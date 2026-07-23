# Standard Hosting Profile v1 Specification

This document is the implementer-facing specification for RFC 0023, Standard
Hosting Profiles. The RFC explains the motivation, support model, and rollout
plan. This file defines the v1 standard profile catalog, condition composition,
selection precedence, activation identity, host-visible result, and packaged
scenario gate.

Status: draft, tied to RFC 0023 and dependent on RFC 0018.

## Scope

This specification defines:

- the `local`, `container`, `reverse-proxy`, and `node-mode` standard profiles;
- composition over canonical readiness criteria from RFC 0018;
- opt-in selection through config, environment, or startup arguments;
- exact profile predicates and stable non-ready reasons;
- logical runtime and unique incarnation identity;
- readiness, health, and status projection; and
- a packaged release scenario lane for the standard catalog.

This specification does not define:

- the readiness condition schema or plugin provider API;
- config generation, merge, repair, or policy enforcement;
- scheduler retry intervals, placement, routing, tenants, or rollout;
- OCC resources or the AgentHarness event protocol;
- checkpoint durability or safe destruction; or
- operator-defined profiles, profile inheritance, host assertions, artifact
  identity, or signed conformance records; or
- support for arbitrary OpenClaw configurations outside the standard catalog.

## Dependencies

This specification requires the canonical condition, aggregation, bounded
evaluation, and projection contract defined by RFC 0018. Profiles are data that
select and classify reusable criteria. They do not define a second evaluator.

An implementation that has no selected profile remains a valid RFC 0018
runtime. Selecting a profile adds the contract in this specification.

## Terminology

- **Standard profile**: an OpenClaw-owned, named runtime posture with stable
  predicates and packaged release scenarios.
- **Universal baseline**: RFC 0018 conditions that apply with or without a
  profile.
- **Profile criterion**: a reusable readiness criterion selected by a profile.
- **Logical runtime ID**: identity that may remain stable across process or
  container replacement.
- **Incarnation ID**: identity unique to one running process or container
  activation.

## Compatibility And Evolution

Hosting Profile v1 uses these compatibility rules:

- profile selection is optional and opt-in;
- an upgrade must not select a profile for an existing unprofiled deployment;
- standard profile IDs, predicates, required condition types and criterion
  selectors, and stable reasons are compatibility contracts;
- adding or strengthening a required criterion changes host behavior and
  requires compatibility review, release notes, and conformance coverage;
- unknown explicit profile values fail startup validation; and
- new standard profiles require a separately reviewable support posture and
  release conformance scenario.

## Standard Profile Catalog

The v1 standard catalog requires these conditions over the RFC 0018 universal
baseline:

| Profile ID | Runtime posture | Required profile criteria |
| --- | --- | --- |
| `local` | Explicit local or foreground Gateway | `WorkspaceWritable`, `ProfileSelected`, `RuntimeActivationIdentified` |
| `container` | Gateway directly reachable through a container listener | `local` plus `ContainerStateReady` |
| `reverse-proxy` | Gateway behind a trusted identity proxy | `local` plus `TrustedProxyReady` |
| `node-mode` | Gateway controlling one or more paired execution targets | `local` plus `NodePairingReady`, `ControlledTargetsReady`, `CommandApprovalReady`, `ControlChannelReady` |

A profile describes runtime posture, not packaging. A container behind an
identity proxy selects `reverse-proxy`; a container with a directly reachable
listener selects `container`.

The RFC 0018 universal baseline remains required and cannot be removed,
replaced, or weakened by a profile.

`WorkspaceWritable` is selected through the RFC 0018 criterion ID
`openclaw.workspace-writable`. The remaining additional condition types are
profile-owned predicates and are not independently operator-selectable in v1.

Canonical condition ordering remains owned by RFC 0018: `ConfigLoaded` and
`WorkspaceWritable` precede `ProfileSelected`, `RuntimeActivationIdentified`,
and the profile-specific conditions listed above; `GatewayResponding` and
`PluginsLoaded` follow them.

## Profile Criteria

### Profile Selection

`ProfileSelected` is `True` when selection precedence resolves to a valid
standard profile. Invalid explicit values fail startup validation rather than
becoming a running false condition.

### Runtime Activation Identity

`RuntimeActivationIdentified` is `True` when both logical runtime and unique
incarnation identities are non-empty and valid.

Invalid explicit values fail startup validation, so V1 does not emit a running
non-ready activation condition.

### Container

`ContainerStateReady` is `True` when the resolved listener host is not loopback.

Stable non-ready reasons are:

- `ContainerGatewayLoopback`.

This criterion validates OpenClaw's effective listener state. It does not
inspect Docker, Kubernetes, ECS, Nomad, or another scheduler API.

### Reverse Proxy

`TrustedProxyReady` is `True` when:

- effective auth mode is `trusted-proxy`;
- a user identity header is configured; and
- at least one syntactically valid trusted proxy source is configured; and
- a loopback-only listener has a loopback trusted proxy source; and
- when that source includes loopback, the explicit trusted-proxy loopback
  allowance is enabled.

Stable non-ready reasons are:

- `TrustedProxyAuthMissing`;
- `TrustedProxyHeaderMissing`;
- `TrustedProxySourcesMissing`; and
- `TrustedProxyIngressUnsafe`.

This readiness condition validates the effective auth configuration. Existing
Gateway trusted-proxy request handling remains responsible for rejecting
untrusted or forged identity ingress; readiness does not replay a request on
every poll. Source syntax and listener/source compatibility use the same network
matching semantics as request authentication. Loopback is valid only when a
colocated proxy is explicitly allowed.

### Node Mode

