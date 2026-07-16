# Standard Hosting Profile v1 Specification

This document is the implementer-facing specification for RFC 0023, Standard
Hosting Profiles. The RFC explains the motivation, support model, and rollout
plan. This file defines the v1 standard profile catalog, condition composition,
selection precedence, activation identity, operator extension, host-visible
result, and packaged conformance contract.

Status: draft, tied to RFC 0023 and dependent on RFC 0018.

## Scope

This specification defines:

- the `local`, `container`, `reverse-proxy`, and `node-mode` standard profiles;
- composition over canonical readiness criteria from RFC 0018;
- opt-in selection through config, environment, or startup arguments;
- exact profile predicates and stable non-ready reasons;
- logical runtime and unique incarnation identity;
- additive operator profiles;
- readiness, health, and status projection; and
- packaged release conformance records and minimum scenarios.

This specification does not define:

- the readiness condition schema or plugin provider API;
- config generation, merge, repair, or policy enforcement;
- scheduler retry intervals, placement, routing, tenants, or rollout;
- OCC resources or the AgentHarness event protocol;
- checkpoint durability or safe destruction; or
- support for arbitrary OpenClaw configurations outside the standard catalog.

## Dependencies

This specification requires the canonical condition, aggregation, bounded
evaluation, and projection contract defined by RFC 0018. Profiles are data that
select and classify reusable criteria. They do not define a second evaluator.

An implementation that has no selected profile remains a valid RFC 0018
runtime. Selecting a profile adds the contract in this specification.

## Terminology

- **Standard profile**: an OpenClaw-owned, named runtime posture with stable
  predicates and packaged release conformance.
- **Operator profile**: an operator-owned additive extension of exactly one
  standard profile.
- **Universal baseline**: RFC 0018 conditions that apply with or without a
  profile.
- **Profile criterion**: a reusable readiness criterion selected by a profile.
- **Logical runtime ID**: identity that may remain stable across process or
  container replacement.
- **Incarnation ID**: identity unique to one running process or container
  activation.
- **Conformance record**: immutable evidence that one artifact passed one
  standard profile contract version.

## Compatibility And Evolution

Hosting Profile v1 uses these compatibility rules:

- profile selection is optional and opt-in;
- an upgrade must not select a profile for an existing unprofiled deployment;
- standard profile IDs, predicates, required condition types and criterion
  selectors, and stable reasons are compatibility contracts;
- adding or strengthening a required criterion changes host behavior and
  requires compatibility review, release notes, and conformance coverage;
- operator profiles may strengthen but never weaken a standard profile;
- unknown explicit profile values fail startup validation; and
- new standard profiles require a separately reviewable support posture and
  release conformance scenario.

## Standard Profile Catalog

The v1 standard catalog composes this exact ordered set of additional required
condition types over the RFC 0018 universal baseline:

| Profile ID | Runtime posture | Additional required condition types, in order |
| --- | --- | --- |
| `local` | Explicit local or foreground Gateway | `ProfileSelected`, `RuntimeActivationIdentified`, `WorkspaceWritable` |
| `container` | Gateway directly reachable through a container listener | `ProfileSelected`, `RuntimeActivationIdentified`, `WorkspaceWritable`, `ContainerStateReady` |
| `reverse-proxy` | Gateway behind a trusted identity proxy | `ProfileSelected`, `RuntimeActivationIdentified`, `WorkspaceWritable`, `TrustedProxyReady` |
| `node-mode` | Gateway controlling one or more paired execution targets | `ProfileSelected`, `RuntimeActivationIdentified`, `WorkspaceWritable`, `NodePairingReady`, `ControlledTargetsReady`, `CommandApprovalReady`, `ControlChannelReady` |

A profile describes runtime posture, not packaging. A container behind an
identity proxy selects `reverse-proxy`; a container with a directly reachable
listener selects `container`.

