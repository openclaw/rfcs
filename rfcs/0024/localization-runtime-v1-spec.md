# Localization Runtime v1 Specification

This document is the implementer-facing runtime specification for RFC 0024.
It defines locale identity, resolution, message descriptors, rendering,
fallback, Gateway error compatibility, and safety-message constraints.

Status: draft, tied to RFC 0024.

## Scope

This specification covers product-owned text rendered by:

- the CLI;
- Gateway clients;
- server-side channel replies;
- Control UI clients consuming Gateway errors; and
- bundled plugins using a core-owned runtime localization seam.

It does not replace native-app or documentation localization formats.

## Kernel Boundary

V1 provides one internal localization kernel consumed by browser and server
adapters. It owns:

- locale registry and resolution;
- immutable localization context;
- message and scalar parameter types;
- catalog lookup and fallback;
- validation primitives; and
- literal bidirectional-isolation helpers.

The kernel:

- is browser-safe and server-safe;
- performs no filesystem, network, environment, storage, translation-provider,
  or model access;
- has no process-global mutable locale;
- accepts locale context explicitly;
- performs no I/O during lookup or rendering; and
- does not import Control UI, CLI, Gateway, channel, native-app, documentation,
  or plugin implementations.

Surface adapters own input discovery, persistence, catalog loading, output
formatting, and wire projection. The kernel is internal in v1 and does not
define a public plugin-provider API.

## Build-Time Translation Boundary

Translation providers are build-time authoring tools and are never part of the
runtime kernel. Owner workflows may use different extractors and catalog
formats, but generated runs share one source-pinned evidence contract:

```text
source repository + exact source revision
+ target locale + source/glossary revisions
+ generator/workflow + provider/model identity
+ generated artifact revision + validation result
```

The evidence contains no credentials, prompts containing private user content,
or rendered runtime parameters. It supports catalog review and maturity
promotion; it is not loaded by the runtime.

Documentation orchestration may remain in `openclaw/docs` while using the
source-owned translator from an exact `openclaw/openclaw` revision. Control UI,
native, CLI/TUI, runtime, channel, and metadata workflows keep owner-specific
publication. Sharing this evidence contract does not create a runtime
translation service or a public provider API.

## Ownership And Adoption

Localization does not own the product meaning that it renders.

- The semantic owner defines the stable message key, allowed parameter schema,
  reviewed English fallback, and safety/recovery meaning.
- The rendering owner defines the legitimate locale input, catalog, renderer,
  escaping, and platform projection.
- Localization core validates and renders those contracts without inventing
  meaning, recipient locale, or machine behavior.
- Coverage aggregates owner-published evidence without becoming a runtime
  registry.

Every migrated message family identifies its semantic owner, rendering owner,
descriptor-construction boundary, and locale-resolution boundary in focused
tests, its PR evidence, or an owner-local design note.

Adoption is incomplete until the old hardcoded, duplicated, parsed-prose, or
edge-invented presentation path is deleted or explicitly retained as a named
compatibility fallback. Adding a descriptor beside an equally authoritative
string path is non-conforming.

Do not create a descriptor when no product owner can define bounded meaning and
parameters. Do not invent a recipient locale when the rendering surface lacks
an authoritative preference. Preserve reviewed English and stable machine
output instead.

## Locale Registry

Core owns a registry entry for every recognized locale:

```ts
type LocaleRegistration = {
  id: string;
  aliases: readonly string[];
  fallback: readonly string[];
  direction: "ltr" | "rtl";
  englishName: string;
  inferredLanguageDefault?: boolean;
};
```

Requirements:

- `id` and aliases are valid BCP 47 tags or documented compatibility tokens.
- IDs and aliases compare case-insensitively after normalization.
- Alias resolution is deterministic and cycle-free.
- English is always the final fallback.
- Existing accepted values remain aliases until a separately documented
  breaking-change process removes them.
- Unknown values in validated configuration fields, request fields, and
  core/bundled package metadata fail validation.
- A stale stored user preference is nonfatal: record a bounded finding, ignore
  the value, continue precedence resolution, and expose a reset path.