The node-mode profile requires all four criteria below. One correlated approved
pairing, connected target, effective command grant, and live target session must
satisfy the set; independent targets cannot satisfy different rows.

| Condition type | True when | Stable non-ready reasons |
| --- | --- | --- |
| `NodePairingReady` | Pairing state is readable and contains an approved pairing. | `NodePairingUnavailable`, `NodePairingTimedOut`, `NodePairingPending`, `NodePairingMissing` |
| `ControlledTargetsReady` | At least one connected target correlates to an approved pairing. | `ControlledTargetsDisconnected` |
| `CommandApprovalReady` | A connected paired target advertises a command permitted by effective grants. | `CommandApprovalMissing` |
| `ControlChannelReady` | At least one live target session correlates to an approved pairing. | `ControlChannelUnavailable` |

A target may be a desktop, sandbox, VM, pod, browser, or another execution
surface. The profile does not impose product, tenant, or one-target-per-agent
semantics. Evaluation is bounded by the canonical readiness deadline and uses
the current pairing generation and pairing-bound connected-session state; it
does not perform network discovery or wait for a target during a readiness poll.
Pairing-store reads are single-flight until timeout. A later poll may start one
replacement read so a recovered store can become ready, but no more than two
reads may remain in flight. Store exceptions are projected as stable redacted
reasons rather than raw error text.

## Selection And Precedence

Selection sources use this precedence:

```text
gateway startup argument
> OPENCLAW_HOSTING_PROFILE
> openclaw.json
```

Configuration example:

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

An absent value means unprofiled operation; it must not imply `local`. The
highest-precedence supplied source is validated and wins; shadowed
lower-precedence values are not evaluated. An empty, malformed, or unknown
winning value fails validation before destructive lifecycle actions.

The effective result records the profile and winning selection source.

Profiles validate effective runtime state. They do not generate or repair the
underlying Gateway, proxy, plugin, model, node, or storage configuration.

## Runtime Activation Identity

Every profiled result is attributable to one activation:

```ts
type RuntimeActivationSummary = {
  runtimeId: string;
  incarnationId: string;
  profile: string;
};
```

Launchers may provide identity through startup arguments or environment.
Absent values receive runtime-owned defaults: the logical runtime ID is
`local`, and the incarnation ID is unique to the current process activation.
Explicit invalid identity must fail startup instead of silently falling back.

Logical runtime identity may survive replacement. Incarnation identity must be
unique for each process/container activation. OCC may supply these values, but
the OpenClaw runtime plane evaluates and reports the live activation.

## Operator Extensions

V1 supports only the four OpenClaw-owned standard profile names. Operators may
add required or advisory RFC 0018 criteria directly through
`gateway.readiness`, including while a standard profile is selected. Named
operator profiles and inheritance may be proposed later; they are not part of
this contract and cannot be inferred from arbitrary config.

## Host-Visible Result

The canonical readiness result may add these optional v1 profile fields:

```ts
type ProfiledReadinessResult = ReadinessResult & {
  profileContractVersion: 1;
  profile: string;
  profileSource: "argument" | "environment" | "config";
  activation: RuntimeActivationSummary;
};
```

For example, a selected container profile with a loopback-only listener returns
`503` and includes:

```json
{
  "profileContractVersion": 1,
  "profile": "container",
  "profileSource": "config",
  "ready": false,
  "activation": {
    "runtimeId": "worker-17",
    "incarnationId": "01J...",
    "profile": "container"
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
  "failures": ["ContainerGatewayLoopback"],
  "advisories": []
}
```

After the listener satisfies the predicate, the same readiness endpoint returns
`200`. Hosts consume the canonical endpoint and do not need a profile-specific
probe API.

Unauthenticated remote projections may redact profile source, activation, and
condition detail while preserving the correct status code.

## Packaged Scenario Gate

A standard profile is a credible support promise only when the packaged
release path exercises it. V1 adds one Docker E2E lane to the release-check
matrix. The lane starts the packaged OpenClaw entrypoint and probes the same
canonical `/readyz` result used by hosts; runtime readiness does not rerun the
release tests or claim artifact attestation.

### Minimum V1 Matrix

The packaged matrix must prove:

- unchanged unprofiled readiness;
- explicit `local` success and writable-workspace failure/recovery;
- `container` success and loopback-listener failure;
- `reverse-proxy` success and missing-auth failure;
- `node-mode` unpaired/unapproved failure and paired/approved recovery;
- activation identity and machine-readable profile fields; and
- exact profile condition status and profile contract version on `/readyz`.

Upgrade survival, direct-ingress security tests, cross-surface parity, immutable
artifact records, and signed attestations are valuable follow-up gates, not V1
runtime semantics.

## Ownership

OpenClaw owns:

- standard profile IDs and definitions;
- profile-specific predicates and stable reasons;
- selection precedence and projection;
- activation identity semantics; and
- the packaged scenario lane for the standard catalog.

Hosts own:

- profile selection;
- container and scheduler manifests;
- probe timing, retries, and restart policy;
- placement, routing, tenants, and rollout;
- telemetry sinks and fleet alerts; and
- any additional operator-selected RFC 0018 criteria.

## Conformance Checklist

An implementation conforms to Hosting Profile v1 when it proves:

- no profile is selected by default or by upgrade;
- each selection source works and precedence is deterministic;
- invalid explicit profile or identity fails startup validation;
- every standard profile composes the exact documented criteria;
- profiled results identify logical runtime and unique incarnation;
- profile failures use stable reasons and canonical readiness aggregation;
- all host-visible surfaces describe the same activation and profile result;
- the packaged scenario lane exercises every standard profile and its primary
  failure/recovery path; and
- unprofiled deployments retain RFC 0018 behavior without profile-only
  conditions.
