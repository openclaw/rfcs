# OpenClaw platform primitives

## Summary

OpenClaw primitives are the provider-neutral resources used to define, deploy,
constrain, and operate enterprise agents. OCC owns each primitive's resource
record and lifecycle. Drivers and Adapters connect those records to runtime and
external systems without becoming owners of primitive intent.

## Motivation

A small, common resource model lets authors compose agents without coupling the
design to one harness, runtime, or provider. It also gives IAM, lifecycle, and
audit contracts exact resources to govern.

## Goals

- Define the canonical purpose, ownership, and lifecycle of each v1 primitive.
- Keep primitive intent provider-neutral.
- Make primitive references compose predictably with Namespace and IAM
  boundaries.

## Non-Goals

- Defining transport protocols or database schemas.
- Defining integration selection, dispatch, or Backend packaging. The canonical
  [integration contracts](./integrations.md) own those seams; provider-specific
  protocols and payloads remain behind Drivers and Adapters.

## Common contract

Every primitive has:

- A typed kind and stable identity.
- An OCC-owned resource record and lifecycle.
- Either installation or Namespace scope.
- Authorization through IAM.
- Audit evidence for lifecycle changes.

OCC owns every primitive's record and lifecycle. Authorable primitives expose
provider-neutral desired intent. Immutable and observed primitives expose only
server-owned state. Runtime-backed authorable primitives use a server-selected
Driver to realize or enforce admitted intent. OCC-native primitives require no
Driver. A Driver may report readiness and observations but cannot rewrite
primitive intent.

Each primitive uses this common envelope:

| Field | Contract |
| --- | --- |
| `apiVersion` | `openclaw.io/v1alpha1` |
| `kind` | Supported primitive kind |
| `metadata.uid` | Stable OCC identity independent of name |
| `metadata.scope` | Installation scope or an exact OCC Namespace reference |
| `metadata.name` | Human-readable name |
| `metadata.createdBy` | Server-owned immutable creator identity; for an actor-created resource, the exact initiating Principal or ServicePrincipal |
| `metadata.labels` | Optional string map |
| `spec` | Provider-neutral desired intent when the primitive is authorable; otherwise omitted |

## Primitive catalogue

| Primitive | Contract | Lifecycle |
| --- | --- | --- |
| `Namespace` | Enforced tenant boundary for deployable resources, policy, identity, and audit. | OCC creates one backing Kubernetes Namespace and pins its immutable identity; update and retirement are deferred. |
| `Agent` | Mutable reusable definition that optionally binds one Configuration and references harness, plugins, channels, secrets, and policy. | Drafts may change; publishing creates a new immutable revision. |
| `AgentRevision` | Immutable, numbered snapshot of one Agent and its publish-time authoring inputs. | Append-only; never follows `latest` and never changes a running instance by itself. |
| `AgentInstance` | Stable deployed identity and desired lifecycle with one selected AgentRevision and at most one candidate rollout. | Identity provisioning makes the selected revision effective; later revisions change only at cutover. |
| `Cell` | Replaceable execution incarnation of one AgentInstance. | OCC records the Kubernetes Pod produced for the admitted workload; at most one Cell is current per AgentInstance, and a like-for-like replacement reuses its WorkloadIdentity-bound RuntimeGrant. |
| `Configuration` | Namespace-owned, ConfigMap-style non-secret string key/value pairs bound to an Agent. | Mutable; Agent publication snapshots the referenced map into an immutable AgentRevision. |
| `Harness` | Versioned agent-loop implementation and configuration. | Installation-published and immutable by version; v1 may expose one fixed choice, pinned by AgentRevision. |
| `Plugin` | Provenance-pinned MCP, skill, or tool bundle whose verified manifest defines its action vocabulary, risk classifications, and provider-specific constraint schemas. | Versioned by immutable artifact and manifest digest. |
| `PluginConnection` | OCC-owned Namespace binding to a provider-owned plugin installation and consent boundary. | Mutable when required for a provider-managed Plugin; publication freezes the exact binding identity and configuration. |
| `Channel` | Namespace-owned messaging surface and exact send and receive actions. | Mutable; publication freezes the exact identity and configuration while message payloads remain in the runtime plane. |
| `Secret` | Typed opaque reference resolved at runtime through one exact SecretBroker. | Metadata is OCC-managed; publication freezes the exact Secret and SecretBroker identities while values remain external. |
| `SecretBroker` | Namespace-scoped runtime binding to the installed secret-resolution capability for one external store. | Administrator-managed; the common RuntimeGrant dependency deletion rule applies. |
| `SandboxPolicy` | Portable requested security contract over generic filesystem, network, exec, and runtime containment. | Mutable; publication freezes its content digest and runtime must prove every required facet is enforced. |
| `Restriction` | OCC-owned, administrator-managed ceiling on authorable configuration and runtime projection. | Mutable; its policy effect may only narrow authority, and removal never widens a running grant automatically. |

