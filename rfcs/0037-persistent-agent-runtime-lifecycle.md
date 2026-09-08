---
title: Persistent Agent and runtime lifecycle
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-08
status: draft
issue:
rfc_pr:
---

# Proposal: Persistent Agent and runtime lifecycle

## Summary

Separate an Enterprise Agent's durable work from the replaceable workload that
executes it. Extend [RFC 0027](0027-openclaw-enterprise.md#agent-deployment) with
explicit lifecycle intent, completed-state recovery, single-writer handoff, and
truthful operation outcomes. Begin with compatible same-cluster recovery on
retained storage. Recovery preserves completed context
and files without restoring authority or replaying interrupted actions.

## Motivation

A conversation and its work products can outlive a process, Pod, or connection.
A process restart is not transparent continuation: credentials change, writes
may be unfinished, and provider operations may have completed.

Persisted stopped intent, denial of new requests, observed process termination,
and credential cleanup are different facts. A controller restart or new message must
not erase an intentional stop. Recovery should expose its supported fidelity and
failure boundary rather than promise restoration of arbitrary process state.

## Goals

- Preserve Agent identity and supported completed work across qualified replacement.
- Keep one writer for the Agent's shared mutable workspace.
- Persist accepted lifecycle intent and recover its exact processing obligation.
- Distinguish readiness, authorization, termination, and external-effect outcomes.

## Non-Goals

- A new user-facing execution resource between `AgentRevision` and its workload.
- Cross-cluster disaster recovery, arbitrary version migration, or process-memory restore.
- A general workflow scheduler, automatic source merging, or replay of historical tools.
- Specifying application-consistent snapshots, host wake, or remote bridge protocols.

## Proposal

### Retain a few independent records

OCC remains the owner of Agent state and lifecycle. Compute and Sandbox drivers
realize admitted intent and report observations; neither chooses policy or rewrites
a revision. The following are internal records associated with existing resources:

| Record | Contents |
| --- | --- |
| Lifecycle intent | Agent, desired running/stopped/disabled condition, monotonically changing generation, and attributable accepted request. |
| Runtime observation | Exact revision and provider instance/incarnation, readiness, writer ownership, and observed termination or uncertainty. |
| Recovery head | Completed conversation boundary, supported workspace durability reference, exact compatibility fingerprint, and interrupted or unresolved work. |
| Lifecycle operation | Stable idempotency key, expected generation, source/target references, admitted processing obligation, dispatch progress, and observed outcomes. |

Readiness does not grant serving permission. An expired controller claim proves
neither process death nor exclusive workspace ownership.

### Admit before dispatch

Conceptually, `stopAgent` and `resumeAgent` take an Agent reference, expected
lifecycle generation, and idempotency key. OCC authenticates and authorizes the
exact action and references, then atomically records accepted intent, operation,
attribution, and durable reconciliation work. Repeated keys identify the same
operation; conflicting input or a stale generation is rejected.

The acceptance receipt reports durable admission, not completed teardown or
startup. If commit status is unknown, reconcile that request before asserting
acceptance or issuing duplicate effects. A worker rechecks current intent and
its ownership before dispatch. Restart resumes the same retained obligation;
it does not manufacture a new executable request. Audit export failure must not
reopen denied authority or erase an already durable protective operation.

### Preserve activation order and one writer

RFC 0027's deployment order remains authoritative: prepare an isolated,
nonserving candidate whose Harness cannot execute; verify containment and prepare
its nonserving route; retire the prior revision and verify its Harness stopped;
record the candidate as the sole active revision; permit execution; enable the
route only after readiness. A candidate readiness probe is not runtime authority.
Failures preserve the prior serving revision where retirement has not occurred;
after retirement, service resumes only through verified activation or rollback.

Shared retained storage adds a stricter handoff requirement. Before any successor
can write it, including automatic initialization, repair, or restore, Compute
must establish actual predecessor termination and resolve earlier creates that
might still produce writers. Names, lease expiry, route withdrawal, and elapsed
time are insufficient. Candidate preparation before this barrier must remain
isolated from that shared writable state. If no-writer evidence is unavailable,
replacement is blocked with data retained.

### Recover a completed boundary

The initial profile supports a fresh runtime in the same cluster using retained
volumes and an exact compatible Harness/build, configuration, adapter protocol,
and recovery schema. It preserves completed text and supported inert tool
observations alongside verified workspace durability. It does not preserve
process RAM, an interrupted shell, provider-private reasoning, or every native
session detail.

A recovery head is not automatically a historical filesystem snapshot. Interrupted
work may have changed retained files after the last completed conversation turn.
Expose that condition and require an explicit recovery disposition; do not pair
older context with residual files and call it a clean rollback.

Once the no-writer barrier is satisfied, a trusted offline recovery adapter may
import and read back the selected completed context without executing the Harness.
If import requires Harness execution, OCC first selects the candidate as the sole
active revision and keeps ordinary work admission and its route closed until
restore and readiness succeed. Restore must not execute model calls, historical
tools, or restored startup instructions. Verify compatibility and file ownership
before permitting ordinary work; otherwise remain nonserving. New execution receives a fresh incarnation and current
workload authorization. Credentials and historical turn grants are never restored
as authority. A changed build requires a separately qualified compatibility or
migration path, not optimistic schema matching.

### Make stop and failure outcomes visible

Stop first persists intent and closes new execution admission. Existing work
then drains within the selected bound or is interrupted; retain the last verified
completed boundary and report any newer uncertainty. Compute stops the exact
owned workload and observes termination. Credential and provider cleanup proceed
under their separately retained responsibilities. The public [credential
proposal](https://github.com/openclaw/rfcs/pull/68) likewise distinguishes closure
from upstream revocation.

If termination is unknown, report it and block writable replacement. If provider
submission may have occurred, retain the exact operation as outcome-unknown.
Reconcile it through supported read/idempotency mechanisms or seek an explicit
disposition; a new process must not automatically repeat a write. Revoking local
authority cannot retract an already accepted remote effect.

Stopped intent survives restart and incoming messages. Resume requires fresh
explicit authorization and current build eligibility. Failed recovery cannot
silently fall back to a revoked build. Storage loss outside the selected retained-storage guarantee remains data loss requiring a separate recovery capability.

### Qualify the integration

RFC 0027 supplies ownership and activation rules, not completed-state portability.
Qualification needs a real supported Harness: recover a non-self-contained
conversation and files, prove predecessor exclusion, survive controller restart,
preserve stopped intent, and expose incompatible restore and ambiguous effects.
Source contracts or mocked transitions do not establish these runtime guarantees.

## Rationale

A small durable state machine separates acceptance, dispatch, and observation
without adopting a workflow engine. Explicit compatibility profiles make the
initial recovery promise independently testable. A fresh container cannot make
retained executable content safe.

Related proposals address different boundaries: [Gateway recovery](https://github.com/openclaw/rfcs/pull/46)
discusses application-consistent recovery and scale-to-zero; [remote AgentHarness](https://github.com/openclaw/rfcs/pull/31)
proposes bridge and event protocols. Both remain proposals. This RFC focuses on
Enterprise Agent/runtime ownership and same-cluster retained-workspace recovery;
it does not select their snapshot, host-wake, or bridge protocols.

## Unresolved questions

- Which Harness/build/configuration combinations form the first supported profile?
- What drain bounds and escalation policy apply when writers cannot be observed?
- Which workspace and context metadata must be retained, exported, or deleted together?
- How should operators resolve interrupted files and unknown provider outcomes?
- What evidence permits later changed-build recovery or storage-independent restore?
