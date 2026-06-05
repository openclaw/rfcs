---
title: Plugin SDK Session and Transcript Storage Migration
authors:
  - jalehman
created: 2026-06-04
last_updated: 2026-06-05
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/7
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
subscribers should publish and prefer the structured target.

The long-term transcript update contract should use the structured `target` object as the canonical
identity. Top-level `agentId`, `sessionKey`, and `sessionId` mirrors should not become a separate
long-term contract because they create parallel fields that must stay synchronized with `target`.
During the deprecation window, `sessionFile` remains required and deprecated for compatibility; it
is removed with the SQLite storage flip.

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

The active session/transcript migration PR stack contains several draft branches that export
`cleanupSessionLifecycleArtifacts` through `openclaw/plugin-sdk/session-store-runtime`. This RFC
treats that export as the required dreaming support, not as permission to add more cleanup surface.
Before any branch that contains that export leaves draft, maintainers should document it as a narrow
lifecycle cleanup API, keep it covered by plugin SDK API checks, and avoid adding broader session
deletion or transcript cleanup exports.

### Proposed SDK names

This RFC proposes using the names already present in the active migration branches:

- Session entries and lifecycle cleanup stay in `openclaw/plugin-sdk/session-store-runtime`:
  `getSessionEntry`, `listSessionEntries`, `patchSessionEntry`, `upsertSessionEntry`,
  `updateSessionStoreEntry`, `readSessionUpdatedAt`, and `cleanupSessionLifecycleArtifacts`.
- Transcript identity and scoped transcript operations use
  `openclaw/plugin-sdk/session-transcript-runtime`: `SessionTranscriptIdentity`,
  `SessionTranscriptTarget`, `formatSessionTranscriptMemoryHitKey`,
  `parseSessionTranscriptMemoryHitKey`, `resolveSessionTranscriptIdentity`,
  `resolveSessionTranscriptTarget`, `readSessionTranscriptEvents`,
  `appendSessionTranscriptMessageByIdentity`, `publishSessionTranscriptUpdateByIdentity`,
  `withSessionTranscriptWriteLock`, and `resolveSessionTranscriptMemoryHitKeyToSessionKeys`.
- Memory sync keeps `MemorySearchManager.sync` in the existing memory host SDK surface and adds
  `sessions: MemorySessionSyncTarget[]` as the replacement for deprecated `sessionFiles`.

The migration PRs should use these names unless review identifies a concrete collision or
ergonomics problem.

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

The deprecation window only works if plugin authors can discover it without reading the
implementation PR stack. Each deprecated SDK surface must therefore be represented in four places:

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

- mutable whole-store helpers such as `loadSessionStore`, `saveSessionStore`, and
  `updateSessionStore`;
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

### Open PR impact matrix

This table is a coordination aid for active OpenClaw PRs. Detailed compatibility evidence belongs
in the individual PR bodies. `SDK?` means the PR intentionally changes or carries a public plugin
SDK contract or export; incidental generated API-baseline drift should still be reviewed in that
PR, but is not classified here as a new SDK contract.

