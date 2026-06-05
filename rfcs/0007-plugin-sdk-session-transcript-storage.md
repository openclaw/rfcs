---
title: Plugin SDK Session and Transcript Storage Migration
authors:
  - jalehman
created: 2026-06-04
last_updated: 2026-06-04
rfc_pr: TBD
---

# Proposal: Plugin SDK Session and Transcript Storage Migration

## Summary

OpenClaw session and transcript state is moving from JSON session-store files and JSONL
transcript files to SQLite. This RFC proposes the plugin SDK compatibility strategy for that
migration: add storage-neutral session and transcript APIs, move OpenClaw-owned callers to those
APIs incrementally, keep shipped file-shaped SDK APIs available during a pre-SQLite deprecation
window, and prove each SDK-affecting slice with API baseline checks, targeted compatibility tests,
documentation, and plugin-inspector deprecation reporting.

The SQLite flip is the compatibility boundary for file-shaped SDK APIs. External plugins should
have a documented migration window before that flip, with deprecations visible in TypeScript,
OpenClaw docs, `openclaw plugins inspect`, and the external plugin inspector. The goal is to keep
legacy plugins compiling during the window while making the removal point explicit rather than
pretending `sessionFile` and mutable whole-store APIs remain valid after runtime state is no longer
file-backed.

## Motivation

The current runtime exposes implementation details of the file-backed session system in several
places. Internal subsystems, bundled plugins, and external plugin SDK consumers can observe or pass
values such as `sessionFile`, mutable whole-session-store objects, and transcript memory hit stems
that are derived from JSONL filenames. Those shapes make sense while the storage implementation is
JSON files on disk, but they are the wrong identity model for SQLite-backed runtime state.

The broader storage migration is intentionally incremental:

1. Add a storage-neutral accessor interface while it still delegates to the existing file-backed
   implementation.
2. Move one subsystem at a time onto that accessor.
3. Add narrow CI ratchets so migrated subsystems do not regress to direct JSON session-store access.
4. Add SQLite implementations behind the same interfaces.
5. Migrate existing user state once, then make the steady-state runtime read and write the
   canonical SQLite store.

Most of that work can happen behind internal boundaries. The exception is the plugin SDK: shipped
external plugins may import current SDK subpaths, call session-store helpers, receive transcript
update events, or trigger memory sync using file-shaped inputs. We need a public compatibility plan
before the SQLite migration reaches those surfaces.

## Goals

- Keep plugin SDK changes backward-compatible during the pre-SQLite migration window.
- Add storage-neutral APIs for session entries, transcript identity, transcript reads/writes, and
  memory transcript sync.
- Preserve existing SDK imports and call shapes during a documented deprecation window before
  SQLite becomes canonical.
- Move OpenClaw-owned callers, including bundled plugins, to the new APIs as soon as the relevant
  API exists.
- Make each SDK-affecting migration slice prove both API compatibility and runtime behavior.
- Make every deprecated SDK surface visible in TypeScript comments, docs, and plugin-inspector
  output before the SQLite flip.
- Avoid making SQLite, JSON files, or transient migration mechanics part of the long-term plugin
  SDK contract.

## Non-Goals

- This RFC does not define the SQLite schema.
- This RFC does not remove existing plugin SDK exports before the deprecation window begins.
- This RFC does not guarantee that file-shaped SDK APIs continue to work after the SQLite flip.
- This RFC does not preserve file-backed runtime fallback after migration. Legacy files should be
  migrated by the designated migration owner before steady-state runtime starts.
- This RFC does not make private cleanup or lifecycle hooks public unless an external plugin use
  case requires them.

## Proposal

### Compatibility rules

Plugin SDK changes for the session/transcript migration should follow these rules:

1. New public capability is additive: new subpaths, functions, optional object fields, or optional
   parameters.
2. Existing public imports continue to resolve.
3. Existing public function signatures continue to typecheck.
4. File-shaped public inputs remain accepted through a deprecation window when there is a shipped
   compatibility contract.
5. New internal and bundled-plugin code uses the storage-neutral APIs, not the deprecated adapters.
6. Deprecated adapters may call the canonical accessor during the file-backed window, but they do
   not become a second runtime storage path after SQLite is canonical.
7. Every deprecated SDK surface has a named replacement, a removal milestone, and plugin-inspector
   visibility.

