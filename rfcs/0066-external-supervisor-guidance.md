---
title: Versioned External-Supervisor Operator Guidance
authors:
  - Paul Campbell
created: 2026-09-21
last_updated: 2026-09-22
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/75
---

# Proposal: Versioned External-Supervisor Operator Guidance

## Summary

OpenClaw will let an external gateway supervisor provide bounded, versioned,
operator-facing lifecycle guidance through one process-scoped environment
variable. When `OPENCLAW_SUPERVISOR_MODE=external`,
`OPENCLAW_SUPERVISOR_GUIDANCE` may name the supervisor, identify where its
commands must run, and provide display-only commands for seven lifecycle
actions. OpenClaw will never execute or shell-interpret the command strings or
treat them as authority, and invalid, unsupported, absent, or partial guidance
will fall back to today's generic external-supervisor message without changing
lifecycle authorization.

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

External mode also reaches an authenticated out-of-process human surface.
[`update.run`](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/src/gateway/server-methods/update.ts#L423-L432)
refuses a Control UI update with
`external-supervisor-update-required`. The UI
[maps that reason](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/ui/src/app/update-overlay-helpers.ts#L45-L60)
to
[generic supervisor guidance](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/ui/src/i18n/locales/en.ts#L654-L666).
The current
[end-to-end scenario](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/ui/src/e2e/update-external-supervisor.e2e.test.ts#L20-L149)
retains that report in Settings without a retry or triage path. An in-process
renderer alone therefore cannot make every existing human boundary actionable;
the authenticated UI needs a bounded display projection of the same validated
guidance.

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
   owning launcher.** An operator runs an OpenClaw gateway start, stop, or
   service-setup command inside a `clawctl`-managed installation. OpenClaw
   refuses native ownership, displays the exact `clawctl` action and execution
   location, and the operator can run the command in the owning environment.
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
- Preserve current lifecycle authorization, required protocol fields, reason
  codes, exit behavior, and safe behavior across upgrades and downgrades while
  permitting a narrow additive optional display projection.
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
- Defining an executable action-discovery, capability, or authorization
  protocol, or projecting the general supervisor action map.
- Standardizing the syntax, exit codes, privileges, or availability of the
  displayed commands.
- Persisting guidance in OpenClaw configuration or a machine-level file.
- Putting credentials, tokens, connection strings, or other secrets in
  guidance.

## Proposal

### Ownership and activation

OpenClaw core owns the v1 schema, validation, action semantics, localization
boundary, resolution API, surface-rendering contract, diagnostics, and
conformance tests. An external supervisor owns construction of the payload,
inheritance into the OpenClaw process, command accuracy, execution location,
and documentation for the command's result.

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

`OPENCLAW_SUPERVISOR_GUIDANCE` is a single-line JSON text value:

```json
{
  "version": 1,
  "name": "clawctl",
  "runFrom": "Windows host session",
  "actions": {
    "start": "clawctl gateway-service start",
    "stop": "clawctl gateway-service stop",
    "restart": "clawctl gateway-service restart"
  }
}
```

Process environments expose strings, not encoded byte sequences. Windows stores
environment strings as UTF-16; Unix-like systems expose platform byte strings
that the runtime decodes. For deterministic cross-platform limits, OpenClaw
measures this contract by encoding the complete JSON text and each parsed field
as UTF-8. A value that cannot be encoded as valid UTF-8 is invalid.

The normative v1 fields are:

| Field | Required | Contract |
|---|---:|---|
| `version` | Yes | JSON integer `1`. Other values invalidate the payload. |
| `name` | Yes | Operator-facing supervisor name, 1-128 UTF-8 bytes. |
| `runFrom` | No | Execution-location noun phrase, 1-256 UTF-8 bytes. |
| `actions` | Yes | Object containing one or more v1 action command strings. |
| `actions.<action>` | No | Opaque command text, 1-1,024 UTF-8 bytes. |

The only v1 action keys are `start`, `stop`, `restart`, `install`, `uninstall`,
`repair`, and `update`. Unknown top-level fields, unknown action keys, wrong
JSON types, arrays, and `null` values invalidate the whole payload. `actions`
must be present and must contain at least one recognized action with a valid
command string; an absent or empty `actions` object invalidates the payload.
Individual action keys remain optional, and a missing requested action uses
generic per-action fallback. Producers that need new fields or actions must use
a later version rather than silently changing v1 semantics.

`name`, `runFrom`, and command strings must not have leading or trailing
whitespace. Each must be non-empty and within its byte limit. The complete raw
environment text, after UTF-8 encoding, must be no more than 8,192 bytes and
must not contain CR or LF, including insignificant JSON whitespace.

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

The 8 KiB total limit supports several practical commands while bounding
parser, log, and environment exposure. It also keeps this optional variable to
roughly one quarter of the 32,767-character Windows environment block in the
common ASCII case and well below typical Unix argument-plus-environment
limits. The total cap always overrides the per-field maxima, including when
JSON escaping expands a command. The field limits allow practical host
commands without turning a refusal message into a general-purpose content
channel.

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
- guided, with validated `name`, optional `runFrom`, and the exact opaque
  command for the requested action.

Parsing may be cached for the lifetime of the process. A caller must not read
or parse the environment variable independently.

When the requested command is present, each human caller keeps its existing
note, error, or hint structure and localized action-first wording. It
identifies the validated supervisor name within that structure and renders the
supplied command using the surface's existing command styling and copy
affordance. V1 does not define one universal layout across onboarding, Doctor,
CLI errors, or other surfaces.

Current OpenClaw already follows this model.
[Onboarding strings](https://github.com/openclaw/openclaw/blob/673048954c9bf48e8e72b6ea1feaf7bbaadb2139/src/wizard/i18n/locales/en.ts)
use compact prompts such as `Start now:`, `Or rerun with:`, and
`Retry the managed service:`.
[Doctor hints](https://github.com/openclaw/openclaw/blob/673048954c9bf48e8e72b6ea1feaf7bbaadb2139/src/commands/doctor-format.ts)
use `Run:`, `Then reinstall:`, and `Recover with:`;
[service hints](https://github.com/openclaw/openclaw/blob/673048954c9bf48e8e72b6ea1feaf7bbaadb2139/src/cli/gateway-cli/shared.ts)
use `Tip:` and `Or:`; and
[systemd hints](https://github.com/openclaw/openclaw/blob/673048954c9bf48e8e72b6ea1feaf7bbaadb2139/src/daemon/systemd-hints.ts)
use `Then run:` and `Verify:`. These phrases illustrate current conventions;
they are not stable or normative English text.
[Daemon lifecycle output](https://github.com/openclaw/openclaw/blob/673048954c9bf48e8e72b6ea1feaf7bbaadb2139/src/cli/daemon-cli/lifecycle.ts)
also retains terminal-aware command presentation; current design language does
not establish a universal guidance label stack.

When `runFrom` is present, the caller appends it as parenthetical opaque
context to its localized action label rather than rendering a separate label
or sentence fragment. A surface may retain an established label such as
`Start now:`, `Run:`, `Tip:`, or `Recover with:`. When `runFrom` is absent, it
omits that parenthetical context.

Rendered examples throughout this RFC are illustrative and non-normative. The
normative rendering requirements are semantic consistency, surface-native
wording, and command fidelity. One possible onboarding rendering is:

```text
OpenClaw gateway lifecycle is managed by clawctl (OPENCLAW_SUPERVISOR_MODE=external).
Start (Windows host session): clawctl gateway-service start
```

The command string is an opaque command span, which may appear on the same line
as the action label. OpenClaw must not rewrite, parse, quote, capitalize,
interpolate, normalize paths in, shell-escape, add punctuation to, or pass that
string through `formatCliCommand`. Presentation escaping, ANSI styling, or
markup may wrap the command span, but copying it must yield exactly the
validated command string. Label punctuation remains outside the command span.

Across surfaces, semantic consistency means that guided output identifies
external lifecycle ownership and the validated `name`, presents the requested
action, includes optional `runFrom` context in the parenthetical form above,
and exposes the exact command. Surrounding prose, action descriptions, labels,
and layout remain owned by the OpenClaw surface and are localizable. `name`,
`runFrom`, and command are opaque operator-supplied literals and must not be
translated. Presentation-specific escaping of those literals must not change
the values displayed or copied.

When the requested action is absent, the caller uses today's generic
action-specific message:

```text
OpenClaw gateway lifecycle is managed by an external supervisor
(OPENCLAW_SUPERVISOR_MODE=external). Use that supervisor to start it.
```

One present action must not affect fallback for another action. For example, a
payload containing only `start` still receives generic guidance for `repair`.

### Integration surfaces

The resolver replaces local guidance assembly at every human-facing external
ownership boundary:

| Surface | Requested action |
|---|---|
| Onboarding postflight start hint | `start` |
| Gateway service start, stop, install, and uninstall refusal | Matching lifecycle action |
| Ordinary external-mode `openclaw gateway restart` | None; retain the existing in-Gateway `runExternalSupervisorRestart` handoff |
| A recovery or other surface that explicitly defers restart to the external supervisor | `restart` |
| Hosted gateway stop refusal | `stop` |
| Doctor service repair redirect | `repair` |
| CLI self-update refusal | `update` |
| Control UI update refusal and retained Settings report | `update` |
| System-agent setup that requires external installation | `install` |
| Recovery flow | The exact operation recovery asks the operator to perform |

Recovery code must select the real next action rather than a generic
`repair`. If a recovery sequence can validly offer more than one action, it
may render more than one independently resolved command, with each missing
entry falling back independently.

Human messages in onboarding, the CLI, Doctor, update, system-agent setup,
recovery, and the Control UI must use the same resolver and validation result.
No consumer may special-case `clawctl`, Docker, or another supervisor.

### Authenticated display projection and Control UI

V1 defines one reusable, action-specific wire shape named
`ExternalSupervisorDisplayGuidanceV1`:

| Field | Contract |
|---|---|
| `version` | Integer `1`, identifying this display projection contract. |
| `action` | The one v1 action requested by the enclosing response. |
| `name` | Exact validated `name` from the accepted guidance payload. |
| `runFrom` | Optional exact validated `runFrom` from that payload. |
| `command` | Exact validated command for `action`. |

Core constructs this projection only from an already validated payload and
only when that payload contains the requested action. It never sends the raw
environment value or the full action map. The projection is display-only and
non-authoritative. A client must not execute, shell-parse, probe, or treat it
as capability or authorization data.

For the current Control UI, authenticated `update.status` gains an optional
`externalSupervisorGuidance` field. The refused `update.run` response gains the
same optional field only when its reason is
`external-supervisor-update-required`. In both responses the field is present
only when valid `update` guidance exists, and its `action` is `update`.

The durable update run record must not store the projection or command.
`update.status` resolves and projects current process guidance so a retained
Settings report never preserves a stale deployment command. The immediate
refused `update.run` response carries the same projection resolved for that
response. A new UI renders the opaque values with its native localized update
presentation and command copy affordance. When the field is absent, it
preserves today's generic supervisor message.

An old UI ignores the additive optional field. The update Settings or sidebar
may remain non-proactive until it has hydrated `update.status`; v1 does not add
supervisor state to Gateway hello or snapshot. A future out-of-process human
surface may embed the same action-specific projection only in the relevant
authenticated response. V1 does not add a general supervisor
action-discovery endpoint.

Existing required protocol fields, error codes, reason strings such as
`external-supervisor-update-required`, and exit behavior remain unchanged.
Other machine-readable output receives no guidance. Consumers must continue
to use codes and reasons for control flow rather than parse display values or
refusal prose.

### Producer examples

#### `clawctl`

The launcher supplies all three policy variables to the OpenClaw child
process. The JSON is shown expanded for review; the actual environment value
is serialized on one line.

```powershell
$env:OPENCLAW_SUPERVISOR_MODE = "external"
$env:OPENCLAW_SERVICE_REPAIR_POLICY = "external"
$env:OPENCLAW_NO_AUTO_UPDATE = "1"
$env:OPENCLAW_SUPERVISOR_GUIDANCE = '{"version":1,"name":"clawctl","runFrom":"Windows host session","actions":{"start":"clawctl gateway-service start","stop":"clawctl gateway-service stop","restart":"clawctl gateway-service restart"}}'
```

`clawctl gateway-service status` remains available to the operator but is not
a mutating guidance action. The example does not advertise `install` or
`uninstall` because those `clawctl gateway-service` subcommands do not exist.

Before this contract, a refused `openclaw gateway start` can end with:

```text
OpenClaw gateway lifecycle is managed by an external supervisor
(OPENCLAW_SUPERVISOR_MODE=external). Use that supervisor to start it.
```

With valid v1 guidance, an illustrative surface-native rendering is:

```text
OpenClaw gateway lifecycle is managed by clawctl (OPENCLAW_SUPERVISOR_MODE=external).
Start (Windows host session): clawctl gateway-service start
```

Ordinary external-mode `openclaw gateway restart` continues to use the
in-Gateway restart handoff described in
[`Restart and supervision`](https://github.com/openclaw/openclaw/blob/3aa130d87165ab08ce615238c8cc1a606ce19840/docs/cli/gateway/restart-and-supervision.md).
This guidance contract does not redirect that command to
`clawctl gateway-service restart`. The v1 `restart` action remains available
for recovery and other surfaces that actually defer restart to the external
supervisor.

#### Docker Compose

Compose injects guidance into the container, but `runFrom` makes clear that the
displayed command belongs to the host:

```yaml
services:
  gateway:
    environment:
      OPENCLAW_SUPERVISOR_MODE: external
      OPENCLAW_SUPERVISOR_GUIDANCE: '{"version":1,"name":"Docker Compose","runFrom":"Docker host","actions":{"start":"docker compose up -d gateway","stop":"docker compose stop gateway","restart":"docker compose restart gateway","repair":"docker compose up -d --force-recreate gateway","update":"docker compose pull gateway && docker compose up -d gateway"}}'
```

A blocked start could use this illustrative rendering:

```text
OpenClaw gateway lifecycle is managed by Docker Compose (OPENCLAW_SUPERVISOR_MODE=external).
Start (Docker host): docker compose up -d gateway
```

A deployment using plain Docker can instead provide, for example,
`docker start openclaw-gateway`. OpenClaw does not inspect the container
runtime, choose between Docker and Compose, or test either command.

### Trust and security

Guidance crosses a trust boundary from the process launcher into user-visible
output. OpenClaw therefore treats it as untrusted display data:

- It is never passed to a shell, process API, command resolver, filesystem
  probe, network request, or package manager.
- Only the one validated action relevant to an authenticated operator response
  may cross the protocol boundary; the raw payload and full action map do not.
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
- New OpenClaw with invalid or unknown-version guidance falls back completely.
- New OpenClaw with a valid payload that omits a requested action falls back
  safely for that action without discarding other supplied actions.
- Old OpenClaw ignores `OPENCLAW_SUPERVISOR_GUIDANCE` and continues to honor
  `OPENCLAW_SUPERVISOR_MODE=external`.
- A supervisor may ship the variable before its minimum OpenClaw version is
  deployed because ownership and authorization do not depend on guidance.
- Removing the feature from a deployment requires only unsetting the guidance
  variable. External ownership remains active until the separate supervisor
  mode variable is changed.
- Old clients ignore the additive optional display projection. New clients
  preserve today's generic text when the projection is absent.
- Only authenticated operator surfaces receive a projection, and only for the
  action relevant to that response. No raw environment value or full action
  map crosses the protocol boundary.
- Durable update run records do not retain commands. Each `update.status` and
  refused `update.run` response projects guidance current to that response.

Version 1 is supported as a public producer contract once released. A future
version uses a different integer in the same variable. Implementations that do
not support that integer must use generic guidance, not attempt best-effort
field parsing. OpenClaw must not reinterpret v1 fields incompatibly.

Human text compatibility is intentionally narrow. Existing prose may gain a
validated name, execution location, and command in human mode. Exact sentence
text and line wrapping are not stable interfaces. Required machine fields,
codes, reasons, and exit behavior remain stable; only the optional
action-specific display projection is additive.

### Rollout and operations

Rollout occurs in four compatible steps:

1. Core adds the parser, resolver, surface-native call-site rendering,
   diagnostics, and in-process call-site migrations while preserving generic
   fallback.
2. The Gateway adds the optional projection to `update.status` and refused
   `update.run`, and the Control UI consumes it with generic fallback. The
   protocol and UI changes can ship in either order because the field is
   optional and ignored by older clients.
3. External supervisors add one-line v1 payloads alongside their existing
   ownership and policy variables.
4. Supervisor documentation adopts the same action names and commands shown by
   OpenClaw.

Core can ship first with no producer. A producer can also ship first because
older core versions ignore the variable. There is no coordinated flag day.

Operators can determine whether guidance was accepted by exercising a safe
human-facing refusal path or by running Doctor after core exposes the
non-sensitive validation status there. Diagnostics may report `absent`,
`accepted-v1`, `unsupported-version`, `oversized`, `invalid-json`,
`invalid-shape`, `invalid-character`, or `field-too-long`; they must not report
field contents. `accepted-v1` requires a non-empty valid `actions` object.
This status is diagnostic text, not a stable machine API.

Rollback consists of removing the producer variable or reverting the
surface integrations. Neither changes the established external ownership
marker. A malformed rollout therefore degrades to generic guidance instead of
restoring native service ownership.

### Validation and conformance

Core acceptance requires behavior tests through real public paths, not source
inspection:

- each of the seven lifecycle actions renders its exact supplied command in at
  least one end-to-end CLI or handler path using that path's established
  action wording and command presentation;
- onboarding, lifecycle refusal, hosted stop, Doctor repair, update refusal,
  system-agent setup, and recovery resolve through the shared behavior;
- representative onboarding, Doctor, CLI service, and systemd paths retain
  their surface-native note, error, or hint structure rather than adopting a
  shared label stack;
- ordinary external-mode `openclaw gateway restart` retains its existing
  in-Gateway handoff and does not render or require a `restart` guidance entry;
- absent guidance and each missing action preserve generic per-action output;
- non-external mode ignores even malformed guidance and emits no guidance
  warning;
- wrong versions, malformed JSON, missing or empty `actions`, unknown
  fields/actions, wrong types, oversized input, overlong fields, surrounding
  whitespace, raw newlines, Unicode control/format/line characters, and
  unpaired surrogates fall back without displaying rejected data;
- missing or empty `actions` never reports `accepted-v1`;
- ASCII and non-ASCII values enforce total and field limits by their UTF-8
  encoded byte length, including when the host stores environment strings as
  UTF-16;
- human surfaces localize only surface-owned wording, render `name` and
  optional `runFrom` as opaque literals, append `runFrom` as parenthetical
  action context, wrap the command span in any needed presentation escaping or
  styling, and copy back exactly the validated command without added
  punctuation or CLI reformatting;
- authenticated `update.status` includes current `update` guidance only when
  valid guidance exists, while absence preserves the generic UI message;
- a refused `update.run` with
  `external-supervisor-update-required` carries the same current
  action-specific projection, without changing its required fields, reason,
  or exit behavior;
- a retained Settings report resolves the current projection through
  `update.status`; the durable update run record, `update.runs.get`,
  `update.runs.list`, Gateway hello, and Gateway snapshot never persist or
  expose the command or full action map;
- old clients ignore the optional field, and new clients preserve generic
  guidance when the field is absent;
- Control UI rendering escapes and styles opaque values without changing the
  command copied by the operator;
- guidance cannot cause a process launch, filesystem probe, network request,
  service mutation, repair, or update, whether consumed in-process or through
  the display projection;
- repeated resolution emits at most one invalid-input warning per process.

Tests must inject an isolated environment and fake lifecycle dependencies.
They must not touch the user's service manager, registry, containers,
installation, profile, or network.

A conforming producer test serializes its payload exactly as inherited by the
OpenClaw child process, verifies the 8 KiB and field limits by UTF-8 byte
length, verifies that it contains no forbidden Unicode categories or secrets,
verifies that `actions` contains at least one recognized command, and checks
that every advertised command matches the producer's documented operator
workflow. Producers are not required to populate all actions.

## Rationale

### Why one process environment value

The guidance travels with the existing process-scoped ownership marker. One
JSON value gives the launcher an atomic snapshot: OpenClaw cannot observe a
new supervisor name with stale action variables or a partially rewritten
file. Process inheritance naturally scopes different guidance to different
gateway instances and requires no new persistence, cleanup, watcher, file
permissions, or configuration precedence.

The closest existing OpenClaw precedent for this transport shape is
`OPENCLAW_CUA_DRIVER_ENDPOINT`. The macOS app's
[`CuaDriverWorkerEndpoint`](https://github.com/openclaw/openclaw/blob/065eb1f58f13c5355be49edd113f82f22bc86f1d/apps/macos/Sources/OpenClaw/ComputerControlProvider.swift#L67-L79)
defines `v = 1`, `socketPath`, and `binaryPath`, and serializes the value with
`JSONEncoder`.
[`MacNodeModeCoordinator`](https://github.com/openclaw/openclaw/blob/065eb1f58f13c5355be49edd113f82f22bc86f1d/apps/macos/Sources/OpenClaw/NodeMode/MacNodeModeCoordinator.swift#L1036-L1044)
places that serialized value in the worker environment. The CUA worker defines
[a strict versioned schema](https://github.com/openclaw/openclaw/blob/065eb1f58f13c5355be49edd113f82f22bc86f1d/extensions/cua-computer/src/commands.ts#L43-L49)
and [caps and validates the input](https://github.com/openclaw/openclaw/blob/065eb1f58f13c5355be49edd113f82f22bc86f1d/extensions/cua-computer/src/commands.ts#L88-L115):
it rejects values over 4 KiB, parses JSON, rejects NUL and non-absolute paths,
and verifies that the binary is executable. This is the closest precedent for
a bounded, versioned, process-scoped app/worker contract.

`OPENCLAW_PLUGIN_INSTALL_OVERRIDES` is a secondary, narrower precedent. Its
[consumer](https://github.com/openclaw/openclaw/blob/065eb1f58f13c5355be49edd113f82f22bc86f1d/src/plugins/install-overrides.ts#L6-L70)
parses a JSON object from the environment only when separately gated by
`OPENCLAW_ALLOW_PLUGIN_INSTALL_OVERRIDES=1`, and its
[documentation](https://github.com/openclaw/openclaw/blob/065eb1f58f13c5355be49edd113f82f22bc86f1d/docs/plugins/install-overrides.md#L11-L34)
defines the JSON map for maintainer and E2E package validation. It demonstrates
a documented JSON environment payload, but it is not a model for v1
compatibility or versioning.

These precedents justify carrying JSON through process inheritance. They do
not make this RFC's public schema, action vocabulary, sanitization, or
compatibility obligations automatic. This RFC remains stricter because
supervisor guidance is a public cross-supervisor producer contract and reaches
user-visible output.

The version field makes downgrade behavior explicit. An older OpenClaw ignores
the variable, while a newer implementation can reject an unsupported version
without guessing. The strict v1 shape makes producer mistakes visible and
reserves semantic changes for a version bump.

Environment size is the main tradeoff. The total and per-field limits keep the
value practical on Windows and Unix, and this contract carries short operator
commands rather than scripts or documentation. Supervisors with longer
workflows should provide a short trusted launcher command whose own help and
logs explain the remaining steps.

### Why surface-native rendering

Onboarding, Doctor, service hints, daemon errors, and systemd guidance already
use different compact action-first language and presentation helpers. A
universal mini-form would duplicate established labels, make short hints look
like forms, and bypass terminal-aware command treatment already owned by each
surface. The shared resolver supplies semantic consistency; identical prose
and line layout do not.

Appending `runFrom` as parenthetical context preserves the important execution
boundary without turning the producer's noun phrase into localized sentence
grammar. The shared command-fidelity rule preserves the exact operator action
while allowing each surface to retain its normal styling and copy affordance.

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

**A full guidance map in Gateway hello or snapshot.** This would expose every
advertised action to clients that do not need it, preserve commands outside
the refusal that makes them relevant, and invite capability discovery or
automation against display strings. The chosen projection is narrower: it is
optional, action-specific, display-only, and embedded only in an authenticated
response that already represents that human operation. Update Settings can
hydrate it through `update.status`, so Gateway hello and snapshot need no
supervisor state.

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
  an executable or capability-oriented action contract? V1's machine-readable
  projection is display-only and must not be repurposed as executable input
  or general action discovery.
- Should hosting profiles define recommendations for which actions a profile's
  supervisor normally supplies, while leaving the command values and
  lifecycle authority outside the profile?