The RFC 0018 universal baseline remains required and cannot be removed,
replaced, or weakened by a profile.

`WorkspaceWritable` is selected through the RFC 0018 criterion ID
`openclaw.workspace-writable`. The remaining additional condition types are
profile-owned predicates and are not independently operator-selectable in v1.

## Profile Criteria

### Profile Selection

`ProfileSelected` is `True` when selection precedence resolves to a valid
standard or configured operator profile. Invalid explicit values fail startup
validation rather than becoming a running false condition.

### Runtime Activation Identity

`RuntimeActivationIdentified` is `True` when both logical runtime and unique
incarnation identities are non-empty and valid.

Stable non-ready reasons are:

- `RuntimeIdentityInvalid`;
- `IncarnationIdentityInvalid`; and
- `ActivationIdentityUnavailable`.

### Host Assertions

Hosts may assert expected profile and immutable artifact identity. These
conditions follow the standard profile set when configured:

| Condition type | True when | Stable non-true reasons |
| --- | --- | --- |
| `ProfileExpectationMatches` | The selected profile equals the host assertion. | `ExpectedProfileMismatch`, `ExpectedProfileNotSelected` |
| `ArtifactIdentityMatches` | The running immutable artifact identity equals the host assertion. | `ArtifactIdentityMismatch`, `ArtifactIdentityNotChecked` |

### Container

`ContainerStateReady` is `True` when the effective Gateway mode is local and
the resolved listener host is not loopback.

Stable non-ready reasons are:

- `ContainerGatewayRemote`;
- `ContainerGatewayLoopback`; and
- `ContainerBindNotResolved`.

This criterion validates OpenClaw's effective listener state. It does not
inspect Docker, Kubernetes, ECS, Nomad, or another scheduler API.

### Reverse Proxy

`TrustedProxyReady` is `True` when:

- effective auth mode is `trusted-proxy`;
- a user identity header is configured; and
- at least one trusted proxy source is configured; and
- the active Gateway ingress contract accepts asserted identity only from a
  validated trusted source and does not honor a client-supplied identity header
  on direct or untrusted ingress.

Stable non-ready reasons are:

- `TrustedProxyAuthMissing`;
- `TrustedProxyHeaderMissing`; and
- `TrustedProxySourcesMissing`; and
- `TrustedProxyIngressUnsafe`.

Loopback is valid when a trusted proxy is colocated with the Gateway.

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
semantics. Evaluation consumes a bounded activation snapshot; readiness polling
must not scan unbounded pairing or session stores.

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

An absent value means unprofiled operation; it must not imply `local`. Every
supplied value is validated, then the highest-precedence valid source wins.
Different valid lower-precedence values are ordinary overrides and do not fail
startup. Empty, malformed, or unknown explicit values fail validation before
destructive lifecycle actions.

The effective result records the profile and winning selection source. A probe
may assert an expected profile, but that assertion does not select or mutate the
running profile. When supplied, mismatch or absence emits required
`ProfileExpectationMatches=False` with reason `ExpectedProfileMismatch` or
`ExpectedProfileNotSelected`.

Profiles validate effective runtime state. They do not generate or repair the
underlying Gateway, proxy, plugin, model, node, or storage configuration.

## Runtime Activation Identity

Every profiled result is attributable to one activation:

```ts
type RuntimeActivationSummary = {
  runtimeId: string;
  incarnationId: string;
  profile: string;
  configGeneration?: string;
  hostIntegrationGeneration?: string;
  restoreGeneration?: string;
};
```

Launchers may provide identity through startup arguments, environment, or a
mounted activation descriptor. Local runs may receive generated defaults.
Explicit invalid identity must fail startup instead of silently falling back.

The activation summary is redacted. Generation values reference contracts
owned by Managed Configuration, Hosted Integration, and Runtime State
Continuity; the profile does not copy their evidence or redefine their meaning.

