# PR #88504 memory-plugin interop research pass

Date: 2026-06-20  
Repo: OpenClaw source checkout  
Branch/head inspected: `pr-88504-ci-remediation` at `c447e22033ca104cb9d5292edf4313bcb74f81cf`  
Baseline comparison: `origin/main` at `9192ff8416bfd5e50a1f3b4c5536caa87f149351`

## Executive finding

OpenClaw documentation already describes memory as an ecosystem rather than a single monolithic provider: builtin/QMD memory provides local recall over project/session memory; Honcho provides AI-native user/agent/session modeling; LanceDB provides embedding-backed long-term memory with auto-recall and auto-capture; Active Memory is a recall orchestration layer; and Memory Wiki is a companion compiler/knowledge vault intended to sit beside active memory.

That documented story is not representable by current `origin/main` slot semantics. `origin/main` exposes only one `plugins.slots.memory` selector, maps every `kind: "memory"` plugin into that same exclusive slot, activates memory plugins only when they own that one slot, and resolves dreaming through that same slot. As a result, choosing one memory-style provider displaces the others instead of letting them own separate roles.

PR #88504 fixes the architectural mismatch by splitting memory into role slots:

- `memory.recall`
- `memory.compaction`
- `memory.capture`
- `memory.dreaming`
- `memory.userModel`

The legacy `memory` slot remains accepted as a shorthand/fallback for `memory.recall`, preserving existing configs while creating enough structure for documented combinations such as Honcho + local Markdown/QMD recall, LanceDB recall/capture + memory-core dreaming, Active Memory using the selected recall provider, and Memory Wiki compiling beside active memory.

## Scope and method

This pass examined documented supported memory-style plugins and adjacent memory orchestration surfaces in docs, manifests, and runtime source:

- `docs/concepts/memory.md`
- `docs/concepts/memory-builtin.md`
- `docs/concepts/memory-qmd.md`
- `docs/concepts/memory-honcho.md`
- `docs/concepts/active-memory.md`
- `docs/plugins/memory-wiki.md`
- `docs/plugins/memory-lancedb.md`
- `docs/reference/memory-config.md`
- `docs/tools/plugin.md`
- `docs/plugins/manifest.md`
- `extensions/memory-core/*`
- `extensions/memory-lancedb/*`
- `extensions/active-memory/*`
- `extensions/memory-wiki/*`
- `src/plugins/*`
- `src/memory-host-sdk/dreaming.ts`

The key comparison is PR #88504 head vs `origin/main`, because the research question is specifically whether current/as-is OpenClaw can satisfy the documented plugin composition story and how the multi-slot architecture closes the gap.

## Documented memory-style plugins and roles

### `memory-core` / builtin memory

**Documented role:** default active memory provider for `memory_search` and `memory_get`; builtin local memory over `MEMORY.md`, `memory/*.md`, optional sessions, and QMD/builtin backends.

Evidence:

- `docs/concepts/memory.md:111-118` states the agent has `memory_search` and `memory_get`, and that by default these tools come from the bundled `memory-core` plugin.
- `extensions/memory-core/openclaw.plugin.json:2-9` declares plugin id `memory-core`, `kind: "memory"`, and tool contracts `memory_get`, `memory_search`.
- `docs/concepts/memory-builtin.md:9-18` describes builtin memory as OpenClaw's local SQLite-backed memory engine, with keyword, vector, hybrid search, CJK tokenization, optional sqlite-vec acceleration, and no external service requirement.
- `extensions/memory-core/index.ts:179-208` registers memory capability and lazy `memory_search` / `memory_get` tools, then adds the `dreaming` runtime slash command.

**Role classification:** factual recall/search, source memory retrieval, builtin local backend, QMD host, and default dreaming/consolidation engine.

### QMD backend

**Documented role:** local-first sidecar backend for memory-core recall/search, especially Markdown/QMD corpora, with BM25/vector/rerank/query expansion and session indexing.

Evidence:

- `docs/concepts/memory-qmd.md:9-22` describes QMD as a local-first memory sidecar with BM25, vector search, reranking, query expansion, extra directories, transcript indexing, and builtin fallback.
- `docs/concepts/memory-qmd.md:34-40` shows QMD selected through `memory.backend: "qmd"`, not as a separate plugin id.
- `docs/concepts/memory-qmd.md:53-82` describes indexing `MEMORY.md`, `memory/*.md`, extra roots, wiki/shared corpus, and optional QMD binary path.
- `docs/concepts/memory-qmd.md:137-173` documents optional indexing of session transcripts.

**Role classification:** recall/search backend under `memory-core`, not a standalone slot-owning plugin. Architecturally, it strengthens the local recall role while leaving room for another plugin to own user modeling or capture.

### Honcho memory plugin

**Documented role:** external AI-native cross-session memory, user/agent modeling, semantic search, multi-agent awareness, and prompt injection.

Evidence:

- `docs/concepts/memory-honcho.md:9-24` says Honcho persists interactions and learns user preferences, agent behavior, conversation patterns, and cross-session context.
- `docs/concepts/memory-honcho.md:26-44` lists tools: `honcho_context`, `honcho_search_conclusions`, `honcho_search_messages`, `honcho_session`, and `honcho_ask`.
- `docs/concepts/memory-honcho.md:98-106` states the plugin automatically persists every AI turn, injects context during `before_prompt_build`, and summarizes/analyzes conversation patterns.
- `docs/concepts/memory-honcho.md:132-136` identifies the source as external: `github.com/plastic-labs/openclaw-honcho`.

**Role classification:** user model, cross-session/session memory, semantic recall over conclusions/messages, and prompt-context injection. It is not the same role as local Markdown/QMD recall.

### `memory-lancedb`

**Documented role:** official LanceDB-backed long-term memory plugin with embeddings, auto-recall, auto-capture, vector search, and `memory_recall` / `memory_store` / `memory_forget` tools.

Evidence:

- `docs/plugins/memory-lancedb.md:11-17` says the bundled plugin provides LanceDB-backed long-term memory with OpenAI-compatible embeddings, auto-recall, and auto-capture.
- `extensions/memory-lancedb/openclaw.plugin.json:2-13` declares plugin id `memory-lancedb`, `kind: "memory"`, and contracts `memory_forget`, `memory_recall`, `memory_store`.
- `extensions/memory-lancedb/openclaw.plugin.json:48-58` exposes `autoCapture`, `autoRecall`, and `dreaming` UI hints, with dreaming help explicitly referring to ownership of `memory.dreaming` or fallback through `memory.recall`.
- `extensions/memory-lancedb/index.ts:1418-1424` registers the plugin as `kind: "memory"`.
- `extensions/memory-lancedb/index.ts:1900-1940` implements auto-recall prompt injection through `before_prompt_build`.
- `extensions/memory-lancedb/index.ts:1942-2015` implements auto-capture through `agent_end`.

**Role classification:** recall, capture, vector LTM storage/search, optional dreaming config contributor.

### Active Memory (`active-memory`)

**Documented role:** not a memory store itself; a bounded pre-generation subagent that uses memory recall tools to inject relevant memory before a reply.

Evidence:

- `extensions/active-memory/openclaw.plugin.json:2-7` describes a blocking memory sub-agent that runs before eligible conversational replies and injects relevant memory into prompt context.
- `docs/concepts/active-memory.md:10-19` explains that regular reactive memory requires the agent or user to decide to search, while Active Memory gives one bounded chance to surface memory before generation.
- `docs/concepts/active-memory.md:80-83` says the subagent only receives memory-recall tools and no filesystem, shell, browser, or messaging access by default.
- `extensions/active-memory/openclaw.plugin.json:141-144` describes `toolsAllow` as defaulting to recall-capable tools registered by the selected `memory.recall` provider.
- `docs/concepts/active-memory.md:514-524` says selecting `plugins.slots.memory.recall: "memory-lancedb"` is enough for Active Memory to grant and use `memory_recall`.

