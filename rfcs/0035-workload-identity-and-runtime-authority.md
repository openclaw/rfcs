---
title: Workload identity and runtime authority with SPIFFE/SPIRE
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-09
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/69
---

# Proposal: Workload identity and runtime authority with SPIFFE/SPIRE

## Summary

Authenticate Enterprise runtime participants with SPIFFE/SPIRE while OCC decides which execution is current and what it may do. Preserve RFC 0027's stable Agent identity, Namespace authorization and single active revision. Per-execution registration prevents a retired execution's valid credential from restoring authority. This proposes an explicitly selected alternative to pod-bound ServiceAccount-token authentication.

## Motivation

Agents survive runtime replacement; their connections and credentials overlap. A valid certificate must not preserve access after OCC retires its execution.

[RFC 0027](0027-openclaw-enterprise.md#iam-and-authority) owns authorization. [SPIFFE](https://spiffe.io/docs/latest/spiffe-about/overview/) supplies identity documents; [SPIRE](https://spiffe.io/docs/latest/spire-about/spire-concepts/) supplies registration and attestation. This proposal binds authenticated identity to exact execution and current authority. Neither SPIFFE nor SPIRE selects active revisions or grants OpenClaw permissions.

## Goals

- Authenticate the expected participant without workload-selected subjects or trust roots.
- Preserve stable Agent identity while distinguishing executions and restarts.
- Deny retired executions independently of certificate expiry.
- Recover bootstrap, retirement and cleanup through independently authorized services.
- Qualify each supported runtime before enabling the profile.

## Non-Goals

- Replacing human login, OAG admission, IAMAdapter policy or Kubernetes authorization.
- Introducing a user-facing execution resource between AgentRevision and its workload.
- Establishing containment, preventing all credential theft, or proving physical termination from authorization.
- Cross-Installation federation, cross-Namespace references or automatic trust-provider fallback.

## Proposal

### Preserve resource ownership; separate authentication profiles

Each Agent retains its OCC-created `WorkloadIdentity`. An internal assignment binds it to an admitted revision and execution. Gateways, registrars and cleanup services use their own narrowly authorized identities; they cannot assume Agent identity.

Installation configuration selects authentication. X.509-SVIDs replace pod-bound tokens only at the selected OCC runtime boundary. The dedicated ServiceAccount retains Kubernetes infrastructure authorization; IAM bindings remain attached to stable OCC identities. No human permissions transfer.

Verification failure cannot switch profiles or admit another credential type. Migration requires an explicit rollout, current assignment bindings and withdrawal of the old acceptance path.

### Register an exact execution

| Owner | Responsibility |
| --- | --- |
| OCC | Record admitted revision, stable identity, runtime assignment and lifecycle selection. |
| ComputeDriver | Provision and observe the exact workload; supply protected execution evidence. |
| Constrained registrar and SPIRE | Bind attested selectors to the server-selected execution subject and issue its SVID. |
| Transport verifier | Validate trust and expected peer; bind authentication evidence to the actual connection. |
| Accepting service | Resolve current purpose and authorize the exact operation where it is accepted. |

Assignments record Installation, Namespace, participant kind, stable identity, applicable revision, opaque assignment ID, execution generation and registration reference. Restart or replacement creates a fresh execution binding even with unchanged Agent, ServiceAccount or Pod UID.

[RFC 0037's observations](https://github.com/openclaw/rfcs/pull/71) reference OCC's canonical assignment; they cannot select another current execution. Lifecycle intent has a separate generation: stop need not change execution generation; replacement does.

Record registration intent before dispatch. The registrar uses its own authority and protected Compute evidence, never the target's credential. Workloads cannot choose subjects, parents or selectors. A timed-out create requires exact reconciliation, not an unrelated registration.

Pre-activation registration grants no Harness execution, Channel traffic or SecretBroker access. Independently authorized readiness paths preserve RFC 0027's activation order.

### Check identity, current purpose and permission

For each protected request:

1. Validate configured trust, certificate validity and the expected X.509-SVID peer.
2. Resolve trusted registration and protected execution evidence to the exact assignment. Caller headers or serialized identity objects are insufficient.
3. Check current purpose: serving, bounded drain of admitted work, permitted control, or retained cleanup. Drain uses the unchanged grant and RFC 0037's finite deadline; it admits no new work.
4. Apply existing IAM, Restrictions, original-invocation and effect constraints. Authentication grants no permission.

The transport produces a process-local verification handle bound to its connection and evidence lifetime. Copying its serialized fields does not recreate that handle. This is an API integrity boundary, not proof that a certificate's private key is uncopyable: ordinary TLS establishes key possession. Where an operation requires proof of the originating execution, the selected protected transport must establish that origin; a copied workload key alone is insufficient. A profile that cannot provide the required proof remains unavailable for that operation.

[RFC 0034 mediation](https://github.com/openclaw/rfcs/pull/68) checks three bindings: connector service assignment, represented Agent assignment through protected runtime evidence, and [RFC 0036's original-work grant](https://github.com/openclaw/rfcs/pull/70). Connector and gateway identities cannot replace caller authority. SPIFFE authentication for trusted services does not change Agent-to-OCC authentication.

### Preserve authority across connections and lifecycle changes

Long-lived connections and streams recheck purpose before privileged dispatch or protected delivery, using current authority or an explicitly bounded lease. Withdrawal must take effect before retirement is reported effective. The concrete consistency protocol remains open.

Dispatch permits bind assignment/generation, applicable original work and grant version, operation digest and evidence deadline. The accepting service must order purpose withdrawal, work closure and permit consumption. Unavailable authority or invalidation connectivity denies new consumption. Identity renewal cannot extend work or drain deadlines. Previously admitted provider effects may finish; record their outcomes separately.

Reconnects obtain new verification handles. Renewal cannot extend a handle's original evidence lifetime. Missing trust, expired evidence, unavailable state or terminal invalidation blocks use; late success cannot reopen a closed stream.

Retirement closes authority, not cleanup responsibility. Registration deletion and certificate expiry do not prove termination. Compute resolves uncertain creates and observes predecessor termination before any writable successor, including initialization or restore. Cleanup survives Agent deletion under its own retained authority. Termination, provider revocation and accepted effects remain separate outcomes.

### Qualify the selected runtime

The first deployment targets Kubernetes. gVisor attestation and transport must distinguish actual sandbox callers; host process IDs or shared labels do not prove inner-process identity. Selecting SPIRE supplies no gVisor implementation.

Runtime qualification must demonstrate distinct identities for co-located workloads and restarts; renewal, reconnect and warm-stream behavior; retired-execution denial while certificates remain valid; unavailable authority, registration timeouts, deletion cleanup and uncertain predecessor termination. Record authorization closure, connection closure, physical stop and external revocation separately. Unit fixtures cannot establish installed-runtime qualification.

## Rationale

Keeping only pod-bound tokens is simpler and remains RFC 0027's existing profile. SPIFFE adds a common service-authentication mechanism, but adds registrar, trust and attestation operations that need explicit ownership.

Using one certificate subject for every Agent execution makes replacements hard to distinguish. Per-execution registration preserves the stable Agent principal while supporting exact retirement. Certificate expiry alone is too coarse for current authorization; copying permissions into certificates would also make policy changes stale.

## Unresolved questions

- Should SPIFFE replace the initial ServiceAccount-token profile or remain an explicitly selected alternative?
- Which gVisor attestation and protected-origin mechanism satisfies exact-execution binding?
- Which authoritative read or bounded-lease protocol enforces purpose withdrawal?
- What certificate, handle and lease lifetimes meet availability and denial targets, and how is migration qualified?
