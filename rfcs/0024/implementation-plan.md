# Localization Implementation Plan

This plan is ordered by dependency shape. Each slice should be a focused
OpenClaw PR with its own tests and compatibility proof. The plan intentionally
avoids a repository-wide string extraction.

## Slice 0: RFC, Inventory, And Ownership

- Repo: `openclaw/rfcs`, then `openclaw/openclaw`
- Depends on: none
- Work:
  - Accept RFC 0024 and sidecar specifications.
  - Assign owners for core runtime, Gateway protocol, Control UI, CLI, native,
    docs, channels, command catalog, skills, and generated content.
  - Add a source-backed inventory that classifies product text, machine
    identity, user data, external prose, and developer diagnostics.
- Result: one accepted contract and one implementation tracking issue.
- Deletion target: independent umbrella localization requests without an owner
  or slice.

## Slice 1: Locale Registry And Resolution

- Repo: `openclaw/openclaw`
- Depends on: Slice 0
- Issues: #28303, #90608
- Work:
  - Add the shared locale registry, aliases, fallback chains, and direction.
  - Normalize existing Control UI and wizard locale resolution against it
    without changing accepted values.
  - Add provenance to resolved locale context.
  - Decide Chinese canonical IDs or ship aliases only.
- Compatibility:
  - preserve `OPENCLAW_LOCALE`;
  - preserve stored Control UI values;
  - preserve current locale IDs as aliases.
- Proof:
  - alias/canonicalization table tests;
  - process/browser precedence tests;
  - migration tests for stored preferences.

## Slice 2: Message Descriptor And English Renderer

- Repo: `openclaw/openclaw`
- Depends on: Slice 1
- Issues: architecture prerequisite; #105266 informs state isolation
- Work:
  - Add typed `LocalizedMessage`.
  - Add English catalog registration and deterministic fallback.
  - Add placeholder validation and bounded diagnostics.
  - Keep current English output byte-compatible for selected fixtures.
  - Isolate localization state in tests and runtime activation.
- Proof:
  - accepted key;
  - missing key fallback;
  - invalid parameter failure;
  - concurrent locale changes;
  - no Gateway crash on renderer failure.

## Slice 3: Exec Approval Safety Messages

- Repo: `openclaw/openclaw`
- Depends on: Slice 2
- Issue: #81253
- Work:
  - Convert approval labels and explanatory prose to message keys.
  - Keep commands, decisions, IDs, paths, and fences renderer-owned literals.
  - Resolve locale at the final channel/native renderer.
  - Start with English plus one reviewed non-English locale.
- Proof:
  - current English snapshots unchanged;
  - non-English approval fixture;
  - missing-locale fallback;
  - every channel route receives identical action semantics;
  - approval parser never consumes translated prose.
- Owner confirmation:
  - required for any recipient locale preference config or protocol field.

## Slice 4: Gateway Error Localization Metadata

- Repo: `openclaw/openclaw`
- Depends on: Slice 2
- Issues: historical #66056; umbrella #88570
- Work:
  - Add optional `messageKey` and `messageParams` to Gateway error shape.
  - Convert a bounded set of common stable errors.
  - Teach Control UI clients to localize recognized keys and fall back to
    English `message`.
  - Keep unknown exceptions sanitized and English.
- Proof:
  - old client fixture;
  - new localized client fixture;
  - inventory of supported clients and proof that unknown optional fields are
    accepted or the client is updated before shipment;
  - unknown-key fallback;
  - no client branching on translated text;
  - protocol compatibility review;
  - emergency removal of one key mapping falls back to English without a
    protocol or server rollback.
- Owner confirmation:
  - Gateway protocol owner must approve the new optional fields.

## Slice 5: CLI Runtime Catalog

- Repo: `openclaw/openclaw`
- Depends on: Slices 1 and 2
- Issue: #88570
- Work:
  - Extend localization beyond onboarding.
  - Start with top-level help, validation, status summaries, and common command
    failures.
  - Preserve stable `--json` output and add structured modes before localizing
    prose currently consumed by scripts.
  - Classify internal exceptions separately from user-facing guidance.
- Sequence:
  1. root help and shared option validation;
  2. status/health;
  3. sessions and cron;
  4. agents, channels, plugins, skills;
  5. remaining command-owned errors.
- Proof:
  - English compatibility snapshots;
  - locale snapshots;
  - structured-output invariance;
  - no translated-text parsing.

## Slice 6: Command Metadata And Channel Menus

- Repos: `openclaw/openclaw`; align with RFC 0017
- Depends on: Slice 1
- Issues: #79458, #55239; landed precedent #56580
- Work:
  - Add `LocalizedText` descriptions to the command catalog.
  - Generalize Discord `descriptionLocalizations`.
  - Add Telegram locale projections.
  - Project the same descriptions into CLI, TUI, and Control UI.
