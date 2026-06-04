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
APIs incrementally, keep shipped file-shaped SDK APIs as compatibility adapters during a
deprecation window, and prove each SDK-affecting slice with API baseline checks and targeted
backward-compatibility tests.

The core migration can then replace the storage implementation behind the new APIs without
requiring external plugins to stop compiling or immediately rewrite existing `sessionFile` and
whole-store call sites.

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

- Keep plugin SDK changes backward-compatible for the SQLite migration.
- Add storage-neutral APIs for session entries, transcript identity, transcript reads/writes, and
  memory transcript sync.
- Preserve existing SDK imports and call shapes as compatibility adapters during a documented
  deprecation window.
- Move OpenClaw-owned callers, including bundled plugins, to the new APIs as soon as the relevant
  API exists.
- Make each SDK-affecting migration slice prove both API compatibility and runtime behavior.
- Avoid making SQLite, JSON files, or transient migration mechanics part of the long-term plugin
  SDK contract.

## Non-Goals

- This RFC does not define the SQLite schema.
- This RFC does not remove existing plugin SDK exports.
- This RFC does not require external plugin authors to migrate before the storage flip.
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
6. Deprecated adapters call the canonical accessor implementation; they do not become a second
   runtime storage path.

The key distinction is external compatibility versus internal architecture. External SDK consumers
get a bridge; OpenClaw-owned callers should move to the canonical API in the same migration slice
that introduces or needs it.

### Session entry access

The SDK should expose narrow session-entry helpers keyed by stable runtime identity, such as
`agentId`, `sessionKey`, and, where needed, `sessionId`.

Representative operations:

- load one session entry;
- list session entries within an agent or runtime scope;
- patch one entry;
- replace or upsert one entry.

The existing mutable whole-store export should remain available as a deprecated compatibility
adapter. It should continue returning the legacy shape during the deprecation window, but new
OpenClaw-owned code should not use it. Where a caller only needs one session, it should use the
narrow entry API rather than loading and mutating the full store.

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

For compatibility, `sessionFile` should remain optional and deprecated. Existing listeners that
only accept the old string form or read `update.sessionFile` should continue to work during the
deprecation window. New emitters and subscribers should publish and prefer the structured target.

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
deprecation window, limited to canonical OpenClaw transcript files. OpenClaw-owned callers should
switch to `sessions` so targeted sync does not require a JSONL path once transcripts live in
SQLite.

### Transcript search hit compatibility

Memory search results and QMD exports can currently refer to transcript files, filename stems, and
QMD markdown filenames. The SDK should expose helpers that map storage-neutral transcript memory
keys back to visible session identity, while preserving existing stem and QMD parsing helpers for
compatibility.

This lets new code treat transcript search hits as session identity, while old memory/QMD workflows
continue to parse existing file-shaped artifacts during the deprecation window.

### Cleanup and lifecycle APIs

Session lifecycle cleanup, transcript deletion, and scoped artifact cleanup should stay internal
unless external plugins need them. The migration needs storage-neutral cleanup internally, but
making that surface public would increase the SDK compatibility burden and expose destructive
operations before plugin use cases are clear.

If a public cleanup API becomes necessary, it should be proposed as an additive follow-up with its
own compatibility and permission model.

### Verification requirements

Every PR that changes plugin SDK session/transcript surfaces should include:

- plugin SDK API baseline generation and `plugin-sdk:api:check`;
- subpath export checks;
- focused tests showing old call shapes still work;
- focused tests showing new identity-based call shapes work;
- bundled plugin or extension tests for any migrated OpenClaw-owned callers;
- a disposable SQLite-flip validation where the slice has a SQLite implementation;
- a ratchet or boundary check when a subsystem has been migrated off direct JSON session-store
  access.

The compatibility proof should be explicit in the PR description. For deprecated adapters, tests
should prove that the adapter routes through the canonical accessor rather than reintroducing a
parallel runtime storage path.

### Deprecation plan

The initial SQLite migration should not remove shipped plugin SDK APIs. Deprecation should happen
in stages:

1. Add the replacement API.
2. Move OpenClaw-owned callers to the replacement.
3. Mark the old API or field deprecated in TypeScript and documentation.
4. Keep the old API working through the SQLite flip by adapting it to the canonical backend.
5. After external usage has had a migration window, propose removal in a separate RFC or release
   plan.

The migration window length is intentionally left open in this RFC.

## Rationale

This plan keeps the storage migration incremental without making external plugins absorb the
internal sequencing. The core runtime can stop treating JSON paths as identity, while SDK consumers
get additive replacements and a compatibility bridge.

A big-bang SDK break would reduce adapter code, but it would force external plugin authors to
coordinate with an internal storage migration. That is unnecessary: the old API shapes can be
implemented as adapters over the new accessor until a later removal decision.

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
- Should deprecated whole-store helpers remain fully mutable adapters, or should some operations
  become read-only after the SQLite migration?
- Should transcript update events expose both a structured `target` object and mirrored top-level
  `agentId`/`sessionKey`/`sessionId` fields long term?
- Do any external plugins need public session cleanup or transcript deletion APIs, or can those
  remain internal?
