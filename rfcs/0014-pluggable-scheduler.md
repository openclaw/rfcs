---
title: Pluggable Automations Dispatch Backend
authors:
  - amittell
created: 2026-05-31
last_updated: 2026-08-24
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/5
---

# Proposal: Pluggable Automations Dispatch Backend

## Summary

OpenClaw's shared SQLite database remains the sole public source of truth for Automations jobs, ownership, identifiers, lifecycle, and run history, while an explicitly selected plugin may dispatch a bounded subset of shell/command `cron` and `at` jobs to a separate execution service and return stable receipts for canonical ingestion. Built-in Automations remain the default, unsupported jobs stay built-in, and no provider can replace the public `cron.*` catalog or history surfaces. This seam should be implemented only after maintainers confirm recurring independent demand and a named conforming provider ships with an onboarding and enablement path.

## Motivation

Built-in Automations already persist jobs and run history in shared SQLite and
support command, script, system-event, and agent-turn payloads, retries,
background tasks, delivery, and recovery. OpenClaw Task Flow and Lobster also
cover native flow and approval use cases. An external scheduler is therefore
not needed for ordinary persistence, retry, history, or workflow behavior.

A narrower operational need remains: some operators want compatible shell work
to continue in a separate failure domain while the Gateway is unavailable. The
maintained
[`openclaw-scheduler`](https://github.com/amittell/openclaw-scheduler) 0.5.2
service demonstrates that use case with `cron` and `at` schedules, shell,
agent, and system-event-style targets, a separate SQLite store, dispatcher
fencing, approvals, and a delivery outbox. It currently integrates through
public Gateway APIs and does not implement an OpenClaw plugin contract.

The missing boundary is not external ownership of OpenClaw's catalog. It is a
small, explicit way for OpenClaw to dispatch compatible jobs to a different
execution service and ingest their results without creating a second public
inventory, a second run-history authority, or duplicate execution.

One maintained project is existence evidence, not sufficient evidence that a
permanent core SDK seam meets OpenClaw's recurring-demand rule. Acceptance must
also identify independent requests or integrations that need the same bounded
contract. If that evidence does not exist, the RFC should be declined and
external schedulers should continue using public Gateway APIs.

## Goals

- Keep shared SQLite authoritative for every public Automation job and run.
- Keep built-in Automations unchanged when no backend is selected.
- Let an operator opt a compatible shell/command job into one registered
  dispatch backend.
- Prevent the built-in timer and an external backend from arming the same job
  revision at the same time.
- Ingest bounded, replay-safe backend receipts into canonical OpenClaw history.
- Keep existing `cron.*` callers, authorization, ordering, pagination, hooks,
  tasks, retention, and deleted-job history on one OpenClaw-owned path.
- Require a conforming provider, user-visible onboarding, and recurring-demand
  evidence before the SDK seam lands.

## Non-Goals

- Replacing the built-in scheduler or making an external package a default.
- Giving a provider ownership of public job specifications, job identifiers,
  run identifiers, run history, caller scopes, scratch state, or lifecycle.
- Merging provider and core catalogs or histories at request time.
- Moving `openclaw-scheduler` into core or standardizing its private graphs,
  approvals, leases, queue, or outbox.
- Supporting every current Automation schedule and payload in v1.
- Migrating an existing sidecar database, importing provider-owned jobs, or
  transferring canonical ownership between stores.
- Sending system heartbeat jobs or internal plugin-scheduled turns to an
  external backend in v1.
- Sending agent-turn or system-event payloads to an external backend in v1.
- Hot failover to built-in execution when a backend is unavailable.

## Proposal

### Canonical owner boundary

OpenClaw's shared SQLite database remains the sole authority for:

- public job specifications, revisions, enablement, ownership, and caller
  authorization;
- canonical job and run identifiers;
- backend assignment and dispatch state;
- `cron.list`, `cron.get`, `cron.status`, `cron.runs`, and scratch state;
- run history, including history retained after a job is deleted; and
- task, hook, delivery, reconciliation, retention, and lifecycle projections.

The backend is an operational dispatcher, not another public scheduler owner.
It receives a closed manifest for one admitted canonical job revision, arms or
disarms that manifest, executes it, and returns stable receipts. It cannot
create or edit canonical jobs, choose caller scope, publish rows directly to
`cron.*`, or mutate canonical history. Provider-private graph children remain
private and never appear as OpenClaw Automations.

Consequently, `cron.list` and `cron.runs` always query one SQLite snapshot and
retain their current authorization, filtering, sort, pagination, and failure
semantics. No request-time provider fetch or mixed-owner merge is added.

### Discovery and explicit job selection

Add an additive, array-valued manifest declaration and matching registration:

```json
{
  "id": "durable-scheduler",
  "activation": { "onStartup": true },
  "contracts": {
    "automationDispatchBackends": ["durable-scheduler"]
  }
}
```

The plugin registers the declared identifier through a versioned
`api.registerAutomationDispatchBackend(...)` SDK surface. Manifest discovery
and configuration validation happen before executing the plugin, and the
runtime registration must match the declaration.

This is not an exclusive global plugin slot. A canonical job has an optional
dispatch-backend assignment; omission means built-in execution. The operator
must explicitly set a backend when creating or updating a compatible job, for
example with a future `--dispatch-backend durable-scheduler` flag. Installing
or enabling a plugin alone changes no jobs.

The first conforming provider must ship with a named normal-user path that:

1. surfaces the provider during `openclaw onboard` or an equivalent first-run
   setup flow;
2. installs and configures the provider without hand-editing internal state;
3. explains the separate-failure-domain tradeoff;
4. makes per-job opt-in visible in CLI, tool, and status output; and
5. gives `doctor` or status output an actionable recovery path.

An SDK registration without that path is a dark-shipped capability and does
not satisfy this RFC.

### Fixed v1 compatibility subset

V1 admits only jobs that map losslessly to the current
`openclaw-scheduler` 0.5.2-shaped execution boundary:

- `cron` expressions and one-shot `at` schedules;
- shell/command execution.

The conformance contract must define exact field and delivery mappings rather
than infer support from those category names. In particular, every admitted
timezone, misfire, retry, delivery, and completion semantic must have an exact
representation on both sides.

Agent-turn and system-event payloads stay built-in because their canonical
model, provider, token-usage, session, and task facts are owned by live
OpenClaw execution, not by a provider receipt. Intervals, `on-exit`, stream
schedules, script payloads, triggers, pacing modes, heartbeat monitors,
internal plugin-scheduled turns, and any other shape without a lossless mapping
also stay on the built-in scheduler. Selecting an external backend for an
incompatible job fails before mutation with a message that names the
unsupported feature and the built-in alternative. There is no silent fallback
after a backend has admitted a revision.

### Bounded manifest lifecycle

Core records desired and active dispatch revisions next to the canonical job.
A manifest is closed and size-capped and contains only the facts needed to
schedule and execute the compatible job, including:

- a host-issued operation id;
- canonical job id and revision;
- schedule and compatible execution payload;
- a backend id; and
- an opaque, content-bound manifest digest.

Creation and update use a bounded idempotent handshake:

1. Core validates authorization and compatibility and persists the desired
   revision as not armed.
2. The backend idempotently stages the manifest by operation id and returns its
   digest without arming it.
3. Core verifies the digest. For replacement, the backend fences the old
   revision and returns its terminal cursor and bounded active-run liabilities.
4. Core settles the cursor, persists those liabilities, durably authorizes the
   exact new digest, and sends a single-use activation token.
5. The backend validates the token, arms the new revision, and returns an
   activation receipt.
6. Core verifies the receipt, marks the revision active, and only then reports
   success.

Startup resumes an incomplete operation by operation id and receipt. While an
external revision is authorized or active, the built-in timer must not arm
that job. First assignment quiesces built-in admission and waits for or cancels
every already-admitted built-in run before the backend may arm the revision.

For external revision replacement, the backend's fence closes old admission,
and core first ingests old terminal receipts through the returned cursor. The
replacement-fence receipt also lists the bounded set of old backend run ids
still active at that fence. Core persists those ids as authorized liabilities
before the new revision is authorized or armed and accepts their later terminal
receipts against the old revision. If the set exceeds its bound, replacement
waits for it to drain. Every other stale-revision receipt is rejected.

`cron.run` remains a complete public operation for assigned jobs. Core
authenticates the request, creates a canonical run id and durable pending
admission, and asks the backend to idempotently admit that exact active revision
by operation id. The backend returns its globally unique run id and current
dispatcher fence; core persists the mapping before acknowledging the run. Its
terminal result arrives through normal receipt ingestion. Rejection or backend
absence is an explicit `cron.run` failure and never falls back to built-in
execution. Startup reconciles an uncertain manual admission by operation id
before it may retry, so a lost response cannot create a second run.

Disable, deletion, backend reassignment, and plugin uninstall first require the
backend to stop new dispatch for the active revision. It then finishes or
cancels already admitted executions and returns a disarm receipt bound to a
terminal receipt cursor and dispatcher fence. Core ingests through that cursor
before settling the change. If the backend is unavailable, the canonical job
remains visible and degraded, and the operation fails with recovery
instructions. OpenClaw must not start a built-in copy merely because the
provider disappeared.

This handshake synchronizes one bounded manifest. It is not a catalog import,
history transfer, cross-store transaction, or general workflow migration.

### Stable receipt ingestion

The backend may execute compatible shell work while the Gateway is unavailable.
It exposes a bounded page of immutable receipts after an opaque cursor and
retains each receipt until OpenClaw acknowledges it. A receipt has a closed,
size-capped shape and includes:

- backend id and a backend-generated receipt id that is never reused and is
  globally unique within that backend across restarts and generations;
- canonical job id and admitted revision;
- a backend run id that is never reused and is globally unique within that
  backend across restarts and generations, plus its trigger;
- start and end timestamps;
- terminal outcome and bounded diagnostics; and
- bounded delivery facts allowed by the admitted manifest.

Each execution has one stable backend run id and one terminal receipt. OpenClaw
validates the receipt against the canonical job, backend assignment, and
admitted revision. In one SQLite transaction it maps
`(backendId, backendRunId)` to a globally unique canonical run id, writes
canonical history and task state, deduplicates both that run key and
`(backendId, receiptId)`, and advances the ingestion cursor. It acknowledges
the receipt only after that transaction commits. Replayed pages therefore
cannot create duplicate public runs.

Malformed receipts, cursor gaps, unknown jobs, or revision mismatches outside
the recorded old-admission liabilities are not acknowledged. Status reports
the exact degradation and recovery action. Pages, receipts, diagnostics, and
per-poll work all have hard bounds; an operator can resume from the last
committed cursor after repair.

Receipts recorded for work completed while the Gateway was unavailable update
history only. They do not retroactively replay hooks, channel delivery,
transcript writes, or agent actions. A v1 receipt cannot contain model,
provider, token-usage, session, transcript, or task facts, and a provider cannot
mint an agent-action or delivery capability. Agent-turn and system-event
execution require a separate future contract for host-issued execution
identity and canonical telemetry ownership.

Before deletion or uninstall settles, OpenClaw drains and acknowledges retained
receipts and verifies disarm. The canonical history then follows OpenClaw's
existing retention and cleanup behavior, even after the job row is deleted.
Canonical job ids are not recycled. No provider tombstone or historical routing
record is required because history never leaves the canonical store.

### Failure and observability

Backend absence, registration mismatch, stage/activation uncertainty, receipt
ingestion failure, and disarm failure are explicit degraded states. CLI, tool,
status, and doctor output identify the job, backend, pending operation, and safe
next action. They do not silently omit provider-backed work or claim success
before the corresponding durable receipt.

Permanent provider loss has one explicit operator-only escape hatch. After a
high-friction confirmation, core records an immutable quarantine entry with the
job and revision, manifest digest, last verified dispatcher fence and receipt
cursor, every known run or delivery liability (or that liability is unknown),
operator identity, time, and reason. The binding remains quarantined and the
job remains disabled; abandonment never arms a built-in copy, clears the audit
record, or permits canonical-id reuse. Starting equivalent built-in work
requires a distinct new job after the operator verifies external cleanup.

The provider executes with installed-plugin trust; this is not a sandbox. Closed
manifests and receipts protect canonical state and consumers from stale events,
integration bugs, oversized payloads, and confused-deputy links.

### Acceptance gates

This RFC remains `draft` until maintainers accept, narrow, or decline the owner
boundary. It must not move to `accepted` or merge until the recurring-demand
evidence, named reference-provider work, and concrete onboarding/enablement
plan below are linked. The implementation itself must not land until all of the
following have executable proof:

- links to several independent OpenClaw requests or integrations that need the
  same separate-dispatch contract, satisfying the recurring-demand rule;
- a named reference provider, initially expected to be a conforming release of
  `amittell/openclaw-scheduler`, with reviewable adapter work at RFC acceptance
  and an installable conformance-tested release before implementation lands;
- the onboarding, per-job enablement, documentation, status, and doctor path
  described above;
- a conformance matrix proving exact mappings for every admitted v1 field and
  rejecting every incompatible shape before mutation;
- unchanged public behavior for built-in jobs and for installations with no
  dispatch provider;
- crash tests across every manifest stage showing that no job revision is
  simultaneously armed by built-in and external dispatchers;
- assignment quiesces existing built-in admissions, revision replacement
  settles or records old-revision liabilities, and only those recorded old
  runs may finish after replacement;
- manual `cron.run` admission is idempotent, returns the canonical run id, and
  never executes through built-in fallback;
- receipt paging, bounds, replay, cursor recovery, revision validation, and
  globally unique backend and canonical run-id tests;
- offline shell completion recorded once in canonical history without replayed
  side effects;
- agent-turn and system-event selection rejected before mutation;
- deletion and uninstall tests proving receipts are drained, the backend is
  disarmed, and deleted-job history remains queryable under current retention;
- visible, actionable behavior for backend outage and every unresolved
  operation, including operator-only quarantine that cannot rearm the job; and
- explicit maintainer confirmation that this bounded permanent SDK seam is
  preferable to continuing with public Gateway APIs.

If maintainers accept the RFC, they create the implementation issue required by
the RFC lifecycle, fill `issue`, and change `status` to `accepted` before the
RFC merges. This draft does not claim that decision.

## Rationale

### Why OpenClaw remains canonical

Keeping public state in one SQLite owner preserves existing authorization,
pagination, history retention, lifecycle, and client behavior. External
catalog ownership would require cross-store migration, mixed-owner paging,
authorization rechecks, distributed tombstones, run-id coordination,
quarantine, and abandonment protocols. That machinery is disproportionate to
the evidenced need for Gateway-independent dispatch.

### Why selection is per job

A global owner switch makes every public job shape part of the provider
contract and turns plugin failure into an Automations-wide outage. Explicit
per-job selection confines the new failure domain, leaves incompatible jobs on
the capable built-in scheduler, and makes the operator's intent auditable.

### Why the subset is fixed

`openclaw-scheduler` 0.5.2 supports `cron` and `at` timing and a narrower target
set than current OpenClaw Automations. V1 selects only its shell/command
boundary. Agent turns and system events also require canonical model, provider,
token-usage, session, and task ownership that a backend-authored receipt cannot
supply. Treating near-matches as conformance would create silent
semantic drift. Later schedule or payload shapes require an additive contract
revision.

### Why not use hooks or public APIs alone

Hooks and public Gateway APIs remain the supported integration boundary today
and may be sufficient. They cannot, however, durably suppress the built-in
timer for one canonical revision while a backend arms it, nor do they define
replay-safe canonical receipt ingestion. The proposed seam is justified only
if recurring demand proves those two capabilities are broadly needed.

### Relationship to external deadline projection

[RFC PR #59](https://github.com/openclaw/rfcs/pull/59) proposes a phase-one
deadline projection that lets a host arrange compute availability while
OpenClaw still admits, executes, delivers, and finalizes each Automation. This
RFC delegates the admitted shell/command execution itself and ingests terminal
receipts while OpenClaw remains the canonical catalog, admission, and history
owner.

Those phase-one contracts are distinct. If RFC #59 later adds a `scheduleOnly`
occurrence with an external action owner, that protocol overlaps this dispatch
seam and must converge on one owner, admission, fencing, receipt, and history
contract. OpenClaw should not ship parallel plugin APIs for the same externally
executed occurrence.

### Why no silent fallback

If an external dispatcher may already have armed a job, starting a built-in
copy can repeat a side effect. A visible degraded state and an explicit disarm
receipt are safer than availability gained through split-brain execution.

## Unresolved questions

The maintainer decision is whether recurring demand justifies this lean
dispatch-and-receipt SDK seam, or whether external schedulers should remain on
public Gateway APIs. The exact canonical field and CLI flag names, reference
provider package, and first-run onboarding flow are implementation details only
after that owner-boundary decision.

The RFC repository also requires a `maintainer-discussion` thread before
acceptance. This draft does not claim that discussion happened. No
implementation issue is linked while the RFC remains a draft.
