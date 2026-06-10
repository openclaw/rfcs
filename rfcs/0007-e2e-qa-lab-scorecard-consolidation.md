---
title: E2E and QA Lab scorecard consolidation
authors:
  - Dallin Romney
created: 2026-06-07
last_updated: 2026-06-07
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/10
---

# Proposal: E2E and QA Lab scorecard consolidation

## Summary

OpenClaw already has the pieces for serious e2e coverage: Vitest e2e shards, QA Lab scenarios, Docker lanes, live transport checks, and a few sibling repos that have explored release-style proof. This RFC makes QA Lab the place where product-level e2e evidence is collected: normal CI gets a small deterministic suite with mock services and mock model responses, release CI runs the same scenario classes against real providers, real channel credentials, package installs, and upgrade paths, and maturity scorecards consume the resulting summaries.

## Motivation

The maturity scorecard process defines product surfaces and category-level maturity. Its rendered scorecard says promotion toward Stable needs release gates, troubleshooting paths, repeated real-world proof, and scenario proof across expected environments. OpenClaw now has a checked-in maturity taxonomy snapshot in `taxonomy.yaml` and a score snapshot in `docs/maturity-scores.yaml`. This RFC adds the executable layer on top of that taxonomy: `taxonomy-mappings.yaml`, coverage IDs, profile membership, evidence summaries, CI gates, and release artifacts.

OpenClaw already has many valuable non-unit checks:

- `pnpm test:e2e` runs Vitest e2e shards across `test/**/*.e2e.test.ts`, `src/**/*.e2e.test.ts`, `packages/**/*.e2e.test.ts`, selected Gateway integration tests, bundled-plugin e2e globs, and Control UI e2e tests.
- `pnpm test:live` runs the live Vitest shard for source, test, and bundled-plugin live tests. It covers provider, agent runtime, gateway, media, plugin, and native/live integration paths that QA Lab does not own directly.
- `qa/scenarios/**` contains YAML-backed user scenarios with coverage IDs, docs refs, code refs, config patches, runtime parity metadata, and executable `qa-flow` blocks.
- `extensions/qa-lab` can start isolated QA Lab runs, a synthetic `qa-channel`, mock providers, live provider modes, runtime-pair parity, live transport lanes for Telegram, Discord, Slack, and WhatsApp, Mantis before/after live verification, and local channel runs backed by the `openclaw/crabline` messaging SDK.
- `extensions/qa-matrix` is a dedicated live transport runner for Matrix. It provisions a disposable Tuwunel homeserver in Docker, runs the real Matrix plugin in a child Gateway, and has release-gate lanes for transport, media, and E2EE coverage.
- `scripts/e2e/**`, Docker lanes, Parallels lanes, and release scripts exercise install, package, upgrade, plugin, live model, MCP, cross-OS, and release journeys.
- `test/scripts/**` covers script-level release tooling, Docker plans, package checks, perf/RTT helpers, live proof helpers, and CI guards. Some of those tests are product-flow candidates; many are still script/tooling tests.
- PTY/TUI tests cover a fake-backend terminal loop and an opt-in local TUI smoke, but the scoped TUI guide explicitly says the fake-backend PTY lane does not prove Gateway transport, embedded backend runtime, providers, session persistence, or live streaming.
- Sibling repos add useful concepts: Kova has release-shaped scenarios and performance attribution; plugin-inspector has offline plugin compatibility and synthetic contract probes; Crabpot has a many-plugin fixture corpus; Kitchen Sink is the credential-free plugin fixture; openclaw-rtt stores normalized timing history; Crabbox provides remote runner capacity; and openclaw/releases keeps release evidence.

Today there is no single summary entry that says: this product surface was exercised like a user would use it, on this ref, with this model provider, channel or UI surface, runner substrate, and live/mock upstream state, and the result counts for this scorecard category. CI can pass while a maturity category has no realistic user-flow proof. It can also cover a plugin contract without covering the visible workflow that depends on it.

## Goals

