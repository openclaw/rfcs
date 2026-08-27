# Rust node runtime v1 specification

This document defines the proposed v1 contract for `openclaw-node-host`, the
node-role layer built on `openclaw-gateway-client`. The TypeScript
`src/node-host` remains the executable behavioral reference until OpenClaw
accepts and proves a Rust capability as conforming.

Status: draft. This contract defines the bounded native/headless subset; it
does not claim parity with every TypeScript command, plugin, skill, or execution
policy.

## Scope

The runtime owns portable node mechanics:

- canonical node connect metadata and challenge-bound device identity;
- device authentication and typed issued-device-token delivery;
- capability and command advertisement for one connection;
- invocation, ordered input, progress, heartbeat, result, and cancellation;
- bounded handler admission and execution;
- reconnect and shutdown lifecycle; and
- transport-neutral adapter APIs for embedding-owned handlers.

The Gateway remains authoritative for pairing, approved command delivery,
controller authentication, and revocation. An embedding-owned admission policy
may narrow delivered work but must never broaden Gateway authority.

## Node connection and identity

A node session must advertise `mode=node`, `role=node`, the supported protocol
range, one stable device identity, and a deterministic snapshot of commands and
capabilities. The current candidate advertises protocol maximum 4 and minimum
node compatibility 3; that range must track the canonical OpenClaw contract.

Device identity uses Ed25519. The signature payload must match the canonical
OpenClaw v3 field order and values exactly. An embedding may sign externally so
private key material can remain in platform secure storage. The runtime must
verify that an externally supplied signature matches the exact requested bytes
before connecting.

Authentication material and newly issued device tokens are distinct outputs.
The runtime must deliver an issued token through a typed callback, not a
general lifecycle event or log. Persistence is embedding-owned and should be
keyed by Gateway, device, and role. If an adopted issued token receives the
canonical device-token-mismatch response, the runtime may clear it and retry
configured authentication once; it must not loop or discard unrelated auth
failures.

In sidecar deployments the supervisor, not the runtime, selects and persists
credentials. The runtime reports the mismatch and retires that connection
generation; any bounded fallback is explicitly reauthorized through
[`sidecar-gateway-connection-v1-spec.md`](sidecar-gateway-connection-v1-spec.md).

## Connection-scoped manifest

Commands and capabilities form an immutable lease for one connection attempt.
They must be sorted or otherwise deterministic before signing and advertising.
Changing the registered surface requires a new connection; a retired session
must not execute commands under its old manifest.

Registration must reject empty capability or command names, duplicate command
names, and the OpenClaw-owned `system` / `system.*` namespace unless a separate
OpenClaw-owned capability specification explicitly authorizes an implementation.
An empty manifest is valid and grants no implied capability.

## Invocation admission

An invocation is eligible only when all of these conditions hold:

1. it was delivered on the active node session;
2. its command is present in that session's manifest;
3. its invocation identifier is not already active;
4. bounded concurrency has capacity;
5. input and parameter size limits are satisfied; and
6. the embedding-owned admission callback succeeds within the invocation
   deadline.

Admission rejection, panic, cancellation, or timeout must fail closed before
the handler runs. Admission receives a typed invocation and cooperative
cancellation token; it must not receive authority to mutate the advertised
manifest or synthesize Gateway approval.

## Bounded execution

The embedding-configurable candidate defaults are:

| Limit | Candidate default |
| --- | ---: |
| Concurrent handlers | 8 |
| Invocation input/parameter budget | 256 KiB |
| Result/output budget | 256 KiB |
| Handler deadline when omitted | 30 seconds |
| Maximum handler deadline | 5 minutes |
| Result-delivery reserve | 100 milliseconds |

The current fixed protocol/runtime constants are:

| Limit | Candidate constant |
| --- | ---: |
| Pending duplex input | 64 KiB |
| One input frame | 16 KiB UTF-8 |
| One progress chunk | 16 KiB UTF-8 |
| Duplex heartbeat interval | 5 seconds |

