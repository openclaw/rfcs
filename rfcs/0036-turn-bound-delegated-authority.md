---
title: Service-owned work authority for Enterprise Agents
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-11
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/70
---

# Proposal: Service-owned work authority for Enterprise Agents

## Summary

Give repository Agents the minimum service-owned Work authority needed to bind each operation to its original request, exact execution and current service permissions. Ship repository reads first, then human-approved publication. Broader persistent Work and lifecycle features follow later. This extends [RFC 0027](0027-openclaw-enterprise.md#iam-and-authority) without requiring a general Work product for the first release.

## Motivation

A review can take many turns and outlast a provider token. The service still needs to know which request each operation belongs to, whether it was canceled, and whether an earlier submission succeeded. Repository access alone cannot answer those questions. A small root Work profile supplies that missing authority while keeping the first release practical.

## Goals

Preserve original request identity, current authorization, configured limits, cancellation and durable outcomes. Support a root review with subordinate helpers, then add approved publication through the same authority boundary.

## Non-Goals

The initial release excludes a general Work UI/API, separately admitted durable children, continuation after coordinator loss across fresh attempts, and advanced orchestration. User-owned execution, human impersonation, cross-Namespace access, offline GitHub operations and guaranteed exactly-once provider effects are outside this proposal.

## Proposal

### Deliver in three stages

| Stage | Supported scope |
| --- | --- |
| **Repository reads** | Metadata and clone/fetch for administrator-granted repositories, using root Work and qualified subordinate helpers. |
| **Approved publication** | Selected repository read workflows plus scoped branch push and draft pull request creation. A configured human approver may be the requester. |
| **Work lifecycle** | General persistent Work interfaces, separately admitted durable children, continuation across fresh attempts, and authorized Stop/Start under [RFC 0037](https://github.com/openclaw/rfcs/pull/71). |

Advanced scheduling and orchestration remain a separate roadmap. Independent human approval and policy-based automatic authorization for explicitly permitted operations, such as an allowlisted branch push or draft PR, are later capabilities. Neither read grants nor invocation allowlists authorize publication. Automatic publication authorization is excluded from the MVP.

### Admit a small root Work record

An administrator grants the service access to selected repositories and operations. Native-channel user and channel allowlists separately determine who may invoke it. OCC checks invocation, current service access, workload permissions and data eligibility. The original invocation records attribution; it does not become a continuing service grant or transfer the requester's provider credentials.

Before execution, persist the minimum root Work contract:

- The original invocation, service owner, Installation/Namespace, Agent/revision and exact execution assignment.
- Immutable repository/action scope, purpose, data eligibility, audience and provider selections.
- The effective duration policy, any configured original horizons, resource limits and cancellation or withdrawal dependencies.

Each dispatch also retains its operation identity, immutable request and durable submission outcome. Provider credentials stay in trusted mediation.

Work admission, enforcement and recovery remain required even when these facts are stored on existing request records. No complete general Work supplier exists today. Repository read and publication operation components exist, but their authentic invocation, State, execution and credential-custody integration still needs qualification. Component tests do not establish a deployed repository flow.

### Keep helpers inside the root

A helper shares the original Work context, aggregate resource budget and cancellation. It has no independent authority or renewal and cannot reset a limit. The supported runtime must own and prove physical stop for every helper; an unqualified helper mechanism remains unsupported. Distinct child Work and renewal without a running coordinator belong to the Work lifecycle stage.

![Initial root Work and subordinate helpers](0036/work-and-children.png)

**Figure 1.** Both helpers remain inside one Work's authority and stop boundary.

### Enforce authority throughout execution

Execution duration defaults to uncapped. Finite leases and operation deadlines still apply; configured horizons never extend through activity, token replacement or renewal. Current authority may narrow access, but cannot expand the admitted scope. An Agent can retain its identity indefinitely; that does not authorize an arbitrary process to run forever. Permission changes follow RFC 0027's fresh-Pod path.

[RFC 0035 / PR 69](https://github.com/openclaw/rfcs/pull/69) binds finite leases and withdrawal to the exact assignment. GitHub requires current OCC authority for every dispatch, including reads and credential maintenance. [RFC 0034 / PR 68](https://github.com/openclaw/rfcs/pull/68) owns credential mediation. Unknown submission requires reconciliation; a replacement token, process or Work record cannot justify replay. Completion, cancellation or Work's own configured expiry closes it terminally; lease expiry only ends that lease's authority.

[RFC 0037 / PR 71](https://github.com/openclaw/rfcs/pull/71) owns execution and stop evidence. Where completed-result delivery is supported, it has separate finite authority for the exact content, audience and destination. Delivery cannot extend computation or its horizons.

## Rationale

The root profile makes repository access accountable without making general scheduling or durable child execution a prerequisite. The [supporting specification](0036/work-authority-spec.md) preserves the fuller model and marks later features explicitly.

## Unresolved questions

Which runtime can demonstrate complete helper stop ownership? Which isolation, lease and withdrawal profiles qualify the first service? How will the current components be integrated and verified as one deployed root Work flow?
