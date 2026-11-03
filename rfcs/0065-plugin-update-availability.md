---
title: Surface plugin update availability
authors:
  - Erick Kinnee (@ekinnee)
created: 2026-08-28
last_updated: 2026-09-07
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/66
---

# Proposal: Surface plugin update availability

## Summary

Expose available plugin updates through `openclaw plugins list --verbose`,
`openclaw update status`, and the Control UI, using a shared availability view
backed by the existing plugin update resolution owner. Preserve recorded install
sources and pins, distinguish newer published releases from eligible update
targets, and make incomplete checks visible. This formalizes Erick Kinnee's
[original RFC, openclaw/openclaw#131897](https://github.com/openclaw/openclaw/issues/131897).
Refresh behavior remains a proposal for maintainer discussion; this RFC does not
authorize background polling or automatic updates.

## Motivation

Plugins release independently of OpenClaw core. An operator can miss plugin
maintenance releases even while following core update notices. The original RFC
uses the OmniRoute provider plugin as an example: provider catalogs and routing
fixes can change independently of the core release cadence.

The original report describes installed-version listings and core-update notices
that do not give an installed-plugin availability overview. Its September 5,
2026 review reports that explicit update checks now surface newer releases behind
npm pins, while inventory, status, and sidebar comparisons remain missing. That
is historical issue evidence, not a claim that this document independently
verified the current runtime.

Operators should be able to discover an update before a failure prompts them to
look for one, without interpreting a newer release as permission to change an
existing pin.

## Goals

- Show plugin update availability in the CLI and Control UI surfaces named in
  the original RFC.
- Reuse one resolution owner and the recorded package source and selector.
- Distinguish installed version, newer published release, and eligible target.
- Report unavailable metadata and failed checks as unknown, with a next action.
- Keep ordinary inventory reads local and make network refresh behavior explicit.
- Provide consistent human-readable and machine-readable results.

## Non-Goals

- Background polling, push notifications, or automatic plugin updates.
- Changing pins, channels, install sources, or configuration during a check.
- Establishing that a candidate core upgrade is safe, evaluating migrations, or
  deciding whether the updater should refuse an upgrade.
- Implementing the installation-specific upgrade preflight tracked by
  [openclaw/openclaw#122019](https://github.com/openclaw/openclaw/issues/122019).
- Adding a separate registry client or version-selection policy for each view.

## Proposal

### Shared availability view

Use ClawHub as the primary plugin update metadata path, through the existing
plugin update resolution owner. Resolve installed plugins from their recorded
source: ClawHub installations use their recorded ClawHub registry and package
identity; npm installations retain npm metadata resolution. Do not substitute a
ClawHub package for an npm installation based on name similarity. Separate metadata resolution
from installation so checking availability performs no package installation or
configuration mutation.

Propose a shared `pluginAvailability` object for JSON consumers, with
`checkedAt`, `complete`, and `plugins` sorted by plugin ID. Each entry contains
`pluginId`, a credential-free source identity, `selector`, `installedVersion`,
`eligibleVersion`, `publishedVersion`, `outcome`, `reason`, and `observedAt`.
Unknown versions and absent observation times are `null`, never inferred values.

`outcome` is `ok`, `unknown`, or `unsupported`. A successful observation also
contains `eligibleUpdate` and `newerOutsideSelector` booleans; both can be true
for a range allowing an update but excluding a still newer release. Unknown
comparisons are `null`. Published releases follow the existing source/channel
policy; this field does not mean the highest version across every channel.
`freshness` is `fresh`, `stale`, or `missing`. Failed refreshes expose their
current reason separately from `lastSuccess`, an optional stale observation.
Only fresh successful observations contribute to the eligible-update count.

`complete` is true only when every installed plugin has a fresh successful
observation. Unsupported, unattempted, and failed entries remain in the result.
Reasons include `not-checked`, `unsupported-source`, `lookup-failed`, `timeout`,
`budget-exhausted`, and `install-changed`. Human output maps each reason to an
explicit refresh, retry, or source-specific manual inspection action.

A pinned plugin can have a newer published release while its eligible target
remains unchanged. Present that as a newer release outside the recorded selector,
not an ordinary eligible update. Missing metadata, offline registries, and
unsupported local sources must not appear as up to date.

### CLI presentation

`openclaw plugins list --verbose` should display an availability hint alongside
the installed version when a result is available. Ordinary inventory listing
must remain local, including verbose output. Propose
`openclaw update status --refresh-plugins` as the explicit metadata refresh
entry point; `--json` returns the same results. These flags describe the proposed
interface, not a command available today. Without refresh, the plugin section
reads retained observations and shows their age or a not-checked hint. Existing
core network checks in `update status` keep their current behavior.

`openclaw update status` should add a separate plugin availability section and an
equivalent JSON representation. Retain the core update section's meaning. Plugin
availability describes releases for the recorded plugin installation; it is not
a candidate-core compatibility assessment.

Keep `openclaw plugins update --all --dry-run` as the actionable check path named
by the original RFC. The availability view should reuse its resolution semantics,
but must not call the installer dry-run as its implementation. Current dry-run
enters installer paths. Extract or reuse metadata primitives at the update owner;
checks must not download package artifacts, execute plugin code, install packages,
or change authored configuration. Persisting the observation is the only proposed
new durable side effect.

### Control UI presentation

Add a neighboring plugin section to the core update card, linking to installed-plugin
details identifying
the installed version, eligible update, and any newer release excluded by a pin.
Count eligible updates separately from pinned newer releases and unknown checks.
Provide explicit refresh and the appropriate CLI next action; displaying a notice
must not start an update.

The UI and CLI should consume equivalent results. A failed refresh should remain
visible. If a previous result is retained, label its observation time and stale
state rather than representing it as a successful current check.

### Refresh and storage

The following values are proposed defaults for acceptance, not measured limits
or existing runtime behavior:

- The existing plugin update owner owns refresh, retained observations, and
  invalidation. CLI and Gateway are callers; neither owns a second cache or
  selection policy. Refresh uses the caller's existing management authorization.
- Retain the latest attempt and at most one successful observation per installed
  plugin in the existing global SQLite control-plane database. Do not add a
  sidecar file, standalone database, history log, config option, or environment
  variable. The exact schema and migration require storage-owner review before
  implementation; RFC acceptance must explicitly include these persistence
  semantics.
- Observations are fresh for 24 hours. Expiry marks them stale without a network
  request. The cache key includes installation identity, installed version,
  recorded source/selector, OpenClaw host version and plugin API compatibility
  context, and resolution-relevant channel and registry context. A core upgrade
  invalidates prior eligibility observations.
  Local reads reject mismatched keys. Refresh rechecks installation identity
  before publishing results; changed entries become `install-changed`.
- Concurrent refreshes must not let an older attempt overwrite a newer result.
  The same update owner serializes publication, revalidating the current attempt
  and install identity after network work. Uninstalled entries are pruned during
  the next authorized refresh; ordinary reads do not perform maintenance writes.
- Allow at most four concurrent metadata lookups and a 15-second total network
  budget per refresh, including queue time. Bound each lookup by the remaining
  budget, cancel outstanding requests at expiry, and schedule no automatic
  retries. Unstarted entries report `budget-exhausted`; unfinished entries report
  `timeout`. Return partial results instead of silently dropping plugins.
- V1 prioritizes ClawHub metadata and also resolves recorded npm installations. Other sources, including Git and
  marketplace installations, remain visible as `unsupported` until their owner
  provides equivalent metadata-only resolution. Existing update support for
  those sources is unchanged.

Opening the UI, listing plugins, and reading retained plugin status never trigger
plugin metadata requests. Offline operators omit the refresh action. Failed
refreshes retain last-success evidence only with an explicit stale label; cache
write failures are reported and must not claim cross-command persistence.

### Acceptance criteria

- CLI and UI agree on eligible targets for the same source, selector, and
  resolution result.
- A newer release outside an exact pin is visibly distinct from an eligible
  update, and checking does not change the pin.
- Offline, failed, unsupported, and incomplete checks cannot produce a false
  all-up-to-date summary.
- Ordinary inventory reads do not contact registries.
- Checks do not install packages or mutate authored configuration.
- Human output offers a next action; JSON preserves unknown and partial results.
- Implementation proof covers registry and ClawHub sources, pinned and unpinned
  installations, partial failures, and the real CLI and Control UI presentation.

## Rationale

Reusing OpenClaw's existing updater is preferable to introducing a standalone
package-monitoring tool or independent registry logic in each view: those views
must respect the operator's recorded source and selector.

Leaving discovery only in explicit update commands preserves simplicity but
does not address the original RFC's visibility problem. Resolving on every list
would make ordinary inventory inspection depend on network availability.
On-demand refresh provides a deliberate check without adding background work.
Process-local caching would lose observations between CLI invocations and leave
ordinary verbose listings without useful availability. Shared SQLite observations
preserve that goal at the cost of explicitly reviewed persistence semantics.

A single `Latest` column is compact but ambiguous for pinned installations.
Separating published releases from eligible targets makes the operator's choice
clear without changing update policy.

The upgrade-preflight issue is related but distinct. An available plugin release
does not prove compatibility with a candidate core or reversibility of migrations.
Future preflight work may reuse resolution primitives while retaining its own
assessment and admission policy.

## Unresolved questions

Maintainers are asked to accept or amend the proposed refresh command, 24-hour
freshness window, four-lookup concurrency, 15-second budget, JSON semantics, and
shared persistence ownership as one v1 contract. These choices are not approved
by publication of this draft.

Before implementation, the storage owner must approve the exact schema,
migration, and publication fencing. Source-specific metadata adapters must prove
that cancellation bounds actual work. These are implementation review gates,
not permission to substitute installer dry-run or introduce another state owner.

Later work may extend metadata-only support to additional install sources.
Background refresh and upgrade-preflight policy remain outside this proposal.

The original issue remains the proposal's provenance. Per the RFC repository's
lifecycle, the frontmatter implementation issue remains blank until acceptance.
