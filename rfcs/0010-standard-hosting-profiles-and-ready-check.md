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

Define standard hosting profiles for running OpenClaw as a workload, plus a
canonical ready check that evaluates the selected profile against runtime
evidence and reports stable readiness conditions through host-facing surfaces
such as `openclaw ready`, `status --json`, and Gateway health.

## Motivation

OpenClaw can be hosted today, but it does not yet expose the small workload
contract that container hosts and orchestrators expect. Hosts need to answer one
question before routing traffic:

```text
Is this OpenClaw instance ready under the hosting profile it was started with?
```

Without that contract, downstream hosts compensate with private startup checks,
baked config, environment restore lists, persistence wrappers, and adapter-only
readiness logic. That makes hosted OpenClaw harder to test upstream and harder
to upgrade downstream.

Profiles turn the broad claim "OpenClaw supports hosted deployments" into a
reviewable support matrix:

```text
OpenClaw supports these profiles.
Each profile has stable readiness conditions.
Each release can test those conditions.
Hosts can prove which profile they are running.
```

## Goals

- Define built-in hosting profiles for `local`, `container`, `reverse-proxy`,
  `managed`, and `node-mode`.
- Make `local` the default profile when no profile is selected.
- Add a canonical readiness result with stable condition `type`, `status`,
  `reason`, and human-readable `message`.
- Add a focused `openclaw ready --json` command for host readiness probes.
- Expose the same readiness result through existing status and health surfaces.
- Add explicit profile selection through config, environment, and Gateway
  startup.
- Keep OpenClaw generic: no Lobster, Scout, Microsoft, tenant, Teams, Kusto, or
  product-specific host concepts.
- Keep the first implementation in core so readiness works without optional
  plugins.
- Leave room for later namespaced plugin or driver readiness conditions without
  letting operators redefine built-in profile semantics.
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
- Make `openclaw ready` depend on doctor, lint, policy, or another optional
  conformance layer.

## Proposal

OpenClaw should expose a standard hostee contract:

```text
profile selection
+ runtime evidence
+ readiness condition evaluation
-> ready/not-ready result
```

The contract is not a parallel hosted config tree. Existing OpenClaw config
continues to own Gateway, proxy, plugin, model, session, node, and state
behavior. A hosting profile decides which runtime evidence must be true before
the instance is considered ready.

### Built-in profiles

OpenClaw should ship profile definitions rather than ask every host to invent
one. Operators can still configure the underlying OpenClaw settings; the profile
names the support contract.

| Profile | Purpose |
| --- | --- |
| `local` | Developer/local foreground process readiness. |
| `container` | One OpenClaw service hosted by Docker, Compose, or a similar supervisor. |
| `reverse-proxy` | Gateway running behind a trusted reverse proxy. |
| `managed` | Platform-hosted OpenClaw with managed lifecycle expectations. |
| `node-mode` | Platform-controlled execution node or cell readiness. |

The initial `local` readiness condition set should include:

- `ProfileSelected`
- `ConfigLoaded`
- `GatewayResponding`
- `WorkspaceUsable`
- `PluginsLoaded`

The initial `node-mode` condition set should add:

- `NodePairingReady`
- `ControlledTargetsReady`
- `CommandApprovalReady`
- `ControlChannelReady`
- `StateReady`

`node-mode` must stay product-neutral. A controlled target can be a desktop,
sandbox, VM, pod, browser, or another execution surface. OpenClaw should not
assume one node maps to exactly one target.

### Profile selection

OpenClaw should not require an explicit profile to run. If no profile is
selected, the effective profile is `local`.

Profile selection should be visible in normal hosting mechanisms:

- config: `hosting.profile`
- environment: `OPENCLAW_HOSTING_PROFILE`
- startup: `openclaw gateway run --hosting-profile <profile>`

`openclaw ready --expect-profile <profile>` should be an assertion, not a
selection mechanism. If the running Gateway selected a different profile, the
ready result should be `ready=false` with a stable `ProfileMismatch` reason.

### Ready result

Readiness should use Kubernetes-style conditions:

```jsonc
{
  "profile": "container",
  "expectedProfile": "container",
  "ready": false,
  "conditions": [
    {
      "type": "ProfileSelected",
      "status": "True",
      "reason": "ProfileSelected",
      "message": "Runtime selected the container hosting profile."
    },
    {
      "type": "GatewayResponding",
      "status": "False",
      "reason": "GatewayUnavailable",
      "message": "Gateway did not respond to the readiness request."
    }
  ],
  "failures": ["GatewayUnavailable"]
}
```

Hosts and tests should key on `type`, `status`, and `reason`. `message` is for
operators and should remain non-normative.

### Extensibility

The first contract should keep built-in profile conditions stable and
OpenClaw-owned. Operators should not be able to redefine what `local`,
`container`, or `node-mode` means.

Custom readiness should use a reusable criteria model, not ad hoc profile
redefinitions. Operators can declare namespaced criteria under a registry such
as `hosting.criteria`, then custom profiles or host policy can reference those
criteria as required or optional. For example, `acme.backup-ready` can be
defined once and reused by `acme.managed` and `acme.node-cell`.

Criteria declarations are desired contract, not observed state. They should
carry stable identity and human-readable intent, while readiness output carries
observed `status`, `reason`, and `message`. This keeps `openclaw.json` aligned
with normal host systems: config/spec declares what must be true, runtime status
reports whether it is true.

Built-in profile names and built-in condition names remain reserved.
Custom profiles extend built-in profiles and append criteria; they do not
mutate the built-in definitions.

Built-in profiles also should not encode host-specific numeric probe values.
Intervals, retries, start periods, and timeouts belong in Docker, Compose,
Kubernetes, systemd, Nomad, ECS, or another host manifest. OpenClaw can document
recommended host manifests, and a later doctor/lint conformance pass can emit
findings and fix recommendations when config does not match the selected
profile, but `openclaw ready` should not depend on that optional repair path.

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
execution, readiness evidence, ready/not-ready result.
```

OCC should not be in the hot path for assistant deltas, tool events, approvals,
patches, compaction events, or harness protocol frames.

### Implementation branches

The initial implementation is being prepared as draft branches in the OpenClaw
fork before upstream OpenClaw PRs are opened:

| Slice | Fork PR | Branch |
| --- | --- | --- |
| Ready surfaces | https://github.com/giodl73-repo/openclaw/pull/17 | `user/giodl/hosting-ready-local` |
| Profile selection and reusable criteria | https://github.com/giodl73-repo/openclaw/pull/18 | `user/giodl/hosting-profile-selection` (`17473adc33`) |
| Node-mode readiness | https://github.com/giodl73-repo/openclaw/pull/19 | `user/giodl/hosting-node-mode-readiness` (`d24dd5f241`) |

The remaining proof work should happen before upstream OpenClaw implementation
PRs are filed:

- local Docker proof for default `local` readiness using `openclaw ready --json`
- local Docker proof for `container` using
  `openclaw ready --expect-profile container --json`
- local Docker proof for `node-mode` readiness behavior
- local Docker proof for custom criteria/profile readiness behavior
- Crabbox Linux/container proof when reviewer-grade platform evidence is needed

## Rationale

This follows the normal contract between a host and a hosted workload. The host
selects a runtime shape and supplies configuration. The workload starts, gathers
its own runtime evidence, evaluates readiness, and reports stable conditions.

Putting the result into `ready`, `status`, and `health` is preferable to a
special "hosted OpenClaw" command tree. "Hosted" is a runtime posture and support
profile, not the primary CLI noun.

Built-in profiles make the support promise concrete. Instead of one broad
hosted-deployment claim, OpenClaw can say which profiles are supported, which
conditions are stable, and which release tests prove them.

## Unresolved questions

- Should OpenClaw also add an HTTP `/ready` endpoint, or is `openclaw ready` plus
  Gateway health enough for the first release?
- Which profile conditions should be release-blocking versus warning-only as
  `container`, `reverse-proxy`, and `managed` mature?
- Should later plugin or driver hooks be able to publish criteria evidence into
  the same `hosting.criteria` model, and what trust boundary should that use?
- Should future profile conformance live in QA Lab, maturity scorecards, Docker
  E2E, or a dedicated profile conformance runner?
- Which stable telemetry event names should accompany readiness transitions in a
  follow-up PR?
