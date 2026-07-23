---
title: Claws
authors:
  - Gio
created: 2026-07-03
last_updated: 2026-07-22
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/27
---

# Proposal: Claws

## Summary

Define a **Claw** as a distributable definition of one complete OpenClaw agent
for one job. Adding a Claw creates a new local agent, creates that agent's
workspace, installs its skills and plugin dependencies, configures declared MCP
servers, creates agent-pinned scheduled work, and records provenance for the
complete installed agent.

The central invariant is:

> One Claw package adds one new agent for one job. It does not merge into,
> replace, or silently update an agent the operator already built.

Claws compose existing OpenClaw primitives. Skills remain skills, plugins remain
plugins, MCP servers remain top-level OpenClaw MCP configuration, heartbeat
remains agent configuration, and cron jobs remain Gateway scheduler records.
The Claw owns their composition and lifecycle for the new agent; it does not
replace the underlying owner surfaces.

The public lifecycle is `add`, `status`, `update`, `remove`, and `export`.
`add --dry-run` is the non-mutating preview. Artifact-level `install` and
`uninstall` remain the underlying operations for individual skills and plugins.

## Motivation

A useful Claw should feel like adding a purpose-built employee to OpenClaw. For
example, adding `@acme/github-triage` creates a GitHub triage agent with its own
workspace, instructions, skills, tools, MCP dependency, heartbeat behavior, and
scheduled triage job. It does not rewrite the default agent or borrow an
unrelated workspace.

Adding a Claw always plans the following owned resources:

1. One new `agents.list[]` entry.
2. One new workspace assigned to that agent.
3. Canonical bootstrap files and supporting files in that workspace.
4. Workspace skills and global plugin dependencies.
5. Declared MCP servers in OpenClaw's top-level `mcp.servers` configuration.
6. Declared cron jobs stored in the Gateway scheduler and pinned to the new
   agent id.
7. Provenance connecting every created or referenced resource to the installed
   Claw and local agent.

The manifest's `agent.id` supplies the default local agent id. If that id or its
default workspace already exists, `add` fails closed. A user may explicitly
choose a different id with `--agent-id`; OpenClaw derives a matching unused
workspace unless `--workspace` is also supplied. Neither override permits
adopting or merging into an existing agent or managed workspace.

## Goals

- Make a complete job-specific agent distributable as plain, reviewable data.
- Preserve the one-Claw-one-new-agent invariant across CLI, schema, provenance,
  updates, removal, export, feeds, and future UI.
- Keep individual skill and plugin packages on their existing install and
  safety paths.
- Create agent workspaces without modifying existing agents or operator
  defaults.
- Distinguish canonical workspace bootstrap files from ordinary supporting
  files.
- Allow portable, job-specific agent settings while excluding operator-owned
  runtime and authentication choices.
- Preview every config, file, package, MCP, and cron mutation before `add`.
- Fail the complete add when any declared component cannot be applied.
- Record enough provenance to inspect, diagnose, update, export, and remove the
  installed agent safely.
- Reuse RFC 0009 feeds for discovery, curation, approval, blocking, and exact
  source resolution of plugin and skill packages without turning MCP server
  declarations into catalog entries.
- Keep Claw processing out of the per-turn Gateway hot path.

## Non-goals

- Modifying, templating over, or adopting an existing agent.
- Importing a complete running OpenClaw instance, sessions, logs, caches,
  memories, channel bindings, OAuth state, or credentials.
- Replacing standalone skill, plugin, MCP, cron, heartbeat, or agent config
  surfaces.
- Replacing plugin-bundled companion skills.
- Defining a new package registry, credential store, or dependency solver.
- Embedding model, provider, thinking-level, authentication, or other
  operator-controlled runtime defaults.
- Embedding channel account ids, group ids, credentials, or bindings.
- Setting `agents.list[].skills`; package coordinates do not yet provide the
  canonical skill identities needed to validate an agent allowlist safely.
  Workspace-installed skills remain naturally discoverable and do not replace
  inherited allowlists.
- Defining a generic `connector` installation concept. Channel capabilities are
  supplied by normal channel plugins and configured or bound locally.
- Defining a feed-backed MCP connector catalog or replacing the Control UI's
  separately curated connector suggestions.
- Silently enabling recurring work without preview, consent, provenance, and a
  disable/remove path.

## Proposal

### Normative principles

Accepting this RFC accepts the following stable product contract. Individual
implementation slices may land separately, but later work must preserve these
principles.

| Principle | Requirement |
| --- | --- |
| Unit of ownership | One Claw describes exactly one new agent and its owned setup. |
| Existing agents | `add` never merges into or updates an existing agent. Agent-id and workspace collisions fail closed. |
| Lifecycle verb | The creation operation is `claws add`; `install` remains an artifact-level operation. |
| Public schema | The manifest uses grouped `agent`, `workspace`, `packages`, `mcpServers`, and `cronJobs` fields rather than a generic flat entry list. |
| Completeness | Every declared component is part of the Claw. Unsupported, blocked, or invalid components block `add`; there is no optional `required` flag. |
| Package identity | Package name and version come from the enclosing package metadata and authenticated publish operation, following the ClawHub plugin precedent. |
| Operator control | Models, providers, credentials, channel bindings, and local runtime defaults are not portable Claw settings. |
| Agent configuration | Only explicitly supported portable job settings can be copied into the new `agents.list[]` entry. |
| Tool policy | A Claw may select a built-in profile registered by the applying OpenClaw version and refine it with portable allow, deny, and workspace-only filesystem policy. Host policy remains authoritative. |
| Skills | Skill packages install into the new agent's workspace and are discovered normally; the Claw does not set `agent.skills`. |
| Plugins | Plugin packages use existing plugin installers, safety checks, enablement rules, and install records. |
| Discovery and composition | Hosted feeds discover and govern plugin and skill packages; a Claw composes exact resolved package versions and direct MCP declarations rather than defining another catalog. |
| MCP | Portable stdio and remote MCP declarations map to top-level `mcp.servers`; credentials and completed OAuth state remain local and are not persisted in the manifest or Claw provenance. |
| Scheduled work | Heartbeat is agent behavior; exact schedules are Gateway cron jobs pinned to the new agent id. |
| Mutation | `add --dry-run` is read-only. Mutating add requires explicit consent. |
| Provenance | OpenClaw records the installed Claw, local agent id, workspace, package refs, MCP refs, cron refs, and managed-file hashes in shared state. |
| Removal | `remove` deletes only Claw-owned state after drift checks and preserves local edits and independently owned artifacts. |

