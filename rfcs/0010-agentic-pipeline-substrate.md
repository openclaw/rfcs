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

OpenClaw's session and transcript surface is the place where policy will, in
practice, either hold or fail. Today the substrate has no named moments where
policy can run on flowing data, and no structural separation between the code
that produces data and the code that evaluates it. This RFC proposes both:
shape the substrate as a three-stage data pipeline — `raw`, `processed`,
`curated` — so that stage boundaries become explicit *seams* where designated
**analyst skills** can read, classify, transform, or hold payloads; and
reserve the substrate, the analyst registry, and the Policy artifacts to the
Gateway control plane so that agent-plane code cannot quietly rewrite the
supervisor that supervises it.

The pipeline is a contract about *shape*, not *backend*. A local SQLite file,
an embedded log, an object store, or a remote managed queue can each back any
stage; the contract names where evaluation happens and who is allowed to
register it.

Analyst skills run in the existing skill runtime — no new isolation primitive
— and emit verdicts (`pass`, `transform`, `block`, `escalate`) shaped as
redacted evidence in the form RFC 0003 already defines. Trust in the surface
improves as the analyst inventory matures; the substrate stays stable.

## Motivation

There is one structural gap underneath several converging threads of work:
OpenClaw has no place where policy can be evaluated against flowing session
data, and no boundary that keeps the code being evaluated from mutating the
evaluator.

Policy conformance today is *config*-conformance. It answers: *does the
configured posture match the policy?* It cannot answer: *does the data
currently flowing through this session contain PII the operator did not
intend to capture? Has PHI been redacted before this message reaches the
channel layer? Has retention expired on this curated artifact?* Those
questions need a substrate that names the moments when evaluation can run.
A row-shaped store, even SQLite, has no native concept of those moments.

Three recent threads of work shorten the path to filling that gap:

