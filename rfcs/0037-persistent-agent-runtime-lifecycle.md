---
title: Persistent Agent and runtime lifecycle
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-09
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/71
---

# Proposal: Persistent Agent and runtime lifecycle

## Summary

Extend [RFC 0027](0027-openclaw-enterprise.md#agent-deployment) with durable lifecycle intent, completed-state recovery, single-writer handoff, and truthful outcomes. Start with same-cluster retained-storage recovery. Service-owned work may outlive its worker; continuing it requires current authority and a qualified successor.

## Motivation

A restart cannot safely mean continuation. Files may contain unfinished changes, credentials may be revoked, and remote operations may already have succeeded. An accepted stop, effective authority withdrawal, physical termination, and credential cleanup are different facts.

## Goals

- Preserve identity and supported completed work across replacement.
- Persist accepted intent and its processing obligation.
- Bound execution and delivery independently; expose uncertainty.

## Non-Goals

No new execution resource, cross-cluster migration, memory restore, workflow scheduler, historical tool replay, automatic merging, application-consistent snapshots, host wake, or remote bridge protocol.

## Proposal

OCC owns lifecycle policy; Compute and Sandbox drivers realize admitted intent and report observations. Retain independent intent, runtime, recovery-head, and operation records. Use [RFC 0035's execution assignment](https://github.com/openclaw/rfcs/pull/69); [RFC 0036](https://github.com/openclaw/rfcs/pull/70) owns logical work and child lineage. See [ownership and records](0037/lifecycle-spec.md#ownership-and-records).

**Admission.** Authenticate and authorize exact requests, then atomically compare the expected lifecycle generation and persist intent, attribution, idempotency key, and reconciliation obligation. Reject stale generations or conflicting key reuse. Acceptance is durable admission; workers recheck intent and ownership before dispatch. Reconcile unknown commits before asserting acceptance or duplicating effects. Restart retains the obligation. See [durable admission](0037/lifecycle-spec.md#durable-admission).

**Replacement flow:**

1. Prepare an isolated, nonserving candidate with Harness execution disabled; verify containment and prepare routing.
2. Retire the predecessor and verify its Harness stopped. Before any shared-storage write, prove predecessor termination and resolve earlier creates that could produce writers. Unknowns block replacement; retain data.
3. Select the sole active revision, permit execution, and enable routing after readiness. Readiness alone grants no authority. Before retirement, failure preserves prior serving; afterward, require verified activation or rollback.

The [activation contract](0037/lifecycle-spec.md#activation-and-writer-exclusion) also covers initialization and restore. Lease expiry, names, route withdrawal, and elapsed time cannot prove writer exclusion.

Recover completed context and verified files only under an exact compatible Harness and build, configuration, adapter, and schema profile. Expose residual files newer than the completed boundary for explicit disposition. Restore cannot call models, replay tools, execute restored startup instructions, or restore credentials as authority. Continuing still-open work requires fresh assignment and enforcement authority within its immutable scope and original horizon; preserve effect receipts and unknown outcomes. See the [recovery contract](0037/lifecycle-spec.md#recovery-contract).

| Event | Execution | Completed-result delivery |
| --- | --- | --- |
| Graceful stop | Close admission; drain within original scope and horizon to a fixed finite deadline, then withdraw authority and observe termination. | Finite responsibility admitted before work closure may continue. |
| Cancellation or security revocation, including disable | Withdraw affected work and descendants, overriding drain. | Withdraw affected delivery, even when already stopped. |
| Uncertain outcomes | Unknown creates or termination block writable replacement. Reconcile uncertain effects under original identity or seek explicit disposition. | Unknown posting outcomes cannot authorize reposting. |

![Graceful stop separates worker termination from completed-result delivery; cancellation and security revocation withdraw both.](0037/stop-and-delivery.png)

**Figure 1.** Delivery can outlive the worker. Cancellation and security revocation withdraw both branches; termination and cleanup obligations remain.

[Drain and disconnected reads](0037/lifecycle-spec.md#graceful-stop-and-withdrawal) require qualified finite bounds; outages permit no admission, writes, renewal, or reassignment. Outstanding leases count toward withdrawal bounds. Report requested and effective withdrawal, termination, and [credential cleanup](https://github.com/openclaw/rfcs/pull/68) independently. Accepted remote effects may finish. Stopped intent survives restart and messages; resume needs fresh authorization and eligible builds.

[Completed delivery](0037/lifecycle-spec.md#completed-result-delivery) fixes content, exact audience and destination, and absolute horizon. A trusted service checks current authority and posting permissions; missing membership evidence blocks delivery. It cannot finish computation, change audience, reopen work, or reset horizons. Stopped intent admits no new delivery.

[Qualification](0037/lifecycle-spec.md#qualification) requires real supported Harness tests of recovery, exclusion, restart, outage bounds, fresh assignment, and delivery withdrawal after stop. Mocks alone establish no runtime guarantee.

## Rationale

Separate records prevent acceptance from masquerading as completion. Compatibility profiles bound recovery promises. [Gateway recovery](https://github.com/openclaw/rfcs/pull/46) and [remote AgentHarness](https://github.com/openclaw/rfcs/pull/31) remain separate proposals.

## Unresolved questions

[Open decisions](0037/lifecycle-spec.md#open-decisions) cover initial profiles, withdrawal evidence and bounds, delivery enforcement, retention, operator disposition, and changed-build or storage-independent recovery.