| PR | Name | Slice/subsystem | SDK? | Dependencies |
| --- | --- | --- | --- | --- |
| [#90463](https://github.com/openclaw/openclaw/pull/90463) | Session accessor + gateway consumer | 3.1a foundation | No | `main` |
| [#89121](https://github.com/openclaw/openclaw/pull/89121) | Transcript reader seam | 3.1b transcript readers | Yes | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89122](https://github.com/openclaw/openclaw/pull/89122) | Command session reads | 3.1b cron/infra/commands | Yes | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89123](https://github.com/openclaw/openclaw/pull/89123) | Transcript writer seam | 3.1b transcript writers | Yes | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89124](https://github.com/openclaw/openclaw/pull/89124) | Auto-reply sessions | 3.1b auto-reply/agent | Yes | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89129](https://github.com/openclaw/openclaw/pull/89129) | Bundled plugin callers | 3.1b bundled consumers | Yes | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89178](https://github.com/openclaw/openclaw/pull/89178) | SQLite session store foundation | 3.2 foundation | No | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89201](https://github.com/openclaw/openclaw/pull/89201) | Transcript identity contract | 3.1b transcript contract | No | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89203](https://github.com/openclaw/openclaw/pull/89203) | SDK session compatibility | 3.1b SDK session store | Yes | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89204](https://github.com/openclaw/openclaw/pull/89204) | SDK session entries | 3.1b SDK session entries | Yes | [#90463](https://github.com/openclaw/openclaw/pull/90463), [#89203](https://github.com/openclaw/openclaw/pull/89203) |
| [#89261](https://github.com/openclaw/openclaw/pull/89261) | Public transcript identity API | 3.1b SDK transcript identity | Yes | [#89201](https://github.com/openclaw/openclaw/pull/89201) |
| [#89262](https://github.com/openclaw/openclaw/pull/89262) | Scoped transcript target writers | 3.1b SDK transcript writers | Yes | [#89261](https://github.com/openclaw/openclaw/pull/89261) |
| [#89348](https://github.com/openclaw/openclaw/pull/89348) | Memory session sync identity | 3.1b SDK memory sync | Yes | [#89262](https://github.com/openclaw/openclaw/pull/89262) |
| [#89360](https://github.com/openclaw/openclaw/pull/89360) | QMD artifact identity mapping | 3.1b memory/QMD artifacts | No | [#89348](https://github.com/openclaw/openclaw/pull/89348) |
| [#89518](https://github.com/openclaw/openclaw/pull/89518) | Plugin transcript mirrors | 3.1b bundled transcript consumers | No | [#89360](https://github.com/openclaw/openclaw/pull/89360) |
| [#89519](https://github.com/openclaw/openclaw/pull/89519) | Session entry lifecycle seam | 3.1b lifecycle cleanup | Yes | [#90463](https://github.com/openclaw/openclaw/pull/90463) |
| [#89581](https://github.com/openclaw/openclaw/pull/89581) | Canonical transcript reader identity | 3.1b transcript readers | No | [#89201](https://github.com/openclaw/openclaw/pull/89201) |
| [#89904](https://github.com/openclaw/openclaw/pull/89904) | Bundled session helpers | 3.1b whole-store internals | Yes | [#89129](https://github.com/openclaw/openclaw/pull/89129) |
| [#89911](https://github.com/openclaw/openclaw/pull/89911) | Bundled transcript target lookups | 3.1b bundled transcript targets | Yes | [#89904](https://github.com/openclaw/openclaw/pull/89904) |
| [#89912](https://github.com/openclaw/openclaw/pull/89912) | Transcript update identity | 3.1b transcript update events | Yes | [#89360](https://github.com/openclaw/openclaw/pull/89360) |
| [#90437](https://github.com/openclaw/openclaw/pull/90437) | SQLite transcript identity adapter | 3.2 transcript identity | No | [#89201](https://github.com/openclaw/openclaw/pull/89201) |
| [#90438](https://github.com/openclaw/openclaw/pull/90438) | SQLite embedded run target adapter | 3.2 embedded run target | Yes | [#89178](https://github.com/openclaw/openclaw/pull/89178) |
| [#90439](https://github.com/openclaw/openclaw/pull/90439) | Embedded run session target seam | 3.1b embedded run target | No | [#89262](https://github.com/openclaw/openclaw/pull/89262) |

### Deprecation plan

The initial 3.1b migration should not remove shipped plugin SDK APIs. Deprecation should happen in
stages before SQLite becomes the canonical runtime store:

1. Add the replacement API.
2. Move OpenClaw-owned callers to the replacement.
3. Mark the old API or field deprecated in TypeScript comments, docs, and plugin-inspector output.
4. Keep the old API working while the runtime is still file-backed.
5. Remove the old file-shaped API at the SQLite storage flip.

The proposed deprecation window is one week between the release that ships the replacement APIs and
the SQLite storage flip. During that week, docs and plugin-inspector warnings should identify the
replacement API for every deprecated surface.

At the SQLite flip, deprecated file-shaped SDK APIs should be removed from TypeScript exports,
generated API baselines, and package exports. The SDK should not keep post-flip throwing stubs only
to make stale JavaScript imports resolve: that would keep the removed surface importable and blur the
compatibility boundary. Plugin authors should get compatibility before the flip through working
deprecated APIs, `@deprecated` comments, docs, and plugin-inspector warnings; after the flip, stale
imports should fail naturally because the exports are gone.

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
