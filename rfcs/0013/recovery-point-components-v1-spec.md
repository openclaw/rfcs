# Recovery Point Components v1 Specification

This document is the implementer-facing component-composition specification for
RFC 0013, SQLite Snapshot Backup Artifacts. RFC 0013 defines one verified
SQLite snapshot directory. This sidecar defines how a recovery workflow may
compose those directories with other owner-authored artifacts without changing
the SQLite snapshot contract.

Status: draft, tied to RFC 0013.

## Scope

This specification defines:

- one aggregate recovery point made from immutable owner components;
- use of RFC 0013 global and per-agent snapshot directories as SQLite
  components;
- explicit non-SQLite owner components;
- a closed required-component inventory supplied by the runtime state owner;
- captured, external, reconstructed, and ephemeral obligations;
- an explicit protection classification that cannot imply credential-free
  portability;
- exact component identity, ordering, compatibility, and verification;
- fail-closed aggregate manifest parsing and conformance.

This specification does not define:

- another SQLite snapshot command, repository, or manifest;
- mutation of an RFC 0013 snapshot after publication;
- upload, storage transport, retention, or encryption implementation;
- Gateway suspension, final handoff, or source destruction;
- restore-on-boot, restored admission, hibernation, or wake;
- arbitrary restore hooks or a generic capture-provider registry.

## Shipped Foundation

An RFC 0013 component is a completed directory produced and verified by:

```text
openclaw backup sqlite create
openclaw backup sqlite verify
openclaw backup sqlite restore
```

The aggregate layer must treat the directory and its strict `manifest.json` and
`database.sqlite` bytes as immutable. It must not:

- copy a live `.sqlite`, `-wal`, `-shm`, or `-journal` file;
- reimplement `VACUUM INTO`;
- weaken role, owner, schema, index, ACL, DACL, link, or race validation;
- claim that a locally present path is durable host acceptance; or
- treat a successful SQLite snapshot as complete OpenClaw recovery state.

## Ownership

| Owner | Authority |
| --- | --- |
| SQLite owner | RFC 0013 capture, manifest, verification, and fresh restore. |
| Non-SQLite owner | Artifact contents, compatibility, and restore semantics for its state. |
| Recovery-point composer | Required-component inventory, exact identities, dependency order, and obligation closure. |
| Host or operator | Durable destination, encryption, access control, retention, and recovery-point selection. |

The composer does not inspect private SQLite schema to infer application state.
It consumes the verified owner result.

## Component Model

A recovery point contains a closed, ordered component list. V1 component kinds
are:

```text
sqlite-global
sqlite-agent
config
workspace
plugin-source
```

The SQLite kinds reference RFC 0013 snapshot directories. The other kinds must
be produced by their existing semantic owner from bounded regular-file
inventories. V1 does not allow third-party component registration.

| Kind | Semantic owner | Eligibility |
| --- | --- | --- |
| `sqlite-global` | OpenClaw shared-state database owner | Eligible through RFC 0013. |
| `sqlite-agent` | OpenClaw per-agent database owner | Eligible through RFC 0013. |
| `config` | OpenClaw config loader and include resolver | Reserved until the owner exposes bounded capture and restore verification. |
| `workspace` | OpenClaw workspace owner | Reserved until the owner exposes bounded capture and restore verification. |
| `plugin-source` | OpenClaw plugin installation owner | Reserved until the owner exposes bounded capture and restore verification. |

Reserved kinds are specified so the aggregate contract has stable ownership.
They are not eligible components until their named owner contract exists and
passes this specification's verification requirements. A host must not invent
path-copy behavior to make a reserved kind appear implemented.

Every component records:

- stable component ID;
- kind and owner;
- immutable artifact digest and size;
- owner manifest digest and size when the component has its own manifest;
- compatibility identity;
- dependency IDs;
- capture time;
- required or optional status.

Paths are materialization details, not component identity.

## Aggregate Manifest

Illustrative V1 shape:

```json
{
  "version": "openclaw-recovery-point/v1",
  "recoveryPointId": "recovery-point-42",
  "createdAt": "2026-07-21T15:00:00.000Z",
  "inventory": {
    "version": "openclaw-runtime-sqlite-inventory/v1",
    "requiredComponentIds": ["sqlite/global", "sqlite/agent/main"]
  },
  "protection": {
    "mode": "host-protected"
  },
  "components": [
    {
      "id": "sqlite/global",
      "kind": "sqlite-global",
      "owner": "openclaw-state",
      "artifactSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "artifactSizeBytes": 1048576,
      "ownerManifestSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "ownerManifestSizeBytes": 512,
      "compatibility": "openclaw-state-schema/7",
      "dependsOn": [],
      "required": true
    }
  ],
  "obligations": {
    "external": [],
    "reconstructed": [],
    "ephemeral": []
  }
}
```

