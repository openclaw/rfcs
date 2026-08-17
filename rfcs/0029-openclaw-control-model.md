---
title: OpenClaw Control Model
authors:
  - Gio Della-Libera
created: 2026-08-11
last_updated: 2026-08-16
status: draft
issue:
rfc_pr: https://github.com/giodl73-repo/rfcs/pull/8
---

# Proposal: OpenClaw Control Model

## Summary

OpenClaw should provide a framework-neutral Control Model as optional
`@openclaw/gateway-client/model` subpaths above the existing browser transport.
The model would expose immutable state snapshots, typed commands, history/live
reconciliation, and renderer-neutral UI artifacts without depending on Lit,
React, routes, or product presentation. OpenClaw's Control UI and independently
owned product shells could consume the same behavior while retaining their own
components, navigation, theming, authentication, and rollout.

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

```mermaid
flowchart TB
  gateway["OpenClaw Gateway"]
  transport["@openclaw/gateway-client/browser<br/>transport, authentication, reconnect"]
  model["@openclaw/gateway-client/model<br/>sessions, conversations, commands, artifacts"]
  controlUi["OpenClaw Control UI<br/>Lit presentation"]
  product["Independent product shell<br/>React or native presentation"]

  gateway --> transport --> model
  model --> controlUi
  model --> product
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
- Preserve renderer-neutral UI artifacts and all applicable OpenClaw-provided
  view offers long enough for a host to select its preferred native renderer,
  product view model, structured fallback, or sandboxed MCP App.
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
- Replacing OpenClaw's existing dashboard/workboard model, registered widget
  providers, layout persistence, or `show_widget`/`dashboard` tool semantics.
- Defining generic model-authored layouts or a public component marketplace in
  v1. A dashboard-shaped artifact view is presentation, not the authoritative
  OpenClaw board model.
- Including config forms, settings navigation, channels, skills, workboards,
  or every existing Control UI capability in v1. Configuration requires a
  separate authority- and provenance-aware model.

## Proposal

The normative candidate contracts and delivery gates are split into companion
documents:

- [Control Model v1 specification](0029/control-model-v1-spec.md)
- [UI artifact v1 specification](0029/ui-artifact-v1-spec.md)
- [Conformance and adoption plan](0029/conformance-and-adoption-plan.md)
- [Implementation and PR plan](0029/implementation-plan.md)
- [Ownership and support plan](0029/ownership-and-support-plan.md)
- [Owner acceptance record](0029/owner-acceptance-record.md)

### Review scope

RFC acceptance would cover only the framework-neutral Control Model v1 and UI
artifact contracts defined here and in the two specifications. It would not
accept a Lobster product roadmap, a framework adapter, a generic dashboard
system, or writable configuration.

The Board Model and Config Model evidence below is non-normative. It tests the
same owner-first extraction pattern against adjacent OpenClaw domains, but each
surface keeps its own contract, release gate, and implementation review.

### Fork-only implementation evidence

The proposed boundary has twelve fork-only implementation and reference-adopter
drafts:

1. [OC1: Gateway Client model foundation](https://github.com/giodl73-repo/openclaw/pull/230)
2. [OC2: conversation model and commands](https://github.com/giodl73-repo/openclaw/pull/231)
3. [OC3: renderer-neutral UI artifacts](https://github.com/giodl73-repo/openclaw/pull/232)
4. [OC4: Control UI reference adoption](https://github.com/giodl73-repo/openclaw/pull/238)
5. [OC5: conformance and package-hardening slices](https://github.com/giodl73-repo/openclaw/pull/241)
6. [OC5: fixture-family continuation](https://github.com/giodl73-repo/openclaw/pull/244)
7. [OC5: steady-state performance and memory](https://github.com/giodl73-repo/openclaw/pull/245)
8. [OC5: wire-compatibility canary](https://github.com/giodl73-repo/openclaw/pull/246)
9. [OC5: lifecycle performance](https://github.com/giodl73-repo/openclaw/pull/247)
10. [OC5: security review and authority-epoch hardening](https://github.com/giodl73-repo/openclaw/pull/248)
11. [CU4: Control UI ordinary command adoption](https://github.com/giodl73-repo/openclaw/pull/242)
12. [CU5: Control UI interaction and artifact adoption](https://github.com/giodl73-repo/openclaw/pull/243)

These drafts are evidence for review, not an upstream submission or accepted
roadmap. OC5 now proves finite defaults, the representative fixture families,
clean packed-package Node/declaration/browser consumption, measured
steady-state and lifecycle performance, candidate/predecessor/main wire
compatibility, and full-stack security review with the confirmed finding
remediated. A final whole-series review then covered OC1-OC5 and CU4-CU5 with
independent GPT-5.6 Terra, Claude Opus 5, and Gemini 3.1 Pro Preview passes,
followed by a clean Codex branch review. Accepted lifecycle, observer
ownership, canonical-session alias, metadata-bound, history, roster, routing,
and question-state findings were fixed at core head `a158436f085` in PR #248
and Control UI head `0a8ad4188a6` in PR #243. Final focused proof passed 59
Gateway lifecycle/model tests, 61 integrated Control UI tests, 6 prompt tests,
and packed-package acceptance. Owner acceptance remains open under the
[ownership and support plan](0029/ownership-and-support-plan.md).

The independent Lobster evidence is also available as a temporary carry plus
six bounded adopter slices:

1. [L0: temporary Control Model carry](https://microsoft.ghe.com/bic/lobster/pull/8165)
2. [LM1: adapt canonical snapshots into `SessionView`](https://microsoft.ghe.com/giodl/lobster/pull/63)
3. [LM2: render one allowlisted native table artifact](https://microsoft.ghe.com/giodl/lobster/pull/64)
4. [LM3: route one native refresh action through the model](https://microsoft.ghe.com/giodl/lobster/pull/65)
5. [LM4: route ordinary sends through the model](https://microsoft.ghe.com/giodl/lobster/pull/66)
6. [LM5: route active-run aborts through the model](https://microsoft.ghe.com/giodl/lobster/pull/67)
7. [LM6: hydrate selected-session history through the model](https://microsoft.ghe.com/giodl/lobster/pull/68)

This series proves native React rendering, actions, send, abort, reconnect, and
history while deleting duplicate Lobster Gateway behavior. It intentionally
stops at LM6: remaining raw paths are host-owned operational/security or
compatibility lanes rather than equivalent Control Model behavior.

Two adjacent owner-first projections now have separate fork-only evidence:

- [Board Model fork proof](https://github.com/giodl73-repo/openclaw/pull/240)
  extracts the existing selected-session reconciliation into
  `@openclaw/gateway-client/model/board` from Control UI while preserving OpenClaw board,
  provider, ticket, grant, persistence, and sandbox authority. Control UI is
  the reference adopter. Release ancestry shows no stable tag contains the
  coordinated board stack. `v2026.8.1-beta.2` is the first tag containing the
  full implementation plus the later ownership and UI hardening; the extraction
  applies cleanly there with 55 focused tests and a Gateway Client build.
  [Lobster Board LB1](https://microsoft.ghe.com/giodl/lobster/pull/70)
  independently consumes a private carry through a main-process safe projection
  and renders one allowlisted native status widget plus inert unsupported
  fallbacks. Its Electron proof uses a mocked beta-generation board protocol;
  it is not release admission and does not make pinned LobsterClaw 2026.6.33
  board-capable.
- [Config Model LC1 fork proof](https://microsoft.ghe.com/giodl/lobster/pull/69)
  provides `@openclaw/gateway-client/model/config` read-only authored
  configuration snapshots and read-scoped schema lookup. Lobster LC1 consumes
  it through Electron-owned Gateway transport and renders one native read-only
  settings category without exposing raw config or write authority to React. A
  real Electron Gateway fixture now proves the populated native page, authored
  value boundary, and restart guidance.

### Proposed future OpenClaw PR sequence

No additional upstream PRs or branches are opened by this RFC update. The
remaining work is proposed here so maintainers can review the intended shape
before any implementation is prepared, and any drafts should remain fork-only
until RFC intake and owner approval.

Control UI adoption is also intentionally incremental. OC4 already proves the
first three slices; it does not yet make every Control UI command, interaction,
or artifact path model-backed.

| Slice | Scope | Status and gate |
| --- | --- | --- |
| CU1: runtime binding | Create one lazy Control Model runtime over the existing Control UI Gateway client and forward connection/event invalidations without changing Lit presentation. | Complete in OC4. |
| CU2: catalog and selection | Drive the active session roster and selected-session lookup from immutable catalog snapshots while retaining unsupported archived/all roster behavior. | Complete in OC4. |
| CU3: selected conversation projection | Drive selected-chat history, live subscription, reconnect, and retryable fallback from the lazy conversation handle. | Complete in OC4; the representative overlap/gap/retired-epoch fixtures are now shared in OC5. |
| CU4: ordinary conversation commands | Route the normal composer send and foreground active-run abort through typed conversation commands. Keep steer/inject, realtime talk, background tasks, no-run abort-all, and other operational callers raw until separately classified. | Complete in fork-only [OpenClaw PR #242](https://github.com/giodl73-repo/openclaw/pull/242), stacked on OC5. The adapter preserves session identity, attachment/reply/fencing inputs, reconnect-resume fallback, and structured command errors used by incumbent recovery. |
| CU5: interactions and artifacts | Project selected-session questions and current Canvas/MCP/structured fallbacks through conversation snapshots plus the existing Control UI adapters. Preserve global/operator approval lanes and sandbox ownership where they are not equivalent. | Complete in fork-only [OpenClaw PR #243](https://github.com/giodl73-repo/openclaw/pull/243), stacked on CU4. |
| CU6: observation and deletion | Run the model-backed path through an observation window, retain rollback, then delete only the superseded UI-local reducers, requests, and compatibility adapters named by the earlier slices. | Maps to OC7 and cannot precede OC6 publication, rollback proof, and an exact deletion ledger. |

Board and configuration adoption are not hidden CU slices. They remain the
separate Board Model and Config Model proposals because their authority,
persistence, and release contracts differ from conversation state.

| Candidate | Scope | Gate |
| --- | --- | --- |
| [OC5: shared conformance and package hardening](https://github.com/giodl73-repo/openclaw/pull/241) | Promote the proven fixture families into shared Gateway Client/Control UI conformance, finalize finite defaults, and prove package acceptance, steady-state and lifecycle performance, wire compatibility, and security through the stacked PRs #244-#248. | Fork-only technical evidence complete; OC6 remains blocked on explicit owner acceptance and a chosen support window. |
| OC6: supported model subpaths | Publish the optional model subpaths with compatibility window, migration policy, framework-neutral quickstart, release notes, support ownership, and install/import proof from the packed release artifact rather than a workspace checkout. Replace fork-only consumption only after a released package exists. | OC5 passes on the supported release, predecessor where promised, and `main`; the packed artifact passes clean browser and Node consumer checks; independent-host evidence remains valid. |
| OC7: incumbent-path cleanup | After an observation window and rollback proof, remove only the superseded Control UI reconciliation, standard command, interaction, artifact-adapter, and compatibility paths actually replaced by CU1-CU5. | OC6 is released, Control UI is stable on the model, and deletion evidence identifies each exact old path. |

Adjacent proposals remain separate from Control Model v1 acceptance:

| Candidate | Scope | Gate |
| --- | --- | --- |
| BM2: Board Model release admission | Reconstruct the Board Model extraction and native-host conformance against an accepted board-capable OpenClaw release, then decide whether `model/board` is supportable. | Stable board-capable tag, or explicit beta admission with complete persistence, grants, tickets, sandbox, and compatibility review. |
| CFG1: read-only Config Model | Extract framework-neutral authored config snapshots and read-scoped schema descriptors into an OpenClaw-owned optional model with Control UI reference adoption. | Config owner review, secret redaction, schema compatibility, and proof that read projection does not imply write authority. |
| CFG2: governed configuration commands | Add provenance, owner, lock reason, candidate preview, validation findings, generation, commit, and activation status only through Managed Configuration contracts. | Separate owner approval and transactional write/activation design; not implied by this RFC or CFG1. |

Cross-client user-message identity, generic generated layouts, framework
adapters, and third-party native component SDKs remain separate future
proposals rather than implied follow-up PRs.

### Module boundary

Add the framework-neutral, browser-safe Control Model as optional exports from
`@openclaw/gateway-client`: `model`, `model/catalog`, and
`model/session-event-refresh`. The model module graph must not import Lit,
React, DOM components, route definitions, product authentication, localization
catalogs, CSS, or Control UI presentation helpers.

The model consumes a narrow host-supplied Gateway binding compatible with the
public Gateway Client:

```ts
export interface ControlGateway {
  getSnapshot(): GatewayConnectionSnapshot;
  subscribe(listener: () => void): () => void;
  subscribeEvents(listener: (event: GatewayEvent) => void): () => void;
  request<T>(method: string, params?: unknown, options?: RequestOptions): Promise<T>;
}
```

The binding lets the model reuse OpenClaw's browser, Node, or hosted transport
without owning credential persistence, product routing, or socket creation.
It is a construction-time capability owned by the host and model
implementation. It is not exposed through snapshots, conversations, artifacts,
renderer registrations, or framework adapters, so consumers cannot use it to
bypass typed model commands.

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
embedding framework hooks in the model.

### V1 capability boundary

V1 contains:

- connection phase, accepted protocol/session metadata, and structured errors;
- session catalog snapshots and refresh/reconciliation state;
- one or more lazily selected conversation models;
- canonical ordered messages;
- active run, stream, tool invocation, approval, and question state needed by
  conversation presentation;
- typed conversation commands plus explicit catalog and history refresh; and
- renderer-neutral UI artifacts associated with messages or tool invocations.

V1 excludes broader Control UI capabilities until each has a bounded,
framework-neutral contract and an independent consumer.
Session create, rename, archive, delete, and other administration commands are
not required by v1 conformance. They remain host-owned or future optional model
capabilities until they have the same independent-adopter and deletion proof.

### Snapshot and event semantics

Snapshots are serializable except for explicitly documented command handles.
They use stable identifiers, finite retained state, and typed lifecycle states.
They do not expose mutable Control UI objects.

The model owns:

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
catalog refresh, conversation history refresh, chat send, active-run abort,
retry where the Gateway exposes a safe contract, answer, approve, deny, and
exact deferred-view materialization.

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
  structuredContent?: JsonValue;
  views: UiArtifactViewOffer[];
  state: "pending" | "ready" | "failed" | "expired";
  source: {
    sessionKey: string;
    messageId?: string;
    toolCallId?: string;
  };
  fallback?: McpAppArtifact | CanvasArtifact;
}

export interface UiArtifactViewOffer {
  id: string;
  templateUri: string;
  dataVersion: number;
  availability: "inline" | "deferred";
  data?: JsonValue;
  recommended?: boolean;
  fallback?: McpAppArtifact | CanvasArtifact;
}
```

