# Implementation Plan

> **Alternative retained for comparison.** This plan implements the original
> node-hosted native MCP proposal. It is not the delivery plan selected by the
> primary RFC.

This sidecar turns RFC 0025 into mergeable work across `trycua/cua`,
`openclaw/openclaw`, and `openclaw/openclaw-windows-node`. Work is grouped into
parallel development waves. A wave may begin when its input contracts are
stable; individual PRs still merge in the dependency order shown below.

## Delivery Rules

- Every merged PR is independently safe. Incomplete CUA paths remain
  undiscoverable and cannot materialize agent tools.
- Protocol changes are additive. A node that does not publish Computer Use
  inventory continues to operate without Computer Use.
- The public Plugin SDK registration lands with a real runtime consumer.
  Peekaboo is the first consumer; CUA follows on the same contract.
- The Gateway never sends install recipes, executable paths, or launch flags to
  a node. Official nodes consume a locally trusted provider package.
- CUA is not selected by default until its node-local provider is installed,
  compatible, enabled, permission-ready, private-transport-ready,
  protected-consent-ready, and probe-ready.
- Provider readiness never implies run authorization. Each execution acquires a
  unique lease and exact bounded manifest before provider-native tools become
  callable, then releases them through one idempotent terminal path.
- Platform PRs share protocol and provider-package fixtures. They do not copy
  CUA tool policy or artifact metadata into Swift, C#, and TypeScript.
- Each PR owns one boundary where practical. Cross-repo generated artifacts are
  versioned and digest-checked rather than coordinated by undocumented timing.
- Temporary Computer Use exposure through generic MCP and the old direct
  `computer.act` materialization path are removed when their canonical
  replacements land. Ordinary generic MCP behavior remains unchanged.

## Dependency Graph

```text
CUA-1 + CUA-4 -----------------------------------> OC-6 Linux host
CUA-2 ---------------------------> OC-5 CUA plugin
CUA-3 ---------------------------> OC-5 and OC-6
CUA-4 ---------------------------> OC-5 and platform hosts

OC-1 node protocol/router ----+--> OC-2 provider runtime + Peekaboo
                              +--> OC-3 reusable node MCP host
                              +--> OC-4 generated provider package

OC-2 + OC-4 + CUA-2/3/4 ------------------------> OC-5 CUA plugin
OC-3 + OC-4 + CUA-1/3/4 ------------------------> OC-6 Linux host
OC-5 + OC-6 ------------------------------------> OC-7 Linux gate

OC-7 + CUA-1/4 --------------+-------------------> OC-8 macOS
OC-4/5 + CUA-1/4 ------------+-------------------> WIN-1 Windows
OC-7 ------------------------+-------------------> OC-9A Gateway UX
OC-6 ------------------------+-------------------> OC-9B Linux CLI/doctor

OC-8 + WIN-1 + OC-9A/B -------------------------> OC-10A/B/C + WIN-2
OC-10A/B/C + WIN-2 ------------------------------> OC-11 default rollout
```

`OC-1`, `CUA-1`, `CUA-2`, `CUA-3`, and `CUA-4` are the initial parallel lanes.
`OC-2` and `OC-3` can be developed in parallel once the `OC-1` wire fixtures
are stable, although both merge after `OC-1`. `OC-5` and `OC-6` can then be
developed in parallel against `OC-4` fixtures. macOS, Windows, and product UX
are the largest final parallel wave.

## Shared Contract Freeze

Before Wave 1 branches diverge, owners should agree on these RFC-level names
and invariants:

| Contract | Freeze requirement |
| --- | --- |
| Provider identity | `providerId`, `providerSpecDigest`, and node-local `generation` have distinct meanings. |
| Invocation | `computer.provider.call.v1` carries one selected node, provider, generation, execution/lease, policy lease, tool, classified arguments, and deadline. |
| Inventory | Provider readiness is separate from execution authorization; both use closed states with driver provenance, tool/skill digests, permission attribution, and protected-consent readiness. |
| Errors | Unknown provider/tool, stale generation/execution, inactive authorization, host busy, local approval required, rebound/retry required, and backend unavailable have stable codes. |
| Live schemas | The reviewed catalog is the maximum surface; live `tools/list` schemas select supported reviewed branches, and unsupported branches are rejected rather than stripped. |
| Results | Existing MCP text, image, structured result, cancellation, timeout, and size-limit behavior is preserved, including native effect/escalation precedence without automatic mutation retry. |
| Provider package | One generated data-only package contains artifact locks, launch capabilities, probes, and a provider-spec digest. |
| Execution binding | One v1 execution lease maps to one node-injected opaque CUA session; durable chat/session ids and callers cannot own or supply native authority. |
| Release | Every execution exit reaches one idempotent release path that revokes grants/indicators, ends leases/session state, releases input/recording, removes the process manifest, and advances generation. |

