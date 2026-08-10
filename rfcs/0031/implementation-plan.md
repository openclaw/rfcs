# RFC 0031 Implementation Plan

This sidecar translates RFC 0031 into bounded, dependency-aware repository
changes. PR boundaries are implementation guidance, not portable schema.

## Dependencies

- Merged RFC 0016 proposal and shipped experimental OpenClaw lifecycle; the RFC
  source remains draft-status pending graduation.
- RFC #48 conventional profile, bootstrap, and adapter addendum, still under
  design review while its implementation layers are merged.
- Existing experimental OpenClaw and ClawHub feature gates.

No public npm publication, stable-schema graduation, or Hermes support is a
prerequisite for this track.

## Draft Disposition

The previous structured-setup stack does not land in its current form. Its
first PR number is reused for the replacement first slice:

- [`openclaw/openclaw#115237`](https://github.com/openclaw/openclaw/pull/115237):
  rewritten as conventional profile discovery and native bootstrap; this is
  OpenClaw PR 1 below.
- [`openclaw/openclaw#115565`](https://github.com/openclaw/openclaw/pull/115565)
  setup-v2 and application planning: accepted schema-v1 extension planning and
  canonical plugin-owner behavior moved into #115962; setup schemas, resource
  roles, metadata profile pointers, and schema version 2 are superseded.
- [`openclaw/openclaw#115296`](https://github.com/openclaw/openclaw/pull/115296)
  persisted answers and setup mutation: superseded by native bootstrap; no
  answer ledger, configure command, setup database, or reconciliation behavior
  moves into the replacement stack.
- [`openclaw/openclaw#115371`](https://github.com/openclaw/openclaw/pull/115371)
  guided setup-template export: its schema-v2 implementation is superseded, but
  the PR number is reused for the bootstrap-native export-authoring follow-up
  below.
- [`openclaw/openclaw#115962`](https://github.com/openclaw/openclaw/pull/115962):
  rebuilt around schema v1 profile extensions and ordinary managed files; this
  is OpenClaw PR 2 below.
- [`openclaw/openclaw#112808`](https://github.com/openclaw/openclaw/pull/112808):
  closed and superseded as an independently landable read/status prerequisite.
- [`openclaw/openclaw#112828`](https://github.com/openclaw/openclaw/pull/112828):
  remains the single reconstruction target on current `main`, combining bounded
  read/status projections with Gateway mutation and guided lifecycle behavior,
  without form-schema or answer-state dependencies.

The superseded #115565 and #115296 branches are historical design evidence and
are not dependencies of the new stack. Their accepted extension work is
represented by #115962; closing them does not discard a live capability.

## OpenClaw Track

### PR 1: Conventional profile and native bootstrap

Merged: [`openclaw/openclaw#115237`](https://github.com/openclaw/openclaw/pull/115237)
as `60fc2fe64d8ec2988a555a638dc1074d31e5760b`.

- Replace `metadata.openclaw.config` lookup with optional fixed
  `profiles/openclaw.yml` discovery.
- Bind exact profile bytes into development and package integrity.
- Discover optional package-root `BOOTSTRAP.md`, disclose it in inspect and
  dry-run, and reject ordinary managed destinations targeting root bootstrap.
- Seed it through OpenClaw's existing new-agent bootstrap owner.
- Treat expected consumption as progress, never recreate it during update, and
  preserve user-owned outputs during remove. Remove only a still-pending
  `BOOTSTRAP.md` whose bytes match the applied digest.
- Update export and fixtures to emit conventional profile paths and omit
  consumed local bootstrap state.
- Keep all commands under `OPENCLAW_EXPERIMENTAL_CLAWS=1`.

### PR 2: Profile extension requirements and application content

Merged: [`openclaw/openclaw#115962`](https://github.com/openclaw/openclaw/pull/115962)
as `7774f9a36c12eb5f63e6ef33b3da2af065b09707`.

- Finalize OpenClaw profile schema version 1 with optional `extensions`, whose
  entries declare shared host requirements rather than Claw-owned members.
- Support strict `openclaw`, `claude`, `codex`, and `cursor` format assertions.
- Delegate detection, safety scanning, package preflight, installation,
  readiness, update, uninstall warnings, and cleanup to canonical plugin owners.
- Classify requirements as satisfied, missing-installable, conflicting, or
  setup-required; bind approved missing installs into plan integrity and run
  them before Claw-owned agent/workspace mutation.
- Persist extension dependency edges as referenced resources even when Claw add
  introduced the global plugin. Default remove releases only the Claw edge,
  retains the plugin, and reports that add introduced it.
- Preserve exact opt-in plugin cleanup through `remove-selected` /
  `--remove-referenced` as a separate canonical owner action, with dry-run,
  plan-integrity consent, known-owner disclosure, an unknown-agent-use warning,
  and canonical plugin uninstall behavior.
- Include exact extension effects and adapter identity in plan integrity and
  provenance.
- Report mapped, detect-only, unavailable, unsupported, and compatibility-drift
  states through inspect, status, and doctor.
- Preserve existing experimental portable plugin entries for reads while
  exporting new native dependencies into `profiles/openclaw.yml`.
- Prove schemas, references, templates, examples, fixtures, and static assets
  need no new manifest role or lifecycle beyond `workspace.files`.

### PR 3: Bootstrap-native export authoring

Merged: [`openclaw/openclaw#115371`](https://github.com/openclaw/openclaw/pull/115371)
as `a3094582ffc5473df9a48be4486f3f240e14484f`.

- Let an author explicitly select a reviewed local Markdown file to become the
  exported package-root `BOOTSTRAP.md`.
- Validate bounded, nonempty UTF-8 content and reject root-bootstrap managed-file
  collisions through the existing package reader.
- Re-read the complete exported package so the bootstrap bytes participate in
  the same package integrity and inspection contract as hand-authored packages.
- Remove an incomplete export target on validation failure.
- Warn authors that bootstrap is package-authored prompt content and must not
  contain credentials, tokens, private answers, or machine-specific paths.
- Do not infer setup questions, rewrite personal files, render templates,
  persist answers, add `claws configure`, or introduce schema version 2.

### PR 4: Gateway lifecycle API

Remaining implementation:
[`openclaw/openclaw#112828`](https://github.com/openclaw/openclaw/pull/112828),
reconstructed directly on current `main`. The former read prerequisite
[#112808](https://github.com/openclaw/openclaw/pull/112808) is closed and
superseded rather than a live dependency.

- Expose bounded inspect, add-plan, add, status, doctor, update-plan, update,
  remove-plan, remove, and export services over the canonical Claw owners.
- Expose authorized exact manifest/effect expansion and redacted default
  projections without leaking source bytes or secret values.
- Report native bootstrap progress and canonical owner prerequisites.
- Advertise methods only while the experimental gate is enabled and fail closed
  for direct disabled calls.
- Keep the API presentation-neutral so CLI, TUI, automation, and browser clients
  share outcomes.

### PR 5: Control UI experience

Remaining implementation is the same single current-main reconstruction:
[`openclaw/openclaw#112828`](https://github.com/openclaw/openclaw/pull/112828).
It includes the bounded read/status projection previously separated into
superseded #112808.

- Add experimental Claw discovery, detail, preview, consent, progress, update,
  remove, and export views.
- Present overview, preview, add, personalize, connect, and ready stages using
  Gateway-produced state.
- Route native bootstrap to the existing agent conversation rather than parsing
  package instructions or storing answers in the browser.
- Label bootstrap as package-authored, warn against pasting secrets, and route
  credentials and integrations only through host-owned canonical setup controls.
- Render extension mapping and compatibility drift, managed/referenced
  ownership, retained user files, and applied-versus-ready status.
- Add responsive, keyboard, focus, reconnect, invalidated-plan, partial-outcome,
  and disabled-gate tests.

## Standalone Reference CLI Track

The standalone `claws` repository supplies the reference lifecycle entry point:

1. Parse and validate schema-v1 packages, conventional profiles, bootstrap, and
   safe managed sources.
2. Resolve source, choose `--agent <adapter>`, preview exact effects, bind
   consent, and delegate host lifecycle ownership to the selected adapter.
3. Use an OpenClaw adapter that invokes `openclaw claws add` across an external
   process boundary without importing or reproducing OpenClaw policy.
4. Use a bounded Codex adapter to create a new project workspace from portable
   prompt/bootstrap instructions and ordinary workspace files. It ignores
   foreign profiles and fails closed on required semantics it cannot represent.

Merged implementations:

- [`giodl73-repo/claws#1`](https://github.com/giodl73-repo/claws/pull/1):
  schema-v1 parser, source providers, constructor, consent flow, and OpenClaw
  adapter, merged as `530d5edb56618814ad3526dc4af494157a389e6e`.
- [`giodl73-repo/claws#3`](https://github.com/giodl73-repo/claws/pull/3):
  portable-core Codex workspace adapter and one-package/two-host conformance
  fixture, merged as `250e41588a54d23ab53b49eef5e7b2eeee83ea03`.
  It replaces closed, superseded #2.

No package is published to npm until maintainers approve the name, repository,
release process, and initial compatibility contract.

## ClawHub Track

The registry layers have merged:

- [`openclaw/clawhub#3328`](https://github.com/openclaw/clawhub/pull/3328)
  aligned conventional profiles, native bootstrap, and bounded summaries with
  schema v1.
- [`openclaw/clawhub#3359`](https://github.com/openclaw/clawhub/pull/3359)
  restricted publication to already-built npm-compatible `.tgz` artifacts and
  preserved exact bytes and digest identity through retry and download.

Together they:

- remove `metadata.openclaw.config` validation;
- discover and structurally validate optional conventional profiles;
- validate optional package-root `BOOTSTRAP.md` as safe bounded UTF-8 content;
- validate OpenClaw profile v1 extension structure without executing bundles or
  claiming applying-version compatibility;
- retain exact artifacts as authority and expose only bounded safe summaries;
- preserve `CLAWHUB_EXPERIMENTAL_CLAWS=1` fail-closed reads and routes.

## Awesome Claws Track

The example migration and complete golden proof have merged:

- [`giodl73-repo/awesome-claws#1`](https://github.com/giodl73-repo/awesome-claws/pull/1)
  migrated the corpus to the schema-v1 application contract.
- [`giodl73-repo/awesome-claws#5`](https://github.com/giodl73-repo/awesome-claws/pull/5)
  replaced superseded #2 and proved one exact artifact through build,
  publication, download, extraction, clean add, status, doctor, and removal.

The merged corpus:

- keep `schemaVersion: 1`;
- remove profile metadata pointers;
- move native plugin dependencies into conventional profiles;
- replace structured setup/templates with reviewed package-root
  `BOOTSTRAP.md` where onboarding is useful;
- keep reusable content as ordinary managed files in readable directories;
- remove invented `dashboard` tool names and use `show_widget` with complete
  Markdown/message fallback where appropriate;
- validate every example from a clean OpenClaw state.

## End-to-End Proof

Minimum proof before asking maintainers to land the full track:

1. Inspect a local package with no profile and inherited defaults.
2. Inspect a package with `profiles/openclaw.yml`, one native extension,
   managed schemas/assets, and package-root `BOOTSTRAP.md`.
3. Add dry-run discloses every effect without mutation or secret resolution.
4. Consented add resolves satisfied requirements, installs approved missing
   requirements through canonical owners before Claw-owned mutation, creates
   one new agent, and seeds bootstrap exactly once.
5. First chat/TUI turn labels package-authored onboarding, does not inject
   secrets, and consumes bootstrap without status drift.
6. The agent uses `show_widget` when available and returns equivalent useful
   Markdown when it is not.
7. Status distinguishes applied, bootstrap-pending, owner-setup-required,
   extension-incompatible, and ready states.
8. Update preserves user-owned personalization, managed-file drift rules, and
   unchanged extension dependency edges.
9. Remove preserves user-owned outputs, releases extension dependency edges,
   retains referenced extensions by default, and reports which were introduced
   by add. Separately selected plugin cleanup shows known owners, warns that
   unrecorded agent use cannot be disproved, and delegates to canonical
   uninstall.
10. ClawHub publication/search/download feeds the exact same artifact into a
    clean OpenClaw add dry-run.
11. Control UI produces the same plan identity and lifecycle outcome as CLI for
    the same exact source and local state.
12. One schema-v1 package produces separate host-native OpenClaw and Codex
    previews; the Codex adapter proves project-oriented projection without
    OpenClaw agent CRUD or silent loss of required capabilities.
13. Bootstrap-native export attaches an explicit reviewed `BOOTSTRAP.md`,
    re-inspects the finished package, and leaves no partial target after a
    validation failure.

## Landing Status

Merged:

1. OpenClaw [#115237](https://github.com/openclaw/openclaw/pull/115237),
   [#115962](https://github.com/openclaw/openclaw/pull/115962), and
   [#115371](https://github.com/openclaw/openclaw/pull/115371).
2. Standalone Claws [#1](https://github.com/giodl73-repo/claws/pull/1) and
   replacement [#3](https://github.com/giodl73-repo/claws/pull/3).
3. ClawHub [#3328](https://github.com/openclaw/clawhub/pull/3328) and
   [#3359](https://github.com/openclaw/clawhub/pull/3359).
4. Awesome Claws [#1](https://github.com/giodl73-repo/awesome-claws/pull/1)
   and replacement [#5](https://github.com/giodl73-repo/awesome-claws/pull/5).

Remaining:

1. RFC #48 and RFC #52 maintainer review.
2. OpenClaw [#112828](https://github.com/openclaw/openclaw/pull/112828),
   reconstructed on current `main` as the single Gateway and Control UI
   lifecycle slice. Closed #112808 is not a prerequisite.

Each PR must be independently testable, signed, rebased on its real base, and
kept behind the existing experimental gate. No step merges or publishes as a
side effect of this plan.
