# Control Model conformance and adoption plan

This plan turns RFC 0029 into independently reviewable gates. A package, UI
artifact, or adopter is not supported until source behavior, fixtures, live
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
| M1 package boundary | OpenClaw PR 1 | Browser-safe module graph, lifecycle, immutable store contract | Consumer scaffolding for connection/session snapshots |
| M2 conversation projection | OpenClaw PR 2 | Shared history/live/reconnect/tool/approval corpus | Per-consumer chat reducers and event folding |
| A1 UI artifacts | OpenClaw PR 3 | Native, structured-only, MCP fallback, malformed, stale, history cases | Tool-specific presentation interpretation |
| O1 Control UI adoption | OpenClaw PR 4 | Existing Control UI behavior unchanged on shared fixtures and E2E | Adopted UI-local capability/reducer code |
| H1 independent host | Lobster/M PR 1 | Real hosted Gateway projected into existing host view model | Host-owned Gateway reconciliation for adopted slice |
| H2 native artifact | Lobster/M PR 2 | One allowlisted component plus denied action and fallback | One bespoke tool-output rendering path |
| R1 publication | OpenClaw PR 5/release | Two consumers, package acceptance, compatibility and support policy | Workspace-only distribution |

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
| Artifacts | multiple view offers, client selection, native, unknown, malformed, fallback, revisions, history, expiry |
| Capability split | extension absent/disabled, renderer absent, version mismatch, stale advertisement |
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
- fixture schema validation; and
- no framework or product imports in core.
- no subscriber/render work in the Gateway receive stack.

### Per-PR

- complete `@openclaw/control-model` tests;
- Gateway protocol compatibility tests;
- current Control UI tests for affected behavior;
- source fixture and real loopback Gateway proof;
- memory/retention bounds under representative history and progress; and
- independent review of error, reconnect, and authorization semantics.

### Native artifact adoption

- exact local registry and schema version;
- multiple OpenClaw view offers and a client-selected non-default view;
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
- every supported serialized fixture version.

The Control Model contract version and Gateway wire protocol version are
distinct. A wire-compatible server may still require an additive model
projection update. An incompatible model change requires migration guidance
and a declared support-window decision.

## Performance and memory gates

The package must measure:

- initial session and conversation projection time;
- per-event reconciliation cost;
- snapshot allocation rate during streaming;
- retained bytes for messages, progress, tools, and artifacts;
- inactive conversation eviction; and
- reconnect/resync latency.

No renderer callback runs in the Gateway receive loop. Slow subscribers must
not block protocol event processing. Unbounded history, progress, artifact, or
listener retention blocks release.

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
- unreviewed renderer registration or unsupported artifact data version.

## Independent adopter proof

The first independent adopter should:

1. consume the package through an existing supported Gateway route;
2. choose among OpenClaw-provided views and adapt the selected projection into
   its existing view model rather than create another shared vocabulary;
3. render one representative conversation;
4. register one native artifact;
5. exercise one denied action;
6. fall back safely when registration is absent;
7. reconnect mid-stream; and
8. identify exact reducer/projection code deleted after parity.

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
