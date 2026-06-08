---
title: Analyst-skill seams on a pipeline-shaped session substrate
authors:
  - David Steeves <davesteeves@gmail.com>
created: 2026-06-08
last_updated: 2026-06-08
status: draft
issue:
rfc_pr: TBD
---

# Proposal: Analyst-skill seams on a pipeline-shaped session substrate

## Summary

Replace OpenClaw's file-shaped session and transcript substrate with a three-stage
data pipeline — `raw`, `processed`, `curated` — and define **analyst-skill seams**
at the stage boundaries where designated skills evaluate flowing data and emit
Policy-conformance evidence.

The substrate sits behind a Gateway-owned seam in the same shape RFC 0007
established for the scheduler: the Gateway owns ingestion, registration, and
evidence; a plugin owns stage execution. Analyst skills run in the existing skill
runtime, register against named seams, and emit one of `pass`, `transform`,
`block`, or `escalate`. Each emission produces a redacted evidence record in the
shape RFC 0003 already defines, extending Policy conformance from
config-conformance into data-conformance.

Stage registration, analyst registration, and Policy artifact mutation are
control-plane responsibilities. Agent-plane skills, including analyst skills,
cannot mutate any of them. This boundary is the load-bearing wall of the
proposal: without it, an agent that processes data can also rewrite the policy
that supervises it, and the rest is theater.

## Motivation

OpenClaw is mid-migration on storage shape, mid-expansion on policy evidence,
and has a recent precedent for plugin-owned execution behind a Gateway seam.
Three concurrent threads of work converge on the same unresolved question: what
shape should runtime data take as it flows through the agent surface?