### `Namespace`

One OpenClaw platform deployment runs in one Kubernetes cluster and represents
one Organization. A Namespace is the v1 Tenant boundary: each OCC Namespace
maps one-to-one to one Tenant and one Kubernetes Namespace. Tenant is not a
separately nestable resource. Every resource is installation-scoped or
Namespace-scoped; every deployable primitive is Namespace-scoped. OCC IAM and
Kubernetes authorization remain independent. After IAM authorizes creation, OCC
persists the new OCC Namespace identity and one server-generated backing name,
then creates that Kubernetes Namespace and records its observed cluster, name,
and UID. The Namespace is usable only after the exact UID is recorded. Partial
creation retains the accepted mapping and reconciles it forward; OCC never
adopts an unrelated existing Namespace or selects a fallback. The OCC Namespace
and backing mapping are immutable, and v1 defines no update or delete operation.
A later missing Namespace or UID mismatch blocks contained resource creation and
deployment without recreating or remapping it. Every Namespace-scoped reference
must remain within the resource's Namespace.

Namespace creation creates only the OCC Namespace and its backing Kubernetes
Namespace. It does not create an `ExternalTenantLink`, human admission, or an
administrator identity.

### `Agent` and `AgentRevision`

`Agent` is the editable source definition shown as a blueprint in the OCC
Console. It optionally binds one Configuration and names the desired Harness,
Plugin references, Channels, Secrets, SandboxPolicy, and attachment-mode
Restrictions through explicit `restrictionRefs`. Scope-mode Namespace and
Installation Restrictions apply independently and cannot be omitted from the
Agent. The resource contains no provider credentials, prompt history, messages,
or resolved secret values.

Publishing authorizes the exact Agent and every direct reference that declares
a separate permission. It resolves and validates all direct and transitive
dependencies, then atomically creates an immutable AgentRevision containing
their exact identities and snapshots and records the publisher as its immutable
creator. The successful publication decision authorizes returning that exact
AgentRevision to the publisher without a second read decision. A missing,
stale, or unauthorized reference creates no AgentRevision. For an attached
Restriction, publication freezes its exact UID and attachment but not its
mutable policy contents; OCC evaluates the current committed policy revision
when authorizing or compiling a RuntimeGrant. Creating an AgentInstance selects its
initial AgentRevision, which becomes effective after identity provisioning
succeeds. An update targeting `Running` may stage a candidate revision without
changing the effective revision until cutover. A Cell becomes ready only after
its applicable RuntimeGrant and every required dependency are ready.

The AgentRevision is the sole realization source for every input frozen at
publication. OCC compiles RuntimeGrants and Cell plans from its exact snapshots
and pins; it does not reread a mutable dependency's current specification.
Updating a dependency affects only a later AgentRevision and rollout. Deletion
or revocation may deny a new rollout, and current Restrictions and live provider
authorization may narrow or deny use. None can replace a frozen input or
silently rewrite a running revision.

### `AgentInstance` and `Cell`

`AgentInstance` is the stable identity of one deployed agent. It selects one
AgentRevision and permanently owns one OCC-created WorkloadIdentity, its current
Cell, active RuntimeGrant, pending rollout, and desired lifecycle. It may also
carry attachment-mode `restrictionRefs` that apply in addition to those frozen
into its AgentRevision. Changing those refs is a runtime-affecting update. The
parent update commits only when IAM allows every exact Restriction addition and
removal; partial ref changes never commit. After identity provisioning succeeds,
the selected revision becomes effective. The AgentInstance is the unit of
routing, operation, and runtime lifecycle.

