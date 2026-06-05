---
title: Doctor Health Upgrades
authors:
  - giodl73-repo
created: 2026-05-27
last_updated: 2026-05-28
rfc_pr: https://github.com/openclaw/rfcs/pull/1
---

# Proposal: Doctor Health Upgrades

## Summary

Upgrade Doctor health checks so core Doctor rules and extension-provided health checks share one structured execution model without forcing a rewrite of every existing Doctor rule. Doctor's existing core contribution order remains the source of truth for built-in checks, the health registry remains the extension and structured-health surface, and individual rules can migrate in place from structured `detect` output through preview repair and finally to full structured repair when that is safe.

## Motivation

Doctor has long had a core sequence of checks that users experience as the normal `doctor` and `doctor --fix` flow. The health registry is also the natural place for plugin and bundled extension health checks. If upgraded core checks are moved into the shared registry without preserving Doctor's contribution order, lint and repair can drift from the historical Doctor flow.

Many existing rules are written as one imperative `run` function that prints notes, asks prompts, detects problems, and optionally repairs them. Forcing all of those rules to split into `detect` and `repair` at once creates large PRs and raises compatibility risk. The migration should recognize the existing pattern instead of fighting it.

Doctor's human output is useful, but automation needs stable finding fields: check id, severity, message, path, line, and fix hint. Without structured findings, `doctor --lint --json` cannot be a reliable contract for CI, UI, or other tools.

A useful dry-run should report what would change. For config and file repairs, that means diffs. For non-file side effects, that means structured effects such as "would delete stale lock", "would rebuild UI assets", or "would quarantine legacy state". Not every rule can provide this immediately, but the contract should make it a normal upgrade path.

## Goals

- Preserve the existing order and behavior of core Doctor checks.
- Make `doctor --lint` report structured findings for upgraded core checks.
- Let extensions register health checks through one registry surface.
- Support small in-place migrations instead of large rewrites of Doctor rules.
- Support dry-run repair previews, diffs, and effects for rules that can provide them.
- Keep real repair behavior backward compatible until each rule intentionally moves to the structured execution path.
- Make the migration easy to review: the code change for one rule should mostly be detection, preview, and tests.

## Non-Goals

- Replacing every existing Doctor rule in one migration.
- Reordering core Doctor checks.
- Making extension health checks run before core Doctor checks.
- Requiring every rule to implement dry-run repair, diffs, or effects immediately.
- Defining policy semantics or policy-specific health behavior. This RFC is about Doctor health execution and migration mechanics.
- Changing the public plugin SDK unless a separate RFC proposes that surface.

## Proposal

The RFC contract is intentionally incremental: core Doctor contributions keep owning order and legacy repair behavior, while structured health data is added at the contribution boundary. The shared registry remains the extension surface and the append-only source for non-core checks.

Built-in Doctor checks continue to be declared as Doctor health contributions. That list owns core ordering for `doctor`, `doctor --fix`, and `doctor --lint`.

```ts
createDoctorHealthContribution({
  id: "doctor:some-rule",
  label: "Some rule",
  run: runSomeRuleHealth,
})
```

This is the legacy-compatible form. The rule runs exactly where it did before.

When a core rule is upgraded, it adds structured health beside the existing Doctor contribution. If the contribution has a single health check, the core health id can be derived from the contribution id:

```ts
createDoctorHealthContribution({
  id: "doctor:some-rule",
  label: "Some rule",
  run: runSomeRuleHealth,
  healthChecks: {
    description: "Some rule is valid.",
    async detect(ctx) {
      return detectSomeRuleFindings(ctx);
    },
  },
})
```

In this shape, legacy `run` still owns real Doctor behavior. The structured health check supplies lint findings and can be used by health tooling.

If a rule can explain its repair without mutating state, it can add structured repair output while still leaving real mutation on the legacy path.

```ts
createDoctorHealthContribution({
  id: "doctor:some-rule",
  label: "Some rule",
  run: runSomeRuleHealth,
  healthChecks: {
    description: "Some rule is valid.",
    async detect(ctx) {
      return detectSomeRuleFindings(ctx);
    },
    async repair(ctx, findings) {
      return previewSomeRuleRepair(ctx, findings);
    },
  },
})
```

This supports `doctor --lint` and dry-run/diff/effects without changing the real `doctor --fix` path.

Some rules are easier to express as one flow with a repair flag. For those rules, structured health can use `run(ctx, scope)` instead of split `detect` and `repair`.

```ts
createDoctorHealthContribution({
  id: "doctor:some-rule",
  label: "Some rule",
  healthChecks: {
    description: "Some rule is valid.",
    async run(ctx, scope) {
      const findings = await detectSomeRuleFindings(ctx, scope);
      if (!ctx.repair && !ctx.previewRepair) {
        return { findings };
      }
      if (ctx.previewRepair) {
        return previewSomeRuleRepair(ctx, findings);
      }
      return repairSomeRule(ctx, findings);
    },
  },
})
```

