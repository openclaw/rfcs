---
title: Workload identity and runtime authority with SPIFFE/SPIRE
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-08
status: draft
issue:
rfc_pr:
---

# Proposal: Workload identity and runtime authority with SPIFFE/SPIRE

## Summary

Use SPIFFE/SPIRE to authenticate Enterprise runtime participants while OCC separately decides which execution is current and what it may do. Preserve RFC 0027's stable Agent `WorkloadIdentity`, exact Namespace authorization and single active revision. Give each execution a distinct, server-owned registration so an unexpired credential from a retired execution cannot restore its authority. This proposes an explicit alternative to RFC 0027's pod-bound ServiceAccount-token authentication profile; it does not replace Kubernetes infrastructure identity or grant human permissions to workloads.

## Motivation

A logical Agent survives deployment and runtime replacement. Its network connections and workload credentials have shorter, overlapping lifetimes. If a service treats a valid certificate as proof that an execution is still active, an old connection can retain access after OCC retires that execution.

[RFC 0027](0027-openclaw-enterprise.md#iam-and-authority) establishes the ownership and authorization rules. This proposal specifies the additional join between authenticated runtime identity, exact execution and current authority. [SPIFFE](https://spiffe.io/docs/latest/spiffe-about/overview/) supplies workload identity documents; [SPIRE](https://spiffe.io/docs/latest/spire-about/spire-concepts/) supplies registration and attestation. Neither selects the active Agent revision or authorizes an OpenClaw operation.

## Goals

- Authenticate the exact expected participant without workload-selected subjects or trust roots.
- Preserve stable Agent identity while distinguishing every execution and restart.
- Deny obsolete execution privileges independently of certificate expiration.
- Keep bootstrap, retirement and cleanup recoverable through independently authorized services.
- Define evidence required before enabling the profile on a particular runtime.

## Non-Goals

- Replacing human login, OAG admission, IAMAdapter policy or Kubernetes authorization.
- Introducing a user-facing execution resource between AgentRevision and its workload.
- Establishing containment, preventing all credential theft, or proving physical termination from an authorization decision.
- Cross-Installation federation, cross-Namespace references or automatic trust-provider fallback.

## Proposal

### Preserve resource ownership; separate authentication profiles

RFC 0027 keeps one OCC-created `WorkloadIdentity` for an Agent. An internal runtime assignment binds that identity to an admitted revision and one exact execution. A Namespace gateway has its own service identity and cannot assume an Agent's identity. Registration and cleanup services likewise act under their own narrowly authorized identities.

Installation configuration selects the workload authentication profile. Under the proposed SPIFFE profile, X.509-SVID authentication replaces the pod-bound token at the corresponding OCC runtime boundary. The dedicated Kubernetes ServiceAccount still belongs to the workload and authorizes Kubernetes infrastructure access. Existing IAM bindings remain attached to stable OCC identities, not to certificate serial numbers or SPIFFE path strings.

Do not silently accept either credential type or switch profiles after verification fails. Profile migration requires an explicit rollout decision, current assignment bindings and withdrawal of the old acceptance path.

### Register an exact execution

| Owner | Responsibility |
| --- | --- |
| OCC | Record admitted revision, stable identity, runtime assignment and lifecycle selection. |
| ComputeDriver | Provision and observe the exact workload; supply protected execution evidence. |
| Constrained registrar and SPIRE | Bind attested selectors to the server-selected execution subject and issue its SVID. |
| Transport verifier | Validate trust and expected peer; bind authentication evidence to the actual connection. |
| Accepting service | Resolve current purpose and authorize the exact operation where it is accepted. |

The assignment record includes Installation, Namespace, participant kind, stable identity, revision when applicable, an opaque assignment identifier, execution generation and registration reference. These are internal records, not new platform resources. A replacement or restart gets a fresh execution binding even when its Agent, ServiceAccount, Pod name or Pod UID remains unchanged.

OCC records registration intent before dispatch. The registrar uses its own authority and protected Compute evidence; it does not need the target's credential to bootstrap that target. Workloads cannot supply their own SPIFFE subjects, registration parents or selectors. A timed-out create remains unresolved until exact readback or reconciliation establishes its outcome; it is not permission to create an unrelated registration.

Registration can be prepared before activation. It does not permit a candidate Harness to execute, receive Channel traffic or access a SecretBroker. Readiness observations use independently authorized control-plane paths and preserve RFC 0027's activation ordering.

### Check identity, current purpose and permission

A protected request follows this sequence:

1. Validate the connection's X.509-SVID against configured trust, certificate validity and the expected service or execution subject.
2. Resolve the subject through trusted registration and protected execution evidence to the exact assignment. Caller-provided headers or serialized identity objects cannot establish this binding.
3. Check authoritative current state for this operation's purpose: serving, an explicitly permitted control operation, or exact retained cleanup.
4. Apply the existing IAM decision and Restrictions, plus any applicable original-invocation and effect constraints. Authentication does not grant permission.

The transport produces a process-local verification handle bound to its connection and evidence lifetime. Copying its serialized fields does not recreate that handle. This is an API integrity boundary, not proof that a certificate's private key is uncopyable: ordinary TLS establishes key possession. Where an operation requires proof of the originating execution, the selected protected transport must establish that origin; a copied workload key alone is insufficient. A profile that cannot provide the required proof remains unavailable for that operation.

### Preserve authority across connections and lifecycle changes

Long-lived connections and streams recheck current purpose before privileged dispatch or protected delivery. The accepting service must use an authoritative decision or an explicitly bounded lease whose withdrawal is enforced before a retirement transition is declared effective. Cached successful checks cannot grant indefinite access. The concrete consistency and lease mechanism remains a review decision.

New connections obtain new verification handles. Credential renewal does not extend an existing handle beyond its original evidence lifetime. Missing trust, expired evidence, unavailable current state or terminal invalidation blocks further protected use; a late successful response cannot reopen a terminally invalidated stream.

Retirement closes future authority and retains independent cleanup responsibility. Registration deletion or certificate expiry does not prove that an execution stopped. Compute must resolve uncertain creates and establish predecessor termination before any writable successor, including initialization or restore. Provider revocation and already accepted external effects remain separate outcomes. Cleanup records survive Agent deletion and use the cleanup service's exact retained authority rather than the revoked workload's permission.

### Qualify the selected runtime

The first proposed deployment remains Kubernetes. A gVisor installation must demonstrate that its attestation and protected transport distinguish actual sandbox callers; a host runtime process identifier or shared label is not sufficient evidence about an inner process. No gVisor attestation implementation is implied by selecting SPIRE.

Acceptance requires two legitimate co-located workloads to receive only their own identities, a restart to obtain a distinct binding, renewal and reconnect behavior, and denial of an old execution while its certificate remains valid. Exercise warm streams, unavailable authority, registration timeouts, cleanup after deletion and uncertain predecessor termination. Record authorization closure, connection closure, physical stop and external revocation separately. Unit fixtures cannot establish this installed-runtime qualification.

## Rationale

Keeping only pod-bound tokens is simpler and remains RFC 0027's existing profile. SPIFFE adds a common service-authentication mechanism, but adds registrar, trust and attestation operations that need explicit ownership.

Using one certificate subject for every Agent execution makes replacements hard to distinguish. Per-execution registration preserves the stable Agent principal while supporting exact retirement. Certificate expiry alone is too coarse for current authorization; copying permissions into certificates would also make policy changes stale.

## Unresolved questions

- Should the SPIFFE profile replace the initial ServiceAccount-token profile or remain an explicitly selected alternative?
- Which gVisor attestation and protected-origin mechanism can satisfy the exact-execution contract?
- What authoritative read or bounded-lease protocol makes current-purpose withdrawal enforceable at every accepting service?
- What certificate, handle and lease lifetimes balance availability with denial latency, and how is profile migration qualified?
