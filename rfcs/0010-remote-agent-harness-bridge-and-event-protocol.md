---
title: Remote Agent Harness Bridge and Event Protocol
authors:
  - Omar Shahine
  - Eduardo Piva
created: 2026-07-06
last_updated: 2026-07-06
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/31
---

# Proposal: Remote Agent Harness Bridge and Event Protocol

## Summary

Define a transport-neutral protocol and lifecycle contract for running selected
AgentHarness attempts outside the OpenClaw Gateway process while preserving the
observable behavior of a local AgentHarness: lifecycle, assistant output,
reasoning, plans, tools, approvals, command output, patch summaries, compaction,
transcripts, cancellation, and terminal results.

## Motivation

OpenClaw can route provider/model turns through native AgentHarness plugins such
as Codex and Copilot. Those harnesses do more than return final assistant text.
They stream assistant deltas, reasoning snapshots, plans, tool lifecycle,
command output, patch summaries, compaction state, approvals, permission
requests, user-input prompts, usage snapshots, lifecycle state, and
harness-specific diagnostics into OpenClaw surfaces.

A remote harness that transports only a prompt, assistant text, and terminal
result is not equivalent to a local harness. It can render text while silently
losing the events that the Gateway uses for WebChat, CLI/TUI status, Control UI,
transcripts, task mirrors, replay-safety decisions, approval resolution, and
lifecycle persistence.

The missing upstream contract also blocks portable contributions. Hosts that run
agents in containers, warm pools, separate processes, or provider-specific
sandboxes must currently invent partial mappings. That creates compatibility and
security risks:

- plans, reasoning, tool progress, command output, patch summaries, and
  compaction events may disappear;
- approval, permission, and user-input requests may bypass OpenClaw policy or
  become unreviewable;
- local and remote runs may disagree about transcript, replay-safety, or
  terminal lifecycle state;
- container hosts may accidentally treat request headers or route metadata as
  identity authority;
- third-party remote harness hosts have no shared conformance target.

This RFC standardizes the remote bridge as an AgentHarness protocol boundary. It
keeps OpenClaw responsible for session orchestration, user-visible event
semantics, approval decisions, and terminal persistence while allowing the
selected native harness to execute in a separate host-managed process or
container.

## Goals

- Define the actors, workflow, and lifecycle for a remote AgentHarness bridge.
- Preserve local-vs-remote behavioral equivalence for OpenClaw's observable
  AgentHarness event surface.
- Keep runtime selection explicit and fail-closed: when a model/provider selects
  the remote harness, the attempt either runs remotely or fails visibly.
- Keep the protocol transport-neutral: stdio, WebSocket, TCP, Unix socket, and
  host-adapter paths are routing choices, not semantic differences.
- Keep identity authority host-owned and explicit. `RunStart` stream context,
  not headers, hostnames, URL paths, or arbitrary transport metadata, is
  authoritative for run/session/workspace identity.
- Keep OpenClaw-owned decisions in OpenClaw: approvals, permissions, dynamic
  tools, memory-write decisions, and user-input prompts are requested by the
  remote host and resolved by the Gateway through normal policy/UI routes.
- Avoid provider/model/caller credentials in OpenClaw-visible remote-harness
  configuration or default remote-agent container projection.
- Define a conformance target for future upstream remote-harness and
  container-runtime contributions.

## Non-Goals

- This RFC does not make remote harness the default OpenClaw runtime.
- This RFC does not define a cloud worker pool, deployment system, Azure/Plex/EV2
  integration, ECS/rollout policy, or production audience gate.
- This RFC does not standardize connector auth, service discovery, certificates,
  retries, or connection pooling; those can be owned by the host-side runtime
  container or platform.
- This RFC does not distribute provider, model, Graph, M365, GitHub, or other
  caller credentials to remote agent containers.
- This RFC does not define a general-purpose remote filesystem, shell, or tool
  execution API outside the AgentHarness event/request contract.
- This RFC does not change OpenClaw approval, permission, tool, memory, or
  context-engine policy. It transports requests and decisions across the remote
  boundary.
- This RFC does not require every harness to emit every event class. It requires
  a bridge to preserve the event classes that the selected native harness
  observes or produces and to fail closed for unsupported core frames.

## Proposal

Add a bundled `remote-harness` AgentHarness plugin and a public remote harness
protocol reference. The plugin is selected through existing provider/model
runtime policy and connects the Gateway to a host-side runtime that executes an
allowlisted inner harness.

