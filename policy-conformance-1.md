# Policy Conformance 1.0

## Summary

Define OpenClaw policy as a configuration conformance and audit-evidence layer
over existing OpenClaw settings. A workspace operator authors `policy.jsonc`,
OpenClaw observes the active workspace configuration as evidence, and policy
checks report drift through `openclaw policy check` and the shared
`doctor --lint` health surface.

Policy 1.0 should help operators answer a narrow question: does this workspace
configuration conform to the approved policy file? It should not become a
second configuration language, a secrets-management system, or a broad runtime
enforcement layer.

## Goals

- Keep policy anchored in existing OpenClaw configuration and workspace
  declarations.
- Report conformance findings with stable check ids, evidence references, and
  attestation hashes.
- Support organization baselines with `openclaw policy compare --baseline`.
- Allow named scoped overlays for selectors such as agent ids and channel ids.
- Require scoped overlays to be equal or more restrictive than broader policy
  when they touch the same field.
- Use shared strictness metadata for policy comparison and scoped overlay
  validation.
- Cover the first enterprise conformance areas without copying every OpenClaw
  config option into policy.
- Keep runtime enforcement explicitly out of scope unless an existing OpenClaw
  runtime hook can prove and enforce the same contract.

## Non-Goals

- Replacing OpenClaw configuration.
- Claiming there are no secrets in config or taking ownership of secret-value
  management.
- Inspecting per-agent credential stores or secret material.
- Enforcing every policy requirement at runtime.
- Mirroring every plugin, channel, provider, or agent setting.
- Treating unobservable runtime state as passing evidence.
- Adding an operator-facing governance product beyond policy conformance.

## Current Model

The Policy plugin contributes conformance checks to OpenClaw. Policy rules live
in `policy.jsonc`; plugin settings live under `plugins.entries.policy.config`.

The current policy surface covers:

- configured channels;
- MCP server ids;
- model provider ids and selected model refs;
- private-network SSRF posture;
- ingress and channel access posture;
- Gateway exposure posture;
- agent workspace posture;
- global and per-agent tool posture;
- governed tool metadata declarations;
- sandbox runtime posture;
- config secret provider and SecretRef provenance;
- config auth profile metadata;
- policy-to-policy baseline comparison.

The final health gate remains `doctor --lint`. Policy-specific authoring and
audit workflows can run `openclaw policy check`, but policy findings should also
flow into doctor so operators have one shared lint signal.

## Current Problems

### Policy can drift toward parallel configuration

As policy grows, there is pressure to mirror every OpenClaw setting in
`policy.jsonc`. That would make policy harder to review, harder to keep current,
and ambiguous about which file actually controls runtime behavior.

Policy 1.0 should stay focused on conformance questions that can be answered
from observed OpenClaw configuration and workspace declarations.

### Evidence quality varies by surface

Some posture is directly observable from config, such as configured channels,
provider ids, MCP server ids, and Gateway bind posture. Other posture depends on
runtime-specific details or secret material that policy should not inspect.

A policy field without attributable evidence should fail as unobservable for
that target instead of becoming a best-effort pass.

### Baselines and scoped policy need shared comparison rules

Enterprise baselines and per-agent or per-channel overlays both need to answer
whether one policy is equal or stricter than another. If each check implements
that comparison separately, scoped overlays and baseline comparison will drift.

Strictness metadata should be owned with the policy schema so baseline compare,
scoped overlay validation, and future repair previews use the same rules.

### Runtime enforcement is easy to overclaim

Policy findings can identify nonconforming config, but they are not runtime
authorization decisions by themselves. Any future enforcement must name the
runtime hook, evidence, and tests that prove the same contract at the point of
use.

## Proposed Contract

### Policy is authored, not inferred

OpenClaw should not generate an authoritative policy from the current workspace
and call that compliant. Operators author the required posture. OpenClaw then
observes active settings and reports where they drift.