OpenClaw core and installed extensions may offer zero or more views of the same
artifact, such as calendar, list, table, summary, or an MCP App. A view's
`templateUri` is opaque. It does not grant trust, select a JavaScript import,
or authorize an action. A host may map a locally registered URI to a native
component. It must schema-validate view data before rendering.

Each view's `dataVersion` selects a schema version within the host's exact local
registration. Registration and component code ship through the host's ordinary
reviewed supply chain; tool output cannot add, replace, or widen a registration.
OpenClaw may identify a recommended default, but the client remains free to
choose any compatible offered view or project the underlying structured content
into its own product view model. If no compatible renderer is registered, the
host may show structured/text output or use an explicitly sandboxed fallback.

OpenClaw exposes every authorized applicable descriptor, not every fully
materialized payload. A bounded view may be inline. An expensive or sensitive
view is deferred until the client selects it and requests materialization
through a typed, read-only Control Model command. Materialization remains
extension-owned and Gateway-authorized.

Presentation placement does not define artifact identity. A client may render
the same artifact revision inline in chat, in an expanded panel, or in a
dedicated artifact surface. Its stable `id` and monotonic `revision` let later
turns or tool runs update that logical artifact instead of emitting unrelated
cards. V1 durability means addressable, revisioned session state that survives
history reload and reconnect. It does not require permanent document storage,
cross-session retention, or a collaborative document protocol.

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

