---
title: Automations Terminology and Configurable Feature Naming
authors:
  - Omar Shahine
created: 2026-07-23
last_updated: 2026-07-25
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/50
---

# Proposal: Automations Terminology and Configurable Feature Naming

## Summary

OpenClaw's scheduled-jobs feature is internally called "cron" but the product
and user model is "Automations." Today the terminology is split three ways:
the web UI mostly says "Automations," the docs say "Scheduled tasks," and the
agent, CLI, and a long tail of UI/doctor strings still say "cron." This RFC
proposes (1) finishing the rename so the word "cron" never appears in
user-facing UX or in text the model sees and can repeat, reserving "cron"
exclusively for the schedule *syntax* (cron expressions) and for internal
identifiers, and (2) making the feature's display name configurable so
deployments that tailor OpenClaw can call it something else entirely (for
example "Habits") through a single config value.

## Motivation

Three names for one feature is a product defect. A user clicks "Automations"
in the nav, lands on a `/cron` URL, sees an "Agent Cron Jobs" panel, reads
"cron job(s) failed" chips in the sidebar, and when they ask the agent about
it, the agent answers in terms of its `cron` tool. The command palette calls
the same feature "Scheduled." Docs call it "Scheduled tasks."

The agent surface matters most: the model is *told* the feature is called
cron. The tool is named `cron`, its ~40-line description uses the word
repeatedly, the heartbeat guidance says "Recurring tasks are cron jobs,"
session labels render as `Cron: ...`, and injected transcript notices say "A
scheduled cron job delivered this message." No amount of UI polish fixes what
the assistant says out loud to end users.

Separately, some operators tailor OpenClaw for their own users and want to
brand the concept differently ("habits," "routines," "rituals"). There is
currently no terminology mechanism at all; the closest precedent is
`ui.assistant.name`, which renames the assistant identity as "branding
without changing runtime behavior." Feature naming deserves the same seam.

## Goals

- The word "cron" does not appear in any rendered UI string, CLI help/output
  prose, doctor prose, docs body copy, or model-visible text (tool names,
  descriptions, system prompts, injected session text, session labels,
  default job names) when referring to the *feature*.
- "Cron" remains the correct, unchanged name for the schedule syntax: cron
  expressions, `--cron <expr>`, `{kind: "cron"}`, "Cron expression is
  required." This mirrors the distinction the UI schedule-type selector
  already draws (Every / At / Once / Cron).
- All internal identifiers stay untouched: config key `cron.*`, gateway RPC
  methods `cron.add|list|get|update|remove|run|runs|status|trigger`, SQLite
  tables (`cron_jobs`, `cron_job_scratch`, `claw_cron_refs`), state path
  `~/.openclaw/cron/`, session-key prefix `cron:`, log subsystem tags, and
  the `openclaw cron` CLI token (kept as a compatible alias).
- A single configurable terminology value lets a deployment replace
  "automation/Automations" with a custom term across UI, agent prompts, and
  CLI display text, without forking string catalogs.

## Non-Goals

- No renaming of wire protocol methods, config keys, DB tables, state paths,
  or session-key namespaces. No protocol version bump, no doctor migration
  for storage. The rename is display-layer and prompt-layer only.
- No removal of the `openclaw cron` command token. `openclaw automations`
  becomes the primary documented form; `cron` stays as an alias
  indefinitely (documented CLI flows are compatibility-sensitive public API).
- No attempt to stop the model from ever emitting the token `cron` in
  technical contexts (it must emit `{kind: "cron"}` on the wire, and cron
  expressions are a universal term). The goal is what the feature is
  *called*, not banning a dictionary word.
- No general translation work. The existing UI i18n pipeline (RFC 0024) and
  docs glossary own translation; this RFC adds a term-injection point that
  flows through them. Custom terms are English-first in v1 — non-customized
  locales keep their canonical localized terms via explicit fallback.
- Docs are not per-deployment. Custom terms ("Habits") apply to the runtime
  product surfaces only; docs.openclaw.ai keeps the canonical "Automations."

## Proposal

Two phases, shipped and accepted independently. Phase 1 is the rename with no
new config surface and stands on its own. Phase 2 adds the terminology config
on top of the seams Phase 1 creates and is contingent on Phase 1 landing; if
Phase 2 stalls, Phase 1 still leaves the product consistent.

