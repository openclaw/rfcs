# Credential Broker v1 Specification

This shared contract supports [RFC 0034](../0034-github-app-credentials.md), the provider-specific [GitHub profile](github-app-v1-spec.md), and [recovery and qualification](lifecycle.md).

Status: draft; upstream OCE implementation is not claimed. **Must** identifies a conformance requirement.

## Scope and ownership

V1 manages credentials for admitted external access through an internal issuer behind the Namespace-scoped `SecretBroker`. It adds no public Token, Lease, Issuer, or permission resource. OCC identities, resource authorization, workload assignments, and the logical work records proposed by RFC 0036 remain authoritative.

OCC owns configuration and resource lifecycle. The broker consumes authorization and coordinates protected custody, inventory, delivery/use, and cleanup. Issuers perform provider operations. `SecretDriver` manages backend storage; custody and durable inventory require the additional guarantees below. `ServiceAccountDriver` retains account provisioning.

Trusted platform services host the broker, issuer, and protected-material client outside Agent execution. Existing services may host them; the Namespace gateway routes requests without gaining credential authority. The GitHub profile's host connector also runs outside execution.

The issuer interface is local. Protected handles have no public constructor, serialization, or workload-facing byte accessor. Remote issuers require a separately specified authenticated protocol; JSON handles confer no authority. Brokers need no dedicated process per Agent or provider. Durable state survives process replacement and supports multiple service instances.

Signing or forwarding with existing credentials may reuse these authority and custody boundaries but needs separate operation contracts. V1 does not migrate model or ServiceAccount credentials.

### Contracts consumed from the RFC series

