# Readiness v1 Specification

This document is the implementer-facing specification for RFC 0018, Readiness
Conditions and Providers. The RFC explains the motivation, compatibility
strategy, and rollout plan. This file defines the v1 condition model, provider
lifecycle, operator selection, bounded evaluation, aggregation, and projection
contract that OpenClaw runtimes, plugins, and hosts can build against.

Status: draft, tied to RFC 0018.

## Scope

This specification defines:

- the canonical readiness condition and result shapes;
- stable identity and reason requirements;
- required and advisory aggregation;
- the core condition namespace and baseline lifecycle conditions;
- plugin readiness-provider registration and activation lifecycle;
- operator selection of additional required or advisory criteria;
- deadlines, cancellation, coalescing, caching, and error conversion;
- HTTP, health, status, and CLI projections; and
- compatibility and conformance requirements.

This specification does not define:

- standard or custom hosting profiles;
- checkpoint durability, safe shutdown, or restore compatibility;
- arbitrary shell, network, or script probes configured by operators;
- orchestration retry intervals or restart policy; or
- telemetry sinks, dashboards, alerting, or retention.

## Terminology

- **Condition**: one bounded observation about the current runtime activation.
- **Criterion**: an enumerable condition definition that can be selected for
  evaluation.
- **Provider**: activated plugin code that implements one plugin-owned
  criterion.
- **Requirement**: whether a non-true condition blocks readiness.
- **Universal condition**: a core lifecycle condition that always participates
  and cannot be removed by operator configuration.
- **Canonical result**: the single aggregated result consumed by all readiness
  projections.
- **Projection**: an HTTP, health, status, or CLI representation of the
  canonical result; a projection is not a second evaluator.

## Compatibility And Evolution

Readiness v1 uses these compatibility rules:

- condition `type` and `reason` values are stable machine contracts;
- `message` is redacted operator guidance and is not stable machine identity;
- adding an advisory criterion is backward compatible;
- making a criterion required, or adding a new universal required condition,
  is compatibility-sensitive because it can change `200` to `503`;
- unknown optional result fields must be ignored by v1 consumers;
- legacy readiness fields remain projections during migration; and
- implementing or registering a criterion does not select it or make it
  required.

## Canonical Data Model

The canonical v1 shapes are:

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

Implementations may add optional metadata, but the fields above retain their
v1 meaning.

### Identity

Condition `type` values must be stable and unique within one result. Core uses
the public condition types defined below, such as `WorkspaceWritable`. A plugin
condition uses this namespace:

- `plugin.<plugin-id>.<criterion-id>` for plugin criteria.

Configuration selects enumerable criterion IDs. Selectable public core
criteria use `openclaw.<criterion-id>` and map to a core condition type. Not
every universal or built-in advisory condition is operator-selectable. Plugin
selectors are the same namespaced ID used by their emitted condition. Core and
plugin criterion IDs must not collide after normalization. A plugin-local ID is
trimmed, converted to lowercase, and must match
`^[a-z0-9][a-z0-9._-]*$`. Core prefixes the canonical activated plugin ID and
must reject an invalid or duplicate resulting ID. Configured selectors use the
canonical stored ID; consumers must not perform a second case-folding rule.

`reason` must describe the observed state, not repeat the criterion identity.
Provider reasons must match `^[A-Za-z][A-Za-z0-9._-]{0,127}$`. Provider messages
must be valid text of at most 512 UTF-8 bytes after redaction. Reason and message
values must not contain secrets, paths with credentials, raw exception text, or
tenant content. Core validates these bounds before caching or projection;
invalid output becomes `CriterionInvalidResult`.

### Status

- `True` means the criterion was observed and satisfied.
- `False` means the criterion was observed and not satisfied.
- `Unknown` means the criterion was selected but could not be established
  within the contract, including timeout, unavailable source state, or an
  evaluator failure.

An absent observation must never be inferred as `True`. A selected required
criterion that cannot be evaluated must be emitted as `Unknown`.

### Aggregation

Aggregation is deterministic:

| Requirement | `True` | `False` or `Unknown` |
| --- | --- | --- |
| `required` | No failure. | `ready=false`; append the stable reason to `failures`. |
| `advisory` | No advisory. | Preserve readiness; append the stable reason to `advisories`. |

The condition array must use this v1 order when present:

1. `ReadinessEvaluationComplete` when the normal evaluation cannot complete;
2. `GatewayStartupComplete`, `GatewayAcceptingWork`, `ChannelRuntimeReady`,
   `ChannelRuntimeSuppressed`, and `EventLoopHealthy`;
