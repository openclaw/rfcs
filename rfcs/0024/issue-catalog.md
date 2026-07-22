# Localization GitHub Issue Catalog

Live state checked: 2026-07-22.

Projected delivery IDs refer to the
[owner slice registry](projected-owner-slice-registry.md). They identify an
initial planning family, not a promise that one issue maps to one pull request.

This catalog maps user reports to RFC contracts and implementation slices. It
is not a request to reopen every closed issue. Closed threads provide evidence,
precedent, and duplicate history.

## Active Contract Issues

| Issue | Surface | Current gap | RFC owner | Delivery |
| --- | --- | --- | --- | --- |
| [#28303](https://github.com/openclaw/openclaw/issues/28303) | Locale identity | `zh-CN`/`zh-TW` public IDs do not express script semantics; migration is unresolved. | Locale registry | `F01`; any canonical-ID migration remains separate |
| [#90608](https://github.com/openclaw/openclaw/issues/90608) | Locale preference | Browser inference can select an unwanted locale; explicit choice/default needs precedence. | Locale context | `F01`, then owner-local UI preference follow-up if still needed |
| [#81253](https://github.com/openclaw/openclaw/issues/81253) | Exec approvals | Safety prompt labels and guidance are hardcoded English. | Runtime messages | `F05`, `R20`, and adapter-gated `R21` |
| [#79458](https://github.com/openclaw/openclaw/issues/79458) | Command metadata | Slash-command descriptions lack one locale-keyed contract. | Metadata | `M25`-`M28` |
| [#55239](https://github.com/openclaw/openclaw/issues/55239) | Telegram | Native command menu descriptions remain English. | Metadata projection | `M28` |
| [#89971](https://github.com/openclaw/openclaw/issues/89971) | Skills | Skill display names and descriptions are raw English metadata. | Metadata | `M29`-`M30` |
| [#79223](https://github.com/openclaw/openclaw/issues/79223) | Dreaming | Dream Diary generated prose has no explicit language input. | Content language | Post-v1 |
| [#101314](https://github.com/openclaw/openclaw/issues/101314) | Dreaming | Journal headings and status labels are hardcoded English, while generated prose has separate language behavior. | Runtime messages + content language | `R23` for deterministic labels; generated content remains Post-v1 |
| [#53345](https://github.com/openclaw/openclaw/issues/53345) | Agent content | Korean UI is present, but agent response-language consistency is a separate unresolved behavior. | Content language | Post-v1 |
| [#78038](https://github.com/openclaw/openclaw/issues/78038) | Control UI | Specific zh-CN strings are untranslated or inaccurate. | Coverage/quality | `P37` and generated owner waves |
| [#88570](https://github.com/openclaw/openclaw/issues/88570) | Product-wide | CLI, runtime errors, channel notices, UI pages, and coverage reporting remain incomplete. | Umbrella coverage | `F01`-`E44`; completion still uses landed owner evidence, not the count |
| [#107851](https://github.com/openclaw/openclaw/issues/107851) | Control UI | `tabs.chat` is missing in non-English bundles. | Coverage/quality | `P37` and generated owner waves |
| [#105266](https://github.com/openclaw/openclaw/issues/105266) | Test infrastructure | Locale-rendering tests can observe stale/split localization state. | Coverage infrastructure | `F01` plus owner-local convergence proof |
| [#106576](https://github.com/openclaw/openclaw/issues/106576) | Localized hosts | Sandbox behavior matches English `stderr` prose. | Locale robustness | `R24` |

## Historical Runtime And Architecture Evidence

| Issue | State | Relevance |
| --- | --- | --- |
| [#50497](https://github.com/openclaw/openclaw/issues/50497) | Closed | Broad CLI/Gateway localization requests were closed in favor of architecture-led work, supporting this RFC rather than another ad hoc language thread. |
| [#66056](https://github.com/openclaw/openclaw/issues/66056) | Closed, not planned | Source review confirmed locale-aware Gateway/runtime errors were still missing. This RFC adopts the unresolved contract. |
| [#70590](https://github.com/openclaw/openclaw/issues/70590) | Closed as duplicate/superseded | Hardcoded Control UI strings were being addressed by focused UI work; product-wide runtime scope remained. |
| [#88171](https://github.com/openclaw/openclaw/issues/88171) | Closed, not planned | A single hosted translation platform was not accepted as the architecture. RFC 0024 keeps in-repo surface ownership and shared semantics. |

## Landed Foundations And Precedents

| Issue | Landed behavior | RFC reuse |
| --- | --- | --- |
| [#79936](https://github.com/openclaw/openclaw/issues/79936) | CLI setup wizard catalog and locale selection. | Reuse locale normalization, dotted keys, and English fallback. |
| [#79937](https://github.com/openclaw/openclaw/issues/79937) | Control UI chat-panel strings moved to i18n. | Reuse UI catalog and rerender behavior. |
| [#79034](https://github.com/openclaw/openclaw/issues/79034) | Finite chat/tool metadata localized across shipped UI locales. | Reuse generated parity validation. |
| [#56580](https://github.com/openclaw/openclaw/issues/56580) | Discord command specs gained `descriptionLocalizations`. | Generalize into the command metadata contract. |
| [#98970](https://github.com/openclaw/openclaw/issues/98970) | Explicit non-English STT hints no longer receive an English-biased default prompt. | Keep product locale and content-language inputs explicit. |
| [#100247](https://github.com/openclaw/openclaw/issues/100247) | Simplified Chinese reached Control UI and core Apple surfaces. | Preserve existing pipelines and manifests. |
| [#103270](https://github.com/openclaw/openclaw/issues/103270) | Profile and agent selectors update with locale changes. | Locale changes must notify active renderers. |
| [#103320](https://github.com/openclaw/openclaw/issues/103320) and [#103333](https://github.com/openclaw/openclaw/issues/103333) | UI locale test/module isolation was hardened. | Treat singleton and test isolation as localization infrastructure. |
| [#103570](https://github.com/openclaw/openclaw/issues/103570) | Locale refresh workflows publish generated PRs through protected-branch-safe identities. | Reuse generated catalog workflow. |
| [#103691](https://github.com/openclaw/openclaw/issues/103691) | Native extraction and locale validation hardened. | Reuse deterministic inventory and validation rules. |
| [#104014](https://github.com/openclaw/openclaw/issues/104014) | Packaged Zod validation restored explicit English locale registration. | Dependencies need deterministic fallback installation. |
| [#104979](https://github.com/openclaw/openclaw/issues/104979) | Android and Apple runtime surfaces were wired into generated localization. | Keep platform-native catalogs and shared inventory. |
| [#105130](https://github.com/openclaw/openclaw/issues/105130) | Control UI locale parity became advisory before release. | RFC 0024 defines when advisory gaps graduate to blocking completeness gates. |
| [#107857](https://github.com/openclaw/openclaw/issues/107857) | Quick Settings labels were moved through the UI `t()` path. | Continue focused surface migration backed by coverage. |

## Duplicate And Alignment Rules

- Do not file a new umbrella OpenClaw localization issue until RFC 0024 is
  accepted; the accepted RFC lifecycle creates the implementation issue.
- Keep focused current issues open and link them from the future implementation
  issue.
- Close focused issues only when their exact surface lands or is explicitly
  superseded by an accepted slice.
- Do not merge generated-content language requests into UI locale behavior.
- Do not treat translation-quality issues as proof that the underlying runtime
  contract is absent.
- Do not treat a locale file as proof of complete product localization.
