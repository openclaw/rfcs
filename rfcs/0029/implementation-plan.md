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
- Add typed conversation commands, catalog/history refresh, and command errors.
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

The adjacent native adopter evidence is also complete:

| Slice | Scope and result | Boundary proved |
| --- | --- | --- |
| Config LC1 | Consumes a private read-only Config Model through Electron-owned transport and renders authored values plus schema guidance in native React. | Read projection can remain OpenClaw-owned without giving React raw config or write authority. |
| Board LB1 | Consumes a private Board Model through main-process routing, renders one exact native status-summary widget, and keeps HTML/Canvas/MCP/unknown widgets inert. | OpenClaw board semantics can drive a product-owned Dashboard without importing Control UI or granting renderer authority. |

Board LB1 uses a mocked beta-generation board protocol because pinned
LobsterClaw 2026.6.33 predates boards. It is conformance evidence, not release
admission.

## OpenClaw PR 5: shared conformance and package hardening

Fork-only draft:
[giodl73-repo/openclaw#241](https://github.com/giodl73-repo/openclaw/pull/241).
Its first slice centralizes finite defaults, adds an authoritative/malformed
catalog fixture pair, proves clean packed-package Node/declaration/browser
consumption, and fixes a package-only browser export failure found by that
proof. It does not yet satisfy the full PR 5 gate.

### Preconditions

- RFC scope and ownership boundary are accepted for implementation.
- OC1-OC4 evidence is reviewed against current source.
- Control UI and independent-host fixtures agree on the bounded contract.

### Scope

- Promote the proven fixture families into shared conformance assets.
- Finalize finite defaults and explicit truncation/partial-state behavior.
- Add browser and Node import/package acceptance checks.
- Add compatibility canaries for the supported release, predecessor where
  promised, and `main`.
- Measure projection, reconciliation, retained-memory, and resync bounds.
- Complete malformed-data, authorization, retired-epoch, and subscriber
  isolation security coverage.
- Keep the subpaths private or fork-only until the release/support gate passes.

### Deletion target

None. This PR hardens the contract before publication.

## OpenClaw PR 6: supported model subpaths

### Preconditions

- PR 5 conformance, compatibility, performance, package, and security gates
  pass.
- Named package, protocol, Control UI, security, and release owners agree.
- The independent-host proof remains valid against the candidate release.

### Scope

- Publish the optional `@openclaw/gateway-client/model` subpaths.
- Document supported versions, compatibility window, and migration policy.
- Add a framework-neutral quickstart and release notes.
- Pack the release artifact and prove clean browser and Node consumers can
  install it, resolve every supported subpath, and consume its declarations
  without workspace-only files or dependencies.
- Define support ownership and deprecation policy.
- Keep framework adapters outside the core model unless separately justified.

### Deletion target

Fork-only source carries after adopters move to a released dependency.

## OpenClaw PR 7: incumbent-path cleanup

### Preconditions

- PR 6 is released and adopted by Control UI.
- The model-backed path has an agreed observation window and rollback proof.
- The exact superseded implementation is named and no supported fallback
  depends on it.

### Scope

- Remove only the superseded Control UI reconciliation and compatibility paths
  for the adopted catalog/conversation slice.
- Retain operational, diagnostic, or unsupported-capability paths that the
  Control Model does not own.
- Update ownership docs and deletion ledger.

### Deletion target

The incumbent UI-local state/reconciliation path identified by OC4 adoption.

## Productization after publication

1. Land the supported package surface from PR 6 and replace Lobster's temporary source
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
  UI as the reference adopter. Lobster Board LB1 proves the native adapter
  boundary with a mocked beta protocol. A future BM2 proposal must reconstruct
  the proof against an admitted board-capable release and must not recreate
  dashboards from generic conversation artifacts.
- **Settings:** host OpenClaw settings first, read-only when Lobster lacks
  secure write authority. The read-only Config Model and Lobster LC1 proof now
  render selected authored values with descriptors and reload impact through a
  main-process adapter. A future CFG1 may upstream only that read projection.
  Effective defaults, provenance, owner, writability and lock reason,
  validation findings, candidate diff, generation, and transactional
  apply/reload status remain the separate CFG2/Managed Configuration work.
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

## Fork-only proposal policy

This plan names OC5-OC7, BM2, CFG1, and CFG2 for maintainer review. OC5 now has
one fork-only draft for its first bounded hardening slice; no upstream branch or
PR was opened. OC6, OC7, BM2, CFG1, and CFG2 remain proposals only. Any further
implementation drafts should remain in the author's forks until RFC intake and
the relevant OpenClaw owners approve the surface.
