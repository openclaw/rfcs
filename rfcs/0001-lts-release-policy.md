---
title: OpenClaw LTS Release Policy
authors:
  - Kevin Lin
created: 2026-05-27
last_updated: 2026-05-28
status: accepted
issue:
rfc_pr: TBD
---

# Proposal: OpenClaw LTS Release Policy

## Summary

Add an opt-in OpenClaw support channel by designating selected monthly release
lines for longer support. The fast/latest train remains the default install and
update path, while `lts` becomes a first-class package and update target backed
by support-line tags, explicit support dates, narrow backport rules, and
documented plugin compatibility.

## Motivation

OpenClaw's fast stable cadence gives users quick access to fixes and
improvements, but some operators need a lower-churn supported line for
production or enterprise deployments. Those users need predictable install
commands, a bounded support window, explicit backport criteria, and a clear
answer for whether core packages and plugins remain compatible.

The LTS policy should provide that stability without creating a second default
release train. The fast/latest stable release remains the proving ground.
Maintainers select a monthly line for support only after it has shipped, soaked,
and produced the normal release evidence.

## Goals

- Preserve the fast/latest `stable` train as the default install and update
  target.
- Add `lts` as an explicit opt-in channel for package installs and
  `openclaw update`.
- Use SemVer-compatible monthly lines: `YYYY.M.PATCH`.
- Keep beta on the fast/latest train as prereleases such as
  `YYYY.M.PATCH-beta.N`.
- Maintain one trailing monthly support line by default as the first step.
- Define the LTS support window, eligible backports, validation bar, docs
  obligations, and end-of-life behavior.
- Make bundled and explicitly-covered official plugin compatibility part of
  the support contract.
- Fail closed when no active LTS artifact exists.

## Non-Goals

- Changing the default fast/latest release cadence.
- Making LTS the default install target.
- Introducing a new `-lts` version suffix or version family.
- Guaranteeing support for every external plugin.
- Backporting normal feature work, refactors, or broad compatibility churn.
- Blocking fast/latest stable releases on LTS maintenance work.
- Defining a multi-line LTS program before maintainers intentionally expand
  support capacity.

## Proposal

### Policy model

OpenClaw LTS is a support designation applied to a selected monthly release
line after that line ships through the normal release process. LTS is additive:
it does not replace `stable`, `beta`, or `dev`, and it does not slow the
fast/latest stable train.

The initial policy is:

- `stable` remains the default user-facing version and continues to track the
  newest stable release in the fast/latest train.
- Maintainers may designate an already-shipped monthly line as the active LTS
  line.
- Monthly-line releases use `YYYY.M.PATCH`. For example, `2026.6.0`,
  `2026.6.1`, and `2026.6.2` are all June 2026 line releases.
- Patch numbers can grow as high as needed, so multiple releases on the same
  day are handled by incrementing `PATCH`.
- Beta remains the fast/latest train prerelease channel, for example
  `2026.6.3-beta.1`.
- Future support tags may point at monthly lines, for example `stable-2026-6`
  or `lts-2026-6`.
- OpenClaw supports one trailing monthly support line by default as the first
  step, not a long LTS promise.
- Users opt in through `openclaw update --channel lts`, `openclaw@lts`, or an
  installer option that resolves to the same LTS package target.

### LTS selection

Maintainers may designate a monthly line as LTS only when all of the following
are true:

- The release already shipped as a normal stable release through the existing
  release flow.
- The release has full release evidence, including the release checklist and a
  successful `Full Release Validation` run.
- The release has a documented upgrade and rollback story that does not require
  operator-only recovery for normal install or update paths.
- The release has a published compatibility coverage table for bundled plugins
  and any official external plugins covered by the LTS promise.
- The release has soaked long enough in the stable population for maintainers to
  judge it lower risk than the moving fast/latest tip.

This makes LTS a promotion decision on a stable artifact, not a parallel
artifact-build process.

### Support window