### Phase 1: finish the rename to "Automations"

**Agent surface** (the largest gap, ~15 files in `openclaw/openclaw`):

- Rename the agent tool `cron` → `automations` as a **tool-identity
  migration**, not a string swap. The tool name is a runtime identifier with
  behavioral consumers keyed on the exact string, so the rename ships as one
  canonical contract:
  - **Single source of truth.** The tool module exports
    `AUTOMATIONS_TOOL_NAME = "automations"`,
    `LEGACY_AUTOMATIONS_TOOL_NAMES = ["cron"]`, and a predicate
    `isAutomationsToolName(name)`. No other file spells the tool name as a
    literal.
  - **Known name-keyed consumers move to the constant/predicate** (inventory
    from current `main`; the implementation PR must re-sweep):
    `src/agents/core-tool-factory-descriptors.ts` (narrow tool
    construction), `src/agents/agent-tools.deferred-followup.ts` (scheduler
    availability detection for exec/process guidance),
    `src/agents/embedded-agent-subscribe.handlers.tools.ts` (successful-add
    counting that feeds incomplete-turn recovery, plus its CLI-arg
    heuristic), `LOCAL_MODEL_LEAN_DENY_TOOL_NAMES` in
    `src/agents/local-model-lean.ts`, the system-prompt `toolOrder` list,
    the tool-catalog entry, and tool-policy allow/deny resolution including
    groups and profiles.
  - **Persisted policy.** `openclaw doctor --fix` rewrites stored
    `toolsAllow`/`toolsDeny` entries `"cron"` → `"automations"`. Until
    rewritten, policy resolution normalizes the legacy name through the
    predicate so existing configs keep constructing and permitting the tool.
  - **Invocation compat.** The tool router accepts a model-emitted `cron`
    tool call as `automations` for one release train (sessions upgraded
    mid-conversation carry old schema bytes in cached context), with the
    removal plan named at the alias site.
  - **Transcripts and tool cards.** Historical transcripts keep the literal
    `cron` tool name; renderers already display arbitrary tool names and
    must not special-case it. No transcript rewriting.
  - **Regression tests** cover both names across policy resolution, narrow
    construction, deferred-followup detection, and add-counting.
  The tool keeps calling the `cron.*` gateway methods internally; the wire
  is unaffected.
- Reword system-prompt lines (`src/agents/system-prompt.ts`), heartbeat
  guidance (`src/auto-reply/heartbeat.ts`,
  `src/agents/heartbeat-system-prompt.ts`), and the subagent prompt
  (`src/agents/subagent-system-prompt.ts`).
- Reword runtime injections: session labels `Cron: ...` and the run
  preamble (`src/cron/isolated-agent/run.ts`), delivery awareness text
  (`src/cron/isolated-agent/delivery-dispatch.ts`), default job name
  "Cron job" (`src/cron/service/normalize.ts`), and the subagent progress
  summary "Running cron job."
- Reword gateway error strings that surface through tool results
  (`src/gateway/server-methods/cron.ts`, `src/cron/service/{jobs,ops,normalize}.ts`)
  where they name the feature rather than an RPC method. Errors that echo
  method names (`invalid cron.list params`) may keep the method string;
  it is a wire identifier.
- Update the shipped workspace template
  (`docs/reference/templates/AGENTS.md`).
- Add one system-prompt rule: the feature is called Automations (or the
  configured term, after Phase 2); never call it cron. This is the backstop
  for model utterances, since the model knows the word independently.

**Web UI** (small; the catalog already says "Automations"):

- Fix the ~8 leftover catalog values in `ui/src/i18n/locales/en.ts`:
  "Agent Cron Jobs," "Gateway cron status.," "Show cron sessions,"
  "{count} cron job(s) failed/overdue," the "Cron" task-origin badge, and
  the two subtitles that list "cron."
- Move the hardcoded `"Cron:" / "Cron Job:"` session-title prefix in
  `ui/src/lib/session-display.ts` into the i18n catalog and reword it.
- Unify the command palette entry ("Scheduled" → "Automations").
- Route `/cron` → `/automations` with the old path redirecting (client-side
  route alias; no server contract involved).
- The schedule-type selector option "Cron," expression fields, and
  validation strings stay: they name the syntax.