Generated examples, repair previews, or upgrade helpers can assist authors, but
the approved `policy.jsonc` remains the authority.

### Policy checks use observed config evidence

Each check should identify:

- the policy requirement being evaluated;
- the OpenClaw config or workspace declaration used as evidence;
- whether the evidence conforms;
- the stable finding id when it does not conform;
- the policy, evidence, findings, and attestation hashes for audit records.

When OpenClaw cannot observe a configured policy field for the selected target,
the result should be a finding, not a silent pass. For example, a container
posture field that cannot be observed for a selected sandbox backend should
report that the claim is unobservable for that target.

### Policy is not a second config language

Policy field names should express the compliance concern rather than duplicate
low-level config fields. For example, sandbox policy should say whether a
container posture allows host networking or requires read-only mounts. It
should not expose Docker-specific names unless Docker is the compliance concern.

OpenClaw config remains the source of behavior. Policy only states the approved
posture and reports whether the current config satisfies it.

### Runtime enforcement is explicit and separate

Policy 1.0 is config conformance. It can make findings about tool posture,
sandbox posture, ingress posture, and Gateway exposure based on observed config,
but those findings are not runtime authorization decisions by themselves.

Future runtime enforcement can reuse policy rules only where OpenClaw has a
stable runtime hook, clear evidence, and tests that prove the same contract at
the point of use.

## Scoped Overlays

Policy supports top-level rules for broad workspace posture and named
`scopes.<scopeName>` blocks for stricter posture on selected targets.

A scope name is descriptive. Matching comes from selectors inside the scope.
The initial selectors are:

| Selector | Supported sections | Purpose |
| --- | --- | --- |
| `agentIds` | `tools`, `agents.workspace`, `sandbox` | Apply stricter agent, tool, or sandbox posture to one or more runtime agents. |
| `channelIds` | `ingress.channels` | Apply stricter channel ingress posture to one or more configured channels. |

Unsupported selector and section combinations should be rejected instead of
ignored. A scope without an enforceable selector should be invalid.

The same target can appear in multiple scopes. That allows operators to compose
policy by purpose, such as "release agents" and "restricted shell agents." If
two applicable scopes touch the same field, the duplicate field must be equal
or more restrictive according to shared policy metadata. Weaker duplicate
claims should fail during policy compilation before check evaluation begins.

## Strictness Metadata

Policy should keep comparison semantics in schema-owned metadata rather than
custom per-check logic. The same metadata should be used for:

- `policy compare --baseline`;
- scoped overlay validation;
- future dry-run upgrade or repair previews.

The initial rule types are:

- allow-lists: checked values must be equal or narrower;
- deny-lists: checked values must be equal or broader;
- required booleans: checked values must keep the required value;
- exact lists: checked values must match;
- ordered strings: checked values must move only toward the more restrictive end
  of the defined order.

Empty values should not receive a universal meaning. Each policy field should
define whether an empty array means "allow nothing," "require nothing," or
"rule omitted." A check should run only when its concrete rule is present.

## Baseline Comparison

`openclaw policy compare --baseline <file>` compares one policy file to another
policy file. It does not inspect runtime state, credentials, or secret values.

This supports the common enterprise lifecycle:

1. A central security or compliance owner authors an official baseline policy.
2. A workspace operator proposes or edits a workspace `policy.jsonc`.
3. `policy compare --baseline official.policy.jsonc --policy policy.jsonc`
   verifies that the workspace policy is not missing or weaker than the
   baseline.
4. `openclaw policy check` verifies that the active workspace config conforms
   to the approved workspace policy.

The checked policy can be stricter than the baseline. A broad top-level checked
rule can satisfy a scoped baseline rule when it is equally or more restrictive
for the selected target.

## Policy Areas

### Channels, MCP, models, and network

These are the seed conformance areas. They provide allow and deny policy for
configured communication and provider surfaces, plus private-network posture for
SSRF-sensitive access.

