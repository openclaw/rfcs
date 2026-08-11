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

## OpenClaw PR 1: package and session snapshots

### Scope

- Add workspace package `packages/control-model`.
- Define host Gateway binding, immutable external-store contract, lifecycle,
  structured errors, and bounds configuration.
- Isolate bounded reconciliation and subscriber notification from the Gateway
  receive stack.
- Project connection state and session catalog.
- Reuse canonical protocol types without re-exporting the entire protocol.
- Add package documentation and browser-safe import checks.

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
- Package graph contains no framework, DOM component, or product import.

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
- Adapt existing MCP App and Canvas previews into explicit fallbacks.
- Add revision, expiry, bound, and structured failure behavior.
- Keep renderer registries outside the package.

### Proof

- Known and unknown template URIs.
- Multiple offered views with client-owned selection.
- Authorization-filtered discovery and selected-only materialization.
- Malformed/oversized data.
- Increasing, duplicate, stale, and conflicting revisions.
- History reload and reconnect.
- MCP App fallback and expiry.
- Proof that metadata cannot select an import or register a component.

### Deletion target

Tool-specific native rendering interpretation and duplicate Canvas/MCP
association logic.

## OpenClaw PR 4: Control UI reference adoption

### Scope

- Adapt the existing Control UI Gateway store to the package binding.
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

## Lobster/M PR 1: adapter into existing SessionView

### Scope

- Consume the workspace or fork package through Lobster's hosted Gateway seam.
- Map model snapshots into M's existing `SessionView`.
- Select the Lobster-compatible OpenClaw view projection without making that
  choice canonical for other clients.
- Keep a compatible user selection stable across reconnect and artifact
  revisions.
- Keep the renderer passive.
- Preserve current desktop and web service-port boundaries.
- Add a runtime flag and incumbent fallback.

### Proof

- Existing `SessionView` fixtures.
- Hosted auth and real Gateway.
- Session list, selection, one conversation, tool result, and approval.
- Mid-stream reconnect without duplication.

### Deletion target

The adopted web-specific Gateway fold/reducer path after parity.

## Lobster/M PR 2: first native UI artifact

### Scope

- Add a host-owned exact-URI renderer registry.
- Register one bounded first-party component, preferably a calendar golden
  scenario already represented by structured tool output.
- Add schema validation and named action binding.
- Pin registration and artifact data versions and emit safe action correlation.
- Preserve text and MCP App fallback.
- Request deferred data only after Lobster selects that view.

### Proof

- Valid, invalid, unknown, fallback, and expired artifacts.
- Fluent/M365 theme, accessibility, localization, and responsive behavior.
- Allowed and server-denied action.
- No dynamic import from artifact metadata.

### Deletion target

One bespoke tool-output parsing/rendering path.

## Lobster/M PR 3: streaming, actions, and operations

### Scope

- Apply complete artifact revisions during live tool execution.
- Add stale-revision action protection.
- Add telemetry for projection lag, renderer selection, validation failure,
  fallback, and action outcome.
- Prove reconnect and rollback.

### Proof

- Progressive pending/ready revisions.
- Duplicate/stale revision handling.
- Mid-stream disconnect/resync.
- Slow native renderer does not block Gateway processing.
- Product telemetry contains no raw sensitive artifact payload.

## OpenClaw PR 5: publication

### Preconditions

- Control UI and independent host are live on the same contract.
- Compatibility and package acceptance pass.
- Bounds and security review pass.
- At least one duplicate implementation is deleted.
- Named package, protocol, security, and release owners agree.

### Scope

- Publish `@openclaw/control-model`.
- Document supported versions and migration policy.
- Add framework-neutral quickstart and conformance fixtures.
- Keep optional framework adapters outside the core package unless separately
  justified.

## Deferred work

- Config/settings capability.
- Channels, skills, nodes, workboards, and admin surfaces.
- JSON Patch/JSONL artifact dialect.
- Model-visible component catalogs and generative dashboards.
- Third-party native component SDK.
- Stable framework-specific adapters.

Each deferred surface requires a separate owner-first slice and deletion case.
