---
title: Standard Hosting Profiles
authors:
  - Gio
created: 2026-07-14
last_updated: 2026-07-15
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/37
---

# Proposal: Standard Hosting Profiles

## Summary

Define a small catalog of named, release-tested OpenClaw runtime postures:
`local`, `container`, `reverse-proxy`, and `node-mode`. A selected profile
composes canonical readiness conditions into a support contract, identifies the
runtime activation being evaluated, and can be validated against packaged
release evidence.

This RFC depends on the separate Readiness Conditions and Providers RFC. That
RFC is directly usable: operators may explicitly select additional required or
advisory criteria without any profile. This RFC adds named, release-tested
presets over the same mechanism; it does not redefine readiness evaluation or
provider lifecycle.

## Motivation

OpenClaw can be deployed in many shapes, but "OpenClaw supports containers" or
"OpenClaw supports hosted deployments" is too broad to test or support. The
same package may run:

- as a local foreground Gateway;
- directly reachable through a container listener;
- behind a trusted identity proxy; or
- as a controller for one or more paired execution targets.

Each posture has different facts that must be true before it can serve its
supported role. Today hosts encode those facts in startup flags, environment
variables, Docker health checks, adapter code, and private support checklists.
OpenClaw cannot report which posture was intended, and release tests cannot
make a durable support claim about it.

Standard profiles turn that open-ended claim into a small product contract:

```text
OpenClaw supports these named runtime postures.
Each posture composes stable readiness conditions.
Each release executes the matching conformance scenarios.
The running process reports which posture and activation it represents.
```

This helps maintainers reproduce issues against a supported subset without
preventing operators from configuring OpenClaw directly or running outside the
standard catalog.

## Goals

- Define `local`, `container`, `reverse-proxy`, and `node-mode` as standard
  OpenClaw support profiles.
- Make selection opt-in so an upgrade preserves the existing unprofiled
  readiness baseline.
- Select profiles through config, environment, or Gateway startup arguments
  with explicit precedence.
- Compose profiles from reusable canonical readiness conditions.
- Define exact predicates and stable reasons for profile-specific conditions.
- Report the selected profile through readiness, health, and status.
- Identify the logical runtime and unique process/container incarnation whose
  profile result is being reported.
- Let operator profiles extend, but never weaken, a standard profile.
- Bind packaged conformance evidence to an immutable OpenClaw artifact and
  profile contract version.
- Keep host orchestration and OpenClaw runtime ownership separate.

## Non-Goals

- Define the canonical readiness-condition schema or plugin provider API.
- Generate, merge, repair, or replace OpenClaw configuration.
- Encode Docker, Kubernetes, systemd, Nomad, or ECS retry/interval settings.
- Define OCC resources, placement, tenant identity, quotas, or admission.
- Define the AgentHarness event protocol or put agent traffic in a control
  plane.
- Standardize host storage, telemetry sinks, routing, worker pools, or admin
  UX.
- Make the optional Policy or Doctor subsystems dependencies of startup.
- Guarantee checkpoint durability, restore compatibility, or safe destruction.
- Claim that every possible OpenClaw configuration belongs to a standard
  profile.

## Proposal

The implementer-facing v1 contract is captured in
[`0023/hosting-profile-v1-spec.md`](0023/hosting-profile-v1-spec.md). This RFC
remains the design rationale, support argument, and rollout plan; the sidecar is
the concise profile catalog, selection, activation, extension, projection, and
conformance reference for OpenClaw runtime and release implementations.

### Dependency on canonical readiness

This RFC assumes the contract proposed by Readiness Conditions and Providers:

```text
condition type + status + requirement + reason + message
```

Profiles do not create a second evaluator. A profile is declarative data that
supplies a named preset of reusable conditions and requirement classes. The
canonical readiness engine evaluates those conditions exactly as if the
operator had selected them explicitly through `gateway.readiness`.

Universal Gateway startup, drain, and selected-channel readiness remains in
force for every profile. No profile may remove, replace, or weaken it.

```text
RFC 0018 direct use:
  universal conditions + operator-selected criteria -> readiness

RFC 0023 profile use:
  universal conditions + standard profile preset + operator additions
  -> readiness + OpenClaw support/conformance claim
```

### Standard profile catalog

