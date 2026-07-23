# Managed Configuration v1 Core Specification

This document is the implementer-facing core specification for RFC 0019,
Managed Configuration. The RFC explains the motivation, ownership boundary,
and rollout plan. This file defines the v1 invocation, source preparation,
composition, validation, findings, runtime lifecycle, hosting, and conformance
contract that OpenClaw and host supervisors can build against.

Status: draft, tied to RFC 0019.

## Scope

This specification defines:

- repeated ordered local-file inputs at Gateway startup;
- generic layer identifiers with no built-in deployment roles;
- JSON5, include, and environment preparation for each source;
- recursive first-declaration authority;
- bounded tightening for `tools.allow` and `tools.deny`;
- final schema and plugin-aware validation;
- one immutable startup snapshot;
- path-scoped mutation rejection;
- ordinary single-config compatibility;
- per-cell use by Fleet and other host supervisors;
- a minimum conformance suite.

This specification does not define:

- live layer reload or reconciliation;
- writable layers or mutation routing;
- provenance or status APIs;
- generation, rollback, or transaction controllers;
- implicit source discovery, priorities, or inheritance;
- special host, tenant, operator, or Fleet roles;
- secret delivery or credential storage;
- tenant isolation inside one Gateway;
- remote layer URLs or signed layer envelopes.

## Normative Language

The terms **must**, **must not**, **should**, and **may** describe requirements
for a conforming v1 implementation. Examples use deployment-oriented labels
only for clarity; those labels have no core semantics.

## Terminology

- **Layer**: one explicitly ordered ordinary OpenClaw config document.
- **Layer id**: a unique descriptive label supplied with a layer path.
- **Authored value**: a value present after JSON5 parsing, include resolution,
  and environment substitution, before schema defaults are applied.
- **Exact path**: a recursively addressed config path such as
  `gateway.controlUi.allowedOrigins`.
- **Controlling layer**: the earliest layer that declares an exact path.
- **Bounded path**: a path with a field-specific rule that may accept a later
  value only when it provably tightens the effective value.
- **Composed source**: the sparse authored document produced by the ordered
  fold.
- **Runtime snapshot**: the validated config published to ordinary Gateway
  consumers for the process lifetime.
- **Canonical config path**: the `openclaw.json` path that ordinary config
  persistence would target for the process.

## Invocation Contract

The Gateway CLI accepts a repeatable option:

```text
--config-layer <id=path>
```

Example:

```bash
openclaw gateway run \
  --config-layer global=./global.json5 \
  --config-layer tenant=./tenant.json5 \
  --config-layer operator=./operator.json5
```

Requirements:

- option occurrence order is layer order;
- at least one occurrence enables layered mode;
- the first `=` separates id from path;
- ids and paths must be non-empty after trimming;
- ids must be unique within one invocation;
- paths resolve through normal user-path expansion to absolute local paths;
- a missing, unreadable, or invalid file rejects startup;
- `--dev` and layered mode must not be combined;
- no flag means the ordinary single-config path with no layered behavior.

The option may be registered on `gateway` and remain available to its `run`
subcommand. The contract is the repeated ordered sequence, not a particular
argument-parser implementation.

## Source Preparation

Each layer is prepared independently in declared order.

For each layer, OpenClaw must:

1. read the selected local file as UTF-8;
2. parse it as JSON5;
3. resolve `$include` using the layer file as the relative source location and
   the normal configured include roots;
4. resolve `${ENV_NAME}` references using the startup environment and preserve
   normal missing-variable warnings;
5. require a plain-object root;
6. reject authored root keys `meta` and `env`.

`meta` and `env` are rejected because they participate in process bootstrap
semantics that precede layered composition. Launchers must supply process
environment through the process boundary instead.

Preparation does not apply schema defaults to individual layers. Defaults and
plugin-aware validation apply once to the complete composed source so defaults
cannot accidentally claim authority on behalf of an earlier sparse layer.

## Ordered Composition

Composition starts from an empty object and folds prepared layers in declared
order:

```text
state[0] = {}
state[i + 1] = compose(state[i], layer[i])
composedSource = state[layerCount]
```

The operation must be deterministic for the same ordered authored inputs.

### Recursive Object Semantics

Plain objects compose recursively. Declaring one child does not claim sibling
paths. For example, an earlier declaration of `gateway.mode` does not control
`gateway.controlUi.allowedOrigins`.

An empty object is an authored value and controls that object path. It must not
disappear during composition.

Arrays, scalars, and non-plain-object values are whole-path values unless the
path has a bounded rule.

### Exact Authority

Exact authority is the default for every path.

The earliest layer declaring a path becomes its controlling layer. A later
layer may:

- omit the path;
- repeat a deeply equal authored value.

A later layer must not replace the path with a different value. One conflict
invalidates the complete candidate; OpenClaw must not publish a partial
composition.

### Bounded Tool Policy

V1 defines bounded rules only for these exact paths:

| Path | Accepted later value |
| --- | --- |
| `tools.allow` | Proven to narrow the effective allow policy |
| `tools.deny` | Proven to broaden the effective deny policy |

Comparisons must use OpenClaw's runtime tool-policy meaning, including exact
tool names, groups, wildcard patterns, and the meaning of an empty allow list.

The following vectors are normative for V1. `accept` means the later value is
proven monotonic; `reject` includes indeterminate containment.

| Path | Earlier value | Later value | Result | Reason |
| --- | --- | --- | --- | --- |
| `tools.allow` | `[]` | `["read"]` | accept | Empty allow is unrestricted; a non-empty allow narrows it |
| `tools.allow` | `["read", "write"]` | `["read"]` | accept | Exact subset |
| `tools.allow` | `["write"]` | `["apply_patch"]` | accept | The runtime `write` alias includes `apply_patch` |
| `tools.allow` | `["read"]` | `["write"]` | reject | Adds authority |
| `tools.allow` | `["read*"]` | `["read_file"]` | accept | The earlier wildcard matches the later exact name |
| `tools.allow` | `["read*"]` | `["read?"]` | reject | Expression-to-expression containment is not proven |
| `tools.allow` | `["group:fs"]` | `["group:fs"]` | accept | Identical group expression |
| `tools.allow` | `["group:fs"]` | `["group:web"]` | reject | Different group containment is not proven |
| `tools.deny` | `[]` | `["exec"]` | accept | Adds a denial |
| `tools.deny` | `["exec"]` | `["exec", "browser"]` | accept | Exact superset |
| `tools.deny` | `["apply_patch"]` | `["write"]` | accept | The runtime `write` alias continues denying `apply_patch` |
| `tools.deny` | `["write"]` | `["apply_patch"]` | reject | Would stop denying the distinct `write` name |

Runtime matcher evolution must preserve these results. A matcher change that
changes whether an existing layered input is accepted requires a contract
revision, even when the matcher change is otherwise compatible for ordinary
single-config use.

A comparator must fail closed. If containment between expressions cannot be
proven, the later declaration is rejected. Syntactic difference alone is not
proof of either tightening or weakening.

No other path receives a comparator in v1. A future bounded path requires
field-specific semantics, positive and negative vectors, and an RFC/spec
update. Hosts must not inject custom comparators into core composition.

## Findings And Startup Rejection

Composition findings are structured and identify enough context to repair the
source without exposing unrelated config values.

An exact conflict has this minimum shape:

```json
{
  "reason": "ControlledByEarlierLayer",
  "layer": "operator",
  "path": "gateway.controlUi.allowedOrigins",
  "controllingLayer": "tenant"
}
```

A bounded weakening has this minimum shape:

```json
{
  "reason": "WouldWeakenEarlierLayer",
  "layer": "operator",
  "path": "tools.deny",
  "controllingLayer": "global"
}
```

Implementations may attach bounded diagnostic metadata, but must not include
credentials, raw secret values, or complete unredacted documents in findings.

Any parse, include, root-shape, bootstrap-key, composition, schema, or plugin
validation error rejects Gateway startup before a runtime snapshot is
published.

## Final Validation And Publication

After successful composition, OpenClaw must:

1. resolve plugin metadata for the composed source and effective workspace;
2. validate the composed source through the ordinary OpenClaw schema and
   plugin-aware validator;
3. retain ordinary validation warnings;
4. publish the validated config through the existing Gateway startup-snapshot
   path.

Gateway, plugin, channel, tool, and agent consumers receive the ordinary
runtime config shape. They must not implement layer-name or layer-role logic.

The canonical `openclaw.json` is not an implicit final layer and must not be
created, repaired, migrated, or merged into the layered candidate.

## Runtime Lifecycle

Layered v1 is startup-only and read-only.

While layered mode is active:

- `config.get` reports the composed source and effective runtime config;
- config mutation RPCs reject before persistence;
- agent create, update, and delete reject before workspace side effects;
- plugin/runtime mutation preflights reject before installation or other
  persistent side effects;
- config persistence targeting the canonical config path is blocked;
- an unrelated config path in the same process remains writable;
- canonical file watching and last-known-good promotion are disabled;
- source file changes do not alter the active snapshot;
- an in-process Gateway restart reuses the validated startup snapshot;
- a full process restart rereads the declared layer files.

Pathless mutation preflights are interpreted as targeting the process's
canonical config path. Runtime write blocks are path-scoped, support
overlapping owners, and release independently when their owning server closes
or startup fails.

A separate process may edit canonical config while a layered Gateway runs. The
layered Gateway does not consume that file, and such edits do not change its
active snapshot.

## Ordinary Config Compatibility

When no `--config-layer` option is supplied:

- startup reads ordinary canonical config exactly as before;
- normal config watching, migration, mutation, backup, and reload behavior is
  unchanged;
- no layered write block is registered;
- users do not need to know the feature exists.

Layered files use the existing OpenClaw schema. This specification does not
create a parallel hosted or managed config schema.

