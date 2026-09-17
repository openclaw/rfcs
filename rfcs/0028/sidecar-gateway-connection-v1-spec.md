# Rust node sidecar Gateway connection v1 specification

This document defines the proposed connection-control messages between a
product supervisor and an out-of-process `openclaw-node-host`. It specializes
the authenticated channel and hosting rules in
[`sidecar-hosting-v1-spec.md`](sidecar-hosting-v1-spec.md); it does not create a
second Gateway protocol or a product-specific bootstrap API.

Status: draft. The existing sidecar implementation does not yet implement this
message family.

## Purpose and ownership

The Rust runtime owns Gateway transport, canonical connect construction,
challenge handling, node lifecycle, and secret-free status classification. The
product supervisor owns endpoint authorization, credential and identity
custody, secure persistence, runtime selection, and local revocation policy.

The boundary must let the runtime:

- reacquire endpoint, trust, authentication, and identity metadata for every
  connection attempt;
- ask the supervisor to sign the exact canonical Gateway challenge payload
  without receiving a private key;
- deliver a Gateway-issued device token for atomic supervisor-owned storage;
- stop promptly when the supervisor retires or replaces authority; and
- report lifecycle state without placing secrets in status or audit events.

This is a hosting relationship. Remote controllers continue to authenticate
and manage the node only through canonical Gateway APIs.

## Prerequisites

Connection-control messages are invalid until sidecar authentication,
negotiation, and immutable runtime configuration have completed. They travel
inside the existing generation-bound, strictly sequenced sidecar frames and
inherit their deadlines and size ceilings.

V1 reserves negotiated sidecar feature bit `1` as
`gateway-connection-control-v1`. Both peers must offer and select that bit
before configuration may activate Gateway sidecar mode. If the bit is absent,
neither peer sends this message family; the supervisor receives a typed
unsupported-feature result and may keep or select its incumbent runtime. It
must not probe support by sending an unknown message. Later required message or
field semantics require another negotiated bit or a sidecar protocol major
revision.

HMAC authentication provides integrity and peer authentication, not payload
encryption. Activating `gateway-connection-control-v1` therefore requires an IPC
transport whose handles, endpoint, and access controls make the entire exchange
confidential to the two peers. This requirement covers every message, including
authentication material, canonical signing payloads, signatures, and issued
tokens. A deployment that cannot provide peer confidentiality must not negotiate
this feature or send this message family.

Credentials, canonical signing payloads, signatures, and issued tokens are
secret-bearing data. They must not appear in arguments, broad environment
state, files used as IPC, logs, status, crash annotations, or public errors.

## Identifiers and generations

Every connection-control message is bound to the authenticated sidecar session.
Three generation scopes remain distinct:

- the sidecar frame generation identifies the authenticated process session;
- `manifestGeneration` identifies one immutable capability/command snapshot and
  may span multiple reconnect attempts; and
- `connectionGeneration` identifies exactly one authorized Gateway connection
  attempt under that manifest.

The following additional identifiers are mandatory:

- `requestId`: unique within the sidecar session for one material request;
- `connectionGeneration`: a positive JSON-safe integer selected by the
  supervisor and never reused in that sidecar session;
- `attempt`: the runtime lifecycle attempt that requested the material;
- `signingRequestId`: unique within one connection generation; and
- `deliveryId`: unique within one connection generation for an issued token.

`manifestGeneration` in a material request must equal the immutable configured
manifest. Responses with a different attempt, request, connection generation,
or manifest are terminal for the connection exchange. A retired generation can
never be reopened or reused, even if a delayed response later arrives.

## State model

```text
configured
    |
    v
material-requested -> authorized -> signing -> connecting -> token-pending -> ready
    |                    |             |           |              |          |
    +--------------------+-------------+-----------+--------------+----------+
                                      deny, failure, retirement, or shutdown
```

The runtime initiates one material request per lifecycle attempt. It may have at
most one unresolved material request and one live connection generation. The
supervisor may deny an attempt without allocating a generation. Authorization
allocates a fresh generation and replaces no earlier authority implicitly; an
earlier live generation must first be retired by the supervisor or reported
ended by the runtime and acknowledged by the supervisor.

