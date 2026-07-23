---
title: Command Catalog
authors:
  - Gio
created: 2026-07-04
last_updated: 2026-07-23
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/32
---

# Proposal: Command Catalog

## Summary

Add a read-only command catalog through `openclaw commands list` and
`openclaw commands inspect`. It joins command information OpenClaw already owns
without adding a dispatcher, policy engine, runtime hook, or execution path.

The catalog reports known command metadata available to the current invocation.
It identifies which sources were collected and preserves unknown operational
effects instead of turning missing classifications into permissive facts.

## Motivation

OpenClaw command information is distributed across static CLI descriptors,
command routes, the runtime Commander tree, plugin CLI descriptors, and paired
nodes. Help text is useful for people but is not a stable machine-readable
inventory. Reimplementing these joins in compliance, diagnostics,
documentation, and prompt consumers would create drift.

Operators and compliance tooling need a consistent way to review:

- which known command surfaces were included in an observation;
- where each record came from;
- which commands are classified as reading or mutating state;
- which commands declare confirmation or elevated risk; and
- which entries are public, internal, hidden, static, or runtime-observed.

The result is inventory evidence, not proof that every possible lazy or external
surface was observed, not a signed attestation, and not an authorization
decision.

Existing issues show demand for parts of this joined view:

- [#52919](https://github.com/openclaw/openclaw/issues/52919) led to Gateway
  `commands.list` for remote agent-command discovery.
- [#77943](https://github.com/openclaw/openclaw/issues/77943) documents the cost
  of inconsistent machine-readable list output.
- [#50011](https://github.com/openclaw/openclaw/issues/50011) and
  [#77730](https://github.com/openclaw/openclaw/issues/77730) show node command
  policy or configuration diverging from runtime-advertised commands.
- [#98978](https://github.com/openclaw/openclaw/issues/98978) documents command
  descriptions drifting across help and completion surfaces.
- [#96697](https://github.com/openclaw/openclaw/issues/96697) shows why plugin
  collection should remain explicit for read-only listings.
- [#89797](https://github.com/openclaw/openclaw/issues/89797) shows a node
  capability advertised without corresponding registered commands.
- [#78082](https://github.com/openclaw/openclaw/issues/78082) shows stale
  external-provider registrations.

Prompt-related issues [#14619](https://github.com/openclaw/openclaw/issues/14619),
[#14785](https://github.com/openclaw/openclaw/issues/14785), and
[#41417](https://github.com/openclaw/openclaw/issues/41417) motivate an optional,
explicitly scoped projection. They do not make prompt generation part of the
initial catalog contract or establish a token-savings claim.

## Goals

- Provide a parseable, read-only command inventory through a familiar CLI.
- Keep existing descriptors, routes, Commander registrations, plugins, and
  nodes as the owners of command facts.
- Label records by source, discovery mode, visibility, and collection scope.
- Report effect, risk, and confirmation metadata only when an owning source
  declares it.
- Support exact inspection without scraping help text.
- Give later documentation, diagnostics, prompt, and policy consumers one
  normalized input.

## Non-Goals

- Adding a command dispatcher, expression language, or alternate execution API.
- Enforcing permissions, policy, risk, or confirmation.
- Producing a signed compliance attestation.
- Claiming that current-invocation, opt-in plugin, node, or external-provider
  observations are globally complete.
- Replacing CLI, route, plugin, node, or Gateway registries.
- Replacing or expanding Gateway `commands.list` in the initial change.
- Enabling command guidance in every agent prompt by default.
- Freezing command counts.

## Proposal

### CLI surface

```text
openclaw commands list [--json|--markdown] [--plugin-descriptors]
openclaw commands list [--json|--markdown] --node <node-id>
openclaw commands inspect <command-path...> [--json|--markdown]
```

`list` joins static descriptors, command routes, routed operations, the
currently registered Commander tree, explicitly requested plugin descriptors,
and explicitly requested or caller-supplied node observations. `inspect`
hydrates the requested lazy command group and returns exact matching records,
including aliases and inherited route metadata.

The JSON result includes collection status for each source. Callers can
distinguish not requested, collected, complete static input, current-invocation
runtime input, and node observation scope. Counts are descriptive and
non-normative.

The `commands` root becomes a core-reserved CLI group. Plugins may contribute
through existing supported registration points but do not replace a core root
command. Registration precedence remains owned by the existing CLI registry.

### Existing Gateway surface

Gateway `commands.list` remains the agent/provider-scoped view of chat, native,
skill, and plugin commands. The proposed CLI is an operator/developer view of
CLI, route, runtime, plugin-CLI, and selected node records. Neither calls nor
replaces the other. A future integration may normalize Gateway results as an
additional labeled source.

### Source metadata

Two small optional concepts cover facts that cannot be inferred reliably:

```ts
type CommandEffectProfile = {
  effectMode: "read" | "mutating" | "mixed";
  confirmationRequired?: boolean;
  risk?: "low" | "medium" | "high";
};

type CommandExposure = {
  tier?: "public" | "internal";
};
```

Effect metadata is advisory and does not grant permission. An omitted value is
`unknown`; inventory and evidence consumers must not convert it to read-only,
low-risk, or confirmation-free. A prompt projection may apply a separately
labeled conservative presentation fallback, such as unknown risk plus required
confirmation, without changing the source-owned record.

`public` records may appear in public list and generated-documentation views.
`internal` records remain available to operator, audit, and policy consumers.
Existing hidden descriptors are omitted from public inventory and generated
documentation.

Plugin-provided values cross a JavaScript boundary and are validated during
registration. Invalid or expanded shapes are discarded. The three optional
plugin descriptor fields are `effectProfile`, `commandExposure`, and `hidden`.

### Plugin collection boundary

`--plugin-descriptors` is explicit because collection imports and executes
enabled, trusted plugin modules in a restricted metadata-registration mode.
Disabling OpenClaw runtime activation side effects does not make arbitrary
module top-level code inert. Requested collection fails visibly on loader
exceptions or error diagnostics so an incomplete result is not presented as
complete. Plugin logs are routed away from machine-readable stdout.

### Node observations

`--node` reuses the pairing-aware diagnostics path for Gateway `node.describe`.
It adds no protocol method or node registry. The selected node must be connected
and must identify itself as the requested node.

The handshake supplies command identifiers, not descriptions, argument schemas,
approval state, availability guarantees, or semantic effects. Live records
therefore remain identifier-only with unknown semantics. Command identifiers
must match a strict bounded grammar before they can enter a model-facing
projection. Rejected identifiers may still be reported separately by a future
audit collector, but are never prompt instructions.

An explicitly opted-in `node-operator` projection may render a validated node
identifier and the existing `nodes action=invoke` routing shape. It does not
invent `{}` parameters when no argument schema is available, and unknown
effects receive conservative prompt guidance rather than permissive defaults.

### Stability boundary

The CLI and versioned JSON output are the supported external access paths.
Internal builders remain implementation details unless exported deliberately.

For schema version 1, stable fields are the schema version, record identity,
source/provenance, discovery mode, collection status, and documented enum value
kinds. New optional fields may be added compatibly. Removing or renaming a
stable field, changing its meaning, or narrowing an accepted enum requires a
schema-version change. Ordering is deterministic. Counts and the set of
commands are not stable compatibility promises.

Plugin metadata remains optional but follows the same validation and
unknown-preservation rules once emitted.

## Acceptance Criteria

- `commands list` and `commands inspect` execute no catalog record.
- Omitted effect metadata remains omitted or explicitly unknown in JSON,
  Markdown, evidence, and prompt inputs.
- Output reports whether runtime, plugin, and node sources were collected.
- Hidden descriptors do not enter public list or generated-documentation views.
- Requested plugin collection executes only enabled, trusted modules in the
  documented restricted mode and fails on incomplete error-level collection.
- Live node records use the established diagnostics authentication path,
  validate identifiers, and remain identifier-only unless an owner supplies
  richer metadata.
- Prompt projection is caller-opted-in, tool- and scope-gated, bounded, and
  excludes unsafe identifiers.
- Generated documentation uses only static public metadata, and every canonical
  generator input schedules or runs its freshness check.
- Each implementation slice type-checks and tests independently of later slices.

## Implementation Drafts

The active upstream implementation is split into independently reviewable
slices:

1. [Foundation #100960](https://github.com/openclaw/openclaw/pull/100960):
   `commands list` and exact `commands inspect`, normalized metadata, collection
   status, and opt-in plugin descriptors.
2. [Live node inventory #104158](https://github.com/openclaw/openclaw/pull/104158):
   pairing-aware `node.describe` collection for one connected node.
3. [Scoped prompt projection #104159](https://github.com/openclaw/openclaw/pull/104159):
   explicit run-scoped command guidance, including bounded `node-operator`
   records.
4. [Generated reference #104160](https://github.com/openclaw/openclaw/pull/104160):
   checked-in static command reference and freshness guard.

Additional fork drafts are internal prototypes, not public or callable surfaces
and not acceptance requirements for the initial CLI:

- [Policy evidence #30](https://github.com/giodl73-repo/openclaw/pull/30)
  projects normalized, non-attesting records with collection scope.
- [Runtime drift #31](https://github.com/giodl73-repo/openclaw/pull/31)
  compares semantic records and collection scope while ignoring observation
  timestamps.
- [Bounded search #32](https://github.com/giodl73-repo/openclaw/pull/32)
  prototypes compact search and exact hydration, including runtime commands.

Historical comparison drafts
[Option A #24-#29](https://github.com/giodl73-repo/openclaw/pulls?q=is%3Apr+is%3Aopen+24+25+26+28+29)
and broader catalog drafts
[#11-#16](https://github.com/giodl73-repo/openclaw/pulls?q=is%3Apr+11+12+13+14+15+16)
remain implementation history rather than normative specification.

## Documentation Automation

The generated reference covers static public command names, descriptions,
provenance, and declared effects. It deliberately excludes deployment-specific
plugin and node observations. Workflow, examples, SDK semantics, and safety
guidance remain hand-authored.

Possible later slices may add public-page coverage checks, generated nested
subcommand and option references, and runtime-inventory guidance. Those should
consume the same catalog rather than create another command registry.

## Alternatives

A broader `openclaw catalog` prototype included audit, summary, test-matrix, and
ownerless tool adapters. It was rejected as the initial proposal because it
introduced a larger product noun and mixed command inventory with advisory
reports before the base contract was accepted.

Another alternative is a typed operation or DSL layer. That would create a
second execution surface that could drift from existing CLI and tool behavior.
This proposal stays read-only and points every fact back to an existing owner.

## Unresolved Questions

- Should plugin descriptor collection remain an explicit flag permanently, or
  can a future lifecycle-owned metadata cache avoid repeated trusted-module
  execution?
- Should Gateway `commands.list` eventually become another labeled catalog
  source, or remain an intentionally separate agent/provider view?
- Which routed operations should owners classify next with explicit effect
  metadata?

The required OpenClaw `maintainer-discussion` thread must be linked before RFC
acceptance.
