# Rust runtime implementation and evidence inventory

This inventory separates the canonical OpenClaw node contract, existing
language implementations, the proposed Rust layers, and the proof available at
the RFC review heads. It is descriptive evidence, not a source of new wire
semantics.

## Reviewed heads

| Repository / surface | Landed or reviewed head | Status |
| --- | --- | --- |
| `openclaw/openclaw` foundation PR #116050 | `f9a7f104c22` | Merged 2026-09-16; shared Gateway client, bounded host, and Linux Tauri consumer |
| `openclaw/openclaw` lifecycle PR #116450 | `29069179def` | Merged 2026-09-16; native ownership hooks and bounded embeddable lifecycle |
| `openclaw/openclaw` sidecar PR #116863 | `ce4f1d711bb` | Merged 2026-09-16; authenticated sidecar bridge and separate-process proof |
| `openclaw/openclaw` conformance PR #150329 | `3083030ee1a` | Open; permanent bilateral TypeScript/Rust lifecycle and authority gate |
| `openclaw/openclaw` native seams PR #150344 | `a97e9bdba67` | Open; reusable signing, TLS trust, admission, request-lifetime, and keepalive seams |
| `openclaw/openclaw` macOS adopter PR #149725 | `f0ada44a58a` | Draft, stacked on #150344; helper, Swift adapter, package/signing integration, proxy-safe routing, and native probes |
| `openclaw/openclaw-windows-node` PR #1068 | `711fe095` | Closed 2026-09-02 without merge; prior seam/adapter evidence only |
| Experimental Rust launch proof #12 | `3d1357f` | Draft, fork-only; protected bootstrap plus deterministic pinned aggregate evidence |
| Experimental Windows launch proof #4 | `199eaa1fcba` | Draft, fork-only; path-locked verified launcher and mandatory artifact identity |
| `openclaw/rfcs` RFC #54 | Current PR head | Ownership decision updated after the foundation merged and native adoption was isolated |
| Experimental `openclaw-rust-node` evidence repository | `1438657c43c` plus refresh branch | Incubation and conformance source projected into OpenClaw PRs; not an independent protocol authority or official distribution |

Exact heads must be refreshed before approval or release.

The implementation was re-derived from current OpenClaw behavior and landed on
2026-09-16. Protocol v4/node minimum v3 and the bounded invocation envelopes
remain compatible. Newer TypeScript worker/session, workspace-transfer, plugin,
runner-inventory, and host-statistics behavior remains outside Rust v1 unless
separately accepted.

## Canonical contract owners

| Surface | Authority | Rust disposition |
| --- | --- | --- |
| Gateway frames, connect, hello, errors | Published Gateway protocol and Gateway server | Consume; do not fork |
| Node invocation/result/input/progress/cancel | Published node schemas plus shared fixtures | Implement only published shapes |
| Pairing and approved command delivery | Gateway device/node pairing behavior | Preserve two distinct authority layers |
| Built-in command semantics and execution policy | TypeScript `src/node-host` and OpenClaw approval/policy owners | Reference; do not infer parity |
| Platform capabilities | Apple, Android, Windows, ESP and product owners | Adapter-owned and manifest-scoped |
| Product process/IPC/UX | Product repository | Remains outside generic Rust crates |

## Implementation comparison

