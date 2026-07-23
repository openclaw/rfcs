# Portable Handoff v1 Specification

This document is the implementer-facing planned-handoff specification for RFC
0013 follow-on recovery points. It composes the shipped cooperative Gateway
suspension contract with final owner capture and durable host acceptance.

Status: draft, tied to RFC 0013.

## Draft Implementation Evidence

[openclaw/openclaw#112865](https://github.com/openclaw/openclaw/pull/112865)
is the OpenClaw draft evidence slice for final owner capture, stacked on
[openclaw/openclaw#112385](https://github.com/openclaw/openclaw/pull/112385).
It uses the existing RFC 0013 SQLite provider, binds the exact runtime lineage,
source generation, handoff identity, selected-agent inventory, and
host-supplied closure evidence, and durably replays one committed recovery
point after response loss.

The operation is deliberately offline and host-invoked. It does not suspend or
stop Gateway, fence external ingress, accept or publish bytes, or authorize
source destruction. The pull request is implementation evidence; this
specification remains the normative responsibility boundary.

## Scope

This specification defines:

- host ingress fencing before planned handoff;
- reuse of `gateway.suspend.prepare|status|resume`;
- final capture after the tracked Gateway work fence is ready;
- immutable host acceptance of one aggregate recovery point;
- exact replay after transport or coordinator uncertainty;
- generation-bound source destruction authority;
- hold and quarantine behavior.

This specification does not define:

- another Gateway pause, drain, or suspension API;
- storage-provider plugin registration;
- object-store, filesystem, sidecar, or queue implementation;
- retention, placement, encryption-key, or idle policy;
- forced-termination recovery beyond the last accepted recovery point;
- restored admission or Elastic wake.

## Shipped Suspension Contract

Current OpenClaw `main` provides:

```text
gateway.suspend.prepare
gateway.suspend.status
gateway.suspend.resume
```

The contract was introduced by
[openclaw/openclaw#103618](https://github.com/openclaw/openclaw/pull/103618)
and its architecture and validation gates were restored by
[openclaw/openclaw#103925](https://github.com/openclaw/openclaw/pull/103925).

`prepare`:

- accepts a stable host operation ID;
- closes new tracked root, session, and command admission;
- pauses automatic cron scheduling;
- synchronously inspects tracked active work;
- returns `busy` and reopens normal operation when work remains; or
- returns a renewable two-minute suspension lease when ready.

The lease is cooperative and refuse-only. It does not:

- persist external ingress;
- stop third-party Channel transports;
- prove unregistered plugin or background work idle;
- stop the process tree;
- snapshot the filesystem; or
- authorize source destruction.

The handoff binding must preserve those boundaries.

## Planned Handoff

The host executes:

```text
fence host-controlled ingress
  -> call gateway.suspend.prepare with stable handoff identity
  -> retry busy without stopping the runtime
  -> receive ready suspension lease
  -> stop the Gateway and remaining authoritative writers cleanly
  -> create and verify final owner components
  -> assemble and verify one aggregate recovery point
  -> durably accept exact recovery-point bytes and identity
  -> finalize the source generation
  -> derive safeToDestroy
```

If the handoff is abandoned before process stop, the controller calls
`gateway.suspend.resume` with the exact suspension ID. A lost control path does
not authorize progress; the host waits for lease expiry or proves the process
is already stopped through its existing supervisor contract.

The host must complete clean Gateway stop before the ready lease expires or
renew the lease by repeating `gateway.suspend.prepare` with the same stable
request ID while the Gateway remains responsive. `gateway.suspend.status` does
not renew the lease. If the host cannot complete or renew the clean-stop window,
it abandons the planned handoff, resumes when possible, and leaves source
compute intact. After the process stops, the host must keep every supervisor,
health-recovery, and autoscaling start path fenced until handoff completes or
is explicitly abandoned.

The host must not extend the suspension lease semantics by treating a stale
lease, health probe, process absence, or local snapshot path as handoff success.

## Final Capture

Final capture reuses owner primitives:

- RFC 0013 `backup sqlite` for global and per-agent databases;
- the Recovery Point Components v1 contract for aggregate composition; and
- existing owner-specific capture for non-SQLite components.

An aggregate made directly from ordinary RFC 0013 snapshots remains
`host-protected`. It may move only into a host protection domain whose
encryption, access control, and credential exposure policy accepts those exact
bytes. A deployment must not call the point credential-free portable unless it
also verifies owner-authored portability receipts bound to every component and
artifact digest. An obligation list alone is not portability evidence.

Final capture must not run while an authoritative writer can still mutate the
captured source. A force kill, uncertain process termination, conventional
shutdown warning, capture blocker, verification failure, or unknown writer
state blocks the planned handoff. Recovery after such a failure uses the last
previously accepted recovery point and does not claim a new clean final point.

The final recovery point is immutable. Retrying the same handoff identity must
return the same recovery-point identity or a typed conflict.

## Host Acceptance

The host durably records:

- logical runtime and continuity lineage;
- source runtime generation;
- handoff identity;
- aggregate recovery-point identity and manifest digest;
- acceptance-set identity;
- exact aggregate-manifest digest and size;
- the canonical component acceptance inventory, including each owner-manifest
  and artifact digest and size;
- durability class;
- accepted-at time; and
- storage-owned opaque reference.

The opaque reference may identify a file, blob, object, or service record. It
must not expose credentials in OpenClaw metadata.

Local artifact creation and host acceptance are separate facts. A host may
claim acceptance only after its selected durability boundary confirms every
byte sequence in the closed acceptance inventory. The storage implementation
may package those bytes as files, blobs, or service records, but must return
the same canonical acceptance-set identity. No digest of an unspecified
directory, archive, or concatenation is valid evidence.

## Replay And Uncertainty

Every mutating step is idempotent under the handoff identity.

- Lost response after capture: replay returns the same local recovery point.
- Lost response after host acceptance: replay queries the same acceptance
  operation and returns the same receipt.
- Different bytes under the same identity: quarantine.
- Unknown storage outcome: hold; do not capture a replacement and infer the
  first attempt failed.
- Source process or adapter replacement before local state is durable:
  quarantine unless the host can prove the exact accepted recovery point.

## Destruction Authority

`safeToDestroy` is a host-owned durable conclusion bound to:

- runtime lineage;
- source generation;
- handoff identity;
- accepted recovery point; and
- the current lifecycle revision.

It authorizes removal of only the source compute generation. It never
authorizes deletion of recovery points, persistent tenant data, external
credentials, registry records, or another generation.

New retained work or an operator cancellation must revoke or race with
destruction through the host's durable lifecycle authority. OpenClaw does not
poll for that race after it has stopped.

## Conformance

V1 conformance must prove:

- current-main `gateway.suspend.*` is called rather than reimplemented;
- busy leaves the runtime running;
- ready closes tracked admission and pauses scheduling;
- lease renewal repeats `prepare` with the same request ID;
- host ingress is fenced separately;
- third-party and unregistered work limitations remain explicit;
- final capture occurs only after authoritative writers stop;
- one exact recovery point is accepted durably;
- the accepted logical byte set is closed and deterministically identified;
- host-protected snapshots cannot be reported as credential-free portable
  without exact owner portability receipts;
- response loss replays the same acceptance;
- digest conflict and unknown outcome block destruction; and
- `safeToDestroy` is generation-scoped and cannot purge persistent data.