- Gateway Client model contracts and implementation;
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

### Extension and client capability split

Installed and enabled OpenClaw extensions determine which tools, structured
results, UI artifacts, and alternative view offers can be produced. The client
determines which artifact views and native renderers it has installed,
registered, and trusted, and which product view model should consume the
projection.

The Control Model does not generate UI capabilities independently of either
side. It normalizes the artifact emitted by the active extension, exposes the
current client-rendering decision, and preserves a safe fallback:

```mermaid
flowchart TB
  extension["Installed extension emits artifact and view offers"]
  model["Control Model normalizes identity, views, data, lifecycle, and fallback"]
  selection{"Client selects a compatible trusted view"}
  native["Local view-model projection<br/>and native renderer"]
  fallback["Structured or sandboxed<br/>MCP App fallback"]

  extension --> model --> selection
  selection -->|compatible registration| native
  selection -->|no compatible registration| fallback
```

Client capability advertisement may let an extension avoid producing an
unsupported optional artifact, but it is an optimization rather than an
authorization grant. Extensions should preserve useful structured or text
output when no native renderer is available. A client must not claim native
support unless an exact compatible local registration exists. OpenClaw owns
the available view offers and their semantics; Lobster or another host owns
which offer it selects and how it maps that projection into its own view model.

View discovery is filtered to the authenticated caller, selected session,
enabled extension surface, and current policy. It must not disclose hidden
extensions or unavailable tools. Client renderer advertisement is delivered to
the trusted Gateway and is not exposed verbatim to extensions by default.