The RFC body defines the interoperability contract and the normative protocol
schema tables. Supporting validation matrices and golden transcript sketches live
in the sidecar protocol reference:
[`0010/protocol-v1-reference.md`](0010/protocol-v1-reference.md).

### Actors and responsibility boundary

| Actor | Responsibility |
| --- | --- |
| OpenClaw Gateway | Selects the AgentHarness, owns session orchestration, applies policy decisions, persists lifecycle/transcript state, and emits user-visible events. |
| Gateway-side remote harness | Implements the local AgentHarness interface, opens the configured transport, validates protocol ordering, maps remote frames to OpenClaw callbacks/events, and maps terminal frames to `AgentHarnessAttemptResult`. |
| Transport | Carries ordered JSON-serializable frames. It is a route, not identity authority. |
| Host-side runtime | Validates `RunStart`, selects an allowlisted inner harness, runs it, streams observed events back to the Gateway, and asks the Gateway for OpenClaw-owned decisions. |
| Inner harness | Codex, Copilot, Pi, command-style reference harness, or another native harness running in the host runtime. |
| Container/platform layer | Optional deployment boundary that owns hostnames, DNS, sidecars, service mesh, certs, connector objects, routing policy, and connection management. |

The upstream protocol standardizes the Gateway-to-host contract. It does not
standardize how a host deploys, scales, warms, authenticates, or connects its
runtime containers.

### End-to-end remote harness workflow

A conforming remote run follows this workflow:

1. **Runtime selection.** Existing model/provider runtime policy selects
   `remote-harness`. Selection is explicit; `auto` may keep existing local
   behavior.
2. **Fail-closed readiness check.** The Gateway verifies the remote-harness
   plugin, configuration, transport, and allowlisted inner harness are available.
   If any required piece is missing, the attempt fails instead of falling back to
   local model execution.
3. **Transport open.** The Gateway-side harness opens stdio, WebSocket, TCP,
   Unix socket, or a host-adapter endpoint. Transport auth and connection
   management remain outside the OpenClaw-visible config.
4. **Run start.** The Gateway sends `RunStart` as the first accepted frame. It
   carries the stream identity, selected inner harness id, model/provider facts,
   session/workspace context, tool policy hints, streaming mode, and limits. It
   does not carry broad provider or caller credentials.
5. **Run accepted.** The host validates immutable identity, selects the inner
   harness, and sends `RunAccepted` before non-terminal event frames.
6. **Event streaming.** The host streams assistant, reasoning, plan, tool,
   command, patch, approval, item, compaction, usage, lifecycle, and diagnostic
   events as they occur. The Gateway maps them to normal OpenClaw callbacks and
   event streams.
7. **Gateway-owned decisions.** When the host needs approval, permission,
   user-input, dynamic-tool, or memory-write decisions, it sends a request frame.
   The Gateway applies normal OpenClaw policy/UI routing and returns an explicit
   decision. If no safe route exists, the decision is denied or unavailable; the
   host must not proceed implicitly.
8. **Cancellation and compaction.** Gateway cancellation, heartbeat, reset, or
   compaction-control frames are correlated to the same immutable stream
   identity. Post-terminal duplicates may be ignored only after identity
   validation.
9. **Terminal result.** The host sends exactly one terminal frame: final, failed,
   or cancelled. The Gateway records terminal lifecycle state and returns the
   corresponding AgentHarness attempt result.
10. **Persistence and cleanup.** The Gateway persists transcripts/lifecycle
    through the same local AgentHarness mechanisms. The host/container runtime
    releases remote resources according to host policy.

### Runtime selection and configuration requirements

The bridge is registered as an AgentHarness and selected through existing
provider/model runtime configuration. The runtime id is `remote-harness`.

Normative selection requirements:

- model-scoped runtime policy wins over provider-scoped runtime policy;
- whole-session or whole-agent runtime pins remain out of scope;
- explicit `remote-harness` selection fails closed when the plugin is missing,
  unsupported, disabled, unconfigured, or unable to reach a required host;
- local fallback is allowed only through existing `auto` selection behavior, not
  after an explicit remote-harness selection.

Configuration requirements:

| Area | Requirement |
| --- | --- |
| fallback | Remote selection is fail-closed and must not silently use a local runtime. |
| inner harnesses | At least one inner harness id is allowlisted; the default inner harness must be allowlisted. |
| transports | v1 allows stdio, WebSocket, TCP, Unix socket, and host-adapter routing paths. |
| connector | `connector` is not a v1 OpenClaw transport kind. Container/platform networking can provide connector-like reachability outside the spec. |
| credentials | OpenClaw-visible config must not contain broad bearer, provider, model, caller, Graph/M365, GitHub, or session credentials. |
| egress | If a host configures egress proxy enforcement, startup fails unless that enforcement is actually wired by the host/platform. |
| unknown fields | Unknown top-level config fields are rejected to avoid silent policy drift. |

### Protocol lifecycle and invariants

Every frame belongs to one stream and carries immutable stream identity. The v1
envelope schema is:

| Field | Required | Type | Semantics |
| --- | --- | --- | --- |
| `protocolVersion` | yes | `1` | Protocol version for this frame. |
| `streamId` | yes | string | Opaque id for this remote stream. |
| `runId` | yes | string | OpenClaw run id for the attempt. |
| `sessionKey` | yes | string | OpenClaw session key for the attempt. |
| `workspaceId` | yes | string | Opaque workspace identity for this stream. |
| `seq` | yes | positive integer | Monotonic sequence number within one direction. |
| `kind` | yes | string | Exact frame kind token from the schema tables below, or an admitted extension frame kind. |

A core frame is encoded as one JSON object: the envelope fields and that frame's
payload fields are siblings at the top level. `AgentEvent` is the exception for
stream-specific payloads: it carries the canonical or namespaced stream name in
`stream` and nests stream-specific fields under `data`.

The RFC-level invariants are:

- `RunStart` is the first accepted Gateway-to-host frame.
- `RunAccepted` precedes all non-terminal host-to-Gateway event frames.
- Protocol version, stream id, run id, session key, and workspace id are
  immutable for a stream.
- Sequence numbers are strictly increasing per direction.
- Request and response frames correlate by `requestId`; they do not correlate by
  `seq`, because each direction has its own sequence counter.
- Unknown core frame kinds fail closed in v1.
- Unknown extension event streams are rejected unless allowlisted by policy.
- Malformed frames close or reject the stream without crashing host loops.
- Exactly one terminal frame ends the stream.
- Post-terminal stale or duplicate frames can be ignored only after immutable
  identity is validated.

### Frame families and required semantics

The protocol has a small set of frame families. The schema tables in this RFC
are normative. The sidecar reference provides validation examples and golden
transcripts.

| Direction | Frame family | Purpose | Required handling |
| --- | --- | --- | --- |
| Gateway → Host | Run control | start, cancel, heartbeat, reset, compaction-control | Host validates stream identity and applies only to the current run. |
| Gateway → Host | Decisions | approval, permission, user input, dynamic tool, memory write | Host correlates by request id and must fail closed on unavailable or denied decisions. |
| Gateway → Host | Optional model proxy response | model chunk/final/error, if a separate host-egress design enables it | v1 implementations may reject model-proxy requests unless explicitly supported. |
| Host → Gateway | Run acknowledgement | selected inner harness and version | Must occur before non-terminal events. |
| Host → Gateway | Observable events | assistant, reasoning, lifecycle, item, plan, tool, command output, patch, compaction, approval, usage, diagnostic streams | Gateway maps them to normal OpenClaw callbacks and event streams. |
| Host → Gateway | Decision requests | approval, permission, user input, dynamic tool, memory write | Gateway owns policy and returns explicit decision frames. |
| Host → Gateway | Artifacts and checkpoints | host-produced artifacts and recoverable state | Gateway may persist or surface according to existing policy. |
| Host → Gateway | Terminal outcome | final, failed, cancelled | Gateway records lifecycle, transcript, replay-safety, and attempt result. |

### Event preservation contract

Remote/local equivalence means that a user-visible or lifecycle-relevant event
produced by the selected inner harness must reach the same OpenClaw surface that
a local harness would have reached, unless the bridge explicitly rejects the
unsupported event before execution.

The bridge must preserve these canonical event classes:

| Event class | Required semantics |
| --- | --- |
| lifecycle | start, finishing, end, error, timeout, abort, user-message persistence, assistant-error persistence, provider-started, liveness, replay-invalid, and terminal metadata when known. |
| assistant | incremental assistant text, cumulative text snapshots, replacement snapshots for provisional/native items, final visible text, and usage when known. |
| thinking/reasoning | reasoning deltas or snapshots, section boundaries when known, media references when supported, and explicit reasoning-end flushes. |
| plan | plan updates, plan-mode request/completion, explanation, steps, actions, selected action, feedback, and approval state when known. |
| tool | tool start/update/result, sanitized args/results, tool call id, tool name, error state, metadata, and private tool-result diagnostics needed for replay safety. |
| item/activity | normalized activity-feed entries with id, phase, kind, title, status, progress, timestamps, summaries, and approval ids when available. |
| approval | command/plugin/permission/unknown approval requested/resolved state, pending/unavailable/approved/denied/failed state, and user-visible message. |
| command output | stdout/stderr deltas, terminal output, status, exit code, duration, and cwd when known. |
| patch | patch begin/update/end or summary, including added/modified/deleted files and summary text. |
| compaction | compaction start/end, completed/aborted state, retry state, backend/item/thread/turn ids when known. |
| diagnostics | non-terminal stream/provider/harness errors that should be visible to diagnostics without replacing terminal failure semantics. |
| extension streams | namespaced harness-specific streams, such as Codex app-server diagnostics, only when the namespace or stream is allowed by Gateway policy. |

`AgentEvent` uses this canonical stream vocabulary:

| Stream identifier | Event class | Closed phase/status vocabulary when present |
| --- | --- | --- |
| `lifecycle` | lifecycle | `phase`: `start`, `finishing`, `end`, `error`, `timeout_armed`, `timeout`, `aborted`, `user_message_persisted`, `assistant_error_persisted` |
| `assistant` | assistant | no required phase; payload uses text/delta/replacement fields when present |
| `thinking` | thinking/reasoning | no required phase; payload uses text/delta/snapshot fields when present |
| `tool` | tool | `phase`: `start`, `update`, `result` |
| `item` | item/activity | `phase`: `start`, `update`, `end`; `status`: `running`, `completed`, `failed`, `blocked` |
| `plan` | plan | `phase`: `update` |
| `approval` | approval | `phase`: `requested`, `resolved`; `status`: `pending`, `unavailable`, `approved`, `denied`, `failed`; `kind`: `exec`, `plugin`, `permission`, `unknown` |
| `command_output` | command output | `phase`: `delta`, `end` |
| `patch` | patch | `phase`: `end` |
| `compaction` | compaction | `phase`: `start`, `end`; optional `completed` and `willRetry` booleans |
| `error` | diagnostics | no required phase; payload includes sanitized error data |
| namespaced streams | extension streams | governed by the admitted namespace or stream contract |

A bridge may use both typed common frames and a generic event frame. Typed frames
make common behavior easy to implement correctly. The generic event frame
preserves existing OpenClaw streams and harness-specific extension streams.

### Protocol schema summary

All frames include the envelope fields above. The tables below list each core
frame's payload schema. Receivers reject missing required fields and reject
unknown core frame kinds in v1.

#### Gateway-to-host frame schemas

| Frame kind | Required payload fields | Optional payload fields | Semantics |
| --- | --- | --- | --- |
| `RunStart` | `innerHarnessId`, `input`, `context` | none | Starts the stream and supplies selected harness, prompt/input, and host-authoritative run context. |
| `CancelRun` | none | `reason` | Requests cancellation for the current stream. |
| `Heartbeat` | none | `sentAt` | Liveness signal. |
| `ResetSession` | none | `reason` | Requests host-side session reset for the current stream. |
| `CompactSession` | none | `reason` | Requests host-side compaction for the current stream. |
| `ApprovalDecision` | `requestId`, `approved` | `reason`, `scope` | Resolves a host approval request. |
| `ToolAuthorizationDecision` | `requestId`, `approved` | `reason` | Resolves a host tool-authorization request. |
| `MemoryWriteDecision` | `requestId`, `approved` | `reason` | Resolves a host memory-write request. |
| `PermissionDecision` | `requestId`, `permissions`, `scope` | `strictAutoReview` | Resolves a host permission request. |
| `UserInputResponse` | `requestId`, `answers` | none | Resolves a host user-input request. |
| `DynamicToolResponse` | `requestId`, `contentItems`, `success` | none | Returns a Gateway-executed dynamic-tool result. |
| `ModelProxyChunk` | `requestId`, `delta` | none | Reserved model-proxy response chunk when model proxying is enabled. |
| `ModelProxyFinal` | `requestId`, `output` | `usage` | Reserved model-proxy final response when model proxying is enabled. |
| `ModelProxyError` | `requestId`, `error` | none | Reserved model-proxy error response when model proxying is enabled. |

