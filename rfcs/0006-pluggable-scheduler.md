---
title: Pluggable Scheduler Seam in Gateway
authors:
  - amittell
created: 2026-05-31
last_updated: 2026-05-31
rfc_pr: https://github.com/openclaw/rfcs/pull/5
---

# Proposal: Pluggable Scheduler Seam in Gateway

## Summary

OpenClaw's gateway currently ships a built-in cron/heartbeat layer that fires
scheduled jobs and gateway heartbeats from a single in-process scheduler.
Operators with workflows that need durability, retries, approvals, multi-step
chains, or full run history reach for external schedulers (notably
`openclaw-scheduler`, a SQLite-backed sibling service), but those tools have to
talk to the gateway only through the public HTTP surface and cannot register
scheduled work that the gateway considers first-class. This RFC proposes a
narrow plugin-SDK seam that lets an external scheduler plugin own scheduled-job
dispatch while the gateway keeps owning heartbeats and run-state ingestion.

## Motivation

The built-in cron is correct for the common case: one or two scheduled agent
prompts, low audit needs, every operator wants it to "just work." It is
intentionally limited:

- Runs are not persisted in a queryable form; failures disappear into the
  gateway log.
- A job that needs `shell -> agent -> approval -> shell` cannot be expressed.
- A failing job has no retry contract beyond the next cron tick.
- The cron is in-process with the gateway, so a draining gateway pauses
  scheduling for the duration of the drain.

Operators who need any of those affordances today install `openclaw-scheduler`
as a sibling service and disable the built-in cron, but that splits the
scheduling surface across two systems with no shared run-state model. The
gateway has no way to surface scheduler-owned runs in `gateway status`,
hooks, or transcripts, and the scheduler cannot mark itself as the canonical
owner of scheduled work.

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
  belongs in `openclaw doctor` follow-up work, not this seam.
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
`gateway scheduledJobs.*` calls to the plugin. If no scheduler plugin is
registered, the built-in cron stays on.

Operators can fall back to built-in cron at any time by uninstalling or
disabling the scheduler plugin; the gateway resumes ownership without a
restart.

### Runtime contract (`scheduler-host-runtime.ts`)

The plugin exports a runtime that the gateway calls in three places:

```typescript
export interface SchedulerHostRuntime {
  registerScheduledJob(spec: ScheduledJobSpec): Promise<ScheduledJobHandle>;
  cancelScheduledJob(id: string): Promise<void>;
  listScheduledJobs(): Promise<ScheduledJobSnapshot[]>;
}
```

The gateway's existing scheduled-job config (`scheduledJobs` in
`gateway.json`) is forwarded to `registerScheduledJob` at startup. The plugin
owns the storage; the gateway forgets the spec after the call returns.

### Run-state contract (`scheduler-run-state.ts`)

The plugin pushes run lifecycle events into a generic ingestion channel the
gateway already owns:

```typescript
runState.onStart({ jobId, runId, startedAt, trigger });
runState.onComplete({ jobId, runId, endedAt, exitCode, deliveredMessageIds });
runState.onError({ jobId, runId, endedAt, error });
```

The gateway uses these to (1) surface runs in `gateway status`, (2) fire the
existing `scheduled_run.*` hooks, and (3) mirror agent-job transcripts. The
plugin does not have to integrate with each consumer individually.

A diagram of the discovery flow will be added under `rfcs/0006/` in a follow-up
revision once the seam shape is settled. In short: when the scheduler plugin
manifest declares `owns: "scheduled-jobs"`, the gateway swaps its built-in cron
registration for a forwarder to the plugin runtime, and ingests run lifecycle
through the generic `runState` channel. Heartbeats stay in core.

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
itself healthy.

### Alternatives considered

- **Hook-only integration.** External schedulers could simply call the
  existing `scheduled_run.*` hooks. This works for run state, but does not
  give the gateway any way to know who owns the schedule, so config-driven
  jobs in `gateway.json` cannot be routed to the plugin.
- **Replace built-in cron entirely with this seam.** Tempting, but breaks
  every operator who has not installed a scheduler plugin and creates a
  hard dependency on an external package for gateway readiness.
- **Bundle openclaw-scheduler as the canonical scheduler.** Discussed in the
  Why-not-move-into-core section; rejected.

## Existence proof

The consumer side already works. `openclaw-scheduler` has been deployed on
two gateways for several weeks, talking to OpenClaw only through the public
HTTP surface. Listing on ClawHub as `durable-scheduler` is live. What is
missing is the seam that would let the same external runtime be registered
as the canonical scheduler so its runs surface in `gateway status`, hooks,
and transcripts. If the seam shape proposed here is accepted, I am willing
to carry the reference implementation as a follow-up PR against
`openclaw/openclaw`.

## Unresolved questions

- Should `cancelScheduledJob` be required, or optional with a fallback to
  unregistering the spec on next startup? Optional is simpler but
  inconsistent with `registerScheduledJob` returning a live handle.
- Heartbeats stay in core. Is there a future seam where a scheduler plugin
  also wants to own heartbeat scheduling (for hosts where heartbeats need
  the same durability as jobs), or should that always be in-process?
- What is the migration path for existing operators who run external
  schedulers via direct HTTP today? Probably an `openclaw doctor` finding
  that suggests installing the scheduler plugin, but the details belong in
  a follow-up RFC, not this one.
- Should the seam also expose a read-only `listScheduledJobs` over the
  plugin SDK so docs/tools can render the canonical job catalog without
  reading from each scheduler's storage? The case for it is operator
  observability; the case against is that pushing this through the runtime
  channel keeps the seam smaller.
