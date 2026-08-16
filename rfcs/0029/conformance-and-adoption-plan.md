# Control Model conformance and adoption plan

This plan turns RFC 0029 into independently reviewable gates. A model subpath,
UI artifact, or adopter is not supported until source behavior, fixtures, live
proof, and deletion agree.

## Evidence principles

- The Gateway protocol and server are authoritative for wire behavior and
  authorization.
- OpenClaw Control UI is the executable behavioral reference until shared
  fixtures replace UI-local interpretation.
- Raw Gateway events are evidence inputs, not the stable Control Model API.
- A source harness proves reconciliation; a real Gateway proves integration; a
  second host proves framework neutrality.
- Native rendering is not proof of action authorization.
- Every proof records repository, exact head, OpenClaw version, command,
  result, and known gap.
- Every adopter names duplicate code that becomes deletable.

## Acceptance layers

| Layer | Review surface | Required proof | Deletion unlocked |
| --- | --- | --- | --- |
| M1 Gateway Client model boundary | OpenClaw PR 1 | Browser-safe module graph, lifecycle, immutable store contract | Consumer scaffolding for connection/session snapshots |
| M2 conversation projection | OpenClaw PR 2 | Shared history/live/reconnect/tool/approval corpus | Per-consumer chat reducers and event folding |
| A1 UI artifacts | OpenClaw PR 3 | Native, structured-only, MCP fallback, malformed, stale, history cases | Tool-specific presentation interpretation |
| O1 Control UI adoption | OC4 plus CU4-CU6 | Existing Control UI behavior unchanged as runtime, catalog, selected conversation, ordinary commands, interactions, and artifacts move through the model in bounded slices | Only the UI-local capability/reducer/request code replaced by each observed slice |
| H1 independent host | Lobster/M PR 1 | Real hosted Gateway projected into existing host view model | Host-owned Gateway reconciliation for adopted slice |
| H2 native artifact | Lobster/M PR 2 | One allowlisted component plus denied action and fallback | One bespoke tool-output rendering path |
| C1 shared conformance | OpenClaw PR 5 | Shared fixtures, finite defaults, browser/Node package acceptance, compatibility canaries, performance bounds, and security review | Publication uncertainty |
| R1 publication | OpenClaw PR 6/release | Accepted conformance, two consumers, compatibility window, migration policy, release and support ownership, and clean install/import proof from the packed release artifact | Fork-only distribution |
| D1 incumbent cleanup | OpenClaw PR 7 | Observation window, rollback proof, and exact deletion ledger | Superseded Control UI reconciliation |

## Evidence to date

Fork-only evidence now covers the full bounded V1 thesis:

