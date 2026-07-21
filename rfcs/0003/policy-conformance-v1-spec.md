# Policy Conformance 1.0 specification

## Status

This document is the normative sidecar specification for RFC 0003.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

## 1. Ownership model

1. `policy.jsonc` MUST define required posture.
2. OpenClaw config and named product artifacts MUST remain the sources of observed evidence.
3. Policy MUST NOT become a second runtime configuration file.
4. Policy findings MUST NOT be treated as request-time authorization decisions.
5. Unsupported policy keys MUST produce an invalid-policy finding.

## 2. Command contract

### 2.1 `policy check`

`openclaw policy check` MUST:

- evaluate the selected `policy.jsonc`;
- collect attributable and redacted evidence;
- emit stable findings;
- calculate policy, evidence, findings, and attestation hashes;
- exit `0` when no finding meets the selected severity;
- exit `1` when a finding meets the selected severity;
- exit `2` on argument or runtime failure.

`--json` MUST emit the attestation, evidence, check counts, and findings.

Each registered Policy JSON finding MUST include `policy.fixRecommendation`.
Optional recommendation fields remain omitted when they do not apply. Example:

```json
{
  "checkId": "policy/gateway-node-command-denied",
  "severity": "error",
  "message": "Gateway node command 'system.run' is denied by policy but not denied by OpenClaw config.",
  "ocPath": "oc://openclaw.config/gateway/nodes/denyCommands",
  "requirement": "oc://policy.jsonc/gateway/nodes/denyCommands",
  "policy": {
    "fixRecommendation": {
      "fixClass": "reviewRequired",
      "policyPath": ["gateway", "nodes", "denyCommands"],
      "configTargets": ["gateway.nodes.denyCommands"],
      "summary": "Add the command to gateway node denyCommands or update policy after review."
    }
  }
}
```

### 2.2 `policy compare`

`openclaw policy compare --baseline <file>` MUST compare authored policy files only.

The checked policy MUST be equal or stricter than the baseline for every baseline rule. Comparison MUST use `POLICY_RULE_METADATA` or its successor as the single source for strictness, normalization, allowed values, and empty-list semantics.

### 2.3 `policy watch`

`openclaw policy watch` MUST report:

- `clean` when the check is clean and accepted attestation matches;
- `findings` when non-attestation findings exist;
- `stale` when current evidence does not match `expectedAttestationHash`.

`--once` MUST perform one evaluation. Continuous mode SHOULD suppress duplicate unchanged reports.

Watch MUST remain a per-workspace observer. It MUST NOT be represented as request-time enforcement or a fleet distribution mechanism.

## 3. Evidence and attestation

Evidence MUST be:

- attributable to a stable config, workspace, or named-artifact source;
- deterministic for the same observed posture;
- redacted to omit secret values and unrelated operational data;
- addressable with stable `oc://` references where possible.

The attestation MUST identify:

- policy hash;
- evidence hash;
- findings hash;
- clean or dirty state.

The stable attestation hash MUST exclude observation time. `checkedAt` MAY be included for audit chronology.

Policy hashes are content identifiers, not signatures. Policy MUST NOT describe the local hash tuple as tamper-proof or independently authentic. Durable audit assurance MUST come from storing accepted hashes and reports in a trusted external system.

Policy MUST NOT read raw secret values, arbitrary workspace files, logs, or per-agent credential stores.

## 4. Named artifact evidence

An artifact MAY become Policy evidence only when it has:

1. a stable product-owned schema;
2. explicit policy opt-in;
3. posture-oriented fields;
4. deterministic redaction;
5. stable evidence references;
6. missing, invalid, and drift tests.

For `exec-approvals.json`:

- any substantive `execApprovals` rule MUST require valid attributable evidence;
- missing required evidence MUST emit `policy/exec-approvals-missing`;
- invalid evidence MUST emit `policy/exec-approvals-invalid`;
- socket credentials, command text, resolved paths, timestamps, and approval-session details MUST be omitted.

