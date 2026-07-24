# Projected Owner Slice Registry

This document turns RFC 0024's owner-first delivery model into an inspectable
queue of bounded implementation families. It applies the same useful planning
lesson as Doctor's structured rule registry: enumerate the work, give every
family an owner and proof bar, and land narrow slices instead of hiding the
remaining work inside one convergence pull request.

Status: projected delivery plan for RFC 0024. It is not a normative runtime
registry, a fixed pull-request count, or an RFC-acceptance gate.

## Registry Contract

The current audit has 47 entries. The first audit had 44; owner review exposed
two automation obligations that had been described by the RFC but not named as
delivery slices, and follow-up review exposed the new-surface adoption gap.
Forty-seven is the current decomposition, not a quota. An entry
may be deleted when source audit proves that existing owner
behavior is already sufficient, or split when it crosses semantic, rendering,
locale, or publication ownership. Entries may combine only when the same owner
can approve the same compatibility, privacy, rollback, and deletion proof.

Each entry tracks:

- one semantic owner registry;
- one rendering or publication owner;
- one bounded message family or projection edge;
- the owner decision or landed dependency that unlocks it;
- accepted, fallback/failure, compatibility, and privacy evidence;
- the hardcoded, duplicated, or parsed-prose authority it deletes; and
- a live state such as `projected`, `audited`, `owner-approved`, `draft`,
  `landed`, `generated-follow-up`, `blocked`, `deferred`, or `deleted`.

The registry lives in RFC and project planning. Runtime lookup remains in
surface-owned catalogs and protocol-owned descriptor registries. Coverage
aggregation reads landed owner declarations; it does not make this planning
file executable.

After `G45` and `G46` land, every slice that adds or migrates deterministic
product strings must also onboard its area to both halves of the maintenance
contract before that area is complete: its declared scope runs the blocking,
credential-free authoring/drift gate, and its owner workflow runs trusted
asynchronous generation, validation, and generated-PR publication. An owner
with an existing pipeline may prove that pipeline satisfies the contract rather
than replace it. Schema-only, English-only, or deferred slices record why no
translated catalog is being enrolled. `G47` separately ensures that newly
enumerated product-string surfaces receive one of those dispositions at
introduction time; platform-constrained dispositions also identify their owner
and reason.

Adoption is documented progressively. Each slice updates its checked-in
inventory disposition, the public contributor workflow index, and nearest
owner-internal guidance, plus additional public documentation when it changes
a public authoring or compatibility contract. These are part of that slice's
done bar. `G47`/`PK0` registers its PK0 entries that predate the inventory,
indexes their workflows publicly, and backfills their nearest owner-internal
guidance rather than expanding their already-reviewed runtime scopes. `F02`,
`F04`, `F05`, and later slices carry those artifacts in their own packages. The
later `P41`-`P42` documentation package localizes documentation as a user-facing
product surface;
it does not defer documentation of earlier owner obligations.

## Owner Registries

| Registry | Owns | Does not own |
| --- | --- | --- |
| `core-locale` | Locale identity, resolution, catalog validation, generic rendering | Product meaning, recipient locale, or publication |
| `wizard`, `updater`, `cli`, `tui`, `doctor` | Their English source families and final terminal rendering | Gateway, channel, or browser behavior |
| `gateway-error` | Stable error discriminator tuples and wire projection | Client locale selection or translated catalogs |
| `approval` | Approval meaning, actions, ordering, and safety fallback | A channel recipient preference that is not recorded |
| `control-ui` | Browser preference, source catalog, rendering, and generated locale workflow | Server or channel recipient locale |
| `command-catalog`, `skill`, `plugin` | Stable capability identity and optional display metadata | Adapter truncation, native reconciliation, execution, or policy |
| `channel.<adapter>` | Legitimate recipient locale, escaping, platform projection, and fallback | Cross-channel locale inference |
| `native.android`, `native.apple`, `docs` | Existing platform catalogs, generation, validation, and publication | Runtime catalog formats |
| `release-localization` | Landed declarations, scoped review evidence, maturity, and release claims | Runtime rendering or translation generation |
| `catalog-automation` | Deterministic authoring gates, new-surface disposition checks, and trusted generated-catalog refresh plumbing | Product meaning, catalog ownership, language review, or release promotion |

