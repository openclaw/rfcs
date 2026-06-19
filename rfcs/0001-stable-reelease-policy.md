---
title: OpenClaw Stable and LTS Release Policy
authors:
  - Kevin Lin
created: 2026-05-27
last_updated: 2026-06-19
rfc_pr: TBD
---

# Proposal: OpenClaw Stable and LTS Release Policy

## Summary

Establish a monthly stable release line backed by a faster daily release line.
OpenClaw versions use `YYYY.M.PATCH`: the current month receives daily releases,
and the completed month becomes the supported stable line. The first stable
release for a month is always `YYYY.M.33`. Stable receives security and
reliability backports, but not new features, and is held to an explicit
integration-test and support standard across the designated LTS surfaces.

## Motivation

OpenClaw needs both a fast release path and a predictable production release.
Operators should be able to install or upgrade to a well-known stable line
without following daily feature changes. Maintainers need an equally clear
answer for which branch to patch, which fixes qualify, which surfaces must be
tested, and when the next monthly line takes over.

The previous proposal used `stable` for the moving release train and added a
separate opt-in `lts` channel. This policy instead makes the trailing monthly
line the user-facing `stable` channel. `daily` names the current-month release
line. LTS describes the supported surface set, maintenance branch, and support
obligations behind `stable`; it is not a separate version family.

## Goals

- Use `YYYY.M.PATCH` for all normal releases in preparation for a future SemVer
  transition.
- Keep the current month on the `daily` release line and the completed month on
  the `stable` release line.
- Make `YYYY.M.33` the first stable release for every monthly line.
- Maintain one active stable monthly line at a time.
- Backport security and reliability fixes to stable without backporting new
  features.
- Provide first-class CLI and installer paths for installing and upgrading to
  stable.
- Establish an integration-test baseline for every designated LTS surface and
  target greater than 90% integration-test coverage for each surface.
- Prioritize issues raised against designated LTS surfaces during the stable
  support window.
- Include bundled plugins and explicitly covered OpenClaw-maintained plugins in
  the stable support and backport process.
- Fail closed when no valid stable artifact exists.

## Non-Goals

- Slowing or stopping daily feature development.
- Backporting new features, new defaults, normal refactors, or broad product
  changes to stable.
- Supporting more than one stable monthly line before the single-line process
  and tooling are proven.
- Guaranteeing stable support for every third-party plugin.
- Introducing an `-lts` version suffix or a separate LTS artifact format.
- Treating maturity-scorecard coverage values as integration-test coverage.

## Proposal

### Terminology

- **Daily line:** the current calendar month's `YYYY.M.PATCH` releases. It may
  include features as well as fixes.
- **Stable line:** the previous completed month's maintained release line. It
  receives only eligible security and reliability backports.