After authorizing creation, OCC atomically accepts the AgentInstance and selected
AgentRevision, creates one server-owned WorkloadIdentity UID, binds them
permanently one-to-one, and records one server-generated ServiceAccount name in
identity-provisioning state. The request contains no WorkloadIdentity or
ServiceAccount identity. OCC then creates that exact Kubernetes ServiceAccount
and records its UID before making the selected AgentRevision effective or
finalizing a Cell plan. A failure before UID observation leaves identity
provisioning unavailable and retries the same name.
After an uncertain create result, OCC may record the UID of that exact name only
when immutable ownership evidence binds it to the accepted AgentInstance and
identity-provisioning record. It rejects an unrelated existing ServiceAccount
and never selects a fallback. Every replacement Cell uses the recorded UID,
which is never shared with or reassigned to another AgentInstance.

`AgentInstance.spec.desiredState` is required and accepts exactly `Running` or
`Stopped`; there is no implicit default. `Running` reconciles one current Cell.
`Stopped` marks the RuntimeGrant terminal, removes it from the active slot,
fences the current Cell, and removes the workload while retaining the
AgentInstance, WorkloadIdentity, dedicated ServiceAccount, and effective
AgentRevision. Required enforcement confirmation and physical cleanup continue
separately and cannot restore runtime authority. Returning to `Running` compiles
a new RuntimeGrant and admits a new Cell.

An AgentInstance has at most one rollout eligible for activation. The rollout
contains the desired lifecycle and, when its target is `Running`, the revision
to realize, candidate RuntimeGrant, and Cell plan. An update may carry a
candidate revision only when its target is `Running`; initial activation uses
the already-effective revision. A transition to `Stopped` applies to the
effective revision and has no candidate revision, RuntimeGrant, or Cell plan. A
stopped AgentInstance may select another revision only in the update that
returns it to `Running`. During non-tightening update preparation, the effective
revision, current Cell, and active grant remain unchanged.

Before OCC starts a new actor-authorized or automatic rollout, it checks for an
unfinished attempt, including a pending or indeterminate attempt. The new intent
supersedes that attempt; it never merges with it. OCC records the old attempt as
cancelled and marks its candidate RuntimeGrant terminal. The attempt and every
late result become permanently ineligible for activation. OCC recovers any
pending or indeterminate operation under its original identity, then reconciles
candidate RuntimeGrant materializations to terminal and waits for enforcement
confirmation or expiry.
It reconciles every candidate workload, Sandbox boundary, current-Cell
association, and coordinate-only Cell binding to absent. The new rollout starts
only after all applicable proofs are authoritative. A non-tightening
supersession leaves the effective revision, current Cell, and active grant
unchanged. If the new intent tightens authority or the prior attempt had entered
the stopped baseline, OCC invokes or retains that baseline and never restores
the old grant. The WorkloadIdentity, dedicated ServiceAccount, and effective
revision are not candidate cleanup state.

An authorized transition to `Stopped` immediately invokes the stopped baseline,
and AgentInstance deletion immediately commits its tombstones and terminal
revocation. Both permanently disqualify the candidate; operation recovery and
candidate cleanup continue afterward and cannot delay revocation or
tombstoning. Only a successor `Running` rollout waits for authoritative cleanup.
A committed Restriction tightening and loss of a required active enforcement
point also preempt immediately, but replacement preparation waits for
cancelled-state cleanup. Configuration and integration-selection changes do not
trigger a rollout; a new creation uses current configuration, while an existing
AgentInstance adopts it only through a later authorized update targeting
`Running`.

A like-for-like Cell replacement reconciles the accepted active generation. It
is not an AgentInstance rollout and creates no candidate RuntimeGrant.

An accepted rollout tightens authority when continued use of the active
RuntimeGrant would preserve authority excluded by the committed desired state or
an applicable Restriction. A non-tightening preparation failure leaves the
current deployment intact. For a committed tightening, OCC cannot leave the old
grant active while required operation persistence, dispatch, preparation, or
attestation is pending, indeterminate, unavailable, or failed. OCC invokes the
stopped baseline: it immediately marks the old grant terminal and removes it
from the active slot, fences and removes the current Cell, and marks the
candidate grant terminal. Required enforcement confirmation and physical
cleanup continue separately. The current revision remains effective. OCC
retains the candidate revision and desired state as rollout input and retries
with a newly compiled grant. Only successful activation changes the effective
revision.

