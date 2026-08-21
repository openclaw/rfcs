# Hosted Control UI policy v1 specification

This document defines the candidate hosted-policy contract for serving the
version-matched OpenClaw Control UI from a host runtime. It is related to the
Control Model because both surfaces let a product host OpenClaw behavior
without forking OpenClaw semantics. It remains a sibling contract: hosted
policy governs deployment, route access, and runtime enforcement, while the
Control Model governs native conversation state, commands, and artifacts.

Status: draft. The active implementation surfaces are
[openclaw/openclaw#115423](https://github.com/openclaw/openclaw/issues/115423),
[openclaw/openclaw#115408](https://github.com/openclaw/openclaw/pull/115408),
and [openclaw/openclaw#116013](https://github.com/openclaw/openclaw/pull/116013).
Settings-constraint evidence is currently fork-only in
[giodl73-repo/openclaw#196](https://github.com/giodl73-repo/openclaw/pull/196)-[#202](https://github.com/giodl73-repo/openclaw/pull/202).

## Scope

A conforming v1 hosted-policy implementation provides:

- an explicit host decision for whether the hosted OpenClaw Control UI route is
  enabled;
- a bounded bootstrap payload that declares host-owned route, Gateway, rollout,
  and lockdown decisions safe for the browser;
- server-side route and method enforcement that remains authoritative even when
  browser state is stale or bypassed;
- policy decision states for enabled, disabled, and read-only affordances;
- safe denial reasons and owner/source metadata where policy permits display;
- rollback to the incumbent host shell or disabled route without changing the
  OpenClaw bundle; and
- conformance evidence that blocked operations fail at the Gateway/runtime
  boundary, not only in UI controls.

This contract does not define a native renderer, a Control Model adapter, a
generic dashboard system, writable configuration authority, or a replacement
for Managed Configuration.

## Ownership

OpenClaw owns:

- the version-matched Control UI bundle;
- the policy vocabulary consumed by the hosted UI;
- Gateway method names and protected operation classification;
- browser-safe bootstrap schema compatibility; and
- default denial and fallback behavior.

The host runtime owns:

- route selection and admission;
- product authentication and tenant/device gating;
- rollout, kill switches, and rollback;
- server-side route and method enforcement;
- policy source binding; and
- operational telemetry and audit sinks.

Policy remains authoritative at the Gateway/runtime boundary. A browser control
may hide, disable, or annotate an operation, but that affordance is never
authorization.

## Bootstrap payload

The host may expose a bounded bootstrap payload to the hosted Control UI before
or during application startup. The shape may evolve, but v1 semantics must
cover:

```ts
export interface HostedControlUiPolicyBootstrap {
  version: 1;
  hostedUi: {
    enabled: boolean;
    routeBase: string;
    gatewayBase: string;
    rollout?: HostedRolloutState;
  };
  lockdown: {
    allowedRoutes: string[];
    allowedGatewayMethods: string[];
    deniedGatewayMethods?: HostedPolicyDecision[];
  };
  settings?: {
    constraints: HostedSettingsConstraint[];
  };
}

export interface HostedPolicyDecision {
  target: string;
  state: "enabled" | "readOnly" | "disabled";
  reasonCode?: string;
  message?: string;
  owner?: string;
}

export interface HostedSettingsConstraint {
  key: string;
  state: "enabled" | "readOnly" | "disabled";
  reasonCode?: string;
  message?: string;
  owner?: string;
}

export interface HostedRolloutState {
  flight?: string;
  enabled: boolean;
  fallbackRoute?: string;
}
```

The bootstrap payload must not include credentials, bearer tokens, raw policy
documents, hidden model context, unrestricted Gateway method lists, or
unbounded error details.

## Route policy

The host runtime must decide whether the hosted OpenClaw Control UI route is
available for the current product, tenant, user, device, and rollout state.

When hosted UI is disabled, the route must fail closed or redirect to an
explicit host-owned fallback. The browser bundle must not infer availability by
probing protected Gateway methods.

Allowed route declarations are presentation hints. The server remains
authoritative for every request.

## Gateway method policy

Gateway method enforcement must happen server-side. A conforming v1
implementation:

- classifies protected Gateway methods before exposure to the hosted browser;
- denies forbidden methods even if a stale UI control still calls them;
- preserves safe structured denial codes;
- does not leak raw policy source data in denial payloads;
- keeps read-only decisions distinct from unavailable or unsupported methods;
  and
- logs or meters denial outcomes without recording sensitive request payloads by
  default.

The hosted Control UI may use bootstrap decisions to hide, disable, or annotate
controls. Those controls improve usability only; they do not authorize the
operation.

## Settings constraints

Settings constraints describe browser-safe policy state for settings controls:

- `enabled`: the setting may be shown and edited subject to ordinary schema and
  Gateway validation;
- `readOnly`: the setting may be shown but mutation is disabled and server-side
  writes must be denied or redirected to a governed path; and
- `disabled`: the setting is unavailable in this hosted context.

Settings constraints do not create write authority. Governed writes require the
separate Managed Configuration contract for provenance, validation findings,
candidate preview, generation, commit, activation, and rollback.

## Rollback and compatibility

Hosted policy must be independently rollbackable from Control Model adoption.
A host can disable the hosted route, restrict methods, or return to an
incumbent shell without changing native Control Model consumers.

Unknown additive bootstrap fields must be ignored. Missing required v1 fields
must fail closed rather than enabling hosted UI or protected Gateway methods by
default.

## Required conformance evidence

Before v1 support is claimed, evidence must cover:

- hosted route disabled and enabled states;
- route rollback to an incumbent host surface;
- bootstrap payload shape and unknown-field compatibility;
- denied Gateway method blocked server-side despite a direct browser call;
- read-only setting visibly disabled and write denied server-side;
- disabled setting unavailable without leaking raw policy details;
- stale bootstrap state corrected by authoritative Gateway/runtime denial;
- safe denial reason preservation;
- audit/telemetry without raw sensitive payloads; and
- coexistence with Control Model consumers without making either surface a
  dependency of the other.
