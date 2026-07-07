---
title: Remote Agent Harness Bridge and Event Protocol
authors:
  - Omar Shahine
  - Eduardo Piva
created: 2026-07-07
last_updated: 2026-07-07
status: draft
issue:
rfc_pr:
---

# Proposal: Remote Agent Harness Bridge and Event Protocol

Assistance note: this RFC updates the remote AgentHarness bridge draft after
reviewing OpenClaw's current AgentHarness callbacks, Codex app-server event
projection, Copilot SDK event bridge, Codex upstream protocol events, and the
portable remote-harness implementation currently carried in Lobster.

## Summary

Add a first-class remote AgentHarness bridge to OpenClaw and standardize the
streaming event protocol that lets a selected native harness run outside the
Gateway process while preserving OpenClaw's local lifecycle, progress,
approval, tool, plan, compaction, transcript, and user-visible delivery events.

## Motivation

OpenClaw can already route selected provider/model turns through native
AgentHarness plugins such as Codex and Copilot. Those harnesses do more than
return final assistant text. They stream assistant deltas, reasoning snapshots,
plans, tool lifecycle, command output, patch summaries, compaction state,
approvals, permission requests, user-input prompts, usage snapshots, lifecycle
state, and harness-specific diagnostic events into OpenClaw surfaces.

A remote harness that only transports `RunStart`, assistant text, a few tool
notifications, and a terminal result is not equivalent to a local Codex, Pi, or
Copilot harness. It would lose the local OpenClaw events that the Gateway uses
to update WebChat, CLI/TUI status, Control UI, transcripts, task mirrors,
replay-safety decisions, approval resolution, and lifecycle persistence.

Without an upstream event contract, every host or container runtime has to
invent its own partial mapping. That makes the boundary unclear and creates
compatibility risks:

- assistant text may render but plans, reasoning, command output, and patch
  summaries may disappear;
- approval or permission prompts may bypass OpenClaw policy or become
  unreviewable;
- tool execution progress may be visible in one harness but not another;
- compaction and replay-safety state may be wrong after a remote native turn;
- container hosts may accidentally trust request headers for session, run, or
  workspace identity;
- future open-source harness or container-runtime contributions cannot prove
  conformance against one shared contract.

This RFC standardizes the remote bridge as an AgentHarness plugin plus an event
protocol. The protocol is transport-neutral, fail-closed, and designed to carry
both harness-originated events and OpenClaw-local event callbacks that must cross
an out-of-process boundary.

## Goals

- Define a platform-neutral remote AgentHarness bridge selected through existing
  provider/model `agentRuntime.id` configuration.
- Standardize the v1 frame protocol for run control, terminal outcomes,
  approval decisions, tool callbacks, and typed event streaming.
- Make OpenClaw's local AgentHarness callback/event surface explicit so Codex,
  Pi, Copilot, and future harnesses can preserve equivalent user-visible
  behavior when remote.
- Preserve OpenClaw event streams for `lifecycle`, `assistant`, `thinking`,
  `tool`, `item`, `plan`, `approval`, `command_output`, `patch`, `compaction`,
  `error`, and namespaced harness-extension streams.
- Preserve fail-closed runtime selection: an explicit remote-harness selection
  must run remotely or fail; it must not silently fall back to local OpenClaw.
- Keep identity authority host-owned. `RunStart` context, not request headers,
  is authoritative for run, session, workspace, and user context.
- Avoid provider/model credentials in the remote agent process unless a future
  accepted RFC defines a credential or model-proxy contract.
- Provide a conformance target for future open-source remote-harness and
  container-runtime contributions.

## Non-Goals

- This RFC does not make remote harness the default OpenClaw runtime.
- This RFC does not define a specific cloud worker pool, deployment system,
  Azure/Plex/EV2 integration, or rollout audience mechanism.
- This RFC does not distribute provider, model, Graph, M365, GitHub, or other
  caller credentials to remote agent containers.
- This RFC does not define a general-purpose remote filesystem or shell API
  outside the harness/tool event contract.
- This RFC does not change OpenClaw's approval, tool-policy, or memory-policy
  decisions; it transports those decisions across the remote boundary.
- This RFC does not require every harness to emit every event. It requires every
  v1 bridge implementation to preserve and forward the event classes it observes
  or produces, and to fail closed for unsupported request/decision frames.
- This RFC does not standardize host-specific container allocation internals in
  v1. It defines the bridge contract that container runtimes must satisfy.

## Proposal

Introduce a bundled `remote-harness` AgentHarness plugin and a public remote
harness event protocol package. The plugin has two sides:

1. **Gateway-side harness.** Runs inside the OpenClaw Gateway process, registers
   an AgentHarness, resolves explicit runtime selection, opens the configured
   transport, sends `RunStart`, maps remote frames into OpenClaw callbacks,
   forwards OpenClaw decisions back to the host, and returns the terminal
   `AgentHarnessAttemptResult`.
2. **Host-side runtime.** Runs outside the Gateway process or in a separate
   container, validates `RunStart`, selects an allowlisted inner harness, runs
   the native harness, and sends remote frames for all assistant, reasoning,
   plan, tool, approval, command, patch, compaction, lifecycle, and diagnostic
   events it observes.