3. `ConfigLoaded` and `WorkspaceWritable`;
4. profile-owned conditions in the order defined by RFC 0023;
5. `GatewayResponding` and `PluginsLoaded`; and
6. remaining plugin conditions sorted by namespaced criterion ID.

`failures` and `advisories` follow condition order and contain no duplicates.

Malformed evaluator output must become a stable `Unknown` result or cause
registration/config validation to fail. It must not disappear from aggregation.

## Core Criteria

The initial public core criteria are:

| Selector ID | Condition type | Default requirement | Stable non-true reasons |
| --- | --- | --- | --- |
| Not selectable | `GatewayStartupComplete` | Universal required | `GatewayStartupPending`, `GatewayStartupNotChecked` |
| Not selectable | `GatewayAcceptingWork` | Universal required | `GatewayDraining`, `GatewayAdmissionNotChecked` |
| Not selectable | `ChannelRuntimeReady` | Universal required | `ChannelRuntimeUnavailable`, `ChannelRuntimeNotChecked` |
| Not selectable | `ChannelRuntimeSuppressed` | Advisory when present | `ChannelRuntimeSuppressed` |
| Not selectable | `EventLoopHealthy` | Advisory | `EventLoopDegraded`, `EventLoopStatusUnavailable` |
| Not selectable | `ConfigLoaded` | Universal required | `ConfigNotLoaded`, `ConfigInvalid`, `EffectiveConfigUnavailable` |
| `openclaw.workspace-writable` | `WorkspaceWritable` | Selectable | `WorkspaceMissing`, `WorkspaceStorageFull`, `WorkspaceNotWritable`, `WorkspaceProbeFailed`, `WorkspaceProbeTimedOut`, `WorkspaceNotChecked` |
| Not selectable | `PluginsLoaded` | Advisory | `PluginLoadFailures`, `PluginStatusUnavailable` |

Each condition is `True` only when the runtime observes the corresponding
startup, admission, channel, event-loop, config, workspace, or plugin predicate
described by RFC 0018. A successful condition uses a stable success reason that
normally matches its condition type.

The evaluator may emit these failure-only guard conditions:

| Condition type | Requirement | Predicate |
| --- | --- | --- |
| `ReadinessEvaluationComplete` | Required | The bounded canonical evaluation completed; otherwise `ReadinessEvaluationTimedOut` or `ReadinessEvaluationFailed`. |
| `GatewayResponding` | Required when the operation is remote | The caller reached the live Gateway; otherwise `GatewayUnavailable` or `GatewayNotChecked`. |

Implementations must preserve existing Gateway readiness behavior while these
observations are normalized. `workspace-writable` remains unselected unless an
operator or a separately accepted profile selects it.

## Plugin Readiness Providers

Only activated OpenClaw plugins may register executable provider code. Runtime
configuration may select a provider ID but must not contain callbacks, scripts,
commands, or arbitrary probe definitions.

The v1 plugin SDK contract is:

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

Registration through `api.registerReadinessCriterion` is scoped to the current
plugin activation. Core publishes the resulting ID as
`plugin.<plugin-id>.<provider-id>`.

### Provider Requirements

A provider must be:

- observational and read-only;
- idempotent under repeated invocation;
- cancellation-aware;
- safe under concurrent invocation or core coalescing;
- free of blocking synchronous I/O; and
- redacted by construction.

A provider must not mutate config, reload plugins, acquire or rotate secrets,
send model requests, change admission state, invoke tools, or alter another
condition.

Provider `reason` must match `^[A-Za-z][A-Za-z0-9._-]{0,127}$`. Provider
`message` must be non-empty after trimming, contain no NUL bytes, and be at
most 512 UTF-8 bytes after core redaction. Output that violates these rules
becomes `CriterionInvalidResult=Unknown`; no raw provider exception or
unvalidated message is projected.

### Activation Lifecycle

The registered provider set is bound to one activation-pinned plugin registry
and effective config snapshot. Plugin or config reload publishes replacement
snapshot identities. Publication aborts in-flight callbacks from the prior
generation, invalidates their cached results, and prevents late settlement from
entering the active result. Core must keep retained state bounded when a
callback ignores cancellation; an abandoned callback must not retain an active
registry or become selectable after replacement.

Provider descriptors must be enumerable without invoking callbacks. At minimum
the active registry entry contains the namespaced ID, description, owning
plugin, and source. The registry snapshot identity is the activation-generation
boundary; a future projection may expose the descriptor catalog without
executing providers.

## Operator Selection

