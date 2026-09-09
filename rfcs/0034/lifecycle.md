# Credential Lifecycle: Recovery and Qualification

Draft recovery and acceptance plan for [RFC 0034](../0034-github-app-credentials.md). The [broker specification](credential-broker-v1-spec.md) defines shared requirements; the [GitHub specification](github-app-v1-spec.md) defines provider and client behavior. This appendix describes how to test them.

## Production scope

Production requires the [mediated Git/`gh` profile](github-app-v1-spec.md#mediated-operation-profile), including persistent processes. Native delivery is development/testing only. The tests below cover trusted request attribution and any enabled background-work modes.

## Authority and identity

The [broker contract](credential-broker-v1-spec.md) separates four lifetimes: issuer service, invocation lease, provider token, and execution process. Tests must distinguish their endings.

## What binds mediated access to the container

Test the [trusted mapping from each request to its container and original invocation](github-app-v1-spec.md#mediated-origin-and-routing). A copied bearer, container-readable key, or claimed turn ID must not substitute for that mapping.

## Minting, refresh, and revocation

Exercise the [issuance protocol](credential-broker-v1-spec.md#durable-issuance-and-dispatch) and [renewal policy](github-app-v1-spec.md#refresh-and-overlap). Track predecessors after replacement and distinguish local access denial from provider revocation or evidenced expiry.

## Recovery cases

| Event | Required recovery |
| --- | --- |
| Broker fails before a committed provider claim | Reconcile the original reservation and claim. Dispatch only with authoritative proof that no earlier attempt could have reached the provider. |
| Mint response is lost after possible dispatch | Retain the original attempt as `unknown`; expiry remains unproven unless evidence establishes it. A fresh request or lease cannot bypass the hold. |
| Custody/inventory acknowledgement is lost after provider success | Read back the exact operation. Block delivery while persistence is uncertain; retain material for cleanup. Missing readback does not authorize reminting. |
| Cancellation or rotation occurs during issuance | Close old authority. Attach late results to their original binding and revoke them. |
| Refresh fails | Use an eligible recorded token only under fresh original authority until expiry. Unknown issuance or exhausted overlap blocks another mint. |
| Delivery response is lost | Record possible exposure and reconcile the same delivery. Retain cleanup obligations. |
| Issuer restarts | Recover durable state, obtain fresh service authority, and resume cleanup/readback without cached authorization. |
| User access is revoked or Agent/Namespace is deleted | Deny new access. Retain tombstones and protected references so independent platform cleanup can continue. |
| Revocation times out or a worker claim expires | Reconcile the pending/unknown attempt; timeout proves neither provider success nor failure. |
| Protected token material is unavailable | Report action-required. Recover custody or perform separately authorized broader mitigation; a hash cannot revoke the token. |

The [GitHub issuance hold](github-app-v1-spec.md#refresh-and-overlap) survives replacement leases and broker restarts. A new connection or request ID does not resolve uncertainty.

## Lifecycle

| Event | Coordination |
| --- | --- |
| Verify enrollment | OCC authorizes exact references; issuer verifies provider identity and scope. Readiness does not mint. |
| Prepare candidate | Compute provides execution and staging; SandboxDriver verifies containment. OCC gates checkout on both and a separate read-only lease. |
| Finish/cancel preparation | Close access, observe preparation stopped, and retain cleanup. Failure preserves the serving workspace. |
| Activate or replace | Close old authority, observe previous writers stopped, and promote verified staging through Compute. Use fresh execution and invocation bindings. |
| End/start work in a persistent process | Close the ended invocation. A surviving worker's later requests need newly admitted work; queued requests cannot borrow it through a mutable current-turn pointer. |
| Admit background work | Require a trusted admission producer, original selection, horizon, and cancellation owner before work may outlive its turn or session. |
| Restart within a Pod | Change execution generation, close old leases, and reestablish origin. The same Pod UID or volume preserves no authority. |
| Disable/retire/delete | Stop new access and affected execution independently of cleanup. Retain outstanding records until terminal evidence. |

## Repository preparation

For the [preparation contract](github-app-v1-spec.md#repository-preparation), document the actual workload, staging/promotion mechanism, cancellation, proof that previous writers stopped, and rollback. A “prepared” flag alone is insufficient.

## Timing targets and outages

These are proposed qualification targets, not measured guarantees:

| Measurement | Target and interpretation |
| --- | --- |
| Local access denial | Within 60 seconds of accepting an authenticated disable request. Record durable closure and the last admitted operation separately. No new permits may be consumed after closure; earlier admitted requests may finish. |
| Workload termination | Observe affected writers stopped before replacement. A timeout blocks unsafe promotion and reports unresolved termination. |
| Upstream cleanup | Observe for up to 120 seconds, then report confirmed revoke, evidenced expiry, pending/unknown, or action-required. Durable cleanup continues after this window. |

Record authenticated request acceptance, durable commit, operation admission, provider dispatch, last success, first denial, and observed termination, including clock uncertainty. Separate request-to-denial from commit-to-denial; failed or lost commits are not successful samples.

Unknown authorization, assignment, inventory commit, or invalidation-channel state denies new effects. Cancel affected mediated requests on authority loss; report any operations already accepted upstream. Native copies remain usable until provider revoke/expiry, including during OCE outages.

Use bounded backoff only where retries are permitted, respecting [`Retry-After` and reset responses](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#handle-rate-limit-errors-appropriately). Outages retain cleanup obligations; network recovery authorizes neither reminting nor replay of ambiguous writes.

## Implementation sequence

| Milestone | Required result |
| --- | --- |
| A. Authority and composition | Map existing OCC/IAM, invocation, runtime, broker, and storage owners to the ports. Define persistent-work dispatch and any background admission. Demonstrate current decisions and trusted request attribution; list unsupported runtime/profile combinations. |
| B. Durable broker | Implement reservations, claims, protected custody, delivery gates, closure, and deletion-safe cleanup. Inject failures at each commit/provider/delivery boundary across replicas and restart. |
| C. GitHub issuer | Verify enrollment, explicit and returned scope, expiry, overlap, and individual revoke with a disposable App installation. |
| D. Preparation and execution | Verify staging, containment, commit, stopped writers, restart generations, and safe activation/rollback. |
| E. Mediated clients | Verify origin, TLS/routing, and exact pinned Git/REST/GraphQL requests, including persistent requesters. |
| F. Operator release | Test the full mediated system against live GitHub. Measure denial/cleanup and outage reporting; provide artifact-linked evidence and enrollment, rotation, disable, and recovery guidance. |

Interfaces and synthetic fixtures may precede deployed dependencies. Native checks remain development/testing evidence; neither replaces the authority, provider, runtime, or mediated E/F release tests.

## Acceptance matrix

C1–C4, P1, and O1 apply across providers using their expiry/cleanup rules. G2 is development/testing only. Production requires M1–M3 and the combined E1 test as well as the applicable shared, provider, publication, and preparation tests.

| ID | Scope | Required evidence and outcome |
| --- | --- | --- |
| C1 | Authority | Deny forged/cross-Namespace references, stale revision/incarnation, closed leases, wrong invocation, and unavailable policy; allow legitimate current work as a control. Give two grants with the same provider/profile distinct leases. Narrowing must restrict issuance, delivery, and mediated use. Old invocations cannot acquire new session grants. Closing one grant preserves the other; closing the session/invocation closes both. |
| C2 | Issuance | Concurrent/repeated requests and crashes retain one original claimed attempt. Lost provider/commit acknowledgements reconcile without untracked remint or premature delivery. GitHub profile/permission edits, rotation, rebinding, and replacement leases cannot bypass an unresolved target hold. |
| C3 | Renewal | Cross provider expiry (one hour for GitHub). Successors retain original authority, predecessors remain inventoried, overlap stays bounded, and ended turns cannot renew through later turns. |
| C4 | Cleanup | Cancel during mint/delivery; test successful/failed key rotation and new-generation admission; revoke user access, delete resources, lose a cleanup claim, and restart. Account for every known/uncertain token. Report local closure separately from provider outcomes. |
| P1 | Persistent work | Keep a worker alive across A's closure and B's admission. Deny A's queued/retried requests; allow B's independently authorized requests without importing A's authority. Test concurrency, narrowing, cancellation, reconnect, and restart. Each background mode needs explicit admission, finite horizon, renewal/cancellation ownership, and a defined session relationship; session-linked work closes with its session. Unsupported attribution or admission denies. |
| G1 | Live provider | Disposable private repositories: selected reads succeed, outside-grant repositories and disallowed writes fail, actual returned scope matches, and revoke-then-deny is observed. Coding also verifies branch/merge rules with no App bypass. |
| G2 | Pinned native clients | Actual Git 2.55.0 and gh 2.93.0 processes against controlled endpoints with synthetic ephemeral tokens: helper/per-child delivery, denied/expired outcomes, refresh overlap, original-attempt retention, and no automatic replay of ambiguous writes. |
| G3 | Public publication | Allow an approved non-public write; deny public write grants even where the App has access. Deny wrong remotes, public mirror pushes, and public PR/API mutations. Visibility/ownership changes and unavailable checks close access and retain cleanup. Use synthetic content. The full guarantee also requires M2/M3 and visibility-change controls; native scope checks provide partial protection. |
| R1 | Preparation/runtime | Verify checkout before Harness startup, commit, preserved user work, cancellation, same-Pod restart, replacement, stopped previous writers, and deletion. Pin runtime/image artifacts. |
| M1 | Copy resistance | While A succeeds, replay every integration-issued container-visible credential from an external host and B, including B on A's host/Pod where supported. GitHub and broker deny copies. A's old invocation cannot borrow its successor's channel. |
| M2 | Boundary enforcement | Keep upstream credentials outside execution. Deny raw-token endpoints, direct/tunnel fallback, and forged origin/turn assertions. Verify key custody and the runtime-owned local mapping. |
| M3 | Protocol scope | Run approved Git/REST/GraphQL requests with real pinned clients. Deny redirects, ambiguous targets, cross-repository node IDs, extra GraphQL operations, malformed framing, and unlisted operations. Broader token permissions cannot authorize unlisted merges/mutations. Unsupported operations and provider denials cannot trigger wider tokens. |
| O1 | Operations | Measure denial separately from termination/cleanup. Test lost authority, throttling, unavailable custody/storage, restart, and operator recovery; deny unsafe access and report actual outcomes. Authorized operators can find unresolved tombstones after deletion/restart and identify the evidence or action needed. |
| E1 | Complete mediated profile | Pin one implementation, configuration, runtime, and client manifest. With a disposable live App/repository, enroll/admit through the actual authority, broker, issuer, and inventory. Prepare/activate; run selected reads and coding; cross token replacement with a persistent requester under its original work. Close that work and observe denial while the process survives, plus separate provider cleanup. New work cannot revive old requests. Separately observe required execution termination; restart and recover an outstanding obligation. |

Record the implementation commit, configuration/profile version, tool/image pins, environment, command/request manifest, positive/negative outcomes, and unresolved results. Publish redacted evidence with synthetic identifiers; keep secrets and private infrastructure details outside this repository.

## Acceptance evidence and current implementation limits

This submission runs documentation checks only. Implementation submissions must identify code, configuration, and mode and provide redacted evidence for applicable rows. Existing component results may be reused where behavior matches this contract; they do not establish the full lifecycle or mediated origin guarantee.

## Upstream decision and implementation handoff

RFC approval covers the platform boundary, production mediation, and selected Git/`gh` profile. Record open persistent-work and transport decisions. Follow the repository's acceptance process; keep draft status until acceptance, then create an implementation issue with milestone and evidence owners. RFC acceptance does not qualify an implementation for production.
