---
title: OpenClaw-owned Rust node runtime
authors:
  - Gio Della-Libera
created: 2026-07-29
last_updated: 2026-07-30
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/54
---

# Proposal: OpenClaw-owned Rust node runtime

## Summary

OpenClaw should own a reusable, headless Rust node runtime in the OpenClaw
repository. Product shells—including Microsoft's Windows Companion and system
tray work in Microsoft-owned Edge/Chromium repositories—should embed or launch
that runtime through narrow adapters instead of implementing a separate node.
This gives Windows Companion and Scout Cloud a common OpenClaw node to manage,
while each product keeps ownership of its user experience, native tools,
packaging, and deployment.

This RFC records the requested ownership split. Microsoft product stakeholders
want the Windows shell to remain with the Edge/Chromium product, while Scott
Hanselman has asked that the reusable runtime be owned by OpenClaw under Peter's
maintainer leadership. The latter is a proposal for OpenClaw maintainer
agreement, not a claim that the ownership decision has already been accepted.

## Motivation

OpenClaw already has a TypeScript node host, and its Tauri application has Rust
code that connects to the Gateway. Neither is the right reusable boundary for a
Windows-native product that intends to run without a Node.js or Tauri runtime:

- `src/node-host` combines the canonical node behavior with a TypeScript/Node.js
  implementation and process assumptions.
- Tauri is an application shell and consumer of Gateway connectivity, not a
  complete headless node runtime.
- A Rust-to-TypeScript wrapper would retain the Node.js dependency and split
  lifecycle, cancellation, and security ownership across two runtimes.
- Implementing the node directly in Edge/Chromium would make protocol and policy
  drift likely and would not give Scout Cloud or other native hosts a reusable
  OpenClaw implementation.

The desired Windows architecture is materially simpler when the product shell
can delegate the portable execution plane:

```text
Windows Companion
  Tray / Settings / Windows UX / Windows-native tools / IPC adapter
                              |
                              v
                    OpenClaw Rust runtime
  Gateway client / protocol / node lifecycle / invocation execution /
        input and progress / cancellation / approval integration
                              |
                              v
                           Gateway
                              ^
                              |
                 Scout Cloud management plane
```

One implementation and conformance suite can then serve native desktop shells,
headless deployments, and managed-node scenarios without transferring ownership
of those products into OpenClaw.

## Goals

- Establish OpenClaw as the owner of the portable Rust node runtime, its Gateway
  contract, security invariants, conformance tests, and release compatibility.
- Keep Microsoft-specific tray, settings, Windows UX, native-tool adapters,
  signing, packaging, and deployment in Microsoft-owned repositories.
- Provide a headless runtime that can be embedded in-process or launched as a
  sidecar without requiring Tauri or Node.js.
- Allow Windows Companion and Scout Cloud to manage the same node identity and
  lifecycle through canonical Gateway APIs.
- Reuse OpenClaw's command, approval, cancellation, and policy semantics rather
  than defining a Microsoft-specific wire profile.
- Preserve incremental value: the Gateway client can be used independently of
  the complete node host.
- Let OpenClaw maintainers accept the Rust commitment incrementally—from the
  shared client, through the bounded node-role subset, up to broader native
  node-mode parity—without making later layers prerequisites for earlier ones.
- Keep every accepted runtime and capability API customer-neutral so native,
  embedded, appliance, and headless adopters can reuse it without Microsoft
  product dependencies or a product-specific protocol profile.

## Non-Goals

- Moving Windows Companion, the system tray, or Edge/Chromium product code into
  the OpenClaw repository.
- Replacing Tauri or requiring native consumers to use Tauri.
- Making OpenClaw responsible for Microsoft product UX, native tool
  implementations, IPC, signing, packaging, deployment, or support policy.
- Adding a second protocol or Microsoft-specific node role.
- Shipping unrestricted `system.run`, PTY, or process execution without the
  canonical OpenClaw approval and policy boundary.
- Reimplementing the model-facing agent loop inside the node runtime. This RFC
  covers the node invocation loop; any broader agent-loop ownership requires a
  separate decision.
- Stabilizing or publishing the Rust crate APIs before conformance and adoption
  evidence are sufficient.

## Proposal

The normative candidate contracts and evidence are split into companion
documents so this RFC can stay focused on ownership and architectural choice:

- [Rust Gateway client v1 specification](0028/gateway-client-v1-spec.md)
- [Rust node runtime v1 specification](0028/node-runtime-v1-spec.md)
- [Rust node sidecar hosting v1 specification](0028/sidecar-hosting-v1-spec.md)
- [Conformance and adoption plan](0028/conformance-and-adoption-plan.md)
- [Implementation and evidence inventory](0028/implementation-and-evidence-inventory.md)

The first two describe the reusable OpenClaw layers. The sidecar specification
defines product-neutral hosting invariants without selecting a product IPC
encoding. The plan and inventory distinguish implemented evidence from future
adoption and release gates.

### Repository and crate boundary

The runtime lives in `openclaw/openclaw` as two workspace crates:

1. `openclaw-gateway-client` owns transport, authentication, request/response
   correlation, event delivery, reconnection, and trust policy. It is useful to
   applications—including Tauri applications—that need Gateway connectivity but
   do not host a node.
2. `openclaw-node-host` builds on the client and owns node identity, pairing,
   capability declaration, lifecycle, invocation dispatch, duplex input and
   progress, cancellation, and a bounded adapter boundary for commands/tools.

The split is deliberate: it prevents every Gateway consumer from inheriting an
execution runtime, while ensuring node hosts do not invent transport or
authentication behavior.

The crates remain in the OpenClaw monorepo while the contract is evolving. This
keeps TypeScript and Rust conformance changes reviewable together and avoids
repository, version, and release skew. A later RFC or maintainer decision may
publish them once the public API and support policy are stable.

### Ownership boundary

OpenClaw maintainers own:

- the Gateway Rust client and node-host implementation;
- protocol compatibility and role-safe session behavior;
- identity, pairing, reconnect, cancellation, input, and progress semantics;
- bounded invocation supervision and the generic tool adapter contract;
- integration with canonical OpenClaw approval and command/tool policy;
- cross-language fixtures, conformance tests, compatibility, and releases.

Microsoft's Edge/Chromium product teams own:

- the Windows Companion process and system-tray shell;
- settings and Windows-native user experiences;
- Windows-native tools and their runtime adapters;
- the IPC shape between the product shell and an out-of-process runtime, when
  that deployment mode is selected;
- product policy selection, signing, packaging, deployment, and servicing.

Scout Cloud owns its management and orchestration experience. It discovers and
manages the node through supported Gateway surfaces; it does not fork the Rust
runtime or introduce a separate node protocol.

Microsoft is prepared to act as the anchor adopter and provide named
implementation and conformance owners for the Rust capability layers, including
broader node-mode parity if OpenClaw accepts that scope. That sponsorship does
not make the runtime Microsoft-specific: accepted APIs, fixtures, and policy
integration must serve other OpenClaw customers and contributors equally.
OpenClaw maintainers retain authority over the canonical contract, security and
policy boundaries, repository acceptance, and release requirements. Peter and
the maintainer group can therefore choose the product scope that is right for
OpenClaw and its broader customer base without requiring them to staff every
implementation layer themselves.

Product-specific shells and adapters remain outside the generic runtime. Other
customers can embed the crates, supervise the headless host, and contribute
portable capability layers under the same conformance and ownership rules.

### Embedding contract

The runtime must support both of these topologies without changing its semantic
contract:

- **In-process:** a native shell links the crates and supplies platform adapters.
- **Sidecar:** a shell supervises an OpenClaw-owned executable over a narrow,
  authenticated local IPC adapter.

The selection is a product and deployment concern. Runtime APIs must not expose
Tauri types, Chromium types, Windows handles, or Scout-specific management
objects. Platform tools are registered through bounded adapters and execute only
after canonical admission and approval decisions.

### Hosting and management are separate relationships

Windows Companion can have two relationships with the same Rust node instance:

1. **Local hosting and supervision:** Windows Companion embeds the runtime or
   starts it as a sidecar, supplies credentials and native-tool adapters, and
   owns local start, stop, health, and recovery behavior.
2. **Gateway-mediated management:** Windows Companion, Scout Cloud, or another
   authorized OpenClaw controller observes and manages the node through
   canonical Gateway APIs.

The first relationship is local process composition. The second is a control-
plane relationship and does not require another runtime or a product-specific
management implementation inside `openclaw-node-host`. The same system-tray
node can participate in both relationships.

