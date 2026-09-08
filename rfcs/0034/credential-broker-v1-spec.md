# Credential Broker v1 Specification

This is the shared implementation contract for [RFC 0034](../0034-github-app-credentials.md). The [GitHub profile](github-app-v1-spec.md) supplies provider-specific behavior; [recovery and qualification](lifecycle.md) supplies failure scenarios and evidence requirements.

Status: draft. These are proposed contracts, not a claim that upstream OCE implements them. In this document, **must** identifies a conformance requirement.

## Scope and ownership

V1 manages credentials issued for admitted external access. It adds an internal issuer capability behind the existing Namespace-scoped `SecretBroker`; it adds no public Token, Lease, Issuer, or permission resource. Existing OCC identities, resource authorization, workload assignments, and invocation records remain authoritative.

OCC owns broker configuration and resource lifecycle. The broker coordinates authorization consumption, protected custody, inventory, delivery/use, and cleanup. The selected issuer performs provider operations. `SecretDriver` manages the selected secret backend; backend storage operations alone do not satisfy the custody and durable inventory requirements below. Account provisioning remains with `ServiceAccountDriver`.

OCC's trusted platform service composition hosts the broker, issuer, and protected-material client outside Agent execution. An eligible existing service may host them; the Namespace gateway retains its routing role and gains no credential authority by forwarding requests. The host connector described by the GitHub profile is another trusted component outside execution.

The issuer interface is local to that composition. Protected handles have no public constructor, serialization, or workload-facing byte accessor. A remote issuer requires a separately specified authenticated protocol; JSON versions of these handles are not authority. A logical broker resource does not imply one process per Agent or provider. Durable state survives process replacement and supports multiple service instances.

This contract does not force request signing or forwarding with existing credentials into a token-issuance API. Those capabilities may reuse authority and custody boundaries, but need their own operation contracts. V1 does not migrate existing model or ServiceAccount credentials.

## Configuration and admitted records

These are internal, versioned records, not new API routes. Identifiers use existing OCC codecs. References are resolved in trusted storage, never dereferenced as caller-supplied URLs. Reject unknown versions, authority-affecting fields, unsupported modes, and unbounded inputs before effects.

| Record | Required contents and owner |
| --- | --- |
| Issuer binding | OCC: Installation and Namespace, exact broker and Secret references, selected issuer implementation/profile versions, protected provider-account binding, configuration generation, and enabled state. No key or token bytes. |
| Admitted access | OCC: Agent/revision, binding/profile versions, provider-typed resource and permission grant, allowed mode, purpose, absolute access horizon, and limits. Current policy may narrow or revoke it. |
| Execution binding | Runtime authority: exact Agent/revision and concrete incarnation, including a generation that changes on restart. For runtime work, a protected correspondence to the original invocation and child/request channel is required. |
| Access lease | Broker: immutable original invocation or preparation identity, execution binding, admitted access digest, current generation/version, deadline, and `open` or `closed` state. |
| Issuance record | Inventory: stable operation and provider-attempt identities, intent digest, original lease/binding/generation, provider outcome, protected material references, actual expiry/scope evidence, delivery state, and cleanup state. |

An issuer-binding change cannot silently retarget an active revision. For planned key rotation, stage protected replacement material and verify the same provider account before atomically selecting its new generation and closing affected leases. Failed verification leaves the current binding unchanged and reports failure; an independently authorized emergency disable can close access immediately. Subsequent use requires newly admitted revisions and leases pinned to the verified generation. Retain issued-token/revocation material and cleanup records until obligations finish; source-key retirement is a separate operation and proves nothing about token revocation.

Operator-visible enrollment states are `unverified`, `ready`, `disabled`, and `degraded`, with bounded reason codes. `ready` requires verified provider binding, protected custody and inventory availability, and a supported issuer profile. It does not grant an Agent access or mint a token. Workload readiness and mode qualification are separate.

## Current authority and workload origin

For each issuance, delivery, and mediated operation, the broker must authenticate the actual caller and obtain a current decision from existing OCC/IAM and runtime authorities for:

- the exact Installation, Namespace, Agent, revision, broker, Secret, and protected provider binding;
- the current execution incarnation and original invocation, or separately admitted preparation purpose;
- the permitted resource/operation intersection, binding/profile versions, lease generation, and deadline;
- every applicable restriction and required audit decision.

The Agent uses its own explicitly granted `WorkloadIdentity` authority. Original-actor attribution and any additional invocation-policy checks may only narrow that authority; they do not transfer human roles, sessions, provider credentials, or permissions to the Agent. Missing mappings and unavailable current decisions deny access. Preparation cannot fabricate a conversation turn or use a runtime lease.

A handle, unexpired identity certificate, caller-supplied turn ID, or cached allow decision does not establish current authority. Container identity also does not prove invocation identity: processes from successive turns may share a container. The runtime must establish a protected per-invocation execution/channel binding, or isolate and stop prior execution before admitting the successor. If old code can borrow a later invocation's binding, that runtime/profile is unsupported. The issuer cannot supply this missing proof.

## Broker operations