- External package localized metadata may use exact normalized BCP 47 tags
  outside the product registry under the localized-metadata specification; it
  does not extend runtime locale inference or product completeness.
- At most one locale per base language is the inferred language default.
- Unknown inferred platform values use the deterministic matching algorithm
  below and fall back without failing startup.

For Chinese, v1 keeps `zh-CN` and `zh-TW` canonical and accepts `zh-Hans` and
`zh-Hant` as aliases. The registry also maps `zh-HK`, `zh-MO`, and
`zh-Hant-*` inference to `zh-TW`, and `zh`, `zh-CN`, `zh-SG`, and
`zh-Hans-*` inference to `zh-CN`. Canonical-ID renaming is deferred.

Inferred browser and operating-system locale matching:

1. Normalize case and separators and remove Unicode extensions and private-use
   subtags.
2. Match an exact canonical ID or alias.
3. Apply registered script or region inference rules such as the Chinese rules
   above.
4. Progressively truncate subtags to find a registered language-level locale,
   so `fr-CA` can select `fr`.
5. Use the one registered inferred language default, so `ja` can select
   `ja-JP`. A cross-region default such as inferred `pt-PT` selecting the only
   shipped Portuguese catalog, `pt-BR`, requires an explicit product-registry
   rule, rationale, and compatibility fixture; it is never derived merely from
   a shared language subtag.
6. Fall back to English.

The registry validates that this algorithm produces at most one result for
every accepted alias and language default. Explicit stored preferences,
configuration values, request fields, and core/bundled package metadata do not
use approximate matching: they must be a canonical ID or registered alias.
External package localized metadata follows its separate exact-BCP-47 rules.
Browser, operating-system, and host process locale variables are inferred
platform inputs and use the matching algorithm. `OPENCLAW_LOCALE` is the
explicit process override described in CLI Resolution.

## Localization Context

Renderers consume:

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

Resolution precedence:

1. explicit user or recipient preference;
2. explicit request/session locale;
3. persisted surface preference;
4. operator default;
5. process, browser, or platform locale;
6. English.

A surface may omit precedence levels it cannot legitimately observe. It must
not infer locale from message text, user names, IP geography, model output, or
channel identity.

The resolved context is immutable for one rendering operation.

The owning surface entry resolves that context once and passes it through every
nested renderer participating in the operation. Nested helpers must not
re-read environment, browser, connection, or persisted locale inputs during the
same command, request, or response. Shared helpers may provide a compatibility
default for callers that cannot inject a context, but production orchestration
must use the context captured at its entry boundary.

Server-rendered channel messages use `explicit-recipient` only when an existing
recipient/account preference or an owner-approved request field supplies a
validated locale. If neither exists, they use reviewed English fallback. V1
does not invent a shared channel preference store or infer locale from channel
identity or message content.

Gateway `ConnectParams.locale` is the existing explicit locale input for the
connected client experience. A Control UI may use it for responses rendered
back to that same connection. It is not evidence of a separate channel
recipient's or approval reviewer's locale and must not be copied into
server-rendered channel messages.

`audience=user` applies to interactive UI, chat, and approval text.
`audience=operator` applies to human-readable CLI status, health, recovery, and
administrative guidance. Logs and structured automation output are excluded.

## Message Descriptor

```ts
type MessageParam = string | number | boolean;

type LocalizedMessage = {
  key: string;
  params?: Readonly<Record<string, MessageParam>>;
  fallback: string;
};

type CatalogMessage =
  | string
  | {
      kind: "plural";
      param: string;
      cases: Partial<
        Record<"zero" | "one" | "two" | "few" | "many" | "other", string>
      > & { other: string };
    }
  | {
      kind: "select";
      param: string;
      cases: Readonly<Record<string, string>> & { other: string };
    };
```

`LocalizedMessage` is the only internal message descriptor. Gateway
localization metadata is serialized from this type:

```ts
function projectGatewayMessage(
  message: LocalizedMessage,
  englishCatalog: CatalogSnapshot,
): {
  message: string;
  details?: {
    localization: {
      messageKey: string;
      messageParams?: Readonly<Record<string, MessageParam>>;
    };
  };
};
```