After the ServiceAccount UID is recorded, failed initial `Running` preparation
retains the accepted AgentInstance, WorkloadIdentity, dedicated ServiceAccount,
and effective AgentRevision with no current Cell or active RuntimeGrant. OCC
removes candidate workload objects and may retry the accepted generation.

`Cell` is one replaceable execution incarnation. Users do not create Cells
directly. The HarnessDriver first returns the immutable Harness plan, every
required Sandbox facet Driver reconciles its boundary for the admitted workload
digest and dedicated ServiceAccount UID, and each required runtime endpoint
stages its exact inactive RuntimeGrant materialization. Only after that plan,
every pre-Pod reconciliation, and every inactive materialization are ready does
OCC materialize the admitted workload with native Kubernetes resources in a
deny-by-default state.

Kubernetes owns scheduling, restart, and rollout. OCC observes the resulting Pod
as a candidate only when its Namespace, ServiceAccount UID, WorkloadIdentity,
and plan match the admitted Cell plan. Each required Sandbox facet Driver then
reconciles the same boundary with that exact Cell UID and returns attestation
evidence. Each runtime endpoint also stages the exact candidate current-Cell
association, and OCC stages the coordinate-only runtime-grant binding in the
candidate Cell. OCC begins activation only after every required Sandbox
attestation, RuntimeGrant materialization, current-Cell association, Cell
binding, and other dependency matches. Initial activation records one activation generation, the
current Cell, and RuntimeGrant without changing the already-effective initial
AgentRevision. During an update cutover, the points fence the prior Cell and OCC
records progress until it can switch the effective AgentRevision, current Cell
UID, RuntimeGrant, and activation generation together. A partial cutover fails
closed and resumes forward; it does not restore wider authority. The new Cell
may then use the AgentInstance's bounded RuntimeGrant; it never inherits the
human deployer's role or provider session.

A like-for-like Cell replacement does not change the effective AgentRevision,
admitted plan, WorkloadIdentity, dedicated ServiceAccount UID, RuntimeGrant
inputs, integration selections, policy digest, or obligations. OCC observes and
attests the replacement under one exact replacement attempt and the active
accepted generation, stages the replacement current-Cell association at every
required runtime endpoint and the coordinate-only binding in the replacement
Cell, then switches only those associations and the current Cell UID. The immutable
active RuntimeGrant remains valid because it is bound to the stable
WorkloadIdentity and exact runtime authority, not to one Cell UID. Runtime
endpoints independently authenticate the exact current Cell; a prior or
unrecorded Cell cannot use the grant. A change to any grant input is an update
rollout and follows the activation boundary above. Like-for-like replacement
reconciles already-authorized state and requires no new
`openclaw.agent_instances.deploy` authorization. A failed replacement removes
only its candidate workload and prepared boundaries; it does not change the
current Cell association or active grant.

Every runtime enforcement point ends grant authority from its local
materialization at `expiresAt` without consulting OCC. The Cell cannot perform
an authorized runtime action after expiry. OCC fences and removes the workload
when it is available; physical cleanup is not required for authority to end.

IAM owns RuntimeGrant validity and renewal. This primitive lifecycle owns the
Cell and workload response when grant authority expires.

Changing desired lifecycle or `restrictionRefs` uses
`openclaw.agent_instances.update` against the exact existing AgentInstance.
Selecting another AgentRevision is valid only when the target is `Running`; it
includes the candidate revision in authorization context and also requires
`openclaw.agent_instances.deploy` on that exact AgentRevision. A transition to
`Stopped` cannot adopt another revision. Adding or removing a `restrictionRef`
also requires the separate exact attach or detach authorization defined by IAM,
regardless of desired state.

Cells are not independent IAM binding scopes. Reading a Cell targets the exact
Cell. Logs are an AgentInstance operation: IAM targets the exact owning
AgentInstance and includes the resolved Cell UID and current ownership as
immutable request context. V1 has no exec, attach, or port-forward operation.

