# GitHub access lifecycle and implementation detail

Supporting detail for [Scoped GitHub App access for Enterprise Agents](../0034-github-app-credentials.md), updated September 8, 2026. The main RFC is the concise decision document. Shared lifecycle rules apply to both modes; the origin/proxy requirements below apply only to mediated mode. Native is the first release profile and exposes a reusable scoped bearer. These proposed contracts do not establish production integration or container binding.

## Authority and identity

| Object | Meaning |
| --- | --- |
| Agent | Stable OCC resource and workload identity, potentially serving many conversations. |
| AgentRevision | Immutable installation identity, repository IDs, exact permissions, and checkout intent. Current policy may narrow or revoke this grant. |
| Workload incarnation | One concrete container execution, including Pod UID and an execution generation that changes on container restart. |
| Credential lease | One original invocation or separate preparation identity, incarnation, purpose, repository/profile grant, deadline, and authorization generation. Preparation and runtime use separate leases. |
| Original invocation | Exact original actor, attempt, grant, audience, purpose and deadline. A later turn cannot authorize an earlier process. |
| GitHub installation token | Upstream bearer held by the credential service and also delivered into native execution. In mediated mode it stays external. GitHub expiry is independent of lease expiry. |

Resolve installation bindings from authorized Namespace configuration. Snapshot the GitHub host, App, organization installation identity, repository IDs, and exact permission values. Binding edits, profile changes, and key rotation cannot silently retarget or expand an admitted revision. Validate repository identity again on rename or transfer. Deny missing repositories, wildcards, unknown profiles, and unsupported hosts.

Start with one repository per token and separate tokens for independently revocable leases. Key caches by host/App/installation, Namespace, Agent, revision, incarnation, exact lease and original invocation (or separate preparation identity), purpose, repository, permissions, and generation. Never satisfy a narrow grant with a broader cached token. GitHub's required read-only metadata permission is the only implicit baseline.

The coding profile is not inherently “draft PRs only”: `contents:write` also permits the [merge endpoint](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request). Use repository rules the App cannot bypass for branch/merge restrictions. These scope controls govern permitted operations; the separate transport binding prevents credential replay.

## What binds mediated access to the container

In mediated mode, the workload may hold a lease handle or audience-bound identity token, but neither authenticates the request's physical origin. Kubernetes validates the referenced Pod and ServiceAccount; a copied bearer can still be presented elsewhere while that Pod remains live. See [ServiceAccount authentication](https://kubernetes.io/docs/concepts/security/service-accounts/).

The selected backend must establish origin outside the workload's control. One candidate is a trusted host egress component that obtains the connection's exact sandbox identity from a protected host mapping and performs the request over an authenticated channel using a host-held key. It does not export reusable signed proofs to the container. The broker checks the authenticated origin against the lease. The worker must be unable to extract the key, forge the mapping, select another sandbox's identity, or reach an alternate credential endpoint. A shared host identity, same-Pod sidecar, or self-reported container ID is insufficient by itself.

This protects against copying container-visible credentials to an external host or another container. It assumes trusted host/control-plane/broker infrastructure and intact sandbox isolation; continued use of the original authorized container as a relay is a different attack from credential replay.

The broker authorizes the canonical host, repository, method, and supported operation before selecting an upstream token. Construct destinations from trusted enrollment data; strip caller authorization, cookies, and proxy headers. Reject redirects, ambiguous paths, host/target disagreement, and unsupported body semantics. Never return upstream tokens in APIs, errors, logs, or response headers. No workload-reachable raw-token route or arbitrary CONNECT fallback is allowed.

Start with HTTPS Git and a fixed REST command set. GraphQL requires reviewed operations or semantic validation; an endpoint allowlist cannot restrict its repository selection. LFS, submodules, uploads, and other origins remain unsupported until separately tested. Client proxy settings provide compatibility; enforced routing and independently verified workload origin provide the security boundary.

## Minting, refresh, and revocation

The credential service calls `POST /app/installations/{id}/access_tokens` with explicit repository and permission fields, using an App JWT signed outside workloads. GitHub limits App JWT expiry to no more than ten minutes into the future; installation tokens expire after one hour, with no custom TTL in the documented mint API. Validate returned permissions and expiry; unexpected scope fails closed and enters cleanup. Treat tokens as opaque, variable-length strings. See [JWT authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app) and [installation-token creation](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app).

Every issuance, refresh, and mediated proxy operation requires the current lease generation and current authorization for its exact original actor, attempt, common Agent/repository grant, audience, purpose and deadline. An A-owned process never adopts B authority. Preparation uses its separate lifecycle authority rather than a fabricated conversation turn. A cached token does not override these service checks. Fencing closes further service access; in native mode it cannot invalidate bearer bytes already delivered. Later authorization creates a fresh lease rather than reopening the old attempt.

Refresh creates another token. Track all outstanding tokens, limit overlap, and revoke superseded tokens when no longer needed. Serialize minting per lease and recheck its generation after mint completes, before using the result. If cancellation won the race, retain the returned token only for revocation.

