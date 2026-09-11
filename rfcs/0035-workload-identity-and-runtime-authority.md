---
title: Workload identity and runtime authority with SPIFFE/SPIRE
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-11
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/69
---

# Proposal: Workload identity and runtime authority with SPIFFE/SPIRE

## Summary

Propose optional SPIFFE/SPIRE authentication and finite authority leases for Enterprise runtimes. Preserve [RFC 0027](0027-openclaw-enterprise.md#iam-and-authority)'s stable Agent identity, Namespace authorization and single active revision. Give each execution its own authenticated identity while checking current permission for each operation.

## Motivation

An Agent can keep working across many turns and restart with the same configuration. Its certificates and connections may outlive an execution or permission change. The system must recognize the stable Agent without allowing old processes or credentials to recover withdrawn authority.

## Goals

Separate stable identity, execution identity and permission; bound authority withdrawal; support long-running work; and preserve independently authorized bootstrap and cleanup.

## Non-Goals

Replacing human login, OAG, IAMAdapter or Kubernetes authorization; adding a user-facing execution resource; federation; cross-Namespace references; or proving physical termination from authorization alone.

## Proposal

### Identity and authority

[RFC 0027](0027-openclaw-enterprise.md#iam-and-authority) distinguishes a human `Principal`, an automation `ServicePrincipal` and an Agent's `WorkloadIdentity`. Explicit `AccessBinding`s grant roles to the appropriate stable subject. An Agent never inherits its creator's identity or permissions.

Current implementation represents Agent identity with an Agent-owned `ServicePrincipal`, referenced by `Agent.servicePrincipalId` and allocated as `service-agent-<Agent ID>`. This draft maps that Agent-specific identity to its one stable `WorkloadIdentity`; it does not equate general automation `ServicePrincipal`s with workloads. The exact schema and binding transition remain an implementation decision. The [identity model](0035/enforcement-spec.md#identity-model) defines the mapping and distinguishes native and Kubernetes ServiceAccounts.

OCC selects the admitted revision and execution assignment. Compute supplies execution evidence; a constrained registrar and SPIRE issue an execution-bound X.509-SVID, a certificate carrying a SPIFFE identity. Restart or replacement creates a new binding that cannot reuse an old execution's authority. The SVID authenticates that execution; accepting services still authorize each operation against the Agent, original work and current assignment.

Installation configuration explicitly selects the optional SVID profile. RFC 0027's pod-bound Kubernetes ServiceAccount token remains the baseline. Authentication failure never changes profiles. A required execution-origin check must bind the actual caller to its assignment; copied identity fields or ordinary TLS key possession alone cannot establish that origin.

### Delivery stages

The first stage supports [RFC 0034's mediated metadata, clone and fetch operations](https://github.com/openclaw/rfcs/pull/68). It needs a genuine root-work record with requester, immutable scope and horizon, current cancellation and assignment state, and operation/effect attribution. Subordinate helpers share that work's authority, resource limits and cancellation; the runtime must demonstrate physical stop for every helper or support root-only execution. A broad Work API and durable child hierarchy are unnecessary for this stage.

Approved publication follows, with approval bound to the exact operation and checked alongside current authority. A configured human, including the requester, may approve in the MVP; Agents cannot approve publication. Independent-human approval and automatic authorization for specific operations under an explicit policy are later profiles owned by RFC 0034.

Full durable Work, independently continuing children and user-facing Stop/Start follow under [RFC 0036](https://github.com/openclaw/rfcs/pull/70) and [RFC 0037](https://github.com/openclaw/rfcs/pull/71). Initial delivery does not require active-session migration or effect replay. The [stage requirements](0035/enforcement-spec.md#stage-requirements) keep the necessary identity and cancellation checks in every stage.

### Runtime enforcement

Every operation in the first GitHub profile requires online OCC authority, including reads and credential maintenance. Provider credentials remain outside Agent workloads. An optional [read-outage profile](0035/enforcement-spec.md#outage-operation) requires separate selection; finite leases alone never enable offline access.

Execution duration defaults to uncapped; configured work and execution horizons are immutable for the admitted context. Every enforcement lease has a finite expiry and binds exact work and execution. Renewal requires current authority and cannot extend a configured cap. Later children also remain bounded by any configured ancestor horizons.

![Authority lifetimes](0035/authority-lifetimes.png)

*Work and executions may run without a duration cap. Every authority lease expires.*

In the Kubernetes/gVisor profile, permission increases and decreases require a fresh Pod/gVisor sandbox and execution identity. Withdraw old dispatch authority before admitting the changed scope. Retained processes, credentials or state cannot acquire new permissions in place; context handoff requires scope and isolation checks.

[Dispatch and lifecycle enforcement](0035/enforcement-spec.md#dispatch-and-lifecycle) rechecks evidence at final submission and protected delivery. Queues and reconnects cannot extend deadlines. Effective withdrawal requires complete holder acknowledgements or proven expiry; physical termination remains separate. Compute observes predecessor termination before a writable successor, and cleanup retains its own authority after Agent deletion.

## Rationale

SPIFFE offers shared service authentication with additional registration and attestation operations. Stable IAM subjects preserve policy across restarts; separate execution identities prevent a successor from inheriting stale authority. Online checks keep the first profile simple. Optional read leases trade outage availability for bounded withdrawal delay.

## Unresolved questions

How should the current Agent principal field and bindings become the target `WorkloadIdentity` mapping? Which gVisor origin mechanism, lease protocol and measured withdrawal bounds qualify? Runtime-authority persistence and GitHub mediation components exist; positive runtime-purpose authorization and protected repository use still need their authoritative producers integrated. The [enforcement specification](0035/enforcement-spec.md) defines the required behavior; an installed SPIRE/gVisor profile remains deployment work.
