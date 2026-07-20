# Claw Package v1 Specification

This document is the implementer-facing package and lifecycle-boundary
specification for RFC 0016, Claws. It defines how one Claw manifest and its
referenced files are identified, validated, published, resolved, and handed to
an OpenClaw lifecycle implementation.

Status: experimental draft, tied to RFC 0016.

## Scope

This specification defines:

- package identity and required metadata;
- package layout and manifest selection;
- archive and filesystem safety requirements;
- publication and registry validation boundaries;
- artifact integrity and exact-version resolution;
- the contract between a registry and an applying harness;
- lifecycle ownership requirements for add, update, status, and remove.

The grouped manifest schema and `CLAW.md` envelope are defined by
[`claw-md-v1-spec.md`](claw-md-v1-spec.md). Equivalent grouped JSON passes
through the same validator and lifecycle.

This specification does not define:

- a new package transport or dependency solver;
- a replacement for skill or plugin packages;
- credentials, local bindings, or host policy;
- the physical schema of OpenClaw provenance storage;
- a cross-harness command-line standard;
- whole-instance backup, restore, or migration.

## Terminology

- **Artifact**: the exact immutable package bytes identified by package name,
  version, byte length, and digest.
- **Development snapshot**: one immutable local read of a development manifest
  and every package file it references.
- **Owner**: the existing OpenClaw subsystem authoritative for an agent, file,
  skill, plugin, MCP server, or scheduler record.
- **Managed resource**: a resource created specifically for one installed Claw
  with an exclusive identity that the Claw lifecycle may reconcile and remove
  after ownership and drift checks.
- **Referenced resource**: a shared canonical resource on which a Claw depends
  without acquiring exclusive lifetime authority.
- **Dependency edge**: the current relationship between an installed Claw and
  a referenced resource. It is warning and cleanup evidence, not an uninstall
  lock or historical reference count.
- **Resource origin**: whether Claw add introduced a canonical resource or
  declaration or found it already present. Origin informs cleanup eligibility
  but is not ownership.
- **Applied**: every consented mutation completed or an existing canonical owner
  was safely referenced.
- **Ready**: the applied agent also has all local credentials, executables,
  bindings, and runtime prerequisites needed to operate as declared.
- **Application profile**: the owner mapping and lifecycle behavior required to
  turn a manifest into a runnable agent on one harness.

## Package Model

A Claw package is a versioned, immutable distribution of one complete agent
definition. It contains:

- package identity in `package.json`;
- one `CLAW.md` or equivalent grouped JSON manifest;
- every workspace source file referenced by that manifest.

The package composes existing skills, plugins, MCP declarations, workspace
files, agent settings, and scheduled work. It is not a plugin, a plugin bundle,
or a replacement package type for those artifacts. Applying it delegates each
resource to its existing OpenClaw owner.

One package adds one new agent. It must not adopt, merge into, replace, or
silently update an agent that the operator already owns.

## Required Package Metadata

The package root must contain a UTF-8 JSON `package.json` with:

```json
{
  "name": "@acme/github-triage",
  "version": "1.2.0",
  "type": "module",
  "openclaw": {
    "claw": "CLAW.md"
  }
}
```

| Field | Required | Semantics |
| --- | --- | --- |
| `name` | Yes | Canonical package coordinate assigned by the registry. Display slugs and aliases are not identity. |
| `version` | Yes | Exact canonical SemVer 2.0.0 version. Tags, ranges, and a leading `v` are forbidden. |
| `openclaw.claw` | Yes | Package-relative path to the manifest. |
| `type` | No | Ordinary package metadata; it does not affect Claw parsing. |

Registry identity, version, and publisher ownership come from this package
metadata and the authenticated publish operation. They must not be duplicated
as authoritative fields inside the Claw manifest.

At publication, the declared `name` and `version` must exactly match the
authenticated publish coordinate. A mismatch must reject the publication.
Registries must reject an identity that is not canonical under their published
package-name rules rather than silently normalizing it to a different package.

## Package Layout

An illustrative package is:

```text
github-triage/
|-- package.json
|-- CLAW.md
`-- workspace/
    |-- AGENTS.md
    |-- SOUL.md
    `-- reference/
        `-- triage-policy.md
