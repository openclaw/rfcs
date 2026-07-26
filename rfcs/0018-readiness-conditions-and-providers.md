---
title: Readiness Conditions and Providers
authors:
  - Gio
created: 2026-07-09
last_updated: 2026-07-25
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/33
---

# Proposal: Readiness Conditions and Providers

## Summary

Add an opt-in canonical, structured condition result around OpenClaw's existing
Gateway readiness evaluator. Existing startup, drain, channel, and event-loop
observations become core conditions; activated plugins may register bounded,
observational readiness providers; every condition identifies the runtime
subject it observed; and configured `/ready`, `/readyz`, health, status, and an
optional CLI project the same result. Without readiness
configuration or another separately accepted activation contract, the existing
Gateway decision path remains authoritative.

This RFC does not define hosting profiles. Standard Hosting Profiles are a
separate proposal that may compose conditions from this RFC into named support
contracts.

## Motivation

OpenClaw already exposes Gateway `/ready` and `/readyz`. Their fixed evaluator
answers important questions about startup, channel runtime health, drain state,
and event-loop health, but it is not an extensible readiness contract:

- existing observations do not share an iterable condition shape;
- a result cannot identify whether a failed fact belongs to the Gateway,
  configuration generation, plugin, node, storage backend, or another subject;
- plugins cannot contribute bounded readiness observations;
- operators cannot promote a known plugin dependency to required;
- health and status can omit facts or describe them differently; and
- hosts must interpret legacy fields and add private scripts for missing facts.

The result is avoidable ambiguity. A process may respond while its workspace is
full, startup dependencies are pending, the Gateway is draining, or a required
plugin-owned backend is unavailable. These are readiness questions, not new
liveness endpoints and not reasons for each host to invent a private protocol.

The proposed invariant is:

```text
core Gateway observations
+ core runtime observations
+ activated plugin-provider observations
-> one canonical readiness result
-> /ready, /readyz, health, status, optional CLI
```

Required `False` or `Unknown` conditions fail readiness. Advisory conditions
remain visible without causing an outage. Existing installations preserve their
current readiness path unless an operator adds `gateway.readiness` or selects a
separately accepted Standard Hosting Profile.

### Evidence from existing issues