**CLI**:

- Add `openclaw automations` as a top-level alias for the existing command:
  `src/cli/cron-cli/register.ts` (`.alias(...)`, same pattern as
  `tui`/`terminal`/`chat`), the lazy-dispatch table in
  `src/cli/program/register.subclis-core.ts`, the static help descriptor in
  `src/cli/program/subcli-descriptors.ts`, and the network-policy path in
  `src/cli/command-catalog.ts`.
- Reword help text and output prose (~10 files under `src/cli/cron-cli/`,
  centralized formatter in `shared.ts`: "No cron jobs." → "No automations.",
  "Manage cron jobs (via Gateway)" → "Manage automations (via Gateway)").
  Flags `--cron`, "Cron expression" descriptions stay (syntax).
- Reword doctor prose (~13 files under `src/commands/doctor/cron/`),
  keeping check IDs and requirement strings unchanged (identifiers).
- Config schema display metadata: `src/config/schema.labels.ts`,
  `schema.help.automation.ts` ("Cron" → "Automations (cron)" or similar;
  the section label should still hint at the on-disk `cron` key so users
  can find it in `openclaw.json`).
- Log lines (`cron: ...` prefixes, ~81 messages) and the `cron-delivery`
  subsystem tag are ops-level grep anchors, not product UX; they stay.

**Docs**: reword body copy on the ~6 substantive `docs/automation/` pages and
`docs/cli/cron.md` so "Automations" is the feature name, "cron expression"
the syntax, and the `cron.*` config/RPC names presented as internal
identifiers. Page titles and the nav group already say "Scheduled tasks" /
"Automation"; retitle to "Automations" for consistency. Add redirects for
any URL moves (precedent exists in `docs/docs.json`).

Expected churn: prompt snapshots and i18n/test fixtures are the bulk of the
diff; behavior changes are limited to the tool rename (with alias) and the
UI route alias.

### Phase 2: configurable terminology

Add one config surface, defaulting to the Phase 1 terms so it is invisible
unless used. The shape is locale-keyed from day one so it composes with the
accepted localization contract (RFC 0024) without a later migration:

```jsonc
{
  "ui": {
    "terminology": {
      "automation": {
        "en": { "singular": "habit", "plural": "habits" }
      }
    }
  }
}
```

- **Ownership: this explicitly broadens the `ui` contract.** Today `ui` is
  documented as presentation customization with no runtime behavior, and
  `ui.assistant.name` is projected only as Control UI identity. This RFC
  amends that contract: `ui.terminology` is a runtime-wide product-language
  value consumed by the Control UI, agent prompt builders, and CLI output
  formatters. The `ui` schema help and docs are updated to say so; the
  broadening is a deliberate part of this proposal, not a side effect. (The
  alternative, a new top-level key, is worse under the repo's config-surface
  bar; see Rationale.)
- **Shape and validation.** Per concept, a locale-keyed map of
  `{ singular, plural }`; `en` is required when the concept is set. Casing
  is derived (capitalize for titles/labels, lowercase mid-sentence). Values
  are plain words, length-capped, validated like `ui.assistant.name`.
- **Localization scope (v1): English-first with explicit fallback.** When
  the active UI locale has no entry in the map, that locale renders its
  canonical localized term from the standard catalogs — a custom English
  term never leaks into a non-English sentence, and locales the operator
  has not customized behave exactly as before. Locales with an entry use
  it through the same interpolation path. Per RFC 0024, surfaces adopting
  interpolated terminology are covered by its mixed-language interpolation
  checks; grammatical agreement beyond singular/plural (case, gender) is
  the operator's responsibility for the locales they choose to customize.
- **Gateway carrier.** The Control UI bootstrap payload — the same
  gateway-to-browser projection that carries `ui.assistant.name` — gains a
  `terminology` field. On config reload the gateway re-projects it and the
  i18n manager updates its ambient params in place; missing or invalid
  values fall back to the built-in defaults. This is a named, additive
  extension of the bootstrap contract, specified in the implementation PR.
- **UI.** The i18n layer's existing `t(key, params)` interpolation carries
  the term: the affected `en.ts` values (~30 keys, mostly the `cron.*`
  namespace) gain `{term}`/`{termPlural}`/`{termTitle}` placeholders, and
  the i18n manager injects the resolved per-locale values as ambient
  params. No architectural change to the translator; localized catalogs
  translate around the placeholder as they already do for other params.
