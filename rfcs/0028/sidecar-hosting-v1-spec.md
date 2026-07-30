# Rust node sidecar hosting v1 specification

This document defines the product-neutral hosting contract for running the
OpenClaw Rust node runtime out of process. It specifies process, authority,
security, and lifecycle invariants. It intentionally does not select Windows
named pipes, Unix sockets, loopback transport, Cap'n Proto, JSON, protobuf, or
another concrete IPC encoding.

Status: draft and not implemented by OpenClaw PRs #116050 or #116450. Windows
PR #1068 creates the replaceable client and capability-dispatch seam needed by
a future adapter while keeping C# as the production runtime.

The current `openclaw-node` executable is a foreground proof host, not this
production sidecar. Its environment-indirected identity/auth loading does not
satisfy the authenticated launch and scoped secret-delivery requirements below.

## Roles

| Role | Responsibility |
| --- | --- |
| OpenClaw Rust runtime | Gateway connection, node manifest, invocation lifecycle, bounds, cancellation, and results |
| Product supervisor | Process creation, exact binary selection, IPC endpoint creation, credentials, restart/rollback policy, and product lifecycle |
| Platform adapter | Product-native capability execution and local policy/approval composition |
| Gateway | Node/controller authentication, pairing, approved command delivery, revocation, and canonical audit authority |

The sidecar must not become a second product control plane. Cloud or local
controllers manage the node through Gateway APIs; local IPC exists only to host
the runtime and execute product-owned capabilities.

## Launch and trust bootstrap

The supervisor must select an exact runtime artifact and verify the platform's
accepted code-signing/provenance policy before launch. It must create a fresh,
local-only IPC endpoint with an unguessable session credential or equivalent
mutual authentication. The credential must not appear in command-line
arguments, inherited broad environment state, logs, crash reports, or world-
readable files.

The sidecar must authenticate the supervisor before accepting configuration,
credentials, capability registration, or invocations. The supervisor must
authenticate the sidecar artifact and protocol version before forwarding any
native capability request. Failure on either side is terminal for that process
instance and must fail closed.

Before reading the first protocol message, each peer must enforce local hard
ceilings for frame bytes, connections, and in-flight work. Authentication,
version negotiation, and configuration must each have a finite local deadline;
a peer that stalls or exceeds a pre-negotiation ceiling is terminated without
activation. Negotiated limits are `min(local ceiling, peer offer)` and may
never raise either peer's local ceiling.

The supervisor owns Gateway credentials and private identity access. It may
grant the sidecar a short-lived handle/callback or scoped secret material. The
sidecar must not require Microsoft-, Tauri-, Chromium-, or Windows-specific
objects in its portable protocol.

## Version negotiation

The first IPC exchange must include:

- protocol major and minor version;
- runtime build/version and artifact identity;
- supervisor/product identity;
- supported feature bits;
- maximum message and in-flight limits; and
- a fresh session identifier bound to the authenticated channel.

Unknown major versions must fail before activation. Unknown optional features
must remain disabled. Minor-version compatibility must be additive and covered
by N-1 fixtures. Neither peer may infer support from product version alone.
Limit values in this exchange are offers inside the hard bootstrap envelope,
not authority to allocate or accept more than local policy allows.

## State model

The normative states are:

```text
stopped -> starting -> authenticated -> configured -> connecting -> ready
   ^          |             |              |             |          |
   +----------+-------------+--------------+-------------+----------+
                              failure / shutdown / rollback
```

`ready` requires all of the following:

- authenticated local IPC;
- accepted IPC version/features;
- valid bounded runtime configuration;
- active Gateway node session;
- activated connection-scoped manifest; and
- a responsive product capability adapter.

The supervisor must not route product traffic merely because the process is
alive or the IPC socket is open. Liveness and readiness are separate signals.

## Configuration and capability registration

Configuration must be finite, validated before activation, and free of inline
long-lived secrets. The supervisor supplies the exact command/capability
surface for one connection generation. Registration must complete before the
Gateway connection advertises that surface.

