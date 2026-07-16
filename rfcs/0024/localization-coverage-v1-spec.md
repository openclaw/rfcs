# Localization Coverage v1 Specification

This document defines the product-level inventory, maturity, validation, and
release-reporting contract for RFC 0024.

Status: draft, tied to RFC 0024.

## Coverage Manifest

OpenClaw checks in one localization coverage manifest. The exact path is an
implementation decision, but the data model is:

```yaml
version: 1
locales:
  en:
    aliases: [en-US, en-GB]
    direction: ltr
    maturity: source
  zh-CN:
    aliases: [zh-Hans]
    direction: ltr
    maturity: supported
surfaces:
  control-ui:
    owner: ui
    source: ui/src/i18n/locales/en.ts
    catalogs: ui/src/i18n/locales
    requiredChecks:
      - key-parity
      - placeholder-parity
      - fallback-report
  runtime:
    owner: core
    source: src/localization/locales/en.ts
    catalogs: src/localization/locales
    requiredChecks:
      - key-parity
      - placeholder-parity
      - safety-review
```

The checked-in schema must validate locale IDs, aliases, paths, owners, and
check names.

## Surface Set

The initial product report covers:

- Control UI;
- CLI onboarding;
- remaining CLI commands and help;
- Gateway errors;
- server-rendered channel messages;
- command metadata;
- skill metadata;
- Android;
- Apple platforms;
- documentation; and
- generated-content features with explicit language support.

Surfaces can have different catalogs and supported locale sets.

## Maturity States

Each locale/surface pair has one state:

| State | Meaning |
| --- | --- |
| `source` | Authoritative English source. |
| `complete` | All required keys pass automated checks and required human review. |
| `partial` | Catalog exists but has missing, fallback, or unreviewed content. |
| `experimental` | Available for testing without a completeness claim. |
| `unsupported` | No shipped support. |

`complete` is a release claim. It must not be inferred only from the presence of
a locale file.

## Automated Checks

### Blocking from the start

- manifest schema;
- locale and alias validity;
- duplicate locale or alias detection;
- source-key uniqueness;
- key parity for declared complete catalogs;
- placeholder name and type parity;
- deterministic generated artifacts;
- invalid or forbidden markup;
- missing English source text; and
- stale generated locale inventory.

### Advisory initially

- untranslated English fallback in non-English catalogs;
- hardcoded user-facing strings;
- unused keys;
- inconsistent terminology;
- suspicious machine translation;
- locale-specific layout risk;
- untranslated external metadata; and
- locale-sensitive parsing of host prose.

Advisory checks become blocking per migrated directory or surface, not
repository-wide in one change.

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
```

Allowlist entries require:

- finding code;
- file and stable owner;
- reason;
- expiry or review condition; and
- whether the text is developer-only, protocol identity, external prose, or
  intentionally literal.

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
  sourceRevision: <commit>
```

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
- hardcoded literals; and
- test infrastructure failure.

## Release Policy

- English source must always pass.
- A locale advertised as complete must pass all required checks for that
  surface at the release commit.
- Partial and experimental locales remain selectable only when the UI clearly
  communicates their status or the project explicitly accepts fallback.
- A missing translation must not block an unrelated runtime operation; it
  blocks only the completeness claim.
- Locale infrastructure failures that can corrupt or drop catalogs are release
  blockers.

## Contribution Workflow

Every catalog documents:

- source file;
- generated files;
- glossary;
- local validation command;
- placeholder rules;
- safety-review requirement;
- how to add a locale; and
- how to update an existing translation.

Generated updates use pull requests, not direct pushes to protected branches.

## Conformance

The coverage system conforms to v1 when it can answer, at one commit:

- which locales OpenClaw recognizes;
- which surfaces each locale supports;
- whether support is complete, partial, experimental, or absent;
- how many keys are missing or falling back;
- whether safety text has required review;
- which validation command proves the claim; and
- which findings prevent promotion to complete.