### Managed and referenced resources

Claws use one ownership model across every capability. A resource relationship
is either **managed** or **referenced**:

- A **managed resource** is created specifically for the installed Claw and has
  an exclusive Claw identity. The Claw lifecycle may reconcile and remove it
  after revalidating ownership and drift. The created agent, its workspace
  files, agent-pinned cron jobs, and a newly created collision-free MCP
  declaration are managed resources.
- A **referenced resource** is a shared resource on which the Claw depends. The
  lifecycle records a current dependency edge but does not acquire exclusive
  authority over the resource. Shared package artifacts and plugins are
  referenced even when Claw add introduced them through their canonical
  installer. An identical pre-existing MCP declaration may also be referenced.

The canonical owner identity, not the capability label alone, determines the
relationship. For example, a skill directory materialized exclusively inside
the new agent workspace is managed workspace state, while a skill installation
shared outside that workspace is referenced.

Resource origin (`claw-introduced` or `pre-existing`) is cleanup evidence, not
a third ownership mode. Provenance stores current resource identities,
integrity, dependency edges, and incomplete cleanup state. It does not maintain
historical reference counts or an operation-history ledger.

Every owner follows the same lifecycle rules: dry-run reports the relationship
and expected state; add either creates a managed resource or satisfies a
reference through the canonical owner; update revalidates before reconciling;
status distinguishes recorded state from live state; and remove deletes managed
resources while retaining referenced resources by default.

### Package and manifest identity

The implementer-facing package contract is captured in
[`0016/claw-package-v1-spec.md`](0016/claw-package-v1-spec.md). The experimental
human-readable envelope is captured separately in
[`0016/claw-md-v1-spec.md`](0016/claw-md-v1-spec.md). This RFC remains the
product rationale, ownership model, lifecycle, and rollout plan.

A published Claw follows the current ClawHub plugin precedent. Registry identity,
version, and publisher ownership come from the enclosing package and the
authenticated publish operation, not duplicated manifest fields.

Illustrative `package.json`:

```json
{
  "name": "@acme/github-triage",
  "version": "1.2.0",
  "type": "module",
  "openclaw": {
    "claw": "openclaw.claw.json"
  }
}
```

The Claw manifest therefore does not repeat a top-level publisher, package slug,
package version, display name, or description. A local unpackaged manifest may
be inspected during development, but mutating local add must synthesize an
explicit development identity and record its canonical source path and digest.

The experimental implementation accepts the strict grouped JSON representation
and `CLAW.md`, in which YAML frontmatter carries the same typed manifest and the
Markdown body is documentation only. Export emits `CLAW.md`; JSON remains a
fully supported serialization of the same grouped schema.

Both representations are covered by the existing
`OPENCLAW_EXPERIMENTAL_CLAWS=1` gate. `CLAW.md` adds only reader/export format
adaptation and no schema, lifecycle, provenance, or ownership branch. While the
RFC remains experimental, maintainers may revise or remove that envelope before
graduation without creating a separate compatibility promise.

Feeds and registries materialize an exact package version and integrity before
add. Mutable tags and floating ranges must not become managed installs without
that resolution step.

### Manifest schema

The initial public shape is grouped by OpenClaw ownership boundary:

```jsonc
{
  "schemaVersion": 1,
  "agent": {
    "id": "github-triage",
    "name": "GitHub Triage",
    "description": "Reviews incoming GitHub issues and prepares a daily triage summary.",
    "identity": {
      "name": "Triage",
      "emoji": "🔎"
    },
    "groupChat": {
      "mentionPatterns": ["@triage", "@github-triage"]
    },
    "sandbox": {
      "mode": "all",
      "scope": "agent",
      "workspaceAccess": "rw"
    },
    "tools": {
      "profile": "coding",
      "alsoAllow": ["cron"],
      "deny": ["exec", "browser", "nodes"],
      "fs": { "workspaceOnly": true }
    },
    "memory": {
      "search": {
        "enabled": true,
        "rememberAcrossConversations": true,
        "sources": ["memory", "sessions"]
      }
    },
    "heartbeat": {
      "every": "30m",
      "activeHours": {
        "start": "08:00",
        "end": "18:00"
      },
      "lightContext": true,
      "isolatedSession": true,
      "skipWhenBusy": true,
      "timeoutSeconds": 120
    },
    "humanDelay": {
      "mode": "natural"
    }
  },
  "workspace": {
    "bootstrapFiles": {
      "AGENTS.md": { "source": "workspace/AGENTS.md" },
      "SOUL.md": { "source": "workspace/SOUL.md" },
      "IDENTITY.md": { "source": "workspace/IDENTITY.md" },
      "TOOLS.md": { "source": "workspace/TOOLS.md" },
      "HEARTBEAT.md": { "source": "workspace/HEARTBEAT.md" }
    },
    "files": [
      {
        "source": "workspace/reference/triage-policy.md",
        "path": "reference/triage-policy.md"
      }
    ]
  },
  "packages": [
    {
      "kind": "skill",
      "source": "clawhub",
      "ref": "@acme/issue-triage-playbook",
      "version": "1.4.0"
    },
    {
      "kind": "plugin",
      "source": "clawhub",
      "ref": "@acme/github-actions",
      "version": "2.1.0"
    }
  ],
  "mcpServers": {
    "github-triage-github": {
      "command": "npx",
      "args": ["-y", "@acme/github-mcp@3.4.1"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      },
      "toolFilter": {
        "include": ["issues_list", "issues_get", "issues_comment"],
        "exclude": ["repository_delete", "repository_admin_*"]
      },
      "timeout": 30,
      "connectTimeout": 10
    }
  },
  "cronJobs": [
    {
      "id": "weekday-triage",
      "name": "Weekday GitHub triage",
      "schedule": {
        "cron": "0 9 * * 1-5",
        "timezone": "America/New_York"
      },
      "session": "isolated",
      "message": "Review new GitHub issues and prepare a concise triage summary.",
      "delivery": {
        "mode": "announce",
        "channel": "last"
      }
    }
  ]
}
```

