# OpenClaw identity and access management

OpenClaw IAM connects enterprise identities to OpenClaw permissions without
giving human users or directory groups direct Kubernetes authority.

The [primitive model](./primitives.md) defines the resources IAM authorizes.
This document specializes that model with identities, permissions, exact
authorization targets, and runtime grants.

External identity providers own authentication, account state, and external
group membership. `IAMAdapter` is the OpenClaw IAM authority integration.
`OCCIAMAdapter` is the built-in default for every resource. Platform deployment
may install a custom IAMAdapter and select it for resource kinds in OCC
configuration YAML. Exactly one IAMAdapter evaluates each exact request.
The built-in adapter applies committed Restrictions, while a custom adapter may
also apply its own policy. The OCC permission ceiling always applies first
through fixed Role and AccessBinding evidence or the narrow creator-read
default.
The canonical [integration contracts](./integrations.md) own IAMAdapter
selection and dispatch; this document owns its authorization semantics.

OCC resolves the exact principal, action, resource, request context, and
committed identity evidence. It enforces the OCC permission ceiling, asks the
selected adapter for its tighten-only decision, and records the combined
result. Kubernetes and runtime providers retain their independent authority. A
request succeeds only when every relevant authority allows it.

Every actor-created OCC entity with a canonical `read` operation records its
initiating Principal or ServicePrincipal in server-owned immutable
`metadata.createdBy`. The same field applies to IAM entities outside the
primitive envelope. For `read` of that exact entity, a creator match satisfies
the OCC permission ceiling without another Role or AccessBinding. The selected
IAMAdapter still evaluates the exact request and may tighten or deny it. The
creator match supplies no ceiling basis for `list`, update, delete, reference
expansion, audit, runtime, or provider authority.

The [access gateway](./access-gateway.md) authenticates the caller and validates
admission before OCC evaluates IAM policy. OCC resolves the existing
`ExternalTenantLink` and Namespace for a human session. OCC accepts the actor
assertion only over the authenticated Ingress Gateway hop; end-user request
credentials never substitute for that assertion.

## Goals

- Map customer directory and provider identities to stable OCC identities.
- Define OpenClaw-native groups, roles, permissions, and scoped bindings.
- Keep exact-resource resolution, decision composition, and audit in OCC while
  allowing explicitly configured external IAM authorities to tighten access.
- Give each AgentInstance a stable WorkloadIdentity and immutable RuntimeGrants.
- Compose permissions within Namespaces across agents, plugins, secrets,
  policies, and channels without implicit privilege inheritance.
- Keep Plugin credentials and the provider-recognized subjects behind them
  outside OCC IAM and RuntimeGrant.
- Keep the IAMAdapter selectable per resource kind through OCC configuration
  without changing OpenClaw resource identity, the final decision contract,
  audit schema, or enforcement semantics.
- Keep existing Cells running under their current unexpired RuntimeGrant when
  OAG, OCC, or an external identity provider is temporarily unavailable,
  unless an explicit runtime revocation applies.

## Non-goals

- Treating authentication, external tenant admission, or product entitlement as an
  OpenClaw permission grant.
- Using email, username, display name, or LDAP DN as a durable identity key.
- Revoking tokens issued by an external identity provider. OAG revokes its
  sessions; OCC invalidates registered session evidence and its own authorization
  state.
- Translating OCC Roles or AccessBindings into Kubernetes Roles or
  RoleBindings.
- Letting a Cell inherit the permissions of the human who deployed it.
- Letting a Cell act as the invoking human at an external provider.
- Treating an OCC RuntimeGrant or Kubernetes ServiceAccount token as a
  provider-recognized identity.
- Unioning grants from OCC and an external runtime provider.
- Letting a client choose the authorization engine.
- Defining OAuth and session protocols or provider integration dispatch. Those
  belong to the [access-gateway](./access-gateway.md) and
  [integration](./integrations.md) designs.
- Migrating an existing resource kind from one IAMAdapter to another.
- Delegated administration and `DelegationGrant`. `OrgAdmin` may grant any
  fixed v1 role at any supported scope without a delegation ceiling.
- Multiple Plugin feeds and `PluginCatalogRef`. V1 uses one
  installation-configured Plugin feed.
- Cross-Namespace references and `ReferenceGrant`. Every Namespace-scoped
  reference must remain in its source Namespace.
- Updating, deleting, retiring, or remapping a Namespace. V1 permits Namespace
  creation only.
- Channel approval policy and evidence. The OpenClaw gateway handles channel
  approvals in v1 outside OCC IAM; IAM defines no channel approval Permission.
- Preventing or recovering from administrative lockout.

## Authority boundaries

| Plane | Source of truth | Responsibility |
| --- | --- | --- |
| Customer identity | OIDC IdP for v1 authentication and an external directory for identity and groups | Human authentication, account state, external tenant membership, and external group membership |
| OpenClaw authorization | OCC permission ceiling plus the one IAMAdapter selected by OCC configuration | OCC satisfies the ceiling through fixed Roles and AccessBindings or exact creator-read evidence. `OCCIAMAdapter` applies committed Restrictions; a custom adapter applies its own policy plus committed Restrictions. Either may only tighten. OCC resolves exact inputs, applies structural invariants, and records the normalized decision. |
| Kubernetes infrastructure | Kubernetes | Platform and Cell service identities, Namespace isolation, admission, and Kubernetes API authorization |
| Provider runtime authorization | Plugin, secret, channel, and other providers | Runtime use of provider-managed resources by a provider-recognized subject |

The planes compose by intersection: authority in one plane never grants
authority in another, and every applicable authority must allow the operation.

External policy administration is not another authorization plane.
`IAMAdapter` decides whether the exact administration action is allowed. A
`PolicyAdministrationAdapter` paired with that IAMAdapter projects OCC's exact
committed Restriction revision to the same external policy authority. OCC
remains canonical; projection readback supplies readiness evidence only.

## Identity classes

Identity classes are disjoint. Converting between them requires an explicit,
audited binding; no class inherits another class's permissions.