The bridge is a protocol and lifecycle contract, not a deployment contract. A
host can connect the sides with stdio, WebSocket, TCP, Unix socket, or a
host-owned adapter transport that is explicitly wired by the embedding runtime.

### Plugin registration and selection

The current OpenClaw registration contract remains the source of truth:

```ts
import type { AgentHarness } from "openclaw/plugin-sdk/agent-harness";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const remoteHarnessAgentHarness: AgentHarness = {
  id: "remote-harness",
  label: "Remote Harness",
  supports(ctx) {
    return ctx.requestedRuntime === "remote-harness"
      ? { supported: true, priority: 100 }
      : { supported: false, reason: "remote-harness requires explicit runtime id" };
  },
  async runAttempt(params) {
    return await runRemoteHarnessAttempt(params);
  },
};

export default definePluginEntry({
  id: "remote-harness",
  name: "Remote Harness",
  register(api) {
    api.registerAgentHarness(remoteHarnessAgentHarness);
  },
});
```

Manifest metadata is planner/catalog data, not registration by itself:

```json
{
  "id": "remote-harness",
  "name": "Remote Harness",
  "activation": {
    "onStartup": false,
    "onAgentHarnesses": ["remote-harness"]
  },
  "agentHarnesses": [
    { "id": "remote-harness", "displayName": "Remote Harness" }
  ]
}
```

`activation.onAgentHarnesses` tells plugin loading that a runtime id can require
this plugin. The runtime behavior is registered by `api.registerAgentHarness`.
If OpenClaw does not yet accept top-level `agentHarnesses` manifest metadata,
that field is treated as proposed catalog metadata for this RFC, not as a v1
runtime dependency.

Runtime selection uses existing provider/model policy:

```json
{
  "models": {
    "providers": {
      "openai": {
        "agentRuntime": { "id": "remote-harness" }
      }
    }
  }
}
```

Model-scoped policy wins, provider-scoped policy follows, and explicit plugin
runtime selections fail closed when the harness is missing, unsupported, or
unavailable. Whole-agent/session runtime pins remain ignored by selection.

### Configuration

The Gateway-side plugin requires explicit fail-closed configuration:

```ts
type RemoteHarnessConfig = {
  schemaVersion: 1;
  failClosed: true;
  allowFallback: false;
  allowedInnerHarnessIds: string[];
  defaultInnerHarnessId: string;
  transport: RemoteTransportConfig;
  egress: RemoteHarnessEgressConfig;
  eventStreams?: RemoteHarnessEventStreamPolicy;
};

type RemoteTransportConfig =
  | { kind: "stdio"; command?: string; args?: string[] }
  | { kind: "websocket"; url: string; headers?: Record<string, string>; connect?: boolean }
  | { kind: "unix"; path: string; connect?: boolean }
  | { kind: "tcp"; host: string; port: number; connect?: boolean }
  | { kind: "hostUri"; uriTemplate: string };

type RemoteHarnessEgressConfig =
  | { mode: "disabled"; requireProxy: false }
  | { mode: "proxy"; requireProxy: true; proxyUrl: string };

type RemoteHarnessEventStreamPolicy = {
  /** Unknown namespaced streams are forwarded only when this is true. */
  allowUnknownNamespacedStreams?: boolean;
  /** Optional allowlist for extension streams such as codex_app_server.item. */
  extensionStreamAllowlist?: string[];
};
```

Invariants:

- `failClosed` is always `true`.
- `allowFallback` is always `false`.
- `allowedInnerHarnessIds` must contain at least one id.
- `defaultInnerHarnessId` must be present in `allowedInnerHarnessIds`.
- Unknown top-level config fields are rejected.
- Transport configuration must not contain bearer tokens, session tokens, or
  broad credentials.
- `hostUri` is a routing adapter transport. It is not identity authority and is
  valid only when the embedding host installs a validator that gates the URI on
  trusted runtime state.
- `connector` is reserved for a future connector SDK and is not an accepted v1
  transport kind. A v1 configuration that names `connector` must be rejected
  fail-closed instead of silently mapping it to another transport.
- Container or host-runtime connectivity is outside the OpenClaw-visible
  transport contract. A host-side runtime may call hostnames, service DNS names,
  sidecars, reverse proxies, or service-mesh endpoints that its container network
  exposes. That layer owns auth, certificates, routing policy, retries, and
  connection management; the remote-harness spec only sees the resulting
  stdio/WebSocket/TCP/Unix/host adapter endpoint.
- If egress proxy enforcement is configured, startup fails unless enforcement is
  actually wired by the host.

### Frame envelope

Every protocol frame is JSON-serializable and carries a stable stream context:

```ts
type RemoteHarnessStreamContext = {
  protocolVersion: 1;
  streamId: string;
  runId: string;
  sessionKey: string;
  workspaceId: string;
  seq: number;
};

type RemoteHarnessFrame = RemoteHarnessStreamContext & {
  kind: string;
};
```

Frame invariants:

- `RunStart` is the first accepted Gateway-to-host frame for a stream.
- `RunAccepted` must precede non-terminal host-to-Gateway event frames.
- `protocolVersion`, `streamId`, `runId`, `sessionKey`, and `workspaceId` are
  immutable for the stream.
