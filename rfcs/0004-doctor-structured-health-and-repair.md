---
title: Doctor Structured Health and Repair
authors:
  - Gio Della-Libera
created: 2026-05-27
last_updated: 2026-07-15
status: accepted
issue:
rfc_pr:
---

# Proposal: Doctor Structured Health and Repair

## Summary

Define one structured health contract for OpenClaw Doctor while preserving the ordered, human-oriented Doctor flow that existing users depend on. Core Doctor contributions retain their execution order; `doctor --lint` consumes stable structured findings; `doctor --fix` may use structured repair when a rule owns a safe mutation; and extension checks use the shared health registry and plugin SDK contract.

The tracked migration has reached structured lint coverage for all 44 legacy Doctor rule families. The default automation set remains intentionally smaller than the complete inventory, so `doctor --lint --all` includes opt-in checks without making deep, historical, live-environment, or legacy-residue findings part of every default gate.

The normative contract is in [Doctor structured health and repair specification](0004/structured-health-and-repair-v1-spec.md).

## Motivation

Doctor began as an ordered imperative flow. Individual rules could print notes, ask questions, inspect state, and mutate config or files inside one `run` function. That model is useful for interactive repair, but automation needs stable findings, deterministic selection, machine-readable output, and explicit mutation results.

A forced rewrite of every rule into a new execution engine would have created large review surfaces and risked changing established repair behavior. The migration instead added structured health at the contribution boundary. Rules could first expose detection, then add repair where the mutation was understood, while the legacy contribution continued to own behavior that was not ready to move.

That incremental approach completed the tracked 44-of-44 legacy rule-family lint migration. It also revealed that "all checks" and "checks suitable for a default CI gate" are not the same set. Some checks are deep, historical, live-environment-sensitive, account-specific, or focused on repairable legacy residue. `--all` makes those checks discoverable without making default lint noisy or unsafe.

Structured repair now has the core plumbing for diffs, effects, repair status, and post-repair validation. A general Doctor repair dry-run remains future work: the contract is ready, but the product must not claim truthful preview coverage until mutation-bearing rules provide complete plans and the CLI has an approved entry point.

## Goals

- Preserve core Doctor contribution order and established interactive behavior.
- Give every tracked legacy Doctor rule family a structured lint path.
- Keep `doctor --lint` read-only, deterministic, and suitable for automation.
- Distinguish the stable default lint set from the complete opt-in inventory.
- Support exact selection with `--only` and exclusion with `--skip`.
- Keep structured findings stable enough for CI, UI, and support tooling.
- Let rules add structured repair without requiring an all-at-once rewrite.
- Report structured changes, diffs, effects, skipped repairs, failures, and validation warnings.
- Keep the shared health registry and plugin SDK health contract as the extension surface.
- Leave general repair dry-run as a separately reviewed future project.

## Non-Goals

- Rewriting every legacy Doctor mutation into structured repair immediately.
- Making every registered check part of default `doctor --lint`.
- Making `doctor --lint --all` clean on an unconfigured or legacy install.
- Treating informational Doctor notes as warnings merely to make them structured.
- Adding a general `doctor --fix --dry-run` CLI in this RFC update.
- Requiring every repair-capable rule to return diffs or effects before it can emit findings.
- Moving internal check-selection metadata into the public plugin SDK.
- Reordering extension checks ahead of core Doctor contributions.

## Proposal

### Preserve ordered core contributions

Built-in Doctor checks remain attached to ordered Doctor health contributions. The contribution list owns the human `doctor` and `doctor --fix` sequence.

A contribution may reference an existing structured check:

```ts
createDoctorHealthContribution({
  id: "doctor:gateway-health",
  label: "Gateway health",
  healthCheckIds: ["core/doctor/gateway-health"],
  run: runGatewayHealthChecks,
})
```

Or it may define structured health beside its legacy flow:

```ts
createDoctorHealthContribution({
  id: "doctor:some-rule",
  label: "Some rule",
  healthChecks: {
    id: "core/doctor/some-rule",
    description: "Some rule is valid.",
    async detect(ctx) {
      return detectSomeRuleFindings(ctx);
    },
  },
  run: runLegacySomeRuleDoctor,
})
```

This keeps migration local to the owning rule and prevents the shared extension registry from becoming the source of core ordering.

### Define lint selection explicitly

Doctor exposes three structured lint selection postures:

| Command | Selection |
| --- | --- |
| `openclaw doctor --lint` | Default-enabled automation checks. |
| `openclaw doctor --lint --all` | Every registered check, including opt-in checks. |
| `openclaw doctor --lint --only <id>` | Only explicitly selected ids, including default-disabled checks. |

`--skip <id>` removes a selected check. Selection happens before severity filtering.

`defaultEnabled: false` is internal runner metadata. It is not part of the public plugin SDK health type. A check may be opt-in because it is deep, historical, likely to report legacy residue, dependent on live environment or account state, or otherwise inappropriate for every automation gate.

Unknown `--only` ids produce a structured `core/doctor/lint-selection` error finding.

### Keep lint read-only

`doctor --lint`:

- never prompts;
- never invokes repair;
- never rewrites config or state;
- sorts findings deterministically;
- applies the selected severity threshold to output and exit status;
- exits `0` for no findings at the threshold, `1` for findings, and `2` for command/runtime failure.

`--all`, `--only`, `--skip`, and `--severity-min` are lint-only options.

### Use one structured finding contract

A finding contains a stable check id, severity, message, and optional path, source location, `ocPath`, target, requirement, and fix hint.

Detection is the required structured operation:

```ts
detect(ctx, scope?) -> HealthFinding[]
```

The 44-of-44 milestone means every tracked legacy Doctor rule family gained a structured lint finding path. It is a migration milestone, not a promise that the registry will remain at 44 checks. Contributions can expose multiple check ids, and new core or extension checks can be added over time.

### Add structured repair incrementally

A check may add:

```ts
repair(ctx, findings) -> HealthRepairResult
```

Repair returns:

- `status: "repaired" | "skipped" | "failed"`;
- change summaries;
- optional config or file diffs;
- optional non-file effects;
- optional warnings and reason.

Omitted status means repaired. Skipped and failed repairs do not run post-repair validation.

After successful structured repair, Doctor re-runs detection scoped to the repaired findings. If the finding remains, Doctor reports a validation warning instead of silently claiming success.

Rules may keep real mutation in the legacy contribution while structured repair exposes only a truthful plan or effect. Other rules may move fully to structured repair when that produces a simpler owner-local implementation.

### Keep dry-run a future project

The repair contract already carries `dryRun`, `diff`, and preview state, and repair results can return `diffs` and `effects`. Several checks can already describe selected file, config, state, or service effects.

This RFC does not add a general Doctor repair dry-run command. A future dry-run project must:

1. define an approved CLI entry point;
2. identify the mutation-bearing rule set that can provide truthful preview;
3. distinguish complete preview, partial preview, and unsupported preview;
4. prove that preview does not mutate state;
5. preserve legacy repair ownership until a rule's plan and mutation match;
6. avoid claiming parity for finding-only or live-environment checks.

The existing plumbing is the substrate for that work, not evidence that dry-run coverage is complete.

### Keep extensions behind the shared health contract

Bundled extensions and plugins register checks through the shared health registry. Extension checks run after ordered core checks once their package is active.

`openclaw/plugin-sdk/health` exposes the public finding, detection, and repair contract. Internal selection metadata such as `defaultEnabled` remains core-owned unless a future RFC explicitly makes opt-in selection a plugin contract.

## Rationale

The contribution-owned model preserves the behavior and ordering users already know while allowing automation to consume a stable contract. Moving every core check into a flat registry would simplify one implementation layer but weaken ownership and make core order easier to disturb.

The default/all split is necessary because completeness and signal quality are different operator needs. CI should use a stable, low-noise default. Audits and migrations should be able to request the full inventory. Exact `--only` selection supports focused proof without changing global defaults.

The Gateway-owner, operator, and simplicity reviews all reject a broad dry-run claim before plans are truthful. Repair preview is useful only when it accurately describes the same owner-local mutation that real repair would perform. Keeping dry-run as a future project prevents the RFC from turning available result fields into an unsupported product promise.

## Unresolved questions

- What should the future general repair dry-run command be called and how should it report partial coverage?
- Which remaining legacy mutations become simpler when moved into structured repair, and which should stay in their existing owner flow?
- Should default lint membership be reviewed through a checked-in compatibility manifest or remain internal metadata plus focused tests?
- When should an extension be allowed to declare an opt-in check rather than registering only default checks?
- Which repair effects require stronger transactional or rollback semantics before structured repair can own the real mutation?