If the material deadline expires, the runtime does not silently abandon the
request. It sends `connection-material-cancel` and waits for
`connection-material-cancelled` before starting another attempt. An
authorization racing with cancellation is quarantined: the runtime must not use
its material or start a Gateway connection, and the supervisor retires any
generation it allocated before acknowledging cancellation. IPC loss remains a
fail-closed terminal outcome for the whole sidecar session.

The runtime must not report `ready` until the Gateway session is activated and,
when the Gateway issued a device token, the supervisor has acknowledged durable
adoption of that token. An issued-token storage rejection retires the Gateway
session and produces a typed pause rather than silently continuing with
unrecoverable pairing state.

The activated Gateway transport must not make the command manifest eligible
for admission while token acknowledgement is pending. Any invocation received
in that window remains within the runtime's existing bounded event budget and
is dispatched only after `outcome: "stored"`; otherwise it is rejected or
discarded when the generation retires. No product-native side effect may begin
before durable token adoption.

## Message family

All messages use compact UTF-8 JSON, camel-case fields, and a kebab-case `type`.
Strings and collections must have finite local limits before allocation. A peer
must ignore bounded unknown fields on a known message so additive minor-version
compatibility remains possible. Senders must not attach authority, security, or
required processing semantics to an unnegotiated field; such a change requires
a negotiated feature bit or a new message type. Unknown message types and
unnegotiated required extensions fail closed. The shared fixture defines
representative values and negative mutations.

### Material request

The runtime sends:

```json
{
  "type": "connection-material-request",
  "requestId": "connect-1",
  "attempt": 1,
  "manifestGeneration": 3
}
```

This message contains no endpoint or credential hint. It asks the supervisor to
authorize the exact current attempt after applying product lifecycle, endpoint,
account, and rollout policy. A bounded mismatch fallback adds:

```json
{
  "type": "connection-material-request",
  "requestId": "connect-fallback-1",
  "attempt": 2,
  "manifestGeneration": 3,
  "recovery": {
    "kind": "device-token-mismatch",
    "priorConnectionGeneration": 7
  }
}
```

Only the canonical device-token-mismatch path may set this v1 recovery object.
The referenced generation must have completed its runtime-ended
acknowledgement, and the runtime may emit it only once for that rejected token.

### Material cancellation

When its bounded material deadline expires, the runtime sends:

```json
{
  "type": "connection-material-cancel",
  "requestId": "connect-timeout-1",
  "attempt": 6,
  "manifestGeneration": 3,
  "reason": "deadline"
}
```

The runtime keeps the request reserved and starts no replacement attempt until
the supervisor acknowledges:

```json
{
  "type": "connection-material-cancelled",
  "requestId": "connect-timeout-1",
  "attempt": 6,
  "manifestGeneration": 3,
  "connectionGeneration": 11
}
```

`connectionGeneration` is present only when authorization raced with the
cancellation and the supervisor had already allocated that generation. Before
sending the acknowledgement, the supervisor must make the request terminal,
retire any such generation, release its material, and ensure it can never become
live. When no generation was allocated, the field is absent. The acknowledgement
therefore establishes a common terminal point in both orderings.

After sending cancellation, the runtime rejects all nonterminal messages for
that request except a racing `connection-authorized`, which it records only for
correlation and never activates. A matching cancellation acknowledgement must
name the same generation if authorization was observed. Mismatched, reused, or
post-ack responses are terminal protocol errors. Duplicate cancellation and
acknowledgement messages are idempotent only when their complete correlation
fields match.

A racing `connection-denied` commutes with cancellation and completes the
runtime's wait immediately. The runtime applies the denial's typed recovery; it
does not wait for a separate cancellation acknowledgement before following that
recovery. When the supervisor later receives the cancellation, it still returns
a matching `connection-material-cancelled` without `connectionGeneration` so
both histories converge. The runtime accepts that later acknowledgement as an
idempotent terminal confirmation and performs no second recovery action. Because
denial allocates no generation, this ordering cannot create authority.

### Authorization or denial

The supervisor either denies the request with a stable secret-free code:

```json
{
  "type": "connection-denied",
  "requestId": "connect-1",
  "attempt": 1,
  "manifestGeneration": 3,
  "code": "credential-unavailable",
  "recovery": "pause"
}
```

`connection-denied` is the authoritative request-scoped cancellation before a
connection generation exists. The supervisor may send it at any time while the
request is unresolved, including when credentials are revoked, rollout is
disabled, the attempt is superseded, or shutdown begins. The runtime cancels
the pending acquisition and applies `recovery` without waiting for its normal
material deadline. Exactly one of `connection-denied` or
`connection-authorized` may resolve a request before cancellation. Once
cancellation is sent, the commuting rules above govern a racing resolution; any
other conflicting response is rejected.

V1 `recovery` values are:

- `pause`: publish the typed pause and emit no further material request in this
  process lifecycle;
- `retry-after-backoff`: apply the normal bounded reconnect backoff/circuit
  breaker, then emit a fresh material request with the next attempt; and
- `stop`: stop the runtime lifecycle cleanly with readiness false.

An unknown recovery value is an unnegotiated required semantic. It invalidates
the response and retires the authenticated sidecar channel fail-closed. New
recovery behavior requires a negotiated feature bit or protocol-major revision.

or supplies attempt-scoped material:

```json
{
  "type": "connection-authorized",
  "requestId": "connect-1",
  "connectionGeneration": 7,
  "attempt": 1,
  "manifestGeneration": 3,
  "endpoint": {
    "url": "wss://gateway.example",
    "tlsTrust": {
      "mode": "pinned-leaf-sha256",
      "sha256": "abababababababababababababababababababababababababababababababab"
    }
  },
  "auth": {
    "kind": "device-token",
    "secret": "fixture-device-token"
  },
  "identity": {
    "deviceId": "fe812c12f3ab4ce6ac5db69ac352f906cb1b11ef43fb33e252ef7ff552263889",
    "publicKeyBase64Url": "6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw",
    "platform": "windows",
    "deviceFamily": "desktop"
  }
}
```

V1 trust modes are `system-roots` and `pinned-leaf-sha256`. The pin is the
SHA-256 digest of the exact DER bytes of the TLS end-entity certificate,
encoded as 64 lowercase hexadecimal characters. Comparison is constant-time.
A pin requires `wss://`; there is no fallback from a configured pin. Matching
the existing Rust Gateway client and OpenClawKit behavior, a configured pin
replaces CA-chain and hostname trust, while the TLS stack must still verify the
handshake signature proving that the peer possesses that certificate's private
key. V1 authentication kinds are `none`, `shared-token`, `shared-password`, and
`device-token`; `secret` is omitted only for `none`. Arbitrary headers, product
cookies, private keys, and product-specific discovery objects are not part of
v1.

The runtime validates the URL, trust policy, authentication shape, public key,
derived device ID, normalized platform metadata, limits, and generation before
opening a socket. It retains secret material only for the authorized attempt and
zeroizes or releases it when the generation retires.

### External signing

After receiving the Gateway nonce, the runtime constructs the canonical
OpenClaw device-auth payload and sends its exact bytes to the supervisor:

```json
{
  "type": "signing-request",
  "connectionGeneration": 7,
  "attempt": 1,
  "signingRequestId": "sign-1",
  "algorithm": "ed25519",
  "payloadBase64": "djN8ZmU4MTJjMTJmM2FiNGNlNmFjNWRiNjlhYzM1MmY5MDZjYjFiMTFlZjQzZmIzM2UyNTJlZjdmZjU1MjI2Mzg4OXxub2RlLWhvc3R8bm9kZXxub2RlfHwxODAwMDAwMDAwMDAwfGZpeHR1cmUtZGV2aWNlLXRva2VufGZpeHR1cmUtbm9uY2V8d2luZG93c3xkZXNrdG9w",
  "payloadSha256": "adff2da6601b1d8fc00c5e95c01bda27f29cbd50c85bef72d9be64af29b7651b"
}
```

The supervisor verifies that the request belongs to the current authorized
identity and connection before invoking its secure-store signer. It returns
either:

```json
{
  "type": "signing-result",
  "connectionGeneration": 7,
  "attempt": 1,
  "signingRequestId": "sign-1",
  "payloadSha256": "adff2da6601b1d8fc00c5e95c01bda27f29cbd50c85bef72d9be64af29b7651b",
  "outcome": "signed",
  "signatureBase64Url": "gBSx1Nxb5fqo-srP1MNU1oMA4Le5sLiaMxkR_a8VlvzYM3PxrtERef6JwXJOuhDprnynuk8OQI7WrcocRRYYCQ"
}
```

or `outcome: "denied"` with a stable `code` and no signature. The runtime
checks the generation, attempt, request identifier, digest, Ed25519 encoding,
and signature against the authorized public key and exact payload before
sending connect parameters to the Gateway. A mismatch retires the connection
generation and pauses for identity repair.

Only one signing request may be unresolved for a generation. Signing has a
finite deadline and cancellation propagates on retirement or shutdown.

### Issued-device-token delivery

When `hello-ok` contains a device token, the runtime sends:

```json
{
  "type": "issued-device-token",
  "connectionGeneration": 7,
  "attempt": 1,
  "deliveryId": "token-1",
  "token": "fixture-issued-device-token"
}
```

The supervisor atomically stores the token keyed by the authorized Gateway,
derived device ID, and `node` role, then responds:

```json
{
  "type": "issued-device-token-ack",
  "connectionGeneration": 7,
  "attempt": 1,
  "deliveryId": "token-1",
  "outcome": "stored"
}
```

`outcome: "rejected"` includes only a stable secret-free `code`. The runtime
does not persist the token, log it, place it in status, or assume it was adopted
before the acknowledgement. Duplicate delivery IDs are idempotent only when
their token digest matches the first delivery; a conflicting duplicate is
terminal.

The token acknowledgement wait has a finite locally enforced deadline no longer
than the negotiated sidecar request timeout. On expiry the runtime keeps
readiness false, closes the Gateway session, releases the issued token and other
generation secrets, and begins the runtime-originated `connection-ended`
exchange with reason `token-adoption-timeout`. If the supervisor also fails to
acknowledge that terminal message within the bounded control-message deadline,
the runtime terminates the authenticated sidecar channel. It must not retry or
redeliver the token under the same generation.

### Retirement

The supervisor may retire current authority at any time:

```json
{
  "type": "connection-retire",
  "connectionGeneration": 7,
  "reason": "credential-revoked"
}
```

The runtime immediately stops new admission for that generation, cancels the
Gateway connection and all generation-owned waits/work, releases secrets, and
then acknowledges:

```json
{
  "type": "connection-retired",
  "connectionGeneration": 7,
  "reason": "credential-revoked"
}
```

The acknowledgement means the session is closed and generation-owned work can
no longer publish results. It is not merely receipt of the request. IPC loss
has the same fail-closed effect and requires no acknowledgement.

When the runtime detects Gateway closure or another terminal generation failure
without a supervisor retirement request, it first stops admission, cancels
generation-owned work, and releases secrets. It then sends:

```json
{
  "type": "connection-ended",
  "connectionGeneration": 7,
  "attempt": 1,
  "reason": "transport"
}
```

The supervisor records the terminal transition and responds:

```json
{
  "type": "connection-ended-ack",
  "connectionGeneration": 7,
  "attempt": 1
}
```

The runtime does not request new material until this acknowledgement arrives.
The supervisor does not authorize a replacement generation until it has
received `connection-ended` or `connection-retired` for the prior generation.
Both waits are bounded; timeout pauses the runtime and makes readiness false
rather than permitting overlapping authority. Duplicate identical
`connection-ended` notifications are idempotent; a conflicting terminal reason
or any later nonterminal message for that generation is rejected.

Supervisor retirement and runtime closure may cross in flight. Their terminal
messages commute:

- after sending `connection-ended`, the runtime accepts either
  `connection-ended-ack` or `connection-retire` as proof that the supervisor has
  observed terminal state; on `connection-retire` it still replies with
  `connection-retired`;
- after sending `connection-retire`, the supervisor accepts either
  `connection-retired` or `connection-ended` as proof that runtime authority is
  already closed; on `connection-ended` it still replies with
  `connection-ended-ack`; and
