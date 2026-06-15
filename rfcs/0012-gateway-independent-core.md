---
title: Gateway-Independent OpenClaw Core
authors:
  - Jason (Json)
created: 2026-06-15
last_updated: 2026-06-15
status: draft
issue:
rfc_pr:
---

# Proposal: Gateway-Independent OpenClaw Core

## Summary

OpenClaw should make its core agent runtime independent of the Gateway lifecycle while preserving the existing `openclaw gateway` command, `gateway.*` configuration, port, authentication, Control UI, TUI, protocol, and plugin behavior. A Host-owned core would run conversations, sessions, cron, heartbeat, tasks, routing policy, and durable delivery intent without requiring any channel connection. The existing Gateway would become a compatibility-supervised composition of a Control Server protocol facade and transport-only Channel Gateways. The migration would be phased, additive at public boundaries, and invisible to existing users and external plugin developers.

## Motivation

The current Gateway is more than a channel gateway. It is the composition root and lifecycle owner for channel connections, the control protocol, agents, cron, heartbeat, tasks, plugin services, hooks, and local clients. This makes the process convenient to start, but it also makes unrelated systems share the same failure and restart boundary.

A channel connection failure, a channel-specific configuration change, a Control Server restart, or a Gateway deployment can interrupt work that does not depend on that surface. Conversely, local agent conversations, cron jobs, and heartbeat work cannot operate as a complete product mode unless the Gateway composition remains available.

This couples the product's core identity to its transport layer. OpenClaw should be an agent runtime with channel integrations, not a channel relay that happens to run agents.

### Why detachment matters

Detaching the Gateway from core functionality provides concrete product benefits:

- **Core work survives channel outages.** Active agent turns, cron jobs, heartbeat work, and local conversations continue when a connector disconnects or restarts.
- **Local-first becomes a real runtime mode.** The TUI, Control UI, CLI, and other local clients can use the Host even when no messaging channels are configured.
- **Failure blast radius becomes smaller.** A Telegram, Discord, or other connector fault does not require restarting conversations, schedules, tasks, or unrelated connectors.
- **Configuration changes become owner-scoped.** A channel token change can restart only that connector; a Control Server TLS change can restart only the Control Server.
- **Security boundaries become clearer.** Channel credentials and untrusted transport payloads can remain at a narrower transport boundary.
- **Plugin contracts become clearer.** Channel plugins can target a serializable connector contract instead of depending on broad in-process Gateway state.
- **Deployment options improve.** OpenClaw can later separate processes or hosts without first encoding the current monolith as a distributed monolith.

### Configuration restart behavior exposes the current coupling

OpenClaw already validates configuration, computes changed paths, and hot-applies many changes. The reload planner distinguishes no-op, hot-reload, and restart-required changes. Channel plugins can declare config prefixes, and plugins can declare hot, no-op, and restart prefixes.

The important limitation is not that OpenClaw lacks reload logic. It is that the fallback restart targets the process that owns everything. When a changed path requires `restartGateway: true`, the Gateway shutdown path stops plugin services, channels, agent harnesses, cron, heartbeat, tasks, and control connections together.

The proposed architecture does not promise that every change becomes hot-reloadable. It changes the restart boundary:

- today, a restart-required change restarts the shared Gateway composition;
- after this RFC, a restart-required change restarts the owner of the affected configuration;
- an explicit full service restart remains available and keeps its existing meaning.

This is one of the clearest user-visible reasons to separate ownership even before OpenClaw uses separate operating-system processes.

### Current-state evidence

The source survey for this proposal used `openclaw/openclaw` `main` at commit `127e174c9e4de36f2eccb96300bb3efa69ae9a32`.

