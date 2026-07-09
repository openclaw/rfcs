---
title: CLI Catalog View for OpenClaw Command Surfaces
authors:
  - Gio
created: 2026-07-04
last_updated: 2026-07-09
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/32
---

# Proposal: CLI Catalog View for OpenClaw Command Surfaces

## Summary

Add a read-only `openclaw catalog` command over existing OpenClaw command and
tool metadata so maintainers, operators, docs, tests, and prompt routing can
inspect the same normalized inventory. OpenClaw already has internal command
catalogs, descriptors, route metadata, plugin descriptors, and tool surfaces,
but it does not have a user-facing command that joins them into one structured
view. This proposal adds that missing view without replacing the existing
registries.

The catalog view is metadata only. It does not add a new execution dispatcher,
runtime hook, gateway plugin, policy engine, or expression language. Existing
commands and tools continue to own validation, permissions, confirmation,
execution, and results.

## Implementation Review Links

There is already one upstream OpenClaw draft PR with the full end-state branch:

- Rollup implementation PR: [openclaw/openclaw#100960](https://github.com/openclaw/openclaw/pull/100960)

For review convenience, the same work is also prepared as fork-local stacked
draft PRs. These are not asking maintainers to merge from the fork; they are a
review aid so the stack can be read one layer at a time. If maintainers prefer,
I am happy to open the same PRs against `openclaw/openclaw` separately and merge
them in order.

- PR1 foundation: [giodl73-repo/openclaw#11](https://github.com/giodl73-repo/openclaw/pull/11)
- PR2 dynamic/operator lenses: [giodl73-repo/openclaw#12](https://github.com/giodl73-repo/openclaw/pull/12)
- PR3 prompt projection: [giodl73-repo/openclaw#13](https://github.com/giodl73-repo/openclaw/pull/13)
- PR4 schema fixtures: [giodl73-repo/openclaw#14](https://github.com/giodl73-repo/openclaw/pull/14)
- PR5 generated docs: [giodl73-repo/openclaw#15](https://github.com/giodl73-repo/openclaw/pull/15)
- PR6 hardening and consumer contract: [giodl73-repo/openclaw#16](https://github.com/giodl73-repo/openclaw/pull/16)

## Motivation

OpenClaw already has several bounded operational surfaces: session status,
process control, gateway operations, skill proposal lifecycle, delegation,
config updates, exports, diagnostics, and similar command or tool surfaces.
Their metadata is split across useful internal sources such as CLI descriptors,
`cliCommandCatalog`, routed-command definitions, plugin descriptors, and prompt
guidance. Today there is no `openclaw catalog` command that answers "what
command/tool surfaces exist, where did they come from, and which ones are safe
for this context?"

That creates three problems:

- no single place lists the available command/tool surfaces with source labels
  and risk metadata
- docs, tests, prompts, and audits can drift because they each infer the same
  inventory differently
- model-facing guidance can phrase or sequence bounded operations incorrectly
  when it relies on prose instead of structured metadata
- repeated flows consume prompt space restating bounded behavior already present
  in command metadata

The goal is not primarily token reduction. The bigger win is a single
inspection point for existing command/tool metadata so bounded actions become
easier to inspect, document, test, audit, and route.

## Goals

- Provide one read-only catalog view over existing OpenClaw command and tool
  registries.
- Let prompt routing choose an existing command or tool surface from reviewable
  metadata.
- Keep the selected surface responsible for validation, permissions,
  confirmation, execution, and output.
- Keep prompt-facing metadata lean enough to avoid turning the catalog into a
  large prompt tax.
- Provide a programmatic and CLI-readable list of OpenClaw command/tool surfaces
  for maintainers, operators, docs, tests, audit, and future policy/admin
  consumers.
- Distinguish static descriptors, route-policy entries, ownerless adapter
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
- Replacing existing CLI, route, plugin, provider, channel, or model catalogs.
- Adding a general-purpose expression language.
- Encoding product judgment or policy enforcement into the catalog itself.
- Adding a new execution surface, dispatcher, runtime hook, or gateway plugin.
- Requiring skill authors or command owners to learn a new authoring format in
  the first pass.
- Exposing this as a public plugin SDK contract in the first implementation.
- Treating prompt projection as required for the catalog list, audit, docs, or
  operator views to be useful.

## Proposal

Start with a hierarchical, additive `openclaw catalog` view over existing
registries instead of a second command registry. The first list is structured
as:

- `cli.descriptors`: the existing top-level/core and sub-CLI descriptor
  inventory.
- `cli.commandRoutes`: the existing command-path routing and startup-policy
  registry.
- `cli.routedOperations`: the mechanical fast-path route IDs derived from the
  command-route registry and routed-command definitions.
- Catalog metadata fields on owning descriptors and routes: optional fields on
  CLI descriptors, command-route entries, and plugin CLI descriptors provide
  prompt, audit, operator, and docs metadata where those registries already own
  the surface.
- `agentToolSurfaces`: projected tool-backed or non-CLI surfaces. Most entries
  should come from the owning descriptor/route/plugin metadata; explicit
  adapter entries are reserved for surfaces that do not yet have an owning
  structured registry.
- `cli.runtimeCommands`: optional entries discovered from the currently
  registered Commander tree for this invocation.
- `cli.pluginCommands`: optional plugin CLI descriptor entries, source-labeled
  by plugin ID and only included when explicitly requested or already available
  to the caller.
- `promptProjection`: a compact model-facing subset derived from routed
  operations, prompt-visible agent/tool surfaces, and explicitly prompt-enabled
  plugin entries.

Exact counts are intentionally omitted from the contract. They are useful in
fixtures and reports as reviewable snapshots, but command inventory changes
over time and should not become a permanent compatibility promise.

The initial owner mapping is:

- CLI descriptors own command-level catalog metadata such as `gateway`.
- Command-route entries own routed-operation metadata such as route title,
  prompt risk, confirmation requirement, and command hints.
- Plugin CLI descriptors own plugin command metadata, including optional
  visibility, risk, confirmation, effect mode, and command hints.
- The adapter owns only ownerless tool-backed surfaces such as
  `skill_workshop`, `session_status`, `sessions_spawn`, and `process` until
  OpenClaw has a structured source for them.

Explicit adapter entries are the exception path, not a new parallel registry.
They cover tool-backed or non-CLI surfaces that do not already have enough
structured metadata to join from existing registries. If OpenClaw later adds
structured descriptors for those surfaces, the catalog should read them from
that source instead of keeping duplicate hand-authored metadata.

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
- Catalog metadata adapters on existing owners: CLI descriptors, route entries,
  and plugin CLI descriptors can carry focused metadata such as examples,
  aliases, risk, confirmation, effect mode, effects, visibility, and command
  hints.
- Ownerless tool adapter: supplies the same metadata only for non-CLI or
  tool-backed model surfaces that do not yet have an owning descriptor or route.
- Prompt lens: exposes only lean model-facing routing fields and filters by
  available tools plus explicitly prompt-enabled plugin IDs.
- Audit, coverage, and operator lenses: consume the same inventory to group risk,
  effect mode, route policy, coverage gaps, and handoff summaries.

Consumers such as the prompt renderer, catalog list command/script, generated
reference docs, drift guards, audit reports, coverage reports, and operator
summaries read from those APIs instead of duplicating metadata.

The first stack should demonstrate live value in more than one consumer:
`openclaw catalog list --json` for inspection, generated docs for reference
freshness, audit/test-matrix/summary outputs for maintainer review, and prompt
projection for model-facing routing. Plugin metadata remains opt-in and
metadata-only so plugin authors can make command surfaces discoverable without
the catalog executing arbitrary plugin runtime code.

### Maintainability Model

The catalog is designed to be easy to maintain because it is a view over
existing OpenClaw data structures, not a replacement for them.

- CLI descriptors continue to come from the existing core and sub-CLI
  descriptor registries, with optional catalog metadata on the descriptor that
  owns the command.
- Command paths and startup-policy metadata continue to come from the existing
  command catalog, with route-local catalog metadata for routed operations that
  need prompt/audit/operator labels.
- Plugin command metadata lives on plugin CLI descriptors so plugin authors do
  not need a second catalog registration path.
- Routed operations are derived from existing command-route metadata instead of
  loading route runners or defining a second operation registry.
- Tool-backed and non-CLI surfaces use explicit adapter metadata only where
  OpenClaw does not already have a structured descriptor, route, or plugin
  entry to read.
- Prompt guidance, generated docs, audit reports, and future operator views all
  consume catalog APIs instead of maintaining their own hardcoded lists.

The expected maintenance path is therefore narrow: when an existing command,
route, or tool surface changes, the catalog either picks that up from the
existing registry or a focused guard points to the missing metadata update. The
catalog should not grow into a new execution system, policy engine, or parallel
source of truth.

### Relationship to Existing Registries

This is additive. OpenClaw already has internal command catalogs and descriptor
registries, but current `main` does not expose a user-facing
`openclaw catalog` command or one joined read-only inventory.

The closest existing source is `cliCommandCatalog`, which owns command paths,
startup policy, and route policy keys. Other sources own adjacent pieces:
sub-CLI descriptors own help and registration metadata, routed-command
definitions own mechanical fast paths, plugin descriptors own plugin CLI
metadata, and prompts/docs describe selected usage in prose.

This RFC keeps those sources as the owners. The catalog command reads them,
adds small optional metadata where the owning source needs prompt/audit/operator
labels, and exposes joined JSON/Markdown views for docs, audit, test planning,
prompt routing, and operator review. It should not become a parallel registry or
new execution path.

### Runtime Flow

1. The catalog list API builds the full hierarchy from existing registries and
   optional catalog metadata on owning descriptors/routes/plugins, plus
   ownerless tool adapters where no owning registry exists yet.
2. The prompt renderer reads the prompt projection API, not the full catalog
   list.
3. Prompt routing identifies a routed operation or agent/tool surface by `id` or
   lean metadata match.
4. The model chooses the existing command or tool surface described by that
   entry.
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

The command is not an execution dispatcher. JSON output is the joined structured
view for humans, automation, docs, and future policy/admin consumers.
Markdown output is a concise operator view.

### Proposed Implementation Stack

The implementation should land as a small review stack that shows the catalog
view first, then layers dynamic inventory, prompt routing, drift guards, docs,
and hardening on top.

1. Foundation catalog view: add `buildCatalogList()`, `openclaw catalog list`,
   static CLI descriptors with optional catalog metadata, command routes with
   route-local catalog metadata, routed operations, ownerless tool adapters,
   source labels, and parseable JSON/Markdown output.
2. Dynamic and operator lenses: add runtime Commander-tree entries, opt-in
   plugin descriptor entries, `catalog audit`, `catalog test-matrix`, and
   `catalog summary`.
3. Prompt projection: add the lean prompt-facing projection and prompt renderer
   that read from the catalog rather than duplicating command prose.
   This PR is intentionally separate so maintainers can review model-facing
   behavior apart from the catalog list, audit, docs, and operator surfaces.
4. Schema fixtures: add checked JSON fixtures that protect schema versions,
   required fields, stable IDs, and value kinds while treating counts as
   reviewable snapshots.
5. Generated docs: generate the catalog reference page from the same APIs, with
   docs-map/i18n updates and a `--check` freshness mode.
   This is a drift guard for a new public CLI reference, not a hand-written
   docs exercise.
6. Hardening: enrich runtime/plugin detail, preserve hidden/private plugin
   metadata through registry normalization, write richer advisory report
   artifacts, and document the CLI-first consumer contract.

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

### Node-Operator Catalog Support

Node/operator command metadata should be folded through the first six PRs rather
than introduced as a separate follow-up. The base catalog already lists `node` and
`nodes` as CLI descriptors, command-route entries, and runtime Commander
entries, but paired-node operation needs structured command metadata and a
scoped prompt view rather than a dump of every node command into every model
prompt.

This support should answer a narrower question: when an OpenClaw agent is
operating through a paired node, which node commands are available, what
arguments do they expect, what approval boundary applies, and which commands
should the model see for the current node context?

Evidence comes from the current `gim-home/m` node-mode command stack:

- `gim-home/m#4045` adds node-routed MCP commands:
  `mcp.help`, `mcp.invoke`, `mcp.status`, and `mcp.cancel`.
- `gim-home/m#4086` adds filesystem node commands:
  `filesystem.read`, `filesystem.write`, and `filesystem.patch`.
- `gim-home/m#4088` adds browser/file-open node commands:
  `browser.open` and `file.openWithDefaultApp`, plus Desktop-owned Playwright
  MCP approval behavior.

Those PRs show the catalog value beyond generic prompt routing. Each node slice
has a command name, argument shape, approval model, risk boundary, docs text,
and model-facing behavior that must stay aligned. Without a structured catalog
lens, every new node command family requires manual prompt/docs/help updates and
can drift from the actual Gateway/Desktop approval path.

The node/operator catalog support should be scoped:

- General catalog/audit views list all known `node`/`nodes` descriptors,
  command routes, runtime commands, and plugin-provided node command
  descriptors.
- Prompt projection includes only node commands available in the active
  node-control context.
- Low-risk read/status/help commands can be prompt-visible by default in node
  mode.
- Mutating or side-effecting commands such as filesystem writes, browser opens,
  app/file opens, shell/system commands, or M365 actions carry risk,
  confirmation, and approval-boundary metadata.
- Plugin-provided `nodes ...` commands remain opt-in and trust-scoped.

This is still metadata-only. The selected node command continues to execute
through the existing OpenClaw/Gateway/Desktop command path, and Desktop remains
the owner of local validation, permission cards, policy, approval memory, and
runtime execution.

### Proposed PR Plan

Because the catalog's value is the combination of normalized inventory plus
consumer-specific lenses, the first implementation stack should show the shared
catalog view and its most important consumers without making reviewers evaluate
ten tiny PRs.

1. Foundation catalog view
   - Deliverables: `buildCatalogList()`, `openclaw catalog list`, static core
     and sub-CLI descriptors with optional catalog metadata, command-route
     policy entries with route-local catalog metadata, routed operations,
     ownerless adapter surfaces, schema version, source/discovery metadata, and
     JSON/Markdown output.
   - Scenario: `openclaw catalog list --json` shows OpenClaw command and tool
     surfaces in one source-labeled shape.
   - Non-goal: no dispatcher, policy enforcement, or replacement registry.
   - Acceptance: output is parseable, source-labeled, and derived from existing
     registries wherever possible.

2. Dynamic inventory and operator lenses
   - Deliverables: runtime Commander-tree entries, opt-in plugin descriptor
     entries, `catalog audit`, `catalog test-matrix`, and `catalog summary`.
   - Scenario: maintainers can inspect static, runtime, plugin, route, and tool
     surfaces by the lens that matches their job: live inventory, audit/policy
     review, smoke coverage planning, or operator handoff.
   - Non-goal: do not force-load command trees or plugin runtime code only for
     discovery; do not fail CI or enforce policy from the first reports.
   - Acceptance: dynamic entries are source-labeled, plugin entries are opt-in
     or caller-supplied, and operator/audit outputs consume catalog data rather
     than prompt text or hand-maintained lists.

3. Prompt projection
   - Deliverables: lean prompt projection, prompt renderer, available-tool
     filtering, prompt budget guard, and explicit opt-in for plugin descriptor
     commands that are allowed into prompt scope.
   - Scenario: the model sees the small set of surfaces available in its
     current scope without seeing the full audit or operator inventory.
   - Non-goal: do not dump the full catalog into the prompt.
   - Acceptance: prompt projection remains small, filters unavailable tools, and
     only includes plugin entries when an allowed plugin ID is supplied.

4. Schema fixtures
   - Deliverables: checked fixtures for `catalog list`, `catalog audit`,
     `catalog test-matrix`, `catalog summary`, and prompt projection output.
   - Scenario: maintainers can review catalog contract changes intentionally
     instead of discovering JSON-shape drift through downstream consumers.
   - Non-goal: do not freeze every command count as a compatibility promise.
   - Acceptance: fixture checks fail on removed/renamed fields, unstable IDs, or
     schema-version drift, but allow deliberate inventory count updates.

5. Generated reference docs
   - Deliverables: generated docs for the catalog commands and lenses, plus
     docs-map and i18n glossary updates where the generated page participates in
     the normal docs index.
   - Scenario: users and maintainers can inspect the catalog surfaces from docs
     generated by the same APIs used by automation.
   - Non-goal: do not hand-write parallel catalog tables.
   - Acceptance: docs generation has a `--check` mode, consumes catalog APIs,
     preserves checked-in formatting, and keeps public docs deterministic when
     private/local QA CLI flags are enabled.

6. Hardening and consumer boundary
   - Deliverables: richer runtime/plugin metadata, hidden/private plugin
     metadata preservation through registry normalization, richer advisory
     report artifacts, and a documented CLI-first consumer contract.
   - Scenario: downstream consumers can use `openclaw catalog ... --json` and
     advisory report artifacts without scraping help output or coupling to
     prompt-rendering internals.
   - Non-goal: do not promise `src/` implementation imports as a published API
     and do not make advisory report artifacts blocking gates.
   - Acceptance: runtime/plugin entries stay source-labeled, hidden/private
     commands stay out of public lenses, advisory outputs remain clearly
     non-blocking, and any future package export is added deliberately.

The node/operator work should be distributed across the six PRs:

- PR1 foundation: define the supplied `cli.nodeCommands` list shape and its
  source, availability, approval, risk, effect, argument-hint, and trust-boundary
  fields.
- PR2 dynamic/operator lenses: include node command metadata in audit,
  test-matrix, and operator summary views.
- PR3 prompt lens: add a scoped `node-operator` prompt projection that is
  disabled by default.
- PR4 schema fixtures: snapshot representative paired-node/node-host command
  records.
- PR5 generated docs: document node/operator commands as a supported dynamic
  catalog family.
- PR6 hardening: carry node command fields through advisory reports and the
  CLI-first consumer contract.

### Node-Operator Shape

The node/operator support has three internal pieces:

1. Node command source metadata
   - Deliverables: catalog metadata for node-routed command families from the
     Gateway/Desktop node command source, including command ID, title, argument
     hints, owner, risk, effect mode, confirmation requirement, approval kind,
     and trust boundary.
   - Scenario: `openclaw catalog list --json` can identify node commands such
     as `mcp.invoke`, `filesystem.write`, and `browser.open` as node-operated
     surfaces rather than opaque prose.
   - Non-goal: do not execute node commands from the catalog and do not import
     Desktop runtime code into OpenClaw catalog generation.
   - Acceptance: node command metadata is source-labeled, generated or
     supplied by the owning node command registry where possible, and absent
     commands do not appear in prompt scope.

2. Node-operator prompt projection
   - Deliverables: a scoped prompt lens, for example
     `listCliCatalogPromptSurfaces({ scope: "node-operator", ... })`, that
     includes only node commands available to the active node context.
   - Scenario: an OpenClaw agent operating a paired node sees how to inspect MCP
     status, invoke an allowed MCP tool, read or patch workspace files, and open
     browser/file targets without seeing unrelated catalog inventory.
   - Non-goal: do not dump full audit metadata or every node/plugin command
     into the default system prompt.
   - Acceptance: prompt output is small, context-filtered, and carries enough
     command/argument/risk hints for correct tool choice.

3. Node trust/audit/test-matrix lens
   - Deliverables: catalog audit/test-matrix support for node command families,
     including approval kind, side-effect classification, command availability,
     and smoke-test candidates.
   - Scenario: maintainers can compare the OpenClaw node prompt surface against
     the actual Desktop/Gateway node command stack and find missing coverage or
     mismatched risk/approval metadata.
   - Non-goal: do not make this a blocking CI gate until maintainers choose
     explicit policy semantics.
   - Acceptance: reports can cite node command families and approval boundaries
     in a stable JSON shape suitable for PR review artifacts.

### Review Learnings Incorporated

The implementation review pass tightened several boundaries in this RFC:

- Checked JSON fixtures are reviewable snapshots. They should protect schema
  versions, required fields, stable IDs, and value kinds, while treating counts
  and inventory membership as expected-to-change catalog snapshots.
- Public generated docs must stay deterministic. They should use the public
  catalog shape, participate in existing docs gates, and avoid leaking
  private/local QA surfaces even when those surfaces are enabled in a developer
  environment.
- Static docs and live inventory serve different jobs. Generated docs describe
  the stable catalog concepts; `catalog list --json` can include runtime
  Commander entries for the current invocation; plugin descriptor entries should
  appear only when the caller opts into or supplies that metadata.
- Plugin metadata must be preserved before filtering. Hidden/private markers
  need to survive the real registry path, not only direct unit-test fixtures.
- The external contract is CLI-first for now. Until package exports are added
  deliberately, downstream consumers should rely on `openclaw catalog ... --json`
  rather than importing catalog builder modules from `src/`.
- Catalog reports should start advisory. They can produce PR artifacts and
  review summaries, but they should not become blocking CI gates until
  maintainers choose explicit policy semantics.

## Rationale

This design uses OpenClaw's existing command registration and tool contracts as
the source of truth. That keeps the catalog view small and reviewable while
avoiding a second control plane.

The main alternative is to create a typed operation or DSL layer. That would
make bounded operations explicit, but it would also create a new surface that
could drift from current CLI/tool behavior. Starting from the CLI descriptor
catalog is lower risk because every catalog entry must point at an existing
surface.

The prompt projection and catalog list APIs are intentionally separate. The
catalog list is the broad structured metadata view. The prompt needs only a
compact routing view. Separating them avoids prompt scraping while keeping token
cost visible.

## Evaluation Plan

Compare current prompt-driven behavior with catalog-view behavior on a fixed set
of bounded tasks:

- set or inspect session state
- approve or reject a bounded action
- add or remove an allowlist entry
- advance a wizard step
- export session or trajectory data
- install, enable, disable, or refresh a skill/plugin
- collect a diagnostic or audit bundle
- operate a paired node through MCP, filesystem, browser/file-open, or future
  system/M365 node commands

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

The catalog view is better only if it is at least as safe as the current path,
reduces retries or prompt ambiguity on repeated mechanical operations, preserves
user-visible behavior, and produces a readable audit trail for covered actions.

Example comparisons:

| Task | Current behavior to compare | Catalog-view behavior to validate |
| --- | --- | --- |
| Inspect Gateway status | Prompt guidance or help text points the model toward `gateway status`. | Prompt projection exposes the `gateway` surface with command hints, while `catalog list --json` shows the source and risk metadata. |
| Review command-route policy | Maintainers inspect route definitions or command catalog entries directly. | `catalog audit --json` groups command paths by route policy key and reports routes without policy keys. |
| Plan routed-operation smoke tests | Maintainers hand-map routed operations to candidate tests. | `catalog test-matrix --json` lists routed-operation smoke candidates and coverage gaps. |
| Operate a paired node | Prompt guidance must be manually updated as node command families are added in PRs such as `gim-home/m#4045`, `#4086`, and `#4088`. | A node-operator prompt lens exposes the available node commands, argument hints, and approval boundaries for the active node context. |

## Unresolved Questions

- How much of the command-route policy should be exposed as stable metadata
  instead of summarized as route policy keys?
- Should descriptor and command-route counts become explicit compatibility
  guards, or should they be treated as expected-to-change inventory counts?
- Where should confirmation thresholds live?
- Are simple metadata gates enough, or is conditional enablement eventually
  needed?
- When should OpenClaw add package exports for catalog builders instead of
  keeping the external contract on `openclaw catalog ... --json`?
- Should the node-operator lens consume node command metadata from an exported
  OpenClaw/Gateway registry, generated command descriptors, or an artifact
  produced by the Desktop/Gateway node command stack?
