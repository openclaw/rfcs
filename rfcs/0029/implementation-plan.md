# Control Model implementation and PR plan

This plan is a proposed review sequence, not an accepted roadmap. It keeps each
OpenClaw layer independently useful and delays publication until two consumers
prove the contract.

## Source extraction rules

- Move behavior only after a shared fixture captures it.
- Keep protocol and schema types in their current owner packages.
- Do not copy Control UI helpers that import presentation, localization,
  browser storage, routing, or DOM behavior.
- Prefer pure normalization and capability factories over a new universal
  application framework.
- Keep OpenClaw Control UI behavior unchanged during adoption.

## OpenClaw PR 1: Gateway Client model foundation

### Scope

- Add optional `@openclaw/gateway-client/model` subpaths.
- Define host Gateway binding, immutable external-store contract, lifecycle,
  structured errors, and bounds configuration.
- Isolate bounded reconciliation and subscriber notification from the Gateway
  receive stack.
- Project connection state and session catalog.
- Reuse canonical protocol types without re-exporting the entire protocol.
- Add Gateway Client model documentation and browser-safe import checks.

### Explicit exclusions

- Conversation messages and streaming.
- UI artifacts.
- React/Lit adapters.
- Public npm publication.

### Proof

- Store race/disposal tests.
- Slow/throwing subscriber and reconciliation-queue saturation tests.
- Session list plus create/update/delete reconciliation.
- Connection-epoch retirement.
- Retryable observer outage and authoritative refresh.
- Model graph contains no framework, DOM component, or product import.

### Deletion target

One duplicate session-catalog reducer in an adopter, after later adoption.

## OpenClaw PR 2: selected conversation and commands

### Scope

- Add lazy conversation models.
- Extract deterministic history/live merge.
- Project messages, runs, tools, approvals, and questions.
- Add typed chat/session commands and command errors.
- Add finite progress and inactive-conversation retention.

### Proof

- Shared fixture corpus consumed by Control Model and current Control UI tests.
- History/live overlap and duplicate suppression.
- Sequence gap plus explicit partial state and refresh.
- Mid-stream reconnect and retired-epoch rejection.
- Allowed, forbidden, conflict, timeout, abort, and disposal command paths.

### Deletion target

Control UI and independent-host reducers for the adopted conversation slice.

## OpenClaw PR 3: renderer-neutral UI artifacts

### Scope

- Define and validate v1 artifacts.
- Preserve all applicable OpenClaw core/extension view offers and let the
  client select among compatible views.
- Enumerate authorized descriptors cheaply and materialize only the selected
  deferred view.
- Preserve sanitized artifact data through live projection and history.
- Preserve one artifact identity across inline chat and dedicated product
  surfaces, including higher revisions published by later turns.
- Adapt existing MCP App and Canvas previews into explicit fallbacks.
- Add revision, expiry, bound, and structured failure behavior.
- Keep renderer registries outside the model.

### Proof

- Known and unknown template URIs.
- Multiple offered views with client-owned selection.
- Authorization-filtered discovery and selected-only materialization.
- Malformed/oversized data.
- Increasing, duplicate, stale, and conflicting revisions.
- History reload and reconnect.
- Inline and dedicated projections of the same artifact ID.
- Later-turn revision without creating a duplicate artifact.
- MCP App fallback and expiry.
- Proof that metadata cannot select an import or register a component.

### Deletion target

Tool-specific native rendering interpretation and duplicate Canvas/MCP
association logic.

## OpenClaw PR 4: Control UI reference adoption

### Scope

- Adapt the existing Control UI Gateway store to the model binding.
- Move the session catalog and one complete conversation route to Control Model
  snapshots.
- Keep Lit components, routes, styling, and behavior unchanged.
- Render current Canvas/MCP fallbacks through a Control UI-local artifact
  registry/adapter.

### Proof

- Existing focused Control UI tests.
- Shared model fixtures.
- Real browser/Gateway chat flow.
- No regression in reconnect, approval, tool cards, MCP Apps, or history.
- Bundle and startup impact measured.

### Deletion target

Superseded UI-local session/conversation capability and reconciliation code.

## Lobster/M evidence series

The bounded independent-adopter series is complete in fork-local drafts. It
uses Lobster's existing hosted Gateway seam and keeps M's `SessionView` as the
passive renderer vocabulary.