**Role classification:** recall orchestration/prompt augmentation, dependent on whatever provider owns `memory.recall`.

### Memory Wiki (`memory-wiki`)

**Documented role:** companion compiled knowledge vault, Obsidian-friendly wiki, provenance/claims/dashboard/digest layer, and bridge over active memory artifacts/events.

Evidence:

- `extensions/memory-wiki/openclaw.plugin.json:2-10` describes a persistent wiki compiler and Obsidian-friendly knowledge vault with tools `wiki_apply`, `wiki_get`, `wiki_lint`, `wiki_search`, and `wiki_status`.
- `extensions/memory-wiki/openclaw.plugin.json:29-35` documents bridge mode that reads active-memory public artifacts when the selected memory provider exposes them.
- `extensions/memory-wiki/openclaw.plugin.json:85-107` exposes bridge configuration for importing from active memory public artifacts/events.
- `docs/plugins/memory-wiki.md:10-16` says Memory Wiki turns durable memory into a compiled knowledge vault and that it complements active memory rather than replacing it.
- `docs/plugins/memory-wiki.md:32-45` splits roles: active memory plugins own recall/search/promotion/dreaming/runtime injection; Memory Wiki owns compiled pages, provenance, claims, contradictions/questions, dashboards, digests, and wiki tools.
- `docs/plugins/memory-wiki.md:85-99` says bridge mode reads public artifacts/events from active memory SDK seams and does not require private imports.

**Role classification:** companion/compiled knowledge layer, not primary recall/capture/dreaming owner; relies on active memory providers for source artifacts and facts.

## Documentation that claims or implies coexistence / interop

### Memory Wiki explicitly sits beside active memory

Evidence:

- `docs/concepts/memory.md:119-135` introduces the Memory Wiki companion plugin and states that if regular memory is the working notebook, Memory Wiki is the curated index, linking claims back to memory sources and importing active memory artifacts/events in bridge mode.
- `docs/plugins/memory-wiki.md:10-16` says Memory Wiki complements active memory rather than replacing it.
- `docs/plugins/memory-wiki.md:32-45` provides an explicit split table where active memory plugins (`memory-core`, QMD, Honcho, etc.) own recall/search/promotion/dreaming/runtime injection and Memory Wiki owns compiled pages/provenance/wiki tools.
- `docs/plugins/memory-wiki.md:47-63` recommends a hybrid pattern: use QMD for active recall over Markdown/session notes, then enable Memory Wiki bridge mode for synthesized pages.

This is the clearest docs-level interop claim: Memory Wiki is not intended to compete for the same role as active memory. It should compose beside whichever active memory provider emits public artifacts/events.

### Honcho is documented as working with builtin/QMD memory

Evidence:

- `docs/concepts/memory-honcho.md:108-121` explicitly states that Honcho can work alongside the built-in memory system, and gives a concrete combined setup: builtin memory provides project-specific facts while Honcho provides learned user preferences and cross-session context. It also states QMD can add local Markdown search while Honcho adds AI-native understanding.

This is a direct coexistence promise: local project/Markdown recall and Honcho user/session modeling should both be usable.

### LanceDB is documented as a companion-compatible memory provider

Evidence:

- `docs/plugins/memory-lancedb.md:32-37` states LanceDB can own recall/capture/dreaming role slots and companion plugins such as Memory Wiki can run beside it through other memory role slots.
- `extensions/memory-lancedb/openclaw.plugin.json:56-58` says its dreaming config is consumed when the plugin owns `memory.dreaming`, or when dreaming falls back through `memory.recall`.

This describes role-level composition, not one global memory owner.

### Active Memory is documented as recall-provider agnostic

Evidence:

- `extensions/active-memory/openclaw.plugin.json:141-144` says `toolsAllow` defaults to recall-capable tools registered by the selected `memory.recall` provider.
- `docs/concepts/active-memory.md:514-524` shows configuring `memory.recall: "memory-lancedb"` so Active Memory grants and uses LanceDB's `memory_recall` tool.

Active Memory is intended to compose with the selected recall provider, not replace storage/search itself.