The key distinction is external compatibility versus internal architecture. External SDK consumers
get a pre-SQLite migration window; OpenClaw-owned callers should move to the canonical API in the
same migration slice that introduces or needs it. The migration window is a compatibility promise,
not a commitment to synthesize JSON session files or `sessionFile` identity after SQLite owns the
runtime state.

### Session entry access

The SDK should expose narrow session-entry helpers keyed by stable runtime identity, such as
`agentId`, `sessionKey`, and, where needed, `sessionId`.

Representative operations:

- load one session entry;
- list session entries within an agent or runtime scope;
- patch one entry;
- replace or upsert one entry.

The existing mutable whole-store export should remain available only during the pre-SQLite
deprecation window. It should continue returning the legacy shape while the runtime is still
file-backed, but new OpenClaw-owned code should not use it. Where a caller only needs one session,
it should use the narrow entry API rather than loading and mutating the full store.

### Transcript identity and target APIs

The SDK should expose transcript APIs that identify runtime transcripts by stable session identity
instead of file paths.

The public identity shape should include:

- the owning `agentId`;
- the visible `sessionKey` when one exists;
- the runtime `sessionId`;
- a storage-neutral memory/search key for transcript search hits.

The public target shape should allow a caller to bind a read or write to either:

- the current runtime transcript for a session; or
- a concrete active transcript artifact when the caller already owns that artifact during a
  file-backed write transaction.

Representative operations:

- resolve transcript identity;
- resolve transcript target;
- read transcript events;
- append transcript messages by identity;
- publish transcript updates by identity;
- run transcript work under the appropriate write lock for the resolved target.

The API may keep an optional `sessionFile` parameter for the active artifact case during the
file-backed period. That parameter is a binding hint for callers that already hold the concrete
artifact, not the general runtime identity model.

### Transcript update events

`SessionTranscriptUpdate` should grow additive storage-neutral identity fields while preserving the
existing file-shaped compatibility path.

The event should include a structured target containing:

- `agentId`;
- `sessionKey`;
- `sessionId`;
- `targetKind`, distinguishing the current runtime session from an active file-backed artifact.

For compatibility, `sessionFile` should remain present and deprecated while file-backed transcript
updates are still emitted. Existing listeners that only accept the old string form or read
`update.sessionFile` should continue to work during the deprecation window. New emitters and
subscribers should publish and prefer the structured target. Making `sessionFile` optional before
the removal boundary is a potential TypeScript source break and should be avoided unless a slice
explicitly accepts and documents that break.

### Memory transcript sync

Memory search currently has file-shaped targeted sync inputs for session transcripts. The SDK
should add storage-neutral sync targets:

```ts
type MemorySessionSyncTarget = {
  agentId?: string;
  sessionId: string;
  sessionKey?: string;
};
```

`MemorySearchManager.sync` should accept those targets through a `sessions` parameter. Existing
`sessionFiles` inputs should remain accepted as deprecated compatibility inputs during the
pre-SQLite deprecation window, limited to canonical OpenClaw transcript files. OpenClaw-owned
callers should switch to `sessions` so targeted sync does not require a JSONL path once transcripts
live in SQLite. This RFC does not require `sessionFiles` to work after the SQLite flip.

### Transcript search hit compatibility

Memory search results and QMD exports can currently refer to transcript files, filename stems, and
QMD markdown filenames. The SDK should expose helpers that map storage-neutral transcript memory
keys back to visible session identity, while preserving existing stem and QMD parsing helpers for
compatibility.

This lets new code treat transcript search hits as session identity, while old memory/QMD workflows
continue to parse existing file-shaped artifacts during the deprecation window.

### Cleanup and lifecycle APIs

Session lifecycle cleanup, transcript deletion, and scoped artifact cleanup should stay internal
except for the lifecycle-artifact cleanup capability already needed by the memory-core dreaming
plugin. Dreaming is implemented as a plugin SDK consumer, and its narrative runner needs to reclaim
stale subagent session rows and orphaned transcript artifacts that ordinary `subagent.deleteSession`
can fail to remove. The SDK should therefore expose this lifecycle cleanup capability, but it should
not grow into a broader deletion or arbitrary cleanup API.

The accepted public shape is the current session lifecycle artifact cleanup capability: remove
session rows whose session-key segment matches a lifecycle-owned prefix, archive stale or orphaned
transcript artifacts that carry the lifecycle marker, preserve fresh/live artifacts, and report the
number of removed rows and archived artifacts. SQLite implementations may change how this is
performed internally, but the SDK contract should stay scoped to lifecycle-owned cleanup rather than
mutable whole-store access.

