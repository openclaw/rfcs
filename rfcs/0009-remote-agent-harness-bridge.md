---
title: Remote Agent Harness Bridge
authors:
  - Omar Shahine
created: 2026-07-06
last_updated: 2026-07-06
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/29
---

# Proposal: Remote Agent Harness Bridge

## Summary

Add a first-class remote AgentHarness bridge to OpenClaw so a selected model
runtime can execute in a separate, host-managed agent process or container while
the normal OpenClaw gateway continues to own session orchestration, streaming
events, approvals, and user-visible delivery.

## Motivation

OpenClaw currently assumes the selected model runtime and most execution
machinery run inside the same gateway process boundary. That is a good default
for local development and simple deployments, but it makes some host
integrations harder than they need to be.

Some hosts need to run the expensive or privileged execution portion in a
separate environment:

- a locked-down container with different filesystem and network policy;
- a pool-managed worker that can be allocated, warmed, or retired independently;
- a provider-specific agent host such as a coding-agent CLI;
- an integration where outbound model/tool egress must stay mediated by the
  host instead of exposing credentials to the gateway process.

Without an upstream bridge contract, each host has to patch OpenClaw internals or
fake a local runtime. That makes the boundary unclear: session/run identity,
workspace identity, approval decisions, streaming deltas, and cancellation all
become implementation-specific.

This RFC proposes a narrow plugin/runtime seam:

- OpenClaw can select a `remote-harness` AgentHarness for a run.
- The remote harness communicates over a typed frame protocol.
- The host decides how that protocol crosses the process/container boundary.
- OpenClaw remains responsible for the user-visible lifecycle and policy
  decisions exposed through the AgentHarness contract.

## Goals

- Define a platform-neutral remote AgentHarness plugin contract for OpenClaw.
- Support explicit runtime selection through the existing model/runtime
  configuration path.
- Preserve OpenClaw's current streaming semantics: assistant deltas, reasoning
  deltas, tool events, checkpoints, artifacts, terminal run results, and
  cancellation.
- Preserve approval boundaries by routing approval, tool authorization, and
  memory-write decisions back through OpenClaw callbacks.
- Make the remote boundary fail closed: no implicit fallback to a local runtime
  when a remote harness was explicitly selected.
- Keep transport details replaceable. The v1 contract should work over stdio,
  WebSocket, TCP, Unix socket, or a host-provided connector.
- Avoid requiring model/provider credentials in the remote agent process.
- Provide a reference host runtime that can wrap a command-style inner harness.
- Keep the public contract independent of any one hosting platform, container
  orchestrator, or product deployment model.

## Non-Goals

- This RFC does not define a specific cloud deployment, worker pool, or
  orchestration service.
- This RFC does not make a particular remote host the default OpenClaw runtime.
- This RFC does not define provider/model credential distribution to remote
  agents.
- This RFC does not define a general-purpose remote tool execution API.
- This RFC does not change OpenClaw's approval policy model.
- This RFC does not require existing model runtimes or AgentHarness
  implementations to move out of process.
- This RFC does not define a sandbox security model beyond the bridge contract
  invariants.

## Proposal

Introduce a new bundled plugin package, `remote-harness`, that registers an
AgentHarness with OpenClaw.

The plugin has two halves:

1. **Gateway-side harness.** Runs inside the normal OpenClaw gateway process,
   implements the AgentHarness interface, opens a configured transport, sends a
   `RunStart` frame, translates remote frames into OpenClaw callbacks, and
   returns the final run result.
2. **Host-side runtime.** Runs in the remote process or container, receives
   `RunStart`, selects an allowlisted inner harness, executes it, and sends
   streaming and terminal frames back to the gateway-side harness.

The bridge is intentionally a protocol and lifecycle contract, not a deployment
contract. A host may connect both sides with stdio for local testing, WebSocket
for an HTTP proxy path, Unix/TCP sockets for colocated processes, or a future
host connector.

### Plugin registration

The plugin manifest should expose one AgentHarness:

```json
{
  "id": "remote-harness",
  "name": "Remote Harness",
  "activation": {
    "onAgentHarnesses": ["remote-harness"]
  },
  "agentHarnesses": [
    {
      "id": "remote-harness",
      "displayName": "Remote Harness"
    }
  ]
}
```

The registered harness supports a run only when OpenClaw explicitly requests the
runtime id `remote-harness`. It should not silently take over normal model
runtime traffic.

Conceptually:

```ts
const remoteHarnessAgentHarness: AgentHarness = {
  id: "remote-harness",
  label: "Remote Harness",
  supports(ctx) {
    return requestedRuntimeId(ctx.requestedRuntime) === "remote-harness"
      ? { supported: true, priority: 100 }
      : { supported: false, reason: "remote-harness requires explicit runtime id" };
  },
  async runAttempt(params) {
    // Open configured transport, send RunStart, stream remote frames into
    // OpenClaw callbacks, then return terminal result.
  },
};
```

### Configuration

