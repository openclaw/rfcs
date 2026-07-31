# Rust runtime conformance and adoption plan

This plan turns RFC 0028 into independently reviewable acceptance gates. Code,
fixtures, live proof, and deletion must agree before a layer is called
supported.

## Evidence principles

- The OpenClaw Gateway protocol is the wire authority.
- TypeScript `src/node-host` is the node behavioral reference until a shared
  fixture replaces an implementation-specific interpretation.
- Tauri, Swift, Kotlin, C#, and ESP implementations are analogues and evidence,
  not independent schema authorities.
- A source harness proves runtime mechanics; a real Gateway proves integration;
  a packaged adopter proves deployment.
- Every proof records exact repository, head, OS/toolchain, command, result,
  and known gap.
- A layer may land without later layers. No proof for a higher layer rewrites
  the ownership or safety bar of a lower layer.

## Acceptance layers

| Layer | Review surface | Required proof | Deletion unlocked |
| --- | --- | --- | --- |
| G1 Gateway client | OpenClaw #116050 | Unit/socket tests, Linux Tauri tests, current-head static gates | Tauri app-local duplicate transport |
| N1 bounded node foundation | OpenClaw #116050 | Real loopback Gateway invocation plus health/readiness/shutdown | Per-adopter basic node session/runtime scaffolding |
| N2 embeddable lifecycle | OpenClaw #116450 | Shared fixtures and real socket lifecycle, signing, token, reconnect, duplex, manifest, admission tests | Per-adopter signing/reconnect/invocation lifecycle |
| A1 adopter seam | Windows #1068 | Existing C# default, full unit suites, real Gateway MXC path | Duplicate Windows routing when Rust adapter arrives |
| A2 sidecar adapter | OpenClaw fork evidence #193-#195 plus future adopter PR | Authenticated/versioned framing, handshake/configuration, typed ordinary-command bridge, parity, crash, revocation, resource, rollout and rollback proof | Incumbent product-owned Gateway transport after rollout |
| R1 supported release | future OpenClaw release decision | Package acceptance, signing/provenance, SBOM, compatibility, servicing and security runbooks | Experimental-only packaging and private distribution |

## Shared fixture families

The conformance corpus must cover:

| Family | Minimum cases |
| --- | --- |
| Connect | challenge ordering, canonical signed metadata, accepted protocol, structured rejection |
| Identity/auth | configured credential, issued token, rejected issued token, pairing and re-pairing |
| Manifest | deterministic order, empty surface, widening/reapproval, retired generation |
| Invocation | success, structured handler failure, unsupported command, duplicate ID, saturation |
| Duplex | ordered input, oversized input, UTF-8 progress, heartbeat, late/duplicate frames |
| Cancellation | before dispatch, during admission, active handler, input wait, disconnect, shutdown |
| Authority | Gateway permits delivery; local admission narrows; neither side broadens the other |
| Recovery | retryable transport/TLS, terminal auth/config/protocol, backoff reset, token fallback |
| Observability | stable state/reason codes, redaction, approved-but-failed distinct from denial |

Fixtures must identify their canonical source and version. Unknown additive
fields must be exercised where the protocol permits them. A fixture must fail
in at least one deliberately nonconforming implementation or mutation so it is
evidence rather than a happy-path snapshot.

The current seed corpus is
`test/fixtures/node-invoke-lifecycle-contract.json`, consumed by the published
Gateway-protocol tests and Rust node tests, plus
`test/fixtures/node-runtime-integration-contract.json`, consumed by the
TypeScript integration-contract test and Rust authority/admission test. These
are seeds, not a claim that the complete node contract is already projected.

## Validation ladder

### Per-commit checks

- formatting and diff hygiene;
- focused unit tests for the changed contract;
- strict lint and rustdoc warnings;
- schema/fixture drift validation when shared artifacts change.

### Per-PR checks

- complete affected Rust workspace tests;
- TypeScript validation for shared fixtures;
- real loopback socket tests for transport/lifecycle behavior;
- current-head independent review with findings mapped to fixes;
- an exact Real behavior proof section in the PR body.

### Adoption checks

- actual packaged supervisor and runtime, not only a library harness;
- live Gateway pairing, invocation, cancellation, reconnect, and revocation;
- allowed and denied platform capability paths;
- sidecar crash, supervisor crash, IPC loss, version mismatch, and rollback;
- finite bootstrap-stage deadlines, pre-negotiation ceilings, and negotiated
  limits that cannot exceed either peer's local policy;
- duplicate authenticated-sequence and retired-session replay rejection without
  native redispatch;
- startup/steady-state resource measurements; and
- audit correlation through the product's real audit/export path without
  credential or raw-error disclosure.

## Compatibility matrix

Before a supported release, test the candidate against:

- the exact current supported Gateway release;
- the declared predecessor release (N-1) where OpenClaw promises compatibility;
- OpenClaw `main` as a non-gating drift canary; and
- each supported target OS/artifact architecture.

Compatibility is a declared window, not best effort. A failing predecessor lane
either blocks the release or causes an explicit support-window change reviewed
with migration guidance.

## Security gates

The following are blocking:

- insecure endpoint or certificate-pin fallback;
- unbounded request, event, invocation, input, output, or restart state;
- authority broadening by local admission or product IPC;
- secret-bearing logs, command lines, or public errors;
- cancellation gaps that leave approved work running after revocation,
  disconnect, session retirement, or shutdown;
- runtime selection without authenticated version negotiation; and
- deletion of the incumbent path before rollback is proved.

## Release gates

An official crate or binary requires named OpenClaw owners for protocol,
security, release, and incident response. Candidate artifacts require exact
checksums, repository-bound provenance, dependency audit, SBOM, code signing
where the platform requires it, fresh-machine install smoke, upgrade and
rollback instructions, and a stated compatibility/support window.

Workspace tests alone do not authorize publication.

## Evidence already available

The current drafts provide:

- #116050: reusable Gateway client, bounded host, Tauri migration, real
  loopback node/health proof, and 56 Rust workspace tests at `41f4e705887`;
- #116450: lifecycle/signing/token, duplex/admission/manifest conformance and
  73 stacked Rust tests at `894d125ee76`;
- Windows #1068: replaceable runtime boundary, shared dispatcher, full C# test
  suites, and 2/2 live Gateway MXC tests at `c0cfa8ba6680`; and
- earlier experimental repository package, SBOM, dependency, and provenance
  evidence, which remains evidence history rather than an official release.

Known gaps are a production/deployed Gateway run for the latest Rust heads, the
authenticated/versioned product IPC adapter, sidecar failure/resource/rollback
proof, an embedding/product audit adapter, supported artifact publication, and
maintainer ownership acceptance.

## Promotion and deletion ledger

Every adopter PR must name:

1. the duplicate implementation or process it intends to remove;
2. the owner behavior that remains in place;
3. the conformance evidence covering the replacement;
4. the rollout and rollback control; and
5. the observation window before deletion.

No deletion is credited merely because a Rust alternative compiles.