## Fleet And Host Supervisor Contract

One ordered stack configures one Gateway trust domain. Managed configuration
does not permit mutually untrusted tenants to share a Gateway.

Fleet or another host supervisor may reuse a global document while selecting
cell-specific later documents:

```text
global + tenant-acme + operator-acme       -> Acme Gateway cell
global + tenant-contoso + operator-contoso -> Contoso Gateway cell
```

The supervisor owns:

- cell/process isolation;
- state, credential, workspace, and network boundaries;
- source generation, permissions, mounts, and order;
- rollout and full-process replacement or restart.

OpenClaw owns:

- source resolution;
- recursive composition;
- exact and bounded authority;
- schema and plugin validation;
- runtime snapshot publication;
- mutation enforcement.

V1 does not require a Fleet command change. A Fleet integration may mount the
applicable documents read-only and pass repeated Gateway flags. Cells that
depend on interactive in-cell configuration should use ordinary mutable config
instead of layered mode.

## Security Requirements

- Layer files are trusted startup inputs from the launcher or operator.
- File permissions and secure materialization are host responsibilities.
- Layer ids and diagnostics are not authorization boundaries.
- Layering does not isolate sessions, users, tenants, credentials, channels,
  workspaces, tools, or state inside one Gateway.
- Mutually untrusted tenants require separate Gateway cells or stronger host
  isolation.
- Secrets remain subject to ordinary OpenClaw secret handling and must not be
  exposed in findings or logs.
- A later layer must never weaken an earlier bounded policy when containment is
  uncertain.

## Compatibility And Evolution

The v1 compatibility surface is the CLI spelling, declared order, source
preparation, composition rules, finding reasons, and immutable lifecycle.

Compatible changes may add clearer diagnostics or optimize implementation
without changing accepted/rejected inputs or runtime behavior.

The following require an explicit contract revision:

- accepting remote or implicit sources;
- changing first-declaration authority;
- adding a bounded comparator;
- making layers writable or reloadable;
- adding semantic layer roles;
- changing full-process versus in-process restart behavior;
- treating canonical config as part of the layered stack.

## Minimum Conformance Suites

A conforming OpenClaw core implementation must cover the invocation,
composition, validation, and lifecycle cases below. Host-supervisor
conformance is separate because process, state, credential, mount, and network
isolation are host responsibilities rather than OpenClaw core behavior.

### Invocation And Preparation

- no flag follows ordinary startup;
- one valid layer starts successfully;
- repeated flags preserve declaration order;
- duplicate or empty ids reject;
- missing files and invalid JSON5 reject;
- includes resolve relative to each source;
- missing environment variables preserve normal warnings;
- non-object roots and authored `meta` or `env` reject;
- `--dev` plus a layer rejects.

### Composition

- unrelated object siblings compose;
- the same value may be repeated;
- a different controlled value rejects with `ControlledByEarlierLayer`;
- arrays behave as whole-path values;
- empty objects preserve authority;
- later `tools.allow` narrowing succeeds;
- later `tools.deny` broadening succeeds;
- allow or deny weakening rejects with `WouldWeakenEarlierLayer`;
- ambiguous wildcard containment fails closed.

### Validation And Lifecycle

- final schema and plugin validation use the composed source;
- `config.get` returns the composed snapshot;
- config mutations reject with no canonical write;
- agent mutations reject before workspace side effects;
- pathless plugin mutation preflights reject before installation side effects;
- an unrelated config path remains writable;
- overlapping runtime owners release independently;
- startup failure releases its write owner;
- a fresh state directory does not gain canonical config;
- an existing canonical config remains byte-for-byte unchanged;
- a full restart rereads sources while an in-process restart reuses the
  validated snapshot.

### Hosted Cell

A conforming host integration must cover these cases. They are not prerequisites
for OpenClaw core conformance.

- two cells may reuse one global source with different tenant sources;
- each cell receives only its own effective config and state;
- the global bounded policy cannot be weakened by either tenant source;
- no test treats layering as cross-tenant process isolation.

## Implementer Checklist

An OpenClaw implementation is v1 conformant when it:

- exposes the repeated Gateway flag without changing no-flag behavior;
- prepares sources through native config primitives;
- composes sparse authored values before applying defaults;
- implements generic recursive exact authority;
- implements only the two specified bounded tool-policy paths;
- rejects the complete startup candidate on any finding or validation error;
- publishes one ordinary runtime snapshot;
- scopes immutability to the canonical config path and server lifetime;
- prevents persistent side effects before mutation rejection;
- documents restart-to-apply behavior and the lack of tenant isolation;
- passes the OpenClaw core portions of the minimum conformance suites.

A host supervisor is v1 compatible when it:

- materializes complete local source files before process start;
- passes a deterministic explicit order;
- protects file paths and permissions;
- uses one stack per Gateway trust domain;
- replaces or fully restarts the process to activate changes;
- does not depend on write-through, reload, provenance, or special role
  semantics;
- passes the hosted-cell conformance suite.