The gateway-side plugin should require explicit fail-closed configuration.

```ts
type RemoteHarnessConfig = {
  failClosed: true;
  allowFallback: false;
  allowedInnerHarnessIds: string[];
  defaultInnerHarnessId: string;
  transport: RemoteTransportConfig;
  egress: RemoteHarnessEgressConfig;
};

type RemoteTransportConfig =
  | { kind: "stdio"; command?: string; args?: string[] }
  | { kind: "websocket"; url: string; headers?: Record<string, string>; connect?: boolean }
  | { kind: "unix"; path: string; connect?: boolean }
  | { kind: "tcp"; host: string; port: number; connect?: boolean }
  | { kind: "connector"; id: string; options?: Record<string, unknown> };

type RemoteHarnessEgressConfig =
  | { mode: "disabled"; requireProxy: false }
  | { mode: "proxy"; requireProxy: true; proxyUrl: string };
```

Invariants:

- `failClosed` is always `true`.
- `allowFallback` is always `false`.
- `allowedInnerHarnessIds` must contain at least one id.
- `defaultInnerHarnessId` must be present in `allowedInnerHarnessIds`.
- Unknown top-level config fields are rejected.
- Transport configuration must not contain bearer tokens or broad credentials.
- If egress proxy enforcement is configured, startup fails unless enforcement is
  actually wired by the host.

### Frame protocol

The bridge uses JSON-serializable frames. Every frame carries a stable stream
context:

```ts
type RemoteHarnessStreamContext = {
  protocolVersion: 1;
  streamId: string;
  runId: string;
  sessionKey: string;
  workspaceId: string;
  seq: number;
};
```

Gateway to host frames:

```ts
type BrainFrame =
  | (RemoteHarnessStreamContext & {
      kind: "RunStart";
      innerHarnessId: string;
      input: JsonValue;
      context?: JsonValue;
    })
  | (RemoteHarnessStreamContext & { kind: "CancelRun"; reason?: string })
  | (RemoteHarnessStreamContext & { kind: "ApprovalDecision"; requestId: string; approved: boolean; reason?: string })
  | (RemoteHarnessStreamContext & { kind: "ToolAuthorizationDecision"; requestId: string; approved: boolean; reason?: string })
  | (RemoteHarnessStreamContext & { kind: "MemoryWriteDecision"; requestId: string; approved: boolean; reason?: string })
  | (RemoteHarnessStreamContext & { kind: "Heartbeat" });
```

Host to gateway frames:

```ts
type AgentFrame =
  | (RemoteHarnessStreamContext & { kind: "RunAccepted"; selectedInnerHarnessId: string; selectedInnerHarnessVersion: string })
  | (RemoteHarnessStreamContext & { kind: "AssistantDelta"; delta: string; text?: string })
  | (RemoteHarnessStreamContext & { kind: "ReasoningDelta"; delta: string })
  | (RemoteHarnessStreamContext & { kind: "ToolStarted"; toolCallId: string; name: string })
  | (RemoteHarnessStreamContext & { kind: "ToolProgress"; toolCallId: string; message: string })
  | (RemoteHarnessStreamContext & { kind: "ToolFinished"; toolCallId: string; result: JsonValue })
  | (RemoteHarnessStreamContext & { kind: "Checkpoint"; checkpointId: string; state: JsonValue })
  | (RemoteHarnessStreamContext & { kind: "ArtifactProduced"; artifactId: string; uri: string; metadata?: JsonValue })
  | (RemoteHarnessStreamContext & { kind: "ApprovalRequested"; requestId: string; prompt: string; details?: JsonValue })
  | (RemoteHarnessStreamContext & { kind: "ToolAuthorizationRequested"; requestId: string; toolName: string; details?: JsonValue })
  | (RemoteHarnessStreamContext & { kind: "MemoryWriteRequested"; requestId: string; proposedMemory: JsonValue })
  | (RemoteHarnessStreamContext & { kind: "RunFinal"; result: JsonValue })
  | (RemoteHarnessStreamContext & { kind: "RunFailed"; error: { message: string; code?: string } })
  | (RemoteHarnessStreamContext & { kind: "RunCancelled"; reason?: string })
  | (RemoteHarnessStreamContext & { kind: "Heartbeat" });
```

Frame invariants:

- `RunStart` is the first accepted frame for a stream.
- `protocolVersion`, `streamId`, `runId`, `sessionKey`, and `workspaceId` are
  immutable for the stream.
- Sequence numbers are monotonic per direction.
- Unknown frame kinds fail closed unless a future schema version defines
  capability negotiation.
- A malformed frame closes or rejects the stream; it must not crash the host.
- A terminal frame ends the run.

### Gateway-side behavior

When the remote harness AgentHarness runs:

1. Resolve run identity from OpenClaw attempt params.
2. Resolve the configured transport.
3. Create a remote stream id.
4. Send `RunStart` with the selected inner harness id and user input.
5. Translate `AgentFrame` events into OpenClaw callbacks.
6. For approval-like requests, call the corresponding OpenClaw callback and send
   the decision back as a `BrainFrame`.
