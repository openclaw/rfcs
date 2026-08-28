# Remote Harness Protocol v1 Supporting Reference

This sidecar supports RFC 0010. The RFC body owns the normative proposal,
protocol schema tables, and vocabulary. This document keeps review aids that
would make the RFC body harder to read inline: validation matrices, golden
transcript sketches, and conformance scenarios.

## Validation matrix

| Area | Valid case | Invalid case | Required behavior |
| --- | --- | --- | --- |
| Envelope version | `protocolVersion` is `1` | absent, null, or not `1` | Reject frame and fail closed for core frames. |
| Stream identity | `streamId`, `runId`, `sessionKey`, and `workspaceId` match the stream | any immutable identity field changes mid-stream | Reject stream as protocol violation. |
| Sequencing | `seq` increases by direction | duplicate, zero, negative, or lower/equal sequence | Reject or close stream without applying payload. |
| First frame | Gateway sends `RunStart` first | any other Gateway-to-host frame starts stream | Host rejects stream. |
| Acceptance ordering | Host sends `RunAccepted` before non-terminal events | host sends assistant/tool/event frames before `RunAccepted` | Gateway rejects stream. |
| Terminal uniqueness | exactly one `RunFinal`, `RunFailed`, or `RunCancelled` | more than one terminal frame | Gateway ignores stale duplicate only after identity validation and records protocol error. |
| Unknown core kind | kind is listed in RFC schema tables | unknown non-extension kind | Reject fail-closed in v1. |
| Extension stream | namespaced stream is allowlisted | namespaced stream not allowlisted | Reject event or fail attempt according to policy. |
| Gateway decisions | host correlates explicit decision by `requestId` | host proceeds without decision or with mismatched `requestId` | Treat as protocol violation. |
| Transport authority | identity comes from `RunStart` | host header/path/hostname attempts to set identity | Ignore transport metadata and reject if it conflicts with stream context. |
| Credentials | config contains only endpoint/routing data | OpenClaw-visible config contains broad bearer/provider/caller tokens | Reject configuration. |

## Golden transcript sketches

These sketches show event order and required semantic preservation. They are not
wire dumps; the RFC body defines the schema fields.

### Successful assistant-only run

```text
Gateway -> Host: RunStart(seq=1)
Host -> Gateway: RunAccepted(seq=1)
Host -> Gateway: AgentEvent(stream=lifecycle, phase=start, seq=2)
Host -> Gateway: AssistantMessageStart(seq=3)
Host -> Gateway: AssistantDelta(delta="hello", text="hello", seq=4)
Host -> Gateway: UsageUpdate(seq=5)
Host -> Gateway: AgentEvent(stream=lifecycle, phase=end, seq=6)
Host -> Gateway: RunFinal(seq=7)
```

Expected Gateway behavior:

- local lifecycle start/end events are emitted;
- assistant text streams to live surfaces;
- usage is attached when supported;
- terminal result maps to a successful AgentHarness attempt.

### Approval denial

```text
Gateway -> Host: RunStart(seq=1)
Host -> Gateway: RunAccepted(seq=1)
Host -> Gateway: ApprovalRequested(requestId=approval-1, seq=2)
Gateway -> Host: ApprovalDecision(requestId=approval-1, approved=false, seq=2)
Host -> Gateway: AgentEvent(stream=approval, status=denied, seq=3)
Host -> Gateway: RunFailed(error.code=approval_denied, seq=4)
```

Expected Gateway behavior:

- approval is presented through normal OpenClaw policy/UI routes;
- denial is visible in approval event state;
- host does not run the denied action;
- terminal failure is replay-safe when no side effect occurred.

### Permission denial

```text
Gateway -> Host: RunStart(seq=1)
Host -> Gateway: RunAccepted(seq=1)
Host -> Gateway: PermissionRequested(requestId=perm-1, seq=2)
Gateway -> Host: PermissionDecision(requestId=perm-1, permissions={}, scope=turn, seq=2)
Host -> Gateway: AgentEvent(stream=approval, status=denied/unavailable, seq=3)
Host -> Gateway: RunFailed(error.code=permission_denied, seq=4)
```

Expected Gateway behavior:

- OpenClaw owns permission policy and grant scope;
- missing UI route results in denied or unavailable, not implicit approval;
- terminal lifecycle records the failure.

### Dynamic tool call

```text
Gateway -> Host: RunStart(seq=1)
Host -> Gateway: RunAccepted(seq=1)
Host -> Gateway: DynamicToolCallRequested(requestId=tool-1, tool=web_search, seq=2)
Gateway -> Host: DynamicToolResponse(requestId=tool-1, success=true, seq=2)
Host -> Gateway: ToolStarted(toolCallId=tool-1, seq=3)
Host -> Gateway: ToolFinished(toolCallId=tool-1, isError=false, seq=4)
Host -> Gateway: RunFinal(seq=5)
```

