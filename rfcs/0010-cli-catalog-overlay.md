---
title: CLI Catalog Overlay for AI-Routable Surfaces
authors:
  - Gio
created: 2026-07-04
last_updated: 2026-07-05
status: draft
issue:
rfc_pr:
---

# Proposal: CLI Catalog Overlay for AI-Routable Surfaces

## Summary

Create one read-only catalog view over existing OpenClaw command and tool
surfaces so different consumers can inspect the same normalized inventory
through scoped lenses. The first implementation makes static CLI descriptors,
command-route policy, routed operations, runtime-registered Commander commands,
plugin CLI descriptors, and explicit agent/tool surfaces visible through a
single source-labeled catalog. It then derives separate prompt, audit, coverage,
and operator lenses from that catalog instead of making every consumer parse the
same giant view.

The catalog overlay is metadata only. It does not add a new execution
dispatcher, runtime hook, gateway plugin, policy engine, or expression language.
Selected commands and tools continue to own validation, permissions,
confirmation, execution, and results.

## Motivation

OpenClaw has several prompt-like operational surfaces that already map to
bounded commands or tools: session status, process control, gateway operations,
skill proposal lifecycle, delegation, config updates, exports, diagnostics, and
similar command surfaces. Today those flows are often described to the model as
conversation text even when the correct behavior is already finite.

That creates three problems:

- the model can phrase or sequence the operation incorrectly
- the operation contract is harder to audit and test
- repeated flows consume prompt space restating bounded behavior already present
  in command metadata

The goal is not primarily token reduction. The bigger win is removing ambiguity
from actions that already have fixed contracts and already exist as commands or
tools.

## Goals

- Let the AI choose an existing command or tool surface from reviewable
  metadata.
- Keep the selected surface responsible for validation, permissions,
  confirmation, execution, and output.
- Keep prompt-facing metadata lean enough to avoid turning the catalog into a
  large prompt tax.
- Provide a programmatic and CLI-readable list of OpenClaw command/tool surfaces
  for maintainers and operators.
- Distinguish static descriptors, route-policy entries, explicit overlay
  entries, runtime-registered commands, and plugin descriptor entries with
  source/discovery metadata.
- Generate scoped lenses from the same inventory for prompts, audit/policy
  review, smoke coverage, and operator handoffs.
- Add drift guards so descriptor-backed entries, list output, prompt projection,
  and consumer lenses stay aligned.

## Non-Goals

- Replacing open-ended reasoning, code review, design review, or
  troubleshooting.
- Turning every prompt into a DSL.
- Adding a general-purpose expression language.
- Encoding product judgment or policy enforcement into the catalog itself.
- Adding a new execution surface, dispatcher, runtime hook, or gateway plugin.
- Requiring skill authors or command owners to learn a new authoring format in
  the first pass.
- Exposing this as a public plugin SDK contract in the first implementation.

## Proposal

Start with a hierarchical, additive catalog over existing registries instead of
a second command registry. The first list is structured as:

- `cli.descriptors`: the existing top-level/core and sub-CLI descriptor
  inventory. In the prototype this is 56 descriptors.
- `cli.commandRoutes`: the existing command-path routing and startup-policy
  registry. In the prototype this is 93 command routes.
- `cli.routedOperations`: the mechanical fast-path route IDs derived from the
  command-route registry and routed-command definitions. In the prototype this
  is 14 routed operations.
- `agentToolSurfaces`: explicit metadata for tool-backed or non-CLI surfaces
  that the AI also needs for routing. In the prototype this is 5 surfaces.
- `cli.runtimeCommands`: optional entries discovered from the currently
  registered Commander tree for this invocation.
- `cli.pluginCommands`: optional plugin CLI descriptor entries, source-labeled
  by plugin ID and only included when explicitly requested or already available
  to the caller.