A capability update retires the current generation, cancels its affected work,
and reconnects with a new manifest. Neither side may add a handler after
advertisement without that generation change.

IPC messages must carry a sidecar session identifier and invocation identifier.
Identifiers supplied by a remote controller must not choose a local UI,
credential, or audit scope without supervisor validation.

The authenticated channel must reject replay across process sessions. Within
one session generation, every authenticated message in each direction must
carry a strictly increasing sequence number, or use an equivalent transport
guarantee with the same property. A message at or below the accepted high-water
mark, or from a retired generation, must fail before admission or native
dispatch. The high-water mark is bounded constant state; peers must rotate the
generation before sequence exhaustion and must not reset it in place.
Invocation identifiers remain correlation and idempotency keys, but are not the
replay-security primitive.

## Invocation flow

The minimum sidecar flow is:

1. Gateway delivers an invocation authorized for the active manifest.
2. The Rust runtime applies its bounds and calls the supervisor's admission
   adapter.
3. The supervisor evaluates current product policy/approval state and returns
   allow or a stable denial.
4. For an allowed native command, the runtime sends one typed invocation to the
   platform adapter.
5. Input, progress, cancellation, and the final result remain correlated to the
   same session generation and invocation.
6. The runtime returns the canonical result to the Gateway.

The supervisor may narrow or deny work. It must not cause the sidecar to report
a command that the Gateway did not approve or a result for a different
invocation. Backpressure applies in both directions; neither peer may use an
unbounded queue.

## Cancellation and shutdown

Cancellation must be idempotent and cover:

- admission/approval wait;
- queued native dispatch;
- active handler work;
- ordered input waits;
- progress/heartbeat production; and
- final-result delivery where the canonical protocol permits cancellation.

On graceful shutdown, the supervisor stops new admissions, asks the runtime to
drain, waits a bounded grace period, and then terminates remaining work. On IPC
loss or supervisor death, the sidecar must retire the session and cancel local
work rather than continue with stale product authority. On sidecar death, the
supervisor must make readiness false immediately and must not silently switch
runtimes mid-invocation.

## Crash recovery and restart

Restart policy must use bounded backoff and a circuit breaker. Repeated auth,
version, signature, configuration, or policy failures require operator repair;
they must not create a restart loop. A new process creates a new IPC session and
Gateway connection generation. Pending invocations are not replayed unless a
future canonical OpenClaw contract explicitly makes them replayable.

Health diagnostics must expose stable state/reason codes, restart count,
runtime version, Gateway connectivity, and active manifest generation without
secrets or raw remote/local exceptions.

## Rollout and rollback

The first adopter must keep its existing runtime as the default. Rust selection
requires an explicit rollout gate. A rollback selects the previous runtime only
for a new process/session; it must not transfer in-flight work or reuse an
authenticated IPC session.

Promotion requires:

- C# or other incumbent versus Rust registration parity;
- allowed, denied, timeout, cancellation, reconnect, revocation, and crash
  parity against a real Gateway;
- startup and steady-state CPU/memory evidence;
- artifact verification and fresh-machine install proof; and
- a practiced rollback with observable readiness transitions.

Deletion of incumbent Gateway transport occurs only after the rollout window
and rollback evidence succeed. Product-native dispatchers, UX, approval UI,
and capability handlers remain.

## Audit and privacy

The Gateway and product audit systems must be able to correlate controller,
node, local supervisor session, manifest generation, invocation, admission
decision, handler outcome, cancellation, and restart without copying secrets or
unbounded payloads. Policy denial, user denial, cancellation, and
approved-but-failed execution are distinct outcomes.

## Decisions intentionally deferred

- in-process versus sidecar as the default topology;
- concrete IPC transport and encoding;
- platform secure-storage API;
- binary distribution and update mechanism;
- Windows service versus tray-child lifetime; and
- product-specific command schemas.

Those decisions may specialize this contract but must not weaken its authority,
authentication, bounds, generation, cancellation, or rollback invariants.
