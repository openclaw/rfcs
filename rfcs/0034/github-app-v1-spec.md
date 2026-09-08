# GitHub App Access v1 Specification

Provider-specific contract for [RFC 0034](../0034-github-app-credentials.md), using the [Credential Broker v1](credential-broker-v1-spec.md). Status: draft. **Must** identifies a conformance requirement. This document specifies target behavior; neither mode is qualified by publication of this spec.

## Scope and proposed release selection

V1 targets organization-managed GitHub.com App installations, one repository per credential, HTTPS Git, and a bounded Git/`gh` workflow. Personal credentials, GitHub Enterprise hosts, SSH, LFS, submodules, arbitrary uploads, and unlisted operations are excluded.

The current Crawl proposal uses native Git/`gh`; GitHub credential substitution is optional within Crawl. The required external model-credential proxy is a separate capability and does not implement Git smart HTTP, REST, or GraphQL. Upstream must decide whether production requires GitHub mediation or accepts the native-token exception to [RFC 0027](../0027-openclaw-enterprise.md#secret-access). Until that decision and mode qualification, neither is a supported production profile.

## Enrollment and configuration

1. An Installation operator selects the GitHub issuer implementation and trusted GitHub.com endpoints. The organization installs the App on explicitly selected repositories with no more than the supported permission profiles.
2. A Namespace administrator binds the exact App installation to its `SecretBroker`, referencing protected signing material through the selected backend. OCC verifies Namespace ownership and authorization for the broker, Secret, and integration binding. Public resources and revisions contain references and metadata only.
3. The issuer verifies App and installation identity, organization ownership, repository membership, and available permissions against GitHub. Report unverified or degraded enrollment on unavailable checks; configuration presence is not proof. Enrollment does not create a runtime token or activate an Agent.
4. OCC admits one access record per repository grant for an Agent revision, with the exact binding/profile versions, repository ID, canonical repository name, permission profile, mode, checkout commit, lease horizon, and configured limits. A revision may reference several such grants. Authorize every referenced resource. Missing support or unresolved scope denies admission.

Each admitted-access record contains provider data with this closed shape; field names are illustrative, not a new public REST API:

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

Repository visibility changes, transfers or enrollment changes require revalidation and denial of affected access. Display-name changes cannot silently redirect a grant. Configuration/profile edits create new admitted revisions; current revocation can narrow active access immediately without redeployment. Planned key rotation follows the [shared staged-verification sequence](credential-broker-v1-spec.md#configuration-and-admitted-records): verify the replacement against the same App/installation, select the new generation and close old leases, then admit new revisions. A bad replacement does not silently replace the working binding.

## Session scope and multiple repositories

At session admission, OCC records which immutable repository grants the session may use, with any supported narrower permission profiles and deadline. The existing IAM/admission authority validates this selection; a chat request, local remote or participant's personal GitHub access cannot grant it. Every invocation derives a separate lease for each selected repository it uses, under the [shared authority rules](credential-broker-v1-spec.md#current-authority-and-workload-origin).

For example, a session can select `coding` for `org/service` and `views` for `org/library`: it may push and open a PR in `service`, but only read `library`. If the task changes both repositories under `coding` grants, it creates two branches and two same-repository PRs. Each command resolves to one explicit repository grant and a token scoped to that grant; no session-wide token combines their permissions. Ambiguous grant selection denies. One PR succeeding does not imply the other succeeded; report outcomes independently and never blindly replay an uncertain write.

The supported PR compares a prepared branch with an explicit base branch in the same repository. Push first, then create the PR with explicit repository/base/head and draft state; do not let `gh` implicitly fork or push. A fork-to-upstream PR would require separately validated head/base identities, grants, visibility and provider compatibility; V1 does not support it. [gh PR creation](https://cli.github.com/manual/gh_pr_create)

Refresh and cleanup remain independent per repository lease. Removing one grant does not close another unless shared authority also changes; closing the invocation/session closes all its leases. The existing unknown-mint hold still applies across aliases for the same provider target. Native restrictions must be enforceable by the selected GitHub permissions and repository rules; unsupported narrower operation restrictions require mediation or denial. Previously delivered native tokens retain their provider scope until revoke or expiry.

## Preventing public publication

V1 must deny writes to public GitHub repositories, even when the App installation can access them. Write destinations must be explicitly approved repository IDs in the enrolled organization with verified non-public visibility (`private`, or `internal` where explicitly approved). This policy applies to all grants sharing an Agent's workspace and context. Public repository reads do not authorize writes; public-repository coding is outside this profile.

- **Admission and credentials:** OCC verifies destination ownership and visibility before admitting a write grant. The broker revalidates against GitHub before issuing or delivering a write-capable token and before every mediated write. Public, unknown or unavailable visibility denies. Retain the checked identity, visibility and observation time as evidence; an admission snapshot or delayed webhook alone is insufficient.
- **Every write surface:** apply the same destination rule to HTTPS Git pushes and all permitted REST/GraphQL mutations, including PR titles and bodies. Repository creation, forks, transfers and visibility changes remain unsupported; no administration permission is granted. A command wrapper or a `github.com` host allowlist alone cannot enforce this rule.
- **Changes:** when visibility or ownership changes, close affected leases and revoke outstanding tokens; require revalidation and fresh admission. An already-delivered native token remains governed by GitHub's permissions until actual revoke or expiry. It is not restricted by the broker's latest visibility decision.
- **Enforcement:** the full publication guarantee requires the mediated operation checks and runtime boundary below, including denial of direct writes, alternate credentials and tunnel bypass. Native mode provides an accidental wrong-destination guardrail through its scoped credential and controlled clients; it does not qualify this stronger guarantee.

GitHub visibility checks and writes are separate operations. For the full guarantee, organization controls must prevent write destinations becoming public while access or accepted writes remain outstanding. Revalidation and webhooks alone do not close that race. Deliberate publication by a trusted administrator, and disclosure through other permitted output channels, are outside this guarantee. GitHub exposes existing repository contents when a repository becomes public. [Repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)

## Permissions and issuer behavior

| Profile | Exact requested permissions | Intended operations |
| --- | --- | --- |
| `checkout` | `contents:read` | Fetch the approved repository and commit. |
| `views` | `contents:read`, `issues:read`, `pull_requests:read` | Repository, issue, and PR reads. |
| `coding` | `contents:write`, `issues:read`, `pull_requests:write` | Prepared-branch push and same-repository draft PR creation, plus reads. |

All profiles include GitHub's required `metadata:read`. Do not request workflow, administration, or secrets permissions. A coding token is not inherently restricted to draft PRs or particular branches: native use can exercise all operations GitHub grants those permissions. GitHub repository rules that the App cannot bypass must enforce branch/merge restrictions. [Merge permissions](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request)

The issuer signs an App JWT outside execution and calls `POST /app/installations/{id}/access_tokens` with exactly one explicit `repository_ids` entry and the exact permissions of the lease's effective profile, validated as a supported subset of its admitted grant. A `coding` grant narrowed to `views` must mint `views` permissions. It never relies on installation-wide defaults. Validate the returned repository selection and permissions against that effective scope, and verify actual expiry before eligibility; incomplete scope evidence or unexpected scope retains the token for cleanup only. Extra unavoidable metadata read is the sole implicit baseline. [Installation token creation](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)

App JWTs have a maximum documented expiry of ten minutes. Installation tokens expire after one hour; the documented API has no custom TTL parameter. Treat tokens as opaque variable-length strings. A shorter OCE lease does not shorten provider validity, and App key rotation does not itself revoke previously issued tokens. [App JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app), [installation token lifetime](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

Declare the profile as new-token issuance, provider-fixed lifetime, individual revocation using protected token material, and no assumed mint-idempotency or lost-token lookup. Revoke each known token using `DELETE /installation/token`; `204` confirms revocation. A token hash alone cannot call this endpoint. Retain protected material through cleanup. Installation suspension/uninstall is a separately authorized operator action, never an automatic broad fallback. [Revocation](https://docs.github.com/en/rest/apps/installations#revoke-an-installation-access-token)

## Refresh and overlap

Cache only an exact binding/profile, Namespace/Agent/revision, incarnation, original lease/purpose, repository/effective permission set, and generation. Never substitute a broader admitted profile for the lease's narrowed scope. Do not share a token across independently revocable leases. Every use or delivery still requires fresh authority.

The initial profile begins replacement when the recorded token has less than five minutes remaining, if its original lease remains open. Permit one active durable mint claim per lease and one original provider attempt per issuance. The overlap budget is two outstanding or potentially issued credentials, counting reservations, dispatched/unknown attempts, and provider-valid predecessor/successor tokens. Local cache retirement does not free a slot: only definite no-issuance, confirmed revocation, or evidenced expiry does. Retain unresolved records without eviction; full capacity denies another mint. Admission and status must expose these availability limits.

The broker may serve an already-recorded, unexpired token during a failed refresh only while its original authority, exact scope, and delivery/use checks still pass. It must not run an autonomous refresh loop after lease closure. Respect provider throttling on permitted retries; uncertain issuance follows the shared no-remint rule.

An unknown GitHub mint creates a hold on the stable provider target: OCE Installation, canonical GitHub host, App identity, GitHub installation ID, and repository ID. For one-repository V1, it blocks new issuance for that target across local binding aliases, Namespaces, profiles/permission changes, key or binding generations, revisions, incarnations, leases, and modes. Keep original ownership and permission evidence on the record; changed configuration or renewed admission does not bypass the hold. OCC's trusted inventory enforces this shared-target restriction without disclosing another Namespace's records. This deliberately trades availability for complete accounting of potentially issued credentials.

The hold remains until definite no-issuance evidence, an evidenced expiry that has elapsed, or verified sufficient administrative revocation resolves it. Neither a new request ID nor time elapsed since a client timeout resolves the hold. A broader remedy must identify its affected scope and receive the corresponding operator authorization. Other provider targets are independent, but the broker must not automatically switch accounts to bypass a hold.

New Git helper invocations and `gh` children receive an eligible token. Existing child environments do not rotate. Running commands may fail on expiry or revocation; renewal does not automatically rerun an ambiguous push, PR mutation, or other write.

## Native client contract

The Git helper and `gh` launcher consume the broker's native delivery port with a protected, immutable original-invocation binding. Reject caller attempts to supply broader permissions, alternate credentials, unsupported remotes, or another invocation. A preparation helper has its separate read-only identity.

- Git authenticates only canonical HTTPS GitHub remotes through the selected helper. Do not put integration credentials in remote URLs, command arguments, persistent Git configuration, or credential stores. Disable inherited helpers and unmanaged credential fallback in the controlled client path.
- Each new `gh` process receives `GH_TOKEN` through its environment for that child only. Preserve original command arguments and exit/signal behavior; do not modify an already-running process's environment or a global current-turn token. Prevent inherited host/token configuration from selecting another credential or destination.
- Helper store/erase handling must not persist material; diagnostics and failures use safe reason codes. Native code can read its token and write it anywhere, so these handling rules do not promise that an adversarial workload will keep tokens out of its own logs or artifacts.
- A denied, closed, expired, unsupported, or unavailable result fails the command's credential acquisition. There is no fallback to a personal credential, App key, alternate installation, or mediated-to-native downgrade.

Git 2.55.0 and `gh` 2.93.0 are the proposed qualification pins. Pin binaries, image digests, configuration, and exact command variants in implementation evidence. Supporting another version requires its own compatibility evidence; a system binary with a different version does not qualify these pins. [Git credential helper interface](https://git-scm.com/docs/gitcredentials), [gh environment](https://cli.github.com/manual/gh_help_environment)

## Mediated origin and routing

The proposed transport uses a trusted host connector whose SPIFFE mTLS key remains outside Agent execution. It authenticates an exclusive runtime-owned local channel, resolves the actual container incarnation and original invocation through a protected mapping, and makes the broker request itself. The broker verifies the connector's service identity and exact mapping; it does not trust container-supplied identity headers.

A shared host identity, socket pathname, Pod UID alone, same-Pod sidecar, or self-reported turn ID is insufficient. The mapping must change on container restart and distinguish sibling containers and successive invocations. An old process must not obtain or use a successor's channel. This is a required runtime capability and a release blocker until demonstrated, not a property provided by naming SPIFFE. The SPIFFE Workload API gives private key material to its authorized consumer; therefore an SVID key delivered inside execution cannot establish the required copy resistance. [SPIFFE Workload API](https://spiffe.io/docs/latest/spiffe-specs/spiffe_workload_api/)

The SandboxDriver enforces the route and denies bypass to token endpoints, alternate brokers, direct credentialed GitHub routes, and general tunnels. Client proxy settings establish compatibility only. The workload receives neither GitHub material nor reusable origin proofs minted by the connector. A native delivery endpoint must be unreachable or refuse all mediated leases, including requests with copied handles.

The guarantee covers replay of container-visible integration credentials from another host/container while the original remains live. It assumes intact sandbox isolation and trusted host/control-plane/broker infrastructure. An attacker continuing to use the original authorized container as a relay is outside the copied-credential guarantee.

Client routing may use a GitHub-compatible service endpoint or managed TLS termination for ordinary GitHub destinations. The implementation must select and test one before qualification. A plain CONNECT tunnel cannot substitute credentials in encrypted HTTP, and `GH_HOST` is a GitHub host setting rather than a generic proxy URL. Keep trust private to the selected runtime/client and validate upstream GitHub TLS independently. [HTTP CONNECT](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.6), [Git HTTP](https://git-scm.com/docs/http-protocol)

## Mediated operation profile

The proxy validates the full provider operation before choosing a token. Construct upstream URLs from trusted enrollment data; reject redirects, ambiguous encodings/paths, host disagreement, and unsupported body semantics. Strip caller cookies, proxy headers, and authorization before upstream dispatch. The qualified client path may send no Authorization header or a fixed public, nonsecret placeholder required by the CLI; reject other credential values. Neither the placeholder nor a lease handle authenticates origin. Bound request/response size, execution time, and pagination in the selected profile. Tokens must not appear in downstream responses, headers, errors, logs, or artifacts.

| Surface | Initial target and validation |
| --- | --- |
| HTTPS Git fetch | `info/refs` for `git-upload-pack` and `git-upload-pack` on the exact admitted repository. Validate service/method/path and supported protocol negotiation. Fetched history remains readable. |
| HTTPS Git push | `info/refs` for `git-receive-pack` and `git-receive-pack` for the exact repository under `coding`. Validate protocol framing and repository/service targets. V1 imposes no additional proxy-side branch policy; GitHub repository rules enforce ref and merge restrictions. |
| REST reads | Exact repository metadata, commit lookup, and bounded issue/PR list/view routes. Validate repository identity and route parameters, including pagination targets. |
| GraphQL | The repository/issue/PR read operations and explicit same-repository draft PR creation emitted by the qualified `gh` commands. Use reviewed documents with constrained variables or a semantic validator covering aliases, fragments, batching, node IDs, and mutation targets. |

A `/graphql` endpoint allowlist or operation name is not a permission check. Resolve node IDs to admitted repository identities and reject queries with additional operations or targets. Reject unsupported protocol extensions rather than forwarding unknown request bodies. No arbitrary REST mutations, raw `gh api` passthrough, implicit fork/push, or unvalidated `gh` command is included.

The target commands are clone/fetch, prepared-branch push, `gh repo view`, bounded `gh issue list/view`, `gh pr view`, explicit draft `gh pr create`, and the selected REST reads. The implementation must publish exact argument variants and observed request manifests for the pinned clients. This list is a compatibility target, not a passing matrix. [Pinned gh repository queries](https://github.com/cli/cli/blob/f96972ce1c11fdb8eaa556257fde962a363dffde/api/queries_repo.go)

## Repository preparation

OCC authorizes a separate read-only preparation lease for the admitted candidate. Compute provides preparation execution and an empty candidate-owned staging volume; the selected SandboxDriver establishes and verifies its admitted containment. OCC gates checkout and Harness startup on the required observations. Native preparation uses an inventoried token; mediated preparation requires the same origin/routing guarantees as runtime access.

Fetch the exact repository and resolved commit using fixed configuration and safe argument arrays. Disable repository hooks, setup scripts, submodules, and LFS. Reject redirects, traversal, symlink escapes, and inherited helpers. Verify the commit and repository identity, stop preparation, and close its lease before handoff. Neither credentials nor preparation authority enter the resulting checkout.

Preserve the active workspace and uncommitted user changes. Compute owns an explicit staging/promotion protocol and observed previous-writer termination before replacement. A backend without safe handoff cannot support this rollout. Preparation failure keeps the serving revision; rollback requires fresh admission and leases, not revival of an old token or execution generation.

## Acceptance

Both modes require the shared broker contract, real provider scope/revocation evidence, safe preparation, and original-invocation lifecycle evidence. Mediation additionally requires origin replay negatives and semantic protocol compatibility. See the [acceptance matrix](lifecycle.md#acceptance-matrix); presence of an issuer or helper is not a production acceptance result.