| Current surface | Relevant source | Observed ownership |
| --- | --- | --- |
| Gateway composition and shutdown | `src/gateway/server.impl.ts`, `src/gateway/server-close.ts` | One lifecycle owns core systems, channels, plugins, and control connections. |
| Config reload planning and application | `src/gateway/config-reload.ts`, `src/gateway/config-reload-plan.ts`, `src/gateway/server-reload-handlers.ts` | Most changes are diffed and classified, but the broad fallback is a Gateway restart. |
| Cron | `src/cron/service-contract.ts`, `src/cron/service.ts`, `src/gateway/server-cron.ts` | The scheduler has a service boundary but is started and stopped by the Gateway. |
| Heartbeat | `src/infra/heartbeat-runner.ts` | Heartbeat has lifecycle structure but still reaches channel delivery concerns. |
| Local TUI | `src/tui/tui-backend.ts`, `src/tui/embedded-backend.ts` | Local execution exists, but core paths and Gateway-facing paths are not one canonical Host service surface. |
| Agent tools | `src/agents/openclaw-tools.ts`, `src/agents/tools/embedded-gateway-stub.ts` | Internal core behavior can route back through Gateway-shaped RPC and stubs. |
| Control UI | `ui/src/ui/gateway.ts`, `ui/src/ui/app-gateway.ts`, `ui/src/ui/controllers/cron.ts` | The UI treats the Gateway protocol as the owner of core and transport concerns. |
| Channel and plugin contracts | `src/gateway/server-channels.ts`, `src/channels/plugins/types.adapters.ts`, `src/plugins/types.ts` | Channel plugins have broad in-process access and lifecycle coupling. |

These are useful existing seams. The proposal builds on them rather than replacing the product in one step.

## Goals

- Run conversations, sessions, cron, heartbeat, tasks, routing policy, and durable delivery intent when zero channels are configured or connected.
- Keep those core systems running through Channel Gateway and Control Server restarts.
- Preserve the public `openclaw gateway` command, `gateway.*` configuration, default port, authentication, protocol methods, subscriptions, Control UI, TUI, CLI, nodes, and hooks.
- Keep existing `openclaw.json` files valid without required new keys, environment variables, or normal-upgrade doctor migrations.
- Keep shipped external plugins working without changes through an automatic co-located compatibility mode.
- Add an additive connector contract for transport-only channel implementations.
- Establish one canonical core execution path and one canonical writer for durable core state.
- Make configuration validation, ownership, desired revision, active revision, and restart scope explicit.
- Make the logical ownership split before making a physical process split.
- Roll out each phase behind proof gates with complete backward compatibility.

## Non-Goals

- This RFC does not rename the public Gateway command, configuration namespace, protocol, or product surfaces.
- This RFC does not require users to manage additional processes, ports, sockets, or IPC settings.
- This RFC does not force external plugin developers to migrate immediately.
- This RFC does not deprecate the existing channel plugin contract in the initial implementation.
- This RFC does not make remote or multi-host Channel Gateways a first-phase feature.
- This RFC does not migrate all channels at once.
- This RFC does not add dual core execution paths, dual durable-state writers, or steady-state runtime fallbacks.
- This RFC does not promise that configuration changes never require a restart.
- This RFC does not promise instantaneous atomic configuration activation across independently restarting owners.

## Proposal

### 1. Establish four explicit runtime owners

The public `openclaw gateway` service remains the user-facing entry point. Internally, it supervises four logical owners:

```text
                         existing clients and plugins
                  TUI / Control UI / CLI / nodes / hooks
                                      |
                                      v
                         +-------------------------+
                         |      Control Server     |
                         | existing Gateway facade |
                         +------------+------------+
                                      |
                                      v
+----------------------+    +---------+---------+    +----------------------+
| Compatibility       |--->|       Host        |<-->| Channel Gateway(s)   |
| Supervisor           |    | canonical core    |    | transport-only      |
| public service owner |    | and durable state |    | connectors          |
+----------------------+    +-------------------+    +----------------------+
```

#### Compatibility Supervisor

The Compatibility Supervisor owns the public service lifecycle:

- starts the combined service for existing users;
- supervises logical owners and, later, child processes;
- exposes combined health and diagnostics;
- places legacy plugins in the correct co-located compatibility runtime;
- performs explicit full service restarts;
- does not own durable business state.

#### Host

The Host is the canonical owner of:

- agent conversations and turns;
- session and transcript coordination;
- cron and scheduled work;
- heartbeat scheduling and work generation;
- tasks and background work;
- routing and product policy;
- durable delivery intent;
- core plugin services;
- canonical core state;
- configuration validation and revision coordination.

The Host must start and operate when no channels or Control Server are available.

#### Control Server

The Control Server is the compatibility facade for the existing Gateway protocol. It owns:

- current protocol authentication and authorization;
- current methods, events, and subscriptions;
- Control UI, TUI, CLI, node, and hook connections;
- Gateway HTTP, WebSocket, TLS, bind, and port configuration;
- projection of Host and connector health into existing protocol views.

The Control Server does not own core business state. It calls Host service APIs and projects their results.

#### Channel Gateways

A Channel Gateway owns transport-specific concerns:

- connect and authenticate to the channel;
- receive and acknowledge native events;
- normalize inbound events into portable ingress;
- render and send portable delivery requests;
- report receipts, typing, delivery state, and transport health;
- enforce channel-specific limits.

A Channel Gateway does not own conversations, sessions, schedules, heartbeat policy, product commands, provider policy, or durable delivery intent.

### 2. Enforce ownership invariants before splitting processes

The implementation must enforce these invariants while all owners can still run in one process:

1. The Host starts and passes its core proof suite with zero Channel Gateways.
2. Core services call Host-owned interfaces directly. They do not call the Control Server or an embedded Gateway stub.
3. The Control Server is a facade over Host APIs, not a second implementation of core behavior.
4. Channel Gateways receive portable ingress and delivery contracts. They do not reach into Host state.
5. Only the Host writes canonical core state.
6. Connector restarts cannot cancel unrelated active turns, cron work, heartbeat work, or tasks.
7. Control Server restarts cannot cancel Host-owned work.
8. Every configuration path has one declared owner before detached mode becomes the default.

This logical split is the architecture change. Moving owners into separate processes is a later deployment step and proof mechanism.

### 3. Add Host service APIs

The Host exposes narrow internal service APIs for:

- conversation start, continue, cancel, and status;
- session lookup, history, and lifecycle operations;
- schedules and cron execution;
- heartbeat scheduling and execution;
- task creation, status, cancellation, and completion;
- durable delivery intent and result reconciliation;
- health, capability, and configuration revision state.

The APIs should use serializable values and closed result types even while calls are in-process. That prevents functions, callbacks, process globals, and transport objects from becoming accidental contracts.

Local TUI and embedded use should call these Host APIs directly. The Control Server should call the same APIs. There must not be a separate local implementation and remote implementation of core behavior.

### 4. Make delivery an explicit Host-to-connector contract

The Host owns durable delivery intent. Channel Gateways own the attempt to render and deliver that intent.

The additive connector contract should include serializable messages for:

- inbound portable events;
- delivery requests;
- delivery accepted/rejected results;
- delivery receipts and final state;
- typing and presence requests;
- connector capability snapshots;
- connector and account health;
- configuration revision activation.

Delivery identifiers and receipt reconciliation must prevent duplicate visible delivery when a connector restarts or retries. The connector contract must distinguish acceptance, upstream acknowledgement, and final delivery state where the transport supports those concepts.

The Host may continue core work while a connector is unavailable. Delivery intent can remain pending, fail according to product policy, or be retried according to an explicit delivery policy. A connector outage must not implicitly become a Host outage.

### 5. Make configuration lifecycle owner-scoped

The Host owns a Config Coordinator that validates the complete configuration and coordinates secret-reference resolution once for the revision. It produces owner-scoped activation payloads so an owner receives only the configuration and secret material it needs; the Host does not need to retain connector plaintext after coordination.

