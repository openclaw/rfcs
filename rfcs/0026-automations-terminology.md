---
title: Automations Terminology and Configurable Feature Naming
authors:
  - Omar Shahine
created: 2026-07-23
last_updated: 2026-07-23
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
- No per-locale terminology. The existing UI i18n pipeline and docs glossary
  handle translation; this RFC only adds the English-source term injection
  point that localized catalogs can flow through.
- Docs are not per-deployment. Custom terms ("Habits") apply to the runtime
  product surfaces only; docs.openclaw.ai keeps the canonical "Automations."

## Proposal

Two phases. Phase 1 is a coordinated string sweep with no new config surface.
Phase 2 adds the terminology config on top of the seams Phase 1 creates.

### Phase 1: finish the rename to "Automations"

**Agent surface** (the largest gap, ~15 files in `openclaw/openclaw`):

- Rename the agent tool `cron` → `automations`: `label`, `name`,
  `displaySummary`, and the full description block in
  `src/agents/tools/cron-tool.ts`, the catalog entry in
  `src/agents/tool-catalog.ts`, and the preset in
  `src/agents/tool-description-presets.ts`. The tool keeps calling the
  `cron.*` gateway methods internally; the wire is unaffected.
- Accept the old tool name in `toolsAllow` / tool-policy matching so
  existing configs that allow `cron` keep working (one-line alias in policy
  resolution, or a doctor rewrite of the allow-list entry).
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
unless used:

```jsonc
{
  "ui": {
    "terminology": {
      "automation": { "singular": "habit", "plural": "habits" }
    }
  }
}
```

- **Shape.** Singular and plural forms are both required when set; casing is
  derived (capitalize for titles/labels, lowercase mid-sentence). Values are
  plain words, length-capped, validated like `ui.assistant.name`.
- **UI.** The i18n layer's existing `t(key, params)` interpolation carries
  the term: the affected `en.ts` values (~30 keys, mostly the `cron.*`
  namespace) gain `{term}`/`{termPlural}`/`{termTitle}` placeholders, and
  the i18n manager injects the configured values as ambient params. No
  architectural change; localized catalogs translate around the
  placeholder as they already do for other params.
- **Agent.** Prompt builders (tool description, catalog summary, system
  prompt lines, heartbeat guidance, session labels, default job name,
  delivery notices) template the term at build time. The value is
  config-stable, so prompt-cache determinism holds; changing it invalidates
  the cache once, which is expected and acceptable. The tool *name* stays
  `automations` regardless of the term (tool names are identifiers in
  allow-lists and transcripts; only descriptions and prose carry the custom
  term).
- **CLI.** Display strings resolve the term from loaded config through the
  central formatter. The command tokens (`automations`, `cron`) do not
  change per deployment: docs, shell history, and support content cannot
  follow a moving token. The custom term appears in output prose and help
  descriptions only.
- **Docs pointer.** One paragraph in the automation docs explaining the
  terminology setting.

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

**Why rename the agent tool at all, instead of only its description?** The
tool name is itself model-visible vocabulary and shows up in transcripts,
tool-call UI, permission prompts, and the model's own phrasing ("I'll use
the cron tool"). Renaming it is cheap (one definition site) and the
allow-list alias covers compatibility. Leaving it named `cron` would leave
the most prominent agent-facing string untouched.

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
- **Grammar beyond singular/plural.** English gets by with two forms plus
  derived casing. If localized catalogs need case/gender agreement with an
  injected term, translators may need locale-specific placeholder handling.
  Acceptable to ship English-first and let the localization RFC (0024)
  owners weigh in.
- **Scope of "model never says cron."** The system-prompt rule plus string
  sweep controls first-party text, but the model can still say "cron" when
  discussing cron expressions or third-party content. Proposed line: syntax
  mentions are fine, feature mentions are not. Is that the accepted bar?
- **Tool-name alias mechanics.** Whether old `toolsAllow: ["cron"]` entries
  are aliased at policy-resolution time forever, or rewritten once by
  `openclaw doctor --fix` and dropped after a deprecation window.
- **Does `ui.terminology` apply to the `openclaw automations` CLI help
  noun?** Proposal says yes for prose; confirm that seeing "habits" in
  `--help` output while the command is `automations` is acceptable, or
  whether CLI prose should stay canonical.
