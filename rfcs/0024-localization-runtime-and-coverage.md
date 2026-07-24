---
title: Localization Runtime and Product Coverage
authors:
  - Gio Della-Libera
created: 2026-07-16
last_updated: 2026-07-23
status: accepted
issue: https://github.com/openclaw/openclaw/issues/113105
rfc_pr: https://github.com/openclaw/rfcs/pull/42
---

# Proposal: Localization Runtime and Product Coverage

## Summary

OpenClaw will adopt one localization contract across runtime, CLI/TUI, Gateway,
channels, metadata, UI, native apps, and docs without replacing the translation
pipelines that already work.

Core owns locale identity, resolution precedence, catalog validation, and
generic coverage semantics. Gateway-owned descriptors live in the shared
Gateway protocol boundary. Each user-facing owner publishes its coverage
declarations and continues to own its catalogs and final rendering. Existing
codes, commands, identifiers, structured output, and reviewed English messages
remain compatible.

For JavaScript and TypeScript runtime catalogs, `intl-messageformat` owns ICU
message parsing and formatting. The OpenClaw-specific layer owns the locale
context, catalog and parameter validation, protected literals, compatibility,
fallback, and safety rules around that formatter.

Supporting material:

- [Localization Runtime v1 specification](0024/localization-runtime-v1-spec.md)
- [Localization Coverage v1 specification](0024/localization-coverage-v1-spec.md)
- [Localized Metadata v1 specification](0024/localized-metadata-v1-spec.md)
- [GitHub issue catalog](0024/issue-catalog.md)
- [Implementation plan](0024/implementation-plan.md)
- [Projected owner slice registry](0024/projected-owner-slice-registry.md)

## Decision

Accepting this RFC approves these product contracts:

1. OpenClaw resolves locale through one immutable `LocalizationContext`.
   Explicit user and recipient choices outrank request, surface, operator, and
   platform inference; unsupported explicit values fail safely to English.
2. Product-owned runtime copy is represented as a stable message key, typed
   literal parameters, and a reviewed English fallback template. The surface
   that presents the message owns the catalog and final rendering. Shared
   JavaScript and TypeScript runtime rendering delegates ICU formatting to
   `intl-messageformat` rather than implementing a second message formatter.
3. Subject to Gateway-owner approval, Gateway errors retain their existing code
   and English `message` while reviewed errors may add bounded localization
   metadata under `details.localization`. Shared descriptor identities live in
   `packages/gateway-protocol`, capable clients render them, and legacy clients
   ignore them.
4. Subject to the command, skill, and plugin owners approving each additive
   public schema, capability identities remain stable while locale-keyed
   presentation metadata may be projected to Gateway and client surfaces.
5. Localization core defines generic maturity and scoped-evidence semantics
   rather than owning a closed product-surface union. Once release aggregation
   is enabled, surface owners publish declarations and the product layer
   generates locale/surface maturity, revision, review, and blocker evidence.
   Missing required portfolio declarations fail the release claim, not the
   runtime kernel.
6. A migrated surface satisfies the localization-ready ownership standard:
   semantic meaning, locale authority, catalog/rendering, compatibility,
   privacy, conformance evidence, current checked-in inventory, a public
   workflow-index entry, owner-internal guidance, any additional public
   contract documentation, and deletion of the superseded presentation path
   all have named owners and proof.
7. Owner workflows may publish one source-pinned translation-run evidence
   contract:
   exact source revision, locale, source and glossary revisions, generator and
   workflow identity, provider/model identity, generated artifact revision,
   and validation result. Extraction, publication, and review policy remain
   owner-specific.

This RFC does not authorize broad exception/log extraction, runtime model
translation, translation of commands or protocol values, AI self-review, or a
new external plugin runtime-catalog API.

The five open foundation drafts are the first bounded entries in the projected
owner slice registry. Their review deltas now isolate the minimal kernel,
updater dry-run, contributor guidance, TUI status, and one Gateway approval
descriptor. `F02` through `F05` now branch independently from `F01`; none
carries another follow-up owner's runtime or documentation delta. Each is
reviewed and landed only by its named semantic and rendering owners.

Accepting the RFC changes no runtime by itself. If `F01` lands and the four
independent owner slices follow, OpenClaw has the internal locale/context and
formatting
foundation, the existing wizard consumer, localized updater dry-run and TUI
status families, one reviewed Gateway/Control UI approval-error edge, and the
contributor guide. The coverage specification then defines how adopted owners
can report language-by-surface state, but these drafts do not install a closed
global matrix or claim that other cells are localized. Owner declarations and
aggregate product reporting remain the later `E43` and `E44` slices.

