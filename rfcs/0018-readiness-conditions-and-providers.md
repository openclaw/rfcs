---
title: Readiness Conditions and Providers
authors:
  - Gio
created: 2026-07-09
last_updated: 2026-07-23
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/33
---

# Proposal: Readiness Conditions and Providers

## Summary

Modernize OpenClaw's existing Gateway readiness evaluator into one canonical,
structured condition result. Existing startup, drain, channel, and event-loop
observations become core conditions; activated plugins may register bounded,
observational readiness providers; and `/ready`, `/readyz`, health, status, and
an optional CLI project the same result.

This RFC does not define hosting profiles. Standard Hosting Profiles are a
separate proposal that may compose conditions from this RFC into named support
contracts.

## Motivation

OpenClaw already exposes Gateway `/ready` and `/readyz`. Their fixed evaluator
answers important questions about startup, channel runtime health, drain state,
and event-loop health, but it is not an extensible readiness contract:

- existing observations do not share an iterable condition shape;
- plugins cannot contribute bounded readiness observations;
- operators cannot promote a known plugin dependency to required;
- health and status can omit facts or describe them differently; and
- hosts must interpret legacy fields and add private scripts for missing facts.

The result is avoidable ambiguity. A process may respond while its workspace is
full, startup dependencies are pending, the Gateway is draining, or a required
plugin-owned backend is unavailable. These are readiness questions, not new
liveness endpoints and not reasons for each host to invent a private protocol.

The proposed invariant is:

```text
core Gateway observations
+ core runtime observations
+ activated plugin-provider observations
-> one canonical readiness result
-> /ready, /readyz, health, status, optional CLI
```

Required `False` or `Unknown` conditions fail readiness. Advisory conditions
remain visible without causing an outage. Existing installations preserve their
current readiness behavior unless an operator explicitly requires an additional
provider condition.

### Evidence from existing issues

