# Implementation Plan

This sidecar is the implementation work plan for the RFC. It is organized by dependency shape, not PR number. The point is to make it clear what can start immediately, what should stack on earlier schema or runner work, and which repos need follow-up work.

## Initial or Independent PR Candidates

These can start before the full scorecard gate exists. Some benefit from coordination, but they do not need to wait for the final release-gating path.

### Evidence schema and coverage inventory

- Repo: `openclaw/openclaw`
- Depends on: none
- Work:
  - Extend `qa-suite-summary.json` with scorecard surface/category IDs, tier, provider ID, model live mode, provider fixture, channel ID, channel live mode, surface ID, runner, package source, artifact paths, failure class, and timing fields.
  - Extend `openclaw qa coverage` to report coverage IDs, source paths, runtime parity tier, docs refs, code refs, and declared maturity categories.
- Result: existing QA runs produce richer summary entries without changing release policy yet.

### Initial scorecard taxonomy fixture

- Repo: `openclaw/openclaw`
- Depends on: none
- Work:
  - Add the first machine-readable taxonomy fixture using the shape in `example-scorecard-checklist.md`.
  - Map current `qa/scenarios/**` coverage IDs to category IDs.
  - Mark release-blocking categories separately from advisory categories.
- Result: CI and reports have a checked-in taxonomy to read.

### Maturity test docs in OpenClaw

- Repo: `openclaw/openclaw`
- Depends on: initial taxonomy fixture helps, but docs can start first
- Work:
  - Move or recreate the maturity test docs in OpenClaw, near the taxonomy and QA docs.
  - Document what each requirement means, why it blocks or does not block release, what code paths it covers, and how to rerun or troubleshoot the proof.
  - Treat `openclaw/maintainers` as the policy/process home, not the only place where executable maturity requirements are explained.
  - Coordinate with `@kevinlin-openai`, who owns the authoritative requirement-to-test mapping.
- Result: OpenClaw contains the docs needed to understand and maintain its own release-blocking test requirements.

### Harness-neutral QA wrapper

- Repo: `openclaw/openclaw`
- Depends on: evidence schema and initial taxonomy fixture are useful, but the first wrapper can start with a small mapping table
- Work:
  - Add a wrapper command such as `pnpm openclaw qa run --surface <surface> --category <category>`.
  - Dispatch by mapping rather than by caller knowledge of the harness. A category can route to Vitest e2e, QA Lab scenarios, live transport lanes, Matrix, Docker/package lanes, Multipass, Control UI, TUI, or release helper scripts.
  - Write the same summary artifacts as direct harness runs.
  - Fail with a clear missing-mapping error when a requested surface/category has no runnable lane.
- Result: CI and maintainers can ask for evidence by product/maturity concept without knowing which test harness currently owns that proof.

### Core QA Lab tier

- Repo: `openclaw/openclaw`
- Depends on: useful after the evidence schema, but the first cut can start before it
- Work:
  - Add `qa suite --tier core` or an equivalent selector over deterministic scenarios.
  - Include Gateway, `qa-channel`, provider/tool, memory/session, automation, plugin, telemetry, and Control UI coverage.
  - Wire a normal-CI command only after the lane is reliable enough not to create broad flake noise.
- Result: a credential-free core QA Lab lane with deterministic provider fixtures.

### Multipass mock-channel runner foundation

- Repo: `openclaw/openclaw`
- Depends on: none
- Work:
  - Add per-channel mock upstream driver selection by channel ID.
  - Start with one channel per run rather than an opaque `all-mock-channels` mode.
  - Use deterministic provider fixtures so failures isolate channel, Gateway, packaging, process, network, and Linux runtime behavior.
  - Wire the first stable channel path into normal PR CI as soon as it is deterministic, even if initial coverage is thin.
- Result: a Multipass lane that can prove a single messaging channel with local upstream shims on every PR.

### Multipass coverage expansion

