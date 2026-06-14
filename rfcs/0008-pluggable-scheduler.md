---
title: Pluggable Scheduler Seam in Gateway
authors:
  - amittell
created: 2026-05-31
last_updated: 2026-06-12
rfc_pr: https://github.com/openclaw/rfcs/pull/5
status: draft
issue:
---

# Proposal: Pluggable Scheduler Seam in Gateway

## Summary

OpenClaw's gateway currently ships a built-in cron/heartbeat layer that fires
scheduled jobs and gateway heartbeats from a single in-process scheduler.
Operators with workflows that need durability, retries, approvals, multi-step
chains, or full run history reach for external schedulers (notably
`openclaw-scheduler`, a SQLite-backed sibling service), but those tools have to
talk to the gateway through the public HTTP `cron.*` surface. Plugins can
already schedule Cron-backed session turns, but no external scheduler can
register itself as the canonical owner of scheduled work. This RFC proposes a
narrow plugin-SDK seam that lets an external scheduler plugin own scheduled-job
dispatch while the gateway keeps owning heartbeats and the core run-state
surfaces.

## Motivation

The built-in cron is correct for the common case: one or two scheduled agent
prompts, low audit needs, every operator wants it to "just work." It is
intentionally scoped to in-process Cron semantics:

- Runs have gateway-owned run-log/status surfaces, but that history is tied to
  built-in Cron and cannot represent an external scheduler's durable run graph.
- A job that needs `shell -> agent -> approval -> shell` cannot be expressed.
- Retry and concurrency policy is tied to the single Cron job lifecycle, not to
  durable multi-step workflow state owned by another scheduler.
- The cron is in-process with the gateway, so a draining gateway pauses
  scheduling for the duration of the drain.

Operators who need any of those affordances today install `openclaw-scheduler`
as a sibling service and disable the built-in cron, but that splits the
scheduling surface across two systems with no shared run-state model. The
gateway has Cron-backed plugin scheduling helpers and a `cron_changed` hook for
gateway-owned jobs, but an external scheduler still cannot mark itself as the
canonical owner of scheduled work or project its runs through the same status,
hook, run-log, and transcript surfaces.

## Goals

- A narrow, additive seam in `openclaw/plugin-sdk` that lets a plugin register
  itself as the canonical scheduler.
- Built-in cron remains the default and stays unchanged for operators who do
  not install a scheduler plugin.
- A single contract for run-state ingestion so the gateway can surface
  scheduler runs in `gateway status`, hooks, and transcript mirroring
  regardless of which scheduler owns them.
- No new compiled dependencies in the gateway. The scheduler plugin owns its
  own storage and runtime.

## Non-Goals

- Replacing built-in cron with a different in-process scheduler.
- Defining a new persistence format for run state in core; the seam is
  contract-only, the plugin owns its store.
- Migrating existing cron config into a scheduler plugin automatically. That
  belongs in `openclaw doctor` follow-up work, not this seam. The same goes
  for operators who run external schedulers via direct HTTP today: the
  expected path is a doctor finding that suggests installing the scheduler
  plugin, with details in a follow-up RFC.
- Bringing `openclaw-scheduler` into the core monorepo or as a bundled plugin;
  this RFC is about the seam, not any specific implementation.

## Proposal

Add a `scheduler` plugin kind to `openclaw/plugin-sdk` that exposes three
contracts.

### Discovery contract (`openclaw.plugin.json`)

```json
{
  "kind": "scheduler",
  "owns": "scheduled-jobs",
  "contracts": {
    "scheduledJobs": true,
    "runState": true
  }
}
```

When a `scheduler` plugin is registered and `owns: "scheduled-jobs"`, the
gateway disables its in-process cron at startup and routes all
`cron.*` scheduled-job calls to the plugin. If no scheduler plugin is
registered, the built-in cron stays on. The manifest shape above is additive:
implementation should extend the current plugin-kind and contract registry
rather than reinterpret any existing capability contract.

Fallback is also a startup decision in v1. If a scheduler plugin owns
scheduled jobs, uninstalling or disabling that plugin, or otherwise changing
scheduler ownership, requires a gateway restart before the built-in cron
resumes ownership. This keeps the first revision aligned with startup-time
discovery and avoids promising a hot scheduler handoff before the runtime has
a live ownership-transfer contract.

### Runtime contract (`scheduler-host-runtime.ts`)

The plugin exports a runtime that the gateway calls in three places:

```typescript
export interface SchedulerHostRuntime {
  registerScheduledJob(spec: ScheduledJobSpec): Promise<ScheduledJobHandle>;
  cancelScheduledJob(id: string): Promise<void>;
  listScheduledJobs(): Promise<ScheduledJobSnapshot[]>;
}
```

