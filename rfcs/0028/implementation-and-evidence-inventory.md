# Rust runtime implementation and evidence inventory

This inventory separates the canonical OpenClaw node contract, existing
language implementations, the proposed Rust layers, and the proof available at
the RFC review heads. It is descriptive evidence, not a source of new wire
semantics.

## Reviewed heads

| Repository / surface | Reviewed head | Status |
| --- | --- | --- |
| `openclaw/openclaw` foundation PR #116050 | `7600501dd50` | Draft; Rust client/host plus Linux Tauri consumer |
| `openclaw/openclaw` follow-up PR #116450 | `c533982d751` | Draft; logically stacked on #116050 |
| `openclaw/openclaw-windows-node` PR #1068 | `194928fdc0c8` | Draft; C# remains production default |
| `openclaw/rfcs` RFC #54 | `cdc10f5a4a9d` before these companion docs | Draft ownership decision |
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

### Windows adopter seam in #1068

- `INodeRuntimeClient` replaceable client boundary;
- injectable runtime factory;
- transport-independent `NodeCapabilityDispatcher`; and
- one shared C# path for indexing, bounded execution, duplicate tracking,
  cancellation, telemetry, and completion.

It contains no Rust binary, IPC protocol, runtime-selection change, or deletion
of the C# Gateway client.

## Evidence inventory

| Evidence | Environment | Result | Limitation |
| --- | --- | --- | --- |
| Foundation Rust workspace | Windows 11, Rust 1.95, `7600501dd50` | 47 tests; strict Clippy/rustdoc/format/diff pass | No deployed production Gateway at latest head |
| Foundation host/socket proof | Ubuntu 24.04 WSL2, Rust 1.93, `13242763f3d` | Health 200, pre-ready 503, clean shutdown, real loopback invocation | Earlier proof head; in-process Gateway harness |
| Linux Tauri suite | Linux proof head | 98/98 passed | Not a packaged desktop UI build |
| Embeddable stack | Windows 11, Rust 1.95, `c533982d751` | 62 workspace tests and strict static gates | In-process Gateway peer for follow-up behaviors |
| Shared fixtures | Rust plus canonical TypeScript validators | Lifecycle and Gateway-authority cases pass | Corpus is not yet the complete node contract |
| Windows adopter | Windows 11, `194928fdc0c8` | 3,402 Shared, 2,022 Tray, 516 Connection tests | Rust adapter not present |
| Windows live MXC | Windows host + isolated Ubuntu WSL + live loopback Gateway | 2/2 allowed/denied `system.run` cases pass | Proves shared dispatcher on C# default path |
| Experimental package acceptance | Linux x64, Windows x64, macOS ARM64 | Build/checksum/extract/execute evidence | Separate experimental repository |
| Dependency/SBOM/provenance | Experimental repository PRs #5/#6 | RustSec, CycloneDX, repository-bound attestations | Not an OpenClaw-supported release |

The shared fixture files are
`test/fixtures/node-invoke-lifecycle-contract.json` and
`test/fixtures/node-runtime-integration-contract.json`; both have TypeScript and
Rust consumers at the reviewed stacked head.

## Capability gap inventory

| Capability | Rust state | Gate before support |
| --- | --- | --- |
| Gateway session | Implemented draft | Ownership, compatibility and release acceptance |
| Basic node invocation | Implemented draft | Shared canonical fixtures and current-head live Gateway proof |
| Duplex input/progress/cancel | Implemented draft | Complete published node-event corpus and cross-language proof |
| Sidecar IPC | Not implemented; current foreground proof host uses environment-indirected secrets | Accept `sidecar-hosting-v1-spec.md`, choose transport, build authenticated launch/adapter |
| Persistent secure identity/token storage | Embedding seam only | Platform adapter and rotation/revocation proof |
| Product audit/export adapter | Not implemented | Stable event contract, correlation/redaction proof, real product audit sink |
| Aggregate retained-event byte budget | Count-bounded only | Accept measured supported envelope or add byte-aware retention without collapsing small-event capacity |
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
- concrete IPC transport and encoding;
- supported compatibility window and platforms;
- secure-store adapter ownership;
- canonical approval/tool integration APIs; and
- artifact naming, publication, servicing, and security response.