Descriptor construction, catalog validation, and Gateway projection use one
shared validator. Gateway projection renders `message` from the reviewed
English catalog snapshot, including any plural or select case, so legacy
clients receive the same English wording that existed before migration. The
projection includes `details.localization` only for recognized, validated
localizable errors. Unknown or intentionally English-only errors project only
`message`.

Reviewed Gateway error descriptors and message-key identities are defined in
the shared `packages/gateway-protocol` boundary so producers and clients depend
on the same protocol-owned contract. Surface-specific catalogs and rendering
remain outside that package.

Requirements:

- `key` is a stable namespaced identifier.
- `fallback` is a required reviewed English template with the same placeholder
  contract as the English catalog entry.
- Parameters are flat scalar values in v1.
- Parameter names are stable and match the English catalog declaration.
- A catalog cannot add, remove, or rename parameters.
- Missing parameters preserve an explicit placeholder or produce a validation
  error; they never become an empty string silently.
- Unknown keys render `fallback`.
- Missing locale entries follow the locale fallback chain, then `fallback`.

Parameters belong to one of two classes:

1. **Literal data**: protocol codes, stable reasons, commands, flags, paths,
   IDs, PIDs, versions, timestamps, user data, and raw upstream diagnostics.
   These values remain unchanged and are escaped by the renderer.
2. **Product-owned presentation**: human labels for modes, install kinds,
   update kinds, statuses, phases, and similar classifications. These values
   must use a catalog key or catalog `select`; a raw internal enum is not
   conforming merely because it is stable in source code.

A localized product-owned wrapper may contain a literal upstream error
parameter. The wrapper is translated; the upstream detail is preserved for
diagnosis. Translators must not parse or rewrite the detail.

V1 supports one top-level plural or select operation per catalog message:

- plural parameters are numeric and use `Intl.PluralRules` cardinal categories
  for the resolved locale;
- select parameters are string or boolean scalar values;
- `other` is required;
- every case has the same placeholder names and types;
- unsupported categories are validation errors;
- nested plural/select expressions are deferred; and
- `fallback` remains one reviewed English template that is safe for every
  allowed selector value, for example `Files: {count}`. It is the descriptor's
  last-resort recovery template, not the source of the normal Gateway
  compatibility message. The reviewed English catalog contains the legacy
  plural/select cases, and Gateway projection renders the matching English case
  before emitting `message`. Other renderers interpolate the selected catalog
  case or the recovery template; descriptor construction sites do not
  pre-render fallback text.

This bounded structure covers count- and state-sensitive runtime copy without
requiring every surface to adopt one catalog file format or a full
MessageFormat implementation.

Each localizable Gateway error code declares an allowed parameter schema with
parameter names, scalar types, and sensitivity classification. Projection
rejects undeclared parameters and any parameter classified as secret or unsafe
for the client boundary.

## Catalog Snapshots

Core and bundled-plugin catalogs activate as immutable snapshots:

```ts
type CatalogSnapshot = {
  registryRevision: string;
  catalogRevision: string;
  catalogs: ReadonlyMap<string, unknown>;
};
```

Each render or Gateway projection captures one snapshot before lookup and uses
it for the entire operation. Validation completes before an atomic snapshot
swap. Failed activation leaves the previous snapshot active. Plugin unload
removes its namespace through the same atomic replacement and emits a bounded
diagnostic with the rejected or removed revision.

Catalog keys must describe meaning, not wording:

```text
good: core.approvals.exec.pendingCommand
bad:  text.approvalRequiredWithColon
```

## Literal Data

The following values are always literal:

- command names and flags;
- approval decisions;
- error codes and stable reasons;
- paths, URLs, IDs, hashes, and timestamps supplied as data;
- config keys;
- provider, model, plugin, skill, and tool IDs;
- source code and shell commands; and
- user-authored content.

Renderers escape literal values for their target format. Translators cannot
modify them or place executable tokens in translation resources.

