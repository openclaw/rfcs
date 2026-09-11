---
title: Persistent Agent and runtime lifecycle
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-11
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/71
---

# Proposal: Persistent Agent and runtime lifecycle

## Summary

Extend [RFC 0027](0027-openclaw-enterprise.md#agent-deployment) with durable lifecycle controls and completed-state recovery on same-build, same-cluster retained storage. Execution duration defaults to uncapped; authority remains finite. These are proposed contracts, not runtime guarantees.

## Motivation

A restart cannot safely mean continuation. Files may contain unfinished changes, credentials may be revoked, and remote operations may already have succeeded. An accepted stop, effective authority withdrawal, physical termination, and credential cleanup are different facts.

## Goals

- Preserve identity and supported completed work across replacement.
- Persist accepted intent and its processing obligation.
- Keep optional execution caps separate from finite authority and delivery bounds.
- Make current work and stop/start outcomes visible without hiding uncertainty.

## Non-Goals

No new execution resource, active-session migration across containers or builds, cross-cluster recovery, memory restore, workflow scheduler, historical tool replay, automatic merging, application-consistent snapshots, host wake, or remote bridge protocol. Full independent-child coordination is not an initial gate.

## Proposal

OCC owns lifecycle policy; Compute and Sandbox drivers realize admitted intent and report observations. [Independent records](0037/lifecycle-spec.md#ownership-and-records) track intent, runtime, recovery head, and operation. Use [RFC 0035's assignment](https://github.com/openclaw/rfcs/pull/69) and [RFC 0036's logical work](https://github.com/openclaw/rfcs/pull/70).

**Execution policy.** An Agent may persist indefinitely; its process and work have separate lifetimes. Duration defaults to uncapped, with an optional finite cap fixed on the original attempt from dispatch, including startup and waiting. Configuration changes affect future admission. Enforcement leases, credentials, operation deadlines, drain, and delivery remain finite; work horizons are optional under uncapped policy. See [execution limits](0037/lifecycle-spec.md#execution-limits-and-authority).

**Controls.** Authorized inventory shows intended state, observed current work, observation time, configured cap, and pending or unknown outcomes. **Stop task** targets exact work and its owned helpers; **Stop Agent** durably blocks new work and drives affected work to stop while retaining the Agent and files; **Start Agent** requires separate authorization and cannot bypass disable, revive canceled work, or replay uncertain effects. Own-task, shared-task, and Agent permissions are distinct. [Default Stop semantics](0037/lifecycle-spec.md#inventory-and-user-controls) remain open; graceful drain is optional.

**Admission.** Authorize exact requests, compare the expected lifecycle generation, and atomically persist intent, attribution, idempotency key, and reconciliation obligation. Reject stale generations or conflicting key reuse. Acceptance is durable admission; workers recheck intent and ownership before dispatch. [Reconcile unknown commits](0037/lifecycle-spec.md#durable-admission) before asserting acceptance or duplicating effects; restart retains the obligation.

**Replacement flow:**

1. Prepare an isolated, nonserving candidate with Harness execution disabled; verify containment and prepare routing.
2. Retire the predecessor and verify its Harness stopped. Before any shared-storage write, prove predecessor termination and resolve earlier creates that could produce writers. Unknowns block replacement; retain data.
3. Select the sole active revision, permit execution, and enable routing after readiness. Readiness alone grants no authority. Before retirement, failure preserves prior serving; afterward, require verified activation or rollback.

The [activation contract](0037/lifecycle-spec.md#activation-and-writer-exclusion) also covers initialization and restore. Lease expiry, names, route withdrawal, and elapsed time cannot prove writer exclusion.

[Recovery](0037/lifecycle-spec.md#recovery-contract) requires exact compatible Harness/build, configuration, adapter, and schema profiles. Expose newer residual files for disposition. Restore cannot call models, replay tools, execute restored startup instructions, or restore credentials as authority. Later continuation profiles require fresh assignment and authority within original scope and any configured horizon, preserving effect receipts and unknown outcomes.

| Event | Execution | Completed-result delivery |
| --- | --- | --- |
| Graceful stop | Close admission; drain within original scope and any configured horizon to a fixed finite deadline, then withdraw authority and observe termination. | Finite responsibility admitted before work closure may continue. |
| Cancellation or security revocation, including disable | Withdraw affected work and descendants, overriding drain. | Withdraw affected delivery, even when already stopped. |
| Uncertain outcomes | Unknown creates or termination block writable replacement. Reconcile uncertain effects under original identity or seek explicit disposition. | Unknown posting outcomes cannot authorize reposting. |

![Graceful stop separates worker termination from completed-result delivery; cancellation and security revocation withdraw both.](0037/stop-and-delivery.png)

**Figure 1.** For an explicitly selected graceful-stop profile, delivery can outlive the worker. Cancellation and security revocation withdraw both branches; termination and cleanup obligations remain.

[Drain and disconnected reads](0037/lifecycle-spec.md#graceful-stop-and-withdrawal) require qualified finite bounds; outages permit no admission, writes, renewal, or reassignment. Outstanding leases count toward withdrawal bounds. Report requested and effective withdrawal, termination, and [credential cleanup](https://github.com/openclaw/rfcs/pull/68) independently. Accepted remote effects may finish. Stopped intent survives restart and messages; Start needs eligible builds.

[Completed delivery](0037/lifecycle-spec.md#completed-result-delivery) fixes content, exact audience and destination, and absolute horizon. A trusted service checks current authority and posting permissions; missing membership evidence blocks delivery. It cannot finish computation, change audience, reopen work, or reset horizons. Stopped intent admits no new delivery.

[Qualification](0037/lifecycle-spec.md#qualification) starts with real supported Harness evidence for same-build completed-state recovery, exclusion, controls, and finite/uncapped execution. Drain, delivery, continuation, and child profiles need evidence when selected; mocks alone establish no runtime guarantee.

## Rationale

Separate records prevent acceptance from masquerading as completion. Compatibility profiles bound recovery promises. [Gateway recovery](https://github.com/openclaw/rfcs/pull/46) and [remote AgentHarness](https://github.com/openclaw/rfcs/pull/31) remain separate proposals.

## Unresolved questions

[Open decisions](0037/lifecycle-spec.md#open-decisions) cover initial profiles, withdrawal evidence and bounds, default Stop semantics, delivery enforcement, the initial child subset, retention, operator disposition, and later continuation or changed-build recovery.
