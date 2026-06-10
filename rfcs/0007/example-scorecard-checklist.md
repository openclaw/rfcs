# Example Stable/LTS Scorecard Checklist

This is a complete example, not the final OpenClaw Stable/LTS taxonomy. OpenClaw now has the maturity taxonomy snapshot in `taxonomy.yaml`, the executable overlay in `taxonomy-mappings.yaml`, and the score snapshot in `docs/maturity-scores.yaml`; this example shows the RFC 0007 mapping shape on top of that data. Every checklist row has a category ID, a blocking rule, evidence requirements, and at least one example mapping to executable evidence. The real mapping can rename categories, split rows, or add surfaces. Whatever the final mapping contains, it should preserve the same property: no release-blocking checklist item exists without a machine-readable evidence mapping.

## Example checklist

| ID | Surface | Category | Stable/LTS requirement | Blocks release | Evidence required |
| --- | --- | --- | --- | --- | --- |
| runtime.gateway.startup | Runtime and Gateway | Startup and protocol readiness | Gateway starts from source and package builds, exposes protocol endpoints, authenticates clients, and rejects bad handshakes predictably. | yes | Passing host e2e and package/Docker e2e on target ref. |
| runtime.gateway.restart | Runtime and Gateway | Restart and in-flight recovery | Gateway restart preserves or safely terminates active runs with visible terminal state and no duplicate final reply. | yes | Host e2e plus Docker/package restart lane. |
| runtime.agent.turns | Runtime and Gateway | Agent turn lifecycle | A normal user turn streams, calls tools when needed, finishes once, and records the final transcript. | yes | Core QA Lab scenario plus runtime e2e shard. |
| runtime.context.compaction | Runtime and Gateway | Context and compaction recovery | Long sessions compact or recover without replaying unsafe mutating work. | yes | QA Lab long-context scenario plus focused runtime e2e. |
| runtime.tools.core | Tools | Core tool execution | File, shell, patch, search, and session tools execute through the production tool path with correct result rendering. | yes | QA Lab tool scenarios plus host e2e shard. |
| runtime.tools.approval | Tools | Approval and denial flows | Approval prompts, denial, retry, and terminal stop paths work through portable actions. | yes | QA Lab approval scenario plus channel action scenario. |
| runtime.observability.trace | Observability | Trace and run diagnostics | User-visible runs emit trace/run diagnostics with enough IDs to debug release failures without leaking secrets. | yes | QA Lab telemetry scenario plus OTEL smoke. |
| runtime.performance.budget | Observability | Startup and request latency | Gateway startup, core turn RTT, and channel reply RTT stay inside release budget or produce an explicit waiver. | yes | Repeated RTT lane plus startup benchmark summary. |
| providers.openai | Model providers | OpenAI provider path | OpenAI auth, catalog, streaming, tool calls, web search, media-adjacent calls, and error handling work with live credentials. | yes | Live provider lane and provider/tool e2e. |
| providers.anthropic | Model providers | Anthropic provider path | Anthropic auth, catalog, streaming, tool calls, long-context behavior, and error handling work with live credentials. | yes | Live provider lane and runtime parity scenario. |
| providers.google | Model providers | Google provider path | Google auth, catalog, text turn, tool behavior where supported, and error handling work with live credentials. | yes | Live provider lane. |
| providers.openrouter | Model providers | OpenRouter provider path | OpenRouter routing, model selection, tool support detection, and error handling work with live credentials. | yes | Live provider lane. |
| providers.local | Model providers | Local provider path | Local provider setup, catalog, text turn, and failure diagnostics work without cloud credentials. | yes | Host e2e or Docker local-provider lane. |
| channels.qa | Channels | Synthetic QA channel | The synthetic channel still covers portable channel contract behavior used by normal PR CI. | yes | Core QA Lab `qa-channel` lane. |
| channels.telegram.mock | Channels | Telegram deterministic channel proof | Telegram adapter handles DM, group mention, thread/topic, approval button, media metadata, reconnect, and outbound transcript with local upstream shims. | yes | `openclaw/crabline` SDK-backed mock-channel lane. |
| channels.telegram.live | Channels | Telegram live upstream proof | Telegram bot and user-driver flows work against live Telegram for every release that claims Telegram support. | yes | Live Telegram lane. |
| channels.discord.mock | Channels | Discord deterministic channel proof | Discord adapter handles DM, guild mention, thread, native callback, reaction/action, media metadata, and outbound transcript with local upstream shims. | yes | `openclaw/crabline` SDK-backed mock-channel lane. |
| channels.discord.live | Channels | Discord live upstream proof | Discord canary works against live Discord for every release that claims Discord support. | yes | Live Discord lane. |
| channels.slack.mock | Channels | Slack deterministic channel proof | Slack adapter handles DM, channel thread, Socket Mode event, slash command, button approval, file attachment, and outbound transcript with local upstream shims. | yes | `openclaw/crabline` SDK-backed mock-channel lane. |
| channels.slack.live | Channels | Slack live upstream proof | Slack canary works against live Slack for every release that claims Slack support. | yes | Live Slack lane. |
| channels.whatsapp.mock | Channels | WhatsApp deterministic channel proof | WhatsApp adapter handles DM, group activation, media/voice metadata, native reaction/approval, reconnect, and outbound transcript with local upstream shims. | yes | `openclaw/crabline` SDK-backed mock-channel lane. |
| channels.whatsapp.live | Channels | WhatsApp live upstream proof | WhatsApp canary works against live WhatsApp for every release that claims WhatsApp support. | yes | Live WhatsApp lane. |
| channels.matrix.live | Channels | Matrix live release lane | Matrix transport, media, and E2EE lanes pass against the disposable Matrix release runner. | yes | Matrix QA release lane. |
| memory.recall | Memory and sessions | Memory recall | User preference and session memory recall work through normal conversation flow and do not cross thread/channel boundaries. | yes | QA Lab memory scenarios. |
| memory.failure | Memory and sessions | Memory failure behavior | Memory store failure produces visible fallback behavior without losing the active turn. | yes | QA Lab memory failure scenario. |
| sessions.persistence | Memory and sessions | Session persistence | Session identity, transcript ordering, and resume state survive restart and package lanes. | yes | Runtime e2e plus package restart lane. |
| automation.cron | Automation | Cron lifecycle | Natural-language cron creation, due-run execution, duplicate prevention, delivery, and run history work end to end. | yes | QA Lab scheduling scenarios. |
| automation.reminders | Automation | Reminders and commitments | Reminder or commitment flows create the right scheduled work and deliver once to the expected target. | yes | QA Lab personal reminder and heartbeat scenarios. |
| automation.webhooks | Automation | Webhook and hook ingress | HTTP/plugin hook ingress validates auth, size, idempotency, routing, and visible run dispatch. | yes | Hook integration plus QA Lab hook scenario. |
| plugins.manifest | Plugins | Manifest and SDK contract | Bundled plugin manifests, SDK imports, public barrels, and static contracts pass without core-boundary leaks. | yes | Plugin inspection summary. |
| plugins.runtime | Plugins | Runtime plugin behavior | Built-in provider/tool/channel/service plugins have at least one user-flow scenario for the behavior users depend on. | yes | QA Lab plugin scenarios plus Kitchen Sink conformance. |
| plugins.external.compat | Plugins | External plugin compatibility | External plugin corpus remains advisory unless the release explicitly claims ecosystem compatibility for that package set. | no | Crabpot/plugin-inspector advisory summary. |
| media.input | Media | Media input understanding | Image/audio/file input is staged, summarized, redacted where needed, and usable in a normal agent turn. | yes | QA Lab media scenarios plus live media lane. |
| media.output | Media | Media generation output | Image/TTS/media output reaches the requested channel or artifact path with usable metadata. | yes | QA Lab media generation scenario plus channel media lane. |
| ui.control | UI and CLI | Control UI workflow | Control UI can start, observe, and recover Gateway-backed runs with browser proof on supported viewports. | yes | Control UI e2e shard. |
| ui.tui | UI and CLI | TUI workflow | TUI fake-backend PTY and local-backend smoke cover rendering, input, streaming, and terminal state. | yes | TUI PTY lane plus local-backend smoke where stable. |
| cli.commands | UI and CLI | CLI setup and command surface | `openclaw` setup, qa, doctor, version, and package commands work from source and package installs. | yes | CLI/package e2e lane. |
| install.npm | Install and upgrade | npm install and update | Fresh npm install, update, and package candidate resolution work on supported Node versions. | yes | Package acceptance workflow. |
| install.docker | Install and upgrade | Docker package workflow | Docker build, install, gateway startup, plugin lifecycle, and release-user journey work from the package artifact. | yes | Docker e2e lane. |
| install.desktop | Install and upgrade | Desktop and OS-specific packaging | macOS, Windows/WSL2, and Linux package smoke lanes pass for platforms claimed by the release. | yes | Parallels/Testbox/Crabbox platform lanes. |
| upgrade.config | Install and upgrade | Upgrade and config migration | Existing supported config/state upgrades through `doctor --fix` or package update without runtime fallback shims. | yes | Upgrade survivor and doctor migration lanes. |
| security.secrets | Security | Secret redaction | Logs, traces, summaries, transcripts, diagnostics, and PR artifacts do not leak credentials. | yes | QA Lab redaction scenario plus secret scanning gate. |
| security.network | Security | Network and SSRF boundaries | Gateway, media, webhook, and tool paths enforce network policy and unsafe source rejection. | yes | Security e2e/integration shard. |
| security.permissions | Security | Approval and permission boundaries | Tool approval, trusted tools, plugin hooks, and channel callback actions stay distinguishable before transport encoding. | yes | QA Lab approval and plugin hook scenarios. |
| docs.troubleshooting | Docs and operations | Troubleshooting path | Every release-blocking surface has a public or maintainer troubleshooting path that explains likely failures and rerun commands. | yes | Docs check plus release checklist summary. |
| release.artifacts | Release operations | Evidence artifact publication | Release CI publishes normalized summaries, scorecard report, artifact manifest, and known proof gaps without raw secrets. | yes | Release workflow artifact step. |
| release.waivers | Release operations | Waiver handling | Upstream-provider outages fail loudly, classify likely upstream cause, and require human maintainer or release-owner waiver. | yes | Release scorecard gate. |

