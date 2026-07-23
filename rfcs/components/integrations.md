# OpenClaw integration contracts

## Summary

OpenClaw connects OCC-owned resources to runtime and external systems through
three concepts. A **Driver** realizes or enforces admitted primitive intent. An
**Adapter** translates an external protocol or authority contract. A
**Backend** packages compatible Drivers and Adapters without gaining their
authority. Installation makes integrations eligible; server-owned OCC
configuration selects them, and every operation remains bound to one exact
selection.

## Motivation

Enterprises need different harnesses, sandboxes, directories, policy systems,
messaging systems, and secret stores without changing the OpenClaw resource
model. Without explicit integration contracts, provider behavior leaks into
OCC, package installation can change authority, and failure recovery cannot
distinguish a permanent rejection from an uncertain side effect.

The integration model preserves the primitive ownership in
[primitives.md](./primitives.md) and the authorization ownership in
[iam.md](./iam.md). Integrations consume those decisions; they do not replace
them.

## Goals

- Give every integration one role, owner, selection, and execution path.
- Keep primitive intent, IAM policy, runtime realization, and external protocol
  translation as separate contracts.
- Make selection, durable OCC dispatch, readiness, failure, and control-plane
  uncertain-result recovery deterministic and fail closed.
- Package tested integrations without granting authority to the package.
- Keep credentials and provider payloads inside their owning runtime boundary.

## Non-goals

- Making Kubernetes an interchangeable compute Driver. OCC and Kubernetes own
  the workload lifecycle defined by the primitive design.
- Letting clients, resources, integration payloads, or Backends select an
  implementation.
- Defining a general integration graph or dynamic compatibility negotiation.
- Standardizing provider-specific payloads, credential protocols, or wire
  encodings.
- Defining a provider-lifecycle Adapter or provider-side `PluginConnection`
  installation, consent, credential provisioning or rotation, or removal
  protocol.
- Defining exact Plugin invocation idempotency, replay, or recovery after an
  indeterminate provider effect.
- Adding Console routes or executable UI through an integration.
- Defining more than the one installation-configured Plugin feed used in v1.

## Integration roles

Each integration has exactly one registered kind. One process may serve
multiple registrations, but each registration has its own registration ID,
capability, selection, and audit evidence. Each out-of-process serving component
has one `PlatformComponentIdentity`, which may serve multiple registrations;
dispatch binds both the component identity and the exact registration.

| Concept | Contract | Authority limit |
| --- | --- | --- |
| Driver | Realizes or enforces admitted primitive intent over time | Cannot rewrite the primitive, choose workload identity, or grant permission |
| Adapter | Translates between an external system and a normalized OCC contract | Cannot become a generic client-controlled proxy or infer authority outside its capability |
| Backend | Distributes compatible Driver and Adapter artifacts with one manifest | Cannot select integrations, own resources or policy, or register UI |

OCC owns the integration registry, compiled configuration, exact selections,
source operations, and the committed control-plane records created from
normalized integration results. An out-of-process control-plane
endpoint accepts only the exact OCC `PlatformComponentIdentity` allowed for its
capability. Runtime endpoints use their capability-specific workload, Cell,
gateway, and provider identities; no endpoint may substitute one identity seam
for another.

## Registry and selection

Installing an integration makes it eligible. It does not select it, invoke it,
or grant it access to an OpenClaw resource.

Each eligible registration declares:

- a stable registration ID and kind;
- an immutable artifact digest;
- provider-neutral capability names and versions; and
- any required, versioned capability schemas.

OCC core owns the provider-neutral capability catalog, including which
capabilities and Sandbox facets are required and whether each has a built-in
implementation. Backend manifests advertise compatible implementations but
cannot change the catalog.

OCC configuration is installation-owned, version controlled, and loaded only
through the deployment path. For an ordinary capability, configured
resource-kind selectors compile to exactly one implementation for each exact
resource. Overlapping selectors are invalid, and OCC refuses the configuration
instead of choosing by order.

Each capability definition states whether OCC supplies a built-in
implementation. A built-in implementation is the default when present. A
capability without one requires an explicit eligible selection. Once a custom
implementation is selected, missing, disabled, stale, or incompatible state
fails closed and never falls back to the built-in implementation or another
custom integration. `OCCIAMAdapter` is the built-in IAM default.