The first support-line step is intentionally short: one trailing monthly support
line at a time. The support window should be long enough to build branch, patch,
validation, docs, and update-channel muscle, without making a long LTS promise
before the process has proven itself.

The policy can expand later toward quarterly or yearly support lines and 4-12
month support windows after the monthly support-line process works.

At end of life, users should move to either the current fast/latest `stable`
line or the next designated LTS line. Before the active LTS line reaches end of
life, maintainers must retarget the active LTS selector to the next supported
line.

### Eligible backports

LTS backports are intentionally narrow. Eligible changes are:

- Security fixes.
- Dependency or packaging fixes required to keep installation, update, signing,
  notarization, or registry publication working.
- Critical regressions in core agent, gateway, update, or packaged install
  flows.
- Upgrade blockers from the base LTS release or an earlier patch in the same
  LTS line.
- Bundled-plugin or explicitly-supported official-plugin compatibility fixes.
- Release-blocking docs or operator guidance corrections where the current docs
  would cause normal install, upgrade, or recovery paths to fail.

The following changes are not eligible by default:

- New features.
- New default behavior.
- Normal refactors.
- New provider, channel, plugin, or product surfaces.
- Broad compatibility churn that is not required to preserve the LTS contract.

Fixes land on `main` first, then are cherry-picked to the maintained LTS branch.

### Branch, tag, and publish mechanics

The normal fast/latest stable process publishes SemVer-compatible monthly-line
versions from `main` using `YYYY.M.PATCH`. LTS designation adds active-channel
metadata and a maintenance selector around an already-published monthly line.

The active LTS branch model is:

- Maintainers create an active support branch or tag selector from the selected
  monthly line.
- The active support branch or tag selector is the canonical git-side selector
  for the active LTS line.
- LTS patches use normal patch increments within the monthly line, for example
  `2026.6.1` and `2026.6.2`.
- `main` continues to move independently and is never gated by LTS maintenance.
- When an LTS line retires, maintainers retarget the active support selector to
  the next active LTS line and may preserve the retired line for history.

The package publication model is:

- The initial LTS designation moves or adds npm dist-tag `lts` to the exact
  already-published stable version.
- Designation does not rebuild or republish different bytes for the base
  stable release.
- Later LTS patch releases move npm dist-tag `lts` or a future line-specific
  support tag such as `stable-2026-6` or `lts-2026-6` forward to the newest
  supported `YYYY.M.PATCH` release in the same monthly line.
- Token-bearing dist-tag mutation should reuse the existing private dist-tag
  workflow and operator path.
- Active LTS docs and compatibility tables are updated in the same designation
  or patch window as the dist-tag move.

### Install and update semantics

`stable` remains the default channel and resolves to the newest stable release
in the fast/latest train. `lts` is explicit and resolves to the active
supported LTS line.

The package-manager path for a new LTS install is:

```bash
npm install -g openclaw@lts
openclaw update --channel lts
```