Security-sensitive catalogs reject every translator-authored Unicode
`Bidi_Control` code point: U+061C, U+200E-U+200F, U+202A-U+202E, and
U+2066-U+2069. They also reject deprecated bidirectional formatting controls
U+206A-U+206F. Renderers, not catalogs, insert the minimum required isolation
controls around escaped literal commands, IDs, paths, numbers, and decision
tokens. Normal Arabic, Persian, Hebrew, and other legitimate script characters
remain valid.

## Rich And Safety Output

V1 does not allow arbitrary translator-authored Markdown or HTML. Complex
output is assembled by code from:

- translated plain-text labels;
- literal values;
- renderer-owned separators;
- renderer-owned Markdown fences or UI elements; and
- stable action descriptors.

Exec approval output must preserve:

- allowed decision set;
- primary and secondary action ordering;
- `/approve` command spelling;
- approval ID or slug;
- command text;
- host, node, CWD, and expiry values; and
- fallback behavior.

Locale changes must not change authorization semantics.

## Gateway Error Projection

Known user-facing Gateway errors may use:

```ts
type LocalizableErrorShape = {
  code: string;
  message: string;
  details?: {
    localization?: {
      messageKey: string;
      messageParams?: Record<string, MessageParam>;
    };
    [key: string]: unknown;
  };
  retryable?: boolean;
  retryAfterMs?: number;
};
```

Rules:

- `code` and `message` remain required.
- `message` remains the English compatibility presentation and is rendered from
  the reviewed English catalog snapshot. For a migrated plural/select message,
  that snapshot preserves the legacy selector-sensitive English cases.
- `details.localization` is optional and does not change protocol branching.
- Clients localize only recognized keys.
- Unknown keys or catalog failures show `message`.
- Sensitive details cannot be promoted into `messageParams`.
- Clients must not parse or compare translated output.
- The producer and consumer use one reviewed key registry from
  `packages/gateway-protocol`.
- A descriptor has at most 16 scalar parameters; parameter names are non-empty
  and at most 64 characters; string values are at most 4096 characters; and
  numeric values are finite.
- Every recognized key declares its allowed parameter names, types, and
  sensitivity classification. Undeclared or sensitive parameters block the
  metadata projection.
- Projection never overwrites existing `details.localization`. Reapplying the
  same reviewed conversion is idempotent.

Defining the optional `details.localization` convention requires Gateway
protocol owner approval and compatibility tests for old and new clients.

The compatibility projection must remain inside the existing opaque `details`
envelope. Supported strict validators reject additive top-level error fields,
while runtime TypeScript guards, Swift `Codable`, Android JSON decoding, and the
current strict schema accept additive data inside `details`.

The ship gate is a checked client matrix containing client/adapter name,
supported version range, parser owner, unknown-field behavior, compatibility
fixture, and result. Missing or failed rows block the optional metadata
projection.

The initial reviewed conversion is approval-not-found only. Adding another
error requires the stable code/detail match, English fallback, key registry,
parameter schema, client catalog entry, and old/new-client fixture in the same
owner-reviewed change.

## CLI Resolution

The existing onboarding source order remains valid:

```text
valid OPENCLAW_LOCALE
> LC_ALL
> LC_MESSAGES
> LANG
> English

invalid OPENCLAW_LOCALE
> diagnostic
> English
```

The runtime registry strips encoding/modifier suffixes and normalizes
separators for every process locale value.

`OPENCLAW_LOCALE` is an explicit override. It must resolve to a canonical ID or
registered alias. An unsupported value emits a bounded diagnostic and falls
directly to English for compatibility; it does not silently select
`LC_ALL`/`LC_MESSAGES`/`LANG` and does not fail CLI startup.

`LC_ALL`, `LC_MESSAGES`, and `LANG` are inferred host inputs. They use the
deterministic inferred-matching algorithm, and an unsupported token continues
to the next host source before English fallback. A persisted setting, config
field, request field, or future explicit CLI flag remains strict. An explicit
CLI locale flag is not part of v1 unless separately approved.

Human output can be localized. Stable automation output must use an existing or
new structured mode such as `--json`; scripts must not be expected to parse
localized tables or prose.