| Profile | Runtime posture | Additional required condition types |
| --- | --- | --- |
| `local` | Explicit local or foreground Gateway posture | `ProfileSelected`, `RuntimeActivationIdentified`, `WorkspaceWritable` |
| `container` | Gateway directly reachable through a container listener | `local` plus `ContainerStateReady` |
| `reverse-proxy` | Gateway behind a trusted identity proxy | `local` plus `TrustedProxyReady`; loopback remains valid for a same-host proxy |
| `node-mode` | Gateway controlling one or more execution targets | `local` plus `NodePairingReady`, `ControlledTargetsReady`, `CommandApprovalReady`, `ControlChannelReady` |

A profile names runtime posture, not packaging. Docker behind an identity proxy
selects `reverse-proxy`; Docker with a directly reachable listener selects
`container`.

New standard profiles require an independently useful support posture, stable
condition predicates, packaged conformance scenarios, and an owner willing to
maintain the support promise. A new diagnostic condition alone does not justify
a new profile.

### Profile conditions

The standard catalog composes conditions owned by the canonical readiness
contract and existing OpenClaw runtime owners.

| Condition | Profile | True when | Stable non-ready reasons |
| --- | --- | --- | --- |
| `ProfileSelected` | All | Selection precedence resolves to a valid standard or configured operator profile. | Invalid explicit values fail startup validation. |
| `RuntimeActivationIdentified` | All | Non-empty logical-runtime and unique-incarnation identities are resolved. | `RuntimeIdentityInvalid`, `IncarnationIdentityInvalid`, `ActivationIdentityUnavailable` |
| `ContainerStateReady` | `container` | Effective Gateway mode is local and resolved listener host is not loopback. | `ContainerGatewayRemote`, `ContainerGatewayLoopback`, `ContainerBindNotResolved` |
| `TrustedProxyReady` | `reverse-proxy` | Auth mode is `trusted-proxy`, a user header and trusted source are configured, and active ingress honors asserted identity only from validated trusted sources. | `TrustedProxyAuthMissing`, `TrustedProxyHeaderMissing`, `TrustedProxySourcesMissing`, `TrustedProxyIngressUnsafe` |
| `NodePairingReady` | `node-mode` | Pairing state is readable and contains an approved pairing. | `NodePairingUnavailable`, `NodePairingTimedOut`, `NodePairingPending`, `NodePairingMissing` |
| `ControlledTargetsReady` | `node-mode` | At least one connected target is correlated to an approved pairing. | `ControlledTargetsDisconnected` |
| `CommandApprovalReady` | `node-mode` | A connected paired target advertises a command permitted by effective grants. | `CommandApprovalMissing` |
| `ControlChannelReady` | `node-mode` | At least one live target session is correlated to an approved pairing. | `ControlChannelUnavailable` |

`node-mode` stays product-neutral. A target may be a desktop, sandbox, VM, pod,
browser, or another execution surface. OpenClaw does not assume one node maps to
exactly one product or tenant. One correlated approved pairing, connected
target, effective command grant, and live session must satisfy all four
conditions; independent targets cannot satisfy different rows.

Common runtime conditions such as `ConfigLoaded`, `WorkspaceWritable`,
`GatewayResponding`, and conditionally required plugin, secret, or model-route
activation remain owned by readiness and their source subsystems. Profiles only
declare when they are required for the supported posture.

### Selection and precedence

Profile selection is optional and opt-in. When no value is supplied, OpenClaw
does not select a profile. Existing installations retain the universal
readiness baseline from RFC 0018 and do not silently acquire profile-specific
required conditions during an upgrade.

Selection precedence is:

```text
gateway startup argument
> OPENCLAW_HOSTING_PROFILE
> openclaw.json
```

Example:

```json5
{
  hosting: {
    profile: "container",
  },
}
```

Equivalent startup selection:

```bash
OPENCLAW_HOSTING_PROFILE=container openclaw gateway run
openclaw gateway run --hosting-profile container
```

When selected, the effective profile, selection source, and condition result
are reported by readiness, health, and status. An unprofiled runtime omits
`ProfileSelected` and profile-only requirements. Hosts may assert an expected
profile when probing, but expectation is an assertion over the running result,
not another selection source.

Profiles validate effective runtime state. They do not generate or repair the
underlying Gateway, proxy, plugin, model, node, or storage config.

### Runtime activation identity

A readiness result must be attributable to one runtime activation. OpenClaw
resolves:

- a logical runtime ID that may remain stable across process replacement; and
- a unique incarnation ID for the current process/container activation.

Launchers may provide identities through startup arguments, environment, or a
mounted activation descriptor. Local runs receive safe generated defaults.
Invalid explicit identities fail startup rather than silently falling back.