The current Path 3 PR stack contains several draft branches that export
`cleanupSessionLifecycleArtifacts` through `openclaw/plugin-sdk/session-store-runtime`. This RFC
treats that export as the required dreaming support, not as permission to add more cleanup surface.
Before any branch that contains that export leaves draft, maintainers should document it as a narrow
lifecycle cleanup API, keep it covered by plugin SDK API checks, and avoid adding broader session
deletion or transcript cleanup exports.

### Verification requirements

Every PR that changes plugin SDK session/transcript surfaces should include:

- plugin SDK API baseline generation and `plugin-sdk:api:check`;
- subpath export checks;
- focused tests showing old call shapes still work during the file-backed window;
- focused tests showing new identity-based call shapes work;
- docs updates for new replacement APIs and deprecated legacy APIs;
- `openclaw plugins inspect` and external plugin-inspector proof for any newly deprecated SDK
  surface they can detect;
- bundled plugin or extension tests for any migrated OpenClaw-owned callers;
- a disposable SQLite-flip validation where the slice has a SQLite implementation;
- a ratchet or boundary check when a subsystem has been migrated off direct JSON session-store
  access.

The compatibility proof should be explicit in the PR description. For deprecated adapters, tests
should prove that the adapter still works during the file-backed window and does not get used by
OpenClaw-owned callers that have a replacement API.

### Documentation and inspector requirements

The deprecation window only works if plugin authors can discover it without reading the Path 3 PR
stack. Each deprecated SDK surface must therefore be represented in four places:

1. TypeScript API comments: add `@deprecated` with the replacement API and removal milestone.
2. Plugin SDK docs: update the relevant runtime guide, subpath reference, and migration guide.
3. Runtime inspection: make `openclaw plugins inspect --runtime` and its JSON report include a
   compatibility notice when a plugin uses a deprecated session/transcript SDK surface.
4. External inspection: update the plugin-inspector advisory rules so package authors see the same
   deprecation before installing or submitting a plugin.

The notice should name the deprecated import, function, option, or event field; explain that it is
supported only through the pre-SQLite deprecation window; name the replacement API; and identify the
planned removal boundary as the SQLite storage flip.

The first deprecated surfaces that need coverage are:

- mutable whole-store helpers such as `loadSessionStore`, `saveSessionStore`,
  `updateSessionStore`, and `updateSessionStoreEntry`;
- file-path helpers such as `resolveSessionFilePath`, `resolveSessionTranscriptPathInDir`,
  `resolveAndPersistSessionFile`, and `readLatestAssistantTextFromSessionTranscript`;
- transcript append/update APIs that take or emit `transcriptPath` or `sessionFile`;
- `SessionTranscriptUpdate.sessionFile` as a consumed identity field;
- embedded-agent and memory-sync parameters such as `runEmbeddedAgent({ sessionFile })` and
  `MemorySearchManager.sync({ sessionFiles })`;
- transcript search-hit helpers that expose JSONL/QMD filename identity.

The inspector does not need to understand arbitrary plugin runtime behavior before this RFC can
land, but it does need to flag importable SDK surfaces and obvious option/field names that plugin
authors can act on. Deeper usage analysis can be added incrementally as each 3.1b slice adds a
replacement.

### Current tracked compatibility matrix

This matrix was generated from the Path 3 tracker issue on 2026-06-04. It covers every tracked PR
that touches plugin SDK source files, generated SDK API baselines, or public SDK-facing event
contracts. "Non-breaking" means existing imports and runtime call shapes are intended to continue
working; it does not mean the new API is automatically approved as the right long-term SDK surface.

