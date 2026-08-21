# Control Model v1 specification

This document defines the candidate behavioral contract for
`@openclaw/gateway-client/model`. It specifies framework-neutral state and
commands above the Gateway Client browser transport. It does not define
presentation, product authentication, or another wire protocol.

Status: draft. This is a fork-only preview and has not been submitted or
accepted upstream.

## Scope

A conforming v1 model provides:

- explicit lifecycle and disposal;
- immutable connection and session-catalog snapshots;
- lazily created conversation snapshots;
- history/live/reconnect reconciliation;
- typed tool, approval, question, and run state needed by chat;
- typed commands with structured failure;
- renderer-neutral UI artifacts; and
- finite retained state with observable partial/lag conditions.

## Host binding

The model consumes one host-owned Gateway binding. The binding must provide:

- the current connection snapshot and an invalidation subscription;
- Gateway event subscription;
- correlated request execution;
- the accepted hello/protocol metadata required for feature detection; and
- typed request and connection errors.

The binding is a construction-only capability for the host and model
implementation. It must not be exposed through public snapshots, conversation
handles, artifacts, renderer registrations, or framework adapters.

The host owns:

- socket creation and route selection;
- credentials, signing, and device-token persistence;
- product authentication and tenant admission;
- reconnect policy outside shared Gateway-client behavior; and
- logging and telemetry sinks.

The model must not start a network connection at import or construction time.
It must not persist credentials.

## Handshake & capability advertisement

Recommendation: the client advertises a bounded capability object during the
initial session handshake or subscription request so the server MAY filter or
rank offered artifact views and avoid sending unsupported large artifacts.
Advertisement is advisory only; it does not grant trust or authorization.

Suggested capability object (client → server):

```
{
  "clientId": "product/instance-version",
  "capabilities": {
    "supports_html": true,
    "supports_a2ui": false,
    "supports_native_table": true,
    "supports_streaming": true,
    "supports_actions": true,
    "max_artifact_size_bytes": 65536
  }
}
```

Server guidance:

1. If an offered view's renderer matches a supported capability, favor
   sending the full view (streaming when streamable && supports_streaming).
2. If the renderer is unsupported but a structured/text fallback exists,
   send the fallback instead.
3. If artifact size exceeds `max_artifact_size_bytes` and the client
   supports streaming, deliver as fragments (fragment/CID) with finalization
   marker; otherwise send a summarized structured fallback.
4. Never expose private or scrubbed fields to clients lacking required
   authorization regardless of advertised capabilities.
5. Treat capability advertisement as potentially stale or incomplete; the
   client may still decline or ignore offers at render time.

Note: this section proposes a concrete handshake schema and server filtering
rules. The full RFC update will include example exchanges, security privacy
considerations, and an appendix mapping uiDetails fields to capability flags.
## Root lifecycle

Construction is inert except for validating options. `start()` may subscribe to
an already managed Gateway binding; alternatively, construction may start
subscriptions when the API makes that behavior explicit. The selected shape
must have one unambiguous lifecycle.

`dispose()` is idempotent and must:

- unsubscribe from Gateway state and events;
- abort or retire model-owned refreshes;
- wake model waiters with a terminal disposed error;
- retire conversation epochs;
- release retained snapshots not reachable by the caller; and
- prevent later events from mutating published state.

No subscription callback may fire after its unsubscribe function returns,
except a callback already executing on the same stack.

Gateway event callbacks must not synchronously run consumer render or
subscriber work. The model may enqueue bounded reconciliation work and publish
outside the protocol receive stack. It must not await subscribers. One
subscriber exception must not prevent other subscribers or future Gateway
events from being processed.

## Snapshot contract

Snapshots are immutable values. A consumer must be able to:

1. read a snapshot;
2. subscribe;
3. read again to close the read/subscribe race; and
4. compare snapshot identity to determine whether state changed.

Every state transition publishes a new root or capability snapshot identity.
Unchanged state must retain identity where practical to avoid unnecessary
renderer work.

Snapshots use JSON-compatible data except documented opaque handles. Dates are
ISO-8601 strings or integer epoch milliseconds consistently within one public
type family.

## Connection snapshot

The connection projection contains:

- phase: stopped, connecting, connected, reconnecting, offline, or disposed;
- a monotonically increasing connection epoch;
- accepted protocol version and declared capabilities where available;
- current session/instance identity safe for presentation;
- structured last error and reconnect classification; and
- whether state is complete, stale, partial, or resynchronizing.

A transport connection alone does not imply conversation readiness. Readiness
requires the required initial snapshots or an explicit partial state.

## Session catalog

The catalog contains stable session keys and the Gateway-authoritative fields
needed to list and identify sessions. Unknown additive fields must not break
projection.

The model owns:

- initial list loading;
- live `sessions.changed` reconciliation;
- explicit deleted-session handling;
- refresh after sequence gaps or observer outages;
- duplicate suppression;
- connection-epoch retirement;
- bounded retry for retryable observer errors; and
- typed loading, refreshing, stale, and error state.

Any future optional catalog mutation must specify reconciliation and rollback.
A failed mutation must not leave success-shaped catalog state.

## Conversation model

`conversation(sessionKey)` returns a stable model handle for that normalized
session key until release or root disposal. A host may release inactive
conversation handles through an explicit API. The package must bound inactive
retention.