The freeze is a review checkpoint, not a separate permanent schema repository.
Canonical schemas live in the repositories that execute them.

## Wave 0: Upstream CUA Prerequisites

These upstream PRs can proceed independently of OpenClaw core. They are ship
dependencies, not blockers for starting the additive Gateway work.

### CUA-1: Inherited connected embedded transport

- Repo: `trycua/cua`
- Depends on: none
- Can run with: `CUA-2`, `CUA-3`, `CUA-4`, `OC-1`
- Work:
  - Let the embedding host create an already-connected Unix or Windows channel
    and pass one protected endpoint to `serve --embedded` and the other to the
    MCP proxy.
  - Do not create a discoverable listening socket, named pipe, bearer secret,
    or reusable endpoint in this mode.
  - Publish the exact launch and handle-inheritance contract for macOS,
    Windows, and Linux.
  - Ensure daemon and proxy shutdown follows parent/handle closure.
- Proof:
  - Integration tests show that only inherited handles can reach the daemon.
  - A second same-user process cannot discover or connect to an endpoint.
  - macOS direct-spawn tests preserve host attribution.
- Gate unlocked: production node hosts may launch CUA embedded mode.

Tracker: [trycua/cua#2410](https://github.com/trycua/cua/issues/2410)

### CUA-4: Embedded protected-consent and indicator adapter

- Repo: `trycua/cua`
- Depends on: none; integrates with the private channel from `CUA-1`
- Can run with: `CUA-1`, `CUA-2`, `CUA-3`, `OC-1`
- Work:
  - Expose an authenticated embedding-host implementation path for CUA's
    `ProtectedConsentProvider` over a separate inherited control channel or a
    structurally separated control subchannel that model-facing MCP cannot
    write.
  - Bind schema/nonce/request digest, daemon instance, provider generation,
    permission mode, policy hashes, OpenClaw execution lease, CUA/transport
    sessions, operation/risk, expiry, and exact browser resource.
  - Support standard decisions and bounded `activate_preapproved()` without a
    second prompt, while requiring indicator activation before a grant becomes
    live.
  - Support host Stop, daemon-driven indicator deactivation, asynchronous
    revocation, and fail-closed host/control-channel death.
- Proof:
  - Wrong digest, daemon, generation, policy, execution lease, session,
    operation, expiry, PID/window, process fingerprint, browser product, or
    endpoint owner is rejected.
  - Indicator activation failure prevents the grant; local Stop revokes it and
    releases browser capabilities even after the original caller disconnects.
  - Packaged-host tests prove that the protected UI cannot be driven through
    CUA AX, PX, foreground, desktop, or browser routes.
- Gate unlocked: bounded existing-profile attachment may become run-authorized
  after the daemon restart loads an exact-resource manifest.

Tracker: [trycua/cua#2411](https://github.com/trycua/cua/issues/2411)

### CUA-2: OpenClaw MCP-first skill and capability profile

- Repo: `trycua/cua`
- Depends on: none
- Can run with: `CUA-1`, `CUA-3`, `CUA-4`, `OC-1`
- Work:
  - Publish a versioned OpenClaw skill profile that retains CUA workflow,
    platform, AX-background, PX-background, exact-browser-page,
    foreground-delivery, explicit desktop-escalation, snapshot, and
    verification guidance while removing direct CLI/bootstrap, daemon,
    transport-selection, and shell instructions.
  - Extend the machine-readable driver manifest with the embedded transport,
    authorization, recording, browser, helper-path, and skill-profile
    capabilities OpenClaw must probe.
  - Bind the profile and companion resources to a digest and driver version.
- Proof:
  - The profile can complete representative CUA tasks using only MCP tools.
  - Result guidance distinguishes `confirmed`, `unverifiable`,
    `suspected_noop`, refusal/delivery failure, and
    `escalation.recommended` without automatic mutation retry.
  - `bring_to_front` remains standalone, and foreground transition uses a
    live-schema `delivery_mode: "foreground"` argument.
  - A mismatched profile or missing required capability fails compatibility.
- Gate unlocked: the bundled plugin can materialize version-matched guidance.

Tracker: [trycua/cua#2412](https://github.com/trycua/cua/issues/2412)

### CUA-3: Node-controlled resources and native helpers

- Repo: `trycua/cua`
- Depends on: none
- Can run with: `CUA-1`, `CUA-2`, `CUA-4`, `OC-1`
- Work:
  - Accept host-injected absolute paths for recording output, download roots,
    upload staging, replay input, and optional helpers such as ffmpeg.
  - Ensure model arguments cannot override those host-owned paths.
  - Make helper availability and browser resource constraints probeable.
  - Preserve managed policy, bounded manifests, exact browser binding, and the
    full-background rung required by the RFC.
- Proof:
  - Arbitrary model-supplied paths and ambient `PATH` helpers are rejected.
  - Exact-resource bounded policy tests cover browser attach and file flows.
- Gate unlocked: OpenClaw can safely expose the corresponding CUA operations.

Tracker: [trycua/cua#2413](https://github.com/trycua/cua/issues/2413)

## Wave 1: OpenClaw Foundations

Wave 1 establishes generic runtime behavior. Development can overlap after the
shared contract freeze, but `OC-1` merges first because it owns the wire shape.

### OC-1: Additive node inventory and classified invocation

- Repo: `openclaw/openclaw`
- Depends on: accepted RFC contract
- Can run with: all Wave 0 work
- Work:
  - Add provider inventory schemas and generated Gateway protocol types.
  - Add `computer.provider.call.v1` to node invocation, dangerous-command
    arming, cancellation, timeout, and result limits.
  - Carry provider-spec digest, generation, tool catalog, policy state, skill
    state, protected-consent state, separate provider readiness/run
    authorization, execution/lease identity, and closed readiness codes.
  - Reject arbitrary server names, commands, native paths, and unknown fields.
  - Add protocol fixtures for old nodes, ready providers, stale generations,
    missing permissions, and backend-unavailable states.
- Proof:
  - Old node clients continue to pair and invoke existing commands.
  - Classified calls fail closed for unknown tools, stale generations,
    disconnects, cancellation, and oversized results.
- Merge state: additive and dormant; no provider tools are visible yet.

### OC-2: Provider runtime, SDK registration, and Peekaboo migration

- Repo: `openclaw/openclaw`
- Depends on: `OC-1`
- Starting point: revise or supersede `openclaw/openclaw#110293`
- Can run with: `OC-3`
- Work:
  - Add the prepared host/provider/execution binding and deterministic selected
    provider tool/skill materialization.
  - Export the narrow Plugin SDK provider registration consumed by runtime.
  - Create the bundled `computer-use` plugin and register Peekaboo as the first
    production consumer.
  - Adapt app-owned `computer.act` behind provider `peekaboo`, preserving
    arming, idempotency, and synthetic-input cleanup.
  - Add explicit provider selection and secure execution-profile conflicts.
  - Remove the old parallel Peekaboo materialization path in the same PR.
- Proof:
  - Two synthetic nodes cannot leak tools or skills across selected bindings.
  - Provider restart, generation change, and selection change invalidate tools.
  - Peekaboo works through the provider route in a packaged macOS app.
- Merge state: useful without CUA and proves that the SDK has a runtime consumer.

### OC-3: Reusable node MCP provider host

- Repo: `openclaw/openclaw`
- Depends on: `OC-1`
- Can run with: `OC-2`
- Work:
  - Extract persistent MCP initialization, `tools/list`, calls, cancellation,
    and result mapping from generic node MCP behind an internal provider host.
  - Keep generic `mcp.tools.call.v1` behavior unchanged for ordinary MCP.
  - Add the digest-verified provider skill-resource reader without granting
    arbitrary node filesystem or shell access.
  - Add exclusive host lease, cleanup, bounded restart, and generation hooks.
  - Add one idempotent execution-release owner for all terminal paths; it ends
    the injected CUA session and leases, releases input/recording, stops or
    restarts the daemon to remove a process manifest, and advances generation.
- Proof:
  - Generic node MCP regression tests remain green.
  - A test provider returns text, image, and structured results through the
    classified route and reaches the same release path on completion, failure,
    cancellation, timeout, disconnect, crash, explicit CUA session end, Stop,
    OpenClaw session clear, and lease expiry.
- Merge state: reusable internal infrastructure; no CUA process is launched.

## Wave 2: CUA Plugin and Linux Reference Slice

Linux is the reference implementation because it exercises remote-node
lifecycle without coupling the first vertical slice to macOS TCC or the
separate Windows repository.

### OC-4: Generated node provider package and artifact lock

- Repo: `openclaw/openclaw`
- Depends on: `OC-1`; Wave 0 capability names should be stable
- Can run with: late `OC-2`/`OC-3` work
- Work:
  - Define the data-only CUA node provider package and deterministic
    `providerSpecDigest` generation.
  - Add per-platform artifact/helper locks, publisher expectations, launch
    capabilities, required probes, and accepted skill digests.
  - Produce fixtures and a published artifact that macOS packaging, Linux node
    code, and the Windows companion can consume.
  - Add drift checks so generated copies cannot be edited independently.
- Proof:
  - Reproducible generation yields the same digest on supported build hosts.
  - Tampered artifacts, unknown specs, mutable links, and digest drift fail.
- Merge state: data and verification only; it grants no process authority.

### OC-5: Bundled CUA provider adapter

- Repo: `openclaw/openclaw`
- Depends on: `OC-2`, `OC-4`, `CUA-2`, `CUA-4`, relevant `CUA-3` contracts
- Can run with: `OC-6`
- Work:
  - Register provider `cua` in the bundled `computer-use` plugin.
  - Add version/spec compatibility, required and optional tool catalogs,
    argument-aware risk/resource classifiers, and schema adaptation.
  - Treat the reviewed catalog as a ceiling and intersect it with live
    `tools/list` schemas at the semantic-branch level; reject unsupported
    branches instead of silently removing arguments.
  - Inject opaque execution-scoped CUA session ids and reject durable
    chat/session ids or caller-supplied native session fields as authority.
  - Materialize the exact MCP-first skill profile and companion resources.
  - Hide unreviewed tools and operation variants rather than forwarding them.
- Proof:
  - Contract tests use recorded `tools/list` and schema fixtures from each
    accepted CUA version.
  - Fixtures preserve schema-supported `delivery_mode` without an invented
    capability token and keep `bring_to_front` as a standalone tool.
  - Structured verdict tests preserve CUA's result precedence and prove the
    Gateway does not retry mutations or advance the interaction ladder.
  - Tool arguments cannot select arbitrary paths, origins, helpers, sessions,
    or output locations.
- Merge state: provider remains unavailable unless a node publishes matching
  ready inventory.

### OC-6: Linux node provider lifecycle

- Repo: `openclaw/openclaw`
- Depends on: `OC-1`, `OC-3`, `OC-4`, `CUA-1`, `CUA-4`, relevant `CUA-3`
  contracts
- Can run with: `OC-5`
- Work:
  - Add node-local detect, verified import, managed download, atomic install,
    rollback, start, stop, status, and test operations.
  - Launch daemon and MCP proxy through inherited connected IPC.
  - Bind the embedded protected-consent/indicator adapter over the protected
    control channel and keep it inaccessible to model-facing MCP.
  - Generate managed policy and bounded manifests; preserve narrower operator
    user policy.
  - Publish provider readiness before run authorization, and make tools
    callable only for a matching execution lease and generation.
  - Preserve X11/Wayland session environment and publish honest backend state.
  - Resolve approved resources only inside node-owned staging/artifact roots.
- Proof:
  - Artifact provenance and running-image identity are checked before OS work.
  - X11 screenshot/input and unavailable Wayland/headless states are covered.
  - A remote Gateway cannot trigger install or mutate launch configuration.
  - Every execution exit removes broadened manifest authority and invalidates
    the old generation through the idempotent release path.
- Merge state: locally enabled only; no automatic default selection.

### OC-7: Linux local and remote vertical gate

- Repo: `openclaw/openclaw`
- Depends on: `OC-5`, `OC-6`
- Can run with: early Wave 3 development
- Work:
  - Join the plugin, Gateway router, node host, policy, skill, and managed
    artifact paths in user-facing enable/status/test flows.
  - Add local-Gateway and remote-Gateway scenarios on an X11 desktop.
  - Exercise snapshot/action/verification, browser binding, recording/resource
    restrictions, stale generation/execution, ready-without-authorization,
    protected-provider activation, asynchronous Stop, and cleanup.
- Proof:
  - A packaged or clean-install node passes the Linux RFC acceptance criteria.
  - No shell/CLI CUA bypass or generic MCP bypass remains available in the run.
- Gate unlocked: shared contracts are stable enough for native app integrations.

## Wave 3: Platform Hosts and Product UX

macOS, Windows, and Gateway UX are separate ownership lanes. Their branches can
start once the provider-package and plugin fixtures are stable; macOS and UX
merge after the Linux gate has proven the shared lifecycle contracts. Windows
can merge independently after its own packaged proof.

### OC-8: macOS app-owned embedded host

- Repo: `openclaw/openclaw`
- Depends on: `OC-4`, `OC-5`, `OC-7`, `CUA-1`, `CUA-4`
- Can run with: `WIN-1`, `OC-9A`, `OC-9B`
- Work:
  - Bundle or locally manage the locked CUA artifact in the app distribution.
  - Make `OpenClaw.app` directly spawn the daemon and pass inherited connected
    transport to the app-owned node worker/proxy.
  - Implement the authenticated protected-consent adapter, including exact
    request binding, bounded `activate_preapproved()`, indicator lifecycle,
    Stop, and asynchronous daemon/host revocation.
  - Add local permission, restart, crash recovery, exact-resource approval,
    rebound/retry, and execution-release flows.
  - Publish TCC attribution and live readiness probes.
- Proof:
  - Packaged DMG testing shows only OpenClaw as the responsible Accessibility
    and Screen Recording identity.
  - Local and remote Gateways complete screenshot and input tasks after one
    local permission flow.
  - Every execution exit, revocation, restart, stale reference, and Stop fails
    closed and removes the old process manifest.

### WIN-1: Windows companion provider host

- Repo: `openclaw/openclaw-windows-node`
- Depends on: `OC-1`, `OC-4`, `OC-5`, `CUA-1`, `CUA-4`
- Can run with: `OC-8`, `OC-9A`, `OC-9B`
- Work:
  - Add the generic outbound MCP provider capability to the companion.
  - Consume and verify the published node provider package.
  - Own managed artifact lifecycle, inherited IPC, dynamic inventory, bounded
    policy, authenticated protected consent, indicator, asynchronous Stop,
    execution release, update, and rollback.
  - Manage the signed UIAccess helper when supported, otherwise publish the
    elevated-target capability as unavailable.
- Proof:
  - Packaged companion tests cover standard and supported elevated targets.
  - The companion, daemon, proxy, and supported helpers run in the intended
    interactive user session; Session 0 reports unavailable.
  - A remote Gateway can select and use the Windows node without installing
    anything on the Gateway machine.
  - Provider-package drift and unsigned/unknown helpers fail closed.

### OC-9A: Gateway selection and remote onboarding

- Repo: `openclaw/openclaw`
- Depends on: `OC-7`; consumes `OC-8`, `WIN-1`, and `OC-9B` states as they land
- Can run with: `OC-8`, `WIN-1`, `OC-9B`
- Work:
  - Add host/provider selection, explicit arming, ready/unready node states,
    deep links or node notifications, and local-action guidance.
  - Keep pairing approval, node-local enablement, and Gateway arming as
    separate user decisions.
  - Prevent unready nodes from creating partial agent tool surfaces.
- Proof:
  - Multi-node tests bind one host and never expose similarly named tools from
    another node.
  - Remote setup cannot dismiss local prompts or create a partial tool surface.
  - Recovery states route users to the machine that can actually fix them.

### OC-9B: Linux CLI, doctor, and bounded diagnostics

- Repo: `openclaw/openclaw`
- Depends on: `OC-6`; uses `OC-7` integration fixtures
- Can run with: `OC-7`, `OC-8`, `WIN-1`, `OC-9A`
- Work:
  - Add Linux node CLI enable/status/test/update/rollback surfaces.
  - Add Gateway doctor checks for selection/protocol and node-local checks for
    artifacts, permissions, backend, policy, and child health.
  - Define shared closed diagnostic codes consumed by native platform UIs.
  - Present bounded diagnostics without stderr, policy contents, screenshots,
    accessibility trees, or transport details.
- Proof:
  - Commands affect only the local node and never expose transport handles.
  - Doctor distinguishes Gateway-fixable state from node-local action.
  - macOS and Windows can render the same states without importing Linux code.

## Wave 4: Security, Packaging, and Cross-Platform Closure

These PRs can be split by platform and test surface after all three hosts speak
the same stable contract.

### OC-10A: Core, Linux, and macOS security closure

- Repo: `openclaw/openclaw`
- Depends on: `OC-8`, `OC-9A`, `OC-9B`; consumes Windows protocol fixtures
- Work:
  - Complete hostile-argument, stale capability, policy composition, protected
    consent, ready-versus-authorized, execution release, host-busy, recording
    isolation, and arbitrary-exec conflict tests.
  - Prove generic MCP, CLI, shell, alternate plugin routes, and unknown node
    inventory cannot reach managed CUA.
  - Audit local IPC and process-handle protections on macOS and Linux.
- Exit gate: every applicable RFC security acceptance criterion has executable
  proof or a documented platform capability marked unavailable in the main
  repository.

### OC-10B: macOS and Linux packaging, upgrade, and recovery

- Repo: `openclaw/openclaw`
- Depends on: `OC-8`, `OC-9B`
- Work:
  - Exercise clean install, compatible system import, managed install, update,
    failed update rollback, app/node upgrade, provider-spec skew, and uninstall
    for macOS and Linux.
  - Verify child cleanup, input/recording release, manifest removal, generation
    changes, and previous known-good recovery after every terminal path and
    crash.
- Exit gate: packaged DMG and Linux node artifacts pass local and
  remote-Gateway scenarios.

### WIN-2: Windows security, packaging, upgrade, and recovery

- Repo: `openclaw/openclaw-windows-node`
- Depends on: `WIN-1`, `OC-9A/B` diagnostic contracts
- Can run with: `OC-10A`, `OC-10B`, `OC-10C`
- Work:
  - Complete Windows IPC, helper, hostile-argument, policy, and local approval
    tests, including interactive-session/Session 0 checks and authenticated
    protected-provider revocation.
  - Exercise clean install, managed update, failed update rollback, companion
    upgrade, provider-spec skew, crash recovery, and uninstall.
  - Publish package evidence in the same closed acceptance shape as macOS and
    Linux.
- Exit gate: the packaged Windows installer passes local and remote-Gateway
  scenarios, with elevated-target support either proven or explicitly absent.

### OC-10C: Browser and model-guidance parity

- Repo: `openclaw/openclaw`
- Depends on: accepted CUA version, `OC-5`, all ready platform hosts
- Work:
  - Run the exact native-window/tab binding and full-background acceptance
    scenarios on supported Chromium/platform combinations.
  - Verify snapshot-before/after, element invalidation, fallback ladders,
    foreground transitions, exact browser-page routing, verdict precedence, and
    explicit DOM-event behavior.
  - Prove the Gateway neither retries mutations nor advances AX/PX/browser/
    foreground/desktop rungs, and preserves standalone `bring_to_front` plus
    live-schema `delivery_mode`.
  - Compare exposed tools/resources with the accepted CUA profile and record
    intentionally unavailable operations.
- Exit gate: OpenClaw routing does not reduce CUA reasoning quality or silently
  alter input trust semantics.

## Wave 5: Default Rollout

### OC-11: Enable CUA as the default ready provider

- Repo: `openclaw/openclaw`
- Depends on: `OC-10A`, `OC-10B`, `OC-10C`, `WIN-2`
- Work:
  - Select CUA by default only on hosts where it is installed, enabled, and
    fully ready; acquire execution-scoped authorization separately for each
    run before materializing callable tools.
  - Keep Peekaboo explicitly selectable on macOS with no per-call fallback.
  - Publish provider-authoring and node-runtime requirements.
  - Add release monitoring for install failures, readiness codes, crash loops,
    and version skew without collecting Computer Use content.
- Proof:
  - The complete RFC acceptance matrix passes against release artifacts.
  - Upgrade tests show existing users without Computer Use retain current node
    behavior and receive no surprise native download or permission prompt.
- Rollback:
  - Disable CUA default selection in product policy while leaving explicit
    provider selection and Peekaboo operational.
  - Roll node artifacts back to the retained known-good lock; never silently
    switch an active run to another provider.

## PR and Ownership Matrix

| ID | Primary owner boundary | Merge dependency | Parallel lane |
| --- | --- | --- | --- |
| CUA-1 | CUA embedded transport | none | Upstream runtime |
| CUA-4 | CUA protected consent/indicator | none; integrates with CUA-1 | Upstream security |
| CUA-2 | CUA skill/manifest | none | Upstream guidance |
| CUA-3 | CUA resources/helpers | none | Upstream policy |
| OC-1 | Gateway protocol/router | RFC contract | OpenClaw protocol |
| OC-2 | Core runtime, SDK, Peekaboo | OC-1 | OpenClaw runtime/macOS adapter |
| OC-3 | Node MCP provider host | OC-1 | OpenClaw node host |
| OC-4 | Generated provider package | OC-1 | Build/release metadata |
| OC-5 | Bundled CUA plugin | OC-2, OC-4, CUA-2/3/4 | Plugin integration |
| OC-6 | Linux provider lifecycle | OC-3/4, CUA-1/3/4 | Linux node |
| OC-7 | Linux integration gate | OC-5/6 | End-to-end proof |
| OC-8 | macOS embedded host | OC-7, CUA-1/4 | Native macOS app |
| WIN-1 | Windows embedded host | OC-4/5, CUA-1/4 | Windows companion |
| OC-9A | Gateway selection/onboarding | OC-7 | Gateway/UI |
| OC-9B | Linux CLI/doctor/diagnostics | OC-6 | Node CLI/diagnostics |
| OC-10A-C | Main-repo closure gates | OC-8, OC-9A/B | Security/package/parity |
| WIN-2 | Windows closure gate | WIN-1, OC-9A/B | Windows package/security |
| OC-11 | Default rollout | OC-10A-C, WIN-2 | Product/release |

## Integration Branch and Fixture Strategy

- `OC-1` publishes canonical protocol fixtures used by OpenClaw and the Windows
  companion. The Windows repository does not regenerate wire shapes by hand.
- `OC-4` publishes the canonical provider-package artifact and digest. Native
  app builds pin a released artifact; a Gateway never supplies it at runtime.
- Stacked development branches may consume an unreleased fixture artifact, but
  merge commits pin a published immutable version.
- Platform PRs should use a fake provider for most lifecycle tests and reserve
  real CUA execution for focused package/E2E lanes.
- The cross-platform integration branch is disposable. Canonical behavior
  lands through the bounded PRs above, not through a permanent compatibility
  layer maintained only on the integration branch.

## Optional Infrastructure

`openclaw/openclaw#98005` may provide a language-neutral process boundary for
future external Gateway-side provider adapters. If it lands, `OC-2` and `OC-5`
may use that process model where it preserves the same registration and policy
contract. It does not change `OC-1`, the node provider package, app-owned CUA
launch, native permissions, or any platform host dependency, and no wave waits
for it.

## Critical Path and Schedule Risk

The critical path is:

```text
CUA-1 + CUA-4 -> OC-6 -> OC-7 -> OC-8/WIN-1 -> OC-10A-C/WIN-2 -> OC-11
```

`OC-1`, `OC-2`, `OC-3`, `OC-4`, CUA skill/policy work, and UX can reduce total
calendar time by proceeding around that path. They cannot remove the `CUA-1`
or `CUA-4` ship dependencies. The RFC should not weaken local IPC isolation or
protected consent merely to fit the current path-addressed embedded endpoint or
missing host adapter into the schedule.

Other schedule risks:

- signed Windows UIAccess helper ownership may delay elevated-target support;
- Wayland support varies by compositor and may ship as an explicit unavailable
  capability after X11;
- exact browser binding and full-background behavior may differ by platform and
  accepted CUA release;
- the protected-consent adapter and packaged host-owned Stop surface may delay
  existing-profile support independently of inherited IPC;
- macOS TCC proof must use a signed packaged app, not a development executable;
- provider package publication must coordinate with the separate Windows build
  without allowing runtime trust to depend on the Gateway.

These risks narrow reported capability. They do not justify silent fallback,
arbitrary local execution, unverified artifacts, or remote permission control.
