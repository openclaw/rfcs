# Localization Coverage v1 Specification

This document defines the product-level inventory, maturity, validation, and
release-reporting contract for RFC 0024.

Status: draft, tied to RFC 0024.

## Coverage Manifest

OpenClaw checks in one localization coverage manifest. The exact path is an
implementation decision. This abbreviated example omits the other required
release-locale rows:

```yaml
version: 1
localeRegistry: <path to shared registry>
registryRevision: <registry content hash>
testFixtures:
  pseudo-expanded:
    kind: expansion
    direction: ltr
  pseudo-bidi:
    kind: bidirectional
    direction: rtl
surfaces:
  control-ui:
    owner: ui
    artifactId: control-ui-web
    catalogRevision: <catalog content hash>
    source: ui/src/i18n/locales/en.ts
    catalogs: ui/src/i18n/locales
    contentClasses: [general]
    locales:
      en:
        maturity: source
      zh-CN:
        maturity: complete
        languageOwner: <owner>
      sv:
        maturity: unsupported
  runtime:
    owner: core
    artifactId: openclaw-runtime
    catalogRevision: <catalog content hash>
    source: src/localization/locales/en.ts
    catalogs: src/localization/locales
    contentClasses: [safety, security, recovery]
    locales:
      en:
        maturity: source
      zh-CN:
        maturity: partial
        languageOwner: <owner>
      sv:
        maturity: unsupported
```

The coverage manifest references the shared locale registry rather than
duplicating aliases, fallback, direction, or source-locale data. The checked-in
schema must validate the registry reference and revision, locale state keys,
test-fixture IDs, paths, owners, artifact IDs, per-artifact catalog revisions,
content classes, and maturity states. Every surface must contain one state row
for every release locale in the referenced registry. Missing rows are schema
errors rather than implicit `unsupported` states. Test fixtures are a separate
set and never receive surface maturity rows.

### Surface ownership and aggregation

The localization-core package defines generic manifest validation, maturity
semantics, derived checks, and promotion blockers. It must not contain a closed
union of Control UI, CLI, TUI, channel, plugin, skill, native-app, or
documentation surface IDs.

Each product owner publishes a build-time surface declaration with:

- a stable lowercase kebab-case surface ID;
- deterministic product-report order;
- owner and artifact identity;
- source, catalog, and revision paths;
- migration state and validation command;
- content classes; and
- locale artifact discovery or explicit supported-locale evidence.

The declaration owner is accountable for that surface's catalog, rendering,
artifact, and coverage evidence. It does not take semantic ownership from the
Gateway, command, approval, runtime, policy, or other domain that defines the
message meaning.

The product aggregation layer consumes every owner/domain declaration. It must
fail on duplicate surface IDs, duplicate order claims, missing declared paths,
or declared locale support without a corresponding artifact. The generated
manifest does not persist the declaration order field; order only makes the
checked report deterministic.

The current RFC 0024 release portfolio contains 15 owner-declared product
surfaces. That portfolio and its 315 target cells are product release policy,
not a closed type restriction in localization core. A future owner can publish
a valid new surface without modifying generic core validation, while changing
the required release portfolio remains an explicit product-policy change.

`manifestRevision` is computed from the canonical checked-in manifest bytes and
is not stored inside that manifest. Release reports, attestations, and packaged
status expose the computed revision.

`contentClasses` uses this closed v1 set:

```text
general
safety
security
authentication
authorization
destructive-action
privacy
recovery
generated
```

Checks are derived from maturity and content class, not selected by each
surface:

- every `complete` pair requires key parity, placeholder parity, fallback
  reporting with zero untranslated fallback, namespace ownership, and
  locale-state isolation;
- `generated` content additionally requires generated-artifact parity;
- `safety`, `security`, `authentication`, `authorization`,
  `destructive-action`, `privacy`, and `recovery` content additionally requires
  human-review attestation for that locale and revision; and
- a migrated surface cannot become `complete` while its owned source directory
  has unresolved blocking hardcoded-string findings.

The schema rejects a manifest that omits any derived requirement. New content
classes or check identities require a schema change rather than an ad hoc
string.

## Surface Set

The initial product report covers:

- Control UI;
- CLI onboarding;
- channel and plugin setup flows;
- remaining CLI commands and help;
- TUI human-readable output;
- core runtime messages, approvals, authentication, validation, and recovery
  guidance;
- Gateway errors;
- server-rendered channel messages and notifications;
- core and bundled command metadata;
- bundled channel command-menu projections, tracked separately for each
  adapter such as Telegram and Discord;
