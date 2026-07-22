# Implementation Plan

This plan delivers RFC 0025 by extending OpenClaw's existing
`screen.snapshot` + `computer.act` architecture. The former plan for projecting
CUA's native MCP catalog through a dedicated provider route is preserved in
[alternative-node-mcp-implementation-plan.md](alternative-node-mcp-implementation-plan.md).

Work is organized into mergeable PRs and parallel waves. A later wave may begin
against frozen fixtures before every earlier platform implementation has
landed, but production rollout follows the dependency graph.

## Delivery rules

- Every PR is independently safe. Incomplete v2 capabilities remain
  unadvertised and unavailable.
- V1 `computer.act`, `screen.snapshot`, frame binding, arming, idempotency,
  cancellation, and Peekaboo behavior remain green throughout migration.
- Protocol changes are additive. Old nodes continue to expose only v1.
- OpenClaw core remains provider-neutral. CUA versions, MCP mappings, skill,
  policies, and artifact metadata live in the bundled `cua-computer` plugin.
- A public Plugin SDK method lands only with the migrated CUA plugin as a real
  runtime consumer.
- The Gateway never sends a driver URL, executable path, socket, launch recipe,
  native session id, or local resource path to a node.
- The model never receives a raw CUA MCP passthrough or CLI fallback.
- Unsupported action variants are omitted or rejected, never silently weakened.
- Provider changes, restarts, and capability changes invalidate generation and
  every dependent frame or semantic reference.
- Default rollout waits for packaged macOS, Windows, Linux, local-Gateway, and
  remote-Gateway proof. Individual platform capabilities may remain explicitly
  unavailable.

## Dependency graph

```text
Wave 0: contract freeze and CUA fixtures
  CU-1 + CU-2
       |
       v
Wave 1: OpenClaw v2 foundations
  OC-1 ------+------ OC-2
    |        |        |
    +------ OC-3 -----+
                 |
                 v
Wave 2: provider and platform vertical slices
  OC-4 (CUA semantic Windows/Linux) --+
  OC-5 (macOS embedded CUA) ----------+--> OC-8 integration gate
  WIN-1 (Windows companion host) -----+
  OC-6 (Peekaboo/provider selection) -+
  OC-7 (local Gateway loopback) ------+
                 |
                 v
Wave 3: rich CUA families
  OC-9A app/window/input
  OC-9B browser
  OC-9C recording/resources
  OC-9D skill/model guidance
                 |
                 v
Wave 4: artifacts, onboarding, security and packaging
  OC-10A artifacts/update
  OC-10B UX/diagnostics
  OC-10C policy/security
                 |
                 v
Wave 5: cross-platform acceptance and default rollout
  OC-11 -> OC-12
```

`CU-1` and `CU-2` can proceed in parallel with the RFC review. `OC-2` and
`OC-3` can proceed in parallel after `OC-1` freezes the v2 fixtures. Platform
work can begin against those fixtures before every core PR merges.

## Wave 0: Contract freeze and upstream alignment

### CU-1: Freeze the CUA-to-`computer.act` parity matrix

- Repo: `openclaw/openclaw`
- Depends on: RFC acceptance
- Can run with: `CU-2`
- Work:
  - Turn the RFC action-family table into a machine-readable or test-fixture
    matrix covering all 49 published CUA MCP tools.
  - Classify each tool as portable model action, consolidated alias,
    node-internal lifecycle, local maintenance, or intentionally omitted legacy
    surface.
  - Record accepted CUA `tools/list`, input schemas, output fixtures, refusal
    fixtures, and platform capability data for the first supported version.
  - Include CUA current-main contract manifest fixtures for the 14 generated
    portable tools without assuming that manifest covers the rich surface.
  - Freeze target-ref, result, delivery, observation, resource, and generation
    semantics used by the OpenClaw protocol fixtures.
