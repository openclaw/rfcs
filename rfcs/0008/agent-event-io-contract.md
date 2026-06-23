<!--
Agent Event I/O Contract — base contract for RFC 0008 (normalized provider→channel stream grammar).

Origin: extracted from openclaw/openclaw #92216 (fix(gateway): mirror hidden commentary-phase
assistant events), docs commit f92c1bfcd2. The upstream maintainer asked that this contract be
split out of that behavior PR so it could be owned and edited separately from runtime code; this
RFC sidecar is that separately-ownable home. RFC 0008's four [AMENDS BASE] points are folded into
this file inline, each marked "[RFC 0008 amendment, §x.x]" so the as-split #92216 baseline and the
RFC 0008 deltas stay distinguishable for the maintainer who owns the upstream contract.

Contributed for RFC 0008 by ragesaq (as-split baseline); amendments folded in for RFC 0008.
-->
---
summary: "Provider input and channel output contract for assistant commentary, tool activity, lifecycle, and final answers"
read_when:
  - Mapping a provider stream into OpenClaw agent events
  - Forwarding agent activity to a chat channel or external client
  - Debugging missing preamble, commentary, or tool progress in channel sessions
title: "Agent event I/O contract"
---

# Agent Event I/O Contract

OpenClaw has two separate responsibilities in a running agent turn:

1. Provider and runtime adapters normalize model/tool activity into OpenClaw agent events.
2. Channel adapters project those normalized events into channel-native user experience.

Provider APIs are allowed to differ. OpenClaw events are not. Once an adapter emits onto the
agent-event bus, downstream channel code must not need to know whether the source was OpenAI,
Claude, Codex, ACP, a CLI backend, or a plugin harness.

This contract defines that boundary.

## Why this exists

OpenClaw already had working runtime events, but ClickClack channel-originated runs did not receive
assistant commentary in their preamble because hidden channel sessions were only mirroring tool
events and a narrow thinking stream. Control UI runs saw more data than channel sessions. The bug
was not in the model and not in ClickClack rendering; it was a missing gateway contract between
normalized provider events and session-scoped channel subscribers.

The rule is now explicit: if a provider emits channel-eligible progress, every channel session bound
to that run must be able to receive it through the normalized session event path, whether or not the
Control UI is visible.

## Current event envelope

The public gateway shape is `AgentEvent` in `packages/gateway-protocol/src/schema/agent.ts`:

```ts
{
  runId: string;
  seq: number;
  stream: string;
  ts: number;
  data: Record<string, unknown>;
}
```

The enriched in-process gateway payload is `AgentEventPayload` in `src/infra/agent-events.ts`:

```ts
{
  runId: string;
  seq: number;
  stream: AgentEventStream;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
}
```

`runId`, `seq`, `stream`, `ts`, and `data` are the portable event identity. `sessionKey`,
`sessionId`, and `agentId` are routing stamps applied from run context so subscribers can receive
only the session and agent they selected.

## Layer contract

| Layer                  | Owns                                                                                         | Must not own                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Provider adapter       | Mapping provider-native stream chunks into OpenClaw streams and phases                       | Channel names, channel-specific row kinds, UI collapse behavior |
| Runtime bus            | Sequencing, timestamps, run context stamping, listener fan-out                               | Provider-specific parsing after normalization                   |
| Gateway session mirror | Delivering normalized events to visible Control UI and hidden channel-session subscribers    | Reclassifying model semantics based on channel UI state         |
| Channel adapter        | Durable or transient projection into native channel rows, drafts, preambles, or status lines | Guessing provider semantics from raw provider payloads          |

## Provider input contract

Provider and harness adapters emit normalized OpenClaw events. They must preserve semantic intent,
not provider quirks.

### Required envelope behavior

