---
title: Default, Pluggable Computer Use with CUA over computer.act
authors:
  - RomneyDa
created: 2026-07-21
last_updated: 2026-07-22
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/45
---

# Proposal: Default, Pluggable Computer Use with CUA over `computer.act`

## Summary

Make CUA the default Computer Use provider while retaining the architecture
already shipped by OpenClaw: the model uses the built-in `computer` tool, the
Gateway binds it to a capable desktop node, desktop image reads flow through
`screen.snapshot`, and all other provider operations flow through the dangerous
`computer.act` node command. Expand that contract from a desktop-coordinate
action subset into a versioned, capability-negotiated Computer Use protocol
covering app/window discovery, semantic observation, stable targets,
background delivery, browser targeting, verification, recording, and explicit
escalation. The bundled `cua-computer` plugin maps this contract to CUA and
provides CUA-derived model guidance. On macOS, `OpenClaw.app` directly starts
CUA embedded mode and the app-owned TypeScript node worker runs the same plugin
adapter used by Windows and Linux. CUA remains replaceable by another node-local
fulfiller such as Peekaboo. The earlier native-MCP projection is rejected; its
tradeoffs are recorded below, but it is not a second design or delivery plan.

## Design constraints and requirements

The design is constrained by these requirements:

1. **CUA is the default implementation, not code copied into OpenClaw.** CUA
   continues to own accessibility, capture, input, browser targeting,
   recording, replay, permission policy, and platform-specific behavior.
   OpenClaw owns a portable command contract and a CUA adapter.
2. **Use the landed Computer Use route.** The built-in `computer` tool,
   `screen.snapshot`, `computer.act`, node capability selection, frame binding,
   idempotency, cancellation, dangerous-command arming, and model-only image
   delivery remain the foundation. There is no second
   `computer.provider.call.v1` route.
3. **Gateway and desktop node may be different machines.** Provider runtime,
   OS work, native prompts, artifacts, and consent remain on the selected node.
   A Gateway plugin installation never implies installation on a remote node.
4. **OpenClaw owns macOS permission attribution.** `OpenClaw.app` directly
   spawns `cua-driver serve --embedded`; the app-owned node worker may run the
   CUA adapter and MCP proxy, but neither the Gateway nor an unrelated Node
   process may spawn the privileged daemon.
5. **The same command contract works everywhere.** macOS, Windows, Linux, a
   local Gateway host, and a remote desktop node all advertise the same
   `screen.snapshot` + `computer.act` surface. Platform hosts may differ behind
   that boundary and must report unsupported capabilities honestly.
6. **CUA parity means substantive behavior, not all 49 tools as public SDK
   methods.** OpenClaw must preserve CUA's targeting, observation, delivery,
   verification, browser, recording, session, and skill semantics. Driver
   maintenance and host lifecycle operations remain node-internal.
7. **Computer Use remains node-locally pluggable.** One active provider owns
   the command pair on a node for an execution. CUA is selected by default when
   ready; Peekaboo remains selectable on macOS. Provider changes never happen
   silently during an execution.
8. **The model cannot bypass the route.** CUA CLI calls, generic node MCP,
   arbitrary shell commands, raw provider tool forwarding, and model-selected
   native paths cannot reach the managed privileged CUA instance.
9. **Native artifacts and authority are local and fail closed.** Only a pinned
   or explicitly accepted CUA artifact runs. Provider generation, frame and
   semantic references, session state, held input, recording, and approvals are
   invalidated on provider restart, disconnect, disable, Stop, or selection
   change.
10. **Model guidance is part of feature parity.** The selected execution gets
    CUA's snapshot, background-first, verification, browser, escalation, and
    platform guidance rewritten for OpenClaw action names. It never tells the
    model to start CUA, choose a socket, install a binary, or use the CLI.

## Motivation

OpenClaw now has a coherent basic Computer Use architecture:

- [openclaw/openclaw#102776](https://github.com/openclaw/openclaw/pull/102776)
  added the built-in `computer` tool and macOS `computer.act` fulfillment through
  embedded Peekaboo services.
- [openclaw/openclaw#112107](https://github.com/openclaw/openclaw/pull/112107)
  made node eligibility capability-based rather than macOS-specific.
- [openclaw/openclaw#112267](https://github.com/openclaw/openclaw/pull/112267)
  added the bundled `cua-computer` plugin as a Windows/Linux node-host
  fulfiller.

That architecture solves the most important routing problem: the agent does not
need to know which implementation drives the selected node. It also already
solves several difficult safety problems:

- coordinates are bound to the exact screenshot frame shown to the model;
- one tool instance stays pinned to one node and display;
- input is serialized and carries stable idempotency keys;
- cancellation and route invalidation release held input;
- `computer.act` is dangerous and disarmed by default;
- desktop screenshots remain model-only rather than being delivered to chat.

The current CUA fulfiller is intentionally narrow. It calls only eight CUA MCP
tools: `get_desktop_state`, `get_screen_size`, `click`, `drag`, `move_cursor`,
`press_key`, `scroll`, and `type_text`. It forces every operation to desktop
scope, uses only the primary display, and cannot expose CUA's app/window,
accessibility, browser, recording, session, delivery, or structured-verification
behavior.

CUA 0.10 documents 49 MCP tools. The missing value is not 41 additional command
names by itself. The larger gap is CUA's object and execution model:

- exact apps, processes, windows, accessibility elements, browser targets,
  tabs, pages, and snapshot-scoped references;
- combined visual and semantic window observation;
- background element and window-pixel delivery before foreground fallback;
- structured `effect`, `verified`, `path`, degradation, and escalation results;
- exact native-window to browser-target binding and a full-background browser
  rung;
- provider sessions, capture scope, stale-reference rules, recording, replay,
  and agent cursor state;
- extensive cross-platform skill guidance that teaches models when and how to
  use those capabilities.

Projecting CUA's native MCP catalog directly would preserve those features but
would discard the simplicity and safety of the landed `computer.act` route.
Keeping only the existing coordinate subset would make CUA a replaceable mouse
driver and lose most of the reason to choose it. This RFC expands the existing
contract at the stable concepts between those extremes.

### Decision change from the original draft

| Original draft | Selected design |
| --- | --- |
| New `computer.provider.call.v1` Gateway/node route | Existing `screen.snapshot` + `computer.act` route |
| Project CUA's native MCP tools into the model | Project portable typed Computer Use actions and adapt them to CUA on the node |
| Gateway selects and materializes a provider-native tool catalog | Node advertises one active provider and an exact portable capability set |
| Dedicated native MCP provider host on every platform | Existing TypeScript node-host plugin runtime, plus app-owned native service handoff where required |
| Swift/macOS-specific CUA adapter likely required | Existing app-owned TypeScript worker runs the shared CUA adapter |
| Inherited connected IPC blocks all production use | Private embedded socket may support bounded desktop use after threat review; inherited IPC remains preferred hardening |
| Protected host consent blocks the entire provider | It blocks existing-profile browser attachment; unrelated capability families remain independently shippable |

The original design remains useful when native provider fidelity is more
important than a stable cross-provider action contract. It is no longer the
recommended OpenClaw architecture.

The comparison above is the complete decision record for that rejected design.
This RFC keeps one normative architecture and one implementation plan; it does
not retain a parallel native-MCP plan that future work could accidentally
maintain or revive.

## Goals

- Ship CUA as the default ready Computer Use provider on supported macOS,
  Windows, and Linux desktop hosts.
- Keep one model-to-node route: the built-in Computer Use tools invoke
  `screen.snapshot` and `computer.act` on one selected node.
- Preserve all substantive CUA agent capabilities through portable typed
  actions and results.
- Run the CUA mapping once in the bundled TypeScript plugin wherever the node
  worker can host it, including the app-owned macOS node worker.
- Make `OpenClaw.app` the responsible macOS process by directly spawning CUA's
  embedded daemon.
- Support a local Gateway with no separate node device as a first-class local
  desktop host on Windows and Linux, while retaining the node boundary.
- Support a Gateway on a different machine without moving installation,
  permissions, prompts, or native state to the Gateway.
- Keep Peekaboo as an explicit macOS alternative behind the same contract.
- Adapt CUA's skill guidance to the OpenClaw contract without maintaining a
  second operating model in core.
- Provide deterministic onboarding, readiness, Stop, diagnostics, updates, and
  rollback on the machine that owns the desktop.

## Non-Goals

- Reimplementing CUA's OS calls or native automation engine in TypeScript,
  Swift, or OpenClaw core.
- Exposing every CUA configuration, health, update, or dependency-installation
  tool to the model.
- Passing arbitrary CUA MCP tool names or schemas through `computer.act`.
- Replacing OpenClaw's browser tool. CUA browser actions provide native-window
  binding and visual/native fallback for the selected desktop.
- Making every provider support every CUA-derived action. Capabilities are
  explicit and unsupported actions fail before dispatch.
- Automatically granting permissions, approving protected browser attachment,
  or downloading native code during an agent action.
- Allowing a remote Gateway to choose native paths, executable arguments,
  helper binaries, or local consent outcomes.
- Silently switching provider, node, window, display, or browser target after a
  failure.
- Treating a provider id in a plugin manifest as authority to inherit native
  app permissions.

## Proposal

### Architecture

The existing command pair becomes the stable provider boundary:

```text
Model
  |
  | built-in computer tool + selected-provider guidance
  v
Gateway computer tool runtime
  | binds node, provider generation, execution, frame and target references
  | node.invoke(command = "computer.act")
  v
Selected desktop node
  | one active Computer Use provider fulfills screen.snapshot + computer.act
  +-- CUA adapter -> CUA MCP proxy -> CUA daemon -> OS
  `-- Peekaboo adapter -> embedded Peekaboo/CoreGraphics -> macOS
```

`computer.act` names the stable node command, not a promise that every operation
is a raw input mutation. Version 2 also carries discovery and semantic
observation actions because keeping one classified, session-bound route is more
important than introducing a second command solely to improve the verb.
`screen.snapshot` remains the fast portable desktop-image path and the source of
desktop coordinate frames.

The Gateway never connects to CUA. It invokes the selected node. The provider
adapter and CUA processes always run on the node machine.

### Ownership boundaries

#### OpenClaw core and Gateway

Core owns only provider-neutral behavior:

- the built-in model-facing Computer Use tool schemas;
- selection of one capable node;
- execution affinity to node, active provider id, and provider generation;
- `screen.snapshot` frame delivery and coordinate authorization;
- opaque semantic-reference tracking;
- `computer.act` request validation, arming, idempotency, cancellation, size
  limits, and result projection;
- generic action risk classes and host-owned resource handles;
- deterministic skill selection for the active provider;
- closed readiness and failure codes.

Core does not know CUA command-line flags, release URLs, socket paths, native
tool names, or platform implementation details.

#### Bundled `cua-computer` plugin

The plugin owns CUA-specific behavior:

- CUA version compatibility and the accepted action-to-MCP mapping;
- live capability and schema checks;
- conversion between OpenClaw target handles and CUA pid/window/element/page
  references;
- mapping CUA results into the portable result envelope without discarding
  native evidence;
- CUA session creation, use, cleanup, and capture-scope escalation;
- the version-matched OpenClaw profile of the CUA skill;
- CUA policy generation and provider-specific risk classification;
- Windows/Linux daemon and MCP proxy supervision;
- managed artifact metadata and CUA-specific diagnostics.

The plugin remains bundled because it is the default product integration and
must ship in every official node host. CUA remains an external native artifact,
not copied source.

#### Desktop node host

The node host owns machine-local authority:

- active provider selection;
- local enablement and Stop;
- driver installation, provenance, launch, update, rollback, and disablement;
- native permissions and interactive-session readiness;
- app-owned service handoff on macOS;
- one active provider generation and execution session;
- cleanup on completion, cancellation, timeout, disconnect, crash, disable,
  provider switch, and process exit;
- local resource roots for recordings, uploads, downloads, and replay.

#### CUA

CUA continues to own its native driver, accessibility and browser adapters,
delivery behavior, semantic caches, recording/replay implementation,
permission modes, daemon policy, and upstream skill content.

### Node-local provider seam

A node advertises one active fulfiller for the command pair. Multiple providers
may be installed, but provider selection occurs locally before the node
publishes readiness. The Gateway may request a user-selected provider id, but
the node must have it installed, enabled, and locally allowed.

The node-host SDK should evolve from direct duplicate command registration to a
narrow provider registration consumed by the CUA plugin:

```ts
type ComputerUseProvider = {
  id: string;
  label: string;
  readiness(context: NodeHostContext): ComputerUseReadiness;
  capabilities(context: NodeHostContext): ComputerUseCapabilities;
  openExecution(context: ComputerUseExecutionContext): Promise<ComputerUseExecution>;
};

type ComputerUseExecution = {
  snapshot(request: ScreenSnapshotRequest): Promise<ScreenSnapshotResult>;
  act(request: ComputerActV2Request): Promise<ComputerActV2Result>;
  close(reason: ComputerUseCloseReason): Promise<void>;
};
```

The node host registers `screen.snapshot` and `computer.act` once and dispatches
them to the selected provider. It serializes provider actions and closes the
execution through one idempotent lifecycle path.

This API does not give plugins native app permission inheritance, executable
launch authority, or permission-prompt callbacks. Official app hosts inject
their own trusted services into the selected bundled provider. External plugins
can fulfill the interface only with authority already available to their node
runtime.

The existing `registerNodeHostCommand` implementation remains available for
unrelated commands. The provider API should land only with replacement of the
experimental CUA proof's direct command path, so it has a real consumer and no
legacy CUA registration path remains.
[openclaw/openclaw#110293](https://github.com/openclaw/openclaw/pull/110293)
may supply the `{id, label}` identity portion if it lands first, but this RFC
does not depend on it. The transport- and permission-specific metadata proposed
by [openclaw/openclaw#101564](https://github.com/openclaw/openclaw/pull/101564)
is unnecessary for execution.

### CUA cutover and removal

Compatibility is deliberately narrow. OpenClaw retains the shipped v1
`computer.act` wire contract and its existing generic node and Peekaboo behavior
for old nodes. The experimental CUA plugin is not a separate compatibility
target: its direct command registration, pre-provider lifecycle, and narrow
eight-tool adapter are replaced in place by the provider execution path.

The replacement must provide the v1 coordinate action subset through the
canonical provider while v2 action families roll out. It must not leave a
legacy CUA adapter, plugin mode, fallback, config reader, or duplicate test
suite beside that path. Any useful driver transport, frame authorization, or
refusal logic moves into the canonical provider implementation; unused
interfaces and tests are deleted.

The pre-release `driverPath` and ambient-`PATH` setup are not upgrade contracts.
Managed artifacts become the production path. If a developer override remains
useful, it is one explicitly developer-only current configuration surface, not
a compatibility reader for the old plugin configuration.

The CUA compatibility bundle names one accepted CUA manifest/version at a time.
An unknown or skewed driver fails closed; OpenClaw does not carry multiple
version-specific mappings or adapters to preserve experimental behavior.

### Versioned node capability declaration

Command-name presence remains the v1 eligibility test. A v2 node additionally
publishes a bounded descriptor in its node declaration:

```ts
type ComputerUseCapabilities = {
  contractVersion: 2;
  provider: {
    id: string;
    label: string;
    generation: string;
  };
  readiness:
    | { state: "ready" }
    | { state: "disabled" }
    | { state: "missing-provider" }
    | { state: "incompatible-provider"; reasonCode: string }
    | { state: "missing-permission"; reasonCode: string }
    | { state: "backend-unavailable"; reasonCode: string }
    | { state: "starting" }
    | { state: "failed"; reasonCode: string };
  actions: readonly ComputerActionName[];
  targets: readonly ("screen" | "window" | "element" | "browser")[];
  deliveryModes: readonly ("background" | "foreground")[];
  observations: readonly ("image" | "accessibility" | "browser")[];
  features: {
    recording: boolean;
    replay: boolean;
    agentCursor: boolean;
    multiDisplay: boolean;
  };
};
```

This is a capability snapshot, not authorization. `computer.act` remains
disarmed until Gateway policy allows it, and the node still enforces local
enablement and provider policy.

`generation` changes whenever provider selection, process identity, accepted
driver version, live capability catalog, permission readiness, or semantic
reference namespace changes. Requests carry the generation they were prepared
against. A mismatch returns `COMPUTER_STALE_PROVIDER` before action dispatch.

A v1 node without this descriptor continues to support only the current
desktop-coordinate contract. The Gateway does not infer semantic capabilities
from platform or provider name.

### `computer.act` version 2

The existing v1 wire shape remains valid for current nodes. A v2 request wraps a
closed action union with host-injected execution state:

```ts
type ComputerActV2Request = {
  version: 2;
  providerGeneration: string;
  executionId: string;
  action: ComputerActionV2;
};
```

`executionId`, provider generation, provider session id, native paths, and
policy context are never model-supplied. The Gateway and node host inject them.
The model supplies only the typed action arguments and opaque references it
received from earlier Computer Use results.

The action union uses precise variants rather than one object with dozens of
optional fields. Calls remain one action at a time. There is no batch mutation
action and no raw `{providerTool, arguments}` escape hatch.

### Target model

Actions address one of four portable targets:

```ts
type ComputerTarget =
  | {
      kind: "screen";
      screenIndex: number;
      frameId: string;
      point?: { x: number; y: number };
    }
  | {
      kind: "window";
      windowRef: string;
      observationId?: string;
      point?: { x: number; y: number };
    }
  | {
      kind: "element";
      windowRef: string;
      elementRef: string;
      observationId: string;
    }
  | {
      kind: "browser";
      browserRef: string;
      pageRef?: string;
      elementRef?: string;
      observationId?: string;
    };
```

Provider-native pid, window id, accessibility token, CDP target id, tab id, and
page reference stay inside the node adapter. Model-visible refs are opaque and
bound to node, provider generation, execution, and observation generation.
Element and browser refs become stale after the provider says their source
snapshot or navigation generation has changed.

Screen points retain the current `frameId` contract. Window points are relative
to the exact window image returned by `get_window_state`; they require the
matching `observationId`. The node performs all scale conversion. The model
never calculates Retina, DPI, display-origin, or browser-viewport transforms.

### Action families and CUA coverage

The v2 action union covers CUA's substantive agent surface while consolidating
duplicates. Exact field schemas belong in the implementation contract, but the
required action families are fixed here.

| Family | `computer` actions | CUA mapping |
| --- | --- | --- |
| Desktop observation | `screenshot` | `get_desktop_state`, `get_screen_size`; still transported through `screen.snapshot` |
| Discovery | `list_apps`, `list_windows`, `get_accessibility_tree`, `get_cursor_position` | same-named CUA tools |
| Window observation | `get_window_state` | tree + screenshot + element tokens + degradation metadata |
| App lifecycle | `launch_app`, `kill_app`, `bring_to_front` | same-named CUA tools |
| Pointer | existing click variants, `mouse_move`, `left_click_drag`, mouse down/up | `click`, `double_click`, `right_click`, `move_cursor`, `drag`; unsupported hold branches remain capability-gated |
| Keyboard and values | `type`, `key`, `hold_key`, `set_value` | `type_text`, `press_key`, `hotkey`, `set_value` |
| View movement | `scroll`, `zoom`, `wait` | `scroll`, `zoom`; `wait` remains Gateway-local |
| Browser observation | `get_browser_state` | exact browser/page snapshots and refs |
| Browser actions | `browser_prepare`, `browser_navigate`, `browser_click`, `browser_type`, `browser_dialog`, `browser_set_input_files`, `browser_download`, `browser_pointer` | same-named CUA tools |
| Scope | `escalate_scope` | `escalate_session` with a bounded reason |
| Recording | `get_recording_state`, `start_recording`, `stop_recording`, `replay_trajectory` | same-named CUA tools |

The complete model-facing action-name set is:

```ts
type ComputerActionName =
  // Existing v1 names.
  | "screenshot"
  | "left_click"
  | "right_click"
  | "middle_click"
  | "double_click"
  | "triple_click"
  | "mouse_move"
  | "left_click_drag"
  | "left_mouse_down"
  | "left_mouse_up"
  | "scroll"
  | "type"
  | "key"
  | "hold_key"
  | "wait"
  // V2 discovery, semantic, browser, scope, and recording names.
  | "list_apps"
  | "list_windows"
  | "get_accessibility_tree"
  | "get_cursor_position"
  | "get_window_state"
  | "launch_app"
  | "kill_app"
  | "bring_to_front"
  | "set_value"
  | "zoom"
  | "get_browser_state"
  | "browser_prepare"
  | "browser_navigate"
  | "browser_click"
  | "browser_type"
  | "browser_dialog"
  | "browser_set_input_files"
  | "browser_download"
  | "browser_pointer"
  | "escalate_scope"
  | "get_recording_state"
  | "start_recording"
  | "stop_recording"
  | "replay_trajectory";
```

`screenshot` remains a model action implemented with `screen.snapshot`, and
`wait` remains Gateway-local. Every other v2 name dispatches through
`computer.act`. The implementation may project the union as more than one
model tool when a model provider cannot reliably consume one large
discriminated schema; the node wire contract remains one command.

The following CUA operations are deliberately not public model actions:

- `start_session`, `end_session`, and `get_session_state` are node-owned
  execution lifecycle;
- `get_config`, `set_config`, `check_permissions`, and `health_report` are local
  status and onboarding;
- `check_for_update` and `install_ffmpeg` are local artifact management;
- agent cursor enablement, motion, and style are local UX settings;
- legacy `page` is superseded by the typed browser actions;
- arbitrary screenshot, recording, download, upload, debug-image, and replay
  paths are replaced by host-owned resource handles.

This accounts for the full published CUA MCP catalog without turning all 49
tools into permanent OpenClaw SDK methods.

### Semantic observation

`get_window_state` is the key parity addition. It returns one result containing:

- a window-local screenshot;
- structured accessibility elements with role, label, value, bounds, hierarchy,
  supported actions, and opaque `elementRef`;
- a stable `windowRef` and `observationId`;
- truncation and degradation metadata;
- optional query filtering and bounded depth/element limits.

The model grounds on both image and semantic state. A later element action must
echo the observation-bound reference. A later window-pixel action must echo the
observation id associated with the screenshot. The adapter rejects stale refs
instead of guessing.

`get_accessibility_tree` remains a lightweight app/window discovery read. It is
not a substitute for the full per-window snapshot.

### Delivery and interaction ladder

Window and element actions accept an explicit `deliveryMode` where the active
provider advertises support:

- `background`: do not intentionally front the target;
- `foreground`: briefly or persistently activate according to the action's
  documented semantics.

The adapted CUA skill teaches this model-selected ladder:

1. Read `get_window_state` and ground on its accessibility tree and screenshot.
2. Try an element action with background delivery, then read fresh state.
3. On a concrete pixel signal, try a window-pixel background action, then read
   fresh state.
4. For an exactly bound supported browser, use the browser-page route and read
   fresh browser state.
5. Use foreground delivery only after background behavior was reported or
   observed ineffective.
6. In an automatic capture-scope session, call `escalate_scope` only after the
   window ladder is exhausted. Then use desktop observation and screen input
   for system UI outside the target window.

The Gateway does not advance this ladder, retry a mutation, substitute another
delivery mode, or silently front an application. It validates and dispatches
the exact model-selected action. This avoids duplicate clicks, text, submits,
and downloads.

`bring_to_front` remains a separate explicit action for surfaces that must stay
frontmost. It is not an alias for the normal foreground delivery rung.

### Results and verification

V2 returns a portable envelope while preserving provider evidence:

```ts
type ComputerActV2Result = {
  ok: boolean;
  provider: { id: string; generation: string };
  effect?: "confirmed" | "unverifiable" | "suspected_noop";
  verified?: boolean;
  path?: string;
  escalation?: {
    recommended: "window-pixel" | "browser" | "foreground" | "desktop";
    reasonCode: string;
  };
  observation?: ComputerObservation;
  resources?: readonly ComputerResource[];
  details?: Record<string, unknown>;
};
```

The adapter retains CUA's structured `path`, `effect`, `verified`, degradation,
and escalation fields. Unknown provider detail may remain in bounded `details`,
but portable decisions use closed fields and codes.

Result precedence is:

- `confirmed`: expected state was verified;
- `unverifiable`: inspect fresh state before deciding whether to mutate again;
- `suspected_noop`, explicit refusal, or delivery failure: another ladder rung
  may be appropriate;
- `escalation.recommended`: a next move is supported, not proof that the prior
  mutation failed.

The current tool automatically captures a desktop screenshot after an action.
For v2, a provider may return a fresher and more relevant window or browser
observation. The Gateway uses that observation and does not add a duplicate
desktop capture. If the provider returns no image after a visual mutation, the
current delayed `screen.snapshot` fallback remains. The Gateway never performs
an automatic second mutation.

### Provider sessions and execution lifecycle

Each bound Computer Use execution owns one provider session. The node creates
the CUA session; the model cannot name or reuse it. The same session is injected
into all mapped CUA calls so element caches, browser refs, capture scope,
recording, and agent cursor state remain coherent.

The node starts the session lazily on the first v2 call and closes it through a
single idempotent path on:

- normal agent-run completion;
- cancellation or timeout;
- Gateway or node disconnect;
- provider process exit or generation change;
- Computer Use disablement or provider switch;
- local Stop;
- bounded idle expiry.

Cleanup ends the CUA session, stops owned recording, removes the agent cursor,
releases held input, closes proxy state, invalidates all refs, and advances the
provider generation when process identity changed. Physical desktop access is
exclusive by default: a second mutating execution receives
`COMPUTER_HOST_BUSY`. Read-only observation concurrency may be added later only
with provider proof that reference namespaces remain isolated.

### CUA skill profile

The CUA skill is required for good model behavior but cannot be installed
unchanged. Its canonical form defaults to CLI calls and native CUA tool names.
The bundled plugin ships a version-matched OpenClaw profile that preserves:

- snapshot before action and fresh-state verification;
- tree and screenshot cross-checking;
- element versus pixel targeting;
- background-first delivery and explicit foreground fallback;
- exact browser-target binding and trust classes;
- capture-scope escalation;
- result precedence and stale-reference recovery;
- recording and replay guidance where enabled;
- relevant macOS, Windows, Linux, browser, and recording guidance.

The profile replaces transport instructions with the OpenClaw action names and
states that the model must not invoke the CUA CLI, start a daemon, choose a
socket, install/update CUA, or select a native session. The profile is bound to
the accepted CUA compatibility bundle and capability version.

OpenClaw may initially maintain this thin transport/action overlay in the
bundled plugin. Upstream publication of an OpenClaw `computer.act` profile is
preferred. [trycua/cua#2412](https://github.com/trycua/cua/issues/2412) should be
updated from the former native-MCP projection to this action-contract profile.

### CUA compatibility source

CUA current main publishes an experimental
[machine-readable contract manifest](https://github.com/trycua/cua/blob/main/libs/cua-driver/contract/manifest.json)
for 14 portable tools. The plugin should consume or generate types and fixtures
from this source where available rather than hand-copy schemas. It does not yet
cover the complete published 49-tool surface, so richer action families still
require pinned live `tools/list` fixtures and source-backed compatibility tests.

Compatibility is an intersection of:

1. the OpenClaw `computer.act` contract version;
2. the plugin's reviewed CUA compatibility bundle;
3. the installed driver's version, capability/schema versions, and live tool
   schemas;
4. platform and backend readiness.

Unsupported action variants are omitted from the advertised capability set and
rejected before MCP dispatch. Arguments are never silently stripped or
rewritten into a weaker semantic branch.

### macOS process topology

macOS uses one CUA adapter and an app-owned native daemon:

```text
OpenClaw.app
  +-- cua-driver serve --embedded        # direct child; owns TCC responsibility chain
  `-- app-owned TypeScript node worker
        +-- bundled cua-computer plugin  # maps computer.act to CUA
        `-- cua-driver mcp --embedded    # proxy to the app-owned daemon
```

This reuses an existing OpenClaw architecture: `OpenClaw.app` remains the sole
Gateway node identity while an app-owned TypeScript worker loads node-host
plugins and can fulfill commands before the native runtime. The CUA adapter can
therefore stay in TypeScript rather than being reimplemented in Swift.

The app, not the worker, directly spawns `cua-driver serve --embedded`. Direct
spawn is the security and TCC invariant. CUA documents that `host-bundle-id` is
only an advisory label; macOS responsibility-chain attribution comes from the
spawner. The app requests Accessibility and Screen Recording, restarts the
daemon after grants change, and verifies `check_permissions` plus a real
capture.

The app supplies the worker a private provider endpoint through an internal
app-to-worker launch contract. It is not OpenClaw configuration and is never
sent through the Gateway or model schema. The worker starts only the unprivileged
MCP proxy and uses the normal bundled plugin mapping.

CUA's documented embedded mode currently uses a private local socket. OpenClaw
creates it under an owner-only random directory, validates ownership and file
mode, rejects pre-existing paths, and removes it at shutdown. Inherited
connected IPC from [trycua/cua#2410](https://github.com/trycua/cua/issues/2410)
would remove the reusable-listener risk and should replace the socket when
available. It is a security hardening and may become a release gate after threat
review, but it does not block the first bounded desktop-action release if the
published private-socket embedding contract passes that review.

When CUA is selected, the worker's `computer.act` and `screen.snapshot`
registrations take precedence over the native Peekaboo implementation. When
Peekaboo is selected, the CUA registrations are unavailable and the existing
native implementation fulfills the same pair. An execution never mixes them.

### Windows topology

The TypeScript node host loads the bundled CUA plugin, supervises the CUA daemon
in the logged-in interactive user session, and runs the MCP proxy over stdio.
The Windows companion should host the same canonical node worker or provide an
equivalent trusted service handoff; it must not maintain a separate action
mapping.

Windows has no macOS-style TCC inheritance requirement, but interactive-session
placement is mandatory. Session 0 reports `backend-unavailable`. Elevated and
UIAccess targets are advertised only after the signed helper path has packaged
acceptance proof.

### Linux topology

`openclaw node run` loads the plugin in the user's interactive desktop session.
The provider reports the actual backend and capabilities:

- X11 may expose the full supported CUA action set;
- Wayland support depends on CUA and compositor-specific capabilities;
- headless, missing portal, unsupported compositor, and inaccessible session
  states fail closed with actionable local diagnostics.

Linux does not require a companion app. Native prompts and package operations
remain on the node machine.

### Gateway-only local desktop

A user running only a Gateway on a Windows or Linux desktop should not need to
pair a second physical device. When locally enabled, the Gateway starts a
loopback desktop node host that loads the same bundled plugin and appears to the
computer tool as one local capable node. It still uses `node.invoke`,
`screen.snapshot`, `computer.act`, arming, provider generation, and node-local
lifecycle. This avoids a special direct-Gateway execution path.

On macOS, the recommended local host is `OpenClaw.app` because it provides a
stable signed TCC identity. A CLI-only Gateway may use CUA's standalone mode if
the user explicitly chooses CUA-owned permission attribution, but it cannot
claim OpenClaw.app-owned permissions. Starting or connecting the app upgrades
the local experience without changing the Gateway tool contract.

### Remote Gateway flow

For a Gateway and node on different machines:

1. The desktop node installs/enables CUA locally and advertises readiness.
2. The user grants permissions and resolves backend errors on that node.
3. The Gateway pairs with the node and sees the command pair and v2 capability
   descriptor.
4. The user selects that node and arms `computer.act`.
5. The Gateway binds the execution to the node and provider generation.
6. All screenshots, semantic state, and actions travel through `node.invoke`;
   all native processes and prompts remain on the node.

The Gateway may display a deep link or diagnostic instruction for the node, but
it never downloads CUA to the node or dismisses its prompts remotely.

### Artifact installation and updates

CUA cannot be the default ready provider if most users must discover and install
an arbitrary binary manually. Official app packages should bundle the pinned
CUA artifact when licensing, size, and release mechanics permit. Otherwise the
node offers an explicit local managed install during Computer Use onboarding.

The node accepts only:

- an artifact bundled with the official node distribution;
- a managed download matching a pinned digest and publisher expectation; or
- an explicit local import whose digest matches an accepted compatibility
  entry.

Ambient `PATH` remains useful for experimental developer mode but is not the
default production trust path. The Gateway never supplies a URL, executable
path, checksum, or launch arguments. Updates are node-local, atomic, and retain
one known-good rollback. No update occurs during an agent tool call.

### Resource handling

Browser upload/download, recording, replay, screenshots-to-file, and helper
selection cross a stronger boundary than clicks and screenshots. Model-visible
actions use opaque OpenClaw resource handles. The node resolves them to exact
approved files or node-owned directories after policy checks.

The managed profile must not expose arbitrary native path fields. Recording
roots, download roots, staged uploads, replay inputs, and `ffmpeg`/`ffprobe`
paths are injected by the node. CUA support tracked by
[trycua/cua#2413](https://github.com/trycua/cua/issues/2413) is a release gate
for the corresponding action families, not for basic observation and input.

### Browser targeting and protected attachment

CUA's [browser targeting and background delivery](https://cua.ai/docs/concepts/browser-targeting-and-background-delivery#a-full-background-rung)
is preserved through typed browser actions and opaque browser/page refs. The
adapter must prove exact native-window to browser-target binding before
navigation or page mutation. Heuristic target selection fails closed.

An isolated driver-owned browser profile can be enabled when the accepted CUA
version proves its ownership and policy boundaries. Existing-profile
attachment is more privileged. It remains unavailable until CUA provides the
authenticated embedding-host consent/indicator adapter tracked by
[trycua/cua#2411](https://github.com/trycua/cua/issues/2411), including local
Stop and asynchronous revocation. A Gateway approval or model Boolean is not a
substitute.

### Authorization and policy

Defense is layered:

1. The node must be paired and advertise the command pair.
2. Computer Use must be enabled locally on the node.
3. `computer.act` must be armed through Gateway command policy.
4. The v2 request must match the bound node, provider generation, execution,
   action capability, frame or semantic refs, and resource policy.
5. Higher-risk action families receive argument-aware OpenClaw classification.
6. The CUA adapter runs CUA with a managed deny-by-default policy and preserves
   any narrower user policy.

CUA's [permission policy](https://cua.ai/docs/concepts/how-permission-policies-work)
is defense in depth. It does not authenticate the remote Gateway, select the
correct OpenClaw node, constrain OpenClaw resource handles, or replace local
provider selection and Stop.

At minimum, forced app termination, existing-profile attachment, uploads,
downloads, replay, persistent foregrounding, and desktop-scope escalation are
separately classifiable from ordinary observation and window-local input.

### Onboarding and provider selection

Computer Use setup is host-aware:

#### macOS app

1. Open **Settings -> Computer Use**.
2. Select CUA (recommended) or Peekaboo.
3. Install or verify the pinned CUA artifact if CUA is selected.
4. Grant Accessibility and Screen Recording to OpenClaw.
5. Run a local capture and harmless input test.
6. The app reconnects with `ready` and the new provider generation.

#### Windows companion or local node

1. Enable Computer Use locally.
2. Install/verify CUA or select an accepted local artifact.
3. Verify interactive-session and backend readiness.
4. Run capture and harmless input tests.
5. Reconnect with the active provider descriptor.

#### Linux node

1. Run a local `openclaw computer setup` flow.
2. Install/verify CUA and detect X11/Wayland state.
3. Run local health, capture, and input probes.
4. Pair/select the node from the Gateway.

#### Gateway

The Gateway shows connected hosts, active provider, readiness, and where a
problem must be fixed. Pairing, local enablement, provider readiness, and
Gateway arming remain separate states. If several capable nodes exist, the user
selects one; the model is not asked to guess.

Provider preference is node-local. Agent- or user-level preference may request
a provider, but a request cannot activate an unready provider. There is no
per-call fallback from CUA to Peekaboo.

### Diagnostics and failure behavior

Diagnostics use closed codes and bounded metadata. They may report provider id,
version, generation, backend, readiness, permission categories, capability
families, and remediation owner. They do not include screenshots,
accessibility trees, page contents, policy contents, socket paths, native file
paths, or raw stderr.

Required failure behavior includes:

- missing or incompatible CUA: unavailable with a local setup action;
- stale frame, observation, element, browser, provider, or execution ref:
  reject before dispatch and require fresh observation;
- unsupported action or delivery mode: reject rather than weaken semantics;
- provider crash or disconnect: invalidate generation and close execution;
- ambiguous mutation timeout: do not retry automatically; return uncertainty
  and require observation;
- missing permission: report the node and local permission category;
- busy host: reject a second mutating execution;
- provider switch: end the current execution, invalidate all refs, and require
  rematerialization;
- local Stop: release input, end sessions and recording, stop provider children
  as needed, and reject subsequent calls.

### Acceptance criteria

The proposal is complete only when the following pass against packaged
artifacts:

- macOS CUA: `OpenClaw.app` directly spawns embedded CUA, only OpenClaw is the
  intended TCC identity, and the app-owned TypeScript worker uses the bundled
  CUA adapter through `computer.act`;
- macOS provider choice: CUA is default when ready, Peekaboo remains selectable,
  and an execution never mixes providers;
- Windows: local and remote Gateways can drive a companion/node in the intended
  interactive session; Session 0 is unavailable;
- Linux: local and remote Gateways complete X11 observation/input tasks and
  report honest Wayland/compositor capability;
- Gateway-only: a Windows/Linux local Gateway starts a loopback node host and
  uses the same command and arming path;
- remote host: no driver, prompt, native path, or OS operation runs on the
  Gateway machine;
- current v1: existing coordinate actions and frame-binding tests remain green;
- semantic observation: window screenshot and accessibility elements arrive
  together and stale element/window-pixel refs fail;
- delivery: a background element action, background pixel fallback, explicit
  foreground action, and explicit desktop escalation preserve model-selected
  semantics without automatic retries;
- verification: CUA `effect`, `verified`, `path`, degradation, and escalation
  survive result projection;
- browser: exact binding and full-background operations work on supported
  browser/platform combinations; stale refs and unproven trusted-pointer paths
  fail closed;
- recording/resources: output roots, uploads, downloads, replay inputs, and
  helpers are node-owned and cannot be redirected by model arguments;
- sessions: one CUA session scopes an execution and every terminal path reaches
  the same cleanup owner;
- skill: representative tasks follow snapshot, background-first, verification,
  browser, and escalation guidance with no CLI or generic MCP bypass;
- artifacts: tampered, unknown, incompatible, or replaced binaries fail before
  OS work; update rollback restores the last known-good version;
- security: command arming, action classification, CUA policy, local Stop, and
  provider generation all fail closed;
- payloads: structured and image observations remain within Gateway limits and
  screenshots remain model-only.

## Rationale

### Why keep `computer.act`

The landed route already solves node selection, remote execution, dangerous
arming, screenshot-coordinate binding, idempotency, cancellation, image
privacy, and native macOS fulfillment. Replacing it with provider-native MCP
would rebuild those controls around a larger and less portable surface.

`computer.act` is therefore the superior architectural boundary if its payload
can represent semantic targets and results. The command should evolve, not be
bypassed.

### Why expansion is not reimplementing CUA

OpenClaw standardizes nouns and outcomes: screen, window, element, browser,
observation generation, delivery mode, verification, and escalation. CUA still
implements every OS call, discovers native objects, maintains caches, binds
browser targets, chooses its platform mechanism, and reports evidence. The CUA
plugin is an adapter, not a second driver.

### Why not expose native CUA MCP tools directly

Native projection would preserve every upstream schema immediately, but it
would make provider semantics model-facing, require a separate classified
route, complicate host selection, and make Peekaboo or another provider expose
a fundamentally different tool set. It also makes CUA's CLI/MCP skill tempting
as a bypass around `computer.act`.

The decision table above records the native-projection alternative and its
stronger native-fidelity tradeoff. It is deliberately not kept as a competing
implementation plan.

### Why not keep the current eight-tool CUA mapping

The experimental mapping is a useful bootstrap slice but reduces CUA to global
foreground desktop input. It loses background window operation, semantic
targets, exact browser binding, verification, sessions, recording, and the
fallback strategy that makes CUA effective. Expanding the action contract is
necessary for CUA to be the default rather than merely another mouse backend.
The replacement retains the portable v1 coordinate behavior through the
canonical provider; it does not preserve the bootstrap adapter as a second path.

### Why not add all 49 tools one-for-one

Several CUA tools are host lifecycle or maintenance operations, several are
specialized aliases, and `page` is legacy. One-for-one exposure would freeze
provider-specific details into OpenClaw and grant the model configuration and
installation authority it does not need. The action-family accounting above
preserves agent capability while keeping host operations local.

### Why a bundled plugin still matters

Core owns portable `computer.act`; the plugin owns CUA versions, mappings,
policy, lifecycle, skill, and compatibility fixtures. This keeps CUA-specific
churn outside core while allowing official node packages to ship and test the
default provider. An ordinary skill cannot own those responsibilities.

### Why the macOS TypeScript worker runs the adapter

`OpenClaw.app` already owns a canonical TypeScript node worker whose commands
can take precedence over native command implementations. Letting that worker
run the bundled CUA adapter avoids a second Swift mapping while preserving the
critical TCC invariant: the app itself directly spawns the privileged embedded
daemon. Peekaboo remains the native fallback when selected.

### Why provider selection is node-local

Only the node knows whether the artifact, permissions, backend, interactive
session, and local consent are ready. Gateway preference is useful, but remote
metadata cannot grant native authority. Local selection also makes the active
command owner unambiguous before an execution begins.

### Why the Gateway-only path is still a node

Running the same loopback node host avoids a direct Gateway-only driver path
with different command policy and lifecycle. It also makes a later remote move
transparent to the model-facing contract.

### Why JSON-RPC plugin bindings are optional

[openclaw/openclaw#98005](https://github.com/openclaw/openclaw/pull/98005)
could help external non-TypeScript plugins implement future provider adapters.
It does not place CUA on a remote node, make `OpenClaw.app` the daemon spawner,
or replace the node-local provider and `computer.act` contracts. No phase of
this RFC waits for it.

## Prior art and research baseline

This rewrite was checked against OpenClaw `main` at `a8537805bd9` and CUA
`main` at `b8a0f32a06c` on 2026-07-22.

### OpenClaw

- [Computer Use documentation](https://docs.openclaw.ai/nodes/computer-use)
  describes the current capability-based command pair, arming, frame binding,
  macOS Peekaboo fulfiller, and experimental CUA fulfiller.
- [macOS Peekaboo bridge](https://docs.openclaw.ai/platforms/mac/peekaboo)
  distinguishes the broad Peekaboo bridge from in-process `computer.act`.
- [Plugin SDK overview](https://docs.openclaw.ai/plugins/sdk-overview) describes
  the supported plugin boundary.
- [openclaw/openclaw#1946](https://github.com/openclaw/openclaw/pull/1946)
  added an earlier CUA computer tool over the Python HTTP server.
- [openclaw/openclaw#72076](https://github.com/openclaw/openclaw/pull/72076)
  proposed an in-repository persistent CUA MCP plugin but did not solve app-owned
  permissions or remote nodes.
- [openclaw/openclaw#80626](https://github.com/openclaw/openclaw/pull/80626)
  documented CUA, Codex Computer Use, and Peekaboo positioning.
- [openclaw/openclaw#97939](https://github.com/openclaw/openclaw/pull/97939),
  [#101564](https://github.com/openclaw/openclaw/pull/101564), and
  [#110293](https://github.com/openclaw/openclaw/pull/110293) explore static
  provider identity and manifest contracts. They are optional to this runtime
  design.

### CUA

- [MCP tool reference](https://cua.ai/docs/reference/cua-driver/mcp-tools)
  documents the published 49-tool surface.
- [MCP tool notes](https://cua.ai/docs/reference/cua-driver/mcp-tool-notes)
  document detailed action and result behavior.
- [Process model](https://cua.ai/docs/reference/cua-driver/process-model)
  defines daemon, proxy, session, and platform process ownership.
- [Embedding](https://cua.ai/docs/reference/cua-driver/embedding) defines direct
  macOS app spawning and host-attributed TCC behavior introduced by
  [trycua/cua#2102](https://github.com/trycua/cua/pull/2102).
- [Browser targeting and background delivery](https://cua.ai/docs/concepts/browser-targeting-and-background-delivery#a-full-background-rung)
  defines exact target binding and the full-background browser rung.
- [Permission policies](https://cua.ai/docs/concepts/how-permission-policies-work)
  define CUA's daemon-side defense and its limits.
- [Canonical CUA skill](https://github.com/trycua/cua/blob/main/libs/cua-driver/rust/Skills/cua-driver/SKILL.md)
  defines the operating loop and platform guidance adapted by this proposal.
- [trycua/cua#2410](https://github.com/trycua/cua/issues/2410),
  [#2411](https://github.com/trycua/cua/issues/2411),
  [#2412](https://github.com/trycua/cua/issues/2412), and
  [#2413](https://github.com/trycua/cua/issues/2413) track inherited IPC,
  protected host consent, OpenClaw guidance, and host-owned resources.

## Unresolved questions

- Should the public node-host provider registration land immediately with CUA,
  or should the first expansion keep direct command registration until a second
  TypeScript provider exists? It must not land without a runtime consumer.
- Which exact CUA release first provides a stable compatibility manifest for
  the richer window, browser, recording, and resource action families?
- Will CUA publish the `computer.act` skill profile, or will the bundled plugin
  maintain the thin action-name overlay?
- Does the macOS threat review accept CUA's owner-only private socket for the
  initial bounded desktop release, or is inherited connected IPC required
  before any packaged default rollout?
- Should official packages bundle CUA or use an explicit first-run managed
  download on each platform? The trust and lifecycle contract is unchanged.
- Which high-risk actions require per-call local confirmation in addition to
  Gateway arming and CUA policy?
- Should Windows elevated/UIAccess support ship in the first release or remain
  an explicit unavailable capability?
- Which Wayland compositors qualify for default-ready status?
- Should read-only semantic observations be allowed concurrently, or should v2
  begin with one exclusive execution for all operations?
