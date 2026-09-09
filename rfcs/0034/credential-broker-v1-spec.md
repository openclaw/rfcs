# Credential Broker v1 Specification

This shared contract supports [RFC 0034](../0034-github-app-credentials.md), the provider-specific [GitHub profile](github-app-v1-spec.md), and [recovery and qualification](lifecycle.md).

Status: draft; upstream OCE implementation is not claimed. **Must** identifies a conformance requirement.

## Scope and ownership

V1 manages credentials for admitted external access through an internal issuer behind the Namespace-scoped `SecretBroker`. It adds no public Token, Lease, Issuer, or permission resource. Existing OCC identities, resource authorization, workload assignments, and invocation records remain authoritative.

OCC owns configuration and resource lifecycle. The broker consumes authorization and coordinates protected custody, inventory, delivery/use, and cleanup. Issuers perform provider operations. `SecretDriver` manages backend storage; custody and durable inventory require the additional guarantees below. `ServiceAccountDriver` retains account provisioning.

Trusted platform services host the broker, issuer, and protected-material client outside Agent execution. Existing services may host them; the Namespace gateway routes requests without gaining credential authority. The GitHub profile's host connector also runs outside execution.

The issuer interface is local. Protected handles have no public constructor, serialization, or workload-facing byte accessor. Remote issuers require a separately specified authenticated protocol; JSON handles confer no authority. Brokers need no dedicated process per Agent or provider. Durable state survives process replacement and supports multiple service instances.

Signing or forwarding with existing credentials may reuse these authority and custody boundaries but needs separate operation contracts. V1 does not migrate model or ServiceAccount credentials.

## Configuration and admitted records

These internal, versioned records use existing OCC identifier codecs and add no API routes. Resolve references in trusted storage, never as caller-supplied URLs. Reject unknown versions, unknown authority-affecting fields, unsupported modes, and unbounded inputs before effects.

| Record | Required contents and owner |
| --- | --- |
| Issuer binding | OCC: Installation and Namespace, exact broker and Secret references, selected issuer implementation/profile versions, protected provider-account binding, configuration generation, and enabled state. No key or token bytes. |
| Admitted access | OCC: immutable internal `admittedAccessRef`, Agent/revision, binding/profile versions, provider-typed resource and permission grant, allowed mode, purpose, absolute access horizon, and limits. Its digest commits these fields. Current policy may narrow or revoke it. |
| Session selection | Existing OCC session/admission record: selected admitted-access references, supported narrower permissions, and horizon. IAM authorizes selection within the Agent's grant. |
| Invocation selection | Existing OCC invocation record: immutable reference/version or digest of the original selected grants, effective scopes, and horizon. |
| Execution binding | Runtime authority: exact Agent/revision and incarnation, with a generation that changes on restart. Runtime work requires a protected link to its original invocation and child/request channel. |
| Access lease | Broker: immutable original invocation or preparation identity, execution binding, exact admitted-access reference and digest, effective scope, current generation/version, deadline, and `open` or `closed` state. |
| Issuance record | Inventory: stable operation and provider-attempt identities, intent digest, original lease/binding/generation, provider outcome, protected material references, actual expiry/scope evidence, delivery state, and cleanup state. |

Binding changes cannot silently retarget active revisions. For planned key rotation, stage protected material and verify the same provider account before atomically selecting the new generation and closing affected leases. Report failed verification and leave the binding unchanged; independently authorized emergency disable can close access immediately. Further use requires newly admitted revisions and leases pinned to the verified generation. Retain issued-token/revocation material and cleanup records until obligations finish. Retiring a source key is separate from token revocation.

Enrollment reports `unverified`, `ready`, `disabled`, or `degraded`, with bounded reason codes. `ready` requires verified provider binding, available protected custody and inventory, and a supported issuer profile. It neither grants access nor mints tokens; workload readiness and mode qualification remain separate.

## Current authority and workload origin

For each issuance, delivery, and mediated operation, the broker must authenticate the caller and obtain current OCC/IAM and runtime decisions for:

- the exact Installation, Namespace, Agent, revision, broker, Secret, and protected provider binding;
- the current execution incarnation and original invocation, or separately admitted preparation purpose;
- the permitted resource/operation intersection, binding/profile versions, lease generation, and deadline;
- every applicable restriction and required audit decision.

Agents use their explicitly granted `WorkloadIdentity` authority. Original-actor attribution and invocation policies may only narrow it; human roles, sessions, provider credentials, and permissions do not transfer to Agents. Missing mappings or unavailable current decisions deny. Preparation requires separate admission and cannot fabricate a turn or use a runtime lease.

Effective access intersects current workload authority, admitted revision grants, authorized session selection, and original invocation selection and restrictions. OCC records both selections before execution; missing or ambiguous selections deny. Each invocation receives fresh leases for its exact selected accesses. Every `beginAccess`, including the first for a grant, checks the retained original selection and current narrowing.

Session expansion requires authorized re-admission within current Agent authority and applies only to new invocations with fresh leases. Existing invocations and renewals cannot gain resources or permissions. Closing a session or invocation closes all affected leases. Preparation uses its separately admitted selection.

Handles, unexpired identity certificates, caller-supplied turn IDs, and cached decisions do not establish current authority. Container identity cannot distinguish invocations sharing a container. The runtime must protect the link between each credentialed effect and its original admitted work; old requests cannot borrow later work's authority. Issuers cannot supply missing origin proof.

### One effective grant, two enforcement points

Issuer permission selection and mediator request checks must derive from the same versioned grant, original selection, and current narrowing. A trusted protocol adapter validates each request and supplies canonical resource identities, operation, policy-relevant arguments, and an immutable request digest. Existing OCC/IAM evaluates these facts; the broker consumes its permit for that exact effect at dispatch. Caller labels and parsed data confer no authority.

Each supported provider operation must declare required permissions, constraints, read/write behavior, and uncertain-outcome handling. This protocol catalog has no policy authority. Unsupported constraints deny admission or the affected operation. Permission failures cannot trigger broader credentials, another account, or a less restrictive mode. Wider grants require authorized admission and new work.

### Persistent processes and background work

Persistent execution is required. Lease closure denies new credentialed effects and starts cleanup even if a process or connection survives. Neither survival nor later work renews closed authority. Workspace replacement requires Compute to observe previous writers stopped.

Admission distinguishes:

- **Reusable worker:** each request belongs to an explicitly admitted invocation with its own immutable selection and current authority. Permissions do not carry forward.
- **Background job:** GitHub work continuing beyond its initiating interactive invocation needs separate admission. The proposed representation uses an existing OCC invocation/work record with a noninteractive purpose, original attribution, exact grants and restrictions, finite horizon, renewal limits, and lifecycle/cancellation owner. Session-linked work closes with its session; session-independent work needs separate explicit authority.

The background-admission producer, supported session relationship, and protected dispatch mechanism cannot authorize access until specified and qualified. The broker must not invent invocations or silently detach work when a turn ends.

A mutable current-turn pointer or workload-selected handle cannot establish work attribution. A trusted dispatcher must own the authorized request boundary, or differently authorized work needs execution isolation. Request labels cannot isolate mutually untrusted computations in a shared process. Without this boundary, restrict the process to one immutable authority context and deny after closure; mixed-authority reuse is unsupported. Qualification must cover concurrency, queued requests, cancellation, reconnects, and restart.

## Broker operations

These required local ports may adapt existing methods without adding another authority or inventory store.

| Operation | Required input | Result and behavior |
| --- | --- | --- |
| `beginAccess` | Authenticated admission context; original invocation/preparation reference; exact `admittedAccessRef`, effective scope and execution binding; stable request ID. | Resolve authoritative records, check current authority, commit a unique lease binding, and return an opaque reference and deadline. |
| `renewAccess` | Same original binding, lease reference, expected version, stable request ID. | Recheck authority and conditionally advance version/deadline within the original absolute horizon. Preserve principal, purpose, resources, mode, and incarnation. Closed leases cannot reopen. |
| `acquireCredential` | Current authorized operation, open lease/version, exact provider-typed grant. | Select an eligible recorded credential or run the durable issuance protocol. Return a protected reference to the trusted delivery/forwarding owner only. |
| `deliverNative` | Current original authority, exact recorded credential and lease, immutable receiving child/channel, delivery ID. | Require admitted native mode and durably committed delivery intent before release on that exact channel. Return safe delivery status separately from issuance status. |
| `authorizeUse` | Current original authority, lease/version, validated provider operation and request digest. | Authorize one mediated dispatch; the trusted protocol adapter uses protected credentials. It cannot expose an arbitrary signing or forwarding endpoint. |
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