- late terminal acknowledgements for that same generation are idempotent, but
  every later nonterminal message remains invalid.

The audit record preserves the supervisor retirement reason and runtime closure
reason separately when both exist; one is not rewritten as the other. This race
never reopens authority or delays replacement-generation eligibility after both
peers have observed a terminal message.

Suggested runtime-end reasons are `transport`, `gateway`, `authentication`,
`device-token-mismatch`, `token-adoption-timeout`, `protocol`, `identity`,
`runtime`, and `shutdown`. They are secret-free classifications, not raw
exceptions.

Suggested v1 reasons are `credential-revoked`, `credential-replaced`,
`endpoint-changed`, `manifest-replaced`, `rollout-disabled`, `shutdown`, and
`superseded`. Unknown additive reasons map to a conservative generic retirement
class, never to continued authority.

## Reconnect and token replacement

The runtime never chooses a stored credential or silently falls back between
credentials. Each reconnect attempt emits a new material request. The
supervisor reauthorizes the endpoint and returns its currently selected
credential under a fresh connection generation.

When a Gateway returns the canonical device-token-mismatch classification, the
runtime closes that generation, completes the runtime-originated ended exchange,
and reports a secret-free authentication recovery state. After the ended
acknowledgement, the runtime emits exactly one new material request carrying the
bounded recovery object above. The supervisor may atomically remove the
rejected token and authorize that attempt with a configured bootstrap/shared
credential, or deny it. A denial, unavailable fallback, or second mismatch
enters the typed authentication pause; it must not loop.

Credential replacement or Gateway removal uses `connection-retire`; changing
memory or storage alone does not revoke an already authorized sidecar session.

## Status and audit

Sidecar lifecycle status adds nullable `connectionGeneration` to the existing
manifest generation, attempt, state, and reason. It contains no endpoint query,
credential kind, public key, signing payload, signature, or token. Before
authorization the field is null; after retirement it remains available only as
bounded correlation for the terminal transition.

The product and Gateway audit paths must be able to correlate sidecar session,
manifest generation, connection generation, lifecycle attempt, signing
decision class, token-delivery outcome, invocation, cancellation, and
retirement reason. Raw secret-bearing messages are never audit records.

## Required conformance

Cross-language tests must consume the shared fixture and prove:

- exact happy-path request, authorization, signing, token acknowledgement, and
  retirement shapes;
- additive unknown-field tolerance, unknown-message/unnegotiated-extension
  rejection, and malformed-auth rejection;
- all denial recovery values plus fail-closed unknown recovery;
- system-root and exact end-entity-DER pin behavior, private-key-possession
  proof, and no pin fallback;
- stale request, attempt, manifest, generation, signature, digest, delivery,
  and retirement rejection;
- signing denial, timeout, cancellation, and invalid-signature pause;
- token storage rejection before readiness and idempotent duplicate delivery;
- bounded token-acknowledgement timeout, generation closure, secret release,
  and sidecar-channel termination when the terminal acknowledgement also stalls;
- no invocation admission or native dispatch before issued-token
  acknowledgement;
- request-scoped denial during a pending material wait, plus prompt generation
  retirement during signing, connect, token, admission, and active invocation
  waits;
- material-deadline cancellation before resolution and while authorization or
  denial is in flight, with no orphaned or activated generation;
- runtime-originated closure acknowledgement before a replacement generation;
- concurrent supervisor retirement/runtime closure without deadlock or
  duplicate authority;
- one bounded fallback after device-token mismatch; and
- redaction scans covering logs, status, diagnostics, crash metadata, and
  public errors.

A source harness must then run this exchange through the actual protected IPC
transport and a real isolated Gateway. A packaged adopter must additionally
prove secure-store behavior, process crash/restart, credential revocation,
resource bounds, rollout, and rollback.

## Deliberate exclusions

V1 does not define product discovery, account UI, secure-store APIs, arbitrary
Gateway headers, controller management, remote secret retrieval, platform
handles inside JSON, capability-specific credentials, or secret persistence in
the Rust runtime. Those concerns may adapt this contract at the supervisor
boundary but cannot weaken generation fencing, external signing, explicit token
adoption, retirement, confidentiality, or redaction.