| Slice | Scope and result | Deletion or boundary proved |
| --- | --- | --- |
| L0 | Temporarily carries OC1-OC3 into Lobster and preserves sanitized artifacts through the pinned OpenClaw history projection. | Source-resolved evidence only; not the publication shape. |
| LM1 | Maps canonical conversation snapshots into existing `SessionView` while preserving host-owned raw operational lanes. | React does not parse Gateway events and no second M view model is introduced. |
| LM2 | Renders an exact allowlisted `clawpilot://widgets/table` v1 artifact with schema bounds, durable history identity, and visible fallback. | One trusted native first-party artifact works without importing Control UI. |
| LM3 | Adds one host-owned Refresh action, validates current artifact identity/revision, and dispatches through `conversation.send`. | Native components receive no raw Gateway authority; stale and denied actions fail visibly. |
| LM4 | Routes ordinary sends through `ControlModelConversation.send` while retaining Lobster attachment preprocessing and operational turn tracking. | Deletes the duplicate raw ordinary `chat.send` request path. |
| LM5 | Routes active foreground aborts through `ControlModelConversation.abort`. | Deletes duplicate raw active-run abort dispatch while retaining no-run abort-all recovery. |
| LM6 | Explicitly refreshes and projects canonical selected-session history through the model. | Deletes duplicate selected-session raw `chat.history` normalization. |

The series stops at LM6. Operator/security approvals, no-run abort-all,
session administration, memory, automation compatibility, attachment
preprocessing, and host run ownership remain outside this bounded deletion
case.

Cross-client user-message correlation is a separate future contract rather
than LM7. It must align Lobster `clientMessageId`, model idempotency,
retry/reconnect, non-renderer callers, persisted history, canonical user
identity, and renderer deduplication.

## OpenClaw PR 5: publication

### Preconditions

- Control UI and independent host are live on the same contract.
- Compatibility and package acceptance pass.
- Bounds and security review pass.
- At least one duplicate implementation is deleted.
- Named package, protocol, security, and release owners agree.

### Scope

- Publish the optional `@openclaw/gateway-client/model` subpaths.
- Document supported versions and migration policy.
- Add framework-neutral quickstart and conformance fixtures.
- Keep optional framework adapters outside the core model unless separately
  justified.

## Productization after publication

1. Land the supported package surface and replace Lobster's temporary source
   carry with a released OpenClaw dependency.
2. Resolve Lobster required checks and land the bounded stack behind a runtime
   flag with rollback.
3. Run a live hosted-Gateway proof covering authentication, reconnect,
   history, streaming, native artifact action, send, and abort.
4. Add safe telemetry for projection lag, fallback, validation failure, action
   outcome, and rollback without recording raw artifact data.
5. Finish Fluent quality, accessibility, localization, security review, and
   shareable screenshots or recordings.

## Adjacent surfaces

- **Dashboards and widgets:** host OpenClaw's existing dashboard routes first.
  The first fork-only Board Model proof now extracts selected-session board
  reconciliation into `@openclaw/gateway-client/model/board` and keeps Control
  UI as the reference adopter. A native Lobster adapter must use a board-capable
  OpenClaw generation and must not recreate dashboards from generic
  conversation artifacts.
- **Settings:** host OpenClaw settings first, read-only when Lobster lacks
  secure write authority. The read-only Config Model and Lobster LC1 proof now
  render selected authored values with descriptors and reload impact through a
  main-process adapter. Effective defaults, provenance, owner, writability and
  lock reason, validation findings, candidate diff, generation, and
  transactional apply/reload status remain Managed Configuration work.
- **Canvas and MCP Apps:** preserve them as explicit sandboxed fallbacks rather
  than converting their executable state into trusted native React.

## Deferred work

- Channels, skills, nodes, workboards, and admin surfaces.
- JSON Patch/JSONL artifact dialect.
- Model-visible component catalogs and generic generated layouts.
- Third-party native component SDK.
- Stable framework-specific adapters.
- Cross-client user-message identity and retry correlation.
- First-class action-run lifecycle, typed interaction payloads, stateful
  artifact evolution, and durable document semantics.

Each deferred surface requires a separate owner-first slice and deletion case.
