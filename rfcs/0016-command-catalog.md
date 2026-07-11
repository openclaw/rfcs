---
title: Command Catalog
authors:
  - Gio
created: 2026-07-04
last_updated: 2026-07-10
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/32
---

# Proposal: Command Catalog

## Summary

Add a read-only command catalog that joins command information OpenClaw already
owns into one structured inventory. The recommended initial surface is
`openclaw commands` with list and exact inspection. A broader
`openclaw catalog` with operational lenses remains a concrete alternative.
Neither option adds a dispatcher, policy engine, runtime hook, or execution
path.

## Motivation

OpenClaw command information is distributed across CLI descriptors, command
routes, the runtime Commander tree, plugin CLI descriptors, paired-node command
declarations, and command-like tool adapters. Those sources are useful
independently, but operators and automation currently have no single view that
can answer:

- what command surfaces exist;
- where each entry came from;
- which entries read or mutate state;
- which entries require confirmation or deserve risk attention; and
- which plugin entries are public inventory versus internal-only metadata.

Help text is designed for people, not as a stable machine-readable inventory.
Reimplementing the same joins in compliance, diagnostics, tests, and deployment
tools would create drift. A catalog view keeps the existing registries as the
source of truth and performs the join once.

This is also a practical compliance need. Operators need to enumerate the
command surfaces present in a deployment and consistently identify which ones
read state, mutate state, require confirmation, or carry elevated risk. The
catalog does not enforce those decisions; it makes the facts already owned by
command registries available for review and automation.

Existing issues show demand for parts of this joined view, although none asks
for this exact CLI:

- [#52919](https://github.com/openclaw/openclaw/issues/52919) requested runtime
  command discovery for remote clients and led to Gateway `commands.list`.
- [#77943](https://github.com/openclaw/openclaw/issues/77943) documents the cost
  of inconsistent machine-readable list output for downstream automation.
- [#50011](https://github.com/openclaw/openclaw/issues/50011) shows node command
  policy accepting names that do not match the known command inventory.
- [#77730](https://github.com/openclaw/openclaw/issues/77730) shows configured
  plugin node commands diverging from the commands advertised at runtime.
- [#98978](https://github.com/openclaw/openclaw/issues/98978) documents command
  descriptions drifting across root help, registered help, and completion.
- [#96697](https://github.com/openclaw/openclaw/issues/96697) shows a read-only
  node listing accidentally loading plugin CLI/runtime work and becoming much
  slower.
- [#89797](https://github.com/openclaw/openclaw/issues/89797) shows a node
  capability being advertised without corresponding registered commands.
- [#78082](https://github.com/openclaw/openclaw/issues/78082) shows disabled
  native commands remaining registered in an external provider control plane.

Prompt-related requests show another possible consumer of the same structured
facts. [#14619](https://github.com/openclaw/openclaw/issues/14619) asks to
remove duplicated tool-list prompt text,
[#14785](https://github.com/openclaw/openclaw/issues/14785) tracks broader tool
schema token overhead, and
[#41417](https://github.com/openclaw/openclaw/issues/41417) asks for assembled
prompt inspection. A future scoped projection could derive compact command
guidance from the catalog, but the initial implementation does not claim token
savings or replace tool schemas.

OpenClaw already exposes a Gateway RPC named `commands.list`. That RPC lists
agent-facing chat, native, skill, and plugin commands for an agent/provider
scope. It does not enumerate CLI routes, the full Commander tree, or paired-node
commands. The naming decision in this RFC must make that distinction clear.
Merging that agent-facing RPC inventory into either option is a possible
follow-up, not part of the initial implementations compared here.

## Goals

- Provide a parseable, read-only command inventory through a familiar CLI.
- Preserve existing descriptors, routes, and plugin registries as owners of
  command shape and behavior.
- Label entries by source and discovery mode.
- Report effect mode, risk, and confirmation requirements when the owning
  source knows them.
- Include the current invocation's Commander tree automatically while keeping
  plugin descriptor loading opt-in.
- Support focused inspection without requiring consumers to scrape help text.
- Give future prompt, generated-documentation, compatibility-fixture,
  diagnostics, and policy consumers one normalized input.

## Non-Goals

- Adding a command dispatcher or expression language.
- Executing commands from catalog records.
- Enforcing policy, permissions, risk, or confirmation in the catalog.
- Producing a signed compliance attestation or tamper-evident audit record.
- Replacing CLI, route, plugin, tool, or node registries.
- Replacing or expanding the Gateway `commands.list` RPC in the initial change.
- Generating agent prompts in the initial implementation.
- Freezing command counts or every advisory output field as a permanent API.
- Requiring schema snapshots, generated docs, or CI report artifacts before the
  core catalog shape is accepted.

## Proposal

### Naming and scope options

Both options use existing registries as sources of truth and keep execution in
the current command implementations.

#### Option A: commands list and inspect (recommended)

```text
openclaw commands list
openclaw commands inspect <command-path...>
```

This option stays command-owned: CLI descriptors, routes, the current Commander
tree, opt-in plugin CLI descriptors, and caller-supplied node command records.
It excludes ownerless tool adapters and aggregate audit/test/summary reports.
`commands` follows existing noun-based CLI groups such as `plugins` and
`skills`, but overlaps conceptually with the narrower Gateway `commands.list`
RPC described above.

Concrete drafts:

- [upstream draft](https://github.com/openclaw/openclaw/pull/100960)
- [commands list](https://github.com/giodl73-repo/openclaw/pull/24)
- [commands inspect](https://github.com/giodl73-repo/openclaw/pull/25)
- [optional scoped prompt projection](https://github.com/giodl73-repo/openclaw/pull/26)

#### Option B: broader catalog

```text
openclaw catalog list
openclaw catalog audit
openclaw catalog test-matrix
openclaw catalog summary
```

This option can include explicit adapters for command-like tool surfaces and
provides audit, test-planning, and operator lenses over the joined inventory.
`catalog` communicates that the result is a read-only cross-registry view, but
introduces a new product noun.

Concrete drafts:

- [catalog foundation](https://github.com/giodl73-repo/openclaw/pull/11)
- [dynamic and operator lenses](https://github.com/giodl73-repo/openclaw/pull/12)

Option A is recommended because it follows existing CLI naming, has a tighter
ownership boundary, and delivers useful list/inspect behavior without requiring
the broader reports. Search, prompt projection, generated docs, and additional
reports can follow after the command inventory contract is accepted.

### Option B catalog sources

The catalog joins existing sources rather than introducing a second command
registry:

- static core and sub-CLI descriptors;
- command paths, route IDs, and startup-policy keys from the existing command
  catalog;
- routed operations derived from those route entries;
- the current invocation's registered Commander tree, collected automatically;
- plugin CLI descriptors when the caller explicitly requests them; and
- explicit adapters for tool-backed surfaces that do not yet have an owning
  structured descriptor.

Every normalized entry identifies its source kind, source ID, and discovery
mode. Dynamic data remains labeled as dynamic rather than being presented as a
static compatibility promise. The catalog reports OpenClaw-known inventory; it
does not prove that an external provider such as Discord has reconciled stale
registrations. A future provider-specific collector may add that observed state
as a separately labeled source.

### Shared minimal source metadata

Most catalog fields are derived from information registries already own. Two
small optional concepts cover operational facts that cannot be inferred
reliably:

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

`CommandEffectProfile` is advisory metadata. It describes expected behavior but
does not grant permission, bypass confirmation, or replace command validation.
Risk remains separate from effect mode: a read operation can expose sensitive
data, while a local mutation can be low risk.

An omitted effect profile means `unknown`; it must not be interpreted as read,
low risk, or confirmation-free. Consumers that require complete classification
must report or reject unclassified entries rather than supplying permissive
defaults.

`CommandExposure` is deliberately not a per-consumer allowlist. `public` means
the entry is suitable for public catalog and documentation views; `internal`
keeps it in audit, operator, and policy inventory by default. Plugin CLI
descriptors may also use their existing descriptor shape to mark a placeholder
`hidden`, causing generated catalog inventory to omit it.

Prompt-specific command hints are not part of either source type. If a later
prompt consumer is accepted, the catalog lens should derive or own that
presentation metadata.

Plugin-provided metadata crosses a JavaScript boundary, so OpenClaw validates
effect and exposure values during plugin registration. Invalid or expanded
shapes are discarded instead of entering catalog output.

### Option B CLI views

The initial command surface is:

```text
openclaw catalog list [--json|--markdown] [--plugin-descriptors]
openclaw catalog audit [--json|--markdown] [--plugin-descriptors]
openclaw catalog test-matrix [--json|--markdown]
openclaw catalog summary [--json|--markdown] [--plugin-descriptors]
```

`list` returns the joined inventory. `audit` groups entries by risk, effect,
confirmation requirement, and route policy keys. `test-matrix` produces
non-blocking routed-operation test candidates. `summary` provides a compact
operator handoff, including separate medium-risk, high-risk, and
confirmation-required attention.

Plugin descriptors are opt-in because collecting them loads plugin metadata.
When requested, plugin effect profiles contribute to audit and summary output;
hidden descriptors remain omitted. JSON output remains machine-readable even
if plugin loading emits logs. Collection must use the non-activating metadata
path and must fail visibly when an error would make the requested inventory
incomplete.

### Stability boundary

The CLI and JSON output are the external access path for the initial proposal.
Builder modules under `src/` are implementation details unless package exports
are added deliberately later.

Schema versions, identity fields, provenance, and value kinds are candidates
for stable treatment. Inventory counts and advisory fields should remain
reviewable snapshots because OpenClaw's command and plugin surface changes over
time. A consumer may timestamp, hash, compare, or sign a snapshot, but the
catalog output alone is not an attestation that a command was permitted or that
the deployment remained unchanged after collection.

### Implementation drafts

The recommended Option A implementation is available in
[openclaw/openclaw#100960](https://github.com/openclaw/openclaw/pull/100960).
The two initial review layers and three optional follow-ups are available on the
author's fork:

1. [Commands list](https://github.com/giodl73-repo/openclaw/pull/24): command-owned
   static, routed, runtime, plugin, and caller-supplied node inventory.
2. [Commands inspect](https://github.com/giodl73-repo/openclaw/pull/25): exact
   inspection with lazy command hydration, aliases, and inherited route metadata.
3. [Scoped prompt projection](https://github.com/giodl73-repo/openclaw/pull/26):
   optional command-only model guidance, reviewed separately from the initial CLI.
4. [Generated command reference](https://github.com/giodl73-repo/openclaw/pull/28):
   optional command-only docs generation and freshness guard, reviewed separately
   from the initial CLI.
5. [Live paired-node commands](https://github.com/giodl73-repo/openclaw/pull/29):
   optional `node.describe` collection for one connected paired node, labeled as
   timestamped, identifier-only runtime observations and accepted by the scoped
   node-operator projection.

Three additional consumer drafts demonstrate how the same inventory can support
enterprise and agent workflows without expanding the initial catalog contract:

6. [Policy evidence projection](https://github.com/giodl73-repo/openclaw/pull/30):
   deterministic records for policy and compliance collectors. The projection
   preserves source and observation scope and explicitly identifies itself as
   inventory evidence, not a signed attestation or policy decision.
7. [Runtime inventory comparison](https://github.com/giodl73-repo/openclaw/pull/31):
   an advisory comparison of two inventory snapshots, reporting added, removed,
   changed, and scope-changed records. It describes OpenClaw-observed drift only;
   it does not infer an external control-plane change or policy violation.
8. [Bounded command search](https://github.com/giodl73-repo/openclaw/pull/32):
   compact search results plus exact-record hydration for progressive disclosure.
   Results are non-executable command metadata, are capped at 20 entries, and
   avoid placing the complete command directory in every model prompt.

These are optional follow-ups, not acceptance requirements for `commands list`
or `commands inspect`. They consume the normalized inventory and add no command
registry fields, dispatcher, execution path, policy engine, or new CLI namespace.

The broader Option B remains preserved in fork drafts for comparison:

1. [Catalog foundation](https://github.com/giodl73-repo/openclaw/pull/11).
2. [Dynamic/operator lenses](https://github.com/giodl73-repo/openclaw/pull/12).
3. [Prompt projection](https://github.com/giodl73-repo/openclaw/pull/13): a
   compact, scoped model-facing lens.
4. [Schema fixtures](https://github.com/giodl73-repo/openclaw/pull/14):
   reviewable snapshots for stable IDs and output shape.
5. [Generated reference docs](https://github.com/giodl73-repo/openclaw/pull/15):
   documentation generated from the catalog API.
6. [Hardening and consumer contract](https://github.com/giodl73-repo/openclaw/pull/16):
   an archived prototype of richer advisory artifacts and downstream boundaries.

### Future documentation automation

The earlier [generated reference draft](https://github.com/giodl73-repo/openclaw/pull/15)
is a prototype, not a claim that every OpenClaw CLI document was generated or
reconciled. It produced one reference page plus navigation, docs-map, glossary,
and freshness wiring.

If documentation automation follows the initial command inventory, it should:

- generate one checked-in `/cli/commands` reference from static command-owned
  inventory, with matching `--write` and `--check` commands;
- add a contract test that compares canonical descriptions across root help,
  registered command help, completion, and catalog output, addressing the drift
  demonstrated by [#98978](https://github.com/openclaw/openclaw/issues/98978);
- keep workflow and conceptual pages hand-authored, linking them to the
  generated reference instead of rewriting explanatory documentation;
- keep Plugin SDK semantics and compatibility guidance hand-authored; and
- exclude deployment-specific plugin, node, and external-provider observations
  from checked-in snapshots while documenting how operators can inspect them at
  runtime.

The command-only implementation of this first layer is available in
[fork PR #28](https://github.com/giodl73-repo/openclaw/pull/28). It is the
exemplar for generating one static reference and enforcing freshness; it does
not implement every follow-up below.

Possible documentation follow-ups, each independently reviewable, are:

1. **Public command page coverage.** Compare public static commands with
   `docs/cli/*` and require each command to declare a dedicated page, an alias
   target, or an explicit index-only classification. This catches a newly added
   command with no documentation destination.
2. **Subcommand and option references.** Generate compact command trees and
   option summaries from registered Commander metadata. Hand-authored command
   pages should embed or link those references while retaining authored
   examples, workflows, safety notes, and conceptual guidance.
3. **Runtime inventory guidance.** Document how operators export
   deployment-specific plugin descriptors with
   `openclaw commands list --json --plugin-descriptors`, including the
   completeness and external-provider boundaries described above. After a live
   paired-node collector exists, extend that guidance with its separately
   labeled node observations. Dynamic results should not become canonical
   checked-in OpenClaw docs.

This sequence intentionally avoids generated explanatory prose. Automation
owns inventory, structural coverage, and freshness; maintainers continue to own
behavioral guidance and compatibility commitments.

The initial recommended drafts keep node commands in the object model as
caller-supplied records. The optional live-node draft connects one selected
paired node through the existing Gateway `node.describe` method without adding a
new node protocol. It fails when the node is disconnected and does not invent
descriptions, argument schemas, or semantic effects that the node handshake does
not provide. Reconciling the Gateway `commands.list` agent view remains a
separate follow-up integration.

The required OpenClaw `maintainer-discussion` thread must be created and linked
before acceptance. The RFC remains in `draft` status until maintainers accept
it. Namespace, stable schema, plugin metadata, and Gateway convergence remain
maintainer decisions rather than contributor-declared contracts.

## Rationale

The main alternative is a new typed operation or DSL layer. That could make
mechanical operations explicit, but it would also create a second execution
surface that could drift from existing CLI and tool behavior. A read-only view
is lower risk: every record points back to a current owner, and execution stays
where it already works.

Another alternative is to expose only help text or the Commander tree. That
would miss route-policy metadata, plugin provenance, tool-backed surfaces, and
effect/confirmation facts. It would also encourage consumers to scrape display
text.

Both options perform the hard N-to-1 normalization in one layer while keeping
source additions small. Option A favors familiar CLI naming and a tighter
command-only boundary. Option B favors a distinct name and broader lenses. The
concrete drafts make that tradeoff reviewable before the public name and JSON
contract are accepted.

## Unresolved questions

- Which JSON fields should be stable in the first supported contract beyond
  schema version, identity, and provenance?
- Should plugin descriptor collection remain an explicit flag permanently, or
  can a future lifecycle-owned metadata cache make it safe by default?
- Should `CommandExposure` be accepted as plugin-facing API now, or remain an
  experimental optional field until another consumer adopts it?
- Which additional routed operations need explicit effect profiles rather than
  conservative catalog defaults?
- If prompt generation is proposed later, which catalog fields should be
  derived for that lens without expanding source registry metadata?
- Should the public CLI use `catalog` to distinguish this cross-registry view,
  or `commands` to match existing noun-based CLI groups?
- If `commands` is chosen, how should its CLI inventory relate to the existing
  Gateway `commands.list` RPC for agent-facing commands?
