---
title: Standard Hosting Profiles and Ready Check
authors:
  - Gio
created: 2026-07-09
last_updated: 2026-07-10
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/33
---

# Proposal: Standard Hosting Profiles and Ready Check

## Summary

Add a small support contract for running OpenClaw as a workload. A
built-in hosting profile names a validated composition of existing OpenClaw
settings; readiness reports whether the running process satisfies that
composition. This extends the existing Gateway `/ready` and `/readyz` result
and projects the same conditions into `status --json` and Gateway health. It
does not add a second config system, generate config, or replace existing
Gateway readiness.

## Motivation

OpenClaw can be hosted today and already exposes Gateway `/ready` and `/readyz`.
Those probes cover Gateway startup, channel runtime health, drain state, and
event-loop health. What they do not identify is the selected hosting model or
the config/runtime predicates that make that model supportable. Hosts therefore
cannot answer one higher-level question before routing traffic:

```text
Is this OpenClaw instance ready under the hosting profile it was started with?
```

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
- Reserve namespaced plugin or driver readiness conditions for a later contract
  that defines trusted runtime evidence publication.
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

Four constraints keep this narrow:

1. A profile does not write, merge, or repair configuration.
2. Operators may continue to configure every OpenClaw setting directly.
3. Profile readiness is an additional conjunction with existing Gateway
   readiness, never a replacement for it.
4. The first contract evaluates only facts owned by OpenClaw core. Optional
   plugins, policy, and doctor may consume the result but are not dependencies.
5. Only required conditions affect the binary ready result. Advisory conditions
   remain visible without turning a useful diagnostic into an outage.

The contract is not a parallel hosted config tree. Existing OpenClaw config
continues to own Gateway, proxy, plugin, model, session, node, and state
behavior. A hosting profile decides which existing runtime status/config facts
must be true before the instance is considered ready. If a criterion needs a
fact that status does not expose yet, the implementation should add that
missing status field rather than introduce a parallel readiness evidence path.

### Built-in profiles

OpenClaw should ship profile definitions rather than ask every host to invent
one. Operators can still configure the underlying OpenClaw settings; the profile
names the support contract.

A profile names the expected ingress/runtime posture, not the packaging
technology. A Gateway directly reachable through its container listener uses
`container`. A Gateway in a container behind a trusted identity proxy uses
`reverse-proxy`. New profile names should be added only when they define a
distinct OpenClaw-owned invariant and conformance scenario.

Profiles should be declarative compositions of reusable readiness criteria. A
built-in profile references OpenClaw-owned `openclaw.*` criteria. Each criterion
is a named rule over OpenClaw runtime status/config fields and has one
OpenClaw-owned evaluator that emits the runtime readiness condition.

| Profile | Purpose | Built-in criteria | Status fields read | Emitted readiness signals |
| --- | --- | --- | --- | --- |
| `local` | Developer/local foreground process readiness. | `openclaw.config-loaded`, `openclaw.gateway-responding`, `openclaw.plugins-loaded` | config load, Gateway reachability, selected plugin activation status | Required: `ProfileSelected`, `ConfigLoaded`, `GatewayResponding`. Advisory: `PluginsLoaded`. |
| `container` | One OpenClaw service hosted by Docker, Compose, or a similar supervisor. | `local` + `openclaw.container-state-ready` | effective Gateway mode, resolved bind host, and port | Core signals plus `ContainerStateReady`. |
| `reverse-proxy` | Gateway running behind a trusted reverse proxy. | `local` + `openclaw.trusted-proxy-ready` | Gateway trusted-proxy auth config | Core signals plus `TrustedProxyReady`. |
| `node-mode` | Gateway/controller for one or more controlled execution nodes. | `local` + node-mode `openclaw.*` criteria | pairing store, live node registry, paired command grants, `gateway.nodes.allowCommands` | Core signals plus `NodePairingReady`, `ControlledTargetsReady`, `CommandApprovalReady`, `ControlChannelReady`. |

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
| `ProfileSelected` | Required | The runtime resolved and reports the selected built-in profile. The default is `local`. | None; invalid explicit values fail selection before startup. |
| `ConfigLoaded` | Required | Runtime configuration loaded successfully. | `ConfigNotLoaded` |
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

The v1 config schema is intentionally closed:

```ts
type HostingProfileId = "local" | "container" | "reverse-proxy" | "node-mode";

type HostingConfig = {
  profile?: HostingProfileId;
};

type OpenClawConfig = {
  hosting?: HostingConfig;
  // Existing OpenClaw fields remain unchanged.
};
```

`hosting` is a strict object and `profile` is its only v1 field. Unknown fields
and profile ids fail normal config validation. The environment variable and
startup flag accept the same closed profile-id set. The `local` default is
resolved at runtime and does not need to be persisted into `openclaw.json`.

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
type HostingReadinessConditionType =
  | "ProfileSelected"
  | "ConfigLoaded"
  | "GatewayResponding"
  | "PluginsLoaded"
  | "ContainerStateReady"
  | "TrustedProxyReady"
  | "NodePairingReady"
  | "ControlledTargetsReady"
  | "CommandApprovalReady"
  | "ControlChannelReady";

