# Readiness Subjects v1 Specification

This document is the focused identity and reconciliation specification for RFC
0018. The parent readiness specification defines condition evaluation,
aggregation, and projections. This sidecar defines how one canonical readiness
result identifies the producer and the independently owned subjects observed by
its conditions.

Status: draft, tied to RFC 0018.

## Goals

- Make repeated readiness results safely diffable.
- Identify which runtime object owns each condition.
- Let multiple conditions reference one subject without copying identity data.
- Let a condition identify bounded related dependencies.
- Let core and plugins contribute subjects without global-name collisions.
- Preserve owner-defined identity and generation semantics.

This specification does not create a general OpenClaw resource store, require a
hosting profile, define tenant identity, retain readiness history, or authorize
providers to discover arbitrary remote resources.

## Data Model

```ts
type ReadinessSubject = {
  ref: string;
  kind: string;
  id?: string;
  generation?: string;
  parentRef?: string;
};

type ReadinessIdentity = {
  producerRef: string;
  subjects: ReadinessSubject[];
};

type ReadinessCondition = {
  type: string;
  subjectRef: string;
  relatedSubjectRefs?: string[];
  observedAtMs?: number;
  status: "True" | "False" | "Unknown";
  requirement: "required" | "advisory";
  reason: string;
  message: string;
};

type ReadinessResult = {
  evaluatedAtMs: number;
  identity: ReadinessIdentity;
  ready: boolean;
  conditions: ReadinessCondition[];
  failures: string[];
  advisories: string[];
};
```

`evaluatedAtMs` is the Unix epoch time when core assembled the canonical result.
`observedAtMs` is optional and records when the owning subsystem captured the
underlying fact. An omitted `observedAtMs` means the observation was made during
the current evaluation or its capture time is unavailable; it must not be
invented from cache insertion time.

## References And Identity

`ref` is a canonical stable role within readiness results. `id` identifies the
current object occupying that role. `generation` distinguishes owner-defined
revisions of the same object. Consumers compare subjects by `ref`, then inspect
`id` and `generation` to detect replacement or revision.

Examples:

```text
openclaw/process/current
openclaw/gateway/current
openclaw/config/active
openclaw/node/desktop-7
plugin.storage/backend/primary
```

Core references use the reserved `openclaw/` prefix. Plugin references use:

```text
plugin.<canonical-plugin-id>/<local-kind>/<local-key>
```

Plugin `kind` and `key` values are trimmed, lowercased, and must match
`^[a-z0-9][a-z0-9._-]{0,63}$`. Core constructs the reference; providers do not
submit a global reference for declarations. Subject `kind` is the canonical
owner-qualified kind, for example `plugin.storage.backend`.

`id` and `generation`, when present, are opaque bounded values. Consumers must
not parse them or infer security authority from them. Owners define their
lifetime semantics. IDs are not credentials and must not contain secrets,
tenant content, credential-bearing paths, or raw connection strings.

## Producer

`producerRef` identifies the subject that assembled and owns the readiness
decision. A live Gateway result uses its Gateway serving-incarnation subject.
That subject begins when one Gateway serving lifecycle initializes and ends when
that lifecycle is disposed. A subsequent Gateway start, including one in the
same OS process, receives a new ID. Config reload, condition transition, drain,
and repeated evaluation do not change the Gateway subject ID.

The Gateway subject may have an `openclaw/process/current` parent. Process and
Gateway identities are distinct because one process may create more than one
Gateway serving lifecycle over time. OpenClaw generates an opaque random ID by
default. A host-supplied startup override must preserve the same uniqueness and
immutability contract.

A non-live diagnostic projection may use its own producer subject and may
declare an unresolved Gateway subject without an `id`. It must report live
Gateway facts as `Unknown`, not borrow a stale Gateway identity.

## Condition Subjects

Every condition has exactly one `subjectRef`. The pair
`(subjectRef, condition.type)` is unique within one canonical result and is the
stable comparison key across results.

`relatedSubjectRefs` is an optional bounded list of other subjects involved in
the observation. The primary subject remains accountable for the condition.
For example, `ModelRouteReady` may target a route and relate its selected model
and credential owner.