### Plugin docs describe memory role slots as first-class composition points

Evidence:

- `docs/tools/plugin.md:197-208` documents memory role slots: `memory.recall`, `memory.compaction`, `memory.capture`, `memory.dreaming`, and `memory.userModel`, with legacy `memory` as a recall alias.
- `docs/reference/memory-config.md` documents corresponding gateway configuration and per-agent role-slot overrides.

This documentation is aligned with PR #88504, not with `origin/main` as-is.

## Why current/as-is OpenClaw cannot satisfy those claims

The current shipped/as-is comparison here is `origin/main` at `9192ff8416bfd5e50a1f3b4c5536caa87f149351`.

### `origin/main` has only one memory selector

Evidence:

- `origin/main:src/config/types.plugins.ts:42-47` defines `PluginSlotsConfig` with only `memory?: string` and `contextEngine?: string`.

Consequence: config can express exactly one memory plugin owner. It cannot say “Honcho owns user modeling while memory-core/QMD owns local recall,” or “LanceDB owns recall/capture while memory-core owns dreaming.”

### Every `kind: "memory"` plugin maps to the same exclusive slot

Evidence:

- `origin/main:src/plugins/slots.ts:1` describes mutually exclusive plugin slot selection for memory and context-engine plugins.
- `origin/main:src/plugins/slots.ts:13-20` maps plugin kind `memory` to slot key `memory`, with default `memory-core`.
- `origin/main:src/plugins/slots.ts:67-88` writes the selected memory plugin id into that slot during exclusive slot selection.

Consequence: selecting `memory-lancedb`, Honcho, or another memory plugin as `kind: "memory"` necessarily replaces `memory-core` as the selected memory slot owner.

### Activation only recognizes the single memory slot

Evidence:

- `origin/main:src/plugins/config-activation-shared.ts:46-49` models activation slots as only `memory` and `contextEngine`.
- `origin/main:src/plugins/config-activation-shared.ts:116-118` marks a plugin explicitly enabled when `params.config.slots.memory === params.id`.

Consequence: a plugin cannot be activated because it owns `capture`, `dreaming`, or `userModel`; those roles do not exist. Companion/sidecar semantics have to be special-cased or enabled outside the slot model.

### Dreaming resolves through the same single memory slot

Evidence:

- `origin/main:src/memory-host-sdk/dreaming.ts:339-349` resolves the memory dreaming plugin id from `plugins.slots.memory`, falling back to `memory-core`.

Consequence: if LanceDB owns the only memory slot for recall/capture, dreaming resolves to LanceDB too; if Honcho owns the slot for user modeling, local builtin/QMD recall and memory-core dreaming are displaced. This contradicts the documented role split.

### Practical breakages against documented combinations

#### Honcho + builtin/QMD

Docs say Honcho can work alongside builtin memory and QMD can add local Markdown search while Honcho provides cross-session/user understanding. Under `origin/main`, both Honcho and `memory-core` are memory-style providers competing for `plugins.slots.memory`. Selecting Honcho as the memory plugin displaces `memory-core`/QMD as the active recall provider; selecting `memory-core` preserves local recall but leaves Honcho outside the memory slot abstraction.

#### LanceDB + memory-core dreaming/QMD

LanceDB docs describe recall/capture/dreaming role slots and companion operation. Under `origin/main`, `memory-lancedb` and `memory-core` both map to the one memory slot. Selecting LanceDB for recall/capture prevents `memory-core` from simultaneously owning dreaming as a normal role, unless loader code grows bespoke exceptions.

#### Active Memory + non-core recall provider + local memory

Active Memory wants recall-capable tools from `memory.recall`. Under `origin/main`, there is no `memory.recall`; there is only `memory`. That means choosing LanceDB recall makes LanceDB the whole memory plugin, not merely the recall provider used by Active Memory. The architecture cannot also say local `memory-core`/QMD remains the compaction/dreaming/source artifact provider.

#### Memory Wiki beside active memory

