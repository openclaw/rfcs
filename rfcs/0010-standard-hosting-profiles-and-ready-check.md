---
title: Readiness Conditions and Standard Hosting Profiles
authors:
  - Gio
created: 2026-07-09
last_updated: 2026-07-10
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/33
---

# Proposal: Readiness Conditions and Standard Hosting Profiles

## Summary

Add a canonical readiness-condition model and project one result through
Gateway `/ready`, `/readyz`, health, and status. Normalize existing fixed
Gateway signals into core conditions, let plugins publish additional conditions
through readiness providers, and let standard hosting profiles compose
conditions into named, OpenClaw-owned, release-tested support contracts. The
condition model is independently useful without selecting a non-default
profile, and profiles do not add a second config system, generate config, or
replace existing Gateway readiness.

## Motivation

OpenClaw can be hosted today and already exposes Gateway `/ready` and `/readyz`.
Those probes cover Gateway startup, channel runtime health, drain state, and
event-loop health. What they do not identify is the selected hosting model or
the config/runtime predicates that make that model supportable. Hosts therefore
cannot answer one higher-level question before routing traffic:

```text
Is this OpenClaw instance ready under the hosting profile it was started with?
```

Today this readiness surface is a purpose-built, Gateway-owned evaluator over a
fixed set of lifecycle signals. It is not a general readiness framework:
plugins cannot register readiness callbacks, operators cannot enumerate or
compose reusable criteria, and releases do not validate named hosting profiles.
This RFC preserves the existing evaluator as an authoritative required input
and adds a provider and composition contract around it:

```text
existing fixed Gateway readiness
+ standard-profile conditions
+ plugin-provider conditions
-> canonical /ready and /readyz result
```

The proposal does not move existing lifecycle checks into plugins or permit a
profile to weaken, replace, or bypass them.

Without that contract, downstream hosts compensate with private startup checks,
baked config, environment restore lists, persistence wrappers, and adapter-only
readiness logic. That makes hosted OpenClaw harder to test upstream and harder
to upgrade downstream.

A concrete example is a container that starts successfully with a loopback-only
Gateway. Existing lifecycle readiness can correctly report that the process is
healthy while the selected container topology is unusable from outside the
container. The missing information is not another liveness probe; it is the
runtime assertion that this process satisfies the container support contract.

Profiles turn the broad claim "OpenClaw supports hosted deployments" into a
reviewable support matrix and a supportable subset that issues can be validated
against:

```text
OpenClaw supports these profiles.
Each profile has stable readiness conditions.
Each release can test those conditions.
Hosts can prove which profile they are running.
```

This gives bug reports and release tests a reproducible starting point. Instead
of debugging an unbounded hosted configuration, maintainers can ask for the
selected profile and its stable condition result. Profiles complement maturity
work by turning a support claim into executable release evidence.

### Evidence From Existing Issues

The proposal generalizes recurring operator failures already reported against
OpenClaw. The issues ask for truthful readiness under additional runtime facts;
they do not require each fact to introduce a new hosting profile.