| Implementation | Reusable evidence | Product-specific ownership retained | Do not copy into Rust v1 |
| --- | --- | --- | --- |
| TypeScript `src/node-host` | Generic node role, manifests, invocation lifecycle, reconnect classification, built-in semantics | Node.js process, worker/session hosting, workspace transfer, runner inventory, dynamic plugin/skill channels, host statistics, full execution policy | Transliteration of every command or Node.js assumption |
| Linux Tauri Rust Gateway client | Rust TLS pinning, signed identity, issued-token replacement, stale-token clearing, reconnect, heartbeat, correlation | Tauri UI/operator role, saved/remote Gateway profiles, credential references, switching/recovery, identity/token persistence and desktop lifecycle | Treating an operator client as the node semantic authority or moving profile policy into the transport crate |
| Apple Swift nodes | Connection-scoped route/capability snapshots and reconnect on authority change | TCC, app/worker IPC, Apple UI and native tools | Apple lifecycle or permission APIs |
| Android Kotlin node | Role-separated sessions, role-keyed tokens, bounded token retry, permission-driven inventory | Android service/UI/permission lifecycle | Android storage and foreground-service policy |
| Windows C# node | Backpressure, cancellation, shared capability dispatcher, real Gateway/MXC execution | WinUI, operator role, MCP, approvals, MXC/native tools | Reimplementing Windows routing or policy in Rust |
| ESP C node | Small fixed registry, bounded queues, persisted identity/session behavior | NVS, FreeRTOS and device-specific tool surface | Embedded constraints as universal desktop defaults |
| Proposed Rust stack | Role-neutral client plus bounded node lifecycle/runtime and headless host | Embedding credentials, policy composition, product IPC and handlers | `system.*`, MCP, skills, plugins, or product fields without accepted contracts |
| Moltis Rust node host | Tokio/tungstenite task ownership and a Rust crate layout are feasible | Moltis protocol extensions and execution policy | Its different v4/result shapes or unrestricted `system.run` surface |

Third-party Rust clients may inform dependency or task-ownership choices, but
they are not OpenClaw compatibility authorities.

### Earlier comparison audit pins

The source comparison that shaped the proposal recorded these immutable heads:

| Repository | Audit head | Use |
| --- | --- | --- |
| `openclaw/openclaw` | `98591fda13112737aa73cc23974c68a304e8212d` | TypeScript, Apple, Android, and Tauri analogues |
| `openclaw/openclaw-windows-node` | `fe43b157b56183ed0746ac53315f39fee41aa3c7` | C# node bounds and capability ownership |
| `openclaw/esp-openclaw-node` | `321604b329516712af5e1dc391f526116b2ca414` | Fixed registry, queues, identity and persisted session |
| `moltis-org/moltis` | `9a8d7dd70a97bb119727fe4e66f15fd61f8f44f4` | External Rust feasibility and negative protocol precedent |

Those pins support the comparison only. The PR heads above are the current
Rust/Windows implementation evidence under review.

## Rust surface inventory

### `openclaw-gateway-client` in #116050

- `GatewayClientConfig`, `GatewayClient`, and `GatewaySession`;
- system-root or exact leaf-pin TLS;
- reviewed plaintext-host policy;
- challenge/connect callback;
- correlated bounded requests;
- retained/live events and transport activity;
- typed errors and normalized connect-recovery details; and
- deterministic socket tests for connect, timeout, ping, close, trust, and
  final-event behavior.

It does not persist credentials, supervise reconnect, implement a node role, or
execute commands.

### `openclaw-node-host` foundation in #116050

- Ed25519 `NodeIdentity` and canonical node connect options;
- node activation, invocation/result, cancellation, and reconnect policy;
- bounded `CommandRuntime` and exact handler registration;
- foreground `openclaw-node` proof host;
- loopback health/readiness; and
- one configurable namespaced status command.

### Embeddable follow-up in #116450

- external signing requests and verification;
- typed issued-device-token delivery and rejected-token fallback;
- supervised `NodeLifecycle` with fresh per-attempt material;
- duplex input/progress/heartbeat and UTF-8-safe chunks;
- embedding-owned fail-closed admission;
- connection-scoped command manifests and retired-session cleanup; and
- shared TypeScript/Rust lifecycle and Gateway-authority fixtures.

### Authenticated sidecar bridge in #116863

- authenticated directional framing with replay/session/generation rejection;
- independently negotiated offer/accept handshake and limit lowering;
- immutable configuration and exact manifest acknowledgement;
- bounded admission, invocation, result, cancellation, and status messages;
- `CommandRuntime`/`NodeLifecycle` adapter for ordinary product-native commands;
- a real child-process test exchanging authenticated frames over TCP; and
- three byte-exact language-neutral corpora consumed independently by Windows.

It does not yet carry Gateway endpoint/auth material, external signing
requests/results, issued-token acknowledgement, or connection retirement.
Those are a distinct live control-plane message family, not fields on the
immutable capability configuration.

### Proposed sidecar Gateway connection control

`sidecar-gateway-connection-v1-spec.md` and its draft fixture adapt existing
behavior rather than inventing a new credential model:

- Tauri supplies the custody precedent for endpoint trust, identity signing,
  issued-token persistence, and stale-token clearing;
