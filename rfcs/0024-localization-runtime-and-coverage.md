---
title: Localization Runtime and Product Coverage
authors:
  - Gio Della-Libera
created: 2026-07-16
last_updated: 2026-07-16
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/42
---

# Proposal: Localization Runtime and Product Coverage

## Summary

Define the contracts required to make OpenClaw fully localizable without
replacing its existing Control UI, native-app, documentation, and onboarding
translation pipelines. OpenClaw gains one locale-resolution model, structured
user-facing message descriptors, compatibility-safe Gateway error metadata,
localized command and skill metadata, and a release-visible coverage manifest.
Translation remains owned by the surface that renders the text, while stable
message keys, literal parameters, locale aliases, fallback behavior, and
coverage semantics become shared product contracts.

Supporting material:

- [Localization Runtime v1 specification](0024/localization-runtime-v1-spec.md)
- [Localization Coverage v1 specification](0024/localization-coverage-v1-spec.md)
- [Localized Metadata v1 specification](0024/localized-metadata-v1-spec.md)
- [GitHub issue catalog](0024/issue-catalog.md)
- [Implementation plan](0024/implementation-plan.md)

## Motivation

OpenClaw already has substantial localization:

- the Control UI has English plus 20 lazy-loaded locale bundles;
- onboarding has an English, Simplified Chinese, and Traditional Chinese
  catalog selected from `OPENCLAW_LOCALE` and process locale variables;
- bundled plugin setup can reuse the onboarding translator;
- Android and Apple apps have generated runtime locale inventories;
- documentation has a dedicated translation workflow and glossaries.

These systems do not yet form a complete product contract. Runtime and package
code still constructs English text at the point where errors occur. Gateway
clients receive a stable error code plus an English `message`, and Control UI
surfaces commonly display that raw message. Channel safety messages such as
exec approvals are assembled from hardcoded English labels. Most CLI help,
status, validation, and failure output is English. Command descriptions and
skill metadata do not have one cross-channel locale model. Translation
completeness is measured differently, or not at all, across surfaces.

The user-visible result is inconsistent:

- a localized Control UI can display an English Gateway failure;
- a user can select Chinese in the UI and receive an English approval request
  in Telegram;
- onboarding can be localized while later CLI commands remain English;
- command and skill descriptions can remain English inside an otherwise
  localized UI;
- shipped locale bundles can contain untranslated fallback strings without a
  clear product-level completeness claim; and
- runtime code sometimes matches English operating-system error text, which
  fails on localized hosts.

This is not solved by extracting every string into one catalog. OpenClaw has
different renderers, security boundaries, packaging constraints, and release
cadences. The missing invariant is:

```text
resolved locale context
+ stable product-owned message identity
+ typed literal parameters
+ surface-owned catalog
-> deterministic localized rendering
-> English compatibility fallback
-> measurable coverage
```

### Evidence from existing issues

The detailed mapping is in [the issue catalog](0024/issue-catalog.md). The
highest-signal gaps are:

| Issue | Gap | RFC implication |
| --- | --- | --- |
| [openclaw#81253](https://github.com/openclaw/openclaw/issues/81253) | Exec approval prompts are hardcoded English. | Safety messages need structured, locale-aware edge rendering. |
| [openclaw#66056](https://github.com/openclaw/openclaw/issues/66056) | Gateway/runtime failures have no locale-aware message contract. | Preserve error codes and English messages while adding localization metadata. |
| [openclaw#88570](https://github.com/openclaw/openclaw/issues/88570) | CLI, runtime, channel, and UI coverage remains incomplete. | Coverage needs a product-level manifest and release report. |
| [openclaw#79458](https://github.com/openclaw/openclaw/issues/79458) | Slash-command descriptions lack a shared localization model. | Command metadata needs locale-keyed descriptions. |
| [openclaw#55239](https://github.com/openclaw/openclaw/issues/55239) | Telegram command menus remain English. | Channel projections must consume the command metadata contract. |
| [openclaw#89971](https://github.com/openclaw/openclaw/issues/89971) | Skill names and descriptions remain raw English metadata. | Package-owned metadata needs locale-keyed fields and fallback. |
| [openclaw#28303](https://github.com/openclaw/openclaw/issues/28303) | Public Chinese locale IDs use region rather than script semantics. | Locale aliases and migration must be explicit and backward compatible. |
| [openclaw#90608](https://github.com/openclaw/openclaw/issues/90608) | Browser locale inference can select an unwanted UI language. | Explicit user choice must outrank inferred locale and remain easy to reset. |
| [openclaw#105266](https://github.com/openclaw/openclaw/issues/105266) | Locale-rendering tests can become nondeterministic. | Localization state and test isolation are release infrastructure. |
| [openclaw#106576](https://github.com/openclaw/openclaw/issues/106576) | Runtime behavior matches English host error text. | Host behavior must not depend on localized prose. |

Broad earlier requests were often closed as duplicate, superseded, or too
general. That history argues for one RFC and issue-to-slice map instead of more
independent language requests.

### Target locales

RFC 0024 v1 targets the 21 locales already shipped by the Control UI:

```text
en
zh-CN
zh-TW
pt-BR
de
es
ja-JP
ko
fr
hi
ar
it
tr
uk
id
pl
th
vi
nl
fa
ru
```

English is the source locale and the other 20 are translation targets. Every
locale is registered from PR 1, but completeness remains measured per surface:
a locale can be complete for Control UI and partial for CLI or runtime until
those surfaces land. OpenClaw must not claim full 21-locale product coverage
until every product-owned surface is complete for every target locale.

The contract is not limited to 21 locales, but RFC 0024 does not adopt an
external product's language list or set a locale-count goal. OpenClaw adds a
release locale when it has user demand, catalog ownership, review capacity,
fallback behavior, direction and formatting support, and an explicit initial
maturity state. Pseudo-locales remain useful test assets for expansion,
interpolation, truncation, and right-to-left behavior.

### Required localization depth

OpenClaw localization follows the user journey rather than one frontend:

| Experience | Required product-owned surfaces |
| --- | --- |
| Discover and install | Documentation, installation guidance, first-run failures |
| Configure and onboard | CLI wizard, channel and plugin setup, validation and recovery guidance |
| Operate | CLI and TUI help/status, Control UI, native apps, configuration and task output |
| Interact | Server-rendered channel messages, notifications, command menus, command and skill metadata |
| Approve and recover | Approval prompts, Gateway errors, authentication failures, doctor and repair guidance |

Logs, protocol codes, command tokens, config keys, paths, IDs, provider/model
names, upstream prose, and model-generated responses are not part of the
product-localization completeness claim.

A locale is product-complete only when all required product-owned surfaces are
complete. OpenClaw should deepen coverage for the existing locale set before
adding languages that are present only in one catalog.

## Goals

- Define one BCP 47-compatible locale identity and alias contract.
- Make the existing 21-locale OpenClaw set the concrete v1 coverage target.
- Define product-wide localization depth across OpenClaw's user journey.
- Define deterministic locale-resolution precedence for UI, CLI, channel, and
  server-rendered messages.
- Define structured user-facing message descriptors with stable keys, typed
  parameters, and required English fallback.
- Preserve stable protocol codes, command names, config keys, IDs, paths,
  provider IDs, model IDs, and code blocks as untranslated literals.
- Extend Gateway errors compatibly so capable clients can localize known
  failures without breaking existing clients.
- Localize exec approval and other safety messages without allowing
  translations to alter executable commands or decision tokens.
- Define locale-keyed command and skill metadata that channels and UI surfaces
  can project.
- Keep model-generated content language separate from product UI localization
  so it can use the locale registry in a post-v1 extension without blocking the
  runtime localization contract.
- Define a checked-in surface/locale coverage manifest and CI checks for key
  parity, placeholders, untranslated fallback, and hardcoded product text.
- Preserve the existing Control UI, native-app, docs, and onboarding pipelines
  and migrate them incrementally.
- Produce a dependency-ordered implementation plan of small reviewable slices.

## Non-Goals

- Translate logs, stack traces, protocol traces, or developer-only diagnostics.
- Translate model/provider names, plugin IDs, tool names, command tokens,
  config keys, paths, URLs, or opaque external-service errors.
- Infer the preferred language of model-generated content solely from the UI
  locale.
- Require one file format or localization library for every surface.
- Load executable translation logic or unsigned remote catalogs at runtime.
- Replace platform-native string catalogs on Apple or Android.
- Translate community plugin or skill content without publisher participation.
- Claim that machine translation alone is sufficient for safety, security, or
  high-quality release localization.
- Complete every locale in one pull request.
- Implement generated-content language selection in v1.

## Proposal

### Product localization model

OpenClaw distinguishes four categories:

| Category | Examples | Localization rule |
| --- | --- | --- |
| Product-owned text | UI labels, CLI help, approval labels, known validation guidance | Must use a stable message key at a supported rendering boundary. |
| Stable machine identity | Error codes, command names, config keys, provider IDs, model IDs | Never translated. |
| User or operator data | Paths, workspace names, commands, agent names, user text | Preserved literally, with escaping appropriate to the renderer. |
| External or generated prose | Provider errors, model output, third-party plugin text | Preserved or safely summarized; not silently machine-translated by core. |

This classification prevents localization from weakening protocol stability or
changing executable content.

### Locale identity and compatibility

Locale identifiers follow BCP 47. OpenClaw maintains a central registry of
supported locale IDs, aliases, display names, fallback chains, writing
direction, and per-surface availability.

V1 keeps `zh-CN` and `zh-TW` as canonical IDs and accepts `zh-Hans` and
`zh-Hant` as aliases. A future canonical-ID change requires a separate
compatibility proposal with stored-preference, environment, config, and plugin
metadata migration; it is not part of RFC 0024.

An unknown explicit locale is an actionable validation error. An unsupported
inferred platform locale falls back through its language and registered aliases
to English.

### Locale context and precedence

Localization is resolved at the rendering edge, not in deep business logic.
Each renderer receives a resolved locale context with provenance:

```ts
type LocalizationContext = {
  locale: string;
  fallbackLocales: readonly string[];
  source:
    | "explicit-user"
    | "explicit-recipient"
    | "request"
    | "surface-preference"
    | "operator-default"
    | "platform"
    | "english-default";
  audience: "user" | "operator";
};
```

The general precedence is:

```text
explicit user or recipient preference
> explicit request/session locale
> persisted surface preference
> operator default
> process/browser/platform locale
> English
```

Each surface documents which inputs it can legitimately observe. A Gateway
must not guess a channel recipient's locale from message text. A Control UI
selection must not silently change the language of model-generated content.

The RFC introduces the context contract. Any new config key, request field,
plugin field, or channel preference store remains a separately reviewable
public surface and requires the owning maintainer's approval.

`audience=user` covers end-user chat, approval, and interactive UI text.
`audience=operator` covers human-readable CLI status, health, recovery, and
administrative guidance. Logs and machine-readable output are not localized by
either audience.

### Structured localized messages

Known product-owned runtime messages use descriptors:

```ts
type LocalizedMessage = {
  key: string;
  params?: Readonly<Record<string, string | number | boolean>>;
  fallback: string;
};
```

This is the single internal descriptor. Gateway `message`, `messageKey`, and
`messageParams` fields are a compatibility wire projection of it, not a second
message model. Both projections use the same key and parameter validator.

The key is stable machine identity for catalog lookup, telemetry, tests, and
coverage. `fallback` is reviewed English text for old clients, missing
translations, diagnostics, and emergency recovery. Parameters are literal
values; translators cannot introduce executable tokens or reinterpret
parameter types.

Catalogs must validate:

- key presence and uniqueness;
- placeholder name and type parity with English;
- locale and alias validity;
- forbidden or unknown markup;
- preserved literal tokens where required; and
- deterministic fallback.

Complex safety output is assembled from translated labels and literal
structured parts. Translators do not own Markdown fences, slash commands,
approval IDs, shell commands, or decision tokens.

### Gateway error compatibility

Gateway errors retain the current `code` and English `message` fields. Known
user-facing errors may add optional localization metadata:

```ts
type ErrorShape = {
  code: string;
  message: string;
  messageKey?: string;
  messageParams?: Record<string, string | number | boolean>;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};
```

Old clients continue to show `message`. New clients localize `messageKey` when
they have a matching catalog and fall back to `message` otherwise. Clients must
not branch on translated text. Server-rendered channel messages use the same
descriptor with the recipient's resolved locale context.

Unknown exceptions remain sanitized English fallbacks. This RFC does not make
arbitrary exception strings translatable.

### Safety-message rendering

Exec approvals are the first runtime slice. The current renderer already has
structured values for approval ID, command, decisions, host, node, CWD, and
expiry.

The localized renderer must:

- translate labels and explanatory prose;
- preserve `/approve`, decision tokens, IDs, commands, paths, and code blocks;
- preserve the same allowed-decision set and ordering;
- produce the current English output for English and fallback;
- avoid locale-sensitive parsing of the rendered result; and
- pass the same payload through all channel routes.

Security-sensitive copy requires human review for each release-complete locale.
Machine-generated translation can seed drafts but cannot alone mark the
security surface complete.

Security catalogs reject bidirectional embedding/override controls. Renderers
use Unicode isolation around literal commands, IDs, paths, and decision tokens
when surrounding text is right-to-left. Legitimate script characters are not
rewritten or removed.

### Catalog ownership

This RFC does not create a monolithic catalog:

- Control UI continues to own its TypeScript locale bundles.
- Apple and Android continue to use native generated catalogs.
- Docs continue to use the docs translation workflow and glossaries.
- CLI and server-rendered runtime messages use core runtime catalogs.
- Plugins and skills own namespaced catalogs or localized metadata packaged
  with the artifact.

Shared infrastructure owns locale IDs, aliases, fallback, message descriptor
validation, placeholder rules, and coverage reporting.

Catalog keys are namespaced by owner, for example:

```text
core.approvals.exec.required
core.gateway.invalidRequest
cli.agent.messageFile.empty
plugin.memory-core.dreaming.journal.title
```

Keys describe stable meaning, not English wording or source line.

### Localized command and skill metadata

Command names remain stable literals. Command descriptions may provide a
locale-keyed map:

```ts
type LocalizedText = {
  default: string;
  localizations?: Record<string, string>;
};
```

The command catalog proposed by RFC 0017 is the preferred owner for command
identity and description metadata. Discord, Telegram, Control UI, TUI, and CLI
help project the same catalog through platform-specific locale capabilities.

Skill manifests may use the same `LocalizedText` shape for display name and
description. Package IDs, folder names, invocation names, and tool identifiers
remain unchanged. Unknown locale keys fail package validation or are excluded
with an explicit finding; they are never silently treated as executable names.

### Post-v1 generated content language

Product localization and generated content language are related but distinct.
Features such as Dreaming may accept an explicit content-language preference,
but must not assume that a German UI means memories or assistant replies should
be rewritten in German.

The first generated-content contract is:

- an explicit feature or workspace content-language input;
- a stable BCP 47 value with the same alias registry;
- no automatic translation of existing user content;
- no change to product UI locale; and
- clear provenance in generated artifacts when language affects output.

This contract is not required for v1 acceptance. It allows later Dreaming work
to reuse locale identity without coupling model behavior to the Control UI
language selector.

### Coverage manifest and release claims

OpenClaw adds a checked-in localization coverage manifest describing:

- supported locales and aliases;
- locale maturity;
- required human review for safety surfaces;
- surface ownership;
- source and generated catalog paths;
- key counts and fallback counts;
- required validation commands; and
- catalog revision identity; and
- whether a locale/surface combination is `complete`, `partial`,
  `experimental`, or `unsupported`.

CI produces a localization report and enforces:

- key and placeholder parity;
- valid locale IDs and aliases;
- no missing required English source strings;
- no untranslated English fallback in a `complete` locale unless allowlisted;
- deterministic generated artifacts;
- locale-change test isolation;
- advisory hardcoded-string inventory initially; and
- blocking hardcoded-string checks only for migrated directories.

OpenClaw must not advertise a surface as complete for a locale unless the
manifest and checks support that claim.

### Locale-safe runtime behavior

Program logic must not match localized operating-system or dependency prose
when a code, exit status, structured field, or deterministic probe is
available. Locale-sensitive parsing is tracked separately from translation
coverage but reported by the same program because it breaks localized hosts.

### Migration and compatibility

Migration is incremental:

1. Add shared contracts without changing output.
2. Give current English messages stable keys and descriptors.
3. Localize one bounded renderer.
4. Add optional protocol metadata.
5. Migrate clients and surfaces.
6. Raise coverage gates directory by directory.

English remains the source and compatibility fallback. Existing locale IDs,
environment variables, persisted preferences, Gateway error messages, command
names, and plugin manifests remain valid until an explicit migration is
accepted.

Every migrated renderer retains an emergency English-fallback path. A bad
translation can be removed or the affected key can fall back to English without
changing error codes, action semantics, or the underlying operation. Invalid
core catalogs fail the owning artifact build; invalid optional plugin catalogs
are rejected without disabling unrelated core catalogs.

## Rationale

### Why render at the edge

Deep exception sites often do not know the recipient, user preference, or
surface. Passing translators through all core logic would couple business logic
to presentation and make logs harder to diagnose. Stable descriptors preserve
meaning until the final renderer has legitimate locale context.

### Why preserve English messages

Gateway clients, scripts, screenshots, support workflows, and logs already
observe English `message` values. Optional localization metadata provides a
gradual migration path and keeps old clients usable.

### Why not one localization library

Control UI, Swift, Kotlin, docs tooling, CLI, and server-rendered channel
messages have different build and runtime constraints. Shared semantics are
more valuable than forcing one file format.

### Why typed parameters and stable keys

Project Fluent and Unicode MessageFormat demonstrate the value of separating
message identity, variables, and language-specific rendering. OpenClaw v1 uses
a smaller contract compatible with its current interpolation systems, while
leaving room for plural, number, date, and selector formatting when a surface
needs it.

### Why BCP 47 aliases rather than renaming immediately

BCP 47 supports language, script, and region subtags, but shipped identifiers
also become compatibility data. Aliases allow OpenClaw to improve semantic
accuracy without invalidating environment variables, stored preferences, or
plugin metadata.

### Why coverage is part of the RFC

Locale files alone do not prove a localized product. Missing keys, English
fallback, untranslated server messages, stale generated assets, and test
isolation failures all produce incomplete experiences. A product-level claim
needs a product-level report.

## Unresolved questions

- Which owner approves the first public locale preference surface for
  server-rendered channel messages?
- Which locales qualify as release-complete for the first runtime and CLI
  slices?
- Should core runtime catalogs use the current dotted-key format or adopt a
  MessageFormat-compatible syntax before pluralized messages are needed?
- How should third-party plugin catalogs declare review quality and fallback
  without implying OpenClaw endorsement?
- Which CLI outputs are presentation tables versus stable machine-readable
  output that should instead gain or preserve `--json`?
- Should the coverage manifest live at the repository root or under a
  localization-owned directory?
- What human-review standard is required before approval, authentication, or
  destructive-operation text is marked complete?
