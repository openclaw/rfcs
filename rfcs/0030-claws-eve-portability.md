---
title: Claws <> Eve Portability Profile
authors:
  - Gio
created: 2026-08-21
last_updated: 2026-08-21
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/63
---

# Proposal: Claws <> Eve Portability Profile

## Summary

Define a non-normative portability profile between Claw packages and Eve
agent/template projects. The profile maps portable Claw package concepts to Eve
project concepts, identifies the authority and proof invariants that must
survive translation, and recommends one bidirectional demo: port Eve's Marketing
Team template into a Claw and port one manager-Claw pattern into an Eve
team-style template.

The first draft of the testable mapping is in
[`0030/claws-eve-portability-profile-v0.md`](0030/claws-eve-portability-profile-v0.md).

This RFC does not make Eve a required Claws runtime. It exists to let Claws and
Eve collaborators evaluate whether their agent-package and agent-team models can
interoperate without weakening either system's ownership, consent, or
deployment model.

## Motivation

Claws package one complete job-specific agent with managed instructions,
workspace resources, dependency declarations, capability boundaries, preview
and consent, provenance, and update/remove expectations. Recent Awesome Claws
work has made that model concrete across 66 packages, including manager Claws
such as Delegation Coordinator, Household Steward, and Work Chief of Staff.

Eve templates expose a similar product shape from the other direction: a
deployable agent project with instructions, channels, connections, tools,
skills, and subagents. Eve's Marketing Team template is especially close to the
manager-Claw model: a lead routes work to specialists, specialists produce
artifacts in external systems, and irreversible sends or publishes require
human approval.

Earlier Claws portability concerns centered on durable instruction and
workspace files such as `SOUL.md`, `workspace/AGENTS.md`, schemas, templates,
fixtures, and handoff docs. Eve's dynamic and file-backed instruction model
suggests these may be mapping questions rather than structural blockers.

## Goals

- Define a reviewable mapping between Claw package concepts and Eve project
  concepts.
- Preserve Claws' authority, provenance, and consent invariants when mapping to
  Eve tools, connections, channels, subagents, and approval gates.
- Preserve Eve's deployable template model when mapping to a Claw package.
- Identify the first proof demos needed before claiming portability.
- Keep RFC 0016 independent of Eve while leaving room for an Eve-specific
  interoperability profile.

## Non-Goals

- Do not require Eve to implement OpenClaw's installer, SQLite lifecycle state,
  or exact CLI commands.
- Do not require Claws to adopt Eve's runtime, deployment, or repository
  layout.
- Do not weaken Claws preview, consent, provenance, or update-drift rules to
  fit a simpler template model.
- Do not claim automatic bidirectional conversion until at least one template
  runs through proof in both directions.
- Do not make this portability profile a merge blocker for RFC 0016.

## Proposal

Treat Claws <> Eve interoperability as a harness portability profile layered on
top of the portable Claws contract.

The companion sidecar
[`0030/claws-eve-portability-profile-v0.md`](0030/claws-eve-portability-profile-v0.md)
defines the first concrete mapping. It is the place to review source and target
fields, unsupported-field handling, manager-Claw delegation invariants,
authority classifications, and proof requirements.

The profile should define a translation contract from a Claw package to an Eve
project and from an Eve template to a Claw package. The contract is successful
only when the translated artifact preserves:

- the agent's purpose and package identity;
- managed instruction ownership versus user-owned local preferences;
- declared resources such as schemas, fixtures, templates, and handoff docs;
- tool, channel, connection, and schedule authority;
- human approval gates for irreversible actions;
- subagent delegation boundaries and result provenance;
- update drift and review behavior;
- validation/proof hooks.

The profile should start with examples rather than a broad conversion tool.

### Concept mapping