- `promptProjection`: a compact model-facing subset derived from routed
  operations, prompt-visible agent/tool surfaces, and explicitly prompt-enabled
  plugin entries. In the static prototype this is 19 prompt items.

The explicit agent/tool surface metadata covers:

- `skill_workshop` - manage durable skill proposal lifecycle.
- `session_status` - report current session state and model-use status.
- `sessions_spawn` - delegate work to a sub-agent or ACP session.
- `process` - inspect and manage active exec/process work.
- `gateway` - inspect, reconfigure, or restart the OpenClaw Gateway.

Each surface entry declares:

- `id`
- `title`
- `kind`
- `target`
- `source`
- `source_kind`
- `source_id`
- `discovery_mode`
- `visibility`
- `intent`
- `examples`
- `aliases`
- `owner`
- `status`
- `confidence`
- `risk`
- `confirmation`
- `effect_mode`
- `effects`
- `dispatch_mode`
- `command_hints`

Example shape:

```yaml
id: gateway
title: Gateway control
kind: command
dispatch_mode: hybrid
target: gateway
intent: Inspect, reconfigure, or restart the OpenClaw Gateway.
risk: medium
confirmation: true
effect_mode: mixed
command_hints:
  - gateway status
  - gateway restart
  - gateway config.schema.lookup
  - gateway config.apply
```

### Architecture

The initial implementation has a normalized inventory layer plus scoped lenses:

- CLI descriptor inventory: reads existing core and sub-CLI descriptors.
- Command-route inventory: reads the existing `cliCommandCatalog` routing and
  startup-policy entries.
- Routed-operation inventory: derives route IDs and command paths from current
  routed-command metadata.
- Runtime command inventory: can enumerate the currently registered Commander
  tree for the active invocation, including nested commands already present.
- Plugin descriptor inventory: can project plugin CLI descriptors into catalog
  entries, labeled by plugin ID and discovery mode, without making plugin
  execution a new default catalog requirement.
- Agent/tool surface registry: owns complete metadata for non-CLI or tool-backed
  model surfaces, including examples, aliases, risk, confirmation, effect mode,
  effects, visibility, and command hints.
- Prompt lens: exposes only lean model-facing routing fields and filters by
  available tools plus explicitly prompt-enabled plugin IDs.
- Audit, coverage, and operator lenses: consume the same inventory to group risk,
  effect mode, route policy, coverage gaps, and handoff summaries.

Consumers such as the prompt renderer, catalog list command/script, generated
reference docs, drift guards, audit reports, coverage reports, and operator
summaries read from those APIs instead of duplicating metadata.

### Maintainability Model

The catalog is designed to be easy to maintain because it is an overlay on
existing OpenClaw data structures, not a replacement for them.

- CLI descriptors continue to come from the existing core and sub-CLI
  descriptor registries.
- Command paths and startup-policy metadata continue to come from the existing
  command catalog.
- Routed operations are derived from existing command-route metadata instead of
  loading route runners or defining a second operation registry.
- Tool-backed and non-CLI surfaces use explicit metadata only where OpenClaw
  does not already have a structured CLI descriptor to read.
- Prompt guidance, generated docs, audit reports, and future operator views all
  consume catalog APIs instead of maintaining their own hardcoded lists.

The expected maintenance path is therefore narrow: when an existing command,
route, or tool surface changes, the catalog either picks that up from the
existing registry or a focused guard points to the missing metadata update. The
catalog should not grow into a new execution system, policy engine, or parallel
source of truth.

### Why Existing Catalogs Do Not Already Cover This

OpenClaw already has several useful catalogs and descriptor registries, but they
serve narrower domains:

- model catalogs describe model/provider availability
- channel and plugin catalogs describe installed or official integration
  surfaces
- provider/install catalogs describe package or extension discovery
- CLI descriptors drive help output and command registration
- the command catalog drives command-path routing and startup policy
- routed-command definitions own command execution fast paths
- prompt guidance describes tool usage in prose