An observation over a collection uses an explicit aggregate subject:

```json
{
  "type": "NodeModeCapacityReady",
  "subjectRef": "openclaw/node-set/scout-desktops",
  "relatedSubjectRefs": [
    "openclaw/node/desktop-7",
    "openclaw/node/desktop-9"
  ]
}
```

When individual failures matter, owners should emit one condition per subject
instead of hiding them behind an aggregate.

## Plugin Subject Collector

Each selected plugin-provider invocation receives a fresh collector bound to
the activated plugin ID:

```ts
type PluginReadinessSubjectCollector = {
  declare(input: {
    kind: string;
    key: string;
    identity?: {
      id?: string;
      generation?: string;
    };
    parentRef?: string;
  }): string;
};
```

`declare` validates the local name, constructs and returns the canonical `ref`,
and records the declaration for the current invocation. Providers use that
returned value as `subjectRef` or `relatedSubjectRefs`. A provider may reference
documented core subjects and may parent its subjects to its own or a documented
core subject. It may not declare, replace, mutate, or parent into another
plugin's namespace.

If a provider emits no explicit primary subject, core assigns:

```text
plugin.<plugin-id>/criterion/<provider-id>
```

This preserves a stable subject for simple providers while allowing richer
providers to identify their actual backend, route, or integration.

## Reconciliation

Core reconciles declarations into one map keyed by canonical `ref` before
projection:

1. Validate all references, kinds, IDs, generations, and parent references.
2. Reject declarations outside the caller's namespace.
3. Merge compatible declarations for the same `ref` when one declaration only
   fills an absent `id`, `generation`, or `parentRef`; this lets an owner enrich
   a core placeholder without changing its canonical reference.
4. Reject different kinds or conflicting non-empty identity fields for the
   same `ref`; never use last-writer wins.
5. Require every primary, related, parent, and producer reference to resolve.
6. Omit unreferenced subjects except the producer and its parent chain.
7. Sort subjects by `ref`, related references lexicographically, and conditions
   by the ordering in the parent readiness specification with `subjectRef` as a
   deterministic tie-breaker.

Invalid plugin declarations or references convert that provider's condition to
`CriterionInvalidResult=Unknown` on its default subject. Invalid core-owned
identity state fails the outer evaluation closed with
`ReadinessEvaluationComplete=Unknown`. No partial invalid identity package may
be projected or cached.

## Bounds

V1 enforces these maximums per canonical result:

- 128 subjects;
- 64 plugin-declared subjects per provider invocation;
- 16 related subjects per condition;
- 192 characters per canonical reference;
- 128 characters each for `kind`, `id`, and `generation`; and
- one parent reference per subject with no cycles.

Provider deadlines and outer readiness deadlines include declaration and
reconciliation work. Subject declaration must perform no I/O.

## Diff Semantics

Consumers may compare canonical results as follows:

- changed `producerRef` target ID means a different readiness authority;
- unchanged `ref` with changed `id` means the role has a different object;
- unchanged `id` with changed `generation` means the owner advanced that
  object's revision;
- unchanged `(subjectRef, type)` with changed status or reason means the same
  subject's condition transitioned; and
- disappearance of a condition means its criterion is no longer selected or
  its owner is no longer active, not that it became `True`.

OpenClaw need not retain result history. Hosts and telemetry consumers may store
and diff bounded canonical results.

## Conformance

An implementation conforms when it proves:

- one Gateway serving lifecycle retains one producer subject across repeated
  evaluations and receives a new ID after disposal and restart;
- all condition and related references resolve;
- `(subjectRef, type)` is unique;
- plugin namespaces cannot collide with core or another plugin;
- compatible declarations merge and conflicting non-empty declarations fail
  closed;
- missing, malformed, cyclic, or excessive declarations return bounded
  structured failure;
- deterministic ordering is stable across equivalent provider completion
  orders;
- provider timeout and cancellation behavior remains bounded while subjects are
  collected; and
- public subject fields contain no secrets or unredacted owner data.