| PR | SDK surface | Public change | Compatibility assessment | Required before undraft/merge |
| --- | --- | --- | --- | --- |
| [#88840](https://github.com/openclaw/openclaw/pull/88840) | `session-store-runtime`; API baseline | Introduced the initial accessor export stack, including lifecycle cleanup exports. | Superseded by [#90463](https://github.com/openclaw/openclaw/pull/90463). Do not merge as-is. | Keep closed/superseded; ensure later PRs own any surviving exports. |
| [#89121](https://github.com/openclaw/openclaw/pull/89121) | `session-store-runtime`; API baseline | Transcript reader slice inherits the lifecycle cleanup export. | Additive at the type level. The export is accepted only as the narrow lifecycle-artifact cleanup needed by dreaming. | Document the cleanup export; refresh API baseline proof after rebase. |
| [#89122](https://github.com/openclaw/openclaw/pull/89122) | `session-store-runtime`; API baseline | Cron, infra, and command consumers inherit the lifecycle cleanup export. | Same as [#89121](https://github.com/openclaw/openclaw/pull/89121): additive and limited to lifecycle-artifact cleanup. | Document the cleanup export; refresh API baseline proof after rebase. |
| [#89123](https://github.com/openclaw/openclaw/pull/89123) | `session-store-runtime`; API baseline | Transcript writer slice inherits the lifecycle cleanup export. | Same lifecycle cleanup scope; writer behavior otherwise routes through the accessor. | Document the cleanup export; rerun SDK baseline and focused writer proof. |
| [#89124](https://github.com/openclaw/openclaw/pull/89124) | `session-store-runtime`; API baseline | Auto-reply and agent slice inherits the lifecycle cleanup export. | Same lifecycle cleanup scope; no intended external call-shape break. | Document the cleanup export; rerun SDK baseline and focused auto-reply proof. |
| [#89129](https://github.com/openclaw/openclaw/pull/89129) | `config-runtime`, `session-store-runtime`; API baseline | Adds entry-level session helpers and aliases such as `getSessionEntry`, `listSessionEntries`, and `readSessionUpdatedAt`. | Non-breaking additive helpers. Existing whole-store and file-shaped helpers remain available. | Confirm aliases are still needed after [#89203](https://github.com/openclaw/openclaw/pull/89203)/[#89204](https://github.com/openclaw/openclaw/pull/89204) settle; rerun API check. |
| [#89178](https://github.com/openclaw/openclaw/pull/89178) | API baseline only | SQLite foundation changes SDK baseline through the stacked migration context, with no direct public SDK source file in the PR. | No independent public SDK contract change identified from tracked files. | Treat baseline drift as a review signal; require fresh `plugin-sdk:api:check` before undraft. |
| [#89201](https://github.com/openclaw/openclaw/pull/89201) | API baseline only; transcript runtime contract | Adds internal transcript identity/state contract used by later SDK/API work. | No direct public SDK API change identified, but later transcript SDK APIs depend on it. | Keep public SDK changes in the owning transcript SDK PRs; refresh API baseline proof. |
| [#89203](https://github.com/openclaw/openclaw/pull/89203) | `config-runtime`, `session-store-runtime`; API docs/tests/baseline | Adds narrow session-entry helpers and routes public runtime helpers through the accessor while keeping deprecated whole-store compatibility helpers during the file-backed window. | Non-breaking additive API plus a pre-SQLite deprecation bridge for legacy session-store callers. It should not promise whole-store helpers after the SQLite flip. | Verify deprecated whole-store helpers still typecheck during the window; add docs and inspector notices that identify the new entry helpers as replacements. |
| [#89204](https://github.com/openclaw/openclaw/pull/89204) | `config-runtime`, `session-store-runtime`; tests/baseline | Adds or refines entry-level helpers including `getSessionEntry`, `listSessionEntries`, `patchSessionEntry`, `upsertSessionEntry`, and `updateSessionStoreEntry`. | Non-breaking additive entry API. Existing imports remain. | Reconcile overlap with [#89203](https://github.com/openclaw/openclaw/pull/89203); keep one coherent helper set and API baseline proof. |
| [#89261](https://github.com/openclaw/openclaw/pull/89261) | New `session-transcript-runtime` subpath; `session-transcript-hit`; package/docs/scripts/tests/baseline | Adds transcript identity/read APIs and memory-hit identity helpers. | Non-breaking additive subpath and helpers. It intentionally moves new callers away from file-path identity without removing old hit parsing. | Confirm new subpath export metadata, docs, and API baseline are current after rebase. |
| [#89262](https://github.com/openclaw/openclaw/pull/89262) | `session-transcript-runtime`; package/docs/tests/baseline | Adds transcript target/writer APIs: resolve target, append by identity, publish update by identity, and write-lock by target. | Non-breaking additive writer API. Optional `sessionFile` remains as a file-backed active-artifact binding hint. | Verify old file-backed writer flows and new identity writer flows in the same proof set. |
| [#89348](https://github.com/openclaw/openclaw/pull/89348) | `memory-core-host-engine-storage`; memory host SDK types/helpers/tests/baseline | Adds `MemorySessionSyncTarget` and `MemorySyncParams.sessions`, while retaining deprecated `sessionFiles` during the file-backed window. | Non-breaking if `sessionFiles` remains accepted through the pre-SQLite deprecation window. This is the public bridge for `MemorySearchManager.sync`, not a post-flip compatibility guarantee. | Keep canonical-path tests for deprecated `sessionFiles`; document and inspect `sessions` as the required replacement before SQLite. |
| [#89518](https://github.com/openclaw/openclaw/pull/89518) | API baseline only; bundled plugin users of transcript APIs | Migrates bundled plugin transcript mirrors onto scoped transcript APIs. | No new public SDK source identified; validates that additive transcript APIs are usable by OpenClaw-owned plugins. | Keep baseline check and bundled plugin proof current after rebasing onto transcript API owners. |
| [#89519](https://github.com/openclaw/openclaw/pull/89519) | `session-store-runtime`; API baseline | Adds or inherits `cleanupSessionLifecycleArtifacts` lifecycle cleanup export. | Additive and accepted as the narrow public SDK capability needed by memory-core dreaming. It should not expand into general cleanup/deletion. | Document the export, prove the dreaming scrub behavior, and keep API baseline proof current. |
| [#89904](https://github.com/openclaw/openclaw/pull/89904) | `config-runtime`, `session-store-runtime`; docs/tests/baseline | Routes bundled SDK/runtime session helpers through the accessor; keeps deprecated whole-store/file-shaped compatibility during the file-backed window. Also carries lifecycle cleanup export. | Session helper compatibility is non-breaking during the deprecation window; lifecycle export remains unresolved. | Keep old SDK helpers working only as pre-SQLite compatibility; resolve cleanup export and add docs/inspector deprecation coverage before undraft. |
| [#89911](https://github.com/openclaw/openclaw/pull/89911) | `session-transcript-runtime`, `session-transcript-hit`, `text-chunking`, package/docs/scripts/tests/baseline | Adds a public phase-aware text extraction helper and uses transcript target lookup APIs in bundled consumers. | Non-breaking additive helper. Existing transcript command/session-file compatibility remains. | Confirm `text-chunking` belongs in the plugin SDK and is documented as stable enough for external use. |
| [#89912](https://github.com/openclaw/openclaw/pull/89912) | `SessionTranscriptUpdate` event contract; API baseline | Adds structured transcript update identity/target fields and deprecates `sessionFile`. | Non-breaking only if `sessionFile` remains present during the pre-SQLite deprecation window. Making it optional before removal is a likely TypeScript source break for external listeners. | Keep `sessionFile: string` required until the SQLite removal boundary, mark it deprecated, and add docs/inspector coverage for subscribers that still key on it. |
| [#90438](https://github.com/openclaw/openclaw/pull/90438) | `session-store-runtime`; API baseline | SQLite embedded-run adapter branch carries the lifecycle cleanup export. | Additive and subject to the same narrow lifecycle cleanup contract. | Implement the same lifecycle-artifact cleanup semantics behind SQLite; rerun API baseline. |
| [#90463](https://github.com/openclaw/openclaw/pull/90463) | API baseline; new accessor package surface | Combines the 3.1a accessor seam with a first gateway consumer and ratchet. | No direct plugin SDK source change in the PR after removing misplaced exports; baseline changes should be reviewed as package-surface drift. | Keep `plugin-sdk:api:check` green and ratchet scope narrow. |

Audited tracker PRs with no identified public plugin SDK API change: [#89120](https://github.com/openclaw/openclaw/pull/89120)
is superseded by [#90463](https://github.com/openclaw/openclaw/pull/90463); [#89360](https://github.com/openclaw/openclaw/pull/89360)
is QMD/internal memory artifact identity mapping; [#89581](https://github.com/openclaw/openclaw/pull/89581)
is an internal transcript reader migration; [#90437](https://github.com/openclaw/openclaw/pull/90437)
is a SQLite adapter implementation; and [#90439](https://github.com/openclaw/openclaw/pull/90439)
is an internal embedded-run session target seam that depends on the transcript target APIs but does
not itself add public SDK surface.

Two compatibility gaps remain open after this audit:

1. The lifecycle cleanup export appears in multiple stacked PRs. It is additive and needed by the
   memory-core dreaming plugin. The stack should keep the export, document it as a narrow
   lifecycle-artifact cleanup API, and avoid adding broader cleanup/deletion SDK surface.
2. `SessionTranscriptUpdate.sessionFile` becoming optional is runtime-compatible only if every
   emitter still populates it for old subscribers. It can still be a TypeScript source break for
   external listeners. The safest compatibility position is to keep `sessionFile` required during
   the pre-SQLite deprecation window, while marking it deprecated and adding the structured target
   fields now.

### Impact on current 3.1b slices

The deprecation-window decision does not invalidate the existing 3.1b migration slices. They still
serve the core purpose of introducing replacement APIs and moving OpenClaw-owned callers onto those
APIs before SQLite becomes canonical. It does change the acceptance criteria for SDK-affecting
slices:

- PRs that introduce replacement APIs must also update docs and plugin-inspector deprecation
  reporting for the legacy surface they replace.
- PRs that keep old SDK helpers working should describe that compatibility as pre-SQLite
  deprecation-window support, not as post-flip JSON/session-file emulation.
- PRs that migrate bundled or internal callers should not leave those callers on deprecated APIs
  just because external plugins still have the migration window.
- SQLite adapter PRs do not need to preserve legacy file-shaped SDK APIs after the flip unless a
  separate compatibility decision explicitly requires it.
- Disposable SQLite-flip validation branches should route any legacy-SDK failure back to either the
  replacement API owner or the deprecation/removal plan; they should not add disposable-only JSON
  fallback behavior.

Concretely, the already-open 3.1b PRs need the following follow-up:

- Session-entry compatibility PRs should keep whole-store helpers available only during the
  file-backed window and add inspector/docs deprecations that point to entry helpers.
- Transcript identity and target/writer PRs remain the canonical replacement for `sessionFile` and
  `transcriptPath` call patterns, and their docs should say so directly.
- Memory sync identity should treat `sessionFiles` as pre-SQLite deprecated compatibility and
  `sessions` as the required future API.
- Transcript update identity should keep `sessionFile` required and deprecated during the window,
  while adding structured target identity for new subscribers.
- Lifecycle cleanup should remain limited to `cleanupSessionLifecycleArtifacts`, because current
  dreaming code needs that lifecycle-artifact scrub through the plugin SDK. Do not add broader
  cleanup/deletion APIs around it.

### Deprecation plan

The initial 3.1b migration should not remove shipped plugin SDK APIs. Deprecation should happen in
stages before SQLite becomes the canonical runtime store:

1. Add the replacement API.
2. Move OpenClaw-owned callers to the replacement.
3. Mark the old API or field deprecated in TypeScript comments, docs, and plugin-inspector output.
4. Keep the old API working while the runtime is still file-backed.
5. Remove the old file-shaped API at the SQLite storage flip, or in an explicitly named release
   boundary tied to that flip.

The migration window length is intentionally left open in this RFC.

## Rationale

This plan keeps the storage migration incremental without making external plugins absorb every
internal sequencing detail. The core runtime can stop treating JSON paths as identity, while SDK
consumers get additive replacements, visible deprecation notices, and a bounded migration window.

A big-bang SDK break would reduce adapter code, but it would force external plugin authors to
coordinate with an internal storage migration immediately. That is unnecessary while the runtime is
still file-backed. It is also unnecessary to preserve file-shaped APIs after SQLite owns the store:
the honest compatibility boundary is a pre-flip deprecation window with inspector support.

A permanent dual-store runtime would also preserve compatibility, but it would make the migration
harder to reason about. The compatibility layer should live at the public SDK edge. The runtime
should have one canonical store after migration, with legacy files imported by the migration owner
rather than consulted indefinitely.

Moving bundled plugins immediately is also deliberate. Bundled plugins are OpenClaw-owned code, so
they should prove the new API is sufficient and avoid setting examples that external plugin authors
should not copy.

## Unresolved questions

- What exact SDK subpath and export names should the transcript identity APIs use?
- How long should the deprecation window last for `sessionFile`, `sessionFiles`, and mutable
  whole-store helpers?
- Should removed JavaScript entry points fail with explicit runtime errors at the SQLite boundary,
  or should they be removed from the package exports entirely?
- Should transcript update events expose both a structured `target` object and mirrored top-level
  `agentId`/`sessionKey`/`sessionId` fields long term?
- How should the SQLite implementation preserve `cleanupSessionLifecycleArtifacts` semantics without
  exposing additional cleanup/deletion SDK surface?