Those pieces are necessary, and this proposal reuses them. What does not exist
today is one read-only view that joins them into an AI-routable operational
inventory: command descriptors, command routes, route-policy keys, routed
operation IDs, explicit tool-backed surfaces, risk/confirmation/effect metadata,
and a lean prompt projection. Without that joined view, docs, prompts, tests,
operator views, and audits either duplicate small command lists or infer intent
from prose/help output.

This RFC therefore does not introduce "another catalog" for its own sake. It
adds the missing joined view over existing catalogs and registries, with drift
guards to keep the overlay honest.

### Runtime Flow

1. The catalog list API builds the full hierarchy from existing registries and
   explicit agent/tool metadata.
2. The prompt renderer reads the prompt projection API, not the full catalog
   list.
3. The AI identifies a routed operation or agent/tool surface by `id` or lean
   metadata match.
4. The AI chooses the existing command or tool surface described by that entry.
5. The selected surface validates arguments, policy, and preconditions using
   existing behavior.
6. If required, the selected surface asks for confirmation.
7. The selected command or tool performs the operation.
8. OpenClaw returns the normal command/tool result and any structured state that
   surface already exposes.

### CLI Access

Expose the read-only operator view through:

```bash
openclaw catalog list
openclaw catalog list --json
openclaw catalog list --markdown
```

The command is not an execution dispatcher. JSON output is the one-stop
structured view for humans, automation, docs, and future policy/admin consumers.
Markdown output is a concise operator view.

### Proposed Implementation Stack

1. Add the prompt projection API, prompt renderer, and focused tests over the
   first routed-operation and agent/tool projection.
2. Expose `buildCatalogList()` as the read-only programmatic catalog list API
   over CLI descriptors, command routes, routed operations, and agent/tool
   surfaces.
3. Add `openclaw catalog list` plus a thin script wrapper for JSON/Markdown
   output.
4. Generate an AI surface catalog docs page from the full catalog hierarchy.
5. Add guards for required metadata, descriptor alignment, prompt size, and
   generated output drift.

### Full Integration Plan

The catalog should become the shared metadata source for mechanical OpenClaw
surfaces, not just prompt text. Integration should proceed in narrow consumers
that prove value while keeping execution with the existing command and tool
implementations.

1. Prompt routing: keep the system prompt on the lean projection only. It should
   classify bounded requests into existing routed operations or agent/tool
   surfaces, then use the current command or tool path.
2. Reference docs: generate user-facing and maintainer-facing catalog docs from
   `buildCatalogList()` so command inventory, route inventory, routed
   operations, and agent/tool surfaces do not drift from hand-written docs.
3. Audit and policy inventory: add read-only reports that answer questions such
   as "which surfaces mutate state", "which surfaces require confirmation",
   "which command paths bypass config guard", and "which routes can use network
   proxy bypass". These reports should consume catalog metadata and existing
   policy data; they should not enforce policy themselves.
4. Test matrix generation: derive smoke-test candidates from `cli.routedOperations`
   and command paths. The generated matrix should identify missing coverage for
   mechanical routes without replacing the route implementations.
5. Operator and admin views: expose the same structured data to diagnostics,
   debug views, and future admin surfaces so operators can inspect what OpenClaw
   can do mechanically without scraping help output.
6. Drift guards: keep compatibility checks around descriptor presence,
   route-definition alignment, generated docs, prompt projection size, and
   catalog JSON shape. Counts can be checked as inventory snapshots, while
   schema and ID stability should be checked more strictly.
7. Future automation adapters: if later work needs automation beyond prompt
   routing, build adapters that select a catalog entry and call the existing
   command or tool implementation. Do not introduce a new catalog dispatcher
   until a concrete consumer proves that the existing command/tool invocation
   path is insufficient.

### Proposed PR Plan

Because the catalog's value is the combination of normalized inventory plus
consumer-specific lenses, the first implementation stack should prove the full
vertical slice rather than landing only a static list first.

