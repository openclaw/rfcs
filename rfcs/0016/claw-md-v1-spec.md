# CLAW.md v1 Specification

This document is the implementer-facing manifest specification for RFC 0016,
Claws. The RFC explains the product model, ownership boundaries, lifecycle, and
rollout plan. This file defines the schema version 1 data contract shared by
OpenClaw and Claw registries and its human-readable `CLAW.md` envelope.

Status: experimental draft, tied to RFC 0016.

## Incubation Status

The experimental implementation reads `CLAW.md` and equivalent grouped JSON,
and exports `CLAW.md`. Both forms use the existing
`OPENCLAW_EXPERIMENTAL_CLAWS=1` gate; there is no format-specific flag.

`CLAW.md` is intentionally a thin serialization layer over the grouped schema.
It does not define separate lifecycle, ownership, provenance, or capability
semantics and introduces no new runtime dependency. Until the Claws gate is
removed, maintainers may revise or remove this envelope without preserving it
as a stable compatibility contract. Feedback remains welcome on the YAML
frontmatter boundary, Markdown-body role, portability, and authoring ergonomics.

## Scope

This specification defines:

- how a `CLAW.md` document carries a machine-readable Claw manifest;
- the equivalent JSON representation;
- the grouped schema version 1 fields;
- strict parsing, defaults, and rejection behavior;
- portable path, package, MCP, and cron declarations;
- local prerequisite and diagnostic requirements;
- producer and consumer conformance requirements.

This specification does not define:

- package identity, archive layout, publication, or registry APIs;
- local add, update, remove, or provenance storage internals;
- credentials, channel bindings, models, providers, or completed OAuth state;
- a whole-instance export format;
- a generic harness-neutral runtime API.

The enclosing package contract is defined by
[`claw-package-v1-spec.md`](claw-package-v1-spec.md).

## Design Goals

`CLAW.md` is intended to be understandable in a code review while remaining a
strict input to lifecycle tooling. Its Markdown body can explain the agent to a
human. Its YAML frontmatter is the only executable declaration.

The same data model may also be represented as JSON. Markdown and JSON are two
serializations of one schema, not different capability levels.

## File Identification and Encoding

The canonical Markdown filename is `CLAW.md`. Consumers identify that filename
case-insensitively when selecting the Markdown parser. Other package-selected
manifest filenames are parsed as JSON.

A `CLAW.md` file must be UTF-8 text. Consumers must accept zero or one leading
UTF-8 byte-order mark and must reject additional byte-order marks. The accepted
byte-order mark is ignored for frontmatter matching, but the original file bytes
remain part of every package or source integrity digest.

## Document Envelope

A `CLAW.md` document has this shape:

```markdown
---
schemaVersion: 1
agent:
  id: github-triage
---

# GitHub Triage

This Claw creates an agent that triages GitHub issues.
```

The following rules apply:

1. After an optional leading byte-order mark, the first line must be exactly
   `---`.
2. The opening delimiter must be followed by LF or CRLF.
3. The YAML frontmatter ends at the next line containing exactly `---`.
4. The closing delimiter must be followed by LF, CRLF, or end of file.
5. The Markdown body after the closing delimiter is documentation only. A
   consumer must not derive runtime behavior, package dependencies, policy, or
   lifecycle actions from it.
6. Producers should include a short heading and description in the Markdown
   body, but consumers must accept an empty body.

## YAML Conversion

Consumers must parse the frontmatter as one YAML 1.2 document using the YAML
1.2 Core Schema, then convert it to a JSON-compatible value before manifest
schema validation. A consumer must not apply YAML 1.1 scalar resolution; for
example, the unquoted v1 enum value `off` is a string, not a boolean.

Consumers must reject:

- malformed YAML;
- duplicate mapping keys;
- a frontmatter value that cannot be converted to JSON-compatible data;
- multiple YAML documents;
- anchors, aliases, merge keys, and explicit YAML tags;
- non-string mapping keys, non-finite numbers, and other values that have no
  unambiguous JSON representation;
- any value that fails the strict manifest schema below.

Consumers must not perform environment expansion, shell interpolation,
template evaluation, Markdown execution, or implicit package resolution while
parsing `CLAW.md`. Environment placeholders are retained as literal strings and
validated only where the schema permits them.

## Top-Level Manifest

