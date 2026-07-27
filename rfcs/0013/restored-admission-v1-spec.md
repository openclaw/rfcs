# Restored Admission v1 Specification

This document is the implementer-facing restore and admission specification for
accepted RFC 0013 follow-on recovery points. It defines the ordering and
evidence required before a restored Gateway can receive work.

Status: draft, tied to RFC 0013.

## Draft Implementation Evidence

[openclaw/openclaw#112896](https://github.com/openclaw/openclaw/pull/112896)
is the OpenClaw draft evidence slice for exact fresh-target restore and
readiness-gated admission, stacked on final-capture draft
[openclaw/openclaw#112865](https://github.com/openclaw/openclaw/pull/112865).
It reuses the RFC 0013 SQLite provider, durably binds the restore receipt and
private startup descriptor, reconciles the canonical scheduler, and opens work
admission only after owner readiness.

The draft deliberately holds when required external or reconstructed
obligations lack accepted owner evidence. It does not add wake routing,
placement, idle policy, host acceptance, or a public restore-hook registry.
This pull request is implementation evidence; this specification remains the
normative responsibility boundary.

## Scope

This specification defines:

- a durable restore hold before target mutation or process start;
- exact accepted recovery-point selection;
- fresh-path component restore and owner verification;
- external and reconstructed obligation handling;
- scheduler reconciliation;
- required owner and generic Gateway readiness;
- one-time restored admission;
- same-child replay after coordinator failure.

This specification does not define:

- another SQLite restore implementation;
- a public generic restore-hook or readiness-provider registry;
- capture, host storage, retention, or source destruction;
- host placement, proxy transport, or Channel delivery;
- Elastic wake policy.

This specification applies to any recovery point previously accepted through a
conforming durability boundary. That includes restore of the latest accepted
point after forced source loss. It does not create an accepted recovery point,
define the forced-loss RPO, or permit restore from an unaccepted local path.

## Shipped Foundation

SQLite components restore through RFC 0013:

```text
openclaw backup sqlite verify <snapshot-directory>
openclaw backup sqlite restore <snapshot-directory> --target <fresh-path>
```

The restore path must preserve RFC 0013's content-pinned verification,
fresh-target requirement, stale-sidecar rejection, and owner validation. It
must not copy snapshot bytes directly into an existing live database.

The host may use current-main `gateway.suspend.*` for planned source handoff.
Restored admission does not add or modify that suspension API.

## Restore Hold

Before creating any original target or starting a Gateway, the host acquires a
durable hold bound to:

- logical runtime and continuity lineage;
- lifecycle owner generation;
- destination runtime generation;
- accepted recovery-point identity;
- aggregate manifest digest;
- acceptance-set identity;
- restore operation identity; and
- destination owner.

Every launcher, health recovery, restart, warm-up, and autoscaling path must
reject ordinary startup while the hold is active.

The hold is released only by:

- exact restored-admission completion;
- explicit operator rollback before any restored process becomes runnable; or
- quarantine and a separately authorized recovery action.

Timeout does not silently release a partially applied restore.

Quarantine has no automatic exit in V1. A lifecycle owner may exit only through
an explicit durable revocation record that binds the quarantined hold and
operation identity. A later attempt uses a new restore-operation identity and a
newly selected accepted recovery point. A newer attempt must not implicitly
supersede, delete, or reuse the quarantined hold or its evidence.

## Restore Ordering

The binding executes:

```text
verify accepted aggregate manifest
  -> verify every required component and compatibility identity
  -> create fresh owner-private destination roots
  -> restore components in declared dependency order
  -> resolve external obligations through existing owners
  -> perform declared reconstruction through existing owners
  -> start one restored Gateway with private restore evidence
  -> reconcile scheduler state
  -> satisfy required owner readiness
  -> satisfy generic Gateway readiness
  -> durably record restored-ready evidence
  -> consume that exact evidence to open admission
```

The exact private transport into the restored process is an implementation
binding, not a new public RFC 0013 command. It must be bounded, owner-private,
versioned, and absent during ordinary startup.

## Required Evidence

The restored-start binding must preserve:

- accepted recovery-point and aggregate manifest identity;
- exact acceptance-set identity;
- destination runtime generation;
- lifecycle owner generation;
- component restore receipt identities;
- stable, generation-bound scheduler-reconciliation evidence identity;
- normalized required-owner readiness evidence identity;
- Gateway incarnation identity;
- one admission identity; and
- one canonical readiness generation.

These identities are independent. A process ID, worker name, health probe,
container generation, or local path cannot substitute for them.

The durable completion record contains identities and bounded disposition
metadata only. It must not contain credential values, raw artifact locations,
message payloads, prompts, or arbitrary commands.

V1 may derive the scheduler and readiness evidence identities only after the
semantic owner operation succeeds. The derivation binds a versioned evidence
label, the exact restore receipt, recovery-point and acceptance-set identities,
the destination runtime generation, and the normalized outcome. It is not a
digest of mutable scheduler status, does not claim to identify the complete
scheduler definition set, and does not substitute for a richer owner-authored
receipt when an owner later exposes one.

## Scheduler And Owner Readiness

OpenClaw remains authoritative for:

- restored scheduler definitions;
- due and missed-run reconciliation;
- duplicate suppression;
- catch-up policy;
- earliest semantic deadline; and
- readiness to admit ordinary work.

The host must not parse cron expressions or synthesize due work.

External or reconstructed obligations are evaluated by their existing owners.
Examples include credential availability and plugin dependency reconstruction.
Missing required evidence holds readiness closed. An obligation classified as
not required must be decided by its owner from restored effective
configuration, not by the host.

## Admission

Restore completion, process startup, `/healthz`, container readiness, and a
successful SQLite open do not independently authorize work.

Admission opens only after one canonical restored-ready record binds:

- the accepted recovery point;
- the accepted logical byte set;
- destination and lifecycle generations;
- component restore receipts;
- generation-bound scheduler-reconciliation evidence;
- normalized required-owner readiness evidence;
- Gateway readiness; and
- the one-time admission identity.

Ordinary startup remains unchanged because it has no restored-start evidence.
Ordinary startup cannot consume a committed restore hold, and restored startup
cannot use an ordinary admission path.

## Gateway Restore Status

V1 adds one read-only Gateway Protocol method:

```text
gateway.restore.status
```

The method is the live-destination observation seam for a host. It follows the
existing `gateway.suspend.status` conventions:

- core-owned and host-neutral;
- closed TypeBox request and result schemas in the Gateway Protocol package;
- `operator.read` scope;
- no control-plane-write classification;
- no config key or environment variable;
- idempotent and side-effect free; and
- exposed by authenticated Gateway control transports that opt into core RPC
  methods, including the existing Admin HTTP RPC path.

The request is:

```ts
type GatewayRestoreStatusParams = {
  restoreOperationId: string;
};
```

`restoreOperationId` must satisfy the same bounded non-empty token rules as
the restored-admission operation. It is required even though only one restored
operation can own a Gateway incarnation. Requiring it prevents an observation
for one host attempt from being mistaken for another generation's readiness.

The successful result is a closed union:

```ts
type GatewayRestoreStatusResult =
  | {
      status: "not-restored";
    }
  | {
      status: "held";
      reason: "scheduler-reconciliation" | "owner-readiness" | "ready-commit";
      retryAfterMs: number;
      runtimeLineage: string;
      lifecycleOwnerGeneration: string;
      destinationRuntimeGeneration: string;
      restoreOperationId: string;
      destinationOwner: string;
      admissionIdentity: string;
      recoveryPointId: string;
      acceptanceSetId: string;
      restoreReceiptIdentity: string;
    }
  | {
      status: "ready";
      runtimeLineage: string;
      lifecycleOwnerGeneration: string;
      destinationRuntimeGeneration: string;
      restoreOperationId: string;
      destinationOwner: string;
      admissionIdentity: string;
      recoveryPointId: string;
      acceptanceSetId: string;
      restoreReceiptIdentity: string;
      schedulerIdentity: string;
      ownerReadinessIdentity: string;
      readinessIdentity: string;
    };
```

`not-restored` means the running Gateway has no restored-start evidence. It is
not permission for a host restore operation to deliver retained work. `held`
means the expected restored incarnation is live but ordinary work admission is
still closed. `ready` is returned only after the exact ready record is durable
and the same admission identity has opened Gateway work admission.

All strings and arrays use explicit protocol bounds. `retryAfterMs` is a
non-negative bounded integer and only a polling hint. Results contain no local
paths, artifact locations, credentials, retained payloads, prompts, or owner
diagnostic text.

The handler must derive `held` and `ready` from the same in-memory startup
binding and operation-scoped SQLite journal that enforce admission. It must not
create a second restore-status file, infer readiness from `/healthz`, or hash a
mutable runtime status object. A replayed call returns the same identity fields
for the same durable record. The Gateway may retain the already validated
status projection in memory; polling must not synchronously reopen or rehash
the recovery journal on every request. Transition to `ready` occurs only after
the durable record commit succeeds.

If a different restore operation owns the running Gateway, the method returns
`UNAVAILABLE` with bounded details reason `restored-admission-conflict`; it
must not return that operation's identity as a success result. Invalid or
oversized tokens return `INVALID_REQUEST`. Journal corruption, contradictory
evidence, or failure to read a required committed record returns `UNAVAILABLE`
and keeps work admission closed. No error is success-shaped.

The method must remain callable while restored admission is held through an
authenticated pre-admission control path. It is exempt only from the restored-
admission work fence, like suspension control methods are exempt from the
suspension work fence; it does not make other RPC methods available. A host
without such a control path may use `/readyz` only as a backoff hint and call
`gateway.restore.status` after readiness, but it must not deliver retained
work until the exact `ready` result matches its operation and destination
generation.

For a fresh destination, the recommended held-state transport is the existing
authenticated Admin HTTP RPC route bound to the host-controlled loopback path.
The status method does not justify a new unauthenticated probe, public listener,
bearer-token scheme, or sidecar process. A mismatched-operation error must not
disclose the active operation's identities.

There is no `gateway.restore.admit`, `resume`, or caller-supplied readiness
method. Admission remains an OpenClaw-owned consequence of durable owner
evidence, not a host command.

## Crash Replay

The required crash boundary is:

```text
restored-ready durably recorded
  -> coordinator exits before completing its host operation
```

A fresh coordinator must:

- resolve the same destination child;
- establish a fresh process-local control or proxy connection;
- read the retained restored-ready evidence;
- verify the same readiness generation; and
- complete without repeating destination allocation, preparation, component
  restore, scheduler reconciliation, or admission.

If the child, generation, recovery point, or retained evidence differs, the
operation conflicts or quarantines. It must not allocate a second winner while
the first can still be authoritative.

All persistent journals and paths are scoped by stable operation identity.
Fixed shared paths across independent attempts are invalid.

OpenClaw-owned recovery intent, committed restore results, startup descriptors,
and restored-ready evidence use an operation-scoped SQLite journal. They are
not steady-state JSON sidecars. A dedicated journal is required because final
capture must commit intent before snapshotting the shared state database, and
restore must commit intent before the fresh shared state database exists.

## Failure Dispositions

- **retry same incarnation**: transient response loss with the same child and
  exact retained evidence;
- **hold**: missing dependency, temporary owner unavailability, or a timeout
  before any destination target mutation;
- **quarantine**: corrupt artifact, identity conflict, stale generation,
  contradictory replay, or a timeout or partially applied state after target
  mutation when the winner is uncertain.

No failure opens admission or emits a success-shaped ready result.

## Conformance

V1 conformance must prove:

- RFC 0013 verify and fresh restore are reused;
- ordinary startup is unchanged;
- the restore hold fences every start path;
- no target mutation occurs before aggregate verification;
- component dependency order is preserved;
- external and reconstructed obligations remain owner-evaluated;
- scheduler reconciliation precedes readiness;
- admission opens exactly once from exact durable evidence;
- process health alone cannot open admission;
- `gateway.restore.status` is read-only, operation-fenced, and returns exact
  durable identities for `ready`;
- ordinary and mismatched restored Gateways cannot return success-shaped
  readiness for the requested operation;
- the status method remains available through an authenticated control path
  while ordinary restored work admission is held;
- coordinator crash replay reuses the same child and readiness generation;
- preparation and restore execute exactly once; and
- stale, contradictory, corrupt, and fixed-path collision cases fail closed.
