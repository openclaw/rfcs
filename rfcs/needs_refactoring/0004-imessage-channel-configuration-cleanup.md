---
title: iMessage Channel Configuration Cleanup
authors:
  - omarshahine
created: 2026-05-27
last_updated: 2026-05-29
rfc_pr: https://github.com/openclaw/rfcs/pull/3
---

# Proposal: iMessage Channel Configuration Cleanup

## Summary

Simplify the iMessage channel configuration surface by moving expected reliability
behavior into defaults, preserving true safety and operations controls, and
hiding or deprecating knobs that expose implementation details.

## Motivation

The current iMessage config surface mixes user-facing policy, bridge operations,
generic channel behavior, and legacy compatibility fields. This makes setup
harder than it needs to be: users must discover opt-in settings for behavior
they reasonably expect, while advanced fields appear equally important in docs
and schema output.

### Expected behavior is opt-in

Several settings are currently optional even though they mostly represent
expected channel reliability:

- `includeAttachments`: users expect media to work once iMessage is enabled,
  while `attachmentRoots` and `mediaMaxMb` already provide the real safety
  boundaries.
- `coalesceSameSenderDms`: users should not need to discover a magic opt-in for
  Apple split-send behavior.
- `catchup.enabled`: users generally expect messages received during gateway
  downtime to be replayed, and catchup already has age, count, lookback, and
  failure limits.

### Advanced controls are not distinguished from setup

Operational escape hatches such as `probeTimeoutMs`, `remoteHost`, and
`textChunkLimit` are valid, but they should not be presented as normal setup
requirements.

### Generic channel options look iMessage-specific

Fields such as `healthMonitor`, `heartbeat`, `responsePrefix`,
`dmHistoryLimit`, and `dms` are shared channel/session behavior. They should
remain available where compatibility requires them, but the iMessage docs should
not imply they are core iMessage concepts.

### Some accepted fields may be stale

`capabilities` is accepted by the iMessage config schema, but no iMessage
runtime consumer has been identified. If there is no generic consumer, it should
be removed or deprecated.

## Goals

- Make common iMessage behavior work with less configuration.
- Keep explicit controls for privacy, security, and deployment variance.
- Keep shipped configs compatible unless there is a deliberate migration path.
- Reduce docs and setup emphasis on low-level transport and generic channel
  internals.
- Clarify which options are basic setup, advanced operations, compatibility, or
  planned deprecation.

## Non-Goals

- Removing multi-account iMessage support.
- Removing group allowlists, pairing, or config-write authorization.
- Changing the iMessage bridge dependency or replacing `imsg`.
- Removing generic channel config support from other channels.

## Proposal

### Field classification

#### Basic setup

These fields remain visible in basic setup and examples:

- `enabled`: starts or stops the iMessage channel.
- `cliPath`: selects the local `imsg` binary or SSH wrapper.
- `dbPath`: overrides the Messages database path.
- `dmPolicy`: controls direct-message admission.
- `allowFrom`: controls authorized direct senders.
- `groupPolicy`: controls group admission.
- `groupAllowFrom`: controls authorized group senders.
- `groups`: controls group registry and mention behavior.
- `attachmentRoots`: path safety boundary for inbound local attachments.
- `service`: selects iMessage, SMS, or auto send behavior.
- `region`: SMS region default, if SMS support remains in scope.
- `accounts`: declares multi-account setups.
- `defaultAccount`: selects the default account when multiple accounts exist.
- `name`: display label for account lists.

#### Default or collapse

These should stop being prominent opt-in settings:

- `includeAttachments`: default to enabled, with `attachmentRoots` and
  `mediaMaxMb` continuing to enforce safety. If compatibility risk is too high,
  introduce a staged rollout with a doctor warning before changing the default.
- `coalesceSameSenderDms`: make this default DM behavior or fold it into generic
  inbound debounce. Keep an escape hatch only if real regressions appear.
- `catchup.enabled`: consider default-on catchup using existing safety limits.
  Keep sub-options for advanced tuning.
- `actions`: collapse per-action toggles into bridge capability probing, or a
  single private API policy if operators need one broad switch.
- `remoteAttachmentRoots`: default to `attachmentRoots` and keep as an advanced
  override only when remote and local paths differ.

#### Keep advanced

These options should remain user-configurable but move out of basic setup docs:

- `sendReadReceipts`: privacy-sensitive opt-out for read receipts.
- `reactionNotifications`: controls tapback system-event noise.
- `probeTimeoutMs`: escape hatch for slow Macs or SSH wrappers.
- `remoteHost`: explicit SCP host when wrapper auto-detection is insufficient.
- `contextVisibility`: privacy policy for quoted or supplemental context.
- `healthMonitor`: generic operational health override.
- `groups.*.tools`: group-specific tool authority policy.
- `groups.*.toolsBySender`: sender-specific group tool authority policy.

#### Keep compatible, hide from iMessage docs