1. Foundation: normalized catalog inventory
   - Deliverables: `buildCatalogList()`, `openclaw catalog list`, static core
     and sub-CLI descriptors, command-route policy entries, routed operations,
     explicit agent/tool surfaces, schema version, source/discovery metadata,
     visibility metadata, startup-policy entry, script wrapper, and drift guards.
   - Scenario: `openclaw catalog list --json` shows static OpenClaw command and
     tool surfaces in one source-labeled shape.
   - Non-goal: no new dispatcher and no policy enforcement.
   - Acceptance: static catalog counts are deterministic; descriptors/routes are
     source-labeled; JSON/Markdown output is parseable and proxy-safe.

2. Runtime command lens
   - Deliverables: Commander-tree enumeration for commands registered in the
     current invocation, including nested subcommands already loaded in the
     runtime command tree.
   - Scenario: an operator can ask what commands OpenClaw has actually
     registered right now instead of only seeing static descriptor placeholders.
   - Non-goal: do not force-load command trees just to discover them.
   - Acceptance: runtime entries are labeled `runtime-registered` and can be
     passed into the catalog without changing static catalog output.

3. Plugin descriptor lens
   - Deliverables: plugin CLI descriptors projected into catalog command entries
     with `source_kind=plugin`, plugin ID, command path, and discovery mode.
   - Scenario: a plugin can contribute command metadata that appears in catalog
     output without hand-editing prompt prose or core command lists.
   - Non-goal: do not make the default catalog command execute arbitrary plugin
     code solely for discovery.
   - Acceptance: plugin descriptor entries are opt-in or caller-supplied,
     source-labeled, and not prompt-visible unless a prompt lens explicitly
     enables that plugin.

4. Prompt lens
   - Deliverables: lean prompt projection, prompt renderer, available-tool
     filtering, prompt budget guard, and explicit opt-in for plugin descriptor
     commands that are allowed into prompt scope.
   - Scenario: the AI sees the small set of surfaces available in its current
     scope, including eligible plugin surfaces, without seeing the full audit or
     operator inventory.
   - Non-goal: do not dump the full catalog into the prompt.
   - Acceptance: prompt projection remains small, filters unavailable tools, and
     only includes plugin entries when a trusted/allowed plugin ID is supplied.

5. Audit, coverage, and operator lenses
   - Deliverables: read-only `catalog audit`, `catalog test-matrix`, and
     `catalog summary` outputs for risk/effect/confirmation grouping, route
     policy keys, smoke coverage gaps, and compact operator/admin handoffs.
   - Scenario: maintainers can inspect static, runtime, plugin, route, and tool
     surfaces by the lens that matches their job: audit/policy review, coverage
     planning, or operator handoff.
   - Non-goal: do not fail CI or enforce policy from these reports in the first
     stack.
   - Acceptance: each lens is deterministic, covered by focused tests, and
     consumes catalog data rather than prompt text or hand-maintained lists.

After that first vertical slice lands, the next stack should harden the catalog
as a reusable integration surface without turning it into a dispatcher or policy
engine.

6. Stable JSON schema fixtures
   - Deliverables: checked fixtures for `catalog list`, `catalog audit`,
     `catalog test-matrix`, `catalog summary`, and prompt projection output.
     Fixtures should lock schema versions, stable IDs, required fields, and
     value kinds while treating inventory counts as expected-to-change
     snapshots.
   - Scenario: maintainers can review catalog contract changes intentionally
     instead of discovering JSON-shape drift through downstream consumers.
   - Non-goal: do not freeze every command count as a compatibility promise.
   - Acceptance: fixture checks fail on removed/renamed fields, unstable IDs, or
     schema-version drift, but allow deliberate inventory count updates.

