# Implementation Plan

This sidecar is the dependency-oriented implementation and rollout plan for the Gateway-Independent OpenClaw Core RFC. It is intentionally more detailed than the RFC body so implementation PRs can remain focused while reviewers retain a shared target architecture, compatibility contract, and proof standard.

## Strategy

The implementation should move logical ownership before physical placement:

1. Define the owner and contract.
2. Route all OpenClaw-owned callers through one canonical path.
3. Prove the owner can start, stop, reload, and fail independently while still in one process.
4. Add serializable boundaries and compatibility placement.
5. Split the owner into a supervised process only after fault-injection proof.

Each implementation PR must preserve the public service and leave the tree in a releasable state. A phase is complete only when the old internal path is removed or explicitly retained as a shipped compatibility contract.

### Hard implementation rules

- The Host is the only canonical implementation of core behavior.
- The Host is the only writer of canonical core state.
- The Control Server and Channel Gateways are clients of Host services.
- Existing user configuration remains the source of truth.
- Public compatibility is automatic; users do not select a migration mode.
- Legacy external plugins remain unchanged in co-located compatibility placement.
- Connector v2 is additive and serializable.
- Unknown configuration ownership fails closed.
- Rollback changes owner placement, not core behavior.
- Process splitting is the last architectural step, not the first.
- No phase adds dual writes, read-through fallbacks, or a second core execution path.

## Target Owner Matrix

This matrix is the intended ownership result. Early phases can remain co-located, but they must converge toward these boundaries.

| Capability | Canonical owner | Other owners' role |
| --- | --- | --- |
| Agent conversations and turns | Host | Control Server invokes and projects; connectors deliver ingress/results. |
| Sessions and transcript coordination | Host | Control Server exposes existing protocol views. |
| Cron and schedules | Host | Control Server exposes existing methods/events. |
| Heartbeat scheduling and work | Host | Connectors receive delivery requests only. |
| Tasks and background work | Host | Control Server exposes status and cancellation. |
| Routing and product policy | Host | Connectors report capabilities; they do not decide policy. |
| Durable delivery intent | Host | Connectors attempt delivery and report receipts. |
| Core plugin services | Host | Compatibility Supervisor places legacy services when required. |
| Complete config validation | Host Config Coordinator | Owners prepare and activate their slices. |
| Desired configuration revision | Host Config Coordinator | All owners report active revision. |
| Gateway protocol and auth | Control Server | Host supplies service results and events. |
| HTTP, WebSocket, TLS, bind, port | Control Server | Compatibility Supervisor observes health. |
| Channel authentication and connection | Channel Gateway | Host never handles native channel connection state. |
| Native event parsing and acknowledgement | Channel Gateway | Host receives portable ingress. |
| Native rendering and transport limits | Channel Gateway | Host sends portable delivery intent. |
| Combined service lifecycle | Compatibility Supervisor | Owners expose health, readiness, and shutdown. |
| Legacy plugin placement | Compatibility Supervisor | Legacy plugin contract remains co-located. |
| Canonical durable core state | Host | No other owner writes it. |

## Configuration Ownership and Revision Contract

Configuration reload is a first-class architecture proof because it exercises validation, ownership, lifecycle, compatibility, and observability together.

### Coordinator algorithm

For every candidate revision:

1. Parse and validate the complete configuration using the current public schema.
2. Coordinate secret-reference resolution according to current behavior and produce owner-scoped activation payloads without requiring the Host to retain connector plaintext.
3. Compute changed source paths against the active desired revision.
4. Resolve every path through an owner registry.
5. Build one closed apply plan containing owner actions:
   - `none`
   - `hot-apply`
   - `restart-subsystem`
   - `restart-owner`
   - `restart-service`
6. Ask every affected owner to prepare the candidate revision.
7. Reject the revision if preparation fails or path ownership is ambiguous.
8. Persist the desired revision and plan.
9. Execute owner actions in dependency order.
10. Record each owner's active revision and result.
11. Expose pending, converged, failed, retrying, and rolled-back states.

The first implementation can run this algorithm in one process. The contract must not depend on that placement.

### Ownership metadata

Existing reload prefixes are migration input, not the final owner model. Add explicit owner metadata that maps current config-schema paths to a logical owner and supported apply actions.

Owner metadata must:

- cover every current configuration path before detached placement becomes default;
- compose with plugin-declared configuration prefixes;
- reject overlapping or ambiguous ownership;
- preserve existing `gateway.reload.mode` behavior;
- preserve existing legacy plugin restart prefixes in co-located mode;
- identify whether an action targets an account, connector, subsystem, owner, or whole service;
- be visible in diagnostics and testable without starting every integration.

### Revision and rollback semantics

- The desired revision is the complete accepted configuration, not a set of partial owner files.
- Each owner reports the desired revision it has prepared and the revision it has activated.
- A failed owner activation is visible; it is not silently treated as success.
- Retry and rollback policy is explicit per action.
- Rollback can restore the prior complete desired revision or return the service to combined placement.
- A crash during activation must not create a hidden split-brain state.
- The compatibility service reports healthy only according to a documented convergence policy.

### Required config proof cases

| Change | Expected proof |
| --- | --- |
| `messages.*` or routing policy | Host applies the new snapshot; connectors and Control Server continue. |
| cron settings | Host scheduler reconfigures or restarts; active conversations and connectors continue. |
| one Telegram account token | Only that account or Telegram connector restarts; Host work and other connectors continue. |
| one connector's transport settings | Only the affected connector restarts. |
| `gateway.port`, bind, TLS, or HTTP | Only the Control Server restarts; Host work and connectors continue. |
| Host-owned plugin settings | Only the plugin service or Host subsystem restarts. |
| mixed Host and connector change | Desired and active owner revisions are visible until convergence. |
| unknown path during migration | Combined restart or rejected revision according to the migration policy. |
| explicit full restart | Compatibility Supervisor restarts the complete service. |

## Compatibility Strategy

### Existing users

The normal upgrade path must require no action:

- same command;
- same config file and keys;
- same service manager entry;
- same default port and authentication;
- same UI, TUI, CLI, node, and hook workflows;
- same protocol methods and event shapes;
- no mandatory doctor migration;
- no operator-managed child process or IPC configuration.

Owner-level diagnostics and health can be additive, but current combined health remains available.

### External plugin developers

External plugin developers should experience no break during rollout.

| Plugin type | Initial behavior | Modern opt-in path |
| --- | --- | --- |
| Existing channel plugin | Runs unchanged in co-located legacy connector v1 placement. | Adopt connector v2 when detached placement or narrower lifecycle is useful. |
| Existing provider, tool, memory, service, or other core plugin | Remains Host-owned with existing public SDK behavior. | Adopt new Host capabilities only when needed. |
| New channel plugin | May use the existing contract. | Prefer connector v2 after the SDK is documented and stable. |
| Bundled OpenClaw channel | Migrated one at a time after connector v2 proof. | Must use the modern contract before detached default for that channel. |

Legacy v1 placement is an explicit compatibility contract:

- detect by declared capability and current plugin shape, not by plugin ID;
- keep broad in-process runtime access only inside the co-located boundary;
- preserve current lifecycle and reload behavior;
- emit diagnostics that explain placement without warning users that their valid setup is broken;
- do not assign a deprecation deadline in this RFC;
- prevent bundled/internal plugins from using the legacy path after they have a modern replacement.

Connector v2 must be additive and versioned through capability negotiation. It should expose the smallest serializable contract required for:

- ingress;
- delivery;
- receipts;
- typing and presence;
- health;
- capabilities;
- account lifecycle;
- configuration prepare/activate;
- shutdown and drain.

### Protocol compatibility

The current Gateway protocol remains the public protocol. The Control Server must preserve existing method, event, auth, and subscription behavior while changing the implementation behind it.

Any owner-level diagnostics should first fit existing compatible response fields or additive methods/events. An incompatible protocol change requires a separate versioned proposal and is not part of this migration.

## Phases

### Phase 0: Contracts, baselines, and dependency guardrails

**Objective:** Make the intended boundaries reviewable and prevent new coupling while behavior remains unchanged.

Work:

- Add an architecture decision record in `openclaw/openclaw`.
- Define the owner matrix and lifecycle state machine.
- Inventory Gateway-owned start, close, reload, and shutdown behavior.
- Inventory all configuration paths and existing reload-prefix declarations.
- Inventory external plugin-facing Gateway, channel, and lifecycle contracts.
- Add dependency checks that prevent new Host-to-Control Server and Host-to-channel imports.
- Add baseline tests for current user, protocol, config, and plugin behavior.
- Define combined placement and rollback semantics.

Exit gates:

- Every known lifecycle surface has a proposed owner.
- Every configuration path is inventoried.
- Legacy external plugin fixtures are captured.
- Boundary checks fail when new reverse dependencies are introduced.
- No user-visible behavior changes.