- Proof:
  - platform length/locale validation;
  - reconcile idempotence;
  - stable command names;
  - fallback for unsupported platform locales.

## Slice 7: Skill And Plugin Metadata

- Repo: `openclaw/openclaw`
- Depends on: Slice 1 and package schema owner approval
- Issue: #89971
- Work:
  - Add localized display name and description fields.
  - Keep package, folder, invocation, and tool IDs stable.
  - Add bundled-skill catalogs.
  - Let external packages own their translations without implying review.
  - Index localized text for search while resolving installs by stable ID.
- Proof:
  - schema compatibility;
  - package round trip;
  - locale fallback;
  - duplicate alias rejection;
  - no effect on invocation or policy.
- Owner confirmation:
  - required because manifest and plugin SDK fields are public surfaces.

## Post-v1 Slice 8: Generated Content Language

- Repo: `openclaw/openclaw`
- Depends on: Slice 1; independent of runtime message rendering after that
- Issues: #79223, #101314, remaining portion of #53345
- V1 status: not required for RFC 0024 runtime acceptance
- Work:
  - Define explicit content-language input for Dreaming.
  - Localize deterministic journal headings/status labels through runtime
    catalogs.
  - Pass language intent to model prompts without rewriting existing content.
  - Keep UI locale and assistant response language separate.
- Proof:
  - explicit language fixture;
  - absent-language current behavior;
  - mixed-locale workspace behavior;
  - provenance in generated artifact metadata where applicable.

## Slice 9: Coverage Manifest And Completeness Gates

- Repo: `openclaw/openclaw`
- Depends on: Slices 1 and 2; can begin advisory earlier
- Issues: #78038, #88570, #107851, #105266
- Work:
  - Add localization coverage manifest and report.
  - Join current UI, native, docs, wizard, runtime, CLI, and metadata surfaces.
  - Enforce parity and placeholder checks.
  - Report fallback and untranslated English.
  - Add safety-review status.
  - Promote checks to blocking per complete surface/locale.
- Proof:
  - one intentionally missing key;
  - one placeholder mismatch;
  - one stale generated artifact;
  - one unreviewed safety string;
  - complete/partial state transitions;
  - every advisory migration finding has an owner and `reviewBy` boundary; and
  - an expired advisory either becomes blocking or removes the completeness
    claim.

## Slice 10: Locale-Safe Runtime Audit

- Repo: `openclaw/openclaw`
- Depends on: none; report joins Slice 9
- Issue: #106576 and similar host-locale failures
- Work:
  - Find runtime branches that match English OS/dependency prose.
  - Replace them with error codes, exit status, structured fields, or
    deterministic probes.
  - Add non-English host-locale CI fixtures where practical.
- Proof:
  - localized host reproduction;
  - same structured result under English and non-English environments.

## Slice 11: Locale Expansion And Quality

- Repo: `openclaw/openclaw`
- Depends on: Slice 9
- Issues: #78038, #88570, future focused quality issues
- Work:
  - Promote locale/surface pairs from partial to complete.
  - Prioritize safety, authentication, onboarding, primary chat, status, and
    recovery before low-frequency settings.
  - Maintain glossaries and human review.
  - Avoid adding a locale to one surface without manifesting gaps elsewhere.
- Result: release claims become explicit and auditable.

## Proposed Stack

```text
0024 accepted
  -> locale registry
      -> message descriptor
          -> exec approvals
          -> Gateway errors
          -> CLI catalog
      -> command metadata
      -> skill metadata
  -> coverage manifest/report
      -> completeness gates
      -> locale expansion

locale-safe runtime audit can proceed independently
generated content language follows as a post-v1 extension
```

## Cross-RFC Alignment

- RFC 0002 owns approval prompt Markdown structure. RFC 0024 localizes labels
  without changing command or Markdown semantics.
- RFC 0017 owns command catalog identity and enumeration. RFC 0024 defines
  localized display metadata.
- Gateway protocol changes remain owned by OpenClaw Gateway maintainers.
- Plugin and skill manifest changes remain owned by plugin/package maintainers.

## V1 Acceptance Criteria

RFC 0024 v1 is implementable when:

- every finite product-owned user-facing string is cataloged or explicitly
  classified for the migrated v1 surfaces;
- Gateway errors and channel safety messages localize through stable
  descriptors;
- CLI human output is localized without destabilizing structured output;
- command and skill metadata use one locale-aware contract;
- runtime behavior does not depend on English host prose;
- missing translations fall back safely to English; and
- release artifacts publish the localization coverage report.
