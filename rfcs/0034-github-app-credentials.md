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

Give Enterprise Agents access to approved repositories through an organization-managed GitHub App. An external credential service issues scoped tokens for ordinary Git and `gh` commands. The first release delivers tokens into the container; a later mediated mode keeps them in a trusted proxy and binds access to the originating container.

## Motivation

Agents need to check out repositories, push changes, and work with issues and pull requests. Operators choose the repositories, permissions, and duration of access. A shared Agent should use organization-managed access rather than a participant's personal credential.

The main security concern is a leaked token being used by an external attacker. Scope limits the damage but does not prevent reuse. GitHub installation tokens expire after one hour; ending a local session does not revoke them. [GitHub token contract](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

## Goals

- Support normal Git and `gh` workflows within an explicit repository grant.
- Keep App keys outside Agent execution and centralize issuance and revocation.
- Offer mediated access where copied container-visible integration credentials confer no access elsewhere.

## Non-Goals

- Preventing an Agent from exercising its permitted operations or exposing repository data it can read.
- Hiding fetched Git history or supporting every GitHub host, protocol, and CLI command.

## Proposal

### Grant repository access

An operator makes an enrolled GitHub App installation available to a Namespace. OpenClaw Controller (OCC) authorizes its use and records the installation, repository IDs, permissions, access mode, and checkout commit in the immutable `AgentRevision`.

- **Ownership:** the credential service holds the App key and issues, refreshes, and revokes tokens.
- **Scope:** every token request specifies repository IDs and one of these permission profiles:

| Profile | Permissions |
| --- | --- |
| Read-only checkout | `contents:read` |
| Issue and PR views | `contents:read`, `issues:read`, `pull_requests:read` |
| Coding | `contents:write`, `issues:read`, `pull_requests:write` |

All profiles include the required `metadata:read` permission.

- Workflow, administration, and secrets permissions are excluded.
- GitHub repository rules must enforce any branch or merge restrictions.

### Use Git and gh

Each revision selects an access mode. The Agent cannot change it or expand its grant.

| Mode | How it works | Security property |
| --- | --- | --- |
| **Native: first release** | A Git credential helper and a launcher for each new `gh` process obtain scoped tokens. Commands use GitHub directly. | Container code can read and reuse the token. Client-managed handling keeps it out of URLs, arguments, persistent configuration, logs, and artifacts. |
| **Mediated: follow-on** | A trusted proxy checks the originating container and current grant, then inserts the installation token into approved GitHub requests. | GitHub tokens stay external. Copying container-visible integration credentials elsewhere grants no GitHub or proxy access. |

Native mode proposes a narrow exception to [RFC 0027's credential boundary](0027-openclaw-enterprise.md#secret-access) for scoped GitHub installation tokens. App keys and other long-lived platform credentials remain outside execution.

Mediated access requires origin authentication that the container cannot copy or impersonate. A reusable proxy bearer is insufficient. The `SandboxDriver` enforces the proxy route; unsupported operations fail without falling back to native access.

### Manage the lifecycle

1. **Prepare.** OCC authorizes a separate read-only checkout for the candidate revision. `ComputeDriver` verifies the checkout and storage handoff before starting the Harness. Preparation failure preserves the serving revision.
2. **Run and refresh.** Token expiry does not end a session. The service supplies replacement tokens as needed while the original invocation remains authorized; the mediated proxy checks every request. An ended turn cannot renew under a later turn's authority. Running commands may fail on expiry; ambiguous writes are not automatically replayed.
3. **Stop.** Turn completion, container replacement, or grant withdrawal closes the affected authorization. Compute stops the affected execution; the credential service revokes all associated tokens, including those replaced during refresh. Already accepted GitHub requests may finish.

Durable issuance and token records let cleanup survive workload deletion and service restarts. Local denial and confirmed GitHub revocation are separate outcomes; copied native tokens may remain usable while revocation is pending. [Detailed lifecycle and recovery rules](0034/lifecycle.md)

## Rationale

GitHub Apps provide scoped service access. Native clients preserve familiar tools and avoid requiring a complete Git/API proxy for the first release, accepting bearer-token exposure inside the container.

Mediation adds protection against credential leaks, at the cost of trusted origin enforcement and separate Git/`gh` compatibility work. It assumes trusted host and proxy infrastructure; an attacker using the original authorized container as a relay is outside the copied-credential guarantee.

## Unresolved questions

- Which trusted transport will bind mediated requests to an exact container, and which Git/`gh` operations will that mode support initially?
- What revocation latency and outage behavior should operators be able to rely on?