A custom IAMAdapter that evaluates Restrictions through an external policy
authority declares one immutable `policyAuthorityId` and is paired by OCC
configuration with exactly one eligible PolicyAdministrationAdapter for that
same authority. The compiled configuration pins both registrations and the
authority ID; clients, resources, and either Adapter cannot choose or replace
the pair. Every evaluator resource kind named by one Restriction must resolve to
that same IAMAdapter pair. `OCCIAMAdapter` evaluates canonical OCC state
directly and has no PolicyAdministrationAdapter pair. Changing either member of
the pair for an existing Restriction is an IAM authority migration and remains
deferred.

Sandbox is selected installation-wide by facet rather than by resource. Every
required facet resolves to exactly one Driver. Multiple Sandbox Drivers are
valid only when their facet sets are disjoint. An unconfigured facet uses its
declared built-in Driver; a facet without a built-in requires explicit
configuration. Overlap or a missing required facet is invalid configuration.

An installation-wide singleton capability selects exactly one implementation
for the Installation and rejects resource selectors. The v1 Plugin feed uses
this rule.

An `IntegrationSelectionRef` pins the configuration revision, registration ID,
artifact digest, capability version, and complete Sandbox facet assignment when
applicable. Every dependent operation carries that one exact reference. The
immutable registry entry retains the supplying Backend manifest identity,
release, and digest as provenance; those fields are not repeated in the
operation coordinates. A Backend manifest advertises eligibility but cannot
define defaults, selectors, or multiplicity.