Localization must not mutate an existing structured payload. If a command uses
the same conceptual data for terminal and JSON output, it must build a separate
localized presentation projection rather than replace stable JSON strings,
arrays, status/reason values, or field semantics. Tests compare structured
output across at least English and one non-English locale for exact equality.

## Failure Behavior

- Missing catalog: use English fallback and emit a bounded diagnostic.
- Invalid catalog at build time: fail validation.
- Invalid core catalog: fail only the artifact or package that owns that
  catalog; do not silently publish a partial generated artifact.
- Invalid optional plugin catalog: reject that catalog and retain plugin
  operation with default metadata where safe.
- A missing catalog, key, locale entry, or invalid catalog entry uses the
  reviewed English fallback template with already-validated descriptor
  parameters and emits a bounded diagnostic.
- Invalid descriptor parameters are rejected before rendering. A protocol
  surface uses its canonical English compatibility message; another surface
  uses its named independently renderable English compatibility path. It does
  not attempt to interpolate invalid values or fail the underlying operation.
- Implementations must not broadly swallow unrelated programmer or operation
  exceptions.
- Missing safety translation: use reviewed English, not unreviewed machine
  translation.
- A safety, security, authentication, authorization, destructive-action,
  privacy, or recovery message family without current scoped review evidence
  renders the entire presentation from one reviewed English snapshot; it never
  mixes translated and fallback fragments.
- Emergency rollback: remove the affected translation or key mapping and use
  the English fallback without changing codes, commands, or authorization
  behavior.

## Observability

Diagnostics may record:

- message key;
- resolved locale;
- locale source;
- fallback depth;
- catalog owner; and
- catalog revision;
- missing-key or invalid-parameter finding code.

Public diagnostics and metrics must not record rendered text, message
parameters, recipient or user identity, paths, commands, tokens, raw exceptions,
or other literal values by default. A surface that requires private diagnostic
capture must use an existing trusted/private-data path with explicit opt-in and
must not promote that data into metrics, stability output, or public findings.

## Minimal Contribution Example

Adding one CLI message requires:

1. Declare the English source key and parameters:

   ```ts
   "cli.agent.messageFile.empty": "Message file is empty: {path}"
   ```

2. Replace the literal renderer call:

   ```ts
   renderLocalizedMessage(context, {
     key: "cli.agent.messageFile.empty",
     params: { path: messageFile },
     fallback: "Message file is empty: {path}",
   });
   ```

3. Add locale entries with the same `{path}` placeholder.
4. Classify each parameter as literal data or product-owned presentation.
5. Run key, placeholder, fallback, mixed-language, and affected renderer tests.
6. Compare any structured output under English and one non-English locale.
7. Leave `path` literal and escaped by the target renderer.
8. Delete the superseded literal presentation path or document the exact
   compatibility caller that still owns it.

## Conformance

A runtime localization implementation conforms to v1 when:

- locale and aliases resolve deterministically;
- English fallback is always available;
- descriptor rendering passes placeholder parity tests;
- one operation uses one immutable context across all nested renderers;
- product-owned presentation enums cannot appear as raw untranslated
  interpolation values;
- literal commands, flags, paths, IDs, PIDs, versions, and upstream diagnostics
  remain unchanged in localized output;
- structured automation output is exactly locale-invariant;
- migrated renderers include a mixed-language interpolation regression fixture;
- plural/select rendering passes English, Russian/Ukrainian, Polish, and Arabic
  category fixtures;
- old Gateway clients continue to receive usable English messages;
- new clients localize known errors without branching on text;
- approval rendering preserves action semantics in every locale;
- semantic and rendering ownership boundaries are named;
- public diagnostics contain only bounded localization identity and provenance,
  not rendered or literal content;
- one owner-local conformance record proves accepted, fallback, invalid,
  compatibility, privacy, and rollback behavior;
- the superseded presentation authority is deleted or explicitly retained only
  for a named compatibility path;
- localization failure cannot crash the Gateway or authorize an action;
- warmed catalog lookup and rendering of one message with at most 16 scalar
  parameters performs no I/O or network access. Implementations should publish
  a reproducible warmed benchmark before adopting a numeric performance gate;
  and
- catalog replacement cannot split one in-flight rendering operation across
  revisions.