This is the full structured form. If the legacy contribution `run` is removed, the structured check owns the contribution execution path.

When one Doctor contribution owns multiple health checks, each check should declare its id explicitly:

```ts
createDoctorHealthContribution({
  id: "doctor:browser",
  label: "Browser",
  healthChecks: [
    {
      id: "core/doctor/browser",
      description: "Browser readiness is valid.",
      async detect(ctx) {
        return collectBrowserReadinessFindings(ctx);
      },
    },
    {
      id: "core/doctor/browser-profile-residue",
      description: "Legacy browser profile residue is absent.",
      async detect(ctx) {
        return detectBrowserResidueFindings(ctx);
      },
      async repair(ctx, findings) {
        return previewOrArchiveBrowserResidue(ctx, findings);
      },
    },
  ],
})
```

This avoids implicit id collisions and keeps JSON output stable.

The shared health registry remains the place for bundled extensions, plugins, and other non-core surfaces to register health checks. Core Doctor checks should not need to move into that registry to become structured. The lint runner should resolve checks in this order:

1. Ordered core Doctor contribution health checks.
2. Registered extension health checks.

Structured repair should be able to return findings, repair status, change summaries, file or config diffs, non-file effects, and warnings that do not fit as lint findings. For `doctor --lint`, findings are the primary output. For dry-run repair, findings plus diffs and effects explain what `doctor --fix` would do. For real repair, the same shape can report what changed after mutation. Rules that cannot safely produce dry-run or diff output may start with structured `detect` only.

The migration plan is:

1. Add the contribution-owned health check path for core Doctor checks.
2. Keep the shared registry as the extension health registration surface.
3. Make lint resolve ordered core contribution checks before extension checks.
4. Add tests that prove core ordering, extension append behavior, duplicate id rejection, and legacy `run` fallback behavior.
5. Migrate simple rules first by adding `healthChecks.detect` beside existing `run`.
6. Add preview repair, diffs, and effects where a rule already has a natural repair plan.
7. Move a rule fully to structured `run` or split `detect`/`repair` only when that makes the rule simpler and preserves behavior.

The shell completion Doctor rule is a good first example because it shows both the current bridge shape and the target contribution-owned shape. The first merged shell-completion migration registered `core/doctor/shell-completion` as a structured health check and kept real repair on the existing positional Doctor path:

```ts
const SHELL_COMPLETION_CHECK_ID = "core/doctor/shell-completion";

registerHealthCheck({
  id: SHELL_COMPLETION_CHECK_ID,
  kind: "core",
  description: "Shell completion profile and cache are ready.",
  async run(ctx, scope) {
    const { runShellCompletionHealth } = await import(
      "../commands/doctor-completion.js"
    );
    return runShellCompletionHealth(ctx, scope);
  },
});
```

That was a safe first step, but it is not the desired final pattern for core Doctor rules. The target shape is for the existing Doctor contribution to declare the structured health beside the legacy real repair path:

```ts
createDoctorHealthContribution({
  id: "doctor:shell-completion",
  label: "Shell completion",
  healthChecks: {
    id: "core/doctor/shell-completion",
    description: "Shell completion profile and cache are ready.",
    async run(ctx, scope) {
      return runShellCompletionHealth(ctx, scope);
    },
  },
  run: runLegacyShellCompletionDoctorRepair,
})
```

In this shape, `doctor --lint` reports `core/doctor/shell-completion` through the ordered core contribution path, while `doctor --fix` can continue to use the legacy repair path until the rule intentionally moves fully behind structured health.

## Rationale

The chosen approach preserves the behavior users already depend on while giving upgraded rules structured output for lint, preview repair, and automation. Moving all core Doctor checks into the shared registry would simplify the model superficially, but it would also make core ordering easier to disturb and would blur the distinction between built-in Doctor behavior and extension-provided health checks.

A full rewrite of every Doctor rule into `detect` and `repair` would produce a cleaner end state, but it would create large review surfaces and increase compatibility risk. Contribution-owned structured health lets each rule migrate when its detection and repair boundaries are clear.

Existing `doctor` and `doctor --fix` behavior should stay byte-for-byte close unless a specific rule PR intentionally changes behavior. Existing core check order should remain stable. Existing note rendering should continue to use the normal Doctor presentation path, and notes should not be routed through lint findings unless they are true findings. A rule with legacy `run` and structured health should use structured health for lint and preview repair, while legacy `run` remains the real repair path. A rule without legacy `run` must provide structured health capable of owning the contribution execution path. Extension health checks should not be able to shadow core check ids.

## Unresolved questions

- Should `doctor --lint` and `doctor --dry-run` remain separate user-facing modes, or should lint become the primary non-mutating health surface with optional preview details?
- Should every upgraded repair-capable check be required to return `effects`, even when it also returns diffs?
- Should full structured repair validate by running detection again after a successful repair, and should that be opt-in at first?
- How much of this contract should become public plugin SDK versus remaining an internal Doctor/health runner contract?
- Should lint severity distinguish user-actionable warnings from informational notes more strictly?
