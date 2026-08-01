# Rust runtime implementation and evidence inventory

This inventory separates the canonical OpenClaw node contract, existing
language implementations, the proposed Rust layers, and the proof available at
the RFC review heads. It is descriptive evidence, not a source of new wire
semantics.

## Reviewed heads

| Repository / surface | Reviewed head | Status |
| --- | --- | --- |
| `openclaw/openclaw` foundation PR #116050 | `41f4e705887` | Draft; Rust client/host plus Linux Tauri consumer |
| `openclaw/openclaw` follow-up PR #116450 | `894d125ee76` | Draft; logically stacked on #116050 |
| `openclaw/openclaw` sidecar PR #116863 | `8d0a1b013ea` | Draft; logically stacked on #116450; consolidates fork evidence #193-#195 |
| `openclaw/openclaw-windows-node` PR #1068 | `3ca913a43a6` | Draft; seam plus independent sidecar adapter; C# remains production default |
| Experimental Rust launch proof #12 | `b63baf2` | Draft, fork-only; protected bootstrap plus pinned aggregate evidence |
| Experimental Windows launch proof #4 | `70a378180da` | Draft, fork-only; path-locked verified launcher and mandatory artifact identity |
| `openclaw/rfcs` RFC #54 | Current PR head | Draft ownership decision; this inventory is refreshed with each evidence change |
| Experimental `openclaw-rust-node` evidence repository | merged PRs #1-#5; draft #6 | Evidence history, not official distribution |

Exact heads must be refreshed before approval or release.

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
| TypeScript `src/node-host` | Generic node role, manifests, invocation lifecycle, reconnect classification, built-in semantics | Node.js process, dynamic plugin/skill inventory, full execution policy | Transliteration of every command or Node.js assumption |
| Linux Tauri Rust Gateway client | Rust TLS pinning, signed identity, reconnect, heartbeat, correlation | Tauri UI/operator role, persistence and desktop lifecycle | Treating an operator client as the node semantic authority |
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
  and
- three byte-exact language-neutral corpora consumed independently by Windows.

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
| Foundation Rust workspace | Ubuntu 24.04 WSL2, Rust 1.93, `41f4e705887` | 56 tests; strict Clippy/format/diff pass | No deployed production Gateway at latest head |
| Foundation host/socket proof | Ubuntu 24.04 WSL2, Rust 1.93, `13242763f3d` | Health 200, pre-ready 503, clean shutdown, real loopback invocation | Earlier proof head; in-process Gateway harness |
| Linux Tauri suite | Linux proof head | 98/98 passed | Not a packaged desktop UI build |
| Embeddable stack | Ubuntu 24.04 WSL2, Rust 1.93, `894d125ee76` | 73 workspace tests; strict Clippy/rustdoc/format/diff pass | In-process Gateway peer for follow-up behaviors |
| Shared fixtures | Rust current-head consumer plus canonical TypeScript validators | Rust lifecycle and Gateway-authority consumers pass at `894d125ee76`; earlier hosted TypeScript lanes passed | Final-head TypeScript UTF-8 validator tests are pending because the local dependency fetch failed TLS negotiation |
| OpenClaw sidecar bridge | Rust workspace, `8d0a1b013ea` | 110 workspace tests; strict Clippy/rustdoc/format/diff pass; exact three-corpus producer/consumer proof | Source harness; no concrete process/IPC/bootstrap |
| Windows adopter | Windows 11, `3ca913a43a6` | Full build; exact three-corpus reproduction; 60 focused, 3,462 Shared, 2,023 Tray, and 519 Connection tests; Codex and three-model reviews clean | C# remains selected; adapter is in-process and non-selectable |
| Protected process launch | Windows 11, Rust `b63baf2`, Windows `70a378180da` | 122 shared Rust and 64 focused Windows tests; three exact fixture blobs; hash, reparse-path, and handshake-identity rejection; private bootstrap and real invocation | Test artifact and source harness; no platform signature, package/update or production selection |
| Windows live MXC | Windows host + isolated Ubuntu WSL + live loopback Gateway | 2/2 allowed/denied `system.run` cases pass | Proves shared dispatcher on C# default path |
| Experimental package acceptance | Linux x64, Windows x64, macOS ARM64 | Build/checksum/extract/execute evidence | Separate experimental repository |
| Dependency/SBOM/provenance | Experimental repository PRs #5/#6 | RustSec, CycloneDX, repository-bound attestations | Not an OpenClaw-supported release |

The shared fixture files are
`test/fixtures/node-invoke-lifecycle-contract.json` and
`test/fixtures/node-runtime-integration-contract.json`; both have TypeScript and
Rust consumers at the reviewed stacked head. The Rust consumer passed at the
current head. The final TypeScript validator execution remains pending after a
repeated package-registry TLS failure; hosted TypeScript lanes passed before the
final UTF-8 validator correction.

## Capability gap inventory

| Capability | Rust state | Gate before support |
| --- | --- | --- |
| Gateway session | Implemented draft | Ownership, compatibility and release acceptance |
| Basic node invocation | Implemented draft | Shared canonical fixtures and current-head live Gateway proof |
| Duplex input/progress/cancel | Implemented draft | Complete published node-event corpus and cross-language proof |
| Sidecar IPC | OpenClaw #116863 plus Windows #1068 implements both sides of authenticated framing and adapter routing; fork #12/#4 proves anonymous-pipe transport, exact hash launch, protected bootstrap, and handshake artifact binding | Accept `sidecar-hosting-v1-spec.md`; prove platform signing/package delivery plus duplex Gateway, audit, crash, resource, rollout and rollback behavior |
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