- [openclaw/rfcs#7] (RFC 0007, *Plugin SDK session/transcript storage migration*)
  begins decoupling agents from file-shape session and transcript APIs by
  routing them through a storage-neutral SDK pointed at SQLite.
- [openclaw/rfcs#5] (RFC 0007, *Pluggable scheduler seam in gateway*)
  demonstrates a pattern where the Gateway retains heartbeats and run-state
  ingestion while a plugin owns dispatch.
- [openclaw/rfcs#6] expands RFC 0003 (*Policy conformance*) with redacted
  evidence shapes and the `execApprovals` policy artifact, formalizing how
  posture is reported back from policy-aware surfaces.

Each is correct in its own scope. Together they describe a substrate that is
storage-agnostic, plugin-extensible, and policy-aware — but stops at the
storage layer. A key-value or row-shaped store, even one as fast and embedded
as SQLite, has no native concept of stage boundaries where data can be
inspected. Policy evaluation today is *config*-conformance: it answers
"does the configured posture match the policy?" It cannot answer "does the data
currently flowing through this session contain PII the policy forbids?",
"has PHI been redacted before this message reaches the channel layer?", or
"has retention expired on this curated artifact?" Those questions require a
substrate that names the moments when evaluation can run.

Pipelines name those moments. The raw / processed / curated medallion pattern
from data engineering is uninteresting on its own — the value is that each
boundary between stages is an explicit seam where validation, redaction,
classification, and triage can be performed by code that is not the producer
and not the consumer. Borrowing that pattern from data engineering into the
agent substrate gives OpenClaw a place to hang analyst skills without
embedding policy enforcement in arbitrary call sites.

The second motivation is structural integrity. A supervisor that the
supervised can rewrite is not a supervisor. OpenClaw skills today run with
broad capability over their workspace; if the policy that governs an analyst
skill is itself a file the agent-plane can mutate, then the analyst skill is
a courtesy, not a control. The control plane / agent plane line — already
implicit in OpenClaw's "Gateway is the control plane" framing — needs to be
named explicitly for the analyst surface to mean anything.

The window for proposing this shape is brief. PR #7 lands first or this RFC
lands first; in either order, the storage layer settles into something
durable. If it settles into "SQLite with helper APIs" and nothing more, the
seams have to be retrofitted later against a contract that does not anticipate
them. If it settles into "pipeline with named stages and registered seams,"
SQLite remains a perfectly good backend for any individual stage, and the
seams come for free.

## Goals

- Define a three-stage pipeline contract — `raw`, `processed`, `curated` —
  as the shape the session and transcript substrate exposes to skills.
- Define analyst-skill seams at each stage boundary: a registered skill reads
  the payload, returns one of `pass`, `transform`, `block`, or `escalate`,
  and emits a redacted Policy evidence record.
- Extend Policy conformance from config-conformance to include
  data-conformance evidence, reusing RFC 0003's redacted evidence shape and
  attestation discipline.
- Name the control-plane / agent-plane boundary explicitly: who may register
  stages, who may register analyst skills, who may mutate Policy artifacts,
  and what happens when an agent-plane caller attempts any of those.
- Establish an evolution path where operator trust improves as the analyst
  inventory matures — without changes to the substrate or the Gateway.

## Non-Goals

- Choosing a storage backend for any stage. SQLite, an object store, an
  embedded log, or any combination remain valid. The pipeline contract is
  storage-neutral.
- Defining concrete plugin manifest fields, jsonc schemas, or CLI command
  shapes for the analyst-skill contract. Those belong to a follow-up RFC
  scoped to the contract surface, after the architectural shape is agreed.
- Bundling a default analyst-skill catalog with OpenClaw. Operators decide
  which analyst skills to install and enable, same as any other skill.
- Replacing or competing with RFC 0006 (*Feeds*). Feeds describe catalog
  metadata flowing into the client; this RFC describes runtime data flowing
  through it.
- Introducing a new isolation primitive. Analyst skills run in the existing
  skill runtime. The trust improvement comes from where they run in the
  pipeline, not from how they are sandboxed.
- Solving multi-tenant isolation as a side effect. Per-tenant analyst rosters
  are mentioned in unresolved questions but are not in scope here.

## Proposal

The proposal has three parts: a pipeline substrate, a seam contract, and a
control-plane boundary. Each is described architecturally; concrete contract
shapes are deferred.

### 1. Pipeline substrate

Session and transcript data move through three named stages with explicit
boundaries between them. The substrate is plugin-pluggable behind a
Gateway-owned seam, in the same shape RFC 0007 (*Pluggable scheduler*)
proposes: the Gateway owns registration, ingestion, and run-state visibility;
a plugin owns the per-stage execution detail. The built-in implementation
remains the default; a plugin declaring `owns: "session-pipeline"` (or the
shape the contract RFC settles on) replaces it without changing the Gateway's
externally visible behavior.

- **Raw.** Captured ingress — channel messages, tool outputs, skill traces,
  any payload entering the session surface. Untrusted by default. No policy
  claims are made about raw data.
- **Processed.** Normalized, parsed, indexed. Analyst skills may have
  rewritten, redacted, or annotated the payload at this boundary. Processed
  data is reviewable but not yet considered safe for arbitrary downstream
  surfaces.
- **Curated.** Published surfaces: channel context, search results, exported
  artifacts, anything an external surface or other skill reads. Data that
  reaches curated has been evaluated and stamped with evidence at every seam
  it crossed.

Stages are typed by purpose, not by physical store. A backend may collapse
processed and curated into the same SQLite table; the contract distinguishes
them so seams have somewhere to run.

### 2. Analyst-skill seams

At each stage boundary the Gateway invokes the analyst skills registered for
that seam, in a deterministic order configured by Policy. Each analyst skill
emits one of:

- `pass` — the payload is unchanged; evidence is recorded.
- `transform` — the payload is replaced; evidence records the rule and the
  redacted nature of the change, not the original content.
- `block` — the payload does not cross the seam; the producer is notified;
  evidence records the block reason and the rule that triggered it.
- `escalate` — the payload is held; a human-review event is emitted through
  the same surface RFC 0005 defines for approval prompts; evidence records
  the escalation and its disposition once resolved.

Each emission produces one Policy evidence record in the redacted shape
RFC 0003 defines. The evidence carries the seam identifier, the analyst skill
identifier, the rule reference, and the verdict — not the payload content.
Multiple analyst skills may register against the same seam; the default
conflict-resolution rule is *most-restrictive-wins* (`block` outranks
`escalate` outranks `transform` outranks `pass`). Policy may override that
ordering. A seam with no analyst skills registered passes payloads through
with an empty-evidence stamp, preserving observability.

The contract is intentionally narrow at this RFC's scope: a follow-up RFC
defines the manifest field, the registration API, the evidence-record fields,
and the timing/cancellation semantics. What matters at this level is that the
seam exists, that the verdicts are bounded, and that the evidence shape is
the one RFC 0003 already defines.

### 3. Control-plane segregation

Three operations are reserved to the control plane:

- Registering or removing a stage plugin.
- Registering or removing an analyst-skill seam binding.
- Mutating any Policy artifact (`policy.jsonc`, `exec-approvals.json`,
  any future artifact RFC 0003 admits).

The Gateway is the enforcement point. A call originating from the agent
plane that attempts any of these three operations is denied; the attempt
itself is recorded as Policy evidence (a `policy/control-plane-violation`
check, in the RFC 0003 evidence shape). Operators perform control-plane
operations through the same `openclaw onboard` / CLI surface they already
use to manage the Gateway; agent-plane code has no path to them.

This boundary is what makes the analyst surface trustworthy. Without it,
an agent skill that runs in the same workspace as the Policy artifacts can
quietly edit them — or, more subtly, can register an analyst skill of its
own that returns `pass` on the inputs the agent will later produce.
Segregation is not a performance choice or an ergonomic preference; it is
the difference between supervision and the appearance of supervision.

## Rationale

The proposal sits inside a small alternative space. Each alternative was
evaluated against three criteria: (a) does it create explicit boundaries
where policy can run on data, (b) can trust improve over time without
substrate churn, and (c) is the supervision surface tamper-resistant?

| Alternative                          | Boundaries | Pluggable trust | Tamper-resistant |
|--------------------------------------|------------|-----------------|------------------|
| SQLite alone (PR #7)                 | No         | Partial         | No               |
| In-line hooks at write sites         | Implicit   | No              | No               |
| External pipeline (Kafka, Pub/Sub)   | Yes        | Yes             | Yes              |
| In-skill responsibility (status quo) | No         | No              | No               |
| Pipeline + seams + segregation       | Yes        | Yes             | Yes              |

**SQLite alone** is the natural endpoint of PR #7 if no shape is proposed on
top of it. It is a real improvement over file-shape APIs — querying gets
better, schemas land, migrations become tractable. It does not create stage
boundaries. Adding seams later means retrofitting them against a contract
that does not anticipate them.

**In-line hooks** at the existing transcript-write call sites would be the
shortest path to "we have a place where policy runs." They scatter policy
into arbitrary code paths, require Gateway edits for every new analyst
contract, and make the supervision surface unreviewable. They optimize for
shipping the first check; they do not survive the tenth.

**External pipelines** — Kafka, Pub/Sub, anything that requires a separate
broker — deliver the architecture cleanly. They are overweight for OpenClaw's
"personal AI on your own devices" ethos. They also conflict with the
operational model: an OpenClaw user should not have to operate a message
broker to enable PII redaction. External pipelines are a reasonable *backend*
choice for an individual stage; they should not be a contract requirement.

**In-skill responsibility** is the status quo, implicitly. Every skill
author is asked to do the right thing. It does not scale, produces no
central evidence, and is trivially bypassed by any skill that fails to
implement the contract — or by any skill author who never knew about it.

Pipeline + seams + segregation is the smallest shape that satisfies all three
criteria. The pipeline gives boundaries. The seam contract gives pluggable
trust — operators get better analysts over time without changing the
substrate. Control-plane segregation gives tamper-resistance: the surface
that supervises the agents is not in the agents' write-path.

On the structural point: any architecture where the supervised can rewrite
the supervisor is structurally equivalent to having no supervisor. This is
the GitHub Actions runner self-update problem, the SUID escalation problem,
and the build-step substitution problem in different costumes. Naming the
control-plane / agent-plane line in this RFC, even before the contract
details, is the cheapest way to keep that line load-bearing as the substrate
evolves.

## Unresolved questions

- **Degradation when no analysts are registered.** Proposed behavior:
  stages still exist; payloads flow through with empty-evidence stamps.
  Is empty-evidence the right default, or should an unconfigured seam be a
  Policy conformance failure?
- **Multi-analyst conflict resolution.** Most-restrictive-wins is the
  proposed default. Are there seams where ordered evaluation with
  short-circuit is preferable, and should Policy express that uniformly?
- **Curated-stage evidence query.** Does curated data carry a queryable
  evidence index (so an operator can ask "show me everything blocked by
  rule X this week"), or is evidence a sidecar on each item?
- **Interaction with Feeds (RFC 0006).** When a curated artifact is
  published into a feed entry — for example, a skill review surface — does
  evidence travel with it? Does the consuming feed get to inspect it?
- **Escalation channel mapping.** The `escalate` verdict produces a
  human-review event. RFC 0005 defines approval prompt markdown; is the
  escalation event a new approval kind, or a sub-kind of an existing one?
- **Per-tenant analyst rosters.** A control plane that supports multiple
  tenants would want per-tenant rosters; the boundary is the same shape.
  Likely yes, out of scope for this RFC, worth a forward reference.
- **Where the contract lives.** This RFC keeps the contract architectural
  and defers manifest/API shape to a follow-up RFC. Reviewers may prefer
  one combined RFC; the trade-off is acceptance speed against breadth.
- **Relationship to ClawHub root feeds.** If analyst skills become a
  significant catalog category, do they get a `reviewed-analysts` root
  feed lane (RFC 0006), and if so does that lane have any control-plane
  semantics distinct from regular skills?
