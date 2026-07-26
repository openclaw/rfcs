# Standard Hosting Profile v1 Specification

This is the implementer-facing specification for RFC 0023. It defines the v1
standard profile catalog, selection precedence, readiness composition, subject
attribution, host-visible projection, and packaged release scenarios.

Status: draft, tied to RFC 0023 and dependent on RFC 0018.

## Scope

This specification defines:

- the `local`, `container`, `reverse-proxy`, and `node-mode` profiles;
- composition over RFC 0018 readiness criteria;
- opt-in selection through config, environment, or startup argument;
- exact profile predicates and stable non-ready reasons;
- attribution through the RFC 0018 readiness identity package;
- readiness, health, and status projection; and
- packaged release scenarios for the standard catalog.

It does not define a second readiness evaluator, runtime-activation envelope,
config repair system, scheduler policy, OCC resource, AgentHarness protocol,
continuity contract, operator-defined profile, or arbitrary OpenClaw support
promise.

## Dependencies

RFC 0018 owns condition shape, subjects, aggregation, deadlines, provider
bounds, fail-closed behavior, and host-visible projection. Profiles are data
that select reusable criteria and add a small set of runtime-owned predicates.

An unprofiled RFC 0018 runtime remains conformant. Selecting a profile opts into
this specification.

## Compatibility

- Selection is optional and opt-in.
- Upgrade must not select a profile for an unprofiled deployment.
- Profile IDs, predicates, required criteria, and stable reasons are contracts.
- Strengthening a required criterion requires compatibility review, release
  notes, and conformance coverage.
- An invalid explicit profile fails startup validation.
- A new standard profile requires a distinct support posture and packaged
  conformance scenario.

## Standard Catalog

| Profile ID | Runtime posture | Required profile conditions |
| --- | --- | --- |
| `local` | Local or foreground Gateway | `ProfileSelected` |
| `container` | Directly reachable container listener | `local` plus `ContainerStateReady` |
| `reverse-proxy` | Gateway behind a trusted identity proxy | `local` plus `TrustedProxyReady` |
| `node-mode` | Gateway controlling paired execution targets | `local` plus `NodePairingReady`, `ControlledTargetsReady`, `CommandApprovalReady`, `ControlChannelReady` |

A profile describes runtime posture, not packaging. A container behind an
identity proxy selects `reverse-proxy`; a directly reachable container selects
`container`.

Every profile selects these RFC 0018 criteria as required:

- `openclaw.config-current`;
- `openclaw.model-route-ready`;
- `openclaw.plugins-loaded`;
- `openclaw.secrets-ready`;
- `openclaw.workspace-writable`;
- `openclaw.session-storage-ready`;
- `openclaw.context-engine-ready`;
- `openclaw.tool-catalog-ready`;
- `openclaw.mcp-runtime-ready`;
- `openclaw.sandbox-ready`; and
- `openclaw.harness-ready`.

Every profile selects these as advisory:

- `openclaw.event-loop-healthy`;
- `openclaw.state-ready`;
- `openclaw.delivery-runtime-ready`; and
- `openclaw.scheduler-ready`.

The RFC 0018 universal Gateway lifecycle baseline remains in force and cannot
be removed or weakened by a profile.

## Selection

Selection precedence is:

```text
gateway startup argument
> OPENCLAW_HOSTING_PROFILE
> openclaw.json hosting.profile
```

Examples:

```json5
{
  hosting: {
    profile: "container",
  },
}
```

```bash
OPENCLAW_HOSTING_PROFILE=container openclaw gateway run
openclaw gateway run --hosting-profile container
```

An absent value means unprofiled operation, not `local`. The winning value is
validated before destructive lifecycle actions. The effective result records
the profile and selection source.

## Profile Predicates

### Profile Selection

`ProfileSelected` is `True` when precedence resolves to a valid standard
profile. Invalid explicit values fail startup rather than becoming a running
false condition.

### Container

`ContainerStateReady` is `True` when the effective listener is not loopback.
Its stable false reason is `ContainerGatewayLoopback`. It inspects OpenClaw's
listener state, not a container scheduler API.

### Reverse Proxy

`TrustedProxyReady` is `True` when:

- auth mode is `trusted-proxy`;
- a user identity header is configured;
- at least one valid trusted source is configured;
- a loopback listener has a loopback trusted source; and
- use of a loopback source is explicitly allowed.

Stable false reasons are `TrustedProxyAuthMissing`,
`TrustedProxyHeaderMissing`, `TrustedProxySourcesMissing`, and
`TrustedProxyIngressUnsafe`.

This validates effective static auth configuration. Request-time Gateway auth
continues to reject untrusted sources and forged identity headers.

### Node Mode

One correlated approved pairing, connected target, effective command grant,
and live session must satisfy all four predicates. Separate targets cannot
satisfy different rows.

| Condition | True when | Stable non-ready reasons |
| --- | --- | --- |
| `NodePairingReady` | Pairing state is readable and contains an approved pairing. | `NodePairingUnavailable`, `NodePairingTimedOut`, `NodePairingPending`, `NodePairingMissing` |
| `ControlledTargetsReady` | A connected target correlates to an approved pairing generation. | `ControlledTargetsDisconnected` |
| `CommandApprovalReady` | A connected paired target advertises a command allowed by effective grants. | `CommandApprovalMissing` |
| `ControlChannelReady` | A live target session correlates to an approved pairing. | `ControlChannelUnavailable` |