- core and bundled skill metadata;
- Android;
- Apple platforms;
- documentation.

Surfaces can have different catalogs and supported locale sets. A shared
metadata catalog and each product-owned platform projection are separate
coverage surfaces because platform limits, locale support, and reconcile
behavior can independently reject or drop localized text.
Generated-content language is post-v1 and is not part of this initial coverage
report or the product-localization completeness claim.

## Initial Locale Baseline

V1 registers this exact existing product set:

```text
en, zh-CN, zh-TW, pt-BR, de, es, ja-JP, ko, fr, hi, ar, it, tr, uk,
id, pl, th, vi, nl, fa, ru, sv
```

`en` is the source locale. The other 21 are translation targets. Registration
does not imply that every surface is complete on day one; the manifest records
the maturity of every locale/surface pair. Swedish is included because it
already ships in the native-app localization inventory, even though Control UI
and documentation do not currently support it.

The product-level phrase "fully localized" is valid only when English source
and every product-owned surface are `complete` for all 21 translation targets.
Surface-specific claims remain valid when they name the surface and satisfy
its complete-state rules.
Platform projections may instead be `platform-constrained` where an upstream
API cannot represent a product locale. That state must be disclosed and blocks
the unqualified phrase "fully localized," but it does not imply an OpenClaw
catalog or adapter defect.

The locale set is OpenClaw-owned. V1 does not inherit a translation service,
vendor, downstream product, or enterprise language-set target. New release
locales require user demand, catalog and reviewer ownership, fallback and
formatting support, and an explicit initial maturity state.

The initial set is not a comprehensive language-coverage claim. The coverage
report must expose language, script, direction, and regional gaps so future
locale additions can be prioritized by OpenClaw users and maintainers.

The v1 manifest contains 15 English source rows plus 15 product surfaces across
21 translation targets. Release completion is calculated over those 315
translation-target cells. The completion target is all 313
OpenClaw-controlled target cells at `complete`. `docs/fa` and `docs/th` must
either gain an approved publishing path or remain the only disclosed
`platform-constrained` cells. An unqualified `fully-localized` claim requires
all 315 target cells to be complete.

Pseudo-locales and bounded script fixtures are declared under
`testFixtures`, not the release locale registry. They support expansion,
truncation, interpolation, bidirectional, mirrored-layout, shaping, and
segmentation testing. They never appear in language selectors, surface
maturity rows, or product completeness calculations.

## Representative Conformance

Release locales and engineering fixtures serve different purposes. The
conformance matrix must cover:

| Dimension | V1 representative |
| --- | --- |
| Long Latin expansion | German and an expanded pseudo-locale |
| Cyrillic and plural variation | Russian or Ukrainian |
| Simplified and Traditional Han | `zh-CN` and `zh-TW` |
| Japanese segmentation | `ja-JP` |
| Hangul | `ko` |
| Indic shaping | `hi`, plus a Bengali or Tamil fixture |
| Unspaced Southeast Asian text | `th`, plus a Khmer or Myanmar fixture |
| Right-to-left Arabic-derived script | `ar` and `fa` |
| Right-to-left non-Arabic script | a Hebrew fixture |
| Ethiopic shaping | an Amharic fixture |
| Bidirectional literal isolation | mirrored pseudo-locale with commands, IDs, paths, and numbers |

Fixtures that are not release locales contain bounded test text rather than a
product catalog. They must never appear in language selectors or coverage
claims. Promoting one to a release locale requires normal catalog ownership,
fallback, review, and maturity rules.

## Required Product Depth

The product report groups required surfaces by user experience:

| Experience | Surfaces |
| --- | --- |
| Discover and install | Documentation, installation guidance, first-run failures |
| Configure and onboard | CLI wizard, channel setup, plugin setup, validation and recovery guidance |
| Operate | CLI and TUI help/status, Control UI, native apps, configuration and task output |
| Interact | Server-rendered channel messages, notifications, native command menus, and core/bundled command and skill metadata |
| Approve and recover | Approval prompts, Gateway errors, authentication failures, doctor and repair guidance |

Every product-owned surface declaration must appear in the generated manifest
even when its current state is `unsupported`. A locale cannot become
product-complete by omitting an untranslated surface from the report. External
plugin and skill metadata is reported separately when available and never
blocks an OpenClaw product completeness claim.

## Translation Provenance And Review

Model-assisted translation is allowed only as a catalog-authoring step.
Deterministic product messages must never depend on a runtime model call.

Generated text remains `partial` or `experimental` until the surface satisfies
its review policy. A `complete` locale/surface pair requires:

- checked-in catalog output and reproducible revision identity;
- source, glossary, workflow, and generator provenance when generated;
- key, placeholder, fallback, and generated-artifact parity;
- a named language owner;
- full human review of safety, security, authentication, authorization,
  destructive-action, privacy, and recovery messages; and
- documented linguistic review or sampling for lower-risk copy.

Translation automation may accelerate coverage, but it cannot self-attest
quality or promote a maturity state.

### Translation-run evidence

Every generated candidate wave emits a checked, content-free evidence record.
This record is separate from the runtime catalog and does not add provider
fields to `LocalizationContext` or `LocalizedMessage`.

```yaml
version: 1
surface: <owner surface ID>
locale: <canonical target locale>
source:
  repository: <owner/name>
  revision: <exact protected-source commit>
  contentRevision: <source inventory or catalog hash>
  glossaryRevision: <glossary hash or none>
generator:
  repository: <owner/name>
  workflow: <workflow identity>
  revision: <generator/tool revision>
  provider: <provider ID>
  model: <model ID>
artifact:
  identity: <owner artifact ID>
  revision: <generated artifact hash>
validation:
  command: <deterministic owner command>
  status: passed
```

Requirements:

- `source.revision` identifies an exact commit reachable from the trusted
  protected source branch.
- Provider credentials, prompts containing private content, translated text,
  runtime parameters, recipient identity, and raw provider errors are absent.
- The artifact revision covers the candidate output actually validated and
  published.
- A stale source, glossary, generator, artifact, or validation result prevents
  promotion and queues or defers to a newer reconciliation.
- Owner workflows may add fields, but Completion E relies only on this common
  minimum.
- The record proves generation and validation, not linguistic or safety
  approval.

The repositories remain owner-specific. `openclaw/docs` owns documentation
orchestration, translation memory, generated locale trees, MDX repair, and
publication while executing the source-owned translator from an exact
`openclaw/openclaw` revision. Product catalog workflows publish through their
own `openclaw/openclaw` automation branches. A shared evidence schema does not
require one repository, extractor, file format, or auto-merge policy.

## Translation Drift Gate

Every registered generated catalog declares:

- English source and source revision;
- target locale artifacts;
- glossary and protected literals;
- generator workflow and provider/model provenance;
- the common translation-run evidence revision;
- deterministic validation command; and
- review policy for its content classes.

The maintenance workflow follows a dependency-guard-style state machine:

| Phase | Trigger | Behavior |
| --- | --- | --- |
| `detect` | Pull request | Runs without provider credentials. Reports changed English source, missing targets, stale revisions, fallback, and review drift. |
| `refresh` | Trusted `main`, schedule, or manual dispatch | Generates candidate translations per locale, validates isolated artifacts, and opens or updates a generated pull request. Failed generation or validation aborts publication. |
| `enforce` | Pull request and release | Blocks invalid catalogs and any `complete` claim whose source, artifacts, or required review are stale. |

The refresh workflow must check out a trusted exact source revision reachable
from a protected base-repository ref, keep provider credentials unavailable to
untrusted pull-request code, and publish through a scoped generated-PR
application identity. Generated changes retain source, glossary, workflow,
provider/model, and catalog-revision provenance.

Detection and enforcement fail closed on malformed manifests, tool failure, or
unreadable required evidence. A failed refresh leaves the prior catalogs and
maturity state unchanged while reporting the unresolved drift.

The gate may automatically repair missing low-risk catalog entries in a
generated pull request. It must not:

- push generated translations directly to a protected branch;
- promote its own output to `complete`;
- bypass named review required by the content class;
- change stable commands, codes, IDs, paths, or protected literals; or
- invoke a runtime model to render deterministic product text.

## Maturity States

Each locale/surface pair has one state:

| State | Meaning |
| --- | --- |
| `source` | Authoritative English source. |
| `complete` | All required keys pass automated checks and required human review. |
| `partial` | Catalog exists but has missing, fallback, or unreviewed content. |
| `experimental` | Available for testing without a completeness claim. |
| `platform-constrained` | OpenClaw catalog and adapter are complete, but the upstream platform cannot represent this locale; deterministic fallback is verified. |
| `unsupported` | No shipped support. |

`complete` is a release claim. It must not be inferred only from the presence of
a locale file. `platform-constrained` requires evidence of the platform locale
limit, the selected fallback, and adapter reconcile behavior.

## Automated Checks

### Blocking from the start

- manifest schema;
- locale and alias validity;
- duplicate locale or alias detection;
- source-key uniqueness;
- key parity for declared complete catalogs;
- zero untranslated English fallback for declared complete non-English
  catalogs;