The contract is intentionally config-level. Policy can report that a denied
provider, channel, MCP server, or private-network posture is configured. It does
not prove that no external system can ever reach the same service.

### Ingress and Gateway exposure

Ingress policy covers direct-message session scope and channel group admission
posture. Channel-scoped ingress should use `channelIds` because channel posture
is attributable. Session DM scope remains global while the evidence is not
channel-attributable.

Gateway exposure policy covers bind posture, auth posture, Control UI posture,
remote Gateway posture, and HTTP endpoint posture. These checks should stay
close to operator-facing exposure questions rather than becoming a copy of
every Gateway config field.

### Agents, tools, and sandbox

Agent workspace policy and tool posture policy cover configured workspace
access, tool profile, filesystem posture, exec posture, elevated mode, additive
tool grants, and deny lists. These are config conformance checks, not runtime
operator approval checks.

Sandbox policy covers sandbox mode, backend, and observable container/browser
posture. Container posture fields should be allowed only where OpenClaw can
observe them for the selected target. Operators can use scopes to apply
different sandbox requirements to different agent groups.

### Secrets and auth profiles

Policy can require managed secret provider declarations, deny insecure provider
sources, and require auth profile metadata in OpenClaw config. It should not
read raw secret values or claim to regulate all secret lifecycle concerns.

Secrets management, credential storage, rotation, and runtime credential access
remain owned by their existing OpenClaw systems and future dedicated work.

## Documentation Requirements

Each policy section should document:

- the `policy.jsonc` syntax;
- the observed OpenClaw state;
- the reason an operator would set the field;
- whether the check is global or supports selectors;
- whether missing or unobservable evidence is a finding;
- whether the rule participates in baseline comparison and scoped strictness.

The CLI docs should continue to show the policy check commands:

```bash
openclaw policy check
openclaw policy check --json
openclaw policy compare --baseline official.policy.jsonc
openclaw doctor --lint
```

## Rollout Plan

1. Land policy sections as narrow conformance PRs, each with docs and focused
   tests.
2. Keep PR bodies explicit about syntax, evidence, check ids, and config-only
   semantics.
3. Run local review and ClawSweeper until each PR has no findings.
4. Update `docs/cli/policy.md` as the canonical user-facing policy reference.
5. Add strictness metadata for every policy field that participates in compare
   or scoped overlay validation.
6. Add maintainer-only drift checks that flag new config areas or changed
   config semantics that policy may need to consider.

## Compatibility Notes

Policy rules are operator and audit contracts once shipped. Renaming a field,
changing a finding id, or changing strictness semantics can break downstream
baselines and attestation workflows.

When a policy field must change, prefer:

- accepting the old field during a deprecation window;
- reporting a clear doctor or policy finding;
- documenting the migration in the CLI policy reference;
- preserving attestation behavior where possible.

## Open Questions

- Should `policy compare` remain the final command name, or should OpenClaw
  expose an alias such as `policy conform` for baseline workflows?
- Which additional selectors are worth adding after `agentIds` and
  `channelIds`?
- Should Gateway or provider policy ever support selectors, or are those
  intentionally workspace-global until OpenClaw has attributable evidence?
- What is the minimum maintainer drift check needed to keep policy current with
  config changes without making policy a public config-audit command?
- Which runtime enforcement hooks, if any, should explicitly consume policy
  rules after 1.0?

## Success Criteria

- Operators can explain the difference between policy conformance and runtime
  enforcement.
- A workspace can check active config against `policy.jsonc` and receive stable
  findings and attestation hashes.
- A workspace policy can be compared against an official baseline without
  inspecting runtime state or secrets.
- Scoped overlays support stricter per-agent and per-channel posture without
  weakening top-level policy.
- Adding a new policy section requires a documented syntax, evidence source,
  strictness rule, and focused tests.
- Policy remains a compliance layer over OpenClaw configuration, not a parallel
  configuration system.
