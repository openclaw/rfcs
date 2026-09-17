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
| G1 Gateway client | Merged OpenClaw #116050 | Unit/socket tests, Linux Tauri tests, current-head static gates | Tauri app-local duplicate transport |
| N1 bounded node foundation | Merged OpenClaw #116050 | Real loopback Gateway invocation plus health/readiness/shutdown | Per-adopter basic node session/runtime scaffolding |
| N2 embeddable lifecycle | Merged OpenClaw #116450 | Shared fixtures and real socket lifecycle, signing, token, reconnect, duplex, manifest, admission tests | Per-adopter signing/reconnect/invocation lifecycle |
| C1 permanent conformance | OpenClaw #150329 | Bilateral TypeScript/Rust lifecycle and authority fixtures plus both complete affected test lanes | Undetected drift between the bounded implementations |
| A1 adopter seam | Future sponsored Windows PR; closed #1068 is prior evidence | Existing C# default, current shared-contract consumers, focused unit suites, protected IPC proof, real Gateway MXC path | Duplicate Windows routing when Rust adapter arrives |
| A2 sidecar adapter | Merged OpenClaw #116863 plus product adapters | Independent authenticated/versioned framing, handshake/configuration, typed ordinary-command bridge, dispatcher routing, exact cross-language corpora, and a real OS child exchanging authenticated frames over product-selected IPC | No deletion; product supervision and production adoption gates remain |
| A2b native ownership seams | OpenClaw #150344 | Native credentials/signing, hostname-bound TLS trust, admission, request lifetime, cancellation, and non-starvable keepalive proof | Per-adopter copies of the same Rust/native boundary |
| A3a launch/bootstrap evidence | Rust fork #12 plus Windows fork #4 | Exact artifact SHA-256 and reparse-path rejection, path locks through launch, self-identity handshake binding, bounded private-pipe bootstrap, real process admission/invocation | No deletion; signing, packaging, Gateway parity and operational adoption remain |
| A3b Gateway connection control | RFC connection fixture plus future OpenClaw and adopter PRs | Negotiated feature gate, per-attempt material acquisition, external signing, issued-token acknowledgement, generation retirement, redaction, and protected-IPC live Gateway proof | Environment/file credential proof paths only; no incumbent production deletion |
| A3 sidecar adoption | Draft macOS #149725 and future sponsored adopters | Verified artifact/launch, protected bootstrap, concrete IPC, Gateway/pairing/token parity, proxy behavior, crash, revocation, audit, resource, rollout and rollback proof | Incumbent product-owned Gateway transport after observation window |
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
| Sidecar connection control | material request/deny, endpoint trust, external signing, token acknowledgement, mismatch fallback, retirement, stale-generation rejection |

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

RFC 0028 also carries draft semantic and cryptographic vectors in
`sidecar-gateway-connection-v1.json`. Its first implementation PR must move or
mirror that fixture into the OpenClaw test corpus, add byte-exact canonical
encodings, and prove independent Rust and adopter consumers before the contract
is considered implemented.

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
- per-attempt credential reacquisition, external signing without private-key
  export, durable issued-token acknowledgement, and authoritative generation
  retirement through the protected sidecar transport;
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

Current-main evidence now includes:

- #116050 merged as `f9a7f104c22`, #116450 as `29069179def`, and #116863 as
  `ce4f1d711bb` after exact-head review, focused Rust/Tauri proof, strict static
  gates, and authenticated separate-process proof;
- #150329 at `3083030ee1a`: a dedicated path-scoped workflow with bilateral
  request/input/progress/result/cancel fixtures, 140 locked Rust tests, 166
  focused TypeScript tests, 639 workflow-guard tests, and a green exact-head
  Node Runtime Conformance run;
- #150344 at `a97e9bdba67`: native credential/signing, hostname-bound trust,
  admission, request-lifetime, and fair control-channel seams with 148 Rust
  tests, green shared iOS/macOS Periphery, macOS Swift tests, and iOS smoke;
- macOS #149725 at `f0ada44a58a`: a focused adopter stack with a signed helper,
  Swift adapter, proxy/PAC-safe URLSession fallback, packaging, and native
  probe harnesses;
- closed Windows #1068: replaceable runtime boundary, shared dispatcher, independent
  C# sidecar consumer, 3,701 Shared and 22 focused Connection tests at
  `711fe095`; the prior head also passed its larger focused, Tray, and full
  Connection suites, and the unchanged C# default path has 2/2 live Gateway
  MXC proof;
- fork-only Rust #11/#12 and Windows #3/#4: real child-process pipes, exact
  artifact hash verification with reparse-safe path locks through launch, bounded secret bootstrap outside arguments,
  environment and files, required handshake artifact binding, 122 shared Rust
  plus 64 focused Windows tests, and three exact fixture blobs; and
- earlier experimental repository package, SBOM, dependency, and provenance
  evidence, which remains evidence history rather than an official release.

Current Gateway protocol v4/node minimum v3 and the
invoke/input/progress/result/cancel envelopes remain compatible. TypeScript
worker/session, workspace, plugin, runner-inventory, and host-statistics
features remain outside bounded Rust v1 unless separately accepted.

Known gaps are final broad CI and review completion for #150329, exact-head
disposable macOS package/signing/install/upgrade/rollback and
functional/performance proof for #149725, implementation of the complete
Gateway connection-control fixture, live Gateway/pairing/token integration
through the packaged sidecar, crash/circuit-breaker/resource/rollback proof, an
embedding/product audit adapter, explicit authorization for the reserved
`system.*` namespace, supported artifact publication, and named release
ownership.

## Promotion and deletion ledger

Every adopter PR must name:

1. the duplicate implementation or process it intends to remove;
2. the owner behavior that remains in place;
3. the conformance evidence covering the replacement;
4. the rollout and rollback control; and
5. the observation window before deletion.

No deletion is credited merely because a Rust alternative compiles.
