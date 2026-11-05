---
title: "Scoped RBAC for multiplayer OpenClaw"
authors:
  - Erick Kinnee
created: 2026-11-04
last_updated: 2026-11-05
status: draft
issue:
rfc_pr:
---

# Proposal: Scoped RBAC for multiplayer OpenClaw

**Status:** Draft for discussion. Proposed behavior, not implemented APIs or a
certification of deployment security. No runtime or permission changes accompany
this RFC. Source paths below refer to the `openclaw/openclaw` repository.

**Submission metadata:** The implementation `issue` remains empty until acceptance;
the RFC PR link is filled after publication. Design discussion:
[openclaw/openclaw#192888](https://github.com/openclaw/openclaw/issues/192888).

## Summary

Extend OpenClaw's existing named operator roles into scoped role-based access
control (RBAC) for multiplayer deployments with staff, invited external
contributors, and guests. An invitation should grant admission, not imply the
authority of a Gateway operator.

The recommended first increment is direct person-to-role bindings for one
repository-session collaboration workflow, with effective-access explanations.
Broader agent-scoped bindings and authorization groups follow demonstrated need.
The design defines how multiple grants compose before enabling them. It builds on
existing identity, method authorization, session authority, execution policy, and
revocation owners rather than adding a parallel policy engine.

The first milestone is an agreed contributor access contract and enforcement
matrix. Tenant isolation is not established merely by adding roles. Neither the
existence of a shared Gateway nor the generic trust-model documentation is proof
of a particular deployment's isolation guarantees.

## Motivation

The [multiplayer guide](https://docs.openclaw.ai/start/multiplayer) describes a shared development
environment and an invitation path for people outside the team. External
contributors need useful access without implicitly receiving platform,
credential, publication, or deployment authority.

Today, administrators can configure named roles with several capability
dimensions, but the effective role resolver selects one role per person. The
discussion is how to evolve that foundation into understandable, resource-scoped
authorization, not whether OpenClaw should start checking permissions.

Example questions the design should answer:

- Can a contributor create an isolated repository task without reading an
  unrelated private conversation?
- Can a reviewer inspect a shared session without modifying it?
- Can someone contribute to one agent or project without administering others?
- Can the same person have different access in different collaboration scopes?
- What happens to queued inputs, retained reads, and delegated work when access
  expires or is revoked?
- Can an administrator explain why an operation was allowed or denied?

### Existing foundation

This inventory is based on source revision
`785e8c67f0d8f3577abe95a488355478e83bf63c`, not an inspection of a live deployment.
See [Operator scopes](https://docs.openclaw.ai/gateway/operator-scopes) and
[Identity and roles](https://docs.openclaw.ai/start/why-openclaw/identity-and-roles) for current behavior.

| Responsibility | Existing owner and behavior |
| --- | --- |
| Named role definitions | `GatewayOperatorRoleDefinitionSchema` in `src/config/zod-schema.gateway.ts`: operator-scope ceilings, agent restrictions, access to other people's sessions, optional sandbox requirements, worker/model policy, and access-policy requirements |
| Effective person policy | `src/gateway/operator-role-policy.ts`: explicit profile assignment, then verified cached GitHub-login mapping, then configured default |
| Assignment mutation | `users.setRole` in `src/gateway/server-methods/users.ts`, through canonical profile administration |
| Method authorization | `src/gateway/server-methods/method-authorization.ts`, method-scope resolution, and `src/gateway/methods/descriptor.ts` metadata |
| Scope implication | `src/shared/operator-scope-compat.ts` |
| Session resource authority | `src/gateway/session-access-authority.ts`: current access, canonical targets, and retained-authority lifecycle |
| Role-policy changes | `src/gateway/operator-role-policy.ts`: assignment/configuration notifications and current-role checks |
| Required external access policy | Gateway access-policy integration, including plugin-held grant authority |

Existing role definitions already constrain more than method names. Existing
session authority and revocation are not missing primitives. This proposal must
preserve their behavior, including direct session access that does not come from
the role's ceiling for other people's sessions.

Omitting `gateway.roles` currently leaves the role boundary disabled. Owner and
system authority also have existing special treatment. Changing either is an
explicit compatibility and product decision, not an incidental consequence of
adding bindings.

## Goals

- Give admitted people explicit, understandable authority over defined resources.
- Support multiple role bindings without accidental privilege combinations.
- Permit later group-based assignment without changing the authorization model.
- Preserve authenticated grant ceilings, resource checks, and execution safeguards.
- Apply policy consistently across direct requests and agent-mediated actions.
- Explain effective access without exposing inaccessible resource information.
- Preserve existing installations through a documented migration contract.

## Non-Goals

- Certifying a shared Gateway as an adversarial tenant-isolation boundary.
- Replacing sandboxing, host permissions, credential isolation, or approval systems.
- Authorization groups in the first increment, arbitrary policy languages, role
  inheritance, or user-authored deny expressions.
- Implementing enterprise identity directories inside core.
- Delegated role administration with independently configurable grant ceilings.
- Changing audit retention or collecting all authorization decisions by default.

The [security trust model](https://docs.openclaw.ai/gateway/security/trust-model) remains the supported
baseline until any stronger guarantees are designed, proven, and documented.
Invited access must not be equated with operator-level trust; equally, RBAC must
not be advertised as isolation of files or credentials it does not actually
mediate.

## Proposal

### Contributor access contract

Before implementing new bindings, classify each resource and workflow by its
intended guarantees. Distinguish intentionally shared resources, private resources
that require explicit sharing, administratively accessible resources, and
execution/storage boundaries.

#### Recommended contributor baseline

This is an illustrative policy to discuss, not this deployment's current policy,
a new built-in role, or a promise that every restriction already has an enforcement
point. The rollout gate is proof of each claimed restriction. An invitation alone
does not activate this policy.

| Workflow | Recommended outcome | Boundary to prove |
| --- | --- | --- |
| Create a repository task | Allow on an explicitly authorized agent using the configured isolated execution environment | Agent admission, worktree ownership, and worker/tool policy |
| Work in that task | Allow permitted reads, edits, and checks; no implied host administration | Session access, filesystem/network boundaries, and execution approvals |
| Read or contribute to a shared task | Allow the exact access explicitly granted to the person | Canonical session sharing and current person-policy constraints |
| Discover or read an unrelated private task | Deny, including derived search results, events, artifacts, and exports | Every read path and the source session's authority |
| Open a PR | Require separately authorized publication action and account access; task write access alone is insufficient | Publication owner and credential selection |
| Merge, release, or deploy | Deny without separately granted authority and existing required approvals | Repository/platform authority and point-of-effect checks |
| Read raw host secrets or use another person's credentials | No grant from contributor access | Secret handling, execution isolation, and credential owner |
| Manage invitations, policy, or Gateway settings | Deny under the contributor baseline | Existing owner/admin administration boundary |
| Delegate or schedule work | No broader authority than the authorized originating action; retain existing lifecycle rules | Run, child, and automation authority owners |

Private here means a resource whose canonical sharing policy excludes this
person. It does not mean all other people's sessions: intentionally shared tasks
can remain discoverable. Session creator, assignable owner, participant history,
and explicit access are distinct facts; an owner label is not a new permission.

For each row, inventory actual entry points and identify enforcement gaps. In
particular, an RPC denial does not protect a secret reachable through a shell.
If the execution environment cannot enforce a claimed boundary, fix that owner
or reduce the supported claim before enabling this baseline. Do not silently
broaden contributor authority to make the workflow work.

### Proposed authorization model

#### Concepts

- **Principal:** an existing canonical person identity, or an explicitly modeled
  system/service identity. Display names and user-supplied identifiers are not
  proof of identity.
- **Authorization group:** a collection of principals used for assignment. This
  is distinct from session grouping or participant history.
- **Permission:** a defined action on a resource type, grounded in an actual
  enforcement point.
- **Role:** a named permission bundle with an explicit domain. The existing
  person role remains baseline policy; a resource role contains only actions
  meaningful on its resource type. The first increment uses fixed session
  collaboration bundles derived from canonical sharing semantics, not arbitrary
  baseline-role definitions attached to sessions.
- **Binding:** a principal or authorization group receives a role at a defined
  resource scope.
- **Constraints:** mandatory conditions such as authenticated scope ceilings,
  sandbox requirements, execution policy, and current access-policy authority.

For discussion, a binding could mean: “Engineering receives Contributor access
to the Coding agent,” or “this reviewer receives read access to this session.”
These examples are not proposed API identifiers or configuration syntax.

Gateway, agent, and session are distinct resource kinds, not an implicit
inheritance tree. Start implementation with direct session collaboration grants;
retain existing agent admission and Gateway administration. Add agent-scoped
bindings only with explicit rules for which operations and sessions they cover.
Project/workspace scopes require defined ownership, stable identifiers,
containment, and execution boundaries. Never infer authority from a matching
name, filesystem path, or a session appearing under an agent.

#### Recommended grant and constraint composition

Keep three categories explicit:

| Category | Recommendation | Example |
| --- | --- | --- |
| Additive grant | Evaluate each complete action/resource pair; any valid grant path may authorize the action | Write session A and read session B do not grant write to B |
| Grant-local condition | The selected grant path must satisfy its conditions; unrelated bindings do not impose conditions on every resource | A worker restriction on a grant for A does not change a read-only grant for B |
| Mandatory restriction | Every grant path must satisfy it; no binding can remove it | Authenticated scope ceilings, baseline agent/model/worker restrictions, required sandboxing, and live admission/access-policy authority |

For the first increment, retain each person's existing single effective role as
the baseline policy. Existing role-level scope, agent, sandbox, model, worker,
and required access-policy restrictions remain mandatory under their current
contracts. New bindings add resource access; they do not replace that baseline
or broaden its ceilings. A permission that the baseline or authenticated grant
does not permit remains unavailable even if a binding names it.

The session `others` setting is special: it controls ambient access to other
people's sessions under the existing sharing rules. Do not reinterpret it as a
universal ceiling over all explicit sharing or as an unconditional grant to a
private session. Preserve current decisions and resolve explicit grants through
the canonical sharing owner.

Do not initially attach independently composable sandbox/model/plugin policies
to new bindings. Such grant-local conditions are an extension point, not first-
release functionality. Reject unsupported binding fields and role combinations
at administration time. This avoids inventing union/intersection rules for the
entire existing role schema.

#### Session access and precedence

The following is the recommended relationship between grant sources. All paths
remain subject to authenticated authority, current baseline constraints, session
lifecycle, and execution checks.

| Access source | Role in the decision | Effect of a new binding |
| --- | --- | --- |
| Existing creator and explicit-sharing rights | Preserve the canonical session owner's existing grants and limits | Add no duplicate permission store; normalize binding operations through that owner |
| Ambient visibility and baseline `sessions.others` | Preserve access already allowed by current sharing semantics | Do not turn an agent-level grant into access to private/draft sessions |
| Direct session binding | An explicit grant, not an override of mandatory constraints | Only an actor already authorized to share that session may create it; use the same private/incognito sharing restrictions |
| Default or identity-mapped role | Select the baseline using existing assignment precedence | Not an additional role union; a binding does not change baseline selection |
| Gateway administrator | Preserve existing Gateway-wide administrative semantics | Not expressible by a resource-scoped binding |

For session bindings, canonical sharing state is authoritative. The binding API
and access explanation are views/operations over that owner, not a second ACL
checked with an independent OR. If the existing owner cannot express a required
read/write grant, extend it through reviewed migration or defer that grant type.
Do not infer membership from presence or participant history.

A binding removal removes that grant, not necessarily every route to the resource.
If a person still has creator, ambient, or another explicit grant, access may
remain; the explanation must identify the remaining source. A “remove all access”
operation would be a separate administrative contract and is not proposed here.
Revocation of retained work continues to follow its original authority lifecycle,
even when a new request could qualify through another grant.

Because grants are additive, this feature does not make an existing broadly
privileged role least-privilege. Adopting the contributor baseline requires an
explicit, reviewed policy change, not merely adding narrower bindings.

#### Request decision and administrator treatment

1. Resolve a verified principal and current authenticated authority. Do not infer
   a human identity from shared-secret access.
2. Resolve the existing baseline person policy and live admission requirements.
3. Determine the actual action and canonical resource from validated parameters.
   A method name alone may be insufficient.
4. Evaluate complete grant paths through the owning resource policy, then enforce
   every mandatory constraint and the selected path's conditions.
5. Revalidate current authority at the owning point of effect using existing
   admission and retained-authority contracts.

Keep `operator.admin` Gateway-wide. Resource management permissions must not
be projected into `operator.admin` or an expanded connection scope list. The
existing method-authorization admin fast path and scope implication operate on
that broad scope; neither substitutes for a resource-scoped decision. Reject
resource bindings that attempt to grant Gateway administration. Existing owner
and authenticated administrator paths retain their documented treatment.

Unclassified protected actions deny in the new authorization path. Existing
public, health, node, and recovery operations retain explicit contracts.

#### Worked examples

**Different access to two tasks.** A contributor's baseline and authenticated
grants permit session collaboration. An explicit binding permits write to task A;
another permits read to task B. Writing A and reading B are allowed. Writing B is
denied unless a separate existing grant already permits it. The decision never
combines the write action from A with B's resource. Removing A's binding removes
that access source; a remaining creator grant is reported rather than ignored.

**No escape from sandboxing or invitation expiry.** A contributor's baseline
requires sandboxing and a current visitor-access grant. Two session bindings
permit work on A and B; neither mentions sandboxing. Both still require the
baseline sandbox. A second binding cannot authorize an unsandboxed launch or
replace an expired admission grant. Expiry follows the existing revocation
contract, including point-of-effect checks after awaited approvals; this is not
a new promise to cancel every in-flight operation identically.

#### Admission, execution, and revocation

Invitation validity and resource authorization are separate requirements. Reuse
the current invitation/access-policy owner for expiring and revoked grants; do
not duplicate its grant database or expiry logic in RBAC.

Agent-mediated operations must not become a bypass. Apply person-policy decisions
through existing tool/runtime boundaries, including child work and automation.
Keep system-originated work explicit rather than assigning every background
operation an invented human identity. Tool visibility is not authorization, and
per-turn checks must not require rebuilding stable tool definitions.

Role, binding, group, and invitation changes should reuse existing invalidation
and authority lifecycles. Define separately how each affects future admission,
queued work, retained reads, in-flight work, and the next protected effect. Do not
promise blanket cancellation or continued execution without the relevant owner
contract. Restoring access must not revive an already revoked authority capture.

### Ownership and integration

- Extend the effective-policy responsibility in
  `src/gateway/operator-role-policy.ts`; do not introduce a competing evaluator.
- Reuse method descriptors and scope implication for the permission catalog.
  Resource and tool checks remain at their owning boundaries.
- Keep baseline role definitions authoritative in the existing configuration
  owner. Fixed session-role bundles derive from the sharing contract, not a new
  configurable policy language. Session bindings use canonical sharing state;
  future bindings use their reviewed state/database owners. Groups are deferred.
  No JSON sidecar policy store or second session ACL.
- Normalize declarative and stored assignments through one effective-policy
  resolver. Do not maintain independent copies of effective access in config,
  profiles, sessions, and UI state.
- Route mutations through existing authenticated administration boundaries, with
  authority checked immediately before the mutation. Baseline-role and Gateway
  policy administration remain with existing owner/admin authority. Direct
  session grants use existing share-management authority; read/write access by
  itself does not confer permission to grant access.
- If groups are added later, use supported plugin/identity contracts for external
  providers. Define membership authority and revocation then; do not introduce a
  second owner of canonical person identity or authorization.
- Scope any derived cache by every input that affects the answer, including
  principal, authenticated grant, resource/action, and relevant policy context.
  Reuse current invalidation rather than adding a new revocation framework.

Exact persistence shapes, protocol fields, and plugin contract changes require
separate design review under their existing owners before implementation.

### Administration and explanations

Provide an effective-access view that identifies the principal, action/resource,
applicable assignment source, and decisive grant or restriction. The same
evaluator must produce explanations and enforcement results.

Ordinary denials should offer a useful next step without revealing a hidden
resource's existence or another person's membership. Administrative previews
must not mint authority or execute an operation as the inspected person.

Use the existing audit framework for approved policy-change evidence. Any new
retained fields, reader scope, or retention behavior needs explicit review. Do
not log prompts, tool content, or credentials as authorization evidence.

### Compatibility and migration

- Preserve single-role assignment precedence, default behavior, and existing
  explicit session access. The first increment retains that role as baseline
  policy rather than reinterpreting it as several additive roles. New session
  bindings and old sharing operations use the same canonical owner.
- Preserve existing role-disabled and owner/system behavior unless a separate
  reviewed migration intentionally changes them. Recommend a least-privilege
  configuration for new multiplayer deployments without silently changing old
  installations.
- Keep public role configuration and assignment operations working through an
  explicit compatibility contract. Do not expand legacy single-role operations
  into ambiguous multi-binding mutations.
- Place config transforms with Doctor/migration owners and durable-state changes
  with the existing schema/worker owners. No new runtime legacy-shape readers.
- Document how policy is backed up, upgraded, repaired, and recovered before
  enablement. Retain a supported operator recovery path without giving ordinary
  users a bypass.

The exact schema, upgrade, rollback/recovery, and deprecation plans are review
gates, not decisions implicitly approved by this proposal.

### Delivery and proof

#### First implementation slice

Use one repository-session review workflow: an authorized contributor creates a
task through existing agent admission, grants another admitted person read-only
access, and removes that grant. Add a write grant only after the same ownership
and constraint semantics are proven. Provide an effective-access explanation
from the enforcing evaluator. Validate the direct and agent-mediated paths.

If existing sharing already provides the complete workflow, reuse it; the first
change may be a normalized policy/explanation contract rather than a new storage
schema. Do not build generalized bindings merely to rename an existing API.

Groups, arbitrary scoped role definitions, project scopes, delegated policy
administration, and grant-local execution conditions are later increments.
Agent-scoped bindings require a demonstrated workflow beyond this slice.

| Stage | Deliverable | Required evidence |
| --- | --- | --- |
| 1. Access contract | Agreed workflows, boundaries, and action/resource/enforcement matrix | Trace existing behavior; identify concrete gaps without claiming a full deployment audit |
| 2. Decision model | Baseline-plus-grants contract, minimal permission metadata, and explanation shape | Legacy decisions unchanged; action/resource combinations cannot cross-grant |
| 3. Direct session bindings | Sharing-owner operations, invalidation, and any necessary migration | No unauthorized sharing or self-escalation; removal identifies remaining grant paths |
| 4. Enforcement cutover | All affected entry points consume the same effective policy | Equivalent verified authority yields consistent decisions across supported transports and delegated operations |
| 5. Administration | Role/binding management and effective-access preview | Explanations match enforcement; errors do not disclose inaccessible resources |
| 6. Rollout | Staged enablement and supported recovery | Real isolated-Gateway flow and latest-stable upgrade proof, with gaps explicitly recorded |

Required scenarios include:

- Existing explicit-role, identity-mapping, default-role, and role-disabled flows.
- A person with different permissions on two resources, including the
  write-A/read-B cross-grant regression.
- Session discovery, streaming events, search, artifacts, and downloads using
  the originating resource's current access.
- A denied action attempted directly and through an agent/tool/delegated path.
- Binding removal and invitation expiry while connected, while
  queued, and across an awaited approval before a protected side effect.
- Binding removal with a remaining creator or explicit grant; private/incognito
  session restrictions; rejection of resource-scoped Gateway admin grants.
- Group removal, if groups are introduced in a later increment.
- Regrant after revocation without revival of the original authority capture.
- No role combination bypassing authenticated scopes or execution constraints.
- An isolated Gateway with real identities, an agent/model, and a controlled
  side effect: allow, revoke, then demonstrate denial at the owning boundary.

Reuse current policy and session-authority tests, then add the smallest missing
regressions. Helper tests and mocked decisions support, but do not replace, the
production-path proof. This document itself has not run that runtime validation.

## Rationale

- **Keep single-role bundles:** lowest complexity and useful today, but requires
  bespoke roles for different combinations and cannot express general scoped
  bindings. Existing sharing may already solve individual session workflows;
  retain it where additional binding machinery provides no benefit.
- **Scoped RBAC over existing owners:** recommended. Adds assignment and
  composition complexity while preserving established enforcement boundaries.
- **General policy language or external policy engine:** defer until a concrete
  requirement exceeds scoped RBAC. Neither inherently solves resource ownership,
  delegated execution, or point-of-effect checks.
- **Separate Gateways/execution domains:** still relevant for stronger isolation.
  RBAC may complement that architecture; it does not replace it.

## Unresolved questions

1. What exact confidentiality and execution guarantees should an invited
   contributor receive, and which resources are intentionally shared?
2. Accept distinct resource domains with no implicit hierarchy, and reserve
   `operator.admin` for Gateway-wide administration?
3. Accept direct session collaboration as the first slice, with groups and
   broader agent bindings deferred? Which unmet workflow should come next?
4. Accept the existing person role as mandatory baseline policy, with new grants
   resolved by resource owners and no binding-local execution policies initially?
5. Should role definitions remain configuration-owned initially, as proposed?
   Which bindings need declarative management versus interactive administration?
6. Which owner/system, legacy API, and upgrade contracts must remain unchanged?
7. Which maintainers own identity, policy, session access, execution, storage, and
   deployment review for this work?

The recommended decisions above are proposals for acceptance or amendment.
Agreement on the contributor baseline, sharing precedence, and first slice should
precede schema or runtime implementation.