The schema version 1 field set, validation rules, JSON representation, and
`CLAW.md` envelope are normative for the experimental implementation.
Implementation slices may land separately behind the experimental gate, but a
producer or consumer must not claim schema v1 conformance until it implements
the complete grouped data model. This addendum finalizes the experimental v1
field set before graduation; omitted optional fields retain the prior behavior.
After v1 graduates, new portable fields, semantic changes, and ownership changes
require a new schema version so existing consumers never interpret or silently
discard an unknown declaration.

Unknown fields fail closed. Implementations must not silently drop a declared
component and still call the agent complete.

### Agent settings boundary

Portable agent settings describe the job and its safe operating posture. The
initial allowlist should be drawn from existing OpenClaw agent configuration and
can include:

- `id`, `name`, and `description`;
- agent identity presentation;
- group-chat mention patterns;
- sandbox boundaries;
- a built-in tool profile registered by the applying OpenClaw version;
- tool `allow` or `alsoAllow`, `deny`, and `fs.workspaceOnly` policy;
- memory-search enablement, explicit cross-conversation memory opt-in, and the
  portable `memory` and `sessions` sources;
- heartbeat behavior;
- human-delay behavior.

The following remain operator controlled and are rejected in a Claw manifest:

- model, provider, thinking level, and runtime implementation;
- API keys, OAuth state, credentials, or secret values;
- channel account ids, group ids, and bindings;
- default-agent selection and global `agents.defaults`;
- `agent.skills` allowlists;
- custom tool-profile definitions, provider-specific tool policy, elevated
  access, executable defaults, and sender-specific policy;
- memory providers, models, credentials, remote endpoints, local paths, and
  storage or indexing tuning;
- arbitrary config fragments or unknown future agent fields.

The generated `agents.list[]` entry inherits operator defaults. Add appends one
entry and does not rewrite existing list members or defaults.

A profile name is valid only when the applying OpenClaw version resolves it
through the canonical built-in profile registry. The Claw schema must not copy a
fixed list of profile names. A Claw carries a profile selection, not a custom
profile definition. Global and operator policy continue to constrain the
resulting tool surface and cannot be widened by a Claw.

`tools.allow` is an explicit allowlist. `tools.alsoAllow` extends a selected
profile, so a single tools object must not contain both. Adding an
`alsoAllow` grant is an escalation. Update preview resolves inherited tool
profiles and filesystem defaults, expands built-in profiles to their effective
tool sets, and treats the `full` wildcard as a superset before classifying a
change. Removing workspace-only confinement is therefore an escalation when the
effective host default permits broader filesystem access. Enabling
`memory.search`, enabling `rememberAcrossConversations`, or adding a source
is a capability escalation; disabling either behavior or removing a source is
a reduction. A portable declaration of the `sessions` source requires
`rememberAcrossConversations: true` so it cannot silently normalize to ordinary
workspace memory.

For example, adding the illustrative manifest above with local agent id
`github-triage` appends an agent entry while preserving the operator's current
defaults and agents:

```jsonc
{
  "agents": {
    "defaults": {
      // Existing operator-owned defaults remain unchanged.
    },
    "list": [
      {
        "id": "main",
        "default": true
      },
      {
        "id": "github-triage",
        "name": "GitHub Triage",
        "description": "Reviews incoming GitHub issues and prepares a daily triage summary.",
        "workspace": "~/.openclaw/workspace-github-triage",
        "identity": {
          "name": "Triage",
          "emoji": "🔎"
        },
        "groupChat": {
          "mentionPatterns": ["@triage", "@github-triage"]
        },
        "sandbox": {
          "mode": "all",
          "scope": "agent",
          "workspaceAccess": "rw"
        },
        "tools": {
          "profile": "coding",
          "alsoAllow": ["cron"],
          "deny": ["exec", "browser", "nodes"],
          "fs": { "workspaceOnly": true }
        },
        "memory": {
          "search": {
            "enabled": true,
            "rememberAcrossConversations": true,
            "sources": ["memory", "sessions"]
          }
        },
        "heartbeat": {
          "every": "30m",
          "activeHours": {
            "start": "08:00",
            "end": "18:00"
          },
          "lightContext": true,
          "isolatedSession": true,
          "skipWhenBusy": true,
          "timeoutSeconds": 120
        },
        "humanDelay": {
          "mode": "natural"
        }
      }
    ]
  },
  "plugins": {
    "entries": {
      "github-actions": {
        "enabled": true
      }
    }
  },
  "mcp": {
    "servers": {
      "github-triage-github": {
        "command": "npx",
        "args": ["-y", "@acme/github-mcp@3.4.1"],
        "env": {
          "GITHUB_TOKEN": "${GITHUB_TOKEN}"
        }
      }
    }
  }
}
```

The installed skill lives under the new workspace's skill root. The cron job is
stored separately by the Gateway scheduler with `agentId: "github-triage"`; it
does not become an `openclaw.json` field.

### Workspace semantics

Every added Claw receives a new workspace. By default OpenClaw derives a path
from the final local agent id, for example
`~/.openclaw/workspace-github-triage`. The resolved path must not already be an
existing agent workspace or a Claw-managed workspace.