type HostingReadinessCondition = {
  type: HostingReadinessConditionType;
  status: "True" | "False" | "Unknown";
  requirement: "required" | "advisory";
  reason: string;
  message: string;
};

type HostingReadinessResult = {
  profile: HostingProfileId;
  ready: boolean;
  conditions: HostingReadinessCondition[];
  failures: string[];
  advisories: string[];
};
```

Every field in `HostingReadinessResult` is required whenever the result is
present; empty `conditions`, `failures`, or `advisories` are serialized as empty
arrays rather than omitted. Built-in condition types and the stable reasons in
the truth-predicate table are reserved by OpenClaw.

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
`failures` is the deduplicated union of existing Gateway lifecycle failure
reasons and non-`True` required profile-condition reasons. This preserves
existing channel/startup/drain/event-loop explanations even though those legacy
checks are not duplicated as profile conditions. `advisories` is the set of
non-`True` advisory profile reasons. `message` is for operators and should
remain non-normative.

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
the canonical hosting fields are flattened once into this existing Gateway
envelope. `ready` is the conjunction of Gateway lifecycle readiness and all
required profile conditions. `failing` remains the legacy Gateway-oriented
list; `failures` is the canonical deduplicated union described above. HTTP is
`200` when `ready` is true and `503` otherwise. `HEAD` returns the same status
without a body. Unauthenticated remote probes retain the redacted shape
`{ "ready": boolean }` and do not disclose condition details.

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

### Future extensibility

The first contract should keep built-in profile conditions stable and
OpenClaw-owned. Operators should not be able to redefine what `local`,
`container`, or `node-mode` means.

This first RFC does not add custom profile or criterion config. A declaration
without a trusted observed-state producer can never become ready and would be a
sticky but unusable public contract. A later RFC may add namespaced criteria
after it defines who may publish evidence, how evidence is scoped and expired,
how plugins or drivers are authenticated, and how status and readiness consume
the same fact without creating a parallel evidence model.

Built-in profile names, `openclaw.*` criterion names, and built-in condition
names remain reserved. Operators configure the underlying OpenClaw settings;
they do not redefine built-in profile semantics.

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
fork before upstream OpenClaw PRs are opened:

| Slice | Fork PR | Branch |
| --- | --- | --- |
| Ready surfaces | https://github.com/giodl73-repo/openclaw/pull/17 | `user/giodl/hosting-ready-local` (`cefbe89976`) |
| Built-in profile selection and predicates | https://github.com/giodl73-repo/openclaw/pull/18 | `user/giodl/hosting-profile-selection` (`c423b77720`) |
| Node-mode readiness | https://github.com/giodl73-repo/openclaw/pull/19 | `user/giodl/hosting-node-mode-readiness` (`0dc6c7184f`) |
| Release conformance gate | https://github.com/giodl73-repo/openclaw/pull/21 | `user/giodl/hosting-profile-release-conformance` (`504310c0b9`) |

The stack includes one package-installed Docker conformance lane,
`pnpm test:docker:hosting-profiles`, built incrementally across the runtime
branches and promoted into blocking package-acceptance release checks by the
fourth branch:

- PR 17 proves an unset profile defaults to `local`, `/readyz` returns 200, and
  required/advisory aggregation is stable.
- PR 18 proves a LAN-bound `container` profile returns 200 and a loopback-bound
  `container` profile returns 503 with `ContainerGatewayLoopback`. It also
  proves a configured trusted-proxy posture returns 200 for `reverse-proxy`
  while token auth returns 503 with `TrustedProxyAuthMissing`, and projects the
  canonical result into Gateway health without a duplicate nested payload.
- PR 19 starts a real node host and proves `node-mode` transitions from 503 to
  200 only after approved pairing, a correlated live target, an advertised
  approved command, and a connected control channel are all observed.
- PR 21 selects that packaged profile matrix in the non-advisory release
  workflow, preserving its targeted plan, log, timing, and summary artifacts.

PR 21 validation confirms the release workflow selects `hosting-profiles`, the
Docker planner resolves the lane with both package and functional-image
requirements, and the existing 33 planner assertions remain green. Formatting,
diff checks, and a full branch Codex review against PR 19 also passed with no
actionable findings.

After the schema/projection audit, the final composed branch passed 193 focused
profile, config-schema, Gateway-health, status, and node assertions, plus the
release-workflow assertion and all 33 Docker planner assertions.

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

1. Land the condition shape and default `local` projection into existing
   readiness, health, and status surfaces.
2. Add explicit selection plus `container` and `reverse-proxy` predicates over
   effective runtime facts.
3. Add `node-mode` using pairing and live node-registry evidence.
4. Make the packaged profile matrix a blocking package-acceptance release gate.

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

Built-in profiles make the support promise concrete. Instead of one broad
hosted-deployment claim, OpenClaw can say which profiles are supported, which
conditions are stable, and which release tests prove them.

This is intentionally less powerful than a general profile or policy engine.
Its value comes from OpenClaw owning a small number of definitions and testing
them release after release. A host-specific profile language would move the
support boundary back downstream and recreate the ambiguity this RFC is meant
to remove.

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
- Should later plugin or driver hooks publish namespaced criteria evidence, and
  what identity, scoping, freshness, and trust boundary should that require?
- Which stable telemetry event names should accompany readiness transitions in a
  follow-up PR?
