# Control Model owner acceptance record

Use this record to accept, replace, or decline an ownership nomination for
RFC 0029. It does not assign ownership by default. Silence, team membership,
code review, or approval of an evidence PR does not count as acceptance.

OC6 remains blocked until every surface has an explicit accepted owner and the
shared release decisions below are recorded.

## Shared publication decisions

| Decision | Required record |
| --- | --- |
| Release vehicle | Package, release train, and first supported version |
| Compatibility window | Supported OpenClaw versions and promised predecessor behavior |
| Required gates | Conformance, package, security, performance, and compatibility checks that block release |
| Regression response | Triage owner, response path, and escalation expectation |
| Security response | Private reporting and incident escalation path |
| Rollback authority | Who can halt, deprecate, or roll back a partial or bad publication |
| Observation window | Minimum evidence required before OC7/CU6 deletes incumbent paths |

## Surface decisions

Record one decision for each surface:

| Surface | Accountable team | Decision | DRI | Deputy | Acceptance link |
| --- | --- | --- | --- | --- | --- |
| Gateway Client package and model API | `@openclaw/maintainer` | Pending | Pending | Pending | Pending |
| Gateway protocol compatibility | `@openclaw/maintainer` | Pending | Pending | Pending | Pending |
| Control UI reference adopter | `@openclaw/maintainer` | Pending | Pending | Pending | Pending |
| Security review and incident escalation | `@openclaw/openclaw-secops` | Pending | Pending | Pending | Pending |
| npm release and rollback | `@openclaw/openclaw-release-managers` | Pending | Pending | Pending | Pending |
| RFC contract approval | `@openclaw/openclaw-rfc-approvers` | Pending | Pending | Pending | Pending |

Valid decisions are:

- **Accept:** confirm the accountable team, DRI, deputy, and obligations.
- **Replace:** name the replacement accountable team, DRI, or deputy.
- **Decline:** state why the surface should not be published or who must decide.

## Comment template

Copy this block into the RFC review:

```text
Surface:
Decision: Accept | Replace | Decline
Accountable team:
DRI:
Deputy:
Supported versions and compatibility window:
Required release and security gates:
Regression and security response path:
Rollback or deprecation authority:
Ownership-transfer conditions:
Acceptance applies to OC6 publication: Yes | No
```

An acceptance is complete only when every field is explicit or links to an
existing owner-controlled policy that supplies the answer.
