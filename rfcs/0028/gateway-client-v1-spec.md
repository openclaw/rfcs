# Rust Gateway client v1 specification

This document defines the proposed v1 behavioral contract for the
`openclaw-gateway-client` crate described by RFC 0028. It specifies a reusable,
role-neutral Gateway session. It does not define node behavior, credential
storage, a product shell, or a second Gateway protocol.

Status: draft. The canonical Gateway protocol and server behavior remain
authoritative. The Rust API remains unstable until the RFC ownership and
release decisions are accepted.

## Scope

A conforming client provides:

- secure WebSocket establishment;
- challenge-before-connect ordering;
- caller-supplied connect parameters;
- correlated requests and responses;
- bounded event delivery and request concurrency;
- typed closure, protocol, transport, TLS, timeout, and Gateway failures; and
- enough structured recovery metadata for an embedding to decide whether to
  retry, pause, repair configuration, or replace a rejected credential.

The client must remain independent of Tauri, the node role, product IPC,
platform key stores, command execution, approvals, and management-plane policy.

## Authority and compatibility

The published OpenClaw Gateway protocol is the wire authority. The Rust client
must not create Rust-only methods, fields, error codes, or authentication
semantics. It may expose a narrower typed projection and preserve unknown JSON
payloads where the Gateway contract allows additive fields.

Protocol compatibility is an explicit tested window. A server-reported
protocol version is evidence of the accepted session; it is not permission for
the client to silently emulate an undocumented older dialect.

## Endpoint and trust policy

The client must reject unsupported URL schemes before network activity.

- Public or otherwise untrusted remote endpoints require `wss://`.
- `ws://` is limited to the reviewed trusted-host policy: loopback, private or
  link-local IP addresses, `localhost`, `.local`, and `.ts.net` names.
- IPv4-mapped IPv6 addresses must be evaluated by their mapped IPv4 address so
  an address cannot bypass the plaintext policy through representation alone.
- Deployments should prefer TLS except for same-host loopback development.

TLS trust is either platform system roots or one exact SHA-256 leaf-certificate
fingerprint. A configured pin is valid only with `wss://`. Pin comparison must
be constant-time, and the TLS stack must still verify that the peer owns the
certificate private key. TLS validation/configuration failures must remain
distinguishable from transient transport or handshake failures so reconnect
policy does not permanently pause on a recoverable outage.

## Connect sequence

A conforming session must:

1. establish the WebSocket with bounded frame and message sizes;
2. wait for `connect.challenge` within the configured challenge timeout;
3. reject a missing or empty nonce;
4. invoke the embedding exactly once to build connect parameters from that
   nonce;
5. send one correlated `connect` request;
6. require a successful response within the request timeout; and
7. expose the accepted hello payload without interpreting product-specific
   fields.

Frames unrelated to the challenge may be ignored only where the canonical
protocol permits them before connection. A malformed frame or invalid connect
response must not activate a session.

## Requests, events, and closure

Request IDs must be unique within the session. The session must correlate only
an exact response ID with its pending request and must remove pending state on
response, timeout, cancellation, or session closure.

A dropped or timed-out request must be durably marked independently of bounded
queue capacity. If it has not yet been written, it must not be transmitted; in
all states it must release its pending entry and concurrency permit. A queued
cancellation notification may wake the session loop sooner, but it must remain
a best-effort optimization rather than the source of cancellation truth.

The default candidate limits are:

| Limit | Candidate default |
| --- | ---: |
| Challenge timeout | 15 seconds |
| Connection establishment timeout | 10 seconds |
| WebSocket write timeout | 10 seconds |
| Request timeout | 30 seconds |
| Maximum WebSocket message/frame | 16 MiB |
| Retained event capacity | 256 events |
| Retained raw-event bytes | 64 MiB |
| Queued plus pending requests | 64 |

Embeddings may choose smaller or larger finite limits. Zero-valued capacities
must normalize to at least one or fail validation; they must not create an
unbounded queue.

The current candidate bounds retained events by both exact event count and
aggregate raw-frame bytes. It evicts the oldest retained frames until both
limits hold. A single frame larger than the complete byte budget advances the
stream position and produces explicit lag for affected subscribers without
closing the transport; later bounded events remain deliverable. The count,
aggregate-byte, oversized-frame, and lag paths have focused current-head tests,
including preservation of the default 256-event small-event burst.

Event subscribers must receive explicit lag rather than silent loss. The
single-consumer convenience API must deliver already-buffered events before a
terminal closure error, including when the final event and close arrive in the
same scheduling interval. Closing a session must wake event and request
waiters, and all pending requests must receive a terminal error.

Ping/pong traffic counts as transport activity but not as an application
event. The client must answer WebSocket pings without blocking the receive loop.

## Failure and recovery metadata

Public error classes must separate at least:

- invalid URL or header;
- insecure plaintext endpoint;
- transient transport failure;
- TLS failure;
- challenge timeout or invalid challenge;
- connect-parameter failure;
- structured Gateway rejection;
- request timeout;
- clean or abnormal closure;
- invalid frame; and
- event lag.

Gateway rejection details are untrusted input. The client may expose only
bounded, normalized recovery text and typed booleans/codes needed by reconnect
policy. It must preserve `retryable`, `retryAfterMs`, `pauseReconnect`, and the
canonical detail code when present. An explicit terminal hint must never be
discarded because a new Gateway error code is unknown to the client.

## Security and privacy

Connect callbacks and errors must not cause credentials, tokens, signatures,
private keys, raw headers, or arbitrary server details to enter public logs.
The crate must not persist credentials. The embedding owns secret acquisition,
storage, rotation, and deletion.

Certificate pins, endpoint trust, frame bounds, and request bounds are security
controls. Their failure behavior must be covered by negative tests and must not
silently fall back to weaker behavior.

## Required conformance evidence

Before v1 support is claimed, the exact candidate head must prove:

- trusted and rejected plaintext endpoint cases, including mapped addresses;
- system-root and exact-pin TLS paths plus pin mismatch;
- challenge success, timeout, and malformed challenge;
- correlated request success, rejection, timeout, and close cleanup;
- bounded concurrency when callers abandon futures;
- measured or mechanically enforced worst-case event-retention memory for the
  supported configuration;
- durable timeout and caller-abandon cancellation under queue saturation;
- event delivery, lag, final-event-before-close, and idle-close wakeup;
- ping/pong transport activity; and
- terminal versus retryable Gateway recovery metadata.

The current implementation evidence is inventoried in
[implementation-and-evidence-inventory.md](implementation-and-evidence-inventory.md).

## Out of scope for v1

- automatic persistent credential storage;
- node identity or command manifests;
- reconnect supervision owned by a product lifecycle;
- proxy discovery beyond existing OpenClaw policy;
- an HTTP/REST compatibility layer; and
- crate publication or a stable Rust API guarantee.