These fields should remain schema-compatible, but documentation should frame
them as shared channel/session behavior or omit them from iMessage setup:

- `textChunkLimit`: low-level outbound chunk limit.
- `mediaMaxMb`: media size safety limit; prefer generic media-limit docs.
- `responsePrefix`: generic outbound presentation policy.
- `heartbeat`: generic channel heartbeat visibility policy.
- `dmHistoryLimit`: generic DM transcript history tuning.
- `dms`: generic per-DM overrides.
- `blockStreaming`: generic reply pipeline override.

#### Deprecate or migrate

These fields should get a compatibility plan:

- `blockStreamingCoalesce`: migrate to the newer generic streaming block
  coalesce shape if available.
- `chunkMode`: remove from iMessage-specific docs and consider migration to
  generic streaming chunk config only.
- `capabilities`: deprecate or remove if no runtime consumer exists.
- `defaultTo`: reassess. It is a CLI convenience, but explicit target or
  last-route behavior is less surprising.
- `groups.*.systemPrompt`: reassess. It is powerful, but contributes to
  prompt/config sprawl. Keep only if cross-channel group prompt policy is an
  intentional product surface.

#### Keep as explicit safety or authority boundaries

These options should not be removed as part of cleanup:

- `attachmentRoots`: path allowlist for inbound attachment ingestion.
- `configWrites`: gates channel-initiated config mutation.
- `groups.*.tools`: controls tool authority in group conversations.
- `groups.*.toolsBySender`: controls sender-specific tool authority.

### Migration plan

1. Split documentation into basic setup and advanced configuration.
2. Remove nonessential fields from basic examples, especially
   `includeAttachments: false`, `actions.*`, `textChunkLimit`, and catchup
   disabled examples.
3. Add schema metadata or docs tables that classify fields as basic, advanced,
   shared, compatibility, or deprecated.
4. Add tests around any default changes:
   - inbound attachments enabled by default while path roots still block
     disallowed files;
   - split-send DM coalescing enabled by default;
   - catchup default behavior respects age/count/failure limits;
   - private API actions remain gated by probe status.
5. Add doctor migrations for any removed or renamed shipped config keys.
6. Stage risky default changes behind one release of warnings when needed.

### Compatibility notes

Changing config defaults is upgrade-sensitive. Any behavior change must preserve
existing explicit config values:

- `includeAttachments: false` must continue to disable attachment ingestion.
- `coalesceSameSenderDms: false` must continue to disable DM coalescing if the
  default changes.
- `catchup: { enabled: false }` must continue to disable replay if catchup
  becomes default-on.
- Existing `actions.*` fields should continue to parse until a doctor migration
  or deprecation window removes them.

### Success criteria

- New iMessage setup requires fewer config lines.
- Safety boundaries remain explicit and tested.
- Advanced operators can still configure remote Mac, timeouts, read receipts,
  reaction visibility, and group tool policy.
- Basic docs no longer present internal transport knobs as normal setup.
- Deprecated fields have a migration or doctor path before removal.

## Rationale

The core design choice is to **classify and default** rather than aggressively
remove. Most of the friction comes not from too many capabilities, but from
presenting policy, operations, generic channel behavior, and legacy fields as if
they were all equally part of iMessage setup. Reclassifying fields and choosing
sensible defaults addresses the friction while keeping the configuration
expressive for advanced operators.

Alternatives considered:

- **Remove the low-value fields outright.** Rejected as the default path because
  shipped configs and remote-Mac deployments depend on several of these knobs.
  Removal without a migration window would break upgrades. Deprecation with a
  doctor migration achieves the same end-state more safely.
- **Leave the surface as-is and only fix documentation.** Rejected because the
  schema itself, not just the docs, presents opt-in settings for behavior users
  reasonably expect (`includeAttachments`, `coalesceSameSenderDms`,
  `catchup.enabled`). Docs-only changes would not reduce required setup lines.
- **Flip risky defaults immediately in one release.** Rejected as the universal
  approach because attachment ingestion and catchup replay change observable
  behavior. The proposal allows a staged rollout behind one release of doctor
  warnings where compatibility risk is high, while still permitting immediate
  defaulting for low-risk knobs.

The main trade-off is added migration machinery (doctor migrations, staged
warnings, classification metadata) in exchange for a smaller, clearer setup
surface and preserved backward compatibility.

## Unresolved questions

- Should iMessage attachment ingestion become default-on in one release, or
  after one release of doctor warnings?
- Should catchup become default-on, or should onboarding explicitly recommend
  enabling it?
- Is per-action private API gating used enough to justify keeping `actions.*`?
- Is `capabilities` consumed by any generic config path, or is it stale?
- Should `groups.*.systemPrompt` remain a cross-channel group feature, or move
  to an agent/routing-owned surface?
- Should `defaultTo` remain for CLI workflows, or be replaced by explicit target
  and last-route behavior?