| Claws concept | Eve concept | Required preservation |
| --- | --- | --- |
| `CLAW.md` manifest and prompt body | `agent/agent.ts` and `agent/instructions.md` | Package identity, purpose, role, and owner-visible authority summary. |
| Installed `SOUL.md` and `workspace/AGENTS.md` | Dynamic instructions and file-backed instructions | Managed instruction text must stay distinguishable from user-owned local preferences. |
| `schemas/`, `templates/`, `fixtures/`, handoff docs | Eve skills, reference files, Blob-backed state, or sandbox files | Resource names and update behavior must be deterministic enough for review. |
| `profiles/openclaw.yml` and declared capabilities | Eve tools, connections, channels, subagents, and approval gates | Least privilege and blocked-action disclosure must survive translation. |
| Claw preview/apply consent plan | Eve human-in-the-loop approval surface | Sends, publishes, deletes, bookings, broker actions, calendar mutations, and other irreversible effects need exact owner approval. |
| Delegation Coordinator, Household Steward, Work Chief of Staff | Eve lead with subagents | The lead routes work and synthesizes artifacts but does not silently broaden specialist or owner authority. |
| Awesome Claws regression, screenshot, and installed proof | Eve validation, deployment diagnostics, and template checks | Portability requires proof artifacts, not only source conversion. |

### Eve to Claw demo

Port Eve's Marketing Team template into an Awesome Claws package.

The Claw should preserve:

- a marketing lead agent;
- specialists for product marketing, long-form content, social, SEO, and email;
- shared brand context as a single-owner resource;
- Notion, Typefully, Resend, and Slack as declared optional dependencies;
- approval gates before scheduling or publishing posts, sending campaigns,
  deleting content, moving pages, or launching irreversible work;
- a source-backed handoff artifact that can be reviewed without those
  integrations installed.

The goal is not to clone Eve's deployment model. The goal is to prove that an
Eve team template can be represented as a portable Claw with clear dependency,
resource, and authority boundaries.

### Claw to Eve demo

Port one manager-Claw pattern into an Eve template. Delegation Coordinator and
Work Chief of Staff are the best first candidates.

The Eve template should preserve:

- a lead that creates self-contained briefs;
- specialists that start from bounded task context rather than shared hidden
  conversation state;
- result artifacts with source and provenance references;
- a synthesis step that exposes conflicts, gaps, and owner questions;
- no recursive or unbounded delegation;
- no final commitment without the accountable owner's approval.

This tests whether Eve's subagent model can express the manager-Claw invariant:
managers coordinate specialist artifacts and decision forums, but do not become
the human or functional owner of the work.

## Rationale

The two systems are close enough to justify a profile, but different enough that
implicit compatibility would be risky.

Claws emphasize portable package identity, local lifecycle, preview/apply
consent, workspace provenance, and update/remove behavior. Eve emphasizes
deployable agent projects, channels, connections, dynamic instructions,
subagents, and Vercel-hosted runtime services. A profile lets the communities
compare these shapes without forcing one system to hide the other's real
ownership model.

Starting with the Marketing Team template and one manager Claw keeps the effort
bounded. Marketing Team exercises lead/specialist routing, shared state,
external integrations, and approval gates. Delegation Coordinator or Work Chief
of Staff exercises bounded delegation, provenance, result synthesis, and
accountable human decisions. If both demos work, broader conversion can be
considered from evidence rather than analogy.

## Unresolved questions

- Which Eve resource should represent Claw-managed schemas, fixtures,
  templates, and handoff docs when a deployed project does not have a normal
  local workspace?
- How should an Eve template expose the exact effect preview that Claws require
  before applying capability, MCP, schedule, or workspace mutations?
- What is the minimum conformance proof for an Eve-to-Claw port: static
  conversion, package validation, screenshot, installed lifecycle proof, or a
  live integration run?
- What is the minimum conformance proof for a Claw-to-Eve port: Eve validation,
  deployment diagnostics, one subagent route, or one approval-gated external
  action preview?
- Should the portability profile live in the OpenClaw RFC repo, Awesome Claws,
  an Eve template repository, or a separate joint spec once the first demos
  exist?

## References

- RFC 0016: Claws: https://github.com/openclaw/rfcs/pull/48
- Eve dynamic instructions: https://eve.dev/docs/instructions#dynamic-instructions
- Eve templates: https://eve.dev/templates
- Eve Marketing Team template: https://eve.dev/templates/marketing-team-eve-template
- Awesome Claws manager set: https://github.com/giodl73-repo/awesome-claws/pull/25
- Household Steward: https://github.com/giodl73-repo/awesome-claws/pull/48
- Work Chief of Staff: https://github.com/giodl73-repo/awesome-claws/pull/50
- Care/Sports/Stocks draft: https://github.com/giodl73-repo/awesome-claws/pull/51