`RunStart.context` is a structured object with these v1 fields:

| Field | Required | Type | Semantics |
| --- | --- | --- | --- |
| `schemaVersion` | yes | `1` | Context schema version. |
| `sessionId` | yes | string | OpenClaw runtime session id. |
| `provider` | yes | string | Resolved provider id. |
| `modelId` | yes | string | Resolved model id. |
| `agentId` | no | string | Agent id when known. |
| `sessionFile` | no | string | Legacy/session artifact hint when still available. |
| `sandboxSessionKey` | no | string | Sandbox-specific session key when different from the visible session key. |
| `workspaceDir` | no | string | Host-visible workspace path when the deployment exposes one. |
| `cwd` | no | string | Working directory for command-style harnesses. |
| `requestedModelId` | no | string or null | Model originally requested before resolution. |
| `runtimePlan` | no | JSON value | Host-curated runtime plan/debug metadata. |
| `trigger` | no | enum | Run trigger such as user, cron, heartbeat, memory, manual, overflow. |
| `message` | no | object | Messaging/channel metadata such as channel, provider, recipient, thread, sender, group, and role ids. |
| `toolPolicy` | no | object | Tool allow/disable/targeting hints. |
| `streaming` | no | object | Block-reply and live-streaming hints. |
| `limits` | no | object | Timeout and context-token-budget hints. |

#### Host-to-Gateway frame schemas

| Frame kind | Required payload fields | Optional payload fields | Semantics |
| --- | --- | --- | --- |
| `RunAccepted` | `selectedInnerHarnessId`, `selectedInnerHarnessVersion` | none | Acknowledges selected inner harness before non-terminal events. |
| `AssistantMessageStart` | none | `itemId` | Marks the beginning of an assistant item. |
| `AssistantDelta` | `delta` | `text`, `replace`, `replaceable`, `usage` | Streams assistant text or replacement snapshots. |
| `VisibleReply` | none | `text`, `mediaUrls`, `audioAsVoice`, `trustedLocalMedia`, `sourceReply`, `final` | Delivers block-reply payloads. |
| `ReasoningDelta` | none | `text`, `delta`, `mediaUrls`, `isReasoningSnapshot` | Streams reasoning or thinking snapshots/deltas. |
| `ReasoningEnd` | none | none | Closes a reasoning block. |
| `ToolStarted` | `toolCallId`, `name` | `args`, `meta`, `startedAt` | Starts a tool item. |
| `ToolProgress` | `toolCallId` | `name`, `message`, `partialResult`, `progressText` | Updates tool progress. |
| `ToolFinished` | `toolCallId`, `name`, `result`, `isError` | `meta`, `endedAt` | Completes a tool item. |
| `ToolStreamBoundary` | none | `toolCallId` | Marks a stream boundary after tool output. |
| `AgentToolResult` | `toolName`, `result`, `isError` | none | Reports private/sanitized tool result diagnostics. |
| `AgentEvent` | `stream`, `data` | `sessionKey`, `agentId` | Carries canonical or allowlisted namespaced OpenClaw event streams. |
| `ExecutionStarted` | none | `lifecycleGeneration` | Reports native execution start. |
| `ExecutionPhase` | `phase` | `provider`, `model`, `backend`, `source`, `tool`, `toolCallId`, `itemId`, `firstModelCallStarted` | Reports execution milestones. |
| `RunProgress` | `reason` | `provider`, `model`, `backend` | Reports provider/model/backend progress. |
| `LaneWait` | `waitMs`, `queuedAhead` | `waiting` | Reports queue wait state. |
| `SessionIdChanged` | `sessionId` | none | Reports native session id changes. |
| `UsageUpdate` | `usage` | `source` | Reports provider/model/harness usage. |
| `ApprovalRequested` | `requestId`, `prompt` | `details` | Requests Gateway approval. |
| `ToolAuthorizationRequested` | `requestId`, `toolName` | `details` | Requests Gateway tool authorization. |
| `MemoryWriteRequested` | `requestId`, `proposedMemory` | none | Requests Gateway memory-write decision. |
| `PermissionRequested` | `requestId`, `permissions` | `reason`, `cwd`, `environmentId` | Requests Gateway permission decision. |
| `UserInputRequested` | `requestId`, `questions` | `autoResolutionMs` | Requests Gateway-mediated user input. |
| `DynamicToolCallRequested` | `requestId`, `tool`, `arguments` | `namespace` | Requests Gateway dynamic-tool execution. |
| `ModelProxyRequest` | `requestId`, `model`, `payload` | none | Reserved model-proxy request when model proxying is enabled. |
| `Checkpoint` | `checkpointId`, `state` | none | Reports recoverable host state. |
| `ArtifactProduced` | `artifactId`, `uri` | `metadata` | Reports host-produced artifact. |
| `RunFinal` | `result` | `assistantTexts`, `usage`, `replayMetadata`, `itemLifecycle` | Completes the run successfully. |
| `RunFailed` | `error` | `replaySafe` | Completes the run with failure. |
| `RunCancelled` | none | `reason`, `timedOut`, `timeoutPhase` | Completes the run as cancelled or timed out. |

