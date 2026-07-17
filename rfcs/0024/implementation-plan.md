# Localization Implementation Plan

RFC 0024 has five owner-coherent implementation workstreams. A workstream may
land as more than one stacked PR when a smaller renderer-owned slice provides a
cleaner review and proof boundary. Each PR must leave the repository in a usable
state and include the infrastructure required by its first production consumer.

Stack PR numbers are publication order, not workstream identifiers. In
particular, the CLI/TUI workstream is intentionally split across several
bounded PRs rather than absorbing every command surface into one change.

Generated-content language remains a post-v1 follow-up because it changes model
behavior rather than product-owned interface text.

## Evidence Stack As Of 2026-07-17

| Slice | Owner-coherent renderer | State | Evidence |
| --- | --- | --- | --- |
| PR 1 | Core and coverage baseline | Open upstream PR | [openclaw/openclaw#109456](https://github.com/openclaw/openclaw/pull/109456) |
| PR 2 | Runtime safety and Gateway compatibility prototype | Fork draft | [giodl73-repo/openclaw#116](https://github.com/giodl73-repo/openclaw/pull/116) |
| PR 3 | CLI process locale and bounded command rendering | Fork draft | [giodl73-repo/openclaw#117](https://github.com/giodl73-repo/openclaw/pull/117) |
| PR 4 | CLI updater dry-run, progress, result, recovery, and completion rendering | Fork draft | [giodl73-repo/openclaw#118](https://github.com/giodl73-repo/openclaw/pull/118) |
| PR 5 | CLI updater managed-service lifecycle rendering | Local proof-complete branch | `user/giodl/localization-update-service` |

The first five slices validate these cross-cutting rules:

- capture one immutable locale context at the owning command/request entry and
  pass it through nested renderers;
- preserve exact reviewed English for compatibility callers;
- keep human presentation separate from locale-invariant structured output;
- classify parameters as literal data or product-owned presentation;
- localize product-owned enum labels instead of interpolating raw values;
- preserve commands, flags, paths, IDs, PIDs, versions, codes, and raw upstream
  diagnostics;
- add English, non-English, fallback, protected-literal, structured-output, and
  mixed-language interpolation proof for each migrated renderer; and
- stop at service, plugin, Gateway, recipient-locale, and safety-copy ownership
  boundaries.

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
workstream 1 core + coverage baseline
  -> workstream 2 runtime safety + Gateway errors
  -> workstream 3 CLI + TUI
  -> workstream 4 command/channel/skill metadata

workstreams 2-4 -> workstream 5 completeness gates + locale-safe runtime

post-v1 generated content language reuses workstream 1
```

Workstreams 2, 3, and 4 can proceed in parallel after workstream 1.
Workstream 5 closes the release and quality contract after their migrated
surfaces exist.

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
- all 22 existing product locales are registered and reported;
- Gateway errors and channel safety messages localize through stable
  descriptors;
- CLI and TUI human output is localized without destabilizing structured
  output;
- command and skill metadata use one locale-aware contract;
- runtime behavior does not depend on English host prose;
- right-to-left locales set direction and isolate literal commands and IDs;
- missing translations fall back safely to English;
- release artifacts publish an honest localization coverage report; and
- OpenClaw does not claim full product localization until every product-owned
  surface is complete for all 22 locales.