### Compatibility and release

The Gateway Client model follows the OpenClaw calendar release train and
declares its compatible Gateway protocol window. Additive fields must not break
consumers. Incompatible snapshot or command changes require a documented
migration and a major contract-version decision independent of the wire
protocol number.

The model subpaths begin as fork-only exports. Publication requires:

- adoption by OpenClaw Control UI;
- adoption by one independent host;
- exact shared conformance fixtures;
- package-acceptance and browser-safe module-graph checks;
- a declared support and compatibility policy;
- explicit owner acceptance recorded with the
  [owner acceptance record](0029/owner-acceptance-record.md); and
- evidence that one duplicate consumer implementation can be deleted.

Subscriber callbacks run outside the Gateway receive stack. Model ingestion,
normalization, notification, and retained queues must remain bounded; a slow or
throwing subscriber cannot be awaited by protocol event delivery.

### Delivery shape

The implementation is intentionally incremental:

1. Gateway Client model boundary plus connection and session-catalog snapshots;
2. selected-conversation projection and commands;
3. renderer-neutral artifact projection and existing MCP App/Canvas adapters;
4. OpenClaw Control UI adoption of one complete slice; and
5. independent Lobster adoption through `SessionView`, including native
   artifact, action, send, abort, and history deletion evidence;
6. package publication and support ownership after compatibility, security,
   and package-acceptance gates; and
