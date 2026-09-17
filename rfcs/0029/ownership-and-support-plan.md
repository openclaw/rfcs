# Control Model ownership and support plan

This plan names the existing OpenClaw teams and proposed directly responsible
individuals for the Control Model publication surface. It is a nomination
packet, not evidence that any person or team has accepted ownership.

OC6 cannot begin until every accountable owner records acceptance on the RFC or
publication PR. One person may cover multiple roles, but each role keeps a
separate acceptance and escalation obligation.

## Owner nominations

| Surface | Accountable owner | DRI nominee | Deputy nominee | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Gateway Client package and model API | `@openclaw/maintainer` | `@steipete` | `@vincentkoc` | Maintainer-team authority; highest recent Gateway Client contribution and review activity. | Acceptance pending |
| Gateway protocol compatibility | `@openclaw/maintainer` | `@steipete` | `@vincentkoc` | Maintainer-team authority; highest recent protocol contribution and both are RFC approvers. | Acceptance pending |
| Control UI reference adopter | `@openclaw/maintainer` | `@steipete` | `@vincentkoc` | Maintainer-team authority and sustained Control UI ownership. `@shakkernerd` is the proposed implementation reviewer for UI-specific behavior. | Acceptance pending |
| Security review and incident escalation | `@openclaw/openclaw-secops` | `@steipete` | `@vincentkoc` | Existing CODEOWNERS security team and current secops membership. | Acceptance pending |
| npm release and rollback | `@openclaw/openclaw-release-managers` | `@steipete` | `@vincentkoc` | Existing CODEOWNERS release boundary plus maintainer and release-history evidence. The release team must confirm or replace the individual nominees. | Acceptance pending |
| RFC contract approval | `@openclaw/openclaw-rfc-approvers` | `@steipete` | `@vincentkoc` | Current RFC approver team membership. | Acceptance pending |

The team names above are existing GitHub teams. The individual nominations are
based on current team membership, repository contribution history, and the
existing CODEOWNERS boundaries as observed on 2026-08-16. They must be replaced
if the relevant teams choose different DRIs.

## Required acceptance

Each accountable owner must comment on the RFC or OC6 publication PR with:

1. the surface accepted;
2. the named DRI and deputy;
3. the supported OpenClaw versions and compatibility window;
4. the required release, security, and rollback checks;
5. the triage expectation and response path for regressions or security
   reports;
6. the conditions for deprecation or ownership transfer; and
7. a link to the accepting comment or approval.

Silence, code review, team membership, or approval of a lower-stack evidence PR
does not count as support ownership.

Use the [owner acceptance record](owner-acceptance-record.md) to make each
decision explicit and comparable. The record is a template, not an assignment
or default acceptance.

## Role obligations

### Gateway Client package

- Own the exported model subpaths, declarations, browser/Node compatibility,
  finite defaults, and migration policy.
- Review breaking or behavior-changing projection updates.
- Keep package acceptance and conformance fixtures release-blocking.

### Gateway protocol

- Own the wire methods, scopes, request/event schemas, and supported predecessor
  boundary used by the model.
- Classify additive model projection changes separately from incompatible wire
  changes.
- Approve changes to command authorization or artifact materialization RPCs.

### Control UI

- Keep Control UI as the executable reference adopter for the supported slice.
- Confirm behavior parity, rollback, and the exact incumbent code eligible for
  deletion.
- Keep product presentation, routing, and renderer registration outside the
  model.

### Security

- Review trust-boundary changes, artifact normalization, selected-view
  materialization, action authorization, epoch retirement, payload bounds, and
  logging/error exposure.
- Route security reports through the existing OpenClaw security process.
- Block publication when a finding can cross session, agent, connection, or
  authorization boundaries.

### Release

- Own packed-artifact verification, npm publication, release notes, rollback,
  and support-window recording.
- Require clean browser and Node consumers to install every supported subpath
  from the exact release artifact.
- Confirm the predecessor/main compatibility canaries before publication.
- Prevent a tag or release note from claiming support when publication or
  install proof is partial, and record the deprecation or rollback action if a
  bad artifact cannot be withdrawn.

## Ownership changes

If a DRI or deputy cannot continue, the accountable team must name a
replacement before the next behavior-changing release. Until then, release of
the affected surface remains blocked; maintainership must not silently fall to
the RFC author, an adopter, or an unacknowledged reviewer.

## Publication decision

OC5 technical evidence is complete enough to request owner acceptance:
conformance, package acceptance, performance, compatibility, lifecycle, and
security gates all have fork-only proof. The complete OC1-OC5 and CU4-CU5 stack
also passed independent GPT-5.6 Terra, Claude Opus 5, and Gemini 3.1 Pro Preview
reviews plus a clean Codex branch review after accepted findings were fixed.
OC6 remains blocked until the acceptance records above are explicit and the
owners choose the supported version window, release vehicle, observation
period, and rollback authority.
