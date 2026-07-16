# Localization RFC Review Findings

These findings apply the project role lenses to RFC 0024.

## Gateway Runtime Owner

- Blocking: do not pass translator instances through deep Gateway business
  logic.
- Required: localization failures must fall back without crashing the Gateway
  or changing an authorization result.
- Required: optional Gateway error metadata must preserve old clients and the
  current English message.
- Simplification: convert only stable known errors; leave unknown exceptions as
  sanitized fallback rather than creating a universal exception translator.
- Proof: measure catalog lookup and rendering as bounded in-memory work with no
  runtime network dependency.

## Multi-Channel Power User

- Blocking: one locale choice must not require per-command or per-channel
  template maintenance.
- Required: explicit locale choice must outrank browser or host inference and be
  easy to reset.
- Required: `/approve`, IDs, commands, paths, and structured output remain
  recognizable across locales.
- Simplification: use one command metadata source for Discord, Telegram, CLI,
  TUI, and Control UI instead of adapter-specific copies.
- Proof: an upgrade preserves stored choices and current English output when no
  new locale preference is configured.

## Security And Compliance

- Blocking: translations cannot alter approval decisions, executable tokens,
  policy identity, or audit codes.
- Required: safety and destructive-operation text needs human review before a
  locale is called complete.
- Required: audit and telemetry record stable message keys and codes, not only
  translated prose.
- Simplification: no runtime remote translation service and no unsigned catalog
  loading.
- Proof: approval semantics remain identical across English, one non-English
  locale, and missing-key fallback.

## Community And Simplicity

- Blocking: do not require every contributor or plugin author to adopt one
  localization framework.
- Required: English remains readable in source and is always a fallback.
- Required: adding a translation should be an ordinary in-repo contribution
  with documented checks.
- Simplification: preserve native UI, docs, and platform pipelines; share only
  locale identity, descriptor semantics, validation, and reporting.
- Proof: a small plugin can provide default English metadata and remain valid
  without shipping additional locales.

## Resulting Revisions

The review changes the proposal in five ways:

1. Rendering occurs at the edge rather than at exception construction.
2. Gateway localization metadata is optional and additive.
3. Safety output is assembled from translated labels and literal structured
   actions, not translator-authored templates.
4. Product UI locale and model-generated content language are separate.
5. Coverage gates rise per migrated surface instead of blocking the repository
   with an immediate all-string extraction.