#### Shared payload object schemas

| Object | Shape and rules |
| --- | --- |
| `requestId` | Non-empty string generated by the requester and unique among in-flight requests within the stream. Decision/response frames must echo it exactly. |
| `scope` | Closed enum: `turn` or `session`. |
| `input` | JSON-serializable value supplied by the Gateway to the selected inner harness. It is opaque to the transport protocol and is not identity authority. Implementations must not put broad provider/caller credentials in it. |
| `usage` | JSON object with optional non-negative integer fields `inputTokens`, `outputTokens`, `totalTokens`, `reasoningTokens`, `cacheReadTokens`, and `cacheWriteTokens`, plus optional `provider` and `model` strings. Unknown provider-specific usage fields may appear only under a namespaced object key. |
| `error` | JSON object with required `code` and `message`; optional `details` is a JSON object. `message` is sanitized user/diagnostic text and must not contain raw credentials, token prefixes, stack traces, or unbounded provider payloads. |
| `result` | JSON object. Interoperable terminal data belongs in sibling fields such as `assistantTexts`, `usage`, `replayMetadata`, and `itemLifecycle`; `result` may carry inner-harness-specific output or `{ "status": "completed" }` when no extra output is needed. |
| `questions` | Array of user-input questions. Each question has required `id`, `header`, and `question`, plus optional `isOther`, `isSecret`, and option labels/descriptions. |
| `permissions` | JSON object interpreted by Gateway permission policy. Empty object means no additional permission is granted. |

`error.code` uses this v1 closed set unless a namespaced extension code is
explicitly admitted by policy:

| Code | Meaning |
| --- | --- |
| `protocol_violation` | The remote protocol was malformed or ordered incorrectly. |
| `remote_unavailable` | The host runtime or transport was unavailable. |
| `inner_harness_unavailable` | The selected inner harness was unavailable or not allowlisted. |
| `approval_denied` | Gateway approval policy denied or could not route the approval request. |
| `permission_denied` | Gateway permission policy denied or could not route the permission request. |
| `user_input_unavailable` | Required user input could not be collected safely. |
| `dynamic_tool_failed` | Gateway dynamic-tool execution failed or was denied. |
| `cancelled` | The run was cancelled. |
| `timeout` | The run timed out. |
| `provider_error` | The selected inner harness reported a sanitized provider/runtime failure. |
| `unknown` | A sanitized failure that does not fit another v1 code. |

`AgentEvent.stream` admits the canonical streams listed in the event preservation
contract plus allowlisted namespaced extension streams. `AgentEvent.data` is a
JSON object whose fields are interpreted according to the named stream. When a
host emits both a typed frame and a matching `AgentEvent`, the Gateway correlates
by stable ids such as `toolCallId`, `itemId`, `requestId`, and the frame
envelope.

### Host-initiated requests and Gateway-owned decisions

Remote native harnesses sometimes need decisions or actions that OpenClaw owns.
They must request them from the Gateway instead of acting independently.

