---
title: Scoped GitHub App access for Enterprise Agents
authors:
  - TBD
created: 2026-09-05
last_updated: 2026-09-08
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/68
---

# Proposal: Scoped GitHub App access for Enterprise Agents

## Summary

Use an external credential service to give Enterprise Agents repository-scoped GitHub App access. Ship native Git/`gh` first, with short-lived installation tokens delivered into the container. Add a separately qualified mediated mode that inserts credentials at the trusted proxy, keeping them outside Agent execution. **The mediated guarantee is that copying all integration-issued container-visible credentials elsewhere grants no GitHub or broker access. Native mode does not provide that guarantee.**

## Motivation

The key risk is a leaked token being used by an external attacker. Scope limits what a stolen token can do; it does not bind the token to its container. GitHub installation tokens are bearer credentials with a one-hour lifetime. A shorter local lease does not shorten their upstream validity. [GitHub token contract](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

## Goals

Support ordinary repository workflows, explicit least-privilege grants, recoverable credential cleanup, and a stronger mode that prevents off-container credential replay.

## Non-Goals

Preventing permitted Agent operations, hiding fetched repository history, impersonating a GitHub user, or supporting every host/protocol/CLI command.

## Proposal

### Authority and ownership

Operators enroll an organization installation. OpenClaw Controller (OCC) admits an immutable `AgentRevision` containing the installation binding, repository IDs, permission profile, access mode and checkout intent. Tools and repository content cannot expand that grant or downgrade the mode.

The credential service owns App keys, minting, refresh and revocation. OCC owns authorization and lifecycle; `ComputeDriver` owns preparation, containers and termination; `SandboxDriver` owns containment and trusted origin enforcement. Long-lived platform credentials remain outside Agent execution.

Always supply explicit, nonempty repository IDs and permissions. Read-only checkout uses `contents:read`; collaboration adds `issues:read` and `pull_requests:read`; approved coding uses `contents:write`, `issues:read` and `pull_requests:write`. Retain required read-only metadata; exclude workflow, administration and secrets permissions. These are shared Agent grants, not a participant's personal GitHub authority. Branch/merge restrictions must be enforced upstream; a wrapper is not an authorization boundary.

### Delivery modes

| Mode | Contract |
| --- | --- |
| **Native — first release** | A Git credential helper and per-new-child `gh` launcher obtain scoped tokens. Client-managed handling avoids tokens in arguments, URLs, persistent configuration, logs and artifacts. Runtime code can still read and copy them. Direct GitHub access is intentional. |
| **Mediated — follow-on** | Trusted host egress authenticates the exact container incarnation to an application-aware proxy. The proxy validates current authority, destination, repository and operation, strips caller authentication and inserts the upstream token. Direct/token-return routes and unsupported fallbacks are denied. |

Mediated origin authentication must depend on infrastructure the container cannot copy or impersonate. A reusable broker bearer, container-readable private key, or self-reported container ID is insufficient. The selected gVisor/SPIRE integration still needs proof of this property. HTTPS credential substitution requires application-level handling; an opaque CONNECT tunnel cannot do it.

### Lifecycle

1. **Prepare:** authorize a separate, contained, read-only preparation workload for the candidate revision and exact commit. It cannot borrow a serving turn's authority. Verify checkout and storage handoff before Harness startup; failure preserves the serving revision.
2. **Execute:** bind each managed invocation to its original actor, attempt, grant, purpose, incarnation and deadline. Every acquisition/refresh, and every mediated forward, rechecks that authority. A container may outlive a turn; an old process cannot borrow a newer turn's authority. Native tokens already delivered remain reusable until revoked or expired.
3. **Mint and refresh:** persist issuance intent before contacting GitHub, then protected token material and provider expiry before delivery/use. Track every token, including refresh overlap. Lost mint responses remain unresolved; do not automatically remint or infer expiry from a client timeout. Preserve original-attempt attribution and never blindly replay a push or PR creation after an ambiguous result.
4. **Stop or revoke:** turn completion, replacement, disable or grant narrowing closes affected authority. Deny new issuance/forwards, stop affected execution, and revoke every outstanding affected token independently of compute cleanup. Preserve cleanup records across restarts/deletion. Report local denial, confirmed provider revocation, evidenced expiry and unknown outcomes separately. Already accepted GitHub requests may finish. [GitHub revocation](https://docs.github.com/en/rest/apps/installations#revoke-an-installation-access-token)

## Rationale

Native mode provides compatibility sooner with explicit bearer-token exposure. Mediation adds leak resistance and requires its own transport and client qualification; it must never silently fall back to native. Its acceptance must demonstrate that an authorized container succeeds while copies of its integration credentials fail from an external host and another container. This assumes trusted host/control-plane/broker infrastructure; use of the original container as a relay is a separate risk.

## Unresolved questions

**Implementation status, September 8:** inactive helper/launcher mechanics preserve original attempts and have 16 passing component tests. All 15 selected Git 2.55.0 / `gh` 2.93.0 cases remain unrun; their harness requires corrections. Production authority, durable inventory/revocation, preparation and selected-runtime integration remain incomplete.

Release evidence must establish actual client compatibility, private-repository scope denials, upstream branch controls and lifecycle recovery. Mediated mode additionally needs proven origin binding and its supported Git/API surface. [Supporting lifecycle and acceptance detail](0034/lifecycle.md)