The exact serialization must be deterministic. `recoveryPointId` is the
lowercase hexadecimal SHA-256 digest of the canonical UTF-8 JSON serialization
of the aggregate manifest with the `recoveryPointId` field omitted. Canonical
JSON sorts object keys recursively, preserves array order, and emits no
insignificant whitespace.

Unknown required fields,
unknown component kinds, duplicate IDs, missing dependencies, dependency
cycles, digest mismatches, and unsupported major versions fail closed.

The state owner supplies the complete required component IDs for the selected
runtime before composition. V1 requires exactly one global component and the
exact selected set of per-agent components. The inventory is canonicalized,
stored in the manifest, and covered by `recoveryPointId`. Composition fails on
a missing or extra component; successfully composing one agent cannot imply
that every agent owned by the selected runtime was captured.

The aggregate manifest does not copy the complete RFC 0013 manifest. It binds
that owner manifest by digest and preserves it beside the component artifact.

## Portability And Sensitive State

An ordinary RFC 0013 snapshot can contain auth profiles, session state, plugin
state, and credentials-adjacent records. This sidecar does not silently remove
or rewrite those rows. A recovery point composed directly from ordinary RFC
0013 snapshots therefore has `protection.mode = host-protected`. The aggregate
manifest cannot label itself credential-free or portable.

A deployment may call a recovery point credential-free portable only when a
separate owner-authored portability receipt proves that every component is an
approved portable projection, binds the exact component and artifact digest,
names the owner contract and version, and proves every sensitive surface has
one explicit treatment:

- **captured**: the owner approves non-reissuable runtime-owned bytes for the
  selected host protection domain;
- **external**: the destination re-resolves the value from its existing owner;
- **reconstructed**: the owner establishes a safe default or rebuilds from
  declared inputs; or
- **ephemeral**: normal startup recreates it and readiness does not depend on
  its captured bytes.

Host-managed or reissuable credentials, OAuth tokens, provider tokens, and
short-lived session credentials must be `external` or omitted. They cannot use
the `captured` treatment in V1.

Manifest obligation arrays imply the `external`, `reconstructed`, or
`ephemeral` treatment. Entries carry a closed obligation kind, stable owner,
identifier, and readiness requirement. V1 initially supports only named
SecretRef, plugin-dependency, and runtime-cache owner pairs; unknown owner,
kind, or treatment combinations fail closed. Obligations must not carry secret
values, credential bytes, raw prompts, message payloads, or arbitrary commands.
Captured state is represented by its owner component, not by an obligation
entry.

If a credential-free portable projection is required, its state owner must
define and verify that projection as a separate operation. It must not change
ordinary `backup sqlite` behavior or mutate the live database.

## Acceptance Byte Set

The recovery point defines a closed logical acceptance byte set without
standardizing a tarball, directory tree, object-store key, or transport:

1. the canonical aggregate-manifest bytes;
2. each exact owner-manifest byte sequence; and
3. each exact component-artifact byte sequence.

An acceptance inventory records the aggregate-manifest digest and size plus,
for every canonically ordered component, its component ID, owner-manifest
digest and size, and artifact digest and size. Its identity is the SHA-256 of
the canonical inventory with that identity field omitted. Storage packaging
and paths remain host-owned and are not part of component identity.

## Verification

Aggregate verification must:

1. parse the closed manifest;
2. verify deterministic identity;
3. verify every component digest and size from content-pinned reads;
4. invoke the owner verifier for every required component;
5. require the component IDs to equal the closed owner inventory;
6. validate dependency ordering and compatibility;
7. validate every obligation against the supported owner/treatment pairs; and
8. return one exact verified recovery-point identity and acceptance inventory.

Verification failure must not create restore targets or return a
success-shaped partial result.

## Conformance

V1 conformance must prove:

- one global and the exact owner-selected per-agent RFC 0013 components;
- rejection of missing and extra components against the bound inventory;
- deterministic aggregate identity;
- exact owner-manifest binding;
- canonical recovery-point identity;
- rejection of missing, duplicate, unknown, corrupt, or reordered components;
- rejection of dependency cycles and unsupported compatibility;
- explicit sensitive-state treatment and rejection of reissuable credential
  bytes;
- ordinary snapshot composition remaining `host-protected` until an exact
  owner portability receipt exists;
- deterministic acceptance inventory over the closed logical byte set;
- no secret values in aggregate metadata; and
- no duplicate SQLite capture or verification implementation.

The first reserved non-SQLite kind gains its own conformance cases only after
its named semantic owner exposes the bounded capture and restore-verification
contract required by this specification.