When the scheduler plugin owns scheduled jobs, new or updated `cron.*` job
specs are forwarded to `registerScheduledJob`. The plugin owns scheduler
storage and runtime after registration, and the gateway treats
`listScheduledJobs` as the canonical catalog for list/status surfaces. Existing
built-in Cron stores are not migrated automatically in v1; they remain available
for the built-in fallback path or a follow-up `openclaw doctor` migration.

### Run-state contract (`scheduler-run-state.ts`)

The plugin pushes run lifecycle events into a scheduler-owned ingestion adapter
that feeds the gateway's existing cron event fan-out:

```typescript
runState.onStart({ jobId, runId, startedAt, trigger });
runState.onComplete({ jobId, runId, endedAt, exitCode, deliveredMessageIds });
runState.onError({ jobId, runId, endedAt, error });
```

The gateway uses these to (1) surface runs in `gateway status` and `cron.runs`,
(2) fire the existing `cron_changed` hook with the same public event shape used
for built-in cron, and (3) mirror or link agent-job transcripts when the plugin
run produces gateway-visible agent turns. The plugin does not have to integrate
with each consumer individually.

A diagram of the discovery flow will be added under `rfcs/0007/` in a follow-up
revision once the seam shape is settled. In short: when the scheduler plugin
manifest declares `owns: "scheduled-jobs"`, the gateway swaps its built-in cron
registration for a forwarder to the plugin runtime, and ingests run lifecycle
through the scheduler run-state adapter. Heartbeats stay in core.

## Rationale

### Why a plugin-SDK seam instead of a config flag

A config flag (`scheduler.implementation: "builtin" | "external"`) was the
first thing I tried in my local fork. It collapses cleanly into the
operator-side mental model but does not give the external scheduler any way
to surface its runs through the gateway's existing observability surface.
Operators end up with two parallel run-state systems and a confused
`gateway status` view.

### Why not move openclaw-scheduler into core

I run `openclaw-scheduler` on two gateways today and would happily contribute
the runtime, but bringing it in-tree fails three policy checks in
`AGENTS.md`: it adds a native dependency (`better-sqlite3`), it duplicates
the existing built-in cron rather than replacing it cleanly through a
deprecation path, and it is an "optional integration / service workflow"
which AGENTS.md routes to plugins or owner repos rather than core. The seam
proposed here lets the same code live as an external plugin while still
giving the gateway a first-class view of scheduled runs.

### Why this seam is small

The runtime contract is three functions and three event shapes. The
discovery contract is a single manifest field and a single `owns` token.
This is intentionally narrower than what the existing cron does internally:
the seam covers scheduled jobs, not heartbeats. Heartbeats stay in core
because no external scheduler should be required for the gateway to consider
itself healthy. This is decided for v1: if a future host needs heartbeats
with job-grade durability, that would be a new `owns` token in a follow-up
RFC, not a widening of this seam.

### Alternatives considered

- **Hook-only integration.** External schedulers could try to project run
  updates through the existing `cron_changed` hook shape. This works for
  observers, but does not give the gateway any way to know who owns the
  schedule, so existing cron jobs and `cron.*` calls cannot be routed to the
  plugin.
- **Replace built-in cron entirely with this seam.** Tempting, but breaks
  every operator who has not installed a scheduler plugin and creates a
  hard dependency on an external package for gateway readiness.
- **Bundle openclaw-scheduler as the canonical scheduler.** Discussed in the
  Why-not-move-into-core section; rejected.

## Existence proof

The consumer side already works. `openclaw-scheduler` has been deployed on
two gateways for several weeks, talking to OpenClaw only through the public
HTTP `cron.*` surface. Listing on ClawHub as `durable-scheduler` is live. Core
already has adjacent pieces for Cron-backed plugin scheduled turns, the
`cron_changed` hook, and cron run-log/status surfaces; the missing part is
startup-time scheduler ownership plus an adapter from plugin-owned runs into
those surfaces. If the seam shape proposed here is accepted, I am willing to
carry the reference implementation as a follow-up PR against `openclaw/openclaw`.

## Unresolved questions

- Should `cancelScheduledJob` be required, or optional with a fallback to
  unregistering the spec on next startup? Optional is simpler but
  inconsistent with `registerScheduledJob` returning a live handle.
- The runtime contract includes `listScheduledJobs`. Should docs/tools consume
  that runtime method directly, or should they stay behind the existing
  `cron.list`/`cron.status` gateway surface so scheduler storage remains fully
  private? The case for direct use is operator observability; the case against
  is keeping consumer APIs independent of the scheduler runtime.