- Map scorecard surfaces to executable coverage IDs and publish run summaries that CI can enforce.
- Provide a harness-neutral QA wrapper so CI can request evidence by surface and category instead of knowing whether the proof comes from Vitest e2e, QA Lab scenarios, live transport lanes, Docker, the `openclaw/crabline` channel SDK, or release scripts.
- Keep normal PR CI deterministic and credential-free while still exercising realistic user flows.
- Run release gates against real providers, real channel credentials, package installs, upgrade paths, and supported platforms.
- Keep scenario behavior portable across model providers, channels, runner substrates, and live/mock upstreams.
- Move script-level checks only when a clearer e2e, QA Lab, integration, release-helper, or tooling-test home exists.

## Non-Goals

- This RFC does not add every missing test.
- Historical RTT storage, broad external plugin fixtures, and durable release ledgers stay in their existing repos.
- Normal PR CI does not require live credentials.
- Unit tests and low-level integration tests remain useful, but they do not count as maturity evidence unless they exercise a user-visible path.

## Proposal

### 1. Standardize the evidence artifact

Add a scorecard-aware e2e evidence model in `openclaw/openclaw`. QA Lab does not have to run every check. Its summary format covers the checks that matter for release confidence: e2e shards, Docker lanes, live transport checks, release jobs, and scorecard reports.

Each run writes a summary JSON artifact into its QA artifact directory: the directory passed with `--output-dir`, or the command default under `.artifacts/qa-e2e/<lane>-<timestamp>`. `qa suite` writes `qa-suite-summary.json`; local `openclaw/crabline` channel runs write the same summary shape; live transport lanes write lane-specific summaries such as `telegram-qa-summary.json`, `discord-qa-summary.json`, `slack-qa-summary.json`, `whatsapp-qa-summary.json`, and `matrix-qa-summary.json`. Release CI uploads those files as workflow artifacts first, then can mirror or import the same summaries into `openclaw/releases` once the schema settles.

Each summary includes one scenario entry per executable user-flow scenario with:

- scenario id
- coverage IDs
- scorecard surface and category IDs
- profile: `smoke-ci` or `release`
- model provider, model live mode, and provider fixture or auth mode, for example `provider: openai`, `model_live: false`, `provider_fixture: tool-call-streaming`
- channel or surface, channel live mode, channel SDK/driver, and runner substrate, for example `channel: telegram`, `channel_live: false`, `channel_driver: crabline`, `runner: host`
- OpenClaw ref, package spec, OS, Node version, runner, and artifact paths
- pass/fail/blocked status plus failure reason
- optional timing fields: p50/p95 when repeated, single-run RTT otherwise

Evidence summaries do not copy taxonomy provenance. `taxonomy-mappings.yaml` sits next to `taxonomy.yaml` and records the taxonomy source/version metadata, executable category IDs, profile membership, coverage IDs, docs refs, code refs, scenario refs, and release/advisory status used to join summary entries back to the maturity taxonomy.

The profile is a named selector layered onto the taxonomy mapping that maps scorecard surfaces and categories to runnable lanes. `smoke-ci` is the deterministic PR and merge-gate profile: model providers use mock fixtures, channels use synthetic or local SDK-backed upstreams, and no live external service is required. `release` is the full Stable/LTS profile: provider, channel, package, upgrade, and platform claims need live proof where the claim depends on a real upstream or release artifact. Focused local runs can still filter a profile down to one surface or category. CI should read that profile mapping from `taxonomy-mappings.yaml` rather than carrying a second list in workflow YAML. Non-blocking evidence can appear as advisory rows in reports, but it is not a separate test profile until maintainers explicitly promote it.

The existing QA scenario `coverage.primary` and `coverage.secondary` fields are the seed for this model. Start by extending `openclaw qa coverage` and the existing `qa-suite-summary.json` shape; then normalize live transport summaries to the same schema and join that output to `taxonomy.yaml` through `taxonomy-mappings.yaml`. The landed taxonomy is the product/maturity source of truth; RFC 0007's follow-up work should add executable mappings and profiles without creating a competing scorecard taxonomy.

[0007/example-scorecard-checklist.md](0007/example-scorecard-checklist.md) shows a complete illustrative Stable/LTS checklist and evidence mapping. It is not the final taxonomy, but it shows the expected implementation shape: every release-blocking checklist item has a category ID, evidence requirement, and machine-readable mapping to one or more runnable lanes. The authoritative requirement-to-test mapping should land in `openclaw/openclaw` as checked-in mapping data; this RFC's example remains a shape reference.

