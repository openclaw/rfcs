---
title: Policy Conformance
authors:
  - Gio Della-Libera
created: 2026-05-27
last_updated: 2026-07-15
status: accepted
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/40
---

# Proposal: Policy Conformance

## Summary

Define OpenClaw Policy as an authored configuration-conformance and audit-evidence layer over existing OpenClaw settings. Operators write `policy.jsonc`; OpenClaw observes attributable workspace, configuration, and named product-artifact evidence; `openclaw policy check`, `compare`, and `watch` report drift; and Policy findings also participate in Doctor's structured health surface. Policy does not become a second runtime configuration system or a request-time authorization engine.

The normative Policy 1.0 contract is in [Policy Conformance 1.0 specification](0003/policy-conformance-v1-spec.md).

## Motivation

Operators need to answer four related questions without duplicating OpenClaw configuration:

1. Does the active workspace conform to an approved policy?
2. Is a workspace policy equal to or stricter than an organization baseline?
3. Has accepted evidence drifted since the last clean review?
4. Can Doctor explain and, where safe, narrow a nonconforming setting?

The original Policy RFC established configuration conformance, scoped overlays, stable findings, and attestations. The implementation has since expanded to cover named `exec-approvals.json` evidence, Gateway node-command deny posture, continuous attestation watching, schema-owned strictness metadata, and classified repair guidance.

Those additions need one coherent contract. In particular, repair must not turn Policy into an authority that silently chooses credentials, providers, sandbox backends, exposure models, or approval posture. Automatic repair is limited to deterministic narrowing changes. Ambiguous or high-blast-radius changes remain review-required or manual.

## Goals

- Keep `policy.jsonc` authoritative for required posture while OpenClaw config remains authoritative for runtime behavior.
- Reject unsupported policy fields instead of silently ignoring them.
- Emit stable findings with attributable evidence and `oc://` references.
- Produce deterministic policy, evidence, findings, and attestation hashes.
- State the integrity boundary of those hashes without presenting them as signatures.
- Compare a workspace policy against an authored baseline using shared strictness metadata.
- Support stricter agent- and channel-scoped overlays.
- Cover Gateway node-command deny posture without treating Policy as node authorization.
- Classify every Policy finding as automatic, review-required, manual, validate-only, or unsupported.
- Apply only deterministic narrowing repairs, and only after explicit workspace repair opt-in.
- Keep Policy findings available through both `openclaw policy check` and `openclaw doctor --lint`.

## Non-Goals

- Replacing `openclaw.json` or other owner-managed configuration.
- Generating an approved policy from current settings and calling it compliant.
- Inspecting raw secret values, credential stores, arbitrary files, logs, or transient runtime decisions.
- Authorizing or denying tool calls, node invocations, or network requests at request time.
- Automatically choosing credentials, model providers, sandbox backends, Gateway auth modes, or exec-approval posture.
- Mirroring every OpenClaw configuration field into Policy.
- Treating a clean config-level check as proof that no sensitive data exists.
- Providing signed, tamper-proof, or fleet-wide audit storage.
- Making `policy watch` a fail-closed runtime enforcement mechanism.

## Proposal

### Author and evaluate policy

Policy is provided by the bundled Policy plugin. Operators enable the plugin and author `policy.jsonc`:

```bash
openclaw plugins enable policy
openclaw policy check
openclaw policy check --json
```

Each rule states required posture. A check runs only when its concrete rule is present. Unsupported keys and invalid selector/section combinations fail as invalid policy rather than being ignored.

Policy evaluation produces:

- the authored policy hash;
- attributable, redacted evidence;
- stable structured findings;
- an evidence hash;
- a findings hash;
- a stable attestation hash that excludes the observation timestamp.

`policy check` is read-only. Its JSON findings include `policy.fixRecommendation` metadata so automation can distinguish automatic, review-required, manual, validate-only, and unsupported remediation classes without inferring them from prose.

The hashes identify exact policy, evidence, and finding content. They are not signatures and do not make local files tamper-proof. An operator that needs durable audit assurance must store accepted hashes and check output in a trusted external control plane or evidence system.

### Compare baselines and watch accepted state

`openclaw policy compare --baseline <file>` compares two authored policies. It does not inspect runtime state. The checked policy must contain every required baseline rule and be equal or stricter according to schema-owned metadata.

`openclaw policy watch` repeatedly evaluates current evidence and reports when findings appear or the current attestation no longer matches `expectedAttestationHash`. `--once` provides the same drift check for CI and release gates.

Watch is a per-workspace observer. It does not block runtime actions, replace supervisor monitoring, or provide fleet distribution by itself.