A new runtime-selection configuration affects only an AgentInstance creation or
actor-authorized update targeting `Running` accepted after that configuration
becomes current. It does not trigger or preempt a rollout, mutate an active
RuntimeGrant or Cell, or change a like-for-like renewal; existing grants and
renewals retain their pinned selections. Loss of a required pinned enforcement
point invokes the canonical primitive
[stopped baseline](./primitives.md#agentinstance-and-cell). Recovery retries the
accepted generation with the same pins; an existing AgentInstance adopts the
new selection only through another authorized update targeting `Running`.
Changing the IAMAdapter for an existing resource kind or active RuntimeGrant
remains deferred.

## Operation dispatch

Every OCC-dispatched evaluation, reconciliation, or control-plane call carries
the minimum coordinates needed to bind it to one exact invocation:

| Coordinate | Contract |
| --- | --- |
| Operation | Stable operation ID, deadline, and capability-specific action |
| Target | Exact Installation or Namespace scope and exact resource identity when one exists |
| Selection | Exact `IntegrationSelectionRef` defined by [Registry and selection](#registry-and-selection) |
| Input | Typed capability input and its digest, constructed from server-owned or admitted state |
| Correlation | Source operation and committed decision references when prior authorization exists |

Browser and API clients cannot supply raw integration input, selection, or
authority coordinates. A durable integration operation rejects a reused
operation ID whose target, action, `IntegrationSelectionRef`, or input digest
differs.

Two OCC-dispatched authority seams cover v1:

1. **Platform calls.** Side-effect-free Directory and IAM evaluation, scheduled
   Plugin-feed refresh, and deployment-authorized Backend capability
   verification can occur before a source allow exists. OCC binds the exact
   `IntegrationSelectionRef`, target, evidence, and request digest and
   authenticates as its `PlatformComponentIdentity` for an out-of-process call.
   The call grants no actor permission. Primitive reconciliation and provider
   mutation never use this seam.
2. **Authorized control-plane calls.** After OCC authorizes and commits a source
   operation, it dispatches the exact downstream action with references to the
   committed decisions and applicable obligations. The integration does not
   receive the complete authorization bundle or an OAG actor assertion.

Portable delegation tokens and long-lived queued user work are outside v1.
Authenticated service identity, exact operation coordinates, and the owning
authorization seam are the only accepted invocation paths.

Runtime data-plane calls do not use the durable OCC operation protocol. A Cell
runtime endpoint authenticates the exact `WorkloadIdentity`, current Cell, and
immutable `RuntimeGrant`. Channel ingress instead authenticates the external
provider path and exact reconciled Channel binding. Channel-specific retry and
replay rules apply, while exact Plugin invocation recovery remains deferred.
Payloads stay off the OCC path. A control-plane operation or initiating human
identity cannot substitute for runtime authority.

### RuntimeGrant materialization

OCC is the sole writer of every RuntimeGrant and its active or terminal state.
Runtime enforcement points receive only a capability-specific materialization
through the exact integration selection pinned by the grant: the companion
Plugin service receives Plugin actions, constraints, and obligations; the
Namespace Channel gateway receives Channel send and receive authority; and each
SecretBroker runtime receives only its Secret bindings. The Cell also receives
a coordinate-only runtime-grant binding from which the Harness reads the exact
active grant UID and activation generation; it contains no policy. These
materializations are derived state and cannot be edited independently.

Every materialization and Cell binding names the exact AgentInstance,
WorkloadIdentity, RuntimeGrant UID and digest, validity window, and activation
generation. A capability materialization also pins its selected registration
and least-privilege slice; the Cell binding contains only the common
coordinates. The endpoint separately records the exact current-Cell association
so a like-for-like replacement can change the Cell without changing grant
authority. OCC reconciles capability records through their pinned registrations
under the durable operation contract. The coordinate-only binding is OCC-owned
Cell lifecycle state, not a Driver, Adapter, or independently authorable
resource.

OCC first stages every required materialization inactive. A candidate
contributes to readiness only after every endpoint confirms the exact digest
and, after Pod observation, the candidate current-Cell association. OCC then
commits the active RuntimeGrant, current Cell, and one activation generation as
the logical activation boundary. Initial activation preserves the AgentRevision
made effective after identity provisioning. An update cutover also switches the
effective AgentRevision in that same boundary. An endpoint accepts the candidate
only after applying that exact generation, and OCC marks the rollout ready only
after every required endpoint agrees. Before its own switch, an endpoint fails
closed for the candidate. A partial activation resumes forward and never
restores prior or wider authority.

Each endpoint has at most one active materialization for an AgentInstance and
capability. Activating a replacement atomically removes the prior grant from
that local slot; an endpoint never treats both grants as active.

Ordinary runtime calls use only the endpoint's active local materialization.
The endpoint verifies the WorkloadIdentity, exact current Cell or Channel
delivery target, RuntimeGrant and activation generation, action or resource
binding, and local validity window. It never calls OCC on the request path or
accepts policy from the Harness, Cell, Channel payload, or provider payload.

A like-for-like Cell replacement stages and switches only the current-Cell
association and coordinate-only Cell binding for the unchanged grant. Renewal
stages a new immutable grant and Cell binding with the same authority,
selections, obligations, and current Cell, differing only in grant identity and
validity window. If it is not active before the old grant expires, every
endpoint rejects locally at expiry.

A terminal transition is monotonic. OCC removes the grant from its active slot,
fences the Cell, and reconciles terminal state to every endpoint. Each endpoint
rejects when terminal state arrives or `expiresAt` is reached, whichever comes
first. OCC reports enforcement confirmation incomplete and activates no
replacement until every required endpoint confirms terminal state or its local
expiry has passed; delayed confirmation cannot reactivate the grant.

Reconciliations and side-effecting Adapter calls use the durable operation
protocol. Before dispatch, OCC persists the operation ID, exact
`IntegrationSelectionRef`, target, input digest, decision references when
present, and dispatch provenance. OCC dispatches no unpersisted operation. If
persistence fails, OCC retries with the same deterministic operation identity.
Accepted state follows the canonical primitive lifecycle: unresolved
non-tightening work preserves the current deployment, while a committed
tightening invokes the stopped baseline.

A durable result names the operation ID and reports `succeeded`, `failed`,
`pending`, or `indeterminate`, with a stable reason and optional typed evidence.
A permanent rejection is `failed` with a stable reason; it is not a separate
result state. OCC persists the result before using it. The integration retains
the result until the later of its deadline or OCC acknowledgement of a terminal
result. If a provider side effect succeeds but OCC cannot persist its result,
the operation remains `indeterminate`. `indeterminate` never means success.

OCC uses `getOperation` or authoritative readback before recovering an uncertain
durable call. An idempotent reconciliation may retry the same operation ID with
identical content. A non-idempotent provider call remains `indeterminate` until
operation lookup or authoritative readback proves its terminal result; OCC never
retries it blindly.

An integration rejects first acceptance of a durable operation after its
deadline. At the deadline, an operation that cannot have produced a side effect
becomes `failed`; one with a possibly unresolved side effect becomes
`indeterminate`. `pending` cannot persist past the deadline. The deadline
neither authorizes replay nor cancels an already accepted side effect.

After a `failed` result proves that no side effect occurred, OCC may create a
new operation ID from the same committed reconciliation intent and accepted
desired generation. After an `indeterminate` result, OCC must resolve the
original operation before it can create a replacement. Pending or uncertain
non-tightening work preserves the previous deployment; unresolved required
tightening work follows the stopped baseline.

Superseding a rollout makes every old candidate and late result permanently
ineligible for activation, but it does not cancel an already accepted durable
operation. OCC recovers each pending or indeterminate operation under its
original ID and uses any late result only to determine cleanup. Candidate
RuntimeGrant materializations become terminal with enforcement confirmation or
expiry. Candidate workloads, Sandbox boundaries, current-Cell associations, and
coordinate-only Cell bindings become absent. OCC dispatches no successor
reconciliation until every applicable proof is authoritative.

Side-effect-free platform evaluations, discovery reads, and capability
verification are synchronous, deadline-bound exact request/response calls. This
includes DirectoryAdapter and IAMAdapter evaluation, Plugin-feed refresh, and
Backend capability verification. Their operation ID, exact
`IntegrationSelectionRef`, and correlation coordinates exist only for request
binding and audit; the
integration retains no recoverable operation and cannot return `pending` or
`indeterminate`. A timeout, transport error, malformed response, or unknown
result fails closed under the capability's contract. A retry constructs a new
call from current committed inputs rather than recovering or replaying the prior
call.

## Drivers

A Driver consumes admitted primitive state and returns normalized readiness or
enforcement evidence. OCC remains the primitive writer. A Driver cannot select
another integration, change frozen AgentRevision input, or create arbitrary
Kubernetes resources or RBAC.

Control-plane reconciliation Drivers expose two semantic operations:

- `reconcile` validates its admitted input and idempotently converges one exact
  target and desired generation; and
- `getOperation` recovers the result of an uncertain reconciliation.

A reconciliation result can make state ready only when its target UID, desired
generation, exact `IntegrationSelectionRef`, and admitted input digest match
current OCC state. A stale result remains evidence but cannot activate newer
state.

### Harness

`HarnessDriver` realizes the frozen Harness configuration and owns agent-loop
behavior inside the Cell. It consumes the selected AgentRevision's frozen
Harness and Configuration plus a policy-free Plugin action interface, pinned
companion Plugin-service dispatch reference, and stable runtime-grant binding
handle. It returns an immutable Harness plan. It cannot read Plugin permissions,
constraints, or approval modes; reread mutable authoring resources; rewrite
Plugin action policy; or change the Cell workload identity.

The Cell-local runtime-grant binding is updated only through the materialization
contract. It exposes the exact active RuntimeGrant UID, digest, activation
generation, validity window, and current-Cell association but no policy. The
Harness reads those coordinates locally for its Plugin-service call; it cannot
edit the binding, and a forged or stale coordinate still fails service-side
validation.

A HarnessDriver registration may include one companion out-of-Cell Plugin
service. The service is a component of that same Driver registration, not a
new integration kind. Its component ID, artifact digest, capability version,
and service-identity requirements are pinned in the supplying Backend manifest.
Backend installation provisions its exact `PlatformComponentIdentity`, private
credentials, and network policy. The selected `IntegrationSelectionRef` and
RuntimeGrant pin the registration, and the Harness may invoke only the
companion service from that exact selection.

During inactive RuntimeGrant materialization staging, the companion service may
validate provider authorization required to use the exact pinned
PluginConnection. This readiness check uses only the service-held credential
boundary and produces no Plugin action. It cannot install, consent, provision,
rotate, or remove provider credentials. Failure keeps the accepted rollout
unready and activates no materialization.

At runtime, the Harness constructs the exact Plugin action and parameters, then
invokes the companion Plugin service directly outside the Cell with
authenticated runtime coordinates. Neither the Harness nor the Plugin service
calls OCC on the invocation path. The service resolves
the verified action definition and compiled policy from its exact active local
RuntimeGrant materialization. It enforces the permission, provider-specific
constraints, and approval mode. A missing action, denied permission, unknown
constraint, invalid value, parameter mismatch, or failed approval denies before
provider invocation. The service handles policy, approval, and provider
invocation opaquely and returns only its terminal result. Policy contents,
approval interaction and evidence, provider credentials, and provider calls do
not cross into the Harness. The Harness never routes Plugin approval through
OCC, a Sandbox Driver, or the Channel gateway. Credentials never persist in OCC,
Backend metadata, integration envelopes, Kubernetes resources, Cell
configuration, plans, logs, or audit evidence.

The Harness-to-Plugin service call uses an authenticated platform runtime
channel outside the Cell Sandbox boundary. It binds the exact WorkloadIdentity,
current-Cell association, active RuntimeGrant materialization, Plugin and
manifest, optional PluginConnection, and exact action-and-parameters digest. The
service rejects a missing, stale, or mismatched binding. Unavailability or an
invalid result fails the Plugin action closed, and the Harness never selects
another service. Exact invocation idempotency, replay, and recovery from an
indeterminate provider effect remain outside v1.

### Sandbox

Each Sandbox Driver owns only its configured generic containment facets. OCC
compiles the effective `SandboxPolicy`, projects each Driver's disjoint facets,
and binds every call to the exact AgentInstance, exact pending rollout or active
replacement attempt, accepted generation, exact `IntegrationSelectionRef`, and
policy digest. Pre-Pod reconciliation also binds the admitted workload digest
and dedicated ServiceAccount UID. Post-Pod reconciliation adds the exact Cell
UID only after OCC observes the Kubernetes Pod.

Sandbox Drivers enforce filesystem, network, exec, and runtime containment.
They do not define or interpret Plugin action vocabulary, risk
classification, approval mode, or provider-specific constraint schemas and
values. Network destinations and egress from the Cell remain Sandbox network
policy. Provider calls and egress from a separate Plugin service are outside the
Cell Sandbox boundary.

Sandbox uses the common Driver operations. OCC calls `reconcile` with the exact
desired Sandbox boundary and generation. Before Pod observation, a successful
result reports that the boundary is ready for the admitted workload digest and
ServiceAccount UID. After OCC observes the Pod, reconciliation also binds the
exact Cell UID and returns its attestation evidence. Only evidence matching the
current target, generation, selection, policy, workload, ServiceAccount, and Cell
can contribute readiness. The pre-Pod and post-Pod calls are distinct durable
`reconcile` operations because their exact inputs differ. `getOperation`
recovers an uncertain reconciliation.

OCC reconciles the exact boundary to absent when its rollout or replacement is
abandoned or its Cell ceases to be current. Removal remains idempotent and
retryable after the source attempt becomes terminal. The canonical
[AgentInstance lifecycle](./primitives.md#agentinstance-and-cell) owns ordering,
workload materialization, activation, fencing, and candidate cleanup. A
candidate RuntimeGrant remains inactive until every required Sandbox boundary
is ready and attested. Every active boundary must continue to enforce locally
or fail closed; stale or mismatched enforcement denies protected runtime actions
and invokes the canonical stopped baseline. Control-plane Driver unavailability
alone does not widen or revoke authority while the active boundary remains
independently valid.

### Channel

The selected Channel Driver runs in the Namespace's OpenClaw gateway outside
the Cell. It reconciles the exact Channel binding and performs only the send and
receive actions allowed by its active local RuntimeGrant materialization and
the external provider.

The gateway authenticates each inbound provider event, binds its stable event
identity to the exact reconciled Channel, resolves the exact AgentInstance and
current Cell, and verifies that the active local RuntimeGrant materialization
permits receive. It returns the recorded outcome for an exact duplicate without
delivering it again, and rejects stale, cross-Namespace, or content-mismatched
replays before the authenticated runtime RPC. Outbound send requires the exact
WorkloadIdentity, current Cell, Channel, and active local RuntimeGrant
materialization and binds one stable runtime action ID to the exact message
digest. An identical retry returns the recorded outcome; mismatched reuse
denies. An indeterminate provider send is
resolved through provider status or readback and is never retried blindly.

Channel credentials remain in the gateway runtime. Message payloads may travel
over the authenticated runtime path to the exact active Cell, but they do not
enter OCC, persistent platform state, logs, or audit evidence. Provider
authorization remains an independent required check. Channel approval handling
remains gateway-owned and outside OCC IAM in v1. It applies only to Channel
actions and cannot satisfy a Plugin action's approval mode.

### SecretBroker

The selected SecretBroker Driver realizes one exact Namespace-scoped
`SecretBroker` binding. It owns the private external-store connection and
reports readiness only for the exact committed binding and configuration.

At runtime, it authenticates the exact WorkloadIdentity and current Cell,
verifies that its active local RuntimeGrant materialization authorizes the exact
requested Secret through that binding, resolves the external value, and
delivers it only over the Cell-bound channel. External-store credentials and
resolved values never enter OCC, Backend metadata, Kubernetes resources, logs,
or audit evidence.

## Adapters

An Adapter translates one bounded OCC call to an allowlisted external operation
and normalizes the result. It never accepts a client-controlled provider path,
method, header, body, authority mode, or target override.

An Adapter that can cause side effects uses the stable operation ID for
idempotency and exposes `getOperation` or authoritative readback for uncertain
outcomes. Side-effect-free capabilities use the synchronous request/response
contract above.

### DirectoryAdapter

`DirectoryAdapter` normalizes immutable external subjects and complete group
membership snapshots into revisioned identity evidence. Snapshot members are
immutable provider-subject coordinates with provenance, not OCC
`ExternalIdentity` objects. OCC may call the Adapter during session binding
before a stable Principal exists or during scheduled refresh.
A session-binding call binds the exact `ExternalTenantLink`, external subject
and tenant facts, input digest, exact `IntegrationSelectionRef`, and OCC
identity. A group-refresh call instead binds the exact `ExternalGroupLink`,
including its `ExternalTenantLink` and immutable external group ID. Neither call
carries a Role, AccessBinding, or prior allow.

OCC validates and commits the normalized evidence before IAM uses it. The
Adapter cannot grant admission, create an AccessBinding, call an IAMAdapter, or
receive a raw actor assertion.

### IAMAdapter

OCC enforces its permission ceiling before calling the one IAMAdapter selected
for the authorization request. The determining evidence is either the fixed
Role and AccessBinding set or, only for exact creator-read, the resource's
immutable creator match. For an existing resource, OCC resolves the Adapter
from that exact resource's kind. The call contains the canonical principal,
action, resource, context, committed identity and ceiling evidence, and exact
`IntegrationSelectionRef`.

OCC also resolves the complete effective Restriction set before dispatch. For
each Restriction, the call includes its UID, scope or attachment provenance,
OCC `policyRevision` and policy digest, and exact applicable actions. When the
Adapter has an external policy pair, it also includes `policyAuthorityId` and
the current ready provider `projectionRevision` and projection digest. The
Adapter evaluates exactly this set; it cannot discover another attachment or
silently omit one supplied by OCC.

For `list` and `create`, the containing Installation or Namespace remains the
authorization target while OCC resolves the IAMAdapter from the listed or
candidate resource kind. The call carries that exact `IntegrationSelectionRef`;
selection never changes the authorization target.

`OCCIAMAdapter` evaluates the known action mapping and applicable committed
Restrictions only. A custom IAMAdapter evaluates its own policy plus committed
Restrictions and may only tighten the OCC permission-ceiling result. It returns
one allow or deny with reason codes, obligations, and determining policy
evidence. OCC owns the normalized `AuthorizationDecision`; the Adapter cannot
authorize a different target or mutate policy.

For an externally projected Restriction, the paired IAMAdapter's decision also
binds `policyAuthorityId`, the exact OCC `policyRevision`, provider
`projectionRevision`, and projection digest used for evaluation. OCC accepts
the decision only when those coordinates match the current ready projection for
every applicable Restriction.

### PolicyAdministrationAdapter

OCC is the canonical writer for Restrictions. A PolicyAdministrationAdapter is
the projection-only member of the exact IAMAdapter pair selected for one
`policyAuthorityId`; it is never independently selected for a Restriction or
request. The paired IAMAdapter authorizes Restriction administration and
evaluates protected actions. The PolicyAdministrationAdapter can only project
already-committed OCC state for that same authority.

The Adapter's only policy object is `RestrictionProjection`, derived from one
exact OCC Restriction. It contains the Restriction UID and scope,
`applicability`, exact evaluator resource kinds and canonical actions, OCC
`policyRevision`, `desiredPresence = present | absent`, and an immutable
authority-pair reference containing `policyAuthorityId`, the compiled OCC
configuration revision, and both Adapter registration IDs. When presence is
`present`, it also contains the exact typed deny or obligation policy and its
digest. An absence projection contains no policy value. The projection contains
no independently authorable provider policy. Attachment membership is OCC-owned
parent state supplied to IAM evaluation, not part of the external projection.

The capability exposes three actions:

- `reconcileRestriction` durably converges one exact projection from committed
  OCC state;
- `getOperation` recovers the result of an uncertain reconciliation; and
- `readRestrictionProjection` strongly reads the provider projection for
  readiness or recovery without mutating it.

`reconcileRestriction` follows the common durable operation protocol. For
`desiredPresence = present`, a `succeeded` result and projection readback return
the exact Restriction UID, OCC `policyRevision`, authority-pair reference,
applied policy digest, provider `projectionRevision`, projection digest, desired
presence, and observation time. For `absent`, they instead return the exact UID,
OCC policy revision, authority-pair reference, desired presence, normalized
provider deletion revision, absence-evidence digest, and observation time; no
applied policy digest is required. The operation's `IntegrationSelectionRef`
and authority-pair reference must resolve to the same pair in the pinned
configuration revision. OCC marks a projection ready only when those
coordinates and applicable fields match the current committed intent, and a
present applied policy digest matches the committed typed policy. `pending`,
`indeterminate`, `failed`, missing, mismatched, or stale results are not ready.

The Adapter cannot authorize its invocation, accept an independent policy
mutation, reinterpret applicability, or change the OCC source record. External
projection revision and readback are evidence, never canonical OpenClaw state.

### Plugin feed

V1 has one installation-configured Plugin feed. Its Adapter refreshes
installation-wide discovery and returns normalized Plugin entries with stable
identity, immutable package candidates, verified manifests and manifest
digests, integrity, and eligibility evidence. There is no feed resource or
resource selector.

Feed membership changes discovery and future install eligibility only. It
cannot install, enable, invoke, authorize, or grant a Plugin. Provider-specific
feed profiles, trust data, and loader behavior remain behind the Adapter.

## Backend installation and versioning

A Backend is one immutable distribution manifest over compatible Driver and
Adapter registrations. The manifest pins its name, publisher, release, content
digest, compatible OpenClaw platform versions, component IDs and kinds,
artifact digests, capability versions, and required schemas. It cannot define
selection, authority, resource ownership, credentials, or routes.

A companion Plugin service is declared as a component of its HarnessDriver
registration and inherits that registration's selection and Backend
provenance; it cannot register or select itself.

Backend lifecycle runs through platform deployment, not the OCC fixed-Role API.
The platform deployment operator authorizes the change, and the deployment
mechanism acts through an installation-owned `PlatformComponentIdentity`. OCC
records the initiating deployment-operator identity or authorization provenance
separately from the acting `PlatformComponentIdentity`, together with the exact
manifest identity, release, digest, and outcome.

Installation verifies manifest authenticity, publisher policy, compatible
platform versions, artifact digests, capability declarations, and required
schemas. It provisions each component's required least-privilege identity,
private credentials, and network policy, starts the candidate components, and
verifies their advertised capabilities before atomically adding the complete
manifest set to the eligible registry.

A failed installation leaves the eligible registry unchanged. The platform
deployment mechanism stops every candidate component and revokes every identity
binding, credential, and network grant created by that attempt. A partial
Backend is never eligible. Cleanup failure leaves the candidate in a forward-only
cleanup-pending state outside the registry; new dispatch remains denied while
the deployment mechanism retries cleanup.

An upgrade installs a new immutable revision alongside the old revision. It
does not change selection. A new OCC configuration revision must select the new
revision, and runtime changes then follow the RuntimeGrant and AgentInstance
rollout contracts. The old revision remains available until no configuration,
operation, or RuntimeGrant pins it.

V1 rejects disabling or removing a selected or pinned revision. Removal occurs
only after configuration no longer selects it and its dependency count reaches
zero. OCC removes its eligible registry entry and integration authorization.
The platform deployment mechanism then stops its components and revokes their
identity bindings, private credentials, and network grants. OCC preserves
manifest, installation, operation, and audit tombstones. Cleanup failure leaves
the revision ineligible and cleanup-pending; retries continue forward and never
restore eligibility.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| Required capability, schema, selection, or Sandbox facet is missing, ambiguous, stale, or incompatible | Reject installation or configuration, or block dispatch; never choose by order or fall back |
| An idempotent reconciler is unavailable before dispatch | Leave accepted desired state pending under the exact `IntegrationSelectionRef`; preserve a non-tightening deployment or retain the stopped baseline for a tightening; never substitute another integration |
| An integration permanently rejects the exact operation coordinates or admitted input | Return `failed` with a stable reason, dispatch no later stages, and preserve the applicable current-deployment or stopped-baseline state until the attempt is stopped, deleted, or superseded |
| IAMAdapter denies, fails, times out, or returns stale or unknown evidence | Deny the source operation; never add a local allow or retry another IAMAdapter |
| Restriction projection is pending, indeterminate, failed, missing, mismatched, or stale for the paired IAM authority | Deny dependent protected operations until exact committed OCC policy revision and desired presence are read back; never use another pair or treat an older projection as a current allow |
| A candidate RuntimeGrant materialization, current-Cell association, or Cell binding is pending, inactive, missing, stale, or mismatched | Keep the candidate unready and deny its runtime use locally |
| An active required materialization, current-Cell association, or Cell binding becomes missing, stale, or mismatched | Deny affected runtime actions locally and invoke the canonical stopped baseline as loss of a required active enforcement point |
| Sandbox reconciliation before Pod observation is pending or indeterminate | Create no workload and leave any candidate RuntimeGrant inactive |
| Sandbox reconciliation for an observed Cell is pending or indeterminate | Keep the candidate Cell deny-by-default and unready and leave any candidate RuntimeGrant inactive |
| Sandbox reconciliation fails or the candidate is abandoned | Reconcile the exact Sandbox boundary to absent; the primitive lifecycle removes candidate workload and attempt state |
| Active Sandbox enforcement becomes missing, stale, or mismatched | Deny protected runtime actions locally, invoke the canonical stopped baseline, and reconcile the exact boundary to absent |
| Plugin service authentication or invocation binding is missing, stale, or mismatched; the compiled permission denies; a provider constraint is invalid or mismatched; or approval fails | Deny the Plugin action before provider invocation |
| Plugin service is unavailable or returns no valid result | Fail the Plugin action closed without consulting OCC or selecting another service; exact retry and indeterminate-result recovery remain outside v1 |
| Durable integration outcome is uncertain | Query the stable operation ID; retry only an idempotent reconciliation with identical content |
| A new rollout supersedes a pending or indeterminate attempt | Cancel the old attempt, recover its original operations, make candidate grant materializations terminal, make candidate workloads and boundaries absent, and dispatch no successor operation until every applicable proof is authoritative |
| Active RuntimeGrant materialization or Cell binding is missing, inactive, expired, terminal, or bound to another WorkloadIdentity, activation generation, or capability slice, or the caller is not the AgentInstance's exact current Cell | Deny runtime use locally without consulting OCC and apply the active-enforcement-loss rule above when required state was previously active |
| Atomic source decision, mutation, reconciliation intent, or audit commit fails | Commit none of them, dispatch nothing, and return a fail-closed infrastructure error |
| Downstream operation persistence fails after an accepted mutation | Dispatch nothing and retry persistence with the same deterministic operation identity |
| Backend installation fails before atomic eligibility | Keep the prior registry unchanged and remove all candidate installation state |
| Backend installation or removal cleanup fails | Keep the revision ineligible and cleanup-pending, deny new dispatch, and retry cleanup without restoring eligibility |

## Audit boundary

For a control-plane mutation, OCC commits assertion consumption when required,
the completed `AuthorizationDecision`, mutation, deterministic reconciliation
intent, and required audit evidence in the canonical atomic boundary. Directory
evidence and its mutation audit commit atomically before becoming authoritative;
IAM evidence participates in the canonical `AuthorizationDecision` boundary.
The [operation dispatch](#operation-dispatch) contract owns downstream
persistence, result use, and recovery.

Audit evidence may record assertion IDs and verified-claims digests, but never
raw actor assertions, credentials, secret values, message contents, provider
payloads, or resolved configuration secrets. Event schemas, transport, storage,
retention, export, and query mechanisms remain deferred.

## Rationale

- **Separate ownership from execution.** OCC owns resources and authorization;
  integrations perform only their selected runtime or external-system work.
- **Separate installation from selection.** Backends make compatible artifacts
  eligible without changing which implementation receives an operation.
- **Recover uncertainty by identity.** Stable operation IDs and retained
  results permit safe reconciliation without blind retries or duplicate
  provider effects.