| Issue | Observed gap | Contract implication |
| --- | --- | --- |
| [openclaw#96084](https://github.com/openclaw/openclaw/issues/96084) | `/readyz` remains healthy when a PVC-backed workspace is full. | Workspace writability needs a bounded readiness condition. |
| [openclaw#78136](https://github.com/openclaw/openclaw/issues/78136) | Docker readiness remains healthy while the command queue is draining. | Admission state must remain a required readiness input. |
| [openclaw#73652](https://github.com/openclaw/openclaw/issues/73652) | The Gateway accepts connections before internal startup is ready. | Startup completion needs a stable required condition. |
| [openclaw#78954](https://github.com/openclaw/openclaw/issues/78954) | Channel/plugin sidecars can block a usable core Gateway. | Readiness needs explicit required versus advisory classification. |
| [openclaw#101083](https://github.com/openclaw/openclaw/issues/101083) | A channel can appear healthy while retrying a fatal login error. | Channel runtime truth should use the canonical result. |

## Goals

- Define one stable readiness-condition shape and aggregation rule.
- Normalize existing Gateway readiness observations into core conditions.
- Preserve existing response fields as compatibility projections.
- Add activation-scoped plugin readiness providers through the plugin SDK.
- Keep provider execution bounded, observational, enumerable, and fail-closed.
- Let operators explicitly select additional registered core or plugin
  criteria as required or advisory without selecting a hosting profile.
- Project one result through HTTP readiness, health, status, and an optional
  `openclaw ready` command.
- Add missing runtime status facts alongside conditions rather than creating a
  parallel evidence store.
- Keep detailed readiness output authenticated or local while preserving the
  compact unauthenticated probe response.

## Non-Goals

- Define standard or custom hosting profiles.
- Add profile selection, profile inheritance, or release profile conformance.
- Replace `openclaw.json` or create a second configuration system.
- Define OCC resources, placement, tenants, or an AgentHarness protocol.
- Make readiness depend on Doctor, policy, telemetry, or another optional
  subsystem.
- Permit arbitrary runtime code, shell commands, or remote probes in config.
- Make readiness prove checkpoint durability, safe shutdown, compatibility, or
  safe destruction.
- Standardize Docker, Kubernetes, or systemd probe intervals and retries.

## Proposal

The implementer-facing v1 contract is captured in
[`0018/readiness-v1-spec.md`](0018/readiness-v1-spec.md). This RFC remains the
design rationale, compatibility argument, and rollout plan; the sidecar is the
concise schema, provider-lifecycle, evaluation, projection, and conformance
reference for OpenClaw runtime and plugin implementations.

### Canonical condition model

Every readiness observation is represented as:

```ts
type ReadinessConditionStatus = "True" | "False" | "Unknown";
type ReadinessRequirement = "required" | "advisory";

type ReadinessCondition = {
  type: string;
  status: ReadinessConditionStatus;
  requirement: ReadinessRequirement;
  reason: string;
  message: string;
};

type ReadinessResult = {
  ready: boolean;
  conditions: ReadinessCondition[];
  failures: string[];
  advisories: string[];
};
```

`type` is stable machine identity. `reason` is a stable machine-readable state
or failure reason. `message` is redacted operator guidance and is not part of
machine matching.

Aggregation is deliberately simple:

| Requirement | Effect of `False` or `Unknown` |
| --- | --- |
| `required` | `ready=false`; reason appears in `failures`. |
| `advisory` | Overall readiness is unchanged; reason appears in `advisories`. |

An unobserved required fact is `Unknown`, never inferred as `True`. Duplicate
condition identities, invalid statuses, or malformed provider results are
converted to stable `Unknown` conditions or reject provider registration; they
must not disappear from the result.

### Core conditions

The first implementation normalizes the observations already owned by the
Gateway and adds generally applicable runtime facts where source evidence
justifies them.

| Condition | Requirement | True when | Stable non-ready reasons |
| --- | --- | --- | --- |
| `GatewayStartupComplete` | Required | Startup dependencies and startup sidecars are no longer pending. | `GatewayStartupPending` |
| `GatewayAcceptingWork` | Required | The Gateway is not draining and can admit new work. | `GatewayDraining` |
| `ChannelRuntimeReady` | Required | No selected channel has an unsuppressed runtime-health failure under existing channel policy. | `ChannelRuntimeUnavailable` |
| `ChannelRuntimeSuppressed` | Advisory when present | A channel runtime failure is intentionally suppressed by existing autostart/crash-loop policy. | `ChannelRuntimeSuppressed` |
| `EventLoopHealthy` | Advisory initially | Existing event-loop health is within its healthy threshold. | `EventLoopDegraded`, `EventLoopStatusUnavailable` |
| `ReadinessEvaluationComplete` | Required when emitted | The bounded canonical evaluation completed. This failure-only guard condition is emitted when the evaluator cannot produce its normal condition set. | `ReadinessEvaluationTimedOut`, `ReadinessEvaluationFailed` |
| `GatewayResponding` | Required when observed remotely | The current operation successfully reached the live Gateway. | `GatewayUnavailable`, `GatewayNotChecked` |
| `ConfigLoaded` | Required | The validated effective runtime config snapshot is installed. | `ConfigNotLoaded`, `ConfigInvalid`, `EffectiveConfigUnavailable` |
| `WorkspaceWritable` | Required or advisory when selected | The effective workspace exists and passes a bounded write, flush, and cleanup probe. It is not a new universal blocker by default. | `WorkspaceMissing`, `WorkspaceStorageFull`, `WorkspaceNotWritable`, `WorkspaceProbeFailed`, `WorkspaceProbeTimedOut`, `WorkspaceNotChecked` |
| `PluginsLoaded` | Advisory | The activation-pinned plugin registry is available and selected plugins have no activation errors. | `PluginLoadFailures`, `PluginStatusUnavailable` |

Changing an advisory core condition to required is a compatibility-sensitive
behavior change. It requires focused review and release notes because it can
change `/ready` from `200` to `503` for an existing deployment.

Further startup facts such as required plugin activation, required secret
availability, or resolved model routing should use the same condition model,
but only after their owners expose bounded, redacted activation snapshots.
Readiness polling must not reload plugins, reacquire secrets, or issue a model
request.

### Readiness providers

Only an activated OpenClaw plugin can register executable provider code. Core
conditions continue to use internal evaluators. Operators and control planes
may reference provider IDs; they cannot inject callbacks through config.

```ts
type PluginReadinessResult = {
  status: "True" | "False" | "Unknown";
  reason: string;
  message: string;
};

type PluginReadinessProvider = {
  id: string;
  description: string;
  check(context: {
    config: OpenClawConfig;
    pluginConfig: unknown;
    signal: AbortSignal;
  }): Promise<PluginReadinessResult> | PluginReadinessResult;
};

type RegisterReadinessCriterion = (
  provider: PluginReadinessProvider,
) => void;
```

Example:

```ts
api.registerReadinessCriterion({
  id: "backend",
  description: "Reports whether the plugin backend can accept work.",
  async check({ pluginConfig, signal }) {
    return (await probeBackend(pluginConfig, { signal }))
      ? {
          status: "True",
          reason: "BackendReady",
          message: "Backend is reachable.",
        }
      : {
          status: "False",
          reason: "BackendUnavailable",
          message: "Backend is unreachable.",
        };
  },
});
```

Core publishes the condition as `plugin.<plugin-id>.backend`. Registration is
bound to the activated plugin registry snapshot. Reload replaces the complete
provider set atomically with the next activation; stale callbacks do not remain
registered.

Provider descriptors are enumerable without invoking callbacks. The active
registry exposes provider identity, description, owning plugin, and source; the
registry snapshot itself is the activation-generation boundary. Future status
or diagnostics may project that descriptor catalog without executing providers.

Providers must be:

- read-only and observational;
- idempotent under repeated invocation;
- safe under concurrent invocation or protected by core coalescing;
- cancellation-aware;
- free of blocking synchronous I/O; and
- redacted by construction.

Core owns namespacing, validation, invocation, deadlines, cancellation,
coalescing, caching, error conversion, and result ordering. A provider cannot
alter another provider's condition or any core condition.

Provider `reason` values use a bounded machine-readable token grammar. Public
messages must be non-empty, contain no NUL bytes, and fit within 512 UTF-8
bytes after core redaction. Invalid output becomes
`CriterionInvalidResult=Unknown`; raw provider output never bypasses these
checks.

### Operator-selected readiness conditions

OpenClaw's universal Gateway lifecycle conditions always apply and cannot be
removed. Beyond that baseline, an operator may explicitly select registered
core or plugin criteria through Gateway readiness config without selecting a
hosting profile:

```json5
{
  gateway: {
    readiness: {
      requiredCriteria: [
        "openclaw.workspace-writable",
        "plugin.storage.backend",
      ],
      advisoryCriteria: ["plugin.metrics.exporter"],
    },
  },
}
```

Provider criteria are advisory unless selected as required. Selector syntax is
validated in config. A syntactically valid ID that is not present in the active
registry produces `CriterionNotRegistered=Unknown` with its selected
requirement; it cannot be silently ignored. Configuration changes are applied
through the normal validated config lifecycle. This RFC does not add a policy
language or a way to redefine criteria semantics.

This explicit list is a complete standalone use of RFC 0018. An operator can
say exactly which additional observations must pass for its deployment without
creating or selecting a profile. RFC 0023 adds reusable, named, release-tested
presets over the same selection mechanism.

### Bounded evaluation

Readiness is a hot operational endpoint and must return within code-owned
limits even when a provider is slow or broken.

The initial implementation uses layered bounds:

- a one-second deadline per plugin provider;
- a one-second deadline for the workspace probe;
- concurrent evaluation of independent observations;
- cancellation signals for cooperative providers; and
- an independent two-second outer watchdog for the complete result.

A timeout becomes `Unknown` with a stable reason. A required timeout returns
`503`; an advisory timeout remains visible without blocking. The outer watchdog
fails closed with a required `ReadinessEvaluationComplete=Unknown` condition
rather than allowing `/ready`, `/readyz`, health, or status to hang or reject.
Unexpected error details are not copied into the public result.

Core retains ownership of a provider invocation after its deadline. If a
provider ignores cancellation and remains pending, later readiness polls reuse
the stable timeout result and do not start another invocation. A new invocation
may begin only after the original callback settles and the result cache expires.
Publishing a replacement plugin registry or effective config snapshot aborts
the prior generation, clears its cache, and prevents late settlement from
entering the active result.

Workspace probes use the same generation fence but permit one replacement
probe when the effective workspace changes, so a blocked retired filesystem
does not pin the new workspace. At most two workspace probes may remain in
flight; further generations fail closed until capacity returns.

In-process timers cannot interrupt synchronous JavaScript that blocks the event
loop. Providers therefore may not perform blocking synchronous I/O. Process or
worker isolation for malicious plugins is outside this RFC.

### Canonical projections

`/ready` and `/readyz` remain the authoritative host probes. Authenticated or
local callers receive the structured result; unauthenticated remote probes
retain a redacted boolean response. `HEAD` behavior remains unchanged.

The same result is projected through Gateway health and status. A surface that
did not observe a required live fact reports `Unknown`; it does not synthesize
success. `/health` and `/healthz` remain shallow liveness and do not acquire
readiness semantics.

An optional `openclaw ready` command may be a thin client of the live Gateway
result:

- human output lists non-`True` conditions;
- `--json` preserves the canonical result; and
- exit status is nonzero for required failure, required unknown, transport
  failure, or a missing readiness contract.

The CLI must not implement a second evaluator.

### Compatibility

Existing `ready`, `failing`, `suppressed`, `eventLoop`, and `uptimeMs` fields
remain compatibility projections during migration. New consumers use
`conditions`, `failures`, and `advisories`.

The migration order is:

1. emit canonical conditions beside legacy fields;
2. make every projection consume the same canonical evaluator;
3. migrate internal and external consumers; and
4. consider legacy-field removal only through a separate compatibility review.

Existing installations gain structured output but do not gain new required
workspace or plugin dependencies. Registering or implementing an additional
criterion does not make it required. Only explicit operator configuration or a
separately selected standard profile changes the additional readiness gate.

### Readiness transitions

A later implementation may emit bounded, redacted events when overall
readiness or a condition changes. Event names, initial observation,
deduplication, restart behavior, and behavior without active polling require a
separate review. Telemetry sinks, dashboards, alerting, and retention remain
host responsibilities.

### Relationship to Standard Hosting Profiles

Standard Hosting Profiles depend on this RFC rather than sharing its acceptance
decision. A profile is a named preset of required and advisory criteria plus a
support promise. It cannot change condition evaluation, provider lifecycle, or
aggregation. Operators that do not need that support contract use
`gateway.readiness` directly.

This separation allows OpenClaw to accept structured readiness and provider
extensibility without committing to profile names, profile selection config,
runtime activation identity, or a release support matrix.

### Implementation plan

The primary implementation for this RFC is
[openclaw/openclaw#104018](https://github.com/openclaw/openclaw/pull/104018).
It is one upstream PR with fourteen ordered commits at exact head `c1919669c3f`,
rebased onto OpenClaw `main` at `b8a47b23384`. The refreshed branch passes
focused readiness, Gateway, status, health, CLI, and method-metadata tests;
production typing and unused-export checks also pass. Timed-out plugin checks remain single-flight
until the original callback settles, even when the plugin ignores cancellation;
provider output is bounded, validated, and redacted. Config publication fences
provider and workspace evidence by runtime generation, including recovery when
a retired filesystem probe never settles, while retaining a strict two-probe
ceiling across repeated generation changes. A prior package-installed
Docker lane proved `/ready` and `/readyz`
transition `200 -> 503 -> 200` for a selected workspace failure and recovery,
`/healthz` remains live, and `openclaw ready --json` exits `0 -> 1 -> 0` with
the same canonical condition. Exact-head remote container and published-upgrade
proof must be refreshed before landing. Reviewers should use that PR for the
proposed landing shape and current validation state.

The fork PRs below expose the implementation as optional smaller review
slices. They are supporting review aids, not alternative landing PRs:

| Slice | Draft PR | Intended scope |
| --- | --- | --- |
| Canonical core conditions | [PR 17](https://github.com/giodl73-repo/openclaw/pull/17) | Normalize existing Gateway observations and compatibility projections. |
| Workspace readiness | [PR 22](https://github.com/giodl73-repo/openclaw/pull/22) | Add the bounded `WorkspaceWritable` condition without profile behavior. |
| Readiness providers | [PR 23](https://github.com/giodl73-repo/openclaw/pull/23) | Add activation-scoped provider registration and operator-required criteria, without custom profiles. |
| Canonical readiness CLI | [PR 27](https://github.com/giodl73-repo/openclaw/pull/27) | Add a thin CLI projection of the live result. |

Profile selection, node-mode composition, activation identity, and packaged
profile release conformance move to the Standard Hosting Profiles RFC and its
separate implementation stack.

The earlier consolidated draft remains useful behavior evidence, but it is not
the proposed landing shape. The slices above can land without accepting profile
names, profile selection, runtime activation identity, or release conformance.

## Rationale

This extends a surface OpenClaw already owns. It does not add a new health
service, policy engine, or hosted envelope. Conditions make the current
evaluator explainable; providers give plugin-owned dependencies a bounded home;
and canonical projections prevent HTTP, status, health, and CLI from drifting.

Keeping providers advisory by default is the critical compatibility rule. A
plugin can improve diagnostics without gaining the power to take down the
Gateway. Operators retain the explicit decision to make a dependency required.

Separating profiles keeps this RFC independently useful and easier to accept.
OpenClaw can modernize readiness first, then decide separately whether named
runtime postures should become release-tested support promises.

## Unresolved questions

- Is `gateway.readiness` the correct config home for operator-required provider
  IDs, or should requirement selection use another existing Gateway surface?
- Which existing advisory observations, if any, should become required in the
  first compatibility-reviewed implementation?
- Should any non-plugin core owner need a public registration API, or should
  core conditions remain internal evaluators?
- What cache lifetime best balances probe cost and freshness for plugin
  providers?
