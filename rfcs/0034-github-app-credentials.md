---
title: Credential lifecycle and GitHub App access for Enterprise Agents
authors:
  - Free Wortley
created: 2026-09-05
last_updated: 2026-09-08
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/68
---

# Proposal: Credential lifecycle and GitHub App access for Enterprise Agents

## Summary

Give OpenClaw Enterprise a shared credential lifecycle behind `SecretBroker`, with GitHub Apps as the first issuer. The OpenClaw Controller (OCC) authorizes access; the broker manages credentials and cleanup; issuers perform provider operations. Production requires mediation, keeping GitHub tokens outside Agent execution. Reviewers are asked to approve this boundary and a bounded Git/`gh` profile.

## Motivation

Agents need organization-managed access to repositories, issues, and pull requests. Secret storage and account provisioning need a shared contract for managing issued credentials throughout their lifetime. Separate implementations would duplicate authorization, renewal, and crash recovery.

An external attacker can reuse a leaked token. Narrow scope limits the damage. GitHub installation tokens expire after one hour; ending a session or replacing a token does not revoke earlier copies. [GitHub token contract](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

## Goals

- Define ownership of credential authorization, protected custody, and durable cleanup.
- Support a pinned subset of ordinary Git/`gh` workflows and persistent processes within explicit grants.
- Prevent Agents from publishing private workspace content to public GitHub repositories.
- Ensure copied container-visible integration credentials grant no access elsewhere in production.

## Non-Goals

- Introducing another IAM system or a user-facing resource for every token.
- Migrating all existing credentials, supporting every provider/protocol, or hiding fetched repository history.
- Preventing disclosure through every output channel; public GitHub writes are explicitly in scope.

## Proposal

### Make the broker the lifecycle owner

Extend [RFC 0027's SecretBroker](0027-openclaw-enterprise.md#secret-access) with an internal issuer capability. Installation configuration selects implementations. Existing `Secret` references name protected material; `SecretDriver` remains responsible for its backend operations. `ServiceAccountDriver` retains account provisioning.

| Owner | Responsibility |
| --- | --- |
| OCC and existing IAM/runtime authorities | Admit the grant and mode; recheck workload and invocation authority. |
| SecretBroker and protected storage | Record issuance before dispatch, retain tokens, control delivery/use, renew access, and recover cleanup. |
| Issuer implementation | Issue/revoke within the grant; report scope, expiry, and uncertainty. |
| Compute and Sandbox drivers | Compute owns execution and checkout; SandboxDriver establishes and verifies containment. |

The issuer cannot grant permission. A lease identifies one original invocation or preparation operation; possession grants nothing. Invocation checks only narrow workload authority. Issuer shutdown, authorization closure, process termination, and provider revocation remain separate events.

The [broker specification](0034/credential-broker-v1-spec.md) defines the shared contract. It begins as a trusted local interface; it does not require a new microservice.

### Configure GitHub access

An operator enrolls a GitHub App installation through a Namespace's broker. OCC admits its repository grant, permission profile, mode, and checkout commit into an immutable revision. The signing key stays outside Agent execution.

OCC records a session's selection from those grants; current Agent authority and invocation restrictions may only narrow it. Each repository has a separate invocation lease and token. Changes to two independent repositories produce two PRs. [Session scope](0034/github-app-v1-spec.md#session-scope-and-multiple-repositories)

| Profile | GitHub permissions |
| --- | --- |
| Read-only checkout | `contents:read` |
| Issue and PR views | `contents:read`, `issues:read`, `pull_requests:read` |
| Coding | `contents:write`, `issues:read`, `pull_requests:write` |

All include required `metadata:read`. Every mint specifies the effective repository and permissions. Workflow, administration, and secrets permissions are excluded. The proxy separately checks each operation against the same grant; GitHub repository rules enforce branch and merge restrictions. Broader client support cannot broaden authority. [Policy enforcement](0034/github-app-v1-spec.md#policy-enforcement)

Git pushes and PR/API writes must target approved, non-public repositories. Public or unverified destinations deny. The [publication policy](0034/github-app-v1-spec.md#preventing-public-publication) also requires controls over visibility changes.

### Require mediation in production

| Mode | Behavior and protection |
| --- | --- |
| Mediated — production | A trusted host connector authenticates execution and original work. The proxy inserts GitHub credentials outside the container. Copied container-visible credentials alone cannot authorize access. |
| Native — development/testing only | A Git helper and each new `gh` child receive scoped tokens. Escaped tokens remain reusable until revoked or expired. |

The initial profile targets clone/fetch, prepared-branch push, repository/issue/PR views, and explicit draft PR creation. Each supported command variant requires qualification. The model-credential proxy does not implement GitHub mediation; unsupported operations deny without native fallback.

### Manage normal operation

1. **Prepare.** OCC authorizes a separate read-only checkout. SandboxDriver verifies containment; Compute verifies the commit and storage handoff. OCC gates candidate Harness startup on both. Failure preserves the serving revision and workspace.
2. **Run and renew.** The broker checks current authority before issuing credentials and each mediated operation. Long-running authorized work receives replacement tokens; each successor is tracked alongside its predecessor. Existing commands may fail on expiry; ambiguous writes are not automatically replayed.
3. **Close and clean up.** Completion, replacement, expiry, or withdrawal closes affected leases and starts durable credential cleanup. A reusable process may remain alive, but old work cannot inherit later work's authority. Workspace replacement still requires observed writer termination.

Persistent processes are a requirement. Their requests need protected work attribution; staying alive cannot extend access. Background work beyond an interactive turn needs explicit admission and a cancellation owner. The [persistent-work design](0034/credential-broker-v1-spec.md#persistent-processes-and-background-work) remains an implementation gate.

[Recovery and qualification](0034/lifecycle.md) distinguish local denial, observed termination, and upstream cleanup. Already accepted provider operations may finish.

## Rationale

A shared broker avoids duplicate lifecycle implementations while each issuer retains its provider's scope and API rules.

Mediation requires trusted origin enforcement and Git/API compatibility work. Its guarantee assumes trusted host and broker infrastructure; use of the original authorized container as a relay is outside that guarantee.

## Unresolved questions

- Which protected transport and dispatcher can attribute persistent-worker requests to their original work on the selected runtime?
- Which background-work lifetimes should initial admission support, and who owns their renewal and cancellation?