```

All manifest paths and referenced workspace sources must resolve inside the
unpacked package root. A registry must verify that every declared source exists
in the uploaded artifact before accepting a version.

## Portable Path Rules

Package paths must be safe on supported OpenClaw filesystems. In addition to
the relative-path rules in the manifest specification, publishers and
registries must reject:

- absolute POSIX, UNC, or drive-qualified paths;
- `.` or `..` traversal segments;
- NUL and control characters;
- Windows-reserved path components and invalid filename characters;
- components with trailing spaces or dots;
- two paths that collide after slash normalization, Unicode NFC normalization,
  and case folding;
- a manifest path or workspace source whose canonical realpath escapes the
  package root;
- symlinks, hardlinks, device files, sockets, and every other entry that is not
  an ordinary directory or regular file.

Consumers must apply bounded file-size and aggregate extraction limits. Limits
are implementation policy and should be documented by the registry or harness;
exceeding them must fail closed rather than truncate content.
Claws must not invent per-capability quotas such as a Claw-only scheduler count;
canonical owner limits apply uniformly. General package, manifest, extraction,
and plan-size limits may protect parsing and resource use across all fields.

Archive entry names must also be unique under the portable collision key before
extraction. Consumers must not trust archive ordering to resolve duplicates.
Executable bits, owners, groups, timestamps, and other host metadata are not
portable package semantics and must not grant execution authority after
extraction.

## Manifest Selection

`openclaw.claw` selects the one manifest for the package. The path must resolve
to a regular UTF-8 text file inside the package.

If the selected basename is `CLAW.md`, compared case-insensitively, the consumer
uses the Markdown-envelope parser. Other selected filenames are parsed as JSON.
Both forms pass through the same strict schema version 1 validator.

A package must not select behavior from package scripts or another undeclared
manifest. Installing or inspecting a Claw package must not execute package
lifecycle scripts merely to discover its manifest. The `CLAW.md` body remains
documentation only.

## Publication Validation Pipeline

A conforming registry must validate a publication in this order:

1. Authenticate the publisher and resolve the requested package coordinate.
2. Verify that `package.json` identity matches that coordinate exactly.
3. Safely enumerate and extract the artifact under package size and path limits.
4. Resolve `openclaw.claw` inside the package root.
5. Parse the selected `CLAW.md` or JSON document.
6. Validate the strict schema version 1 manifest.
7. Verify that every workspace source exists and is a safe regular file, and
   that any local avatar resolves through a declared workspace destination.
8. Apply registry ownership, visibility, moderation, malware, and security
   scanning rules.
9. Compute and retain the immutable artifact digest over the exact distributed
   artifact bytes.
10. Store a bounded public safe summary derived from the validated manifest.

The exact artifact remains the authoritative stored declaration. A registry is
not required to duplicate the parsed full manifest into its metadata store; if
it does, that copy must remain private and must fit the registry's documented
storage limits without truncation.

Validation is all-or-nothing. A registry must not publish a partial package or
silently discard unsupported manifest fields or components.

## Artifact Resolution and Integrity

A feed or registry result used for add or update must resolve to an exact
package name, exact version, artifact location, and immutable artifact digest
formatted as `sha256:` followed by 64 lowercase hexadecimal characters. The
consumer records the observed byte length and must also verify it when the
registry supplies an expected length.
Floating tags and version ranges may be discovery inputs, but they must be
resolved before a managed lifecycle plan is produced.

Artifact metadata must identify the archive format or transport kind. A
consumer must select its bounded safe extractor from that metadata and must not
assume that every registry artifact uses the same archive format.

The registry artifact digest covers the exact distributed artifact bytes. The
trusted registry or signed feed binds that digest to package identity; the
digest alone proves byte equality, not publisher identity, review, or safety.

A local development source must be materialized as one immutable planning
snapshot containing the exact manifest bytes and every referenced workspace
source path and byte sequence. Its development digest must cover that complete
snapshot plus the canonical source location. Hashing only the manifest is not
sufficient. Development and registry digests identify different trust layers
and must not be presented as interchangeable proofs.

A consumer must verify the expected artifact digest before trusting package
contents. Validation and integrity do not imply that package code or declared
capabilities are approved; existing source policy, scanning, and install safety
checks still apply to every dependency.

## Registry and Client Boundary

A registry such as ClawHub owns:

- authenticated publication and package ownership;
- immutable versions and artifact storage;
- package validation and security eligibility;
- safe search/detail summaries;
- exact artifact resolution and hosted feed entries.

OpenClaw owns:

- local package and manifest validation;
- read-only planning and operator consent;
- creation of the new agent and workspace;
- delegation to skill, plugin, MCP, agent, workspace, and scheduler owners;
- local provenance, status, diagnostics, update, export, and removal.

Registry approval of a Claw must not transitively approve a skill or plugin
dependency. The client must resolve and evaluate every dependency through its
normal policy and installer path.

Public search and release APIs should expose a bounded, derived summary for
indexing. Before consent, the applying client must make the exact grouped
manifest available for review and display its complete package effects from the
downloaded artifact under the artifact's visibility and authorization rules.
Valid packages cannot contain secrets. The downloaded artifact remains the
authoritative full declaration; a summary must not replace or contradict it.

## Read-Only Planning and Consent

Inspection validates package metadata and the manifest without reading or
mutating local lifecycle state. Add dry-run resolves the final local agent id,
workspace, dependencies, MCP servers, files, scheduled work, local credential
prerequisites, and every external executable or downloadable artifact. It
reports all actions, retained resources, conflicts, blockers, and post-add
readiness requirements.

The plan must expose the security-relevant effect of each action: exact package
identity and integrity; workspace source, destination, and content digest; MCP
transport, executable and literal arguments or remote URL, environment variable
names, authentication mode, and tool filters; and cron schedule, timezone,
session, message, and delivery behavior. Secret values must remain undisclosed.
Any registry trust warning associated with a resolved package is part of that
effect and must remain visible in both machine-readable and human preview.

Capability escalation is classified consistently across owners. Adding
executable package code, plugin or tool access, an MCP execution or network
surface, or recurring work requires a distinct machine-readable record and
human-readable disclosure rather than being hidden in ordinary content
reconciliation. The same classification applies during add and update; an
owner must not invent a weaker capability-specific approval.

An application profile may satisfy capability and content consent with one
confirmation only when the plan represents the capability set separately and
the supplied integrity token binds both sets exactly. A profile may instead
require a separate capability prompt or aggregate capability records across
several plans before the first mutation. A changed capability record
invalidates prior consent in either model.

The OpenClaw application profile marks each escalation record with
`requiresDistinctConsent: true`. This is a host-facing signal that the change
must receive distinct disclosure and explicit acknowledgment; it does not by
itself require a second portable CLI flag. OpenClaw's CLI acknowledgment is the
exact plan-integrity token entered after that separate disclosure.

Mutation requires explicit consent after the complete plan is available. A
feature or deployment gate is not consent. A package must not cause mutation
merely by being discovered, downloaded, inspected, or passed through an
ordinary package installer.

Consent must bind to the exact package or development snapshot digest, final
agent id, workspace, action set, and expected local owner state shown in the
plan. Immediately before mutation, the client must rebuild or revalidate those
inputs. Resolved dependency integrity, install identity, and trust warning are
included in that binding. A change to any consented digest, destination, package owner, owner
configuration value, scheduler record, or file-presence expectation invalidates
consent and requires a new plan; the client must not silently apply a materially
different plan.

Agent-id or workspace collisions fail closed. An explicit override may choose
an unused id or workspace, but it must not adopt an existing agent or managed
workspace.

## Ownership and Provenance

After consent, the lifecycle delegates resources to their canonical owners and
records enough shared provenance to explain and reconcile the resulting agent.
At minimum, provenance must identify:

- Claw package name, version, source, and integrity;
- final local agent id and workspace;
- the consented plan identity and applied manifest schema version;
- generated agent configuration digest and owned field paths;
- managed workspace paths and content digests;
- exact skill and plugin dependency edges, resource origin
  (`claw-introduced` or `pre-existing`), and current non-Claw ownership;
- MCP names, managed or referenced relationship, resource origin, current
  non-Claw ownership, and redacted configuration digests;
- manifest cron ids and scheduler record ids;
- per-owner pending, complete, partial, failed, and cleanup states;
- timestamps and actor or caller identity when the host can establish one.

Credentials and resolved environment values must never be persisted in Claw
provenance.

Provenance explains ownership and dependency relationships. It is not an
uninstall lock and does not replace canonical owner state.

The managed or referenced relationship is derived during planning from the
resource kind and canonical owner state. A package author cannot declare
deletion authority. Agents, workspace files, agent-pinned scheduler jobs, and
  new collision-free MCP declarations are managed. Shared package artifacts and
  plugins are referenced even when add introduced them. A skill materialized
  exclusively inside the new agent workspace is managed workspace state, while
  a skill installation shared outside that workspace is referenced. An
  identical pre-existing MCP declaration is referenced rather than adopted.

Provenance stores current identities, integrity, dependency edges, and pending
or incomplete cleanup state. Implementations must not require a historical
operation ledger or stored reference-count history. Any cleanup decision uses
the current enumerated dependency edges and canonical owner state.

Applied state and ready state are distinct. A complete add means every declared
mutation was applied or safely referenced. Status must separately report
unresolved environment placeholders, incomplete OAuth login, unavailable MCP
executables, disabled or missing scheduler dependencies, and other local
prerequisites that prevent the agent from operating as declared.

## Add Semantics

A conforming add implementation must:

- create exactly one new agent and one new workspace;
- fail the complete add when any declared component is unsupported, blocked,
  invalid, or unavailable;
- use existing skill and plugin installers and safety checks;
- write only confined workspace files;
- map MCP declarations to the existing MCP owner;
- create scheduler records pinned to the final local agent id;
- persist pending owner provenance before each external mutation;
- record successful external mutations as they occur;
- report a partial result when owners cannot share one atomic transaction.

On failure, add must stop later owners and compensate only work whose canonical
owner can prove a safe inverse. Completed or uncertain external mutations remain
in resumable provenance with a partial root status. A retry, doctor, or remove
uses that current state; add must not report a partially created agent as
successfully added.

## Update Semantics

Update targets the installed agent identified by provenance and never another
agent that happens to share a manifest id. It must produce a read-only
reconciliation plan before separately consented mutation.

The installed local agent id and workspace are immutable update identity. A
different `agent.id` in a later package version changes the default for new adds
only; it must not rename or move an existing installed agent. Update may move to
an older or newer exact package version only when that target is explicit in the
consented plan. There is no implicit background update authority in v1.

At the mutation boundary, each owner must revalidate the strongest available
expected state, including file presence and digest, package ownership, MCP
configuration, scheduler identity, and agent/root provenance. Local edits or
concurrent changes become conflicts rather than silent overwrites.

An update plan must classify each resource as create, change, remove, retain,
requires-local-configuration, or conflict. It must preserve unrelated owner
state and must not replace a global plugin while another installed Claw or a
direct owner requires a different version.

Removing a package declaration during update releases that Claw's reference.
It does not imply artifact uninstall during the update transaction. Irreversible
or uncertain owner outcomes must be retained in current provenance and reported
as `status: partial`, including in structured CLI output.

Before changing or removing a scheduler record, update and remove must read the
live record through the scheduler owner and compare its owned definition with
provenance. Operator-modified jobs are conflicts and must not be overwritten or
deleted.

## Resource Limits

A consumer must reject a Claw manifest larger than 1 MiB and package metadata
larger than 256 KiB before parsing. Reads must remain bounded if a file grows
after an initial metadata check. Existing canonical extraction, workspace-file,
aggregate-workspace, and plan-output limits continue to apply.

## Remove Semantics

Remove must first produce a plan and then require explicit consent. It must
delegate agent, skill, plugin, MCP, workspace, and scheduler cleanup to their
canonical owner lifecycles.

Remove must disable Claw-owned recurring work before deleting the agent or its
workspace content. If recurring work cannot be proven disabled, cleanup is
partial and the failure remains visible; remove must not claim success merely
because later local records were deleted.

Managed resources are selected for cleanup by default. Referenced resources are
retained by default while the removing Claw's dependency edges are released.
The plan must show the relationship, origin, expected integrity, every other
known Claw dependency edge, known non-Claw ownership, and the canonical cleanup
owner for each resource.

The operator must be offered these referenced-resource dispositions:

- **retain**: release only this Claw's dependency edge. This is the default.
- **remove-if-unused**: invoke canonical removal only when the resource has no
  other Claw dependency edge or known non-Claw owner, was introduced by Claw
  add, is complete, unchanged, and unambiguous, and its canonical owner permits
  removal.
- **remove-selected**: invoke canonical removal for specifically selected
  resources after showing all known affected Claws and non-Claw owners. A
  remaining dependency or pre-existing origin requires stronger explicit
  confirmation but is not a hidden uninstall lock.

The chosen disposition and affected resource identities must be part of the
integrity-bound remove plan. Non-interactive mutation must identify its cleanup
mode explicitly; it must not broaden default `retain` behavior merely because a
general `--yes` flag is present. Referenced cleanup runs after managed-resource
cleanup so failure cannot damage a still-live Claw agent.

If an operator explicitly uninstalls an artifact despite a Claw-reference
warning, canonical uninstall semantics win. The Claw becomes degraded and
status must report the missing dependency. Claw status or remove must not
silently reinstall it.

Resource origin must remain current cleanup evidence while Claw dependency
edges remain. `remove-if-unused` eligibility is evaluated from resource origin,
current dependency edges, and canonical owner state, not from which Claw happens
to be removed last. Removal order must not change the result.

Conversely, a later direct install or explicit operator adoption must add
independent ownership through the shared package lifecycle. Once independently
owned, the artifact is retained when no Claw dependency edge remains. A
Claw lifecycle must not infer that an idempotent direct install conveys no
ownership merely because the exact artifact was already present.

The same dispositions apply to referenced MCP declarations. A newly created
Claw-managed MCP declaration is removed by default when unchanged; an identical
pre-existing MCP declaration is referenced and retained by default. Remove must
preserve locally modified files, unrelated MCP declarations, channel bindings,
credentials, operator settings, and any resource whose ownership or expected
state cannot be proven. Failed cleanup remains visible to status and
diagnostics.

## Development Sources and Export

A local unpackaged manifest may be inspected and, when explicitly supported,
added under a synthesized development identity. The consumer must record its
canonical source path and exact digest. A development identity must not be
mistaken for an authenticated registry identity.

An unpacked development directory may select its manifest through a symlink
whose canonical target is a regular file inside that directory. This authoring
convenience is not publishable package content: registry artifacts continue to
reject links, and referenced workspace sources remain regular, non-linked
files.

Export creates a new package directory and must fail if the output directory
already exists. It emits `package.json`, `CLAW.md`, and confined
workspace sources. Export includes only portable supported state and excludes
secrets, resolved environment values, models, providers, bindings, sessions,
logs, caches, and unrelated global configuration.

Export may preserve an original package name and version only by returning the
byte-for-byte original artifact with the same digest. Any regenerated package,
including one exported from an unchanged installation, must use a new
development-safe or derivative identity and version so it does not impersonate
the publisher's immutable artifact. Publication under another publisher's
namespace remains forbidden regardless of local provenance.

## Compatibility and Evolution

Package v1 is identified by a manifest with `schemaVersion: 1` and the metadata
contract above. Registry transport may evolve independently as long as it still
delivers the exact identity, version, digest, and package bytes.

Package and manifest v1 define the OpenClaw application profile. A different
harness may inspect the portable data or implement that complete profile, and a
future specification may define additional harness profiles. A consumer must
not claim v1 application conformance if it drops, translates approximately, or
cannot own a declared component. It may inspect such a package, but add must
fail the complete plan rather than silently degrade the Claw.

## Registry Conformance

A conforming registry must:

- authenticate publication and bind it to exact package identity;
- enforce package containment and portable path collision rules;
- parse and validate the selected manifest strictly;
- verify every referenced source file;
- retain exact artifact length and SHA-256 integrity;
- retain a bounded public summary derived from the validated artifact without
  requiring a second full-manifest copy in registry metadata;
- allow authorized clients to retrieve the exact artifact for local manifest
  review;
- never imply that Claw approval bypasses dependency policy.

## Client Conformance

A conforming applying client must:

- verify package identity, containment, manifest schema, and integrity locally;
- resolve exact dependencies before planning;
- expose a complete read-only plan and require explicit consent;
- bind mutation to the consented artifact, destinations, actions, and expected
  owner state;
- preserve the one-package-one-new-agent invariant;
- delegate resources to canonical owners and record provenance;
- fail closed on collisions, unsupported components, and unsafe paths;
- distinguish applied state from local operational readiness;
- preserve drifted or independently owned state during update and remove;
- derive managed and referenced relationships from canonical owner state;
- retain referenced resources by default and bind any operator-selected
  referenced cleanup into the exact remove plan;
- report partial outcomes and leave them diagnosable.
