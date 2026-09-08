---
title: Turn-bound delegated authority for Enterprise Agents
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-08
status: draft
issue:
rfc_pr:
---

# Proposal: Turn-bound delegated authority for Enterprise Agents

## Summary

Add an online, turn-bound authority contract for Enterprise Agents. A trusted
boundary records the original request and a fixed resource/action ceiling; each
subsequent operation must also satisfy the workload's own current permissions,
current initiating-principal policy, and platform Restrictions. Enforcement and
provider credentials remain outside the Agent. This extends the operation
boundary in [RFC 0027](0027-openclaw-enterprise.md#iam-and-authority) without
letting a workload inherit a human's credentials or permissions.

## Motivation

A shared Agent may handle Alice's request to inspect repository A and then
Bob's request to edit repository B. Neither the Agent's ambient access nor the
most recently active user identifies which request permits a particular tool
call. A delayed child process or retry must remain associated with its original
turn.

An identity certificate answers who is calling. It does not establish the
allowed repository, action, initiating request, or whether permission still
exists. A recorded approval also cannot survive policy withdrawal indefinitely.
We need a small contract that makes these distinctions enforceable at the
actual external-operation boundary.

## Goals

- Bind every covered operation to its original admitted turn and exact workload.
- Enforce finite resource/action ceilings that later policy changes cannot widen.
- Recheck current authority, support revocation, and retain truthful effect outcomes.
- Reuse OCC, existing IAM adapters, Restrictions, and broker boundaries.

## Non-Goals

- Human impersonation, cross-Namespace access, or a new IAM system.
- General policy languages, offline delegation, or automatic multi-Agent orchestration.
- Claiming that logical subagents sharing a process are isolated security principals.

## Proposal

### Preserve independent workload authority

RFC 0027 gives each Agent an OCC-owned `WorkloadIdentity`; only its active
revision's exact workload may act. Preserve that rule. For an operation, the
workload must independently possess the required current permission. The
original-turn grant is an additional restriction, never a substitute binding.
The initiating principal must remain authorized for the requested use, and
applicable collaboration policy, revision limits, Restrictions, and provider
policy must also allow it.

For example, Alice's read-only grant cannot let a read-only workload write, even
if Alice can write. A workload's broader repository access cannot expand her
grant beyond A. Policy shrink takes effect on subsequent checks; policy growth
can restore access only within the original ceiling while the grant remains open;
it cannot reopen a closed grant. No amendment to RFC 0027's
no-inheritance rule is proposed.

### Record a turn and its operations

Use internal durable records attached to existing Agent and request identities;
these are not additional user-facing deployment resources. Conversation
association supplies attribution, not permission to read another user's memory;
the [memory ACL proposal](https://github.com/openclaw/rfcs/pull/30) remains separate.
Illustrative fields:

| Record | Contents |
| --- | --- |
| Turn grant | Original request/turn reference, verified initiating principal, Installation and Namespace, Agent, revision, WorkloadIdentity and incarnation, intended receiver, immutable resources/actions, expiry, and closure state. |
| Operation receipt | Grant reference, idempotency key, canonical request fingerprint, current authorization observations, reserved allowance where applicable, dispatch state, and external outcome reference. |

Conceptual trusted interfaces are `admitTurn`, `authorizeOperation`, and
`closeTurn`. Wire formats remain open. Admission resolves identity and scope
from verified ingress and server-owned mappings, not model text or caller-chosen
identity labels. It durably records the grant before acknowledging acceptance.
A duplicate key returns the same admission; a conflicting request is rejected.
Admission alone neither dispatches a tool nor proves an external effect.

Return an opaque reference bound to the intended authenticated presenter and
original turn. Possession alone grants nothing. Expiry, closure, or workload
replacement invalidates further use. Scheduling overlap remains a separate
policy; admitting authority does not create an implicit execution queue.

### Enforce at dispatch

1. The trusted connector authenticates the actual workload incarnation and
   original-turn origin through a protected path. An untrusted header is
   insufficient.
2. It derives the exact action and resource from the operation it will send,
   including relevant request-body and redirect behavior.
3. OCC and selected authorities check the immutable ceiling, current policies,
   active revision, purpose, expiry, and closure. Missing or unavailable evidence
   denies the operation; no alternate adapter supplies a fallback allow.
4. The operation owner durably reserves any allowance and records dispatch
   responsibility under the original idempotency key before submission. It
   rechecks current authority at the actual dispatch boundary.
5. The connector sends the bounded request and records the observed result.
   Duplicate admission does not cause another submission.

A positive decision cannot be carried across arbitrary asynchronous work as
permanent authority. Streams need bounded rechecks and terminal invalidation;
late positive responses cannot reopen a closed stream. Exact recheck and
revocation-latency requirements must be selected and qualified per connector.

### Keep credential modes explicit

Model access uses a trusted mediator that retains upstream credentials. Model
credentials, GitHub installation tokens, and opaque grant references are
separate mechanisms; one cannot stand in for another.

The public [GitHub credential proposal](https://github.com/openclaw/rfcs/pull/68)
distinguishes native Git/`gh` tokens from mediated repository access. Native
mode deliberately exposes scoped bearer tokens to workload processes and
proposes a separate, narrow exception to RFC 0027. This RFC does not approve
that exception or claim a model proxy mediates GitHub. A strict mediated profile
must qualify its own protected origin and credential insertion path; unsupported
mediation never falls back to token delivery.

### Close honestly and qualify the boundary

Closing a turn denies new authorizations. It does not retract an accepted
provider operation, prove process termination, or revoke an escaped native
token. Those outcomes require their own observations. A timeout after possible
submission remains outcome-unknown until reconciled by exact operation identity;
neither a new grant nor a retry silently replays it. Audit records retain
attribution and safe outcome references, excluding credentials and message bodies.

The public platform interfaces are building blocks, not proof that this complete
integration works. Qualification must exercise the selected real Harness,
identity verifier, connector, and authority store: allow/deny, policy shrink,
expiry, workload replacement, duplicate submission, crash ambiguity, and
cross-turn misuse. Surviving code in a shared process may steal a later handle;
a strict original-turn isolation claim requires a protected origin boundary
that actually prevents this, not merely narrower handles.

## Rationale

A single online authority can reuse existing durable state and current IAM
checks. Independent long-lived bearer grants would require separate revocation
and accounting mechanisms. Offline capabilities and token exchange may become
useful adapters, but serialization or signature verification alone cannot
establish current policy or shared allowance state. Explicit operation receipts
also make uncertainty reviewable without promising exactly-once provider effects.

## Unresolved questions

- Which protected transport proves original-turn origin for each supported Harness?
- What bounded freshness and outage behavior must each connector demonstrate?
- Which actions need shared allowance reservations or human approval before dispatch?
- When should separately authenticated child Agents and bounded grant ancestry be added?