The top-level value must be an object with these fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `schemaVersion` | integer | Yes | Must be exactly `1`. |
| `agent` | object | Yes | Portable configuration for the one new agent. |
| `workspace` | object | No | Bootstrap and supporting files. Defaults to empty. |
| `packages` | array | No | Exact skill and plugin dependencies. Defaults to empty. |
| `mcpServers` | object | No | Portable MCP declarations keyed by server name. Defaults to empty. |
| `cronJobs` | array | No | Agent-pinned scheduled work. Defaults to empty. |

Unknown top-level or nested fields must be rejected. A producer must not use an
unknown field as a forward-compatible extension point.

The manifest does not declare `managed`, `referenced`, ownership, uninstall, or
cleanup fields. The applying harness derives each resource relationship from
its kind and canonical owner state as specified by the package lifecycle. This
prevents package authors from claiming deletion authority over pre-existing or
shared host resources. Operator-selected referenced cleanup is remove-plan
input, not portable package content.

## Agent

`agent.id` is required. It must start with a lowercase ASCII letter, contain
only lowercase ASCII letters, digits, `_`, or `-`, and contain at most 64
characters. It is the default local id; add still fails if that id or its
derived workspace is already in use.

The portable agent object is:

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `id` | string | Yes | Agent-id syntax above. |
| `name` | string | No | Non-empty after trimming. |
| `description` | string | No | Non-empty after trimming. |
| `identity.name` | string | No | Non-empty after trimming. |
| `identity.theme` | string | No | Non-empty after trimming. |
| `identity.emoji` | string | No | Non-empty after trimming. |
| `identity.avatar` | string | No | Non-empty portable avatar described below. |
| `groupChat.mentionPatterns` | string array | No | At least one non-empty string when present. |
| `sandbox.mode` | enum | No | `off`, `non-main`, or `all`. |
| `sandbox.scope` | enum | No | `session`, `agent`, or `shared`. |
| `sandbox.workspaceAccess` | enum | No | `none`, `ro`, or `rw`. |
| `tools.allow` | string array | No | At least one non-empty string when present. |
| `tools.deny` | string array | No | At least one non-empty string when present. |
| `heartbeat` | object | No | Exact portable heartbeat object below. |
| `humanDelay` | object | No | Exact portable human-delay object below. |

All objects are strict. Consumers may accept empty optional objects, but
canonical producers must omit an optional object when none of its members are
present.

`heartbeat` may contain only:

| Field | Type | Constraints |
| --- | --- | --- |
| `every` | string | A non-negative OpenClaw duration using `ms`, `s`, `m`, `h`, or `d`; composite forms such as `1h30m` are allowed and a bare number means minutes. |
| `activeHours.start` | string | `HH:MM` in 24-hour form from `00:00` through `23:59`. |
| `activeHours.end` | string | `HH:MM` in 24-hour form from `00:00` through `24:00`; no other `24:xx` value is valid. |
| `activeHours.timezone` | string | Non-empty IANA timezone recognized by the scheduler. |
| `lightContext` | boolean | No additional constraint. |
| `isolatedSession` | boolean | No additional constraint. |
| `skipWhenBusy` | boolean | No additional constraint. |
| `timeoutSeconds` | integer | Greater than zero. |

`humanDelay` may contain only `mode`, `minMs`, and `maxMs`. `mode`, when
present, is `off`, `natural`, or `custom`. The millisecond values are optional
non-negative integers. Version 1 imposes no relationship between them; runtime
behavior uses the declared values only when the selected mode requires them.

`identity.avatar` may be an image data URL no larger than 2 MiB decoded or
2,796,230 characters encoded, or a workspace-relative path with a `.png`,
`.jpg`, `.jpeg`, `.gif`, `.webp`, or `.svg` extension. Remote URLs are not
portable v1 avatar values because their bytes are mutable and outside package
integrity. A workspace-relative avatar must exactly match a destination
declared in `workspace.files`. Its package source is then subject to the same
existence, containment, size, copy, digest, provenance, and drift rules as every
other managed workspace file. Consumers must reject an undeclared local avatar
path.

The manifest must not declare models, providers, thinking levels, credentials,
channel accounts, channel bindings, local default selection, or an existing
workspace path. Those remain operator-owned.

## Workspace

`workspace.bootstrapFiles` maps canonical OpenClaw filenames to package
sources. The only v1 keys are:

- `AGENTS.md`
- `SOUL.md`
- `IDENTITY.md`
- `TOOLS.md`
- `HEARTBEAT.md`