- [openclaw/rfcs#7] (*Plugin SDK session/transcript storage migration*)
  begins decoupling agents from file-shaped APIs by routing them through a
  storage-neutral SDK pointed initially at SQLite. Once the SDK exists, the
  shape of what sits behind it becomes the question.
- [openclaw/rfcs#5] (*Pluggable scheduler seam in gateway*) demonstrates a
  pattern where the Gateway retains registration, ingestion, and run-state
  visibility while a plugin owns per-domain execution. The same seam shape
  fits a session pipeline.
- [openclaw/rfcs#6] (updating RFC 0003, *Policy conformance*) reuses the
  redacted evidence shape across new policy artifacts. The same evidence
  shape can carry data-conformance verdicts emitted at stage boundaries.

Pipelines from data engineering supply the missing primitive. The raw /
processed / curated medallion pattern is uninteresting on its own — its
value is that each stage boundary is an explicit place where code that is
not the producer and not the consumer can inspect, classify, and decide.
Borrowing that pattern into the agent substrate gives OpenClaw a place to
hang analyst skills without embedding policy enforcement in arbitrary call
sites. "Seam" names the boundary itself, not the implementation: a seam is
the interstitial moment where evaluation can run independently of either
side.

The second motivation is structural integrity. A supervisor that the
supervised can rewrite is not a supervisor. OpenClaw skills today run with
broad capability over their workspace; if the policy that governs an
analyst skill is itself a file the agent-plane can mutate, the analyst skill
is a courtesy, not a control. The control plane / agent plane line —
already implicit in the Gateway's stated role as control plane — needs to
be named explicitly for any analyst surface to mean anything.

On the strength of policy claims: this RFC does not assert that analyst
skills can *forensically prove* that PII was removed. RFC 0003's evidence
model is observational; the redacted-evidence shape records that a verdict
was reached, not the inputs that produced it. Analyst skills under this
proposal *declare* redaction intent. Cryptographic attestation of redaction
(pre-image hashes, signer chains, forensic audit) is a separate problem
left to a follow-up RFC. Naming this boundary now is important because the
distinction between "we ran an analyst" and "we can prove what it did" will
matter the first time an operator faces a real audit.

## Goals

- Define a three-stage pipeline contract — `raw`, `processed`, `curated` —
  as the shape the session and transcript substrate exposes to skills.
- Define analyst-skill seams at each stage boundary: a registered skill
  reads the payload, returns one of `pass`, `transform`, `block`, or
  `escalate`, and emits a redacted Policy evidence record.
- Reserve stage-plugin behavior to passive I/O. A registered stage plugin
  owns storage shape and transport; it does not evaluate, transform, or
  filter payloads — that surface belongs exclusively to analyst skills.
- Extend Policy conformance to include data-conformance evidence emitted at
  stage boundaries, reusing RFC 0003's redacted evidence shape.
- Name the control-plane / agent-plane boundary explicitly: who may register
  stages, who may register analyst skills, who may mutate Policy artifacts,
  and what the Gateway does when an agent-plane caller attempts any of those
  (denied + evidence-emitted, not silently ignored).
- Establish an evolution path where operator trust improves as the analyst
  inventory matures without changes to the substrate or the Gateway.

## Non-Goals

- Choosing a storage backend for any stage. A local SQLite database, an
  embedded append-only log, an object store, or a managed remote queue
  remain valid choices. The pipeline contract is shape, not backend.
- Defining concrete plugin manifest fields, jsonc schemas, registration
  APIs, or CLI command shapes. Those belong to a follow-up RFC scoped to
  the contract surface, after the architectural shape is agreed.
- Bundling a default analyst-skill catalog with OpenClaw. Operators decide
  which analyst skills to install and enable, same as any other skill.
- Replacing or competing with RFC 0006 (*Feeds*). Feeds describe catalog
  metadata flowing into the client; this RFC describes runtime data flowing
  through it.
- Introducing a new isolation primitive. Analyst skills run in the existing
  skill runtime. The trust improvement comes from where they run in the
  pipeline, not from how they are sandboxed.
- Forensic attestation of redaction. This RFC defines declarative evidence;
  cryptographic proof of what was inspected and what was removed is a
  separate problem.
- Solving multi-tenant isolation as a side effect. Per-tenant analyst
  rosters are mentioned in unresolved questions but are not in scope here.

## Proposal

The proposal has three parts: a pipeline substrate, a seam contract, and a
control-plane boundary. Each is described architecturally; concrete contract
shapes are deferred to a follow-up RFC.

### 1. Pipeline substrate

Session and transcript data move through three named stages with explicit
boundaries. The substrate is plugin-pluggable behind a Gateway-owned seam,
in the same shape demonstrated by [openclaw/rfcs#5]: the Gateway owns
registration, ingestion, and run-state visibility; a plugin owns the
per-stage I/O detail. The built-in implementation remains the default; a
plugin declaring ownership of the session pipeline replaces it without
changing the Gateway's externally visible behavior.

- **Raw.** Captured ingress — channel messages, tool outputs, skill traces,
  any payload entering the session surface. Untrusted by default. No policy
  claims are made about raw data.
- **Processed.** Normalized, parsed, indexed. Analyst skills may have
  rewritten, redacted, or annotated the payload between raw and processed.
  Processed data is reviewable but not yet considered safe for arbitrary
  downstream surfaces.
- **Curated.** Published surfaces: channel context, search results, exported
  artifacts, anything an external surface or other skill reads. Data that
  reaches curated has been evaluated and stamped with evidence at every
  seam it crossed.

Stages are typed by purpose, not by physical store. A backend may collapse
processed and curated into the same SQLite table or split them across a
local file and a remote queue. The contract distinguishes them so seams
have somewhere to run. Stage plugins are responsible for storage shape and
transport only — they do not inspect, transform, or filter payloads. Any
mutation of payload content is the exclusive responsibility of registered
analyst skills.

### 2. Analyst-skill seams

At each stage boundary the Gateway invokes the analyst skills registered
for that seam, in a deterministic order configured by Policy. Each emits
one of:

- `pass` — the payload is unchanged; an evidence record is written.
- `transform` — a modified payload is returned and used downstream. The
  original payload is retained by the Gateway in a separate write-restricted
  store, available to Policy audit but not to downstream agent-plane reads.
  Evidence records the rule and the redacted nature of the change, not the
  original content.
- `block` — the payload does not cross the seam. The producer is notified
  with a structured error; evidence records the block reason and the rule
  that triggered it.
- `escalate` — the payload continues downstream marked
  `pending-human-review`; a review event is emitted through the surface
  RFC 0005 defines for approval prompts; evidence records the escalation.
  Downstream consumers can choose to consume `pending-human-review` data
  with the marker visible, or wait for resolution. Escalation does not
  block indefinitely; a Policy-configured timeout converts unresolved
  escalations to `block` or `pass` per operator choice.

Each emission produces one Policy evidence record in the redacted shape
RFC 0003 defines. The evidence carries the seam identifier, the analyst-skill
identifier, the rule reference, and the verdict — not the payload content.
Multiple analyst skills may register against the same seam; the default
conflict-resolution rule is *most-restrictive-wins* (`block` outranks
`escalate` outranks `transform` outranks `pass`). Policy may override that
ordering, and the contract RFC will specify the layered-redaction case
where ordered short-circuit (e.g., PII redaction before semantic
validation) is intended.

A seam with no analyst skills registered emits an **empty-evidence stamp**:
a verdict-less evidence record naming the seam and recording that it was
evaluated against an empty registry. The stamp is observability data, not a
`pass` verdict. Policy may declare certain seams as requiring at least one
registered analyst — an empty stamp at such a seam is a conformance
failure, not a silent pass.

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
operations through the same onboard/CLI surface they already use to manage
the Gateway. Agent-plane code has no path to them.

The OpenClaw model already names the Gateway as the control plane in its
top-level description; this RFC makes the line load-bearing for the
analyst surface. Stage plugins, despite running under the control plane's
authority, are constrained to passive I/O: they own how a stage is stored
and transported, not what is stored. A compromised or malicious stage
plugin cannot reorder payloads, redact evidence, or suppress blocks
without leaving the passive-I/O contract — and Policy can be written to
reject stage plugins that do.

## Rationale

The proposal sits inside a small alternative space. Each alternative is
evaluated against three criteria: (a) does it create explicit boundaries
where policy can run on flowing data, (b) can trust improve over time
without substrate churn, and (c) is the supervision surface tamper-resistant?

| Alternative                          | Boundaries | Pluggable trust | Tamper-resistant |
|--------------------------------------|------------|-----------------|------------------|
| SQLite alone (per [openclaw/rfcs#7]) | No         | Partial         | No               |
| In-line hooks at write sites         | Implicit   | No              | No               |
| External pipeline (Kafka, Pub/Sub)   | Yes        | Yes             | Yes              |
| In-skill responsibility (status quo) | No         | No              | No               |
| Pipeline + seams + segregation       | Yes        | Yes             | Yes              |

**SQLite alone** is the natural endpoint of [openclaw/rfcs#7] if no shape
is proposed on top of it. It is a real improvement over file-shape APIs.
It does not create stage boundaries. Adding seams later means retrofitting
them against a contract that does not anticipate them.

**In-line hooks** at existing transcript-write call sites are the shortest
path to "we have a place where policy runs." They scatter policy into
arbitrary code paths, require Gateway edits for every new analyst
contract, and make the supervision surface unreviewable. They optimize
for shipping the first check; they do not survive the tenth. They also
have no story for stage plugins that want to swap storage shape — the
hooks are coupled to whatever code path the original maintainer wrote.

**External pipelines** — Kafka, Pub/Sub, anything that requires a separate
broker — deliver the architecture cleanly and are the right answer at
data-platform scale. They are overweight for personal-AI on personal
devices: an OpenClaw user should not have to operate a message broker to
enable PII redaction. They remain a reasonable *backend* choice for an
individual stage in a managed deployment; they are not a contract
requirement.

**In-skill responsibility** is the status quo. Every skill author is
asked to do the right thing. It produces no central evidence, scales with
the number of skill authors rather than the number of policies, and is
trivially bypassed by any skill that fails to implement the contract — or
any skill author who never knew about it.

Pipeline + seams + segregation is the smallest shape that satisfies all
three criteria. The pipeline gives boundaries. The seam contract gives
pluggable trust. Control-plane segregation keeps the surface that
supervises the agents out of the agents' write-path.

On the structural point: any architecture where the supervised can rewrite
the supervisor is structurally equivalent to having no supervisor. The
build-step substitution attack, the GitHub Actions runner self-update
attack, and the SUID escalation attack are instances of the same failure.
Naming the control-plane / agent-plane line in this RFC, even before the
contract details, is the cheapest way to keep that line load-bearing as
the substrate evolves.

## Unresolved questions

- **Empty-evidence policy default.** Should a seam with no registered
  analysts emit a stamp by default (current proposal) or be a Policy
  conformance failure by default? Sensitive seams (e.g., the
  processed → curated transition for channel context) may justify a
  stricter default.
- **Multi-analyst conflict resolution.** Most-restrictive-wins is the
  proposed default. Layered-redaction cases — PII redaction before
  semantic validation, or schema normalization before content filtering —
  require ordered short-circuit, expressed in Policy. The contract RFC
  should define the configuration surface and pick a sensible default
  ordering.
- **Compromised analyst skill.** A malicious analyst skill can emit
  `pass` when it should `block`, creating a rubber-stamp surface. The
  contract RFC should define supply-chain integrity for analyst skills
  (signer chains, attestation) at least as strong as that for other
  skills, and consider whether evidence records themselves need
  cryptographic chaining.
- **Forensic vs declarative redaction.** This RFC defines declarative
  evidence: a verdict was reached, by which rule. A future RFC may define
  forensic evidence: a hash of the pre-redaction payload, a signer chain
  on the redacted output, an audit log of the inputs the analyst saw.
  This is the right path to GDPR/HIPAA defensibility; it is out of scope
  here.
- **Time-of-check / time-of-use.** Between stage boundaries, may an
  agent-plane skill read the processed store while an analyst skill is
  evaluating the processed → curated seam? The contract RFC should
  specify that stage transitions are causally ordered and that evidence
  is written before downstream reads of the destination stage are
  allowed.
- **Curated evidence query.** Does curated data carry a queryable
  evidence index (so an operator can ask "show me everything blocked by
  rule X this week") or is evidence a sidecar on each item? The contract
  RFC should address operator-facing audit ergonomics.
- **Interaction with Feeds (RFC 0006).** When a curated artifact is
  published into a feed entry, does evidence travel with it? Does the
  consuming feed get to inspect it?
- **Per-tenant analyst rosters.** A control plane that supports multiple
  tenants would want per-tenant rosters; the boundary is the same shape.
  Likely yes, out of scope for this RFC.
- **Where the contract lives.** This RFC keeps the contract architectural
  and defers manifest/API shape to a follow-up RFC. Reviewers may prefer
  one combined RFC; the trade-off is acceptance speed against breadth.