- Sequence numbers are strictly increasing per direction.
- Unknown non-extension frame kinds fail closed.
- Unknown extension streams are rejected unless allowed by `eventStreams` policy.
- Malformed frames close or reject the stream without crashing host loops.
- `RunFinal`, `RunFailed`, or `RunCancelled` ends the stream.
- Post-terminal duplicate/stale frames can be ignored only after validating the
  immutable stream context.

### Gateway-to-host frames

Gateway-to-host frames carry run control and OpenClaw decisions:

```ts
type BrainFrame =
  | RunStartFrame
  | CancelRunFrame
  | HeartbeatFrame
  | ApprovalDecisionFrame
  | ToolAuthorizationDecisionFrame
  | MemoryWriteDecisionFrame
  | PermissionDecisionFrame
  | UserInputResponseFrame
  | DynamicToolResponseFrame
  | ModelProxyChunkFrame
  | ModelProxyFinalFrame
  | ModelProxyErrorFrame
  | CompactSessionFrame
  | ResetSessionFrame;
```

#### `RunStart`

`RunStart` carries host-authoritative context. The remote agent must not replace
these fields with request headers, URL paths, hostnames, or arbitrary transport
metadata.

```ts
type RunStartFrame = RemoteHarnessStreamContext & {
  kind: "RunStart";
  innerHarnessId: string;
  input: JsonValue;
  context: {
    schemaVersion: 1;
    agentId?: string;
    sessionId: string;
    sessionFile?: string;
    sandboxSessionKey?: string;
    workspaceDir?: string;
    cwd?: string;
    provider: string;
    modelId: string;
    requestedModelId?: string | null;
    runtimePlan?: JsonValue;
    trigger?: "cron" | "heartbeat" | "manual" | "memory" | "overflow" | "user";
    message?: {
      channel?: string;
      provider?: string;
      to?: string;
      threadId?: string | number;
      currentMessageId?: string | number;
      senderId?: string | null;
      senderName?: string | null;
      senderUsername?: string | null;
      senderIsOwner?: boolean;
      groupId?: string | null;
      groupChannel?: string | null;
      groupSpace?: string | null;
      memberRoleIds?: string[];
    };
    toolPolicy?: {
      toolsAllow?: string[];
      disableTools?: boolean;
      requireExplicitMessageTarget?: boolean;
    };
    streaming?: {
      blockReplyBreak?: "text_end" | "message_end";
      suppressLiveStreamOutput?: boolean;
      silentExpected?: boolean;
    };
    limits?: {
      timeoutMs: number;
      runTimeoutOverrideMs?: number;
      contextTokenBudget?: number;
    };
  };
};
```

`RunStart.context` intentionally contains runtime facts and routing metadata, not
provider credentials. Sensitive auth remains Gateway-owned or harness-owned.

#### Decisions and callbacks

```ts
type ApprovalDecisionFrame = RemoteHarnessStreamContext & {
  kind: "ApprovalDecision";
  requestId: string;
  approved: boolean;
  reason?: string;
  scope?: "turn" | "session";
};

type ToolAuthorizationDecisionFrame = RemoteHarnessStreamContext & {
  kind: "ToolAuthorizationDecision";
  requestId: string;
  approved: boolean;
  reason?: string;
};

type MemoryWriteDecisionFrame = RemoteHarnessStreamContext & {
  kind: "MemoryWriteDecision";
  requestId: string;
  approved: boolean;
  reason?: string;
};

type PermissionDecisionFrame = RemoteHarnessStreamContext & {
  kind: "PermissionDecision";
  requestId: string;
  permissions: JsonValue;
  scope: "turn" | "session";
  strictAutoReview?: boolean;
};

type UserInputResponseFrame = RemoteHarnessStreamContext & {
  kind: "UserInputResponse";
  requestId: string;
  answers: Record<string, { answers: string[] }>;
};

type DynamicToolResponseFrame = RemoteHarnessStreamContext & {
  kind: "DynamicToolResponse";
  requestId: string;
  contentItems: JsonValue[];
  success: boolean;
};
```

`PermissionDecision`, `UserInputResponse`, and `DynamicToolResponse` are required
because Codex exposes request-permissions, request-user-input, and dynamic tool
calls as first-class protocol events, while OpenClaw owns the user-visible
review and tool execution surfaces.

#### Model proxy frames

Model proxy frames are reserved for a future host-defined egress path. A v1
implementation may reject `ModelProxyRequest` from the host and never emit these
responses. If implemented, the Gateway owns provider credentials and streams
model output back as:

```ts
type ModelProxyChunkFrame = RemoteHarnessStreamContext & {
  kind: "ModelProxyChunk";
  requestId: string;
  delta: string;
};

type ModelProxyFinalFrame = RemoteHarnessStreamContext & {
  kind: "ModelProxyFinal";
  requestId: string;
  output: JsonValue;
  usage?: JsonValue;
};

type ModelProxyErrorFrame = RemoteHarnessStreamContext & {
  kind: "ModelProxyError";
  requestId: string;
  error: { message: string; code?: string };
};
```

### Host-to-Gateway frames

Host-to-Gateway frames carry lifecycle, event streams, requests, and terminal
outcomes:

```ts
type AgentFrame =
  | RunAcceptedFrame
  | AssistantMessageStartFrame
  | AssistantDeltaFrame
  | VisibleReplyFrame
  | ReasoningDeltaFrame
  | ReasoningEndFrame
  | ToolStartedFrame
  | ToolProgressFrame
  | ToolFinishedFrame
  | ToolStreamBoundaryFrame
  | AgentEventFrame
  | AgentToolResultFrame
  | ExecutionStartedFrame
  | ExecutionPhaseFrame
  | RunProgressFrame
  | LaneWaitFrame
  | SessionIdChangedFrame
  | UsageUpdateFrame
  | ApprovalRequestedFrame
  | ToolAuthorizationRequestedFrame
  | MemoryWriteRequestedFrame
  | PermissionRequestedFrame
  | UserInputRequestedFrame
  | DynamicToolCallRequestedFrame
  | ModelProxyRequestFrame
  | CheckpointFrame
  | ArtifactProducedFrame
  | RunFinalFrame
  | RunFailedFrame
  | RunCancelledFrame
  | HeartbeatFrame;
```

Common host-to-Gateway frame shapes:

```ts
type RunAcceptedFrame = RemoteHarnessStreamContext & {
  kind: "RunAccepted";
  selectedInnerHarnessId: string;
  selectedInnerHarnessVersion: string;
};

type AssistantMessageStartFrame = RemoteHarnessStreamContext & {
  kind: "AssistantMessageStart";
  itemId?: string;
};

type ExecutionStartedFrame = RemoteHarnessStreamContext & {
  kind: "ExecutionStarted";
  lifecycleGeneration?: string;
};

type ExecutionPhaseFrame = RemoteHarnessStreamContext & {
  kind: "ExecutionPhase";
  phase:
    | "runner_entered"
    | "workspace"
    | "runtime_plugins"
    | "before_agent_reply"
    | "model_resolution"
    | "auth"
    | "context_engine"
    | "attempt_dispatch"
    | "context_assembled"
    | "turn_accepted"
    | "process_spawned"
    | "tool_execution_started"
    | "assistant_output_started"
    | "model_call_started";
  provider?: string;
  model?: string;
  backend?: string;
  source?: string;
  tool?: string;
  toolCallId?: string;
  itemId?: string;
  firstModelCallStarted?: boolean;
};

type RunProgressFrame = RemoteHarnessStreamContext & {
  kind: "RunProgress";
  reason: string;
  provider?: string;
  model?: string;
  backend?: string;
};

type LaneWaitFrame = RemoteHarnessStreamContext & {
  kind: "LaneWait";
  waitMs: number;
  queuedAhead: number;
  waiting?: boolean;
};

type SessionIdChangedFrame = RemoteHarnessStreamContext & {
  kind: "SessionIdChanged";
  sessionId: string;
};

type UsageUpdateFrame = RemoteHarnessStreamContext & {
  kind: "UsageUpdate";
  usage: JsonValue;
  source?: "assistant" | "model" | "harness";
};

type AgentToolResultFrame = RemoteHarnessStreamContext & {
  kind: "AgentToolResult";
  toolName: string;
  result: JsonValue;
  isError: boolean;
};

type ToolStreamBoundaryFrame = RemoteHarnessStreamContext & {
  kind: "ToolStreamBoundary";
  toolCallId?: string;
};

type CheckpointFrame = RemoteHarnessStreamContext & {
  kind: "Checkpoint";
  checkpointId: string;
  state: JsonValue;
};

type ArtifactProducedFrame = RemoteHarnessStreamContext & {
  kind: "ArtifactProduced";
  artifactId: string;
  uri: string;
  metadata?: JsonValue;
};

type ModelProxyRequestFrame = RemoteHarnessStreamContext & {
  kind: "ModelProxyRequest";
  requestId: string;
  model: string;
  payload: JsonValue;
};
```

Common control frames shared by both directions:

```ts
type HeartbeatFrame = RemoteHarnessStreamContext & {
  kind: "Heartbeat";
  sentAt?: string;
};

type CancelRunFrame = RemoteHarnessStreamContext & {
  kind: "CancelRun";
  reason?: string;
};

type CompactSessionFrame = RemoteHarnessStreamContext & {
  kind: "CompactSession";
  reason?: "manual" | "threshold" | "overflow";
};

type ResetSessionFrame = RemoteHarnessStreamContext & {
  kind: "ResetSession";
  reason?: "new" | "reset" | "idle" | "daily" | "compaction" | "deleted" | "unknown";
};
```

### Required OpenClaw event mapping

The following mapping is the contract that remote harnesses must preserve when
they observe or produce the corresponding behavior. Implementations may add
harness-specific extension events, but they must not drop the canonical event
when one is available.