The five runtime drafts do not install the reusable authoring gate or
asynchronous translation lane. Draft OpenClaw PR
[#112784](https://github.com/openclaw/openclaw/pull/112784) implements `G45`
and `G46` together as the bounded core/tooling exemplar: a routine English
source edit trips deterministic CI, then a trusted exact-source workflow
generates and validates a locale candidate and opens a generated pull request.
Each later surface opts in only for its owner-declared families, namespaces, or
directories and must bring both halves of that loop. Its inventory disposition,
public workflow-index entry, and owner-internal guidance land in the same
adoption slice,
not in a documentation cleanup at product completion. The later documentation
cohort localizes docs as a product surface; it does not defer documentation of
earlier maintainer obligations.

The current delivery audit identifies 47 projected owner slices. The first
audit had 44; owner review exposed the authoring-gate and generated-refresh
obligations now explicit as `G45` and `G46`, and follow-up review exposed the
new-surface adoption obligation now explicit as `G47`. This is the proposed
queue to work down over time, using the same planning pattern as Doctor's
structured rule registry. The count is planning evidence, not a required
pull-request count or acceptance gate. A slice is deleted when source audit
proves that no migration is needed and split when it crosses an owner,
locale-authority, public-contract, or publication boundary. Coverage and
release state consume only landed owner declarations; the planning registry is
never loaded by the runtime.

Because the `F01`, `F03`, `G45`, and `G46` PK0 entries predate the disposition
inventory, `G47`/`PK0` also backfills their public workflow-index entries and
nearest owner-internal guidance. `F02`, `F04`, `F05`, and later slices carry
those artifacts in their own scheduled adoption packages.

### Acceptance and delivery milestones

RFC 0024 separates architecture acceptance from implementation and product
completion:

1. **Architecture accepted:** owners approve the locale, descriptor, fallback,
   and minimum coverage semantics. Any Gateway, command, skill, plugin, or
   recipient-locale surface remains gated on its named owner.
2. **Foundation shipped:** a minimal kernel and one existing owner-controlled
   consumer land with accepted, fallback, compatibility, privacy, and deletion
   proof, current inventory, and applicable public/internal owner guidance.
3. **Owner cohorts complete:** operator, runtime-safety, channel/capability, and
   native/docs owners migrate bounded message families through independent,
   reviewable PRs and generated catalog waves tracked in the projected owner
   slice registry.
4. **Product claim promoted:** the release report evaluates only landed,
   owner-declared evidence and may make a qualified or full localization claim.

The execution target is a product-completion decision on September 1, 2026.
The projected registry groups all 47 current entries into 16 dependency-safe
delivery packages from July 22 through September 1, at roughly three completed
packages per full week. This is a delivery forecast, not a change to normative
runtime behavior. A package may contain several small source, consumer, or
generated-catalog pull requests; it reuses shared per-repository gates rather
than creating a separate automation system for each slice.

The current 15-surface, 315-cell portfolio is a delivery target and release
policy snapshot. It is not an RFC-acceptance condition, a localization-core
type restriction, or a requirement that one PR fill an entire cohort.

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
locale is registered by the minimal foundation, but completeness remains
measured per surface.
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

The current implementation is already partially shared:

- `openclaw/docs` orchestrates documentation translation and publication, but
  checks out an exact `openclaw/openclaw` source revision and runs the
  source-owned `scripts/docs-i18n` translator;
- native translation imports the Control UI translation client instead of
  maintaining another provider implementation; and
- docs, Control UI, and native workflows use aligned provider-secret naming
  and source-pinned execution.

RFC 0024 formalizes that alignment without creating another repository or
translation service. Every generated translation run emits the same bounded
evidence:

```text
source repository + exact source revision
+ locale + source/glossary revisions
+ generator/workflow + provider/model identity
+ generated artifact revision + validation result
-> reviewable candidate translation evidence
```

Owner workflows keep their native extraction and publication models. Docs
continue publishing through `openclaw/docs`; Control UI, native, CLI/TUI, and
runtime catalogs publish through their owning `openclaw/openclaw` workflows.
Safety catalogs may use the same candidate-generation evidence while retaining
stricter review and auto-merge policy.

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

The projected registry names the reusable implementation proof explicitly:
`G45` installs the owner-scoped deterministic authoring/drift gate, `G46`
installs the trusted asynchronous refresh-to-generated-PR lane, and `G47`
prevents newly introduced product-string surfaces from remaining unclassified.
The first two begin with one routine core exemplar; existing Control UI, native,
and docs owners keep their current workflows, while later CLI/TUI/runtime owners
adopt the reference contract without surrendering catalog or review ownership.

`G47` is a build-time adoption gate, not a heuristic scan of every string
literal. Owner adapters enumerate product-surface registrations or declared
product-facing source roots. A newly added scope must identify its semantic
owner and either enroll in the catalog contract, point to a conforming existing
pipeline, or record an explicit English-only, platform-constrained, or deferred
disposition with rationale. Existing unclassified scopes are baselined as
legacy backlog; tests, logs, developer diagnostics, and model-authored text do
not become product surfaces merely because they contain strings.

After that exemplar lands, each slice that adds or migrates deterministic
product strings brings its area fully onto the contract: a blocking,
credential-free gate for its declared scope plus a trusted owner-owned refresh,
validation, evidence, and generated-PR path. Existing Control UI, native, and
docs workflows may demonstrate conformance instead of being replaced.

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
- Share one source-pinned translation-run evidence contract across docs,
  Control UI, native, CLI/TUI, runtime, channel, and metadata workflows without
  forcing one extractor, catalog format, or publication policy.
- Keep model-generated content language separate from product UI localization
  so it can use the locale registry in a post-v1 extension without blocking the
  runtime localization contract.
- Define owner-published surface declarations, a checked-in generated
  surface/locale coverage manifest, and CI checks for key parity, placeholders,
  untranslated fallback, and hardcoded product text.
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

### Localization-ready ownership

Localization separates ownership rather than transferring it to localization
core:

- the semantic owner defines the message meaning, stable key, allowed
  parameters, reviewed English fallback, and any safety or recovery semantics;
- the rendering owner selects the legitimate locale context, owns the catalog
  and renderer, and preserves literal values and platform constraints;
- localization core owns generic context, validation, fallback, and rendering
  primitives, but does not invent message meaning or recipient locale; and
- the coverage owner aggregates owner-published evidence without becoming the
  source of message or translation truth.

One team may fill multiple roles, but every adopted message family or surface
must identify them explicitly. A renderer must not reinterpret an error,
decision, finding, status, or recovery action merely to make it translatable.

A localization-ready adoption has:

1. a named semantic owner and authoritative descriptor-construction boundary;
2. a named rendering/catalog owner and authoritative locale-resolution
   boundary;
3. stable machine identity, typed parameters, and a reviewed English fallback
   template rendered by the same edge renderer as translated templates;
4. one immutable locale context and catalog snapshot per operation;
5. explicit literal, presentation, sensitivity, and safety classification;
6. locale-invariant codes, commands, decisions, structured output, and policy;
7. deterministic accepted, fallback, invalid-input, and rollback behavior;
8. compatibility proof for every affected protocol or automation consumer;
9. coverage and required human-review evidence bound to the exact message
   family, source, locale-specific reviewed-content, and review-policy
   revisions; and
10. deletion of the hardcoded, duplicated, parsed-prose, or edge-invented
    presentation path that the descriptor replaces.

Each implementation slice records this evidence in its PR description, focused
fixture, or owner-local design note. This is review evidence, not a runtime
registry or new manifest schema.

Stop rather than broaden the localization framework when:

- no semantic owner can approve a stable meaning and parameter schema;
- no legitimate recipient or operator locale is available;
- a generic exception or external prose has no bounded product-owned
  descriptor;
- required safety or linguistic review is absent;
- compatibility requires changing stable machine output; or
- the old presentation authority cannot be removed or clearly bounded.

In those cases OpenClaw preserves stable machine output and reviewed English
fallback, records the surface as incomplete where applicable, and leaves the
underlying operation unchanged.

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

The first implementation slice introduces one small internal localization
kernel at the lowest dependency layer shared by browser and server code. The
exact package path is an implementation decision, but the kernel owns:

- locale registration, normalization, aliases, inferred matching, fallback,
  display names, and direction;
- immutable `LocalizationContext`;
- the `LocalizedMessage` and scalar parameter types;
- catalog lookup and reviewed English fallback;
- ICU message parsing and formatting delegated to `intl-messageformat` for
  shared JavaScript and TypeScript runtime catalogs;
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
native-app, documentation, and wizard catalogs remain surface-owned. The slice
proves the kernel through one selected existing consumer plus browser/server
conformance fixtures; it does not land a type-only framework.

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
coverage. `fallback` is a reviewed English template for old clients, missing
translations, diagnostics, and emergency recovery. The renderer interpolates
that template with the same validated parameters and literal-isolation rules as
a translated template; descriptor construction sites never pre-render it.
Parameters are literal values; translators cannot introduce executable tokens
or reinterpret parameter types.

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

If the selected safety message family is missing, invalid, incomplete, or lacks
the required scoped human-review attestation, the renderer uses one reviewed
English snapshot for the complete approval presentation. It does not mix
translated labels with English fallback fragments.

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
- Documentation orchestration and generated locale trees remain in
  `openclaw/docs`, while the source-pinned translator implementation remains
  owned by `openclaw/openclaw`.
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

Localization core defines the generic manifest schema, maturity semantics,
derived checks, and promotion-blocker rules. It does not enumerate every UI,
channel, plugin, skill, native, or documentation surface.

Each product owner may publish a build-time declaration once it has an adopted
message family or artifact. The declaration contains its stable surface ID,
owner, artifact, source/catalog paths, migration state, validation command,
message-family classifications, and locale artifact discovery. A root product
aggregator includes every declaration, orders the generated report
deterministically, and fails on duplicate surface IDs or order claims. Adding a
new owner surface changes its declaration and the product portfolio, not the
generic localization-core validator.

The product aggregation layer may check in a generated localization coverage
manifest describing:

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
- blocking hardcoded-string checks only for explicitly migrated message
  families, key namespaces, or narrowly owned directories.

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
3. Confirm the semantic owner, rendering owner, and authoritative descriptor
   and locale-resolution boundaries.
4. Give current English messages stable keys and descriptors.
5. Classify every parameter as literal data or product-owned presentation,
   including sensitivity and safety treatment.
6. Localize one bounded renderer without changing structured output.
7. Add optional protocol metadata where the owner approves it.
8. Prove accepted, fallback, compatibility, privacy, and rollback behavior.
9. Delete or explicitly bound the superseded hardcoded or duplicated
   presentation path.
10. Migrate clients and surfaces and raise coverage gates by owned message
    family, key namespace, or narrowly owned directory.

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

The five foundation drafts have provided cross-cutting implementation evidence
across the shared kernel, runtime safety, process-scoped CLI/TUI rendering,
updater and service presentation, Gateway/UI errors, channel approvals,
metadata, native/docs convergence, RTL interpolation, and product-level release
reporting.

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
  extraction change;
- Gateway localization descriptor identities are shared from
  `packages/gateway-protocol` rather than imported from private Gateway source;
  and
- the 15-surface release portfolio is composed from owner/domain declarations
  while localization-core remains generic and accepts future valid surface IDs.
- documentation translation already consumes an exact source revision and
  source-owned translator from `openclaw/openclaw`, while native reuses the
  Control UI translation client; completion work should standardize their run
  evidence rather than introduce another translation service.

The current product-policy snapshot contains 15 English source rows plus 15
owner-declared surfaces across 21 translation targets. Release completion is
calculated over those 315 translation-target cells. Independent owner cohorts
may fill the remaining cells. The terminal product target is all 313
OpenClaw-controlled target cells complete, with `docs/fa` and `docs/th` either
completed through an approved publishing path or disclosed as the only
external platform constraints.

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

### Why one formatter does not imply one localization system

Control UI, Swift, Kotlin, docs tooling, CLI, and server-rendered channel
messages have different build and runtime constraints. Shared semantics are
more valuable than forcing one file format. The shared JavaScript and
TypeScript runtime kernel uses `intl-messageformat` for ICU formatting instead
of maintaining a custom formatter, while native, UI, and documentation owners
retain their existing formats and publication workflows.

### Why typed parameters and stable keys

Unicode MessageFormat demonstrates the value of separating message identity,
variables, and language-specific rendering. OpenClaw v1 stores ICU message
strings and delegates parsing and rendering to `intl-messageformat`. OpenClaw
still validates a deliberately bounded v1 profile: scalar parameters, simple
interpolation, and at most one top-level plural or select. Nested selectors and
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

The RFC standardizes the meaning of maturity and evidence. The current surface
portfolio, reviewer roster, completion schedule, and generated report layout
remain delivery and release policy so they can evolve without changing the
runtime contract.

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