The installer path should expose the same target:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm --version lts
openclaw update --channel lts
```

The existing-install path is:

```bash
openclaw update --channel lts
```

If the current install is newer than the active LTS line, switching to LTS may
be a downgrade. OpenClaw should surface that clearly using the existing
downgrade-prompt behavior.

Resolution rules:

- `openclaw update --channel stable` targets the newest stable release in the
  fast/latest train.
- `openclaw update --channel lts` targets the active supported LTS line.
- npm installs on the LTS channel resolve through npm dist-tag `lts`.
- git installs on the LTS channel follow the active support branch or tag
  selector and select the newest `YYYY.M.PATCH` release reachable from that
  selector.
- Exact LTS versions and tags remain supported for pinned installs and
  diagnostics.
- Update status should distinguish configured channel from resolved artifact.
- Persisted `update.channel = lts` should reuse stable-class auto-update delay
  and jitter behavior.

LTS resolution must fail closed when no active LTS artifact exists. It must not
silently fall back to `latest`.

### Version identity

OpenClaw should express LTS through channel and support metadata, not through a
new version suffix.

- Future base LTS releases use monthly-line form `YYYY.M.PATCH`.
- Future LTS patches increment the normal patch number within that monthly line,
  for example `2026.6.0`, `2026.6.1`, and `2026.6.2`.
- `lts` is represented by update-channel and dist-tag selection.
- Future support tags may identify the monthly line explicitly, for example
  `stable-2026-6` or `lts-2026-6`.

Beta remains the fast/latest train prerelease mechanism, for example
`2026.6.3-beta.1`. A new `-lts.N` shape would expand OpenClaw's custom version
semantics while looking like a prerelease to generic SemVer tooling.

### Plugin support

The LTS promise must name its plugin scope.

- Bundled `@openclaw/*` plugins that ship with the LTS core artifact are covered
  by the same support-line patch policy.
- First-party `@openclaw/*` plugins bundled in normal OpenClaw builds follow the
  LTS policy as part of the LTS artifact, even when they also exist as separate
  fallback packages.
- Official external plugins are covered only when the active LTS docs list them
  in the plugin LTS table.
- Unpinned `default` or `latest` plugin specs are outside the LTS contract
  unless OpenClaw resolves them through the plugin LTS table.
- Untrusted third-party plugins remain user-managed and are never implicitly
  rewritten onto an LTS-specific target.

When `openclaw update --channel lts` encounters a tracked official external
plugin listed in the active LTS table, OpenClaw should resolve that plugin by
deriving the same-version npm or ClawHub spec from catalog metadata. Exact
pinned external plugin specs are not rewritten unless the table names an
explicit LTS target.

When a tracked official external plugin is not listed in the active LTS table,
OpenClaw should complete the core LTS update, leave the plugin unchanged, and
emit a structured warning that the plugin is outside the LTS support promise.

### Plugin LTS table

The first LTS release should use a checked-in Markdown table as the plugin
support source of truth. The table answers "which plugins are under LTS?" The
monthly-line `YYYY.M.PATCH` version scheme answers "which version?"

Covered external plugins use the same version as the active LTS core by
default. For example, active core LTS `openclaw@2026.6.11` maps a covered
WhatsApp plugin to `@openclaw/whatsapp@2026.6.11` or
`clawhub:@openclaw/whatsapp@2026.6.11`.

The active LTS docs should publish a table in this shape:

| Plugin | Package or install spec | LTS status | LTS version | Notes |
| --- | --- | --- | --- | --- |
| Bundled `@openclaw/*` plugins | Included in `openclaw` | Covered | Same as `openclaw@lts` | Covered by core release validation. |
| `whatsapp` | `@openclaw/whatsapp` or `clawhub:@openclaw/whatsapp` | Covered | Same as `openclaw@lts` | Example official external plugin once package acceptance passes. |
| Any official external plugin not listed above | Current user install | Not covered | Unchanged | `openclaw update --channel lts` warns and leaves it pinned. |

The table should be deliberately small for the first LTS line. Maintainers can
add rows as official external plugins gain release proof. JSON or a dedicated
compatibility registry can wait until the table becomes hard to maintain.

Table validation must prove:

- every covered plugin row matches a bundled plugin or official external package
  in the generated plugin inventory
- every covered official external plugin has package acceptance proof
- every same-version derived npm or ClawHub spec is syntactically valid
- no covered target uses `latest`, `default`, or an unversioned package spec

The structured warning should include `pluginId`, `packageName`, current install
spec or version when known, active LTS version, and a stable reason code such as
`outside_lts_contract`.

### Validation bar

Before designating a release as LTS, OpenClaw should have:

- Full release checklist evidence from the existing stable release flow.
- `Full Release Validation` at `release_profile=full`.
- Package acceptance against the exact published version.
- Cross-OS packaged install and upgrade proof.
- Upgrade proof from the base LTS release to the latest support-line patch in
  that line, when a patch exists.
- Plugin compatibility proof for bundled plugins and any explicitly-covered
  official plugins.
- A validated Markdown plugin LTS table for the active line.
- Published docs that name the active LTS version, support window, install
  commands, compatibility scope, and end-of-life date.

For LTS patch releases, maintainers may reuse previous umbrella evidence and
rerun the smallest affected release-validation box, but each patch still needs
exact-version package proof before announcement.

### Documentation and communication

OpenClaw must publish and keep current:

- The active LTS version.
- Support start and end dates.
- Exact install and update commands.
- The plugin LTS table.
- The structured warning users see when a tracked plugin is outside the LTS
  contract.
- Which fixes qualify for backport consideration.
- The rule that `stable` remains the default fast/latest recommendation.

### Rollout plan

1. Adopt this policy and choose the first trailing monthly support line.
2. Add the active LTS branch, tag, validation, compatibility, and docs
   obligations to the release runbook.
3. Implement SemVer-compatible monthly-line versioning with `YYYY.M.PATCH` and
   beta prereleases such as `YYYY.M.PATCH-beta.N`.
4. Add npm `lts` dist-tag promotion, future line tags such as `stable-2026-6`
   or `lts-2026-6`, and `openclaw update --channel lts`.
5. Add fail-closed LTS resolution for package and git install paths.
6. Add the Markdown plugin LTS table, lightweight validation, and updater
   warnings for official external plugins that are not listed.

### Worked example

Assume:

- The newest stable release is `2026.6.18`.
- The active LTS base release is `2026.6.10`.
- The newest LTS patch is `2026.6.11`.

Then expected resolution is:

| Action | Result |
| --- | --- |
| `npm install -g openclaw@latest` | Installs `2026.6.18`. |
| `npm install -g openclaw@lts` | Installs `2026.6.11`. |
| `openclaw update --channel stable` | Resolves to `2026.6.18`. |
| `openclaw update --channel lts` | Resolves to `2026.6.11`. |

Default users keep following the moving fast/latest stable train. LTS users
follow the maintained LTS line. Version numbers stay SemVer-compatible while
preserving monthly-line identity.

## Rationale

### Monthly support lines

Monthly `YYYY.M.PATCH` lines preserve OpenClaw's calendar identity while giving
support lines normal SemVer patch behavior. Patch numbers can grow as high as
needed, including multiple releases on the same day.

### Channel designation instead of an `-lts` suffix

LTS is a support contract, not a new artifact identity. Channel designation
keeps generic SemVer tooling behavior predictable and avoids teaching OpenClaw
that named suffixes can be stable support releases.

### Promotion after stable instead of a parallel release train

Selecting an already-shipped monthly line lets the fast/latest train remain the
quality gate and soak period. A parallel LTS factory would add build and release
complexity while reducing confidence that LTS artifacts match what users already
validated in stable.

### One trailing monthly support line by default

One trailing monthly support line keeps support, validation, docs, and plugin
compatibility work bounded while maintainers build the process. Quarterly or
yearly lines and 4-12 month windows can be added later only if maintainers have
the release capacity and automation to keep each line healthy.

### Same-version plugin compatibility instead of `latest`

Core LTS stability is undermined if plugin resolution keeps following moving
`latest` or `default` specs. Same-version plugin resolution keeps covered
official plugins aligned with the active LTS core line, while the Markdown table
makes the supported plugin set obvious.

### Markdown table instead of a compatibility registry

The existing plugin compatibility registry tracks plugin-facing contract
adapters and deprecation windows. The first LTS release only needs to tell users
which plugins are included in the support promise. A Markdown table is enough for
that, and it keeps package-support state out of the API migration registry.

### Fail-closed resolution instead of falling back to stable

Falling back from `lts` to `latest` would silently erase the support promise.
Failing closed forces maintainers to fix designation metadata or publish a clear
message before users are moved onto a different release lane.

## Unresolved questions

- Which already-shipped stable release should be the first LTS candidate?
- Which docs surface should become the canonical active-LTS landing page?
- Which official external plugins should be included in the first LTS table?