| Host request | Gateway-owned decision | Required fail-closed behavior |
| --- | --- | --- |
| approval | command/plugin approval policy, UI routing, reviewer state | If no approval route exists, return denied/unavailable. |
| permission | filesystem/network/environment permission policy and grant scope | If the policy cannot be evaluated, deny or return unavailable. |
| user input | prompt presentation, secret handling, auto-resolution, response persistence | If the user route is unavailable, return explicit empty/denied/unavailable result according to policy. |
| dynamic tool | tool lookup, argument validation, execution, result redaction | Unknown or denied tools fail closed; host must not synthesize success. |
| memory write | memory policy, storage target, review state | Denied/unavailable means no memory write. |
| optional model proxy | provider/model credential use and response streaming | Out of core v1 unless a host enables a separate model-egress contract. |

This preserves Codex-style request-permissions, request-user-input, and dynamic
tool calls without putting OpenClaw policy into the remote container.

### Terminal result, replay safety, and persistence

The terminal frame maps to the local `AgentHarnessAttemptResult` and lifecycle
persistence. A conforming host must provide the terminal information it knows:

- final assistant text or structured result;
- provider/model usage snapshots;
- replay-safety metadata and whether side effects may have occurred;
- item lifecycle counts or active-item state when available;
- stop reason, timeout phase, cancellation reason, yielded state, and provider
  started state when known;
- sanitized failure code/message for failed runs.

The Gateway, not the host, owns final persistence semantics. It uses the normal
AgentHarness result, assistant callbacks, user/error message persistence
callbacks, and `AgentEvent` streams to update transcripts and lifecycle state.
v1 does not add a remote-only transcript side channel.

### Transport authority, identity, and credentials

The transport is a routing mechanism, not authority.

The remote agent must not treat hostnames, URL paths, headers, or arbitrary
request metadata as proof of user, session, workspace, or run identity.
`RunStart` stream context is authoritative.

The upstream plugin must not require bearer tokens or broad credentials in
OpenClaw-visible configuration. If a host needs authenticated routing, it can
provide authority outside this spec through:

- process-local sockets;
- reverse-proxy admission;
- container-provided DNS names, sidecars, service-mesh routes, or hostnames that
  are reachable only from the host-side runtime container;
- host-managed connector objects, if a deployment provides them outside this
  spec;
- short-lived substream metadata produced by the host runtime;
- container-runtime capability state consulted by a host adapter.

The remote-harness protocol does not standardize connector auth, connection
pooling, service discovery, retries, certificate handling, or credential
projection. Deployments such as Lobster can solve those concerns in the
container or host platform and expose only a reachable endpoint to the bridge.

### Container-runtime contribution boundary

This RFC deliberately separates upstreamable bridge contracts from host-specific
container orchestration:

| Surface | Upstream contract | Host/container responsibility |
| --- | --- | --- |
| Remote AgentHarness plugin and lifecycle | yes | no |
| v1 protocol frame families, invariants, and validation | yes | no |
| Host runtime and inner-harness registry semantics | yes | host chooses implementation |
| Reference command harness/container | optional upstream reference | host may replace |
| Event conformance suite | yes | host must pass |
| Container allocator interface | future RFC or implementation issue | provider-specific allocator |
| Worker pool, deployment, EV2/Azure/Plex/ECS wiring | no | yes |
| Container DNS, hostnames, sidecars, service mesh, certificates, and connection management | no | yes |
| Rollout audience authoring | no | yes |
| Runtime admission storage/evaluation | invariant is upstream | mechanism is host-specific |

Any container runtime that claims remote-harness support must prove:

- explicit remote-harness requests fail closed when disabled, disallowed,
  unavailable, or unready;
- request headers cannot set session, run, workspace, or user identity;
- the adapter accepts remote bridge traffic only while trusted runtime state says
  the current Gateway is in remote-harness mode;
- raw provider/model/caller credentials are not projected into the remote agent
  container by default;
- required event classes are forwarded or the attempt fails with a visible
  conformance error before user-visible work is lost.

### Context-engine runtime settings

Remote harness runs participate in context-engine behavior through the normal
OpenClaw attempt lifecycle. The bridge preserves context-engine execution phase
events and carries selected runtime facts in `RunStart`, but v1 does not define
a new remote-only context-engine runtime-settings payload or let the remote host
mutate context-engine selection, routing, fallback, or auth policy.

### Compatibility, versioning, and migration

This proposal is additive:

- existing local AgentHarness runtimes continue to work unchanged;
- existing plugins are not required to implement remote harness;
- `remote-harness` is selected only by explicit provider/model runtime policy;
- unsupported transports or unavailable remote hosts fail the selected attempt;
- v1 rejects unknown core frame kinds;
- v1 allows controlled extension streams through explicit namespace or stream
  allowlisting;