- **Agent.** Prompt builders (tool description, catalog summary, system
  prompt lines, heartbeat guidance, session labels, default job name,
  delivery notices) template the term at build time. The value is
  config-stable, so prompt-cache determinism holds; changing it invalidates
  the cache once, which is expected and acceptable. The tool *name* stays
  `automations` regardless of the term (tool names are identifiers in
  allow-lists and transcripts; only descriptions and prose carry the custom
  term).
- **CLI: runtime output only; help text is excluded.** On current `main`,
  `buildProgram()` registers the command tree and its help/description
  strings before config bootstrap, which runs in a Commander pre-action
  hook — help invocations return before any config is loaded. Configurable
  terminology therefore applies only to post-bootstrap output (command
  results, warnings, doctor prose) resolved through the central formatter
  after the config snapshot exists. `--help` prose, command registration
  strings, and completions always use the canonical "automations" term.
  Command tokens (`automations`, `cron`) never change per deployment.
- **Docs pointer.** One paragraph in the automation docs explaining the
  terminology setting and its English-first scope.

Per the repo's config-surface bar: the justification for a new key is that
no existing behavior can express per-deployment product language, and the
alternative (forking the i18n catalog and prompt strings) is strictly worse.
`ui.terminology` is namespaced so future concepts (if ever needed) extend
the same object rather than minting new top-level keys.

## Rationale

**Why not rename the internal identifiers too?** Renaming `cron.*` RPC
methods, the `cron` config key, DB tables, or state paths buys no user value
(users never see them once display text is fixed) and costs a protocol
version bump, doctor migrations, and ecosystem breakage. The docs already
model the correct split: display name for people, technical identifier
underneath.

**Why rename the agent tool instead of keeping `cron` as the stable runtime
identifier with a display-name seam?** The considered alternative — stable
internal id, custom model/display name layered on top — was rejected. The
tool name is the single most prominent model-visible string: it appears in
the tool schema, transcripts, tool-call UI, permission prompts, and the
model's own phrasing ("I'll use the cron tool"). A display seam that leaves
the model calling a tool literally named `cron` fails the RFC's core goal;
a seam that presents a different name to the model than the runtime id is a
rename with extra indirection — the same name-keyed consumers must be
audited either way, plus a permanent translation layer. Renaming once,
through the canonical migration contract in Phase 1 (single constant,
predicate, doctor rewrite, bounded invocation alias, regression tests), is
the smaller permanent surface.

**Why placeholders in i18n rather than a term-resolution layer in the
translator?** Parameter interpolation already exists and is visible in the
catalog itself: a translator sees `"No {termPlural} yet"` and knows a word
is injected. A hidden lookup-time substitution layer would rewrite strings
invisibly and complicate localization review.

**Why not make the CLI command name configurable?** The CLI builds its
command tree after config load, so a dynamic alias is technically possible,
but a per-deployment command token breaks documentation, support, scripts,
and muscle memory. Prose can be branded; tokens should be stable.

**Why config and not an env var?** The repo treats env surface as equally
expensive, and the value must reach the UI (served by the gateway) and
prompt builders identically; config is the single distribution point and
follows the `ui.assistant.name` precedent.

## Unresolved questions

- **Config settings section label.** The settings UI section maps to the
  on-disk `cron` key. Pure "Automations" labeling hides the key name users
  must type in `openclaw.json`; "Automations (`cron`)" is honest but
  clunky. Needs a product call.
- **Scope of "model never says cron."** The system-prompt rule plus string
  sweep controls first-party text, but the model can still say "cron" when
  discussing cron expressions or third-party content. Proposed line: syntax
  mentions are fine, feature mentions are not. Is that the accepted bar?
- **Invocation-alias window.** The tool router accepts model-emitted `cron`
  calls for one release train; confirm one train is enough for long-lived
  sessions, or whether the alias should key off session age instead.
- **RFC 0024 adoption boundary.** Which terminology-interpolated surfaces
  count as "adopted localized surfaces" under RFC 0024's coverage checks in
  v1 — Control UI only, or agent-visible prompt text too (which is not
  localized today).