| Identity | Meaning | Authority |
| --- | --- | --- |
| `Principal` | Stable OCC human identity | OCC owns the stable identity, links, and normalized AuthorizationDecision; the selected IAMAdapter owns policy and evaluation for the exact request |
| `ExternalIdentity` | Provider subject linked to a Principal and keyed by `(provider, issuer, subject)` | Provider owns authentication and account state |
| `ServicePrincipal` | Namespace-scoped automation client | OCC owns explicit registration and AccessBindings; no JIT creation |
| `PlatformComponentIdentity` | Logical OpenClaw identity for one installed platform service, such as OCC or OAG. It is not a Kubernetes ServiceAccount. | Installation configuration defines its fixed platform capabilities and records its immutable backing ServiceAccount cluster, Namespace UID, name, and UID. |
| `WorkloadIdentity` | OCC-created logical runtime identity permanently bound to exactly one `AgentInstance`. OCC creates its server-owned UID atomically with AgentInstance acceptance. It is not a Kubernetes ServiceAccount. | Its OpenClaw authority comes from the active `RuntimeGrant`. OCC later records the immutable cluster, Namespace UID, name, and UID of its one dedicated backing ServiceAccount during identity provisioning. |

The following substitutions are forbidden:

- A `Principal` or `ServicePrincipal` cannot be attached to a Cell
  ServiceAccount.
- A `PlatformComponentIdentity` cannot become an AccessBinding subject or
  inherit the initiating user's Roles.
- A `WorkloadIdentity` cannot call OCC admin APIs or assume a human session.
- One backing ServiceAccount cannot serve both a platform component and a
  workload.
- One Cell cannot use another AgentInstance's WorkloadIdentity, dedicated
  ServiceAccount, or RuntimeGrant.
- A workload ServiceAccount belongs to exactly one WorkloadIdentity.
  Replacement Cells reuse it, but another AgentInstance never shares or
  receives it.

### Identity and directory entities

| Entity | Purpose |
| --- | --- |
| `IdentityProviderConnection` | Installation configuration for the one v1 external identity provider; credentials remain in OAG or its adapter |
| `ExternalTenantLink` | Installation-owned one-to-one link between one immutable provider tenant and one OCC Namespace within the configured IdentityProviderConnection |
| `Group` | AccessBinding subject with immutable `membershipMode`; v1 supports `local` and `synchronized` |
| `GroupMember` | OCC-owned Principal membership in a local Group |
| `ExternalGroupLink` | Explicit mapping from one exact `ExternalTenantLink` and immutable external group ID to one OCC Group |
| `ExternalGroupSnapshot` | Committed logical membership generation for one `ExternalGroupLink`, containing the complete immutable set of `(provider, issuer, subject)` membership coordinates and each coordinate's provenance |

### Authorization entities

| Entity | Purpose |
| --- | --- |
| `Permission` | Canonical action definition with allowed principal types, resource types, and request-context schema, such as `openclaw.agent_instances.deploy` |
| `Role` | Fixed v1 named set of Permissions |
| `AccessBinding` | Assignment of a Role to a Principal, Group, or ServicePrincipal at one BindingScopeRef |
| `BindingScopeRef` | Typed bindable scope: Installation or Namespace |
| `ResourceRef` | Exact target of an authorization check, including non-bindable resources such as AgentRevision and Cell |
| `AuthorizationDecision` | Revision-bound normalized allow or deny for one exact authorization request |

### Runtime entities

| Entity | Purpose |
| --- | --- |
| `WorkloadIdentity` | OCC-created stable identity permanently bound to one AgentInstance and later backed by one dedicated ServiceAccount |
| `RuntimeGrant` | Immutable compiled runtime authorization for one WorkloadIdentity, including exact Plugin actions and constraints, secret references, Channels, obligations, and runtime integration selections |

A WorkloadIdentity has no independent create, update, or delete path.
AgentInstance input cannot select its identity. It survives stop and Cell
replacement and is tombstoned with its AgentInstance; its UID is never reused or
reassigned.

A RuntimeGrant records OCC authorization intent. It contains no Plugin
credential or provider-subject metadata. It binds one WorkloadIdentity, not one
Cell. Runtime enforcement separately verifies that the caller is the exact
current Cell of that WorkloadIdentity's AgentInstance.

