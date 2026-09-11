---
title: Credential lifecycle and GitHub App access for Enterprise Agents
authors:
  - Free Wortley
created: 2026-09-05
last_updated: 2026-09-11
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/68
---

# Proposal: Credential lifecycle and GitHub App access for Enterprise Agents

## Summary

Extend OpenClaw Enterprise's `SecretBroker` to manage issued credentials, starting with GitHub Apps. The OpenClaw Controller (OCC) authorizes access; the broker owns issuance, renewal, and cleanup. Production requests pass through a trusted mediator that obtains current online authority for each operation and adds tokens outside Agent execution. The first GitHub profile provides managed reads and a trusted Approve and publish action for an exact candidate.

## Motivation

Agents need organization-managed repository, issue, and pull-request access. Shared lifecycle management avoids duplicating authorization, renewal, and crash recovery across providers. Scoped tokens still expose usable copies when leaked: GitHub installation tokens [expire after one hour](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app), and ending a session or replacing a token does not revoke them.

## Goals

- Define authorization, credential custody, and cleanup ownership.
- Support selected Git/`gh` workflows and persistent processes within explicit grants.
- Prevent public GitHub publication of private workspace content and external reuse of integration credentials copied from production containers.

## Non-Goals

New IAM or public token resources; migrating every credential or supporting every protocol; hiding fetched history or preventing disclosure through every output channel.

## Proposal

### Ownership and authority

Extend [RFC 0027's SecretBroker](0027-openclaw-enterprise.md#secret-access) with an internal issuer capability. OCC/IAM authorizes invocation separately from service/workload access. The broker records issuance before dispatch and protects credentials; issuers issue and revoke, reporting scope, expiry, and uncertain outcomes. Compute owns execution and checkout; SandboxDriver establishes and verifies containment. Existing `SecretDriver` storage and `ServiceAccountDriver` provisioning responsibilities remain.

A broker **access lease** binds one original service-owned logical work record and execution assignment, or separately admitted preparation. OCC's bounded **enforcement lease** authorizes operations; it is distinct from broker access. Neither requester identity nor a lease ID grants provider access. The [broker contract](0034/credential-broker-v1-spec.md) follows the [series' identity, original-work, and stop rules](0027/runtime-access-overview.md).

### Credential flow

1. **Admit and prepare.** Enroll a Namespace's GitHub App installation. OCC pins approved repositories, permissions, mode, and commit in an immutable Agent revision. Admit work's selection with a separate access lease and token per repository and assignment. Prepare checkout under separate read-only authority; verify containment, commit, and safe handoff before Harness startup. Failure preserves the serving revision and workspace.
2. **Dispatch and renew.** A trusted connector identifies execution and original work. The mediator validates each operation against the same grant used for issuance, then inserts the token. Signing keys and tokens stay outside Agent execution. Replacement retains predecessor cleanup obligations without extending work authority. Never automatically replay uncertain writes.
3. **Close and recover.** Work closure, assignment retirement, access expiry, or withdrawal closes affected leases and starts durable cleanup. Reassignment needs fresh authority and the required stop barrier; old leases stay closed. Workspace replacement requires observed writer termination. Access denial, process termination, and provider revocation remain separate. Accepted provider operations may finish.

![Credential requests pass through a trusted connector and mediator before GitHub.](0034/credential-flow.png)

### Constraints

The [GitHub profile](0034/github-app-v1-spec.md) starts with managed clone/fetch and selected reads, followed by trusted **Approve and publish**. Approval binds the exact approved non-public repository, candidate objects, base, target ref, expected prior remote tip, and draft PR metadata. The publisher enforces configured approvers and exact allowed refs, performs an atomic expected-old ref update, then records PR creation as a separate effect. Missing approval policy denies; changed content or targets require new approval. GitHub rules add defense in depth. Transparent `git push` and `gh pr create` adapters follow later using the same authority and effect records. Native token delivery is development/testing only; production routing must prevent bypass.

Logical work may outlive turns and tokens; execution and work duration may be explicitly uncapped. Broker and enforcement leases, credentials, and individual operation bounds stay finite, and every configured horizon remains immutable. Persistent requests retain original-work attribution. Permission increases and decreases require a fresh Pod/gVisor sandbox and eligible context; a sibling container is insufficient. The initial child subset remains a separate decision, and active-session migration/replay is later scope.

Every first-profile GitHub dispatch, including reads, issuance, and credential maintenance, requires current online OCC authority. Unavailable authority denies dispatch. The shared broker describes a future qualified read-continuity option; it is not enabled for this GitHub profile.

## Rationale

A shared broker centralizes lifecycle behavior while issuers retain provider rules. Mediation adds origin-enforcement and Git/API compatibility work. Copy resistance assumes trusted host and broker infrastructure and intact containment; relay through the original authorized container remains outside the guarantee.

## Unresolved questions

The [acceptance matrix](0034/lifecycle.md#acceptance-matrix) defines the selected profile’s production gates. Which protected dispatcher and runtime attachment establish original-work attribution? Which approvers, self-approval rule, exact allowed refs, and numerical withdrawal bounds should deployments select? Which subordinate helpers or separately admitted children belong in the initial profile?