`workspace.bootstrapFiles` names canonical OpenClaw files. The initial keys are
`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `TOOLS.md`, and `HEARTBEAT.md`. Supporting
content belongs in `workspace.files` with explicit package-relative source and
workspace-relative destination paths.

All paths must remain within the unpacked Claw package or the new agent
workspace after realpath resolution. Symlink, hardlink, device-file, oversized,
and traversal escapes fail closed. The dry-run shows each source, destination,
digest, and action.

Because add always targets a new workspace, v1 does not need general patch or
merge modes. Any unexpected existing destination is a collision and blocks add.
Update may replace an unchanged Claw-managed file, but it preserves local edits
and reports them as manual conflicts.

### Package semantics

`packages` contains only actual installable `skill` and `plugin` packages.
Every package is required. A blocked source, failed safety check, unavailable
exact version, or unsupported source blocks the complete add.

Skill packages install into the new agent workspace through existing skill
installers. They are discovered from the workspace normally. Add must not set
`agents.list[].skills`.

Plugin packages install through existing plugin installers and safety checks.
Plugin artifacts can be shared with direct user installs or other Claws. Claw
provenance is explanation and dependency metadata, not an uninstall lock.
Shared skill artifacts and plugins are referenced resources even when add
introduced them. A skill directory materialized exclusively in the Claw's
workspace is managed as part of that workspace. By default, removing a Claw
releases dependency edges and retains shared artifacts.

The remove plan must offer explicit cleanup choices for referenced artifacts:

1. `retain` releases only this Claw's dependency edge and is the default.
2. `remove-if-unused` invokes the canonical artifact lifecycle only when no
   other Claw dependency edge or known non-Claw owner remains and the artifact
   is complete, unchanged, and unambiguous.
3. `remove-selected` invokes canonical removal for artifacts explicitly chosen
   by the operator. It must show every known affected Claw and direct owner and
   require stronger confirmation when dependencies remain.

These choices are bound into the integrity-checked remove plan. A failed or
declined canonical uninstall does not erase the resource's cleanup state.
Reference discovery belongs to the shared package lifecycle owner used by CLI,
Gateway, and Control UI uninstall entry points; a Claw command must not bypass
the same warnings by reimplementing removal. A dependency edge is neither a
hidden refcount lock nor authority to override a confirmed operator uninstall.
This includes the Control UI plugin-management work in
[openclaw/openclaw#103176](https://github.com/openclaw/openclaw/pull/103176):
its install, enablement, disablement, and uninstall controls remain plugin lifecycle
operations, while Claws contribute references and shared uninstall warnings.

Update installs the exact target package version before advancing Claw
provenance. Removing a package from a Claw releases only that Claw's reference.
A global plugin must not be replaced when another installed Claw is pinned to a
different version. Package installers do not currently provide a general
artifact rollback contract, so a later update failure after installation is
reported as partial even when Claw reference provenance can be compensated.

### MCP server semantics

`mcpServers` maps stable server names to a reviewed portable subset of the
existing OpenClaw MCP server config shape. Add writes those declarations to
top-level `mcp.servers`; they are not nested inside the generated agent entry.
The initial subset supports both local stdio servers (`command`, `args`, and
related process settings) and remote servers (`url`, `sse` or
`streamable-http` transport, and credential-free OAuth intent). It does not
carry arbitrary authorization headers, bearer tokens, client secrets, or
completed OAuth state.

Server-name collisions fail unless the existing canonical config is identical
and a referenced dependency edge can be recorded without taking over unrelated
state. A newly created, collision-free MCP declaration is managed by the Claw;
an identical pre-existing declaration is referenced. Both cases use the same
canonical MCP config path, plan preview, capability consent, drift checks, and
operator-selected cleanup rules as other resources. Environment
placeholders such as `${GITHUB_TOKEN}` remain references. Resolved secret values
must never be stored in the manifest, plan, logs, or provenance. Provenance uses
a canonical redacted digest sufficient for drift detection. Remote OAuth and
other credential completion is an operator-owned local step after add. The
Control UI may present curated MCP suggestions, but their presentation identity
is not a Claw package dependency, hosted-feed entry, or provenance key.

### Heartbeat and cron semantics

Heartbeat and cron jobs are distinct existing OpenClaw concepts:

- `agent.heartbeat` controls when and how the new agent wakes.
- `workspace.bootstrapFiles["HEARTBEAT.md"]` contains what the agent checks.
- `cronJobs` contains exact scheduled jobs stored by the Gateway scheduler.

Every created cron job is pinned to the final local agent id regardless of
whether the manifest id or `--agent-id` override supplied it. Cron ids must be
unique within the Claw and must not overwrite existing scheduler records.
Dry-run shows cadence, timezone, session mode, message/action, delivery, and the
derived `agentId`. Mutating add creates cron jobs only after the agent and
workspace are ready, and provenance stores stable scheduler ids for status,
update, disable, and removal.

Channel delivery settings may name portable modes such as `last`, but a Claw
does not embed account ids, group ids, credentials, or bindings. Operators bind
the new agent to local channels separately.

### CLI and lifecycle

#### Experimental incubation gate

While this RFC remains draft, every Claws CLI surface is gated behind the
process-level opt-in `OPENCLAW_EXPERIMENTAL_CLAWS=1`.

When the gate is absent or false:

- OpenClaw does not register the `claws` command;
- Claws do not appear in default help, shell completions, or onboarding;
- no background service, update flow, or Gateway startup path reads or applies
  Claw state;
- encountering Claw package metadata through an ordinary install path does not
  implicitly enable the experiment.

The hosted experimental guide is intentionally public and may appear in the
documentation navigation while the local command is disabled. Static hosted
documentation cannot observe a process environment variable, so it labels the
feature experimental and shows the opt-in explicitly. Public documentation is
not a stability promise and does not enable any local runtime surface.

The gate is intentionally an environment opt-in rather than a persisted config
field. Internal launchers, test lanes, and controlled deployments can enable it
for a process, but users do not acquire a durable experimental setting that is
silently carried into later releases or fleet config.

When enabled, text-mode commands print a concise experimental compatibility
warning before mutation, and machine-readable results include
`stability: "experimental"` plus their exact output schema version. During the
draft period, the manifest schema, CLI flags, JSON result shapes, and SQLite
tables may change without backward-compatibility guarantees. Destructive
commands still require their normal explicit consent; the experimental gate is
not consent and does not weaken any safety check.

Removing the gate is a separate maintainer decision after this RFC is accepted.
That graduation PR must define released migration behavior, stable CLI and JSON
contracts, documentation, and compatibility policy. Shipping experimental code
does not itself establish those contracts.

The public CLI is:

```bash
openclaw claws inspect <source>
openclaw claws add <source> --dry-run --json
openclaw claws add <source> [--agent-id <id>] [--workspace <path>] --yes --plan-integrity <digest>
openclaw claws status [claw-or-agent]
openclaw claws update <claw-or-agent> [--from <source>] --dry-run --json
openclaw claws update <claw-or-agent> [--from <source>] --yes --plan-integrity <digest>
openclaw claws remove <claw-or-agent> --dry-run --json [cleanup selection]
openclaw claws remove <claw-or-agent> --yes --plan-integrity <digest> [cleanup selection]
openclaw claws export <agent> --out <path>
```

`inspect` validates package metadata and the grouped manifest without reading or
mutating local lifecycle state. `add --dry-run` resolves the final agent id,
workspace, packages, MCP servers, and cron jobs and emits the complete action
plan. `add` without `--dry-run` requires `--yes` and the exact
`--plan-integrity` digest from that dry run. Update uses the source recorded in
provenance unless `--from` explicitly overrides it. Remove retains referenced
resources by default; `--remove-unused`, repeatable `--remove-referenced`, and
`--force-referenced` select stronger cleanup in both preview and mutation so
the choice is included in the plan digest. `--yes` alone never broadens a plan.

Add ordering is transactional where owner APIs permit it and resumable where
external installers or the scheduler cannot share one transaction:

1. Validate package metadata and manifest.
2. Resolve exact dependencies and run install safety checks.
3. Resolve the final unused agent id and workspace.
4. Preflight all config, file, MCP, and cron collisions.
5. Create the agent entry and workspace state.
6. Write bootstrap and supporting files.
7. Install workspace skills and plugin dependencies.
8. Configure MCP servers.
9. Create agent-pinned cron jobs.
10. Persist one complete apply record and per-resource provenance.

Any failure stops later phases. Pending provenance is written before external
mutation and successful resources are recorded immediately. Safe local
pre-commit work may be compensated, but a completed or uncertain owner mutation
is retained for deterministic resume, doctor, or remove rather than hidden by a
best-effort rollback. The result distinguishes complete, partial, and failed
adds; it never reports a partial agent as successfully added.

### Provenance and local state

Claw lifecycle state belongs in OpenClaw's shared SQLite state database, not in
the user config file and not only in marker files inside the workspace.

The installed record must include:

- package identity, version, integrity, source, and source byte length;
- final local agent id and workspace root;
- generated agent config digest and owned field paths;
- managed workspace paths and content digests;
- exact skill and plugin artifact identities, managed or referenced
  relationship, resource origin, and current independent ownership;
- MCP server names, managed or referenced relationship, resource origin,
  current independent ownership, and canonical redacted config digests;
- cron job ids and scheduler record ids;
- add/update timestamps and actor or caller when available;
- partial-operation diagnostics and cleanup state.

Status and doctor read this ledger to report missing agents, workspace drift,
modified files, missing dependencies, changed MCP config, missing or changed cron
jobs, and orphaned partial state.

### Update, remove, and export

Update always targets the installed agent created by the Claw. It never changes
another agent merely because a target manifest now uses the same id. Update has
a read-only plan and a separately consented apply.

Update may add or change portable agent fields, files, package dependencies, MCP
servers, and cron jobs owned by the installed Claw. Local modifications become
manual conflicts. Operator defaults, models, providers, credentials, bindings,
and unrelated config remain untouched.

Portable tool-profile changes are compared using inherited host defaults and the
built-in profile registry's resolved capabilities rather than opaque profile
labels. Wildcard profiles are compared as supersets. Tool additions, including
`alsoAllow`, removal of effective workspace-only confinement, memory-search
enablement, cross-conversation memory, and added memory sources require distinct
capability consent. Restricting filesystem access, disabling memory search or
cross-conversation memory, or removing sources is reported as a reduction.
Update compares canonical `memory.search` settings and inherited memory
defaults before classification.

Consented update rebuilds the read-only plan immediately before mutation. Each
owner uses its strongest available concurrency boundary: workspace content
digests, expected MCP config values, stable cron declaration keys and scheduler
ids, exact package refs, and agent/root provenance compare-and-swap checks.
Workspace checks include expected file presence as well as content. Before an
external package installer runs, OpenClaw atomically replaces the expected
package reference with a pending ownership claim; concurrent ownership changes
abort before installation. Once the installer boundary is crossed, failure
retains pending or failed provenance because the artifact outcome may be
uncertain.
Completed owners compensate in reverse order only when the canonical owner can
prove the inverse operation is safe. A thrown config or Gateway call has an
uncertain commit outcome, and an installed package artifact cannot be assumed
rolled back merely because its reference was restored. Pending owner provenance
and a partial root status are retained in these cases so status, doctor, and a
retry can reconcile the actual state rather than claiming cross-owner atomicity.
Removing a package declaration during update releases the Claw dependency edge;
artifact uninstall is a separately planned remove operation, never an update
side effect.

Remove first produces a plan. Managed resources are selected for cleanup by
default: it removes agent-pinned cron jobs, unchanged Claw-managed MCP
declarations and workspace files, and the Claw-created agent through their
canonical owner lifecycles. Referenced packages and MCP declarations are
retained by default while their dependency edges are released. The operator may
instead select eligible referenced resources for `remove-if-unused`, or select
specific referenced resources for canonical removal after reviewing dependency
warnings. Locally modified files, unrelated MCP servers, channel bindings, and
operator state remain outside Claw cleanup. Failed cleanup remains visible in
status and doctor.

Export is agent-centric. It exports only portable state belonging to the chosen
agent: supported agent settings, selected workspace bootstrap/supporting files,
installed skill/plugin refs, matching MCP declarations, and agent-pinned cron
jobs. It excludes secrets, resolved environment values, models/providers,
bindings, sessions, logs, caches, and unrelated global state. Package output
uses `package.json` for identity, `CLAW.md` for the grouped manifest, and
confined sidecars. Readers continue to accept the equivalent grouped JSON
manifest.

### Feeds, catalogs, and ClawHub

RFC 0009 feeds remain the conceptual discovery and policy layer. A feed may
expose a Claw package, pin an exact version, recommend or block it, and
independently block or substitute package dependencies. Approval of the Claw
does not transitively approve its skills or plugins. While Claws are
experimental, ClawHub uses a separate gated Claw feed parser, serializer, feed
id, and route rather than adding `type: "claw"` to RFC 0009's stable plugin and
skill feed schema version 1.

That feed boundary is intentionally narrower than the complete Control UI
experience. Hosted feeds currently provide official plugin and skill catalog
entries. Installed MCP servers come from local `mcp.servers`, while the Control
UI's suggested MCP connectors are a separately curated presentation surface.
Claws use the first mechanism to resolve exact plugin and skill package inputs,
and use direct portable MCP declarations for the second kind of capability.
They do not create a third connector registry or infer a stable connector
identity from a UI suggestion.

ClawHub owns authenticated publication, package ownership, search/detail/API
surfaces, hosted feed export, and authoring guidance. OpenClaw owns manifest
validation, planning, local mutation, provenance, and lifecycle behavior. Both
must share the portable structural schema and fixtures rather than maintain
divergent package contracts. Applying OpenClaw additionally resolves a selected
profile through its current built-in registry; ClawHub must not freeze that
runtime-owned registry into publication validation.

### Safety and security

- Agent-id and workspace collisions fail closed.
- Add never mutates an existing agent.
- Unknown fields or unsupported declared components fail closed.
- All package dependencies pass existing source, integrity, compatibility, and
  install safety checks.
- Workspace package reads and destination writes use rooted, symlink-safe,
  hardlink-safe file APIs with size limits.
- Secrets and resolved environment values never enter plans or provenance.
- MCP config writes use validated, concurrent-write-safe config APIs.
- Cron jobs require explicit consent, visible cadence/action previews, stable
  ownership, live-definition revalidation, and disable/remove handles.
- Config mutation preserves `agents.defaults`, existing `agents.list[]` entries,
  channel bindings, and unrelated plugin/MCP settings.
- Partial adds persist enough state for diagnosis and cleanup.
- Update and remove revalidate expected presence, content/config digests, and
  provenance ownership at the actual mutation boundary.
- A plan that adds executable code, an MCP execution or network surface,
  plugin/tool access, or recurring work must identify that capability
  escalation in a distinct machine-readable record and human-readable plan
  section. OpenClaw may use one confirmation token only when
  `--plan-integrity` binds the exact separately disclosed capability set as
  well as ordinary content reconciliation. Other hosts may require a separate
  dialog or aggregate those records before mutating multiple agents.
- ClawHub trust warnings and resolved dependency identity are part of the
  separately disclosed capability effect and plan integrity. The Claw CLI's
  exact plan confirmation may acknowledge that warning; an internal
  `acknowledge` parameter must not make the warning disappear from preview.
- Claws do not introduce capability-specific resource quotas. Existing
  canonical owner limits apply. Claw manifests are limited to 1 MiB and package
  metadata to 256 KiB; extraction, managed workspace, and plan limits remain
  parser and resource-safety policy.

## Rationale

The one-Claw-one-new-agent model gives the lifecycle one understandable unit of
ownership while continuing to delegate files, packages, MCP configuration, and
scheduled work to their existing OpenClaw owners. Grouped schema fields make
those boundaries reviewable; plan-first mutation, provenance, and conservative
cleanup make composition safer than an opaque setup script or whole-instance
export. The tradeoff is a broader lifecycle than an ordinary package manager,
which is why the RFC uses `add`/`remove`, explicit partial outcomes, and an
experimental gate rather than promising cross-owner atomicity.

## Compatibility and migration

Claws are additive. Existing agents, skills, plugins, MCP servers, cron jobs,
feeds, and plugin bundles continue to work without becoming Claws.

The earlier prototype used `openclaw.claw.v1`, a flat `entries[]` list, and
`claws apply` against a caller-selected workspace. That prototype is not the
accepted public compatibility contract. Before any implementation PR is made
ready, it must be restacked around the grouped schema and one-new-agent
invariant. Prototype SQLite tables may be discarded or migrated during the
draft phase; no released migration promise exists until the RFC is accepted.

## Rollout plan

Implementation should widen the trust boundary in reviewable slices:

1. **Schema and read-only plan.** Parse package metadata and grouped manifests;
   implement `inspect` and `add --dry-run`; prove agent/workspace collision
   behavior and complete blockers without mutation.
2. **Agent and workspace creation.** Add one `agents.list[]` entry, derive a new
   workspace, preserve defaults and existing agents, and persist the root apply
   record.
3. **Workspace bootstrap and supporting files.** Add confined file writes,
   managed hashes, partial-failure provenance, and local-edit protection.
4. **Skill and plugin packages.** Reuse existing installers, install skills into
   the new workspace, preserve artifact ownership boundaries, and warn on direct
   uninstall when Claws reference an artifact.
5. **MCP servers.** Add validated top-level MCP configuration, collision checks,
   redacted digest provenance, status, and cleanup.
6. **Heartbeat and cron jobs.** Apply portable heartbeat config and create
   scheduler records pinned to the new agent id with status/disable/remove proof.
7. **Status, doctor, and remove.** Diagnose complete and partial agents, drift,
   orphaned resources, and conservative cleanup.
8. **Update planning and apply.** Reconcile only the installed Claw-owned agent
   and resources, separating read-only planning from consented mutation.
9. **Export and round trip.** Export a selected agent to package metadata,
   grouped manifest, and safe sidecars; prove export-to-add in a fresh state dir.
10. **ClawHub publication and feeds.** Share schema fixtures, publish a package,
    expose it through hosted feeds, and prove source resolution and add dry-run.
11. **Control UI.** First expose read-only Claw inventory and health, then add
    plan-backed lifecycle actions and ClawHub discovery without creating a
    second mutation or policy implementation.

### Current OpenClaw implementation stack

The experimental implementation is one RFC plus thirteen ordered OpenClaw PRs. Each
implementation PR is based on the preceding head so reviewers can evaluate one
ownership boundary at a time:

1. [#101328](https://github.com/openclaw/openclaw/pull/101328) - grouped schema,
   inspect, and read-only add planning.
2. [#101755](https://github.com/openclaw/openclaw/pull/101755) - new agent,
   workspace root, and root install provenance.
3. [#101973](https://github.com/openclaw/openclaw/pull/101973) - managed
   workspace bootstrap and supporting files.
4. [#102228](https://github.com/openclaw/openclaw/pull/102228) - exact ClawHub
   skill/plugin installation and shared uninstall-reference warnings.
5. [#102296](https://github.com/openclaw/openclaw/pull/102296) - plan-first
   status and conservative remove.
6. [#102306](https://github.com/openclaw/openclaw/pull/102306) - agent-centric
   grouped export.
7. [#102383](https://github.com/openclaw/openclaw/pull/102383) - Gateway-owned
   cron jobs and scheduler provenance.
8. [#102406](https://github.com/openclaw/openclaw/pull/102406) - stdio and remote
   MCP ownership, including credential-free OAuth intent.
9. [#102427](https://github.com/openclaw/openclaw/pull/102427) - lifecycle and
   drift diagnostics.
10. [#102959](https://github.com/openclaw/openclaw/pull/102959) - read-only
    grouped update planning.
11. [#102982](https://github.com/openclaw/openclaw/pull/102982) - consented
    grouped update apply and compensation.
12. [#111391](https://github.com/openclaw/openclaw/pull/111391) - thin
    `CLAW.md` YAML-frontmatter input/export adaptation with grouped JSON read
    compatibility and no separate lifecycle behavior. It supersedes #106888,
    which was merged only into an obsolete stack head.
13. [#112773](https://github.com/openclaw/openclaw/pull/112773) - registered
    built-in tool profile selection, portable tool modifiers and filesystem
    restriction, narrow memory-search behavior, export round trip, and
    capability-aware updates.

Public documentation follows the same staged boundary as the implementation.
#101328 introduces the experimental guide, navigation, opt-in, schema, inspect,
and add preview. Each later PR extends that guide only with the command or
resource behavior implemented at that stage. #111391 adds only `CLAW.md`
authoring and canonical export documentation. The final settings slice documents
only the portable policy fields it implements. At every intermediate stack head,
the guide must describe no later command or ownership behavior.

These PRs replace the old workspace-apply prototype rather than
extending its compatibility contract. Every experimental CLI PR remains behind
`OPENCLAW_EXPERIMENTAL_CLAWS=1`; command registration, help, completion, and
direct-handler tests must prove the disabled state as well as the enabled state.

### Current ClawHub implementation stack

ClawHub follows the OpenClaw schema and lifecycle contract in four ordered PRs:

1. [#3089](https://github.com/openclaw/clawhub/pull/3089) - shared manifest
   validation, derived summaries, and storage data model. Existing generic
   publication remains closed to Claws.
2. [#3090](https://github.com/openclaw/clawhub/pull/3090) - guarded publication,
   package ingestion, source-file checks, CLI authoring support, and author
   guidance. It also owns the fail-closed public-read boundary while disabled
   and strips full manifests from every public release serializer. Publication
   retains the exact immutable artifact bytes and bounded summary, validates
   every package path, requires exact manifest/source spelling, applies strict
   UTF-8 and pre-parse size limits, and accepts Claw npm packs without requiring
   a plugin manifest.
3. [#3091](https://github.com/openclaw/clawhub/pull/3091) - enabled search,
   detail, and version APIs that expose only the latest or requested release's
   bounded summary.
4. [#3092](https://github.com/openclaw/clawhub/pull/3092) - separately gated
   hosted Claw feed with its own experimental wire contract, safe summaries,
   and exact artifact digests, plus a repeatable published-package proof through
   real OpenClaw add dry-run. The versioned route is gated before publication
   lookup and has no ungated unversioned redirect. The proof bounds download,
   entry count, per-file and aggregate expansion; rejects unsafe or colliding
   paths, links, and special archive entries; and supports npm-pack and legacy
   ZIP package roots.

The #3092 proof is a registry-to-OpenClaw bridge: it selects an exact candidate
from the experimental Claw feed, verifies and extracts the artifact, then hands
the package directory to OpenClaw. It proves that the published package produces
a real non-mutating OpenClaw plan; native OpenClaw Claw-feed resolution remains
a separate dependent integration.

The ClawHub runtime surfaces in this track require
`CLAWHUB_EXPERIMENTAL_CLAWS=1`. The deployment gate is independent of
`OPENCLAW_EXPERIMENTAL_CLAWS=1` in the OpenClaw client and is not a replacement
for explicit add/update consent.

The experimental ClawHub contract accepts both `CLAW.md` and the equivalent
grouped JSON manifest behind `CLAWHUB_EXPERIMENTAL_CLAWS=1`; it does not add a
second format-specific gate. Search, detail, and feed APIs expose bounded
summaries and immutable artifact coordinates; the applying client reviews the
full declaration from the resolved artifact.

### Current Control UI implementation stack

Control UI support is a non-blocking follow-up to the experimental CLI and
ClawHub tracks. The UI must consume the same plan, provenance, status, doctor,
and lifecycle operations as the CLI. It must not independently interpret a
manifest, decide resource ownership, broaden consent, or implement a second
mutation path.

The follow-up is intentionally limited to two ordered PRs:

1. [#112808](https://github.com/openclaw/openclaw/pull/112808) - read-only,
   experimental-gated Claw inventory and agent detail showing package identity
   and version, applied status, drift and doctor findings, and managed or
   referenced provenance. This slice performs no Claw mutation and does not
   require ClawHub discovery.
2. [#112828](https://github.com/openclaw/openclaw/pull/112828) - ClawHub search
   and exact-release detail plus canonical add, update, and remove previews,
   capability consent, blockers, partial outcomes, and confirmation. This
   slice depends on the ClawHub discovery APIs and invokes the same lifecycle
   planners and executors as the CLI.

The second slice resolves an exact ClawHub package and version, applies the
existing ClawHub trust gate, verifies the immutable artifact digest, and uses
the existing fs-safe extraction path. Preview leaves no durable source; apply
caches the verified source under the OpenClaw state directory so provenance can
support later update and status operations. The browser receives only bounded
catalog metadata and a redacted plan projection, not the manifest or source.

The confirmation token is a digest of the redacted projection bound to the
canonical planner's full internal `planIntegrity`. Therefore a change in file
content, configuration, provenance, capability effects, or live target state
invalidates confirmation even when the visible action labels are unchanged.
The Gateway rebuilds and verifies both layers before invoking mutation.

Catalog reads and lifecycle previews require `operator.read`. Add, update, and
remove apply require `operator.admin` and use the existing control-plane write
budget. Remove retains referenced resources by default; selecting unused
referenced cleanup rebuilds the plan and remains limited to resources with no
owner outside the selected Claw.

Both slices remain behind `OPENCLAW_EXPERIMENTAL_CLAWS=1`. Hiding navigation is
not the security boundary: disabled direct routes and backend operations must
also fail closed. ClawHub publication and discovery remain independently gated
by `CLAWHUB_EXPERIMENTAL_CLAWS=1`.

Control UI must not read or receive the Gateway process environment. The
Gateway evaluates `OPENCLAW_EXPERIMENTAL_CLAWS`, conditionally registers the
Claw lifecycle methods, and advertises only registered methods through the
existing `hello-ok.features.methods` capability list. Control UI exposes each
read or mutation surface only when its required method is advertised. With the
gate disabled, Claw methods are absent from capability discovery and direct
requests fail closed. A flag change takes effect through Gateway restart and
the normal Control UI reconnect capability refresh.

ClawHub follows the same server-authoritative rule without sharing a flag with
OpenClaw. Its Convex runtime evaluates `CLAWHUB_EXPERIMENTAL_CLAWS`; disabled
package queries omit or reject the Claw family, and the experimental feed
returns `404` with `Cache-Control: no-store`. Browser clients infer availability
only from those gated APIs and never receive the deployment environment value.

## Acceptance criteria

The RFC implementation is acceptable when tests and real CLI proof demonstrate:

1. Inspect validates package identity and the grouped manifest without mutation.
2. Without `OPENCLAW_EXPERIMENTAL_CLAWS=1`, the `claws` command is unregistered,
   absent from help and completions, and cannot be enabled by package content;
   the public experimental guide remains non-executable documentation.
3. Add dry-run shows one new agent, one new workspace, every file/package/MCP/
   cron action, all collisions, and stable machine-readable blockers.
4. An existing agent id or workspace blocks add unless an explicit unused
   override is supplied.
5. Add appends one agent without changing defaults or existing agents.
6. Canonical and supporting files are confined to the new workspace.
7. Skills install into that workspace without setting `agent.skills`.
8. Plugins use existing safety checks and preserve shared/direct ownership;
   CLI, Gateway, and Control UI uninstall paths all emit Claw-reference warnings
   through the shared lifecycle owner.
9. Portable stdio and remote MCP declarations write only validated top-level
   config, store no secrets or completed OAuth state in provenance, and do not
   depend on a feed-backed connector identity.
10. Cron jobs are scheduler records pinned to the final local agent id.
11. Any declared unsupported or blocked component fails the complete add.
12. Partial failures remain visible and cleanable; they are not reported as a
    successfully added Claw.
13. Status and doctor explain agent, workspace, package, MCP, cron, and managed
    file drift.
14. Update changes only Claw-owned state, preserves local/operator edits,
    revalidates owner state before mutation, compensates only safely reversible
    completed owners, retains uncertain provenance, and reports uncertain or
    irreversible outcomes as partial.
15. Remove uses canonical owner lifecycles, selects managed resources for
    cleanup, retains referenced resources by default, offers integrity-bound
    `remove-if-unused` and explicitly selected referenced cleanup, warns about
    every known affected Claw or direct owner, and preserves modified or
    unrelated state.
16. Export emits `CLAW.md`, excludes secrets and operator runtime settings,
    retains grouped JSON read compatibility, and can be added in a fresh state
    directory as a new equivalent agent.
17. Feed approval does not bypass dependency policy or install safety checks.
18. Every implementation stage documents its newly available surface without
    claiming commands or ownership behavior from a later stage.
19. Add and update plans disclose capability escalations separately from
    ordinary content, include them in plan integrity, and reject mutation when
    the reviewed capability set changes.

## Unresolved questions

- Before removing the experimental gate, should `CLAW.md` remain the default
  authoring/export representation or should export return to grouped JSON?
- What exact default workspace naming rule should resolve cross-platform path
  and case-folding collisions?
- Should ordinary `agents delete` eventually delegate attached-Claw recurring
  work cleanup, or remain distinct from the provenance-aware `claws remove`
  lifecycle?
- Should a future audit/history feature retain removed Claw tombstones? V1 keeps
  current ownership and incomplete recovery state only.
- Which cron delivery modes are portable without embedding local channel
  bindings?
- What package transports should mutating v1 support beyond ClawHub and local
  development packages?
- What is the minimum released SQLite migration contract before Claws leave
  draft status?
- How should OpenClaw and ClawHub publish and version one shared schema and
  fixture suite?