| Issue | Observed gap | Contract implication |
| --- | --- | --- |
| [openclaw#96084](https://github.com/openclaw/openclaw/issues/96084) | `/readyz` remains healthy when a PVC-backed workspace is full and writes fail with `ENOSPC`. | Workspace writability should be an observable status fact with a stable readiness condition. |
| [openclaw#78136](https://github.com/openclaw/openclaw/issues/78136) | Docker health and readiness remain healthy while the command queue is draining and rejects model work. | Admission/drain state must participate in required readiness, not only process liveness. |
| [openclaw#73652](https://github.com/openclaw/openclaw/issues/73652) | The Gateway accepts connections before internal startup is ready. | Readiness must represent the actual startup admission boundary. |
| [openclaw#78954](https://github.com/openclaw/openclaw/issues/78954) | Channel/plugin sidecars can block reaching a usable core Gateway state. | Conditions need required versus advisory classification. |
| [openclaw#43886](https://github.com/openclaw/openclaw/issues/43886) | A Docker Gateway configured for LAN still listens on loopback. | Container readiness must evaluate effective bind state rather than configured intent alone. |

Other reports show the same need at additional projections: systemd can declare
the service started before Gateway readiness
([openclaw#66512](https://github.com/openclaw/openclaw/issues/66512)), and a
channel can report healthy while retrying a fatal login error
([openclaw#101083](https://github.com/openclaw/openclaw/issues/101083)). One
canonical condition result lets HTTP probes, status, service managers, and
future telemetry consume the same runtime truth.

## Goals

- Define built-in hosting profiles for `local`, `container`, `reverse-proxy`,
  and `node-mode`.
- Make `local` the default profile when no profile is selected.
- Add a canonical readiness result with stable condition `type`, `status`,
  `reason`, and human-readable `message`.
- Expose the same readiness result through existing HTTP readiness, status, and
  health surfaces.
- Add explicit profile selection through config, environment, and Gateway
  startup.
- Keep OpenClaw generic: no Lobster, Scout, Microsoft, tenant, Teams, Kusto, or
  product-specific host concepts.
- Keep the first implementation in core so readiness works without optional
  plugins.
- Define the requirement class, exact truth predicates, and stable non-ready
  reasons for every built-in profile condition.
- Let plugins register namespaced advisory criteria through the existing plugin
  lifecycle, and let operators promote them only through additive custom
  profiles.
- Make readiness providers enumerable and self-describing so status, operators,
  and future doctor tooling can discover the active criterion catalog.
- Leave room for later doctor/lint conformance findings that recommend fixes
  for config that does not match the selected built-in profile.

## Non-Goals

- Replace `openclaw.json`.
- Define OCC resources or require OCC before hosted readiness works.
- Define the remote AgentHarness event protocol.
- Standardize a host's storage backend, auth provider, telemetry sink, tenant
  routing, UI, deployment system, or worker-pool model.
- Put assistant deltas, tool frames, approvals, patches, compaction events, or
  harness protocol frames into the hosting contract.
- Allow arbitrary operator-defined conditions to redefine built-in profile
  semantics or built-in condition names.
- Encode host-specific probe intervals, retries, start periods, or timeout
  values into OpenClaw profile config.
- Make readiness depend on doctor, lint, policy, or another optional
  conformance layer.

## Proposal

The RFC has two pieces that can be reviewed together or split if maintainers
prefer:

1. Standard hosting profiles: named support contracts for the OpenClaw runtime.
2. A canonical ready check: a host-facing pass/fail surface for the selected
   profile.

These pieces compose but are separable. The canonical condition/result model
is useful without adding any non-default profile. A generally required runtime
invariant, such as accepting work rather than draining, can extend existing
Gateway readiness. A new OpenClaw-owned fact, such as workspace writability,
can add a criterion to the existing `local` contract inherited by the hosted
profiles. Neither change requires defining a new profile.

A new profile is justified only when OpenClaw wants to name and release-test a
distinct support posture that selects a different composition or requirement
class for existing criteria. Profiles organize readiness criteria into support
contracts; they are not the extension mechanism for every readiness fix.

OpenClaw should expose a standard hostee contract:

```text
profile selection
+ runtime status/config facts
+ readiness condition evaluation
-> ready/not-ready result
```

Five constraints keep this narrow:

1. A profile does not write, merge, or repair configuration.
2. Operators may continue to configure every OpenClaw setting directly.
3. Profile readiness is an additional conjunction with existing Gateway
   readiness, never a replacement for it.
4. Built-in profiles evaluate facts owned by OpenClaw core. Plugins may publish
   advisory namespaced criteria; only an operator-defined profile can make one
   required. Policy and doctor may consume the result but are not dependencies.
5. Only required conditions affect the binary ready result. Advisory conditions
   remain visible without turning a useful diagnostic into an outage.

The contract is not a parallel hosted config tree. Existing OpenClaw config
continues to own Gateway, proxy, plugin, model, session, node, and state
behavior. A hosting profile decides which existing runtime status/config facts
must be true before the instance is considered ready. If a criterion needs a
fact that status does not expose yet, the implementation should add that
missing status field. Plugin-owned dependencies use the readiness registration
contract below rather than a host-specific endpoint or global evidence store.

### Standard profiles

OpenClaw should ship a small catalog of standard profile definitions rather
than ask every host to invent one. Operators can still configure the underlying
OpenClaw settings; the profile names the support contract. These profiles are
implemented in core, which is why the schema calls their ids "built-in," but
their product role is to be OpenClaw's documented and release-gated standard
profiles.

A profile names the expected ingress/runtime posture, not the packaging
technology. A Gateway directly reachable through its container listener uses
`container`. A Gateway in a container behind a trusted identity proxy uses
`reverse-proxy`. New profile names should be added only when they define a
distinct OpenClaw-owned invariant and conformance scenario.

Profiles should be declarative compositions of reusable readiness criteria. A
built-in profile references reserved OpenClaw condition ids. Each criterion
is a named rule over OpenClaw runtime status/config fields and has one
OpenClaw-owned evaluator that emits the runtime readiness condition.

| Profile | Purpose | Built-in criteria | Status fields read | Emitted readiness signals |
| --- | --- | --- | --- | --- |
| `local` | Developer/local foreground process readiness. | `ConfigLoaded`, `WorkspaceWritable`, `GatewayResponding`, `PluginsLoaded` | config load, effective default workspace write evidence, Gateway reachability, selected plugin activation status | Required: `ProfileSelected`, `ConfigLoaded`, `WorkspaceWritable`, `GatewayResponding`. Advisory: `PluginsLoaded`. |
| `container` | One OpenClaw service hosted by Docker, Compose, or a similar supervisor. | `local` + `ContainerStateReady` | effective Gateway mode, resolved bind host, and port | Core signals plus `ContainerStateReady`. |
| `reverse-proxy` | Gateway running behind a trusted reverse proxy. | `local` + `TrustedProxyReady` | Gateway trusted-proxy auth config | Core signals plus `TrustedProxyReady`. |
| `node-mode` | Gateway/controller for one or more controlled execution nodes. | `local` + `NodePairingReady`, `ControlledTargetsReady`, `CommandApprovalReady`, `ControlChannelReady` | pairing store, live node registry, paired command grants, `gateway.nodes.allowCommands` | Core signals plus the four node-mode conditions. |

`node-mode` must stay product-neutral. A controlled target can be a desktop,
sandbox, VM, pod, browser, or another execution surface. OpenClaw should not
assume one node maps to exactly one target.

### Built-in truth predicates

Profile readiness is composed with, and does not replace, the existing Gateway
readiness result. Final `/ready` and `/readyz` readiness is true only when the
existing startup/channel/drain/event-loop evaluation is ready and every
required condition listed for the selected profile is `True`. `False` and
`Unknown` required conditions block profile readiness. Non-`True` advisory
conditions are reported but do not change the binary result.

The condition contract and aggregation rules are shared across surfaces; the
observed status may differ with probe depth and observation time. A status
surface that did not observe a required fact reports `Unknown` and cannot claim
ready. A status operation that successfully probes the Gateway may project that
observation as `True`. Missing required evidence must never become a positive
readiness result.

| Condition | Requirement | True when | Stable non-ready reasons |
| --- | --- | --- | --- |
| `GatewayStartupComplete` | Required | Gateway startup dependencies and startup sidecars are no longer pending. | `GatewayStartupPending` |
| `GatewayAcceptingWork` | Required | The Gateway is not draining and can admit new work. | `GatewayDraining` |
| `ChannelRuntimeReady` | Required | No selected channel has an unsuppressed runtime-health failure under the existing channel readiness policy. | `ChannelRuntimeUnavailable` |
| `EventLoopHealthy` | Advisory | The existing event-loop health observation is within its healthy threshold. It remains advisory unless a separate compatibility-reviewed change intentionally makes it gate readiness. | `EventLoopDegraded`, `EventLoopStatusUnavailable` |
| `ProfileSelected` | Required | The runtime resolved and reports the selected built-in or configured custom profile. The default is `local`. | None; invalid explicit values fail selection before startup. |
| `ConfigLoaded` | Required | Runtime configuration loaded successfully. | `ConfigNotLoaded` |
| `WorkspaceWritable` | Required for all built-in profiles | The running Gateway resolves the effective default-agent workspace and completes a write, flush, and cleanup probe. The probe is cached and coalesced so readiness polling does not cause unbounded filesystem work. Non-probing command fallbacks do not invent positive evidence. | `WorkspaceStorageFull`, `WorkspaceNotWritable`, `WorkspaceProbeFailed`, `WorkspaceProbeTimedOut`, `WorkspaceNotChecked` |
| `GatewayResponding` | Required | The running Gateway is evaluating its own readiness request, or the current status/health operation successfully probed that Gateway. | `GatewayUnavailable`, `GatewayNotChecked` |
| `PluginsLoaded` | Advisory | The Gateway-pinned plugin registry is available and every selected plugin has no activation error. Explicitly disabled plugins do not report an advisory. | `PluginLoadFailures`, `PluginStatusUnavailable` |
| `ContainerStateReady` | Required for `container` | The effective Gateway mode is `local` and the resolved listener host is not loopback. The port has already passed normal config validation. Config-only status reports `Unknown` when an `auto` bind has not been resolved. | `ContainerGatewayRemote`, `ContainerGatewayLoopback`, `ContainerBindNotResolved` |
| `TrustedProxyReady` | Required for `reverse-proxy` | Auth mode is `trusted-proxy`, `trustedProxy.userHeader` is non-empty, and `gateway.trustedProxies` contains at least one address/CIDR. Loopback is valid for a same-host proxy. | `TrustedProxyAuthMissing`, `TrustedProxyHeaderMissing`, `TrustedProxySourcesMissing` |
| `NodePairingReady` | Required for `node-mode` | The pairing store is readable and contains at least one approved pairing. | `NodePairingUnavailable`, `NodePairingPending`, `NodePairingMissing` |
| `ControlledTargetsReady` | Required for `node-mode` | The live Gateway node registry contains at least one connected node whose id is approved in the pairing store. Persisted pairing alone is insufficient. | `ControlledTargetsDisconnected` |
| `CommandApprovalReady` | Required for `node-mode` | A connected paired node advertises at least one command that is granted by pairing or `gateway.nodes.allowCommands` and not removed by `gateway.nodes.denyCommands`. A deny-only list is not approval evidence. | `CommandApprovalMissing` |
| `ControlChannelReady` | Required for `node-mode` | At least one connected node session is correlated to an approved pairing. Gateway HTTP responsiveness alone is insufficient. | `ControlChannelUnavailable` |

### Profile selection

OpenClaw should not require an explicit profile to run. If no profile is
selected, the effective profile is `local`.

Profile selection should be visible in normal hosting mechanisms:

- config: `hosting.profile`
- environment: `OPENCLAW_HOSTING_PROFILE`
- startup: `openclaw gateway run --hosting-profile <profile>`

Built-in ids are closed, while operator profiles are additive and namespaced:

```ts
type BuiltInHostingProfileId =
  | "local"
  | "container"
  | "reverse-proxy"
  | "node-mode";

type OperatorHostingProfile = {
  extends: BuiltInHostingProfileId;
  requiredCriteria?: string[];
  advisoryCriteria?: string[];
};

type HostingConfig = {
  profile?: string;
  profiles?: Record<string, OperatorHostingProfile>;
};

type OpenClawConfig = {
  hosting?: HostingConfig;
  // Existing OpenClaw fields remain unchanged.
};
```

`hosting` and each profile definition are strict objects. Operator profile names
must match `<namespace>/<name>` using lowercase alphanumeric DNS-label-like
segments. A selected custom profile must exist in `hosting.profiles`. Each
custom profile extends exactly one built-in profile and can only add criteria;
it cannot remove or demote inherited requirements. A criterion cannot be both
required and advisory in the same profile.

The environment variable and startup flag accept built-in ids or a namespaced
custom id. Runtime resolution validates a custom id against the loaded config.
The `local` default is resolved at runtime and does not need to be persisted.

Selection precedence is deterministic:

```text
gateway startup flag > environment > openclaw.json > local default
```

An invalid value from any explicitly supplied source is a startup/config error;
it must not silently fall through to a lower-priority source or to `local`.
The effective value after precedence resolution is the profile reported by all
readiness and status surfaces.

The selected profile should be reported in `/ready`, `/readyz`, `status --json`,
and Gateway health so hosts and release tests can assert that the running
process selected the intended profile. A later optional CLI wrapper can add an
`openclaw ready --expect-profile <profile>` assertion if maintainers want that
ergonomic surface, but it is not required for the first contract.

### Ready result

Readiness should use Kubernetes-style conditions:

```ts
type CoreReadinessCriterionId =
  | "GatewayStartupComplete"
  | "GatewayAcceptingWork"
  | "ChannelRuntimeReady"
  | "EventLoopHealthy"
  | "ProfileSelected"
  | "ConfigLoaded"
  | "WorkspaceWritable"
  | "GatewayResponding"
  | "PluginsLoaded"
  | "ContainerStateReady"
  | "TrustedProxyReady"
  | "NodePairingReady"
  | "ControlledTargetsReady"
  | "CommandApprovalReady"
  | "ControlChannelReady";

type HostingReadinessConditionType =
  | CoreReadinessCriterionId
  | (string & {});

type HostingReadinessCondition = {
  type: HostingReadinessConditionType;
  status: "True" | "False" | "Unknown";
  requirement: "required" | "advisory";
  reason: string;
  message: string;
};

type HostingReadinessResult = {
  profile: string;
  ready: boolean;
  conditions: HostingReadinessCondition[];
  failures: string[];
  advisories: string[];
};
```

Every field in `HostingReadinessResult` is required whenever the result is
present; empty `conditions`, `failures`, or `advisories` are serialized as empty
arrays rather than omitted. Built-in condition types and the stable reasons in
the truth-predicate table are reserved by OpenClaw. Plugin criteria are
namespaced by core as `plugin.<plugin-id>.<local-id>`.

```jsonc
{
  "profile": "container",
  "ready": false,
  "conditions": [
    {
      "type": "ProfileSelected",
      "status": "True",
      "requirement": "required",
      "reason": "ProfileSelected",
      "message": "Runtime selected the container hosting profile."
    },
    {
      "type": "GatewayResponding",
      "status": "False",
      "requirement": "required",
      "reason": "GatewayUnavailable",
      "message": "Gateway did not respond to the readiness request."
    }
  ],
  "failures": ["GatewayUnavailable"],
  "advisories": []
}
```

Hosts and tests should key on `type`, `status`, `requirement`, and `reason`.
`failures` is the deduplicated set of non-`True` required-condition reasons.
`advisories` is the set of non-`True` advisory-condition reasons. Existing
Gateway startup, drain, channel, and event-loop observations are projected into
the same canonical condition model rather than remaining a permanent parallel
readiness system. `message` is for operators and should remain non-normative.

`conditions` has map semantics keyed by `type`; a built-in result contains at
most one condition of each type, and consumers must not depend on array order.
`failures` and `advisories` have deduplicated set semantics, and their order is
not contractual. Condition and reason identity is stable; `message` wording is
not.

The object above is the one canonical public result. Transports may embed or
flatten that object exactly once, but implementations must not serialize a
second nested copy that gives consumers another contract or source of drift.

### Transport projections

The existing HTTP readiness envelope remains backward compatible:

```ts
type DetailedGatewayReadyResponse = HostingReadinessResult & {
  // Existing Gateway readiness fields.
  ready: boolean;
  failing: string[];
  suppressed?: string[];
  uptimeMs: number;
  eventLoop?: GatewayEventLoopHealth;
};

type ReadinessEvaluationErrorResponse = {
  ready: false;
  failing: ["internal"];
  uptimeMs: 0;
};

type RedactedRemoteReadyResponse = {
  ready: boolean;
};

type GatewayReadyHttpBody =
  | DetailedGatewayReadyResponse
  | ReadinessEvaluationErrorResponse
  | RedactedRemoteReadyResponse;
```

For local or authenticated detailed `GET /ready` and `GET /readyz` requests,
the canonical fields are flattened once into this existing Gateway envelope.
`ready` is true only when every required core, profile, and selected provider
condition is `True`. `failing` and `suppressed` remain compatibility projections
of the normalized Gateway lifecycle/channel conditions; new consumers should
use `conditions`, `failures`, and `advisories`. HTTP is `200` when `ready` is
true and `503` otherwise. `HEAD` returns the same status without a body.
Unauthenticated remote probes retain the redacted shape `{ "ready": boolean }`
and do not disclose condition details.

Normalization must preserve current behavior. Startup-pending, draining, and
unsuppressed channel failures remain required and continue to make readiness
false. Existing event-loop health is initially advisory because the current
evaluator reports it diagnostically without changing `ready`. Changing that
requirement class later requires compatibility review and release coverage.

If readiness evaluation itself throws before it can produce the canonical
object, the existing detailed fail-closed response is
`{ "ready": false, "failing": ["internal"], "uptimeMs": 0 }`; an
unauthenticated remote caller still receives only `{ "ready": false }`. This
exception envelope is not a second readiness model and must never report ready.

Gateway health and `status --json` embed the canonical object once:

```ts
type HealthReadinessProjection = {
  readiness?: HostingReadinessResult;
};

type StatusReadinessProjection = {
  readiness: HostingReadinessResult;
};
```

The optional health field preserves existing observation-depth and
compatibility behavior. A surface that cannot authoritatively observe required
runtime evidence must omit the result or report the affected condition as
`Unknown`; it must never invent a positive observation. When `readiness` is
present, all five canonical fields are required. Text status is a human summary
of this object and is not a separate machine-readable schema.

### Compatibility and operational cost

No explicit selection is required. Existing installations resolve to `local`,
and their Gateway/session/plugin configuration remains unchanged. Selecting a
profile does not enable auth, change bind addresses, install plugins, move
state, or provision nodes. It only changes which runtime-owned facts must be
true for profile readiness.

Plugin activation errors are advisory in the default profile. They remain
visible through stable conditions and the `advisories` list without changing an
existing healthy readiness response from 200 to 503. Explicitly disabled
plugins do not report an advisory.

This keeps the operational contract familiar to container hosts:

```text
host supplies config and selects a supported runtime shape
OpenClaw starts using its normal config semantics
host waits for the existing readiness endpoint
readiness explains both lifecycle and profile conformance
```

Hosts that do not set a profile retain the existing endpoints and configuration
model, with `local` as the reported and evaluated support contract.

### Why this belongs in core

Doctor can explain or repair static misconfiguration, and policy can restrict
what configuration is allowed. Neither is the right owner for a workload's
live readiness contract: both are optional, while `/ready` is consumed during
startup and continuously by supervisors. Core already owns the authoritative
Gateway, plugin, proxy, pairing, and live-node facts used here. The smallest
reliable implementation is therefore a projection over those facts at the
existing core readiness boundary.

Keeping the predicates in core also makes the support promise testable in the
OpenClaw release matrix. Downstream hosts remain responsible for tenant routing,
deployment, storage destinations, telemetry backends, and product policy.

### Extensible criteria and operator profiles

Built-in profile conditions remain stable and OpenClaw-owned. Operators cannot
redefine what `local`, `container`, or `node-mode` means. They can define a
namespaced profile that extends one built-in profile and adds reusable built-in
or plugin criteria.

Plugins register self-describing observed-state providers during normal
activation:

```ts
type PluginReadinessResult = {
  status: "True" | "False" | "Unknown";
  reason: string;
  message: string;
};

type PluginReadinessProvider = {
  id: string;
  description: string;
  check: (context: {
    config: OpenClawConfig;
    pluginConfig: unknown;
    signal: AbortSignal;
  }) => Promise<PluginReadinessResult> | PluginReadinessResult;
};

type RegisterReadinessCriterion = (
  provider: PluginReadinessProvider,
) => void;

api.registerReadinessCriterion({
  id: "backend",
  description: "Reports whether the plugin backend can accept work.",
  check: async ({ config, pluginConfig, signal }) => {
    // Return PluginReadinessResult.
  },
});
```

`registerReadinessCriterion` is available to an activated OpenClaw plugin
through its normal `OpenClawPluginApi`. Registration installs the descriptor and
callback into the Gateway-pinned registry for that plugin activation. Core
criteria use internal core evaluators; operators, host config, and OCC do not
register executable callbacks. They only select profiles and reference full
provider ids.

The `check` member is the provider callback. The Gateway readiness evaluator
invokes it asynchronously with the effective OpenClaw config, that plugin's
resolved config, and an `AbortSignal`. The callback returns one observed
condition result. Core validates and namespaces the result before adding it to
the canonical readiness projection.

The registration is a readiness provider: a lifecycle-owned producer with a
stable identity, owner, description, and bounded evaluator. Core owns
namespacing, lifecycle, enumeration, timeout, caching, coalescing,
invalid-result, error, and missing-registration behavior. Registrations live in
the existing Gateway-pinned plugin registry, so plugin load rollback and reload
replace the provider with the rest of that registry. There is no process-global
hosting registry and no downstream-specific publication path.

The active provider catalog is enumerable from that pinned registry. Detailed
readiness and status expose each evaluated provider through its canonical
condition type; future doctor or administrative surfaces may list the same
descriptor catalog without inventing another registration mechanism. Provider
identity is the namespaced condition type. Plugin-owned reasons must be stable
within that identity, and messages are non-normative and must not contain
credentials, tokens, personal data, or thrown error details.

Every active plugin provider is evaluated and reported as advisory by default,
even when the selected profile does not reference it. Installing a plugin may
therefore add advisory conditions, but cannot make an otherwise ready built-in
profile unready. A plugin cannot choose its requirement class. An operator
promotes a criterion by listing its full id in a custom profile's
`requiredCriteria`. A required criterion that is absent, times out, throws, or
reports `False` or `Unknown` blocks readiness. An absent selected criterion
emits `Unknown` with `CriterionUnavailable`. Plugin failures use generic
messages so readiness does not expose thrown error details.

The initial implementation evaluates registered checks concurrently, supplies
an `AbortSignal`, uses a one-second deadline, and caches/coalesces each result
for five seconds. These mechanics are core-owned rather than profile-authored
numeric values.

A provider check is an observational probe, not a lifecycle or repair hook. It
must be read-only, idempotent, safe under concurrent and repeated invocation,
avoid blocking synchronous I/O, and honor the supplied `AbortSignal`. It must
not start dependencies, rewrite config, repair state, or emit durable audit
claims. The cache duration bounds how stale a reported observation may be; a
cached result is not historical or audit-grade evidence.

### Evaluation budgets and fail-closed behavior

Every readiness condition must have a bounded evaluation strategy in code. A
condition may read an already-owned in-memory snapshot, perform a finite pass
over configured runtime state, or use a core-owned timeout and cache. It must
not introduce unbounded readiness-path I/O.

| Condition family | Code-owned bound |
| --- | --- |
| Startup, drain, Gateway response, config, profile, proxy, and event-loop conditions | Constant-time reads over existing runtime/config snapshots. |
| Channel runtime | One finite pass over the current in-memory channel snapshot, cached for one second. |
| Workspace writability | One-second hard timeout with five-second cache/coalescing. |
| Node mode | Pairing snapshot cached for one second; live sessions and command policy are finite in-memory passes. A later event-driven pairing snapshot may remove readiness-time storage reads entirely. |
| Plugin providers | All providers run concurrently; each has a core-enforced one-second `Promise.race` deadline and five-second cache/coalescing. The deadline does not depend on the callback honoring cancellation. |
| Complete readiness evaluation | Independent two-second outer watchdog around workspace, provider, and node evaluation, which run concurrently. |

Timeout, throw, invalid result, or missing registration becomes `Unknown` with a
stable reason. It blocks readiness when required and remains visible without
blocking when advisory. If the complete evaluation exceeds its outer deadline,
the existing HTTP exception path returns `503` and never reports ready.

An in-process timer cannot interrupt JavaScript that synchronously blocks the
Node.js event loop. Core evaluators therefore use bounded snapshot work, and the
plugin contract forbids blocking synchronous I/O or computation. Stronger
isolation against a malicious plugin would require worker/process execution and
is outside this RFC; it is not implied by `AbortSignal`.

### Profile inheritance and support ownership

In v1, every operator profile extends exactly one standard profile and inherits
all of its required and advisory criteria. It may add requirements, but cannot remove,
replace, or demote the inherited contract. This gives custom hosting models a
known OpenClaw support baseline instead of allowing each operator to redefine
what a healthy Gateway means.

Support ownership follows the composition:

- OpenClaw owns, documents, and release-tests each standard profile and its
  inherited criteria.
- An extended profile retains that OpenClaw-tested baseline. A failure in an
  inherited criterion can be reproduced against and supported as the built-in
  profile it extends.
- The plugin or operator owns added provider semantics and the additional
  support promise made by the extended profile. OpenClaw does not certify an
  arbitrary downstream composition merely because it inherits a built-in.

A namespaced profile is therefore still an operator's own profile. Requiring
`extends` in v1 gives the first implementation a known release-tested baseline.
A later revision may allow an operator profile to compose its own provider set
without extending a standard profile. Such a profile would be operator-owned
and would still be conjoined with universal Gateway lifecycle readiness; custom
composition must never replace or bypass core startup, drain, channel, or
event-loop readiness.

Built-in profile names and condition names remain reserved. Operators configure
the underlying OpenClaw settings; they do not redefine built-in semantics.

`node-mode` requires at least one approved, connected, controllable target. It
does not prove that every target desired by OCC or a host platform is present;
desired fleet cardinality remains a control-plane concern. Pairing snapshots
used by frequent readiness probes should be briefly cached or event-driven,
while live node sessions and current command policy are evaluated on each
observation.

Condition identity and requirement class are part of the support contract.
Changing an advisory condition to required, adding a new required condition to
an existing profile, or changing a stable reason can alter host behavior and
must receive compatibility review, release notes, and profile conformance
coverage. New diagnostics should default to advisory unless failure means the
named runtime shape cannot perform its supported role.

Built-in profiles also should not encode host-specific numeric probe values.
Intervals, retries, start periods, and timeouts belong in Docker, Compose,
Kubernetes, systemd, Nomad, ECS, or another host manifest. OpenClaw can document
recommended host manifests, and a later doctor/lint conformance pass can emit
findings and fix recommendations when config does not match the selected
profile, but core `/ready` should not depend on that optional repair path.

### OCC and AgentHarness alignment

This RFC does not conflict with OCC or the remote AgentHarness RFC. OCC can
compile declarative desired state into OpenClaw config, selected profile, and
host policy. The runtime plane still owns readiness evaluation, channel ingress,
session routing, cell supervision, and AgentHarness event streams.

In that model:

```text
OCC/control plane: desired state, tenant identity, admission, restrictions,
quotas, policy compilation, provisioning, audit indexing.

OpenClaw/runtime plane: startup, Gateway, sessions, cells/nodes, harness
execution, runtime status fields, ready/not-ready projection.
```

OCC should not be in the hot path for assistant deltas, tool events, approvals,
patches, compaction events, or harness protocol frames.

### Implementation branches

The initial implementation is being prepared as draft branches in the OpenClaw
fork before upstream OpenClaw PRs are opened. The first slice normalizes the
existing Gateway startup, drain, channel, and event-loop outputs into core
conditions before adding profile-specific conditions:

| Slice | Fork PR | Branch |
| --- | --- | --- |
| Core conditions and local profile | https://github.com/giodl73-repo/openclaw/pull/17 | `user/giodl/hosting-ready-local` (`1bb6bfd5`) |
| Standard profile selection and predicates | https://github.com/giodl73-repo/openclaw/pull/18 | `user/giodl/hosting-profile-selection` (`a7cba836`) |
| Node-mode readiness | https://github.com/giodl73-repo/openclaw/pull/19 | `user/giodl/hosting-node-mode-readiness` (`ca8ab296`) |
| Workspace writability readiness | https://github.com/giodl73-repo/openclaw/pull/22 | `user/giodl/hosting-workspace-readiness` (`781df835`) |
| Readiness providers and operator profiles | https://github.com/giodl73-repo/openclaw/pull/23 | `user/giodl/hosting-readiness-registry` (`07c6aae3`) |
| Release conformance gate | https://github.com/giodl73-repo/openclaw/pull/21 | `user/giodl/hosting-profile-release-conformance` (`b0974bb7`) |

The stack includes one package-installed Docker conformance lane,
`pnpm test:docker:hosting-profiles`, built incrementally across the runtime
branches and promoted into blocking package-acceptance release checks by the
sixth branch:

- PR 17 normalizes startup, drain, channel, and event-loop observations into
  core conditions, proves an unset profile defaults to `local`, and preserves
  the legacy readiness fields while canonical aggregation drives HTTP status.
- PR 18 proves a LAN-bound `container` profile returns 200 and a loopback-bound
  `container` profile returns 503 with `ContainerGatewayLoopback`. It also
  proves a configured trusted-proxy posture returns 200 for `reverse-proxy`
  while token auth returns 503 with `TrustedProxyAuthMissing`, and projects the
  canonical result into Gateway health without a duplicate nested payload.
- PR 19 starts a real node host and proves `node-mode` transitions from 503 to
  200 only after approved pairing, a correlated live target, an advertised
  approved command, and a connected control channel are all observed.
- PR 22 adds `WorkspaceWritable` to every built-in profile without defining a
  new profile or changing the HTTP probe implementation. Its Docker scenario
  fills a workspace `tmpfs` to `ENOSPC`, expects 503 with
  `WorkspaceStorageFull`, removes the fill file, and expects recovery to 200
  without restarting OpenClaw.
- PR 23 adds activation-scoped, self-describing, enumerable readiness providers
  and additive operator profiles while preserving standard-profile requirements
  and canonical `/ready` projection.
- PR 21 selects that packaged profile matrix in the non-advisory release
  workflow, preserving its targeted plan, log, timing, and summary artifacts.

PR 21 validation confirms the release workflow selects `hosting-profiles`, the
Docker planner resolves the lane with both package and functional-image
requirements, and the existing 33 planner assertions remain green. After the
condition/provider amendments, the focused provider-registry, provider
evaluation, hosting config, Gateway readiness, timeout, and HTTP probe suites
pass 132 routed assertions. Earlier status-contract coverage remains part of
the stack.

The workspace-readiness composed branch passed 188 focused profile,
Gateway-probe, health-state, status, node, and workspace assertions. After the
restack, PR 21's package-acceptance workflow file passes all 49 assertions and
the Docker planner passes all 33 assertions on Linux.

Actual execution of the new workspace `tmpfs` failure/recovery scenario remains
pending because Docker Desktop was unavailable on the authoring host. The
scenario, package-installed lane, and deterministic plan are implemented, but
the draft stack does not claim a local or brokered runtime pass yet.

The lane is the reproducible behavior proof for upstream review. A brokered
Linux/Crabbox execution should be attached before the implementation PRs are
promoted upstream; the draft branches do not depend on Crabbox to define the
contract.

This first stack proves the core ready/result shape, explicit profile
selection, built-in profile composition from reusable criteria, exact built-in
container/reverse-proxy predicates, and node-mode rules backed by the
live node registry.

### Incremental adoption

The proposal does not require one all-or-nothing implementation landing:

1. Land the condition shape, normalize existing Gateway startup, drain,
   channel, and event-loop observations into core conditions, and add the
   default `local` projection across readiness, health, and status surfaces.
2. Add explicit selection plus `container` and `reverse-proxy` predicates over
   effective runtime facts.
3. Add `node-mode` using pairing and live node-registry evidence.
4. Add a generally applicable workspace-writability criterion to every
   existing profile, proving that criteria can extend readiness without adding
   a profile.
5. Add plugin criterion registration and additive operator profiles over the
   same canonical result.
6. Make the packaged profile matrix a blocking package-acceptance release gate.

The first slice is independently useful because it creates one canonical,
explainable result without introducing non-local hosting behavior. If the
profile catalog needs further design, maintainers can accept that foundation
without committing to every proposed profile at once.

## Rationale

This follows the normal contract between a host and a hosted workload. The host
selects a runtime shape and supplies configuration. The workload starts,
publishes runtime status, evaluates readiness criteria over that status, and
reports stable conditions.

Putting the result into `ready`, `status`, and `health` is preferable to a
special "hosted OpenClaw" command tree. "Hosted" is a runtime posture and support
profile, not the primary CLI noun.

Standard profiles make the support promise concrete. Instead of one broad
hosted-deployment claim, OpenClaw can say which standard profiles it supports,
which conditions are stable, and which release tests prove them. An operator
profile preserves the tested baseline it inherits while clearly identifying
the additional criteria whose support belongs to the operator or plugin owner.

This is intentionally less powerful than a general profile or policy engine.
Its value comes from OpenClaw owning a small number of built-in definitions and
testing them release after release. Operator profiles are constrained to
additive composition; they cannot rewrite the support boundary downstream.

The ready check is intentionally smaller than the profile model. Container
hosters can use it directly as their readiness probe, while hosts that already
have their own probe plumbing can still benefit from standard profiles and
stable readiness conditions.

## Unresolved questions

- Should OpenClaw later add an `openclaw ready` CLI wrapper over the same
  readiness result, or are HTTP `/ready` plus status/health enough for the first
  release?
- Which additional advisory conditions would improve supportability without
  weakening the meaning of required profile conformance?
- Should non-plugin runtime drivers need a separate criterion registration
  surface, or is activation-scoped plugin registration sufficient?
- Which stable telemetry event names should accompany readiness transitions in a
  follow-up PR?
