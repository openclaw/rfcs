# GitHub App Access v1 Specification

Provider-specific contract for [RFC 0034](../0034-github-app-credentials.md), using
[Credential Broker v1](credential-broker-v1-spec.md). Status: draft. **Must**
identifies a conformance requirement. This spec describes target behavior;
publication qualifies neither mode.

## Scope and proposed release selection

V1 targets organization-managed GitHub.com App installations, one repository per
credential, HTTPS Git, and the bounded Git/`gh` workflow below. Personal
credentials, GitHub Enterprise hosts, SSH, LFS, submodules, arbitrary uploads,
and unlisted operations are excluded.

| Mode | Release scope |
| --- | --- |
| Mediated | Required in production under [RFC 0027's credential boundary](../0027-openclaw-enterprise.md#secret-access). |
| Native | Development/testing only; never a production fallback. |

Delivery is sequential, with a separate production gate for each stage:

| Stage | Qualified scope |
| --- | --- |
| A — Managed reads | Dedicated Kubernetes/gVisor execution; mediated repository metadata and HTTPS clone/fetch with verified preparation. |
| B — Coding workflow | Selected issue/PR reads and trusted **Approve and publish** for an exact candidate. Add GraphQL read shapes only where qualified commands require them. |
| C — Durable work | Broader durable Work and separately admitted children, plus Stop task / Stop Agent / Start Agent controls. |

Stages A and B require genuine root Work and current operation authority.
Subordinate helpers may operate only within that root's qualified context,
scope, and cancellation; root-only execution may qualify first. Helpers do not
receive independent durable Work. Local Git operations remain ordinary Git.
Transparent `git push` and `gh pr create` adapters are later work using the same
publisher and effect records. Model-credential proxies and token-forwarding
components alone do not establish production GitHub mediation.

Execution and logical work may be explicitly uncapped. Access/enforcement leases,
provider credentials, and operation time/resource limits remain finite and fit
every configured original horizon. No universal Agent or job duration is imposed.

## Client versions

Git 2.55.0 and `gh` 2.93.0 are the proposed qualification pins for both modes.
Evidence must pin binaries, image digests, configuration, and exact command
variants. Another version needs its own compatibility evidence and cannot
qualify these pins. [Git credential helper interface](https://git-scm.com/docs/gitcredentials),
[gh environment](https://cli.github.com/manual/gh_help_environment)

## Enrollment and configuration

### Enrollment

The [proposed Agent configuration](repository-configuration.md) is admin-managed
and frozen into `AgentRevision`; it is not an existing public repository field.
OCC authorizes the exact Namespace administrator, Agent/Configuration operation,
and each referenced binding, broker, and Secret. Invocation allowlists and the
App's broader installation access cannot replace these service grants.

1. An Installation operator selects the issuer and trusted GitHub.com endpoints.
   The organization installs the App on explicit repositories within supported
   permission profiles.
2. A Namespace administrator binds the exact App installation to its
   `SecretBroker`, referencing protected signing material through the selected
   backend. OCC verifies Namespace ownership and authorization for the broker,
   Secret, and integration binding. Public resources and revisions contain only
   references and metadata.
3. The issuer verifies App/installation identity, organization ownership,
   repository membership, and available permissions against GitHub. Unavailable
   checks report unverified or degraded enrollment. Configuration alone is not
   verification; enrollment neither mints a runtime token nor activates an Agent.
4. OCC admits one access record per repository grant for an Agent revision,
   recording the binding/profile versions, repository ID and canonical name,
   permission profile, mode, checkout commit, lease horizon, and configured
   limits. Authorize every referenced resource, including when a revision has
   several grants. Missing support or unresolved scope denies admission.

### Admitted data

Provider data has this closed shape. Field names are illustrative; this is not a
public REST API:

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
  publicationPolicyDigest: string; // disabled or human-approval policy frozen in revision
  publicationPolicyGeneration: number;
  accessHorizon: Timestamp | null; // explicit uncapped grant ceiling; leases stay finite
};
```

`OccReference` and `Timestamp` use validated OCC codecs. Publication policy is
frozen from the proposed selection: stage A permits only `disabled`; stage B
may admit the configured human-approval policy. The binding resolves
host, App ID, installation ID, organization identity, and protected key version.
Workload requests cannot supply another host, account, key reference, permission
map, or longer horizon. Unknown fields and malformed or cross-Namespace
references deny.

### Configuration changes

Visibility changes, transfers, and enrollment changes require denial and
revalidation of affected access. Display-name changes cannot silently redirect a
grant. Configuration/profile edits require new admitted revisions; revocation
can deny active access immediately. Both permission increases and decreases require
a fresh Pod/gVisor sandbox and eligible context before serving the changed
authority; a new container in the old Pod is insufficient. Existing connections,
background processes, caches, and queued requests cannot inherit the new context.

Planned key rotation follows the
[shared sequence](credential-broker-v1-spec.md#configuration-and-admitted-records):
verify the replacement against the same App/installation, select its generation
and close old leases, then admit new revisions. Failed verification preserves
the working binding.

## Session scope and multiple repositories

### Admission and grant selection

At logical-work admission, OCC records the selected immutable repository grants,
supported narrower profiles, and any configured original horizon. IAM authorizes requester
invocation separately from service/workload repository access. Chat requests,
local remotes, and personal GitHub access confer no provider authority.

Each work/assignment derives a separate access lease for each selected repository
under the [shared authority rules](credential-broker-v1-spec.md#current-authority-and-workload-origin).
Session references retain provenance and any explicitly admitted cancellation
relationship; ending a model turn does not close logical work.

Each command selects one explicit grant and a token scoped to it; ambiguous
selection denies. No session-wide token combines permissions.

| Example grants | Allowed work |
| --- | --- |
| `coding` on `org/service`; `views` on `org/library` | Pushes and PRs in `service`; reads only in `library`. |
| `coding` on both repositories | Changes use two branches and two same-repository PRs. |

### Trusted publication

The first write interface is **Approve and publish**, backed by a trusted
publisher outside Agent execution. Freeze and retain one immutable candidate
before requesting approval. Its action digest binds:

- Original work, invocation, execution assignment, authority revision, and scope.
- Stable numeric repository and App installation identity.
- Exact base ref and captured base OID; exact allowed target ref and expected
  prior remote OID, or explicit authorized branch creation.
- Proposed commit OID, complete retained object manifest and pack digest, with
  finite object, byte, path, and capture limits.
- Exact draft PR title/body and ordered actions: push, then create draft PR.

Stage B requires explicit approval from a configured, currently authorized
human. The requester may approve if eligible; the Agent and its helpers cannot
self-approve. Eligibility requires current IAM `operate` permission on the
exact Agent and membership in its configured human approver list, as proposed
in [the configuration contract](repository-configuration.md#publication-modes-and-delivery). Configure exact repository and base/target ref allowlists,
branch-creation permission, eligible human principals, and a finite approval
lifetime. Missing policy denies publication. OCC and the selected IAM authority
authenticate the approver and commit approval durably for that exact digest;
a candidate ID, signature on a Git commit, or workload claim is not approval.
Changed content, base, ref, expected prior tip, or PR metadata invalidates approval
for the changed candidate. No broad branch-write permission substitutes for these
checks. Validate and retain bounded, complete Git object graphs outside execution
without repository hooks, filters, helpers, or ambient configuration. Isolate
untrusted Git parsing from signing-key and credential custody.

At each effect, recheck current online work, approval, IAM, and destination
controls. Push uses one atomic expected-old ref update to the exact approved OID,
with a separate fast-forward requirement. A preflight read or generic non-force
update is insufficient. See the [Git push semantics](https://git-scm.com/docs/git-push)
and [pack protocol](https://git-scm.com/docs/pack-protocol). Deny multiple refs, force updates, deletion, and tags.
Only a confirmed, recorded push permits a separate draft-PR effect with explicit
same-repository base/head and exact approved metadata. Do not implicitly fork or
push. Unknown effects retain their original claims and observations and never
trigger automatic replay, including after retries or restart.

PR creation uses moving branch names: this proposal does not assume an atomic
base/head OID precondition in GitHub's PR API. Retain and compare the attributed
response's repository, refs, OIDs, title, body, and draft state with the candidate.
A mismatch or unattributable result remains unknown; preserve the confirmed push
as its own outcome. Matching an existing PR's text is not evidence this attempt
created it. Fork-to-upstream PRs remain unsupported.
[gh PR creation](https://cli.github.com/manual/gh_pr_create)

#### Later authorization modes

Two future modes may be selected independently: require a human other than the
requester, or automatically authorize narrowly configured operations, such as
an allowlisted branch push or draft PR. Automatic mode records a current policy
decision for the exact candidate/effect without requiring per-operation human
approval. Neither mode is enabled in the MVP, and missing policy never falls
back to automation. Both retain current Work/IAM authority, the same destination
and object/ref constraints, durable separate effects, and unknown-outcome rules.

### Scope changes and closure

Refresh and cleanup are independent per repository access lease. Removing one
grant preserves others unless shared authority changes; closing logical work
closes its leases and applies its admitted child-cancellation rules. Authorized
execution replacement creates fresh assignment-bound leases after the stop
barrier; it cannot reopen old leases. The
[unknown-mint hold](#unknown-mint-hold) applies across aliases for the same
provider target.

Native restrictions require enforcement by GitHub permissions and repository
rules; narrower unsupported restrictions require mediation or denial. Delivered
native tokens retain their scope until revoke or expiry.

## Preventing public publication

V1 must deny public GitHub writes, including to repositories accessible to the
App. Write destinations must be explicitly approved repository IDs in the
enrolled organization with verified `private` visibility, or `internal` where
explicitly approved. This applies to all grants sharing an Agent's workspace and
context. Public reads confer no write authority; public-repository coding is
unsupported.

### Required checks

- **Admission and credentials:** OCC verifies ownership and visibility before
  admitting a write grant. The broker revalidates against GitHub before issuing
  or delivering a write-capable token and before every mediated write. Public,
  unknown, or unavailable visibility denies. Retain checked identity, visibility,
  and observation time; admission snapshots or delayed webhooks alone are
  insufficient.
- **Every write surface:** enforce the destination rule on HTTPS pushes and
  permitted REST/GraphQL mutations, including PR titles and bodies. Repository
  creation, forks, transfers, and visibility changes are unsupported; no
  administration permission is granted. Wrappers or a `github.com` allowlist
  alone cannot enforce this rule.
- **Changes:** ownership or visibility changes close affected leases and revoke
  outstanding tokens, requiring revalidation and fresh admission. Delivered
  native tokens remain governed by GitHub's permissions until actual revoke or
  expiry, regardless of the broker's latest visibility decision.
- **Enforcement:** the full guarantee requires the mediated checks and runtime
  boundary below, denying direct writes, alternate credentials, and tunnel
  bypass. Native scoped credentials and controlled clients only guard against
  accidental wrong destinations.

### Visibility race and guarantee limits

Visibility checks and writes are separate operations. Organization controls must
prevent destinations becoming public while access or accepted writes remain
outstanding; revalidation and webhooks cannot close that race. Trusted
administrators' deliberate publication and other permitted output channels are
outside the guarantee. Making a repository public exposes its existing contents.
[Repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)

## Permissions and issuer behavior

| Profile | Exact requested permissions | Intended operations |
| --- | --- | --- |
| `checkout` | `contents:read` | Fetch the approved repository and commit. |
| `views` | `contents:read`, `issues:read`, `pull_requests:read` | Repository, issue, and PR reads. |
| `coding` | `contents:write`, `issues:read`, `pull_requests:write` | Prepared-branch push and same-repository draft PR creation, plus reads. |

All profiles include required `metadata:read`; workflow, administration, and
secrets permissions are excluded. Coding tokens are not limited to drafts or
particular branches: `contents:write` satisfies the PR-merge permission check
even without `pull_requests:write`. The trusted publisher enforces the exact
approved ref update and denies merge operations. GitHub repository rules with no
App bypass provide defense in depth; they do not replace publisher constraints.
[Merge permissions](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request)

### Issuance and validation

The issuer signs an App JWT outside execution and calls
`POST /app/installations/{id}/access_tokens` with one explicit `repository_ids`
entry and the issuance's exact effective permissions. Validate these as a
supported subset of the immutable lease ceiling and applicable enforcement
authority. A `coding` ceiling narrowed to `views` must mint `views` permissions
without changing the ceiling. Never use installation-wide defaults; unavoidable
metadata read is the sole implicit baseline.

Validate returned repository scope, permissions, and actual expiry before
eligibility. Incomplete scope evidence or unexpected scope retains the token for
cleanup only. [Installation token creation](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)

### Lifetime and revocation

| Credential | Provider lifetime |
| --- | --- |
| App JWT | Expires within ten minutes. |
| Installation token | Expires after one hour; no documented custom TTL parameter. |

Tokens are opaque variable-length strings. Shorter OCE leases do not shorten
provider validity; App key rotation does not revoke issued tokens.
[App JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app),
[installation token lifetime](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

Declare new-token issuance, provider-fixed lifetime, and individual revocation
using protected token material, without assumed mint-idempotency or lost-token
lookup. Revoke each known token with `DELETE /installation/token`; `204` confirms
revocation. Retain protected material through cleanup: a hash cannot call this
endpoint. Installation suspension/uninstall requires separate operator
authorization and is never an automatic fallback.
[Revocation](https://docs.github.com/en/rest/apps/installations#revoke-an-installation-access-token)

## Policy enforcement

Enforce the [same effective grant](credential-broker-v1-spec.md#one-effective-grant-two-enforcement-points)
at minting and on every mediated request. GitHub's token API accepts repositories
and permission categories, without general fields for branches, arbitrary paths,
individual mutations, current visibility, OCE work, or originating containers.
Naming a profile cannot encode those restrictions.
[Token parameters](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app)

| Constraint | Enforcement |
| --- | --- |
| Repository and permission category | Explicit mint scope and validation of each request against the effective grant. |
| Supported operation and parameters | Mediator validates actual Git/REST/GraphQL semantics, including same-repository targets and draft PR state. |
| Exact publication and ref restrictions | Trusted publisher checks approved objects, exact allowed refs and expected-old update; deny merges, force, deletion, and multiple refs. GitHub rules add defense in depth. |
| Approved non-public destination | Current ownership/visibility checks plus the organization controls required by the publication policy. |
| Work purpose, horizon, withdrawal | Current online OCC/IAM decision for every dispatch, plus finite broker and enforcement leases. |
| Execution origin | Trusted runtime/host mapping and enforced routing; no workload-visible proof is sufficient by possession. |

### Narrowing and additions

The profile is a ceiling: use supported narrower profiles for read-only work,
never arbitrary per-request permission combinations. Never reuse or refresh
broader tokens for narrower work. Finer operation classes require a versioned
profile and compatible lease/cache accounting. GitHub specifies endpoint
permissions and calls for testing actual GraphQL queries and mutations.
[Permission guidance](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)

Every operation added to the reviewed catalog must identify targets, provider
permissions, request constraints, and outcome handling. Generic authenticated
passthrough is unsupported. Unenforceable restrictions require denial or
authorized admission of a narrower supported profile; permission errors never
justify silently broader access.

Ordinary Contents permissions lack per-token arbitrary path scope.
App-registration `single_file` permissions configure paths but are outside this
profile and do not establish Git compatibility. GitHub push rules may add path
restrictions after separate qualification.
[App registration](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-using-url-parameters),
[repository rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

## Refresh and overlap

### Cache identity

Cache by exact binding/profile, Namespace/Agent/revision, assignment/incarnation,
original work and access lease/purpose, repository/effective permissions, and
generation. Never substitute broader admitted scope or share tokens across
independently revocable leases. Every use requires current online authority, including reads and credential
maintenance; native delivery also requires current authority.

Supported narrower issuances under the same open lease have distinct exact-scope
cache entries. All scopes share that lease's mint claim and two-credential overlap
budget. Broader credentials retired after narrowing remain counted through actual
revoke or evidenced expiry; no new scope resets capacity or an unknown-mint hold.

### Replacement limits

| Limit | Requirement |
| --- | --- |
| Refresh threshold | Begin replacement below five minutes remaining, while the original lease remains open. |
| Mint concurrency | One active durable mint claim per lease; one original provider attempt per issuance. |
| Overlap | Two credentials per lease, counting reservations, dispatched/unknown attempts, and provider-valid predecessors/successors. |
| Capacity release | Only definite no-issuance, confirmed revocation, or evidenced expiry frees a slot. Local cache retirement does not. |
| Full capacity | Deny minting; never evict unresolved records. Admission and status must expose these limits. |

After failed refresh, the broker may serve a recorded unexpired token only while
original authority, exact scope, and delivery/use checks pass. Do not run
autonomous refresh after lease closure. Respect provider throttling on permitted
retries and the shared no-remint rule for uncertain issuance.

### Authority outages

Require current online OCC authority for every GitHub dispatch: reads, writes,
issuance, renewal, and credential maintenance. Existing tokens and unexpired
leases do not permit offline dispatch. If any required authority, provider,
custody, or inventory check is unavailable, deny the affected operation.
Independently retained cleanup still owns its obligations and needs its own
applicable authority; work authorization cannot stand in for cleanup authority.

The shared broker's qualified offline-read/maintenance option is future profile
work and is not enabled here. Accepted upstream operations may finish; report
their outcomes and cleanup separately from the denied next operation.

### Unknown-mint hold

An unknown mint holds the stable provider target:

| Target component | Identity |
| --- | --- |
| Platform | OCE Installation. |
| Provider | Canonical GitHub host, App identity, GitHub installation ID. |
| Resource | Repository ID. |

The hold blocks issuance across binding aliases, Namespaces, profiles/permission
changes, key or binding generations, revisions, incarnations, leases, and modes.
Retain original ownership and permission evidence; configuration changes or
renewed admission cannot bypass the hold. OCC's trusted inventory enforces it
without disclosing another Namespace's records, prioritizing complete accounting
over availability.

Resolve the hold only with definite no-issuance evidence, evidence that expiry
has elapsed, or verified sufficient administrative revocation. New request IDs
and time since a timeout do not resolve it. Broader remedies require an
identified scope and corresponding operator authorization. Other targets remain
independent; never automatically switch accounts to bypass a hold.

### Client behavior

Mediated dispatches can use eligible replacement tokens without restarting the
requester. Native mode supplies eligible tokens to new Git helper invocations
and `gh` children; existing environments do not rotate. Dispatched operations
may fail on expiry or revocation. Neither mode automatically replays an ambiguous
push, PR mutation, or other write.

## Native client contract

The Git helper and `gh` launcher use the broker's native delivery port with a
protected, immutable original-work and execution binding. Reject broader
permissions, alternate credentials, unsupported remotes, or work substitution.
Preparation helpers use a separate read-only identity.

- **Git:** authenticate only canonical HTTPS GitHub remotes through the selected
  helper. Keep credentials out of remote URLs, command arguments, persistent
  configuration, and credential stores. Disable inherited helpers and unmanaged
  credential fallback in the controlled client path.
- **`gh`:** each new child receives `GH_TOKEN` in its environment only. Preserve
  arguments and exit/signal behavior; never update existing environments or a
  global current-turn token. Prevent inherited host/token configuration from
  selecting another credential or destination.
- **Custody:** helper store/erase handling must not persist material. Diagnostics
  and failures use safe reason codes. Native workloads can read and publish
  their tokens, so these rules cannot keep tokens out of adversarial workload
  logs or artifacts.
- **Failure:** denied, closed, expired, unsupported, or unavailable results fail
  credential acquisition. Never fall back to personal credentials, App keys,
  alternate installations, or a mediated-to-native downgrade.

## Mediated origin and routing

### Trusted identity

The proposed trusted host connector keeps its SPIFFE mTLS key outside Agent
execution. It authenticates an exclusive runtime-owned local channel, resolves
the actual container incarnation and original logical work through a protected
mapping, and makes the broker request. The broker verifies its service identity
and exact mapping; container-supplied identity headers are untrusted.

Use [RFC 0035's identity and assignment contract](https://github.com/openclaw/rfcs/pull/69)
to check three bindings separately:

| Binding | Required identity |
| --- | --- |
| Connector | Its own service assignment. |
| Represented execution | Agent execution assignment/generation from protected runtime evidence. |
| Original work | [RFC 0036's original-work grant](https://github.com/openclaw/rfcs/pull/70). |

A connector may represent only executions allowed by its server-owned mapping;
its SVID cannot substitute for Agent authority. Installation configuration pins
trust roots and permitted peers. Registration/attestation ownership, peer
acceptance, evidence lifetime, and invalidation must be specified and qualified
for the selected runtime. SPIFFE service authentication does not itself select a
different Agent-to-OCC authentication profile.

A shared host identity, socket pathname, Pod UID alone, same-Pod sidecar, or
self-reported turn ID is insufficient. The mapping must change on container
restart and distinguish sibling containers and each request's original work.
Persistent workers require the
[protected work-binding contract](credential-broker-v1-spec.md#persistent-processes-and-background-work);
old queued requests cannot inherit successor authority. The dispatcher/channel
remains a release blocker until demonstrated. Until then, constrain execution to
one immutable admitted authority context and deny mixed-authority reuse; serial
scheduling alone does not stop old requests inheriting new authority.

SPIFFE identifies its authorized consumer and supplies private key material; an
SVID key inside execution cannot establish copy resistance.
[SPIFFE Workload API](https://spiffe.io/docs/latest/spiffe-specs/spiffe_workload_api/)

### Runtime boundary

SandboxDriver enforces routing and denies bypass through token endpoints,
alternate brokers, direct credentialed GitHub routes, or general tunnels. Proxy
settings establish only compatibility. Workloads receive neither GitHub material
nor reusable connector-issued origin proofs. Native delivery must be unreachable
or reject all mediated leases, including copied handles.

The guarantee covers replay of container-visible integration credentials from
another host/container while the original remains live. It assumes intact
sandbox isolation and trusted host/control-plane/broker infrastructure; using
the original authorized container as a relay is outside this guarantee.

### Client transport

The first deployment selects split DNS to an external trusted TLS/HTTP mediator
for ordinary GitHub destinations. DNS answers must derive from the authenticated
runtime attachment and current work; source IP, Pod name, or a caller receipt is
insufficient. The mediator resolves upstream GitHub independently. DNS steering
alone grants no operation authority: the installed network fence and mediator
must deny cached-address, existing-connection, direct-route, and tunnel bypass.
Qualify the complete runtime attachment and both TLS legs before release. Plain CONNECT
cannot substitute credentials in encrypted HTTP; `GH_HOST` selects a GitHub
host, not a generic proxy. Keep trust private to the selected runtime/client and
validate upstream GitHub TLS independently.
[HTTP CONNECT](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.6),
[Git HTTP](https://git-scm.com/docs/http-protocol)

## Mediated operation profile

### Request validation

The proxy validates the full provider operation before choosing a token:

- Construct upstream URLs from trusted enrollment data; reject redirects,
  ambiguous encodings/paths, host disagreement, and unsupported body semantics.
- Strip caller cookies, proxy headers, and authorization before dispatch. The
  qualified client path may omit Authorization or send a fixed public, nonsecret
  placeholder required by the CLI; reject other credentials. Placeholders and
  lease handles cannot authenticate origin.
- Bound request/response size, execution time, and pagination in the selected
  profile. Tokens must not enter downstream responses, headers, errors, logs, or
  artifacts.

### Supported surfaces

| Surface | Stage and validation |
| --- | --- |
| HTTPS Git fetch | A: `info/refs` for `git-upload-pack` and `git-upload-pack` on the exact admitted repository. Validate service/method/path and supported protocol negotiation. Fetched history remains readable. |
| Trusted publication | B: Freeze, approve, and publish one exact candidate through the publisher contract above. No direct Agent receive-pack or raw mutation route in the first profile. |
| REST reads | A: exact repository metadata. B: selected commit lookup and bounded issue/PR list/view routes. Validate repository identity and route parameters, including pagination targets. |
| GraphQL reads, if selected | B: Exact repository/issue/PR reads required by qualified commands. Use reviewed documents with constrained variables or a semantic validator covering aliases, fragments, batching, and node IDs. Arbitrary operations and mutations deny. |

A `/graphql` allowlist or operation name cannot check permissions. Resolve node
IDs to admitted repositories; reject additional operations/targets and
unsupported protocol extensions. Arbitrary REST mutations, raw `gh api`
passthrough, implicit fork/push, and unvalidated `gh` commands are unsupported.

### Command qualification

Stage A targets clone/fetch and repository metadata, including only qualified
`gh api` read shapes. Stage B adds `gh repo view`, bounded `gh issue list/view`,
and `gh pr view` only with their exact request manifests. Local history is
permitted; strict history isolation is an optional separate mode. Integration
uses explicit fast-forward updates; rebase requires configuration and explicit
dirty/conflict handling. Publish argument variants and observed manifests for
pinned clients. These remain compatibility targets pending qualification.

Later `git push` / `gh pr create` adapters must capture and validate the complete
candidate before any write, then use the same approval and publication effects.
Unapproved calls return approval-required or use a separately bounded pending
interaction. Retry references the original immutable candidate/effect; it cannot
hold an unbounded stream or create a new effect. Qualify receive-pack framing,
pack/object limits, exact one-ref mapping, PR request shapes, and lost-response
behavior independently before enabling these adapters.
[Pinned gh repository queries](https://github.com/cli/cli/blob/f96972ce1c11fdb8eaa556257fde962a363dffde/api/queries_repo.go)

## Repository preparation

1. **Authorize and contain.** OCC authorizes a separate read-only preparation
   lease for the admitted candidate. Compute provides execution and an empty
   candidate-owned staging volume; SandboxDriver establishes and verifies
   admitted containment. OCC gates checkout and Harness startup on the required
   observations. Native preparation uses an inventoried token; mediation
   requires runtime-equivalent origin/routing guarantees.
2. **Fetch and verify.** Fetch the exact repository and resolved commit using
   fixed configuration and safe argument arrays. Disable repository hooks, setup
   scripts, submodules, and LFS. Reject redirects, traversal, symlink escapes, and
   inherited helpers. Verify the commit and repository identity, stop
   preparation, and close its lease before handoff. Neither credentials nor
   preparation authority enter the resulting checkout.
3. **Promote safely.** Preserve the active workspace and uncommitted changes.
   Compute owns the explicit staging/promotion protocol and must observe
   previous writers terminate before replacement. Backends without safe handoff
   are unsupported. Preparation failure preserves the serving revision; rollback
   requires fresh admission and leases, never revived tokens or execution
   generations.

## Acceptance

Stage A requires the shared broker, real provider scope/revocation evidence,
safe preparation, genuine root Work and operation authority, online-only
dispatch, mediated origin replay negatives, and its selected read protocols.
Stage B adds selected coding reads and exact-candidate human-approved
publication. Stage C separately qualifies durable children and lifecycle
controls; active-session migration/replay remains later scope. Unsupported
helper/child/execution combinations deny admission. Native helper evidence
supports development/testing only. An issuer or helper alone cannot satisfy
the [acceptance matrix](lifecycle.md#acceptance-matrix).