7. product rollout with live hosted-Gateway proof, flags, rollback, telemetry,
   accessibility, localization, and shareable demo evidence.

No later layer is required to accept an earlier bounded layer.
Adding another capability after v1 requires an independent consumer, a bounded
contract, and a named duplicate implementation or inference path it can delete.

Existing OpenClaw dashboards and settings follow separate adoption paths.
Lobster can host version-matched dashboard and settings routes immediately.
The Board Model proof now demonstrates the optional projection of OpenClaw's
existing board model and a bounded Lobster native adopter, but only with a
mocked beta-generation protocol. No stable OpenClaw tag currently contains the
coordinated board stack; `v2026.8.1-beta.2` is the first fully compatible tag
and passes the extraction proof. The adopter does not change the pinned
2026.6.33 support boundary. The Config Model and LC1 proof demonstrate a native
read-only settings surface over authored values and schema descriptors,
including a real Electron screenshot. Governed writes still require provenance,
authority, validation, candidate diffs, generation, and transactional
activation from Managed Configuration. Neither adjacent model belongs in the
conversation snapshot or expands Control Model v1.

## Rationale

### Why not inject a model into Control UI

Control UI already has an internal capability graph, but its bootstrap,
application context, route ownership, and presentation lifecycle are
application internals. Making that graph injectable would still require an
independent host to load the Lit application and track private module changes.
The reusable boundary belongs below the application.

### Why not use the Gateway Client browser transport directly

The browser transport deliberately exposes protocol methods and events. Session
catalogs, conversation snapshots, tool outcomes, and UI artifacts remain a
distinct optional state-and-command layer under `gateway-client/model`; every UI
otherwise reimplements them.

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

- Do maintainers accept the optional Gateway Client model subpaths as the
  correct owner boundary for OC6 publication?
- Do the nominated package, protocol, Control UI, security, release, and RFC
  owners accept the responsibilities, deputies, and escalation paths in the
  [ownership and support plan](0029/ownership-and-support-plan.md)?
- Which release vehicle and version window should carry the first supported
  model subpaths?
- What observation window and rollback evidence must pass before OC7 can
  delete incumbent Control UI paths?
- Should Board Model and Config Model proceed as the separate BM2/CFG1 proposals
  above, or remain fork-only evidence until a later RFC?
- If cross-client user-message delivery becomes required, what identity
  contract aligns host `clientMessageId`, model idempotency, retry/reconnect,
  persisted history, and renderer deduplication?