## 5. Scoped overlays

Supported selectors are:

| Selector | Supported sections |
| --- | --- |
| `agentIds` | `tools`, `agents.workspace`, `sandbox`, `dataHandling.memory`, `execApprovals` |
| `channelIds` | `ingress.channels` |

A scope MUST contain at least one supported selector. Unsupported selector/section combinations MUST be rejected.

When multiple scopes apply to the same target and field, the combined claim MUST be equal or stricter. A weaker duplicate claim MUST fail policy validation.

## 6. Strictness semantics

Policy fields MUST declare one strictness kind:

- `allowlist-subset`;
- `denylist-superset`;
- `ordered-string`;
- `requires-true`;
- `requires-false`;
- `exact-list`.

Empty arrays MUST NOT have a universal meaning. Each list field MUST declare whether an empty list is meaningful or disables the rule.

The same metadata MUST drive baseline comparison and overlapping-scope validation.

## 7. Gateway node commands

`gateway.nodes.denyCommands` MUST:

- compare exact command ids case-sensitively;
- use deny-superset strictness;
- observe `gateway.nodes.denyCommands`;
- emit `policy/gateway-node-command-denied` for every required command absent from config.

Policy MUST NOT infer denial from the absence of `gateway.nodes.allowCommands`. Runtime admission remains owned by the Gateway node-command policy.

## 8. Repair classification

Every registered Policy check MUST have fix metadata with:

- `checkId`;
- `fixClass`;
- summary;
- optional policy path;
- optional config targets.

Allowed fix classes are:

| Class | Required behavior |
| --- | --- |
| `automatic` | MAY mutate only deterministic narrowing config after explicit opt-in. |
| `reviewRequired` | MAY return a non-mutating structured preview. |
| `manual` | MUST direct the operator to the owning workflow or artifact. |
| `validateOnly` | MUST remain detection-only. |
| `unsupported` | MUST explain why a truthful repair is unavailable. |

## 9. Automatic repair

Automatic Policy repair MUST require:

```text
plugins.entries.policy.config.workspaceRepairs = true
```

Without that value, repair MUST return `skipped` and MUST NOT mutate config.

Automatic repair MUST:

- narrow existing product-managed config;
- avoid choosing credentials, providers, sandbox backends, auth modes, or approval posture;
- skip a scoped repair when the available mutation target is shared more broadly than the scope;
- return patched config through the Doctor health contract instead of writing config directly;
- return structured change summaries;
- allow Doctor's post-repair detection to validate the result.

The shipped automatic set includes:

- `policy/channels-denied-provider`;
- `policy/agents-tool-not-denied`;
- `policy/tools-elevated-enabled`;
- `policy/tools-required-deny-missing`;
- `policy/gateway-control-ui-insecure`;
- `policy/gateway-http-endpoint-enabled`;
- `policy/gateway-remote-enabled`;
- `policy/ingress-open-groups-denied`;
- `policy/ingress-group-mention-required`;
- `policy/data-handling-redaction-disabled`;
- `policy/data-handling-telemetry-content-capture`.

## 10. Review-required preview

A review-required preview MUST NOT mutate config.

It SHOULD return:

- `status: "skipped"`;
- a reason explaining that review is required;
- a human-readable proposed change;
- a structured effect with `dryRunSafe: true`.

The shipped preview set includes:

- `policy/gateway-non-loopback-bind`;
- `policy/gateway-node-command-denied`.

Classification as `reviewRequired` does not imply that a preview implementation exists yet.

## 11. Compatibility

- Existing supported policy fields and finding ids SHOULD remain stable.
- A renamed field SHOULD have a documented deprecation window.
- Changes to strictness or attestation inputs MUST be treated as contract changes.
- Changes to evidence canonicalization or hash inputs MUST be treated as attestation contract changes.
- Policy checks MUST remain available through `doctor --lint`.
- Disabling the Policy plugin MUST remove Policy evaluation without changing unrelated OpenClaw runtime behavior.
