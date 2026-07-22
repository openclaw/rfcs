---
title: Default, Pluggable Computer Use with CUA
authors:
  - RomneyDa
created: 2026-07-21
last_updated: 2026-07-22
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/45
---

# Proposal: Default, Pluggable Computer Use with CUA

## Summary

Make CUA the default Computer Use provider for OpenClaw while preserving a
provider boundary for alternatives such as Peekaboo. A bundled OpenClaw plugin
owns the CUA-specific tool catalog, model guidance, compatibility policy, and
provider registration. The desktop node owns installation and lifecycle of the
native CUA driver. The Gateway owns host selection, provider selection, policy,
and agent-tool projection. On macOS, `OpenClaw.app` directly launches CUA's
embedded daemon so Accessibility and Screen Recording remain attributed to
OpenClaw. Windows and Linux use the same Gateway and plugin contracts with
platform-specific node hosts. A remote Gateway never installs or launches a
driver on another machine; the selected node advertises readiness and presents
local, actionable setup when needed. Shipping is gated on CUA accepting an
inherited, already-connected transport and an authenticated embedded-host
protected-consent/indicator adapter. The researched path-addressed embedded
endpoint and a host dialog without CUA's protected provider are not acceptable
privileged boundaries.

## Design constraints and requirements

The proposal is driven by the following non-negotiable requirements. A design
that violates one of them needs an explicit RFC amendment rather than an
implementation shortcut.