Maturity test docs should also live in `openclaw/openclaw` alongside `taxonomy.yaml`, `taxonomy-mappings.yaml`, and runnable coverage IDs. OpenClaw CI should not depend on external process notes to understand what a release-blocking requirement means, how it maps to code paths, or how to rerun/troubleshoot the proof.

### 2. Add a harness-neutral QA wrapper

Keep the harness-specific commands for local debugging and focused work, but add a wrapper that lets CI and maintainers request evidence by product surface and scorecard category:

```sh
pnpm openclaw qa run \
  --profile smoke-ci \
  --surface channels.telegram \
  --category channels.telegram.mock \
  --provider-mode mock-openai \
  --transport telegram \
  --output-dir .artifacts/qa-e2e/channels-telegram-smoke-ci
```

The wrapper can dispatch to the right implementation: Vitest e2e shard, QA Lab scenario pack, live transport command, Matrix runner, Docker/package lane, `openclaw/crabline` channel SDK lane, Control UI browser run, TUI lane, or release helper. The caller should not need to know that `runtime.gateway.startup` is currently a Vitest shard while `channels.telegram.mock` is an SDK-backed QA Lab run.

The wrapper should still write the same summary artifacts described above. A profile can map to many surface/category pairs, a category can map to multiple lanes, and the wrapper can either run all required lanes or fail early with a clear "missing runnable mapping" error. `--surface` and `--category` are filters over the selected profile, not a separate source of truth.

### 3. Split the suites by when they run

#### `smoke-ci` profile in normal CI

The `smoke-ci` profile runs on every PR or normal merge gate. It is deterministic and credential-free. It still needs to hit user paths, not only package checks or internal contracts.

Required components:

- Gateway e2e Vitest shard for protocol, auth, sessions, and core runtime.
- Control UI e2e shard for browser/Gateway workflows with mocked Gateway and selective real WebSocket flows.
- QA Lab scenario subset through `qa-channel` and mock model providers.
- Runtime-pair parity for the standard profile, currently OpenClaw vs Codex where the scenario declares parity.
- `openclaw/crabline`-backed messaging-channel smoke lane with mock AI responses. Run it on every PR, even while coverage is still thin, so regressions force the lane to mature instead of leaving channel e2e as occasional release-only work.
- TUI fake-backend PTY lane plus an explicit local-backend smoke on the platforms where it is stable enough for CI.
- Plugin fixture smoke for built-in plugins using plugin-inspector concepts and Kitchen Sink conformance mode, but without executing arbitrary external plugin code.

The `smoke-ci` profile needs an explicit configuration path. The current CLI spells deterministic OpenAI-compatible model fixtures as `--provider-mode mock-openai`; the proposed evidence schema records that as `provider: openai` and `model_live: false`.

```sh
pnpm openclaw qa run \
  --profile smoke-ci \
  --provider-mode mock-openai \
  --transport qa-channel \
  --output-dir .artifacts/qa-e2e/smoke-ci

pnpm openclaw qa run \
  --profile smoke-ci \
  --channel-driver crabline \
  --provider-mode mock-openai \
  --transport telegram \
  --output-dir .artifacts/qa-e2e/smoke-ci-crabline-telegram
```

#### Broader release-track e2e

Some release-profile coverage can run before a release candidate on scheduled, maintainer-triggered, and changed-surface gates. These runs can spend more time on deterministic services and broader matrices without creating a third profile:

- Docker install, package, plugin lifecycle, MCP, upgrade, and release-user journey lanes.
- Kova-like release-shaped runtime scenarios when they test behavior that belongs in `openclaw/openclaw`.
- Control UI browser flows across at least Chromium and mobile viewport emulation.
- TUI local-backend smoke and PTY rendering stress tests.
- More QA Lab YAML scenarios across memory, automation, media, provider, workspace, and plugin surfaces.

#### Release and maturity scorecard suite

Release CI runs the full suite with real model providers, real upstream services, and service credentials:

- real OpenAI, Anthropic, Google, OpenRouter, and selected long-tail providers for provider-path maturity categories
- real Telegram bots and user-driver flows
- real Discord, Slack, and WhatsApp canaries
- real package install/update/upgrade journeys from npm tags
- Crabbox/Testbox, Docker, Linux, macOS, Windows/WSL2, and platform-specific lanes when the surface claims release support
- scorecard coverage export for each release candidate

Release CI fails closed for scorecard categories. For the first Stable/LTS gate, anything important enough to appear on the scorecard blocks release; advisory checks can stay outside the scorecard until they are ready to be enforced. Messaging channels need live upstream proof to count as release evidence. That live proof can be added channel by channel, but a local shim alone does not satisfy a Stable/LTS claim for a channel listed as supported.

### 4. Keep scenarios portable across providers, channels, and runners

Make each high-level scenario portable across providers, channels, channel drivers, and runner substrates. The scenario describes the user behavior. The selected driver supplies the channel upstream behavior, while the runner supplies the execution environment, provider fixture or credentials, and package source.

Model provider dimensions:

- `provider`: `openai`, `anthropic`, `google`, `openrouter`, `local`, or another provider ID.
- `model_live`: `false` for deterministic provider fixtures and `true` for real provider credentials.
- `provider_fixture`: the deterministic behavior to use when `model_live` is false, such as OpenAI-compatible streaming, planned tool calls, provider timeout, malformed response, or rate-limit behavior.
- `package_source`: source checkout, packed tarball, npm tag, or release artifact.

Use "frontier" only as informal shorthand for commercial model providers; OpenAI belongs in that group. The reason current QA Lab commands name `mock-openai` is practical: the OpenAI-compatible path is the default mock server and covers the most common chat/tools/streaming contract. Anthropic, Google, OpenRouter, and other providers should get provider-specific fixtures too, but the schema should encode them as provider IDs plus live/mock state rather than a separate `mock-frontier` mode.

Channel and surface dimensions:

- `channel`: `qa-channel`, `telegram`, `discord`, `slack`, `whatsapp`, `matrix`, or another channel ID.
- `channel_live`: `false` for synthetic channels or deterministic local upstream shims, and `true` for real upstream credentials.
- `channel_driver`: `native`, `crabline`, or another channel driver. `crabline` means the `openclaw/crabline` messaging SDK.
- `surface`: `gateway-rpc`, `control-ui`, `tui-pty`, `cli`, `docker-package`, `package-install`, or another non-channel surface.
- `runner`: `host`, `docker`, `crabbox`, or a release workflow runner.

This keeps channel identity separate from liveness. A Telegram scenario can run as `channel: telegram, channel_live: false` in PR CI and as `channel: telegram, channel_live: true` in release CI. The same pattern applies to model providers with `provider: openai, model_live: false` versus `provider: openai, model_live: true`.

Suggested env/flag contract:

```text
OPENCLAW_QA_PROFILE=smoke-ci|release
OPENCLAW_QA_PROVIDER=openai|anthropic|google|openrouter|local|...
OPENCLAW_QA_MODEL_LIVE=0|1
OPENCLAW_QA_PROVIDER_FIXTURE=openai-tools-streaming|timeout|rate-limit|...
OPENCLAW_QA_CHANNEL=qa-channel|telegram|discord|slack|whatsapp|matrix|...
OPENCLAW_QA_CHANNEL_LIVE=0|1
OPENCLAW_QA_CHANNEL_DRIVER=native|crabline|...
OPENCLAW_QA_SURFACE=gateway-rpc|control-ui|tui-pty|cli|docker-package|...
OPENCLAW_QA_RUNNER=host|docker|crabbox
OPENCLAW_QA_SCORECARD=1
```

Prefer CLI flags for local runs. CI can pass env vars through reusable workflows.

### 5. Use `openclaw/crabline` for deterministic channel behavior

The Crabline work in this RFC refers to the `openclaw/crabline` messaging SDK. It should provide deterministic local upstream shims for channel behavior so OpenClaw can test Telegram, Discord, Slack, WhatsApp, and similar transports without real service credentials in normal CI.

Add a channel conformance runner with this shape:

```text
qa suite --channel-driver crabline --runner host --transport telegram --profile smoke-ci --output-dir .artifacts/qa-e2e/smoke-ci-crabline-telegram
  uses a deterministic provider fixture so channel failures are not mixed with live model-provider failures
  starts the selected channel's local Crabline upstream shim
  starts OpenClaw Gateway with selected channel plugin enabled
  injects inbound DM/group/thread/media/action events
  waits for Gateway/agent/channel reply
  asserts outbound adapter payload and user-visible transcript
  writes scenario entries into the summary artifact
```

First-wave mock channel adapters:

- Telegram: DM, group mention, forum topic/thread, inline button approval, media/location input, reconnect.
- Discord: DM, guild channel mention, thread, slash/native command callback, media, reaction/action.
- Slack: DM, channel thread, Socket Mode event, slash command, button approval, file attachment.
- WhatsApp: DM, group activation, media/voice, native reaction/approval, reconnect.

Second-wave adapters:

- iMessage, Matrix, Google Chat, Microsoft Teams, Signal.
- Mattermost, LINE, IRC, Nextcloud Talk, Nostr, Twitch, Tlon, Synology Chat.
- Regional channels after their setup and credential constraints are documented.

Use Kova's channel capability vocabulary as an input, not a second harness: durable final text/media/payload, reply-to/thread behavior, ack after dispatch, native platform actions, retries, source-visible delivery, and no self-trigger. Turn the useful capabilities into OpenClaw QA coverage IDs and channel mock driver assertions.

### 6. Keep hard-coded tests and YAML scenarios

Use hard-coded Vitest e2e when the invariant is low-level, fast, and closer to an API contract than to a user journey. Examples:

- Gateway protocol and WebSocket handshake behavior
- session history ordering and idempotency
- provider response normalization
- plugin loader failure handling
- security gates and SSRF boundaries
- deterministic TUI rendering primitives

Use YAML-driven QA Lab scenarios when the behavior is a product workflow:

- "user sends message, agent replies visibly in same channel"
- "group mention does not leak to unrelated room"
- "approval button resolves one pending tool call"
- "provider timeout recovers with visible failure"
- "cron reminder arrives once"
- "media input is staged, summarized, and reply media is sent"

The existing `qa/scenarios/channels/group-visible-reply-tool.md` is the right shape: it has coverage IDs, docs/code refs, a config patch, and a flow that asserts both mock-provider tool planning and visible outbound transcript state. The plan is to expand that pattern across scorecard surfaces and let the wrapper choose mock, live, host, Docker, Crabbox, or `openclaw/crabline` channel-driver paths.

### 7. Turn plugin contract coverage into user-flow coverage

Bring plugin-inspector-style checks into OpenClaw for built-in and bundled plugin confidence. Keep them labeled as contract evidence. They are useful, but they are not the same as a user workflow.

For each built-in plugin:

1. Keep static manifest/SDK/import/contract checks.
2. Add a Kitchen Sink or plugin-specific deterministic runtime smoke when the plugin exposes a provider/tool/channel/service surface.
3. Add at least one QA Lab user-flow scenario for the product behavior that depends on the plugin, such as a channel message, provider turn, media tool, telemetry export, or service lifecycle.
4. Emit one summary entry for the contract check and one for the user-flow check so scorecard Coverage can distinguish them.

External plugin ecosystem coverage stays in Crabpot. OpenClaw release CI can consume Crabpot's summary as an advisory compatibility signal. Core OpenClaw CI avoids cloning or downloading broad external plugin corpora.

### 8. Normalize performance evidence

Reuse the timing approaches from Kova and openclaw-rtt without moving their data ledgers into core.

Bring into `openclaw/openclaw`:

- a normalized RTT/evidence schema for QA Lab and e2e summaries
- per-sample attempt counts and resource metrics when a lane already measures them
- direct Gateway RPC and Control UI timing measurement helpers when they prove release regressions
- p50/p95 aggregation for repeated release checks

Keep separate:

- `openclaw-rtt` dashboard data and historical result rows
- `openclaw/releases` release evidence ledger
- Kova's broader OCM-controlled lab reports unless a scenario is promoted into the core OpenClaw suite

### 9. Script disposition plan

`test/scripts` currently contains 262 script tests. Most stay where they are: they protect scripts, release tooling, package checks, and CI plumbing. A smaller set can move when the replacement has a clearer home and emits the same or stronger evidence.