Evaluation uses current cached runtime and pairing state. It does not perform
network discovery or wait for a target. Pairing reads are bounded,
single-flight, and limited to two unresolved generations after timeout.

## Subject Attribution

Profiles reuse the RFC 0018 identity package. They do not define `runtimeId`,
`incarnationId`, or another activation object.

Every selected profile declares:

```ts
{
  ref: "openclaw/hosting-profile/selected";
  kind: "openclaw.hosting-profile";
  id: "local" | "container" | "reverse-proxy" | "node-mode";
  parentRef: "openclaw/gateway/current";
}
```

`ProfileSelected` targets this subject. Container and proxy conditions target
the Gateway and include the profile subject in `relatedSubjectRefs`. The
profile contract version is result metadata, not a generation of the selected
profile object.

Node mode also declares:

- `openclaw/nodes/managed`, kind `openclaw.node-controller`, parented by the
  Gateway; and
- a deterministic subset of at most 16 paired node subjects observed during
  evaluation, with a one-way fingerprint of pairing generation when available.

Node-mode aggregate conditions target `openclaw/nodes/managed` and list the
observed node subjects as related subjects. Aggregate counts cover the complete
paired-node set even when related subjects are truncated. Node IDs must not be
copied into a subject ref; implementations use a deterministic bounded opaque
key and prioritize actionable disconnected subjects.

Gateway, process, and optional host-workload identities are owned by RFC 0018.
OpenClaw generates a Gateway ID at every serving-lifecycle start and a process
ID at process start. `OPENCLAW_INSTANCE_ID`, when supplied, becomes only a
fingerprinted host-workload subject; it never overrides either generated child
identity.

## Host-Visible Result

A profiled canonical result adds:

```ts
type ProfiledReadinessResult = ReadinessResult & {
  profileContractVersion: 1;
  profile: "local" | "container" | "reverse-proxy" | "node-mode";
  profileSource: "argument" | "environment" | "config";
};
```

The identity package carries runtime attribution. For example, a container
profile with a loopback listener returns `503`:

```json
{
  "contractVersion": 1,
  "profileContractVersion": 1,
  "profile": "container",
  "profileSource": "config",
  "ready": false,
  "identity": {
    "producerRef": "openclaw/gateway/current",
    "subjects": [
      {
        "ref": "openclaw/process/current",
        "kind": "openclaw.process",
        "id": "process-opaque-id"
      },
      {
        "ref": "openclaw/gateway/current",
        "kind": "openclaw.gateway",
        "id": "gateway-opaque-id",
        "parentRef": "openclaw/process/current"
      },
      {
        "ref": "openclaw/hosting-profile/selected",
        "kind": "openclaw.hosting-profile",
        "id": "container",
        "parentRef": "openclaw/gateway/current"
      }
    ]
  },
  "conditions": [
    {
      "type": "ContainerStateReady",
      "subjectRef": "openclaw/gateway/current",
      "relatedSubjectRefs": ["openclaw/hosting-profile/selected"],
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

After the listener satisfies the predicate, the same endpoint returns `200`.
Hosts use canonical readiness and do not need a profile-specific probe API.
If evaluation times out or throws, the result remains `503` and retains the
selected profile metadata and profile subject.

## Operator Extensions

V1 supports only the four standard names. Operators may add required or
advisory RFC 0018 criteria directly through `gateway.readiness`, including
while a profile is selected. Named operator profiles and inheritance are not
part of V1.

## Packaged Scenario Gate

The package-installed Docker lane probes the same canonical `/readyz` result
used by hosts. It must prove:

- unchanged unprofiled behavior;
- explicit `local` success and workspace failure/recovery;
- `container` success and loopback failure;
- `reverse-proxy` success and missing-auth failure;
- `node-mode` unpaired/unapproved failure and paired/approved recovery;
- stable profile metadata and subject attribution; and
- exact condition status and profile contract version.

Upgrade survival, direct-ingress security, immutable records, and signed
attestations are follow-up gates, not V1 runtime semantics.

## Ownership

OpenClaw owns profile IDs, predicates, reasons, precedence, subject attribution,
projection, and packaged scenarios. Hosts own selection, manifests, probe
timing, restart policy, placement, tenants, rollout, telemetry, and additional
operator-selected RFC 0018 criteria.

## Conformance Checklist

- No profile is selected by default or upgrade.
- Every selection source works with deterministic precedence.
- Invalid explicit profiles fail startup validation.
- Every profile composes the documented criteria.
- Every profiled result identifies its profile through metadata and subjects.
- Node conditions identify the observed controller and related node set.
- Profile failures use stable reasons and canonical aggregation.
- Timeout and exception results remain bounded, fail closed, and retain profile
  attribution.
- Readiness, health, and status project the same profile result.
- Packaged scenarios exercise each profile's primary success and recovery path.
- Unprofiled deployments retain RFC 0018 behavior.