- incompatible frame changes require a protocol-version bump;
- additive fields are allowed only when old receivers can ignore them without
  changing policy or user-visible semantics.

The initial implementation may include a compatibility shim for current SDK
surfaces. That shim should stay at one package boundary and should not become a
second protocol.

### Conformance requirements

A third-party host claiming v1 support should pass a conformance suite that
covers at least:

1. **Schema validation.** Required envelope fields, immutable identity,
   monotonic sequences, terminal uniqueness, and fail-closed unknown core frames.
2. **Golden lifecycle transcripts.** Successful run, tool run, approval denial,
   permission request, user-input request, dynamic-tool call, compaction, patch,
   command output, cancellation, timeout, malformed frame, and unsupported event.
3. **Event preservation.** The Gateway receives the canonical event classes
   listed in this RFC for the corresponding host-side behavior.
4. **Security/authority.** Request headers and route metadata cannot override
   `RunStart` identity; broad credentials are not present in OpenClaw-visible
   config or default remote-agent container environment.
5. **Executable fake host.** A minimal fake host drives the Gateway-side harness
   end-to-end through the above transcripts. Schema-only validation is not
   sufficient for an accepted implementation.

## Rationale

### Why use the AgentHarness seam

The selected design keeps OpenClaw's runtime model simple: provider/model policy
selects an AgentHarness, and the harness owns execution details. A remote
harness is operationally different, but it still produces the same attempt
events and terminal result as a local native harness. Adding a special core
execution path would duplicate selection, lifecycle, approval, transcript, and
retry semantics that already exist around AgentHarness attempts.

### Why typed common frames plus generic event streams

Common behavior such as assistant deltas, tool lifecycle, decisions, and
terminal results needs strict semantics so independent hosts interoperate. At the
same time, OpenClaw already has stable event stream names and harness-specific
extension streams. A generic event frame preserves those surfaces without
freezing every Codex, Copilot, or future harness diagnostic into the core
protocol.

The protocol therefore uses typed frame families for common contract surfaces and
a controlled generic event stream for canonical and namespaced extension events.
The sidecar reference carries exact field shapes; the RFC body carries the
reviewable interoperability decision.

### Why fail closed

If a user or host explicitly selects remote execution, silent local fallback can
violate deployment policy, egress policy, reproducibility expectations, canary
controls, or container-isolation guarantees. `auto` selection may keep existing
conservative behavior, but explicit remote selection must either run remotely or
fail visibly.

### Why keep connector behavior outside v1

Some deployments can already solve connector-like routing inside a container or
host platform by giving the host-side runtime DNS names, hostnames, sidecars,
reverse proxies, service mesh routes, or host-managed connector objects. The
OpenClaw bridge does not need to standardize auth or connection management to be
useful. Keeping connector out of v1 prevents the RFC from depending on a
connector SDK that does not exist while still allowing containerized hosts to
connect to reachable services.

### Why avoid credentials in OpenClaw-visible config

Plugin configuration is often visible to host tooling, logs, diagnostics, or
user-editable files. Transport credentials, provider/model credentials, and
caller credentials belong in host-managed runtime state, not in a portable RFC
schema. The bridge carries only the endpoint and protocol frames needed to
operate the selected run.

## Unresolved questions

- Should the host-adapter transport be named `hostUri`, `hostAdapter`, or
  something else that better describes validated reverse-proxy/container paths?
- Should model-proxy request/response frames be entirely deferred to a separate
  model-egress RFC, or kept as reserved fail-closed v1 frame families in the
  protocol reference?
- Which package should own the public frame types:
  `openclaw/plugin-sdk/agent-harness`, a new `openclaw/remote-harness-protocol`,
  or both with one re-exporting the other?
- Should v1 carry only an opaque `workspaceId`, or should OpenClaw expose
  workspace path/mount metadata as a first-class AgentHarness attempt parameter
  before this RFC is accepted?
- Should `AgentEvent` extension streams be allowlisted by namespace, plugin id,
  or selected inner harness id?
- Should the Gateway require hosts to emit both typed frames and canonical event
  frames, or should the Gateway synthesize canonical events from typed frames
  whenever possible?
- Should native subagent/task mirroring be standardized in this RFC or in a
  follow-up RFC that covers multi-agent task runtimes across Codex, Copilot, Pi,
  and OpenClaw-native subagents?
