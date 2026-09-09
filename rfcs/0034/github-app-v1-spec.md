# GitHub App Access v1 Specification

Provider-specific contract for [RFC 0034](../0034-github-app-credentials.md), using [Credential Broker v1](credential-broker-v1-spec.md). Status: draft. **Must** identifies a conformance requirement. This spec describes target behavior; publication qualifies neither mode.

## Scope and proposed release selection

V1 targets organization-managed GitHub.com App installations, one repository per credential, HTTPS Git, and a bounded Git/`gh` workflow. Personal credentials, GitHub Enterprise hosts, SSH, LFS, submodules, arbitrary uploads, and unlisted operations are excluded.

Production requires GitHub mediation under [RFC 0027's credential boundary](../0027-openclaw-enterprise.md#secret-access). Native delivery is development/testing only, with no production fallback. The initial Git/`gh` subset includes the REST and GraphQL requests specified below; broader compatibility requires separate specification and qualification. The model-credential proxy does not establish GitHub mediation.

## Client versions

Git 2.55.0 and `gh` 2.93.0 are the proposed qualification pins for both modes. Evidence must pin binaries, image digests, configuration, and exact command variants. Another version needs its own compatibility evidence and cannot qualify these pins. [Git credential helper interface](https://git-scm.com/docs/gitcredentials), [gh environment](https://cli.github.com/manual/gh_help_environment)

## Enrollment and configuration

1. An Installation operator selects the issuer and trusted GitHub.com endpoints. The organization installs the App on explicit repositories within the supported permission profiles.
2. A Namespace administrator binds the exact App installation to its `SecretBroker`, referencing protected signing material through the selected backend. OCC verifies Namespace ownership and authorization for the broker, Secret, and integration binding. Public resources and revisions contain only references and metadata.
3. The issuer verifies App/installation identity, organization ownership, repository membership, and available permissions against GitHub. Unavailable checks report unverified or degraded enrollment. Configuration alone is not verification; enrollment neither mints a runtime token nor activates an Agent.
4. OCC admits one access record per repository grant for an Agent revision, recording the binding/profile versions, repository ID and canonical name, permission profile, mode, checkout commit, lease horizon, and configured limits. Revisions may reference several grants; authorize every referenced resource. Missing support or unresolved scope denies admission.

Provider data has this closed shape. Field names are illustrative; this is not a public REST API:

```ts
type GitHubAccessV1 = {
  schemaVersion: 1;
  issuerBindingRef: OccReference;
  issuerBindingGeneration: number;
  providerProfileVersion: 1;
  repositoryId: number;
  repositoryName: string; // verified owner/name; ID is authoritative
  permissionProfile: "checkout" | "views" | "coding";
  accessMode: "native" | "mediated";
  checkoutCommit: string; // resolved full object ID for the admitted repository
  accessHorizon: Timestamp;
};
```

`OccReference` and `Timestamp` use existing validated codecs. The binding resolves host, App ID, installation ID, organization identity, and protected key version. Workload requests cannot supply another host, account, key reference, permission map, or longer horizon. Unknown fields and malformed/cross-Namespace references deny.

Visibility changes, transfers, and enrollment changes require denial and revalidation of affected access. Display-name changes cannot silently redirect a grant. Configuration/profile edits require new admitted revisions; revocation can narrow active access immediately without redeployment. Planned key rotation follows the [shared sequence](credential-broker-v1-spec.md#configuration-and-admitted-records): verify the replacement against the same App/installation, select its generation and close old leases, then admit new revisions. Failed verification preserves the working binding.

## Session scope and multiple repositories

At session admission, OCC records the selected immutable repository grants, supported narrower profiles, and deadline. Existing IAM/admission authority validates the selection; chat requests, local remotes, and personal GitHub access confer no authority. Every invocation derives a separate lease for each selected repository it uses under the [shared authority rules](credential-broker-v1-spec.md#current-authority-and-workload-origin).

For example, `coding` on `org/service` and `views` on `org/library` allows pushes and PRs in `service`, and only reads in `library`. Changing both under `coding` grants creates two branches and two same-repository PRs. Each command selects one explicit grant and a token scoped to it; ambiguous selection denies. No session-wide token combines permissions. Report each PR's outcome independently and never blindly replay an uncertain write.

Push the prepared branch first, then create a draft PR with explicit repository, base, and head in that same repository. Do not let `gh` implicitly fork or push. Fork-to-upstream PRs are unsupported; they require separate head/base identity, grant, visibility, and compatibility validation. [gh PR creation](https://cli.github.com/manual/gh_pr_create)

Refresh and cleanup are independent per repository lease. Removing one grant preserves others unless shared authority changes; closing an invocation/session closes all its leases. The unknown-mint hold below applies across aliases for the same provider target. Native restrictions require enforcement by GitHub permissions and repository rules; narrower unsupported restrictions require mediation or denial. Delivered native tokens retain their scope until revoke or expiry.

## Preventing public publication

V1 must deny public GitHub writes, including to repositories accessible to the App. Write destinations must be explicitly approved repository IDs in the enrolled organization with verified `private` visibility, or `internal` where explicitly approved. This applies to all grants sharing an Agent's workspace and context. Public reads confer no write authority; public-repository coding is unsupported.

- **Admission and credentials:** OCC verifies ownership and visibility before admitting a write grant. The broker revalidates against GitHub before issuing or delivering a write-capable token and before every mediated write. Public, unknown, or unavailable visibility denies. Retain checked identity, visibility, and observation time; admission snapshots or delayed webhooks alone are insufficient.
- **Every write surface:** enforce the destination rule on HTTPS pushes and permitted REST/GraphQL mutations, including PR titles and bodies. Repository creation, forks, transfers, and visibility changes are unsupported; no administration permission is granted. Wrappers or a `github.com` allowlist alone cannot enforce this rule.
- **Changes:** ownership or visibility changes close affected leases and revoke outstanding tokens, requiring revalidation and fresh admission. Delivered native tokens remain governed by GitHub's permissions until actual revoke or expiry, regardless of the broker's latest visibility decision.
- **Enforcement:** the full guarantee requires the mediated checks and runtime boundary below, denying direct writes, alternate credentials, and tunnel bypass. Native scoped credentials and controlled clients only guard against accidental wrong destinations.

Visibility checks and writes are separate operations. Organization controls must prevent destinations becoming public while access or accepted writes remain outstanding; revalidation and webhooks cannot close that race. Trusted administrators' deliberate publication and other permitted output channels are outside the guarantee. Making a repository public exposes its existing contents. [Repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)

## Permissions and issuer behavior

| Profile | Exact requested permissions | Intended operations |
| --- | --- | --- |
| `checkout` | `contents:read` | Fetch the approved repository and commit. |
| `views` | `contents:read`, `issues:read`, `pull_requests:read` | Repository, issue, and PR reads. |
| `coding` | `contents:write`, `issues:read`, `pull_requests:write` | Prepared-branch push and same-repository draft PR creation, plus reads. |

All profiles include required `metadata:read`; workflow, administration, and secrets permissions are excluded. Coding tokens are not limited to drafts or particular branches: `contents:write` satisfies the PR-merge permission check even without `pull_requests:write`. GitHub repository rules with no App bypass must enforce branch/merge restrictions. [Merge permissions](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request)

The issuer signs an App JWT outside execution and calls `POST /app/installations/{id}/access_tokens` with one explicit `repository_ids` entry and the lease's exact effective permissions, validated as a supported subset of its admitted grant. A `coding` grant narrowed to `views` must mint `views` permissions. Never use installation-wide defaults; unavoidable metadata read is the sole implicit baseline. Validate returned repository scope, permissions, and actual expiry before eligibility. Incomplete scope evidence or unexpected scope retains the token for cleanup only. [Installation token creation](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)

App JWTs expire within ten minutes; installation tokens expire after one hour, with no documented custom TTL parameter. Tokens are opaque variable-length strings. Shorter OCE leases do not shorten provider validity; App key rotation does not revoke issued tokens. [App JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app), [installation token lifetime](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

Declare new-token issuance, provider-fixed lifetime, and individual revocation using protected token material, without assumed mint-idempotency or lost-token lookup. Revoke each known token with `DELETE /installation/token`; `204` confirms revocation. Retain protected material through cleanup: a hash cannot call this endpoint. Installation suspension/uninstall requires separate operator authorization and is never an automatic fallback. [Revocation](https://docs.github.com/en/rest/apps/installations#revoke-an-installation-access-token)

## Policy enforcement

Enforce the [same effective grant](credential-broker-v1-spec.md#one-effective-grant-two-enforcement-points) at minting and on every mediated request. GitHub's token API accepts repositories and permission categories, without general fields for branches, arbitrary paths, individual mutations, current visibility, OCE work, or originating containers. Naming a profile cannot encode those restrictions. [Token parameters](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)

| Constraint | Enforcement |
| --- | --- |
| Repository and permission category | Explicit mint scope and validation of each request against the effective grant. |
| Supported operation and parameters | Mediator validates actual Git/REST/GraphQL semantics, including same-repository targets and draft PR state. |
| Branch and merge restrictions | GitHub repository rules with no App bypass. V1 adds no proxy-side branch policy. |
| Approved non-public destination | Current ownership/visibility checks plus the organization controls required by the publication policy. |
| Work purpose, horizon, withdrawal | Current OCC/IAM decision and broker lease enforcement at dispatch. |
| Execution origin | Trusted runtime/host mapping and enforced routing; no workload-visible proof is sufficient by possession. |

The profile is a ceiling: use supported narrower profiles for read-only work, never arbitrary per-request permission combinations. Never reuse or refresh broader tokens for narrower work. Finer operation classes require a versioned profile and compatible lease/cache accounting. GitHub specifies endpoint permissions and calls for testing actual GraphQL queries and mutations. [Permission guidance](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)

Every operation added to the reviewed catalog must identify targets, provider permissions, request constraints, and outcome handling. Generic authenticated passthrough is unsupported. Unenforceable restrictions require denial or authorized admission of a narrower supported profile; permission errors never justify silently broader access.

Ordinary Contents permissions lack per-token arbitrary path scope. App-registration `single_file` permissions configure paths but are outside this profile and do not establish Git compatibility. GitHub push rules may add path restrictions after separate qualification. [App registration](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-using-url-parameters), [repository rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

## Refresh and overlap

Cache by exact binding/profile, Namespace/Agent/revision, incarnation, original lease/purpose, repository/effective permissions, and generation. Never substitute broader admitted scope or share tokens across independently revocable leases. Every use or delivery requires fresh authority.

Begin replacement when the recorded token has less than five minutes remaining, if its original lease remains open. Permit one active durable mint claim per lease and one original provider attempt per issuance. The two-credential overlap budget counts reservations, dispatched/unknown attempts, and provider-valid predecessors/successors. Only definite no-issuance, confirmed revocation, or evidenced expiry frees a slot; local cache retirement does not. Never evict unresolved records. Full capacity denies minting; admission and status must expose these limits.

After failed refresh, the broker may serve a recorded unexpired token only while original authority, exact scope, and delivery/use checks pass. Do not run autonomous refresh after lease closure. Respect provider throttling on permitted retries and the shared no-remint rule for uncertain issuance.

An unknown mint holds the stable provider target: OCE Installation, canonical GitHub host, App identity, GitHub installation ID, and repository ID. It blocks issuance across binding aliases, Namespaces, profiles/permission changes, key or binding generations, revisions, incarnations, leases, and modes. Retain original ownership and permission evidence; configuration changes or renewed admission cannot bypass the hold. OCC's trusted inventory enforces it without disclosing another Namespace's records, prioritizing complete accounting over availability.

Resolve the hold only with definite no-issuance evidence, evidence that expiry has elapsed, or verified sufficient administrative revocation. New request IDs and time since a timeout do not resolve it. Broader remedies require an identified scope and corresponding operator authorization. Other targets remain independent; never automatically switch accounts to bypass a hold.

Mediated dispatches can use eligible replacement tokens without restarting the requester. Dispatched operations may fail on expiry or revocation. Native mode supplies eligible tokens to new Git helper invocations and `gh` children; existing environments do not rotate. Neither mode automatically replays an ambiguous push, PR mutation, or other write.

## Native client contract

The Git helper and `gh` launcher use the broker's native delivery port with a protected, immutable original-invocation binding. Reject broader permissions, alternate credentials, unsupported remotes, or invocation substitution. Preparation helpers use a separate read-only identity.

- Git authenticates only canonical HTTPS GitHub remotes through the selected helper. Keep credentials out of remote URLs, command arguments, persistent configuration, and credential stores. Disable inherited helpers and unmanaged credential fallback in the controlled client path.
- Each new `gh` child receives `GH_TOKEN` in its environment only. Preserve arguments and exit/signal behavior; never update existing environments or a global current-turn token. Prevent inherited host/token configuration from selecting another credential or destination.
- Helper store/erase handling must not persist material. Diagnostics and failures use safe reason codes. Native workloads can read and publish their tokens, so these rules cannot keep tokens out of adversarial workload logs or artifacts.
- Denied, closed, expired, unsupported, or unavailable results fail credential acquisition. Never fall back to personal credentials, App keys, alternate installations, or a mediated-to-native downgrade.

## Mediated origin and routing

The proposed trusted host connector keeps its SPIFFE mTLS key outside Agent execution. It authenticates an exclusive runtime-owned local channel, resolves the actual container incarnation and original invocation through a protected mapping, and makes the broker request. The broker verifies its service identity and exact mapping; container-supplied identity headers are untrusted.

A shared host identity, socket pathname, Pod UID alone, same-Pod sidecar, or self-reported turn ID is insufficient. The mapping must change on container restart and distinguish sibling containers and each request's original work. Persistent workers require the [protected work-binding contract](credential-broker-v1-spec.md#persistent-processes-and-background-work); old queued requests cannot inherit successor authority. The dispatcher/channel remains a release blocker until demonstrated. SPIFFE identifies its authorized consumer and supplies private key material; an SVID key inside execution cannot establish copy resistance. [SPIFFE Workload API](https://spiffe.io/docs/latest/spiffe-specs/spiffe_workload_api/)

SandboxDriver enforces routing and denies bypass through token endpoints, alternate brokers, direct credentialed GitHub routes, or general tunnels. Proxy settings establish only compatibility. Workloads receive neither GitHub material nor reusable connector-issued origin proofs. Native delivery must be unreachable or reject all mediated leases, including copied handles.

The guarantee covers replay of container-visible integration credentials from another host/container while the original remains live. It assumes intact sandbox isolation and trusted host/control-plane/broker infrastructure; using the original authorized container as a relay is outside this guarantee.

Select and test either a GitHub-compatible service endpoint or managed TLS termination for ordinary GitHub destinations before qualification. Plain CONNECT cannot substitute credentials in encrypted HTTP; `GH_HOST` selects a GitHub host, not a generic proxy. Keep trust private to the selected runtime/client and validate upstream GitHub TLS independently. [HTTP CONNECT](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.6), [Git HTTP](https://git-scm.com/docs/http-protocol)

## Mediated operation profile

The proxy validates the full provider operation before choosing a token. Construct upstream URLs from trusted enrollment data; reject redirects, ambiguous encodings/paths, host disagreement, and unsupported body semantics. Strip caller cookies, proxy headers, and authorization before dispatch. The qualified client path may omit Authorization or send a fixed public, nonsecret placeholder required by the CLI; reject other credentials. Placeholders and lease handles cannot authenticate origin. Bound request/response size, execution time, and pagination in the selected profile. Tokens must not enter downstream responses, headers, errors, logs, or artifacts.

| Surface | Initial target and validation |
| --- | --- |
| HTTPS Git fetch | `info/refs` for `git-upload-pack` and `git-upload-pack` on the exact admitted repository. Validate service/method/path and supported protocol negotiation. Fetched history remains readable. |
| HTTPS Git push | `info/refs` for `git-receive-pack` and `git-receive-pack` for the exact repository under `coding`. Validate framing and repository/service targets. GitHub rules enforce ref and merge restrictions; V1 adds no proxy-side branch policy. |
| REST reads | Exact repository metadata, commit lookup, and bounded issue/PR list/view routes. Validate repository identity and route parameters, including pagination targets. |
| GraphQL | The repository/issue/PR read operations and explicit same-repository draft PR creation emitted by the qualified `gh` commands. Use reviewed documents with constrained variables or a semantic validator covering aliases, fragments, batching, node IDs, and mutation targets. |

A `/graphql` allowlist or operation name cannot check permissions. Resolve node IDs to admitted repositories; reject additional operations/targets and unsupported protocol extensions. Arbitrary REST mutations, raw `gh api` passthrough, implicit fork/push, and unvalidated `gh` commands are unsupported.

Target commands are clone/fetch, prepared-branch push, `gh repo view`, bounded `gh issue list/view`, `gh pr view`, explicit draft `gh pr create`, and the selected REST reads. Publish exact argument variants and observed request manifests for pinned clients. These are compatibility targets pending qualification. [Pinned gh repository queries](https://github.com/cli/cli/blob/f96972ce1c11fdb8eaa556257fde962a363dffde/api/queries_repo.go)

## Repository preparation

OCC authorizes a separate read-only preparation lease for the admitted candidate. Compute provides execution and an empty candidate-owned staging volume; SandboxDriver establishes and verifies admitted containment. OCC gates checkout and Harness startup on the required observations. Native preparation uses an inventoried token; mediation requires runtime-equivalent origin/routing guarantees.

Fetch the exact repository and resolved commit using fixed configuration and safe argument arrays. Disable repository hooks, setup scripts, submodules, and LFS. Reject redirects, traversal, symlink escapes, and inherited helpers. Verify the commit and repository identity, stop preparation, and close its lease before handoff. Neither credentials nor preparation authority enter the resulting checkout.

Preserve the active workspace and uncommitted changes. Compute owns the explicit staging/promotion protocol and must observe previous writers terminate before replacement. Backends without safe handoff are unsupported. Preparation failure preserves the serving revision; rollback requires fresh admission and leases, never revived tokens or execution generations.

## Acceptance

Production requires the shared broker, real provider scope/revocation evidence, safe preparation, persistent-work attribution, mediated origin replay negatives, and selected semantic protocol compatibility. Native helper evidence supports development/testing only. An issuer or helper alone cannot satisfy the [acceptance matrix](lifecycle.md#acceptance-matrix).