- Proof:
  - Every published CUA tool appears exactly once in the matrix.
  - Fixtures cover images, structured content, effect/verification/escalation,
    stale refs, unsupported delivery, browser refs, recording, and refusal.
  - Source links point to the accepted CUA tag rather than moving `main`.
- Merge state: fixtures and design data only; no runtime behavior.

### CU-2: Align upstream CUA embedding and skill contracts

- Repo: `trycua/cua`
- Depends on: none
- Can run with: `CU-1` and all Wave 1 work
- Work:
  - Update [trycua/cua#2412](https://github.com/trycua/cua/issues/2412)
    from native OpenClaw MCP projection to an OpenClaw `computer.act` action
    profile, or agree that OpenClaw owns a thin version-pinned overlay.
  - Confirm the accepted embedded `serve` + `mcp` launch contract and macOS
    responsibility-chain tests.
  - Continue inherited connected IPC in
    [trycua/cua#2410](https://github.com/trycua/cua/issues/2410).
  - Continue protected browser host consent in
    [trycua/cua#2411](https://github.com/trycua/cua/issues/2411).
  - Continue trusted host resources/helpers in
    [trycua/cua#2413](https://github.com/trycua/cua/issues/2413).
  - Expand the generated contract manifest to richer action families where CUA
    wants stable portable schemas.
- Proof:
  - Packaged reference-host test confirms direct app spawning and host TCC
    attribution.
  - Skill profile contains no CLI/bootstrap/transport instructions.
  - Resource and protected-browser capabilities remain machine-detectable and
    fail closed when unavailable.
- Merge state: upstream improvements are consumed capability-by-capability.
  Basic desktop observation/input does not wait for browser/resource features.

## Wave 1: OpenClaw v2 foundations

### OC-1: Add v2 protocol types and capability fixtures

- Repo: `openclaw/openclaw`
- Depends on: `CU-1` fixture freeze
- Can run with: early `OC-2` and `OC-3` branches
- Work:
  - Add additive Gateway/node protocol types for the Computer Use capability
    descriptor, provider id/generation, readiness, supported action names,
    target classes, delivery modes, observation classes, and feature flags.
  - Add the `ComputerActV2Request`, closed action union, portable target union,
    observation envelope, resource handles, and result envelope.
  - Define stable closed error codes for stale provider/execution/frame/
    observation/element/browser refs, unsupported action/delivery, busy host,
    missing permission, and unavailable backend.
  - Preserve v1 wire decoding and current `OpenClawComputerActParams` fixtures.
  - Generate or share fixtures consumed by TypeScript and Swift.
- Proof:
  - Protocol round-trip tests for every action family and result branch.
  - Old node fixtures decode unchanged and expose no inferred v2 capability.
  - Unknown v2 variants fail closed without changing protocol version.
- Merge state: additive and dormant; no node advertises v2 yet.

### OC-2: Extend the built-in Computer Use tool runtime

- Repo: `openclaw/openclaw`
- Depends on: `OC-1`
- Can run with: `OC-3`
- Work:
  - Retain the existing `computer` tool and current v1 action schema.
  - Add precise model-facing schemas for the v2 action families. Split into a
    small family of built-in tools only if provider schema limits make one
    discriminated union unreliable; every tool still invokes `computer.act`.
  - Bind one execution to node, provider id, provider generation, display,
    observation refs, and resource handles.
  - Track semantic refs only when their source result remains in model context,
    extending the current screenshot-context invalidation rule.
  - Preserve current coordinate `frameId` authorization.
  - Project mixed image/structured observations and portable result evidence.
  - Prefer a provider-returned fresh observation; use delayed
    `screen.snapshot` only when the result lacks an image.
  - Never retry mutations or advance the CUA interaction ladder.
- Proof:
  - Existing `computer-tool` tests remain green.
  - New tests cover target affinity, stale semantic refs, provider generation,
    provider observations, screenshot fallback, result precedence, and no
    automatic mutation retry.
  - Multi-node and provider-switch tests cannot retarget an established
    execution silently.
- Merge state: v2 activates only for a node advertising matching capability.

### OC-3: Add the node-local provider runtime and lifecycle

- Repo: `openclaw/openclaw`
- Depends on: `OC-1`
- Can run with: `OC-2`
- Starting point: current `registerNodeHostCommand` and optional identity work
  in [openclaw/openclaw#110293](https://github.com/openclaw/openclaw/pull/110293)
- Work:
  - Add one node-local Computer Use provider registry and active-provider
    selection owner.
  - Register `screen.snapshot` and `computer.act` once and dispatch both to the
    selected provider execution.
  - Add provider readiness, capability publication, availability watching, and
    generation updates.
  - Add exclusive mutating execution ownership and one serialized action queue.
  - Add provider execution open/close with an opaque node-generated session.
  - Route completion, cancellation, timeout, disconnect, crash, disable,
    provider switch, Stop, and idle expiry through one idempotent close path.
  - Extend node-host invocation context with the run identity and cancellation
    signal needed by the provider without exposing either to the model.
  - Migrate the existing CUA plugin's v1 command registration as the first real
    consumer before exporting the SDK surface.
- Proof:
  - Duplicate providers cannot both own the command pair.
  - Readiness changes republish the node declaration deterministically.
  - Every close trigger releases held input and invalidates provider state.
  - A second mutating execution receives `COMPUTER_HOST_BUSY`.
  - External plugin tests prove provider registration does not grant native app
    permission or process-launch authority.
- Merge state: current CUA v1 behavior remains opt-in; provider registry is now
  exercised in production code.

## Wave 2: Provider and platform vertical slices

### OC-4: Refactor the CUA plugin around the provider runtime

- Repo: `openclaw/openclaw`
- Depends on: `OC-3`; consumes `OC-1` fixtures
- Can run with: `OC-5`, `OC-6`, `OC-7`
- Work:
  - Split driver lifecycle, MCP transport, mapping, frame state, and provider
    execution into explicit modules.
  - Replace the hard-coded 0.10 prefix check with the accepted compatibility
    bundle and exact capability/schema validation.
  - Preserve the deny-by-default environment allowlist, telemetry/update
    opt-outs, serialization, geometry checks, and typed refusals.
  - Inject one CUA session per OpenClaw execution and close it through provider
    lifecycle.
  - Publish v2 readiness/capabilities only for implemented action families.
  - Keep unsupported primary-display, hold, modifier, Wayland, and platform
    branches explicit until later PRs close them.
- Proof:
  - Existing `extensions/cua-computer` tests remain green.
  - Recorded CUA fixtures prove version, capability, schema, and generation
    behavior.
  - Provider restart invalidates frame and session state.
- Merge state: behavior-equivalent to current v1 plus provider lifecycle; still
  disabled by default.

### OC-5: Add the macOS app-owned embedded CUA host

- Repo: `openclaw/openclaw`
- Depends on: `OC-3`; integrates with `OC-4`
- Can run with: `WIN-1`, `OC-6`, `OC-7`
- Work:
  - Add app-local CUA provider selection and lifecycle state.
  - Bundle or verify the accepted CUA artifact.
  - Make `OpenClaw.app` directly spawn `cua-driver serve --embedded` with a
    private endpoint and minimal environment.
  - Restart the daemon after TCC grant changes and verify attribution plus real
    capture.
  - Pass a private app-owned provider endpoint to the canonical TypeScript node
    worker through an internal launch contract.
  - Let the bundled CUA plugin start only the MCP proxy and fulfill the command
    pair through the worker.
  - Stop children and invalidate worker/provider generation on app Stop,
    disconnect, provider switch, permission loss, crash, and update.
- Proof:
  - Swift process tests prove direct app spawn and no Gateway/worker daemon
    spawn path.
  - Signed packaged DMG shows OpenClaw as the intended Accessibility and Screen
    Recording identity.
  - Local and remote Gateways complete v1 screenshot/click/type tasks through
    the worker CUA adapter.
  - Endpoint ownership, mode, replacement, cleanup, and parent-death tests pass.
- Merge state: CUA selectable but not default; richer v2 families may still be
  absent.

### WIN-1: Add the Windows companion CUA host

- Repo: `openclaw/openclaw-windows-node`
- Depends on: `OC-3`; integrates with `OC-4` and `OC-1` fixtures
- Can run with: `OC-5`, `OC-6`, `OC-7`
- Work:
  - Host the canonical TypeScript node worker and bundled CUA plugin in the
    companion, or add an equivalent worker boundary that consumes the same
    plugin and protocol fixtures without a second action mapping.
  - Supervise CUA daemon/proxy lifecycle in the logged-in interactive user
    session and reject Session 0.
  - Consume the same accepted compatibility bundle and managed artifact lock as
    the main repository.
  - Publish the same v2 provider descriptor, readiness, generation, and command
    pair as a CLI Windows node.
  - Own local setup, Stop, update, rollback, crash cleanup, and signed helper
    lifecycle for any elevated/UIAccess capability.
- Proof:
  - Packaged companion works with local and remote Gateways.
  - Session 0, disconnected desktop, unknown artifact, provider crash, and Stop
    fail closed.
  - Protocol fixtures and CUA mapping are not independently reimplemented.
- Merge state: CUA selectable in the packaged companion but not default.

### OC-6: Put Peekaboo behind explicit provider selection

- Repo: `openclaw/openclaw`
- Depends on: `OC-3`
- Can run with: `OC-4`, `OC-5`, `OC-7`
- Work:
  - Represent the existing native macOS `computer.act` fulfiller as provider
    `peekaboo` in the app's active-provider state.
  - Advertise only its actual v1 capabilities.
  - Ensure the TypeScript worker command pair takes precedence only when CUA is
    selected and ready.
  - End active execution, release held input, and advance generation on
    provider switch.
  - Add no per-call fallback between CUA and Peekaboo.
- Proof:
  - Both providers pass existing v1 frame-binding and arming scenarios.
  - Switching providers invalidates old frame ids and actions.
  - CUA failure never dispatches the same action through Peekaboo.
- Merge state: explicit macOS provider choice works before CUA becomes default.

### OC-7: Add a local Gateway loopback desktop node

- Repo: `openclaw/openclaw`
- Depends on: `OC-3`, `OC-4`
- Can run with: `OC-5`, `OC-6`
- Work:
  - Add a local, explicitly enabled desktop node-host mode for Gateway-only
    Windows/Linux installations.
  - Load the same bundled plugin registry and advertise the same command pair
    and v2 descriptor.
  - Reuse node command policy and arming rather than adding direct Gateway CUA
    execution.
  - Keep macOS CLI-only behavior explicit: standalone CUA attribution is
    allowed only when the user chooses it; OpenClaw-owned TCC requires the app.
- Proof:
  - Gateway-only Windows/Linux scenarios select exactly one loopback node and
    pass current v1 tasks.
  - Remote nodes and loopback nodes obey the same ambiguity and selection rules.
  - Disabling loopback mode stops provider children and removes capability.
- Merge state: opt-in local convenience path.

### OC-8: V2 integration gate

- Repo: `openclaw/openclaw`
- Depends on: `OC-2`, `OC-4`, `OC-5`; consumes `OC-6` and `OC-7`
- Work:
  - Join capability advertisement, core tool binding, node provider execution,
    CUA session, macOS app service handoff, and result projection.
  - Implement one harmless v2 vertical action: list windows, observe one window
    with image + semantic data, act on an element, and verify with fresh state.
  - Run the same scenario on Linux X11 and macOS packaged app; run Windows when
    its host lane is available.
- Proof:
  - Local and remote Gateway versions of the scenario pass.
  - Stale observation, provider restart, cancellation, and local Stop fail
    closed.
- Gate unlocked: action-family work may merge against a proven end-to-end v2
  route.

## Wave 3: Rich CUA action families

The four lanes below share protocol fixtures but may be implemented and reviewed
in parallel after `OC-8`.

### OC-9A: App, window, semantic observation, and rich input

- Repo: `openclaw/openclaw`
- Depends on: `OC-8`
- Can run with: `OC-9B`, `OC-9C`, `OC-9D`
- Work:
  - Implement app/window discovery and app lifecycle actions.
  - Implement `get_accessibility_tree` and complete `get_window_state` with
    bounded tree, image, element refs, query, truncation, and degradation.
  - Add window-point and element targets, `set_value`, `zoom`, delivery mode,
    and supported modifier/hold branches.
  - Preserve standalone `bring_to_front` semantics.
  - Implement explicit `escalate_scope` with CUA session capture scope.
- Proof:
  - Background element and window-pixel paths work without foreground theft on
    supported platforms.
  - Stale refs, hidden/minimized windows, DPI/Retina mapping, and provider
    generation are covered.
  - Unsupported branches refuse before MCP dispatch.

### OC-9B: Browser targeting and full-background actions

- Repo: `openclaw/openclaw`
- Depends on: `OC-8`; isolated-profile support may consume upstream CUA work
- Can run with: `OC-9A`, `OC-9C`, `OC-9D`
- Work:
  - Add browser observation and all typed browser action variants.
  - Bind native window -> browser target -> tab/page refs exactly.
  - Preserve trusted pointer versus explicit synthetic DOM-event semantics.
  - Invalidate refs on navigation, target loss, provider restart, and execution
    close.
  - Enable isolated driver-owned profile preparation first.
  - Keep existing-profile attachment unavailable until protected host consent
    and indicator support from CUA passes packaged proof.
- Proof:
  - Occluded Chromium/Electron scenarios exercise navigation, text, DOM click,
    dialogs, and pointer refusal/success branches.
  - Heuristic target selection and stale refs fail closed.
  - Existing-profile flow cannot be approved by model or Gateway arguments.

### OC-9C: Recording, replay, and host-owned resources

- Repo: `openclaw/openclaw`
- Depends on: `OC-8`, applicable `trycua/cua#2413` capabilities
- Can run with: `OC-9A`, `OC-9B`, `OC-9D`
- Work:
  - Add recording state/start/stop and replay actions.
  - Add opaque OpenClaw resource handles for uploads, downloads, recordings,
    screenshots, and replay inputs.
  - Inject node-owned output roots and accepted helper paths outside model
    schemas.
  - Scope recording ownership to one provider execution.
  - Keep update and FFmpeg installation local and non-agent-callable.
- Proof:
  - Path traversal, symlink replacement, arbitrary absolute paths, ambient
    helper lookup, and cross-session recording control fail.
  - Completion and every abnormal close path stop recording and finalize or
    discard artifacts deterministically.

### OC-9D: CUA skill and model-behavior parity

- Repo: `openclaw/openclaw`, optionally `trycua/cua`
- Depends on: `CU-1`; integrates after `OC-9A/B/C` capability names settle
- Can run with: all `OC-9` implementation lanes
- Work:
  - Build the version-pinned OpenClaw CUA skill profile.
  - Preserve core, platform, browser, and recording guidance while replacing
    CLI/MCP-native calls with OpenClaw actions.
  - Filter guidance by advertised action families without creating contradictory
    platform instructions.
  - Bind skill digest to the accepted CUA compatibility bundle.
- Proof:
  - Static checks reject CLI, shell, daemon, socket, installation, update, and
    native-session instructions.
  - Model evaluations cover snapshot-before-action, tree/image cross-check,
    background-first delivery, no-op handling, browser binding, foreground and
    desktop escalation, recording, and cleanup.
  - Gateway traces prove no automatic mutation retry or ladder advancement.

## Wave 4: Artifacts, onboarding, security, and packaging

### OC-10A: Managed CUA artifacts and updates

- Repo: `openclaw/openclaw`; Windows package lane may consume shared metadata
- Depends on: `OC-4`, platform packaging decisions
- Can run with: `OC-10B`, `OC-10C`
- Work:
  - Define one plugin-owned artifact lock and accepted compatibility bundle.
  - Bundle CUA in official packages where approved; otherwise add explicit
    node-local managed install.
  - Verify digest, publisher expectation, regular-file identity, executable
    path, and running image before OS work.
  - Add atomic update, rollback, disable, and uninstall.
  - Keep ambient `PATH` as developer mode only.
- Proof:
  - Clean install, import, update, failed update rollback, package upgrade, and
    uninstall pass on each platform.
  - Tamper, replacement, unknown version, and unknown capability manifest fail.

### OC-10B: Host-aware onboarding and diagnostics

- Repo: `openclaw/openclaw`; Windows companion UI as applicable
- Depends on: `OC-5`, `OC-7`; consumes action readiness from `OC-9`
- Can run with: `OC-10A`, `OC-10C`
- Work:
  - Add local provider selection, enablement, install, permission, backend,
    test, Stop, update, rollback, and disable flows.
  - Add Gateway host selection, active-provider/readiness display, arming, and
    deep links or local-action instructions.
  - Add `openclaw computer setup/status/test` for non-app node hosts.
  - Distinguish Gateway-fixable, node-local, permission, backend, artifact, and
    policy failures with closed codes.
- Proof:
  - Local Gateway, remote Gateway, multiple node, multiple provider, missing
    permission, incompatible driver, and disconnected node flows are covered.
  - Diagnostics contain no Computer Use content, native paths, endpoints,
    policies, or raw stderr.

### OC-10C: Policy and security closure

- Repo: `openclaw/openclaw`
- Depends on: `OC-9A/B/C`
- Can run with: `OC-10A`, `OC-10B`
- Work:
  - Add argument-aware classification for high-risk action families.
  - Generate and verify CUA managed policy for the advertised mapping.
  - Prove CLI, shell, generic MCP, raw provider calls, and unselected plugin
    commands cannot reach the managed CUA instance.
  - Audit macOS private endpoint handling and decide whether
    `trycua/cua#2410` is a default-rollout blocker.
  - Complete local Stop, protected browser consent, resource isolation,
    provider generation, replay, timeout ambiguity, and hostile-argument tests.
- Proof:
  - Security acceptance matrix passes on packaged macOS, Windows, and Linux.
  - Any unavailable upstream protected feature remains absent from capability
    advertisement rather than shipping weakened behavior.

## Wave 5: Cross-platform acceptance and rollout

### OC-11: Packaged cross-platform acceptance

- Repo: `openclaw/openclaw` plus Windows companion package lane
- Depends on: `OC-9A-D`, `OC-10A-C`
- Work:
  - Run packaged macOS, Windows, Linux X11, supported Wayland, local-Gateway,
    remote-Gateway, and provider-switch scenarios.
  - Verify v1 regression, v2 semantic flow, browser, recording/resources,
    provider sessions, cleanup, upgrades, rollback, and diagnostics.
  - Compare advertised capability with the accepted CUA parity matrix and
    document every intentionally unavailable branch.
- Exit gate:
  - Every applicable RFC acceptance criterion has executable evidence.
  - Missing platform features are explicit capabilities, not hidden fallbacks.

### OC-12: Make CUA the default ready provider

- Repo: `openclaw/openclaw`
- Depends on: `OC-11`
- Work:
  - Enable/select CUA by default only on nodes where the accepted artifact and
    required readiness checks pass.
  - Keep provider installation/permission prompts local and explicit.
  - Keep Peekaboo selectable on macOS and preserve explicit provider affinity.
  - Publish provider-authoring, setup, security, and troubleshooting docs.
  - Add privacy-preserving readiness, install, skew, and crash-loop telemetry
    where OpenClaw policy permits it.
- Rollback:
  - Disable default CUA selection while preserving explicit CUA and Peekaboo
    choices.
  - Roll managed artifacts to the retained known-good version.
  - Never switch an active execution to another provider.

## PR and ownership matrix

| ID | Owner boundary | Depends on | Parallel lane |
| --- | --- | --- | --- |
| CU-1 | CUA/OpenClaw contract fixtures | RFC | Contract research |
| CU-2 | CUA embedding/skill/resources | none | Upstream |
| OC-1 | Gateway/node v2 protocol | CU-1 | Protocol |
| OC-2 | Built-in Computer Use tool | OC-1 | Gateway/agent runtime |
| OC-3 | Node provider runtime/SDK | OC-1 | Node host |
| OC-4 | CUA plugin provider refactor | OC-3 | Plugin |
| OC-5 | macOS embedded CUA host | OC-3/4 | macOS app |
| WIN-1 | Windows companion CUA host | OC-3/4 | Windows companion |
| OC-6 | Peekaboo provider selection | OC-3 | macOS app |
| OC-7 | Local Gateway loopback node | OC-3/4 | Gateway/node |
| OC-8 | First v2 vertical slice | OC-2/4/5 | Integration |
| OC-9A | App/window/input parity | OC-8 | CUA adapter |
| OC-9B | Browser parity | OC-8 | CUA/browser |
| OC-9C | Recording/resources | OC-8 + upstream resource support | CUA/resources |
| OC-9D | Skill/model parity | CU-1 + action names | Guidance/evals |
| OC-10A | Artifacts/update | OC-4/5 | Packaging |
| OC-10B | Onboarding/diagnostics | OC-5/7 | UX |
| OC-10C | Security/policy | OC-9A-C | Security |
| OC-11 | Packaged acceptance | OC-9/10 + WIN-1 | Cross-platform QA |
| OC-12 | Default rollout | OC-11 | Product/release |

## Fixture and branch strategy

- `OC-1` owns canonical TypeScript/Swift wire fixtures. Native apps consume the
  fixtures and do not regenerate protocol shapes by hand.
- `CU-1` pins CUA fixtures to accepted tags. Tests do not fetch CUA `main`.
- The CUA plugin compatibility bundle is one source of truth for supported
  versions, mappings, policies, skill digest, and artifacts.
- Platform PRs use fake providers for lifecycle coverage and reserve real CUA
  for focused packaged E2E lanes.
- Stacked branches may consume provisional fixtures, but merged PRs depend only
  on committed or published immutable fixtures.
- Action families can land independently because capability advertisement is
  exact. A half-implemented family remains absent.

## Optional infrastructure

- [openclaw/openclaw#110293](https://github.com/openclaw/openclaw/pull/110293)
  may provide provider identity before `OC-3`. `OC-3` should consume it if it
  lands, but should not retain a second registry.
- [openclaw/openclaw#98005](https://github.com/openclaw/openclaw/pull/98005)
  may help future external non-TypeScript providers. No current wave depends on
  it.
- Inherited connected IPC from
  [trycua/cua#2410](https://github.com/trycua/cua/issues/2410) should replace the
  private socket when available. `OC-10C` decides whether it is required before
  default rollout based on the packaged threat review.

## Critical path and schedule risk

The initial useful path is:

```text
CU-1 -> OC-1 -> OC-2/OC-3 -> OC-4/OC-5 -> OC-8
```

The default rollout path is:

```text
OC-8 -> OC-9A-D -> OC-10A-C -> OC-11 -> OC-12
```

Main schedule risks are:

- CUA schema churn before a stable rich compatibility manifest;
- signed packaged macOS direct-spawn and TCC proof;
- deciding whether private-socket embedding is sufficient for first rollout;
- protected existing-profile consent and host-owned resource support;
- Windows interactive-session and elevated-target packaging;
- Wayland compositor variance;
- model-tool schema limits if the v2 action union becomes too large;
- keeping the adapted skill synchronized without forking CUA's operating model.

These risks narrow capability or delay default selection. They do not justify a
generic MCP bypass, raw provider passthrough, silent fallback, or reimplementation
of CUA's native driver.
