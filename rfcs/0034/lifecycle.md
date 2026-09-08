# Credential Lifecycle: Recovery and Qualification

Implementation and review companion to [RFC 0034](../0034-github-app-credentials.md). Status: draft. The [broker specification](credential-broker-v1-spec.md) owns shared normative rules; the [GitHub specification](github-app-v1-spec.md) owns provider and client rules. This appendix maps those requirements to recovery, delivery milestones, and acceptance evidence. It does not report production qualification.

## Production scope

Production requires GitHub mediation and qualification of the selected ordinary Git/`gh` subset. Native delivery is development/testing only; model proxying remains separate. See [GitHub release selection](github-app-v1-spec.md#scope-and-proposed-release-selection) and the [mediated command profile](github-app-v1-spec.md#mediated-operation-profile). Persistent processes are a requirement; their work attribution and background admission require the design and evidence below.

## Authority and identity

The four lifetimes are the issuer service instance, original-invocation access lease, individual provider credential, and execution process. Their owners and closure semantics are defined in the [shared specification](credential-broker-v1-spec.md). Ending any one is not evidence that the others ended.

## What binds mediated access to the container

The [origin and routing contract](github-app-v1-spec.md#mediated-origin-and-routing) requires a protected host-to-execution mapping and original-invocation correspondence. It explicitly excludes relying on a copied bearer, a container-readable key, or a claimed turn ID. The transport choice remains a qualification dependency.

## Minting, refresh, and revocation

Use the [durable issuance protocol](credential-broker-v1-spec.md#durable-issuance-and-dispatch) and [GitHub renewal policy](github-app-v1-spec.md#refresh-and-overlap). Replacement creates another tracked token. Local closure prevents new authorized use; provider revoke or evidenced expiry determines when an escaped native token stops working.

## Recovery cases

| Event | Required recovery and truthful result |
| --- | --- |
| Broker fails before a committed provider claim | Reconcile the original reservation and claim. Dispatch only when authoritative evidence proves no earlier attempt could have crossed the boundary. |
| Mint response is lost or a timeout follows possible dispatch | Keep the original attempt `unknown`, with expiry unproven unless evidence establishes it. Do not remint under a fresh request/lease to evade the hold. |
| Provider succeeds but custody/inventory acknowledgement is lost | Read back the exact protected operation. No delivery while persistence is uncertain; retain available material for cleanup. A missing read result alone does not authorize minting again. |
| Cancellation/rotation occurs during issuance | Close old authority. Record late results against their original binding and revoke them; never attach them to the successor. |
| Refresh fails | An eligible recorded token may still be used under fresh original authority until expiry. Unknown minting or exhausted overlap blocks further issuance as required by the profile. |
| Delivery response is lost | Track possible exposure; reconcile the same delivery record. Do not report that the workload received nothing or discard the token's cleanup obligation. |
| Issuer process restarts | Reconstruct state from durable records, obtain fresh service authority, and resume exact cleanup/readback. Do not revive cached allow decisions. |
| User access is revoked or Agent/Namespace is deleted | Deny new access; retain tombstones and protected cleanup references. Independent platform cleanup authority continues after user/resource removal. |
| Revocation times out or a worker claim expires | Record pending/unknown state and reconcile that attempt. Worker timeout is neither provider failure nor provider success. |
| Protected token material is unavailable | Report action-required; recover custody or perform separately authorized broader mitigation. Do not claim a hash can revoke the token. |

Apply the [GitHub issuance hold](github-app-v1-spec.md#refresh-and-overlap) across replacement leases and broker restarts. A recovered connection or a new local request ID does not resolve an uncertain provider attempt.

## Lifecycle

| Event | Coordination |
| --- | --- |
| Admit and verify enrollment | OCC authorizes exact references; issuer verifies provider identity/scope; readiness alone does not mint. |
| Prepare candidate | Compute provides execution and staging; SandboxDriver verifies containment; OCC gates checkout on their observations and a separate read-only preparation lease. |
| Finish/cancel preparation | Close preparation access, observe preparation stopped, and retain cleanup. Failure leaves the serving workspace intact. |
| Activate or replace | Close old runtime authority, observe previous writers stopped, and promote verified staging through Compute's handoff. Candidate requests use fresh execution and invocation bindings. |
| End/start work in a persistent process | Close the ended invocation while the worker may remain alive. Bind each later effect to newly admitted work; old queued requests cannot inherit its authority. A mutable current-turn pointer is insufficient. |
| Admit background work | Define the trusted producer, exact original selection, horizon and cancellation owner before enabling it. Continuing past the initiating turn or session requires that explicit admission; surviving processes cannot create authority. |
| Restart within a Pod | Change the execution generation, close old leases, and reestablish origin. Reusing a Pod UID or volume does not preserve authority. |
| Disable/retire/delete | Stop new access and affected execution independently of provider cleanup. Keep outstanding records until terminal evidence. |

## Repository preparation

The [GitHub preparation contract](github-app-v1-spec.md#repository-preparation) owns checkout constraints. The runtime implementation must document its concrete preparation workload, staging/promotion mechanism, cancellation behavior, previous-writer proof, and rollback behavior. No generic “prepared” flag substitutes for those observations.

## Timing targets and outages

These are proposed qualification targets, not measured guarantees:

| Measurement | Target and interpretation |
| --- | --- |
| Local access denial | Within 60 seconds of accepting an authenticated disable request. Record durable closure and last admitted operation separately; closure permits no new operation-permit consumption. Earlier admitted in-flight requests may finish. |
| Workload termination | Observe affected writers stopped before replacement. A timeout reports unresolved termination and blocks unsafe promotion. |
| Upstream cleanup | Observe the initial cleanup episode for up to 120 seconds, then report confirmed revoke, evidenced expiry, pending/unknown, or action-required. The observation window does not terminate durable cleanup. |

Record authenticated request acceptance, durable state commit, operation admission, provider dispatch, last success, first denial, and observed process termination with clock uncertainty. Report request-to-denial separately from commit-to-denial. A lost or failed commit is not a successful sample.

Unknown current authorization, assignment, inventory commit, or invalidation-channel state denies new effects. Cancel affected mediated requests on authority loss; report already accepted provider operations honestly. Native copies remain usable until actual provider revoke/expiry even when OCE is unavailable.

Rate limiting and outages preserve cleanup obligations and use bounded backoff where the provider profile permits retry. Respect `Retry-After` and reset responses. Do not replay an ambiguous business write or treat a recovered network connection as permission to remint. [GitHub rate-limit guidance](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#handle-rate-limit-errors-appropriately)

## Implementation sequence

| Milestone | Deliverable and exit evidence |
| --- | --- |
| A. Authority and composition | Map existing OCC/IAM, invocation, runtime, SecretBroker and protected-storage owners to the new ports. Define the persistent-work dispatcher and any selected background-admission producer. Demonstrate current decisions and protected original-work correspondence; record unsupported runtime/profile combinations. |
| B. Durable broker | Implement reservations, claimed attempts, protected custody, delivery gates, closure, and deletion-safe cleanup. Exercise failures at every commit/provider/delivery boundary across replicas and restart. |
| C. GitHub issuer | Verify enrollment, explicit scope, returned scope/expiry, replacement overlap and individual revoke against a disposable App installation. |
| D. Preparation and execution | Qualify staging, containment, commit verification, old-writer termination, restart generations, and safe activation/rollback. |
| E. Mediated clients | Qualify origin binding, TLS/routing, and the exact pinned Git/REST/GraphQL request manifests, including persistent requesters. Native helper/child checks remain separate development/testing evidence. |
| F. Operator release | Qualify the complete mediated production composition against live GitHub; demonstrate denial/cleanup targets and outage reporting; supply enrollment/rotation/disable/recovery guidance and exact artifact-linked evidence. |

API definitions and synthetic fixtures can be developed before their dependencies are deployed. They cannot satisfy the later authority, provider, or runtime gates. Native fixtures may exercise shared mechanics, but cannot replace mediated E/F release evidence.

## Acceptance matrix

C1–C4, P1 and O1 cover shared behavior; substitute the selected provider's supported expiry/cleanup semantics. G1 is GitHub provider evidence, G2 is development/testing native-client evidence, G3 covers publication policy, and R1 applies to repository preparation. M1–M3 and E1 are mandatory for production; separately passing layers do not replace that combined proof.

| ID | Scope | Required evidence and outcome |
| --- | --- | --- |
| C1 | Authority | Forged/cross-Namespace references, stale revision/incarnation, closed leases, wrong original invocation and unavailable policy all deny. The legitimate current invocation succeeds as a positive control. Two grants with the same provider/permission profile get distinct leases; session/invocation narrowing denies broader broker issuance/delivery and mediated use. Old invocations cannot acquire newly added session grants. Closing one grant preserves the other's valid authority; closing the session/invocation closes both. |
| C2 | Issuance | Concurrent/repeated requests and crash injection establish one original claimed attempt. Lost provider/commit acknowledgements reconcile without untracked remint or premature delivery. For GitHub, profile/permission edits, rotation, rebinding, and replacement leases cannot bypass an unresolved provider-target hold. |
| C3 | Renewal | A session crosses provider credential expiry (one hour for GitHub); successors retain original authority, predecessors remain inventoried, overlap is bounded, and ended turns cannot renew through later turns. |
| C4 | Cleanup | Cancel during mint/delivery; verify successful and failed key rotation plus new-generation admission; revoke user access, delete resources, lose a cleanup claim, and restart the broker. Every known/uncertain token remains accounted for; local closure and provider outcome stay separate. |
| P1 | Persistent work | Keep a worker alive across A's closure and B's admission. A's queued/retried requests deny; B's independently authorized requests succeed without importing A's authority. Exercise concurrent work, narrowing, cancellation, reconnect and restart. For each enabled background mode, prove explicit admission, finite horizon, renewal/cancellation ownership and the declared session relationship; session-linked work closes with its session. Unsupported attribution or background admission denies. |
| G1 | Live provider | Disposable private repositories: selected reads succeed, outside-grant repositories and disallowed writes fail, actual returned scope matches, and revoke-then-deny is observed. Coding also verifies branch/merge rules with no App bypass. |
| G2 | Pinned native clients | Actual Git 2.55.0 and gh 2.93.0 processes against controlled endpoints with synthetic ephemeral tokens: helper/per-child delivery, denied/expired outcomes, refresh overlap, original-attempt retention, and no automatic replay of ambiguous writes. |
| G3 | Public publication | An approved non-public write succeeds; public write grants deny even for repositories accessible to the App. Wrong remotes, mirror pushes to public destinations, and public PR/API mutations deny. Visibility/ownership changes and unavailable checks close affected access and retain token cleanup. Use synthetic content only. Qualifying the full guarantee additionally requires M2/M3 and visibility-change controls; native scope checks alone are partial protection. |
| R1 | Preparation/runtime | Safe checkout before Harness startup, commit verification, preserved user work, cancellation, same-Pod restart, replacement, previous-writer termination, and deletion. Tie all evidence to pinned runtime/image artifacts. |
| M1 | Copy resistance | While A is live and succeeds, replay every integration-issued container-visible credential from an external host and B, including B on A's host/Pod where supported. GitHub and broker deny the copies. An old A invocation cannot borrow its successor's channel. |
| M2 | Boundary enforcement | Demonstrate no upstream credential reaches execution, no raw-token endpoint or direct/tunnel fallback works, and forged origin/turn assertions fail. Verify key custody and the runtime-owned local mapping. |
| M3 | Protocol scope | Real pinned clients exercise approved Git/REST/GraphQL requests. Redirects, ambiguous targets, cross-repository node IDs, extra GraphQL operations, malformed framing and unlisted operations deny. A coding token's broader provider permissions do not authorize an unlisted merge or mutation through the mediator. Unsupported operations and provider denials never trigger wider tokens. |
| O1 | Operations | Measured local-denial and separate termination/cleanup outcomes; lost authority, provider throttling, unavailable custody/storage, restart, and operator recovery remain truthful and fail closed. Authorized management can discover unresolved tombstoned obligations after deletion/restart and identify the evidence/action needed to resolve them. |
| E1 | Complete mediated profile | Using one pinned implementation/configuration/runtime/client manifest and a disposable live App/repository, enroll and admit an Agent through the actual authority, broker, issuer and inventory. Prepare/activate, run the selected Git/gh reads and coding workflow, and cross token replacement with a persistent requester under its original work. Close that work and observe denial while the process remains alive, with separate provider cleanup. Verify new work cannot revive the old request; separately observe required execution termination. Restart and recover an outstanding obligation. |

Each evidence bundle records implementation commit, configuration/profile version, tool and image pins, fixture or real-provider environment, command/request manifest, positive/negative outcomes, and unresolved results. Publish only redacted evidence with synthetic identifiers; retain secrets and private infrastructure details outside the RFC repository.

## Acceptance evidence and current implementation limits

This RFC submission runs documentation checks only. It claims no native-client, provider, recovery, or selected-runtime qualification. Future implementation submissions must identify their actual code, configuration, and mode, and publish appropriate redacted evidence for the applicable rows. Existing issuer caches, helpers, or component results may be reused only where their behavior matches this contract; they do not establish the shared lifecycle or mediated origin guarantee by themselves.

## Upstream decision and implementation handoff

Reviewers are asked to approve the platform boundary, required production mediation, and bounded Git/`gh` profile. Approval does not establish production qualification. Record the remaining persistent-work admission and protected-transport decisions explicitly. Follow the RFC repository's discussion and acceptance process; after acceptance, create the implementation issue and attach milestone/evidence ownership there. Keep draft status until the maintainers accept the proposal.