| Issue | Observed gap | Contract implication |
| --- | --- | --- |
| [openclaw#96084](https://github.com/openclaw/openclaw/issues/96084) | `/readyz` remains healthy when a PVC-backed workspace is full. | Workspace writability needs a bounded readiness condition. |
| [openclaw#78136](https://github.com/openclaw/openclaw/issues/78136) | Docker readiness remains healthy while the command queue is draining. | Admission state must remain a required readiness input. |
| [openclaw#73652](https://github.com/openclaw/openclaw/issues/73652) | The Gateway accepts connections before internal startup is ready. | Startup completion needs a stable required condition. |
| [openclaw#78954](https://github.com/openclaw/openclaw/issues/78954) | Channel/plugin sidecars can block a usable core Gateway. | Readiness needs explicit required versus advisory classification. |
| [openclaw#101083](https://github.com/openclaw/openclaw/issues/101083) | A channel can appear healthy while retrying a fatal login error. | Channel runtime truth should use the canonical result. |

## Goals

- Define one stable readiness-condition shape and aggregation rule.
- Define one bounded identity package so conditions can reference core- and
  plugin-owned subjects without copying identity fields into every condition.
- Normalize existing Gateway readiness observations into core conditions.
- Preserve existing response fields as compatibility projections.
- Add activation-scoped plugin readiness providers through the plugin SDK.
- Keep provider execution bounded, observational, enumerable, and fail-closed.
- Let operators explicitly select additional registered core or plugin
  criteria as required or advisory without selecting a hosting profile.
- Project one result through HTTP readiness, health, status, and an optional
  `openclaw ready` command.
- Add missing runtime status facts alongside conditions rather than creating a
  parallel evidence store.
- Keep detailed readiness output authenticated or local while preserving the
  compact unauthenticated probe response.

## Non-Goals

- Define standard or custom hosting profiles.
- Add profile selection, profile inheritance, or release profile conformance.
- Replace `openclaw.json` or create a second configuration system.
- Define OCC resources, placement, tenants, or an AgentHarness protocol.
- Make readiness depend on Doctor, policy, telemetry, or another optional
  subsystem.
- Permit arbitrary runtime code, shell commands, or remote probes in config.
- Make readiness prove checkpoint durability, safe shutdown, compatibility, or
  safe destruction.
- Standardize Docker, Kubernetes, or systemd probe intervals and retries.

## Proposal

The implementer-facing v1 contracts are captured in
[`0018/readiness-v1-spec.md`](0018/readiness-v1-spec.md) and the focused
[`0018/readiness-subjects-v1-spec.md`](0018/readiness-subjects-v1-spec.md)
sidecar. This RFC remains the design rationale, compatibility argument, and
rollout plan; the sidecars are the concise schema, identity, provider-lifecycle,
evaluation, projection, and conformance references for OpenClaw runtime and
plugin implementations.

### Canonical condition model

Every readiness observation is represented as:

```ts
type ReadinessConditionStatus = "True" | "False" | "Unknown";
type ReadinessRequirement = "required" | "advisory";

type ReadinessCondition = {
  type: string;
  subjectRef: string;
  relatedSubjectRefs?: string[];
  observedAtMs?: number;
  status: ReadinessConditionStatus;
  requirement: ReadinessRequirement;
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

`type` identifies the condition contract. The stable comparison key is
`(subjectRef, type)`. `reason` is a stable machine-readable state or failure
reason. `message` is redacted operator guidance and is not part of machine
matching.

Aggregation is deliberately simple:

| Requirement | Effect of `False` or `Unknown` |
| --- | --- |
| `required` | `ready=false`; reason appears in `failures`. |
| `advisory` | Overall readiness is unchanged; reason appears in `advisories`. |

An unobserved required fact is `Unknown`, never inferred as `True`. Duplicate
condition identities, invalid statuses, or malformed provider results are
converted to stable `Unknown` conditions or reject provider registration; they
must not disappear from the result.

### Subject identity

Readiness is an aggregate over independently owned runtime objects. A Gateway
serving incarnation, active configuration generation, plugin activation,
paired node, model route, storage backend, sandbox, and harness do not share one
useful lifetime. The canonical result therefore declares subjects once and lets
conditions reference them:

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
```

`subjectRef` names the primary object whose state the condition describes.
`relatedSubjectRefs` names bounded dependencies without changing condition
ownership. An aggregate condition uses an explicit aggregate subject and lists
its members as related subjects. Atomic per-subject conditions remain preferred
when individual failures matter.

Core reserves `openclaw/*` references. A plugin declares local `kind` and `key`
values; core derives `plugin.<plugin-id>/<kind>/<key>`, validates every
reference, collapses identical declarations, and rejects conflicting
declarations. Subject `ref` is the stable role used for comparison; `id` and
`generation` identify what currently occupies that role. Subjects and
conditions are deterministically ordered. The focused identity and
reconciliation contract is normative in
[`0018/readiness-subjects-v1-spec.md`](0018/readiness-subjects-v1-spec.md).

### Core conditions

The first implementation normalizes the observations already owned by the
Gateway and adds generally applicable runtime facts where source evidence
justifies them.

| Condition | Requirement | True when | Stable non-ready reasons |
| --- | --- | --- | --- |
| `GatewayStartupComplete` | Required | Startup dependencies and startup sidecars are no longer pending. | `GatewayStartupPending` |
| `GatewayAcceptingWork` | Required | The Gateway is not draining and can admit new work. | `GatewayDraining` |
| `ChannelRuntimeReady` | Required | No selected channel has an unsuppressed runtime-health failure under existing channel policy. | `ChannelRuntimeUnavailable` |
| `ChannelRuntimeSuppressed` | Advisory when present | A channel runtime failure is intentionally suppressed by existing autostart/crash-loop policy. | `ChannelRuntimeSuppressed` |
| `EventLoopHealthy` | Advisory by default; selectable | Existing event-loop health is within its healthy threshold. | `EventLoopDegraded`, `EventLoopStatusUnavailable`, `CriterionEvaluationUnavailable` |
| `ReadinessEvaluationComplete` | Required when emitted | The bounded canonical evaluation completed. This failure-only guard condition is emitted when the evaluator cannot produce its normal condition set. | `ReadinessEvaluationTimedOut`, `ReadinessEvaluationFailed` |
| `GatewayResponding` | Required when observed remotely | The current operation successfully reached the live Gateway. | `GatewayUnavailable`, `GatewayNotChecked` |
| `ConfigLoaded` | Required | The validated effective runtime config snapshot is installed. | `ConfigNotLoaded`, `ConfigInvalid`, `EffectiveConfigUnavailable` |
| `WorkspaceWritable` | Required or advisory when selected | The effective workspace exists and passes a bounded write, flush, and cleanup probe. It is not a new universal blocker by default. | `WorkspaceMissing`, `WorkspaceStorageFull`, `WorkspaceNotWritable`, `WorkspaceProbeFailed`, `WorkspaceProbeTimedOut`, `WorkspaceNotChecked` |
| `PluginsLoaded` | Advisory by default; selectable | The activation-pinned plugin registry is available and selected plugins have no activation errors. | `PluginLoadFailures`, `PluginStatusUnavailable`, `CriterionEvaluationUnavailable` |
| `ConfigCurrent` | Required or advisory when selected | The accepted effective config does not require restart. | `ConfigRestartRequired` |
| `ModelRouteReady` | Required or advisory when selected | The selected model route has usable provider authentication. | `ModelRouteUnavailable`, `ModelAuthUnavailable` |
| `SecretsReady` | Required or advisory when selected | Required secret owners resolved during activation. | `SecretOwnersUnavailable` |
| `SessionStorageReady` | Required or advisory when selected | Session storage passes its bounded write, flush, and cleanup probe. | `SessionStorageMissing`, `SessionStorageFull`, `SessionStorageNotWritable`, `SessionStorageProbeFailed`, `SessionStorageProbeTimedOut` |
| `ContextEngineReady`, `ToolCatalogReady`, `McpRuntimeReady`, `SandboxReady`, `HarnessReady` | Required or advisory when selected | Each configured execution capability has activation evidence from its owning subsystem. An intentionally unconfigured optional capability is satisfied. | Owner-specific unavailable, failed, or unobserved reasons. |
| `StateReady`, `DeliveryRuntimeReady`, `SchedulerReady` | Required or advisory when selected | Existing state and background-service snapshots report their current observed status. | Owner-specific unavailable, degraded, or unobserved reasons. |

Changing an advisory core condition to required is a compatibility-sensitive
behavior change. It requires focused review and release notes because it can
change `/ready` from `200` to `503` for an existing deployment.

These selectable core conditions consume bounded, redacted observations from
their owning subsystems. Readiness polling must not reload plugins, reacquire
secrets, issue a model request, connect MCP servers, start a sandbox or harness,
open the state database, or start a scheduler.

### Readiness providers

Only an activated OpenClaw plugin can register executable provider code. Core
conditions continue to use internal evaluators. Operators and control planes
may reference provider IDs; they cannot inject callbacks through config.

```ts
type PluginReadinessResult = {
  subjectRef?: string;
  relatedSubjectRefs?: string[];
  observedAtMs?: number;
  status: "True" | "False" | "Unknown";
  reason: string;
  message: string;
};

type PluginReadinessProvider = {
  id: string;
  description: string;
  check(context: {
    config: OpenClawConfig;
    pluginConfig: unknown;
    signal: AbortSignal;
    subjects: PluginReadinessSubjectCollector;
  }): Promise<PluginReadinessResult> | PluginReadinessResult;
};

type RegisterReadinessCriterion = (
  provider: PluginReadinessProvider,
) => void;
```

Example:

```ts
api.registerReadinessCriterion({
  id: "backend",
  description: "Reports whether the plugin backend can accept work.",
  async check({ pluginConfig, signal, subjects }) {
    const backend = subjects.declare({
      kind: "backend",
      key: "primary",
      identity: { id: "configured-backend" },
    });
    return (await probeBackend(pluginConfig, { signal }))
      ? {
          subjectRef: backend,
          status: "True",
          reason: "BackendReady",
          message: "Backend is reachable.",
        }
      : {
          subjectRef: backend,
          status: "False",
          reason: "BackendUnavailable",
          message: "Backend is unreachable.",
        };
  },
});
```

Core publishes the condition as `plugin.<plugin-id>.backend`. Registration is
bound to the activated plugin registry snapshot. Reload replaces the complete
provider set atomically with the next activation; stale callbacks do not remain
registered.

Each invocation receives a fresh subject collector bound to the activated
plugin namespace. `declare` returns a canonical subject reference and records a
bounded declaration for reconciliation. A provider may reference documented
core subjects but cannot declare or replace them. If a provider omits
`subjectRef`, core assigns the criterion's default plugin-owned subject. Invalid,
unresolved, conflicting, or excessive declarations become
`CriterionInvalidResult=Unknown`; partial raw identity output is never
projected.

The bundled Policy plugin is the concrete v1 example. When activated, it
registers `plugin.policy.conformant`, reuses its existing policy evaluator, and
reports `True` when evaluation has no findings, `False` with a bounded finding
count when findings exist, and `Unknown` when policy checks are disabled. The
provider remains inert until an operator selects it. Selecting it as advisory
exposes drift without changing `/readyz` from `200`; selecting it as required
makes nonconformance block readiness.

Provider descriptors are enumerable without invoking callbacks. The active
registry exposes provider identity, description, owning plugin, and source; the
registry snapshot itself is the activation-generation boundary. Future status
or diagnostics may project that descriptor catalog without executing providers.

Providers must be:

- read-only and observational;
- idempotent under repeated invocation;
- safe under concurrent invocation or protected by core coalescing;
- cancellation-aware;
- free of blocking synchronous I/O; and
- redacted by construction.

Core owns namespacing, validation, invocation, deadlines, cancellation,
coalescing, caching, error conversion, and result ordering. A provider cannot
alter another provider's condition or any core condition.

Provider `reason` values use a bounded machine-readable token grammar. Public
messages must be non-empty, contain no NUL bytes, and fit within 512 UTF-8
bytes after core redaction. Invalid output becomes
`CriterionInvalidResult=Unknown`; raw provider output never bypasses these
checks.

### Operator-selected readiness conditions

OpenClaw's universal Gateway lifecycle conditions always apply and cannot be
removed. Beyond that baseline, an operator may explicitly select registered
core or plugin criteria through Gateway readiness config without selecting a
hosting profile:

```json5
{
  gateway: {
    readiness: {
      requiredCriteria: [
        "openclaw.workspace-writable",
        "plugin.storage.backend",
      ],
      advisoryCriteria: [
        "openclaw.event-loop-healthy",
        "plugin.metrics.exporter",
        "plugin.policy.conformant",
      ],
    },
  },
}
```

Provider criteria are advisory unless selected as required. Selector syntax is
validated in config. A syntactically valid ID that is not present in the active
registry produces `CriterionNotRegistered=Unknown` with its selected
requirement; it cannot be silently ignored. Configuration changes are applied
through the normal validated config lifecycle. This RFC does not add a policy
language or a way to redefine criteria semantics.

This explicit list is a complete standalone use of RFC 0018. An operator can
say exactly which additional observations must pass for its deployment without
creating or selecting a profile. RFC 0023 adds reusable, named, release-tested
presets over the same selection mechanism.

### Bounded evaluation

Readiness is a hot operational endpoint and must return within code-owned
limits even when a provider is slow or broken.

The initial implementation uses layered bounds:

- a one-second deadline per plugin provider;
- a one-second deadline for the workspace probe;
- concurrent evaluation of independent observations;
- cancellation signals for cooperative providers; and
- an independent two-second outer watchdog for the complete result.

A timeout becomes `Unknown` with a stable reason. A required timeout returns
`503`; an advisory timeout remains visible without blocking. The outer watchdog
fails closed with a required `ReadinessEvaluationComplete=Unknown` condition
rather than allowing `/ready`, `/readyz`, health, or status to hang or reject.
Unexpected error details are not copied into the public result.

Core retains ownership of a provider invocation after its deadline. If a
provider ignores cancellation and remains pending, later readiness polls reuse
the stable timeout result and do not start another invocation. A new invocation
may begin only after the original callback settles and the result cache expires.
Publishing a replacement plugin registry or effective config snapshot aborts
the prior generation, clears its cache, and prevents late settlement from
entering the active result.

Workspace probes use the same generation fence but permit one replacement
probe when the effective workspace changes, so a blocked retired filesystem
does not pin the new workspace. At most two workspace probes may remain in
flight; further generations fail closed until capacity returns.

In-process timers cannot interrupt synchronous JavaScript that blocks the event
loop. Providers therefore may not perform blocking synchronous I/O. Process or
worker isolation for malicious plugins is outside this RFC.

### Canonical projections

`/ready` and `/readyz` remain the authoritative host probes. Authenticated or
local callers receive the structured result; unauthenticated remote probes
retain a redacted boolean response. `HEAD` behavior remains unchanged.

The same result is projected through Gateway health and status. A surface that
did not observe a required live fact reports `Unknown`; it does not synthesize
success. `/health` and `/healthz` remain shallow liveness and do not acquire
readiness semantics.

An optional `openclaw ready` command may be a thin client of the live Gateway
result:

- human output lists non-`True` conditions;
- `--json` preserves the canonical result; and
- exit status is nonzero for required failure, required unknown, transport
  failure, or a missing readiness contract.

The CLI must not implement a second evaluator.

### Compatibility

Canonical readiness evaluation is opt-in. When `gateway.readiness` and any
separately accepted activation contract are both absent, the Gateway invokes
only its legacy lifecycle and channel checker; provider or runtime-evaluator
failure cannot create a new `503`. Presence of `gateway.readiness`, including
an empty object, activates bounded canonical evaluation. A separately accepted
Standard Hosting Profile may also activate canonical evaluation as part of
profile selection.

Existing `ready`, `failing`, `suppressed`, `eventLoop`, and `uptimeMs` fields
remain compatibility projections during migration. New consumers use
`conditions`, `failures`, and `advisories`.

The migration order is:

1. preserve the legacy decision path when canonical readiness is not activated;
2. emit canonical conditions beside legacy fields after activation;
3. make every activated projection consume the same canonical evaluator;
4. migrate internal and external consumers; and
5. consider legacy-field removal only through a separate compatibility review.

Activated installations gain structured output but do not gain new required
workspace or plugin dependencies. Registering or implementing an additional
criterion does not make it required. Only explicit operator configuration or a
separately selected standard profile changes the additional readiness gate.

### Readiness transitions

A later implementation may emit bounded, redacted events when overall
readiness or a condition changes. Event names, initial observation,
deduplication, restart behavior, and behavior without active polling require a
separate review. Telemetry sinks, dashboards, alerting, and retention remain
host responsibilities.

### Relationship to Standard Hosting Profiles

Standard Hosting Profiles depend on this RFC rather than sharing its acceptance
decision. A profile is a named preset of required and advisory criteria plus a
support promise. It cannot change condition evaluation, provider lifecycle, or
aggregation. Operators that do not need that support contract use
`gateway.readiness` directly.

This separation allows OpenClaw to accept structured, subject-aware readiness
and provider extensibility without committing to profile names, profile
selection config, or a release support matrix. Profiles reuse the identity
package rather than adding a profile-only activation envelope.

### Implementation plan

The primary implementation for this RFC is
[openclaw/openclaw#104018](https://github.com/openclaw/openclaw/pull/104018).
Its upgrade boundary keeps unconfigured probes on the legacy checker and makes
the presence of `gateway.readiness` the explicit canonical activation signal.
It is one upstream PR with eighteen ordered commits at exact head `57d627464a23`.
The opt-in compatibility amendment passes 154 focused readiness, live Gateway,
HTTP/RPC, health, selector, registry, and CLI assertions; type-aware lint,
formatting, and diff checks pass. Timed-out plugin checks remain single-flight
until the original callback settles, even when the plugin ignores cancellation;
provider output is bounded, validated, and redacted. Config publication fences
provider and workspace evidence by runtime generation, including recovery when
a retired filesystem probe never settles, while retaining a strict two-probe
ceiling across repeated generation changes. A prior package-installed
Docker lane proved `/ready` and `/readyz`
transition `200 -> 503 -> 200` for a selected workspace failure and recovery,
`/healthz` remains live, and `openclaw ready --json` exits `0 -> 1 -> 0` with
the same canonical condition. Exact-head remote container and published-upgrade
proof must be refreshed before landing. Reviewers should use that PR for the
proposed landing shape and current validation state.

The first core-owner adoption is consolidated in
[openclaw/openclaw#113421](https://github.com/openclaw/openclaw/pull/113421),
stacked at exact readiness head `57d627464a23` and exact implementation head
`9257236adfa5`. It adds selectable core-owner criteria,
execution-capability, session-storage, state, delivery, and scheduler
observations without selecting any of them by default. Fork PRs
[#153](https://github.com/giodl73-repo/openclaw/pull/153),
[#154](https://github.com/giodl73-repo/openclaw/pull/154), and
[#155](https://github.com/giodl73-repo/openclaw/pull/155) preserve the three
owner-area review slices; PR 113421 is the intended merge unit.

The fork PRs below expose the implementation as optional smaller review
slices. They are supporting review aids, not alternative landing PRs:

| Slice | Draft PR | Intended scope |
| --- | --- | --- |
| Canonical core conditions | [PR 17](https://github.com/giodl73-repo/openclaw/pull/17) | Normalize existing Gateway observations and compatibility projections. |
| Workspace readiness | [PR 22](https://github.com/giodl73-repo/openclaw/pull/22) | Add the bounded `WorkspaceWritable` condition without profile behavior. |
| Readiness providers | [PR 23](https://github.com/giodl73-repo/openclaw/pull/23) | Add activation-scoped provider registration and operator-required criteria, without custom profiles. |
| Canonical readiness CLI | [PR 27](https://github.com/giodl73-repo/openclaw/pull/27) | Add a thin CLI projection of the live result. |
| Readiness subjects | [PR 161](https://github.com/giodl73-repo/openclaw/pull/161) | Add the shared producer/subject identity package and condition attribution used by core and plugins. |

Profile selection, node-mode composition, profile subject attribution, and packaged
profile release conformance move to the Standard Hosting Profiles RFC and its
separate implementation stack.

The earlier consolidated draft remains useful behavior evidence, but it is not
the proposed landing shape. The slices above can land without accepting profile
names, profile selection, profile subject attribution, or release conformance.

#### Follow-on condition adoption

The framework should not grow through one PR per condition. Follow-on adoption
is grouped by the OpenClaw owners that already maintain the underlying runtime
facts. Each bucket is one reviewable implementation unit; individual conditions
may be deferred when their owner does not yet expose a bounded activation
snapshot.

| Bucket | Candidate conditions | Existing owner evidence | Proposed PR scope |
| --- | --- | --- | --- |
| Runtime activation integrity | `SecretsReady`, `ModelRouteReady`, `ConfigCurrent`, selectable `PluginsLoaded`, selectable `EventLoopHealthy` | Degraded secret-owner snapshots, model-auth and route resolution state, runtime config/reloader state, plugin activation and configured-unavailable state, Gateway event-loop snapshot | Project activation-pinned facts and existing canonical Gateway facts into selectable or advisory conditions. Do not resolve secrets, contact a model, reload plugins, or create a second event-loop probe during readiness evaluation. |
| Agent execution capabilities | `ContextEngineReady`, `ToolCatalogReady`, `McpRuntimeReady`, `SandboxReady` or `HarnessReady`; defer `SkillsReady` until bounded owner evidence exists | Context-engine and tool-schema quarantine records, MCP runtime ownership, sandbox and harness runtime state | Let each selected execution owner publish a bounded condition. Optional capabilities remain advisory unless explicitly selected as required. Do not rebuild the skill inventory in the readiness path. |
| State and background services | `StateReady`, `SessionStorageReady`, `DeliveryRuntimeReady`, `SchedulerReady`; defer `RestoreComplete` until a restore fence exists | State/store activation, bounded persistence-location probes, delivery runtime ownership, cron lifecycle and startup recovery state | Report whether configured stateful services can accept new work. A selected storage probe may perform a capped write/fsync/unlink check, but historical dead letters and individual job failures remain diagnostics or advisories rather than universal blockers. Do not infer restore completion from database-open, fleet-restore, or config-migration state. |
| Hosted dependencies | `HostBindingsReady`; defer `EgressReady` and `ManagedConfigApplied` until their owners publish authoritative facts | RFC 0020 host-integration bundle and owner-generation evidence | Project required host bindings through the ordinary readiness selector. Keep network probing, config inference, Lobster, OCC, tenant, and deployment policy out of the condition evaluator. |

All four buckets now have fork evidence slices. The first three are stacked
directly on the exact head of the primary readiness implementation. The fourth
is stacked on an explicit composition of that readiness head with RFC 0020 host
integration package 3. They remain optional follow-on work and are not
prerequisites for accepting this RFC:

- [Runtime activation integrity PR 153](https://github.com/giodl73-repo/openclaw/pull/153)
  adds selectable `ConfigCurrent`, `ModelRouteReady`, and `SecretsReady`
  conditions plus quarantine-aware plugin activation evidence.
- [Agent execution capabilities PR 154](https://github.com/giodl73-repo/openclaw/pull/154)
  adds selectable context-engine, tool-catalog, MCP, sandbox, and harness
  conditions. MCP discovery is captured for every configured agent when the
  Gateway accepts a runtime configuration; readiness evaluation does not
  connect to MCP servers or start any execution surface. `SkillsReady` remains
  deferred because the current skill inventory path is not a bounded readiness
  source; the skills owner must first publish an activation snapshot or index.
- [State and background services PR 155](https://github.com/giodl73-repo/openclaw/pull/155)
  adds selectable state-database, session-storage, durable session-delivery,
  and scheduler lifecycle conditions. Owners publish synchronous process-local
  snapshots. The selected storage condition uses a one-second, target-capped,
  concurrency-capped, generation-safe write/fsync/unlink probe over resolved
  persistence parents; failures are redacted. Readiness does not open SQLite,
  install delivery recovery, import or start cron, scan queues, or run recovery.
  `RestoreComplete` remains deferred until OpenClaw owns a generic restore
  generation and admission fence.
- [Hosted dependencies PR 156](https://github.com/giodl73-repo/openclaw/pull/156)
  adds selectable `openclaw.host-bindings-ready` and connects RFC 0020 bundle
  declarations to the active core/plugin criterion catalog. Selecting the
  aggregate includes referenced criteria as advisory detail without requiring
  operators to repeat the bundle's selectors. A required contribution fails
  the aggregate for missing, incompatible, unresolved, stale, degraded, or
  unavailable owner state, and when a declared criterion is absent, `False`,
  or `Unknown`; optional contributions remain visible without blocking it.
  Status and Doctor name unresolved selectors, recursive aggregate references
  are prohibited, and manifests are capped at 64 unique selectors. Evaluation
  uses one bounded in-memory bundle/evidence snapshot. Real endpoint coverage
  proves `/ready` returns `200 -> 503 -> 200` across owner-generation failure
  and recovery. Generic `EgressReady`, `ManagedConfigApplied`, and
  `RestoreComplete` remain deferred until their owners publish authoritative
  facts.

The capability slice passes 14 focused assertions, the state/background slice
passes 145 focused assertions, and the hosted-binding composition passes 142
focused assertions including the real Gateway endpoint transition. The first
two pass production and source-test typechecks; all three pass lint, formatting,
diff checks, and independent review. Capability review
found and fixed an initial default-agent-only MCP snapshot so the final evidence
covers all configured agent workspaces. State/background review verified
disabled, starting, recovery-pending, active, stopped, failed, repaired, and
stale-generation transitions without adding probe-side I/O.

These buckets are adoption work over the v1 framework, not prerequisites for
accepting it. They do not change the v1 aggregation algorithm or make a newly
implemented condition required by default. A condition becomes required only
through explicit `gateway.readiness` selection or a separately accepted Hosting
Profile composition.

Every adoption PR must preserve the owner boundary:

1. expose or reuse a redacted, activation-scoped status fact;
2. map that fact to `True`, `False`, or `Unknown` without mutation;
3. bound evaluation through the v1 provider and outer-evaluator deadlines;
4. test ready, failed, unknown, timeout, recovery, and generation replacement;
5. prove that HTTP, RPC, health, status, and CLI project the same result.

Readiness evaluation must not perform model inference, credential acquisition,
unbounded network discovery, migration, repair, restore, or queue draining.
Those operations remain owner workflows; readiness only observes their current
activation state.

## Rationale

This extends a surface OpenClaw already owns. It does not add a new health
service, policy engine, or hosted envelope. Conditions make the current
evaluator explainable; providers give plugin-owned dependencies a bounded home;
and canonical projections prevent HTTP, status, health, and CLI from drifting.

Keeping providers advisory by default is the critical compatibility rule. A
plugin can improve diagnostics without gaining the power to take down the
Gateway. Operators retain the explicit decision to make a dependency required.

Separating profiles keeps this RFC independently useful and easier to accept.
OpenClaw can modernize readiness first, then decide separately whether named
runtime postures should become release-tested support promises.

## Unresolved questions

- Is `gateway.readiness` the correct config home for operator-required provider
  IDs, or should requirement selection use another existing Gateway surface?
- Which existing advisory observations, if any, should become required in the
  first compatibility-reviewed implementation?
- Should any non-plugin core owner need a public registration API, or should
  core conditions remain internal evaluators?
- What cache lifetime best balances probe cost and freshness for plugin
  providers?