7. On abort/cancel, send `CancelRun`, abort the transport, and return cancelled.
8. On `RunFinal`, return the terminal result.
9. On `RunFailed`, fail the attempt.

The gateway-side harness must not make model/provider calls directly unless the
selected inner harness explicitly asks through an OpenClaw-owned callback or
host-defined egress path.

### Host-side behavior

The host runtime receives frames, validates the session, and executes one
allowlisted inner harness at a time.

The host-side API should be small:

```ts
type InnerRunRequest = {
  runId: string;
  sessionKey: string;
  workspaceId: string;
  streamId: string;
  input: JsonValue;
  context?: JsonValue;
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

The reference host runtime should include an in-memory registry and a generic
command inner harness for local and product integration experiments. Command
inner harness execution must use an allowlist-style environment:

- pass ambient process basics such as `PATH`, `HOME`, `LANG`, `TZ`, and trusted
  CA bundle variables;
- pass explicit host-provided environment entries only after filtering sensitive
  credential-shaped names;
- abort the child process on cancellation;
- stream stdout as assistant text only after the process succeeds.

`deterministic-poc` may exist for repeatable tests, but it must be test-only and
must not become a production fallback.

### Runtime selection

OpenClaw should be able to select the remote harness through the same model
runtime configuration mechanism used by other runtimes.

Example:

```json
{
  "models": {
    "providers": {
      "anthropic": {
        "agentRuntime": { "id": "remote-harness" }
      }
    }
  }
}
```

Hosts that dynamically enable remote execution may apply this config at startup
or per run, but the upstream OpenClaw contract should remain simple: when the
model provider resolves to `agentRuntime.id = "remote-harness"`, OpenClaw asks
the remote harness AgentHarness to run.

### Transport authority

The transport is a routing mechanism, not an authority mechanism.

The upstream plugin should not require bearer tokens in OpenClaw-visible
configuration. If a host needs authenticated routing, it should put that
authority outside the plugin config, such as:

- process-local sockets;
- reverse-proxy admission;
- host-managed connector objects;
- short-lived substream metadata produced by the host runtime.

The remote agent must not treat hostnames, paths, or arbitrary request headers as
proof of user, session, workspace, or run identity. The host-owned `RunStart`
context is the authoritative identity for a stream.

### Compatibility and migration

This is additive:

- existing OpenClaw runtimes continue to work unchanged;
- existing plugins are not required to consume or implement the remote harness;
- the new plugin is selected only by explicit runtime configuration;
- unsupported transports or unavailable remote hosts fail the selected attempt
  rather than silently falling back.

The initial implementation may ship the plugin with a compatibility shim for the
current AgentHarness SDK types. Once the SDK exposes native remote-harness
extension points, the shim should be removed and imports should move to the
public SDK package.

## Rationale

The selected design uses the AgentHarness plugin seam instead of adding a new
special-purpose execution path to OpenClaw core.

That keeps the OpenClaw core model simple: model runtime selection chooses an
AgentHarness, and the AgentHarness owns the execution details. A remote harness
is different operationally, but from OpenClaw's perspective it still produces
the same stream of attempt events and terminal result as any other harness.

A typed frame protocol is preferred over forwarding opaque process stdio because
OpenClaw needs to preserve structured events. Tool progress, approvals,
checkpoints, artifacts, memory writes, cancellation, and final results should not
be parsed out of free-form text.

A host-side inner harness registry is preferred over hard-coding a specific
remote agent. It lets upstream OpenClaw provide the bridge and reference host
while product integrations decide which command or runtime should run behind
that bridge.

Fail-closed selection is deliberate. If a user or host explicitly selected
remote execution, silently falling back to a local model runtime can violate
deployment policy, egress policy, reproducibility expectations, or canary
controls. Headerless or default runtime selection can continue using existing
OpenClaw behavior, but explicit remote selection must either run remotely or
fail.

The proposal avoids putting tokens in plugin config because plugin config is
often visible to host tooling, logs, diagnostics, or user-editable config files.
Host integrations can still enforce authenticated routing, but that authority
belongs outside the OpenClaw-visible transport object.

## Unresolved questions

- Should the first upstream version include a `connector` transport, or should it
  ship only stdio, WebSocket, TCP, and Unix socket transports until a connector
  SDK exists?
- Should frame capability negotiation be part of protocol version 1, or should
  v1 reject unknown frame kinds and defer negotiation to version 2?
- Which OpenClaw SDK package should own the public frame types?
- Should OpenClaw expose `workspaceId` as a first-class AgentHarness attempt
  parameter, or should hosts continue mapping from session identity until a
  broader workspace API exists?
- What is the right conformance suite for third-party remote harness hosts?
- Should remote harness runs participate in any existing OpenClaw transcript or
  context-engine runtime settings payloads beyond the normal AgentHarness event
  stream?