A verified Plugin manifest owns each tool or action identifier, risk
classification, and provider-specific constraint schema. AgentRevision freezes
the Agent's selected per-action permissions, approval modes, and constraint
values, and RuntimeGrant compiles them. The selected Plugin service enforces
that policy from its active capability-specific RuntimeGrant materialization
under the canonical [Harness integration contract](./integrations.md#harness).
SandboxPolicy remains the Cell's generic filesystem, network, exec, and
runtime-containment boundary and does not govern the Plugin service or
interpret provider-specific constraints.

For each admitted Plugin tool or action, the RuntimeGrant records the exact
Plugin and manifest digest, PluginConnection when required, selected permission,
validated constraint values, and approval obligation frozen in the
AgentRevision. It cannot introduce an action or constraint absent from the
verified Plugin manifest.

Plugin tool and action permissions are frozen runtime policy, not OCC
`Permission` entities or AccessBinding targets. Existing Agent update and
publish checks, plus exact Plugin and optional PluginConnection `use` checks,
authorize their selection.

Runtime implementation selection is an IAM dependency, not another permission.
OCC resolves each required integration from server-owned configuration and pins
the exact opaque selection revision in the RuntimeGrant. A configuration change
does not itself change an existing RuntimeGrant; a new AgentInstance creation or
later authorized update targeting `Running` may adopt it through rollout.

## Entity scope

| Entities | Scope |
| --- | --- |
| `Principal`, `ExternalIdentity`, `IdentityProviderConnection`, `ExternalTenantLink`, `Permission`, `Role`, `PlatformComponentIdentity` | Installation |
| `ServicePrincipal`, `WorkloadIdentity`, `RuntimeGrant` | Exactly one Namespace |
| `Group`, `GroupMember`, `ExternalGroupLink`, `ExternalGroupSnapshot` | Installation or exactly one Namespace; child records inherit the Group's scope |
| `Restriction` | Installation or exactly one Namespace |
| `AccessBinding` | Its exact `BindingScopeRef` |
| `AuthorizationDecision` | The scope of its exact target; never a binding scope |

`BindingScopeRef` and `ResourceRef` are references, not independently scoped
resources. An installation-scoped Principal may receive a Namespace binding;
the binding limits its permissions without changing the Principal's scope. An
installation-scoped Group may likewise receive either binding, while a
Namespace-scoped Group can receive bindings only in that Namespace.

An immutable `ExternalTenantLink` is an installation prerequisite for human
access to each Namespace. Initial installation also supplies one Namespace and
the first Principal with an installation-scoped OrgAdmin binding. This design
does not define their bootstrap mechanism. Creating a Namespace does not
implicitly create an `ExternalTenantLink`, Principal, AccessBinding, or human
admission.

Within the one configured `IdentityProviderConnection`, each immutable provider
tenant and each OCC Namespace may appear in only one `ExternalTenantLink`.
Provisioning rejects a candidate link or configuration that would make tenant
resolution ambiguous; OAG never chooses among competing mappings.

Deleting a `ServicePrincipal` requires
`openclaw.service_principals.delete` on that exact resource. OCC first advances
its credential generation and marks it inactive, so current assertions fail
immediately. OCC then requires OAG to deactivate the exact verifier through the
authenticated lifecycle-control channel before it commits the irreversible
tombstone. If OAG is unavailable, deletion remains pending from the inactive
state and retries forward; the ServicePrincipal cannot authenticate or return
to active state.

## IAMAdapter authorization

The canonical [integration contract](./integrations.md#registry-and-selection)
resolves one exact `IntegrationSelectionRef` for each evaluator resource kind.
`OCCIAMAdapter` is the built-in default. A missing, stale, or ambiguous selected
adapter denies without fallback. For a request that passed the OCC permission
ceiling, `OCCIAMAdapter` allows unless an applicable committed Restriction denies
or returns an unmet obligation. It has no separate grant store. Unknown actions,
resource mappings, or Restriction semantics deny.

For each request OCC resolves one immutable principal, canonical action,
action-specific context, committed identity evidence, and exact committed
resource state. The OCC permission ceiling requires either an applicable fixed
Role and AccessBinding containing the requested Permission or, only for exact
`read`, an actor match to the resource's immutable creator. OCC sends the
determining Role and binding evidence or creator evidence to the selected
IAMAdapter, which evaluates its own policy plus committed OCC Restrictions and
returns one normalized allow or deny. For `OCCIAMAdapter`, "own policy" means
only its known action mapping and applicable Restrictions. A custom adapter may
only deny or tighten the OCC ceiling result. OCC never calls a second
IAMAdapter or re-evaluates a custom adapter's policy.

For `list`, the exact authorization target remains the containing Installation
or Namespace, while IAMAdapter selection uses the listed resource kind. For
`create`, the target also remains the containing scope, while selection uses the
candidate resource kind. Every other operation uses the exact target resource's
kind. This separates the resource being authorized from the policy evaluator
without changing containment.

An `AuthorizationDecision` binds the principal, action, exact resource,
context digest, committed identity evidence, exact Role and AccessBinding
evidence or exact creator match, evaluator resource kind, policy digest, and
adapter selection. It carries one OCC-normalized allow or deny,
stable reason codes, tighten-only obligations, validity, and audit correlation.
A missing permission-ceiling basis, missing or ambiguous selection, deny,
timeout, stale evidence, unsupported action mapping, or unknown result fails
closed. OCC never retries against `OCCIAMAdapter` when a selected custom adapter
fails.

Every decision also preserves the determining authority evidence and the exact
selected evaluator and policy artifact revision or digest. This evidence must
be sufficient to explain which authoritative rule produced an allow or deny.

`IAMAdapter` evaluates policy; it does not mutate policy. OCC is the canonical
writer for Restrictions. Each Restriction has an OCC `policyRevision` and names
exact evaluator resource kinds, canonical actions, a typed deny or obligation
policy, and `applicability = scope | attachment`. Scope mode applies by
Installation or Namespace containment. Attachment mode applies only through
explicit Restriction UIDs on an Agent or AgentInstance. The effective set is
the deduplicated union of applicable scope Restrictions, refs frozen into the
effective AgentRevision, and current AgentInstance refs; evaluation uses each
Restriction's current committed policy revision.

Restriction actions preserve one evaluation authority. List and create target
the exact containing Installation or Namespace; the candidate Restriction is
create context. Read, update, attach, detach, and delete target the exact
Restriction. Every operation uses the IAMAdapter selected for the `Restriction`
resource kind. Every evaluator resource kind named by a Restriction must resolve
to that same IAMAdapter registration and, when it uses an external policy
authority, its exact paired PolicyAdministrationAdapter and
`policyAuthorityId`. An incompatible set is invalid configuration or mutation
input; this structural check grants no Permission.

Attach and detach are valid only for an attachment-mode Restriction. A parent
create or update authorizes mutation of the parent but does not independently
authorize its `restrictionRefs`. For an AgentInstance update, OCC computes the
exact UID delta between the committed refs and the complete candidate. Every
addition requires `openclaw.restrictions.attach` on the exact Restriction, and
every removal requires `openclaw.restrictions.detach` on the exact Restriction.
AgentInstance creation requires `attach` for every initial ref and uses its exact
deploy authorization for the parent. The parent decision, every reference
decision, and the mutation commit all-or-nothing; a missing, stale, invalid, or
denied Restriction rejects the entire update and starts no rollout. The mutation
changes the parent's refs, not the Restriction policy revision, so it does not
call the PolicyAdministrationAdapter.

For create, update, or delete, OCC authorizes against current state, then
atomically commits a new OCC `policyRevision`, a deterministic projection
intent when an external pair exists, and audit evidence. A delete revision is a
logical tombstone with `desiredPresence = absent`; it retains the exact
Restriction UID, scope, applicability, evaluator resource kinds, and canonical
actions needed to project absence. The paired PolicyAdministrationAdapter may
only reconcile that committed intent. A dependent protected request denies
until readback matches the exact OCC policy revision, desired presence, pair,
and scope, plus either the present policy digest or normalized absence evidence.
`OCCIAMAdapter` instead reads the committed OCC revision directly and requires
no projection. An external copy and its projection revision never become
canonical.

Any change not provably non-tightening is treated as a tightening. The new OCC
revision is effective immediately; affected control-plane requests deny until
its projection is ready, and affected active or pending RuntimeGrants follow
the stopped baseline. Loosening, detachment, and deletion never widen an active
grant. New evaluation still requires current projection readiness, and runtime
widening requires an actor-authorized AgentInstance rollout. Delete creates a
logical tombstone and projects absence; it rejects new refs, preserves identity
and audit, and is rejected while a pending or active RuntimeGrant references
the Restriction.

The [RuntimeGrant replacement](#runtimegrant-replacement) contract defines how
Restriction changes affect active and pending grants.

## External directory mapping

`DirectoryAdapter` normalizes directory objects by immutable provider IDs into
revisioned identity evidence that OCC validates and commits. Snapshot membership
uses immutable provider-subject coordinates and does not require a Principal for
every directory member. Before IAM evaluation, OCC resolves the stable Principal
and current ExternalIdentity, then matches that identity's exact coordinate
against the current group snapshot. IAMAdapters never call DirectoryAdapter or
accept client-authored membership.

The durable mappings are:

| Customer concept | OCC mapping | Contract |
| --- | --- | --- |
| Directory tenant | `IdentityProviderConnection` plus `ExternalTenantLink` | Explicit immutable-ID link; never infer from email domain |
| Console or API human | Provider-specific `ExternalIdentity` linked to one `Principal` | Link immutable subjects; never join by email or display name |
| Active tenant membership | OAG-registered session evidence | Admits a session but grants no Role |
| Directory group and direct members | Exact `ExternalTenantLink` and external group ID through `ExternalGroupLink`, plus one committed `ExternalGroupSnapshot` of immutable provider-subject coordinates | Authorize only when the current actor's committed ExternalIdentity coordinate appears in a complete, current revision |
| Installation-issued automation credential | Explicit `ServicePrincipal` | OCC owns the credential ID, generation, and Namespace; OAG stores only a one-way verifier; no JIT provisioning |
| Disabled or deleted subject | OAG session invalidation plus invalidated registered session evidence | OAG stops assertion issuance; OCC invalidates every corresponding registered session record and preserves identity, bindings, and audit history unchanged |

The three v1 actor paths remain distinct:

```text
Console or API user -> ExternalIdentity -> Principal -> OCC IAM
Channel sender -> provider-authenticated evidence -> Channel runtime checks
Agent workload -> WorkloadIdentity -> active RuntimeGrant
```

External group assignment is explicit:

```text
ExternalTenantLink + external group ID
  -> ExternalGroupLink
  -> OCC Group
  -> AccessBinding(Role, BindingScopeRef)
```

Each Group has one immutable membership mode. `local` uses OCC-owned
`GroupMember` edges. `synchronized` uses only the latest complete committed
provider snapshot and cannot be edited member-by-member in OCC. V1 supports
direct members; nested membership must be flattened by the identity provider.

A Namespace-scoped synchronized Group's `ExternalGroupLink` must name that
Namespace's exact `ExternalTenantLink`. An installation-scoped synchronized
Group also names one exact link; no group ID is resolved across provider tenants.
OCC accepts a snapshot only when it names the same link and its membership
provenance matches that tenant.

A snapshot coordinate need not have a materialized Principal. It grants no
authority by itself. During authorization, only an exact match to the current
actor's committed ExternalIdentity contributes synchronized Group membership.

Partial, stale, out-of-order, or ambiguous evidence never becomes authoritative.
When a synchronized snapshot exceeds its freshness bound or its external group
is deleted, permissions derived from that group deny while unrelated local
grants remain evaluable. An authorized exact Group read returns its aggregate
synchronization condition, including the provider revision, last successful
synchronization, freshness deadline, and failure condition. Snapshot membership
is not user-readable in v1. Synchronization history is audit evidence and
requires `openclaw.audit.read` on the containing Installation or Namespace.

## Roles and permissions

The following matrix is the complete v1 fixed-role contract. Brace notation is
an exact enumeration: `openclaw.agents.{list,read}` means the two named
Permissions and is not a wildcard.

| Role | Exact Permissions | Binding scopes | Binding subjects |
| --- | --- | --- | --- |
| `OrgAdmin` | Every Permission in the other rows, plus `openclaw.namespaces.{list,read,create}`, `openclaw.principals.{list,read}`, `openclaw.service_principals.{list,read,create,update,delete}`, `openclaw.roles.read`, `openclaw.bindings.{list,read,create,delete}`, `openclaw.groups.{list,read,create,update,delete}`, `openclaw.group_members.{add,remove}`, `openclaw.external_group_links.{list,read,create,delete}`, `openclaw.secret_brokers.{create,update,delete}`, and `openclaw.restrictions.{create,update,delete}` | Installation | Principal, Group |
| `AgentAdmin` | `openclaw.agents.{list,read,create,update,publish,delete}`, `openclaw.agent_revisions.read`, `openclaw.configurations.{list,read,create,update,delete,use}`, `openclaw.harnesses.{list,read,use}`, `openclaw.plugins.{list,read,use}`, `openclaw.plugin_connections.{list,read,create,update,delete,use}`, `openclaw.channels.{list,read,create,update,delete,attach}`, `openclaw.secrets.{list,read,create,update,delete,bind}`, `openclaw.secret_brokers.{list,read}`, `openclaw.sandbox_policies.{list,read,create,update,delete,attach}`, and `openclaw.restrictions.{list,read,attach,detach}` | Namespace | Principal, Group, ServicePrincipal |
| `Deployer` | `openclaw.agent_revisions.read`, `openclaw.agent_instances.{list,deploy,read,update,delete}`, `openclaw.cells.read`, `openclaw.plugin_connections.{list,read,use}`, `openclaw.channels.{list,read,attach}`, `openclaw.secrets.{list,read,bind}`, `openclaw.secret_brokers.{list,read}`, `openclaw.sandbox_policies.{list,read,attach}`, and `openclaw.restrictions.{list,read,attach}` | Namespace | Principal, Group, ServicePrincipal |
| `Operator` | `openclaw.agent_instances.{list,read,logs}` and `openclaw.cells.read` | Namespace | Principal, Group, ServicePrincipal |
| `Viewer` | `openclaw.agents.{list,read}`, `openclaw.agent_revisions.read`, `openclaw.agent_instances.{list,read}`, `openclaw.cells.read`, `openclaw.configurations.{list,read}`, `openclaw.harnesses.{list,read}`, `openclaw.plugins.{list,read}`, `openclaw.plugin_connections.{list,read}`, `openclaw.channels.{list,read}`, `openclaw.secrets.{list,read}`, `openclaw.secret_brokers.{list,read}`, `openclaw.sandbox_policies.{list,read}`, and `openclaw.restrictions.{list,read}` | Namespace | Principal, Group, ServicePrincipal |
| `Auditor` | `openclaw.audit.read`, `openclaw.namespaces.{list,read}`, `openclaw.principals.{list,read}`, `openclaw.service_principals.{list,read}`, `openclaw.roles.read`, `openclaw.bindings.{list,read}`, `openclaw.groups.{list,read}`, `openclaw.external_group_links.{list,read}`, and `openclaw.restrictions.{list,read}` | Installation or Namespace | Principal or Group at either scope; ServicePrincipal only in its own Namespace |

Creator-read is the only implicit v1 permission-ceiling basis. It is not a
Permission, Role, or AccessBinding and applies only when the requesting actor
exactly matches the immutable creator of the exact readable entity.
`OCCIAMAdapter` permits that read unless an applicable Restriction denies or
adds an unmet obligation. A custom selected IAMAdapter may tighten it under the
ordinary exact-request contract.

An Installation-bound Auditor can exercise the complete row. A Namespace-bound
Auditor can exercise only `openclaw.audit.read`, `openclaw.namespaces.read`, and
the listed `list` and `read` Permissions for ServicePrincipals, AccessBindings,
Groups, ExternalGroupLinks, and Restrictions contained by that Namespace.
Namespace containment cannot authorize `openclaw.namespaces.list`, Principal
reads, or Role reads because those operations target installation-scoped
resources.

`OrgAdmin` owns the OpenClaw installation and OCC Namespaces; it receives no
Kubernetes authority. It is the only role that may mutate AccessBindings, local
Group membership, ExternalGroupLinks, or ServicePrincipals. No delegation
ceiling exists in v1. The installation prerequisites establish the first
OrgAdmin binding, and the external directory remains authoritative for
membership in a linked synchronized Group. `OrgAdmin` grants no authority over
Backend installation or installation-deployment configuration.

Binding containment is exact. An Installation binding covers the Installation,
every Namespace, and their contained resources. A Namespace binding covers
only that Namespace and its contained resources. Agent, AgentInstance, and
other resources are authorization targets, not binding scopes. A
ServicePrincipal is Namespace-scoped and cannot receive an Installation
binding or act outside its own Namespace.

Installation-published Harness and Plugin artifacts have one narrow exception:
a Namespace binding may grant only their `list`, `read`, and `use` Permissions,
and only when the request names that exact Namespace as the candidate consumer.
This grants no installation mutation or access through another Namespace.

Every Permission fixes one exact target:

| Operation | Exact target and context |
| --- | --- |
| `list` or `create` | The containing Installation or Namespace; `create` includes the complete candidate resource in context |
| `read`, `update`, or `delete` | The exact existing resource; `update` includes the complete candidate change in context |
| `openclaw.group_members.add` or `openclaw.group_members.remove` | The exact local Group plus the exact Principal membership in context |
| `use`, `attach`, or `bind` | The exact referenced resource plus the complete candidate Agent, AgentInstance, or Namespace in context |
| `openclaw.restrictions.detach` | The exact removed Restriction plus the committed and complete candidate Agent or AgentInstance in context |
| `openclaw.agents.publish` | The exact Agent plus every frozen reference in context |
| `openclaw.agent_instances.deploy` | The exact candidate AgentRevision plus target Namespace and candidate AgentInstance in context |
| `openclaw.agent_instances.update` | The exact existing AgentInstance plus the complete candidate, including desired lifecycle, the exact `restrictionRefs` additions and removals, and, for a `Running` target, any candidate revision; adopting a different revision also requires `deploy` on that exact AgentRevision |
| `openclaw.agent_instances.logs` | The exact AgentInstance plus the resolved current Cell UID and ownership in context |
| `openclaw.cells.read` | The exact Cell |
| `openclaw.audit.read` | The exact Installation or Namespace whose audit collection is requested |

## Kubernetes mapping

OCC IAM and Kubernetes RBAC compose, but do not mirror each other:

| OCC or external entity | Kubernetes entity | Mapping |
| --- | --- | --- |
| Human Principal | None in the product path | OAG authenticates; OCC authorizes the OpenClaw operation |
| Customer or OCC Group | None | Do not create Kubernetes groups or RoleBindings for product membership |
| OCC Role or AccessBinding | None | Keep product permissions in OCC |
| Ordinary ServicePrincipal | None | Authenticate only to the OCC API with a scoped audience and AccessBindings |
| PlatformComponentIdentity | Dedicated Kubernetes ServiceAccount | Record the exact cluster, Namespace UID, name, and ServiceAccount UID on the identity and bind only the fixed least-privilege Kubernetes RBAC required by that component |
| OCC Namespace | OCC-created Kubernetes Namespace | One-to-one in v1; persist cluster ID, name, and Namespace UID |
| AgentInstance WorkloadIdentity | One dedicated ServiceAccount | OCC creates the logical identity with the AgentInstance, later provisions its backing ServiceAccount, and reuses both for replacement Cells |
| RuntimeGrant | Admission inputs, policy labels, projected refs, and provider grants | Never compile it into a human RoleBinding |

OCC calls Kubernetes as its own ServiceAccount. Kubernetes audit records that
service identity. OCC audit records the initiating actor and authorization
decision.

The Kubernetes administrator installs fixed RBAC that lets OCC create and
observe Namespaces and manage AgentInstance workloads and dedicated
ServiceAccounts in OCC-created Namespaces. OCC cannot update or delete
Namespaces or mutate Roles, ClusterRoles, RoleBindings, or ClusterRoleBindings,
and it has no `bind`, `escalate`, or general `impersonate` permission.
Kubernetes admission restricts writes to the immutable OCC Namespace mapping
and admitted resource kinds and plans. OCC never creates static ServiceAccount
token Secrets.

IAM authorizes `openclaw.namespaces.create`; the canonical
[Namespace lifecycle](./primitives.md#namespace) owns backing creation,
identity pinning, readiness, and failure behavior.

AgentInstance ServiceAccounts have no Kubernetes API permissions or RoleBindings
in v1. They exist only as the Pod's dedicated workload identity. The exact
projected-token audience set is an immutable installation prerequisite in v1.
AgentInstance workloads receive only short-lived projected tokens for that set.
AgentInstance input, RuntimeGrant state, integrations, and Drivers cannot select,
add, or override an audience.

OCC records each exact ServiceAccount cluster, Namespace UID, name, and UID on
its PlatformComponentIdentity or WorkloadIdentity. A platform-component
ServiceAccount can never double as a workload identity. Each workload
ServiceAccount belongs to one AgentInstance for its lifetime: replacement Cells
reuse it, but it is never shared with or reassigned to another AgentInstance.
IAM must allow deployment before the
[primitive lifecycle](./primitives.md#agentinstance-and-cell) provisions and
pins that identity. Every admitted replacement workload must match it.
Audit evidence records the initiating Principal or ServicePrincipal, acting
PlatformComponentIdentity, WorkloadIdentity when present, and exact immutable
ServiceAccount backing fields.

## Authorization flows

### Control-plane request

For every request, OCC:

1. Requires the canonical [OCC verification contract](./access-gateway.md#occ-verification)
   to succeed for the authenticated Gateway hop and current actor assertion.
   Request credentials are not authentication inputs.
2. Resolves the stable Principal or ServicePrincipal and, for a human, current
   committed directory evidence; an IAMAdapter never invokes DirectoryAdapter
   itself.
3. Resolves the canonical action, action-specific context, exact committed
   resource state, immutable creator, identity evidence, and applicable Roles
   and AccessBindings from server-owned data.
4. Requires the OCC permission ceiling to contain the requested Permission
   through an applicable fixed Role and AccessBinding or, only for exact
   `read`, through an exact match to the resource's immutable creator.
5. Resolves the one IAMAdapter selected for the request's evaluator resource
   kind by compiled OCC configuration and sends it the immutable principal,
   action, exact resource, context, identity, determining ceiling evidence, and
   selection proof.
6. Requires one explicit, current adapter allow and intersects its tighten-only
   obligations. A selected custom IAMAdapter is never retried against
   `OCCIAMAdapter` or locally re-evaluated.
7. Applies OCC-owned reference, composition, and lifecycle
   invariants that are structural checks rather than additional permission
   grants.
8. Normalizes the permission-ceiling result, adapter decision, and invariants
   into one AuthorizationDecision with complete evidence and canonical reason
   codes.
9. Persists the completed AuthorizationDecision and its audit evidence. For an
   allowed mutation, OCC commits assertion-ID consumption, the decision,
   mutation, and audit evidence in one atomic boundary. A failed commit writes
   none of them and leaves the assertion ID unconsumed.

The effective control-plane decision is:

```text
valid current OAG actor assertion
AND (an applicable fixed Role includes the exact Permission
     OR the exact read targets an entity created by this actor)
AND the selected IAMAdapter allows the exact action on the exact resource
AND all returned obligations hold
AND every direct reference addition or removal that declares use, attach,
    detach, or bind passes that check
AND independent OCC structural invariants hold
```

The selected IAMAdapter evaluates its own applicable policy plus committed OCC
Restrictions. OCC independently enforces the permission ceiling and
transactional invariants, then composes the result with other authority domains.
Group membership is revision-bound decision input; it does not grant permission
by itself.

When an allowed mutation creates a readable OCC entity, the same atomic commit
records the initiating actor as immutable creator. The committed mutation
decision authorizes returning that exact new entity to that actor without a
second `read` decision. This create-like result rule covers ordinary `create`,
Agent publication creating an AgentRevision, and initial AgentInstance
deployment. It does not authorize referenced-resource expansion or audit
detail. A later read is an ordinary exact-resource request and follows the full
flow above with creator evidence as its permission-ceiling basis.

### AgentInstance deployment and update

Creating an AgentInstance requires
`openclaw.agent_instances.deploy` on the exact AgentRevision with the target
Namespace and candidate AgentInstance configuration in context. Updating one
requires `openclaw.agent_instances.update` on the exact existing AgentInstance
with the complete candidate, including the desired lifecycle, exact
`restrictionRefs` delta, and any valid candidate AgentRevision in context. If an
update adopts a different revision, it also requires
`openclaw.agent_instances.deploy` on that exact candidate AgentRevision.
A request cannot adopt a different revision while targeting `Stopped`; a
stopped AgentInstance selects another revision in the update that returns it to
`Running`.

The canonical [AgentInstance and Cell lifecycle](./primitives.md#agentinstance-and-cell)
owns desired state, identity provisioning, preparation, cutover, replacement,
retry, the Cell and workload response to grant expiry, and deletion. IAM owns
the checks plus RuntimeGrant validity, renewal, and terminal transitions that
authorize that lifecycle.

Candidate AgentInstance input contains no WorkloadIdentity, ServiceAccount, or
projected-token audience field. After authorization, the primitive lifecycle
creates the server-owned WorkloadIdentity in the AgentInstance acceptance commit
and later provisions its dedicated ServiceAccount. Updates and replacements load
both existing identities.

For every creation, OCC requires `openclaw.restrictions.attach` on each initial
AgentInstance `restrictionRef`. For every update, regardless of desired state,
OCC computes the complete ref delta and separately requires `attach` on each
addition and `detach` on each removal. OCC rejects the entire parent mutation if
any required decision denies.

Every creation and every update targeting `Running` additionally passes these
checks:

1. The selected IAMAdapter allows every applicable exact action and target
   above.
2. Separate exact checks allow the required use, attach, or bind actions on
   every referenced PluginConnection, Channel, SandboxPolicy, and Secret.
   Restriction references use only the exact delta checks above.
3. Every Namespace-scoped reference belongs to the AgentInstance's Namespace.
   Every referenced resource remains eligible for new use, and the selected
   AgentRevision and all of its exact snapshots and immutable pins remain
   available. A mutable resource's current specification never replaces the
   frozen input.
4. The primitive lifecycle records the new WorkloadIdentity in the acceptance
   commit, then provisions the dedicated ServiceAccount and records its UID
   before plan admission. Update and replacement load both existing identities.

A transition to `Stopped` that changes only desired state requires the authorized
update on the exact AgentInstance and structural lifecycle checks. It performs no
dependency availability, use, attach, bind, or deploy checks and compiles no
Cell plan or RuntimeGrant. A stop request that also changes `restrictionRefs`
must pass every corresponding attach or detach check. The primitive lifecycle
immediately applies the stopped baseline and permanently disqualifies any
pending or indeterminate candidate; operation recovery and cleanup follow
without delaying revocation.

For a target state of `Running`, OCC compiles the candidate RuntimeGrant and
Cell plan from the selected AgentRevision's frozen inputs. The RuntimeGrant
contains the exact per-action Plugin permissions, validated constraints, and
approval obligations. The Cell plan's Plugin projection contains only the
policy-free Plugin action interface, pinned companion-service dispatch
reference, and stable runtime-grant binding handle needed to bind an invocation. Current
Restrictions and live provider authorization may deny or narrow use but cannot
rewrite or widen either artifact.

An accepted desired generation remains authorized for convergence after the
initiating actor or session changes until a later authorized intent supersedes
it, the AgentInstance stops, or deletion tombstones it. Those actor and session
changes govern new mutations; deleting the accepted AgentInstance requires
another authorized mutation.

### RuntimeGrant replacement

OCC derives every primitive input in a candidate RuntimeGrant from the selected
AgentRevision's exact frozen snapshots and pins. It adds current applicable
Restrictions and server-owned runtime integration selections during compilation.
Live provider authorization may deny or narrow use at runtime but cannot rewrite
or widen the compiled grant or Cell plan.

A runtime-affecting rollout begins from exactly one of three triggers: an
authorized AgentInstance creation or update targeting `Running`, an applicable
committed Restriction tightening, or loss of a required active enforcement
point. An AgentInstance update is runtime-affecting when it changes a Plugin action
permission, constraint, or approval mode; another compiled runtime action or
resource reference; the runtime capability selections adopted by that update;
the policy digest; or an enforcement obligation. Every such rollout creates a
new immutable RuntimeGrant; OCC never edits a historical grant. A configuration
or integration-selection change alone is not a trigger. A transition to
`Stopped` is instead a revocation rollout with no candidate grant or Cell plan.

Before any actor or automatic trigger compiles or stages a successor grant, IAM
marks an existing candidate grant terminal and waits for the primitive
lifecycle to cancel and clean any unfinished prior attempt, including a pending
or indeterminate one. A cancelled attempt and every late result remain
ineligible for activation. A
non-tightening supersession leaves the active grant unchanged during cleanup; a
tightening terminally revokes it and retains the stopped baseline.

An applicable Restriction tightening computes each automatic replacement as the
intersection of the affected active or pending RuntimeGrant and current
Restrictions. Automatic reconciliation therefore cannot widen authority. A
stopped AgentInstance compiles the current Restriction set when it next
transitions to `Running`. Detaching, removing, or loosening a Restriction never
widens a running grant; widening requires an authorized AgentInstance rollout.

A tightening preempts a candidate grant still in preparation: OCC marks that
grant terminal, cleans its candidate state, and only then compiles the narrower
grant. If required downstream state is unresolved, IAM marks the old and
candidate grants terminal and removes the old grant from the active slot. The
canonical primitive
[stopped baseline](./primitives.md#agentinstance-and-cell) owns fencing,
effective-revision preservation, and retry.

Loss of a required active enforcement point terminally revokes the active and
pending grants and invokes the same stopped baseline. Recovery waits for prior
candidate cleanup and may compile a new grant only for the already-accepted
AgentRevision, authority, and pinned selections. Adopting a newer configuration
requires another authorized update targeting `Running`.

Every grant is staged and activated through the canonical
[RuntimeGrant materialization contract](./integrations.md#runtimegrant-materialization).
Every runtime enforcement point rejects from its local materialization before
`notBefore` or at and after `expiresAt`, without consulting the OCC control
plane. Renewal creates a new immutable grant with identical compiled authority,
selections, obligations, and current Cell, differing only in grant identity and
validity window. OCC stages and activates it before expiry without a Cell
rollout. If renewal fails, runtime authority ends locally at expiry even when
OCC is unavailable. OCC reconciles terminal revocation, physical fencing, and
workload removal when it becomes available; continued Pod existence confers no
runtime authority.

Human IAM changes, metadata-only changes, credential renewal with unchanged
authority, and like-for-like Cell replacement do not create a new RuntimeGrant.
After exact attestation, replacement stages and switches only the
AgentInstance's current-Cell association at each required runtime endpoint and
the coordinate-only binding in the replacement Cell; the active grant remains
bound to its stable WorkloadIdentity.
Publishing an AgentRevision alone does not update a running AgentInstance; an
authorized AgentInstance update must select that revision.

For a runtime dependency or policy with a v1 delete operation, OCC rejects
physical deletion while a pending or active RuntimeGrant references it.
The grant's terminal transition or retirement must commit first; enforcement
confirmation and physical cleanup may continue afterward. OCC preserves the
resource's immutable identity and audit history and rejects later references to
the deleted resource.

## Revocation

- When OAG detects a disabled external user, it revokes affected sessions and
  notifies OCC. OCC invalidates their registered session evidence and preserves
  existing bindings unchanged.
- When the [primitive lifecycle](./primitives.md#agentinstance-and-cell) stops,
  tightens, or tombstones an AgentInstance, IAM terminally revokes its active and
  candidate grants. Primitive reconciliation owns Cell and workload cleanup.

OCC marks a grant terminal and removes it from the active slot immediately.
Every required enforcement point must reject that grant. Runtime revocation is
confirmed only when every selected endpoint acknowledges terminal state or its
local `expiresAt` has passed. Until then OCC reports enforcement confirmation
incomplete and activates no replacement; delayed confirmation never restores
the grant.

## Failure behavior

| Failure | Behavior |
| --- | --- |
| Access Gateway verification failure | Deny before IAM evaluation and create no authorization state |
| Inactive external tenant or user membership | OAG revokes the affected session; OCC invalidates its registered evidence and denies new work |
| Stale, partial, or out-of-order group evidence | Deny any action that depends on that membership |
| OAG verifier deactivation is unavailable during ServicePrincipal deletion | Keep the ServicePrincipal inactive and deletion pending; reject authentication and retry forward without restoring it |
| Audit persistence unavailable | Return a fail-closed infrastructure error, commit neither an AuthorizationDecision nor a mutation, and leave the assertion ID unconsumed |
| IdP or adapter unavailable | Deny login, refresh, privilege elevation, and operations requiring fresh external evidence |
| Selected IAMAdapter is unavailable, errors, returns an unknown result, or cannot evaluate current policy | Deny; never fall back to another adapter or reuse an unbound decision |
| Paired Restriction projection is pending, indeterminate, failed, missing, mismatched, or stale | Deny dependent protected operations until exact current OCC policy revision and desired presence are read back; never use another pair or an older projection as a current allow |
| Candidate RuntimeGrant materialization, current-Cell association, or Cell binding is inactive, missing, stale, or mismatched | Deny candidate runtime use locally and keep the rollout unready |
| Active required materialization, current-Cell association, or Cell binding becomes missing, stale, or mismatched | Deny affected runtime actions locally, terminally revoke active and pending grants, and invoke the stopped baseline |
| Unknown subject, role, scope, or target | Deny without name-based fallback |

Existing Cells do not require the OCC control plane for ordinary execution.
While their compiled runtime inputs remain unchanged, they may continue under
the current RuntimeGrant until it expires, is revoked, or a provider enforces a
stricter decision. An accepted runtime-affecting update supersedes the current
grant through the applicable activation, replacement, or stop behavior.

## Audit contract

OCC persists the canonical `AuthorizationDecision` for every completed allow or
deny. If audit persistence is unavailable, OCC returns a fail-closed
infrastructure error, commits neither a decision nor a mutation, and leaves the
assertion ID unconsumed.
Returning the exact newly created entity in the direct successful mutation
response creates no synthetic `read` decision. A later creator read is a new
request whose decision and audit evidence record the exact creator match.
Mutation and lifecycle events add initiating and acting identities, before and
after committed record digests, and the workload, Kubernetes, provider, or
runtime correlations needed to explain the result. For an allowed mutation,
assertion-ID consumption, the decision, the mutation, and audit evidence commit
in one atomic boundary. Runtime enforcement emits correlated evidence without
credential contents.

The audit record retains the decision's determining authority evidence and
exact selected evaluator and policy artifact revision or digest; aggregate
authorization or adapter-selection revisions alone are insufficient provenance.

## Security invariants

1. External identities use `(provider, issuer, subject)`, never email or
   display name, as their durable key.
2. External tenant selectors provide admission context, not authority. Within
   the configured identity provider, each immutable provider tenant and OCC
   Namespace appears in at most one `ExternalTenantLink`.
3. Directory roles and groups are identity facts. The OCC permission ceiling
   requires either an applicable fixed Role containing the requested Permission
   or an exact creator match for `read` of that actor-created entity. The one
   IAMAdapter selected for the request's evaluator resource kind must also allow
   the exact request.
4. Every Group has exactly one membership authority. Every synchronized Group
   and snapshot names one exact `ExternalTenantLink`; an external group ID is
   never resolved across provider tenants. Snapshot membership contributes only
   through an exact match to the current actor's committed ExternalIdentity
   coordinate.
5. Every AccessBinding names an exact Installation or Namespace
   BindingScopeRef. Namespace bindings never cross Namespace boundaries, and a
   Namespace-scoped ServicePrincipal cannot receive an Installation binding.
6. Authorization checks name an exact ResourceRef and derive scope ancestry
   from authoritative containment.
7. Only `OrgAdmin` may mutate AccessBindings, local Group membership, or
   ExternalGroupLinks.
8. Provider or identity-system outages never broaden access.
9. PlatformComponentIdentity never substitutes for the initiating actor.
10. OCC creates one server-owned WorkloadIdentity with each AgentInstance.
    Clients cannot select it; it survives stop and Cell replacement, is
    tombstoned with the AgentInstance, and cannot call OCC admin APIs.
11. Each WorkloadIdentity has one dedicated ServiceAccount. Replacement Cells
    reuse it, but no other AgentInstance may share or receive it. Its
    projected-token audiences are the immutable installation set.
12. The admitted Cell plan fixes the Namespace, WorkloadIdentity, and exact
    ServiceAccount UID. OCC and Kubernetes admission reject mismatched
    workloads.
13. Drivers receive only capability-specific admitted inputs. A Harness Driver
    receives a stable runtime-grant binding handle for invocation coordinates,
    not Plugin policy contents. No Driver can select a different ServiceAccount,
    widen IAM, or create arbitrary Kubernetes RBAC.
14. Secret `bind` never implies reveal, rotation, or administration.
15. OCC and provider grants compose by intersection, never union.
16. RuntimeGrant records authorization intent and never stores provider
    credentials.
17. Plugin credentials and the provider-recognized subjects behind them never
    enter OCC records, Kubernetes resources, Cell configuration, or audit
    events.
18. IAMAdapter selection is OCC-configuration-owned. Clients cannot select it,
    adapter errors deny, and there is no per-request fallback.
19. A Cell never uses an invoking human's provider identity or session.