- `NodeLifecycle` supplies per-attempt reacquisition, external signing, typed
  issued-token delivery, reconnect classification, and secret-free status; and
- Windows supplies endpoint authorization, generation fencing, token recovery,
  and product-owned capability dispatch.

The shared contract adds only the missing protected process boundary. Private
keys remain supervisor-owned, credentials are attempt-scoped, issued tokens
require explicit durable acknowledgement, and revocation retires one exact
connection generation. No implementation PR exists yet.

### Windows adopter seam in #1068

- `INodeRuntimeClient` replaceable client boundary;
- injectable runtime factory;
- transport-independent `NodeCapabilityDispatcher`; and
- one shared C# path for indexing, bounded execution, duplicate tracking,
  cancellation, telemetry, and completion;
- byte-exact C# consumers for the Rust protocol, handshake, and runtime corpora;
- independently recomputed negotiation and immutable manifest acknowledgement;
- bounded admission/outbound queues, cancellation, result/work bounds; and
- ordinary native invocation routing only through `NodeCapabilityDispatcher`.

The adapter remains an in-process, non-selectable proof. It contains no Rust
binary or runtime-selection change and does not implement the verified
Rust artifact/process owner, protected bootstrap, concrete IPC, Gateway
connection/pairing/token lifecycle, health/crash supervision, audit export,
resource proof, rollout, or rollback. The current Rust runtime also rejects the
reserved `system.*` namespace, so Windows `system.run` remains on C# pending an
explicit OpenClaw authorization mechanism.

Fork-only follow-ups #3/#4 launch a real Rust test child over anonymous pipes.
They verify an exact SHA-256 pin while holding native handles on every parent
directory and the artifact through launch, reject reparse-point path components,
deliver the fresh session secret in a bounded private-pipe bootstrap record,
and require the authenticated runtime offer to present the same self-computed
artifact identity. These follow-ups remain non-selectable source evidence; they
do not add package discovery, platform signing, Gateway credentials, restart
policy, or rollout controls to the product.

## Evidence inventory

| Evidence | Environment | Result | Limitation |
| --- | --- | --- | --- |
| Merged foundation | Rust 1.93 plus Linux Tauri, #116050 `f9a7f104c22` | Shared workspace, strict static gates, Tauri unit/integration suites, bounded socket/runtime proof | No supported standalone artifact or release promise |
| Merged embeddable lifecycle | Rust 1.93, #116450 `29069179def` | External signing/token delivery, admission, duplex lifecycle, cancellation, manifest, and cleanup proof | Product credentials, policy, persistence, and native tools remain adapter-owned |
| Merged sidecar bridge | Rust 1.93, #116863 `ce4f1d711bb` | 141 stacked Rust tests and 2/2 authenticated separate-process proofs passed before merge | Shared primitive only; no product package, supervisor, or rollout |
| Permanent conformance gate | #150329 `3083030ee1a` | 140 locked Rust tests, 166 focused TypeScript contract/registry tests, 639 workflow-guard tests, strict Rust static gates and formatting; exact-head Node Runtime Conformance is green | Broad exact-head CI and review are still completing; the gate must remain green as either implementation evolves |
| Reusable native seams | #150344 `a97e9bdba67` | 148 Rust tests and strict static gates; exact-head shared iOS/macOS Periphery, macOS Swift tests, and iOS smoke passed after hostname-bound trust, fair control-channel, declaration/member retention, and SwiftLint fixes | Broader full-CI failures were outside the touched native surface |
| macOS adopter | #149725 `f0ada44a58a` | Focused helper/adapter stack with authenticated IPC, exact JSON, native admission, TLS, cancellation, saturation, proxy/PAC fallback, packaging, signing, and probe harnesses; probe scripts pass the complete repository script-lint shard, formatter, syntax, cleanup-flow review, and are registered as executable Knip roots | Exact-head full CI and disposable-macOS install/upgrade/rollback and functional/performance proof remain required |
| Closed Windows adopter | Windows 11, `711fe095` | 3,701 Shared tests and 22 focused Connection tests passed; the prior head additionally passed the full build, exact three-corpus reproduction, 60 focused, 2,023 Tray, and 519 Connection tests | PR #1068 closed without merge on 2026-09-02; evidence informs a smaller sponsored replacement but is not current adoption proof |
| Protected process launch | Windows 11, Rust `3d1357f`, Windows `199eaa1fcba` | 122 shared Rust and 64 focused Windows tests; three exact fixture blobs; deterministic junction-path, hash, and handshake-identity rejection; private bootstrap and real invocation | Test artifact and source harness; no platform signature, package/update or production selection |
| Windows live MXC | Windows host + isolated Ubuntu WSL + live loopback Gateway | 2/2 allowed/denied `system.run` cases pass | Proves shared dispatcher on C# default path |
| Experimental package acceptance | Linux x64, Windows x64, macOS ARM64 | Build/checksum/extract/execute evidence | Separate experimental repository |
| Dependency/SBOM/provenance | Experimental repository PRs #5/#6 | RustSec, CycloneDX, repository-bound attestations | Not an OpenClaw-supported release |

