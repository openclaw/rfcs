# Claw Project v1 Specification

Status: accepted experimental contract, tied to RFC 0016.

This document defines the source-project, validation, deterministic-build, and
offline-development contract implemented by shipped OpenClaw Claws. It does not
create a second runtime or mutation owner.

## Product States

- A **project** is mutable author source.
- A **package** is the deterministic immutable artifact built from validated
  selected inputs.
- An **applied Claw** is the new agent plus managed and referenced local state
  created by the canonical runtime lifecycle.

OpenClaw owns runtime semantics and local resource owners. Project tooling owns
only project discovery, scaffolding, validation, deterministic packaging,
offline preview, and exact-artifact handoff.

## Project Discovery and Layout

A v1 project contains both `package.json` and `CLAW.md` at its root.
JSON-only packages remain valid package input but are not v1 authoring projects.

Conventional optional paths are:

```text
my-claw/
|-- package.json
|-- CLAW.md
|-- BOOTSTRAP.md
|-- profiles/
|   `-- openclaw.yml
|-- workspace/
`-- references/
```

Discovery starts from the supplied file or directory, resolves canonical real
paths, and requires exactly one containing project root. Ambiguous nested
projects fail. `.git` and `node_modules` are project-only exclusions and cannot
supply selected package content.

## Public Commands

```bash
openclaw claws create [path] [--name <name>] [--agent-id <id>] [--json]
openclaw claws validate [path] [--json]
openclaw claws dev [path] [--agent-id <id>] [--workspace <path>] [--json]
openclaw claws build [path] --out <artifact.tgz> [--json]
```

All commands remain behind `OPENCLAW_EXPERIMENTAL_CLAWS=1`.

## Create

`create` writes one minimal project into an absent or empty directory:

- `package.json` with canonical name, version `0.1.0`, and
  `openclaw.claw: "CLAW.md"`; and
- `CLAW.md` with schema version 1, portable agent identity, and a non-whitespace
  body that becomes managed `SOUL.md`.

The generated project must pass offline validation. Create fails rather than
merging into a non-empty destination. It does not install dependencies, add an
agent, contact ClawHub, select credentials, or mutate OpenClaw state.

## Validate

`validate` is read-only and validates the exact selected inputs that build
would consume:

- canonical package name and exact version;
- `openclaw.claw` exactly equal to `CLAW.md`;
- strict `CLAW.md` schema and body-to-`SOUL.md` conflicts;
- recognized conventional OpenClaw profile, including shipped legacy-pointer
  compatibility;
- optional non-empty safe UTF-8 package-root `BOOTSTRAP.md`;
- every declared workspace source and portable path collision;
- exact package and extension versions; and
- project-only excluded paths.

A project package must not declare a non-empty `scripts` object. Validation
rejects unsafe links except the confined development-manifest symlink supported
by the canonical reader, special files, over-limit content, ambiguous roots,
selected content under `.git` or `node_modules`, and selected path collisions.

Validation reports stable structured diagnostics and does not install, enable,
authenticate, publish, apply, or migrate durable OpenClaw state.

## Deterministic Build

`build` implicitly validates, requires a new `.tgz` destination whose parent
already exists, and refuses overwrite.

The artifact:

- is an npm-compatible archive with a `package/` root;
- contains generated canonical `package.json`, exact `CLAW.md`, optional
  `BOOTSTRAP.md`, the recognized OpenClaw profile, and exact declared workspace
  source bytes;
- excludes all unselected project files, `.git`, and `node_modules`;
- uses stable byte ordering, epoch timestamps, portable archive metadata,
  normalized permissions, separators, and gzip settings;
- executes no package script, hook, project code, dependency resolution, or
  network call; and
- is reopened through the canonical Claw reader before publication.

If selected input changes after validation, build fails. The builder stages in
the output parent and publishes with no-replace semantics. Failure removes only
its incomplete staging output and never deletes or replaces a pre-existing
destination.

Build returns the artifact path, SHA-256 integrity, byte length, included files,
excluded paths, and package identity. Build success is not publication,
publisher ownership, security approval, or runtime readiness.

## Offline Development Preview

`dev` validates and builds a temporary artifact, safely extracts it, and invokes
the canonical OpenClaw add planner against that exact built content.

V1 dev is offline and non-mutating:

- no agent, workspace, plugin, MCP, schedule, channel delivery, or durable Claw
  state is created;
- no provider turn, network-capable tool, MCP server, or package installer is
  executed;
- the result has `mutationAllowed: false` and reports the same blockers,
  capability effects, and readiness requirements as the canonical planner; and
- temporary artifact and extraction paths do not become source identity or
  stable plan inputs.

If an owner cannot preflight offline, dev reports the unresolved prerequisite
or blocker rather than claiming readiness or weakening the offline boundary.

## Package and Publication Handoff

Publication consumes the exact already-built artifact. It must not rebuild
source, infer omitted files, execute project code, or substitute archive bytes.
The built, published, downloaded, and locally verified artifact identities must
remain linked by exact digest.

Applying that artifact still requires canonical inspect, dry-run, consent,
owner readiness, and lifecycle behavior. Registry acceptance never bypasses
dependency policy or capability consent.

## Security and Non-Goals

Project tooling never resolves or injects secrets from environment or host
state. Logs and JSON results redact credentials and sensitive owner errors.

V1 does not define:

- package scripts, arbitrary build hooks, or setup code;
- provider-backed model evaluation or live disposable development;
- credentials, bindings, host paths, or runtime deployment;
- a second Gateway, plugin manager, scheduler, sandbox, or secret store;
- publication as an OpenClaw local-runtime command; or
- a universal cross-harness CLI.

## Conformance

A conforming implementation proves:

1. Fresh create passes offline validate.
2. Validate rejects unsafe or unsupported inputs without mutation.
3. Build output is deterministic for identical selected inputs.
4. The built artifact passes the canonical package reader.
5. Unselected project and secret-bearing ambient files are absent.
6. Dev produces canonical offline planning with no durable or delivery effects.
7. Build refuses overwrite and preserves pre-existing output.
8. Clean-recipient add, status, doctor, update, export, and remove continue to
   use their canonical runtime owners.