- **LTS surfaces:** the categories marked as included in the
  [OpenClaw LTS category proposal](https://github.com/openclaw/maintainers/blob/main/docs/kevinslin/maturity-scorecard/LTS.md).
- **LTS branch:** the maintenance branch for the active stable monthly line.

`stable` is the user-facing channel. LTS names the scope and maintenance
contract behind that channel; it does not require a separate `lts` version
suffix or user-facing release family.

### Version format

Normal OpenClaw releases use `YYYY.M.PATCH`:

- `YYYY` is the four-digit calendar year.
- `M` is the calendar month without a leading zero.
- `PATCH` identifies releases within that monthly line.
- Beta builds remain prereleases of the same version shape, for example
  `2026.7.12-beta.1`.

Patch `33` is reserved as the stable boundary. A daily line must not publish a
final release at patch `33` or higher before monthly promotion. When the month
is complete, maintainers publish `YYYY.M.33` as that line's first stable
release. Later security or reliability patches increment from there, for
example `YYYY.M.34` and `YYYY.M.35`.

Release tooling must enforce the reserved boundary so a daily publish cannot
consume `YYYY.M.33`. This gives users and automation one deterministic answer
for where stable support starts.

### Monthly rotation

At each month boundary, maintainers complete these steps:

1. Validate the completed monthly line against the stable release bar.
2. Publish `YYYY.M.33` as the first stable release for that month.
3. Move the stable package and update selectors to that release.
4. Create or retarget the LTS maintenance branch for the new stable line.
5. Advance daily development to the new calendar month.
6. Retire the prior stable line after the new stable selectors, install paths,
   upgrade paths, and documentation have been verified.

The initial rotations are explicit:

- At the end of June 2026, `2026.6.33` starts the stable line and daily
  development moves to `2026.7.X`.
- During July, security and reliability fixes may produce `2026.6.34`,
  `2026.6.35`, and later June-line patches. New features ship only on
  `2026.7.X` daily releases.
- At the end of July 2026, `2026.7.33` starts the new stable line and daily
  development moves to `2026.8.X`.
- The same rotation repeats each month.

Stable selection is a promotion of the completed monthly line, not a parallel
artifact-build process. The release must use the same source and artifact
provenance as the release evidence that qualified it.

### Support window

OpenClaw maintains one stable monthly line at a time. A line enters support at
`YYYY.M.33` and remains supported until the following monthly stable line is
published and verified.

Before retiring the active line, maintainers must verify that the new stable
line can be installed, upgraded to, and resolved through every stable selector.
The previous stable line remains active if that verification fails.

This initial one-month trailing window is deliberately bounded. A longer or
multi-line LTS commitment requires a separate policy change after the monthly
process has demonstrated reliable release, validation, backport, and support
operations.

### Eligible backports

Stable backports are limited to security and reliability work. Eligible changes
include:

- Security vulnerability fixes and hardening required to preserve an existing
  security boundary.
- Critical regressions in agent, gateway, CLI, update, packaged install, or
  recovery flows.
- Dependency, packaging, signing, notarization, or registry fixes required to
  keep existing supported workflows operating.
- Upgrade blockers introduced by the stable base release or an earlier patch
  on the same stable line.
- Reliability fixes for bundled plugins or explicitly supported
  OpenClaw-maintained plugins.
- Documentation corrections required to prevent an existing install, upgrade,
  security, or recovery workflow from failing.

The following changes are not eligible:

- New features or product surfaces.
- New providers, channels, plugins, or capabilities.
- New default behavior.
- Normal refactors, cleanup, or performance work without a demonstrated stable
  reliability impact.
- Broad compatibility changes that are not required to preserve the stable
  support contract.

Fixes land on `main` first whenever practical, then are backported to the active
LTS branch. Each backport must link the originating change, state why it meets
the stable criteria, and include validation proportional to the affected LTS
surfaces.

### Branch, tag, and publish mechanics

The daily line continues to move from `main`. The stable line is maintained on
an LTS branch rooted at the completed month's qualified source revision.

- The LTS branch is the canonical git-side selector for the active stable line.
- The first stable tag for a month is `vYYYY.M.33`.
- Subsequent stable tags increment `PATCH` on the same line.
- `main` continues independently and is not gated by stable maintenance.
- Stable backports are cherry-picked or otherwise mechanically backported from
  their reviewed source changes; they are not authored only on the LTS branch.
- Backport tooling must cover the core `openclaw/openclaw` repository and
  plugins maintained in repositories under the `openclaw` GitHub organization.
- The exact bytes validated for a stable release are the bytes published for
  that version.

The package publication model is:

- The `stable` package selector points to the newest supported patch on the
  active stable monthly line.
- The `daily` package selector points to the newest current-month daily
  release.
- Moving `stable` to a new monthly line must not silently move tracked plugins
  outside their documented stable compatibility targets.
- Token-bearing selector changes reuse the existing private release workflow
  and operator path.
- Stable docs and compatibility data are updated in the same release window as
  the selector change.

### Install and update semantics

The CLI and installer must support stable as a first-class target before the
first stable release.

The package-manager path is:

```bash
npm install -g openclaw@stable
openclaw update --channel stable
```

The installer path is:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm --version stable
openclaw update --channel stable
```

Resolution rules:

- `openclaw update --channel stable` resolves to the newest supported patch on
  the active stable monthly line.
- `openclaw update --channel daily` resolves to the newest current-month daily
  release.
- npm stable installs resolve through the `stable` dist-tag.
- Git stable installs follow the active LTS branch or stable tag selector.
- Exact stable versions remain supported for pinned installs and diagnostics.
- Update status distinguishes the configured channel from the resolved
  version.
- Persisted `update.channel = stable` uses stable-class auto-update delay and
  jitter behavior.

If the current install is newer than the active stable line, switching to
stable is a downgrade. OpenClaw must show that explicitly using the existing
downgrade confirmation behavior. Stable resolution must fail closed if no
active stable artifact exists; it must not silently fall back to daily or
`latest`.

This RFC does not redefine the existing `beta`, `dev`, or `latest` selectors.
Release and user documentation must state how those selectors relate to
`daily` and `stable` before launch, and no selector may ambiguously resolve to
both lines.

### Plugin support

The stable promise must name its plugin scope.

- Bundled `@openclaw/*` plugins that ship with the stable core artifact are
  covered by the same stable patch policy.
- Official plugins maintained under the `openclaw` GitHub organization are
  covered only when the active stable documentation lists them.
- Covered external plugins must have an exact compatibility target for the
  active stable core version.
- Unversioned, `default`, or `latest` plugin specs are outside the stable
  contract unless stable tooling resolves them through checked-in
  compatibility data.
- Third-party plugins remain user-managed and are never implicitly rewritten
  to a stable-specific target.

When a tracked official plugin is outside the documented stable scope,
`openclaw update --channel stable` must leave it unchanged and emit a structured
warning. The warning should include `pluginId`, `packageName`, current install
spec or version when known, active stable version, and a stable reason code such
as `outside_stable_contract`.

The initial stable release may use a checked-in Markdown table as its plugin
support source of truth. That table must identify the package or install spec,
coverage status, exact stable version or compatibility rule, and any operational
notes. Automated validation must reject covered targets that use `latest`,
`default`, or an unversioned package spec.

### LTS surface quality bar

The designated stable scope is the set of included categories in the
[OpenClaw LTS category proposal](https://github.com/openclaw/maintainers/blob/main/docs/kevinslin/maturity-scorecard/LTS.md).
That document selects the product surfaces; this RFC defines the release
quality target for them.

Before the first stable release, maintainers must record an integration-test
coverage baseline for every designated LTS surface. The baseline must identify:

- The surface and included category.
- The integration scenarios counted for that surface.
- Which scenarios are automated, manually verified, missing, or blocked.
- The evidence source and most recent successful run.
- The owner and tracked issue for each material gap.

Stable releases target greater than 90% integration-test coverage for every
designated LTS surface, measured per surface rather than as one aggregate
percentage. The baseline is a pre-release requirement; the greater-than-90%
target is the operating goal. Until maintainers explicitly make it a hard
promotion gate, any surface below target must be disclosed in the stable
release evidence with an owner and prioritized remediation issue.

Maturity-scorecard `Coverage/Quality` values are not the integration-test
coverage percentage. They may inform prioritization, but they do not satisfy
this baseline or target by themselves.

Issues raised against a designated LTS surface receive priority triage during
the stable support window. Security issues follow the security response
process. Reliability issues that reproduce on the active stable line are
evaluated for backport before non-LTS feature work; severity and user impact
still determine ordering within that queue.

### Stable release validation

Before publishing `YYYY.M.33`, OpenClaw must have:

- Full release checklist evidence.
- `Full Release Validation` at `release_profile=full`.
- Package acceptance against the exact version to be published.
- Cross-OS packaged install and stable-upgrade proof.
- CLI and installer proof for a new stable install and an upgrade or channel
  switch to stable.
- An integration-test coverage baseline for every designated LTS surface.
- Published per-surface coverage results and tracked gaps toward the
  greater-than-90% target.
- Plugin compatibility proof for bundled plugins and every explicitly covered
  OpenClaw-maintained plugin.
- A validated stable plugin support table.
- Published documentation naming the stable version, support window, install
  and update commands, compatibility scope, known coverage gaps, and next
  expected rotation.

For later stable patches, maintainers may reuse unaffected umbrella evidence
and rerun the smallest affected release-validation scope. Every patch still
needs exact-version package proof and targeted integration proof for the
affected LTS surfaces before publication.

### Pre-release requirements

The following work must be in place before the first stable release:

1. **Integration coverage baseline:** record the baseline for every designated
   LTS surface, publish the gaps, and create prioritized issues toward greater
   than 90% coverage per surface.
2. **Stable install and upgrade tooling:** implement and verify CLI,
   package-manager, installer, channel-switch, downgrade-confirmation, and
   fail-closed resolution behavior for stable.
3. **LTS backport tooling:** implement a repeatable workflow that selects an
   eligible reviewed fix, applies it to the active LTS branch, coordinates any
   required plugin backports across repositories under `openclaw`, and records
   validation and provenance.
4. **Documentation:** update user install and upgrade docs, maintainer release
   and backport runbooks, channel semantics, plugin compatibility guidance,
   support dates, and end-of-life or rotation guidance.

Release tooling must also reserve patch `33`, publish the monthly stable
selectors atomically or with a documented rollback, and verify the selectors
before the previous stable line is retired.

### Documentation and communication

OpenClaw must publish and keep current:

- The active stable monthly line and exact version.
- The support start date and expected next rotation.
- Exact install, upgrade, downgrade, and channel-switch commands.
- The relationship among `stable`, `daily`, `latest`, `beta`, and `dev`.
- The designated LTS surfaces and their integration-test coverage baselines.
- Known coverage gaps and prioritized tracking issues.
- The stable plugin support table and out-of-contract warning behavior.
- Stable backport eligibility and the rule that new features remain on daily.
- End-of-life and rollback guidance.

### Rollout plan

1. Adopt `YYYY.M.PATCH` and enforce patch `33` as the stable boundary.
2. Establish the integration-test coverage baseline for every designated LTS
   surface and create prioritized coverage-gap issues.
3. Implement stable install, update, selector, downgrade, and fail-closed
   behavior.
4. Implement LTS branch and cross-repository plugin backport tooling.
5. Update user and maintainer documentation.
6. Run the full stable validation bar against `2026.6.33`.
7. Publish `2026.6.33` as stable and advance daily to `2026.7.X`.
8. Backport only eligible security and reliability fixes to `2026.6.X`.
9. At the end of July, publish `2026.7.33` as stable, advance daily to
   `2026.8.X`, verify the new stable paths, and retire the June line.
10. Repeat the rotation monthly.

### Worked example

Immediately after the June 2026 rotation:

- Active stable base: `2026.6.33`.
- Newest stable patch after one reliability backport: `2026.6.34`.
- Active daily line: `2026.7.X`.

Expected resolution is:

| Action | Result |
| --- | --- |
| `npm install -g openclaw@stable` | Installs `2026.6.34`. |
| `openclaw update --channel stable` | Resolves to `2026.6.34`. |
| `openclaw update --channel daily` | Resolves to the newest `2026.7.X` daily release. |
| Pin `openclaw@2026.6.33` | Installs the June stable base exactly. |

At the end of July, `2026.7.33` becomes the stable base. Stable selectors move
to `2026.7.33`, daily moves to `2026.8.X`, and the June stable line retires only
after install and upgrade verification succeeds.

## Rationale

### A trailing monthly stable line

A completed month has already received daily usage before it becomes stable.
Keeping one trailing monthly line gives maintainers a bounded backport and
validation target while daily development continues on the next month.

### Patch 33 as the stable boundary

`YYYY.M.33` is recognizable and cannot be confused with a normal calendar day.
Reserving it makes the first stable version deterministic for users, release
automation, support, and documentation.

### Stable as a channel, LTS as a support contract

Users need one clear production target: stable. Maintainers still need the LTS
surface inventory, maintenance branch, coverage target, and prioritization
rules. Separating those meanings avoids adding a second user-facing version
family while retaining an explicit support contract.

### Security and reliability backports only

The stable line reduces change risk only if its scope stays narrow. New features
remain on daily and soak there before the next monthly promotion. Stable changes
therefore have a demonstrable security or reliability reason and targeted
validation evidence.

### Per-surface integration coverage

An aggregate coverage number can hide an untested supported surface. Measuring
and targeting greater than 90% for each designated LTS surface keeps the stable
promise tied to the actual supported product areas. Distinguishing this metric
from maturity-scorecard coverage prevents unrelated scoring systems from being
treated as release proof.

### Fail-closed stable resolution

Falling back from stable to daily would silently remove the support guarantee.
Failing closed forces maintainers to repair selector metadata or communicate a
release problem before users are moved to a faster-changing line.

## Unresolved questions

- What exact LTS branch naming convention and archive policy should the
  backport tooling enforce?
- How should `latest` map to `stable` or `daily` at launch, and does that mapping
  change the default install behavior?
- Which OpenClaw-maintained external plugins are included in the first stable
  plugin support table?
- When should greater than 90% integration-test coverage per LTS surface become
  a hard promotion gate rather than a disclosed operating target?