| OpenClaw local surface | Remote frame or stream | Required behavior |
| --- | --- | --- |
| `onExecutionStarted({ lifecycleGeneration })` | `ExecutionStarted` | Signals that the selected harness has entered execution and gives the Gateway the owning lifecycle generation when known. |
| `onExecutionPhase(...)` | `ExecutionPhase` and `AgentEvent(stream="item")` when user-visible | Carries milestones such as `runner_entered`, `workspace`, `runtime_plugins`, `before_agent_reply`, `model_resolution`, `auth`, `context_engine`, `attempt_dispatch`, `context_assembled`, `turn_accepted`, `process_spawned`, `tool_execution_started`, `assistant_output_started`, and `model_call_started`. |
| `onLaneWait(...)` | `LaneWait` | Preserves queued/waiting status before execution. |
| `onRunProgress(...)` | `RunProgress` | Preserves provider/model/backend progress messages. |
| `onSessionIdChanged(sessionId)` | `SessionIdChanged` | Lets the Gateway update active session identity after native resume/start decisions. |
| `onAssistantMessageStart()` | `AssistantMessageStart` | Marks the first assistant item before deltas. |
| `onPartialReply(payload)` | `AssistantDelta` | Streams assistant text with `delta`, cumulative `text`, optional `replace`, and optional usage. |
| `onBlockReply(payload)` / `onBlockReplyFlush()` | `VisibleReply` | Carries text/media/source-reply payloads that should be delivered as block replies rather than only append deltas. |
| `onReasoningStream(payload)` | `ReasoningDelta` | Carries reasoning text snapshots or deltas, media URLs, and `isReasoningSnapshot`. |
| `onReasoningEnd()` | `ReasoningEnd` | Closes a reasoning block so channels can flush thinking UI. |
| `onToolResult(payload)` | `ToolProgress` or `VisibleReply` | Carries user-visible tool result text/media/status that channels should render. |
| `onAgentToolResult({ toolName, result, isError })` | `AgentToolResult` | Carries sanitized private per-tool result for replay-safety and diagnostics. |
| `onToolStreamBoundary()` | `ToolStreamBoundary` | Preserves spacing/order after a tool finishes streaming. |
| `onAgentEvent({ stream, data, sessionKey })` | `AgentEvent` | Generic sequenced OpenClaw event bus frame for canonical and extension streams. |
| `onUserMessagePersisted(message)` | `AgentEvent(stream="lifecycle", data.phase="user_message_persisted")` | Lets remote/native harnesses report the point at which the user message is durably in transcript. |
| `onAssistantErrorMessagePersisted(message)` | `AgentEvent(stream="lifecycle", data.phase="assistant_error_persisted")` | Lets the Gateway distinguish persisted error text from transient stream failures. |
| `onAttemptTimeoutArmed()` | `AgentEvent(stream="lifecycle", data.phase="timeout_armed")` | Preserves watchdog observability. |
| `onAttemptTimeout(error)` | `AgentEvent(stream="lifecycle", data.phase="timeout")` and terminal metadata | Preserves timeout phase and liveness data. |
| `onAttemptAbort()` | `RunCancelled` or `AgentEvent(stream="lifecycle", data.phase="aborted")` | Preserves explicit native abort acknowledgement. |

### Canonical `AgentEvent` streams

`AgentEvent` is the escape hatch that keeps the remote protocol aligned with
OpenClaw's local event bus without adding a new top-level frame for every UI
or diagnostic stream:

```ts
type AgentEventFrame = RemoteHarnessStreamContext & {
  kind: "AgentEvent";
  stream:
    | "lifecycle"
    | "tool"
    | "assistant"
    | "error"
    | "item"
    | "plan"
    | "approval"
    | "command_output"
    | "patch"
    | "compaction"
    | "thinking"
    | `${string}.${string}`;
  data: Record<string, JsonValue>;
  sessionKey?: string;
  agentId?: string;
};
```

Canonical stream requirements:

- `lifecycle`: emits `phase: "start"`, `"finishing"`, `"end"`, `"error"`,
  timeout, abort, and persistence-related phases. Terminal lifecycle events carry
  `stopReason`, `yielded`, `timeoutPhase`, `providerStarted`, `aborted`,
  `livenessState`, and `replayInvalid` when known.
- `assistant`: emits assistant snapshots/deltas, including replacement snapshots
  for provisional/native items that append-only partial-reply consumers cannot
  safely concatenate.
- `thinking`: emits reasoning snapshots/deltas for live thinking UI.
- `tool`: emits tool `start`, `update`, and `result` with sanitized args/results,
  tool name, tool call id, error state, and metadata.
- `item`: emits normalized activity-feed items with `itemId`, `phase`, `kind`,
  `title`, `status`, timestamps, progress text, approval ids, and summaries.
- `plan`: emits plan updates, exit-plan-mode requests/completions, explanation,
  steps, actions, selected action, and feedback.
- `approval`: emits approval `requested` and `resolved` events for command,
  plugin, permission, and unknown approval families.
- `command_output`: emits command stdout/stderr deltas and terminal command
  output with status, exit code, duration, and cwd when known.
- `patch`: emits patch summary with added, modified, deleted files and summary
  text.
- `compaction`: emits compaction `start` and `end`, completed/aborted state,
  retry state, backend, item/thread/turn ids when known.
- `error`: emits non-terminal stream/provider/harness errors that should be
  visible to diagnostics but do not replace terminal `RunFailed`.
- Namespaced extension streams such as `codex_app_server.item`,
  `codex_app_server.guardian`, `codex_app_server.hook`, and
  `codex_app_server.lifecycle` are allowed only when the Gateway configuration
  admits the namespace or the stream is known to the plugin.

### Typed event frames

Typed frames exist for high-value event classes that every host should implement
without inspecting generic stream payloads:

```ts
type AssistantDeltaFrame = RemoteHarnessStreamContext & {
  kind: "AssistantDelta";
  delta: string;
  text?: string;
  replace?: boolean;
  replaceable?: boolean;
  usage?: JsonValue;
};

type VisibleReplyFrame = RemoteHarnessStreamContext & {
  kind: "VisibleReply";
  text?: string;
  mediaUrls?: string[];
  audioAsVoice?: boolean;
  trustedLocalMedia?: boolean;
  sourceReply?: JsonValue;
  final?: boolean;
};

type ReasoningDeltaFrame = RemoteHarnessStreamContext & {
  kind: "ReasoningDelta";
  text?: string;
  delta?: string;
  mediaUrls?: string[];
  isReasoningSnapshot?: boolean;
};

type ReasoningEndFrame = RemoteHarnessStreamContext & {
  kind: "ReasoningEnd";
};

type ToolStartedFrame = RemoteHarnessStreamContext & {
  kind: "ToolStarted";
  toolCallId: string;
  name: string;
  args?: JsonValue;
  meta?: string;
  startedAt?: number;
};

type ToolProgressFrame = RemoteHarnessStreamContext & {
  kind: "ToolProgress";
  toolCallId: string;
  name?: string;
  message?: string;
  partialResult?: JsonValue;
  progressText?: string;
};

type ToolFinishedFrame = RemoteHarnessStreamContext & {
  kind: "ToolFinished";
  toolCallId: string;
  name: string;
  result: JsonValue;
  isError: boolean;
  meta?: string;
  endedAt?: number;
};
```

Typed frames and `AgentEvent` are complementary. A host that emits
`ToolStarted` should also emit the matching canonical `AgentEvent(stream="tool")`
and `AgentEvent(stream="item")` when it has enough data to preserve OpenClaw's
activity feed. The Gateway deduplicates by `toolCallId`/`itemId`.

### Requests initiated by the remote host

Remote native harnesses can need OpenClaw-owned decisions or actions. These are
host-to-Gateway request frames:

```ts
type ApprovalRequestedFrame = RemoteHarnessStreamContext & {
  kind: "ApprovalRequested";
  requestId: string;
  prompt: string;
  details?: JsonValue;
};

type ToolAuthorizationRequestedFrame = RemoteHarnessStreamContext & {
  kind: "ToolAuthorizationRequested";
  requestId: string;
  toolName: string;
  details?: JsonValue;
};

type MemoryWriteRequestedFrame = RemoteHarnessStreamContext & {
  kind: "MemoryWriteRequested";
  requestId: string;
  proposedMemory: JsonValue;
};

type PermissionRequestedFrame = RemoteHarnessStreamContext & {
  kind: "PermissionRequested";
  requestId: string;
  reason?: string;
  permissions: JsonValue;
  cwd?: string;
  environmentId?: string;
};

type UserInputRequestedFrame = RemoteHarnessStreamContext & {
  kind: "UserInputRequested";
  requestId: string;
  questions: Array<{
    id: string;
    header: string;
    question: string;
    isOther?: boolean;
    isSecret?: boolean;
    options?: Array<{ label: string; description: string }>;
  }>;
  autoResolutionMs?: number;
};

type DynamicToolCallRequestedFrame = RemoteHarnessStreamContext & {
  kind: "DynamicToolCallRequested";
  requestId: string;
  namespace?: string;
  tool: string;
  arguments: JsonValue;
};
```

The Gateway must apply the same approval, user-input, dynamic-tool, memory, and
permission policies it would apply for an in-process harness. If a policy or UI
route is unavailable, the Gateway returns a denial/unavailable decision rather
than letting the remote host proceed implicitly.

### Terminal frames and result mapping

```ts
type RunFinalFrame = RemoteHarnessStreamContext & {
  kind: "RunFinal";
  result: JsonValue;
  assistantTexts?: string[];
  usage?: JsonValue;
  replayMetadata?: JsonValue;
  itemLifecycle?: {
    startedCount: number;
    completedCount: number;
    activeCount: number;
  };
};

type RunFailedFrame = RemoteHarnessStreamContext & {
  kind: "RunFailed";
  error: { message: string; code?: string; data?: JsonValue };
  replaySafe?: boolean;
};

type RunCancelledFrame = RemoteHarnessStreamContext & {
  kind: "RunCancelled";
  reason?: string;
  timedOut?: boolean;
  timeoutPhase?: string;
};
```

The Gateway maps terminal frames into `AgentHarnessAttemptResult`. A remote
harness must send the final assistant text, usage, replay-safety, and item
lifecycle metadata it knows so the outer OpenClaw attempt can make the same
fallback, retry, transcript, and lifecycle decisions as a local native harness.

### Existing event-source mapping

The v1 bridge must be able to represent these current sources:

| Source | Events observed today | Remote mapping |
| --- | --- | --- |
| OpenClaw embedded runner | execution started/phase, lane wait, run progress, session id change, assistant partials, block replies, reasoning, tool results, private tool results, generic agent events, tool stream boundaries, user/error persistence, timeout/abort hooks | typed frames plus `AgentEvent` canonical streams |
| OpenClaw agent event bus | `lifecycle`, `tool`, `assistant`, `error`, `item`, `plan`, `approval`, `command_output`, `patch`, `compaction`, `thinking`, extension streams | `AgentEvent` |
| Codex app-server plugin | assistant deltas with replaceable snapshots, reasoning snapshots, plan updates, item started/completed, tool progress, compaction start/end, approval events, permission requests, user-input requests, dynamic tool calls, MCP/tool events, guardian/hook diagnostics, native lifecycle streams | typed frames for common events, `PermissionRequested`, `UserInputRequested`, `DynamicToolCallRequested`, and namespaced `AgentEvent` for Codex-specific diagnostics |
| Upstream Codex protocol | `TurnStarted`, `TurnComplete`, `AgentMessageContentDelta`, `PlanDelta`, `ReasoningContentDelta`, `ItemStarted`, `ItemCompleted`, `ExecCommandBegin`, `ExecCommandOutputDelta`, `ExecCommandEnd`, `PatchApplyBegin`, `PatchApplyUpdated`, `PatchApplyEnd`, `RequestPermissions`, `RequestUserInput`, `DynamicToolCallRequest`, `McpToolCallBegin`, `McpToolCallEnd`, `SubAgentActivity`, hook events | typed frames and canonical/namespaced `AgentEvent` streams |
| Copilot SDK bridge | assistant message deltas, assistant usage, tool start/complete counts, plan changed, exit-plan-mode request/completion, subagent started/completed/failed, compaction start/complete, session idle/error/abort | typed assistant/usage frames, `AgentEvent(stream="plan")`, `AgentEvent(stream="item")`, `AgentEvent(stream="compaction")`, terminal failure/cancel frames |
| Portable Lobster remote-harness plugin | `AssistantDelta`, `ReasoningDelta`, tool started/progress/finished, checkpoint, artifact, approval/tool-auth/memory requests, terminal frames, heartbeat | retained as the minimal subset, extended by `AgentEvent`, visible reply, plan, command output, patch, compaction, user-input, permission, dynamic tool, usage, and lifecycle frames |

### Host-side inner harness API

The host-side API remains small but must expose event callbacks instead of only
assistant/tool callbacks:

```ts
type InnerRunRequest = {
  runId: string;
  sessionKey: string;
  workspaceId: string;
  streamId: string;
  input: JsonValue;
  context: RunStartFrame["context"];
};

type InnerHarnessCallbacks = {
  assistantDelta(frame: Omit<AssistantDeltaFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<void>;
  visibleReply(frame: Omit<VisibleReplyFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<void>;
  reasoningDelta(frame: Omit<ReasoningDeltaFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<void>;
  reasoningEnd(): Promise<void>;
  toolStarted(frame: Omit<ToolStartedFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<void>;
  toolProgress(frame: Omit<ToolProgressFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<void>;
  toolFinished(frame: Omit<ToolFinishedFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<void>;
  agentEvent(frame: Omit<AgentEventFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<void>;
  requestApproval(frame: Omit<ApprovalRequestedFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<ApprovalDecision>;
  requestPermission(frame: Omit<PermissionRequestedFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<PermissionDecision>;
  requestUserInput(frame: Omit<UserInputRequestedFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<UserInputResponse>;
  callDynamicTool(frame: Omit<DynamicToolCallRequestedFrame, keyof RemoteHarnessStreamContext | "kind">): Promise<DynamicToolResponse>;
};

type InnerHarness = {
  id: string;
  version: string;
  run(
    request: InnerRunRequest,
    callbacks: InnerHarnessCallbacks,
    signal: AbortSignal,
  ): Promise<JsonValue>;
};
```

A generic command inner harness can exist for local and product integration
experiments. Command execution must use an allowlist-style environment:

- inherit only ambient process basics such as `PATH`, `HOME`, `LANG`, `TZ`, and
  trusted CA bundle variables;
- pass explicit host-provided environment entries only after filtering sensitive
  credential-shaped names;
- abort the child process on cancellation;
- stream stdout as assistant text only after the process succeeds unless the
  command explicitly speaks the remote-harness event protocol.

`deterministic-poc` may exist for repeatable tests, but it is test-only and must
not be a production fallback.

### Transport authority and trusted identity

The transport is a routing mechanism, not authority.

The upstream plugin must not require bearer tokens in OpenClaw-visible
configuration. If a host needs authenticated routing, it should put authority
outside the plugin config, such as:

- process-local sockets;
- reverse-proxy admission;
- container-provided DNS names, sidecars, service-mesh routes, or hostnames that
  are reachable only from the host-side runtime container;
- host-managed connector objects, if a deployment provides them outside this
  spec;
- short-lived substream metadata produced by the host runtime;
- container-runtime capability state that the transport adapter consults before
  accepting a bridge connection.

The remote-harness protocol does not standardize connector auth, connection
pooling, service discovery, retries, certificate handling, or credential
projection. Deployments such as a containerized host runtime can solve those
concerns in the container or host platform and expose only a reachable endpoint
to the bridge.

The remote agent must not treat hostnames, URL paths, headers, or arbitrary
request metadata as proof of user, session, workspace, or run identity.
`RunStart.context` is the authoritative stream identity.

### Container-runtime contribution boundary

This RFC deliberately separates upstreamable bridge contracts from host-specific
container orchestration:

| Surface | Upstream contract | Host-specific implementation |
| --- | --- | --- |
| Remote AgentHarness plugin | yes | no |
| Protocol frame types and validators | yes | no |
| Host runtime and inner-harness registry | yes | no |
| Reference command harness/container | yes | optional |
| Event conformance suite | yes | no |
| Container allocator interface | yes, as a future RFC or implementation issue | provider-specific allocator |
| Worker pool, deployment, EV2, Azure, Plex, or ECS wiring | no | yes |
| Container DNS, hostnames, sidecars, service mesh, certificates, and connection management | no | yes |
| Rollout audience authoring | no | yes |
| Runtime admission invariants | yes | host chooses storage/evaluation mechanism |

Any container runtime that claims remote-harness support must prove:

- explicit remote-harness requests fail closed when disabled, disallowed,
  unavailable, or unready;
- headerless rollout misses can remain on existing local Gateway behavior;
- request headers cannot set session, run, workspace, or user identity;
- the adapter accepts remote bridge traffic only while trusted runtime state says
  the current Gateway is in remote-harness mode;
- raw provider/model/caller credentials are not projected into the Agent
  container by default;
- all required event streams from this RFC are forwarded or intentionally denied
  with a visible conformance failure.

### Compatibility and migration

This is additive:

- existing OpenClaw runtimes continue to work unchanged;
- existing plugins are not required to implement remote harness;
- `remote-harness` is selected only by explicit provider/model runtime
  configuration;
- unsupported transports or unavailable remote hosts fail the selected attempt;
- v1 frame validation rejects unknown core frame kinds;
- `AgentEvent` provides a controlled extension path for existing harness-specific
  streams without requiring a protocol revision for every diagnostic event.

The initial implementation may include a compatibility shim for current
AgentHarness SDK types. That shim should stay in one package boundary and be
removed once the public SDK exposes native remote-harness frame and event types.

### Transcripts and context-engine runtime settings

Remote harness runs participate in transcript and lifecycle persistence through
the same AgentHarness result, assistant delivery callbacks, user/error message
persistence callbacks, and `AgentEvent` streams that local harnesses use. v1 does
not add a remote-only transcript side channel.

Remote harness runs also participate in context-engine behavior through the
normal OpenClaw attempt lifecycle. The bridge preserves context-engine execution
phase events and carries selected runtime facts in `RunStart.context`, but v1
does not define a new remote-only context-engine runtime-settings payload or let
the remote host mutate OpenClaw context-engine selection, routing, fallback, or
auth policy.

## Rationale

The selected design uses the AgentHarness plugin seam instead of adding a new
special-purpose execution path to OpenClaw core. That keeps the OpenClaw model
simple: provider/model runtime selection chooses a harness, and the harness owns
execution details. A remote harness is operationally different, but it still
produces the same attempt events and terminal result as a local native harness.

A typed frame protocol is preferred over forwarding opaque process stdio because
OpenClaw relies on structured events. Tool progress, activity-feed items,
command output, patch summaries, approvals, plans, compaction, reasoning,
artifacts, lifecycle, cancellation, and final results should not be parsed out
of free-form text.

A generic `AgentEvent` frame is included because OpenClaw already has an event
bus with stable stream names and harness-specific extension streams. Defining a
new top-level frame for every Codex or Copilot diagnostic would freeze too much
provider detail into the core remote-harness protocol. Conversely, using only a
generic event frame would make common assistant/tool/approval behavior harder to
implement correctly. The mixed design gives strict typed frames for common
contract surfaces and a namespaced extension stream for harness-specific detail.

Fail-closed selection is deliberate. If a user or host explicitly selects remote
execution, silently falling back to a local model runtime can violate deployment
policy, egress policy, reproducibility expectations, canary controls, or
container-isolation guarantees. `auto` and headerless default behavior can remain
conservative, but explicit remote selection must either run remotely or fail.

The proposal avoids putting tokens in plugin config because plugin config is
often visible to host tooling, logs, diagnostics, or user-editable config files.
Host integrations can still enforce authenticated routing, but that authority
belongs outside the OpenClaw-visible transport object.

## Unresolved questions

- Should `hostUri` be accepted as a public transport name, or should upstream use
  a different name such as `hostAdapter` for validated reverse-proxy paths?
- Should model proxy frames be removed from v1 until a separate model-egress RFC
  is accepted, or kept as reserved fail-closed frame names?
- Which package should own the public TypeScript frame types:
  `openclaw/plugin-sdk/agent-harness`, a new `openclaw/remote-harness-protocol`,
  or both with one re-exporting the other?
- Should `RunStart.context.workspaceDir` be exposed to remote hosts as a path,
  or should v1 carry only an opaque `workspaceId` plus host-owned workspace
  mounting metadata?
- Should `AgentEvent` extension streams be allowlisted by namespace, by plugin
  id, or by the selected inner harness id?
- What is the minimum conformance suite for third-party remote harness hosts:
  static schema validation only, golden frame transcripts, or an executable
  fake host that drives OpenClaw callbacks end-to-end?
- Should OpenClaw require every remote harness to emit both typed frames and the
  matching canonical `AgentEvent`, or should the Gateway synthesize canonical
  agent events from typed frames when possible?
- Should native subagent/task mirroring be standardized in this RFC or in a
  follow-up RFC that covers multi-agent task runtimes across Codex, Copilot, Pi,
  and OpenClaw-native subagents?