- placeholder name and type parity;
- deterministic generated artifacts;
- invalid or forbidden markup;
- missing English source text;
- stale generated locale inventory; and
- catalog namespace ownership: core keys are core-owned and a plugin may write
  only its own namespace.

### Blocking for migrated renderers

Once a renderer or directory is declared migrated, its checks additionally
require:

- exact reviewed English compatibility unless the change explicitly documents
  an English-copy change;
- one non-English rendering fixture;
- protected-literal preservation for commands, flags, paths, IDs, PIDs,
  versions, status/reason codes, and raw upstream diagnostics;
- exact structured-output equality across English and one non-English locale;
- catalog-backed labels or `select` cases for product-owned presentation enums;
- a mixed-language interpolation fixture that rejects raw enum or English-label
  leakage into translated prose; and
- one immutable locale context across the complete rendering operation.

### Advisory initially

- untranslated English fallback in partial or experimental non-English
  catalogs;
- hardcoded user-facing strings;
- unused keys;
- inconsistent terminology;
- suspicious machine translation;
- locale-specific layout risk;
- untranslated external metadata; and
- locale-sensitive parsing of host prose.

Advisory checks become blocking per migrated directory or surface, not
repository-wide in one change.

Every advisory migration entry records an owner and `reviewBy` release or date.
Passing that boundary requires promotion to blocking, an explicit renewed
deadline, or removal of the completeness claim. Advisory status cannot remain
unowned and indefinite.

## Hardcoded String Inventory

The scanner classifies findings:

```text
L10N001 product-owned literal outside catalog
L10N002 translated output used for program branching
L10N003 localized host/dependency prose matched by runtime logic
L10N004 missing English fallback
L10N005 placeholder mismatch
L10N006 unknown locale or alias
L10N007 untranslated fallback in complete locale
L10N008 unsafe translator-owned markup or executable token
L10N009 raw presentation enum or English label interpolated into translated prose
L10N010 structured output changes when only locale changes
```

Allowlist entries require:

- finding code;
- file and stable owner;
- reason;
- expiry or review condition; and
- whether the text is developer-only, protocol identity, external prose, or
  intentionally literal.

Migrated findings additionally name the replacement descriptor/catalog owner
and the deletion condition for the old path. A surface cannot become `complete`
while the replaced literal, duplicated adapter template, or prose-parsing path
remains an unbounded second authority.

## Adoption Conformance Record

Every migrated message family or coherent surface slice records:

| Field | Required evidence |
| --- | --- |
| Semantic owner | Owner of message meaning, key, parameter schema, fallback, and safety/recovery semantics |
| Rendering owner | Owner of locale authority, catalog, escaping, and final projection |
| Authoritative boundaries | Descriptor construction and locale resolution |
| Accepted fixture | Reviewed English plus at least one non-English rendering |
| Failure fixtures | Missing key/catalog, invalid parameters, incomplete safety review, and renderer failure as applicable |
| Compatibility | Locale-invariant codes, commands, decisions, structured output, and legacy fallback |
| Privacy | Public diagnostic fields and prohibited content |
| Coverage | Surface declaration, catalog/artifact revision, maturity, and required review evidence |
| Rollback | Exact fallback or demotion behavior |
| Deletion | Hardcoded, duplicated, parsed-prose, or edge-invented authority removed |

The record may live in focused fixtures, a PR evidence block, or an owner-local
design note. It is not a runtime registry and does not add fields to the
coverage manifest.

## Safety Review

Approval, authentication, destructive-operation, policy-denial, and
security-warning messages require human review before a locale/surface pair can
be `complete`.

The manifest records review provenance without storing reviewer personal data
beyond the repository's normal commit history:

```yaml
review:
  required: true
  status: reviewed
  reviewerRole: security-localization-reviewer
  sourceRevision: <commit>
  checklist: localization-safety-v1
  attestationRevision: <commit>
```

The attestation is checked data. A normal approving commit without the required
role, checklist, and reviewed source revision does not satisfy safety review.
It also records `surface`, `locale`, `catalogRevision`, and `manifestRevision`.
CI requires exact revision equality before promoting or retaining `complete`;
a regenerated or cherry-picked catalog invalidates stale review evidence. If a
release manifest is signed, the attestation hash is included in that signed
manifest rather than creating a separate signing system.

## Report

CI emits machine-readable JSON and a concise Markdown summary:

| Surface | Locale | State | Keys | Missing | Fallback | Findings |
| --- | --- | --- | ---: | ---: | ---: | ---: |

The report distinguishes:

- missing;
- fallback;
- invalid;
- unreviewed safety text;
- stale generated output;
- hardcoded literals;
- mixed-language presentation interpolation;
- locale-dependent structured-output drift; and
- test infrastructure failure.

## Release Policy

- English source must always pass.
- A locale advertised as complete must pass all required checks for that
  surface at the release commit.
- Partial and experimental locales remain selectable only when the UI clearly
  communicates their status or the project explicitly accepts fallback.
- Platform-constrained projection rows do not block a qualified
  "OpenClaw-owned localization complete" claim when every owned catalog and
  adapter check passes, but the release report must name each constrained
  platform/locale pair and must not claim that users see that locale natively.
- The release report uses `openclaw-owned-complete-with-platform-constraints`
  only when every non-constrained translation-target cell is complete.
- The release report uses `fully-localized` only when every one of the 315
  translation-target cells is complete.
- Safety, security, authentication, authorization, destructive-action,
  privacy, and recovery surfaces use one reviewed English message when the
  locale/surface pair is not complete; key-level mixed-language fallback is
  forbidden for those messages.
- A missing translation must not block an unrelated runtime operation; it
  blocks only the completeness claim.
- Locale infrastructure failures that can corrupt or drop catalogs are release
  blockers.
- Invalid core catalogs block the owning build artifact. Invalid optional
  plugin catalogs do not block unrelated core artifacts.
- A bad or partial generated wave is quarantined by catalog revision. Affected
  locale/surface pairs are demoted to `partial` or `experimental`, their
  `complete` claims are removed, and the last certified catalog or reviewed
  English fallback remains active.

## Deployment Drift

Each packaged artifact exposes a machine-readable localization status:

```yaml
artifactId: openclaw-runtime
artifactVersion: <version>
buildRevision: <source revision>
registryRevision: <locale registry revision>
manifestRevision: <certifying manifest revision>
catalogRevisions:
  runtime: <catalog revision>
  bundled-plugin.example: <catalog revision>
```

An artifact that bundles multiple localization surfaces exposes the revision
for each bundled surface. Operators compare those values with matching entries
in the release manifest that certified them.

The runtime does not fetch catalogs or coverage state from the network. A
catalog revision mismatch within one immutable package is a packaging failure.
Different fleet members may run different releases, but fleet tooling can
report their declared locale maturity and per-artifact catalog revisions
without inspecting translated text. A catalog change in documentation or a
native app does not create false drift for an unchanged runtime artifact.

## Contribution Workflow

One public contributor guide indexes every localization surface and its owning
workflow. Every catalog documents:

- source file;
- generated files;
- glossary;
- local validation command;
- placeholder rules;
- safety-review requirement;
- parameter classification as literal data or product-owned presentation;
- structured-output invariants;
- how to add a locale; and
- how to update an existing translation.

The new-string lifecycle is:

1. add or change reviewed English at the owning final-render boundary;
2. for a new message, add a stable namespaced key; for a copy-only change,
   reuse the existing key; confirm semantic and rendering ownership; classify
   every parameter;
3. update the owning source catalog, glossary, and generation inputs;
4. regenerate only owner-declared artifacts;
5. add English compatibility, non-English, fallback, and protected-literal
   proof appropriate to the surface;
6. refresh the coverage manifest and run the documented validation command;
7. demote affected complete locale rows to `partial` until regenerated
   translations and required human review are present, and report the stale
   translation as a separate finding;
8. record privacy-safe observability and rollback behavior; and
9. delete the superseded presentation path or record the named compatibility
   boundary that still requires it.

Generated catalogs, locale trees, translation memory, and native projections
are edited only through their owning generation workflow. A changed English
source string cannot retain a `complete` locale claim solely because an older
translation with the same key still exists.

Generated updates use pull requests, not direct pushes to protected branches.

Existing English-only commands, plugins, and skills remain valid contributors
to the ecosystem. Localization fields are optional unless an artifact claims a
specific locale/surface completeness state.

## Conformance

The coverage system conforms to v1 when it can answer, at one commit:

- which locales OpenClaw recognizes;
- which surfaces each locale supports;
- whether support is complete, partial, experimental, platform-constrained, or
  absent;
- how many keys are missing or falling back;
- whether safety text has required review;
- which validation command proves the claim;
- whether migrated structured outputs are locale-invariant;
- whether product-owned presentation labels are fully catalog-backed;
- whether protected literals remain unchanged; and
- which semantic and rendering owners approved each migrated family;
- whether public diagnostics avoid rendered, literal, and recipient content;
- which superseded presentation authority was deleted; and
- which findings prevent promotion to complete.
