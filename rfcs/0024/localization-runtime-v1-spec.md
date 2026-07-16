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

## Locale Registry

Core owns a registry entry for every recognized locale:

```ts
type LocaleRegistration = {
  id: string;
  aliases: readonly string[];
  fallback: readonly string[];
  direction: "ltr" | "rtl";
  englishName: string;
};
```

Requirements:

- `id` and aliases are valid BCP 47 tags or documented compatibility tokens.
- IDs and aliases compare case-insensitively after normalization.
- Alias resolution is deterministic and cycle-free.
- English is always the final fallback.
- Existing accepted values remain aliases until a separately documented
  breaking-change process removes them.
- Unknown explicit values fail validation.
- Unknown inferred platform values fall back without failing startup.

For Chinese, v1 must accept `zh-CN`, `zh-TW`, `zh-Hans`, and `zh-Hant`.
Selection of canonical internal IDs remains an RFC acceptance decision.

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

## Message Descriptor

```ts
type MessageParam = string | number | boolean;

type LocalizedMessage = {
  key: string;
  params?: Readonly<Record<string, MessageParam>>;
  fallback: string;
};
```

Requirements:

- `key` is a stable namespaced identifier.
- `fallback` is required reviewed English text.
- Parameters are flat scalar values in v1.
- Parameter names are stable and match the English catalog declaration.
- A catalog cannot add, remove, or rename parameters.
- Missing parameters preserve an explicit placeholder or produce a validation
  error; they never become an empty string silently.
- Unknown keys render `fallback`.
- Missing locale entries follow the locale fallback chain, then `fallback`.

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
  messageKey?: string;
  messageParams?: Record<string, MessageParam>;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};
```

Rules:

- `code` and `message` remain required.
- `message` remains the English compatibility fallback.
- `messageKey` is optional and does not change protocol branching.
- Clients localize only recognized keys.
- Unknown keys or catalog failures show `message`.
- Sensitive details cannot be promoted into `messageParams`.
- Clients must not parse or compare translated output.

Adding these optional fields requires Gateway protocol owner approval and
compatibility tests for old and new clients.

## CLI Resolution

The existing onboarding order remains valid:

```text
OPENCLAW_LOCALE
> LC_ALL
> LC_MESSAGES
> LANG
> English
```

The runtime registry normalizes these values for all migrated CLI commands.
An explicit CLI locale flag is not part of v1 unless separately approved.

Human output can be localized. Stable automation output must use an existing or
new structured mode such as `--json`; scripts must not be expected to parse
localized tables or prose.

## Failure Behavior

- Missing catalog: use English fallback and emit a bounded diagnostic.
- Invalid catalog at build time: fail validation.
- Invalid optional plugin catalog: reject that catalog and retain plugin
  operation with default metadata where safe.
- Renderer exception: use English fallback; do not fail the underlying
  operation solely because localization failed.
- Missing safety translation: use reviewed English, not unreviewed machine
  translation.

## Observability

Diagnostics may record:

- message key;
- resolved locale;
- locale source;
- fallback depth;
- catalog owner; and
- missing-key or invalid-parameter finding code.

Diagnostics must not record sensitive parameter values by default.

## Conformance

A runtime localization implementation conforms to v1 when:

- locale and aliases resolve deterministically;
- English fallback is always available;
- descriptor rendering passes placeholder parity tests;
- old Gateway clients continue to receive usable English messages;
- new clients localize known errors without branching on text;
- approval rendering preserves action semantics in every locale; and
- localization failure cannot crash the Gateway or authorize an action.