- Emit every event for the correct `runId`.
- Register run context before event emission when the event must route to a session.
- Let the event bus assign monotonically increasing `seq` values per run.
- Set `stream` to the normalized OpenClaw surface, not the provider's raw event name.
- Put provider details in `data`, using the canonical fields below when available.
- Do not emit channel-specific kinds such as `agent_commentary`, `agent_tool`, Slack block names, or
  ClickClack message kinds from provider code.

### Assistant text events

Use `stream: "assistant"` for assistant-visible text.

Canonical `data` fields:

```ts
{
  delta?: string;
  text?: string;
  phase?: "commentary" | "final_answer";
  id?: string;
  status?: "in_progress" | "completed";
}
```

Rules:

- `delta` is incremental text for the current assistant segment.
- `text` is a full snapshot or complete assistant segment.
- A frame with `delta` and no `text` is valid. Consumers must not require `text` before forwarding
  a non-empty `delta`.
- `phase: "commentary"` means visible progress, preamble, narration, or interim assistant text. It
  is not the final answer.
- `phase: "final_answer"` means terminal answer text. It must not be mirrored into commentary or
  preamble outputs.
- Missing `phase` plus non-empty `delta` is live assistant text. Gateways may forward it as
  progress unless a later or enclosing provider signal marks it as final.
- Private reasoning, hidden analysis, chain-of-thought, and provider-only traces must use a
  separate stream such as `thinking`. They must not be disguised as assistant commentary.
  **[RFC 0008 amendment, §3.2]** Wire-carried reasoning must **not** be dropped before event
  emission: emission onto the `thinking` stream is unconditional whenever the wire carries
  reasoning, and display is gated downstream at presentation. (The earlier "or must be dropped
  before event emission" allowance is removed — a dropped thought cannot be shown by a later
  `/reasoning on`, nor archived.)

### Tool and item events

Use the normalized activity streams for non-prose work:

- `stream: "tool"` for tool lifecycle payloads already emitted by the runtime.
- `stream: "item"` for display-ready activity items shaped by `AgentItemEventData`.
- `stream: "command_output"`, `patch`, `approval`, `plan`, and `compaction` for their typed
  activity surfaces.

`item` stream data should follow `AgentItemEventData`:

```ts
{
  itemId: string;
  phase: "start" | "update" | "end";
  kind: "tool" | "command" | "patch" | "search" | "analysis" | string;
  title: string;
  status: "running" | "completed" | "failed" | "blocked";
  name?: string;
  meta?: string;
  toolCallId?: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  summary?: string;
  progressText?: string;
}
```

Rules:

- Emit `phase: "start"` at the earliest moment the call id and name are available (first tool-call
  delta, Anthropic `content_block_start`, Responses `output_item.added`) — never delayed until
  argument assembly completes. **[RFC 0008 amendment, §3.3]** (Tightens the prior "before the tool
  or command begins whenever the provider/runtime knows the call in advance.")
- Emit `phase: "end"` after completion, failure, or cancellation.
- Reuse `itemId` and `toolCallId` across updates for the same logical tool call.
- Keep `title`, `name`, `meta`, and `summary` display-safe. Redact secrets, tokens, credentials,
  raw headers, and private paths unless an explicit channel setting permits raw command detail.
- Use `suppressChannelProgress: true` only when another sibling event already carries the channel
  progress for the same item.

### Lifecycle and terminal events

Use `stream: "lifecycle"` for run lifecycle.

Required behavior:

- Emit start/end/error phases for the run when the runtime can do so.
- On abort, stop forwarding new assistant commentary or tool progress for that run.
- Terminal lifecycle must settle `agent.wait` and any channel progress state.
- A lifecycle end is not itself a final answer. Final answer text belongs to the final reply path.

### Provider mapping guide

| Provider or harness surface                                | Map to                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| OpenAI/Codex streamed output text with commentary metadata | `stream: "assistant"`, `data.phase: "commentary"`, `data.delta` or `data.text`   |
| OpenAI/Codex delta frame with no full text                 | `stream: "assistant"`, `data.delta`; do not drop it because `text` is missing    |
| OpenAI/Codex final output text                             | final reply path and, if emitted as an event, `data.phase: "final_answer"`       |
| Function/tool call begin                                   | `stream: "item"` or `tool` with start/running status before execution            |
| Function/tool call result                                  | `stream: "item"` or `tool` with end/completed or end/failed status               |
| Claude/Anthropic inter-tool narration                      | `stream: "assistant"`, `data.phase: "commentary"` when it is visible narration   |
| Claude/Anthropic thinking/reasoning                        | `stream: "thinking"` (variant `raw`/`summary`/`redacted`); never dropped — display gated downstream **[RFC 0008, §3.2]** |
| Harmony `commentary` channel text                          | `stream: "assistant"`, `data.phase: "commentary"`                                |
| Harmony `final` channel text                               | final reply path and, if emitted as an event, `data.phase: "final_answer"`       |
| Harmony `analysis` channel text                            | `stream: "thinking"`; never dropped **[RFC 0008, §3.2]**                          |
| ACP or subagent progress/status                            | `stream: "item"` or `lifecycle`; not assistant final text                        |
| Non-streaming provider with one final response             | final reply path only, unless the provider emits separate progress               |

## Gateway session mirror contract

The gateway has two subscriber classes:

- Control UI subscribers: the operator-visible UI is attached to the run or session.
- Hidden channel-session subscribers: a channel bridge is attached to a session, but the Control UI
  is not the active surface for that run.

Both subscriber classes must be able to receive channel-eligible runtime activity.

### Must mirror to hidden channel-session subscribers

When `isControlUiVisible` is false, the gateway must mirror these events to the exact session
subscriber set selected by `resolveSessionDeliveryKey(sessionKey, agentId)`:

- **[RFC 0008 amendment, §5.1]** `stream: "thinking"` events (all variants: `raw`, `summary`,
  `redacted`), mirrored on their own stream — never disguised as commentary. Display suppression is
  the channel's job, not the gateway's.
- Tool lifecycle/progress events that channels use for tool rows or progress status.
- Assistant commentary: `stream: "assistant"` with `data.phase === "commentary"` and non-empty
  `text` or `delta`.
- Assistant delta-only progress: `stream: "assistant"` with non-empty `data.delta`, unless the
  phase is `final_answer`.
- Item start/update/end events that are intended for channel progress projection.
- Lifecycle terminal state needed to close progress displays.

### Must not mirror as hidden commentary

- `stream: "assistant"` with `data.phase === "final_answer"`.
- Empty assistant frames with neither non-empty `delta` nor non-empty `text`.
- Private reasoning or analysis events **disguised as commentary**. **[RFC 0008 amendment, §5.1]**
  Reasoning is still mirrored — on the `thinking` stream (see the mirror list above), not the
  commentary path; this rule forbids only re-tagging it as `assistant`/`commentary`.
- Events from aborted runs after the abort guard is active.
- Events for a different `sessionKey` or `agentId`.

### Backpressure

Live progress events may use `dropIfSlow: true` because they are incremental. Final user-visible
answer delivery must not depend on a drop-if-slow event path.

## Channel output contract

Channel adapters consume normalized gateway events and project them into channel-native output.
They choose persistence and rendering, but not semantics.

### Output kinds

| Normalized source             | Channel output                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Final answer                  | Durable normal message                                                         |
| `assistant` commentary/delta  | Progress draft, preamble row, or channel equivalent such as `agent_commentary` |
| `tool` or display-safe `item` | Tool progress row, status line, or channel equivalent such as `agent_tool`     |
| Lifecycle end/error           | Close, collapse, or mark progress as complete/failed                           |

ClickClack's current durable projection uses:

- `kind: "message"` for normal user and final assistant messages.
- `kind: "agent_commentary"` for assistant preamble/progress text.
- `kind: "agent_tool"` for tool-call activity rows.

Other channels may use editable drafts, native status APIs, or transient previews instead of durable
activity rows. The source semantics stay the same.

### Ordering and grouping

- Group progress by logical turn, using `runId` or a channel-specific `turn_id` derived from it.
- Interleave commentary and tool rows by normalized `seq` when both are available.
- Preserve durable channel order with the channel's own sequence field when messages are stored.
- Collapse or hide old progress only as presentation. Do not merge progress into the final answer
  body unless the channel explicitly uses a transient preview model.
- If activity is durable, keep it inspectable after final answer delivery. Collapsed is acceptable;
  deleted without policy is not.

### Idempotency

Channels should use stable keys to avoid duplicate progress:

- Assistant commentary segment: a provider item id **only where the provider supplies a stable
  one** (Anthropic block index; Responses composite `item_id:content_index` — `item_id` alone
  collapses distinct segments), else `runId + seq`. **[RFC 0008 amendment, §7.3]** Synthesized
  counters are forbidden as idempotency keys — they are reconnect-unstable.
- Tool item: `runId + itemId + phase`, or `runId + toolCallId + phase`.
- Final answer: normal message idempotency and delivery mirror rules, not the progress key.

Repeated updates for the same item should patch or replace the previous channel activity row when
the channel supports edits. Append-only channels may post bounded updates, but must avoid replaying
the same event as a new row on reconnect.

### Security and privacy

Channel projection must respect the least revealing output that still tells the user work is
happening:

- Show tool names and short status by default.
- Hide raw command text, raw arguments, environment values, credentials, API keys, and private file
  contents unless a channel-specific setting explicitly enables that detail.
- Never send private reasoning to external channels as commentary.
- Treat `commentary` as user-visible progress, not as hidden thought.

### User promise

If a channel shows "the agent is working," it must be backed by runtime events, not model prompt
discipline. Agents should not need to narrate around long tools for the UI to remain alive.

## Test contract

Every provider or channel change that touches this boundary should include focused tests for the
contract surface it changes.

Provider/runtime tests:

- Commentary with `text` and `delta` emits `stream: "assistant"` with `phase: "commentary"`.
- Delta-only assistant frames emit and survive normalization.
- Final-answer frames are distinguishable from commentary.
- Tool start emits before execution when the runtime knows the call before dispatch.
- Abort stops later channel-progress forwarding.

Gateway mirror tests:

- Hidden session subscribers receive assistant commentary.
- Hidden session subscribers receive delta-only assistant progress.
- `final_answer` is not mirrored as commentary.
- The selected session receives the event, and other sessions do not.
- Global broadcasts and node/channel sends are not accidentally invoked by the hidden-session mirror.
- Slow progress subscribers may drop progress without affecting final delivery.

Channel tests:

- A real channel-originated turn displays tool activity and assistant commentary before the final
  answer.
- A final answer still arrives once and only once.
- Preamble or progress ordering matches runtime event order.
- Reload or reconnect does not duplicate durable activity rows.
- Before/after proof uses a real configured channel, not a synthetic fixture only.

## Regression example: hidden ClickClack commentary

The ClickClack failure that motivated this contract had this shape:

1. A user typed into a ClickClack channel.
2. OpenClaw ran the agent with `isControlUiVisible: false`.
3. Runtime tool events reached session subscribers and rendered as tool rows.
4. Runtime assistant commentary stayed on the visible-Control-UI path and did not reach the hidden
   session bridge.
5. ClickClack could render `agent_tool` rows, but had no `agent_commentary` rows to render.

The fix mirrored channel-eligible `assistant` commentary and delta-only frames to hidden
session-scoped subscribers while continuing to exclude `final_answer`.

That is the baseline expected behavior for every provider and channel integration going forward.

## Related

- [Agent loop](https://docs.openclaw.ai/concepts/agent-loop)
- [Streaming and chunking](https://docs.openclaw.ai/concepts/streaming)
- [Channel routing](https://docs.openclaw.ai/channels/channel-routing)
- [ClickClack](https://docs.openclaw.ai/channels/clickclack)