The names below describe required local ports. Implementations may adapt existing methods without creating a parallel authority or inventory store.

| Operation | Required input | Result and behavior |
| --- | --- | --- |
| `beginAccess` | Authenticated admission context; original invocation/preparation reference; exact admitted profile and execution binding; stable request ID. | Resolve authoritative records, check current authority, commit a unique lease binding, return an opaque reference and deadline. Identical authorized repeats read the same record; conflicting intent denies. |
| `renewAccess` | Same original binding, lease reference, expected version, stable request ID. | Recheck authority and conditionally advance version/deadline within the original absolute horizon. Never change principal, purpose, resources, mode, or incarnation. A closed lease cannot reopen. |
| `acquireCredential` | Current authorized operation, open lease/version, exact provider-typed grant. | Select an eligible recorded credential or run the durable issuance protocol. Return a protected reference to the trusted delivery/forwarding owner only. |
| `deliverNative` | Current original authority, exact recorded credential and lease, immutable receiving child/channel, delivery ID. | Require admitted native mode; durably commit delivery intent before authorizing release on that exact channel. Return safe delivery status separately from provider issuance status. |
| `authorizeUse` | Current original authority, lease/version, validated provider operation and request digest. | Authorize one mediated dispatch; the trusted protocol adapter uses protected credentials. It cannot expose an arbitrary signing or forwarding endpoint. |
| `closeAccess` | Exact lease/version and authenticated lifecycle/cancel authority, cause, operation ID. | Commit terminal closure and cleanup obligations. Return local closure status; do not report provider revocation or execution termination by implication. |
| `readStatus` | Authorized reader and exact operation/lease reference. | Return safe state and evidence metadata. Readback cannot authorize another provider attempt. |
| `listOutstanding` | Existing management authority for the original ownership scope, binding/resource filter, bounded page size and snapshot cursor. | Enumerate unresolved records, including tombstones, without exposing protected material or requiring the deleted resource to exist. Read authority grants no cleanup effect. |

Current-authorization context is created by the accepting authority, not by parsing caller fields or trusting a type brand. Management, workload-use, read, and cleanup capabilities are distinct. Management status includes original ownership, safe operation IDs, blocked scope, cause, evidenced/unproven expiry, last/next cleanup attempt, and the authority/evidence needed to resolve a hold. Resource deletion cannot remove this management path or the remaining custody responsibility.

Each mutating call has a stable request/operation ID and immutable intent digest; updates also name an expected record version. Results use this closed family:

| Result | Meaning |
| --- | --- |
| `ok` | Known committed operation, resulting record version and method-specific safe result. Protected references go only to the authorized local consumer. |
| `denied` | Current authority or profile forbids this call; no new effect is admitted. Existing obligations from earlier calls remain. |
| `conflict` | Request ID reused with different intent, or a new update names a stale version; no new effect is admitted. |
| `unavailable` | A dependency is unavailable and evidence proves this call admitted no effect. |
| `indeterminate` | An identified provider, commit, or delivery phase may have acted. Return the original operation reference and safe known state; reconcile it instead of replaying. |

The unique lease key is `(Namespace, original invocation or preparation operation, incarnation, broker binding, profile)`. Look up an identical operation before applying a new expected-version comparison; a lost begin/renew response reads its known result under fresh authority. A changed immutable lease binding conflicts even with a new request ID for the same key; renewal may change only the permitted deadline/version. Readback returns a known version/state, `unresolved`, or `not-found`; `not-found` alone is not proof of no earlier effect. Listing uses a stable snapshot and records late obligations separately so concurrent cleanup cannot silently omit entries.

## Issuer interface

Each issuer exposes a fixed versioned profile and the following ports. The broker supplies already-authorized, bounded calls; the issuer never chooses a broader account or grant.

| Port | Contract |
| --- | --- |
| `capabilities` | Declares the provider-typed scope schema, fixed or requested lifetime semantics, individual/broader/unsupported revocation, observation support, and any evidenced idempotency behavior. A declaration is not qualification. |
| `issue` | Takes the recorded issuance/provider-attempt IDs and intent digest, exact binding/profile generation and admitted grant, protected material capability, current one-operation permit, deadline, and cancellation signal. |
| `revoke` | Takes the exact issued record and protected revocation capability, recorded cleanup claim/provider-attempt IDs, independently authorized cleanup responsibility, deadline, and cancellation signal. |
| `observe`, if supported | Reads the outcome of an exact earlier operation or credential under bounded read authority. It cannot repeat the original effect. |

`issue` returns one of:

- `issued`: protected credential/revocation references, returned scope, actual expiry or an explicitly supported expiry classification, and bounded provider evidence;
- `not-dispatched`: evidence that no request crossed the provider boundary;
- `rejected`: definitive evidence that the provider created no credential;
- `unknown`: the provider may have created a credential; retain available protected material and evidence without enabling use.

`revoke` returns `confirmed`, `pending`, `unknown`, or `failed`, with evidence and a safe reason. Unsupported revocation is declared before profile admission. `observe` returns evidence or an explicit unresolved result. Neither an abort nor an exception proves that the provider did nothing.