Memory Wiki docs say it complements active memory, imports active-memory public artifacts/events, and can sit beside QMD/Honcho/etc. Under the single-slot model, the “active memory plugin” is one selected memory owner, so the system cannot represent different memory plugins contributing different public artifacts, capture, recall, dreaming, and user-modeling roles. Memory Wiki can be enabled as a non-memory companion, but the underlying active-memory side remains forced into one owner rather than a composable memory ecosystem.

## How PR #88504 fixes the gap

### Adds role slots to config

Evidence:

- `src/config/types.plugins.ts:42-60` defines legacy `memory` plus role slots `memory.recall`, `memory.compaction`, `memory.capture`, `memory.dreaming`, `memory.userModel`, and `contextEngine`.

Effect: OpenClaw can now express multiple memory-style providers at once, each with a specific responsibility.

Example:

```json
{
  "plugins": {
    "slots": {
      "memory.recall": "memory-lancedb",
      "memory.capture": "memory-lancedb",
      "memory.dreaming": "memory-core",
      "memory.userModel": "honcho"
    }
  }
}
```

### Preserves legacy `memory` as recall shorthand

Evidence:

- `src/plugins/slot-resolution.ts:56-67` resolves `memory.recall` with legacy `memory` as fallback.
- `src/plugins/slots.ts:97-105` syncs legacy `memory` when recall selection changes.

Effect: existing configs keep working, but the system can also progressively move to explicit role slots.

### Resolves all memory roles independently

Evidence:

- `src/plugins/slot-resolution.ts:7-15` defines roles `recall`, `compaction`, `capture`, `dreaming`, and `userModel`.
- `src/plugins/slot-resolution.ts:17-19` maps each role to `memory.<role>`.
- `src/plugins/slot-resolution.ts:69-80` resolves all configured memory role slots.
- `src/plugins/slot-resolution.ts:128-138` can list all configured memory role plugin ids.

Effect: the loader can know that more than one memory-style plugin is selected, because each is selected for a different role.

### Loader activates selected role providers rather than only one memory owner

Evidence:

- `src/plugins/loader.ts:2207-2224` computes `memoryRoleSlots`, selected memory role plugin ids, and memory slot decision values.
- `src/plugins/loader.ts:2491-2506` documents and implements the critical exception: the dreaming engine, `memory-core` by default, must load alongside the selected memory slot plugin so dreaming can run even when LanceDB holds the slot.
- `src/plugins/loader.ts:2544` records selected memory roles for plugin diagnostics/records.

Effect: memory plugins can coexist where their role selections require it; the loader no longer needs to pretend there is exactly one memory plugin for every memory concern.

### Active Memory can target the selected recall role

Evidence:

- `extensions/active-memory/openclaw.plugin.json:141-144` says default tool grants come from the selected `memory.recall` provider.
- `docs/concepts/active-memory.md:514-524` documents `memory.recall: "memory-lancedb"` as enough for Active Memory to use `memory_recall`.
- `src/plugins/memory-runtime.ts:18` resolves the recall provider via `resolveMemoryRoleSlot({ role: "recall" })`.

Effect: Active Memory becomes an orchestration layer over the recall role, not another reason to collapse all memory into one provider.

### LanceDB can own recall/capture while memory-core owns dreaming

Evidence:

- `extensions/memory-lancedb/openclaw.plugin.json:48-58` exposes auto-capture, auto-recall, and role-aware dreaming help.
- `src/plugins/loader.ts:2491-2506` specifically allows the dreaming engine to load beside the selected memory slot plugin.

Effect: the common desired configuration is representable: LanceDB stores/recalls/captures embeddings while memory-core continues background consolidation/dreaming or QMD-backed local recall in another role if selected.

### Honcho can own user modeling while builtin/QMD owns recall

Evidence:

- `docs/concepts/memory-honcho.md:108-121` explicitly describes Honcho alongside builtin memory and QMD.
- `src/config/types.plugins.ts:52-58` provides `memory.userModel` as a first-class role alongside `memory.recall`.