Each value has one required `source` field. `workspace.files` contains objects
with required `source` and `path` fields. `source` is relative to the package
root; `path` is relative to the new agent workspace.

Paths must be non-empty and relative. They must not contain absolute roots,
drive prefixes, empty segments, `.` segments, or `..` segments after `\` is
normalized to `/`. Package ingestion and local application must additionally
enforce realpath containment and reject unsafe filesystem objects as described
by the package specification.

No two declarations may target the same workspace destination after `\` to `/`
normalization, Unicode NFC normalization, and locale-independent case folding.
Consumers must use that normalized value only as a collision key; they must
preserve the declared spelling when materializing an accepted path. A supporting
file must not target a canonical bootstrap filename already declared in
`bootstrapFiles` under the same comparison.

## Packages

Each `packages` entry has this exact shape:

```yaml
- kind: skill
  source: clawhub
  ref: "@acme/issue-triage-playbook"
  version: 1.4.0
```

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `kind` | enum | Yes | `skill` or `plugin`. |
| `source` | enum | Yes | `clawhub` in schema version 1. |
| `ref` | string | Yes | Canonical immutable package coordinate assigned by the selected source. |
| `version` | string | Yes | Exact SemVer 2.0.0 version; ranges, tags, a leading `v`, and non-canonical numeric identifiers are forbidden. |

The source's canonicalization rules produce the identity key for `ref`; display
slugs and aliases are not identity. The tuple `(kind, source, canonical ref)`
must be unique within a manifest. Every package is required. The declaration
does not bypass source policy, scanning, compatibility checks, or the existing
skill/plugin installer.

## MCP Servers

`mcpServers` is keyed by a stable local server name using the same identifier
rules as `agent.id`.

A stdio server requires `command` and may declare:

- `transport: stdio`;
- `args` as an array of non-empty strings;
- `env` as a map whose values are literal `${ENV_VAR}` references;
- `toolFilter.include` and `toolFilter.exclude` arrays;
- finite positive `timeout` and `connectTimeout` values in seconds.

`command` and `args` are an executable plus literal argument vector. Consumers
must not pass them through a shell or perform variable, glob, home-directory, or
command substitution. Inspection and add must not launch the server. A package
manager command that names a downloadable artifact must use an exact immutable
version; a floating tag or range blocks the plan.

Environment keys must match `[A-Za-z_][A-Za-z0-9_]*`. Each value must match
`${[A-Z_][A-Z0-9_]*}` exactly. Literal secret values are forbidden. The applying
client must evaluate keys through its canonical spawned-process environment
safety policy; a blocked key blocks the Claw plan rather than being silently
dropped.

A remote server requires a URL and `transport` equal to `sse` or
`streamable-http`. The URL must use HTTPS, except that HTTP is allowed when the
hostname is exactly `localhost`, `127.0.0.1`, or `[::1]`. User information and
fragments are forbidden. A remote server may declare `auth: oauth`, tool
filters, and finite positive timeouts in seconds. It must not carry
authorization headers, bearer tokens, client secrets, or completed OAuth state.

The stdio and remote shapes are mutually exclusive. A stdio declaration must
not contain `url` or `auth`; a remote declaration must not contain `command`,
`args`, or `env`. A consumer must reject a mixed declaration rather than choose
one transport by field order or precedence.

`toolFilter.include` and `toolFilter.exclude`, when present, each contain at
least one unique non-empty exact tool name or simple `*` glob. A simple glob is
matched against the complete tool name, treats `*` as the only wildcard, and
treats every other character literally; `?`, character classes, and path
semantics are not supported. `include` first limits the discovered set and
`exclude` then removes matches, so exclusion wins when both match. Duplicate
filter entries must be rejected after exact string comparison.

Unresolved environment references and `auth: oauth` are local prerequisites,
not embedded credentials. Dry-run must list their names and affected server
without resolving or printing secret values. Add may complete after safely
writing the declaration, but status must report the server as `requires-local-
configuration` until every required environment value exists and OAuth login,
when declared, is complete. An applied Claw is not necessarily ready to run.

## Cron Jobs

Each cron job contains:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `id` | string | Yes | Manifest-local stable id using agent-id syntax. |
| `name` | string | No | Display name. |
| `schedule.cron` | string | Yes | Valid cron expression. |
| `schedule.timezone` | string | Yes | Non-empty IANA timezone recognized by the scheduler. |
| `session` | enum | Yes | `main` or `isolated`. |
| `message` | string | Yes | Non-empty scheduled input. |
| `delivery.mode` | enum | No | `none` or `announce`. |
| `delivery.channel` | enum | No | `last` in schema version 1. |

Cron ids must be unique. The lifecycle pins each created scheduler record to
the final local agent id; the manifest does not carry a channel account or
binding.

`schedule.cron` must be a portable five-field minute/hour/day-of-month/month/
day-of-week expression. Host-local timezone defaults are forbidden. `delivery`
may be omitted, may be `{ mode: none }`, or may be
`{ mode: announce, channel: last }`; `channel` is forbidden for `none` and
required for `announce`. Dry-run must identify that `last` resolves through
local channel state and does not embed a binding.

## Complete Example

```markdown
---
schemaVersion: 1
agent:
  id: github-triage
  name: GitHub Triage
  description: Reviews incoming issues and prepares a daily summary.
  tools:
    allow: [read, write, web_fetch]
    deny: [exec]
  heartbeat:
    every: 30m