1. **CUA is the default ready provider, not OpenClaw's native driver.** OpenClaw
   ships and supports the integration, but CUA continues to own the driver
   behavior described by its [interface contracts](https://cua.ai/docs/reference/cua-driver/contracts)
   and [platform support matrix](https://cua.ai/docs/reference/cua-driver/platform-support).
   OpenClaw does not rebuild CUA's OS automation stack.
2. **Computer Use remains pluggable.** The contract is a narrow extension of
   the [OpenClaw Plugin SDK](https://docs.openclaw.ai/plugins/sdk-overview), CUA
   is selected by default only when ready, and the existing
   [Peekaboo bridge](https://docs.openclaw.ai/platforms/mac/peekaboo) remains an
   explicit macOS alternative. Providers may expose different native tools and
   guidance; OpenClaw does not force them into one lowest-common-denominator
   action schema.
3. **Gateway and desktop host may be different machines.** The model and plugin
   run through the Gateway while all observation, input, native processes, and
   OS prompts stay on the selected desktop node. This extends OpenClaw's
   existing [Gateway/node host model](https://docs.openclaw.ai/nodes); a plugin
   installed at the Gateway does not thereby install code on a remote node.
4. **The desktop node owns the native runtime.** Detection, verified install,
   launch, update, rollback, health, and disablement are node-local operations.
   The Gateway may select and invoke a ready provider, but it never supplies a
   binary URL, executable path, checksum, or launch recipe to the node.
5. **macOS permissions belong to OpenClaw.** The signed `OpenClaw.app` identity
   described by OpenClaw's [macOS permission model](https://docs.openclaw.ai/platforms/mac/permissions)
   must directly spawn CUA embedded mode. This follows CUA's
   [daemon/proxy process model](https://cua.ai/docs/reference/cua-driver/process-model)
   and [`--embedded` contract](https://cua.ai/docs/reference/cua-driver/cli-reference),
   so Accessibility and Screen Recording appear under OpenClaw rather than a
   Gateway `node` process or separately launched driver.
6. **One provider contract works across macOS, Windows, and Linux.** Platform
   hosts may differ in packaging, permissions, UIAccess, X11, Wayland, or
   interactive-session handling, but the Gateway binding, inventory,
   invocation, policy, skill, and result contracts remain the same. Unsupported
   platform capabilities return explicit states; they do not silently degrade.
7. **CUA functionality and model guidance are preserved.** OpenClaw consumes
   CUA's native MCP schemas, sessions, structured/image results, capture and
   delivery behavior, browser targeting, recording, and fallback ladder. The
   [CUA agent skill](https://cua.ai/docs/how-to-guides/driver/install-agent-skill)
   remains substantive model guidance delivered through OpenClaw's
   [skill system](https://docs.openclaw.ai/tools/skills), but its OpenClaw
   profile is MCP-first and cannot invoke the CUA CLI as a policy bypass.
8. **Computer Use has a dedicated classified route.** Calls do not travel as
   ordinary node MCP or shell execution. OpenClaw binds one node, provider,
   generation, execution lease, CUA session, and policy lease; applies
   argument-aware risk and resource policy; and rejects arbitrary exec
   authority on that same host.
   CUA's [permission policy](https://cua.ai/docs/concepts/how-permission-policies-work)
   remains an independent daemon-side defense, not a replacement for Gateway
   enforcement.
9. **Local consent cannot be delegated to the model or remote Gateway.** Node
   enablement, OS permission prompts, protected browser/profile attachment, and
   Stop/revocation controls happen on the desktop node. The Gateway exposes
   closed readiness and recovery states and never silently replays a mutation,
   changes host, or falls back to another provider.
10. **Only locally trusted native artifacts receive app-owned authority.** A
    node uses a pinned provider package, verified driver/helper digests,
    running-image checks, and atomic managed storage. A matching version string,
    system `PATH` entry, plugin claim, or node-advertised tool list is not
    sufficient provenance.
11. **The production transport cannot expose a reusable privileged listener.**
    CUA embedded mode must accept an inherited, already-connected channel
    between the app-owned daemon and MCP proxy. The currently documented local
    socket/named-pipe topology is useful for ordinary clients but is not the
    security boundary for OpenClaw-owned permissions. This upstream capability
    is a ship blocker, not a reason to weaken the contract.
12. **Protected browser consent uses CUA's certified provider seam.** A bounded
    exact-resource manifest pre-approves authority, but it does not activate
    the persistent indicator required by CUA. The accepted CUA version must
    let the trusted embedding host implement `ProtectedConsentProvider` over an
    authenticated control channel, including Stop and asynchronous revocation.
    Manifest restart and protected-provider activation are separate ship
    dependencies.
13. **SDK and protocol surface lands with consumers and proof.** Additive node
    protocol can land dormant, but public Plugin SDK registration lands with a
    real provider runtime consumer. CUA becomes the default only after packaged
    macOS, Windows, Linux, remote-Gateway, security, and upgrade acceptance
    gates pass.

## Motivation

OpenClaw already has several pieces of Computer Use infrastructure, but they do
not form one product:

- the macOS app implements `computer.act` through Peekaboo;
- the TypeScript node host can publish tools from configured MCP servers;
- the Gateway can project those node-hosted MCP tools into an agent;
- desktop nodes can publish node-hosted skills;
- node command policy treats `computer.act` as dangerous and requires explicit
  arming;
- CUA provides a cross-platform driver, an MCP server, a CLI, a detailed skill,
  managed skill packs, and an embedded mode for host-owned permissions.

These pieces solve different parts of the problem. Connecting CUA as an
ordinary Gateway plugin or ordinary node MCP server would expose tools, but it
would not provide a complete Computer Use product:

- a remote Gateway cannot grant permissions or install a native driver on the
  selected desktop node;
- on macOS, the wrong process may become the TCC-responsible identity;
- generic `mcp.tools.call.v1` currently follows the ordinary node-command path,
  while Computer Use observation and input require explicit privacy and safety
  policy;
- duplicate tools from multiple nodes are name-prefixed rather than bound to a
  selected Computer Use host;
- CUA's canonical skill defaults to invoking the CLI, which can bypass the
  selected node, app-owned embedded transport, and OpenClaw's Computer Use
  policy;
- static wrappers around a subset of CUA actions lose CUA's session, capture,
  browser, fallback, recording, and verification behavior;
- installing a plugin at the Gateway does not install native code into a
  remote macOS or Windows node app.

The desired user experience is instead:

1. A user enables Computer Use on a desktop node.
2. The node detects or installs a compatible CUA driver and proves readiness.
3. On macOS, the user grants Accessibility and Screen Recording to OpenClaw,
   not to a separate driver app.
4. The Gateway selects that node as the Computer Use host and uses CUA by
   default.
5. The model receives CUA's full supported tool surface and high-quality,
   version-compatible operating guidance.
6. The user can explicitly select another provider, such as Peekaboo, without
   changing the Gateway-to-node architecture.

## Goals

- Ship CUA as OpenClaw's default Computer Use provider on macOS, Windows, and
  supported Linux desktop sessions.
- Make "default" mean the provider OpenClaw recommends and selects when ready,
  not permissionless or silent installation.
- Keep CUA implementation and semantics in CUA and the bundled CUA integration,
  not duplicated as OpenClaw-native OS primitives.
- Attribute macOS Accessibility and Screen Recording to `OpenClaw.app` by using
  CUA embedded mode correctly.
- Support a Gateway running on a different machine from the desktop node.
- Preserve CUA's full compatible MCP tool surface, structured/image results,
  session semantics, fallback ladder, and version-matched model guidance when
  OpenClaw can enforce each tool's resource and argument policy. Tools without
  a safe adapter remain unavailable rather than bypassing policy.
- Classify every Computer Use invocation through a dedicated Gateway policy
  path instead of generic MCP or shell execution.
- Provide clear local-node and Gateway onboarding, health, diagnostics, and
  recovery states.
- Make provider selection explicit and stable for a run. Do not silently change
  providers or target nodes after the model has received a provider's tools and
  guidance.
- Retain Peekaboo as an explicit macOS alternative and define a provider seam
  that additional integrations can implement.
- Avoid an unconsumed public Plugin SDK contract. Add SDK surface together with
  its first runtime consumer.

## Non-Goals

- Reimplementing CUA's accessibility-tree traversal, element cache, background
  input, browser adapters, recording, replay, or targeting heuristics in
  OpenClaw.
- Defining one universal schema for every Computer Use action. Providers may
  expose different native tools and matching guidance.
- Making arbitrary third-party native binaries inherit OpenClaw's permissions
  merely because a Gateway plugin claims a provider id.
- Automatically installing or updating native code during an agent tool call.
- Granting remote Gateways authority to dismiss local permission prompts or
  bypass local user consent.
- Treating a node's self-reported provider metadata as authorization.
- Claiming that CUA policy can contain arbitrary code execution on the selected
  desktop host. The secure Computer Use profile excludes such execution from
  the run.
- Replacing [OpenClaw's browser tools](https://docs.openclaw.ai/tools/browser).
  Browser DOM automation remains distinct; CUA can operate native browser
  chrome or serve as an explicit visual/native fallback.
- Guaranteeing foreground-free behavior for every provider or platform. The
  selected provider advertises its behavior and its skill teaches the model the
  correct operating mode.
- Solving Wayland portal policy at the Gateway. The Linux node must report the
  actual compositor and portal readiness.

## Proposal

### Product model

OpenClaw introduces four explicit Computer Use concepts:

- **Computer Use host**: the desktop node whose screen and input are being
  controlled.
- **Computer Use provider**: the implementation available on that host, such as
  `cua` or `peekaboo`.
- **Computer Use execution**: the binding of one agent execution to one host,
  one provider capability snapshot, one execution lease, and one policy lease.
- **CUA session**: the opaque native session injected by the node for that
  execution. A durable OpenClaw chat/session id may correlate several
  executions but never owns native authority.

CUA is the default provider when it is installed, compatible, ready, and
allowed on the selected host. If it is unavailable, OpenClaw shows setup or an
explicit provider choice. It does not silently fall back to Peekaboo because
the provider's tool semantics and model guidance differ.

Provider choice is host-specific. A Mac can offer CUA and Peekaboo, a Windows
node can offer CUA, and a Linux node can offer CUA with backend-specific
readiness. The Gateway stores a user's selected default Computer Use host and
provider as product state, not as a growing set of environment variables.

### Ownership boundaries

The architecture has four owners.

#### Bundled `computer-use` plugin

An in-repository bundled plugin owns:

- provider registrations for `cua` and, when migrated, the OpenClaw Peekaboo
  adapter;
- CUA's accepted version range and pinned recommended node artifact;
- platform artifact names and OpenClaw-pinned integrity digests;
- the required and optional CUA MCP tool catalog;
- an argument-aware risk and resource policy for every exposed CUA operation;
- capability and schema probes used to accept a driver;
- projection of the selected provider's native tools into the agent;
- provider-specific model guidance and transport adaptation;
- CUA-specific diagnostics and user-facing setup descriptions;
- provider-specific result normalization where OpenClaw's portable image or
  structured-result envelope requires it;
- a generated, data-only node provider package consumed by official node
  distributions.

CUA remains an upstream native dependency, not copied source and not an npm peer
dependency. The plugin may contain compatibility metadata and model guidance,
but it must not reproduce CUA's native implementation.

#### OpenClaw core and Gateway

Core owns only generic Computer Use infrastructure:

- provider declaration and registration contracts;
- node provider inventory and readiness protocol;
- Computer Use host and provider selection;
- execution binding and stale-snapshot detection;
- classified invocation routing, cancellation, timeout, and result limits;
- arming and policy enforcement;
- filtering node-advertised tools against a trusted plugin registration;
- deterministic tool and skill materialization for the selected execution;
- health and diagnostics envelopes.

Core does not know CUA tool names, CUA command-line flags, CUA release URLs, or
Peekaboo action semantics.

#### Desktop node host

The desktop node owns machine-local state and privileged process lifecycle:

- driver discovery and managed installation;
- local enable/disable consent;
- process start, stop, restart, and crash recovery;
- connected IPC handles and child-process environment;
- OS permissions and platform readiness;
- MCP initialization, `tools/list`, tool calls, and cancellation;
- provider version, capability, and health publication;
- version-matched node-hosted skill material supplied to the Gateway;
- one idempotent execution-release path for completion, failure, cancellation,
  timeout, disconnect, crash, local Stop, session clear, or lease expiry;
- cleanup when Computer Use is disabled, the node disconnects, or a bounded
  policy lease expires.

The macOS app and Windows companion implement this owner in their native app
lifecycle. The TypeScript node host implements it for Linux and headless node
installations with an interactive desktop session.

#### Node provider package

Installing a Gateway plugin does not install code into a remote node. The
bundled plugin therefore produces a versioned, data-only node provider package
as a build artifact. It contains the audited CUA artifact lock, accepted launch
shapes, required capability probes, and provider-spec digest. It contains no
Gateway-supplied executable code.

Official OpenClaw node distributions consume that same generated artifact:

- the macOS packaging build embeds it as an app resource;
- the Windows companion consumes the released artifact in its build;
- the TypeScript/Linux node reads it from the bundled plugin distribution.

The native node trusts only provider packages shipped in, or explicitly
installed into, that node. A Gateway registration must match the node's local
provider id and compatible provider-spec digest before the provider can become
ready. The Gateway cannot send a binary URL, checksum, command line, or launch
recipe to a node.

The generated package has one source of truth in the bundled plugin. Cross-repo
CI verifies that the Windows companion's consumed artifact matches a published
OpenClaw provider-spec digest. This avoids hand-maintained CUA policy in two
repositories while preserving the node's local trust boundary.

#### CUA

CUA continues to own:

- platform accessibility and capture implementations;
- background and foreground input behavior;
- element addressing and caches;
- CUA sessions, capture scopes, cursors, and escalation;
- browser-specific adapters;
- recording and replay;
- driver-side authorization modes;
- its MCP, CLI, daemon, and skill-pack formats.

### End-to-end architecture

```text
Agent run
  |
  | selected host + selected provider + execution/policy leases
  v
Bundled computer-use plugin (Gateway process)
  |  materializes provider-native tools and matching skill
  |  invokes classified Computer Use command
  v
Gateway Computer Use router
  |  validates execution binding, node, provider, tool, risk, arming
  v
node.invoke: computer.provider.call.v1
  |
  v
Selected desktop node provider host
  |  validates provider generation and tool catalog
  |  calls provider-local MCP connection
  v
CUA MCP proxy -> CUA daemon -> OS accessibility/capture/input APIs
```

The Gateway may be local or remote. The driver and all OS calls remain on the
selected node. No screenshot, permission prompt, or native process is moved to
the Gateway machine merely because that machine runs the agent.

### Provider registration contract

The [public Plugin SDK](https://docs.openclaw.ai/plugins/sdk-overview) should
expose one provider registration whose fields are consumed by the runtime in
the same change. The exact TypeScript names may change during implementation,
but the semantic contract is:

```ts
type ComputerUseProviderRegistration = {
  id: string;
  label: string;
  toolPolicy: readonly {
    name: string;
    classify(args: unknown): ComputerUseToolDecision;
    required: boolean;
  }[];
  compatibility: {
    accepts(inventory: ComputerUseProviderInventory): CompatibilityResult;
  };
  materialize(context: ComputerUseSessionContext): {
    tools: AgentTool[];
    skills: SkillReference[];
  };
};

type ComputerUseToolDecision =
  | { decision: "allow"; risk: ComputerUseRiskClass; args: unknown }
  | { decision: "approval-required"; risk: ComputerUseRiskClass; args: unknown }
  | { decision: "deny"; reasonCode: string };
```

Only stable provider identity belongs in static plugin metadata. Runtime
registration owns compatibility and materialization. Installation commands,
native launch callbacks, permission claims, and app-spawn authority are not
general Plugin SDK callbacks: they execute on the node, not necessarily in the
Gateway plugin process.

A provider registration is not authority to use OS permissions. The Gateway
must match it with an inventory entry from a paired node and an explicitly
enabled local provider. Unknown providers and unknown tools fail closed.

Classification is argument-aware. The reviewed plugin catalog is the maximum
allowed surface; the installed driver's live `tools/list` schemas determine
which reviewed tools and semantic argument branches exist for the current
generation. The provider may preserve a model-visible opaque resource handle
for node-side resolution or require approval, but it must reject an unsupported
semantic branch rather than silently remove or rewrite its arguments. The
Gateway never resolves a handle to a node filesystem path. Calls are simple
after classification: the router receives validated, path-free arguments and a
closed risk class. A tool with multiple operations is assigned the highest
applicable risk unless the plugin has a typed operation-specific classifier.

### Additive node protocol

Desktop nodes publish a versioned provider inventory in addition to ordinary
commands and plugin tools:

```ts
type ComputerUseProviderInventory = {
  schemaVersion: 1;
  providerId: string;
  providerSpecDigest: string;
  generation: string;
  platform: "macos" | "windows" | "linux";
  backend: string | null;
  driver: {
    version: string;
    source: "managed-download" | "managed-import" | "bundled";
    digest: string;
  } | null;
  readiness:
    | { state: "ready" }
    | { state: "disabled" }
    | { state: "missing-driver" }
    | { state: "incompatible-driver"; reasonCode: string }
    | { state: "missing-permission"; reasonCode: string }
    | { state: "backend-unavailable"; reasonCode: string }
    | { state: "starting" }
    | { state: "failed"; reasonCode: string };
  permissionAttribution: "openclaw-host" | "provider" | "os-session" | "unknown";
  protectedConsent: "ready" | "unavailable" | "degraded";
  runAuthorization:
    | { state: "inactive" }
    | {
        state: "authorized";
        executionId: string;
        executionLeaseId: string;
        managedPolicyHash: string;
        userPolicyHash: string | null;
        sessionManifestHash: string;
        expiresAt: string;
      };
  toolCatalogHash: string;
  tools: readonly NodeComputerUseToolDescriptor[];
  skill: {
    version: string;
    digest: string;
    profile: string;
  } | null;
};
```

The inventory contains bounded facts, not raw process output or exception text.
`driver` is null only when no locally accepted artifact is present. Provider
readiness and run authorization are separate states. `ready` proves the
artifact, backend, permissions, private transport, protected-consent adapter,
and probes are available; it may and normally does coexist with inactive run
authorization. Provider-native tools become callable only after an execution
owns a current bounded manifest and both execution and policy leases.

`generation` changes whenever the provider-spec digest, driver process,
compatibility decision, tool catalog, permission state, policy hash, bounded
manifest, protected-consent readiness, run authorization, or selected local
provider state changes. Agent calls carry the generation and execution lease
they were materialized from; a mismatch fails with a typed stale-provider or
stale-execution error and forces rematerialization.

`providerSpecDigest` identifies the locally trusted node provider package. It
is distinct from the native driver digest and tool catalog hash. Gateway
compatibility requires the provider registration to accept this exact digest;
the node never accepts a provider spec supplied by the Gateway.

The invocation command is dedicated and dangerous:

```text
computer.provider.call.v1
```

Its envelope contains the provider id, provider-spec digest, inventory
generation, execution id, execution lease id, policy lease id, MCP tool name,
path-free arguments, opaque resource handles, deadline, and idempotency metadata
where the provider supports it. A durable OpenClaw chat/session id may be
carried only as non-authoritative correlation metadata. The command does not
accept arbitrary MCP server names, node-native paths, or shell commands.

### Why generic node MCP is insufficient

OpenClaw's current node MCP manager is useful transport infrastructure and
should be reused internally. It already keeps persistent MCP sessions, lists
tools, publishes dynamic descriptors, and maps text, image, and structured
results. The current public route uses the reserved `node-mcp` plugin id and
`mcp.tools.call.v1`.

Computer Use must not be projected through that generic route. Today
`mcp.tools.call.v1` is admitted as an ordinary node command, whereas
`computer.act` is in the dangerous, explicitly armed set. Reusing the ordinary
command would let a Computer Use tool bypass the product's existing safety
classification.

The implementation should therefore extract the reusable MCP session manager
behind a provider-host interface, while routing Computer Use through
`computer.provider.call.v1`. The provider plugin supplies the trusted tool/risk
and argument-policy map. A node cannot make a newly discovered MCP tool callable
merely by labeling it Computer Use.

### Host and provider binding

Before assembling an agent run, OpenClaw resolves one prepared Computer Use
binding:

```ts
type PreparedComputerUseBinding = {
  nodeId: string;
  providerId: string;
  providerSpecDigest: string;
  generation: string;
  toolCatalogHash: string;
  executionId: string;
  executionLeaseId: string;
  policyLeaseId: string;
};
```

The prepared binding is carried through tool and skill assembly. Tool execution
does not rediscover nodes or providers from broad registries. This prevents:

- accidental calls to a different node when two nodes publish the same tools;
- provider-specific skills being shown while another provider handles calls;
- silent fallback after a node disconnect or provider restart;
- request-time metadata polling.

If the selected node disconnects, the provider generation changes, permissions
are revoked, or the lease expires, calls fail with a typed recovery state. The
user or agent can rebind explicitly after readiness is restored.

### CUA process topology

The topology specializes CUA's documented
[daemon/proxy process model](https://cua.ai/docs/reference/cua-driver/process-model)
for an OpenClaw-owned desktop node.

#### macOS

The native app, not the Gateway and not the TypeScript worker, directly starts
the privileged daemon:

```text
OpenClaw.app (TCC-responsible process)
  +-- creates a non-discoverable connected IPC channel
  +-- cua-driver serve --embedded --transport-handle <inherited handle>
  +-- OpenClaw TypeScript node worker
        +-- cua-driver mcp --embedded --transport-handle <inherited handle>
```

This topology follows CUA's embedded-mode contract. The long-lived `serve`
process performs OS operations. The `mcp` process is a stdio proxy over the
inherited connected channel and never becomes the permission owner.
`OpenClaw.app` must use
`Process`/`posix_spawn`-style direct execution; launching through `open` or
`NSWorkspace` breaks the macOS responsibility chain. `--host-bundle-id` is
diagnostic, not a security signal.

The app owns both child lifecycles. The existing app-owned TypeScript node
worker remains useful for generic MCP framing and Gateway inventory, but it
must receive only its inherited connected transport handle from the app. It
must never decide to start the privileged daemon itself.

After a TCC grant changes, the app restarts the embedded daemon before declaring
readiness because macOS caches permission answers per process. Readiness
requires:

- the app's Accessibility check;
- a live screen-capture probe;
- CUA `check_permissions` reporting host attribution;
- a successful MCP initialization and required-tool probe.

The result is one OpenClaw identity in System Settings. The CUA binary remains
separate code and a child process, but it runs inside OpenClaw's TCC
responsibility chain.

#### Windows

The Windows companion owns the CUA process using the same provider lifecycle:

```text
OpenClaw Windows companion
  +-- creates a non-discoverable connected IPC channel
  +-- cua-driver serve --embedded --transport-handle <inherited handle>
  +-- cua-driver mcp --embedded --transport-handle <inherited handle>
  +-- CUA UIAccess helper when required and supported
```

Windows does not have macOS TCC inheritance, but keeping the app as lifecycle
owner gives users the same enable/disable, health, update, and remote-Gateway
experience. Embedded mode is still used so the host owns one private daemon and
adapter topology on every platform. The companion's existing `INodeCapability`
registry and local MCP bridge are suitable host boundaries. The new work is a
generic outbound MCP provider capability with dynamic tool inventory, not a
second CUA action implementation in C#.

Driving elevated or UWP targets requires CUA's UIAccess path. CUA's embedded
mode does not make that helper lifecycle automatic. Windows readiness must
prove that the companion, daemon, MCP proxy, and supported helpers all run in
the intended interactive user session. Session 0 reports unavailable rather
than empty or degraded window results. Readiness must also report
elevated-target support honestly and remain degraded until the companion
installs and manages the signed helper according to CUA's contract.

#### Linux

The TypeScript node host owns CUA in the interactive desktop session:

```text
openclaw node host
  +-- creates a non-discoverable connected IPC channel
  +-- cua-driver serve --embedded --transport-handle <inherited handle>
  +-- cua-driver mcp --embedded --transport-handle <inherited handle>
```

The node preserves the desktop session environment required by the backend,
including `DISPLAY`, `WAYLAND_DISPLAY`, and the relevant D-Bus/runtime
directory. Embedded mode gives Linux the same private, host-owned process
topology even though it does not confer a macOS-style permission identity. X11
can use the normal desktop APIs. Wayland capture and input depend on compositor
and XDG portal behavior; the node reports actual backend readiness and never
claims that a Gateway permission setting can pre-grant a portal session.

#### Privileged local transport

An unpredictable socket path, bearer token, and same-user filesystem
permissions are not sufficient boundaries. Another process running as the user
may discover the endpoint or inspect a reusable secret and call the daemon
outside Gateway policy while using the capabilities enabled by OpenClaw's
daemon process.

Production readiness therefore requires a non-discoverable connected transport
in the accepted CUA version. The node creates a socket pair, anonymous pipe
pair, or equivalent protected platform channel and passes only the already
connected handles to the app-owned daemon and proxy. There is no listening
socket, named endpoint, bearer secret, environment value, or model-visible
configuration to discover. Platform process ACLs and anti-inspection controls
must prevent unrelated same-user processes from opening or duplicating those
handles.

The researched CUA protocol currently uses a path-addressed socket or named
pipe. Accepting an inherited connected transport is therefore an upstream
prerequisite for shipping the app-owned TCC integration. OpenClaw must not
insert a broker in front of an unauthenticated daemon while leaving the
underlying privileged listener reachable.

The embedding host also needs an authenticated protected-control channel to
the daemon. It may be a separate inherited channel or a cryptographically and
structurally separated subchannel, but ordinary MCP calls cannot write it. It
binds the daemon's `ProtectedConsentProvider` requests and asynchronous
revocation to the exact OpenClaw execution lease; inherited IPC alone does not
provide protected consent.

### Driver installation and compatibility

Native drivers are node-local managed artifacts. The upstream
[CUA installation flow](https://cua.ai/docs/how-to-guides/driver/install) is a
candidate source, but OpenClaw applies its own pinned artifact and provenance
contract. Drivers are not plugin npm peer dependencies and are not downloaded
by a remote Gateway.

Each release of the bundled plugin carries an audited CUA artifact lock:

```ts
type ManagedComputerUseArtifact = {
  providerId: "cua";
  kind: "driver" | "helper";
  version: string;
  platform: string;
  architecture: string;
  url: string;
  sha256: string;
};
```

The pinned version is the recommended path. The node never launches an
operator-installed system path directly. It may import that binary only when
its exact bytes match an artifact digest in the node's locally shipped provider
lock. Import copies the bytes atomically into a versioned node-managed store,
rejects links and mutable aliases, verifies the copied artifact again, and
reports it as `managed-import`. A self-reported version, manifest, tool catalog,
or behavior probe is not provenance.

Launch is bound to the verified executable, not a previously checked path. On
platforms with suspended-process creation, the node starts suspended, verifies
the running image's digest and expected CUA publisher/code identity, installs
or enables the connected transport, and only then resumes it. Platforms with
verified descriptor execution may execute from the already verified handle.
If the node cannot prove that the running image is the locked artifact before
it can perform OS work, app-owned Computer Use is unavailable on that platform.
Code-signing identity is an additional check, not a replacement for the pinned
digest.

The same rule applies to native helper processes that CUA can launch. A helper
must be present in the local provider lock, imported into the managed store,
and selected through a node-controlled absolute path supported by CUA. Ambient
`PATH` lookup is not accepted for a model-triggerable helper.

After provenance succeeds, all of these compatibility checks must also pass:

1. its version is in the plugin's tested range;
2. `cua-driver manifest` advertises the required launch, embedded, inherited
   connected-transport, protected-consent adapter, and trusted resource/helper
   features;
3. MCP initialization and `tools/list` succeed;
4. every required tool and required schema capability is present;
5. the resulting tool catalog matches a plugin-known operation and resource
   policy map;
6. platform-specific live probes pass.

A semver match alone is insufficient. Unknown newer tools remain hidden and
uncallable until the plugin assigns them a risk class. For known tools, the live
schema is intersected with the reviewed catalog at the semantic-branch level. A
schema-supported field such as `delivery_mode` remains available without an
invented capability token, while an absent branch is rejected explicitly
rather than stripped during dispatch. A newer unknown driver is not
auto-selected merely because it starts successfully. A custom or locally built
driver is never granted OpenClaw's app-owned permissions in the production
profile; developers use an explicit non-production flow with separate OS
identity and warnings.

Tool-name compatibility is also insufficient. Every exposed tool and accepted
argument branch needs a reviewed resource policy. The initial CUA integration
applies these rules:

- screenshots and accessibility state return through MCP results; model
  arguments cannot choose arbitrary output files;
- recording outputs are injected into a node-owned, execution-scoped artifact
  directory;
- `record_video: true` on Windows or Linux is exposed only when the node
  provider package contains a digest-verified ffmpeg helper and the accepted
  CUA version supports a node-injected absolute helper path. CUA must not resolve
  the helper from model arguments or `PATH`; otherwise video recording is
  unavailable on that platform;
- browser file upload accepts OpenClaw-approved attachment handles, which the
  node resolves to exact, digest-checked files in a node-owned staging area
  immediately before dispatch; arbitrary absolute paths are rejected and the
  Gateway never learns the staged native path;
- browser navigation and data operations enforce the execution's approved origin
  set where the provider exposes a typed origin boundary;
- browser downloads use a node-owned download directory and explicit policy;
- dependency installation tools such as `install_ffmpeg` are local onboarding
  actions, never model-callable Computer Use tools;
- replay or import tools accept only node-owned recording handles, not arbitrary
  filesystem paths;
- unknown fields and unreviewed operation variants fail closed.

If a CUA version exposes a tool that cannot satisfy these rules, the plugin
hides that tool while preserving the rest of the compatible catalog. CUA's
bounded manifest remains defense in depth, but OpenClaw does not assume its
tool-name allowlist constrains every file path or operation argument.

When no compatible binary exists, local onboarding offers **Install managed
CUA**. The node downloads the pinned artifact, verifies the OpenClaw-pinned
digest, installs it atomically into a versioned node-managed directory, and
retains the previous known-good version for rollback. It does not execute a
remote install script or trust a checksum fetched from the same untrusted
location as the binary.

Downloads and upgrades occur only through local setup or an explicit local
update action. They never occur during tool execution. Managed artifacts are
garbage-collected after they are no longer active or needed for rollback.

### CUA model guidance without a CLI bypass

CUA's [agent skill](https://cua.ai/docs/how-to-guides/driver/install-agent-skill)
is a significant part of the integration. It teaches the model to:

- start and end explicit sessions;
- snapshot before and after every action;
- preserve element-index validity;
- choose window, auto, or desktop capture scope;
- follow the AX-background, PX-background, exact-browser-page,
  foreground-delivery, and explicit desktop-escalation ladder;
- use browser-specific paths and recording features correctly;
- preserve exact native-window/browser bindings and the explicit
  full-background CDP rung without silently changing input trust models;
- verify effects instead of assuming an action succeeded.

That content should not be reduced to a short OpenClaw tool description.

The current canonical CUA skill defaults to shelling out to
`cua-driver <tool> '<json>'`. OpenClaw must not expose that default in a managed
Computer Use execution. Direct CLI execution can target the wrong machine, omit
the app-owned connected transport, use a different CUA session, and bypass
`computer.provider.call.v1` policy.

Accepted CUA releases should therefore provide a version-matched OpenClaw
profile in the CUA skill pack. It preserves CUA's semantic instructions and
platform companion documents, but its transport section says:

- use the selected provider-native OpenClaw tools;
- never invoke CUA through shell/CLI for this execution;
- never start or update the daemon;
- treat the OpenClaw execution binding as the transport owner;
- use the exact tool names and schemas published for the selected node.

CUA already distributes a skill tarball matched to each driver release and can
install into `~/.openclaw/skills`. For managed integration, the node verifies
and publishes the matching skill profile and digest as provider inventory. The
Gateway injects it only when its plugin compatibility table accepts the driver,
skill profile, and digest.

Until CUA publishes an OpenClaw profile, the bundled plugin may carry a reviewed
transport overlay keyed to an exact upstream skill digest. The overlay may
replace only the transport/bootstrap instructions; it must not hand-maintain a
fork of CUA's workflow guidance. A digest mismatch disables the overlay and
requests a plugin/driver update.

Node-hosted skill delivery is preferred over a single Gateway-local copy
because it is naturally scoped to the connected node and exact driver version.
It also lets the node publish only the relevant macOS, Windows, or Linux
companion documents. The selected Computer Use binding filters the skill to the
same node and provider as the tools.

Current remote node skills are eligible through a `system.run`-capable node and
refer models back to node-local files. Computer Use must not require general
shell execution merely to read provider guidance. The node protocol should add
a bounded skill-resource reader that can return only files from the published,
digest-verified provider skill bundle. Provider skills become eligible through
the ready Computer Use binding, and relative companion documents resolve
through that reader. Arbitrary node filesystem reads remain unavailable.

### Interaction ladder and verdict ownership

The version-matched CUA skill, not the Gateway, teaches and drives this
verify-then-escalate ladder:

1. Call `get_window_state(pid, window_id)` and ground on the AX tree and
   screenshot returned together.
2. Try an element AX action with background delivery, then re-snapshot and
   verify.
3. On a concrete PX signal, try an element PX action from that window
   screenshot, still in background mode, then re-snapshot and verify.
4. When the native window can be bound to an exact browser target, use the
   browser-page route and verify against fresh browser state and refs.
5. Use `delivery_mode: "foreground"` only after background delivery was shown
   or reported to be ineffective, then verify again.
6. Only for an `auto` session, and only after the window ladder is exhausted,
   call `escalate_session`. Use `get_desktop_state` plus desktop/system input
   for external UI such as permission prompts, file pickers, or authentication
   sheets, then verify in the desktop coordinate frame.

`bring_to_front` remains a standalone platform-specific tool where the live
schema exposes it. It is not an action argument or an invented cross-platform
capability. The normal cross-platform foreground transition repeats the same
action with `delivery_mode: "foreground"`.

The Gateway does not implement or advance CUA's interaction ladder. It
preserves CUA's native live schemas and structured outcomes, applies host,
execution, resource, and policy admission checks to each model-selected call,
and never automatically retries a mutation or substitutes another interaction
route. CUA enforces its session, capture-scope, reference, delivery, and consent
invariants. The model selects the next rung using the version-matched CUA skill.
OpenClaw never maintains a second copy of CUA element, browser-ref, or
capture-scope state.

The skill and integration tests preserve this result precedence:

- `confirmed`: verify the expected state and finish;
- `unverifiable`: inspect fresh state before deciding whether another mutation
  is needed; it is not a failure;
- `suspected_noop`, an explicit refusal, or a delivery failure: another rung
  may be appropriate;
- `escalation.recommended`: describes a supported next move but does not prove
  the previous mutation failed.

This precedence prevents duplicate clicks, text, submissions, and other side
effects.

### Browser targeting and the full-background rung

The CUA integration preserves CUA's documented
[browser targeting and background delivery](https://cua.ai/docs/concepts/browser-targeting-and-background-delivery)
model rather than flattening it into generic clicks or direct CDP identifiers.

The model begins with native `list_apps` and `list_windows` results and selects
an exact `(pid, window_id)`. `get_browser_state` may then bind that native window
to a browser target and mint opaque target, tab, and page-ref capabilities. The
binding must prove process ownership and native/browser geometry, and it is
revalidated immediately before mutation. Ambiguous tab state remains
tri-state; no plugin code promotes "first process," "first window," or "first
tab" into an action route.

For an exactly bound Chromium page, provider-native navigation, ref-bound text
insertion, and explicitly requested synthetic DOM clicks can operate on an
occluded tab without borrowing the real pointer or keyboard focus. This is the
full-background rung. It does not mean every CDP input route is background-safe:

- trusted pointer delivery reports `browser_input_trust_unavailable` on an
  unproven platform/surface before dispatch;
- `input_route: "dom_event"` is explicit and never substituted silently for
  trusted pointer input;
- target ids, tab ids, dialog generations, and refs remain session- and
  generation-scoped;
- navigation, a new snapshot, browser reconnect, or native/browser identity
  drift invalidates stale capabilities;
- generic OS input is a separate fallback rung selected according to the CUA
  skill, never an automatic transport fallback.

`browser_prepare` remains an explicit destructive setup boundary. Isolated
driver-owned profiles are the default. Attaching to an existing authenticated
profile requires exact PID/window binding, a protected local consent decision,
and a persistent OpenClaw node indicator with a Stop control. A model Boolean,
ordinary MCP elicitation, or remote Gateway assertion is not consent. Browser
downloads and file assignment additionally pass the OpenClaw resource-handle
policy described above.

### CUA sessions and concurrency

The model still chooses CUA capture scope and explicitly calls `start_session`
and `end_session` as CUA's skill requires. The model does not choose the native
session id. The plugin removes that field from model-visible schemas, and the
node injects one stable, opaque id namespaced to the unique OpenClaw execution
lease, selected node, and provider into every session-aware CUA call. Any
caller-supplied reserved or native session field is rejected. Anonymous action
calls are never dispatched. The native id contains no durable chat/session id,
user text, workspace paths, credentials, or externally meaningful identifiers.

Calling CUA `end_session` is necessary session cleanup, but it does not remove
the process-level immutable bounded manifest. Every exit from an authorized
Computer Use execution therefore converges on one idempotent node-owned release
path. The triggers are normal completion, failure, cancellation, timeout, node
or Gateway disconnect, provider crash, explicit CUA session end, local Stop,
OpenClaw session clear, execution-lease expiry, and policy-lease expiry. Release
performs these steps:

1. Revoke the exact browser grant and protected indicator, including an
   asynchronous revocation signal to CUA when local Stop originates in the
   host UI.
2. End the injected CUA session and the OpenClaw execution, host, and policy
   leases.
3. Release synthetic input, agent cursor, recording, replay, and other
   execution-owned state.
4. Stop or restart the daemon so the execution's exact-resource bounded
   manifest no longer exists in the process.
5. Advance provider generation and reject every capability minted for the old
   execution.

The release operation is keyed by `executionLeaseId`, not by a durable
OpenClaw chat/session id. Repeated or racing exit notifications are no-ops after
the first successful state transition. A fresh execution must acquire a fresh
lease, manifest, CUA session, generation, and tool binding before calls become
available again.

V1 allows one active Computer Use execution per provider host. The app-owned MCP
connection serializes calls, and another run receives `computer-use-host-busy`
until the active lease ends. This preserves CUA's process-global caches,
recording state, and connected-transport isolation without pretending separate
MCP sessions isolate the daemon.

CUA recording is daemon-global at the researched baseline: starting a new
recording replaces the active recording, action hooks observe subsequent calls
across MCP sessions, and manual `stop_recording` is unconditional. Separate MCP
connections do not isolate that state.

The exclusive provider-host lease therefore also owns recording. The adapter
verifies lease ownership before `get_recording_state` or `stop_recording`,
injects the execution-owned output directory, and releases recording during
lifecycle cleanup. A future CUA version with daemon-enforced state isolation and
an app-owned connected channel per run may allow concurrent sessions after
compatibility probing.

### Authorization and defense in depth

Computer Use has two independent authorization layers.

#### OpenClaw policy

The Gateway treats all `computer.provider.call.v1` calls as privacy-sensitive.
It additionally evaluates the plugin-owned, argument-aware decision and risk
class:

- `observe`: screenshots, accessibility trees, app/window enumeration;
- `input`: clicks, typing, keys, scrolling, dragging, value changes;
- `launch`: app and window lifecycle operations;
- `browser-data`: browser state, page text, DOM, or script-capable operations;
- `record`: recording, replay, or persisted visual trajectories.

Computer Use must be explicitly enabled on the node and armed at the Gateway.
Fine-grained approvals can evolve, but v1 must not classify screenshots or
accessibility trees as ordinary generic MCP calls. Plugin registrations map
known operations and resources to risk classes; a node cannot self-assign a
lower class. File, origin, recording, install, replay, and output-path arguments
are checked before dispatch. Tool-name allowlisting alone is not sufficient.

The dedicated command reuses OpenClaw's existing node allowlist, dangerous
command, cancellation, idempotency, and lifecycle mechanisms. Disabling
Computer Use revokes active leases and releases synthetic input.

An armed Computer Use run uses a secure execution profile for the selected
desktop host. OpenClaw does not materialize `system.run`, local shell/exec, or a
shell-capable plugin route that can execute arbitrary processes on that host.
When Gateway and node are the same machine, this exclusion covers Gateway-local
exec as well as node exec. Process execution on a different, explicitly bound
host is unaffected.

OpenClaw refuses to arm the Computer Use binding if another tool in the same run
retains arbitrary process execution on the selected host. This is an authority
conflict, not a prompt-guidance issue: a shell-capable agent could launch CUA or
other OS automation outside `computer.provider.call.v1`, replace policy files,
or inspect the driver. Users who deliberately grant arbitrary local code
execution already grant equivalent desktop authority and must use a separate
run from managed Computer Use.

#### CUA daemon policy

CUA's [policy stack](https://cua.ai/docs/concepts/how-permission-policies-work)
and [permission mode](https://cua.ai/docs/reference/cua-driver/permission-modes)
are separate and both are used.

The node provider package supplies an administrator-owned, deny-by-default CUA
managed policy through `CUA_DRIVER_MANAGED_POLICY_FILE`. It permits only the
reviewed CUA operations and argument shapes accepted by the plugin. A local
operator may provide a CUA user policy through `CUA_DRIVER_POLICY_FILE`; that
policy can narrow the managed ceiling but cannot widen it. The node does not
overwrite or silently disable an operator policy.

OpenClaw launches CUA in bounded mode with an immutable, node-created session
manifest. The manifest names the exact allowed tools and, where applicable,
browser PID/window and origin resources. It has a finite expiration and idle
timeout and is approved only by the trusted local node launcher. Unknown tools
and omitted tools are denied. OpenClaw never uses CUA unrestricted mode by
default and sets the managed control that disables unrestricted startup when
the accepted CUA version supports it.

CUA loads managed policy, user policy, mode, and bounded manifest once per
daemon process. OpenClaw treats their hashes and the bounded manifest expiry as
part of provider generation. Any policy, grant, or mode change restarts the
exclusive daemon session and invalidates previous tools and browser
capabilities. An expired bounded session is never revived in place.

Gateway policy remains authoritative per call. CUA's policy engine is
defense in depth at the daemon enforcement point and can repeat argument limits
such as allowed operations, string lengths, numeric ranges, and origins. It
does not authenticate callers, constrain tool responses, enforce quotas, or by
itself turn arbitrary file paths into approved resources. Those boundaries
remain with the connected transport, Gateway result limits, and node-side
resource resolver.

The node repeats security-critical argument checks before MCP dispatch so a
compromised or version-skewed Gateway cannot turn an approved attachment handle
into an arbitrary local path. The Gateway owns user and execution policy; the
node owns final native-resource resolution.

#### Protected consent and bounded rebinding

CUA's bounded manifest is immutable and must name an existing browser profile's
exact PID/window before the daemon starts. Those resources are often discovered
during the run. V1 uses an explicit approve-rebind-retry protocol rather than
pretending current CUA can resume an operation-time approval in place. It also
requires CUA's embedded `ProtectedConsentProvider` adapter: the new manifest
pre-approves the exact resource, while the protected provider activates and
revokes the persistent indicator after the new daemon starts. Neither contract
substitutes for the other.

The protected control exchange is inaccessible to model-facing MCP and binds
the schema version, nonce, CUA request digest, daemon instance, provider
generation, immutable permission mode, managed and user policy hashes,
OpenClaw execution lease, injected CUA and transport sessions, operation, risk
class, expiry, and exact browser resource. The resource includes PID, native
window, browser product, process fingerprint, and endpoint owner when
available. A replay against any other daemon, generation, policy, lease,
session, operation, expiry, or resource fails closed.

The bounded flow is:

1. the plugin classifies an operation such as
   `browser_prepare(existing_profile)` and does not dispatch it to CUA;
2. the selected node app displays the exact PID/window, operation, requested
   origin scope, expiry, and policy context;
3. local approval invokes the idempotent release path for the current execution
   authorization and creates a new bounded manifest containing that exact
   resource;
4. the app restarts CUA with the new manifest, advances provider generation,
   and binds a fresh execution lease plus opaque CUA session over the inherited
   data and protected-control channels;
5. when CUA calls `activate_preapproved()`, the host adapter validates the exact
   request digest and activates a persistent Computer Use indicator with Stop;
   failure to activate the indicator prevents the browser grant from becoming
   live;
6. the original call returns `provider-rebound-retry-required`; the skill makes
   the model re-list/re-snapshot and explicitly retry against the new
   generation. OpenClaw never automatically replays the pending mutation.

A remote Gateway may initiate the request, but only the local node UI can
approve the new bounded scope. Local Stop revokes the indicator immediately,
sends asynchronous revocation over the protected control channel, and invokes
the same execution-release path even if the Gateway or original caller is
gone. Daemon-side grant revocation deactivates the host indicator. Host death,
protected-channel closure, indicator failure, policy change, daemon restart,
CUA session end, or execution-lease end also revokes the grant. A model Boolean,
ordinary MCP elicitation, chat reply, or Gateway-only approval cannot approve
the manifest or activate the indicator.

The accepted CUA version must expose and compatibility-advertise this embedded
provider adapter. If inherited IPC, bounded rebinding, protected-provider
activation, or asynchronous revocation is unavailable, existing-profile
attachment remains unavailable. A future CUA contract may reduce restarts only
if it can replace the process-level immutable manifest safely; the current
design always restarts to remove or broaden manifest authority.

The connected provider transport is never published as a model-visible
argument. Inherited-handle isolation, platform process protections, bounded CUA
policy, and OpenClaw's classified route are required defense-in-depth layers.

### Onboarding and user flows

Onboarding distinguishes five states that are often conflated:

1. the node is paired and online;
2. a provider is installed and compatible on that node;
3. local OS permissions/backend access are ready;
4. the provider is ready, including private transport, protected-consent
   adapter, and probes, but no execution owns native authority;
5. the Gateway has selected and armed that host/provider and the current
   execution has acquired bounded run authorization.

#### Local Gateway and desktop app

The app's **Enable Computer Use** flow:

1. explains that CUA is the default driver and that OpenClaw will own local
   permission prompts;
2. detects a managed CUA installation or an exact-match system artifact that
   is eligible for verified import;
3. offers the pinned managed install when needed;
4. verifies artifact, manifest, MCP capabilities, and matching skill profile;
5. requests or directs the user through local OS permissions;
6. verifies the authenticated protected-consent adapter, indicator lifecycle,
   Stop, and asynchronous revocation;
7. starts the provider under the correct app/node owner with immutable managed
   policy and no active run authorization;
8. runs permission, screenshot, accessibility, and tool-catalog probes;
9. publishes ready inventory with `runAuthorization.state: "inactive"`;
10. selects this node and CUA as the Gateway default after explicit
    confirmation;
11. acquires a short-lived test execution authorization, performs a harmless
    capture, presents the result locally, and invokes the release path.

#### Remote Gateway and desktop node

The Gateway never tries to run a desktop installer remotely. Its setup surface
lists paired desktop nodes with actionable states, for example:

- **MacBook Pro - Open OpenClaw on this Mac to enable Computer Use**;
- **Windows desktop - CUA update required locally**;
- **Linux workstation - Wayland portal permission is waiting on the desktop**;
- **Mac mini - ready, CUA 0.x, permissions owned by OpenClaw**.

Selecting an unready node creates no partial agent tool surface. The Gateway
offers a deep link or node-directed notification, and the node app performs the
local flow. When the node publishes ready inventory, the Gateway can complete
host selection and arming. Provider-native tools remain unavailable until the
run acquires its own execution authorization. Pairing approval, node readiness,
Gateway arming, and run authorization remain separate decisions.

An operation that needs a broader bounded scope returns a typed local-approval
state while the selected node presents the exact request. After approval and
provider rebinding, the original call returns
`provider-rebound-retry-required`; it is not resumed or replayed silently.
Gateway approval UI, chat replies, and model arguments cannot substitute for
the local decision. The active node indicator and Stop control remain visible
for the grant lifetime.

If several nodes are ready, onboarding requires a default host choice. Agent or
session configuration may override it explicitly. A model does not choose a
machine from a list of similarly named dynamic tools.

#### Linux node without a companion app

The equivalent local flow is available through a node-local command such as:

```text
openclaw node computer-use enable
openclaw node computer-use status
openclaw node computer-use test
```

Those commands operate on the node where they are executed, not on the Gateway
unless it is the same machine. They print bounded diagnostics and never expose
connected transport handles or secrets by default. The node still requires an
interactive desktop session; a truly headless Linux node reports
`backend-unavailable`.

### Provider selection and Peekaboo

The macOS app's existing Peekaboo-backed `computer.act` becomes provider
`peekaboo`. It remains app-owned and uses the same inventory, readiness,
selection, generation, and policy route. Its tools and skill can differ from
CUA's.

CUA is selected by default when both are ready. A user can select Peekaboo for a
host or session. The active provider's tools and skill are the only Computer
Use surfaces materialized for that binding.

There is no automatic per-call fallback between CUA and Peekaboo in v1. A CUA
failure returns a typed error and recovery guidance. Silent fallback would
invalidate CUA element references, session state, capture coordinates, risk
classification, and model instructions.

Third-party providers can register through the same Gateway SDK contract, but
they must also arrange a trusted node-side runtime. V1 does not let a Gateway
plugin upload arbitrary native executables into a node app or inherit macOS TCC
automatically. Future signed node-provider packages can extend this boundary
after their install, publisher, update, and permission-inheritance security
model is reviewed.

### Diagnostics and observability

Gateway and node diagnostics report a closed state machine rather than raw
stderr:

- selected host and provider;
- provider generation and version;
- managed-download/managed-import/bundled artifact source;
- compatibility result and missing required capability codes;
- local enablement;
- permission attribution and readiness;
- backend (`macos`, `windows-uia`, `x11`, `wayland-portal`, or provider-defined
  bounded value);
- tool and skill catalog digests;
- managed/user/session policy hashes, bounded expiry, and protected-consent
  readiness without policy contents;
- daemon/proxy lifecycle state;
- last successful readiness probe time;
- active session count and connected-channel health;
- provider readiness and run-authorization state;
- active execution, host, and policy lease state;
- protected-control channel and local Stop-indicator state.

Logs may include provider stderr after OpenClaw's normal redaction and size
limits, but protocol diagnostics use closed codes. Screenshots, accessibility
trees, page text, and recorded trajectories are never health telemetry.

`openclaw doctor` checks Gateway-side selection and protocol compatibility. The
node-local app or CLI checks native artifacts, OS permissions, backend state,
and process health. Doctor does not pretend a remote Gateway can repair local
TCC or portal grants.

### Failure behavior

The integration fails closed in these cases:

- selected node disconnected;
- selected provider disabled or changed;
- inventory generation changed;
- driver or skill version incompatible;
- provider-spec digest incompatible;
- required CUA tool/schema missing;
- unknown CUA tool requested;
- unapproved operation, origin, file, output path, or resource handle;
- Computer Use host lease held by another execution;
- local permissions revoked;
- Wayland portal/session unavailable;
- managed or user policy missing, invalid, or denying the operation;
- bounded daemon policy expired;
- protected consent unavailable or locally denied;
- Windows host, daemon, proxy, or helper running outside the intended
  interactive user session, including Session 0;
- browser binding, origin, trust route, or capability generation stale;
- execution authorization inactive, expired, or bound to another execution;
- Gateway Computer Use lease not armed;
- tool result exceeds Gateway limits;
- daemon or proxy crashes repeatedly.

The node may restart a crashed provider with bounded backoff. Every restart
changes the generation and invalidates active bindings because CUA caches,
sessions, and element references are process-local. OpenClaw does not replay
input automatically after a transport failure unless the operation has a
provider-proven idempotency contract.

### Current architecture reused

This proposal deliberately builds on current OpenClaw seams:

- the app-owned macOS TypeScript node worker keeps the native app as the sole
  node identity;
- `node.pluginTools.update` demonstrates dynamic node tool publication;
- the node MCP manager demonstrates persistent MCP connections and result
  mapping;
- node-hosted skills already support connection-scoped delivery and filtering
  by selected node;
- node invocation already supports allowlists, dangerous-command arming,
  cancellation, and lifecycle cleanup;
- the Windows companion already has a capability registry shared by Gateway
  and local MCP exposure.

The clear core changes are a classified provider route, a prepared Computer Use
binding, provider inventory, and selected-provider tool/skill projection. They
are broadly useful architecture changes; CUA remains the first consumer.

### Implementation sequence

The detailed [implementation plan](0025/implementation-plan.md) organizes work
into parallel development waves with explicit merge dependencies, repository
ownership, proof, and rollout gates.

1. **Upstream prerequisites:** CUA inherited connected IPC, an authenticated
   embedded protected-consent/indicator adapter, an OpenClaw MCP-first
   skill/capability profile, and node-controlled resource/helper paths proceed
   in parallel.
2. **OpenClaw foundations:** additive node protocol, provider runtime, early
   Peekaboo migration, and reusable node MCP hosting establish the generic
   contract. The Plugin SDK export lands with Peekaboo as a real consumer.
3. **CUA Linux reference slice:** the generated provider package, bundled CUA
   adapter, and Linux lifecycle proceed in parallel where possible, then join
   in a local and remote-Gateway X11 gate.
4. **Platform and UX wave:** macOS app hosting, the Windows companion host, and
   Gateway onboarding/doctor work proceed in parallel against the proven Linux
   contracts.
5. **Closure and rollout:** security, packaging, browser/model parity, and
   upgrade gates complete before CUA becomes the default ready provider.

The critical path is CUA inherited connected IPC plus the protected-consent
adapter -> Linux provider lifecycle -> Linux vertical proof -> macOS/Windows
packaged hosts -> cross-platform closure -> default rollout. Work outside that
path should not wait for the current CUA embedded transport and protected-host
contracts to change.

### Acceptance criteria

The feature is not complete until all of these are demonstrated:

- macOS packaged app: only OpenClaw appears as the responsible Accessibility
  and Screen Recording identity, and a CUA screenshot plus accessibility action
  succeeds after one permission flow;
- Windows packaged companion: CUA runs under companion-owned lifecycle and a
  remote Gateway can use it, while Session 0 reports unavailable;
- Linux X11 node: managed install, readiness, screenshot, and input work from a
  remote Gateway;
- Wayland: unsupported or portal-blocked states are reported honestly and
  recover without Gateway restart;
- multiple nodes: only the selected host's tools and skill are visible;
- multiple providers on macOS: CUA is default, Peekaboo is selectable, and no
  silent fallback occurs;
- incompatible/new CUA version: unknown tools are hidden and setup offers the
  pinned compatible version;
- binary provenance: a system `cua-driver` with the right version and tools but
  an unknown digest is refused, and the running image is proven to be the
  imported locked artifact before it can perform OS work;
- provider package skew: an unknown `providerSpecDigest` cannot become ready;
- driver restart: old sessions and element references fail as stale;
- provider/run state: a provider can be ready with no authorized run, tools are
  unavailable until a unique execution lease is authorized, and a durable
  chat/session id cannot reuse authority across executions;
- policy: the run cannot arm Computer Use while `system.run`, local exec, or
  another arbitrary process route targets the selected desktop host; generic
  MCP cannot invoke managed CUA outside the classified route;
- local transport: there is no provider listener for a same-user process to
  discover or connect to, and inherited handles cannot be opened or duplicated
  by unrelated processes;
- resource policy: uploads, downloads, recordings, replays, and output paths
  cannot address arbitrary node files, and install tools are not model-callable;
- helper provenance: Windows/Linux video recording is hidden unless ffmpeg is a
  locked managed helper invoked by a node-controlled absolute path, never
  ambient `PATH`;
- CUA policy composition: managed, user, and bounded policy layers all fail
  closed; their hashes change provider generation; unrestricted mode is denied;
- protected consent: existing-profile attachment cannot proceed from a model
  Boolean or Gateway approval alone; local approval creates a new exact-resource
  manifest and generation; CUA `activate_preapproved()` activates the persistent
  indicator through the authenticated host adapter; explicit retry is required;
  and local Stop asynchronously revokes the active grant;
- execution release: completion, failure, cancellation, timeout, node or
  Gateway disconnect, provider crash, explicit CUA session end, local Stop,
  OpenClaw session clear, and lease expiry all reach the same idempotent release
  path, remove the process-level bounded manifest by stopping or restarting the
  daemon, and invalidate the old generation;
- live schemas: the reviewed catalog limits the maximum surface, the installed
  driver's `tools/list` decides which reviewed branches exist,
  schema-supported `delivery_mode` needs no invented capability token,
  unsupported branches fail explicitly, and `bring_to_front` remains a
  standalone tool;
- browser targeting: an exactly bound occluded Chromium tab can use the
  documented full-background navigation/text/explicit DOM-event rung, while an
  unproven trusted pointer route fails before dispatch and stale refs are
  rejected after navigation or reconnect;
- concurrency: a second run receives `computer-use-host-busy`, and one CUA
  session cannot capture, replace, or stop another session's recording;
- skill resources: CUA companion guidance is readable without granting general
  node shell or filesystem access;
- skill: an end-to-end task exercises snapshot-before/after and at least one
  documented CUA fallback without direct CLI execution, automatic mutation
  retry, or Gateway-controlled ladder advancement;
- disable/revoke: active input is released, child processes stop, and subsequent
  calls fail closed;
- image and structured MCP results reach the model without base64 inflation or
  loss of typed metadata beyond existing Gateway limits.

## Rationale

### Why not rebuild CUA as OpenClaw primitives

The small-looking list of screenshot, click, type, key, scroll, drag, and screen
size operations is not CUA feature parity. CUA also owns background per-window
operation, accessibility snapshots, stable addressing, sessions, capture
scopes, escalation, browser adapters, permissions, recording, replay, caches,
and platform-specific behavior. Reimplementing these in OpenClaw would create a
second driver with a separate compatibility and security burden.

OpenClaw needs provider lifecycle and policy primitives, not OS automation
primitives. This keeps the cleanest contract and lets CUA evolve independently.

### Why a bundled plugin instead of only a skill

A skill can teach models how to use a driver, but it cannot safely own native
installation, macOS TCC responsibility, node inventory, policy classification,
or remote host selection. Direct CLI invocation also bypasses the desired
transport and policy path. The skill remains essential model guidance inside a
real provider integration.

### Why a bundled plugin instead of an external CUA plugin only

An external Gateway plugin cannot by itself install code into desktop node apps
or make a remote macOS app spawn a TCC-inheriting child. Making CUA the default
requires coordinated Gateway, protocol, native app, packaging, onboarding, and
cross-platform test work. A bundled plugin keeps CUA-specific policy out of
core while allowing OpenClaw releases to ship a tested end-to-end product.

The provider SDK still permits external alternatives. They must satisfy the
node-runtime boundary rather than assuming Gateway plugin installation
magically distributes native code.

### Why MCP rather than a TypeScript port

CUA's MCP adapter exposes the driver's full evolving surface and structured
results. The OpenClaw node already has reusable MCP infrastructure. A
TypeScript wrapper that manually mirrors every action creates schema drift and
turns OpenClaw into a partial CUA implementation. The plugin should validate
and classify native MCP tools, not rewrite them.

### Why app-owned processes on all platforms

macOS requires app ownership for the intended TCC attribution. Windows and
Linux do not require the same permission identity, but the same lifecycle model
provides consistent install, update, health, disable, and remote-node behavior.
Platform-specific child processes and helpers remain allowed behind the common
provider host.

### Why not use ordinary node MCP tools

Ordinary node MCP is transport, not product policy. Its current command is not
classified like `computer.act`, and it does not establish a selected host,
provider generation, trusted tool/risk map, permission readiness, or matching
skill. Reusing its internals behind a dedicated route avoids duplicating
transport without weakening Computer Use policy.

### Why not expose the canonical CUA CLI skill unchanged

The canonical skill's CLI default is effective when the model and driver share
one machine and process environment. OpenClaw supports remote Gateways and
app-owned connected transports. In that architecture, direct shell execution is
ambiguous and bypasses the classified provider route. A version-matched
MCP-first profile preserves CUA's reasoning quality without compromising host
selection or permissions.

### Why not silently fall back to Peekaboo

Providers have different addressing, capture, foreground, session, and tool
semantics. A provider switch invalidates the model's context and may act on a
different coordinate frame. Explicit selection and rematerialization are safer
and easier to diagnose.

### Why not rely on manifest JSON-RPC plugin bindings

[openclaw/openclaw#98005](https://github.com/openclaw/openclaw/pull/98005)
proposes language-neutral Gateway plugin processes. It may make some external
provider adapters easier to author, but it does not place a binary on a remote
node, make the macOS app the direct spawner, own Windows helpers, or classify
node-side Computer Use calls. This RFC does not depend on that PR landing.

## Prior art and research baseline

This RFC was researched against OpenClaw main at
`e5610976cfb1`, CUA at `994308a96649`, and the Windows companion at
`80dbd80ad780` on 2026-07-21.

### OpenClaw

- [Node MCP manager](https://github.com/openclaw/openclaw/blob/e5610976cfb1/src/node-host/mcp.ts)
  supplies reusable process-lifetime MCP transport.
- [Node plugin tool projection](https://github.com/openclaw/openclaw/blob/e5610976cfb1/src/agents/node-plugin-tools.ts)
  demonstrates dynamic agent tools and current node naming behavior.
- [Node command policy](https://github.com/openclaw/openclaw/blob/e5610976cfb1/src/gateway/node-command-policy.ts)
  classifies `computer.act` as dangerous while generic node MCP remains an
  ordinary command.
- [Remote node skills](https://github.com/openclaw/openclaw/blob/e5610976cfb1/src/skills/runtime/remote-skills.ts)
  provide connection-scoped skill delivery and selected-node filtering.
- [macOS node worker](https://github.com/openclaw/openclaw/blob/e5610976cfb1/apps/macos/Sources/OpenClaw/NodeMode/MacNodeHostWorker.swift)
  already keeps `OpenClaw.app` as the sole node identity while an app-owned
  TypeScript worker supplies generic node behavior.

### CUA

- [trycua/cua#2410](https://github.com/trycua/cua/issues/2410) tracks inherited
  connected IPC for embedded hosts.
- [trycua/cua#2411](https://github.com/trycua/cua/issues/2411) tracks the
  authenticated embedded `ProtectedConsentProvider`, persistent indicator,
  Stop, and asynchronous revocation contract.
- [trycua/cua#2412](https://github.com/trycua/cua/issues/2412) tracks the
  versioned OpenClaw MCP-first skill and capability profile.
- [trycua/cua#2413](https://github.com/trycua/cua/issues/2413) tracks trusted
  host-owned resource and helper paths.
- [How permission policies work](https://cua.ai/docs/concepts/how-permission-policies-work)
  defines the daemon enforcement point, deny-by-default managed/user policy
  composition, immutable process snapshot, argument rules, and the explicit
  limits around caller identity, responses, paths, network, and quotas.
- [Permission modes and bounded autonomy](https://cua.ai/docs/reference/cua-driver/permission-modes)
  defines bounded manifests, policy hashes, protected host consent, persistent
  Stop indicators, and revocation.
- [Browser targeting and background delivery](https://cua.ai/docs/concepts/browser-targeting-and-background-delivery#a-full-background-rung)
  defines exact native-window/tab binding, capability lifetimes, explicit input
  trust, and the full-background CDP rung retained by this proposal.
- [Embedded mode](https://github.com/trycua/cua/blob/994308a96649109c4e6334acba7179acc8542155/libs/cua-driver/rust/Skills/cua-driver/EMBEDDING.md)
  defines the direct-spawn responsibility chain, daemon/proxy topology, host
  attribution, restart requirements, and Windows/Linux notes. It was introduced
  by [trycua/cua#2102](https://github.com/trycua/cua/pull/2102).
- [Canonical skill](https://github.com/trycua/cua/blob/994308a96649109c4e6334acba7179acc8542155/libs/cua-driver/rust/Skills/cua-driver/SKILL.md)
  defines sessions, snapshot invariants, fallback behavior, browser use, and
  the current CLI-default transport.
- [Skill installer](https://github.com/trycua/cua/blob/994308a96649109c4e6334acba7179acc8542155/libs/cua-driver/rust/crates/cua-driver/src/skills.rs)
  distributes a driver-version-matched skill pack and already recognizes
  OpenClaw's skill directory.
- [Driver authorization](https://github.com/trycua/cua/blob/994308a96649109c4e6334acba7179acc8542155/libs/cua-driver/rust/crates/cua-driver-core/src/authorization.rs)
  and [bounded session manifest](https://github.com/trycua/cua/blob/994308a96649109c4e6334acba7179acc8542155/libs/cua-driver/rust/crates/cua-driver-core/src/session_manifest.rs)
  provide a defense-in-depth daemon policy for compatible releases.
- [Daemon socket server](https://github.com/trycua/cua/blob/994308a96649109c4e6334acba7179acc8542155/libs/cua-driver/rust/crates/cua-driver/src/serve.rs)
  accepts local connections without an embedded-client authentication handshake
  at this baseline, which is why an inherited connected transport is a
  production prerequisite rather than an assumed current capability.

### Windows companion

- [Node capability contract](https://github.com/openclaw/openclaw-windows-node/blob/80dbd80ad7800cdd710fcd007194ba128614f6ce/src/OpenClaw.Shared/NodeCapabilities.cs)
  and the companion's existing local MCP/Gateway capability sharing provide a
  suitable owner boundary for an outbound MCP provider host.

### Earlier OpenClaw proposals

- [openclaw/openclaw#1946](https://github.com/openclaw/openclaw/pull/1946)
  added a CUA `computer` tool over the older Python HTTP computer server. It
  proved demand and basic plugin shape, but did not solve native app permission
  ownership or remote desktop-node lifecycle.
- [openclaw/openclaw#72076](https://github.com/openclaw/openclaw/pull/72076)
  was the closest tool integration: an in-repository plugin with a persistent
  CUA MCP client. It was macOS-only, spawned from the OpenClaw/plugin process,
  required separate CUA permissions, exposed a manually selected action subset,
  and lacked node selection, managed installation, versioned skills, and the
  classified provider route.
- [openclaw/openclaw#80626](https://github.com/openclaw/openclaw/pull/80626)
  documented CUA, Codex Computer Use, and Peekaboo positioning but added no
  runtime architecture.
- [openclaw/openclaw#97939](https://github.com/openclaw/openclaw/pull/97939)
  proposed manifest-first Computer Use provider metadata with transport and
  permission fields. It correctly identified pre-runtime provider discovery,
  but mixed provider identity with host-specific launch details.
- [openclaw/openclaw#110293](https://github.com/openclaw/openclaw/pull/110293)
  narrows that work to static provider ownership and `{id, label}` runtime
  identity. That direction aligns with this RFC, but identity alone is not the
  operational contract. It should land with the runtime binding and first
  consumer described here rather than establish an indefinitely unconsumed SDK
  surface.

## Unresolved questions

- What exact inherited connected transport will CUA expose on Unix and Windows?
  OpenClaw's requirement of no discoverable privileged listener is fixed even
  if the upstream handle-passing mechanism changes.
- What exact protected-control framing will CUA expose for the embedding host's
  consent/indicator adapter? Model-facing MCP must not be able to forge it, and
  its daemon, request, generation, policy, execution, session, operation,
  expiry, and resource bindings are fixed even if framing changes.
- Will CUA publish and version an explicit OpenClaw MCP-first skill profile, or
  must the initial integration use an exact-digest transport overlay?
- Which CUA release first satisfies the required embedded topology, bounded
  authorization, managed artifacts, and cross-platform capability probes for a
  production OpenClaw compatibility range?
- Should the first Windows release include elevated/UWP UIAccess support, or
  ship with that capability explicitly unavailable until the signed helper
  lifecycle is complete?
- Should provider preference be global per user, per agent, or both? The runtime
  binding supports both, but product precedence needs a separate UX decision.
- Which observation and action risk classes require per-call confirmation in
  addition to node enablement and Gateway arming?
- Should a future signed node-provider package format allow external plugins to
  distribute native app-owned runtimes? That requires an explicit publisher,
  install, update, rollback, and TCC-inheritance security review and is not a v1
  prerequisite.
- Should CUA managed artifacts update only with OpenClaw/plugin releases, or may
  a signed hosted provider feed advance the pinned version between releases?
  Automatic activation remains out of scope either way.
