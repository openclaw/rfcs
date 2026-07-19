---
title: Localization Runtime and Product Coverage
authors:
  - Gio Della-Libera
created: 2026-07-16
last_updated: 2026-07-19
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/42
---

# Proposal: Localization Runtime and Product Coverage

## Summary

OpenClaw will adopt one localization contract across runtime, CLI/TUI, Gateway,
channels, metadata, UI, native apps, and docs without replacing the translation
pipelines that already work.

Core owns locale identity, resolution precedence, stable message descriptors,
catalog validation, and coverage semantics. Each user-facing surface continues
to own its catalogs and final rendering. Existing codes, commands, identifiers,
structured output, and reviewed English messages remain compatible.

Supporting material:

- [Localization Runtime v1 specification](0024/localization-runtime-v1-spec.md)
- [Localization Coverage v1 specification](0024/localization-coverage-v1-spec.md)
- [Localized Metadata v1 specification](0024/localized-metadata-v1-spec.md)
- [GitHub issue catalog](0024/issue-catalog.md)
- [Implementation plan](0024/implementation-plan.md)

## Decision

Accepting this RFC approves these product contracts:

1. OpenClaw resolves locale through one immutable `LocalizationContext`.
   Explicit user and recipient choices outrank request, surface, operator, and
   platform inference; unsupported explicit values fail safely to English.
2. Product-owned runtime copy is represented as a stable message key, typed
   literal parameters, and reviewed English fallback. The surface that presents
   the message owns the catalog and final rendering.
3. Gateway errors retain their existing code and English `message`. Reviewed
   errors may add bounded localization metadata under `details.localization`;
   capable clients render it and legacy clients ignore it.
4. Commands, skills, and plugins retain stable identities while exposing
   locale-keyed presentation metadata for Gateway and client projections.
5. A generated manifest records every locale/surface maturity cell, its owner,
   source and catalog revision, required checks, review evidence, and promotion
   blockers. Release claims are derived from that manifest and fail closed.

This RFC does not authorize broad exception/log extraction, runtime model
translation, translation of commands or protocol values, AI self-review, or a
new external plugin runtime-catalog API.

The five open foundation PRs implement and demonstrate these contracts. They do
not claim that OpenClaw is already fully translated. Completion A-E fills every
catalog and evidence cell after owners approve the direction.

### Ten-PR delivery arc

RFC 0024 closes through two five-PR stacks.

The foundation stack is implemented and open for review:

1. [Locale context and message rendering](https://github.com/openclaw/openclaw/pull/111541):
   shared registry, locale resolution, immutable catalogs, additive Gateway
   metadata, and the first CLI, approval, and Control UI consumers.
2. [Runtime adoption](https://github.com/openclaw/openclaw/pull/111542):
   updater, service, completion-cache, and shell presentation.
3. [Governance and inventory](https://github.com/openclaw/openclaw/pull/111543):
   authoring workflow, generated inventory, maturity, and promotion gates.
4. [Product surfaces](https://github.com/openclaw/openclaw/pull/111544):
   CLI/TUI, Gateway/UI, channel safety, command, skill, and plugin metadata.
5. [Convergence and readiness](https://github.com/openclaw/openclaw/pull/111545):
   cross-surface alignment, translation evidence, RTL safety, and honest
   release reporting.

The completion stack fills the product rather than adding another framework:

1. complete Control UI, onboarding/setup, CLI, and TUI catalogs;
2. complete a bounded owner-approved runtime and Gateway error inventory;
3. complete server-rendered channels, command menus, and capability metadata;
4. complete native-app and documentation artifacts; and
5. ingest named review evidence and promote the final release matrix.

The original smaller implementation slices remain useful development
provenance, but they are not the preferred review or delivery plan.

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

RFC 0024 v1 starts with the union of existing shipped product locales: the 21
Control UI locales plus Swedish, which already has a native-app catalog:

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
sv
```

English is the source locale and the other 21 are translation targets. Every
locale is registered from PR 1, but completeness remains measured per surface.
For example, Swedish begins with native-app coverage and remains unsupported on
other surfaces until their catalogs exist. OpenClaw must not claim full
22-locale product coverage
until every product-owned surface is complete for every target locale.

This is a baseline, not a claim of comprehensive world-language coverage. It
has strong East Asian coverage through Simplified Chinese, Traditional
Chinese, Japanese, and Korean; partial South and Southeast Asian coverage
through Hindi, Indonesian, Thai, and Vietnamese; and two right-to-left
languages through Arabic and Persian. It does not yet cover several major
language communities, including Bengali, Urdu, Tamil, Telugu, Malay, Filipino,
Hebrew, or Swahili.

Engineering coverage is broader than the release-locale list. The conformance
suite must exercise representative direction, script, shaping, segmentation,
plural, expansion, and interpolation behavior. The initial set already covers
Latin, Cyrillic, Arabic-derived scripts, Simplified and Traditional Han,
Japanese, Hangul, Devanagari, and Thai. Additional fixtures should cover Hebrew
RTL behavior, another major Indic script, Khmer or Myanmar segmentation, and
Ethiopic shaping even before OpenClaw has owned translations for those
languages.

A representative fixture or pseudo-locale is not a supported-language claim.
New user-visible locales still require demand, language ownership, and review
capacity.

The contract is not limited to 22 locales, but RFC 0024 does not adopt an
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
| Interact | Server-rendered channel messages, notifications, command menus, and core/bundled command and skill metadata |
| Approve and recover | Approval prompts, Gateway errors, authentication failures, doctor and repair guidance |

Logs, protocol codes, command tokens, config keys, paths, IDs, provider/model
names, upstream prose, and model-generated responses are not part of the
product-localization completeness claim.

A locale is product-complete only when all required product-owned surfaces are
complete. OpenClaw should deepen coverage for the existing locale set before
adding languages that are present only in one catalog.

### Translation production and review

OpenClaw already uses model-assisted automation to refresh Control UI, native
app, and documentation catalogs. That is an authoring pipeline, not runtime
translation: deterministic product text is generated into reviewed,
version-controlled catalogs before release.

Model-generated output does not establish completeness by itself:

- generated catalogs retain source, workflow, model/provider, glossary, and
  revision provenance where the surface supports it;
- key, placeholder, fallback, and generated-artifact checks remain mandatory;
- approval, authentication, authorization, destructive-action, privacy, and
  recovery text requires full human review in each complete locale;
- lower-risk generated copy may use owner-defined linguistic sampling, but a
  named language owner remains accountable for the completeness claim; and
- runtime model calls must not translate deterministic product messages.

OpenClaw extends its existing Control UI, native-app, and docs refresh
automation into one continuous catalog-maintenance contract:

1. **Detect:** trusted CI compares English source revisions with registered
   target catalogs and reports missing, fallback, or stale entries.
2. **Refresh:** a trusted `main`, scheduled, or manually dispatched workflow
   uses an approved model/provider and glossary to generate candidate locale
   artifacts.
3. **Validate:** key, placeholder, protected-literal, formatting, script,
   direction, fallback, and generated-artifact checks run before publication.
4. **Publish:** the generated changes are committed to a reviewable automation
   branch and opened or updated as a pull request through the existing
   generated-PR application flow.
5. **Enforce:** CI blocks a `complete` claim while source drift, fallback,
   missing artifacts, or required review remains unresolved.

Validate and publish are sub-steps of the trusted refresh phase. Failed
generation or validation aborts publication and leaves the detected drift
visible. Detection and enforcement failures fail closed.

Translation-provider credentials never run against untrusted pull-request
code. Pull requests run deterministic detection and enforcement only. AI fills
candidate gaps; it does not approve its output or change maturity by itself.

## Goals

- Define one BCP 47-compatible locale identity and alias contract.
- Make the existing 22-locale OpenClaw union the concrete v1 baseline.
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
- Keep catalogs current through trusted AI-assisted generated pull requests and
  a deterministic detect/refresh/enforce drift gate.
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
direction. The coverage manifest is the sole source of per-surface availability
and maturity.

V1 keeps `zh-CN` and `zh-TW` as canonical IDs and accepts `zh-Hans` and
`zh-Hant` as aliases. A future canonical-ID change requires a separate
compatibility proposal with stored-preference, environment, config, and plugin
metadata migration; it is not part of RFC 0024.

An unknown locale in a validated config field, request field, or core/bundled
package manifest is an actionable validation error. A stale stored user
preference is nonfatal: the surface records a bounded finding, follows normal
precedence, and exposes a reset path.
External package localized metadata may use exact valid BCP 47 tags under its
package-owned rules without extending the product registry. Browser,
operating-system, and host process locales are inferred inputs: they fall
through language defaults and registered aliases without failing startup.
`OPENCLAW_LOCALE` remains an explicit nonfatal override: an unsupported value
produces a diagnostic and reviewed English fallback rather than silently using
a lower-precedence host locale.

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

V1 server-rendered channel messages use a recipient locale only when the
surface already has an explicit recipient/account preference or the request
carries an owner-approved validated locale. Until an owner approves a new
preference store, all other channel recipients receive reviewed English
fallback. Locale is never inferred from message text, user name, phone number,
channel identity, IP geography, or model output.

The existing optional Gateway `ConnectParams.locale` belongs to the connected
client experience. It can describe the Control UI connection that supplied it,
but it does not establish the locale of a separate channel recipient or
approval reviewer.

The RFC introduces the context contract. Any new config key, request field,
plugin field, or channel preference store remains a separately reviewable
public surface and requires the owning maintainer's approval.

`audience=user` covers end-user chat, approval, and interactive UI text.
`audience=operator` covers human-readable CLI status, health, recovery, and
administrative guidance. Logs and machine-readable output are not localized by
either audience.

One user-visible operation captures one immutable context at its owning surface
entry point and passes that context through every nested renderer. A CLI command
must not re-read process locale variables in each helper, and a request renderer
must not change locale midway through one response. Compatibility defaults for
shared helpers may resolve a context only when no owning entry point can inject
one; production orchestration must inject the captured context.

### Foundational localization kernel

PR 1 introduces one small internal localization kernel at the lowest dependency
layer shared by browser and server code. The exact package path is an
implementation decision, but the kernel owns:

- locale registration, normalization, aliases, inferred matching, fallback,
  display names, and direction;
- immutable `LocalizationContext`;
- the `LocalizedMessage` and scalar parameter types;
- catalog lookup and reviewed English fallback;
- key, parameter, namespace, and catalog validation primitives; and
- renderer-safe bidirectional isolation helpers for literal data.

The kernel is synchronous after startup, browser-safe, server-safe, and free of
filesystem, network, environment, storage, translation-provider, and model
dependencies. It has no process-global current locale. Callers pass an
immutable context into lookup or rendering.

Surface adapters depend on the kernel:

```text
Control UI adapter
CLI/runtime adapter
Gateway wire projection
channel message renderer
command/skill metadata projection
        |
        v
internal localization kernel
```

The dependency never points from the kernel back into a surface. Existing UI,
native-app, documentation, and wizard catalogs remain surface-owned. PR 1
proves the kernel through existing Control UI and wizard locale resolution plus
one runtime English descriptor; it does not land a type-only framework.

This is not a public localization-provider plugin API in v1. Translation
providers remain build-time authoring tools. A public plugin seam is considered
only when external package requirements cannot be met by namespaced catalogs
and localized metadata.

### Structured localized messages

Known product-owned runtime messages use descriptors:

```ts
type LocalizedMessage = {
  key: string;
  params?: Readonly<Record<string, string | number | boolean>>;
  fallback: string;
};
```

This is the single internal descriptor. Gateway `message` plus optional
`details.localization` metadata are a compatibility wire projection of it, not
a second message model. Both projections use the same key and parameter
validator.

The key is stable machine identity for catalog lookup, telemetry, tests, and
coverage. `fallback` is reviewed English text for old clients, missing
translations, diagnostics, and emergency recovery. Parameters are literal
values; translators cannot introduce executable tokens or reinterpret
parameter types.

Not every enum-like value is literal product identity. Product-owned
presentation categories such as install-kind labels, update-kind labels, status
names, and other human classifications must use catalog-backed labels or a
catalog `select`. Passing raw values such as `package` into otherwise translated
prose creates mixed-language output and is non-conforming. Stable protocol
codes, reason codes, command tokens, IDs, paths, versions, and raw upstream
errors remain literal.

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
  details?: {
    localization?: {
      messageKey: string;
      messageParams?: Record<string, string | number | boolean>;
    };
    [key: string]: unknown;
  };
  retryable?: boolean;
  retryAfterMs?: number;
};
```

Localization metadata uses the existing opaque `details` envelope because
supported strict validators reject additive top-level error fields. Old clients
continue to show `message`. New clients localize recognized
`details.localization.messageKey` values when they have a matching catalog and
fall back to `message` otherwise. Clients must not branch on translated text.
Server-rendered channel messages use the same descriptor with the recipient's
resolved locale context.

Producer and client share one reviewed message-key registry. Metadata is
bounded to 16 flat scalar parameters, 64-character parameter names,
4096-character string values, and finite numeric values. Each key declares an
allowed parameter schema and sensitivity classification. Projection is
idempotent and never overwrites existing localization metadata.

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

If the selected safety catalog is missing, invalid, incomplete, or lacks the
required human-review attestation, the renderer uses one reviewed English
snapshot for the complete approval presentation. It does not mix translated
labels with English fallback fragments.

Security-sensitive copy requires human review for each release-complete locale.
Machine-generated translation can seed drafts but cannot alone mark the
security surface complete.

Security catalogs reject translator-authored Unicode bidirectional controls,
including direction marks, embeddings, overrides, isolates, and deprecated
formatting controls. Renderers own the minimum Unicode isolation around literal
commands, IDs, paths, numbers, and decision tokens when surrounding text is
right-to-left. Legitimate script characters are not rewritten or removed.

### Catalog ownership

This RFC does not create a monolithic catalog:

- Control UI continues to own its TypeScript locale bundles.
- Apple and Android continue to use native generated catalogs.
- Docs continue to use the docs translation workflow and glossaries.
- CLI and server-rendered runtime messages use core runtime catalogs.
- Bundled plugins may use namespaced runtime catalogs through an internal
  activation adapter.
- External plugins and skills may package localized display metadata.

Shared infrastructure owns locale IDs, aliases, fallback, message descriptor
validation, placeholder rules, and coverage reporting.

The intended extension path lets external plugins package declarative,
namespaced runtime catalogs that are validated and activation-pinned with the
plugin snapshot. Plugins cannot override core or another plugin's namespace,
register a translation provider, mutate global catalogs after activation, or
make runtime model calls for deterministic product text.

That external runtime-catalog seam is post-v1. V1 external support is localized
metadata only while bundled plugins prove the catalog mechanism. Any future
public manifest field or Plugin SDK registration method is a new semi-public
surface requiring explicit plugin-owner approval.

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
- required validation commands;
- catalog revision identity; and
- whether a locale/surface combination is `source`, `complete`, `partial`,
  `experimental`, `platform-constrained`, or `unsupported`.

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
2. Capture one immutable locale context at the owning surface entry.
3. Give current English messages stable keys and descriptors.
4. Classify every parameter as literal data or product-owned presentation.
5. Localize one bounded renderer without changing structured output.
6. Add optional protocol metadata where the owner approves it.
7. Migrate clients and surfaces.
8. Raise coverage gates directory by directory.

English remains the source and compatibility fallback. Existing locale IDs,
environment variables, persisted preferences, Gateway error messages, command
names, and plugin manifests remain valid until an explicit migration is
accepted.

Every migrated renderer retains an emergency English-fallback path. A bad
translation can be removed or the affected key can fall back to English without
changing error codes, action semantics, or the underlying operation. Invalid
core catalogs fail the owning artifact build; invalid optional plugin catalogs
are rejected without disabling unrelated core catalogs.

### Implementation evidence and refinements

The five-PR foundation stack has validated the architecture across the shared
kernel, runtime safety, process-scoped CLI/TUI rendering, updater and service
presentation, Gateway/UI errors, channel approvals, metadata, native/docs
convergence, RTL interpolation, and product-level release reporting.

The evidence changed the implementation guidance in these concrete ways:

- locale resolution occurs once per command or request and the immutable
  context is threaded through nested rendering boundaries;
- exact reviewed English remains the compatibility default for existing shared
  callers while localized production entry points inject their context;
- human presentation and structured automation payloads are separate
  projections of the same operation, so localization cannot rewrite JSON
  fields, status/reason codes, or stable arrays;
- commands, flags, paths, IDs, PIDs, versions, stderr, and upstream error text
  remain literal, while product-owned wrappers and labels are localized;
- raw internal enums are not automatically literal: when they appear as human
  labels, they require catalog-backed presentation names;
- partial locale support remains reported as partial even when a migrated
  command group has complete English and Simplified Chinese catalogs; and
- service, plugin, Gateway, channel-recipient, and safety-copy ownership
  boundaries remain separate slices rather than being hidden inside a broad
  extraction change.

The checked manifest contains 15 English source rows plus 15 surfaces across
21 translation targets. Release completion is calculated over those 315
translation-target cells. The completion stack owns all remaining target
cells. Its terminal claim is all 313 OpenClaw-controlled target cells complete,
with `docs/fa` and `docs/th` either completed through an approved publishing
path or disclosed as the only external platform constraints.

Conformance tests for a migrated renderer therefore include exact English
compatibility, one non-English rendering, protected-literal preservation,
structured-output equality across locales, unsupported-locale fallback, and a
mixed-language interpolation case for product-owned presentation labels.

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
a smaller contract compatible with its current interpolation systems and adds
one top-level structured plural or select operation. Nested selectors and
general number/date formatting remain future extensions.

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
- How should third-party plugin catalogs declare review quality and fallback
  without implying OpenClaw endorsement?
- What human-review standard is required before approval, authentication, or
  destructive-operation text is marked complete?
- Who owns the named reviewer roster for all 21 translation targets?
- Do Persian and Thai documentation use another publishing path, or remain
  explicit external platform constraints?