workspace:
  bootstrapFiles:
    AGENTS.md:
      source: workspace/AGENTS.md
    SOUL.md:
      source: workspace/SOUL.md
  files:
    - source: workspace/reference/triage-policy.md
      path: reference/triage-policy.md
packages:
  - kind: skill
    source: clawhub
    ref: "@acme/issue-triage-playbook"
    version: 1.4.0
  - kind: plugin
    source: clawhub
    ref: "@openclaw/github"
    version: 2.1.0
mcpServers:
  github:
    command: npx
    args: [--yes, "@acme/github-mcp@3.4.1"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
cronJobs:
  - id: daily-triage
    schedule:
      cron: "0 9 * * 1-5"
      timezone: America/Los_Angeles
    session: isolated
    message: Review new issues and prepare the daily triage summary.
    delivery:
      mode: announce
      channel: last
---

# GitHub Triage

Adds one GitHub triage agent and the reviewed resources it needs.
```

## JSON Compatibility

The package contract may point `openclaw.claw` at a JSON file containing the
grouped top-level object. JSON input passes through the same strict schema,
defaults, diagnostics, and lifecycle. `CLAW.md` and JSON are two serializations
of the same schema version, not different capability levels.

## Compatibility and Evolution

Schema evolution requires a new integer `schemaVersion`. Consumers must reject
unsupported versions rather than partially apply them. New optional fields must
not be added to version 1 because strict v1 consumers reject unknown fields.

There is no canonical byte serialization. Producers should emit stable field
ordering and formatting for reviewable diffs, but semantic equality is based on
the parsed manifest. Artifact and source integrity remains byte-based.

## Diagnostics

Every rejection must identify a machine-readable code that remains stable for
the specification major version, the validation phase, and the most specific
manifest or package path available. Human messages must explain the violated
rule and a corrective action without including secret values or raw sensitive
owner errors. Consumers should return all independently actionable schema
findings from one read, but must stop before policy checks or mutation when
parsing or schema validation fails.

Diagnostics are not an extension mechanism. A warning must not permit a
consumer to ignore an unknown field, unsupported component, unsafe path, or
missing required package source and still call the Claw valid.

## Consumer Conformance

A conforming consumer must:

- parse the `CLAW.md` envelope and equivalent grouped JSON form as specified;
- reject duplicate YAML keys and unknown schema fields;
- validate all identifiers, exact versions, paths, environment references,
  cron expressions, timezones, and uniqueness constraints;
- ignore the Markdown body for runtime behavior;
- preserve original bytes for integrity calculations;
- reject a `CLAW.md` file larger than 1 MiB before parsing, including when it
  grows during the read;
- report unresolved environment and OAuth prerequisites without reading or
  persisting their values;
- emit actionable diagnostics without exposing resolved secrets;
- reject an unsupported schema version before planning mutation.

## Producer Conformance

A conforming producer must:

- emit UTF-8 `CLAW.md` with one YAML frontmatter block;
- emit only schema version 1 fields and exact dependency versions;
- keep all referenced workspace sources inside the enclosing package;
- use exact package and package-manager dependency versions and explicit cron
  timezones;
- place human explanation, not executable declarations, in the Markdown body;
- exclude credentials and operator-owned runtime choices;
- validate the result against this specification before publication or export.