Effect: the docs claim becomes structurally expressible. Honcho no longer has to replace builtin/QMD recall just to participate in the memory ecosystem.

### Memory Wiki remains a companion instead of competing for memory ownership

Evidence:

- `docs/plugins/memory-wiki.md:10-16` says it complements active memory rather than replacing it.
- `docs/plugins/memory-wiki.md:32-45` separates active memory runtime roles from wiki compiled/provenance roles.
- `extensions/memory-wiki/openclaw.plugin.json:85-107` exposes bridge import settings from active memory public artifacts/events.

Effect: Memory Wiki can sit beside whichever role-specific active memory providers are selected and consume public memory artifacts/events without pretending to be the one memory owner.

## Plugin-by-plugin interop matrix

| Combination | Documentation intent | `origin/main` behavior | PR #88504 behavior |
|---|---|---|---|
| `memory-core`/QMD + Honcho | Local project/Markdown recall plus AI-native user/session model (`docs/concepts/memory-honcho.md:108-121`) | Both are memory-style providers competing for one `memory` slot | `memory.recall = memory-core`/QMD, `memory.userModel = honcho` |
| `memory-lancedb` + `memory-core` dreaming | LanceDB recall/capture with role-aware dreaming config (`extensions/memory-lancedb/openclaw.plugin.json:56-58`) | LanceDB replaces memory-core as sole memory owner; dreaming resolves through same slot | `memory.recall`/`memory.capture = memory-lancedb`, `memory.dreaming = memory-core` |
| Active Memory + LanceDB | Active Memory uses selected recall provider's `memory_recall` (`docs/concepts/active-memory.md:514-524`) | Selecting LanceDB makes it the whole memory plugin | Active Memory uses `memory.recall` while other roles remain independently selectable |
| Memory Wiki + QMD/active memory | QMD for active recall; Memory Wiki bridge for compiled pages (`docs/plugins/memory-wiki.md:47-63`) | Wiki can be enabled as companion, but active memory side is still a single provider | Wiki remains companion; active memory ecosystem can be split by role |
| Memory Wiki + Honcho/local recall | Wiki complements active memory, not replacement (`docs/plugins/memory-wiki.md:10-16`, `32-45`) | Only one active memory owner can be represented | Wiki consumes public artifacts beside role-selected memory providers |

## Remaining caveats / review notes

1. **Docs now describe PR #88504 semantics.** Some docs on the branch already mention `memory.recall` and companion role slots. That is desirable for the PR, but when arguing “current OpenClaw as-is,” compare against `origin/main`, where those role slots do not exist.

2. **Honcho is external.** The repo docs describe it and provide configuration guidance, but the plugin source is external (`docs/concepts/memory-honcho.md:132-136`). The architecture still needs external plugin manifests/config to align with `memory.userModel` or other role slots.

3. **QMD is backend, not separate plugin.** It composes by being selected under `memory-core`, so “QMD + Honcho” means `memory-core`/QMD owns recall while Honcho owns user modeling/context.

4. **Memory Wiki is not itself a memory-slot plugin.** It is a companion knowledge compiler. The multi-slot architecture helps indirectly by making the active memory side composable and by preserving SDK/public artifact seams for Memory Wiki bridge imports.

5. **Interop still depends on runtime implementation details.** Role slots make the configuration and activation model capable of expressing coexistence; individual plugins still need correct hook policy, tool contracts, public artifacts/events, and safe prompt-injection boundaries.

## Bottom line

The docs already promise a memory ecosystem: local recall, AI-native user modeling, embedding LTM, recall orchestration, dreaming/consolidation, and compiled wiki knowledge are different responsibilities. `origin/main` collapses all `kind: "memory"` providers into one exclusive `plugins.slots.memory` owner, so those documented combinations are either impossible, require bespoke exceptions, or force one plugin to displace another.

PR #88504's multi-slot memory architecture is the missing config/runtime abstraction. It turns “memory plugin” from a single exclusive selector into role-based ownership, allowing documented memory-style plugins to coexist and interoperate according to their actual responsibilities.
