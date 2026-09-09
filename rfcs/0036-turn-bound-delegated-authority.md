---
title: Turn-bound delegated authority for Enterprise Agents
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-09
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/70
---

# Proposal: Turn-bound delegated authority for Enterprise Agents

## Summary

Add online, turn-bound authority for Enterprise Agents. A trusted boundary records the original request and immutable resource/action ceiling. Every operation also requires current workload permissions, initiating-principal policy and platform Restrictions. Enforcement and provider credentials stay outside the Agent. This extends [RFC 0027](0027-openclaw-enterprise.md#iam-and-authority) without transferring human credentials or permissions.

## Motivation

A shared Agent may inspect repository A for Alice, then edit B for Bob. Its ambient access or latest user cannot identify which request authorizes a delayed child process or retry.

Certificates authenticate callers; they do not establish original requests, permitted actions or current policy. Recorded approval must not survive withdrawal indefinitely. Enforce these distinctions where external operations are dispatched.

## Goals

- Bind operations to their original admitted turn and exact workload.
- Keep finite resource/action ceilings immutable despite later policy growth.
- Recheck authority, support revocation and retain truthful effect outcomes.
- Reuse OCC, IAM adapters, Restrictions and broker boundaries.

## Non-Goals

- Human impersonation, cross-Namespace access or a new IAM system.
- General policy languages, offline delegation or automatic multi-Agent orchestration.
- Treating logical subagents in one process as isolated security principals.

## Proposal

### Preserve independent workload authority

Only RFC 0027's active revision and exact workload may act through the Agent's OCC-owned `WorkloadIdentity`. The workload independently needs current permission. The turn grant only narrows it; initiating-principal, collaboration, revision, Restriction and provider policy must also allow the operation.

Alice's permission cannot let a read-only workload write. Broader workload access cannot expand her grant beyond A. Policy shrink applies on subsequent checks; recovery permits access only within the unchanged ceiling of an open grant. Closed grants cannot reopen.

### Record a turn and its operations

Use internal durable records attached to existing Agent/request identities. Conversation attribution grants no access to another user's memory; the [memory ACL proposal](https://github.com/openclaw/rfcs/pull/30) remains separate.

| Record | Contents |
| --- | --- |
| Turn grant | Original request/turn, verified principal, Installation/Namespace, Agent/revision, WorkloadIdentity/incarnation, intended receiver, immutable resources/actions, expiry and closure. |
| Operation receipt | Grant, idempotency key, canonical request fingerprint, current authorization observations, reserved allowance, dispatch state and external outcome reference. |

Session-based admission retains the verified original session reference; a caller cannot omit or change it to avoid closure. Session closure terminally closes interactive grants and dependent permits/leases across all connectors. Separately admitted session-independent work remains unavailable until specified and qualified below.

Use OCC's canonical assignment/generation from the [identity contract](https://github.com/openclaw/rfcs/pull/69) under the selected authentication profile; this does not require SPIFFE. For [broker access](https://github.com/openclaw/rfcs/pull/68), the authoritative turn grant retains session selection, selected `admittedAccessRef` values, scopes and horizon. Broker invocation selection references its immutable digest; repository leases only narrow it.

The receipt owns business-request identity and outcome. Credential issuance and lifecycle operations retain separate identities. Correlate their references: replacing a token, process or connection cannot turn a retry into a new business effect.

Trusted interfaces are `admitTurn`, `authorizeOperation` and `closeTurn`; wire formats remain open. Verified ingress and server-owned mappings resolve identity/scope. Durably record admission before acknowledging it. Duplicate keys return the same admission; conflicts deny. Admission neither dispatches a tool nor proves its effect.

Return an opaque reference bound to the authenticated presenter and original turn. Possession grants nothing. Expiry, closure or workload replacement invalidates use. Admission creates no implicit execution queue; scheduling overlap needs separate policy.

### Enforce at dispatch

1. Authenticate the workload incarnation and original-turn origin through a protected connector path, not an untrusted header.
2. Derive action and resource from the actual operation, including relevant body and redirect behavior.
3. OCC and selected authorities check the ceiling, current policies, active revision, purpose, expiry and closure. Missing evidence denies; no alternate adapter supplies permission.
4. Before submission, durably reserve applicable allowances and dispatch responsibility under the original key. Recheck authority at dispatch.
5. Submit the bounded request and record its observed result. Duplicate admission cannot trigger another submission.

Streams require bounded rechecks and terminal invalidation; asynchronous work cannot retain permanent authority. Late success cannot reopen a closed stream. Each connector must specify and qualify recheck and revocation latency.

Policy recovery cannot expand session selection, mutate a lease scope ceiling or reopen closed work. Delegated operations retain current initiating-principal checks. Preparation and retained cleanup have separate admission and purposes; they cannot impersonate the user or depend on reviving revoked user permission.

### Keep credential modes explicit

Model access retains upstream credentials in a trusted mediator. Model credentials, GitHub tokens and grant references are not interchangeable. [RFC 0034](https://github.com/openclaw/rfcs/pull/68) requires production GitHub mediation; native delivery is development/testing only. Each mediated profile must qualify origin and credential insertion. A model proxy provides neither GitHub mediation nor permission for native fallback.

### Persistent workers and background admission

Workers may serve successive turns, but operations retain original grants and protected work bindings. Surviving code, queued requests and recovered context cannot acquire later authority.

Work beyond a turn needs a separately admitted noninteractive grant. This RFC owns the unresolved producer, initiating-principal policy, resource/action ceiling, finite horizon, renewal/cancellation owner and session relationship. This paragraph authorizes no background access. RFC 0037 owns execution/recovery; RFC 0034 may consume a qualified grant but cannot invent or detach one.

### Close honestly and qualify the boundary

Closing a turn denies new authorization. It does not retract accepted effects, prove termination or revoke native tokens. Possible submission with no confirmed outcome requires exact reconciliation; a new grant or retry cannot replay it. Audit retains attribution and safe outcome references, excluding credentials and message bodies.

[RFC 0037 stop](https://github.com/openclaw/rfcs/pull/71) closes new work immediately. Eligible existing work may finish only under its unchanged grant, current policy and recorded deadline. Turn closure, deadline, disable or retirement denies further dispatch even on an open connection. Cleanup retains independent authority.

Qualification requires the real Harness, verifier, connector and authority store: allow/deny, shrink, expiry, replacement, duplicates, crash uncertainty and cross-turn misuse. Session-closure tests must deny further model and GitHub operations while connections and credentials remain valid. Shared-process code may steal later handles; original-turn isolation needs a protected boundary that prevents this. Interfaces or narrower handles alone do not qualify it.

## Rationale

Online authority reuses durable state and current IAM. Independent bearer grants add revocation/accounting machinery. Signatures alone cannot establish current policy or shared allowance state. Receipts expose uncertainty without promising exactly-once provider effects.

## Unresolved questions

- Which protected transport proves original-turn origin for each Harness?
- What freshness and outage behavior must connectors demonstrate?
- Which actions need shared allowance reservations or human approval?
- When should authenticated child Agents and bounded grant ancestry be added?
- Which noninteractive grants may outlive turns/sessions, with what admission, renewal and cancellation policy?