Deleting an AgentInstance first commits irreversible tombstones for the
AgentInstance and its WorkloadIdentity. The tombstones deny new use, updates,
and transitions back to `Running`. OCC then reconciles forward by marking active
and candidate grants terminal and removing them from their slots, fencing the
Cell, cancelling and clearing the pending rollout, and deleting the workload.
OCC deletes a dedicated ServiceAccount only by its recorded UID. If creation had
an uncertain result before UID observation, OCC may record and delete the UID
observed at the accepted name only when the original immutable ownership
evidence binds that object to the tombstoned AgentInstance and
identity-provisioning record. An absent object completes ServiceAccount cleanup;
an unproven object is never deleted and leaves cleanup pending. Enforcement
confirmation and cleanup may lag without restoring authority. A cleanup failure
remains visible and retries forward; it never restores the AgentInstance. OCC
preserves both immutable identities and audit history. Neither the
WorkloadIdentity nor ServiceAccount is reused or reassigned.

Every runtime dependency or policy resource follows one deletion rule. Physical
deletion is rejected while a pending or active RuntimeGrant references the
resource. After deletion, OCC preserves immutable identity and audit history and
rejects new publication, deployment, or update requests that reference it.

### Runtime dependencies

#### `Configuration`

`Configuration` is a Namespace-owned flat map with the same basic shape as
`ConfigMap.data`:

```ts
interface ConfigurationSpecV1 {
  data: Record<string, string>;
}
```

Values are non-secret strings. V1 has no typed declarations, nested values,
projection targets, per-key ownership, separate Configuration revisions, or
merge and precedence rules.

An Agent binds at most one Configuration through `configurationRef`. Publishing
the Agent requires `use` permission on that Configuration and snapshots its
exact name, UID, content digest, and data into the new
AgentRevision. When the Agent has no Configuration, the snapshot and runtime
record are empty. Changing a Configuration does not affect an existing
AgentRevision or running AgentInstance. To adopt a change, an author publishes a
new AgentRevision and an authorized deployer updates the AgentInstance to it.

OCC stores Configuration natively. There is no Configuration driver, provider,
resolver, or Cell projection contract in v1. The Harness receives the immutable
flat record from the AgentRevision. Configuration never stores secrets or
provider credentials; those remain behind Secret or provider-owned boundaries.

#### `Harness`

`Harness` identifies the versioned agent-loop implementation and configuration.
Publishing requires `openclaw.harnesses.use` on the exact Harness. An
AgentRevision pins its exact version or artifact digest.
OCC materializes the native Kubernetes workload. `HarnessDriver` realizes the
frozen Harness configuration and owns agent-loop behavior inside that workload.
The Harness owns inference configuration and makes inference calls through the
Sandbox network policy.

#### `Plugin` and `PluginConnection`

`Plugin` describes portable functionality. Its signed or otherwise verified
manifest defines each tool or action identifier, its risk classification, and
its provider-specific constraint schemas. Users
cannot rename an action, relabel its risk, or supply constraint fields outside
that schema. Publishing requires `openclaw.plugins.use` on the exact Plugin and
freezes the artifact digest, manifest digest, and verified action definitions.
V1 publishes Plugins from the one installation-configured feed.

`PluginConnection` separates that portable definition from a Namespace's
provider-owned installation, consent, and credential boundary.
OCC create, update, and delete operations mutate only the binding record.
Provider-side installation, consent, credential provisioning and rotation, and
removal protocols are outside this design.

`AgentPluginReference` is an OCC-owned typed member of Agent. It identifies the
exact Plugin and optional PluginConnection and, for each selected tool or
action, carries the selected permission, approval mode, and constraint values.
OCC validates those values against the verified manifest. Publication freezes
the complete reference in AgentRevision. The frozen member inherits the
AgentRevision's identity, scope, immutability, and authorization; it has no
independent resource envelope or lifecycle. It does not copy or transfer the
provider's policy. A selected Plugin action permission is embedded Agent policy,
not a new OCC IAM Permission.