The same strictness metadata owns:

- baseline comparison;
- overlapping scoped-overlay validation;
- empty-list semantics;
- allowed enum values;
- normalization rules;
- the check ids associated with each policy field.

### Use attributable evidence only

Policy may evaluate existing OpenClaw configuration, workspace declarations, and named product artifacts when they provide stable, reviewable posture.

`exec-approvals.json` is explicit opt-in evidence. Policy retains posture such as default and per-agent security modes, auto-allow-skills posture, and reviewed allowlist patterns. It omits socket credentials, command text, resolved paths, timestamps, and approval-session details. Missing or invalid required evidence is a finding, not an inferred pass.

Policy does not read per-agent credential stores or raw secret values. Secret and auth-profile checks use config declarations and SecretRef metadata only.

### Support scoped overlays

Named scopes apply stricter rules to selected targets:

- `agentIds` can scope tools, workspace access, sandbox, session-memory data handling, and exec-approval posture.
- `channelIds` can scope channel ingress posture.

Global policy still applies. Repeated rules for the same target must be equal or stricter. A weaker duplicate claim is invalid before evidence evaluation.

### Cover Gateway node-command posture

`gateway.nodes.denyCommands` is a case-sensitive deny-superset rule. Policy reports `policy/gateway-node-command-denied` when a command required by policy, such as `system.run`, is not present in OpenClaw's configured node-command deny list.

This remains conformance, not authorization. The Gateway node-command policy continues to own runtime command admission. A deployment that intentionally permits a privileged command must update the authored policy after review.

### Classify and constrain repairs

Every Policy finding has one fix class:

| Fix class | Meaning |
| --- | --- |
| `automatic` | A deterministic narrowing change can be applied without choosing new authority or capability. |
| `reviewRequired` | A concrete change can be previewed or described, but an operator must approve the target or blast radius. |
| `manual` | Repair belongs to another owner flow, artifact, credential, or policy review process. |
| `validateOnly` | The finding can be checked but has no repair action. |
| `unsupported` | Evidence is insufficient to define a truthful repair. |

Automatic repairs require:

```jsonc
{
  "plugins": {
    "entries": {
      "policy": {
        "config": {
          "workspaceRepairs": true
        }
      }
    }
  }
}
```

Without that opt-in, `doctor --fix` reports a skipped repair and warning. Automatic repair may only narrow existing product-managed config. Current narrowers include disabling denied channels, adding required global and agent-workspace tool denies, disabling elevated tools, closing open group ingress, restoring mention gates, disabling insecure Control UI toggles, disabling denied Gateway HTTP endpoints, switching remote Gateway mode to local, restoring sensitive-log redaction, and disabling telemetry content capture.

Scoped findings are skipped when a shared config mutation would affect targets outside the selected scope. Repair must not broaden policy, add capability, or guess an owner-specific value.

Automatic repair returns a patched OpenClaw config through Doctor's normal repair path rather than writing config directly. Doctor remains responsible for the standard config-write, validation, backup, and post-repair detection flow.

Review-required preview currently covers non-loopback Gateway bind and Gateway node-command deny additions. It returns structured effects and warnings but does not mutate config.

### Preserve one shared health signal

Policy-specific authoring workflows use `policy check`, `compare`, and `watch`. The final workspace health gate remains:

```bash
openclaw doctor --lint
```

Policy checks register through the shared health contract. Their stable finding ids, evidence references, and repair metadata remain consistent across Policy CLI and Doctor output.

## Rationale

This design separates three kinds of authority:

- `policy.jsonc` owns approved posture;
- OpenClaw configuration and named artifacts own observed behavior and evidence;
- the relevant runtime subsystem owns request-time enforcement.

That separation keeps Policy useful to operators and auditors without adding a second control plane. Schema-owned strictness metadata avoids independent comparison implementations drifting apart. Explicit repair classes make remediation inspectable, while the narrow automatic-repair bar prevents a clean-looking result from hiding an unreviewed authority change.

Policy may observe broadly and explain precisely, but it mutates only deterministic narrowing settings, remains removable as a plugin, and adds no request-path enforcement latency.

## Unresolved questions

- Which additional review-required findings should gain structured previews after their target-selection rules are proven?
- Should new selector types be added beyond `agentIds` and `channelIds`, and what evidence would make them attributable?
- Which named product artifacts meet the same stability and redaction bar as `exec-approvals.json`?
- Should a future runtime enforcement RFC consume a clean Policy attestation, and which runtime owner would define freshness and failure behavior?
