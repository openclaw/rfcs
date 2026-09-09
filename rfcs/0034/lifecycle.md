# Credential Lifecycle: Recovery and Qualification

Draft recovery and acceptance plan for [RFC 0034](../0034-github-app-credentials.md). The [broker specification](credential-broker-v1-spec.md) defines shared requirements; the [GitHub specification](github-app-v1-spec.md) defines provider and client behavior. This appendix describes how to test them.

## Production scope

Production requires the [mediated Git/`gh` profile](github-app-v1-spec.md#mediated-operation-profile), including persistent processes and service-owned logical work. Native delivery is development/testing only. The tests below cover trusted request attribution, attached children, and any qualified read-continuity profile.

## Authority and identity

The [broker contract](credential-broker-v1-spec.md) separates logical work, bounded enforcement authority, broker access, provider tokens, execution processes, and issuer services. Tests must distinguish their endings: a turn or token can end while work remains open, and a valid provider token cannot extend an enforcement deadline.

The [RFC series](../0027/runtime-access-overview.md) assigns execution identity to 0035, original-work authority to 0036, runtime lifecycle to 0037, and credential obligations to 0034. Their acceptance is separate from qualification of the combined production path.

## What binds mediated access to the container

Test the [trusted mapping from each request to its container and original work](github-app-v1-spec.md#mediated-origin-and-routing). A copied bearer, container-readable key, or claimed work ID must not substitute for that mapping.

## Minting, refresh, and revocation

Exercise the [issuance protocol](credential-broker-v1-spec.md#durable-issuance-and-dispatch) and [renewal policy](github-app-v1-spec.md#refresh-and-overlap). Track predecessors after replacement and distinguish local access denial from provider revocation or evidenced expiry.

## Recovery cases

| Event | Required recovery |
| --- | --- |
| Broker fails before a committed provider claim | Reconcile the original reservation and claim. Dispatch only with authoritative proof that no earlier attempt could have reached the provider. |
| Mint response is lost after possible dispatch | Retain the original attempt as `unknown`; expiry remains unproven unless evidence establishes it. A fresh request or lease cannot bypass the hold. |
| Custody/inventory acknowledgement is lost after provider success | Read back the exact operation. Block delivery while persistence is uncertain; retain material for cleanup. Missing readback does not authorize reminting. |
| Cancellation or rotation occurs during issuance | Close old authority. Attach late results to their original binding and revoke them. |
| Refresh fails | Use an eligible recorded token only with valid original authority and all required checks, through current authorization or the qualified existing read lease. Unknown issuance or exhausted overlap blocks another mint. |
| Delivery response is lost | Record possible exposure and reconcile the same delivery. Retain cleanup obligations. |
| Issuer restarts | Recover durable state, obtain fresh service authority, and resume cleanup/readback without cached authorization. |
| Work/service authority is revoked or Agent/Namespace is deleted | Withdraw affected access under its selected bound. Retain tombstones and protected references so independent platform cleanup can continue. Requester invocation permission and service/workload access remain separate. |
| Revocation times out or a worker claim expires | Reconcile the pending/unknown attempt; timeout proves neither provider success nor failure. |
| Protected token material is unavailable | Report action-required. Recover custody or perform separately authorized broader mitigation; a hash cannot revoke the token. |

The [GitHub issuance hold](github-app-v1-spec.md#refresh-and-overlap) survives replacement leases and broker restarts. A new connection or request ID does not resolve uncertainty.

## Lifecycle

| Event | Coordination |
| --- | --- |
| Verify enrollment | OCC authorizes exact references; issuer verifies provider identity and scope. Readiness does not mint. |
| Prepare candidate | Compute provides execution and staging; SandboxDriver verifies containment. OCC gates checkout on both and a separate read-only lease. |
| Finish/cancel preparation | Close access, observe preparation stopped, and retain cleanup. Failure preserves the serving workspace. |
| Activate or replace | Close old assignment authority, observe previous writers stopped, and promote verified staging through Compute. Continuing logical work requires fresh current assignment authorization and new access leases; original scope and effect receipts remain fixed. |
| End a turn or logical work | A turn ending does not finish service-owned work. Logical-work closure closes its access leases; queued requests cannot borrow another work record through a mutable pointer. |
| Admit long-lived work or children | Require trusted admission, original scope/horizon, and cancellation owner. An attached child renews under current authority while logical ancestors remain open and authorized, without requiring a live coordinator. |
| Restart within a Pod | Change execution generation, close old leases, and reestablish origin. The same Pod UID or volume preserves no authority. |
| Stop with bounded drain | Close new work admission; retain only eligible original work until the recorded finite deadline. Recheck authority on each effect. Completion/deadline closes access; disable or retirement overrides draining. A restart cannot extend the deadline. |
| Disable/retire/delete | Stop new access and affected execution independently of cleanup. Retain outstanding records until terminal evidence. |
| Deliver a completed result | Graceful stop preserves only separately admitted finite delivery to its exact audience. Posting still requires current authority. Cancellation/security revoke withdraws delivery even while already stopped; an uncertain submission is never blindly replayed. |

## Repository preparation

For the [preparation contract](github-app-v1-spec.md#repository-preparation), document the actual workload, staging/promotion mechanism, cancellation, proof that previous writers stopped, and rollback. A “prepared” flag alone is insufficient.

## Timing targets and outages

Each selected profile must publish numerical withdrawal bounds and their clock, observation, and enforcement assumptions. Ordinary eligible work may target minutes; sensitive profiles may target seconds with lower outage availability. These are tolerance scales, not fixed TTLs or measured guarantees:

| Measurement | Target and interpretation |
| --- | --- |
| Access withdrawal | Measure the selected end-to-end target, including authority observation, issue/revoke ordering, distribution, local enforcement, and clock uncertainty. A disconnected read holder stops by its original deadline; it cannot extend that deadline on reconnect. Record authority commit separately from observed holder withdrawal. |
| Workload termination | Observe affected writers stopped before replacement. A timeout blocks unsafe promotion and reports unresolved termination. |
| Upstream cleanup | Observe for up to 120 seconds, then report confirmed revoke, evidenced expiry, pending/unknown, or action-required. Durable cleanup continues after this window. |

Record authenticated request acceptance, authoritative observation, durable commit, holder observation, operation admission, provider dispatch, last success, first denial, and observed termination, including clock uncertainty. Separate request-to-denial from commit-to-denial; failed or lost commits are not successful samples. Tightening a profile cannot advertise its new bound until outstanding older leases are accounted for.

During an authority outage, deny writes, new admission, renewal, expansion, and reassignment. Only qualified existing reads may continue under an unexpired enforcement lease with protected origin, trustworthy local revocation/clock state, and all mandatory dependencies. Read-only credential maintenance needs explicit preauthorization under that same lease and available custody/inventory/provider evidence; it cannot reuse a write-capable token or move an authority deadline. Missing any required check denies. Report already accepted upstream operations separately. Native copies remain usable until provider revoke/expiry, including during OCE outages.

Use bounded backoff only where retries are permitted, respecting [`Retry-After` and reset responses](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#handle-rate-limit-errors-appropriately). Outages retain cleanup obligations; network recovery authorizes neither reminting nor replay of ambiguous writes.

## Implementation sequence

| Milestone | Required result |
| --- | --- |
| A. Authority and composition | Map OCC/IAM, work, enforcement, runtime, broker, and storage owners to the ports. Implement service-owned work and child admission; select protected dispatch, read/maintenance profiles, and numerical withdrawal bounds. Demonstrate genuine authority and trusted request attribution; list unsupported runtime/profile combinations. |
| B. Durable broker | Implement reservations, claims, protected custody, delivery gates, closure, and deletion-safe cleanup. Inject failures at each commit/provider/delivery boundary across replicas and restart. |
| C. GitHub issuer | Verify enrollment, explicit and returned scope, expiry, overlap, and individual revoke with a disposable App installation. |
| D. Preparation and execution | Verify staging, containment, commit, stopped writers, restart generations, and safe activation/rollback. |
| E. Mediated clients | Verify origin, TLS/routing, and exact pinned Git/REST/GraphQL requests, including persistent requesters. |
| F. Operator release | Test the full mediated system against live GitHub. Measure denial/cleanup and outage reporting; provide artifact-linked evidence and enrollment, rotation, disable, and recovery guidance. |

Interfaces and synthetic fixtures may precede deployed dependencies. Native checks remain development/testing evidence; neither replaces the authority, provider, runtime, or mediated E/F release tests.

## Acceptance matrix

C1–C5, S1, P1, and O1 apply across providers using their expiry/cleanup rules. O2 applies to any enabled read-continuity or maintenance profile. G2 is development/testing only. Production requires M1–M3 and the combined E1 test as well as the applicable shared, provider, publication, and preparation tests.

| ID | Scope | Required evidence and outcome |
| --- | --- | --- |
| C1 | Authority | Deny forged/cross-Namespace references, stale revision/incarnation, closed leases, and wrong work; allow legitimate current work. Check requester invocation permission separately from service/workload permission. Give two grants with the same provider/profile distinct leases. Narrowing restricts issuance, delivery, and mediated use. Existing work cannot acquire a wider selection. Closing one grant preserves the other; closing logical work closes both. A turn ending alone does neither. |
| C2 | Issuance | Concurrent/repeated requests and crashes retain one original claimed attempt. Lost provider/commit acknowledgements reconcile without untracked remint or premature delivery. GitHub profile/permission edits, rotation, rebinding, and replacement leases cannot bypass an unresolved target hold. |
| C3 | Renewal | Cross provider expiry (one hour for GitHub) and model-turn boundaries while logical work remains open. Successors retain original authority, predecessors remain inventoried, and overlap stays bounded. Token replacement never extends enforcement/work deadlines; closed work cannot renew through later work. |
| C4 | Cleanup | Cancel during mint/delivery; test successful/failed key rotation and new-generation admission; withdraw work/service authority, delete resources, lose a cleanup claim, and restart. Account for every known/uncertain token. Report local closure, effective distributed withdrawal, and provider outcomes separately. |
| C5 | Scope narrowing | Narrow a live coding lease to views without changing its recorded ceiling. Deny writes and broader-token reuse; allow a supported narrower issuance/read only when authority, capacity and holds permit. Retain the broader token's identity and cleanup obligation. All scopes count toward the same overlap budget until evidenced revoke/expiry. Policy recovery cannot revive cleanup-only credentials, closed work, or a wider original work selection. |
| S1 | Series integration | Verify connector identity, represented assignment, original-work grant, and enforcement lease independently. Deny an allowed connector's claim for an unassigned execution. During stop, deny new work and enforce the original drain deadline. Fresh reassignment requires current authority and predecessor stop evidence; old access leases remain closed. Graceful stop preserves only separately admitted completed-result delivery; cancellation/security revoke withdraws it while already stopped. Correlate business receipts, credential attempts, and lifecycle operations without replaying uncertain effects. |
| P1 | Persistent work | Keep a worker alive across A's closure and B's admission. Deny A's queued/retried requests; allow B without importing A's authority. Test concurrency, narrowing, cancellation, reconnect, and restart. Continue admitted work across turn completion. Renew an attached child with a stopped coordinator and expired parent execution lease while logical ancestors remain open; deny after ancestor cancellation. Enforce eligible shared state and private/additional-authority isolation independently of equal repository scope. Unsupported attribution or admission denies. |
| G1 | Live provider | Disposable private repositories: selected reads succeed, outside-grant repositories and disallowed writes fail, actual returned scope matches, and revoke-then-deny is observed. Coding also verifies branch/merge rules with no App bypass. |
| G2 | Pinned native clients | Actual Git 2.55.0 and gh 2.93.0 processes against controlled endpoints with synthetic ephemeral tokens: helper/per-child delivery, denied/expired outcomes, refresh overlap, original-attempt retention, and no automatic replay of ambiguous writes. |
| G3 | Public publication | Allow an approved non-public write; deny public write grants even where the App has access. Deny wrong remotes, public mirror pushes, and public PR/API mutations. Actual visibility/ownership changes close affected access and retain cleanup. Unavailable visibility checks deny the affected write; recovery requires fresh verification and still-open original authority, never reopening a closed lease. Use synthetic content. The full guarantee also requires M2/M3 and visibility-change controls; native scope checks provide partial protection. |
| R1 | Preparation/runtime | Verify checkout before Harness startup, commit, preserved user work, cancellation, same-Pod restart, replacement, stopped previous writers, and deletion. Pin runtime/image artifacts. |
| M1 | Copy resistance | While A succeeds, replay every integration-issued container-visible credential from an external host and B, including B on A's host/Pod where supported. GitHub and broker deny copies. A's closed work cannot borrow its successor's channel. |
| M2 | Boundary enforcement | Keep upstream credentials outside execution. Deny raw-token endpoints, direct/tunnel fallback, and forged origin/turn assertions. Verify key custody and the runtime-owned local mapping. |
| M3 | Protocol scope | Run approved Git/REST/GraphQL requests with real pinned clients. Deny redirects, ambiguous targets, cross-repository node IDs, extra GraphQL operations, malformed framing, and unlisted operations. Broader token permissions cannot authorize unlisted merges/mutations. Unsupported operations and provider denials cannot trigger wider tokens. |
| O1 | Operations | Measure denial separately from termination/cleanup. Test lost authority, throttling, unavailable custody/storage, restart, and operator recovery; deny unsafe access and report actual outcomes. Authorized operators can find unresolved tombstones after deletion/restart and identify the evidence or action needed. |
| O2 | Read continuity | During authority outage, allow only qualified reads within the existing deadline; deny writes, new admission, renewal, and reassignment. Exercise expressly preauthorized read-only token replacement, missing maintenance permission, broader-token rejection, unknown-mint hold, full overlap, and unavailable inventory. Deny at the original deadline despite a newly minted token. Missing live approval/freshness evidence denies. Restart with uncertain clock/revocation state requires synchronization. Measure each selected withdrawal bound, including disconnected holders and tighter-profile transitions. |
| E1 | Complete mediated profile | Pin one implementation, configuration, runtime, and client manifest. With a disposable live App/repository, enroll/admit through the actual authority, broker, issuer, and inventory. Prepare/activate; run selected reads and coding; cross token replacement with a persistent requester under its original work. Close that work and observe denial while the process survives, plus separate provider cleanup. New work cannot revive old requests. Separately observe required execution termination; restart and recover an outstanding obligation. |

Record the implementation commit, configuration/profile version, tool/image pins, environment, command/request manifest, positive/negative outcomes, and unresolved results. Publish redacted evidence with synthetic identifiers; keep secrets and private infrastructure details outside this repository.

## Acceptance evidence and current implementation limits

This submission runs documentation checks only. Implementation submissions must identify code, configuration, and mode and provide redacted evidence for applicable rows. Existing component results may be reused where behavior matches this contract; they do not establish the full lifecycle or mediated origin guarantee.

## Upstream decision and implementation handoff

RFC approval covers the platform boundary, service-owned work integration, bounded read continuity, production mediation, and the selected Git/`gh` profile. Record remaining transport, read/maintenance profile, and numerical withdrawal decisions. Follow the repository's acceptance process; keep draft status until acceptance, then create an implementation issue with milestone and evidence owners. RFC acceptance does not qualify an implementation for production.
