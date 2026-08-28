# Claws <> Eve portability profile v0

Status: draft sidecar for RFC 0030.

This sidecar defines the first testable shape of a Claws <> Eve portability
profile. It is intentionally non-normative until both directions have at least
one reviewed demo.

## Profile identity

Profile id: `openclaw.claws.eve-portability.v0`

The profile describes a lossy-but-reviewable mapping between:

- a Claw package that follows RFC 0016's portable package contract; and
- an Eve agent/template project with instructions, channels, connections,
  skills, tools, and subagents.

A mapper MUST report unsupported fields rather than silently dropping them. A
mapper MAY produce a partial draft when a field cannot be represented, but the
draft MUST carry explicit unresolved items.

## Eve to Claw mapping

An Eve template maps to one Claw package.

| Eve source | Claw target | Required behavior |
| --- | --- | --- |
| Template name, description, and repository metadata | `CLAW.md` package identity and README | Preserve the user-facing job, audience, and setup summary. |
| `agent/agent.ts` model and compaction settings | `profiles/openclaw.yml` when representable; otherwise package notes | Do not invent OpenClaw support for Eve-only runtime settings. |
| `agent/instructions.md` | `CLAW.md` prompt body and `workspace/AGENTS.md` | Preserve lead-agent behavior and completion criteria. |
| Specialist `agent/subagents/*` definitions | Delegation resources or manager-Claw instructions | Preserve routing descriptions, specialist scope, and one-level delegation limits. |
| Skills and reference files | `sources/<id>/templates`, `schemas`, `fixtures`, or package resources | Keep resource paths stable and reviewable. |
| Connections such as Slack, Notion, Resend, Typefully | External dependency declarations and capability guidance | Describe credential/setup needs and blocked actions; do not embed credentials. |
| Approval gates | Claw boundaries and handoff requirements | Irreversible actions remain owner-approved, preview-first, or blocked. |
| Deploy/readme instructions | Claw README setup and limitations | Separate Vercel deployment steps from portable Claw behavior. |

The generated Claw MUST include:

- a dependency and capability summary;
- explicit blocked actions for every irreversible Eve tool family;
- a fixture or handoff artifact that is useful without live connections;
- at least one regression vector covering a missing credential or unapproved
  action.

## Claw to Eve mapping

A Claw package maps to one Eve template project.

| Claw source | Eve target | Required behavior |
| --- | --- | --- |
| `CLAW.md` metadata and prompt body | `agent/agent.ts`, `agent/instructions.md`, and README | Preserve purpose, role, boundaries, and review expectations. |
| `workspace/AGENTS.md` | Lead instructions or specialist instructions | Preserve workflow, deliverables, and done criteria. |
| `schemas`, `templates`, `fixtures`, handoff docs | Skills, reference files, Blob-backed state, or sandbox files | Make resource placement explicit and stable. |
| `profiles/openclaw.yml` | Eve tools, channels, connections, subagents, and approval gates | Preserve least privilege; unresolved OpenClaw-only settings become warnings. |
| Preview/apply consent plan | Eve human-in-the-loop approval model | Preserve exact approval boundaries for external effects. |
| Regression and screenshot proof | Eve validation and demo proof | Preserve the proof intent even when the proof mechanism differs. |

The generated Eve template MUST include:

- a README section listing translated and unresolved Claw fields;
- an approval matrix for every external action family;
- a validation command or checklist;
- a demo prompt that exercises either a blocked action or an approval-gated
  preview.

## Manager-Claw delegation contract

When mapping manager Claws, the Eve template MUST preserve these invariants:

1. A lead MAY route work to specialists, but MUST NOT perform every specialist
   deliverable itself unless the translated template explicitly removes the
   specialist shape and reports that loss.
2. Each specialist receives a self-contained brief with the source context it is
   allowed to use.
3. Specialists do not share hidden conversation state by default.
4. Specialist outputs return as artifacts or artifact references.
5. The lead may synthesize conflicts, gaps, and owner questions.
6. The lead MUST NOT make final owner commitments, broaden specialist authority,
   or perform irreversible external actions without the mapped approval gate.
7. Delegation is one level deep unless the source package explicitly declares a
   deeper delegation contract.

These rules are intended to preserve the manager-Claw behavior demonstrated by
Delegation Coordinator, Household Steward, and Work Chief of Staff.

## Consent and authority contract

A portability mapper MUST classify each external effect as one of:

- `blocked`: the translated artifact must not perform it;
- `draft-only`: the translated artifact may prepare a draft or preview;
- `approval-required`: the translated artifact may perform it only after exact
  owner approval;
- `allowed-read`: the translated artifact may read under the declared scope;
- `unsupported`: the target runtime has no equivalent and must report the gap.

The following effects MUST NOT be silently translated as ordinary allowed tool
access:

- sends, publishes, deletes, page moves, scheduling, or queueing;
- broker, banking, trading, ticketing, booking, payment, or calendar mutations;
- credential, workspace, connection, or deployment administration;
- broad account-management operations outside the source package's scope.

## Proof requirements

A demo claiming this profile SHOULD include:

1. Source package/template URL and exact revision.
2. Generated target artifact or branch.
3. Static validation result.
4. One missing-dependency or unsupported-field diagnostic.
5. One blocked or approval-gated action proof.
6. One successful handoff or artifact output.
7. A short list of fields that did not translate cleanly.

For the first round, screenshot or transcript proof is sufficient. Later
versions may require installed lifecycle proof or deployed Eve diagnostics.

## Initial demo targets

### Eve to Claw

Port Eve Marketing Team to Awesome Claws:

- lead: marketing team lead;
- specialists: product marketing, content, social, SEO, email;
- shared state: brand context document;
- dependencies: Slack, Notion, Typefully, Resend;
- approval gates: publish, schedule, send, delete, move page, campaign launch.

### Claw to Eve

Port one of these manager Claws:

- Delegation Coordinator: smallest pure delegation contract;
- Work Chief of Staff: strongest work-portfolio manager contract;
- Household Steward: strongest consumer multi-principal privacy contract.

The first successful port should prefer Delegation Coordinator if the goal is a
small conformance slice, and Work Chief of Staff if the goal is a more vivid
product demo.