All embedding-configurable limits must be finite and configurable downward.
Fixed constants must remain finite and require a runtime/protocol revision to
change; embedders may narrow them in their own adapters but cannot advertise a
larger shared contract. Saturation must reject immediately with a stable
structured failure; it must not create an unbounded work queue. A handler panic
must become a structured failure and must not terminate the host process.

`timeoutMs: 0` follows the canonical Gateway meaning and disables the handler
deadline; embeddings that cannot safely permit that behavior must narrow it in
their admission policy or product contract rather than silently reinterpret the
wire value.

## Duplex input, progress, and cancellation

Only commands registered as duplex may consume invocation input or emit
progress. Input must remain ordered. Oversized, duplicate, late, or
out-of-scope input must be rejected or ignored according to the canonical
lifecycle fixture without crossing invocation/session boundaries.

Progress strings must be split only at UTF-8 boundaries. Heartbeats must stop
when the invocation completes, is cancelled, or the session retires.
Cancellation must reach the admission wait, handler, duplex input receiver, and
child work through the cooperative token. Disconnect cleanup must cancel all
work owned by the retired session.

The runtime must not automatically replay an invocation after reconnect.

## Results and public failures

Every admitted invocation produces at most one final result. Success and
handler failure use the canonical node result envelope. Public failures must
use stable bounded codes/messages. Default runtime and proof-host diagnostic
sinks must emit only bounded redacted classes and explicitly safe context.
Generic library error values may retain source detail for programmatic
classification; embedders must not log arbitrary `Display`, `Debug`, or source
text without an explicit redaction policy. Canonical signing payloads and
credentials must never be formatted.

At minimum, distinct outcomes must exist for unsupported command, duplicate
invocation, saturation, invalid/oversized input, admission rejection,
admission failure, handler timeout, handler panic/failure, cancellation,
result-delivery failure, and session retirement.

Approved-but-failed execution must remain distinguishable from policy or
approval denial in audit and telemetry.

## Lifecycle and readiness

The reusable lifecycle must expose connecting, connected, ready, disconnected,
backoff, paused, and stopped states. It must acquire fresh connect material for
every attempt. Successful connection resets exponential backoff. Pairing,
authentication, protocol, local-identity, and permanent configuration failures
pause with a typed reason; transient transport and TLS-handshake failures retry.

The current candidate uses a 1-second initial reconnect delay capped at 30
seconds, a 1-second runtime-restart delay, and a 5-second shutdown grace.
Shutdown must cancel a connection attempt or active runtime, drain within the
grace period where possible, and report whether draining completed.

Readiness is true only while the current session is activated and its runtime
is serving the advertised manifest. A listening process, paired identity, or
healthy event loop alone is not readiness.

## Ownership boundary

The runtime does not own:

- product UI or approval presentation;
- product IPC and runtime selection;
- sandboxing, OS isolation, or least-privilege policy for product-native
  handlers, which are trusted embedding components;
- credential persistence or OS key-store policy;
- Windows, Apple, Android, ESP, Scout, or Lobster capability handlers;
- `system.run`, PTY, MCP, skills, or plugins without separate accepted
  OpenClaw contracts; or
- the Gateway's model-facing agent loop or controller policy.

## Required conformance evidence

V1 evidence must cover canonical signing, issued-token adoption and rejection,
pairing/reconnect classification, deterministic manifests, retired-session
denial, admission fail-closed behavior, duplicate/saturation bounds, timeout
and panic containment, ordered input/progress, UTF-8 chunking, cancellation at
each wait window, disconnect cleanup, result correlation, lifecycle shutdown,
and readiness transitions.

Sidecar conformance additionally covers material reacquisition, external
signing, issued-token acknowledgement, generation retirement, and redaction
through the shared sidecar Gateway connection fixture.

Every behavior shared with TypeScript must use a shared fixture or an explicit
documented comparison. See
[conformance-and-adoption-plan.md](conformance-and-adoption-plan.md).