7. Generated reference docs for all lenses
   - Deliverables: generated docs for `catalog list`, `catalog audit`,
     `catalog test-matrix`, `catalog summary`, runtime entries, plugin entries,
     and prompt scope.
   - Scenario: users and maintainers can inspect the catalog surfaces from docs
     generated by the same APIs used by automation.
   - Non-goal: do not hand-write parallel catalog tables.
   - Acceptance: docs generation has a `--check` mode and consumes catalog APIs
     rather than prompt text.

8. Deeper runtime and plugin enumeration
   - Deliverables: richer runtime and plugin metadata where OpenClaw can collect
     it without force-loading arbitrary plugin runtime code, including clearer
     source labels, parent paths, hidden-command filtering, and metadata-only
     plugin behavior.
   - Scenario: audit and operator consumers can tell static descriptors,
     currently registered commands, and plugin-provided descriptors apart.
   - Non-goal: do not execute plugin registrars or arbitrary plugin runtime code
     only to make the catalog look complete.
   - Acceptance: runtime/plugin entries remain source-labeled, metadata-only
     plugin loading is JSON-safe, and hidden/private commands stay out of
     public lenses.

9. Advisory CI and report integration
   - Deliverables: non-blocking catalog summary and test-matrix artifacts for
     PRs, with coverage-gap and drift summaries that maintainers can inspect.
   - Scenario: a PR touching command routes, descriptors, prompts, or tools can
     see catalog impact without making the first reports hard gates.
   - Non-goal: do not fail normal CI on catalog coverage gaps until maintainers
     choose specific gate semantics.
   - Acceptance: reports are deterministic, easy to attach to PR validation,
     and clearly labeled advisory.

10. Policy/admin consumer contract
    - Deliverables: a stable import path and minimal data contract for policy,
      diagnostics, and future admin consumers, plus guidance on which fields are
      stable contracts versus inventory snapshots.
    - Scenario: policy/admin code can consume catalog metadata without scraping
      help output or coupling to prompt-rendering internals.
    - Non-goal: do not add enforcement, conditional enablement, or a new
      catalog execution path.
    - Acceptance: consumer-facing exports are documented, tested, and scoped to
      read-only metadata.

## Rationale

This design uses OpenClaw's existing command registration and tool contracts as
the source of truth. That keeps the overlay small and reviewable while avoiding
a second control plane.

The main alternative is to create a typed operation or DSL layer. That would
make bounded operations explicit, but it would also create a new surface that
could drift from current CLI/tool behavior. Starting from the CLI descriptor
catalog is lower risk because every catalog entry must point at an existing
surface.

The prompt projection and catalog list APIs are intentionally separate. The
catalog list is one-stop shopping for structured metadata. The prompt needs only
a compact routing view. Separating them avoids prompt scraping while keeping
token cost visible.

## Evaluation Plan

Compare current prompt-driven behavior with catalog-overlay behavior on a fixed
set of bounded tasks:

- set or inspect session state
- approve or reject a bounded action
- add or remove an allowlist entry
- advance a wizard step
- export session or trajectory data
- install, enable, disable, or refresh a skill/plugin
- collect a diagnostic or audit bundle

Track:

- correctness
- retries
- clarification turns
- total tokens
- tool calls
- latency
- manual intervention
- policy violations
- audit completeness

The overlay is better only if it is at least as safe as the current path,
reduces retries or prompt ambiguity on repeated mechanical operations, preserves
user-visible behavior, and produces a readable audit trail for covered actions.

## Unresolved Questions

- How much of the command-route policy should be exposed as stable metadata
  instead of summarized as route policy keys?
- Should descriptor and command-route counts become explicit compatibility
  guards, or should they be treated as expected-to-change inventory counts?
- Where should confirmation thresholds live?
- Are simple metadata gates enough, or is conditional enablement eventually
  needed?
- Which registry and catalog list exports should be treated as stable enough
  for downstream policy/admin consumers?
- Where should future policy/admin consumers import catalog list data from so
  they do not couple to prompt rendering internals?
