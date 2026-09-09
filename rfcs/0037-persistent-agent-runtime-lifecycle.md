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

Extend [RFC 0027](0027-openclaw-enterprise.md#agent-deployment) with durable lifecycle intent, completed-state recovery, single-writer handoff, and truthful outcomes. Begin with compatible same-cluster recovery on retained storage: preserve completed context and files without restoring authority or replaying interrupted actions.

## Motivation

Work outlives processes, but restart is not transparent continuation: credentials change, writes remain unfinished, and provider operations may have completed. Persisted stop intent, denied requests, process termination, and credential cleanup are separate facts. Restart or incoming messages must not erase intentional stop.

## Goals

- Preserve Agent identity and supported completed work across qualified replacement.
- Keep one writer for the shared mutable workspace.
- Persist accepted intent and its exact processing obligation.
- Distinguish readiness, authorization, termination, and external-effect outcomes.

## Non-Goals

- A new execution resource between `AgentRevision` and its workload.
- Cross-cluster recovery, arbitrary migration, or process-memory restore.
- A workflow scheduler, automatic source merging, or historical tool replay.
- Application-consistent snapshots, host wake, or remote bridge protocols.

## Proposal

### Retain a few independent records

OCC owns Agent state and lifecycle. Compute and Sandbox drivers realize admitted intent and report observations; neither chooses policy nor rewrites revisions. Internal records use existing resources:

| Record | Contents |
| --- | --- |
| Lifecycle intent | Agent, desired running, stopped, or disabled condition, monotonic generation, attributable accepted request. |
| Runtime observation | Canonical execution assignment and generation, exact revision and provider instance and incarnation, readiness, writer ownership, termination or uncertainty. |
| Recovery head | Completed conversation boundary, workspace durability reference, exact compatibility fingerprint, interrupted or unresolved work. |
| Lifecycle operation | Stable idempotency key, expected generation, source/target references, admitted obligation, dispatch progress, observed outcomes. |

Readiness grants no serving permission; expired controller claims prove neither death nor exclusive ownership. Use [0035's execution assignment](https://github.com/openclaw/rfcs/pull/69) across registration, observations, and accepting services. OCC selects it; Compute supplies evidence. Lifecycle and execution generations differ. This does not require SPIFFE for Agent authentication.

### Admit before dispatch

Conceptually, `stopAgent` and `resumeAgent` take an Agent reference, expected lifecycle generation, and idempotency key. OCC authenticates and authorizes exact actions and references and atomically records intent, operation, attribution, and reconciliation work. Repeated keys identify the same operation; conflicting inputs or stale generations are rejected.

The acceptance receipt reports durable admission, not completed teardown or startup. Reconcile unknown commits before asserting acceptance or duplicating effects. Workers recheck current intent and ownership before dispatch; restart resumes the retained obligation. Audit export failure cannot reopen denied authority or erase durable protective operations.

### Preserve activation order and one writer

Preserve RFC 0027's order: prepare an isolated nonserving candidate with Harness execution disabled; verify containment and prepare its nonserving route; retire the predecessor and verify its Harness stopped; select the candidate as sole active revision; permit execution; enable routing after readiness. A candidate readiness probe is not runtime authority. Before retirement, failures preserve prior serving; afterward, service requires verified activation or rollback.

Before any successor writes shared retained storage—including initialization, repair, or restore—Compute establishes predecessor termination and resolves earlier creates that could still produce writers. Names, lease expiry, route withdrawal, and elapsed time are insufficient. Earlier candidate preparation remains isolated from shared writable state. Missing no-writer evidence blocks replacement with data retained.

### Recover a completed boundary

The initial profile requires same-cluster retained volumes and exact compatible Harness and build, configuration, adapter protocol, and recovery schema. Preserve completed text, supported inert tool observations, and verified workspace durability; exclude RAM, interrupted shells, provider-private reasoning, and unsupported native-session details.

A recovery head is not a historical filesystem snapshot. Expose files changed after the completed turn and require explicit disposition; older context plus residual files is not clean rollback.

After the no-writer barrier, a trusted offline adapter may import and read back completed context without Harness execution. If import requires execution, OCC first selects the candidate as sole active revision; ordinary-work admission and routing remain closed until restore and readiness succeed. Restore cannot execute model calls, historical tools, or restored startup instructions. Verify compatibility and ownership or remain nonserving. Use a fresh incarnation and current workload authorization; never restore credentials or historical grants as authority. Changed builds require separately qualified compatibility or migration.

### Make stop and failure outcomes visible

Stop durably records stopped intent, closes new ordinary-work admission, and records a finite deadline for the exact execution. Until then, admitted work may finish and submit operations only under its unchanged [original grant](https://github.com/openclaw/rfcs/pull/70) and current authorization. Stop cannot extend grants, admit background work, or renew deadlines. Unqualified drain defaults to immediate closure.

At completion or deadline, close remaining authority before reporting drain complete. Turn cancellation, disable, or retirement closes affected authority immediately. Accepting services enforce closure before reporting it effective; missing current authority denies dispatch. Accepted provider effects may finish.

Retain the verified completed boundary and newer uncertainty. Compute stops the exact workload and observes termination before reporting stopped. [Credential cleanup](https://github.com/openclaw/rfcs/pull/68) retains independent authority. Report admission closed, deadline, authority closed, termination, and cleanup separately from accepted stop.

Unknown termination blocks writable replacement. Possible provider submission remains outcome-unknown under its exact operation identity: reconcile through supported read/idempotency mechanisms or seek explicit disposition. Replacement cannot automatically repeat writes; local revocation cannot retract accepted remote effects.

Stopped intent survives restart and incoming messages. Resume requires fresh explicit authorization and current build eligibility; failed recovery cannot use revoked builds. Storage loss beyond the retained-storage guarantee needs separate recovery capability.

Persistent requests retain original grants. Recovery supplies neither background authority nor historical grants. RFC 0036 owns admission beyond turns or sessions; it remains unavailable until separately specified and qualified.

### Qualify the integration

With a real supported Harness, recover non-self-contained conversation and files, prove predecessor exclusion, survive controller restart, preserve stopped intent, and expose incompatible restore and ambiguous effects. Source contracts and mocks do not establish runtime guarantees.

With a live connection, deny new work, allow only eligible original work before deadline, deny effects after closure, and let disable override drain. Restart retains the same deadline and operation; unknown closure or termination blocks writable replacement.

## Rationale

Durable records separate acceptance, dispatch, and observation; compatibility profiles bound recovery promises. Fresh containers do not make retained executable content safe.

[Gateway recovery](https://github.com/openclaw/rfcs/pull/46) proposes application-consistent recovery and scale-to-zero; [remote AgentHarness](https://github.com/openclaw/rfcs/pull/31) proposes bridge and event protocols. Both remain proposals; this RFC selects neither.

## Unresolved questions

- Which Harness, build, and configuration combinations form the first profile?
- What drain bounds and escalation apply when writers cannot be observed?
- Which workspace and context metadata must be retained, exported, or deleted together?
- How should operators resolve interrupted files and unknown provider outcomes?
- What evidence permits changed-build recovery or storage-independent restore?
