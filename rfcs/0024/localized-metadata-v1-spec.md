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
- Locale keys resolve through the shared locale registry.
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
  description: LocalizedText;
};
```

`name` is never translated. Platform adapters map `description.localizations`
to native platform fields where supported.

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
  displayName: LocalizedText;
  description: LocalizedText;
};
```

Rules:

- `id`, directory name, invocation name, and tool identity remain stable.
- Localized display names are presentation only.
- Core and bundled skills may ship reviewed catalogs in-tree.
- External skills package their own metadata.
- OpenClaw validates shape and locale IDs but does not certify translation
  quality for third-party packages.
- Search may index localized display text, but installation and policy continue
  to use stable IDs.

## Plugin Ownership

Plugins may register localized metadata only for capabilities they own. They
cannot overwrite core or another plugin's keys.

Metadata is activation-pinned with the plugin registry snapshot. Reload
atomically replaces the plugin's metadata set.

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