Universal conditions always apply. Operators may select additional registered
core or plugin criteria without selecting a hosting profile:

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

Selection uses namespaced criterion IDs. The same ID must not appear in both
lists. Configuration validates selector syntax. A syntactically valid selected
ID absent from the active registry produces `CriterionNotRegistered=Unknown`
with the requirement of its containing list. Unknown IDs must never be silently
ignored.

Registration alone does not activate a plugin criterion. Only explicitly
selected criteria participate: `advisoryCriteria` selects them as advisory and
`requiredCriteria` selects them as required. Operator selection may strengthen
a selectable criterion from advisory to required but must not weaken universal
required conditions.

## Bounded Evaluation

Readiness is a hot operational path and must complete within code-owned bounds.
The initial v1 limits are:

- one second per plugin provider;
- one second for the workspace observation;
- concurrent evaluation of independent observations; and
- an independent two-second outer deadline for the complete result.

Core owns deadlines, cancellation, coalescing, caching, error conversion, and
result ordering. A timed-out criterion becomes `Unknown` with a stable timeout
reason. Unexpected exceptions become `Unknown`; raw exception text is not
copied into public output.

Universal core observations consume already-owned runtime snapshots and must
not perform request-time network I/O. Plugin providers should report from
asynchronously refreshed local state when an observation can exceed the normal
probe path. Blocking synchronous work is invalid even though the outer watchdog
bounds cooperative asynchronous work.

Plugin-provider failures use these core-owned reasons:

- `CriterionNotRegistered` when a selected provider is unavailable;
- `CriterionInvalidResult` when output violates the provider result shape;
- `CriterionTimedOut` when the provider exceeds its deadline; and
- `CriterionCheckFailed` when invocation throws or rejects.

If the outer deadline expires, the evaluator must return a required
`ReadinessEvaluationComplete=Unknown` condition with reason
`ReadinessEvaluationTimedOut`. The HTTP request must not hang or reject.

Core retains ownership of an invocation after its deadline. If a provider
ignores cancellation and remains pending, later polls reuse the stable timeout
result and must not start another invocation. A new invocation may start only
after the prior callback settles and the cache expires.

Successful and failed provider or workspace observations may be cached for at
most five seconds. Replacement effective-config or plugin-registry snapshots,
effective workspace identity, or selected-criterion changes invalidate affected
entries immediately. Admission, drain, startup, channel, and event-loop
snapshots are not made stale by this cache. A late result from an invalidated
generation is discarded.

## Projections

All projections consume the same canonical result.

### HTTP

- `/ready` and `/readyz` are authoritative readiness probes.
- A ready result returns `200`; a non-ready result returns `503`.
- `HEAD` compatibility remains unchanged.
- Authenticated or local callers may receive the structured result.
- Unauthenticated remote callers receive only a compact redacted response.
- `/health` and `/healthz` remain shallow liveness probes and do not acquire
  readiness semantics.

### Health And Status

Gateway health and status project the canonical result or a bounded summary of
it. A surface that did not observe a required live fact reports `Unknown`; it
must not synthesize success. Descriptor enumeration must not execute providers.

### CLI

An `openclaw ready` command, when implemented, is a client of the live Gateway
result:

- human output lists non-true conditions;
- `--json` preserves the canonical result; and
- exit status is nonzero for required failure, required unknown, transport
  failure, or absence of a supported readiness contract.

The CLI must not implement condition evaluation independently.

## Legacy Projection

Existing `ready`, `failing`, `suppressed`, `eventLoop`, and `uptimeMs` fields
remain compatibility projections during migration. Implementations must first
emit canonical conditions beside legacy fields, then move every surface to the
canonical evaluator. Legacy removal requires a separate compatibility review.

## Conformance Checklist

An implementation conforms to readiness v1 when it proves:

- existing unconfigured readiness behavior is unchanged;
- universal startup, admission, and selected-channel failures return `503`;
- additional criteria do not become required without explicit selection;
- required `False` and `Unknown` return `503`;
- advisory `False` and `Unknown` remain visible while returning `200` when all
  required conditions are true;
- provider timeout, exception, malformed output, and ignored cancellation all
  return within the outer deadline;
- cache entries expire within five seconds and invalidate on relevant config,
  workspace, selection, and plugin-generation changes;
- reload atomically replaces provider descriptors and callbacks, discards late
  results, and remains bounded across repeated never-settling providers;
- unknown selected criteria fail closed;
- `/ready`, `/readyz`, health, status, and CLI do not disagree about the same
  observed activation; and
- public output contains no raw exceptions, secrets, credentials, or tenant
  content.
