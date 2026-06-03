---
title: Policy Conformance 1.0
authors:
  - giodl73-repo
created: 2026-05-27
last_updated: 2026-06-03
rfc_pr: https://github.com/openclaw/rfcs/pull/6
---

# Proposal: Policy Conformance 1.0

## Summary

Define OpenClaw policy as a configuration conformance and audit-evidence layer over existing OpenClaw settings. A workspace operator authors `policy.jsonc`, OpenClaw observes the active workspace configuration as evidence, and policy checks report drift through `openclaw policy check` and the shared `doctor --lint` health surface.

## Motivation

Policy 1.0 should help operators answer a narrow question: does this workspace configuration conform to the approved policy file? It should not become a second configuration language, a secrets-management system, or a broad runtime enforcement layer.

The Policy plugin contributes conformance checks to OpenClaw. Policy rules live in `policy.jsonc`; plugin settings live under `plugins.entries.policy.config`. The current policy surface covers configured channels, MCP server ids, model provider ids and selected model refs, private-network SSRF posture, ingress and channel access posture, Gateway exposure posture, agent workspace posture, global and per-agent tool posture, governed tool metadata declarations, sandbox runtime posture, config secret provider and SecretRef provenance, config auth profile metadata, exec approval file posture, and policy-to-policy baseline comparison.

The final health gate remains `doctor --lint`. Policy-specific authoring and audit workflows can run `openclaw policy check`, but policy findings should also flow into Doctor so operators have one shared lint signal.

As policy grows, there is pressure to mirror every OpenClaw setting in `policy.jsonc`. That would make policy harder to review, harder to keep current, and ambiguous about which file actually controls runtime behavior. Policy 1.0 should stay focused on conformance questions that can be answered from observed OpenClaw configuration and workspace declarations.

Evidence quality varies by surface. Some posture is directly observable from config, such as configured channels, provider ids, MCP server ids, and Gateway bind posture. Some posture is stored in named product artifacts. Those artifacts can be policy evidence only when they have a stable product schema, contain reviewable posture rather than secret material, are read by an explicit opt-in policy section, and can be redacted to stable evidence fields. `exec-approvals.json` is the first concrete example because it stores default and per-agent exec approval posture plus reviewed allowlist patterns. This RFC does not grant blanket coverage for every file under the OpenClaw state directory. Other posture depends on runtime-specific details, credential liveness, filesystem integrity, arbitrary file contents, logs, or secret material that policy should not inspect. A policy field without attributable evidence should fail as unobservable for that target instead of becoming a best-effort pass.

Enterprise baselines and per-agent or per-channel overlays both need to answer whether one policy is equal or stricter than another. If each check implements that comparison separately, scoped overlays and baseline comparison will drift. Strictness metadata should be owned with the policy schema so baseline compare, scoped overlay validation, and future repair previews use the same rules.

Policy findings can identify nonconforming config, but they are not runtime authorization decisions by themselves. Any future enforcement must name the runtime hook, evidence, and tests that prove the same contract at the point of use.

## Goals

- Keep policy anchored in existing OpenClaw configuration and workspace declarations.
- Report conformance findings with stable check ids, evidence references, and attestation hashes.
- Support organization baselines with `openclaw policy compare --baseline`.
- Allow named scoped overlays for selectors such as agent ids and channel ids.
- Require scoped overlays to be equal or more restrictive than broader policy when they touch the same field.
- Use shared strictness metadata for policy comparison and scoped overlay validation.
- Cover the first enterprise conformance areas without copying every OpenClaw config option into policy.
- Keep runtime enforcement explicitly out of scope unless an existing OpenClaw runtime hook can prove and enforce the same contract.

## Non-Goals

- Replacing OpenClaw configuration.
- Claiming there are no secrets in config or taking ownership of secret-value management.
- Inspecting per-agent credential stores, secret material, or runtime approval decisions.
- Enforcing every policy requirement at runtime.
- Mirroring every plugin, channel, provider, or agent setting.
- Treating unobservable runtime state as passing evidence.
- Adding an operator-facing governance product beyond policy conformance.

## Proposal

OpenClaw should not generate an authoritative policy from the current workspace and call that compliant. Operators author the required posture. OpenClaw then observes active settings and reports where they drift. Generated examples, repair previews, or upgrade helpers can assist authors, but the approved `policy.jsonc` remains the authority.

Each check should identify the policy requirement being evaluated, the OpenClaw config or workspace declaration used as evidence, whether the evidence conforms, the stable finding id when it does not conform, and the policy, evidence, findings, and attestation hashes for audit records. When OpenClaw cannot observe a configured policy field for the selected target, the result should be a finding, not a silent pass. For example, a container posture field that cannot be observed for a selected sandbox backend should report that the claim is unobservable for that target.

Policy field names should express the compliance concern rather than duplicate low-level config fields. For example, sandbox policy should say whether a container posture allows host networking or requires read-only mounts. It should not expose Docker-specific names unless Docker is the compliance concern. OpenClaw config remains the source of behavior. Policy only states the approved posture and reports whether the current config satisfies it.

