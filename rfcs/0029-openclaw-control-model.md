---
title: OpenClaw Control Model
authors:
  - Gio Della-Libera
created: 2026-08-11
last_updated: 2026-08-11
status: draft
issue:
rfc_pr:
---

# Proposal: OpenClaw Control Model

## Summary

OpenClaw should provide a framework-neutral Control Model above
`@openclaw/gateway-client`. The model would expose immutable state snapshots,
typed commands, history/live reconciliation, and renderer-neutral UI artifacts
without depending on Lit, React, routes, or product presentation. OpenClaw's
Control UI and independently owned product shells could consume the same
behavior while retaining their own components, navigation, theming,
authentication, and rollout.

This document is a fork-only design preview. It does not request RFC intake,
open an upstream pull request, or claim maintainer acceptance.

## Motivation

OpenClaw already publishes a reference Gateway client. It owns protocol
handshake, authentication helpers, request correlation, timeouts, reconnect
primitives, sequence-gap detection, and event delivery.

OpenClaw's Control UI builds a richer application model above that client:
session catalogs, history/live reconciliation, connection epochs, chat stream
state, tool lifecycle, approvals, config state, and other capabilities. That
model is assembled inside the Lit application and is not a supported headless
consumer boundary.

An independently owned UI therefore has two unattractive choices:

1. host or fork OpenClaw's complete Control UI even when the product needs a
   different framework and experience; or
2. consume raw Gateway methods and events and independently reimplement the
   state machines already required by Control UI.

The first choice couples product presentation to OpenClaw's application. The
second creates semantic drift around reconnect, event ordering, history
reconciliation, tool outcomes, approvals, and compatibility.

Tool-provided UI has a related gap. OpenClaw can materialize Canvas documents
and MCP Apps, but the current projection selects those presentation paths
before another host can choose a trusted native renderer. First-party products
that need native components either add tool-specific interpretation or bypass
the existing projection.

The desired architecture is:

```text
OpenClaw Gateway
       |
@openclaw/gateway-client
       |
@openclaw/control-model
  snapshots / commands / UI artifacts
       |
       +-------------------------+
       |                         |
OpenClaw Control UI       Independent product shell
Lit presentation          React/native presentation
```

One OpenClaw-owned behavioral model can serve multiple presentations without
making OpenClaw own those products.

## Goals

- Publish a framework-neutral state and command boundary above the Gateway
  client.
- Keep Gateway protocol and server behavior authoritative.
- Provide stable immutable projections for connection, session catalog, and a
  selected conversation.
- Reconcile history, live events, reconnects, and tool lifecycle once.
- Return typed command failures without success-shaped fallbacks.
- Preserve renderer-neutral UI artifacts long enough for a host to select a
  native renderer, structured fallback, or sandboxed MCP App.
- Let OpenClaw Control UI become a reference adopter without changing its
  presentation.
- Support independently owned browser, desktop, mobile, terminal, and hosted
  shells without importing a UI framework.
- Make adoption incremental and tie each layer to conformance and deletion
  evidence.

## Non-Goals

- Replacing `@openclaw/gateway-client` or introducing another wire protocol.
- Standardizing routes, navigation, layout, CSS, theme, localization, or
  product design systems.
- Moving product-owned React, Lit, native, or terminal components into the
  Control Model.
- Publishing Control UI's complete internal `ApplicationContext` as-is.
- Defining browser credential storage, tenant authentication, runtime routing,
  or host deployment.
- Making UI visibility, disabled state, or command preflight authoritative.
- Loading executable React components or arbitrary JavaScript named by a tool
  result.
- Replacing MCP Apps as the sandboxed third-party executable-UI contract.
- Requiring JSON Render or any other renderer library.
- Adding a sidecar, service, or new process boundary. The Control Model is an
  in-process library over an existing Gateway client.
- Defining generic model-authored dashboards, arbitrary layout generation, or a
  public component marketplace in v1.
- Including config forms, settings navigation, channels, skills, workboards,
  or every existing Control UI capability in v1.

## Proposal

The normative candidate contracts and delivery gates are split into companion
documents:

- [Control Model v1 specification](0029/control-model-v1-spec.md)
- [UI artifact v1 specification](0029/ui-artifact-v1-spec.md)
- [Conformance and adoption plan](0029/conformance-and-adoption-plan.md)
- [Implementation and PR plan](0029/implementation-plan.md)

### Package boundary

Add `@openclaw/control-model` to the OpenClaw monorepo. The package is
framework-neutral and browser-safe. Its public module graph must not import
Lit, React, DOM components, route definitions, product authentication,
localization catalogs, CSS, or Control UI presentation helpers.

