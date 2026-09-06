---
title: Surface plugin update availability
authors:
  - Erick Kinnee (@ekinnee)
created: 2026-08-28
last_updated: 2026-09-06
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

Use the existing plugin update resolution owner to obtain metadata for installed
plugins with a recorded, resolvable install source. Separate metadata resolution
from installation so checking availability performs no package installation or
configuration mutation.

Each result should identify the plugin, recorded source and selector, installed
version, eligible target when known, and newer published release when known.
Include the check outcome and observation time. Exact field names and the public
JSON contract remain subject to review.

A pinned plugin can have a newer published release while its eligible target
remains unchanged. Present that as a newer release outside the recorded selector,
not an ordinary eligible update. Missing metadata, offline registries, and
unsupported local sources must not appear as up to date.

### CLI presentation

`openclaw plugins list --verbose` should display an availability hint alongside
the installed version when a result is available. Ordinary inventory listing
should remain local. The precise explicit refresh entry point is an unresolved
question; verbose formatting alone should not silently introduce registry calls.

`openclaw update status` should add a separate plugin availability section and an
equivalent JSON representation. Retain the core update section's meaning. Plugin
availability describes releases for the recorded plugin installation; it is not
a candidate-core compatibility assessment.

Keep `openclaw plugins update --all --dry-run` as the actionable check path named
by the original RFC. The availability view should reuse its resolution semantics,
with an implementation-time check that metadata-only inspection causes no install
or state changes.

### Control UI presentation

Extend the update surface with a plugin summary and a details view identifying
the installed version, eligible update, and any newer release excluded by a pin.
Count eligible updates separately from pinned newer releases and unknown checks.
Provide explicit refresh and the appropriate CLI next action; displaying a notice
must not start an update.

The UI and CLI should consume equivalent results. A failed refresh should remain
visible. If a previous result is retained, label its observation time and stale
state rather than representing it as a successful current check.

### Refresh and storage

Propose on-demand checks with bounded completion and explicit partial results.
Do not add scheduled polling. The cache lifetime, invalidation owner, and need
for persistence must be settled before implementation; this draft does not
prescribe a new store, configuration option, or environment variable.

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

A single `Latest` column is compact but ambiguous for pinned installations.
Separating published releases from eligible targets makes the operator's choice
clear without changing update policy.

The upgrade-preflight issue is related but distinct. An available plugin release
does not prove compatibility with a candidate core or reversibility of migrations.
Future preflight work may reuse resolution primitives while retaining its own
assessment and admission policy.

## Unresolved questions

1. What explicit CLI action refreshes availability, and how should verbose list
   and update status consume the result without hidden network work?
2. Should results be cached across commands, and if so, which existing owner
   controls storage, expiry, and invalidation?
3. What precise JSON fields and outcome names distinguish eligible updates,
   releases excluded by pins, unknown checks, and unsupported sources?
4. Should the Control UI summary appear in the core update card or a neighboring
   plugin section, and where should per-plugin details live?
5. How should offline operators invoke or suppress an explicit check without
   adding another configuration flag?
6. What bounds apply to concurrent lookups and total check duration?

The original issue remains the proposal's provenance. Per the RFC repository's
lifecycle, the frontmatter implementation issue remains blank until acceptance.
