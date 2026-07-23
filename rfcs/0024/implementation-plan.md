# Localization Implementation Plan

RFC 0024 ships through serial owner-scoped vertical slices. It does not require
a fixed PR count, a cumulative stack, or completion of the product translation
matrix before the architecture can be accepted.

Generated-content language remains a post-v1 follow-up because it changes model
behavior rather than deterministic product-owned interface text.

The auditable delivery queue is the
[projected owner slice registry](projected-owner-slice-registry.md). Its current
47 entries apply the same planning pattern as a structured health-rule
registry: every known family has an owner, gate, proof bar, and deletion target.
The first audit had 44 entries; owner review split the previously implicit
authoring-gate and generated-refresh obligations into `G45` and `G46`, then
follow-up review added the new-surface adoption gate as `G47`.
The number is not fixed. Source audit may delete, split, or add entries without
changing the runtime contract.

## Existing Drafts

The five current drafts have been reduced to bounded intended deltas. They
remain draft implementation evidence until their named owners approve them:

| Registry entry | Draft | Intended review delta | Delivery disposition |
| --- | --- | --- | --- |
| `F01` | [#111541](https://github.com/openclaw/openclaw/pull/111541) | Minimal kernel and onboarding consumer | Land only after core and wizard owner review; no coverage or public metadata contract. |
| `F02` | [#111542](https://github.com/openclaw/openclaw/pull/111542) | Updater human dry-run preview | Preserve JSON and operational literals; updater owner approves the final edge. |
| `F03` | [#111543](https://github.com/openclaw/openclaw/pull/111543) | Contributor ownership guide | Document owner-native workflows without introducing mandatory coverage gates. |
| `F04` | [#111544](https://github.com/openclaw/openclaw/pull/111544) | TUI status summary and relative ages | Keep other TUI, CLI, Gateway, metadata, and channel families separate. |
| `F05` | [#111545](https://github.com/openclaw/openclaw/pull/111545) | One protocol-owned approval-not-found descriptor and Control UI edge | Generated target catalogs follow separately through the Control UI workflow; product readiness remains deferred. |

## End State Of RFC Acceptance And The Five Drafts

RFC acceptance approves contracts and owner gates; it does not change runtime
behavior. Landing `F01` through `F05` in dependency order provides:

- an internal locale/context kernel whose JavaScript and TypeScript ICU
  formatting delegates to `intl-messageformat`;
- the existing wizard as the first foundation consumer;
- bounded updater dry-run and TUI status localization;
- one reviewed Gateway descriptor and Control UI approval-error edge; and
- contributor guidance for adding later owner-scoped families.

The coverage specification defines the eventual language-by-surface reporting
shape, but these drafts neither install a closed global reporting matrix nor
claim completion for unadopted surfaces. Owner declarations and aggregate
reporting begin later in `E43`; review evidence and release promotion follow in
`E44`.

The five runtime drafts do not prove the reusable CI and translation-authoring
loop. Draft OpenClaw PR
[#112784](https://github.com/openclaw/openclaw/pull/112784) implements `G45`
and `G46` together: change one routine English source message, observe
deterministic CI detect the stale target, run trusted asynchronous generation
and validation, and open a generated pull request. Later owners adopt that lane
only for their declared families, namespaces, or directories, with both the
scoped gate and owner-owned refresh configured in the same adoption slice.
Its review branch contains `F01`, the exact five-file `F03` ownership delta,
and the 17-file exemplar; unrelated updater, TUI, Gateway, and approval runtime
ancestry is excluded. Landing preparation may drop the carried `F03` commits
after that documentation slice merges.
Draft OpenClaw PR
[#112801](https://github.com/openclaw/openclaw/pull/112801) implements `G47` as
a separate build-time guard so a newly introduced product-string surface cannot
bypass that decision by never entering an owner registry.

## Serial Foundation Plan

### Slice 1: minimal kernel and existing consumer

- locale registry, exact/inferred resolution, and immutable context;
- descriptor, reviewed English fallback template, `intl-messageformat`
  rendering for shared JavaScript and TypeScript catalogs, and literal
  isolation;
- catalog and placeholder validation;
- one existing Control UI or onboarding consumer; and
- accepted, fallback, locale-isolation, compatibility, and deletion proof.

It excludes Gateway metadata, capability metadata, the 15-surface portfolio,
readiness reports, broad CLI/TUI extraction, and a public plugin catalog API.

### Slice 2: one owner-approved safety path

After Gateway-owner approval, prove `APPROVAL_NOT_FOUND` end to end:

- one shared protocol-owned descriptor;
- bounded optional `details.localization` metadata;
- unchanged English code/message behavior for legacy clients;
- Control UI edge rendering;
- an English source key plus malformed, missing-key, privacy, and old-client
  fixtures; and
- a separate generated-locale follow-up through the owning Control UI workflow,
  with named safety review before any locale/surface pair becomes `complete`.

### Slice 3: updater-owned CLI adoption

Rework the bounded updater changes from #111542 onto Slice 1. Keep JSON,
commands, flags, paths, versions, status/reason values, stderr, and exit behavior
locale-invariant. Delete the replaced updater presentation path.

### Slice 4: one bounded TUI family

Adopt one owner-approved family such as status or recovery. Do not combine this
with command metadata, skills, plugins, channels, or a whole-TUI migration.

### Independent owner tracks

After their public contracts are approved, these tracks proceed independently:

- command metadata and per-platform projection;
- skill metadata;
- plugin metadata and host-version negotiation;
- Telegram and Discord command menus;
- additional runtime and Gateway error families; and
- channel safety messages only where a legitimate recipient locale exists.

No track is blocked on a global readiness PR, and no track changes another
owner's schema merely to satisfy localization-core.

The current 47-entry registry assigns these tracks to `F01`-`G47`. It is the
planning source for follow-up PR selection. Pick the earliest entry whose owner
and dependency gates are satisfied; do not select work merely to advance the
numeric count.

## Repair And Adoption Rule

Each implementation PR is reviewed as:

```text
one semantic owner
+ one rendering owner
+ one authoritative descriptor boundary
+ one authoritative locale boundary
+ one accepted and one fallback/failure fixture
+ one compatibility and privacy proof
+ one deleted presentation workaround
+ one scoped authoring gate and owner-owned generated refresh path when the
  slice adds or migrates deterministic product strings
```

The PR description or focused tests record the corresponding conformance
evidence. Shared localization machinery is not acceptance by itself.

Stop the slice when no owner can approve stable meaning, no legitimate locale
exists, safety review is missing, stable machine output would change, or the
old authority cannot be removed. Preserve reviewed English, keep the surface
incomplete, and do not widen localization core to compensate.

## Completion Cohorts

Completion names are tracking cohorts, not single PRs or a linear stack:

| Cohort | Primary scope | Product target |
| --- | --- | --- |
| Operator surfaces | Control UI, onboarding, channel/plugin setup, CLI, and TUI | `F01`-`F04`, `O06`-`O15`, and `P37`-`P38` track owner-scoped migrations and catalog waves. |
| Runtime safety | Bounded user-facing runtime and Gateway errors | `F05` and `R16`-`R24` use owner-approved descriptors, edge rendering, and compatible English fallback. |
| Channels and capabilities | Server-rendered channels, command menus, command metadata, and skill/plugin metadata | `M25`-`M36` land each public contract and locale authority independently. |
| Native and docs | Android, Apple, and documentation | `P39`-`P42` extend existing owner pipelines and record the Persian/Thai disposition. |
| Authoring automation | Shared tooling plus each adopting owner | `G45`-`G46` prove scoped deterministic enforcement and trusted generated-PR refresh; `G47` requires a disposition for newly introduced product-string surfaces. |
| Release promotion | Product-wide | `E43`-`E44` aggregate only landed scoped evidence and produce an honest release claim. |

The current product-policy target is all 313 OpenClaw-controlled cells complete.
`docs/fa` and `docs/th` must either gain an approved publishing path or remain
the only two disclosed external platform constraints. An unqualified
`fully-localized` claim requires all 315 cells to be complete. None of these
counts is an RFC-acceptance condition.

## Continuous Translation Maintenance

Owner cohorts generalize existing Control UI, native-app, and docs refresh
patterns rather than creating a new translation service:

- define a common minimum translation-run evidence record when a second owner
  needs to consume or aggregate it;
- deterministic owner checks detect missing or stale target entries;
- trusted `main`, scheduled, or manual workflows run approved translation
  providers per locale;
- owner workflows retain extraction, validation, publication, and auto-merge
  policy; and
- generated or model-authored copy cannot attest itself as reviewed.

`openclaw/docs` continues to check out an exact `openclaw/openclaw` revision and
run the source-owned translator. Native translation continues to reuse the
Control UI translation client. The release cohort reads their scoped evidence;
it does not copy their catalogs or translation memory into a central service.
Provider secrets are never exposed to untrusted pull-request code.

### Core end-to-end exemplar

`G45` and `G46` establish the reusable reference path before broad owner
adoption. One routine, non-safety message family must prove:

1. an English source edit is detected on an untrusted pull request without
   provider credentials;
2. the migrated scope fails its deterministic gate while the target catalog is
   missing, stale, malformed, or violates ICU/placeholders/protected literals;
3. a trusted exact-source workflow generates one locale candidate;
4. validation succeeds before publication and records source-pinned generation
   evidence;
5. the existing generated-PR publisher opens or updates a reviewable pull
   request rather than pushing directly; and
6. failed or stale generation publishes nothing and leaves the affected cell
   partial.

The exemplar proves plumbing, not linguistic completion. Its generated output
does not approve itself, and safety families require their stricter owner and
review policy before adopting the same lane.

`G47` then proves initial adoption without pretending arbitrary string literals
are classifiable. Each owner adapter enumerates real product-surface
registrations or declared product-facing source roots. The gate compares newly
added scopes with the checked-in localization disposition inventory and fails
until each scope is one of:

- adopted with catalog source, targets, and validation;
- served by an existing owner pipeline that demonstrates conformance; or
- explicitly English-only, platform-constrained, or deferred with a named
  owner and rationale.

The initial implementation baselines existing unclassified scopes as legacy
debt and gates additions or scope expansions only. It does not scan tests, logs,
developer diagnostics, model-authored text, or all source literals. One fixture
must prove that adding an enumerated surface fails before classification and
passes after a valid disposition is added.

After the exemplar lands, every subsequent slice that adds or migrates
deterministic product strings must leave its area enrolled end to end. The PR
defines the adopted family, namespace, or directory; enables its blocking
credential-free gate; and configures the area's trusted asynchronous refresh,
validation, evidence, and generated-PR path. Existing Control UI, native, or
docs pipelines satisfy this requirement by proving conformance, not by being
replaced. A schema-only, explicitly English-only, or deferred slice records why
no translated catalog is enrolled.

## Workstream 1: Minimal Localization Core

- Depends on: accepted RFC 0024
- Issues: #28303, #90608, #105266
- Owners: core runtime plus one existing consumer owner
- Includes:
  - one dependency-light internal localization kernel shared by browser and
    server adapters;
  - shared locale registry, aliases, fallback chains, and direction;
  - registration of the existing 22-locale OpenClaw product union;
  - locale-driven language and direction at the selected rendering boundary;
  - `zh-CN` and `zh-TW` canonical IDs with `zh-Hans` and `zh-Hant` aliases;
  - normalized locale resolution for one selected existing consumer;
  - immutable localization context with provenance;
  - one internal `LocalizedMessage` descriptor and English renderer;
  - bounded top-level plural/select catalog entries using locale plural rules;
  - one Control UI or wizard locale-resolution adapter as a production
    consumer;
  - shared key, placeholder, namespace, and fallback validation;
  - representative script, direction, shaping, and segmentation matrix;
  - catalog revision identity and locale-state isolation fixes.
- Compatibility:
  - preserve `OPENCLAW_LOCALE`;
  - preserve stored Control UI preferences;
  - preserve existing locale IDs and English output;
  - perform no runtime catalog I/O or network access.
- Proof:
  - locale alias and precedence matrix;
  - Arabic and Persian document `lang`/`dir` behavior;
  - bounded Hebrew, additional Indic, Khmer or Myanmar, and Ethiopic fixtures;
  - one accepted descriptor and one missing-key fallback;
  - English, Russian/Ukrainian, Polish, and Arabic plural-category fixtures;
  - invalid placeholder and namespace failures;
  - render-path denial of filesystem, network, environment, and storage access;
  - parallel locale isolation with no process-global locale bleed;
  - concurrent locale changes and catalog replacement;
  - unchanged English snapshots for the selected consumer; and
  - a reproducible warmed benchmark report before any numeric gate is adopted.
- Result:
  - the shared kernel exists with one production consumer;
  - that consumer uses it without visible English behavior changes; and
  - later owners can adopt it without broadening the kernel.

## Workstream 2: Runtime Safety Messages And Gateway Errors

- Depends on: workstream 1
- Issues: #81253, deterministic-label portion of #101314, historical #66056,
  umbrella #88570
- Owners: Gateway protocol, channels, Control UI, security copy
- Includes:
  - localized exec approval labels and explanatory prose;
  - deterministic product-owned runtime labels, including Dreaming journal
    headings and status text, without changing generated prose language;
  - renderer-owned literal commands, decisions, IDs, paths, and Markdown;
  - recipient locale resolution from an existing explicit preference or
    owner-approved request field, with reviewed English otherwise;
  - optional Gateway `details.localization` projection containing a recognized
    `messageKey` and bounded scalar `messageParams`;
  - bounded conversion of common stable Gateway errors;
  - Control UI localization of recognized errors with English fallback;
  - revision-bound safety-review attestation for the initial non-English
    locale.
- Compatibility:
  - retain Gateway `code` and English `message`;
  - inventory supported clients and update any strict parser before shipping;
  - preserve approval action set, ordering, routing, and authorization;
  - unknown errors remain sanitized English.
- Proof:
  - current English approval snapshots unchanged;
  - one human-reviewed non-English approval fixture;
  - missing-key and emergency English fallback;
  - incomplete safety catalogs collapse the whole presentation to one reviewed
    English snapshot rather than mixing languages;
  - old-client and new-client Gateway fixtures;
  - unknown optional fields accepted by supported clients;
  - producer and Control UI consume one reviewed Gateway message-key registry;
  - duplicate Gateway localization projection is idempotent and never
    overwrites existing metadata;
  - checked supported-client/parser compatibility matrix;
  - identical approval semantics across every channel route;
  - RTL literal isolation and forbidden bidi-control checks.
- Result:
  - the highest-risk runtime gap is solved end to end;
  - the descriptor and Gateway compatibility model are proven by real users.

## Workstream 3: CLI And TUI Localization

- Depends on: workstream 1
- Issue: #88570
- Owners: CLI and command owners
- Includes:
  - root help and shared option validation;
  - TUI navigation, help, status, validation, and recovery text;
  - status, health, and recovery summaries;
  - sessions and cron human-readable output;
  - agents, channels, plugins, and skills human-readable output;
  - common command-owned validation and failure guidance;
  - explicit classification of developer-only exceptions;
  - structured output preservation or addition where scripts currently parse
    prose.
- Compatibility:
  - preserve `--json` and other machine-readable output;
  - preserve command names, flags, config keys, IDs, paths, and provider/model
    names;
  - retain English fallback for every migrated message.
- Proof:
  - English and one non-English command snapshot matrix;
  - structured-output invariance;
  - one immutable context for each command execution;
  - catalog-backed presentation labels for modes, phases, statuses, and other
    human-facing enum values;
  - protected literal preservation for commands, flags, paths, IDs, PIDs,
    versions, codes, and raw upstream diagnostics;
  - mixed-language interpolation regressions;
  - no translated-text parsing;
  - missing catalog and renderer failure fallback;
  - hardcoded-string findings become blocking for migrated CLI directories.
- Result:
  - onboarding is no longer the only localized CLI/TUI experience;
  - automation remains stable while human output follows locale.

## Workstream 4: Localized Command, Channel, And Skill Metadata

- Depends on: workstream 1; aligns with RFC 0017
- Issues: #79458, #55239, #89971; landed precedent #56580
- Owners: command catalog, channel adapters, plugin/package SDK
- Includes:
  - optional `LocalizedText` in the command catalog;
  - generalized Discord description localization;
  - Telegram native command-menu localization;
  - CLI, TUI, and Control UI projection from the same command metadata;
  - optional localized skill display names and descriptions;
  - bundled-skill catalogs and external-package validation;
  - external localized metadata with host capability/version negotiation;
  - localized search indexing while installs and policy use stable IDs.
- Compatibility:
  - existing plain-English commands and all published skills remain valid;
  - command, package, folder, invocation, skill, and tool IDs remain literal;
  - metadata cannot change execution, permissions, routing, or policy;
  - unsupported platform locales use deterministic fallback.
- Proof:
  - schema and package round trips;
  - platform length and locale validation;
  - native command reconcile idempotence;
  - duplicate locale alias rejection;
  - no effect on invocation or policy;
  - plugin/core namespace ownership enforcement.
- Result:
  - one metadata source feeds UI, CLI, TUI, Discord, and Telegram;
  - package authors can add translations without a forced migration.

## Workstream 5: Completeness Gates And Locale-Safe Runtime

- Depends on: workstreams 1-4
- Issues: #78038, #88570, #107851, #106576 and later quality issues
- Owners: release, localization pipeline, affected runtime owners
- Includes:
  - product-level coverage report across UI, native, docs, wizard, runtime,
    CLI, TUI, notifications, core/bundled command and skill metadata, and
    per-adapter native command-menu projections;
  - blocking key, placeholder, namespace, generated-artifact, and safety-review
    checks for complete surfaces;
  - fallback and untranslated-English reporting;
  - pseudo-locale expansion and right-to-left layout fixtures;
  - representative conformance report separate from release-locale claims;
  - owner and `reviewBy` boundary for every remaining advisory migration;
  - removal of English OS/dependency prose matching where structured signals
    exist;
  - non-English host-locale fixtures;
  - first explicit locale/surface maturity promotions;
  - per-artifact localization status and deployment drift diagnostics.
- Proof:
  - intentionally missing key;
  - placeholder mismatch;
  - stale generated artifact;
  - unreviewed safety string;
  - expired advisory that becomes blocking or removes the completeness claim;
  - same runtime result under English and non-English host locales;
  - complete, partial, experimental, platform-constrained, and unsupported
    report rows.
- Result:
  - OpenClaw can make honest release-level localization claims;
  - localized host behavior no longer depends on English prose;
  - future locale expansion is translation and quality work, not architecture.

## Post-v1 Follow-Up: Generated Content Language

- Issues: #79223, generated-content portion of #101314, remaining portion of
  #53345
- Reuses: workstream 1 locale registry and workstream 2 runtime labels
- Includes:
  - explicit content-language input for Dreaming;
  - model prompt language intent without rewriting existing content;
  - separation from Control UI locale and assistant default language.

This follow-up is not required to accept or complete the v1 product-localization
runtime.

## Dependency Shape

```text
accepted locale/descriptor/fallback contract
  -> minimal kernel + existing consumer
       -> updater-owned adoption
       -> bounded TUI family
       -> owner-approved Gateway safety slice

owner-approved public contracts
  -> command metadata
  -> skill/plugin metadata
  -> channel and native menu projections

landed owner declarations + scoped review evidence
  -> coverage aggregation
  -> release promotion
```

Owner cohorts can proceed independently after the minimal kernel and their own
public contract approvals. Release promotion closes the product claim only
after landed artifacts and scoped named-review evidence are current.

## Cross-RFC Alignment

- RFC 0002 owns approval prompt Markdown structure. RFC 0024 localizes labels
  without changing command or Markdown semantics.
- RFC 0017 owns command catalog identity and enumeration. RFC 0024 defines
  localized display metadata.
- Gateway protocol changes remain owned by OpenClaw Gateway maintainers.
- Plugin and skill manifest changes remain owned by plugin/package maintainers.

## Acceptance Criteria

### RFC acceptance

RFC 0024 can be accepted when owners approve:

- locale identity, precedence, immutable context, and fallback semantics;
- the stable descriptor, typed parameter, and edge-rendering model;
- locale-invariant machine identities and structured output;
- the minimum maturity and scoped-evidence meanings; and
- explicit owner gates for Gateway, recipient locale, command, skill, and
  plugin public surfaces.

### Foundation shipped

The foundation is shipped when:

- the minimal kernel and one existing owner-controlled consumer land;
- reviewed English fallback templates are rendered at the edge;
- right-to-left literal isolation and missing-key fallback are proven;
- adopted slices include accepted, fallback/failure, compatibility, privacy,
  rollback, and deletion evidence; and
- public diagnostics remain bounded and content-free by default.

### Product completion

Product completion is a later release-policy decision. It requires an honest
coverage report, current generated artifacts, scoped named review, disclosure
of any platform constraints, and the chosen 313/315 or 315/315 target. It is
not required to accept the RFC or ship the runtime foundation.