Successful provider output is not successful inventory persistence or successful delivery. The broker validates returned scope and expiry; unexpected output is retained for cleanup only. Providers that cannot meet the selected native exposure or mediated-use policy remain unavailable. Broader administrative revocation needs separately authorized scope; it is never an automatic fallback.

## Durable issuance and dispatch

1. **Reserve.** Check current authority, limits, and audit readiness. Commit an issuance intent bound to the original lease, exact scope, generation, and operation. No provider call precedes this commit.
2. **Claim.** Commit one provider-attempt claim under conditional version checks. Concurrent replicas and retries must resolve the same operation. An expired worker claim or missing acknowledgement does not prove no dispatch occurred.
3. **Dispatch.** The existing authority owner supplies a bounded operation permit. The accepting broker consumes it for the exact request at the dispatch boundary, ordered against lease closure and configuration invalidation. A close that wins before consumption denies the operation. A permit consumed first identifies an in-flight operation that may finish; cancellation cannot promise distributed rollback. Lost authority or invalidation connectivity denies new consumption.
4. **Record.** Retain accepted material in protected durable custody and commit its inventory record, actual scope and expiry before use/delivery. Late results after closure or rotation retain the original attempt and enter cleanup. Partial or uncertain persistence is reconciled by exact operation identity.
5. **Use or release.** Validate the recorded credential against the still-current original grant. Delivery intent must have a known durable outer commit before exposing the first byte or invoking a release callback. Returning from an uncommitted transaction is insufficient; unknown commitment suppresses release until exact readback. Then consume fresh use/delivery authority at the actual boundary. Cancellation between mint and release must not make the credential available to a later invocation.

Every effect has a stable operation ID and immutable intent digest. Identical retries return or reconcile that operation; a different digest conflicts. The provider profile defines any safe retry after definitive no-effect evidence. `unknown`, timeout, a new request ID, or an absent local read result never authorizes reminting. There is no generic exactly-once provider guarantee.

Inventory must retain outstanding and uncertain obligations across restart and deletion. Conditional claims, protected custody, and audit persistence must have defined commit/readback behavior. If capacity, audit, or storage availability is insufficient, deny new effects rather than evict obligations. No token values, keys, authorization headers, or handle secrets enter ordinary resource records, logs, metrics, or audit payloads.

## Replacement, closure, and cleanup

Credential replacement is a new issuance under the same still-authorized lease. It does not renew that lease, revoke the predecessor, or replay a failed business operation. Track every predecessor and successor and bound overlap per profile. A cache may only reuse an exact permitted scope/binding/lease; it never caches authority.

Lease closure, expiry, grant withdrawal, binding rotation, incarnation retirement, and explicit disable prevent new use/delivery and create cleanup work for every affected issued or uncertain credential. Commit invalidation and a complete inventory-scan obligation together so that racing/late results are included. Resource deletion retains a tombstone, protected references, and cleanup responsibility.

Cleanup uses separately authenticated platform lifecycle authority, sufficient only to reduce the exact recorded access. It survives revocation of the initiating human and cannot issue replacement credentials or perform user work. Each cleanup attempt is durably claimed and recorded; takeover resolves or safely accounts for a previous uncertain attempt before new dispatch. Claim timeout alone is not success.

Keep these status dimensions independent:

| Dimension | States |
| --- | --- |
| Authorization | `open`, `closed` with cause and commit time. |
| Issuance | `reserved`, `dispatched`, `issued`, `not-issued`, `unknown`. |
| Delivery/use | `not-started`, `admitted`, `completed`, `unknown`, or `denied`. |
| Cleanup | `not-required`, `pending`, `confirmed-revoked`, `confirmed-expired`, `unknown`, or `action-required`. |
| Execution | Supplied independently by Compute: stopping, observed stopped, or unresolved. |

Expiry is either evidenced with a timestamp and provenance or unproven. A future expiry is not a terminal outcome. Expiry completion requires the evidenced time to have elapsed with the selected clock uncertainty allowance. A guessed issue time plus nominal TTL is insufficient.

## Issuer service lifecycle

Trusted composition validates the fixed issuer profile and dependencies before serving. `quiesce` stops admitting local calls and cancels/drains bounded in-flight work while retaining their outcome records. `dispose` releases local clients and material handles; it does not mean provider tokens were revoked. Restart resumes from durable inventory under fresh service and cleanup authority, never by reviving in-memory permission decisions.

Shutdown reports local completion separately from retained cleanup obligations. An unavailable issuer or backend is an explicit degraded state; there is no fallback to another account, issuer, credential class, or access mode.

## Versioning and conformance

V1 profile identity includes the interface version and provider schema version. Reject unsupported authority-bearing fields and capability combinations. Backend, authority, and runtime replacements require conformance to the same lifecycle and evidence rules, not just compatible method signatures.

The applicable rows in [the acceptance matrix](lifecycle.md#acceptance-matrix) are required alongside this contract. The selected provider and access mode determine which provider, client, preparation, and mediation checks apply. A parser, mock capability, or component pass cannot establish real current authority, durable transactions, provider revocation, or origin binding.
