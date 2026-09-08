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

Give OpenClaw Enterprise a shared credential lifecycle behind `SecretBroker`, with GitHub Apps as the first issuer. The OpenClaw Controller (OCC) authorizes access; the broker manages credentials and cleanup; issuers perform provider operations. Reviewers are asked to approve this boundary and the GitHub profile. Whether production permits native tokens or requires mediation remains open.

## Motivation

Agents need organization-managed access to repositories, issues, and pull requests. Secret storage and account provisioning need a shared contract for managing issued credentials throughout their lifetime. Separate implementations would duplicate authorization, renewal, and crash recovery.

An external attacker can reuse a leaked token. Narrow scope limits the damage. GitHub installation tokens expire after one hour; ending a session or replacing a token does not revoke earlier copies. [GitHub token contract](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

## Goals

- Define ownership of credential authorization, protected custody, and durable cleanup.
- Support ordinary Git and `gh` workflows within an explicit repository grant.
- Prevent Agents from publishing private workspace content to public GitHub repositories.
- Provide mediated access where copying container-visible integration credentials grants no access elsewhere.

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

The issuer cannot grant permission. A lease identifies one original invocation or preparation operation; it grants nothing by possession. Workloads retain their own authority, with invocation checks only narrowing it. Issuer process shutdown, authorization closure, container termination, and provider revocation remain separate events.

The [broker specification](0034/credential-broker-v1-spec.md) defines the shared contract. It begins as a trusted local interface; it does not require a new microservice.

### Configure GitHub access

An operator enrolls a GitHub App installation through a Namespace's broker. OCC admits its repository grant, permission profile, mode, and checkout commit into an immutable revision. The signing key stays outside Agent execution.

OCC records a session's selection from those grants; current Agent authority and invocation restrictions may only narrow it. Each repository has a separate invocation lease and token. Changes to two independent repositories produce two PRs. [Session scope](0034/github-app-v1-spec.md#session-scope-and-multiple-repositories)

| Profile | GitHub permissions |
| --- | --- |
| Read-only checkout | `contents:read` |
| Issue and PR views | `contents:read`, `issues:read`, `pull_requests:read` |
| Coding | `contents:write`, `issues:read`, `pull_requests:write` |

All include required `metadata:read`. Every mint specifies the repository and permissions. Workflow, administration, and secrets permissions are excluded; repository rules must enforce branch and merge restrictions. The [GitHub specification](0034/github-app-v1-spec.md) defines enrollment, clients, and provider behavior.

Writes must target approved, non-public repositories, including Git pushes and PR/API mutations. Public or unverified destinations deny. Native scope checks provide partial protection; the [publication policy](0034/github-app-v1-spec.md#preventing-public-publication) requires enforced mediation and visibility controls for the full guarantee.

### Select an access mode

| Mode | Behavior and protection |
| --- | --- |
| Native | A Git helper and each new `gh` child receive scoped tokens. Escaped tokens remain reusable until revoked or expired. This proposes a narrow exception to RFC 0027. |
| Mediated | A trusted host connector authenticates the exact execution and original invocation. The proxy inserts GitHub credentials outside the container. Copied container-visible credentials alone cannot authorize access. |

The current Crawl (initial rollout) proposal uses native repository access, with GitHub mediation optional. Its required model-credential proxy does not implement GitHub mediation. Production selection and acceptance of any native exception remain open; unsupported mediation never falls back to native.

### Manage normal operation

1. **Prepare.** OCC authorizes a separate read-only checkout. SandboxDriver verifies containment; Compute verifies the commit and storage handoff. OCC gates candidate Harness startup on both. Failure preserves the serving revision and workspace.
2. **Run and renew.** The broker checks current authority before issuing or delivering credentials and before each mediated operation. Long sessions receive replacement tokens while the original invocation remains authorized. Each successor is tracked alongside its predecessor. Existing commands may fail on expiry; ambiguous writes are not automatically replayed.
3. **Close and clean up.** Turn completion, replacement, expiry, or access withdrawal closes affected leases. Compute stops affected execution; the broker independently revokes outstanding credentials. Cleanup survives deletion and restart. An old process cannot adopt a later turn's authority.

[Recovery and qualification](0034/lifecycle.md) distinguish local denial, observed termination, and upstream cleanup. Already accepted provider operations may finish.

## Rationale

A shared broker avoids duplicate lifecycle implementations while each issuer retains its provider's scope and API rules.

Native clients offer simpler compatibility with explicit bearer exposure. Mediation addresses copied credentials but requires trusted origin enforcement and separate Git/API compatibility work. Its guarantee assumes trusted host and broker infrastructure; use of the original authorized container as a relay is outside that guarantee.

## Unresolved questions

- Should production require mediation, or accept the bounded native exception?
- Which protected local transport can prove both execution and original-invocation origin on the selected runtime?
- Can the initial mediated profile qualify the selected ordinary `gh` GraphQL commands, or must its first supported workflow be smaller?
