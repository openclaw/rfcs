---
title: External Automation Deadlines and Schedule-Only Occurrences
authors:
  - Omar Shahine
created: 2026-08-04
last_updated: 2026-08-04
status: draft
issue:
rfc_pr:
---

# Proposal: External Automation Deadlines and Schedule-Only Occurrences

## Summary

OpenClaw should expose one explicit ownership boundary for hosts that must keep
compute available for an Automation deadline. OpenClaw remains authoritative for
the job, schedule, occurrence, execution, and outcome. A host may consume a
reconciled projection of the next deadlines and durably arrange compute, but a
host wake is not an Automation run and cannot complete one. This RFC also
reserves `scheduleOnly` as the accurate name for a possible future occurrence
whose action belongs to an external owner. It does not add that public payload
until OpenClaw defines owner identity, admission, completion, replay, history,
and failure semantics. The proposed `wake` payload in
[openclaw/openclaw#119040](https://github.com/openclaw/openclaw/pull/119040)
should remain paused while this contract is reviewed.

## Motivation

OpenClaw's scheduler assumes the Gateway process remains available. A managed
host may suspend that process between requests, restore it on another machine,
or replace it after a failure. The host therefore needs to know when OpenClaw
will next need compute. It does not need, and should not acquire, ownership of
OpenClaw's job definitions or recurrence calculations.

The current plugin hooks already establish most of the right boundary:

- `cron_reconciled` provides a post-reconciliation baseline tied to a live
  scheduler lifecycle.
- `cron_changed` is a change hint. A consumer can reread `cron.list` instead of
  attempting to apply lossy deltas.
- An abort signal invalidates work from an older scheduler lifecycle.

This is enough to build an external deadline projection. It is not enough to
define how that projection is accepted durably, how stale writers lose, what a
host does with an already-due deadline, or when restored compute is ready to
admit the occurrence.

The proposed `payload.kind = "wake"` takes a different path. When its occurrence
is due, OpenClaw performs no payload work, records a successful run, and advances
the schedule. It does not wake a host. It also creates a new public payload
variant across Gateway schemas, persisted state, the CLI, the Automations tool,
the Control UI, macOS, and Android. That compatibility cost would buy an
ambiguous contract: the history says the occurrence succeeded even though no
external owner is identified and no external action is acknowledged.

Operational evidence from managed-host implementations shows why the boundary
must be precise:

- A host can wake successfully while the restored OpenClaw process lacks the
  authoritative job state needed to admit the occurrence.
- A recurring deadline can disappear after its first fire if the host clears a
  one-shot wake record and never reconciles the next OpenClaw deadline.
- Multiple live containers can admit the same occurrence unless the scheduler
  keeps a durable occurrence identity and reservation.
- A payload can finish while delivery fails. Treating the combined run as
  failed can replay side effects; treating it as successful can hide delivery
  loss.
- A pre-wake deadline can produce an immediate-wake loop if the host confuses
  compute activation with the authoritative due time.
- A stale scheduler or restored checkpoint can overwrite a newer projection
  unless replacement is fenced.
- A source process can be removed only after the host has durably accepted the
  exact replacement deadline state.
- Readiness for the Gateway process, the restored schedule state, and a delivery
  destination are separate facts.

These failures are not solved by a no-op payload. They point to a durable
ownership contract.

## Goals

- Keep one canonical owner for every Automation job, recurrence calculation,
  due occurrence, reservation, run, and outcome.
- Define how a plugin projects a bounded, reconciled view of external deadlines
  without exporting prompts, commands, credentials, or delivery payloads.
- Define replacement, cancellation, supersession, restart reconciliation,
  already-due handling, and observability for an external deadline registrar.
- Separate host compute activation from occurrence admission, payload execution,
  delivery, and outcome finalization.
- State the semantics that must exist before OpenClaw can add a public
  schedule-only or externally completed occurrence.
- Preserve compatibility for independently versioned Gateway clients and stored
  Automation data.
- Give implementations a sequence of independently reviewable changes with a
  rollback point after each slice.

## Non-Goals

- Replacing OpenClaw's scheduler, recurrence engine, SQLite store, run history,
  or catch-up policy.
- Standardizing a hosting platform, compute provider, queue, database, blob
  store, lock service, proxy transport, or process supervisor.
- Moving ordinary Automation payloads or delivery data into the host deadline
  projection.
- Defining Teams, webhook, channel, or agent-turn delivery guarantees.
- Defining snapshot creation, final capture, source destruction, or full
  scale-to-zero recovery. This RFC defines the deadline fact those systems may
  consume.
- Defining generic Gateway readiness providers. Deadline admission composes with
  a readiness contract but does not replace one.
- Changing manual-run, one-shot, webhook, failure-alert, or run-history behavior
  for existing payload kinds.
- Adding `wake`, `noop`, `external`, or `scheduleOnly` to the public payload union
  in the first implementation phase.

## Terminology

**Automation**
: The user-facing feature. Existing `cron.*` RPC, config, table, and internal
  identifiers remain unchanged.

**Job**
: OpenClaw's durable Automation definition, including its schedule, payload,
  delivery policy, owner metadata, and mutable scheduler state.

**Occurrence**
: One logical due instance of a job. Its identity is derived from the job and
  scheduled time, not from a process, host wake, or delivery attempt.

**Deadline projection**
: A bounded, replace-all snapshot of enabled jobs and their next known due times.
  It is derived from OpenClaw and is never a second job store.

**Deadline registrar**
: A plugin-owned adapter that accepts a projection and arranges external compute
  availability. It can be local or remote to the Gateway process.

**Host activation**
: The host action that makes compute available. Activation does not reserve,
  run, deliver, or complete an Automation occurrence.

**Scheduler generation**
: An opaque identity for one live reconciled scheduler lifecycle. Work from an
  older generation cannot replace work from a newer accepted generation.

**Destination generation**
: An opaque host identity for the compute instance selected to continue work.

**Readiness generation**
: An opaque identity for one accepted readiness observation on a destination.

**Schedule-only occurrence**
: A possible future Automation occurrence for which OpenClaw calculates and
  records the occurrence while a declared external owner performs the action
  and reports its outcome. It is not part of phase 1.

## Proposal

### 1. OpenClaw remains authoritative

OpenClaw owns:

- job creation, update, disablement, and deletion;
- schedule parsing and next-run calculation;
- one-shot deletion and recurring cadence advancement;
- catch-up and missed-occurrence policy;
- manual and forced-run policy;
- durable occurrence reservation and supersession;
- payload execution and delivery policy;
- run history, hook emission, failure alerts, and final outcome.

The host owns:

- accepting a bounded deadline projection;
- choosing how to retain or restore compute;
- activating compute before or at the projected deadline;
- fencing its own stale writers and lifecycle generations;
- reporting registration state and failures to operators.

The host must not edit recurrence state, locally advance a deadline, synthesize
a successful run, or infer completion from process activation.

### 2. Projection uses the existing plugin lifecycle

The deadline registrar is plugin-owned. It consumes the existing
`cron_reconciled` baseline and `cron_changed` hint, then reads the full current
inventory through `cron.list(includeDisabled: true)`.

The registrar follows these rules:

1. It publishes nothing until `cron_reconciled` establishes a baseline.
2. Every `cron_changed` event triggers or coalesces a full reread. Event payloads
   are hints, not a delta protocol.
3. It sorts and bounds the snapshot before sending it to the host.
4. A newer scheduler lifecycle aborts in-flight work from the older lifecycle.
5. Gateway shutdown aborts and joins the active projection worker.
6. A disabled registrar emits no registrations. If an enabled registrar is
   deliberately disabled, it explicitly clears the projection it owns.

The projected job shape is deliberately narrow:

```ts
type ExternalAutomationDeadline = {
  jobId: string;
  enabled: boolean;
  nextRunAtMs?: number;
};

type ExternalAutomationDeadlineSnapshot = {
  schedulerGeneration: string;
  observedAtMs: number;
  jobs: ExternalAutomationDeadline[];
};
```

The projection omits names, schedules, payloads, prompts, commands, session
keys, destinations, credentials, and run results. `nextRunAtMs` may be absent
when a job is valid but has no externally armable next deadline. Empty snapshots
are authoritative and distinct from read failure.

`schedulerGeneration` is process-local and opaque. It identifies the producing
lifecycle; it is not a global revision and does not need to be stored in the
Automation database. The registrar or host adds its own monotonic revision and
idempotency key when persisting a projection.

### 3. Registration is replace-all and durable

The registrar sends a full replacement. The host accepts it with an operation
equivalent to prepare, commit, and abort:

```ts
type DeadlineRegistrationResult =
  | { status: "accepted"; receipt: string; revision: string }
  | { status: "replay"; receipt: string; revision: string }
  | { status: "superseded"; winningRevision: string }
  | { status: "due"; jobIds: string[] }
  | { status: "unarmable"; jobIds: string[] }
  | { status: "rejected"; reason: string };
```

This is a semantic contract, not a required Gateway RPC or storage schema. A
local plugin can call a host SDK; an isolated process can use a trusted private
transport. OpenClaw core does not learn a hosting provider or remote bearer
format.

The acceptance rules are normative:

- The host derives tenant, user, runtime, and provider scope from trusted
  execution context. The plugin request cannot choose another owner or storage
  scope.
- A registration is durably committed before the host acknowledges acceptance.
- The receipt binds the complete normalized snapshot, scheduler generation,
  owner scope, observation time, revision, and earliest deadline.
- Replaying the same operation is idempotent.
- Reusing an operation identity for different content fails closed.
- A stale expected revision loses to the accepted winner.
- Pending work is not authoritative until commit.
- Commit and abort arbitrate against the same durable version. An ambiguous
  transport result is resolved by reading the accepted state, not by guessing.
- Accepting an empty snapshot removes the prior deadline for that owner.
- A failed inventory read or failed durable write cannot be converted into an
  empty snapshot.

The host may store a digest, count, observation time, earliest deadline, owner
scope, and receipt. It does not need the full OpenClaw job definition after it
has selected the earliest deadline. If it stores job rows for diagnostics or
per-job arming, those rows remain a reconstructable projection.

### 4. Cancellation and supersession are first-class outcomes

Deletion, disablement, schedule edits, lifecycle replacement, and shutdown can
invalidate a pending registration. Cancellation is an operation against one
exact attempt, not an unkeyed request to clear whatever state exists now.

If commit wins, cancellation returns the accepted receipt and the caller
reconciles from the current OpenClaw inventory. If cancellation wins, the
pending attempt cannot later become accepted. A newer committed replacement
cannot be erased by an older abort.

The same rules apply when multiple Gateway processes briefly overlap. Each can
project its view, but only the current accepted revision controls host
activation. A stale writer receives `superseded`; it does not retry blindly
with a higher revision.

### 5. Already-due work is preserved

When the earliest deadline is at or before the registrar's observation time,
the host returns `due`. It must not move the deadline forward, fabricate a new
occurrence, or treat the projection as safely cleared.

`due` means the host should keep or activate compute and allow OpenClaw to
reconcile. On a scale-to-zero host, an accepted due fact vetoes suspension until
one of these events occurs:

- OpenClaw reconciles and publishes a later or empty projection;
- the job is cancelled or superseded in OpenClaw;
- an operator applies an explicit failure policy.

A pre-wake may happen before `nextRunAtMs`, but the host keeps the authoritative
deadline until OpenClaw replaces it. Waking early is not permission to clear the
deadline or advance recurrence.

### 6. Restart and recovery reconcile from OpenClaw

On host or Gateway restart:

1. The host reads its last accepted projection.
2. If the accepted earliest deadline is in the future, it may reconstruct its
   transient wake mechanism from that durable fact.
3. If the deadline is due, it activates compute and retains the due fact.
4. OpenClaw loads its canonical SQLite job and scheduler state.
5. `cron_reconciled` starts a new scheduler generation.
6. The plugin publishes a complete replacement.

The host never reconstructs an OpenClaw job from its deadline journal. OpenClaw
never imports the host's projection as scheduler state.

If the host also restores a captured OpenClaw state database, acceptance of the
capture, selection of a destination generation, restored-state admission, and
readiness belong to their respective recovery contracts. The accepted deadline
receipt may be bound to those facts, but it does not replace them.

### 7. Activation, readiness, and occurrence admission are separate

The lifecycle is:

```text
OpenClaw reconciles jobs
        |
        v
plugin publishes full deadline projection
        |
        v
host durably accepts exact projection
        |
        v
host activates or retains compute
        |
        v
OpenClaw restores state and reconciles a new scheduler generation
        |
        v
OpenClaw reserves, executes, delivers, and finalizes the occurrence
```

A host may coalesce several retained causes, such as an Automation deadline and
an inbound message, into one destination generation. Each cause remains
independent. Readiness for the destination cannot complete the Automation
cause, and completion of one cause cannot erase another.

Where restored delivery requires an external handoff, the dispatch identity
must bind:

- the retained cause or occurrence identity;
- the accepted recovery point, when one exists;
- the destination generation;
- the readiness generation;
- a deterministic dispatch identifier.

The dispatch intent is durable before the semantic owner is invoked. Crash
replay reuses the same identifier. The semantic owner atomically fences its own
side effect and reports completion for that cause. These rules are composition
requirements for hosts that retain more than a deadline. They do not add a
generic delivery queue to OpenClaw cron.

### 8. Existing occurrence behavior does not change

For existing payload kinds:

- startup catch-up remains OpenClaw policy;
- manual and forced runs still create ordinary OpenClaw runs;
- one-shot deletion still depends on OpenClaw's terminal run semantics;
- run history reflects payload and delivery results from OpenClaw;
- `cron_changed` and `cron_reconciled` hooks keep their current meanings;
- webhook delivery and failure alerts keep their current policy;
- a host deadline registration does not emit a run-history entry.

The implementation should continue to reserve an occurrence durably before
execution and finalize only the exact reservation. Occurrence identity must be
stable across overlapping processes and startup catch-up. Host activation IDs
and delivery attempt IDs are not substitutes for the occurrence identity.

### 9. Schedule-only occurrences are a separate protocol decision

OpenClaw may eventually support a job whose schedule is canonical in OpenClaw
while its action belongs to a plugin or host. If accepted, the concept should be
named `scheduleOnly`. `wake` describes a mechanism that may not happen, `noop`
describes an implementation rather than the contract, and `external` does not
say whether the schedule or action is external.

A schedule-only occurrence cannot ship as a no-op payload. Its protocol must
define all of the following:

- an external owner declared when the job is created;
- authorization for the CLI, Automations tool, and Gateway callers to select
  that owner;
- a canonical occurrence ID and durable reservation;
- dispatch or claim semantics and an idempotency key;
- owner acknowledgement, timeout, cancellation, and supersession;
- payload-free or owner-defined action metadata with a bounded schema;
- restart and catch-up policy;
- manual and forced-run policy;
- one-shot deletion policy;
- run-history states for pending, claimed, completed, failed, cancelled, and
  abandoned work;
- hook and failure-alert behavior;
- delivery semantics, including the deliberate absence of delivery;
- a migration and removal plan for experimental payload variants.

Until that protocol is accepted, OpenClaw should expose no new payload
discriminator. A host that only needs compute activation uses the deadline
projection. A system that owns both schedules and actions keeps them outside
OpenClaw.

### 10. Observability

OpenClaw should expose plugin-level structured events or metrics for:

- baseline reconciliation started and completed;
- projection inventory read failed;
- registration accepted, replayed, superseded, due, unarmable, or rejected;
- accepted snapshot digest, bounded job count, and earliest deadline;
- scheduler generation and registrar owner, using opaque bounded identifiers;
- cancellation and shutdown completion.

The host should expose activation, restored readiness, and retained-cause state
separately. Logs must never include job payloads, prompts, credentials, message
content, or private destination data merely to explain a deadline.

Every accepted projection should be inspectable enough for an operator to
answer: which owner published it, which scheduler generation it came from, when
it was observed, which revision won, what the earliest deadline was, and why the
host is or is not keeping compute available.

## Compatibility and migration

Phase 1 adds no public payload kind, Gateway method, config key, or SQLite
column. Existing clients continue to decode the same exhaustive payload union.
Existing Automation stores require no migration.

The plugin contract can be introduced additively:

- Document the existing reconciled-projection pattern as the supported basis.
- Add an opaque scheduler-generation field to plugin hook context only if
  current lifecycle identity cannot be carried safely by the existing abort
  signal and plugin instance.
- Keep the registrar optional and disabled unless a host installs and enables
  it.
- Treat host transports and durable journals as plugin or deployment details.

If an experimental build has persisted `payload.kind = "wake"`, its owner must
provide a one-time migration before removing the runtime reader. No released
OpenClaw version currently establishes that compatibility requirement.

Adding schedule-only occurrences later requires an additive Gateway protocol
change and follow-through in every exhaustive client. Older clients need a
defined display and edit policy for unknown owner-defined occurrence kinds. A
schema discriminator alone is not a compatibility plan.

## Security and privacy

- The host derives owner scope from trusted runtime context. The registration
  request cannot select a tenant, user, provider, storage account, or compute
  destination.
- The projection contains opaque job IDs and deadlines only.
- A public agent tool cannot create schedule-only work until policy can
  authorize the declared external owner.
- A stale process cannot cancel or replace a newer accepted projection.
- Receipts and generation IDs are bounded opaque values, not bearer
  credentials.
- External dispatch, if later added, uses deterministic idempotency identities
  and owner-side atomic fencing. OpenClaw does not claim a side effect completed
  merely because a request was sent.

## Implementation sequence

Each slice remains independently reviewable.

### Slice 1: document and test the projection contract

- Document `cron_reconciled` as the baseline and `cron_changed` as a hint.
- Add contract tests for full reread, authoritative empty state, abort on
  lifecycle replacement, and shutdown join.
- Confirm the plugin can derive a scheduler generation without a new public
  Gateway field. Add an opaque plugin-hook generation only if needed.

Acceptance criteria:

- A plugin reconstructs the exact enabled-job deadline view after restart.
- A read failure cannot clear the last accepted host state.
- An older lifecycle cannot publish after a newer baseline.

### Slice 2: publish a generic registrar interface

- Define the bounded snapshot and semantic result types in the plugin SDK.
- Keep transport, storage, and host credentials outside core.
- Add a reference in-process test registrar.

Acceptance criteria:

- No public cron payload or Gateway method is added.
- The interface carries no payload, prompt, command, destination, or
  credential.
- Empty, due, unarmable, replay, and superseded outcomes are distinguishable.

### Slice 3: prove durable arbitration in a host plugin

- Implement replace-all acceptance with idempotent operation identity.
- Fence stale revisions and prepare/commit/abort races.
- Reconstruct transient host wake state after restart.

Acceptance criteria:

- A stale writer cannot overwrite a newer accepted snapshot.
- Cancellation cannot erase a winner whose commit already succeeded.
- An already-due deadline remains due and vetoes host suspension.
- Crash after durable commit but before response resolves as replay.

This slice can live entirely in a host or plugin repository.

### Slice 4: integrate lifecycle and readiness

- Bind accepted deadlines to the host's source and destination generations.
- Keep host activation separate from Gateway readiness and restored-state
  admission.
- Test overlapping starts, source destruction, restart, and scale-to-zero.

Acceptance criteria:

- Source compute is not removed until the exact replacement deadline state is
  accepted.
- Stale readiness cannot authorize a retained cause.
- Host activation does not create or complete an OpenClaw run.

### Slice 5: decide schedule-only occurrences

Only begin this slice after maintainers approve the owner and completion
protocol in this RFC or a focused follow-up.

- Define owner identity, authorization, claim, acknowledgement, and terminal
  states.
- Specify catch-up, manual-run, one-shot, history, hook, delivery, and alert
  behavior.
- Update Gateway schemas, codecs, SQLite state, CLI, Automations tool, Control
  UI, macOS, Android, and documentation as one compatibility program.

Acceptance criteria:

- Every occurrence has a visible pending or terminal outcome.
- An external acknowledgement is required before success is recorded.
- Independently versioned clients handle the new union member safely.
- No code path calls the occurrence `wake`.

## Rationale

### Alternative A: public `wake` or `noop` payload

This is small in the scheduler but large in the public contract. It creates a
persisted union member across every client and reports success without proving
that an owner acted. The term `wake` already means heartbeat requests, scheduler
wake calls, wake modes, and host activation in OpenClaw. The proposed payload
does none of those reliably. `noop` is honest about implementation but says
nothing about ownership or completion.

Rejected for phase 1. It can be replaced by a complete `scheduleOnly` protocol
if maintainers choose OpenClaw-owned schedules with external actions.

### Alternative B: distinct schedule-only occurrence

This accurately models OpenClaw-owned recurrence with externally owned action.
It can support history and failure semantics, but only with an owner identity
and acknowledgement protocol. It is the right future abstraction when that
product need is approved.

Deferred. It is not required for host compute activation.

### Alternative C: plugin-owned host registration from reconciled projection

This preserves one source of truth and uses existing lifecycle hooks. It adds no
public payload variant and keeps provider-specific transport and storage out of
core. Durable arbitration and recovery can be implemented by the host that owns
those concerns.

Selected for phase 1.

### Alternative D: scheduling entirely outside OpenClaw

This is appropriate when an external system owns the schedule, action, history,
and retry policy. It avoids duplicate contracts, but the Automation does not
appear as an OpenClaw job and cannot use OpenClaw catch-up, manual-run, history,
or one-shot behavior.

Supported as an operator choice. It is not a substitute when OpenClaw owns the
Automation schedule.

### Alternative E: replace OpenClaw's scheduler with a pluggable scheduler

[RFC PR #5](https://github.com/openclaw/rfcs/pull/5) proposes a broader seam in
which an external scheduler can become canonical. That may serve deployments
that want external ownership of all scheduled work. A host that only needs the
next deadline should not take over job storage, recurrence, or execution.

Not selected for this problem. The two proposals can coexist if their owner
modes are mutually exclusive and explicit.

## Relationship to current work

- [Issue #114145](https://github.com/openclaw/openclaw/issues/114145) describes
  nullable external deadlines derived from reconciled cron projection hooks.
  This RFC supplies the missing durable ownership and lifecycle contract.
- [Issue #103205](https://github.com/openclaw/openclaw/issues/103205) and
  [PR #103647](https://github.com/openclaw/openclaw/pull/103647) introduced the
  projection hooks.
- [PR #104368](https://github.com/openclaw/openclaw/pull/104368) added exact
  lifecycle cancellation for reconciled hooks.
- [PR #103618](https://github.com/openclaw/openclaw/pull/103618) and
  [PR #103925](https://github.com/openclaw/openclaw/pull/103925) define current
  suspension behavior. Suspension pauses automatic cron dispatch but does not
  transfer schedule ownership.
- [PR #105718](https://github.com/openclaw/openclaw/pull/105718) added SQLite
  snapshots. [PR #112385](https://github.com/openclaw/openclaw/pull/112385),
  [PR #112865](https://github.com/openclaw/openclaw/pull/112865), and
  [PR #112896](https://github.com/openclaw/openclaw/pull/112896) propose broader
  recovery-point, final-capture, and restored-admission contracts. Deadline
  acceptance composes with those proposals but does not depend on their public
  Gateway surfaces.
- [RFC PR #46](https://github.com/openclaw/rfcs/pull/46) discusses recovery
  lifecycle composition. This RFC remains standalone and does not make that
  draft addendum a prerequisite.
- [RFC 0026](https://github.com/openclaw/rfcs/blob/main/rfcs/0026-automations-terminology.md)
  records the current “Automations” product terminology direction while
  retaining `cron.*` technical identifiers.
- [PR #119040](https://github.com/openclaw/openclaw/pull/119040) and
  [issue #119035](https://github.com/openclaw/openclaw/issues/119035) should be
  resolved against this ownership decision before adding a public union member.

## Unresolved questions

The following decisions require named maintainer approval:

1. **Cron and Automations owners:** Is OpenClaw permanently authoritative for
   occurrences in the host-activation use case?
2. **Plugin SDK owners:** Should scheduler generation become an explicit hook
   field, or is hook-instance identity plus the abort signal sufficient?
3. **Gateway protocol owners:** If schedule-only occurrences proceed, what is
   the additive compatibility policy for older exhaustive clients?
4. **Storage owners:** Does a schedule-only occurrence fit the existing
   `cron_jobs` schema without a version bump, and which state records external
   claim and acknowledgement?
5. **Automations tool owners:** Which callers may select an external owner, and
   how does policy expose only owners available in the current runtime?
6. **Delivery owners:** Does external completion include delivery, or are action
   and delivery acknowledged independently?
7. **Recovery and readiness owners:** Which accepted recovery, destination, and
   readiness generations must gate a restored external dispatch?
8. **Product terminology owners:** Is `scheduleOnly` the accepted public term if
   the second phase proceeds?
9. **RFC maintainer:** Should #119040 be closed after phase 1 is accepted, or
   retained as an implementation branch for a later schedule-only protocol?