Policy 1.0 is config conformance. It can make findings about tool posture, sandbox posture, ingress posture, and Gateway exposure based on observed config, but those findings are not runtime authorization decisions by themselves. Future runtime enforcement can reuse policy rules only where OpenClaw has a stable runtime hook, clear evidence, and tests that prove the same contract at the point of use.

Policy supports top-level rules for broad workspace posture and named `scopes.<scopeName>` blocks for stricter posture on selected targets. A scope name is descriptive. Matching comes from selectors inside the scope. The initial selectors are:

| Selector | Supported sections | Purpose |
| --- | --- | --- |
| `agentIds` | `tools`, `agents.workspace`, `sandbox`, `execApprovals` | Apply stricter agent, tool, sandbox, or exec approval posture to one or more runtime agents. |
| `channelIds` | `ingress.channels` | Apply stricter channel ingress posture to one or more configured channels. |

Unsupported selector and section combinations should be rejected instead of ignored. A scope without an enforceable selector should be invalid. The same target can appear in multiple scopes. That allows operators to compose policy by purpose, such as "release agents" and "restricted shell agents." If two applicable scopes touch the same field, the duplicate field must be equal or more restrictive according to shared policy metadata. Weaker duplicate claims should fail during policy compilation before check evaluation begins.

Policy should keep comparison semantics in schema-owned metadata rather than custom per-check logic. The same metadata should be used for `policy compare --baseline`, scoped overlay validation, and future dry-run upgrade or repair previews. The initial rule types are allow-lists, deny-lists, required booleans, exact lists, and ordered strings. Empty values should not receive a universal meaning. Each policy field should define whether an empty array means "allow nothing," "require nothing," or "rule omitted." A check should run only when its concrete rule is present.

`openclaw policy compare --baseline <file>` compares one policy file to another policy file. It does not inspect runtime state, credentials, or secret values. This supports the common enterprise lifecycle:

1. A central security or compliance owner authors an official baseline policy.
2. A workspace operator proposes or edits a workspace `policy.jsonc`.
3. `policy compare --baseline official.policy.jsonc --policy policy.jsonc` verifies that the workspace policy is not missing or weaker than the baseline.
4. `openclaw policy check` verifies that the active workspace config conforms to the approved workspace policy.

The checked policy can be stricter than the baseline. A broad top-level checked rule can satisfy a scoped baseline rule when it is equally or more restrictive for the selected target.

The seed conformance areas are channels, MCP, models, private network posture, ingress, Gateway exposure, agents, tools, sandbox posture, secrets, and auth profiles. These checks are intentionally config-level. Policy can report that a denied provider, channel, MCP server, or private-network posture is configured. It does not prove that no external system can ever reach the same service.

Ingress policy covers direct-message session scope and channel group admission posture. Channel-scoped ingress should use `channelIds` because channel posture is attributable. Session DM scope remains global while the evidence is not channel-attributable. Gateway exposure policy covers bind posture, auth posture, Control UI posture, remote Gateway posture, and HTTP endpoint posture. These checks should stay close to operator-facing exposure questions rather than becoming a copy of every Gateway config field.

Agent workspace policy and tool posture policy cover configured workspace access, tool profile, filesystem posture, exec posture, elevated mode, additive tool grants, and deny lists. These are config conformance checks, not runtime operator approval checks. Exec approval policy can separately cover the named `exec-approvals.json` artifact for required file presence, default and per-agent security posture, and reviewed allowlist patterns. That evidence should omit socket tokens, command text, resolved paths, timestamps, and any other approval-session details. Sandbox policy covers sandbox mode, backend, and observable container/browser posture. Container posture fields should be allowed only where OpenClaw can observe them for the selected target. Operators can use scopes to apply different sandbox requirements to different agent groups.

For example, a policy can require the approvals artifact, deny permissive approval defaults, and allow selected agents to use only reviewed exec approval allowlists:

```jsonc
{
  "execApprovals": {
    "requireFile": true,
    "defaults": {
      // Security modes: "deny", "allowlist", or "full".
      // This default permits only the locked-down deny posture.
      "allowSecurity": ["deny"]
    }
  },
  "scopes": {
    "restricted-shell": {
      "agentIds": ["family-agent", "groups-agent"],
      "execApprovals": {
        "agents": {
          // Selected agents may use reviewed allowlist posture, but not "full".
          "allowSecurity": ["allowlist"],
          "allowlist": {
            "expected": ["travel-hub", "calendar-cli", "/bin/date"]
          }
        }
      }
    }
  }
}
```

The collected evidence is redacted posture, not the raw artifact. For example,
this artifact includes socket credentials and command text:

```json
{
  "socket": { "path": "/tmp/openclaw.sock", "token": "secret-token" },
  "defaults": { "security": "full" },
  "agents": {
    "sebby": {
      "security": "full",
      "allowlist": [{ "pattern": "deploy", "commandText": "deploy --prod" }]
    }
  }
}
```

Policy evidence should retain only attributable posture records:

```json
[
  {
    "kind": "defaults",
    "source": "oc://exec-approvals.json/defaults",
    "security": "full"
  },
  {
    "kind": "agent",
    "source": "oc://exec-approvals.json/agents/sebby",
    "agentId": "sebby",
    "security": "full"
  },
  {
    "kind": "allowlist",
    "source": "oc://exec-approvals.json/agents/sebby/allowlist/#0",
    "agentId": "sebby",
    "pattern": "deploy"
  }
]
```

A finding then links the policy requirement to the redacted evidence reference:

```json
{
  "checkId": "policy/exec-approvals-agent-security-unapproved",
  "ocPath": "oc://exec-approvals.json/agents/sebby",
  "requirement": "oc://policy.jsonc/execApprovals/agents/allowSecurity",
  "message": "exec approvals agent 'sebby' uses unapproved security mode 'full'."
}
```

The evidence excludes socket path/token, command text, resolved paths,
timestamps, and approval-session details.

Policy can require managed secret provider declarations, deny insecure provider sources, require auth profile metadata in OpenClaw config, and attest redacted posture from named non-secret product artifacts. It should not read raw secret values or claim to regulate all secret lifecycle concerns. Secrets management, credential storage, rotation, and runtime credential access remain owned by their existing OpenClaw systems and future dedicated work.

The policy evidence roadmap should stay focused on posture that can be expressed as authored policy and supported by attributable, redacted evidence:

- P1 should cover the highest-value policy evidence gaps. `execApprovals` should read `exec-approvals.json` through an explicit policy section and report required file presence, default security posture, per-agent effective security posture, and exact reviewed allowlist patterns. Sandbox policy should also gain a mode allowlist so a policy can assert that selected agents must remain `off` when the approved isolation model is exec allowlists plus tool denies rather than sandboxing.
- P2 should cover additional config-backed policy rules where OpenClaw already has stable evidence: elevated default posture, agent-to-agent enablement and allowlists, trusted safe-bin directories, and plugin allow/deny policy. These should use existing allowlist, denylist, exact-list, or required-boolean strictness metadata rather than bespoke comparison logic.
- P3 should remain explicit and low priority. Routing bindings may be policy evidence if the rule is framed as static routing posture. Cron recurring-job counts should not become policy evidence unless a future proposal defines a stable, low-noise cron posture artifact rather than treating dynamic job count as compliance state.

Future evidence files should meet the same bar as `exec-approvals.json`: stable product schema, explicit policy opt-in, posture-oriented fields, deterministic redaction, stable `oc://` evidence references, and focused tests for invalid, missing, and drift states. Policy should not inspect credential stores, raw secret material, arbitrary wrapper file contents, filesystem layout integrity, transient runtime decisions, or logs. Those surfaces should remain with Doctor, command-specific self-tests, credential/status commands, or log monitoring.

Each policy section should document the `policy.jsonc` syntax, the observed OpenClaw state, the reason an operator would set the field, whether the check is global or supports selectors, whether missing or unobservable evidence is a finding, and whether the rule participates in baseline comparison and scoped strictness. The CLI docs should continue to show:

```bash
openclaw policy check
openclaw policy check --json
openclaw policy compare --baseline official.policy.jsonc
openclaw doctor --lint
```

The rollout plan is:

1. Land policy sections as narrow conformance PRs, each with docs and focused tests.
2. Keep PR bodies explicit about syntax, evidence, check ids, and config-only semantics.
3. Run local review and ClawSweeper until each PR has no findings.
4. Update `docs/cli/policy.md` as the canonical user-facing policy reference.
5. Add strictness metadata for every policy field that participates in compare or scoped overlay validation.
6. Add maintainer-only drift checks that flag new config areas or changed config semantics that policy may need to consider.
7. Track future policy evidence work as separate implementation issues: P1 for exec approvals plus sandbox mode allowlists, P2 for config-backed coverage, and separate non-policy work for Doctor, command self-tests, credential/status commands, or log monitoring.

## Rationale

This design keeps policy as a compliance layer over OpenClaw configuration rather than a parallel configuration system. It lets operators compare approved policy files, check active workspace configuration against the approved workspace policy, and collect stable findings and attestation hashes without claiming to inspect secret material or enforce runtime authorization.

The alternative of mirroring every config field into policy would make policy comprehensive on paper, but it would duplicate ownership and make drift harder to control. The alternative of treating policy as runtime enforcement would overclaim the evidence available in Policy 1.0 and would require separate runtime hooks that this RFC does not define.

Policy rules are operator and audit contracts once shipped. Renaming a field, changing a finding id, or changing strictness semantics can break downstream baselines and attestation workflows. When a policy field must change, prefer accepting the old field during a deprecation window, reporting a clear Doctor or policy finding, documenting the migration in the CLI policy reference, and preserving attestation behavior where possible.

## Unresolved questions

- Should `policy compare` remain the final command name, or should OpenClaw expose an alias such as `policy conform` for baseline workflows?
- Which additional selectors are worth adding after `agentIds` and `channelIds`?
- Should Gateway or provider policy ever support selectors, or are those intentionally workspace-global until OpenClaw has attributable evidence?
- What is the minimum maintainer drift check needed to keep policy current with config changes without making policy a public config-audit command?
- Which runtime enforcement hooks, if any, should explicitly consume policy rules after 1.0?