The package consumes a narrow host-supplied Gateway binding compatible with the
public Gateway client:

```ts
export interface ControlGateway {
  getSnapshot(): GatewayConnectionSnapshot;
  subscribe(listener: () => void): () => void;
  subscribeEvents(listener: (event: GatewayEvent) => void): () => void;
  request<T>(method: string, params?: unknown, options?: RequestOptions): Promise<T>;
}
```

The binding lets the package reuse OpenClaw's browser, Node, or hosted transport
without owning credential persistence, product routing, or socket creation.

The Control Model exposes immutable snapshots and typed commands:

```ts
export interface ControlModel {
  getSnapshot(): ControlSnapshot;
  subscribe(listener: () => void): () => void;
  conversation(sessionKey: string): ConversationModel;
  sessions: SessionCommands;
  dispose(): void;
}
```

Subscriptions are invalidation signals. Consumers read the current immutable
snapshot after notification. This works with framework adapters without
embedding framework hooks in the package.

### V1 capability boundary

V1 contains:

- connection phase, accepted protocol/session metadata, and structured errors;
- session catalog snapshots and refresh/reconciliation state;
- one or more lazily selected conversation models;
- canonical ordered messages;
- active run, stream, tool invocation, approval, and question state needed by
  conversation presentation;
- typed chat/session commands supported by the selected Gateway; and
- renderer-neutral UI artifacts associated with messages or tool invocations.

V1 excludes broader Control UI capabilities until each has a bounded,
framework-neutral contract and an independent consumer.

### Snapshot and event semantics

Snapshots are serializable except for explicitly documented command handles.
They use stable identifiers, finite retained state, and typed lifecycle states.
They do not expose mutable Control UI objects.

The package owns:

- the initial history snapshot;
- live event application;
- connection-epoch retirement;
- duplicate and stale event handling;
- explicit sequence-gap and partial-state presentation;
- reconnect resynchronization;
- tool invocation/result association;
- cancellation and terminal run reconciliation; and
- artifact association and revision ordering.

Raw Gateway events remain available from the Gateway client. They are not the
Control Model's stable UI contract.

### Command semantics

Commands express typed user intent. Candidate v1 commands include session
refresh, select, create, rename, archive/delete where authorized, chat send,
abort, retry where supported, answer, approve, and deny.

The model may expose command availability for presentation. The Gateway remains
authoritative. A command must return a typed result or throw a typed error. It
must not silently treat a rejected, stale, disconnected, or unsupported
operation as success.

Commands are connection- and session-aware. An operation captured under a
retired connection epoch must not execute against a replacement session unless
the command contract explicitly permits safe retry.

### Renderer-neutral UI artifacts

A UI artifact is data and identity, not executable presentation:

```ts
export interface UiArtifact {
  id: string;
  revision: number;
  templateUri: string;
  dataVersion: number;
  data: JsonValue;
  structuredContent?: JsonValue;
  state: "pending" | "ready" | "failed" | "expired";
  source: {
    sessionKey: string;
    messageId?: string;
    toolCallId?: string;
  };
  fallback?: McpAppArtifact | CanvasArtifact;
}
```

`templateUri` is opaque. It does not grant trust, select a JavaScript import,
or authorize an action. A host may map a locally registered URI to a native
component. It must schema-validate artifact data before rendering. If no native
renderer is registered, the host may show structured/text output or use an
explicit sandboxed fallback.

`dataVersion` selects a schema version within the host's exact local
registration. Registration and component code ship through the host's ordinary
reviewed supply chain; tool output cannot add, replace, or widen a registration.

V1 uses complete immutable revisions. It does not standardize JSON Patch,
JSONL, or a renderer-specific component tree. A later extension may introduce a
negotiated patch dialect after conformance evidence demonstrates a shared need.

### Security boundary

The Control Model is presentation support, not an authorization authority.

- Native renderers are registered and allowlisted by the host.
- Tool output cannot select an import path, module URL, or privileged action.
- Artifact data is untrusted input with finite size and depth.
- Artifact data and structured content remain separate from hidden model or
  credential state.
- Component actions call named host bindings that re-enter typed model commands.
- The Gateway independently authorizes every protected action.
- Native action audit and telemetry can correlate the renderer registration,
  artifact ID, revision, action name, session, and tool call without recording
  raw artifact data.
- MCP Apps and Canvas retain their sandbox, CSP, lifecycle, and capability
  boundaries.
- Unknown versions, malformed data, expired state, and stale revisions fail
  visibly and do not trigger executable fallback automatically.

