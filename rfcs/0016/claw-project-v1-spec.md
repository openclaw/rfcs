# Claw Project v1 Specification

This document is the implementer-facing source-project, deterministic-build,
and local-development specification for RFC 0016, Claws. The existing
`CLAW.md` and package specifications define the portable declaration and built
artifact. This specification defines how authors produce and exercise that
artifact without creating a second OpenClaw runtime or mutation owner.

Status: experimental draft, tied to RFC 0016.

Addendum PR: [openclaw/rfcs#56](https://github.com/openclaw/rfcs/pull/56).

## Dependency

This specification depends on the portable profile/bootstrap contract proposed
in [RFC PR #48](https://github.com/openclaw/rfcs/pull/48) and the
application-composition and client contract proposed in
[RFC PR #52](https://github.com/openclaw/rfcs/pull/52). In particular, it
consumes those proposals' schema-v1 conventional profiles, package-root
`BOOTSTRAP.md`, native extensions, managed application content, and shared
lifecycle services.

This specification does not independently standardize those inputs. If either
prerequisite changes, this specification must be reconciled before acceptance.
It may be reviewed and prototyped in parallel, but it must not be accepted or
merged first.

## Scope

This specification defines:

- the distinction among a Claw project, package, and applied Claw;
- project discovery and conventional source layout;
- create and read-only validation behavior;
- deterministic package builds and project-only exclusions;
- offline local lifecycle preview;
- the handoff of exact built artifacts to ClawHub and OpenClaw; and
- conformance evidence for the complete author-to-recipient lifecycle.

It does not change the portable package schema version, ownership model, or
one-Claw-one-new-agent invariant.

## Product States

### Claw project

A Claw project is a human-authored directory containing package inputs and
optional project-only development material. It is mutable source and is not a
registry identity or an applied installation.

### Claw package

A Claw package is a deterministic immutable artifact built from validated
project inputs. It contains only publishable package content defined by RFC
0016 and its sidecar specifications. Its artifact digest identifies the exact
bytes inspected, published, downloaded, and handed to an applying client.

### Applied Claw

An applied Claw is one new agent plus the managed and referenced local state
realized by a harness. Credentials, selected accounts, channel addresses,
provider authentication, host paths, runtime availability, operator policy,
sessions, and user-created personalization remain local and are not package
identity.

```mermaid
flowchart LR
  Project[Claw project] --> Validate[validate]
  Validate --> Dev[offline dev preview]
  Validate --> Build[deterministic build]
  Build --> Package[Claw package]
  Package --> Publish[ClawHub publish]
  Package --> Add[OpenClaw add]
  Add --> Applied[applied Claw]
```

## Ownership Boundary

OpenClaw owns runtime semantics and every local capability owner: agents,
models, tools, sandboxes, channels, secrets, plugins, MCP servers, schedules,
workspaces, bootstrap, status, diagnostics, update, and removal.

The Claw project tooling owns only source discovery, project validation,
deterministic packaging, offline lifecycle preview, and exact-artifact handoff.
It must call public or explicitly shared OpenClaw lifecycle services rather
than reproduce their planning or mutation logic.

ClawHub owns authenticated publication, package ownership, immutable versions,
security scanning, discovery, and exact artifact distribution. Publication is
not an OpenClaw runtime mutation and must not rebuild source.

## Project Discovery and Layout

A V1 project is identified by both `package.json` and `CLAW.md` at its root.
No additional root configuration file or hidden generator state is required.
Equivalent grouped JSON remains a supported package-reader serialization, but
V1 project authoring deliberately requires the human-readable `CLAW.md`
envelope. A JSON-only package is therefore valid package input, not a V1 source
project for `create`, `validate`, `dev`, or `build`.

Conventional optional paths are:

```text
my-claw/
|-- package.json
|-- CLAW.md
|-- BOOTSTRAP.md
|-- profiles/
|   `-- openclaw.yml
|-- skills/
|-- references/
|-- schemas/
|-- templates/
`-- examples/
```

These directory names do not create new runtime owners. Files become package
content only through the existing package and manifest contracts. Repository
tests, fixtures, and other author-only material are not selected implicitly.

Project discovery must use canonical real paths, reject an ambiguous ancestor
project, and apply the package specification's path, link, file-type, size, and
containment rules before consuming source bytes.

## Create

`openclaw claws create [path]` scaffolds one minimal, immediately valid project.
It may offer a small number of maintained examples, but templates must produce
the same ordinary files an author would write by hand.

Create must:

- fail rather than merge into a nonempty destination unless an explicit future
  conflict contract says otherwise;
- emit readable Markdown, JSON, and YAML with no generated lock file or hidden
  project database;
- use a development-safe package identity and version;
- produce a project that passes validation without network access; and
- make optional capabilities removable without repairing unrelated files.

Create does not install dependencies, add an agent, contact ClawHub, select
credentials, or modify OpenClaw state.

## Validate

`openclaw claws validate [path]` is read-only. It validates the project and the
exact package inputs that a subsequent build would consume.

Validate is also an implicit prerequisite of `dev` and `build`. Those
commands must return the same validation findings before performing their own
work. Standalone validate remains useful for editors, CI, and focused diagnosis
without becoming another required first-use step.

Validation must:

- discover exactly one project root;
- validate package metadata, `CLAW.md`, conventional profiles,
  `BOOTSTRAP.md`, declared files, skills, and exact dependency references;
- report project-only exclusions;
- resolve local source paths without mutation;
- reject unsupported required components, collisions, unsafe paths, links
  other than the package specification's confined development-manifest symlink,
  special files, unbounded content, and credentials in prohibited fields;
- reject a nonempty package `scripts` object, including npm lifecycle scripts;
- distinguish package validity from local OpenClaw readiness; and
- emit stable machine-readable findings suitable for editors and CI.

Validation may inspect installed catalogs needed for compatibility, but it must
not install, enable, authenticate, publish, or apply anything. A network-backed
resolution mode must be explicit and must not change the local project.

## Deterministic Build

`openclaw claws build [path] --out <artifact>` produces one immutable package
artifact from the validated project snapshot.

The destination must not already exist. The builder writes a temporary sibling,
re-opens and verifies that temporary artifact, and publishes it to the requested
path with no-replace semantics. Failure removes or clearly quarantines only the
incomplete temporary artifact; it must never delete or replace a pre-existing
destination.

The V1 OpenClaw builder emits a deterministic npm-compatible `.tgz` archive
with the conventional `package/` root. Registries and applying clients may
continue to support other explicitly identified transport formats under the
package specification, but those formats are not alternative outputs of the V1
project builder.

For identical source bytes, selected inputs, builder contract version, and
declared package metadata, two builds must be byte-identical. The builder must
therefore define stable path ordering, normalized archive metadata, timestamps,
permissions, separators, and compression settings. It must not include host
user names, absolute paths, process environment, filesystem mtimes, caches, or
nondeterministic generated identifiers.

The repository must retain a golden project and expected artifact digest.
Supported Linux, macOS, and Windows builders must produce those exact bytes;
WSL must also pass the packed-CLI build/read smoke. A platform-specific archive
is nonconforming rather than a valid alternative artifact.

V1 build must not execute package scripts, hooks, arbitrary project code, or
network calls. Executable application behavior remains in exact declared
plugins or extensions and is evaluated by their canonical owners during
OpenClaw planning.

A V1 Claw project's root `package.json` must not contain a nonempty `scripts`
object. Validation rejects it, and build must not copy it into the artifact.
This keeps the Claw artifact data-only even when another tool treats the output
as an npm-compatible archive. Declared plugin or extension packages retain
their own canonical installation and execution contracts; this rule applies to
the Claw package itself.

The build excludes by default:

- `tests/` and project-only evaluation fixtures;
- caches, logs, temporary output, and prior build artifacts;
- local credentials, environment files, OAuth state, and SecretRef values;
- local OpenClaw state, sessions, memories, bindings, and user-created output;
- host-specific paths and development dependency mappings; and
- source-control metadata.

These exclusions prevent ambient or undeclared local state from entering a
build. Explicitly declared workspace sources are package content and are copied
byte-for-byte after the package path and file rules pass; project tooling cannot
promise semantic secret detection inside arbitrary authored content. Authors
must not declare secret-bearing files, package validation and registry scanning
may reject suspected secrets, and valid packages remain subject to the package
specification's no-secrets rule.

After writing the artifact, the builder must re-open it through the canonical
Claw package reader and verify its package identity, complete contents,
integrity, and expected artifact digest. A failed re-read deletes or clearly
quarantines the incomplete output and returns failure.

Build and publish are separate operations. Build success conveys no registry
ownership, security approval, or runtime compatibility promise.

## Offline Development Preview

`openclaw claws dev [path]` builds a development snapshot and exercises it
through the canonical OpenClaw planner without applying it. V1 `dev` is
offline, non-delivering, and read-only outside temporary build files. It
validates, builds, and produces the complete native lifecycle preview without
creating applied or durable OpenClaw state. It does not start provider-backed
turns, invoke network-capable tools or MCP servers, activate recurring
schedules, or deliver through channels.

If a canonical owner cannot complete preflight without network access, offline
dev reports that unresolved prerequisite or blocker rather than weakening the
offline boundary or claiming readiness.

Dev must:

- show the same inspect and dry-run effects production add would show;
- reuse the canonical add planner and readiness owners; and
- expose missing local prerequisites honestly.

## Publication and Application

ClawHub publication consumes the exact already-built artifact. It must not run
the project builder, infer omitted files, execute project code, or substitute a
new archive. The authenticated publisher selects package identity and version;
ClawHub validates and scans the exact bytes, stores their digest, and enforces
version immutability.

The digest of the locally built and previewed archive, accepted publication
artifact, and downloaded archive must match. A transport client then verifies
that digest, rejects unsafe archive entries, extracts the package into an
isolated directory, and hands that directory to OpenClaw's canonical package
reader. OpenClaw records its canonical package snapshot and plan-integrity
digests; the proof record binds those identities to the verified transport
digest. Registry approval does not bypass dependency policy, capability
consent, or canonical owner readiness.

No `openclaw claws publish` command is required by this specification. A
ClawHub-owned CLI or another publisher client may perform the authenticated
upload as long as it accepts the exact built artifact and preserves this
boundary.

## Security and Privacy

Project tooling inherits all package containment, archive, size, integrity,
dependency, and consent rules from RFC 0016. It adds these requirements:

- project validation and build never resolve, interpolate, or inject secret
  values from the environment, host state, or SecretRef providers;
- validation rejects package scripts and build executes or ships no
  package-authored lifecycle code;
- dev stops at canonical offline planning and produces no provider, network,
  schedule, channel-delivery, or durable-state effects;
- logs and machine-readable results redact credentials and private local data;
- publication accepts exact bytes and cannot silently rebuild; and
- experimental commands remain behind `OPENCLAW_EXPERIMENTAL_CLAWS=1`.

## Conformance

A V1 project implementation conforms only when it proves:

1. A fresh `create` result passes offline `validate` without hidden state.
2. Validation rejects unsafe and unsupported input without mutation.
3. Editing one selected input predictably changes the project/build digest.
4. One golden project produces byte-identical output and the same digest on
   Linux, macOS, Windows, and WSL packed-CLI proof.
5. The built artifact independently passes the canonical package reader.
6. Project-only tests, caches, credentials, and host paths are absent.
7. Offline dev creates no durable OpenClaw state and produces no provider,
   network, schedule, or channel-delivery effects.
8. The built, published, and downloaded archive digests match, and proof binds
   the safely extracted package content to OpenClaw's canonical package
   snapshot and plan-integrity digests.
9. Clean-recipient add, status, doctor, and remove use existing OpenClaw
   lifecycle owners and preserve user-owned local state.

## Non-Goals

- A TypeScript agent framework or package-authored runtime code.
- A second Gateway, plugin manager, scheduler, sandbox, or secret store.
- Schema version 2 or new portable package fields.
- Package scripts, arbitrary build hooks, setup scripts, or downloaded test
  execution.
- Packaging credentials, channel accounts, concrete bindings, or host paths.
- Deploying or managing an OpenClaw Gateway service.
- Multi-agent or subagent package semantics.
- Requiring `npx claws`, Hermes, Codex, Claude, or another harness for V1.
- Making publication part of OpenClaw's local runtime lifecycle.

## Evolution

A standalone `claws` tool may later implement this project contract and invoke
public harness commands through adapters. That does not change the V1 owner
boundary: OpenClaw remains the reference runtime and canonical mutation owner,
and a foreign adapter must fail rather than silently discard required package
semantics.

Additional project metadata, test check kinds, dependency-workspace mappings,
and deployment targets require separate evidence and versioned contracts. They
must not be inferred from permissive unknown fields in V1.

The first implementation intentionally stops at one polished end-to-end
reference Claw. The following are follow-up tracks, not V1 conformance:

- a bounded declarative `claws test` format;
- provider-backed model evaluation;
- live disposable development, including interruption recovery; and
- a broader Awesome Claws conformance matrix.

Each follow-up requires evidence from the initial author workflow and its own
reviewed safety, ownership, and result contract before implementation.
