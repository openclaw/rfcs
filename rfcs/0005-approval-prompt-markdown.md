---
title: Approval Prompt Markdown Contract
authors:
  - omarshahine
created: 2026-05-30
last_updated: 2026-05-30
rfc_pr: https://github.com/openclaw/rfcs/pull/4
---

# Proposal: Approval Prompt Markdown Contract

## Summary

Approval prompts are built once in core and sent verbatim to every channel.
The builders emit mostly plain text, with an ad hoc markdown subset already
leaking in for exec approvals, and channels render that string inconsistently.
This proposal makes the approval prompt text a single defined markdown contract
owned by the core plugin SDK. Core emits one canonical markdown dialect, and
each channel decides, as an explicit capability, whether it renders that
markdown into native styling or downgrades it to clean plaintext.

## Motivation

Three core builders produce approval prompt text today and all return plain
strings that channels send as ordinary outbound messages:

- `src/infra/plugin-approvals.ts` builds the legacy plugin approval prompt
  (`buildPluginApprovalRequestMessage`) plus its resolved and expired variants.
  This is the text behind the `Plugin approval required / Title: / Plugin:`
  prompt. It is pure plaintext.
- `src/plugin-sdk/approval-reaction-runtime.ts` builds the reaction-aware
  pending text for both exec and plugin approvals, the reaction hint
  (`buildApprovalReactionHint`), and owns the canonical
  `APPROVAL_REACTION_BINDINGS` table.
- `src/infra/exec-approval-reply.ts` builds the exec approval pending payload
  (`buildExecApprovalPendingReplyPayload`). This one already emits a markdown
  subset: fenced code blocks for the pending command via `buildFence` and
  inline code for `Full id`.

So core already ships markdown, just not on purpose and not uniformly. The exec
approval `Pending command:` fence renders as a code block on channels that
parse markdown and shows literal backticks on channels that do not, and richer
formatting such as a bold title is impossible without each channel reverse
engineering the plain text.

On the channel side, all seven native approval channels (Discord, iMessage,
Matrix, Signal, Slack, Telegram, WhatsApp) already own a markdown or formatting
layer for normal outbound text, but with diverging dialects:

- iMessage converts a markdown subset (bold, italic, underline, strikethrough)
  into native typed-run ranges on send (`extractMarkdownFormatRuns` in
  `extensions/imessage/src/send.ts`, documented in
  `extensions/imessage/src/markdown-format.ts`). macOS 15+ renders the runs;
  macOS 14 sees clean marker-stripped text. Approval prompts already flow
  through this send path, so the machinery is present and unused for approvals.
- Telegram sends with a parse mode and must escape reserved characters, so an
  unescaped `*` or `_` is a delivery hazard, not just a cosmetic one.
- Signal, WhatsApp, Slack, Discord, and Matrix each have their own format or
  send module with a distinct dialect (`**bold**` vs `*bold*`, fenced code
  support, escaping rules).

The dialects diverge, which is exactly why a single canonical core dialect plus
per-channel translation is the right seam. The goal is not a new approval
product surface. It is a stable formatting contract for the approval text that
already ships.

## Goals

- Core approval builders emit one canonical markdown dialect, documented and
  versioned in the plugin SDK.
- A channel renders approval markdown into native styling or downgrades to
  plaintext, by explicit capability, never by accident.
- Plaintext downgrade is lossless in meaning: stripping markers never changes
  the words, the id, the command text, or the reaction or reply instructions.
- The exec approval code fence and inline id already in core text become part
  of the defined contract rather than incidental output.
- Existing channels keep working during migration without a flag day.

## Non-Goals

- Changing approval semantics, decisions (`allow-once`, `allow-always`,
  `deny`), reaction emoji bindings, or the `/approve` reply grammar.
- Changing the approval reaction affordance (the allow once, allow always, and
  deny emoji shortcuts and hint) owned by the reaction runtime.
- Inventing a new rich-text format. The contract is a small markdown subset,
  not HTML, not attributed-body, not per-channel block kits.
- Forcing every channel to render markdown. Plaintext is a first-class,
  supported outcome.
- Localizing or rewording approval copy.

## Proposal

### Canonical subset

Core emits a fixed markdown subset, intentionally the intersection of what the
channels can already express plus what the exec builder already uses:

- `**bold**`
- `_italic_`
- `~~strikethrough~~`
- `` `inline code` ``
- triple-backtick fenced code blocks with an optional language hint

Underline is excluded from the core subset because most channels cannot express
it. iMessage may still map a channel-local marker if it wants, but core does
not emit one.

### Plugin SDK ownership

The plugin SDK owns:

1. The builders, unchanged in wording, updated to emit the canonical subset
   deliberately (bold labels or title, code for ids and commands).
2. A documented description of the subset and its escaping rules.
3. A `downgradeApprovalMarkdownToPlaintext(text)` helper that strips markers
   losslessly, so any channel can call one function to get safe plaintext.

### Channel capability

Channels gain an explicit capability on their approval handler:

- `approvalText: "markdown"` means the channel translates the canonical subset
  into its native styling. The channel owns the translation and any escaping.
- `approvalText: "plaintext"` (the default during migration) means the channel
  calls `downgradeApprovalMarkdownToPlaintext` before send and surfaces clean
  text with no markers.

A channel must never pass canonical markdown straight to a transport that will
mangle it. Either it translates, or it downgrades. There is no implicit
pass-through.

### Migration

Compatibility is opt-in, so the default is the safe one.

1. Land the canonical subset, the downgrade helper, and the capability with
   every channel defaulting to `plaintext`. Behavior is unchanged for users
   because the downgrade reproduces today's plaintext, including turning the
   existing exec fence into the same readable block channels show today.
2. Move iMessage to `markdown` first. It already converts the subset to typed
   runs on send, so the change is wiring the approval path to skip the
   downgrade and reuse the existing converter.
3. Move Telegram, Signal, WhatsApp, Slack, Discord, and Matrix to `markdown`
   one at a time, each with channel-native escaping and rendering proof.
4. Once a channel opts in, its approval prompt formatting is a tested contract,
   not incidental output.

There is no flag day. A channel that never opts in keeps shipping clean
plaintext forever, which is a supported end state, not a temporary shim.

### Testing

- Plugin SDK unit tests for the canonical builders (exact emitted markers) and
  for `downgradeApprovalMarkdownToPlaintext` (strip is lossless: same words,
  same id, same command, same instructions, zero residual markers).
- Per-channel tests asserting the chosen mode: `plaintext` channels emit no
  markers; `markdown` channels emit native styling and escape reserved
  characters.
- iMessage: prove the approval prompt produces typed-run ranges via the
  existing converter and strips clean on the macOS 14 path.
- Telegram: prove reserved-character escaping on a prompt whose title or
  command contains `*`, `_`, backticks, or other reserved characters.
- Real-channel delivery proof for each channel at the point it opts into
  `markdown`, since rendering and escaping are transport behaviors.

## Rationale

The chosen design keeps formatting policy in core and rendering in channels,
matching the repo rule that core stays channel-agnostic and channels own their
rendering. Three alternatives were considered.

- iMessage-local formatting only. The iMessage channel could restyle the
  approval text it sends without touching core. This has zero blast radius but
  solves the problem for exactly one channel and leaves the existing exec fence
  inconsistency unaddressed everywhere else. It also pushes presentation logic
  that other channels want into a single plugin, so the next channel has to
  reinvent it.
- Shared markdown in core with no opt-in. Core could simply emit markdown and
  assume every channel renders it. This is the smallest diff but the highest
  risk: channels that do not parse markdown would surface literal markers, and
  parse-mode channels such as Telegram could break delivery on unescaped
  characters. Rendering is a transport behavior, so it cannot be assumed.
- Fully structured segments. Core could emit label and value segments and let
  every channel render its own way. This is the cleanest long-term contract but
  the largest change, touching every channel approval handler at once with no
  safe incremental path.

The proposal takes the middle path. Core emits markdown, but each channel opts
in explicitly and the default is a lossless plaintext downgrade, so the change
ships safely channel by channel. It also formalizes the markdown core already
emits incidentally rather than introducing a brand new format.

## Unresolved questions

- Should the canonical subset include underline given only iMessage can express
  it, or stay at the strict cross-channel intersection and let iMessage add a
  local marker out of band.
- Whether the capability lives on the existing channel approval capability
  object or as a small standalone field, and how a plugin author declares it
  through the public SDK.
- Whether the exec fence language hints (`sh`, `txt`) should be normalized as
  part of the contract or left to each channel to honor or drop.