### Ownership boundary

OpenClaw maintainers own:

- package contracts and implementation;
- Gateway-to-model normalization and reconciliation;
- stable state, command, error, and artifact semantics;
- compatibility fixtures and release versioning;
- Control UI reference adoption; and
- server-side authorization behavior.

Independent products own:

- product navigation, layout, components, design systems, accessibility, and
  localization;
- renderer registration and component schemas;
- registration provenance, code review, signing, and deployment through the
  product's ordinary component supply chain;
- product authentication, tenant routing, telemetry, deployment, and rollout;
- optional adapters into an existing product view model; and
- product-specific actions that call supported OpenClaw commands.

Tool and MCP server authors own structured domain results and UI resources.
They do not choose whether a host trusts a native renderer.

### Compatibility and release

The package follows the OpenClaw calendar release train and declares its
compatible Gateway protocol window. Additive fields must not break consumers.
Incompatible snapshot or command changes require a documented migration and a
major contract-version decision independent of the wire protocol number.

The package begins as a monorepo workspace package. Publication requires:

- adoption by OpenClaw Control UI;
- adoption by one independent host;
- exact shared conformance fixtures;
- package-acceptance and browser-safe module-graph checks;
- a declared support and compatibility policy; and
- evidence that one duplicate consumer implementation can be deleted.

Subscriber callbacks run outside the Gateway receive stack. Model ingestion,
normalization, notification, and retained queues must remain bounded; a slow or
throwing subscriber cannot be awaited by protocol event delivery.

### Delivery shape

The implementation is intentionally incremental:

1. package boundary plus connection and session-catalog snapshots;
2. selected-conversation projection and commands;
3. renderer-neutral artifact projection and existing MCP App/Canvas adapters;
4. OpenClaw Control UI adoption of one complete slice; and
5. publication after independent adoption and compatibility evidence.

No later layer is required to accept an earlier bounded layer.
Adding another capability after v1 requires an independent consumer, a bounded
contract, and a named duplicate implementation or inference path it can delete.

## Rationale

### Why not inject a model into Control UI

Control UI already has an internal capability graph, but its bootstrap,
application context, route ownership, and presentation lifecycle are
application internals. Making that graph injectable would still require an
independent host to load the Lit application and track private module changes.
The reusable boundary belongs below the application.

### Why not use the Gateway client directly

The Gateway client deliberately exposes protocol methods and events. It should
not absorb session catalogs, conversation snapshots, tool outcomes, and UI
artifacts. Those are a distinct state-and-command layer, and every UI otherwise
reimplements them.

### Why not publish Control UI's application context

The current context includes theme, navigation, overlays, browser settings,
native bridges, and capabilities whose state mixes domain and presentation
concerns. Publishing it wholesale would freeze application internals and make
framework-independent use difficult. V1 extracts only the proven independent
slice.

### Why immutable snapshots

Immutable snapshots work with React external stores, Lit controllers, native
bridges, tests, and non-UI consumers. They keep ordering and mutation inside
the owner package and avoid making raw event accumulation a renderer
responsibility.

### Why UI artifacts are not components

A renderer identifier plus validated data supports native first-party
presentation without letting untrusted tool output load code. It also preserves
MCP Apps as the executable third-party boundary and keeps renderer choice with
the host.

### Why not standardize JSON Render in v1

JSON Render is a useful adopter and comparator: it demonstrates schema-defined
catalogs, named actions, and streamed revisions. Making its component tree or
patch dialect normative would couple OpenClaw state reuse to one renderer
before two OpenClaw consumers prove the need. The v1 artifact contract can
carry validated JSON data that a host renders with JSON Render or another
library.

### Why OpenClaw owns the model

The model interprets OpenClaw protocol behavior and must change atomically with
Gateway and Control UI semantics. Product-owned copies would drift. Product
presentation remains outside OpenClaw, so upstream ownership does not absorb
independent UX.

## Unresolved questions

- Which exact session and chat commands form the smallest useful v1?
- Should the first package release be public or remain workspace-only until
  independent adoption lands?
- Which existing Control UI normalizers can move unchanged, and which require a
  clean implementation because they mix UI concerns?
- Does artifact streaming need complete revisions only, or does adoption
  evidence justify a negotiated patch dialect?
- Should generic MCP tool-result metadata be projected directly, or should the
  Gateway first publish a narrower sanitized artifact envelope?
- What finite size, depth, count, and retention defaults should v1 require?
- Which Control UI slice should become the first reference adopter?
- Which maintainers own package compatibility and security review if the
  package is published?