### Phase 1: Host lifecycle and Config Coordinator

**Objective:** Introduce the Host as a real lifecycle owner while everything remains in one process.

Work:

- Add `OpenClawHost` start, ready, drain, close, and health lifecycle.
- Make the Compatibility Supervisor start the Host.
- Move complete config validation and revision coordination into the Host.
- Generate owner-scoped apply plans while still executing combined behavior where needed.
- Move cron ownership into the Host.
- Move heartbeat scheduling and work generation into the Host.
- Introduce a Host delivery port so heartbeat and cron do not call channel adapters directly.

Exit gates:

- Host starts and runs with all channels disabled.
- Cron and heartbeat survive a simulated connector restart.
- Config Coordinator can explain ownership and planned action for every changed path.
- Current public command, config, and protocol remain unchanged.
- Shutdown ordering is deterministic and covered.

### Phase 2: Canonical Host service APIs

**Objective:** Make local and protocol clients use one core implementation.

Work:

- Add Host APIs for conversations, sessions, schedules, tasks, cancellation, and status.
- Add durable delivery-intent APIs and receipt reconciliation.
- Route embedded/local TUI execution through Host APIs.
- Route current Gateway-facing core methods through Host APIs.
- Remove internal Gateway RPC calls from core systems.
- Remove embedded Gateway stubs after all OpenClaw-owned callers migrate.
- Move core plugin services under Host lifecycle.

Exit gates:

- Local TUI and Control Server paths execute the same Host methods.
- No core subsystem requires a Control Server connection.
- No OpenClaw-owned core caller uses the legacy Gateway stub.
- Host is the only canonical writer of core state.
- Active work survives a simulated Control Server restart.

### Phase 3: Control Server facade and owner-scoped reload

**Objective:** Make the existing Gateway protocol a replaceable facade over the Host.

Work:

- Extract the current protocol/auth/server surface into the Control Server owner.
- Route existing methods, subscriptions, UI, TUI, CLI, node, and hook behavior to Host APIs.
- Project Host and connector health through existing compatible views.
- Assign Gateway HTTP, WebSocket, TLS, bind, and port configuration to the Control Server.
- Execute Control Server-only config restart plans.
- Add desired-versus-active revision diagnostics.

Exit gates:

- Existing protocol compatibility suites pass unchanged.
- Control Server can restart without cancelling active Host work.
- Control Server-owned config changes restart only the Control Server.
- Existing clients reconnect according to current behavior.
- Combined service health accurately represents Host and Control Server state.

### Phase 4: Connector v2 and legacy compatibility placement

**Objective:** Create a transport-only serializable channel contract without breaking existing plugins.

Work:

- Define connector v2 ingress, delivery, receipt, health, capability, lifecycle, and config-revision messages.
- Define account and connector identity, fencing, and delivery idempotency rules.
- Add the legacy v1 classifier and co-located placement.
- Add plugin diagnostics that show placement and capability.
- Migrate one bundled connector as the reference implementation.
- Prove owner-scoped connector and account restarts.
- Migrate remaining bundled connectors incrementally.

Exit gates:

- An unchanged external legacy channel plugin fixture passes.
- A connector v2 fixture passes both in-process and detached-boundary contract tests.
- The reference bundled connector can restart during an active Host turn without cancelling it.
- Connector-owned config changes restart only the affected connector or account.
- Duplicate-delivery proof passes across restart and retry cases.
- No bundled connector migrated to v2 uses broad Host internals.

### Phase 5: Supervised process split

**Objective:** Use process isolation as a deployment and fault-containment mechanism after logical boundaries are proven.

Work:

- Add private local IPC for Host, Control Server, and connector v2 messages.
- Add leases, fencing tokens, restart budgets, backoff, and drain deadlines.
- Add process-level desired and active revision convergence.
- Add combined and owner-level health reporting.
- Split the Control Server into a supervised process.
- Split migrated connector v2 implementations into supervised processes.
- Keep legacy v1 plugins in safe co-located placement.
- Preserve one service-manager entry and existing public command.

Exit gates:

- Process kill and restart fault-injection tests pass.
- Stale connector instances cannot deliver after fencing.
- Host work survives Control Server and connector process failure.
- Upgrade from the last stable package requires no config edits or doctor run.
- Rollback to combined placement is proven.
- Operator diagnostics identify failed owner, active revision, and recovery action.