Expected Gateway behavior:

- Gateway validates and executes the dynamic tool;
- result redaction follows normal tool policy;
- tool lifecycle is visible in the activity stream.

### Command output and patch summary

```text
Gateway -> Host: RunStart(seq=1)
Host -> Gateway: RunAccepted(seq=1)
Host -> Gateway: ToolStarted(toolCallId=exec-1, name=bash, seq=2)
Host -> Gateway: AgentEvent(stream=item, kind=command, phase=start, seq=3)
Host -> Gateway: AgentEvent(stream=command_output, phase=delta, seq=4)
Host -> Gateway: ToolFinished(toolCallId=exec-1, isError=false, seq=5)
Host -> Gateway: AgentEvent(stream=command_output, phase=end, seq=6)
Host -> Gateway: AgentEvent(stream=patch, phase=end, seq=7)
Host -> Gateway: RunFinal(seq=8)
```

Expected Gateway behavior:

- command output streams as command output, not only generic text;
- patch summary reaches the patch stream;
- activity-feed item state transitions from running to completed.

### Compaction followed by retry

```text
Gateway -> Host: RunStart(seq=1)
Host -> Gateway: RunAccepted(seq=1)
Host -> Gateway: AgentEvent(stream=compaction, phase=start, seq=2)
Host -> Gateway: AgentEvent(stream=compaction, phase=end, completed=true, willRetry=true, seq=3)
Host -> Gateway: AssistantMessageStart(seq=4)
Host -> Gateway: AssistantDelta(seq=5)
Host -> Gateway: RunFinal(seq=6)
```

Expected Gateway behavior:

- before/after compaction hooks or equivalent lifecycle are observable;
- retry state is visible;
- stale usage before the latest compaction is not treated as the final turn's
  usage.

### Cancellation

```text
Gateway -> Host: RunStart(seq=1)
Host -> Gateway: RunAccepted(seq=1)
Gateway -> Host: CancelRun(reason=user, seq=2)
Host -> Gateway: RunCancelled(reason=user, seq=2)
```

Expected Gateway behavior:

- cancellation is correlated to the same stream identity;
- terminal lifecycle records cancellation;
- no later non-terminal frames are applied.

### Malformed unknown core frame

```text
Gateway -> Host: RunStart(seq=1)
Host -> Gateway: RunAccepted(seq=1)
Host -> Gateway: UnknownCoreFrame(seq=2)
Gateway: reject stream and surface remote protocol failure
```

Expected Gateway behavior:

- unknown core frame does not get ignored silently;
- user-visible terminal failure or diagnostic is emitted;
- the host cannot smuggle unsupported behavior through an extension path.

## Conformance checklist

A v1 implementation passes conformance when it proves:

- frame schemas validate for all core frame families listed in the RFC;
- `RunStart` ordering, `RunAccepted` ordering, immutable identity, sequencing,
  and terminal uniqueness are enforced;
- unknown core frame kinds fail closed;
- unknown extension streams require allowlist admission;
- Gateway-owned decision requests never proceed without an explicit decision;
- assistant, reasoning, plan, tool, item, approval, command output, patch,
  compaction, lifecycle, diagnostic, usage, and terminal events map to expected
  OpenClaw surfaces;
- cancellation and timeout produce terminal lifecycle metadata;
- request headers, route metadata, and hostnames cannot override stream identity;
- OpenClaw-visible config and default remote-agent container environment do not
  contain broad provider/model/caller credentials;
- golden transcript tests and an executable fake host cover success, approval
  denial, permission denial, user-input, dynamic-tool, compaction, patch,
  command output, cancellation, timeout, malformed frame, and unsupported event
  cases.

## Suggested test fixture inventory

| Fixture | Purpose |
| --- | --- |
| `success-assistant-only.jsonl` | Minimal accepted run with assistant text and final result. |
| `approval-denied.jsonl` | Approval request/decision correlation and fail-closed denial. |
| `permission-denied.jsonl` | Permission policy remains Gateway-owned. |
| `dynamic-tool-success.jsonl` | Gateway executes and returns a dynamic-tool result. |
| `command-output-patch.jsonl` | Command output and patch event preservation. |
| `compaction-retry.jsonl` | Compaction lifecycle and retry state. |
| `cancelled.jsonl` | Cancellation ordering and terminal state. |
| `malformed-identity-change.jsonl` | Immutable identity enforcement. |
| `unknown-core-frame.jsonl` | v1 unknown core frame fail-closed behavior. |
| `unknown-extension-stream.jsonl` | Extension stream allowlist behavior. |