- Repo: `openclaw/openclaw`
- Depends on: Multipass mock-channel runner foundation
- Work:
  - Expand from the first Telegram/Discord paths to Slack and WhatsApp.
  - Add richer scenario coverage per channel: DM, group or guild mention, thread/topic, media metadata, reconnect, native approval/action, and outbound transcript assertions.
  - Add a coverage matrix so missing channel capabilities are visible instead of hidden behind a green smoke.
- Result: Multipass becomes an actual channel maturity lane, not just a runner smoke.

### Live transport summary normalization

- Repo: `openclaw/openclaw`
- Depends on: evidence schema
- Work:
  - Normalize Telegram, Discord, Slack, WhatsApp, and Matrix live summary entries to the same scorecard evidence schema as the mock transport lane.
  - Preserve credential leasing and redaction rules.
- Result: live transport artifacts can be consumed by the same scorecard report as mock lanes.

### Script migration and cleanup slices

- Repo: `openclaw/openclaw`
- Depends on: none, though the evidence schema helps when replacing e2e-like scripts
- Work:
  - Migrate or clean up scripts one file at a time or in small batches when the new home is obvious.
  - Move user-flow scripts to QA Lab or e2e scenarios.
  - Move helper, runner, planner, and report tests beside their code.
  - Keep package, release, CI, and tooling scripts under `test/scripts` unless the script itself moves.
  - Remove an old script test only after the replacement preserves the old failure signal and emits equivalent evidence when relevant.
- Result: incremental cleanup without a giant migration PR.

### Built-in plugin inspection checks

- Repo: `openclaw/openclaw`
- Depends on: none
- Work:
  - Bring plugin-inspector-style static checks into OpenClaw for bundled plugins.
  - Cover manifest, SDK imports, public barrels, runtime capture where useful, and stable finding codes.
  - Keep this labeled as contract evidence.
- Result: bundled plugin contract confidence in core CI.

### Built-in plugin user-flow scenarios

- Repo: `openclaw/openclaw`
- Depends on: core QA Lab tier helps
- Work:
  - Add user-flow scenarios for plugin families users experience directly: provider, tool, channel, diagnostics, service, media, memory, and web.
  - Add Kitchen Sink conformance install/run as a credential-free external plugin fixture.
- Result: scorecard reporting can distinguish plugin contract evidence from user-flow evidence.

### Kova scenario vocabulary extraction

- Repos: `openclaw/kova`, `openclaw/openclaw`
- Depends on: none
- Work:
  - In Kova, document or export the scenario concepts that OpenClaw should consume: release-shaped scenario hierarchy, process role attribution, repeated-sample p50/p95 gates, and channel capability vocabulary.
  - In OpenClaw, import the vocabulary as coverage IDs and planning terms, not as a second harness.
- Result: OpenClaw gets reusable concepts without moving the Kova harness.

### openclaw-rtt importer shape check

- Repos: `openclaw/openclaw-rtt`, `openclaw/openclaw`
- Depends on: evidence schema
- Work:
  - Update or document the RTT importer expectations for normalized QA summary timing fields.
  - In OpenClaw, make new channel timing sources originate in QA summaries before import.
- Result: timing history can consume new evidence without owning OpenClaw runtime lanes.

### Crabpot advisory summary shape

- Repos: `openclaw/crabpot`, `openclaw/openclaw`
- Depends on: built-in plugin inspection checks are useful but not required
- Work:
  - Define the advisory external-plugin compatibility summary shape that release CI can optionally consume.
  - Keep broad fixture corpus ownership in Crabpot.
- Result: external plugin compatibility remains advisory and separate from core release blockers unless explicitly promoted.

## Stacked PR Candidates

These should wait for one or more initial pieces. Landing them too early would hard-code temporary shapes or produce reports that no lane can satisfy.

### Scorecard gap report

- Repo: `openclaw/openclaw`
- Stacks on: evidence schema, initial taxonomy fixture, maturity test docs
- Work:
  - Add a report command that joins summary artifacts to the taxonomy.
  - Print pass, fail, missing, and advisory rows.
  - Detect stale evidence by target ref, release package, live proof requirement, and freshness rule.
