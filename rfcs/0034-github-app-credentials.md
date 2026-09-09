---
title: Credential lifecycle and GitHub App access for Enterprise Agents
authors:
  - Free Wortley
created: 2026-09-05
last_updated: 2026-09-09
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/68
---

# Proposal: Credential lifecycle and GitHub App access for Enterprise Agents

## Summary

Extend OpenClaw Enterprise's `SecretBroker` to manage issued credentials, with GitHub Apps as the first provider. The OpenClaw Controller (OCC) authorizes access; the broker owns issuance, renewal, and cleanup. In production, a trusted proxy checks each GitHub request and adds the token outside Agent execution.

## Motivation

Agents need organization-managed access to repositories, issues, and pull requests. A shared credential lifecycle lets providers reuse authorization, renewal, and crash recovery.

Scoped tokens limit damage, but an external attacker can still use a leaked copy. GitHub installation tokens [expire after one hour](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app); ending a session or replacing a token does not revoke it.

## Goals

- Define who authorizes access, protects credentials, and completes cleanup.
- Support selected Git/`gh` workflows and persistent processes within explicit grants.
- Prevent Agents from publishing private workspace content to public GitHub repositories.
- Make integration credentials copied from a production container unusable elsewhere.

## Non-Goals

- A new IAM system or a user-facing resource for every token.
- Migrating all credentials or supporting every provider and protocol.
- Hiding fetched history or preventing disclosure through every output channel.

## Proposal

### Make the broker the lifecycle owner

Add an internal issuer capability to [RFC 0027's SecretBroker](0027-openclaw-enterprise.md#secret-access), selected by Installation configuration. Existing `Secret` references and `SecretDriver` manage protected material; `ServiceAccountDriver` retains account provisioning.

| Owner | Responsibility |
| --- | --- |
| OCC and existing IAM/runtime authorities | Authorize invocation separately from service/workload access; issue and withdraw bounded enforcement authority. |
| SecretBroker and protected storage | Record issuance before dispatch, protect tokens, control use, renew, and recover cleanup. |
| Issuer implementation | Issue and revoke within the grant; report scope, expiry, and uncertain outcomes. |
| Compute | Own execution and checkout. |
| SandboxDriver | Establish and verify containment. |

The broker tracks access in an **access lease** tied to one logical work record and execution assignment, or a separately admitted preparation operation. This is distinct from the bounded **enforcement lease** issued by OCC's authority service. Requester invocation permission and service/workload permission are separate; neither a lease ID nor requester identity grants provider access. The [broker interface](0034/credential-broker-v1-spec.md) runs within trusted platform services and requires no new microservice.

This proposal consumes the [identity/execution contract](https://github.com/openclaw/rfcs/pull/69), [original-work authority](https://github.com/openclaw/rfcs/pull/70), and [stop/replacement rules](https://github.com/openclaw/rfcs/pull/71). The [series overview](0027/runtime-access-overview.md) maps their ownership and remaining decisions.

### Configure GitHub access

An operator enrolls a GitHub App installation through a Namespace's broker. OCC records approved repositories, permissions, mode, and checkout commit in an immutable Agent revision. The signing key stays outside Agent execution.

Each request selects from those grants at admission to service-owned logical work, with a separate access lease and token per repository and execution assignment. Logical work may outlive a message, model turn, or token. Later session changes cannot expand its original scope. [Session scope](0034/github-app-v1-spec.md#session-scope-and-multiple-repositories)

| Profile | GitHub permissions |
| --- | --- |
| Read-only checkout | `contents:read` |
| Issue and PR views | `contents:read`, `issues:read`, `pull_requests:read` |
| Coding | `contents:write`, `issues:read`, `pull_requests:write` |

All include `metadata:read`; workflow, administration, and secrets permissions are excluded. Token issuance and proxy checks use the same grant. GitHub repository rules enforce branch and merge restrictions. [Policy enforcement](0034/github-app-v1-spec.md#policy-enforcement)

Pushes and PR/API writes require approved, verified non-public destinations, with [controls over visibility changes](0034/github-app-v1-spec.md#preventing-public-publication).

### Require mediation in production

```mermaid
flowchart LR
    AGENT["Agent execution<br/>Git / gh<br/>Persistent processes"]

    subgraph TRUSTED["Outside Agent execution"]
        CONNECTOR["Trusted host connector<br/>Establish execution<br/>and original-work identity"]
        PROXY["Broker + GitHub mediator<br/>Enforce work authority<br/>Validate operation<br/>Insert token"]

        CONNECTOR --> PROXY
    end

    GITHUB["GitHub<br/>Enforce token permissions<br/>and repository rules"]

    AGENT -->|"Request without a GitHub token"| CONNECTOR
    PROXY -->|"Authorized request + scoped token"| GITHUB
```

SandboxDriver must [enforce this route](0034/github-app-v1-spec.md#mediated-origin-and-routing) and prevent bypass. Client proxy settings alone are insufficient.

Native delivery is development/testing only: Git helpers and new `gh` processes receive scoped tokens, which remain reusable if leaked until revoked or expired.

The initial profile covers clone/fetch, prepared-branch push, repository/issue/PR views, and explicit draft PR creation. Each command variant needs qualification; unsupported operations deny without native fallback. The model-credential proxy does not provide GitHub mediation.

### Manage normal operation

1. **Prepare.** OCC authorizes a separate read-only checkout. SandboxDriver verifies containment; Compute verifies the commit and storage handoff before OCC starts the candidate Harness. Failure preserves the serving revision and workspace.
2. **Run and renew.** Enforce the admitted work and operation at every dispatch. Writes, authority renewal, and new assignments require current authority. Explicitly qualified reads may continue during an authority outage under an existing unexpired enforcement lease; narrowly preauthorized read-only credential maintenance may preserve that access. Token replacement tracks every predecessor and never renews work authority. Commands may fail on expiry; ambiguous writes are not automatically replayed.
3. **Close and clean up.** Work completion, assignment retirement, access expiry, or withdrawal closes affected broker leases and starts durable cleanup. Logical work can move to a fresh authorized assignment after the required stop barrier; old assignment leases remain closed. Reusable processes cannot lend later work's authority to old requests. Workspace replacement requires observed writer termination.

Persistent processes need trusted attribution of requests to their original work. Attached children have their own admission and immutable lineage; renewal depends on open, authorized logical ancestors, not a live coordinator process. The [protected dispatch mechanism remains a release gate](0034/credential-broker-v1-spec.md#persistent-processes-and-background-work).

[Recovery requirements](0034/lifecycle.md) distinguish stopping access, stopping a process, and revoking tokens. Already accepted provider operations may finish.

## Rationale

A shared broker gives providers common lifecycle behavior while issuers retain provider-specific APIs and scope rules.

Mediation requires trusted origin enforcement and Git/API compatibility work. Copy resistance assumes trusted host and broker infrastructure; it does not cover an attacker relaying through the original authorized container.

## Unresolved questions

- Which protected transport and dispatcher can attribute persistent-worker requests to their original work on the selected runtime?
- Which GitHub read operations and read-only credential-maintenance profile can qualify for bounded operation during an authority outage?
- What numerical lease and withdrawal profiles meet the selected availability and security requirements?
