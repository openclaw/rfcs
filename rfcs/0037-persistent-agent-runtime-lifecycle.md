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

Extend [RFC 0027](0027-openclaw-enterprise.md#agent-deployment) with durable lifecycle intent, completed-state recovery, single-writer handoff, and truthful outcomes. Service-owned logical work may survive a turn or runtime, but assigning a successor requires current authority and a qualified execution. Begin with compatible same-cluster recovery on retained storage: preserve completed context, files and effect receipts without restoring authority or replaying interrupted actions.

## Motivation

Work outlives processes, but restart is not transparent continuation: credentials change, writes remain unfinished, and provider operations may have completed. Persisted stop intent, denied requests, process termination, and credential cleanup are separate facts. Restart or incoming messages must not erase intentional stop.

## Goals

- Preserve Agent identity and supported completed work across qualified replacement.
- Separate logical-work lifetime, runtime execution, bounded drain and completed-result delivery.
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

[RFC 0036](https://github.com/openclaw/rfcs/pull/70) owns logical work, its service owner and requester attribution, immutable scope and original horizon, and attached-child lineage. This RFC owns runtime transitions and finite completed-result delivery. Work and delivery records retain their identity across runtime replacement. A message acknowledgement, completed model turn or lost connection does not close logical work; retained context does not authorize it. Attached-child renewal and required joins follow RFC 0036, including ancestor cancellation even when no parent process runs.

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

Continuing still-open logical work additionally requires fresh authoritative assignment to the qualified successor and fresh enforcement authority within the work's immutable scope and original horizon. Preserve its original operation fingerprints, allowance reservations, submission receipts and unknown outcomes. Replacement cannot reopen terminal work, reset its horizon or convert an unresolved effect into a new attempt. The work model does not expand this RFC's recovery compatibility or remove existing attempt limits.

### Make stop and failure outcomes visible

Graceful stop durably records stopped intent, closes new ordinary-work admission, and records a finite drain deadline for the exact execution. Eligible existing work may finish within its unchanged scope, original horizon and that deadline. Current authoritative renewal may maintain access only within those bounds; stop cannot extend them or admit new work. Without a qualified drain profile, OCC admits no draining execution authority.

Application writes, including message posting, require current authority. During an authority outage, only explicitly qualified reads may continue under an existing unexpired enforcement lease and all required local checks from [RFC 0035](https://github.com/openclaw/rfcs/pull/69). The outage permits no admission, renewal, expansion or new execution assignment. Each issued lease must fit applicable work and ancestor horizons, drain deadlines and profile withdrawal bounds, including clock and enforcement allowances. A newly imposed stop or tighter withdrawal target must account for outstanding disconnected leases before claiming the new bound. Minutes for ordinary work and seconds for sensitive work are tolerance scales to qualify, not guaranteed values. Reconnect and restart cannot move an existing deadline; a holder with untrustworthy clock or revocation state synchronizes before serving.

At drain completion or deadline, withdraw remaining authority for that execution before reporting drain complete. Runtime retirement withdraws the predecessor's authority; it need not terminally close logical work eligible for a fresh assignment. Cancellation and security revocation close or withdraw affected work, descendants and delivery. Record withdrawal durably, fence further issuance, and report it effective only with evidence from accepting services or expiry under the qualified profile. Requested withdrawal, effective withdrawal and physical termination remain distinct. Accepted provider effects may finish.

Retain the verified completed boundary and newer uncertainty. Compute stops the exact workload and observes termination before reporting stopped. [Credential cleanup](https://github.com/openclaw/rfcs/pull/68) retains independent authority. Report admission closure, drain deadline, work state, execution-authority withdrawal, delivery state, termination and cleanup separately from accepted stop.

Unknown termination blocks writable replacement. Possible provider submission remains outcome-unknown under its exact operation identity: reconcile through supported read/idempotency mechanisms or seek explicit disposition. Replacement cannot automatically repeat writes; local revocation cannot retract accepted remote effects.

Stopped intent survives restart and incoming messages. Resume requires fresh explicit authorization and current build eligibility; failed recovery cannot use revoked builds. Storage loss beyond the retained-storage guarantee needs separate recovery capability.

### Preserve bounded completed-result delivery

Graceful stop preserves pending delivery of an already completed result when a separate finite delivery responsibility was admitted before logical-work closure, possibly at original admission. Completion follows required child joins and preserves unresolved effects under RFC 0036. The responsibility records its owner, originating work, cancellation relationships and operation receipt; it fixes the permitted output, exact audience and destination, and original absolute horizon. Binding the completed content must satisfy that admission. A trusted delivery service can act independently of the stopped worker, checking current authority, content access, audience eligibility, exact Channel permission and provider authorization at posting time. Missing required membership evidence blocks delivery. It cannot complete unfinished computation, use a fallback audience or reopen work. A later delivery responsibility requires fresh admission, and stopped intent alone permits none.

Cancellation or security revocation, including Agent disable, withdraws affected delivery even if the Agent is already stopped. That path must preserve outstanding physical-termination and cleanup obligations and distinguish requested from effective withdrawal. Retry reservations cannot reset the delivery horizon. A definitive no-effect result may permit a policy-approved retry within the remaining horizon; an unknown outcome retains its original receipt and cannot authorize reposting.

### Qualify the integration

With a real supported Harness, recover non-self-contained conversation and files, prove predecessor exclusion, survive controller restart, preserve stopped intent, and expose incompatible restore and ambiguous effects. Source contracts and mocks do not establish runtime guarantees.

With a live connection, deny new work, allow only eligible original work before deadline, deny new dispatch after effective withdrawal, and let cancellation or disable override drain. Exercise qualified reads during authority outage while denying writes, renewal and reassignment; measure withdrawal from the selected profile's start point through accepting-service enforcement. Restart retains the same deadline and operation; unknown execution-authority closure or termination blocks writable replacement.

Verify fresh assignment of still-open work without widening its scope or horizon or losing effect receipts. Exercise completed delivery after graceful stop, expiry without horizon reset, unknown posting outcomes, and cancellation or disable after the Agent is already stopped. These are qualification requirements, not claims of implemented runtime behavior.

## Rationale

Durable records separate acceptance, dispatch, and observation; compatibility profiles bound recovery promises. Fresh containers do not make retained executable content safe.

[Gateway recovery](https://github.com/openclaw/rfcs/pull/46) proposes application-consistent recovery and scale-to-zero; [remote AgentHarness](https://github.com/openclaw/rfcs/pull/31) proposes bridge and event protocols. Both remain proposals; this RFC selects neither.

## Unresolved questions

- Which Harness, build, and configuration combinations form the first profile?
- What drain bounds and escalation apply when writers cannot be observed?
- Which withdrawal profiles, clock assumptions and observation evidence bound qualified reads and prove effective closure?
- Which output paths enforce exact completed-result identity, audience and cancellation while the Agent is stopped?
- Which workspace and context metadata must be retained, exported, or deleted together?
- How should operators resolve interrupted files and unknown provider outcomes?
- What evidence permits changed-build recovery or storage-independent restore?