For each accepted configuration revision, the coordinator:

1. validates the complete candidate configuration;
2. computes changed source paths;
3. maps every changed path to exactly one owner or an explicitly combined action;
4. asks affected owners to prepare the revision;
5. persists the desired revision;
6. applies hot changes or restarts only affected owners;
7. records the active revision for each owner;
8. exposes convergence, failure, retry, and rollback state.

The system provides revisioned convergence rather than pretending that independently restarting owners activate a revision at one instant.

Representative ownership:

| Changed configuration | Owner and action |
| --- | --- |
| message or routing policy | Apply a new Host snapshot. |
| cron configuration | Reconfigure or restart only the Host scheduler subsystem. |
| `channels.telegram.*` | Reconfigure or restart only the affected Telegram connector or account. |
| another connector's account settings | Reconfigure or restart only that connector or account. |
| `gateway.port`, bind, TLS, or HTTP settings | Restart or reconfigure only the Control Server. |
| Host-owned plugin configuration | Reconfigure or restart the Host-owned plugin service. |
| explicit full restart request | Compatibility Supervisor restarts the complete service. |

Unknown or ambiguous path ownership fails closed. During migration, it may require a combined service restart. Detached mode must not become the default until the path has owner metadata and proof.

Existing reload semantics remain compatible:

- `gateway.reload.mode: hybrid` gains owner-scoped actions where ownership is known;
- `gateway.reload.mode: hot` and `gateway.reload.mode: off` keep their shipped meanings;
- an explicit restart remains a full compatibility-supervised service restart;
- existing legacy plugin restart prefixes keep a safe co-located restart meaning;
- modern Host and connector contracts can declare narrower reload capabilities additively.

### 6. Preserve all public user contracts

The migration is intentionally invisible to existing users:

- `openclaw gateway` remains the normal command.
- Existing service management continues to manage one OpenClaw service.
- Existing `gateway.*` configuration remains valid.
- Existing default port, authentication, Control UI URL, protocol, methods, events, and subscriptions remain valid.
- Existing TUI and CLI workflows remain valid.
- Existing configuration needs no manual edits.
- A normal upgrade does not require `openclaw doctor --fix` solely because of this architecture change.
- Existing monitoring can continue to observe the combined service, with additive owner-level health available for diagnosis.

New internal owner configuration should be derived from existing configuration and defaults. User-facing configuration is added only if a later product requirement cannot be expressed through existing behavior.

### 7. Preserve external plugin behavior through compatibility placement

External plugin compatibility is a release gate, not a best-effort follow-up.

Existing channel plugins use a broad in-process contract that can include functions, callbacks, runtime objects, and Gateway lifecycle assumptions. Those plugins cannot be moved across a process boundary without changing their contract. The Compatibility Supervisor therefore classifies them as legacy connector v1 plugins and runs them unchanged in a co-located compatibility runtime.

Legacy compatibility rules:

- existing plugin packages, manifests, config, and SDK imports continue to work;
- existing lifecycle and restart-prefix behavior remains available;
- no new permission or configuration is required;
- the plugin remains co-located with the compatibility service until it opts into a serializable connector contract;
- OpenClaw-owned and bundled callers migrate to the modern contract as it becomes available;
- no initial deprecation date is assigned to the legacy contract.

Connector v2 is additive. It defines the serializable ingress, delivery, receipt, health, capability, lifecycle, and configuration-revision contract required for detached placement. Plugin authors can opt in when the capability is useful to them.

Non-channel plugins remain Host-owned unless their contract explicitly belongs to another owner.

### 8. Roll out in proof-gated phases

The implementation proceeds in phases:

1. **Contract and guardrails:** document owners, invariants, compatibility rules, dependency boundaries, and configuration ownership.
2. **Host kernel:** introduce the Host lifecycle and Config Coordinator while the service remains combined; move cron and heartbeat ownership.
3. **Canonical core service APIs:** move conversations, sessions, schedules, tasks, delivery intent, and local TUI execution behind Host APIs; remove internal Gateway RPC and embedded Gateway stubs.
4. **Control Server facade:** make the current protocol a facade over Host APIs and prove Control Server/config restarts do not interrupt Host work.
5. **Connector v2 and compatibility placement:** add the serializable connector contract, keep legacy v1 plugins co-located, and migrate bundled connectors incrementally.
6. **Supervised physical split:** add private IPC, leases, restart budgets, revision convergence, and separate processes only after logical boundaries pass fault-injection proof.

The detailed dependency-oriented work packages, compatibility gates, and proof matrix are in [0012/implementation-plan.md](0012/implementation-plan.md).

### 9. Gate default changes on real upgrade and fault proof

No phase becomes the default solely because its unit tests pass. Each default change requires:

- upgrade proof from the last stable published OpenClaw version with unchanged configuration;
- unchanged legacy external plugin fixture proof;
- zero-channel Host proof;
- active-turn survival through connector and Control Server restarts;
- owner-scoped configuration restart proof;
- duplicate-delivery and lease/fencing proof;
- current protocol compatibility proof;
- rollback proof to the prior combined placement.

The combined compatibility placement remains the fallback deployment mode during rollout, but core behavior must still have one canonical Host implementation. Rollback changes placement, not business logic.

## Rationale

### Why this is the right product direction

Users care that their conversations, schedules, tasks, and local workflows continue to work. They should not need to understand which internal process owns them. Separating the core runtime from channel connectivity makes OpenClaw more dependable without adding setup burden.

The proposal also aligns product boundaries with operator expectations. A channel token rotation should affect that channel. A Control Server certificate change should affect the Control Server. A disconnected channel should not stop a local conversation or cron job. The new ownership model makes those expectations enforceable.

### Why not a one-shot rewrite

A one-shot rewrite would combine lifecycle changes, core service APIs, protocol projection, plugin SDK compatibility, channel migration, state ownership, configuration reload, and deployment changes in one release. That creates too many simultaneous failure modes and makes rollback ambiguous.

The phased plan keeps the public product stable while moving one owner boundary at a time. Every slice must leave one canonical core path, preserve compatibility, and provide a rollback placement.

### Why not keep the monolith and improve hot reload

Improved hot reload is useful, but it does not isolate channel faults, control-plane restarts, shutdown ordering, resource leaks, or deployment changes. It also cannot make zero-channel Host operation a first-class mode while the Gateway remains the core owner.

### Why not split processes first

Splitting the current composition first would turn existing in-process coupling into IPC calls and create a distributed monolith. Logical ownership, serializable contracts, and one-writer state rules must be proven before process boundaries make failures slower and harder to diagnose.

### Why not make remote Channel Gateways the first target

Remote connectors introduce public networking, trust, authentication, versioning, support, and deployment contracts that are not required to obtain the main resilience benefits. Private supervised placement should prove the architecture first. Remote placement can be a separate product proposal if demand justifies it.

### Why compatibility belongs at the public edge

Complete backward compatibility does not require keeping the current internal architecture. It requires preserving shipped user and plugin contracts. The proposal keeps compatibility in the public service, protocol facade, configuration interpretation, and legacy plugin placement while allowing core internals to converge on one Host-owned design.

## Unresolved questions

- Which bundled channel should be the first connector v2 migration and proof case?
- Which private IPC transport best fits supervised local processes?
- What exact SDK capability names should declare connector v2 support and owner-scoped reload behavior?
- Which Host plugin services, if any, should later receive their own owner boundary?
- What evidence would justify offering remote Channel Gateways as a supported product mode?
- Should legacy co-located channel plugins ever receive a deprecation timeline? This RFC intentionally does not set one.
- Which owner-level health details should be projected through the existing Gateway protocol before any additive protocol methods are introduced?
- The RFC lifecycle requires a matching discussion thread in `maintainer-discussion`.