Use [RFC 0035's execution-assignment contract](https://github.com/openclaw/rfcs/pull/69), [RFC 0036's original-work grant](https://github.com/openclaw/rfcs/pull/70), and [RFC 0037's stop/replacement semantics](https://github.com/openclaw/rfcs/pull/71). These remain draft dependencies. The [series overview](../0027/runtime-access-overview.md) is informational. Credential mediation needs their required semantics, not the entire completed-context recovery feature or an automatic switch to SPIFFE for Agent-to-OCC authentication.

OCC owns one canonical execution assignment and generation. Broker bindings and runtime observations reference it; the broker cannot independently decide which execution is current. RFC 0036 owns service-owned logical work, its immutable scope and horizon, requester provenance, and child lineage. RFC 0035 owns bounded enforcement leases and their issuance/withdrawal protocol. Requester invocation authorization is separate from service/workload provider permission; there is no ambient per-effect intersection with the requester's human permissions. Data eligibility and result audience require their own checks. Preparation uses separately admitted control purpose; cleanup uses independently retained platform authority.

The broker's access lease references the original logical work and digest, exact admitted repository grant, and current execution assignment. It can only narrow that authority. Logical work may span turns and execution replacements; a broker access lease cannot change its work or assignment. A replacement needs fresh current authorization and the required predecessor termination evidence, then new access leases. Old assignment leases remain closed.

Business-operation receipts, credential-issuance records, and lifecycle operations have distinct identities and owners. Link their references so a token refresh, reconnect, or runtime replacement cannot create another attempt at an uncertain business effect. An issuance result is not the result of the business request that needed it.

## Configuration and admitted records

These internal, versioned records use existing OCC identifier codecs and add no API routes. Resolve references in trusted storage, never as caller-supplied URLs. Reject unknown versions, unknown authority-affecting fields, unsupported modes, and unbounded inputs before effects.

| Record | Required contents and owner |
| --- | --- |
| Issuer binding | OCC: Installation and Namespace, exact broker and Secret references, selected issuer implementation/profile versions, protected provider-account binding, configuration generation, and enabled state. No key or token bytes. |
| Admitted access | OCC: immutable internal `admittedAccessRef`, Agent/revision, binding/profile versions, provider-typed resource and permission grant, allowed mode, purpose, absolute access horizon, and limits. Its digest commits these fields. Current policy may narrow or revoke it. |
| Admission selection | OCC: selected admitted-access references, supported narrower permissions, and horizon. Selected IAM authorizes invocation separately from service/workload access. Session references retain provenance and any explicit cancellation relationship. |
| Logical work | Reference to RFC 0036's authoritative service-owned work and immutable digest: original selection, owner and requester, admitted-access references, scope/horizon, and child lineage. A model turn or connection does not define its lifetime. |
| Enforcement lease | OCC authority: bounded permission for exact work, assignment, receiver, operation profile, and original absolute deadline, with issuance ordering and withdrawal evidence. The broker cannot issue or extend it. |
| Execution binding | Reference to OCC's canonical assignment and execution generation, exact Agent/revision and incarnation. Runtime work requires a protected link to its original work and child/request channel. |
| Access lease | Broker: immutable original work or preparation identity, execution binding, exact admitted-access reference and digest, scope ceiling fixed at admission, current generation/version, deadline within the original work/purpose horizon, and `open` or `closed` state. It grants no use beyond valid enforcement authority. |
| Issuance record | Inventory: stable operation and provider-attempt identities, intent digest, original lease/binding/generation, provider outcome, protected material references, actual expiry/scope evidence, delivery state, and cleanup state. |

Binding changes cannot silently retarget active revisions. For planned key rotation, stage protected material and verify the same provider account before atomically selecting the new generation and closing affected leases. Report failed verification and leave the binding unchanged; independently authorized emergency disable can close access immediately. Further use requires newly admitted revisions and leases pinned to the verified generation. Retain issued-token/revocation material and cleanup records until obligations finish. Retiring a source key is separate from token revocation.

Enrollment reports `unverified`, `ready`, `disabled`, or `degraded`, with bounded reason codes. `ready` requires verified provider binding, available protected custody and inventory, and a supported issuer profile. It neither grants access nor mints tokens; workload readiness and mode qualification remain separate.

## Current authority and workload origin

For each issuance, delivery, and mediated operation, the broker must authenticate the caller and enforce OCC/IAM and runtime authority for:

- the exact Installation, Namespace, Agent, revision, broker, Secret, and protected provider binding;
- the admitted execution incarnation and original logical work, or separately admitted preparation purpose;
- the permitted resource/operation intersection, binding/profile versions, lease generation, and deadline;
- every applicable restriction and required audit decision.

Agents use their explicitly granted service/workload authority. Human roles, sessions, provider credentials, and permissions do not transfer to Agents. Requester permission to invoke the service is checked at admission and other explicitly selected invocation boundaries, not used as ambient provider authority on each effect. Missing required evidence denies. Preparation requires separate admission and cannot fabricate logical work or use a runtime lease.

Writes, new admission, enforcement/access-lease renewal, expansion, and new execution assignment require current authority. Existing application reads may continue during an authority outage only under an expressly qualified, unexpired enforcement lease. Protected origin, locally enforced withdrawal, operation semantics, scope, inventory, approval, freshness, and all other required evidence still apply. An HTTP method alone does not classify an operation as a read. Missing or untrustworthy clock/revocation state requires synchronization before serving.

This bounded read profile deliberately extends RFC 0027's denial on unavailable authority; it is not an existing platform guarantee. Each lease fits the original work and ancestor horizons, purpose/stop deadlines, and every applicable withdrawal target after clock and enforcement allowance. Ordinary profiles may target minutes and sensitive profiles seconds; exact numerical bounds need qualification. Allocated operation budgets require durable consumption across restart. A lease cannot substitute for required live approval, freshness, or provider checks.

Trusted credential maintenance may preserve those existing reads only when expressly preauthorized under the same enforcement lease, without new work, broader scope, or a later authority deadline. It must use an enforceable read-only credential profile and cannot reuse or replace a write-capable credential offline. Custody, inventory, overlap limits, unknown-issuance holds, and provider evidence remain mandatory. Otherwise issuance denies during the outage. Native delivery does not qualify for this exception.

Effective access intersects service/workload authority, admitted revision grants, the original work selection, and applicable restrictions, using current decisions or the qualified read lease above. Each work/assignment receives fresh access leases for its exact selected grants. Every `beginAccess`, including the first for a grant, requires current authority and checks the retained original selection. Policy recovery permits use only within unchanged scope and still-open authority; it cannot reopen a closed lease.

Enforcement expiry stops dispatch without itself completing logical work. Current authority may issue fresh enforcement evidence for still-open work and an eligible assignment; an independently unexpired, open broker access lease may then serve it. This does not reopen an expired enforcement lease, a closed access lease, or completed work.

The lease records an immutable scope ceiling. Each issuance/use computes current
effective scope within that ceiling and selects a supported provider profile.
Policy narrowing changes eligible operations and credentials, not the recorded
ceiling. An open lease may issue a supported narrower credential under its
existing limits; each issuance records its exact scope and cache key. Unsupported
intersections deny instead of rounding up permissions.

Credentials exceeding current effective scope become ineligible and retain
cleanup obligations. Mark affected credentials cleanup-only and revoke them;
they cannot return to use if policy later recovers. Previously delivered native
copies remain provider-valid until actual revoke or expiry. Narrowing, renewal,
and later policy recovery never bypass overlap limits or unknown-issuance holds.

A wider selection requires fresh work admission within current Agent authority. Existing work and renewals cannot exceed their original selection. Logical-work closure closes its affected access leases. A session or turn ending closes work only when its admitted lifecycle explicitly requires that relationship. Preparation uses its separately admitted selection.

Handles, unexpired identity certificates, caller-supplied work IDs, and ordinary cached decisions do not establish authority. A qualified enforcement lease requires its own protected issuance and withdrawal evidence. Container identity cannot distinguish work sharing a container. The runtime must protect the link between each credentialed effect and its original admitted work; old requests cannot borrow later work's authority. Issuers cannot supply missing origin proof.

### One effective grant, two enforcement points

Issuer permission selection and mediator request checks must derive from the same versioned grant, original selection, and applicable narrowing. A trusted protocol adapter validates each request and supplies canonical resource identities, operation, policy-relevant arguments, and an immutable request digest. OCC/IAM or its qualified read enforcement lease authorizes those facts; the broker consumes the exact effect permit at dispatch. Caller labels and parsed data confer no authority.

Each supported provider operation must declare required permissions, constraints, read/write behavior, and uncertain-outcome handling. This protocol catalog has no policy authority. Unsupported constraints deny admission or the affected operation. Permission failures cannot trigger broader credentials, another account, or a less restrictive mode. Wider grants require authorized admission and new work.

### Persistent processes and background work

Persistent execution is required. Lease closure denies new credentialed effects and starts cleanup even if a process or connection survives. Neither survival nor later work renews closed authority. Workspace replacement requires Compute to observe previous writers stopped.

Admission distinguishes:

- **Reusable worker:** each request belongs to explicitly admitted logical work with its own immutable selection and enforcement authority. Permissions do not carry forward between work records. Shared state must satisfy the admitted baseline; private data or additional authority requires qualified isolation.
- **Long-lived work and attached children:** service-owned work may outlive the initiating turn within its original scope and finite horizon. Each attached child has its own admitted work record and immutable lineage. Fresh child renewal requires current authority and open, authorized logical ancestors; it does not require a live coordinator process or an unexpired parent execution lease. Ancestor cancellation withdraws descendants. Independent work requires its own admission.

RFC 0036 owns work admission, child lineage, and cancellation relationships. The admission producer and protected dispatch mechanism require implementation and qualification. The broker cannot invent work or silently detach children. RFC 0037's completed-state recovery supplies no authority to resume provider operations; separately admitted finite delivery has its own exact scope and current write authorization.

A mutable current-turn pointer or workload-selected handle cannot establish work attribution. A trusted dispatcher must own the authorized request boundary, or differently authorized work needs execution isolation. Request labels cannot isolate mutually untrusted computations in a shared process. Without this boundary, restrict the process to one immutable authority context and deny after closure; mixed-authority reuse is unsupported. Qualification must cover concurrency, queued requests, cancellation, reconnects, and restart.

## Broker operations

These required local ports may adapt existing methods without adding another authority or inventory store.

| Operation | Required input | Result and behavior |
| --- | --- | --- |
| `beginAccess` | Authenticated admission context; original work/preparation reference; exact `admittedAccessRef`, requested scope ceiling and execution binding; stable request ID. | Resolve authoritative records, check current authority, commit the authorized ceiling and unique lease binding, and return an opaque reference and deadline. |
| `renewAccess` | Same original binding, lease reference, expected version, stable request ID. | Recheck authority and conditionally advance version/deadline within the original absolute horizon. Preserve principal, purpose, resources, mode, and incarnation. Closed leases cannot reopen. |
| `acquireCredential` | Authorized operation, open access lease/version, enforcement evidence, exact provider-typed grant. | Select an eligible recorded credential or run the durable issuance protocol. During authority outage, allow only the expressly preauthorized read-only maintenance exception. Return a protected reference to the trusted delivery/forwarding owner only. |
| `deliverNative` | Current original authority, exact recorded credential and lease, immutable receiving child/channel, delivery ID. | Require admitted native mode and durably committed delivery intent before release on that exact channel. Return safe delivery status separately from issuance status. |
| `authorizeUse` | Current authority or qualified read enforcement lease, original work binding, access lease/version, validated provider operation and request digest. | Authorize one mediated dispatch; the trusted protocol adapter uses protected credentials. It cannot expose an arbitrary signing or forwarding endpoint. |
| `closeAccess` | Exact lease/version and authenticated lifecycle/cancel authority, cause, operation ID. | Commit terminal closure and cleanup obligations. Return local closure status separately from provider revocation and execution termination. |
| `readStatus` | Authorized reader and exact operation/lease reference. | Return safe state and evidence metadata. Readback cannot authorize another provider attempt. |
| `listOutstanding` | Existing management authority for the original ownership scope, binding/resource filter, bounded page size and snapshot cursor. | Enumerate unresolved records, including tombstones, without exposing protected material or requiring the deleted resource to exist. Read authority grants no cleanup effect. |

The accepting authority creates current-authorization context; caller fields or type brands cannot establish it. Management, workload-use, read, and cleanup capabilities are distinct. Management status includes original ownership, safe operation IDs, blocked scope, cause, evidenced/unproven expiry, last/next cleanup attempt, and authority/evidence needed to resolve a hold. This management path and custody responsibility survive resource deletion.

Every mutation and effect requires a stable request/operation ID and immutable intent digest; updates require expected record versions. Results use this closed family:

| Result | Meaning |
| --- | --- |
| `ok` | Known committed operation, resulting version, and method-specific safe result. Protected references go only to the authorized local consumer. |
| `denied` | Current authority or profile forbids this call; no new effect is admitted. Existing obligations from earlier calls remain. |
| `conflict` | Request ID reused with different intent, or a new update names a stale version; no new effect is admitted. |
| `unavailable` | A dependency is unavailable and evidence proves this call admitted no effect. |
| `indeterminate` | An identified provider, commit, or delivery phase may have acted. Return its original operation reference and safe known state for reconciliation; do not replay. |

The unique access-lease key is `(Namespace, original work or preparation operation, execution assignment/generation, broker binding, admittedAccessRef)`. `admittedAccessRef` identifies an OCC-owned immutable grant, never a caller alias or profile name. Repositories sharing a profile still require distinct references and leases.

Look up identical operations before comparing expected versions; lost begin/renew responses read known results under fresh authority. Changing an immutable binding or scope ceiling conflicts even with a new request ID for the same lease key. Renewal changes only the permitted deadline/version; current effective scope is rechecked separately. Readback returns known version/state, `unresolved`, or `not-found`; `not-found` does not prove that no earlier effect occurred. Listing uses a stable snapshot and records late obligations separately to prevent omissions during concurrent cleanup.

## Issuer interface

Each issuer exposes a fixed versioned profile and these ports. Broker calls are authorized and bounded; issuers cannot broaden accounts or grants.

| Port | Contract |
| --- | --- |
| `capabilities` | Declares the provider-typed scope schema, fixed or requested lifetime semantics, individual/broader/unsupported revocation, observation support, and any evidenced idempotency behavior. A declaration is not qualification. |
| `issue` | Takes the recorded issuance/provider-attempt IDs and intent digest, exact binding/profile generation and authorized effective scope within the lease ceiling, protected material capability, current one-operation permit, deadline, and cancellation signal. |
| `revoke` | Takes the exact issued record and protected revocation capability, recorded cleanup claim/provider-attempt IDs, independently authorized cleanup responsibility, deadline, and cancellation signal. |
| `observe`, if supported | Reads an exact earlier operation or credential's outcome under bounded read authority, without repeating its effect. |

`issue` returns one of:

- `issued`: protected credential/revocation references, returned scope, actual expiry or an explicitly supported expiry classification, and bounded provider evidence;
- `not-dispatched`: evidence that no request crossed the provider boundary;
- `rejected`: definitive evidence that the provider created no credential;
- `unknown`: the provider may have created a credential; retain available protected material and evidence without enabling use.

`revoke` returns `confirmed`, `pending`, `unknown`, or `failed`, with evidence and a safe reason. Declare unsupported revocation before profile admission. `observe` returns evidence or explicit unresolved status. Aborts and exceptions do not prove that the provider did nothing.

Provider success does not establish inventory persistence or delivery. The broker validates returned scope and expiry, retaining unexpected output only for cleanup. Providers unable to meet the selected native-exposure or mediated-use policy remain unavailable. Broader administrative revocation requires separate scope authorization and cannot be an automatic fallback.

## Durable issuance and dispatch

1. **Reserve.** Check current authority, or the expressly preauthorized read-maintenance authority, plus limits and audit readiness. Before any provider call, commit issuance intent bound to the original lease, exact scope, generation, and operation.
2. **Claim.** Commit one provider-attempt claim with conditional version checks. Replicas and retries must resolve the same operation. Expired worker claims and missing acknowledgements do not prove no dispatch occurred.
3. **Dispatch.** The existing authority owner supplies a bounded operation permit, directly or through qualified local read enforcement. The broker consumes it for the exact request at dispatch, ordered against applicable closure and invalidation. Locally observed withdrawal or expiry before consumption denies; consumption first means an in-flight operation may finish. Disconnected read holders enforce the original deadline and selected withdrawal bound; write permits require current authority. Cancellation cannot promise distributed rollback.
4. **Record.** Before use/delivery, retain accepted material in protected durable custody and commit its inventory record, actual scope, and expiry. Late results after closure or rotation retain the original attempt and enter cleanup. Reconcile partial or uncertain persistence by exact operation identity.
5. **Use or release.** Validate the credential against the original work and applicable enforcement evidence. Delivery intent requires a known durable outer commit before the first byte or release callback; returning from an uncommitted transaction is insufficient. Unknown commitment suppresses release until exact readback. Enforce use/delivery authority at the actual boundary. Cancellation between mint and release must not expose credentials to later work.

Identical retries return or reconcile the original operation; different intent digests conflict. Provider profiles define safe retries after definitive no-effect evidence. `unknown`, timeout, new request IDs, or absent local read results never authorize reminting. Providers have no generic exactly-once guarantee.

Inventory must retain outstanding and uncertain obligations across restart and deletion. Conditional claims, protected custody, and audit persistence must define commit/readback behavior. Insufficient capacity, audit, or storage availability denies new effects; obligations cannot be evicted. Token values, keys, authorization headers, and handle secrets cannot enter ordinary resource records, logs, metrics, or audit payloads.

## Replacement, closure, and cleanup

Replacement issues a new credential under the same still-authorized lease without renewing it, revoking predecessors, or replaying failed business operations. Track every predecessor and successor; bound overlap per profile. Caches may reuse only exact permitted scope/binding/lease matches and cannot cache authority.

Access-lease closure or expiry, grant withdrawal, binding rotation, incarnation retirement, and explicit disable prevent new use/delivery and require cleanup of every affected issued or uncertain credential. Commit invalidation and a complete inventory-scan obligation together, including racing/late results. Resource deletion retains a tombstone, protected references, and cleanup responsibility.

An Agent stop first closes admission of new work under RFC 0037. During its recorded finite drain, existing work may use or replace eligible credentials only within its unchanged original scope, enforcement evidence, and drain deadline. Authority renewal requires current decisions and cannot extend the stop deadline. Completion, deadline, cancellation, disable, or retirement closes affected authority. The accepting-service protocol must order runtime-purpose withdrawal, work closure, and broker dispatch, including qualified disconnected readers and their withdrawal bounds. An open connection, renewed SVID, or refreshed GitHub token cannot bypass those bounds.

Graceful stop preserves pending delivery of an already completed result when its separate finite delivery responsibility was admitted before work closure; it cannot keep computation's access leases open. Any GitHub write used for that delivery needs its own exact admitted scope and current authority. Cancellation or security revocation withdraws affected delivery even if the Agent is already stopped. Already admitted provider effects and independently authorized cleanup remain separately tracked.

Cleanup uses separately authenticated platform lifecycle authority limited to reducing the exact recorded access. It survives revocation of the initiating human and cannot issue replacements or perform user work. Durably claim and record each attempt; takeover must resolve or safely account for earlier uncertain attempts before dispatch. Claim timeout alone is not success.

Keep these status dimensions independent:

| Dimension | States |
| --- | --- |
| Authorization | `open`, `closed` with cause and commit time. |
| Issuance | `reserved`, `dispatched`, `issued`, `not-issued`, `unknown`. |
| Delivery/use | `not-started`, `admitted`, `completed`, `unknown`, or `denied`. |
| Cleanup | `not-required`, `pending`, `confirmed-revoked`, `confirmed-expired`, `unknown`, or `action-required`. |
| Execution | Supplied independently by Compute: running, stopping, observed stopped, or unresolved. A closed lease does not imply a stopped process. |

Expiry requires a timestamp and provenance; otherwise it is unproven. Completion requires that evidenced time to have elapsed, including the selected clock uncertainty allowance. Neither a future expiry nor guessed issue time plus nominal TTL proves completion.

## Issuer service lifecycle

Trusted services validate the fixed issuer profile and dependencies before serving. `quiesce` stops admitting local calls and cancels/drains bounded in-flight work while retaining outcome records. `dispose` releases local clients and material handles without implying token revocation. Restart resumes from durable inventory under fresh service and cleanup authority; cached permission decisions cannot revive.

Shutdown reports local completion separately from cleanup obligations. Unavailable issuers or backends report degradation without fallback to another account, issuer, credential class, or access mode.

## Versioning and conformance

V1 profile identity includes interface and provider schema versions. Reject unsupported authority-bearing fields and capability combinations. Backend, authority, and runtime replacements must satisfy the lifecycle and evidence rules as well as method signatures.

The selected provider and mode determine required provider, client, preparation, and mediation checks in [the acceptance matrix](lifecycle.md#acceptance-matrix). Parser, mock, and component checks cannot establish real current authority, durable transactions, provider revocation, or origin binding.