Use this rule for each file:

- If the test proves a user journey, make it a QA Lab or e2e scenario.
- If it proves a helper, runner, planner, or report contract, move it beside that code as an integration test.
- If it proves release machinery, keep it as a script test unless the release lane itself starts emitting equivalent scenario evidence.
- If it has no explicit package-script reference, do not treat that as removal proof; Vitest discovers `*.test.ts` files.

The initial file-level inventory lives in [0007/script-test-inventory.md](0007/script-test-inventory.md). Keep that list as migration input, not as the RFC contract. The contract is the rule above: move tests only when the new home preserves or improves the old failure signal, and remove old script tests only after the replacement emits equivalent summary evidence.

Pick the first conversion batch by readiness and coverage gap. A useful batch should cover different risk shapes: one Gateway/runtime smoke, one telemetry path, one package or release path, one provider or tool path, and one messaging channel.

### 10. Pull from other repos

| Repo | Decision |
| --- | --- |
| `openclaw/kova` | Pull concepts, not the whole harness. Bring release-shaped scenario hierarchy, mock/live auth policy, process role attribution, repeated-sample p50/p95 gates, and channel capability proof vocabulary into OpenClaw e2e planning. Keep Kova as the OCM-backed runtime validation lab and broader report system. |
| `openclaw/plugin-inspector` | Pull built-in plugin inspection concepts into OpenClaw CI: static manifest/SDK/import checks, runtime capture with mocked SDK, synthetic probes, and stable finding codes. Keep the publishable package separate for external plugin authors and Crabpot. |
| `openclaw/openclaw-rtt` | Keep as data/dashboard repo. Pull only normalized timing schema and importer expectations into OpenClaw QA summaries. New channel timing sources should originate in OpenClaw and then be imported into `openclaw-rtt`. |
| `openclaw/crabbox` | No consolidation. Use it as a runner substrate for remote, cross-OS, niche, heavy, and visual proof lanes. |
| `openclaw/crabpot` | Keep separate. It pins many external plugins and consumes plugin-inspector reports. Pull only fixture categorization, contract probe backlog ideas, and summary shape for optional release advisory gates. |
| `openclaw/kitchen-sink` | Keep separate as a published example and fixture plugin. Use it in OpenClaw e2e as the canonical credential-free external plugin for conformance, adversarial, and live-provider-routing scenarios. |
| `openclaw/releases` | Keep separate. Release CI should publish normalized evidence as workflow artifacts first, then mirror or import the same summaries into `openclaw/releases` once the artifact shape settles. |

### 11. Implementation plan

The dependency-oriented PR plan lives in [0007/implementation-plan.md](0007/implementation-plan.md). It splits work into PRs that can start independently and PRs that should stack on earlier schema, runner, or release-artifact work. It also calls out cross-repo work in `openclaw/kova`, `openclaw/openclaw-rtt`, `openclaw/crabpot`, and `openclaw/releases`.

## Rationale

This keeps the repo boundaries straightforward:

- Core product behavior and executable test harnesses stay in `openclaw/openclaw`.
- Scorecard policy, executable taxonomy, maturity test docs, and CI-owned requirement metadata live in `openclaw/openclaw`.
- The design decision stays in `openclaw/rfcs`.
- Timing history and dashboards stay in `openclaw/openclaw-rtt`.
- Durable release evidence can stay in `openclaw/releases` after CI artifacts establish the schema.
- Broad external plugin compatibility stays in `openclaw/crabpot`.
- Remote execution capacity stays in `openclaw/crabbox`.

Normal CI stays affordable. Mock services and `openclaw/crabline` channel shims catch many regressions without credentials. Live release lanes still cover upstream API and real-account behavior before users get a release.

Without this consolidation, the likely path is more isolated Docker scripts, live workflows, and script tests. Those checks can be useful, but the maturity scorecard still has to infer whether the product surface was actually covered.

The machine-readable summaries are necessary for CI, but they should not become the only maintainer interface. A fast-follow report should start from scorecard categories, show blocking/missing/stale/advisory status, link to artifacts and rerun commands, and keep raw scenario rows behind the main view. Otherwise the system risks producing large reports that technically contain the answer but are hard to review.

## Unresolved questions

None at the moment.
