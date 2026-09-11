# Enterprise runtime and access: RFC series

This informational guide connects four **draft** proposals under accepted [RFC 0027](../0027-openclaw-enterprise.md). Each draft owns its requirements; this guide adds no authority, resource, or acceptance decision.

## Four owners

| Proposal | Owns |
| --- | --- |
| [0036: work authority](https://github.com/openclaw/rfcs/pull/70) | Service-owned logical work, immutable scope and selected duration policy, child admission, and delivery authority. |
| [0035: identity and enforcement](https://github.com/openclaw/rfcs/pull/69) | Authenticated identity, execution assignment, bounded enforcement leases, and withdrawal. |
| [0034: credentials and GitHub](https://github.com/openclaw/rfcs/pull/68) | Credential issuance, protected custody, mediated use, and cleanup. |
| [0037: runtime and delivery](https://github.com/openclaw/rfcs/pull/71) | Stop/resume, bounded drain, writer exclusion, completed-state recovery, and completed-result delivery. |

![An operation passes from work admission through execution binding and credential mediation to runtime transitions and delivery. Lease renewal stays within work limits; replacement needs a fresh assignment for still-open work.](runtime-access-overview.png)

Arrows follow one operation, not service topology. Agent identity, work, execution, enforcement leases, and provider tokens have separate lifetimes. Execution defaults to uncapped unless admission selects a finite limit; every enforcement lease and provider-operation deadline remains finite.

## One operation

1. **Admit.** OCC checks the requester's invocation permission and the service's own access separately. It records logical work with immutable scope and an explicit finite-or-uncapped horizon policy (0036), selects an eligible execution, and issues finite enforcement authority (0035). Missing policy is not an uncapped selection.
2. **Dispatch and renew.** The trusted connector proves its identity and the represented execution/work binding. The first GitHub profile requires online OCC authorization for every dispatch and keeps provider credentials outside Agent execution (0034). Its first write flow approves and publishes an exact frozen candidate; transparent write adapters follow separately. Authority renewal requires current policy within every configured work, attempt, and ancestor limit; rotating a certificate or token extends none of them.
3. **Stop or complete.** A completed model turn does not close logical work. Graceful stop can drain eligible work within a finite deadline and preserve separately admitted delivery of an already completed result to its exact audience. Cancellation or security revocation withdraws affected work and delivery (0036/0037).
4. **Replace and clean up.** Changed permissions require a fresh isolation boundary; the selected Kubernetes/gVisor profile uses a fresh Pod and sandbox. Compute proves predecessor termination before shared writable replacement. Recovery restores supported completed state; active-session migration and replay remain later scope (0037). Closed work and uncertain effects cannot be revived or replayed. Credential cleanup survives work closure and Agent deletion under retained platform authority (0034).

## Acceptance boundary

RFC 0027's accepted baseline denies operations when authorization is unavailable. The first GitHub profile retains that behavior, including reads and credential maintenance; previously fetched local files are a separate boundary. The broader authority drafts retain an optional **explicit amendment** for separately selected, qualified reads under existing unexpired enforcement leases, with all required local evidence intact. Writes, authority renewal, admission, and new assignment still require current authority. That amendment remains unaccepted and is not an initial GitHub release gate.

Review shared contracts together and accept RFCs separately under the [repository lifecycle](../../README.md#rfc-lifecycle): identity and work authority first, lifecycle alongside them, then credential integration. Interfaces can be reviewed concurrently. Selecting SPIFFE for a connector does not select it for every Agent.

Acceptance does not qualify a production runtime. Each owner retains its mechanism and integration gates, including protected work attribution, measured withdrawal, recovery compatibility, and mediated provider access. Initial profiles name the helper/child and recovery subset they support; the full durable-child or changed-build recovery design is not an implicit prerequisite. Component checks and explicitly substituted external interfaces support bounded source evidence; runtime and provider claims require the corresponding live evidence.