Gateway remains authoritative for controller authentication, node session
state, authorization, conflict behavior, audit attribution, and revocation.
The Rust runtime receives canonical authorized events, executes or cancels the
corresponding work, preserves attribution, and reports status and results. It
must not contain separate Windows Companion and Scout Cloud control planes.
These authority rules must be complete before the multi-manager topology is
considered production-ready.

Sidecar deployments also require an explicit operational contract: local-only
authenticated IPC, bounded startup and memory, truthful readiness, supervised
crash recovery, idempotent reconnect, and graceful shutdown of active work.
These are release gates for sidecar mode, not details delegated implicitly to
each shell.

### Conformance and security

Until the Rust implementation reaches parity, `src/node-host` is the executable
behavioral reference. Shared fixtures should replace implementation-by-
implementation interpretation for:

- connect metadata, identity, authentication, and pairing;
- command declaration and invocation envelopes;
- input/progress ordering and byte limits;
- cancellation, deadlines, saturation, shutdown, and reconnect behavior;
- structured failures and redaction;
- approval and command/tool policy decisions.

The runtime fails closed when policy, approval, identity, or controller authority
is unknown. A native tool adapter cannot broaden permissions granted by the
Gateway or product policy. Every admission, approval, denial, cancellation,
controller action, and approved-but-failed execution must retain distinct,
exportable audit attribution. Revocation must stop new work promptly and cancel
affected in-flight work; a disconnected management surface cannot silently
retain authority.

### Delivery plan

The proposed review shape is two OpenClaw implementation PRs plus one initial
Windows adopter PR:

1. **OpenClaw foundation:** add the two crates, a role-safe Gateway session, a
   minimal bounded node host, and a Tauri consumer that proves the client is
   reusable ([openclaw/openclaw#116050](https://github.com/openclaw/openclaw/pull/116050)).
2. **OpenClaw embeddable runtime:** add external credential/signing hooks,
   issued-token delivery, the supervised lifecycle, bounded duplex invocation,
   local fail-closed admission, connection-scoped command manifests, and the
   shared TypeScript/Rust lifecycle corpus. Draft
   [openclaw/openclaw#116450](https://github.com/openclaw/openclaw/pull/116450)
   is the second upstream PR, explicitly dependent on the foundation landing
   first.
3. **Windows adopter:** keep the existing C# runtime as the production default
   while adding one replaceable runtime boundary and one Windows-owned shared
   capability dispatcher ([openclaw-windows-node#1068](https://github.com/openclaw/openclaw-windows-node/pull/1068)).

The earlier fork drafts #186-#191 remain as detailed evidence history, but they
are superseded as the intended review shape by the single embeddable-runtime
follow-up. Their commits remain intact in #116450, so consolidation does not hide
the native-signing, lifecycle, duplex, authority, manifest, or conformance
boundaries.

After those reviews, adoption proof must demonstrate the authenticated,
versioned Windows adapter and a Scout Cloud management flow against a real
Gateway, including cancellation, revocation, reconnect, crash recovery,
readiness, rollback, and audit evidence. Sidecar proof also measures startup
and steady-state resource cost. API stability, artifacts, SBOM/signing,
compatibility windows, servicing, and support ownership remain explicit release
decisions before the crates are declared generally supported.

The existing official C# Windows node now has one consolidated draft adopter
([openclaw-windows-node#1068](https://github.com/openclaw/openclaw-windows-node/pull/1068)).
It introduces an injectable node-runtime contract and extracts a single
Windows-owned capability dispatcher shared by the current C# transport and a
future Rust adapter, while keeping the C# client as the production default. A
follow-up adapter can supervise the Rust runtime over authenticated, versioned
local IPC: Rust owns Gateway transport, registration, invocation, cancellation,
reconnect, and runtime lifecycle, while the Windows app retains WinUI, the
operator role, MCP, approvals, and native capability handlers. This proves
adoption can be incremental without duplicating Windows command routing,
replacing the product shell, or introducing a Tauri dependency.

Each earlier layer remains useful if maintainers defer a later layer. In
particular, adopting only the Gateway client still removes duplicated transport,
authentication, and reconnect logic from Rust consumers.

## Rationale

### Existing multi-language node precedent

OpenClaw node mode already has several language- and platform-specific
implementations: the generic TypeScript headless host, shared Swift sessions
used by Apple nodes, the Kotlin Android node, the official C# Windows node, and
the official C ESP-IDF component. They do not expose identical tools. Each
advertises the capabilities and commands its platform can currently serve.

These are not competing protocols. They implement one node role: protocol
admission, signed device identity and pairing, a connection-scoped capability
manifest, invocation/result behavior, bounded lifecycle, and Gateway plus local
policy enforcement. Transport adapters, credential storage, native capability
handlers, and application lifecycle remain implementation-specific.

The Rust work is therefore not a new architectural exception. It fills the
reusable native/headless Rust slot and prevents every Rust adopter from
implementing that common machinery independently. Its additional commitment is
to strengthen the shared cross-language fixtures and conformance corpus where
input, progress, cancellation, lifecycle, and error behavior are currently
distributed across schemas and implementation tests.

### Why OpenClaw owns the runtime

The runtime implements an OpenClaw protocol role and security boundary. Keeping
it beside the canonical TypeScript implementation makes behavior changes,
fixtures, and review atomic. It also makes the implementation available to
non-Microsoft native consumers.

### Why the product shell stays with Microsoft

Tray behavior, settings, Windows UX, native tools, packaging, and deployment are
product concerns with different release and platform constraints. Moving them
into OpenClaw would blur responsibility and make the portable runtime less
reusable.

### Why this is not a Tauri decision

Tauri and the Rust runtime occupy different layers. A Tauri app can consume the
Gateway client or node host, but a headless service, Chromium component, or
Windows-native shell should not need an application framework to reuse protocol
and lifecycle behavior.

### Why this is not two competing OpenClaw runtimes

Node mode is a protocol role, not a requirement that every node run in the same
language or application framework. OpenClaw keeps one canonical node contract,
policy boundary, and conformance corpus. The TypeScript `src/node-host` remains
the executable behavioral reference while the Rust implementation reaches the
approved native/headless subset.

The minimum Rust commitment is the proper node-role subset needed by native and
headless hosts; it does not absorb the Gateway's model-facing agent loop.
Additional node-mode capabilities—including MCP, skills, plugins, and richer
tool execution where they truly belong to the node role—can be added when
OpenClaw accepts the scope and a named owner supplies implementation,
conformance, and maintenance. Microsoft is willing to seed that ownership, but
the resulting surface must remain useful to non-Microsoft adopters. Shared
fixtures must prove equivalent behavior for every capability implemented in
both languages, and Rust must reuse the canonical policy rather than create a
parallel one.

This lets Peter and the OpenClaw maintainers choose among a shared Gateway
client, a bounded native node host, or broader native node-mode parity. In every
case it eliminates product-owned Rust node forks. Whether a future native or
headless deployment replaces its TypeScript bridge is an adoption decision made
only after conformance is proven; this RFC does not require removing the
TypeScript host from Node.js deployments.

### Why not keep a separate Rust repository

A separate repository would make protocol changes, security fixes, tests, and
releases easier to skew while the implementation is young. The monorepo provides
the strongest path to conformance. Extraction remains possible after the API and
release contract stabilize.

### Why not wrap the TypeScript node host

A wrapper is the shortest path for products already carrying Node.js. It does
not meet the all-Rust runtime goal, does not simplify the Windows process model,
and preserves two runtimes across lifecycle and security-sensitive paths.

## Unresolved questions

- Do Peter and the OpenClaw maintainer group accept long-term ownership of the
  runtime, its conformance surface, and its release compatibility?
- Which command/tool catalog and approval APIs are the canonical integration
  point, and what shared fixtures must exist before native tools are enabled?
- Should Windows Companion embed the runtime or supervise a signed sidecar?
- How are controller authority, conflicts, revocation, and audit attribution
  represented when Windows Companion and Scout Cloud manage the same node?
- Which identity and token material is stored by the runtime versus a
  Windows-secure-storage adapter?
- What is explicitly in scope for the node invocation loop, and what remains in
  the Gateway's model-facing agent loop?
- When should the crates be published, and who owns artifact signing, SBOMs,
  compatibility windows, servicing, and security response?
- What end-to-end evidence is required before the TypeScript node host is no
  longer the behavioral reference for a capability?
