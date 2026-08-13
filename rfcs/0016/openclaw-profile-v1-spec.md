# OpenClaw Claw Profile v1

Status: accepted experimental contract, tied to RFC 0016.

This document defines the OpenClaw-owned harness profile at
`profiles/openclaw.yml`. Shipped OpenClaw behavior is authoritative for this
profile. The portable manifest and package lifecycle remain defined by
`claw-md-v1-spec.md` and `claw-package-v1-spec.md`.

## Scope

The profile maps one portable Claw to OpenClaw-native agent policy, memory, and
extension requirements. It does not change portable schema version 1, define a
universal plugin format, or move operator-owned configuration into a package.

Other harnesses own their own conventional profiles and native projection. They
do not need OpenClaw tool names, agent CRUD, or identical presentation.

## Discovery and Integrity

The canonical path is `profiles/openclaw.yml`. When present, the file:

- is a regular, non-linked UTF-8 file inside the package;
- is at most 256 KiB;
- participates byte-for-byte in package or development-source integrity;
- uses JSON-compatible YAML and rejects duplicate keys, anchors, aliases,
  merge keys, explicit tags, unknown fields, and unsupported versions; and
- is validated during inspect and before add, update, dev, or build succeeds.

For shipped compatibility, `metadata.openclaw.config` may select a safe
package-relative `.yml` or `.yaml` profile. OpenClaw emits a deprecation warning.
If `profiles/openclaw.yml` also exists, the pointer must name that same path or
validation fails. Canonical producers use only the conventional path.

Absence means inherited OpenClaw defaults and no profile extensions.

## Strict Schema

The top-level shape is:

```yaml
schemaVersion: 1
agent: {}
extensions: []
```

`schemaVersion` and `agent` are required. `agent` may be empty. `extensions` is
optional and defaults to an empty array. Every object is strict.

### Agent Settings

`agent` may contain only:

| Field | Constraints |
| --- | --- |
| `groupChat.mentionPatterns` | Non-empty array of non-empty strings. |
| `sandbox.mode` | `off`, `non-main`, or `all`. |
| `sandbox.scope` | `session`, `agent`, or `shared`. |
| `sandbox.workspaceAccess` | `none`, `ro`, or `rw`. |
| `tools.profile` | A built-in profile registered by the applying OpenClaw version. |
| `tools.allow` | Non-empty bounded grants; mutually exclusive with `alsoAllow`. |
| `tools.alsoAllow` | Non-empty bounded grants; requires `profile` and is mutually exclusive with `allow`. |
| `tools.deny` | Non-empty array. |
| `tools.fs.workspaceOnly` | Literal `true`; omission inherits host policy. |
| `memory.search.enabled` | Boolean. |
| `memory.search.rememberAcrossConversations` | Boolean explicit cross-conversation opt-in. |
| `memory.search.sources` | Non-empty subset of `memory` and `sessions`. |
| `heartbeat` | Exact heartbeat object below. |
| `humanDelay` | Exact human-delay object below. |

The canonical memory path is `memory.search`; there is no `memorySearch` alias.
Selecting `sessions` requires `rememberAcrossConversations: true`.

Tool grants must be bounded. Wildcards, unresolved dynamic groups,
`group:plugins`, and `bundle-mcp` are not portable consent boundaries. The
`full` profile requires an explicit bounded `allow`. If a selected profile
contains a dynamic selector, `allow` must narrow the effective set to concrete
tool names accepted by that profile. `alsoAllow` cannot be used without a
profile. Host policy remains an upper bound.

`heartbeat` may contain only:

| Field | Constraints |
| --- | --- |
| `every` | Valid OpenClaw duration. |
| `activeHours.start` | `HH:MM`, `00:00` through `23:59`. |
| `activeHours.end` | `HH:MM`, `00:00` through `24:00`. |
| `activeHours.timezone` | Valid IANA timezone. |
| `lightContext` | Boolean. |
| `isolatedSession` | Boolean. |
| `timeoutSeconds` | Positive integer. |

Unknown heartbeat fields, including retired busy-state policy, are invalid.

`humanDelay` may contain `mode`, `minMs`, and `maxMs`. `mode` is `off`,
`natural`, or `custom`; millisecond values are non-negative integers.

Example accepted by the shipped strict schema:

```yaml
schemaVersion: 1
agent:
  groupChat:
    mentionPatterns: ["@triage"]
  sandbox:
    mode: all
    scope: agent
    workspaceAccess: rw
  tools:
    allow: [read, write, web_fetch]
    deny: [exec]
    fs:
      workspaceOnly: true
  memory:
    search:
      enabled: true
      rememberAcrossConversations: true
      sources: [memory, sessions]
  heartbeat:
    every: 30m
    timeoutSeconds: 120
  humanDelay:
    mode: natural
extensions:
  - id: github-actions
    kind: plugin
    format: openclaw
    source: clawhub
    ref: "@acme/github-actions"
    version: 2.1.0
```

### Native Extensions

Each `extensions` entry has required fields:

| Field | Contract |
| --- | --- |
| `id` | Unique portable identifier. |
| `kind` | Exactly `plugin`. |
| `format` | `openclaw`, `claude`, `codex`, or `cursor`. |
| `source` | Exactly `clawhub`. |
| `ref` | Canonical package reference. |
| `version` | Exact semantic version. |

`format` is an expected artifact-format assertion. OpenClaw delegates detection,
scanning, installation, mapping, readiness, update, and cleanup to its canonical
plugin owner. A mismatch, blocked artifact, unavailable package, failed
preflight, duplicate dependency, or bundle with no usable mapped component
blocks the complete plan.

Mapped and unavailable components, artifact integrity, adapter identity, trust
findings, setup requirements, and redacted effects participate in plan
integrity. The Claw records a referenced dependency edge and origin; it does not
gain plugin deletion authority.

Existing experimental portable `packages` entries of kind `plugin` remain
readable. Canonical producers put new OpenClaw-native extension requirements in
this profile and do not duplicate the same dependency in both locations.

## Ownership and Lifecycle

Inspect and dry-run expose effective settings, extension identity, detected
format, mapped and unavailable inventory, prerequisites, and redacted effects.
Add delegates agent settings to the canonical agent owner and extensions to the
canonical plugin owner.

Update re-resolves built-in profiles and extension mapping. Any effective tool
grant, memory capability, filesystem-access, or extension increase is a
capability escalation requiring renewed exact consent. Status and doctor report
profile and extension drift without silently changing plugin enablement.

Remove releases extension dependency edges and retains plugins by default.
Uninstall is a separately selected canonical plugin-owner operation.

The profile cannot carry models, providers, credentials, bindings, custom tool
profiles, sender-specific policy, memory providers, remote memory endpoints,
local storage paths, or indexing tuning.

## Conformance

A conforming OpenClaw adapter must:

- discover and validate the profile as specified;
- preserve inherited defaults when absent and host policy when present;
- freeze consent to bounded effective tool and memory policy;
- use canonical plugin owners for every extension;
- fail closed on unsupported settings and required extension failures;
- bind exact profile bytes and resolved effects into integrity;
- keep credentials and resolved secrets outside package and Claw state; and
- preserve referenced plugins by default during removal.