The unique lease key is `(Namespace, original invocation or preparation operation, incarnation, broker binding, admittedAccessRef)`. `admittedAccessRef` identifies an OCC-owned immutable grant, never a caller alias or profile name. Repositories sharing a profile still require distinct references and leases.

Look up identical operations before comparing expected versions; lost begin/renew responses read known results under fresh authority. Changing an immutable binding or effective scope conflicts even with a new request ID for the same lease key. Renewal changes only the permitted deadline/version. Readback returns known version/state, `unresolved`, or `not-found`; `not-found` does not prove that no earlier effect occurred. Listing uses a stable snapshot and records late obligations separately to prevent omissions during concurrent cleanup.

## Issuer interface

Each issuer exposes a fixed versioned profile and these ports. Broker calls are authorized and bounded; issuers cannot broaden accounts or grants.

| Port | Contract |
| --- | --- |
| `capabilities` | Declares the provider-typed scope schema, fixed or requested lifetime semantics, individual/broader/unsupported revocation, observation support, and any evidenced idempotency behavior. A declaration is not qualification. |
| `issue` | Takes the recorded issuance/provider-attempt IDs and intent digest, exact binding/profile generation and admitted grant, protected material capability, current one-operation permit, deadline, and cancellation signal. |
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

1. **Reserve.** Check current authority, limits, and audit readiness. Before any provider call, commit issuance intent bound to the original lease, exact scope, generation, and operation.
2. **Claim.** Commit one provider-attempt claim with conditional version checks. Replicas and retries must resolve the same operation. Expired worker claims and missing acknowledgements do not prove no dispatch occurred.
3. **Dispatch.** The existing authority owner supplies a bounded operation permit. The broker consumes it for the exact request at dispatch, ordered against lease closure and configuration invalidation. Closure before consumption denies; consumption first means an in-flight operation may finish. Cancellation cannot promise distributed rollback. Lost authority or invalidation connectivity denies new consumption.
4. **Record.** Before use/delivery, retain accepted material in protected durable custody and commit its inventory record, actual scope, and expiry. Late results after closure or rotation retain the original attempt and enter cleanup. Reconcile partial or uncertain persistence by exact operation identity.
5. **Use or release.** Validate the credential against the still-current original grant. Delivery intent requires a known durable outer commit before the first byte or release callback; returning from an uncommitted transaction is insufficient. Unknown commitment suppresses release until exact readback. Consume fresh use/delivery authority at the actual boundary. Cancellation between mint and release must not expose credentials to a later invocation.

Identical retries return or reconcile the original operation; different intent digests conflict. Provider profiles define safe retries after definitive no-effect evidence. `unknown`, timeout, new request IDs, or absent local read results never authorize reminting. Providers have no generic exactly-once guarantee.

Inventory must retain outstanding and uncertain obligations across restart and deletion. Conditional claims, protected custody, and audit persistence must define commit/readback behavior. Insufficient capacity, audit, or storage availability denies new effects; obligations cannot be evicted. Token values, keys, authorization headers, and handle secrets cannot enter ordinary resource records, logs, metrics, or audit payloads.

## Replacement, closure, and cleanup

Replacement issues a new credential under the same still-authorized lease without renewing it, revoking predecessors, or replaying failed business operations. Track every predecessor and successor; bound overlap per profile. Caches may reuse only exact permitted scope/binding/lease matches and cannot cache authority.

Lease closure, expiry, grant withdrawal, binding rotation, incarnation retirement, and explicit disable prevent new use/delivery and require cleanup of every affected issued or uncertain credential. Commit invalidation and a complete inventory-scan obligation together, including racing/late results. Resource deletion retains a tombstone, protected references, and cleanup responsibility.

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