The conversation snapshot contains:

- normalized session identity;
- loading, ready, stale, partial, terminal, and error state;
- canonical ordered messages with stable IDs;
- the active run and stream projection;
- tool invocations and outcomes;
- approval and question requests;
- UI artifacts;
- command availability hints; and
- the connection and history revisions used to derive the snapshot.

## History and live reconciliation

The model must define one deterministic merge for:

- an initial or refreshed history response;
- live messages received before, during, or after history loading;
- duplicate live and persisted messages;
- live tool calls and later persisted tool results;
- run start, progress, terminal, abort, and disconnect;
- sequence gaps;
- history truncation or pagination; and
- reconnection to a replacement Gateway client.

Stable server IDs are authoritative. Where the server does not provide an ID,
the model may derive a bounded provisional key, but it must expose provisional
status and reconcile it when canonical state arrives.

A reconnect must not duplicate a message, tool invocation, approval, question,
or UI artifact. Events from a retired connection epoch must not mutate the
current conversation.

When a gap prevents complete reconciliation, the model publishes explicit
partial/stale state and requests an authoritative refresh. It must not silently
continue with success-shaped complete state.

## Tool and run projection

Every tool invocation has:

- a stable call ID;
- tool identity safe for display;
- finite structured input or a redacted/unavailable marker;
- pending, running, succeeded, failed, cancelled, or unknown outcome;
- live progress with finite retention;
- structured output or a redacted/unavailable marker;
- associated UI artifact IDs; and
- timestamps/revisions needed for deterministic ordering.

Approved-but-failed execution remains distinct from approval denial.
Cancellation remains distinct from failure. Unknown output is not success.

Progress retention must be bounded by count and bytes. Truncation is explicit.

## Approval and question projection

An approval or question contains:

- a stable request ID and owning session/run/tool identity;
- typed presentation-safe description;
- exactly the actions currently allowed by the Gateway contract;
- pending, answered, expired, cancelled, or unavailable lifecycle;
- an optional deadline; and
- structured source/authority information safe for presentation.

The model must reject a locally requested action that is not in the current
allowed set, but that preflight is not authorization. The Gateway independently
authorizes the request.

When the server provides a safe denial reason, policy source, or responsible
owner, the projection preserves it so adapters can present an actionable
explanation rather than a generic disabled state. Adapters must not widen or
replace the server-provided allowed-action set.

## Commands

Candidate v1 commands are:

- refresh session catalog;
- load/refresh conversation history;
- send chat content and supported attachments;
- abort the active run;
- answer a question;
- approve or deny a pending request; and
- materialize one exact deferred UI view for the current artifact revision; and
- retry only where the Gateway exposes a safe retry contract.

Session creation, rename, archive, delete, and other administration operations
are not required by v1 conformance. A later optional capability must add its own
independent-adopter, authorization, reconciliation, rollback, and deletion
evidence.

Each command defines:

- required current state;
- exact Gateway method and parameter contract;
- whether it is idempotent;
- abort behavior;
- stale/retired epoch behavior;
- optimistic state, if any;
- success result; and
- typed failures.

The model must not retry a non-idempotent command automatically unless the
Gateway contract provides an idempotency key and the retry preserves it.

## Error contract

Public errors distinguish at least:

- disconnected or not ready;
- disposed;
- unsupported by negotiated capability;
- invalid input;
- stale connection/session epoch;
- forbidden;
- conflict;
- not found or expired;
- timeout or abort;
- retryable transport/startup failure;
- sequence gap/partial state; and
- malformed or incompatible server data.

Errors preserve safe canonical codes, retryability, and retry-after hints where
available. Arbitrary server details, credentials, raw headers, and unbounded
payloads must not enter public messages or logs.

## Bounds

V1 must define finite defaults for:

- retained inactive conversations;
- messages per loaded page and total retained pages;
- live progress lines and bytes;
- pending tool/approval/question entries;
- UI artifacts per message/conversation;
- artifact data bytes/depth;
- observer retry delay;
- refresh concurrency; and
- command timeout inheritance.

The package must expose truncation, pagination, or partial state rather than
silently dropping retained state.

The implementation must also bound queued reconciliation work between Gateway
event delivery and snapshot publication. Exceeding that bound produces an
explicit lag/partial state and authoritative refresh rather than unbounded
memory growth.

## Framework neutrality

The published runtime graph must not import:

- Lit, React, Vue, Svelte, or framework adapters;
- DOM custom elements or browser storage;
- Control UI routes, theme, localization, CSS, or components;
- product authentication or telemetry; or
- Node-only modules from the browser entry.

Framework adapters may live in separate optional packages or adopter
repositories.

## Required conformance evidence

Before v1 support is claimed, shared fixtures must cover:

- read/subscribe race closure and immutable identity;
- initial session list plus live create/update/delete;
- retryable observer outage and authoritative refresh;
- history/live overlap;
- duplicate and out-of-order message/tool events;
- sequence gap and explicit partial state;
- reconnect with retired-epoch event rejection;
- active stream completion, cancellation, and disconnect;
- approval allowed/denied/expired paths;
- typed command rejection and conflict;
- artifact association and revision ordering;
- bounds and truncation; and
- disposal during every active wait.

At least OpenClaw Control UI and one independent host must consume the same
fixtures before publication.
