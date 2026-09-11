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

Extend OpenClaw Enterprise's `SecretBroker` to manage issued credentials, starting with GitHub Apps. The OpenClaw Control Plane (OCC) authorizes each operation; a proposed `CredentialGatewayDriver` manages mediation and credential lifecycle outside Agent execution. Deliver managed repository reads first, then a coding workflow with human-approved publication, followed by broader durable work and lifecycle controls.

## Motivation

Agents need organization-managed repository, issue, and pull-request access. Shared lifecycle management avoids duplicating authorization, renewal, and recovery across providers. Scoped tokens still expose usable copies when leaked: GitHub installation tokens [expire after one hour](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app), and ending a session or replacing a token does not revoke them.

## Goals

- Keep provider credentials outside production Agent execution.
- Enforce each Agent's repository grants and exact publication policy.
- Preserve original-work authority and credential cleanup across turns and failures.

## Non-Goals

New IAM or public token resources; personal GitHub ACL synchronization; every Git protocol; hiding fetched history; disclosure prevention across every output channel. Active-session migration and replay remain later work.

## Proposal

### Configure repository access

A Namespace administrator selects repositories through typed Agent configuration. OCC authorizes the exact Agent, Configuration, and referenced integration binding. A separately authorized deployment verifies GitHub installation scope and freezes repository IDs, checkout refs, read profiles, and publication policy into `AgentRevision`; saving the draft does not activate it. Effective access intersects these grants with current service authority and the GitHub App's available permissions. App-wide access and invocation user/channel allowlists grant no repository access by themselves.

The current public Agent API has no repository field. The [proposed configuration and Driver contract](0034/repository-configuration.md) makes this addition explicit. Initial configuration is admin-managed in OCE; no external directory or personal GitHub ACL synchronization is required.

### Assign ownership

The Installation selects a proposed `CredentialGatewayDriver` for trusted mediation and broker/issuer lifecycle through admitted handles. OCC/IAM remains the sole platform authorizer. `SecretDriver` retains storage ownership; `ServiceAccountDriver` retains account provisioning. Compute owns execution and checkout; SandboxDriver verifies containment. The credential gateway is distinct from the Agent messaging gateway; one trusted deployment may host both broker and mediator.

Each broker access lease binds genuine service-owned **Work**, its exact Agent/revision and execution assignment, or separately admitted preparation. Current operation grants, cancellation/withdrawal, protected custody, durable effect records, and unknown-outcome handling are required from the first read. A work ID or caller-supplied handle cannot establish authority. The [broker contract](0034/credential-broker-v1-spec.md) and [series overview](0027/runtime-access-overview.md) define these boundaries.

### Deliver in three stages

| Stage | Release scope |
| --- | --- |
| A — Managed reads | Mediated repository metadata and clone/fetch, with verified checkout before Harness startup. |
| B — Coding workflow | Selected issue/PR reads and trusted **Approve and publish** for an exact retained candidate. |
| C — Durable work | Broader durable Work, separately admitted children, and Stop task / Stop Agent / Start Agent controls. |

Stages A and B use root Work. Subordinate helpers may share its scope and cancellation only after that context is qualified; root-only execution may qualify first. Separately admitted durable children belong to stage C. These stages have [separate acceptance gates](0034/lifecycle.md#acceptance-matrix).

![Credential requests pass through a trusted connector and mediator before GitHub.](0034/credential-flow.png)

### Authorize publication

Stage B requires explicit approval by a configured, currently authorized human; the requester may approve. The Agent cannot approve itself. Approval binds the non-public repository, exact objects, base and target refs, expected prior remote tip, and draft PR metadata. Changed candidates require new approval. Push performs an atomic expected-old update; draft PR creation is a separate recorded effect. Unknown outcomes never trigger blind replay.

Later policy modes may require an independent human or automatically authorize narrowly configured operations, such as an allowlisted branch push or draft PR. Both retain current authority and exact candidate/effect controls. Neither is enabled in the MVP or used when policy is missing. [Publication details](0034/github-app-v1-spec.md#trusted-publication) also govern later transparent Git/`gh` adapters.

### Enforce and close access

Production is mediated only. Every dispatch, including reads, issuance, and credential maintenance, requires online OCC authority; outages deny dispatch. Native tokens are development/testing only. Permission increases and decreases require a fresh Pod/gVisor sandbox and eligible context. Checkout replacement requires observed writer termination; preparation failure preserves the serving workspace.

Work and execution may be explicitly uncapped, while leases, credentials, and operation deadlines remain finite. Closure starts durable cleanup without implying process termination or provider revocation. Already accepted provider effects may finish.

## Rationale

A shared lifecycle reduces provider-specific recovery code. Mediation adds protocol and runtime integration work, but keeps reusable GitHub credentials outside execution. Copy resistance assumes trusted infrastructure and containment; relay through the original authorized container remains outside the guarantee.

## Unresolved questions

Which runtime attachment and protected dispatcher qualify first? Which exact read commands, deployment approvers/refs, approval lifetimes, and measured withdrawal bounds should the implementation support? The [acceptance plan](0034/lifecycle.md) records the required evidence; these components are not a released production path.