## A. Current Foundation Evidence

These five drafts are the first registry entries. `F02` through `F05` branch
independently from `F01`, so each review contains the shared foundation plus
only its own owner-bounded delta.

| ID | Owner registry | Slice and edge | State | Exit and deletion proof |
| --- | --- | --- | --- | --- |
| `F01` | `core-locale` + `wizard` | Minimal kernel and onboarding consumer ([#111541](https://github.com/openclaw/openclaw/pull/111541)) | `draft` | Kernel/catalog tests, unchanged English wizard behavior, missing-key fallback, no runtime I/O; replaces wizard-local resolution duplication where adopted. |
| `F02` | `updater` | Human `update --dry-run` preview ([#111542](https://github.com/openclaw/openclaw/pull/111542)) | `draft` | JSON equality, literal command/path/version preservation, English and non-English proof; deletes updater-owned hardcoded preview labels. |
| `F03` | contributor/docs owners | Ownership and contribution guide ([#111543](https://github.com/openclaw/openclaw/pull/111543)) | `draft` | Docs map, glossary, source-safe validation, and working links; replaces undocumented cross-surface guesswork, not owner workflows. |
| `F04` | `tui` | TUI status summary and relative ages ([#111544](https://github.com/openclaw/openclaw/pull/111544)) | `draft` | Formatter and PTY proof, documented `OPENCLAW_LOCALE`/host-locale/English precedence, literal IDs/paths/models/events, exact English compatibility; deletes status-owned English assembly. |
| `F05` | `gateway-error` + `control-ui` + `approval` | `APPROVAL_NOT_FOUND` descriptor and approval-page edge ([#111545](https://github.com/openclaw/openclaw/pull/111545)) | `draft` | Stable tuple, bounded metadata, legacy English, unknown-key denial, protocol/UI tests; deletes the two Gateway emitter variants as independent descriptor authorities. |

## B. Operator Surface Follow-Ups

These entries use private owner catalogs and existing command boundaries. They
do not add public capability metadata.

| ID | Owner registry | Projected slice | Gate | Required proof and deletion target |
| --- | --- | --- | --- | --- |
| `O06` | `control-ui` | Generated locale refresh for `gateway.approval.notFound` | `F05` landed; Control UI workflow owner | Isolated generated PR, source-pinned evidence, catalog validation, named safety review before `complete`; no hand-edited generated bundle. |
| `O07` | `updater` | Apply, status, recovery, and failure presentation after dry-run | `F02` owner acceptance | Human-output snapshots and exact JSON/actions/reasons; remove only updater-owned wrappers, never upstream error text. |
| `O08` | `wizard` | Remaining onboarding/setup validation and recovery families | `F01` landed | Existing locale precedence and English snapshots, protected config keys and commands; remove parallel wizard-only renderer seams where core replaces them. |
| `O09` | bundled setup owners | Channel and plugin setup messages already using wizard translation | `F01`; each setup owner approves its family | One bundled owner per PR, setup fixtures, literal account/channel/plugin IDs; delete duplicated setup labels. |
| `O10` | `cli` | Root help shell and shared option validation | CLI maintainer inventory approval | Help/validation snapshots, flags and metavariables unchanged, structured modes identical; delete shared English validation helpers only after all callers migrate. |
| `O11` | agent/ACP/capability CLI owners | Agent command, ACP provenance, and capability guidance | `O10` adapter available | Operation-scoped context, upstream diagnostics literal, JSON invariant; delete command-local wrappers covered by the catalog. |
| `O12` | sessions CLI owner | Sessions, history, and compaction human presentation | Source audit separates machine output | IDs, keys, paths, timestamps, and JSON invariant; delete only final-edge prose and labels. |
| `O13` | cron/tasks CLI owners | Cron, tasks, and audit human presentation | Semantic owners approve enum labels | Schedule/task IDs and structured status/reason fields literal; catalog product-owned phase labels and delete duplicated table prose. |
| `O14` | `doctor` | Doctor lint/status finding presentation from stable `checkId` families | Doctor owner maps its completed structured registry to presentation families | Findings JSON unchanged, paths/targets literal, no parsing of translated fixes; replace presentation at the final CLI edge rather than translating 44 rule implementations. |
| `O15` | `tui` | Navigation, help, validation, and recovery after status | `F04` accepted | PTY plus formatter proof, keyboard tokens and commands literal, no whole-TUI extraction; delete one bounded renderer family per PR if owners differ. |

## C. Runtime Safety And Gateway Families

Every new Gateway entry follows the `F05` rule: one stable discriminator tuple,
one reviewed key, unchanged English, bounded parameters, compatible clients,
and a client edge. Safety and recovery families remain English until required
owner and security review exists.

| ID | Owner registry | Projected slice | Gate | Required proof and deletion target |
| --- | --- | --- | --- | --- |
| `R16` | `gateway-error` + auth UI owner | Link, pair, and authentication-required errors | Gateway/auth owner approves exact tuples | Old/new-client fixtures, no credential parameters, canonical English; delete client-side message matching for adopted tuples. |
| `R17` | `gateway-error` + connection UI owner | Protocol mismatch and startup-unavailable families | Gateway compatibility matrix | Version/retry fields literal, strict-client proof, deterministic fallback; delete recognized raw-message branching. |
| `R18` | `gateway-error` + request UI owner | Validation and missing-scope presentation | Authorization owner approves safe parameter schema | Scope/config keys literal, no authorization change, malformed metadata denied; delete adopted English parsing. |
| `R19` | `gateway-error` + operator UI owner | Storage/service-unavailable recovery families | Service owners define stable reasons | Retry metadata unchanged, raw exception excluded, English fallback; delete duplicated recovery wrappers at adopted edges. |
| `R20` | `approval` | Exec approval labels and explanatory structure with English safety snapshot | Approval owner plus SecOps copy policy | Commands, decisions, ordering, IDs, Markdown, and authorization identical; delete hardcoded labels in the shared approval renderer. |
| `R21` | `approval` + first `channel.<adapter>` | First non-English approval recipient edge | `R20` plus an existing explicit recipient locale and adapter-owner approval | Full family fallback, named language and SecOps review, no requester-locale inference; delete that adapter's English-only template. |
| `R22` | runtime auth/profile owners | Deterministic authentication, profile, and recovery wrappers outside Gateway | Stable machine reason exists | Secrets and upstream prose excluded, reason codes invariant, English fallback; delete product-owned wrappers only. |
| `R23` | Dreaming runtime owner | Deterministic journal headings and status labels | Separate generated-content language behavior | Product labels localized, generated prose untouched, content-language tests independent; delete hardcoded headings. |
| `R24` | affected runtime owners | Remove English host/dependency prose matching | Structured signal available per case | Same runtime result under English and non-English hosts; delete the prose parser rather than cataloging host errors. |

## D. Commands, Skills, Plugins, And Channel Projections

Public metadata contracts land before their consumers. Plain English remains a
valid legacy form, and localized presentation never changes identity,
execution, routing, permissions, or policy.

| ID | Owner registry | Projected slice | Gate | Required proof and deletion target |
| --- | --- | --- | --- | --- |
| `M25` | `command-catalog` | Optional `LocalizedText` command-description contract | RFC 0017/command owner approval | Schema and legacy round trips, alias/size validation, stable command identity; no adapter changes yet. |
| `M26` | CLI/TUI/Control UI command renderers | Project command descriptions into local product clients | `M25` landed | One source, per-surface fallback, locale changes rerender, invocation unchanged; delete duplicate local descriptions. |
| `M27` | `channel.discord` | Discord native command description localizations | `M25`; Discord owner | Platform limits, locale mapping, reconcile idempotence, deterministic fallback; replace existing Discord-only localization source. |
| `M28` | `channel.telegram` | Telegram native command-menu localizations | `M25`; Telegram owner | Bot API locale/length validation, reconcile proof, stable commands; delete English-only menu descriptions. |
| `M29` | `skill` | Optional localized skill display-name/description contract | Skill/package owner approval | Legacy manifest round trip, size/namespace checks, stable skill/tool identity; no prompt or policy effect. |
| `M30` | bundled skill owners + search UI | Bundled skill catalogs and localized search projection | `M29` landed | Search/display changes only, install and policy use IDs, fallback proof; delete bundled duplicate display text. |
| `M31` | `plugin` / Plugin SDK | Optional localized plugin metadata and host negotiation | Plugin SDK owner approval | Old-host behavior, minimum-version/capability negotiation, namespace and size limits; no runtime-message callback API. |
| `M32` | bundled plugin owners | Bundled plugin display metadata catalogs | `M31` or an internal bundled-only seam | Atomic registry snapshot, owner namespace, activation fallback; delete bundled duplicate labels only. |
| `M33` | routine channel semantic owners | Descriptor inventory for non-safety server-rendered notices | Stable bounded families identified | No arbitrary exception extraction, English fallback, literal user/channel data; establishes meaning before adapter work. |
| `M34` | `channel.telegram` | Telegram projection of approved routine notices | `M33` plus explicit recipient/account locale | Escaping, locale ownership, fallback, routing invariance; delete adopted Telegram templates. |
| `M35` | `channel.teams` | Teams projection using persisted `activity.locale` where authoritative | `M33`; Teams owner validates lifetime/recipient semantics | Proactive-reference and fallback fixtures, no cross-recipient leakage; delete adopted Teams templates. |
| `M36` | remaining `channel.<adapter>` owners | Adapter-by-adapter projection and explicit English-only declarations | `M33`; split once per distinct locale authority | Each adapter either proves an authoritative locale and deletes its template or records reviewed English as the supported state. |

## E. Control UI, Native Apps, And Documentation

These entries extend existing owner workflows. Source PRs and generated locale
PRs remain separate where the repository policy requires it.

| ID | Owner registry | Projected slice | Gate | Required proof and deletion target |
| --- | --- | --- | --- | --- |
| `P37` | `control-ui` | Remaining source inventory, missing keys, and raw-copy/fallback reduction | UI owner batches by page/feature | Source-only PR then generated refresh, layout and rerender tests; delete page-local literals per batch. |
| `P38` | `control-ui` | Locale-driven document `lang`, `dir`, RTL isolation, and layout fixtures | UI accessibility/design review | Arabic/Persian plus Hebrew fixture, commands/IDs isolated, no translator bidi controls; delete fixed-English document metadata. |
| `P39` | `native.android` | Android catalog completeness and blocking quality advisories | Native workflow owner | Generated inventory/artifact parity, platform UI tests, named review; platform-native resources remain authoritative. |
| `P40` | `native.apple` | Apple catalog completeness and blocking quality advisories | Native workflow owner | Generated inventory/artifact parity, platform UI tests, named review; platform-native resources remain authoritative. |
| `P41` | `docs` | Swedish documentation source/navigation and generated publication | Docs owner and `openclaw/docs` workflow | Exact source/tool revision, glossary, links/anchors, published artifact evidence; no second docs translator. |
| `P42` | `docs` | Persian and Thai publishing-path decision and implementation | Docs platform owner decision | Either verified artifacts or explicit `platform-constrained` rows with fallback and platform evidence. |

## F. Authoring Gates And Translation Automation

These three obligations are explicit delivery slices. The first two may land
together in one bounded core exemplar PR because they share tooling ownership
and one test fixture, but adopted surfaces opt in independently and retain their
own source, catalog, generation, review, and publication policy.

Draft OpenClaw PR
[#112784](https://github.com/openclaw/openclaw/pull/112784) is the reference
implementation for both slices, using the wizard completion family as the first
adopted area. Its draft status is implementation evidence, not a claim that the
slices have landed.

| ID | Owner registry | Projected slice | Gate | Required proof and deletion target |
| --- | --- | --- | --- | --- |
| `G45` | `catalog-automation` + first adopting owner | Deterministic authoring and drift gate for explicitly migrated families, namespaces, or directories | `F01` and `F03`; one routine core/wizard fixture | A changed English product string fails until it is registered; invalid ICU, placeholder mismatch, protected-literal drift, stale catalog evidence, and hand-edited generated paths fail without provider credentials. Unmigrated legacy scopes remain advisory. Replaces ad hoc or manual adopted-scope checks. |
| `G46` | `catalog-automation` + first adopting owner | Trusted async catalog refresh and generated-PR reference lane | `G45`; approved provider secret on trusted `main`, schedule, or manual dispatch | One English fixture change produces an isolated locale candidate, validates it, records source-pinned generation evidence, and opens or updates a generated PR through the existing publisher. Stale input or validation failure publishes nothing and leaves coverage partial. No direct protected-branch push, AI self-review, or automatic safety-copy promotion. Replaces hand-copied translation updates for the adopted fixture. |
| `G47` | `catalog-automation` + surface-registry owners | [New product-string surface disposition gate](https://github.com/openclaw/openclaw/pull/112801) | `G45` and `G46`; one owner adapter that enumerates real surface registrations or declared product-facing source roots | Adding an enumerated surface or expanding a declared product-facing scope fails until it is adopted, mapped to a conforming owner pipeline, or explicitly English-only, platform-constrained, or deferred with a named owner and rationale. Existing unclassified scopes are baselined as legacy debt. No repository-wide literal heuristic, runtime registry, or classification requirement for tests, logs, developer diagnostics, or model-authored text. Replaces review-only discovery of newly introduced localization debt. |

The exemplar is deliberately routine product copy. Safety catalogs may reuse
the lane only with their named semantic owner, language reviewer, and SecOps
policy; generated output alone cannot mark a safety family complete.

## G. Evidence And Product Promotion

These entries begin only after multiple owners have landed declarations. They
must not be pulled forward merely to make the kernel or an early slice appear
complete.

| ID | Owner registry | Projected slice | Gate | Required proof and deletion target |
| --- | --- | --- | --- | --- |
| `E43` | `release-localization` + surface owners | Owner-published declarations and scoped coverage aggregation | Representative landed entries from operator, runtime, metadata, and native/docs cohorts | Missing required declarations fail only the release claim, advisory migration is owner/deadline scoped, and no runtime closed-surface union is introduced. |
| `E44` | release owner + language/security reviewers | Review-evidence ingestion, maturity promotion, and qualified/full release claim | `E43`, current generated artifacts, named review roster | Stale evidence demotes only affected families, platform constraints disclosed, no manual override or AI self-attestation; replaces hand-maintained completion claims. |

## Dependency And Execution Order

```text
F01 kernel
  -> F02 updater -> O07
  -> F04 TUI -> O15
  -> O08/O09/O10-O14

F01 kernel + F03 contributor contract
  -> G45 scoped authoring gate
  -> G46 trusted async refresh exemplar
  -> G47 new-surface disposition gate

F05 Gateway approval descriptor
  -> O06 generated Control UI catalog
  -> R16-R19 additional reviewed Gateway tuples
  -> R20 English approval family -> R21 first legitimate recipient locale

M25 command metadata -> M26-M28 projections
M29 skill metadata -> M30 bundled skill catalogs
M31 plugin metadata -> M32 bundled plugin catalogs
M33 routine notice inventory -> M34-M36 adapter projections

landed owner declarations from all cohorts
  -> E43 scoped aggregation
  -> E44 review evidence and release promotion
```

Independent owners may work in parallel after their own dependency and owner
gate. Within one owner registry, source/contract work lands before generated
artifacts or adapter projections. Once the core exemplar lands, every later
string-bearing area slice includes its scoped `G45` gate and `G46` refresh
adoption (or evidence that its existing owner workflow already conforms), while
`G47` prevents newly enumerated surfaces from remaining outside that decision.
The slice's inventory and applicable public/internal guidance land alongside
that adoption rather than in the final evidence or documentation packages.

## September 1, 2026 Delivery Packages

The delivery target is a product-completion decision on September 1, 2026.
This forecast packages related registry entries for implementation and review;
a package is not one large pull request. Contract, consumer, generated-catalog,
and evidence changes remain independently reviewable and land in dependency
order inside the package.

Patrick Erichsen is the primary stack reviewer. Semantic, protocol, security,
platform, and publication owners still approve their own boundaries. Those
owner decisions are front-loaded during the foundation package rather than
discovered in the scheduled implementation week.

| Window | Delivery packages | Registry entries | Required outcome |
| --- | --- | --- | --- |
| July 22-24 | `PK0` architecture, foundation, and automation | `F01`, `F03`, `G45`, `G46`, `G47` | Accept RFC direction; land the kernel, contributor contract, shared per-repo gates, trusted refresh exemplar, and new-surface disposition gate; backfill foundation inventory, public workflow indexing, and nearest owner guidance; supervise the first credentialed generated-PR run. |
| July 27-31 | `PK1` initial operator consumers; `PK2` first Gateway edge; `PK3` wizard/setup | `F02`, `F04`, `O07`, `O15`; `F05`, `O06`; `O08`, `O09` | Finish updater and TUI families, approval-not-found plus its generated UI catalog, and remaining owner-bounded wizard/setup families; land each slice's inventory, public workflow index, and nearest owner guidance. |
| August 3-7 | `PK4` CLI shell/agent; `PK5` sessions/tasks/Doctor; `PK6` Gateway families | `O10`, `O11`; `O12`, `O13`, `O14`; `R16`, `R17`, `R18`, `R19` | Land reusable CLI adapters and bounded consumers, then expand only reviewed Gateway discriminator tuples. |
| August 10-14 | `PK7` runtime safety; `PK8` command metadata; `PK9` skill/plugin metadata | `R20`, `R21`, `R22`, `R23`, `R24`; `M25`, `M26`, `M27`, `M28`; `M29`, `M30`, `M31`, `M32` | Complete approval/runtime safety boundaries and land public metadata contracts before their projections. |
| August 17-21 | `PK10` channel notices; `PK11` Control UI; `PK12` native apps | `M33`, `M34`, `M35`, `M36`; `P37`, `P38`; `P39`, `P40` | Finish adapter-owned channel dispositions and extend existing UI/native owner pipelines without replacing them. |
| August 24-28 | `PK13` documentation product surface; `PK14` coverage aggregation and catch-up | `P41`, `P42`; `E43` | Land or prove the localized docs publishing paths, close any slipped package, and publish coverage from landed owner declarations; earlier slice guidance is already required at each slice's merge. |
| August 31-September 1 | `PK15` evidence promotion | `E44` | Ingest current named-review evidence and generated artifacts, disclose accepted platform constraints, and make the qualified or full product claim. |

The packages cover all 47 current entries exactly once. The target operating
cadence is roughly three completed packages per full week with no more than
three packages in active implementation at once. Generated locale follow-ups
belong to the same package as their source family even when repository policy
requires a separate pull request.

For this target, an entry is done only when it is `landed`, source audit proves
it `deleted`, or an existing owner pipeline has current conformance evidence.
`projected`, `draft`, `blocked`, an open generated follow-up, or a schedule-only
`deferred` state is not done. A genuine external platform constraint may close
only with named owner acceptance, fallback evidence, and disclosure in `E44`.
If an owner decision misses its package window, the registry records the
blocker and Patrick reorders independent packages; the blocked entry does not
silently disappear from the September 1 claim.

## Review Findings Applied

The projected registry was evaluated through four tension lenses:

- **Gateway runtime:** planning and coverage stay out of the request path;
  rendering performs no network, model, or catalog-generation work.
- **Operator:** every implementation entry must replace a visible hardcoded or
  duplicated authority; registry maintenance alone is not user value.
- **Simplicity/community:** 47 is an auditable inventory, not a mandated stack,
  new framework, or contributor tax; owner-native catalogs and workflows stay
  authoritative.
- **Security:** safety entries require stable machine semantics, whole-family
  reviewed-English fallback, legitimate recipient locale, bounded public
  metadata, and revision-scoped owner/SecOps review before completion.

## Registry Maintenance

After each landed or abandoned slice:

1. update the state and link the exact PR/head or deletion evidence;
2. record any new owner or compatibility gate discovered by source review;
3. split entries that cross an owner boundary before implementation;
4. add newly discovered product-owned families instead of hiding them from the
   coverage claim; and
5. regenerate release coverage only from landed owner declarations.

The registry is complete as planning evidence when every known family is
landed, explicitly English-only, platform-constrained, deferred with an owner,
or deleted as unnecessary. Product localization is complete only under the
separate coverage and release specifications.