The activation summary is redacted and references, rather than copies, inputs
owned by other contracts:

```ts
type RuntimeActivationSummary = {
  runtimeId: string;
  incarnationId: string;
  profile?: string;
  configGeneration?: string;
  hostIntegrationGeneration?: string;
  restoreGeneration?: string;
};
```

Managed Configuration, Hosted Integration, and Runtime State Continuity own
their generations and evidence. A profile only requires and reports the
resolved references needed for its support posture.

This is not an OCC instance resource. OCC may supply desired identity and
profile selection, but OpenClaw evaluates the live activation in the runtime
plane.

### Operator profiles

An operator profile extends one standard profile and adds required or advisory
condition IDs:

```json5
{
  hosting: {
    profile: "acme/managed",
    profiles: {
      "acme/managed": {
        extends: "container",
        requiredCriteria: ["plugin.storage.backend"],
        advisoryCriteria: ["plugin.metrics.exporter"],
      },
    },
  },
}
```

V1 operator profiles are additive:

- exactly one standard profile is inherited;
- inherited required conditions cannot be removed or weakened;
- standard profile IDs and core condition IDs are reserved;
- unknown required provider IDs fail closed; and
- the operator or plugin owner owns the added support promise.

OpenClaw supports and release-tests the inherited standard baseline. It does
not claim release conformance for operator-added conditions.

### Host-visible result

The selected profile appears in the canonical readiness result. For example, a
container selected with a loopback-only listener returns:

```http
HTTP/1.1 503 Service Unavailable
```

```json
{
  "profile": "container",
  "ready": false,
  "activation": {
    "runtimeId": "worker-17",
    "incarnationId": "01J..."
  },
  "conditions": [
    {
      "type": "ContainerStateReady",
      "status": "False",
      "requirement": "required",
      "reason": "ContainerGatewayLoopback",
      "message": "The effective Gateway listener is loopback-only."
    }
  ],
  "failures": ["ContainerGatewayLoopback"]
}
```

After the listener becomes reachable, the same endpoint returns `200`. Docker,
Kubernetes, systemd, or OCC can consume the ordinary readiness endpoint without
interpreting a profile-specific API.

### Packaged profile conformance

A standard profile is a support promise only if the release process tests it.
Conformance produces an immutable record bound to the exact package or image:

```ts
type HostingProfileConformanceRecord = {
  schemaVersion: 1;
  profileContractVersion: 1;
  artifact: {
    openclawVersion: string;
    packageIdentity: string;
    digest: string;
  };
  profile: "local" | "container" | "reverse-proxy" | "node-mode";
  conditionContractVersion: number;
  requiredConditionTypes: string[];
  result: "passed" | "failed";
  suiteIdentity: string;
  completedAt: string;
  provenance?: {
    builder?: string;
    sourceRevision?: string;
    attestationRef?: string;
  };
};
```

Readiness may project artifact identity and matching profile-conformance status,
but it reads packaged metadata; it never reruns release tests. Source and
development runs may report conformance as advisory `Unknown`.

If a host supplies an immutable expected artifact identity, mismatch is a
required `ArtifactIdentityMatches=False` readiness failure with reason
`ArtifactIdentityMismatch`. This prevents a different build from satisfying a
deployment's support claim.

The initial profile matrix must execute package-installed scenarios for:

- unchanged unprofiled readiness and explicit local-profile readiness;
- container success and loopback failure;
- reverse-proxy success and missing-auth failure;
- node-mode unpaired failure and paired/approved recovery; and
- workspace-full failure and recovery without restart.

Making this matrix release-blocking is a governance decision attached to
accepting the profile contract. The draft conformance PR demonstrates the
blocking package-acceptance wiring so reviewers can evaluate the complete
support promise; it should not land ahead of the profile contract.

### Support ownership and compatibility

OpenClaw owns:

- standard profile names and definitions;
- profile-specific condition predicates and reasons;
- selection precedence and result projection;
- activation identity semantics; and
- packaged conformance for the standard catalog.

Hosts own:

- which profile to select;
- container and scheduler manifests;
- probe timing, retries, and restart policy;
- placement, routing, tenants, and rollout;
- telemetry sinks and fleet alerts; and
- support for operator-added conditions.

Adding a required condition, changing a stable reason, or changing an advisory
condition to required can alter host behavior and needs compatibility review,
release notes, and conformance coverage.