The shared fixture files include
`test/fixtures/node-invoke-lifecycle-contract.json` and
`test/fixtures/node-runtime-integration-contract.json`. #150329 makes the
lifecycle fixture bilateral across request, input, progress, result, and
cancellation and keeps both TypeScript and Rust consumers in a dedicated,
path-scoped workflow. Sidecar handshake, negotiation, protocol, and runtime
fixtures remain Rust/native-adopter contracts rather than false TypeScript node
host parity.

## Capability gap inventory

| Capability | Rust state | Gate before support |
| --- | --- | --- |
| Gateway session | Implemented draft | Ownership, compatibility and release acceptance |
| Basic node invocation | Implemented draft | Shared canonical fixtures and current-head live Gateway proof |
| Duplex input/progress/cancel | Implemented draft | Complete published node-event corpus and cross-language proof |
| Sidecar IPC | Merged #116863 proves authenticated framing across a real OS child; #150344 exposes reusable native ownership seams; macOS #149725 exercises a signed helper and Swift adapter; closed Windows #1068 and fork #12/#4 remain prior protected-launch evidence | Complete exact-head macOS package and operational proof, implement the remaining connection-control fixture, and prove live Gateway, audit, crash, resource, rollout and rollback behavior |
| Persistent secure identity/token storage | Embedding seam only | Platform adapter and rotation/revocation proof |
| Product audit/export adapter | Not implemented | Stable event contract, correlation/redaction proof, real product audit sink |
| Aggregate retained-event byte budget | Implemented draft: exact count plus aggregate raw-frame bytes; 256 events and 64 MiB by default | Current-head compatibility and load proof before support |
| Windows runtime selection | Not implemented | Opt-in adapter, parity, rollout and rollback |
| `system.which` | Not implemented | Admin-sensitive canonical policy/result corpus |
| `system.run` / PTY | Not implemented | OpenClaw-owned preparation, approval, execution, audit and emergency-disable contracts |
| MCP, skills, plugins | Not implemented | Concrete adopter, owner API, lifecycle and conformance |
| Pending/offline work | Not implemented | Canonical replay/idempotency contract and concrete adopter |
| Supported artifacts | Not published | Named owners, package acceptance, signing, SBOM, servicing and incident response |

## Deletion inventory

| Candidate deletion | Earliest gate | Retained owner surface |
| --- | --- | --- |
| Linux Tauri app-local Gateway transport | #116050 accepted and Tauri proof green | Tauri shell, UI, persistence and operator behavior |
| Per-adopter Rust Gateway/session implementations | Gateway client accepted and supported | Product lifecycle, credentials and adapters |
| Per-adopter node lifecycle/correlation machinery | #116450 conformance accepted | Product policy, approval UX and native handlers |
| Windows C# Gateway transport | Sidecar adapter rollout and rollback complete | WinUI, operator, MCP, approvals, dispatcher and native tools |
| Experimental standalone repository as source of truth | In-tree ownership and release path accepted | Historical evidence and archived provenance |

No deletion is authorized by RFC acceptance alone.

## Open decisions

- maintainer ownership and code owners;
- embed versus sidecar default;
- whether anonymous pipes remain the adopter transport or another concrete IPC is selected;
- supported compatibility window and platforms;
- secure-store adapter ownership;
- canonical approval/tool integration APIs; and
- artifact naming, publication, servicing, and security response.
