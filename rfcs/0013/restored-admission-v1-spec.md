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
- scheduler reconciliation identity;
- required owner-readiness identities;
- Gateway incarnation identity;
- one admission identity; and
- one canonical readiness generation.

These identities are independent. A process ID, worker name, health probe,
container generation, or local path cannot substitute for them.

The durable completion record contains identities and bounded disposition
metadata only. It must not contain credential values, raw artifact locations,
message payloads, prompts, or arbitrary commands.

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
- scheduler reconciliation;
- required owner readiness;
- Gateway readiness; and
- the one-time admission identity.

Ordinary startup remains unchanged because it has no restored-start evidence.
Ordinary startup cannot consume a committed restore hold, and restored startup
cannot use an ordinary admission path.

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
- coordinator crash replay reuses the same child and readiness generation;
- preparation and restore execute exactly once; and
- stale, contradictory, corrupt, and fixed-path collision cases fail closed.
