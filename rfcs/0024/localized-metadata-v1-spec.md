# Localized Metadata v1 Specification

This document defines locale-aware display metadata for commands, skills, and
other cataloged OpenClaw capabilities.

Status: draft, tied to RFC 0024.

## Scope

V1 covers:

- slash/chat command descriptions;
- Control UI and TUI command descriptions;
- Telegram and Discord native command-menu descriptions;
- skill display names and descriptions; and
- bundled plugin-provided command or skill metadata.

It does not translate executable names, invocation tokens, IDs, or paths.

## Localized Text

```ts
type LocalizedText = {
  default: string;
  localizations?: Readonly<Record<string, string>>;
};
```

Rules:

- `default` is required English.
- Core and bundled metadata locale keys resolve through the shared product
  locale registry.
- External packages may additionally use normalized valid BCP 47 tags that are
  not product locales. Those entries are package-owned, do not alter the core
  registry or completeness claims, and are projected only to surfaces or
  platforms that request and support the exact tag.
- Alias keys are accepted at authoring time only if normalization produces one
  unambiguous canonical entry.
- Two aliases that resolve to the same locale with different text are invalid.
- Missing locale text falls back through the locale chain to `default`.
- Empty localized strings are invalid.

## Commands

Command identity remains:

```ts
type LocalizedCommandMetadata = {
  name: string;
  description: string | LocalizedText;
};
```

`name` is never translated. A plain string is the legacy English-only form.
Platform adapters normalize either form internally and map
`description.localizations` to native platform fields where supported.

Existing command definitions with a plain English description remain valid and
require no migration. They are interpreted as `default` with no
`localizations`. Serializers preserve the plain-string form unless localized
entries are added.

Platform constraints are validated per adapter:

- maximum length;
- allowed characters;
- locale code support;
- duplicate normalized locale;
- update/reconcile behavior; and
- fallback when a platform does not support the locale.

RFC 0017 owns the canonical command catalog. RFC 0024 adds the localized text
shape and locale projection rules.

## Skills

```ts
type LocalizedSkillMetadata = {
  id: string;
  displayName?: string | LocalizedText;
  description?: string | LocalizedText;
};
```

Rules:

- `id`, directory name, invocation name, and tool identity remain stable.
- Localized display names are presentation only.
- Core and bundled skills may ship reviewed catalogs in-tree.
- External skills package their own metadata.
- OpenClaw validates shape and BCP 47 locale syntax but does not certify
  translation quality for third-party packages.
- Search may index localized display text, but installation and policy continue
  to use stable IDs.
- Every currently published skill with no localized fields remains valid with
  no required package or manifest change.
- Existing plain-string display names and descriptions are interpreted as
  English defaults and retain their legacy serialized shape until
  localizations are added.

## Plugin Ownership

Plugins may register localized metadata only for capabilities they own. They
cannot overwrite core or another plugin's keys.

Namespace ownership is enforced by catalog validation and the blocking
`namespace-ownership` coverage check.

Metadata is activation-pinned with the plugin registry snapshot. Reload
atomically replaces the plugin's metadata set.

External runtime-message catalogs are not registered through arbitrary
callbacks or translation-provider hooks. A future or owner-approved v1 Plugin
SDK seam may accept a declarative package-owned catalog under the plugin's
namespace, validate it before activation, and replace it atomically with the
plugin snapshot. Without that owner-approved seam, v1 external localization is
limited to the metadata defined in this specification.

## Security

- Localized text is untrusted display data.
- UI rendering escapes it.
- It cannot contain executable command tokens that replace the stable name.
- It cannot change permissions, tool schema, approval policy, or routing.
- Logs and audit events record stable IDs, optionally alongside localized
  display text.

## Conformance

A metadata implementation conforms when:

- command and skill identity remain stable across locales;
- native platform projections preserve reconcile behavior;
- fallback is deterministic;
- duplicate aliases are rejected;
- localized metadata cannot alter execution or policy; and
- one catalog can feed CLI, UI, and supported channel projections.
