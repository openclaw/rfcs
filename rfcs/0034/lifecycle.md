# Credential Lifecycle: Recovery and Qualification

Draft recovery and acceptance plan for [RFC 0034](../0034-github-app-credentials.md).
The [broker specification](credential-broker-v1-spec.md) defines shared
requirements; the [GitHub specification](github-app-v1-spec.md) defines provider
and client behavior. This appendix describes how to test them.

## Production scope

Production requires the
[mediated Git/`gh` profile](github-app-v1-spec.md#mediated-operation-profile),
including original-work attribution for persistent processes, online OCC
authority for every dispatch, and trusted exact-candidate publication. Native
delivery is development/testing only.

Qualification covers trusted request attribution and the explicitly selected
operation/runtime profile. Attached-child support remains a separate scope
decision; active-session migration/replay is later work. Offline read continuity
is a future optional broker profile, excluded from the first GitHub release.
The [acceptance matrix](#acceptance-matrix)
identifies required tests; [release evidence](#acceptance-evidence-and-current-implementation-limits)
records their results.

## Authority and identity

The [broker contract](credential-broker-v1-spec.md) distinguishes these lifetimes:

| Term | Distinction tests must preserve |
| --- | --- |
| Logical work | Service-owned work can remain open after a turn or provider token ends. |
| Enforcement lease | Bounded authority has its own deadline; a valid provider token cannot extend it. |
| Broker access lease | Closure denies further access and retains cleanup obligations. |
| Provider token | Local denial is separate from confirmed provider revocation or evidenced expiry. |
| Execution process | A process can survive access closure. Replacement requires observed writer termination. |
| Issuer service | Restart requires durable recovery and fresh service authority. |

The [RFC series](../0027/runtime-access-overview.md) assigns ownership as follows:

| RFC | Responsibility |
| --- | --- |
| 0034 | Credential obligations |
| 0035 | Execution identity |
| 0036 | Original-work authority |
| 0037 | Runtime lifecycle |

Acceptance of those RFCs is separate from qualification of the combined
production path.

## What binds mediated access to the container

Test the [trusted mapping from each request to its container and original work](github-app-v1-spec.md#mediated-origin-and-routing).
A copied bearer, container-readable key, or claimed work ID must not substitute
for that mapping.

## Minting, refresh, and revocation

Exercise the [issuance protocol](credential-broker-v1-spec.md#durable-issuance-and-dispatch)
and [renewal policy](github-app-v1-spec.md#refresh-and-overlap). Track predecessor
tokens after replacement and report local access denial, provider revocation,
and evidenced expiry separately.

## Recovery cases

| Event | Required recovery |
| --- | --- |
| Broker fails before a committed provider claim | Reconcile the original reservation and claim. Dispatch only with authoritative proof that no earlier attempt could have reached the provider. |
| Mint response is lost after possible dispatch | Retain the original attempt as `unknown`; expiry remains unproven unless evidence establishes it. A fresh request or lease cannot bypass the hold. |
| Custody/inventory acknowledgement is lost after provider success | Read back the exact operation. Block delivery while persistence is uncertain; retain material for cleanup. Missing readback does not authorize reminting. |
| Cancellation or rotation occurs during issuance | Close old authority. Attach late results to their original binding and revoke them. |
| Refresh fails | Use an eligible recorded token only with valid original authority and all required checks, through current online authorization in the first GitHub profile. Unknown issuance or exhausted overlap blocks another mint. |
| Delivery response is lost | Record possible exposure and reconcile the same delivery. Retain cleanup obligations. |
| Issuer restarts | Recover durable state, obtain fresh service authority, and resume cleanup/readback without cached authorization. |
| Work/service authority is revoked or Agent/Namespace is deleted | Withdraw affected access under its selected bound. Retain tombstones and protected references so independent platform cleanup can continue. Requester invocation permission and service/workload access remain separate. |
| Revocation times out or a worker claim expires | Reconcile the pending/unknown attempt; timeout proves neither provider success nor failure. |
| Protected token material is unavailable | Report action-required. Recover custody or perform separately authorized broader mitigation; a hash cannot revoke the token. |

The [GitHub issuance hold](github-app-v1-spec.md#refresh-and-overlap) survives
replacement leases and broker restarts. A new connection or request ID does not
resolve uncertainty.

## Lifecycle

### Enrollment and preparation

| Event | Coordination |
| --- | --- |
| Verify enrollment | OCC authorizes exact references; issuer verifies provider identity and scope. Readiness does not mint. |
| Prepare candidate | Compute provides execution and staging; SandboxDriver verifies containment. OCC gates checkout on both and a separate read-only lease. |
| Finish/cancel preparation | Close access, observe preparation stopped, and retain cleanup. Failure preserves the serving workspace. |

### Active work and replacement

| Event | Coordination |
| --- | --- |
| Activate or replace | Close old assignment authority, observe previous writers stopped, and promote verified staging through Compute. Continuing logical work requires fresh current assignment authorization and new access leases; original scope and effect receipts remain fixed. |
| End a turn or logical work | A turn ending does not finish service-owned work. Logical-work closure closes its access leases; queued requests cannot borrow another work record through a mutable pointer. |
| Admit long-lived work | Require trusted admission, original scope and explicit finite-or-uncapped duration selection, and cancellation owner. Every configured horizon remains immutable; leases and operation bounds remain finite. Child admission and renewal tests apply only to a separately selected supported child profile. |
| Restart within a Pod | Change execution generation, close old leases, and reestablish origin. The same Pod UID or volume preserves no authority. Permission/context changes additionally require a fresh Pod/gVisor sandbox, eligible context, and observed old-writer termination. |

### Stopping and result delivery

| Event | Coordination |
| --- | --- |
| Stop with bounded drain | Close new work admission; retain only eligible original work until the recorded finite deadline. Recheck authority on each effect. Completion/deadline closes access; disable or retirement overrides draining. A restart cannot extend the deadline. |
| Disable/retire/delete | Stop new access and affected execution independently of cleanup. Retain outstanding records until terminal evidence. |
| Deliver a completed result | Graceful stop preserves only separately admitted finite delivery to its exact audience. Posting still requires current authority. Cancellation/security revoke withdraws delivery even while already stopped; an uncertain submission is never blindly replayed. |

## Repository preparation

For the [preparation contract](github-app-v1-spec.md#repository-preparation),
document:

- The actual workload and staging/promotion mechanism.
- Cancellation and proof that previous writers stopped.
- Rollback.

A "prepared" flag alone is insufficient.

## Timing targets and outages

### Withdrawal and cleanup bounds

Each selected profile must publish numerical withdrawal bounds and their clock,
observation, and enforcement assumptions. Ordinary eligible work may target
minutes; sensitive profiles may target seconds with lower outage availability.
These are tolerance scales, not fixed TTLs or measured guarantees.

| Measurement | Target and interpretation |
| --- | --- |
| Access withdrawal | Measure the selected end-to-end target, including authority observation, issue/revoke ordering, distribution, local enforcement, and clock uncertainty. A disconnected read holder stops by its original deadline; it cannot extend that deadline on reconnect. Record authority commit separately from observed holder withdrawal. |
| Workload termination | Observe affected writers stopped before replacement. A timeout blocks unsafe promotion and reports unresolved termination. |
| Upstream cleanup | Observe for up to 120 seconds, then report confirmed revoke, evidenced expiry, pending/unknown, or action-required. Durable cleanup continues after this window. |

### Timing evidence

Record each of the following, including clock uncertainty:

- Authenticated request acceptance, authoritative observation, and durable commit.
- Holder observation, operation admission, and provider dispatch.
- Last success, first denial, and observed termination.

Separate request-to-denial from commit-to-denial; failed or lost commits are not
successful samples. Tightening a profile cannot advertise its new bound until
outstanding older leases are accounted for.

### Authority outages

For the first GitHub profile, deny every dispatch without current online OCC
authority, including reads, issuance, and maintenance. An existing token or
unexpired lease cannot provide an offline fallback. Report already accepted
upstream effects separately, and retain cleanup obligations under their own
independent authority.

The shared broker's future read-continuity/maintenance profile requires separate
selection and O2 qualification. It cannot silently enable offline GitHub access.
Native development/testing copies remain usable until provider revoke/expiry,
including during OCE outages.

### Retries

Use bounded backoff only where retries are permitted, respecting
[`Retry-After` and reset responses](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#handle-rate-limit-errors-appropriately).
Outages retain cleanup obligations; network recovery authorizes neither
reminting nor replay of ambiguous writes.

## Implementation sequence

| Milestone | Required result |
| --- | --- |
| A. Authority and composition | Map OCC/IAM, work, enforcement, runtime, broker, and storage owners to the ports. Implement the selected original-work admission; select protected dispatch, online authority and numerical withdrawal bounds. Keep optional children/offline profiles separate. Demonstrate genuine authority and trusted request attribution; list unsupported runtime/profile combinations. |
| B. Durable broker | Implement reservations, claims, protected custody, delivery gates, closure, and deletion-safe cleanup. Inject failures at each commit/provider/delivery boundary across replicas and restart. |
| C. GitHub issuer | Verify enrollment, explicit and returned scope, expiry, overlap, and individual revoke with a disposable App installation. |
| D. Preparation and execution | Verify staging, containment, commit, stopped writers, restart generations, and safe activation/rollback. |
| E. Managed reads and publication | Verify real gVisor origin, split DNS, both TLS legs, no-bypass fencing, and pinned Git/REST reads. Then qualify exact-candidate approval and separate push/PR effects. Select GraphQL reads only where required. |
| F. Operator release | Test the complete selected profile against live GitHub. Measure denial/cleanup and outage reporting; provide artifact-linked evidence and enrollment, rotation, disable, and recovery guidance. |
| G. Later transparent writes | Qualify `git push` and `gh pr create` adapters against the same immutable candidate, approval, publisher and effect records; no raw write passthrough. |

Interfaces and synthetic fixtures may precede deployed dependencies. Native
checks remain development/testing evidence; neither replaces the authority,
provider, runtime, or mediated E/F release tests.

## Acceptance matrix

C1-C5, S1, P1, and O1 apply across providers using their expiry/cleanup rules.
O2 applies only to a future enabled read-continuity/maintenance profile and is
not a first GitHub gate. Child and completed-delivery tests apply only when those
features are admitted; rejecting unsupported combinations is required. G2 is
development/testing only. Production requires M1-M3 and the combined E1 test,
as well as the applicable shared, provider, publication, and preparation tests.

| ID | Required test |
| --- | --- |
| C1 | [Authority](#c1-authority) |
| C2 | [Issuance](#c2-issuance) |
| C3 | [Renewal](#c3-renewal) |
| C4 | [Cleanup](#c4-cleanup) |
| C5 | [Scope narrowing](#c5-scope-narrowing) |
| S1 | [Series integration](#s1-series-integration) |
| P1 | [Persistent work](#p1-persistent-work) |
| G1 | [Live provider](#g1-live-provider) |
| G2 | [Pinned native clients](#g2-pinned-native-clients) |
| G3 | [Public publication](#g3-public-publication) |
| G4 | [Exact-candidate publication](#g4-exact-candidate-publication) |
| R1 | [Preparation/runtime](#r1-preparationruntime) |
| M1 | [Copy resistance](#m1-copy-resistance) |
| M2 | [Boundary enforcement](#m2-boundary-enforcement) |
| M3 | [Protocol scope](#m3-protocol-scope) |
| O1 | [Operations](#o1-operations) |
| O2 | [Read continuity](#o2-read-continuity) |
| E1 | [Complete mediated profile](#e1-complete-mediated-profile) |

Each test below states its required evidence and outcomes.

### C1: Authority

- Deny forged/cross-Namespace references, stale revision/incarnation, closed
  leases, and wrong work; allow legitimate current work.
- Check requester invocation permission separately from service/workload
  permission.
- Give two grants with the same provider/profile distinct leases. Closing one
  grant preserves the other; closing logical work closes both. A turn ending
  alone does neither.
- Narrowing restricts issuance, delivery, and mediated use. Existing work cannot
  acquire a wider selection.

### C2: Issuance

- Concurrent/repeated requests and crashes retain one original claimed attempt.
- Lost provider/commit acknowledgements reconcile without untracked remint or
  premature delivery.
- GitHub profile/permission edits, rotation, rebinding, and replacement leases
  cannot bypass an unresolved target hold.

### C3: Renewal

- Cross provider expiry (one hour for GitHub) and model-turn boundaries while
  logical work remains open.
- Test both explicit uncapped work/execution and a configured finite horizon.
  All leases and operation bounds remain finite; renewal preserves each
  configured horizon and cannot turn missing policy into uncapped authority.
- Successors retain original authority, predecessors remain inventoried, and
  overlap stays bounded.
- Token replacement never extends enforcement/work deadlines; closed work
  cannot renew through later work.

### C4: Cleanup

- Cancel during mint/delivery. Test successful/failed key rotation and
  new-generation admission.
- Withdraw work/service authority, delete resources, lose a cleanup claim, and
  restart. Account for every known/uncertain token.
- Report local closure, effective distributed withdrawal, and provider outcomes
  separately.

### C5: Scope narrowing

- Narrow a live coding lease to views without changing its recorded ceiling.
  Deny immediately; serving changed permissions in the first GitHub profile
  requires fresh Pod/gVisor isolation and new assignment-bound leases.
- Deny writes and broader-token reuse; allow a supported narrower issuance/read
  only when authority, capacity, and holds permit.
- Retain the broader token's identity and cleanup obligation. All scopes count
  toward the same overlap budget until evidenced revoke/expiry.
- Policy recovery cannot revive cleanup-only credentials, closed work, or a
  wider original work selection.

### S1: Series integration

- Verify connector identity, represented assignment, original-work grant, and
  enforcement lease independently. Deny an allowed connector's claim for an
  unassigned execution.
- During stop, deny new work and enforce the original drain deadline.
- Fresh reassignment requires current authority and predecessor stop evidence;
  old access leases remain closed.
- Graceful stop preserves only separately admitted completed-result delivery;
  cancellation/security revoke withdraws it while already stopped.
- Correlate business receipts, credential attempts, and lifecycle operations
  without replaying uncertain effects.

### P1: Persistent work

- Keep a worker alive across A's closure and B's admission. Deny A's
  queued/retried requests; allow B without importing A's authority.
- Test concurrency, narrowing, cancellation, reconnect, and restart. Continue
  admitted work across turn completion.
- If attached children are enabled, renew a child with a stopped coordinator
  and expired parent execution lease while logical ancestors remain open; deny after ancestor
  cancellation.
- Enforce eligible shared state and private/additional-authority isolation
  independently of equal repository scope. Unsupported attribution or admission
  denies.

### G1: Live provider

Use disposable private repositories to verify that:

- Selected reads succeed; outside-grant repositories and disallowed writes fail.
- Actual returned scope matches, and revoke-then-deny is observed.
- Publication obeys exact approved ref/object constraints and expected-old
  updates; repository rules with no App bypass add defense in depth.

### G2: Pinned native clients

Run actual Git 2.55.0 and `gh` 2.93.0 processes against controlled endpoints with
synthetic ephemeral tokens. Verify:

- Helper/per-child delivery and denied/expired outcomes.
- Refresh overlap and original-attempt retention.
- No automatic replay of ambiguous writes.

### G3: Public publication

Use synthetic content for these checks:

- Allow an approved non-public write; deny public write grants even where the
  App has access.
- Deny wrong remotes, public mirror pushes, and public PR/API mutations.
- Actual visibility/ownership changes close affected access and retain cleanup.
- Unavailable visibility checks deny the affected write. Recovery requires fresh
  verification and still-open original authority, never reopening a closed
  lease.

The full guarantee also requires M2/M3 and visibility-change controls; native
scope checks provide partial protection.

### G4: Exact-candidate publication

- Missing approver policy or self-approval selection denies. Authenticate the
  configured approver against current policy and record the exact action digest.
- Reject changed objects, manifests, base/target refs, expected prior tips,
  repository identity or PR metadata after approval; capture and approve anew.
- Enforce exact ref allowlists, branch-creation permission, and atomic
  expected-old comparison at the actual update. A competing remote update must
  fail the approved push even after a successful preflight read.
- Reject force, deletion, tags, multi-ref updates, and raw mutation bypass.
- Claim and record push and PR effects separately. Require confirmed push before
  PR dispatch; retain partial success and unknown outcomes without replay after
  lost responses, cancellation, reconnect or restart.
- Compare the attributed PR response, including observed head/base OIDs, against
  the candidate. A mismatch stays unknown without erasing the confirmed push.

### R1: Preparation/runtime

- Verify checkout before Harness startup, the commit, and preserved user work.
- Verify cancellation, same-Pod restart, replacement, stopped previous writers,
  and deletion.
- Test both permission increases and decreases with a fresh Pod/gVisor sandbox;
  deny reuse of the old context and sibling-container substitution.
- Pin runtime/image artifacts.

### M1: Copy resistance

- While A succeeds, replay every integration-issued container-visible
  credential from an external host and B, including B on A's host/Pod where
  supported. GitHub and broker deny copies.
- A's closed work cannot borrow its successor's channel.

### M2: Boundary enforcement

- Keep upstream credentials outside execution.
- Deny raw-token endpoints, direct/tunnel fallback, and forged origin/turn
  assertions.
- Verify key custody and the runtime-owned local mapping.

### M3: Protocol scope

- Run selected Git/REST reads and any explicitly selected GraphQL reads with
  real pinned clients; test the trusted publication action independently.
- Deny direct Agent receive-pack and PR mutations in the first profile. Later
  transparent adapters require separate qualification against the same publisher.
- Deny redirects, ambiguous targets, cross-repository node IDs, extra GraphQL
  operations, malformed framing, and unlisted operations.
- Broader token permissions cannot authorize unlisted merges/mutations.
- Unsupported operations and provider denials cannot trigger wider tokens.

### O1: Operations

- Measure denial separately from termination/cleanup.
- With valid tokens and leases retained, make OCC unavailable and deny reads,
  writes, issuance and maintenance; recovery does not replay uncertain effects.
- Test lost authority, throttling, unavailable custody/storage, restart, and
  operator recovery; deny unsafe access and report actual outcomes.
- Authorized operators can find unresolved tombstones after deletion/restart
  and identify the evidence or action needed.

### O2: Read continuity

Future optional broker profile only; excluded from the first GitHub release.

- During authority outage, allow only qualified reads within the existing
  deadline; deny writes, new admission, renewal, and reassignment.
- Exercise expressly preauthorized read-only token replacement, missing
  maintenance permission, broader-token rejection, unknown-mint hold, full
  overlap, and unavailable inventory.
- Deny at the original deadline despite a newly minted token. Missing live
  approval/freshness evidence denies.
- Restart with uncertain clock/revocation state requires synchronization.
- Measure each selected withdrawal bound, including disconnected holders and
  tighter-profile transitions.

### E1: Complete mediated profile

1. Pin one implementation, configuration, runtime, and client manifest.
2. With a disposable live App/repository, enroll/admit through the actual
   authority, broker, issuer, and inventory.
3. Prepare/activate; run selected reads and Approve and publish through the
   trusted publisher; cross token replacement under the same original work.
   Observe separate push and draft-PR results and fail closed on OCC outage.
4. Close that work and observe denial while the process survives, plus separate
   provider cleanup. New work cannot revive old requests.
5. Separately observe required execution termination; restart and recover an
   outstanding obligation.

## Acceptance evidence and current implementation limits

This submission runs documentation checks only. Implementation submissions must
identify code, configuration, and mode and provide redacted evidence for
applicable tests. Record:

- Implementation commit and configuration/profile version.
- Tool/image pins and environment.
- Command/request manifest.
- Positive/negative outcomes and unresolved results.

Publish redacted evidence with synthetic identifiers; keep secrets and private
infrastructure details outside this repository.

Existing component results may be reused where behavior matches this contract;
they do not establish the full lifecycle or mediated origin guarantee.

## Upstream decision and implementation handoff

RFC approval covers the platform boundary, original-work integration, online
production mediation, and the selected managed-read/trusted-publication profile.
The broader broker contract records future read continuity and optional child
semantics without making them first-release dependencies.
Record the remaining decisions:

- Qualified runtime attachment, protected dispatch, and exact read command matrix.
- Configured approvers, self-approval behavior, exact allowed refs, and approval lifetime.
- Numerical withdrawal bounds and the initially supported helper/child subset.

Follow the repository's acceptance process: keep draft status until acceptance,
then create an implementation issue with milestone and evidence owners. RFC
acceptance does not qualify an implementation for production.