The RuntimeGrant alone carries the compiled per-action permissions, constraints,
approval modes, and resulting obligations from the frozen AgentRevision. The
Harness plan receives only the policy-free action interface, pinned companion
Plugin-service dispatch reference, and stable runtime-grant binding handle. The selected
Plugin service enforces its active local capability materialization under the
canonical [Harness integration contract](./integrations.md#harness). Cell
SandboxPolicy does not govern the Plugin service or its egress.

#### `Channel`

`Channel` names one messaging surface and its exact receive and send actions.
OCC owns the OpenClaw resource. The selected IAMAdapter owns its
permission policy and evaluation; `OCCIAMAdapter` is the default.
An external messaging provider owns its API authorization. Message content
stays on the runtime path through the selected Channel Driver in the
Namespace's OpenClaw gateway and does not enter OCC.

Channel-triggered work binds to the exact Channel, AgentInstance, and active
local RuntimeGrant materialization. The Channel contract carries provider actor
evidence without manufacturing an OCC Principal from an untrusted display
name. A Channel
provider allow cannot substitute for OCC authorization, and an OCC grant cannot
substitute for provider authorization. The OpenClaw gateway handles approval
for Channel actions in v1 outside OCC IAM. It does not approve Plugin actions.

#### `Secret` and `SecretBroker`

`SecretBroker` is a Namespace-scoped runtime primitive. It binds one Namespace
to the installed secret-resolution capability for one external store. OCC owns
its metadata, desired binding, and lifecycle; the external store owns the
values. The canonical
[SecretBroker Driver contract](./integrations.md#secretbroker) owns realization
and runtime execution without gaining authority over the resource.

`SecretBroker.spec` contains only an opaque, non-secret `externalStoreRef`.
Clients cannot select the Driver, and the resource contains no endpoint
credentials or secret values. A binding is ready only when the selected Driver
confirms that it can serve the exact configuration. One shared runtime service
may realize multiple SecretBroker resources, but it cannot cross their Namespace
or RuntimeGrant boundaries.

`Secret` contains an exact `brokerRef`, an opaque `externalRef`, and an optional
pinned external version. It never contains the value. Publishing an Agent
freezes the exact Secret and SecretBroker identities and committed
specifications in the AgentRevision. The RuntimeGrant authorizes resolution of
the exact Secret through the pinned SecretBroker; it contains neither the value
nor external-store credentials.

An administrator creates or updates a SecretBroker. The common dependency
deletion rule applies. Only the exact current Cell may resolve a Secret under
the AgentInstance's WorkloadIdentity and active local RuntimeGrant
materialization. Successful resolution delivers only the value over a
Cell-bound channel. The Cell never receives broker or external-store
credentials. OCC, the Console, the OpenClaw
gateway, the resource store, logs, and audit evidence never receive the value.

A missing or stale Secret or SecretBroker, unavailable broker runtime,
Namespace mismatch, inactive RuntimeGrant, wrong workload or Cell, denial,
timeout, or external-store failure denies resolution. OCC never selects a
fallback SecretBroker or external store. When the admitted plan requires a
Secret at startup, failure keeps the Cell unready. Failure of an on-demand
lookup fails only that runtime operation.

Plugin credentials are not modeled as Secret resources in v1.

### Policy primitives

#### `SandboxPolicy`

`SandboxPolicy` describes generic filesystem, network, exec, and runtime
containment without naming the component that enforces each facet. It does not
define Plugin action names, approval modes, or provider-specific constraints.
OCC admits a deployment only when the installed runtime can enforce every
required facet. Runtime layers may tighten policy but cannot widen it.

`openclaw.sandbox_policies.attach` targets the exact SandboxPolicy. The source
resource and candidate deployment or composition are request context, allowing
the policy authority to evaluate the real proposed attachment without changing
the target.

The realized Sandbox is derived state of a Cell. Readiness includes evidence
that the admitted policy digest and required facets are active. A separate
mutable `Sandbox` resource would create a second policy owner and is not part of
v1.

#### `Restriction`

`Restriction` is an OCC-owned, administrator-managed policy ceiling. It names a
non-empty set of exact evaluator resource kinds and canonical actions, a typed
deny or obligation policy, and `applicability = scope | attachment`. A
scope-mode Restriction applies automatically to matching actions and resource
kinds within its Installation or Namespace containment. An attachment-mode
Restriction applies only through an explicit `restrictionRef` on an Agent or
AgentInstance. The effective set is the deduplicated union of applicable scope
Restrictions, Restriction UIDs frozen into the effective AgentRevision, and
current AgentInstance restriction refs.

Its policy effect may deny or add obligations but cannot grant authority. The
resource may be created, updated, attached, detached, or deleted; tighten-only
describes its effect in an authorization decision, not a requirement that each
mutation be more restrictive than the previous one. Attach and detach mutate
the referencing Agent or AgentInstance, not the Restriction policy record. The
parent mutation and every exact attach or detach decision commit all-or-nothing.
Evaluation uses the current committed Restriction policy revision for every
effective UID. An applicable tightening reconciles
each affected active or pending RuntimeGrant as the intersection of that grant's
existing authority and the current Restrictions. Automatic reconciliation can
therefore only narrow authority and invokes the stopped baseline while required
downstream state is unresolved. Effects that would widen authority remain
inactive until an authorized AgentInstance rollout adopts them. A stopped
AgentInstance compiles the current Restriction set when it next transitions to
`Running`. Detaching or removing a Restriction never widens an active grant.
Deletion is a logical tombstone that rejects new references and projects
absence before external cleanup. The tombstone is a new OCC policy revision and
retains the exact UID, scope, applicability, evaluator resource kinds, and
canonical actions needed to project `desiredPresence = absent`. OCC rejects
deletion while a pending or active RuntimeGrant still references the Restriction
and preserves identity and audit history. IAM owns evaluation; the
`PolicyAdministrationAdapter` paired with the selected IAMAdapter projects exact
committed policy revisions under the canonical
[integration contract](./integrations.md#policyadministrationadapter).

## Publication and deployment request example

This application-neutral example assumes that Configuration `defaults`,
Harness `standard-harness` version `1.0`, Secret `service-token`, SecretBroker
`primary-store`, and SandboxPolicy `standard-policy` already exist in their
required scopes. Readable names are request inputs; OCC resolves and persists
exact identities.

1. **Create or update the Agent.** An author writes Agent `example-agent` in
   Namespace `example`, referencing the Configuration, Harness, Secret, and
   SandboxPolicy.
2. **Publish the Agent.** OCC authorizes the exact Agent and every reference,
   then creates immutable AgentRevision number `7` with opaque UID
   `<agent-revision-uid>`. The revision freezes the exact Agent UID and source
   specification, Configuration UID, digest, and data, Harness artifact digest,
   Secret and SecretBroker UIDs and committed specifications, optional pinned
   external secret version, and SandboxPolicy UID and content digest.
3. **Create the AgentInstance.** A deployer requests creation of AgentInstance
   `example-instance` in Namespace `example`, pins AgentRevision UID
   `<agent-revision-uid>`, and requests `Running`. The request cannot alter a
   frozen reference or snapshot.

If any reference is missing, stale, or unauthorized during publication, OCC
creates no AgentRevision and deployment cannot begin.

## Audit requirements

Primitive operations must produce audit evidence identifying the actor or
workload, action, exact resource and committed-state digest, outcome, and
related runtime operation. Control-plane mutations follow the platform's atomic
audit invariant. Secret values, credentials, and message payloads must never be
recorded. Event schemas, transport, storage, retention, export, query, and
correlation mechanisms are deferred.

## Rationale

- **Separate definition, deployment, and execution.** AgentRevision immutability
  makes behavior reviewable, AgentInstance identity survives upgrades, and Cell
  replacement remains an implementation concern.
- **Freeze authoring references at publication.** Replacing an OCC dependency
  cannot silently change a reviewed Agent. Live provider policy may still deny
  an action without rewriting the AgentRevision.
- **Keep policies separate from implementations.** SandboxPolicy and Restriction
  remain portable while runtime layers evolve.
- **Keep provider state separate.** PluginConnection makes the external
  relationship explicit without copying provider state into OCC.
- **Keep the primitive model smaller than the implementation model.** Drivers,
  adapters, and Backends can change without forcing new agent resource
  kinds.
- **Separate configuration and secrets.** Agent binds one reusable non-secret
  Configuration record and AgentRevision snapshots it. Secret values remain
  external and resolve only through the pinned SecretBroker.