## Implementation Work Packages

The phases above describe product milestones. These work packages are intended to become focused PRs or small PR stacks.

### P0: Architecture decision and public invariants

- Document owner boundaries, public invariants, lifecycle state machine, and rollback placement.
- Record the source survey and current behavior baselines.
- Name the compatibility contracts that must not change.

### P1: Dependency and ownership guardrails

- Add import/dependency checks for Host, Control Server, connector, and compatibility boundaries.
- Add configuration-path ownership inventory validation.
- Add a ratchet against new core calls through Gateway RPC or channel adapters.

### P2: Host lifecycle shell

- Introduce Host lifecycle, health, drain, and close.
- Start it from the existing service composition.
- Do not move behavior until lifecycle proof is stable.

### P2A: Config Coordinator and apply-plan metadata

- Move complete config validation and diff ownership to the Host.
- Add owner-scoped plan types and diagnostics.
- Initially execute combined restart for unknown ownership.

### P3: Cron to Host

- Make cron start, stop, reload, and execution Host-owned.
- Preserve current protocol and user behavior through projection.

### P4: Heartbeat and delivery port

- Make heartbeat scheduling and work Host-owned.
- Replace direct channel delivery access with the Host delivery port.
- Establish portable delivery intent before connector v2.

### P5: Conversations, sessions, schedules, tasks, and delivery intent

- Introduce narrow Host APIs.
- Route existing protocol handlers to them.
- Make Host state ownership explicit.

### P6: Embedded TUI to Host

- Route local TUI execution through the same Host APIs used by protocol clients.
- Prove zero-channel local conversation operation.

### P7: Remove internal Gateway RPC and embedded stubs

- Migrate all OpenClaw-owned callers.
- Delete the old internal path once no shipped external contract requires it.

### P8: Control Server extraction

- Make protocol/auth/HTTP/WebSocket lifecycle independently restartable.
- Assign Control Server configuration ownership.

### P9: Existing client projection

- Preserve UI, TUI, CLI, node, hook, method, event, and subscription behavior.
- Add reconnect and active-work-survival proof.

### P10: Connector v2 contract

- Define serializable messages and capability negotiation.
- Define delivery IDs, receipts, fencing, account lifecycle, and revision activation.
- Publish plugin SDK docs and fixtures.

### P11: Legacy v1 classifier and diagnostics

- Classify existing plugins into automatic co-located placement.
- Preserve current config, lifecycle, and restart-prefix behavior.
- Add compatibility fixtures and understandable diagnostics.

### P12: First bundled connector migration

- Select one representative connector.
- Prove in-process v2, owner-scoped reload, detached placement, restart, and delivery reconciliation.

### P13: Remaining bundled connector migrations

- Migrate in small channel-owned PRs.
- Keep unmigrated and external v1 connectors co-located.

### P14: Supervisor, IPC, leases, and revision convergence

- Add private IPC and supervised child placement.
- Add fencing, restart budgets, health aggregation, drain, and convergence state.

### P15: Zero-touch upgrade and cohort rollout

- Prove stable-package upgrade with unchanged config and plugins.
- Roll out detached placement by capability cohort.
- Preserve combined placement rollback until detached proof is mature.

## Test and Proof Matrix

### Core independence

- Start Host with zero configured channels.
- Start Host with all configured channels disabled.
- Run a local TUI conversation without Control Server or channels.
- Run cron, heartbeat, and tasks without Control Server or channels.
- Restart and reconnect Control Server while a Host turn remains active.
- Crash and restart one connector while a Host turn remains active.

### Compatibility

- Upgrade from the last stable published package using an unchanged real-world config fixture.
- Start with existing `gateway.*` settings and service manager behavior.
- Exercise current protocol clients without changes.
- Load unchanged external legacy channel plugin fixtures.
- Load unchanged external non-channel plugin fixtures.
- Preserve `gateway.reload.mode` semantics.
- Preserve explicit full restart semantics.

### Configuration lifecycle

- Hot-apply a Host-owned change.
- Restart one Host subsystem.
- Restart one connector account.
- Restart one connector.
- Restart only the Control Server.
- Apply a mixed-owner revision and observe convergence.
- Reject or safely combine-restart an unknown-owner revision.
- Fail preparation and prove no silent partial activation.
- Crash during activation and prove revision state remains diagnosable.

### Delivery and connector safety