| Evidence | Result |
| --- | --- |
| OC1 | Immutable bounded catalog snapshots, explicit host binding, epoch-safe refresh, typed errors, and subscriber isolation. |
| OC2 | Lazy conversations, deterministic history/live reconciliation, bounded messages/runs/tools/interactions, typed commands, reconnect, and retention. |
| OC3 | Sanitized renderer-neutral artifacts, history/reconnect revisions, selected-only deferred materialization, MCP App/Canvas fallback, and provenance/identity hardening. |
| OC4 | Initial Control UI adoption: lazy runtime binding, canonical active-session catalog, and selected-chat history/subscription state without visual or startup-budget regression. Ordinary commands, interactions, artifacts, and operational callers remain outside this draft. |
| OC5 current slices | Centralized finite defaults; reusable catalog, history/live overlap, reconnect, approval authorization, run, tool, question, artifact, and retained-bounds fixtures; packed protocol/client installation; every Gateway Client export imported from the tarball; declaration consumption; browser bundling; repair of a package-only browser export failure; asserted steady-state projection and retained-memory bounds; an asserted candidate/predecessor/main wire-compatibility matrix; and asserted initial projection, selected-view materialization, inactive eviction, and reconnect/resync lifecycle bounds. The latest test-only slice is fork [OpenClaw PR #247](https://github.com/giodl73-repo/openclaw/pull/247), stacked on compatibility PR #246. |
| CU4 | Fork-only Control UI ordinary-command adoption: selected composer sends and connected exact-run aborts route through the existing conversation handle while reconnect-resume, steer/inject, background/non-selected, realtime, replay, and session-wide abort paths remain raw. Session identity, attachments, reply/fencing inputs, retry metadata, and active-leaf recovery details are preserved. |
| CU5 | Fork-only selected-session interaction and artifact adoption: exact pending question answer/cancel commands route through the cached conversation identity while Control UI retains prompt lifecycle and raw fallback. Validated ready Canvas/MCP artifact snapshots feed only existing sandboxed adapters, with canonical-first provenance and occurrence-aware compatibility dedupe. Global/operator approval queues remain raw. |
| LM1-LM3 | Existing `SessionView` adaptation, exact native table rendering, visible fallback, and a host-owned action routed through the model. |
| LM4-LM6 | Ordinary send, active-run abort, and selected-session history cut over to the model, deleting equivalent raw Lobster paths. |
| Board Model + LB1 | Existing Control UI board reconciliation extracted to `@openclaw/gateway-client/model/board`; 55 focused tests, Gateway Client build, and clean review. Lobster LB1 independently renders one safe native status widget and inert unsupported fallbacks through a main-process projection. Its mocked beta protocol is evidence only; release admission remains open. |
| Config Model + LC1 | Read-only authored config snapshots and schema lookup consumed by a native Lobster settings category through Electron-owned transport; principal-scoped cache, structured failure states, focused tests, and clean review. |

The independent-adopter gate is therefore demonstrated, not merely planned.
Publication is still blocked on upstream acceptance, security review, package
ownership, and a released dependency through PR 6. The bounded steady-state
projection and retained-memory threshold slice is measured in PR #245, the
wire-compatibility canary is measured in PR #246, and the lifecycle performance
scenarios are measured in PR #247. Control UI CU5 remains fork-only adopter
evidence in
[OpenClaw PR #243](https://github.com/giodl73-repo/openclaw/pull/243).
Incumbent cleanup remains CU6/PR 7 after
observation and rollback proof. Product shipment is additionally blocked on
Lobster CI, live hosted-Gateway proof, rollout and rollback controls, telemetry,
and UX quality.

## Shared fixture families

| Family | Minimum cases |
| --- | --- |
| Store | read/subscribe race, immutable identity, unsubscribe, disposal |
| Scheduling | receive-stack isolation, bounded reconciliation queue, slow/throwing subscriber |
| Connection | connect, reconnect, offline, terminal error, retired epoch |
| Sessions | initial list, live create/update/delete, observer outage, resync |
| History | initial load, pagination/truncation, live-before-history, duplicate persisted/live |
| Runs | start, stream, progress, success, failure, cancellation, disconnect |
| Tools | call/result association, out-of-order result, duplicate ID, bounded progress |
| Approvals/questions | allowed action, denial, expiry, reconnect, stale action |
| Commands | success, forbidden, conflict, timeout, abort, unsupported, idempotent retry |
| Artifacts | multiple view descriptors, lazy materialization, client selection, native, unknown, malformed, fallback, revisions, history, expiry |
| Capability split | extension absent/disabled, renderer absent, version mismatch, stale/private advertisement, authorization-filtered discovery |
| Bounds | messages, progress, artifacts, bytes/depth, inactive conversations |

Each fixture identifies:

- wire/projection schema version;
- canonical source behavior;
- initial state;
- ordered inputs;
- expected snapshots;
- expected commands or failures; and
- one mutation that must fail in a deliberately nonconforming implementation.

## Validation ladder

### Per-commit

- formatting, lint, typecheck, and diff hygiene;
- affected package tests;
- browser-safe import graph;
- fixture schema validation;
- no framework or product imports in core; and
- no subscriber/render work in the Gateway receive stack.

### Per-PR

- complete `@openclaw/gateway-client/model` tests;
- Gateway protocol compatibility tests;
- current Control UI tests for affected behavior;
- source fixture and real loopback Gateway proof;
- memory/retention bounds under representative history and progress; and
- independent review of error, reconnect, and authorization semantics.

### Native artifact adoption

- exact local registry and schema version;
- multiple OpenClaw view offers and a client-selected non-default view;
- deferred descriptors with only the selected payload materialized;
- valid and invalid artifact data;
- allowed and denied action;
- stale artifact action;
- unknown renderer;
- extension-installed but renderer-unsupported and renderer-installed but
  extension-absent cases;
- MCP App/structured fallback;
- theme, accessibility, localization, and responsive behavior owned by the
  adopter; and
- no dynamic import derived from artifact data.

### Hosted adoption

- real product authentication and Gateway route;
- cold start and reconnect;
- history/live overlap;
- mid-stream disconnect and resync;
- tenant/session isolation;
- rollback to the incumbent path; and
- telemetry without raw tool data or credentials.

## Compatibility

Before publication, test:

- the exact supported OpenClaw release;
- the declared predecessor release where compatibility is promised;
- OpenClaw `main` as a drift canary;
- browser and Node host bindings; and
- a packed release artifact installed into clean browser and Node consumers,
  including every supported subpath and declaration entrypoint; and
- every supported serialized fixture version.

The Control Model contract version and Gateway wire protocol version are
distinct. A wire-compatible server may still require an additive model
projection update. An incompatible model change requires migration guidance
and a declared support-window decision.

The first asserted compatibility slice is fork
[OpenClaw PR #246](https://github.com/giodl73-repo/openclaw/pull/246). It checks
the candidate schema, published predecessor
`@openclaw/gateway-protocol@2026.7.2-beta.7`, and current `main` for the exact
methods, authorization scopes, request payloads, and representative events used
by the Control Model. Blacksmith Testbox `tbx_01m05spdcyy97ht168pfy3tqv1`
passed against `main@63401b730b55b40f691b004308cab45b66c8eb89`. The predecessor
accepts the baseline ordinary-send contract but rejects `expectedRunId`; the
canary records that capability boundary instead of promising an unsupported
fenced-send downgrade.

## Performance and memory gates

The package must measure:

- initial session and conversation projection time;
- per-event reconciliation cost;
- snapshot allocation rate during streaming;
- retained bytes for messages, progress, tools, and artifacts;
- descriptor enumeration and selected-view materialization latency/bytes;
- inactive conversation eviction; and
- reconnect/resync latency.

No renderer callback runs in the Gateway receive loop. Slow subscribers must
not block protocol event processing. Unbounded history, progress, artifact, or
listener retention blocks release.

The first asserted performance slice is fork
[OpenClaw PR #245](https://github.com/giodl73-repo/openclaw/pull/245). It runs
six measured batches after warmup, with 1,000 artifact-heavy cycles and 4,000
events per batch. The gate requires p95 projection latency at or below 4,000 ms,
retained heap growth at or below 2 MiB, retained heap slope at or below 256 KiB
per batch, and exact finite snapshot lengths with truncation evidence.
Blacksmith Testbox `tbx_01m05mrxhzajxpdqb6ggdzx4y1` passed at 2,211.45 ms p95,
52,272 bytes retained growth, and 8,482.51 bytes/batch retained slope. Initial
projection, selected-view materialization, inactive eviction, and
reconnect/resync are asserted in fork
[OpenClaw PR #247](https://github.com/giodl73-repo/openclaw/pull/247).
Blacksmith Testbox `tbx_01m05veqewr76wd05191gt6sb8` passed with:

- 14.32 ms initial projection p95 for 200 sessions, 200 messages, and 50
  artifacts, below a 100 ms ceiling;
- 0.58 ms selected deferred-view materialization p95 across 100 views, below a
  10 ms ceiling;
- 26.23 ms inactive eviction p95 per 1,000 handles, with exactly 50 retained
  and 5,950 disposed, below a 250 ms ceiling; and
- 8.07 ms reconnect/resync p95 for authoritative 200-message history, below a
  100 ms ceiling.

## Security gates

The following are blocking:

- native renderer registration from tool-provided data;
- component/module import paths derived from artifact metadata;
- action execution without model command and server authorization;
- success-shaped state after forbidden/conflicting commands;
- cross-session or retired-epoch artifact/action confusion;
- credentials, hidden model context, capability URLs, or unbounded payloads in
  logs/errors;
- implicit executable fallback for unknown artifacts;
- loss of MCP App sandbox/CSP/expiry behavior; and
- deletion of the incumbent path before rollback proof;
- unreviewed renderer registration or unsupported artifact data version;
- eager materialization of unselected deferred views;
- discovery that reveals unauthorized extension/tool/view availability; and
- verbatim extension access to unrelated client renderer inventory.

## Independent adopter proof

The first independent adopter should:

1. consume the Gateway Client model through an existing supported Gateway
   route;
2. choose among OpenClaw-provided views and adapt the selected projection into
   its existing view model rather than create another shared vocabulary;
3. render one representative conversation;
4. register one native artifact;
5. exercise one denied action;
6. fall back safely when registration is absent;
7. reconnect mid-stream; and
8. identify exact reducer/projection code deleted after parity.

LM1-LM6 satisfy this bounded proof. Future work should not extend the stack
merely to remove every raw Gateway call. Remaining raw lanes must be classified
by ownership first; host operational/security behavior is not Control Model
duplication.

## Promotion and deletion ledger

Every adoption PR records:

1. incumbent implementation;
2. owner behavior preserved;
3. exact conformance fixtures;
4. real integration proof;
5. rollout and rollback control;
6. observation window; and
7. deletion commit or follow-up owner.

No deletion credit is granted because a package compiles or a demo renders.