### OCC and AgentHarness alignment

OCC may compile desired state into OpenClaw config, profile selection, runtime
identity, and host policy. The runtime plane still evaluates readiness and
reports the live activation.

AgentHarness owns harness execution events. Hosting profiles do not carry
assistant deltas, tool frames, approvals, patches, compaction events, or
harness protocol frames.

```text
OCC/control plane
  -> desired runtime identity and profile

OpenClaw/runtime plane
  -> live activation
  -> canonical readiness conditions
  -> selected profile result

AgentHarness/data plane
  -> harness execution events
```

### Relationship to continuity

Readiness says whether the current runtime can serve work under its selected
profile. It does not say whether mutable state has been durably published or
whether the runtime is safe to destroy.

A runtime may be ready but dirty, or not ready while its durable state is
complete. Checkpoint publication, restore compatibility, hibernate, and
generation-fenced safe destruction remain Runtime State Continuity concerns.

### Implementation plan

After the readiness-only stack is established, the profile implementation is a
single dependent series in
[openclaw/openclaw#107765](https://github.com/openclaw/openclaw/pull/107765).
It is based on readiness head `d1450aeb7f9` from
[openclaw/openclaw#104018](https://github.com/openclaw/openclaw/pull/104018)
and contains nine profile-only commits at exact head `e53d0d7dbfb`:

| Commit | Intended scope |
| --- | --- |
| `773f55479f2` | Add selection, `local`, `container`, and `reverse-proxy` compositions and predicates. |
| `49b2d1600b3` | Add product-neutral node pairing, target, approval, and control-channel conditions. |
| `cc190ebc9bb` | Attribute profile results to logical runtime and incarnation IDs. |
| `bddc10acecd` | Demonstrate the profile matrix and proposed blocking package-acceptance gate. |
| `823d532cc55` | Validate profile startup inputs before destructive lifecycle actions. |
| `2ab70849ddb` | Prove writable host-provisioned workspace behavior and storage recovery. |
| `6f887976e8a` | Prove the existing node approval flow transitions node-mode to ready. |
| `3fb44ece8a0` | Make profile activation explicit and prove unprofiled upgrade compatibility. |
| `e53d0d7dbfb` | Document profile selection, predicates, host inputs, and support boundaries. |

PR 107765 is a stacked upstream draft against `main`. Until PR 104018 lands,
its aggregate GitHub diff includes the readiness dependency followed by the
nine profile commits. After PR 104018 lands, the same PR naturally reduces to
the profile-only diff. [Fork PR 94](https://github.com/giodl73-repo/openclaw/pull/94)
preserves that profile-only comparison view in the meantime. Fork PRs
[#18](https://github.com/giodl73-repo/openclaw/pull/18),
[#19](https://github.com/giodl73-repo/openclaw/pull/19),
[#42](https://github.com/giodl73-repo/openclaw/pull/42), and
[#21](https://github.com/giodl73-repo/openclaw/pull/21) expose the major design
slices as review aids; they are not alternative landing requests.

The refreshed stack passes 206 focused profile, Gateway, config, CLI, Docker-plan,
and release-wiring assertions; formatting and documentation indexing also pass.
A prior package-installed Docker matrix proved all four profiles plus listener,
trusted-proxy, node-approval, workspace-full, recovery, and unprofiled `200`
compatibility using image
`sha256:20d507b613b346e1165add88234eb00390ea6d1b086970dd3589dd3f41654175`.
Exact-head remote container proof must be refreshed before landing.

## Rationale

Named profiles are useful because OpenClaw's configuration space is much larger
than any support matrix. A small standard catalog provides reproducible bug
reports, executable release evidence, and clear responsibility without taking
configuration freedom away from operators.

Profiles belong in OpenClaw because only the runtime can define the predicates
that mean its Gateway, proxy, node, plugin, and activation state satisfy a
supported posture. Hosts should select and operationalize the posture, not
reverse-engineer its internal readiness semantics.

Separating this proposal from readiness keeps both decisions honest. OpenClaw
can accept the condition/provider facility without accepting profile product
semantics, and profile review can focus on names, predicates, support ownership,
and release cost rather than debating the underlying readiness API again.

## Unresolved questions

- Should operator profiles be part of the first implementation or follow after
  the standard catalog proves stable?
- Which activation references are required in V1 beyond runtime and
  incarnation identity?
- Should packaged conformance be visible only through status, or also as
  advisory conditions in readiness?
