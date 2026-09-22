---
title: Versioned External-Supervisor Operator Guidance
authors:
  - Paul Campbell
created: 2026-09-21
last_updated: 2026-09-21
status: draft
issue:
rfc_pr:
---

# Proposal: Versioned External-Supervisor Operator Guidance

## Summary

OpenClaw will let an external gateway supervisor provide bounded, versioned,
operator-facing lifecycle guidance through one process-scoped environment
variable. When `OPENCLAW_SUPERVISOR_MODE=external`,
`OPENCLAW_SUPERVISOR_GUIDANCE` may name the supervisor, identify where its
commands must run, and provide display-only commands for seven lifecycle
actions. OpenClaw will never execute or interpret this data, and invalid,
unsupported, absent, or partial guidance will fall back to today's generic
external-supervisor message without changing lifecycle authorization.

## Motivation

OpenClaw already recognizes external lifecycle ownership. At the
[current core boundary](https://github.com/openclaw/openclaw/blob/3aa130d87165ab08ce615238c8cc1a606ce19840/src/infra/gateway-supervision.ts),
`OPENCLAW_SUPERVISOR_MODE=external` prevents OpenClaw from mutating its native
service and tells the user to "Use that supervisor" for the requested action.
The same generic guidance reaches
[onboarding](https://github.com/openclaw/openclaw/blob/3aa130d87165ab08ce615238c8cc1a606ce19840/src/wizard/setup.finalize.ts),
[lifecycle commands](https://github.com/openclaw/openclaw/blob/3aa130d87165ab08ce615238c8cc1a606ce19840/src/cli/daemon-cli/lifecycle.ts),
[hosted stop](https://github.com/openclaw/openclaw/blob/3aa130d87165ab08ce615238c8cc1a606ce19840/src/daemon/hosted-stop.ts),
Doctor repair, update refusal, system-agent setup, and recovery paths.

That refusal is safe but not actionable. OpenClaw does not know whether "that
supervisor" is a packaging launcher, Docker, Docker Compose, Kubernetes, a
service manager, or an operator-specific control plane. It also cannot infer
whether the corresponding command exists in the current process environment.
A command suitable for a container host, such as
`docker compose up -d gateway`, is commonly unavailable inside the container
that prints the refusal.

The Windows packaging work proposed in
[openclaw/rfcs#58](https://github.com/openclaw/rfcs/pull/58) is one concrete
consumer. Its `clawctl` launcher sets `OPENCLAW_SUPERVISOR_MODE=external`,
keeps service repair and update authority outside OpenClaw, and owns commands
such as `clawctl gateway-service start`. OpenClaw can currently print only a
generic refusal or a packaging-specific postflight hint assembled outside the
core guidance path. Other external supervisors face the same integration gap.

The required user scenarios are:

1. **Packaged service operator -> blocked lifecycle command -> follow the
   owning launcher.** An operator runs an OpenClaw gateway lifecycle command
   inside a `clawctl`-managed installation. OpenClaw refuses native ownership,
   displays the exact `clawctl` action and execution context, and the operator
   can run the command in the owning environment.
2. **Container operator -> blocked in-container action -> act on the host.**
   An operator reaches a stop, repair, or update refusal inside a container.
   OpenClaw identifies that the suggested Docker or Compose command must run
   on the Docker host instead of implying that the binary is available in the
   container.
3. **Operator -> old, absent, or invalid guidance -> safe downgrade.** An
   older OpenClaw build, a partial deployment, or malformed input never gains
   lifecycle authority and never executes supplied text. New builds fall back
   to the existing generic message; old builds ignore the new variable.

This RFC concerns only operator guidance. The machine-level graceful-stop
handshake proposed in
[openclaw/openclaw#152863](https://github.com/openclaw/openclaw/issues/152863)
is a separate control protocol. Standard hosting profiles in
[openclaw/rfcs#37](https://github.com/openclaw/rfcs/pull/37) may describe
supported deployment postures, but do not own supervisor-specific lifecycle
commands.

## Goals

- Preserve `OPENCLAW_SUPERVISOR_MODE=external` as the single activation and
  ownership signal for externally supervised gateway lifecycle.
- Define one versioned v1 guidance payload that supports the `start`, `stop`,
  `restart`, `install`, `uninstall`, `repair`, and `update` actions.
- Give human-facing refusal and recovery paths a consistent, actionable
  command when the external supervisor supplies one.
- Keep every supplied string untrusted, bounded, display-only, and opaque to
  OpenClaw.
- Fall back independently for each missing action and fall back completely for
  invalid or unsupported payloads.
- Preserve current lifecycle authorization, JSON schemas, reason codes, and
  safe behavior across upgrades and downgrades.
- Make invalid guidance diagnosable without logging its potentially sensitive
  contents.
- Define conformance tests that an OpenClaw implementation and an external
  supervisor can run without invoking real service managers or mutating user
  state.

## Non-Goals

- Executing, shell-parsing, probing, validating, or locating an external
  supervisor command.
- Authorizing OpenClaw to install, repair, update, stop, or otherwise mutate an
  externally supervised gateway.
- Replacing `OPENCLAW_SERVICE_REPAIR_POLICY`,
  `OPENCLAW_NO_AUTO_UPDATE`, or any other repair or update policy.
- Defining a graceful-stop, restart, health, readiness, or process-control
  protocol between OpenClaw and a supervisor.
- Advertising supervisor capabilities or adding stable fields to
  machine-readable output in v1.
- Standardizing the syntax, exit codes, privileges, or availability of the
  displayed commands.
- Persisting guidance in OpenClaw configuration or a machine-level file.
- Putting credentials, tokens, connection strings, or other secrets in
  guidance.

## Proposal

### Ownership and activation

OpenClaw core owns the v1 schema, validation, action semantics, localization
boundary, resolution API, human rendering, diagnostics, and conformance tests.
An external supervisor owns construction of the payload, inheritance into the
OpenClaw process, command accuracy, execution context, and documentation for
the command's result.

`OPENCLAW_SUPERVISOR_GUIDANCE` is optional and has no effect unless
`OPENCLAW_SUPERVISOR_MODE`, after the existing normalization, equals
`external`. OpenClaw must not parse, warn about, or expose the guidance value
in any other supervisor mode.

Guidance never grants permission. A valid `repair` command does not change
service repair policy. A valid `update` command does not enable OpenClaw
self-update. A valid `stop` command does not permit OpenClaw to stop an
externally supervised process. Each existing policy check runs first and
continues to decide whether the OpenClaw operation is allowed. Guidance is
consulted only to explain the external action after OpenClaw refuses or
redirects the operation.

### Environment variable and v1 schema

`OPENCLAW_SUPERVISOR_GUIDANCE` contains a single-line UTF-8 JSON object:

```json
{
  "version": 1,
  "name": "clawctl",
  "context": "in an elevated PowerShell session",
  "actions": {
    "start": "clawctl gateway-service start",
    "stop": "clawctl gateway-service stop",
    "restart": "clawctl gateway-service restart",
    "install": "clawctl gateway-service install"
  }
}
```

The normative v1 fields are:

| Field | Required | Contract |
|---|---:|---|
| `version` | Yes | JSON integer `1`. Other values invalidate the payload. |
| `name` | Yes | Operator-facing supervisor name, 1-128 UTF-8 bytes. |
| `context` | No | Phrase describing where to run commands, 1-256 UTF-8 bytes. |
| `actions` | No | Object containing zero or more v1 action command strings. |
| `actions.<action>` | No | Opaque command text, 1-1,024 UTF-8 bytes. |

The only v1 action keys are `start`, `stop`, `restart`, `install`, `uninstall`,
`repair`, and `update`. Unknown top-level fields, unknown action keys, wrong
JSON types, arrays, and `null` values invalidate the whole payload. Producers
that need new fields or actions must use a later version rather than silently
changing v1 semantics.

`name`, `context`, and command strings must not have leading or trailing
whitespace. Each must be non-empty and within its byte limit. The complete raw
environment value must be no more than 8,192 UTF-8 bytes and must not contain
CR or LF, including insignificant JSON whitespace.

After JSON parsing, every string must be rejected if it contains a Unicode
character in the `Cc`, `Cf`, `Zl`, or `Zp` general category. This excludes
terminal controls, C0/C1 controls, line and paragraph separators, zero-width
format controls, and bidirectional controls. OpenClaw must validate strings by
Unicode scalar value, not by UTF-16 code unit, and must reject unpaired
surrogates.

The input limit is checked before parsing. Field limits and character rules are
checked after parsing. Any failure invalidates the entire payload, emits at
most one warning per process that names the variable and a non-sensitive
reason, and falls back to generic guidance. The warning must never echo the raw
value or an individual field.

The 8 KiB total limit leaves room for all seven maximum-size ASCII commands
while bounding parser and log exposure. It also keeps this optional variable
to roughly one quarter of the 32,767-character Windows environment block in
the common ASCII case and well below typical Unix argument-plus-environment
limits. The field limits allow practical host commands without turning a
refusal message into a general-purpose content channel.

### Action semantics

Actions identify the external operation that resolves the current OpenClaw
refusal. They do not promise that the command is available or that its effect
is synchronous.

| Action | Meaning |
|---|---|
| `start` | Start the externally managed gateway. |
| `stop` | Intentionally stop the externally managed gateway. |
| `restart` | Restart or replace the externally managed gateway. |
| `install` | Create or register the external gateway service ownership. |
| `uninstall` | Remove or unregister the external gateway service ownership. |
| `repair` | Restore the externally managed installation or service to its intended state. |
| `update` | Run the external supervisor's full update workflow. |

Callers must request one of these typed actions. They must not pass free-form
verbs into the resolver, derive one action from another, or use `restart` as a
fallback for a missing `start` or `stop`.

### Resolution and rendering

Core will expose one resolver for all external-supervisor operator guidance.
The resolver accepts a typed action and the process environment, then returns
one of:

- inactive, because external supervisor mode is not active;
- generic, because guidance is absent, invalid, unsupported, or missing the
  requested action; or
- guided, with validated `name`, optional `context`, and the exact opaque
  command for the requested action.

Parsing may be cached for the lifetime of the process. A caller must not read
or parse the environment variable independently.

When the requested command is present, a human renderer retains the existing
surface-specific refusal and adds a separate copyable command block. For
example:

```text
OpenClaw gateway lifecycle is managed by clawctl
(OPENCLAW_SUPERVISOR_MODE=external).
Run in an elevated PowerShell session:
  clawctl gateway-service restart
```

The line break shown after `clawctl` is prose wrapping, not a required output
break. The command itself must occupy a distinct line and must not receive
punctuation, quoting, capitalization, interpolation, path normalization, or
shell escaping from OpenClaw.

When `context` is absent, the renderer uses a localized equivalent of `Run:`.
When the requested action is absent, the renderer uses today's generic
action-specific message:

```text
OpenClaw gateway lifecycle is managed by an external supervisor
(OPENCLAW_SUPERVISOR_MODE=external). Use that supervisor to restart it.
```

One present action must not affect fallback for another action. For example, a
payload containing only `start` still receives generic guidance for `repair`.

Surrounding prose, action descriptions, labels, and layout remain owned by the
OpenClaw surface and are localizable. `name`, `context`, and command are opaque
operator-supplied literals and must not be translated. Renderers that apply
Markdown, terminal markup, HTML, or another presentation language must escape
these literals for that language without changing their displayed characters.
The copyable command value must remain byte-for-byte equivalent to the
validated string.

### Integration surfaces

The resolver replaces local guidance assembly at every human-facing external
ownership boundary:

| Surface | Requested action |
|---|---|
| Onboarding postflight start hint | `start` |
| Gateway service start, stop, restart, install, and uninstall refusal | Matching lifecycle action |
| Hosted gateway stop refusal | `stop` |
| Doctor service repair redirect | `repair` |
| Self-update refusal | `update` |
| System-agent setup that requires external installation | `install` |
| Recovery flow | The exact operation recovery asks the operator to perform |

Recovery code must select the real next action rather than a generic
`repair`. If a recovery sequence can validly offer more than one action, it
may render more than one independently resolved command, with each missing
entry falling back independently.

Human messages in onboarding, the CLI, Doctor, update, system-agent setup, and
recovery must use the same resolver and validation result. No consumer may
special-case `clawctl`, Docker, or another supervisor.

Version 1 adds no fields to stable JSON or protocol output. Existing JSON
schemas, error codes, reason strings such as
`external-supervisor-update-required`, and exit behavior remain unchanged.
When a command supports machine-readable output, guidance is omitted from that
output in v1; only human-mode text is enriched. Consumers must continue to use
codes and reasons rather than parse refusal prose.

### Producer examples

#### `clawctl`

The launcher supplies all three policy variables to the OpenClaw child
process. The JSON is shown expanded for review; the actual environment value
is serialized on one line.

```powershell
$env:OPENCLAW_SUPERVISOR_MODE = "external"
$env:OPENCLAW_SERVICE_REPAIR_POLICY = "external"
$env:OPENCLAW_NO_AUTO_UPDATE = "1"
$env:OPENCLAW_SUPERVISOR_GUIDANCE = '{"version":1,"name":"clawctl","context":"in an elevated PowerShell session","actions":{"start":"clawctl gateway-service start","stop":"clawctl gateway-service stop","restart":"clawctl gateway-service restart","install":"clawctl gateway-service install"}}'
```

Before this contract, `openclaw gateway restart` can end with:

```text
OpenClaw gateway lifecycle is managed by an external supervisor
(OPENCLAW_SUPERVISOR_MODE=external). Use that supervisor to restart it.
```

With valid v1 guidance, it can end with:

```text
OpenClaw gateway lifecycle is managed by clawctl
(OPENCLAW_SUPERVISOR_MODE=external).
Run in an elevated PowerShell session:
  clawctl gateway-service restart
```

#### Docker Compose

Compose injects guidance into the container, but the context makes clear that
the displayed command belongs to the host:

```yaml
services:
  gateway:
    environment:
      OPENCLAW_SUPERVISOR_MODE: external
      OPENCLAW_SUPERVISOR_GUIDANCE: '{"version":1,"name":"Docker Compose","context":"on the Docker host","actions":{"start":"docker compose up -d gateway","stop":"docker compose stop gateway","restart":"docker compose restart gateway","repair":"docker compose up -d --force-recreate gateway","update":"docker compose pull gateway && docker compose up -d gateway"}}'
```

A blocked start then renders:

```text
OpenClaw gateway lifecycle is managed by Docker Compose
(OPENCLAW_SUPERVISOR_MODE=external).
Run on the Docker host:
  docker compose up -d gateway
```

A deployment using plain Docker can instead provide, for example,
`docker start openclaw-gateway`. OpenClaw does not inspect the container
runtime, choose between Docker and Compose, or test either command.

### Trust and security

Guidance crosses a trust boundary from the process launcher into user-visible
output. OpenClaw therefore treats it as untrusted display data:

- It is never passed to a shell, process API, command resolver, filesystem
  probe, network request, or package manager.
- Validation occurs before any field is logged or rendered.
- Control, format, multiline, and bidirectional characters are rejected to
  prevent terminal escape injection, hidden direction changes, and misleading
  command display.
- Presentation-specific metacharacters are escaped by the final renderer.
- Limits bound memory, log amplification, and environment-block consumption.
- Invalid-input diagnostics identify only the variable and rejection class.
- The contract forbids secrets. Environment inheritance, crash reports,
  process inspection, diagnostics, and copied terminal output can expose the
  complete value.
- Displaying a command does not establish that it is trustworthy. The launcher
  already controls the OpenClaw process environment and is responsible for the
  accuracy and security of its guidance.

The contract deliberately does not validate command availability. Doing so
would be incorrect for host-side commands, could execute shell lookup hooks,
would create platform-specific behavior, and would turn guidance into a
capability signal it is not designed to be.

### Compatibility, downgrade, and removal

The contract is additive:

- New OpenClaw with no guidance produces today's generic text.
- New OpenClaw with invalid, unknown-version, or partial guidance falls back
  safely, per action.
- Old OpenClaw ignores `OPENCLAW_SUPERVISOR_GUIDANCE` and continues to honor
  `OPENCLAW_SUPERVISOR_MODE=external`.
- A supervisor may ship the variable before its minimum OpenClaw version is
  deployed because ownership and authorization do not depend on guidance.
- Removing the feature from a deployment requires only unsetting the guidance
  variable. External ownership remains active until the separate supervisor
  mode variable is changed.

Version 1 is supported as a public producer contract once released. A future
version uses a different integer in the same variable. Implementations that do
not support that integer must use generic guidance, not attempt best-effort
field parsing. OpenClaw must not reinterpret v1 fields incompatibly.

Human text compatibility is intentionally narrow. Existing prose may gain a
validated name, context, and command in human mode. Exact sentence text and
line wrapping are not stable interfaces. Existing machine schemas, codes,
reasons, and exit behavior are stable and do not change in v1.

### Rollout and operations

Rollout occurs in three independent steps:

1. Core adds the parser, resolver, renderer, diagnostics, and all call-site
   migrations while preserving generic fallback.
2. External supervisors add one-line v1 payloads alongside their existing
   ownership and policy variables.
3. Supervisor documentation adopts the same action names and commands shown by
   OpenClaw.

Core can ship first with no producer. A producer can also ship first because
older core versions ignore the variable. There is no coordinated flag day.

Operators can determine whether guidance was accepted by exercising a safe
human-facing refusal path or by running Doctor after core exposes the
non-sensitive validation status there. Diagnostics may report `absent`,
`accepted-v1`, `unsupported-version`, `oversized`, `invalid-json`,
`invalid-shape`, `invalid-character`, or `field-too-long`; they must not report
field contents. This status is diagnostic text, not a stable machine API.

Rollback consists of removing the producer variable or reverting the core
renderer. Neither changes the established external ownership marker. A
malformed rollout therefore degrades to generic guidance instead of restoring
native service ownership.

### Validation and conformance

Core acceptance requires behavior tests through real public paths, not source
inspection:

- each of the seven lifecycle actions renders its exact supplied command on a
  distinct line in at least one end-to-end CLI or handler path;
- onboarding, lifecycle refusal, hosted stop, Doctor repair, update refusal,
  system-agent setup, and recovery resolve through the shared behavior;
- absent guidance and each missing action preserve generic per-action output;
- non-external mode ignores even malformed guidance and emits no guidance
  warning;
- wrong versions, malformed JSON, unknown fields/actions, wrong types,
  oversized input, overlong fields, surrounding whitespace, raw newlines,
  Unicode control/format/line characters, and unpaired surrogates fall back
  without displaying rejected data;
- human renderers escape presentation metacharacters while preserving the
  copyable command;
- JSON output retains its existing schema, codes, reasons, and exit behavior;
- guidance cannot cause a process launch, filesystem probe, network request,
  service mutation, repair, or update;
- repeated resolution emits at most one invalid-input warning per process.

Tests must inject an isolated environment and fake lifecycle dependencies.
They must not touch the user's service manager, registry, containers,
installation, profile, or network.

A conforming producer test serializes its payload exactly as inherited by the
OpenClaw child process, verifies the 8 KiB and field limits by UTF-8 byte
length, verifies that it contains no forbidden Unicode categories or secrets,
and checks that every advertised command matches the producer's documented
operator workflow. Producers are not required to populate all actions.

## Rationale

### Why one process environment value

The guidance travels with the existing process-scoped ownership marker. One
JSON value gives the launcher an atomic snapshot: OpenClaw cannot observe a
new supervisor name with stale action variables or a partially rewritten
file. Process inheritance naturally scopes different guidance to different
gateway instances and requires no new persistence, cleanup, watcher, file
permissions, or configuration precedence.

The version field makes downgrade behavior explicit. An older OpenClaw ignores
the variable, while a newer implementation can reject an unsupported version
without guessing. The strict v1 shape makes producer mistakes visible and
reserves semantic changes for a version bump.

Environment size is the main tradeoff. The total and per-field limits keep the
value practical on Windows and Unix, and this contract carries short operator
commands rather than scripts or documentation. Supervisors with longer
workflows should provide a short trusted launcher command whose own help and
logs explain the remaining steps.

### Alternatives considered

**Per-action environment variables.** Variables such as
`OPENCLAW_SUPERVISOR_START_COMMAND` avoid JSON parsing but cannot update
atomically as a set, duplicate naming and validation rules, consume more of
the environment block, and have no clean schema-version negotiation.

**A guidance file.** A file permits larger and richer content but introduces
path discovery, ACL and ownership requirements, stale-file cleanup, encoding,
watching, and time-of-check/time-of-use questions. A container would also need
a mount for data that is already known by its launcher. This is disproportionate
for display-only commands.

**OpenClaw configuration.** Persisting external ownership guidance in
OpenClaw-owned configuration blurs the ownership boundary and can outlive or
be copied away from the supervisor that makes the commands valid. It also
creates precedence questions between runtime ownership and stored settings.

**Supervisor-specific integrations in core.** Teaching OpenClaw about
`clawctl`, Docker, Compose, systemd, or Kubernetes would couple release
cadences, require environment probing, and inevitably produce incorrect
commands for customized deployments. The supervisor is the authority on its
own operator workflow.

**Structured executable plus argument arrays.** This would suggest that
OpenClaw can safely execute the operation and would not represent shell,
remote-host, or control-plane workflows well. V1 deliberately carries a
human-copyable display string and forbids execution.

**Documentation URL instead of a command.** A URL can explain a workflow but
does not make a routine refusal immediately actionable, may be inaccessible
in an offline deployment, and adds URL trust and rendering concerns. A future
version can consider a bounded documentation reference if concrete consumers
need one.

**Stable guidance fields in JSON output.** This would create an automation
contract before action availability, trust, and cross-version semantics are
proven. Existing codes and reasons already let automation identify the
refusal. V1 improves humans only and leaves machine expansion to a separate
proposal.

**Inferring commands from hosting profiles.** Hosting profiles describe
supported deployment posture and readiness, not the exact launcher, project
name, container name, privilege boundary, or operator control plane. Inference
would be less accurate than producer-supplied guidance and would cross the
ownership line defined here.

## Unresolved questions

No unresolved question blocks v1. The following are explicit follow-ups rather
than implicit v1 behavior:

- Should a later version add a bounded documentation reference for workflows
  that cannot be represented by one short command?
- If concrete automation consumers emerge, should a separate proposal define
  a narrow machine-readable action-discovery contract? Such a contract must
  not reuse display strings as executable input.
- Should hosting profiles define recommendations for which actions a profile's
  supervisor normally supplies, while leaving the command values and
  lifecycle authority outside the profile?