## Example mapping

`Required profiles` uses only the initial `smoke-ci` and `release` profiles. `none` means the row is advisory evidence outside the blocking profile set unless maintainers later promote it.

| Checklist ID | Coverage IDs | Example scenarios or lanes | Required profiles | Required live proof | Freshness rule |
| --- | --- | --- | --- | --- | --- |
| runtime.gateway.startup | `runtime.gateway.startup`, `runtime.protocol.auth` | `pnpm test:e2e` Gateway shard; Docker gateway smoke; package acceptance workflow | smoke-ci, release | package lane for release | target ref and release package |
| runtime.gateway.restart | `runtime.gateway.restart`, `runtime.run.recovery` | `qa/scenarios/jsonl-replay/gateway-restart-recovery.jsonl`; `qa/scenarios/runtime/gateway-restart-inflight-run.md` | smoke-ci, release | package lane for release | target ref and release package |
| runtime.agent.turns | `runtime.agent.turn`, `runtime.streaming.final` | `qa/scenarios/channels/dm-chat-baseline.md`; `qa/scenarios/runtime/streaming-final-integrity.md` | smoke-ci | no | target ref |
| runtime.context.compaction | `runtime.context.compaction`, `runtime.replay.safe` | `qa/scenarios/runtime/compaction-retry-mutating-tool.md`; `qa/scenarios/runtime/long-context-progress-watchdog.md` | smoke-ci, release | no | target ref |
| runtime.tools.core | `runtime.tools.core`, `runtime.tools.files`, `runtime.tools.exec` | `qa/scenarios/runtime/tools/fs-read.md`; `qa/scenarios/runtime/tools/fs-write.md`; `qa/scenarios/runtime/tools/exec.md`; `qa/scenarios/runtime/tools/apply-patch.md` | smoke-ci | no | target ref |
| runtime.tools.approval | `runtime.tools.approval`, `runtime.actions.approval` | `qa/scenarios/runtime/approval-turn-tool-followthrough.md`; `qa/scenarios/personal/approval-denial-stop.md` | smoke-ci, release | live channel action for channel claims | target ref and release package |
| runtime.observability.trace | `runtime.observability.otel`, `runtime.trace.visibility` | `qa/scenarios/runtime/otel-trace-smoke.md`; `qa/scenarios/runtime/qa-bus-tool-trace-visibility.md` | smoke-ci, release | no | target ref |
| runtime.performance.budget | `runtime.performance.rtt`, `runtime.performance.startup` | RTT harness summary; CLI/Gateway startup benchmark summary | release | live channel RTT for channel claims | release candidate |
| providers.openai | `providers.openai.live`, `providers.openai.tools`, `providers.openai.web_search` | `qa/scenarios/models/openai-native-web-search-live.md`; OpenAI tools client e2e | release | yes | release candidate |
| providers.anthropic | `providers.anthropic.live`, `providers.anthropic.long_context` | `qa/scenarios/models/anthropic-opus-api-key-smoke.md`; `qa/scenarios/models/anthropic-opus-setup-token-smoke.md` | release | yes | release candidate |
| providers.google | `providers.google.live` | Live provider shard for Google | release | yes | release candidate |
| providers.openrouter | `providers.openrouter.live`, `providers.routing.catalog` | Live provider shard for OpenRouter | release | yes | release candidate |
| providers.local | `providers.local.live`, `providers.local.diagnostics` | Local-provider Docker or host e2e lane | release | local runtime, no cloud | target ref and release package |
| channels.qa | `channels.qa.baseline`, `channels.portable.contract` | `qa/scenarios/channels/channel-chat-baseline.md`; `qa/scenarios/channels/dm-chat-baseline.md` | smoke-ci | no | target ref |
| channels.telegram.mock | `channels.telegram.mock`, `channels.actions.approval`, `channels.media.metadata` | `openclaw/crabline` Telegram mock upstream lane | smoke-ci | no | target ref |
| channels.telegram.live | `channels.telegram.live`, `channels.telegram.user_driver` | Telegram live QA lane; Telegram user-driver Crabbox proof | release | yes | release candidate |
| channels.discord.mock | `channels.discord.mock`, `channels.threading`, `channels.actions.native` | `openclaw/crabline` Discord mock upstream lane | smoke-ci | no | target ref |
| channels.discord.live | `channels.discord.live` | Discord live QA lane | release | yes | release candidate |
| channels.slack.mock | `channels.slack.mock`, `channels.threading`, `channels.file_attachment` | `openclaw/crabline` Slack mock upstream lane | smoke-ci | no | target ref |
| channels.slack.live | `channels.slack.live` | Slack live QA lane | release | yes | release candidate |
| channels.whatsapp.mock | `channels.whatsapp.mock`, `channels.media.voice`, `channels.reconnect` | `openclaw/crabline` WhatsApp mock upstream lane | smoke-ci | no | target ref |
| channels.whatsapp.live | `channels.whatsapp.live` | WhatsApp live QA lane | release | yes | release candidate |
| channels.matrix.live | `channels.matrix.live`, `channels.matrix.e2ee`, `channels.matrix.media` | Matrix QA transport/media/E2EE release lane | release | yes | release candidate |
| memory.recall | `memory.recall`, `memory.thread_isolation` | `qa/scenarios/memory/memory-recall.md`; `qa/scenarios/memory/thread-memory-isolation.md`; `qa/scenarios/personal/memory-preference-recall.md` | smoke-ci | no | target ref |
| memory.failure | `memory.failure.fallback` | `qa/scenarios/memory/memory-failure-fallback.md` | smoke-ci | no | target ref |
| sessions.persistence | `sessions.persistence`, `sessions.resume` | `qa/scenarios/jsonl-replay/recovery-partial-session.jsonl`; runtime e2e shard | smoke-ci, release | package lane for release | target ref and release package |
| automation.cron | `automation.cron.lifecycle`, `automation.cron.dedupe` | `qa/scenarios/scheduling/cron-natural-fire-no-duplicate.md`; `qa/scenarios/scheduling/cron-single-run-no-duplicate.md`; `qa/scenarios/scheduling/cron-one-minute-ping.md` | smoke-ci, release | live delivery for claimed live channels | target ref and release package |
| automation.reminders | `automation.reminders`, `automation.heartbeat` | `qa/scenarios/personal/reminder-roundtrip.md`; `qa/scenarios/memory/commitments-heartbeat-target-none.md` | smoke-ci | no | target ref |
| automation.webhooks | `automation.webhooks.ingress`, `automation.hooks.dispatch` | Hook integration shard; future QA Lab webhook scenario | release | live tunnel only if release claims hosted ingress | release candidate |
| plugins.manifest | `plugins.manifest.contract`, `plugins.sdk.boundary` | Plugin inspection summary; plugin contract integration tests | smoke-ci | no | target ref |
| plugins.runtime | `plugins.runtime.user_flow`, `plugins.kitchen_sink.conformance` | `qa/scenarios/plugins/kitchen-sink-live-openai.md`; `qa/scenarios/plugins/mcp-plugin-tools-call.md`; `qa/scenarios/plugins/plugin-manifest-contract-health.md` | smoke-ci, release | live provider only for provider plugin claims | target ref and release package |
| plugins.external.compat | `plugins.external.compat.advisory` | Crabpot/plugin-inspector advisory summary | none | no | latest advisory run |
| media.input | `media.input.image`, `media.input.attachment` | `qa/scenarios/media/image-understanding-attachment.md`; live media shard | smoke-ci, release | live provider for release | release candidate |
| media.output | `media.output.image`, `media.output.tts` | `qa/scenarios/media/image-generation-roundtrip.md`; `qa/scenarios/media/native-image-generation.md`; `qa/scenarios/runtime/tools/tts.md` | release | live provider/channel where claimed | release candidate |
| ui.control | `ui.control.gateway`, `ui.control.browser` | Control UI e2e shard; mobile viewport browser run | smoke-ci, release | no | target ref |
| ui.tui | `ui.tui.pty`, `ui.tui.local_backend` | TUI fake-backend PTY lane; local-backend smoke where stable | smoke-ci, release | no | target ref |
| cli.commands | `cli.commands.package`, `cli.doctor`, `cli.qa` | Package acceptance workflow; CLI startup and doctor smoke | smoke-ci, release | no | target ref and release package |
| install.npm | `install.npm.fresh`, `install.npm.update` | Package acceptance workflow; npm update smoke | release | package registry or release artifact | release candidate |
| install.docker | `install.docker.package`, `install.docker.gateway` | Docker e2e lane; Docker package gateway smoke | release | package artifact | release candidate |
| install.desktop | `install.desktop.macos`, `install.desktop.windows`, `install.desktop.linux` | Parallels macOS/Windows/Linux smoke; Crabbox/Testbox platform lanes | release | platform lane | release candidate |
| upgrade.config | `upgrade.config.doctor`, `upgrade.state.migration` | `qa/scenarios/config/config-apply-restart-wakeup.md`; `qa/scenarios/runtime/auth-profile-doctor-migration-safety.md`; upgrade survivor lane | release | package upgrade lane | release candidate |
| security.secrets | `security.secrets.redaction`, `security.artifacts.redaction` | `qa/scenarios/security/secret-redaction-tool-logs.md`; `qa/scenarios/personal/redaction-no-secret-leak.md`; secret scanning gate | smoke-ci, release | no | target ref and release package |
| security.network | `security.network.boundaries`, `security.media.ssrfsafe` | Security e2e/integration shard; media unsafe-source checks | smoke-ci, release | no | target ref |
| security.permissions | `security.permissions.actions`, `security.plugin_hooks.policy` | `qa/scenarios/personal/tool-safety-followthrough.md`; plugin hook health scenario | smoke-ci, release | live channel action for channel claims | target ref and release package |
| docs.troubleshooting | `docs.troubleshooting.surface`, `docs.release.rerun` | Docs check; release checklist summary with rerun commands | release | no | release candidate |
| release.artifacts | `release.artifacts.summary`, `release.artifacts.manifest` | Release workflow artifact upload step; scorecard report artifact | release | release workflow | release candidate |
| release.waivers | `release.waiver.upstream`, `release.failure.classification` | Scorecard gate failure classification; maintainer waiver record | release | live upstream outage path | release candidate |

## Example generated gap report

The scorecard gate can generate a compact report from the mapping above and the collected summary artifacts. Example shape:

| Checklist ID | Status | Evidence artifact | Detail |
| --- | --- | --- | --- |
| runtime.gateway.startup | pass | `.artifacts/qa-e2e/smoke-ci/qa-suite-summary.json` | host e2e and package lane passed for target ref |
| channels.telegram.live | pass | `.artifacts/qa-e2e/telegram-20260607/telegram-qa-summary.json` | live Telegram bot and user-driver proof passed |
| providers.google | fail | `.artifacts/qa-e2e/live-providers/qa-suite-summary.json` | live Google provider scenario failed with provider outage classification |
| plugins.external.compat | advisory | `crabpot-summary.json` | advisory-only compatibility signal, not release-blocking |
| release.waivers | pending | `release-scorecard-summary.json` | maintainer or release-owner waiver required before promotion |