Use `DELETE /installation/token` authenticated with each token to revoke it; `204` confirms success. Consequently, crash recovery needs protected token material until revocation or expiry. Store secret values in the selected protected backend, with opaque references, ownership, expiry, and cleanup state in ordinary OCC records. Hashes alone cannot perform this revocation. See [GitHub's revoke endpoint](https://docs.github.com/en/rest/apps/installations#revoke-an-installation-access-token).

Persist an issuance intent before sending the mint request, including original authority, installation, exact scope and operation. Store known token material and actual provider expiry durably before delivery/use. If the response or persistence outcome is lost, retain an `issuance-unknown` record with `expiry-unproven`; do not deliver, automatically remint or discard it after a guessed deadline. Client timeout plus one hour does not prove actual mint time or expiry. Keep the affected issuance scope blocked until provider-derived expiry, an evidenced mint-time bound, definitive no-issuance evidence or verified operator revocation resolves it. A future expiry is not terminal until it has elapsed. Unknown tokens may lack recoverable bytes for individual revocation. Retry known-token cleanup until confirmed or evidenced expiry; network failures are not success.

Operators own App enrollment, key rotation, and installation-wide suspension/uninstall. Key removal, local cache deletion, and container teardown do not establish that previously issued tokens were revoked.

## Lifecycle

| Event | Required behavior |
| --- | --- |
| Admit | Authorize the Agent and each installation/repository binding; snapshot the grant. Admission or gateway readiness alone does not mint tokens. |
| Prepare candidate | Verify containment; create a separate preparation incarnation with a bounded read-only lease. The candidate Harness remains inactive. |
| Finish/cancel preparation | Fence its lease, stop preparation, and revoke its tokens. Failure leaves the previous active revision intact. |
| Activate | Serialize activation; fence old runtime leases, stop and confirm old Harness termination, then activate the candidate and enable its route when ready. |
| End/start conversation turns | Close the ended attempt's issuance/forward authority even if the container remains active. Each new attempt receives fresh authorization; old processes cannot inherit it. Track native token copies until actual revoke/expiry. |
| Restart or replace container | Fence the old incarnation and revoke its tokens. Admit a fresh incarnation and lease; never inherit old authority through a reused Pod or volume. |
| Expire lease or deny renewal | Fence terminally, deny forwards, and queue all associated tokens for revocation. OCC reconciles or stops the workload. |
| Stop/delete Agent, retire revision, or remove access | Fence affected leases immediately; stop affected routing/workloads independently of upstream cleanup. Rollback uses fresh authorization and leases. |
| Installation or permission changes | Reconcile verified provider changes with current OCC policy and fence affected grants. A revision snapshot cannot override revocation. |

Compute cleanup and credential cleanup retry independently. Preserve a cleanup tombstone after workload deletion. Report “workload stopped; upstream revocation pending until recorded expiry” when appropriate. Fencing prevents new proxy operations; it cannot undo requests already accepted by GitHub.

## Repository preparation

Preparation is an OCC-owned provisioning operation for an admitted candidate, with its own identity and read-only grant. It does not activate that candidate or borrow the previous revision's runtime lease. This extends RFC 0027's candidate preparation sequence without introducing another user-facing execution resource.

Use a separate contained preparation Job. `ComputeDriver` supplies its exact incarnation and candidate-owned staging volume; `SandboxDriver` verifies the selected mode's containment before checkout. Native preparation receives an inventoried read-only ephemeral token; mediated preparation uses enforced broker routing and origin binding without receiving a GitHub token.

Clone/fetch the admitted repository and resolved commit into an empty staging directory. Preserve the active workspace and uncommitted user work. Persistent-volume handoff must be explicit; a backend without safe staging/promotion cannot claim rollout support. Run no repository hooks, setup scripts, submodules, or LFS during preparation.

Use fixed Git configuration, argument arrays, canonical HTTPS remotes, validated destination paths, and no inherited credential helpers. Reject traversal, symlink escapes, and redirects. Verify the resulting commit and repository identity, stop preparation, and fence its lease before starting the Harness. No integration-supplied credentials are written into the checkout; repository code and instructions remain untrusted input.

## Acceptance evidence and current implementation limits

1. **Provider behavior:** with a configured test App and disposable repositories, verify selected reads, denied unselected repositories/writes, refresh, and revoke-then-deny. Coding grants also require verified branch/merge rules. Simulated transport tests do not establish live GitHub behavior.
2. **Mediated copy resistance:** while workload A remains live, capture every integration-issued container-visible credential and replay it from an external host and container B, including B on A's host or in its Pod where supported. Require denial by GitHub and the broker while A's authorized request succeeds. Include copied ServiceAccount tokens, handles, and any client keys.
3. **Mediated boundary enforcement:** prove no upstream token reaches the workload, direct routes and tunnel fallbacks fail, alternate broker endpoints cannot return tokens, and forged identities, redirects, and ambiguous requests cannot escape the grant.
4. **Lifecycle:** verify preparation before Harness startup, safe workspace handoff, cancellation during mint/request execution, restart within a Pod, replacement, and deletion. Expire a lease while its container remains alive; require denied forwards, queued cleanup, and no reuse of the expired generation.
5. **Recovery:** restart the broker with outstanding tokens; recover cleanup, revoke refresh-overlap tokens, and distinguish unavailable GitHub cleanup from successful local fencing.

As of September 8, the inactive native client contribution implements helper/per-new-child delivery mechanics, explicit command/permission plans including `issues:read`, and immutable original-attempt handling. Its dependency-injected delivery port does not provide production authority or an issuer. The retained component run records 16 passed, zero failed and 15 native skips; all selected Git 2.55.0 / gh 2.93.0 cases remain unrun. The current harness needs an import guard, request-attempt accounting, setup cancellation/partial cleanup, overlapping-child and in-flight-expiry coverage, and documentation/formatting corrections.

Native acceptance still requires actual authority, protected inventory/revocation, private outside-grant negatives, upstream branch controls, preparation and selected-runtime evidence. The credential-facing preparation boundary is defined; concrete Job applicability, genuine producers and runtime qualification remain incomplete. Mediated acceptance adds items 2–3 above. Neither source presence nor a component test pass establishes a supported production mode. Native credential readability and fetched history remain explicit residual exposure.
