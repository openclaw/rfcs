# Doctor structured health and repair specification

## Status

This document is the normative sidecar specification for RFC 0004.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

## 1. Execution ownership

1. Core Doctor contribution order MUST remain the source of truth for built-in interactive checks and repair flow.
2. Core structured checks MUST stay attached to their owning contribution or be referenced by it.
3. Extension health checks MUST register through the shared health registry.
4. Extension checks MUST run after ordered core contribution checks.
5. A duplicate check id MUST be rejected.

## 2. Structured check contract

Every structured check MUST provide:

```ts
{
  id: string
  kind: "core" | "plugin"
  description: string
  detect(ctx, scope?): Promise<HealthFinding[]>
}
```

A check MAY provide:

```ts
repair(ctx, findings): Promise<HealthRepairResult>
```

Core MAY normalize an owner-local combined `run()` implementation into the split detect/repair contract.

## 3. Finding contract

A finding MUST contain:

- `checkId`;
- `severity`;
- `message`.

A finding SHOULD include the most precise available:

- config, file, or logical `path`;
- `line` and `column`;
- `ocPath`;
- evidence `target`;
- policy or health `requirement`;
- actionable `fixHint`.

Severities are:

- `info` for noteworthy but not wrong state;
- `warning` for actionable wrong, stale, ambiguous, or reliability-affecting state;
- `error` for a blocking or invalid state.

Finding order MUST be deterministic. The lint runner MUST sort by severity, check id, then path.

## 4. Lint behavior

`openclaw doctor --lint` MUST:

- call detection only;
- never prompt;
- never call repair;
- never itself persist config, file, package, service, process, or state changes, except that it MAY start a configured `exec` SecretRef resolver when `--allow-exec` is present;
- report check counts and findings;
- exit `0`, `1`, or `2` according to the CLI contract.

Read-only MUST mean Doctor does not apply repairs or persist config/state changes. Detection MAY perform bounded observation probes. It MUST NOT execute configured `exec` SecretRefs unless the operator explicitly supplies `--allow-exec`. When `--allow-exec` is present, the resolver process is trusted operator-configured code and its external side effects are outside Doctor's non-mutation guarantee.

A thrown check error MUST become an error finding for that check rather than aborting the remaining inventory.

## 5. Selection behavior

Checks MAY carry internal:

```ts
defaultEnabled?: boolean
```

This metadata MUST remain outside the public plugin SDK type in version 1.

Selection order MUST be:

1. apply `--only` when present;
2. otherwise exclude `defaultEnabled: false` unless `--all` is present;
3. apply `--skip`;
4. run selected checks;
5. apply severity filtering to findings and exit status.

`--only` MUST be able to select a default-disabled check.

An unknown `--only` id MUST emit:

```text
checkId: core/doctor/lint-selection
severity: error
```

## 6. Default and complete inventories

The default set SHOULD contain checks suitable for stable automation.

A check SHOULD be default-disabled when it is:

- deep or expensive;
- historical or legacy-residue focused;
- dependent on optional live environment, account, or service state;
- likely to be noisy on a valid unconfigured install;
- intended primarily for explicit migration or repair review.

`--all` MUST mean every registered check, not "all default checks."

The completed 44-of-44 milestone records structured lint coverage for the tracked legacy Doctor rule families. It MUST NOT be interpreted as a fixed registry size or a requirement that one rule family maps to exactly one check id.

## 7. Repair result contract

`HealthRepairResult` MUST support:

```ts
{
  status?: "repaired" | "skipped" | "failed"
  reason?: string
  changes?: string[]
  diffs?: HealthRepairDiff[]
  effects?: HealthRepairEffect[]
  warnings?: string[]
  config?: OpenClawConfig
}
```

Omitted status MUST mean `repaired`.

`skipped` and `failed` results SHOULD include a reason. They MUST NOT trigger post-repair validation.

Changes MUST describe completed or proposed owner-local work. Diffs MUST identify config or file edits. Effects MUST identify non-file actions such as service, process, package, state, or cleanup operations.

## 8. Post-repair validation

After a successful structured repair, Doctor MUST re-run detection scoped to the repaired findings.

If a repaired finding remains:

- Doctor MUST report a warning;
- Doctor MUST NOT silently claim the repair is complete;
- the check MAY use finding ids, paths, targets, or `ocPath` values to focus validation.

## 9. Legacy bridge

A contribution MAY contain both structured health and a legacy `run`.

In that shape:

- lint MUST use structured detection;
- interactive Doctor order MUST remain contribution-owned;
- legacy `run` MAY continue to own real mutation;
- structured repair MAY return a truthful preview or skipped result until ownership moves.

Removing legacy `run` SHOULD happen only when the structured implementation preserves behavior and makes ownership simpler.

## 10. Extension contract

The plugin SDK health surface MUST expose:

- findings;
- detection context;
- optional repair context;
- repair diffs and effects;
- stable check registration.

Core-internal selection policy MUST NOT become a plugin compatibility promise in version 1.

Extension registration MUST NOT shadow a core id.

Registration MUST be declarative. It MUST NOT perform health probes, invoke configured executables, or add work to normal Gateway request handling. Detection and repair MUST run only when a selected health flow invokes the check.

## 11. Future repair dry-run

Version 1 provides plumbing but no general Doctor repair dry-run command.

The plumbing includes:

- repair context dry-run and diff intent;
- structured diffs;
- structured effects;
- repair status and reasons;
- post-repair validation.

A future general dry-run MUST:

- be explicitly proposed and documented;
- remain non-mutating;
- report coverage per selected repair;
- distinguish complete, partial, skipped, failed, and unsupported preview;
- avoid promising preview for finding-only checks;
- prove that preview and real repair use the same owner-local plan.

Until that project lands, documentation MUST NOT advertise general `doctor --fix --dry-run`.

## 12. Compatibility

- Core contribution order SHOULD remain stable.
- Existing check ids SHOULD remain stable.
- Default lint membership changes SHOULD include focused compatibility tests and rationale.
- Existing `doctor` and `doctor --fix` behavior SHOULD remain unchanged unless a rule-specific change intentionally updates it.
- New structured fields MUST be additive unless a separate compatibility change is approved.