- Receive ingress once across connector reconnect.
- Deliver visible output once across retry and connector restart.
- Reject stale connector receipts after fencing.
- Drain accepted delivery before planned restart.
- Report pending, accepted, acknowledged, failed, and final delivery states.
- Exercise multi-account connector concurrency.

### Lifecycle and fault injection

- Kill Control Server process.
- Kill one connector process.
- Kill and restart the Compatibility Supervisor while preserving documented Host behavior.
- Exercise restart budget and backoff.
- Exercise drain deadline and forced shutdown.
- Verify shutdown ordering and resource cleanup.
- Verify owner health and desired/active revision diagnostics.

### Security

- Prove channel credentials remain connector-scoped where supported.
- Prove native untrusted payloads cross into Host only through portable ingress.
- Prove Control Server auth and authorization behavior remains unchanged.
- Prove private IPC rejects unauthorized or stale peers.
- Prove logs and diagnostics do not expose secrets.

## Rollout Plan

### Default placement progression

1. Combined service with Host lifecycle present.
2. Combined service with canonical Host APIs and Control Server facade.
3. Combined service with connector v2 reference implementation.
4. Opt-in or capability-gated detached placement for internal proof.
5. Detached Control Server and migrated bundled connectors by default.
6. Legacy external v1 plugins remain automatically co-located.

The user still runs one public service throughout this progression.

### Cohort gates

A connector or owner can move to detached default only when:

- it declares the modern capability;
- its config paths have complete ownership metadata;
- its lifecycle and fault-injection suite passes;
- its delivery reconciliation suite passes where relevant;
- upgrade and rollback proof passes;
- diagnostics identify failures without requiring internal knowledge.

### Rollback

Rollback returns an owner to combined placement while preserving the same Host APIs and state ownership. It must not reactivate a removed core implementation or create dual writes.

### Observability

Additive diagnostics should expose:

- combined service health;
- owner health and readiness;
- owner placement;
- desired configuration revision;
- active revision per owner;
- pending or failed apply action;
- restart count, budget, and next retry;
- connector account health;
- delivery backlog and failure classification without message content or secrets.

## Risk Register

| Risk | Severity | Mitigation and gate |
| --- | --- | --- |
| Dual core execution during migration | Critical | One canonical Host API per migrated capability; delete old internal path before phase exit. |
| Duplicate or stale channel delivery | Critical | Delivery IDs, receipts, idempotency, leases, fencing, and restart fault proof. |
| External plugin incompatibility | Critical | Automatic legacy v1 co-location, unchanged fixtures, additive v2, no initial deprecation. |
| Multiple writers to canonical state | Critical | Host-only state ownership and boundary checks. |
| Configuration split-brain | Critical | Complete validation, owner prepare, desired/active revisions, fail-closed ownership, recovery proof. |
| Hidden lifecycle globals | High | Inventory, dependency guardrails, deterministic shutdown tests, move one owner at a time. |
| Protocol behavior drift | High | Keep Control Server as compatibility facade; unchanged protocol suites and clients. |
| Expanded local trust boundary | High | Private authenticated IPC, least privilege, connector-scoped credentials, stale-peer fencing. |
| Operator complexity | High | One public service, existing config, combined health, additive owner diagnostics. |
| Rollback reintroduces two implementations | High | Rollback changes placement only; Host remains canonical. |
| Excess resource or startup cost | Medium | Measure per-owner startup, memory, connection, and restart costs before detached default. |
| Migration stalls with permanent mixed architecture | Medium | Phase exit gates, ownership inventory, and bundled-caller migration ratchets. |

## Review and Landing Requirements

Every implementation PR should state:

- owner boundary changed;
- public and plugin compatibility impact;
- configuration paths affected;
- old internal path removed or retained contract;
- focused proof run;
- fault or upgrade proof when relevant;
- rollback behavior;
- remaining phase gate.

Larger behavior, plugin SDK, protocol, security, and default-placement changes require owner review. A phase should not be considered complete while its compatibility or real-behavior proof is deferred.

## Completion Criteria

This RFC is implemented when:

- Host core systems run and remain useful with zero channels and no Control Server;
- current public commands, config, protocol, UI, TUI, CLI, nodes, and hooks continue to work;
- existing external plugins work without changes;
- migrated connectors can restart independently;
- Control Server can restart independently;
- owner-scoped config changes affect only their owners;
- explicit full restart retains its current behavior;
- Host is the only canonical core implementation and state writer;
- stable-package upgrade and rollback proof pass;
- detached placement is an internal detail users do not need to configure or understand.
