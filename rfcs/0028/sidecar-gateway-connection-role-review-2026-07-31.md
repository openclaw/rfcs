# RFC 0028 sidecar Gateway connection role review

Date: 2026-07-31

Scope: the proposed connection-control contract between a product supervisor
and an out-of-process Rust node runtime.

## Source analogues

- Linux Tauri owns endpoint trust, device identity, canonical signing,
  issued-token persistence, stale-token clearing, and desktop lifecycle.
- `openclaw-node-host` already exposes external signing requests, typed
  issued-token delivery, per-attempt material acquisition, reconnect
  classification, and secret-free lifecycle state.
- `openclaw-windows-node` owns endpoint authorization, generation fencing,
  token recovery, and the native capability dispatcher.
- The authenticated sidecar bridge owns framing, replay resistance,
  negotiation, immutable capability configuration, and bounded invocation.

The review therefore treats the missing work as a process-boundary contract,
not a new Gateway authentication design.

## Gateway engineer — cluster B

Accepted findings:

1. Reconnect acquisition must stay between the sidecar and supervisor; it must
   not add a Gateway hook or per-invocation round trip.
2. One material request per connection attempt composes directly with
   `NodeLifecycle` and keeps Gateway transport logic in the Rust crate.
3. Signing and token acknowledgement are handshake-time operations with finite
   deadlines. Ordinary invocation remains on the existing bounded fast path.
4. A denied or unavailable supervisor must pause/back off with typed state
   rather than crash the Gateway or spin a reconnect loop.

## Platform engineer — cluster D

Accepted findings:

1. Endpoint, trust, account, credential, and rollout authorization must be
   reacquired for every attempt so fleet changes cannot leave stale authority.
2. Every authorization allocates a fresh, never-reused connection generation;
   delayed responses and retired generations fail closed.
3. Issued tokens are not considered adopted until the supervisor reports an
   atomic durable store keyed by Gateway, device, and role.
4. Runtime status needs manifest, attempt, and connection-generation
   correlation without endpoint or credential disclosure.
5. Credential replacement and runtime rollback are explicit retirement plus a
   new attempt, not mutation of a live generation.

## CISO — cluster A

Accepted findings:

1. The private key never crosses IPC. The runtime sends exact canonical bytes
   for external Ed25519 signing and verifies the returned signature locally.
2. Authenticated HMAC frames do not provide confidentiality. Direct credential
   messages require a peer-confidential protected IPC transport or an
   equivalent secret-delivery mechanism.
3. Signing requests/results bind generation, attempt, request ID, and payload
   digest; substitution or replay retires the generation.
4. Revocation stops admission and generation-owned work before acknowledgement.
   IPC loss has the same fail-closed result.
5. Logs, status, public errors, crash metadata, and audit contain only stable
   reason classes and correlation IDs, never credentials, signing payloads,
   signatures, or issued tokens.

## Resulting contract line

The immutable sidecar configuration remains capability-only. Live Gateway
authority is a separate authenticated connection-control exchange with five
paired operations: material request/decision, signing request/result,
issued-token delivery/acknowledgement, supervisor retirement/acknowledgement,
and runtime closure/acknowledgement. Product storage and policy remain outside
Rust; Gateway wire behavior and node lifecycle remain inside Rust.

## Deferred implementation evidence

- Rust and independent adopter consumers of the shared fixture;
- byte-exact canonical JSON encodings and negative mutations;
- protected-IPC live Gateway pairing, token reconnect, mismatch recovery, and
  revocation;
- crash, resource, rollout, rollback, and audit-sink proof; and
- packaged secure-store and artifact-signing validation.