- Result: maintainers can see exactly which scorecard items have no fresh evidence.

### Release scorecard artifact

- Repo: `openclaw/openclaw`
- Stacks on: scorecard gap report, live transport summary normalization
- Work:
  - Add release workflow steps that upload normalized summaries, a scorecard report, an artifact manifest, known proof gaps, and redacted failure classifications.
  - Keep raw logs, prompts, transcripts, and credentials out of release artifacts.
- Result: release CI publishes reviewable evidence before any releases-repo handoff.

### Release-blocking scorecard gate

- Repo: `openclaw/openclaw`
- Stacks on: release scorecard artifact
- Work:
  - Make release CI fail when a release-blocking scorecard category has no fresh passing evidence for the target ref/package.
  - Keep advisory rows outside the blocking scorecard until they are intentionally promoted.
- Result: Stable/LTS release gates become enforceable.

### Waiver classification and release-owner override

- Repo: `openclaw/openclaw`
- Stacks on: release-blocking scorecard gate
- Work:
  - Add failure classification for likely upstream provider or messaging-service outages.
  - Require a maintainer or release-owner waiver record before promotion when a blocking live lane fails for likely upstream reasons.
- Result: live upstream outages fail loudly but have an explicit human-controlled release path.

### releases ledger handoff

- Repos: `openclaw/releases`, `openclaw/openclaw`
- Stacks on: release scorecard artifact exercised in normal releases
- Work:
  - Import or mirror release scorecard summaries from CI artifacts into `openclaw/releases` after the schema has survived real release validation.
  - Avoid raw secrets and raw transcripts.
- Result: durable release evidence ledger without making `openclaw/releases` define the CI taxonomy.

### Performance and RTT release convergence

- Repos: `openclaw/openclaw`, `openclaw/openclaw-rtt`
- Stacks on: evidence schema, openclaw-rtt importer shape check
- Work:
  - Add repeated-sample aggregation to selected QA Lab lanes.
  - Add direct Gateway RPC timing where it proves release behavior.
  - Add Control UI timing where useful.
  - Emit importable channel RTT summaries.
- Result: performance evidence becomes part of release confidence instead of a separate ad hoc dashboard.

### Full Stable/LTS category closure

- Repo: `openclaw/openclaw`
- Stacks on: scorecard gap report, harness-neutral QA wrapper, core tier, Multipass expansion, live transport normalization, plugin scenarios, release artifacts
- Work:
  - Iterate through missing scorecard categories until every release-blocking category has at least one fresh executable evidence path.
  - Add a troubleshooting or rerun path for every release-blocking category.
  - Use `@kevinlin-openai`'s requirement-to-test mapping as the source of truth when deciding whether a category is actually covered.
  - Land this as focused PRs, not one giant closure PR.
- Result: the example checklist shape becomes a real, enforced OpenClaw taxonomy.

## Cross-Repo Coordination Notes

- `openclaw/openclaw` owns executable taxonomy, QA summaries, CI gates, and release workflow artifact generation.
- `openclaw/rfcs` owns the accepted design and sidecar examples only.
- `openclaw/maintainers` can keep scorecard policy and human-facing process notes, but CI must not depend on generated maintainer reports as its source of truth.
- `@kevinlin-openai` owns the authoritative mapping from maturity requirements to executable tests. The example mapping in this RFC is only a scaffold for shape and review.
- `openclaw/kova` keeps the broader OCM-backed validation lab. Only vocabulary, scenario shape, and aggregation ideas should move into OpenClaw.
- `openclaw/openclaw-rtt` keeps timing history and dashboards. OpenClaw should emit normalized timing evidence that openclaw-rtt imports.
- `openclaw/crabpot` keeps the broad external plugin corpus. OpenClaw consumes its summary as advisory unless a release explicitly promotes that compatibility set to blocking.
- `openclaw/crabbox` remains runner capacity. It should not own the scorecard taxonomy.
- `openclaw/releases` receives durable release evidence after the CI artifact shape has proven stable.