Logical runtime identity may survive replacement. Incarnation identity must be
unique for each process/container activation. OCC may supply these values, but
the OpenClaw runtime plane evaluates and reports the live activation.

## Operator Profiles

An operator profile extends exactly one standard profile and adds canonical
criterion IDs:

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

V1 operator profiles follow these rules:

- `extends` names exactly one standard profile;
- required and advisory lists use RFC 0018 namespaced criterion IDs;
- inherited required conditions cannot be removed or weakened;
- the same ID cannot appear in both lists;
- standard profile IDs and core criterion IDs are reserved;
- unknown required provider IDs fail closed; and
- the operator or plugin owner owns added support semantics.

OpenClaw release conformance covers the inherited standard baseline, not
operator additions. V1 does not permit operator-profile inheritance chains.

## Host-Visible Result

The canonical readiness result may add these optional v1 profile fields:

```ts
type ProfiledReadinessResult = ReadinessResult & {
  profileContractVersion: 1;
  profile: string;
  profileSource: "argument" | "environment" | "config";
  activation: RuntimeActivationSummary;
  conformance?: HostingProfileConformanceSummary;
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

## Packaged Conformance

A standard profile is an OpenClaw support promise only when the release process
tests the exact packaged artifact. The v1 record is:

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

type HostingProfileConformanceSummary = {
  artifactDigest?: string;
  profileContractVersion: number;
  profile: string;
  result: "passed" | "failed" | "unknown";
  conditionContractVersion?: number;
};
```

Runtime readiness may read and project packaged conformance metadata. It must
not rerun release tests. Source and development runs may report conformance as
advisory `Unknown`. The record is release evidence, not by itself a security
attestation. A distribution that makes an authenticated provenance claim must
publish and verify a signed attestation referenced by `attestationRef`.

If a host supplies an immutable expected artifact identity, a mismatch is a
required `ArtifactIdentityMatches=False` condition with reason
`ArtifactIdentityMismatch`; unavailable verification is required `Unknown`
with reason `ArtifactIdentityNotChecked`. The expectation must not be satisfied
by mutable version text alone.

### Minimum V1 Matrix

The packaged matrix must prove:

- unchanged unprofiled readiness after upgrade;
- explicit `local` success and writable-workspace failure/recovery;
- `container` success and loopback-listener failure;
- `reverse-proxy` success, missing-auth failure, direct-ingress rejection, and
  forged identity-header rejection;
- `node-mode` unpaired failure, wrong-target correlation failure, and
  paired/approved recovery;
- activation identity presence and incarnation replacement; and
- exact profile condition sets, profile contract version, and expected-artifact
  mismatch behavior; and
- agreement among `/ready`, `/readyz`, health, status, and any readiness CLI.

Records must bind the exact artifact digest, profile ID, profile contract
version, condition contract version, required criterion set, suite identity,
completion time, and available build provenance.

## Ownership

OpenClaw owns:

- standard profile IDs and definitions;
- profile-specific predicates and stable reasons;
- selection precedence and projection;
- activation identity semantics; and
- packaged conformance for the standard catalog.

Hosts own:

- profile selection;
- container and scheduler manifests;
- probe timing, retries, and restart policy;
- placement, routing, tenants, and rollout;
- telemetry sinks and fleet alerts; and
- support for operator-added criteria.

## Conformance Checklist

An implementation conforms to Hosting Profile v1 when it proves:

- no profile is selected by default or by upgrade;
- each selection source works and precedence is deterministic;
- invalid explicit profile or identity fails startup validation;
- every standard profile composes the exact documented criteria;
- operator profiles are additive and cannot weaken their standard parent;
- profiled results identify logical runtime and unique incarnation;
- profile failures use stable reasons and canonical readiness aggregation;
- all host-visible surfaces describe the same activation and profile result;
- packaged evidence binds an immutable artifact and contract version; and
- unprofiled deployments retain RFC 0018 behavior without profile-only
  conditions.
