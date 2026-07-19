# Localization Implementation Plan

RFC 0024 ships as a ten-PR arc: five foundation PRs followed by five completion
PRs. The foundation creates and proves the shared contracts. The completion
stack fills every declared product surface and closes the release matrix.

Generated-content language remains a post-v1 follow-up because it changes model
behavior rather than deterministic product-owned interface text.

## Foundation Stack

The preferred foundation stack is implemented and open for review:

| PR | Scope | Result |
| --- | --- | --- |
| [#134](https://github.com/giodl73-repo/openclaw/pull/134) | Runtime foundation | Shared locale kernel, safety message contracts, Gateway compatibility, and process-scoped CLI rendering. |
| [#135](https://github.com/giodl73-repo/openclaw/pull/135) | Runtime adoption | Updater, service lifecycle, completion-cache, and shell presentation use the shared runtime. |
| [#136](https://github.com/giodl73-repo/openclaw/pull/136) | Governance and inventory | Contributor workflow, generated inventory, maturity states, catalog revisions, and promotion blockers. |
| [#137](https://github.com/giodl73-repo/openclaw/pull/137) | Product surfaces | CLI/TUI, Gateway/UI, channel safety, command, skill, and plugin metadata. |
| [#138](https://github.com/giodl73-repo/openclaw/pull/138) | Convergence and readiness | Cross-surface locale alignment, translation evidence, RTL safety, and fail-closed release reporting. |

The foundation stack validates these cross-cutting rules:

- capture one immutable locale context at the owning command/request entry;
- preserve exact reviewed English for compatibility callers;
- keep human presentation separate from locale-invariant structured output;
- classify parameters as literal data or product-owned presentation;
- preserve commands, flags, paths, IDs, versions, codes, and upstream
  diagnostics;
- render recognized Gateway metadata without changing stable error semantics;
- use whole-message English fallback for incomplete safety catalogs; and
- bind maturity claims to checked artifacts, catalog revisions, and review
  evidence.

Earlier smaller drafts remain development provenance only. Review and delivery
should use #134-#138.

## Completion Stack

The completion stack owns all 15 surfaces and all 315 translation-target cells.
Candidate catalogs may land as `partial`; generated or model-authored copy
cannot attest itself as reviewed.

| PR | Primary scope | Cells | Completion result |
| --- | --- | ---: | --- |
| Completion A | Control UI, onboarding, channel/plugin setup, CLI, and TUI | 105 | The existing AI generated-PR pipeline becomes a shared detect/refresh/enforce gate; every operator-facing surface has complete target catalogs, zero fallback gaps, and script/RTL proof. |
| Completion B | Bounded user-facing runtime and Gateway errors | 42 | An owner-approved error inventory uses stable descriptors, translated edge rendering, and compatible English fallback. |
| Completion C | Server-rendered channels, command metadata, Telegram/Discord menus, and skill metadata | 105 | Every channel and capability surface has explicit locale ownership, complete catalogs, and unchanged stable identity. |
| Completion D | Android, Apple, and docs | 63 | Native quality blockers are cleared, artifacts are current, docs are verified, and Persian/Thai publishing has an explicit disposition. |
| Completion E | Review evidence and release promotion | Product-wide | Named review is bound to exact revisions, eligible cells become complete, and the generated release claim matches the evidence. |

The terminal target is all 313 OpenClaw-controlled cells complete. `docs/fa`
and `docs/th` must either gain an approved publishing path or remain the only
two disclosed external platform constraints. An unqualified `fully-localized`
claim requires all 315 cells to be complete.

## Continuous Translation Maintenance

Completion A generalizes the existing Control UI and native-app locale-refresh
pattern rather than creating a new bot:

- deterministic PR checks detect missing or stale target entries;
- trusted `main`, scheduled, or manual workflows run approved translation
  providers per locale;
- workers publish isolated artifacts that are combined and validated once;
- the generated-PR application opens or updates one reviewable branch;
- registered surfaces declare their source, glossary, generator, outputs, and
  validation command; and
- enforcement demotes stale cells and blocks unsupported completeness claims.

Completion B-D register their catalogs with this contract. Completion E reads
the generated provenance and named review manifests when promoting maturity.
Provider secrets are never exposed to untrusted pull-request code.

## Workstream 1: Localization Core And Coverage Baseline

- Depends on: accepted RFC 0024
- Issues: #28303, #90608, #105266
- Owners: core runtime, Control UI, CLI
- Includes:
  - one dependency-light internal localization kernel shared by browser and
    server adapters;
  - shared locale registry, aliases, fallback chains, and direction;
  - registration of the existing 22-locale OpenClaw product union;
  - locale-driven document language and direction at UI rendering boundaries;
  - `zh-CN` and `zh-TW` canonical IDs with `zh-Hans` and `zh-Hant` aliases;
  - normalized existing Control UI and wizard locale resolution;
  - immutable localization context with provenance;
  - one internal `LocalizedMessage` descriptor and English renderer;
  - bounded top-level plural/select catalog entries using locale plural rules;
  - Control UI and wizard locale-resolution adapters as production consumers;
  - shared key, placeholder, namespace, and fallback validation;
  - checked-in localization coverage manifest;
  - representative script, direction, shaping, and segmentation matrix;
  - advisory hardcoded-string and locale-sensitive parsing inventory;
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
  - unchanged English onboarding and representative UI snapshots;
  - warmed rendering stays within the v1 performance budget.
- Result:
  - the shared kernel exists and has production consumers;
  - current localized surfaces use it without visible behavior changes;
  - coverage can report later migrations from the first PR.

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
#134 foundation
  -> #135 runtime adoption
  -> #136 governance and inventory
  -> #137 product surfaces
  -> #138 convergence and readiness

#138
  -> completion A operator surfaces
  -> completion B runtime and Gateway
  -> completion C channels and metadata
  -> completion D native apps and docs

completion A-D + named review evidence
  -> completion E release promotion
```

Completion A-D can proceed by owner after #138. Completion E closes the product
claim only after their artifacts and named review evidence are current.

## Cross-RFC Alignment

- RFC 0002 owns approval prompt Markdown structure. RFC 0024 localizes labels
  without changing command or Markdown semantics.
- RFC 0017 owns command catalog identity and enumeration. RFC 0024 defines
  localized display metadata.
- Gateway protocol changes remain owned by OpenClaw Gateway maintainers.
- Plugin and skill manifest changes remain owned by plugin/package maintainers.

## V1 Acceptance Criteria

RFC 0024 v1 is complete when:

- the shared locale, descriptor, fallback, and coverage contracts are shipped;
- English plus all 21 translation targets are registered and reported;
- Gateway errors and channel safety messages localize through stable
  descriptors;
- CLI and TUI human output is localized without destabilizing structured
  output;
- command and skill metadata use one locale-aware contract;
- runtime behavior does not depend on English host prose;
- right-to-left locales set direction and isolate literal commands and IDs;
- missing translations fall back safely to English;
- release artifacts publish an honest localization coverage report; and
- all 313 OpenClaw-controlled translation-target cells are complete;
- any remaining `docs/fa` or `docs/th` platform constraint is explicitly
  disclosed; and
- OpenClaw does not claim full product localization until all 315
  translation-target cells are complete.
