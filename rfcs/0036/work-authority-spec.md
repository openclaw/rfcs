# Work Authority Specification

This supporting specification expands [RFC 0036](../0036-turn-bound-delegated-authority.md), proposed in [PR #70](https://github.com/openclaw/rfcs/pull/70). It describes proposed behavior, not an implemented or qualified production guarantee.

Logical Work gives service-owned Enterprise Agents scoped authority across messages and model turns. The initial profile admits one root Work with subordinate helpers in the same execution context. Continuation across replacement attempts and separately admitted durable children are later capabilities. OCC records the verified requester, service owner, immutable scope and explicit duration policy with any configured work horizon. Trusted services enforce finite, renewable leases tied to the original Work and exact execution. Invocation permission, service permission and data access remain separate.

The proposal extends [RFC 0027's IAM and authority model](../0027-openclaw-enterprise.md#iam-and-authority). Responsibilities across the series are:

| RFC | Responsibility |
| --- | --- |
| [0034 / PR #68](https://github.com/openclaw/rfcs/pull/68) | Provider credential mediation, broker access leases and credential replacement. |
| [0035 / PR #69](https://github.com/openclaw/rfcs/pull/69) | Execution assignment, enforcement-lease issuance and withdrawal. |
| [0036 / PR #70](https://github.com/openclaw/rfcs/pull/70) | Logical work admission and closure, bounded renewal authorization and attached lineage. |
| [0037 / PR #71](https://github.com/openclaw/rfcs/pull/71) | Execution, recovery, completed-result delivery and runtime lifecycle. |

## Selected Delivery Sequence

These stages define the supported scope. Later requirements below do not expand the initial profile.

| Stage | Admission and operations |
| --- | --- |
| **Repository reads** | One service-owned root Work, metadata and clone/fetch for administrator-granted repositories, and subordinate helpers only where complete stop ownership is qualified. |
| **Approved publication** | Selected repository read workflows plus scoped branch push and draft PR creation. Publication requires a configured human approver; the requester is eligible when configured. Root Work and the same subordinate-helper boundary remain the default. |
| **Work lifecycle** | General persistent Work UI/API, separately admitted durable children, continuation after coordinator loss across fresh attempts, and separately authorized Stop/Start under RFC 0037. Each needs its own qualification. |

Advanced scheduling and orchestration remain a separate roadmap. Independent human approval is a later option. Automatic authorization by policy for explicitly permitted operations, such as an allowlisted branch push or draft PR, is also later; the MVP does not automatically authorize publication. Approval covers the exact publication content, repository and branch/destination under the publication contract in RFC 0034. An edit invalidates approval for the prior content. An approval neither grants repository access nor expands the original Work ceiling, audience or horizons.

The initial administrative model is a direct service grant for selected repositories and operations. Native-channel user and channel allowlists govern invocation separately. They cannot confer service repository access, and a service grant cannot admit an otherwise unauthorized invocation. Richer IAM administration is not required to express this initial policy.

### Minimum root Work remains required

Root Work admission must durably bind the original authenticated invocation, service owner, Installation/Namespace, Agent/revision, exact assignment, immutable repository/action scope, purpose, eligible data, audience and provider selections. It records the effective duration policy, any original configured horizons, aggregate resource limits and cancellation or withdrawal dependencies. Each operation retains its original identity, immutable request, submission state and outcome. Provider credential custody remains with trusted mediation.

The root has no parent or independent child authority. Existing Agent/request records may host these facts; admission, current service authorization, enforcement and recovery remain required.

Repository read and publication operation owners exist as components; general Work ports are declarations. No complete general Work supplier exists today. Authentic invocation, State, execution and credential-custody suppliers must be integrated and qualified for the read release. Component checks do not establish a released or deployed repository flow.

### Initial helper boundary

A subordinate helper remains in the root's original Work and execution context, with the same authority, aggregate resource budget, cancellation and physical stop ownership. It has no independent renewal or admission. Creation cannot reset a duration or resource limit. The supported runtime must demonstrate physical stop for every helper; mechanisms that lack this custody remain unsupported. Request labels and logical subagent names do not prove isolation.

## Principals and Admission

### Keep three identities distinct

| Identity | Meaning |
| --- | --- |
| Requester | The attributable actor who invoked the service. |
| Owner | The principal whose service authority supports the work and whose lifecycle policy governs it. |
| Workload | The Agent execution performing operations, with its own applicable permissions. |

The work record models user and service ownership, but initial execution admission supports only service owners. Unsupported user-owned work is rejected; it is not silently converted. Naming a service owner cannot bypass independent workload authorization or transfer a human's permissions. This is a proposed admission contract: an owner field alone neither supplies service authorization nor replaces an implementation's original-requester dependencies. The actual service-authority issuer and accepting path must be composed and qualified before claiming that behavior.

The access gateway verifies ingress identity and requested scope. OCC resolves existing principals and obtains invocation authorization from the selected IAM authority. OCC separately authorizes the service's work, referenced resources, data eligibility and purpose. Gateways and adapters neither own work admission nor choose another policy authority.

For example, Alice may be allowed to ask a review service to inspect an approved repository without holding the service's provider permissions. Admission must authorize both her invocation and that exact service access. Her identity supplies attribution, not an inherited provider session. Authorization covers the exact invocation, target and intended audience; a replay with a different actor, target or audience cannot reuse the original admission. Her private attachment and the report's intended recipients require separate data and audience checks.

### Preserve admitted dependencies

Admission records which requester, membership and session relationships remain conditions of the work, including cancellation ownership and dependencies. Requester withdrawal behavior is explicit admission policy, not a connector choice.

Session closure withdraws work explicitly bound to that session. Service-owned work may otherwise outlive the initiating session. A session reference cannot be omitted or relabeled to escape an admitted cancellation dependency, and changing the owner cannot preserve withdrawn user authority.

### Admit an explicit duration policy

An Agent may retain its identity indefinitely; that does not authorize an arbitrary process to run forever. A process, execution attempt and logical Work have separate lifetimes. Execution duration defaults to uncapped, meaning elapsed time alone does not end an attempt. Completion, cancellation, service stop, required-authority withdrawal and independently configured resource or spend limits still apply.

Admission resolves configuration and applicable Restrictions into an explicit immutable finite-or-uncapped selection. Restrictions may require or narrow a cap. A finite attempt cap runs from its original dispatch anchor, including startup and waiting; a configured absolute work horizon remains binding across attempts. Missing authority, or missing or unsupported persisted policy, denies execution. A creation-time default does not reinterpret historical records.

Uncapped work need not have an absolute work horizon. Every enforcement lease still has a finite expiry and fits every applicable work, ancestor, purpose, stop and withdrawal bound. Later draft edits, useful activity, reconnects and credential rotation cannot extend an admitted cap or horizon. Active-budget extension is outside this proposal.

### Keep the scope bounded

The proposal does not admit user-owned execution, human impersonation or cross-Namespace access. General scheduling, arbitrary detached delegation and a new IAM system are outside its scope. Logical subagents in one process are not isolated security principals. Offline application writes, historical-effect replay and guaranteed exactly-once provider effects are also excluded.

## Shared and Isolated Work

### Distinguish resource ceilings from data eligibility

OCC admits three resource/action ceilings. None grants permission on its own.

| Ceiling | Meaning and constraint |
| --- | --- |
| `M` | The Agent maximum. Every work ceiling must fit within it. |
| `B` | The explicitly shared baseline, with `B` within `M`. |
| `W` | One work's immutable ceiling. Shared baseline execution requires `W` within `B`; additional authority requires `W` within `M`, applicable approval and a qualified isolated execution compartment. |

Private data requires protected isolation even when the requested operations fit within the shared baseline. Resource/action ceilings and provider scope do not settle whether state is eligible for sharing.

Admission records eligible data/state classes and the applicable membership epoch. Repository read access alone does not admit private prompts, attachments, memory or intermediate results into shared state. Membership changes must affect subsequent access under the selected freshness contract.

The [memory ACL proposal](https://github.com/openclaw/rfcs/pull/30) remains a separate resource policy. This proposal supplies no blanket permission to share memory.

### Qualify the compartment

A qualified compartment must prevent retained code or state from acquiring another work's handles, private data or authority. Request labels, different logical subagents and narrowed opaque handles do not prove isolation. Unsupported isolation denies the affected work.

A persistent shared Agent must distinguish work requested by different people. An old process cannot acquire a later request's permissions, and shared repository access cannot expose another person's private attachment. Permission changes follow RFC 0027's fresh-Pod path; narrowing a handle in an existing Pod does not replace that requirement. Work identity, runtime identity and permission to share data answer different questions.

## Durable Records

### Separate work, execution, leases and effects

OCC owns internal durable records attached to existing Agent and request identities. They do not introduce a user-facing execution resource between an AgentRevision and its workload. The read stage needs root admission, the exact assignment, finite leases and durable operation receipts. Its lineage is explicitly root-only. The general Work UI/API and independent child/attempt lifecycle remain in the Work lifecycle stage; separately admitted delivery applies only where that feature is supported.

| Record | Required contents |
| --- | --- |
| Logical work | Stable work ID; owner kind/principal; verified requester and provenance; Installation/Namespace; Agent/revision; selected authority; immutable resource/action ceiling and explicit duration policy with any original absolute work horizon; data class; purpose; audience; cancellation owner/dependencies; parent/ancestor references. |
| Execution assignment | Exact current workload incarnation, generation and qualified compartment under RFC 0035's assignment contract. |
| Enforcement lease | Work, assignment, accepting service and policy profile; authoritative issuance ordering; scope ceiling; absolute expiry and withdrawal bounds under RFC 0035. |
| Operation receipt | Original work, idempotency key, canonical request fingerprint, authorization observations, reserved allowance, submission state and external outcome reference. |
| Completed-result delivery | Completed content identity, exact audience/destination, original finite horizon, cancellation relationships and original submission receipt under RFC 0037. |

The work record also retains admitted provider selections and scopes. RFC 0034's broker access leases are distinct from enforcement leases and may only narrow those selections and scopes. Credential issuance and cleanup use separate operation identities correlated with business-operation receipts.

### Admit durably and close terminally

Durably record work admission before acknowledging it. Duplicate keys resolve to the same admission; conflicting inputs deny. An admission receipt proves neither tool dispatch nor completion and creates no implicit execution queue. Wire formats remain open.

In the Work lifecycle stage, logical Work can span execution attempts under its admitted duration policy. The read stage retains durable admission and effect history but does not offer coordinator-loss continuation across fresh attempts. A message acknowledgement, model response, certificate renewal, provider-token refresh or lost connection neither completes Work nor renews its authority. Completion, cancellation or Work's own configured expiry closes it terminally. Lease expiry ends only that lease's authority; an open Work still requires current authorization for renewal. Recovery cannot reopen closed Work.

OCC admits and closes work and authorizes bounded lease renewal. RFC 0035 owns enforcement-lease issuance and withdrawal; RFC 0037 owns execution, recovery and delivery lifecycle.

### Protect original-work origin

An opaque work reference is bound to an authenticated presenter and protected original-work origin. Possession alone grants nothing. Work references, model credentials and provider credentials have distinct purposes; none substitutes for the others' checks.

## Operation Enforcement

### Admission and dispatch sequence

1. Authorize invocation, service access, workload access, data eligibility and exact scope through OCC and the selected authorities. Freeze the work ceiling, effective duration policy and any configured work horizon.
2. Select a qualified execution under current authority. A former assignment's lease cannot authorize its successor. From the initial release, any successor must have observed termination of the old writer before writing retained state, alongside assignment fencing and the fresh-Pod rule for permission changes. RFC 0037 owns that evidence. Continuing the same Work across replacement attempts remains a later Work lifecycle capability.
3. Issue a finite enforcement lease in an authoritative order with cancellation and revocation. Bind it to the work, assignment and accepting service.
4. At dispatch, authenticate the workload and establish original-work origin through the protected connector path. Derive action and resource from the actual operation, including relevant request-body and redirect behavior. Check the lease, applicable policies, purpose, scope, allowances and mandatory evidence under the selected freshness profile.
5. Durably reserve dispatch responsibility and allowances under the original operation key. Preserve request identity and bytes through submission and record the observed outcome. Duplicates resolve the original dispatch state; pending or unknown submission cannot trigger another submission.

### Keep enforcement outside Agent control

Only RFC 0027's active revision and exact authorized workload may perform Agent execution. Enforcement remains outside Agent-controlled execution. A denied decision is not retried against another adapter.

Current policy can narrow access. Renewal preserves original work identity, purpose, audience and cancellation dependencies. Later permission growth cannot expand `W`, admitted provider selections or any configured horizon. Policy recovery restores access only within an unchanged, still-open work record.

Streams and queued operations retain their original-work bindings and obey the same dispatch and withdrawal rules. An open connection or surviving process cannot adopt later authority. A late successful check cannot revive an expired lease or closed stream.

### Preserve provider mediation

RFC 0034 owns broker mediation and credential replacement. Provider bearer credentials remain in trusted mediation. Identity certificates and short token lifetimes alone do not make leaked provider tokens harmless. A model proxy neither supplies GitHub mediation nor authorizes native fallback.

Credentials authenticate or enable provider access; they do not record work scope, cancellation or immutable effects. Durable receipts preserve uncertainty across token changes and execution replacement.

## Renewal and Withdrawal

### Renew through current authority

Authority renewal is a fresh decision through OCC and the selected policies while work remains open, within its original ceiling and every configured horizon.

RFC 0035's issuer must bound every lease by:

- Its issuance-time maximum.
- Applicable work and ancestor horizons and configured attempt deadlines.
- Purpose and stop deadlines.
- Withdrawal targets, including clock and enforcement allowances.

Every issued lease and every applicable deadline must be finite, consistent and authoritative. An explicitly uncapped work policy omits a work deadline; it does not omit the lease expiry or other required bounds. Missing policy is not an uncapped fallback. A deadline calculator does not supply these inputs' authority.

### Select and measure withdrawal profiles

Ordinary profiles may target withdrawal on the scale of minutes; sensitive profiles may target seconds with reduced availability. These are tolerance scales, not selected TTLs or measured guarantees.

RFC 0035 owns each profile's withdrawal start point, external-IAM observation delay, issuer fencing, holder enforcement delay, trusted-clock assumptions and provider-effect boundary. Requested withdrawal and proven effective withdrawal remain distinct.

Selected GitHub dispatch stops whenever current OCC authorization is unavailable. A future qualified outage-read profile must stop by its original lease deadline; reconnection or restart cannot move that deadline. Tightening a target must account for outstanding leases before advertising the tighter guarantee: new policy cannot retroactively shorten an unseen old lease.

### Preserve state through restart and collection

RFC 0035 owns ordered issuance/revocation, issuer fencing and durable, monotonic holder synchronization. A restarted holder whose clock or revocation state is untrustworthy synchronizes before serving.

Collection of obsolete enforcement entries must not erase terminal work, current policy or descendant withdrawal obligations. Effect receipts and cleanup retain their own lifetimes.

## Authority Outages

### Qualify application reads explicitly

The series leaves an explicit bounded-read freshness profile as an optional future amendment to RFC 0027's default current-authority checks. It is not selected for initial GitHub access: that profile requires current OCC authority for every dispatch, including reads and credential maintenance. Authentication does not imply cached permission.

Only application reads expressly selected and qualified for such a profile may continue during an authority outage under an existing, unexpired enforcement lease. Eligibility follows operation semantics, not HTTP method.

Protected origin, local revocations, scope, inventory, approval, freshness and every other mandatory check still apply. Missing required evidence denies the affected operation.

### Keep other actions dependent on current authority

Application writes, message posting, new admission, renewal, expansion and new execution assignment require current authority.

Trusted credential maintenance may preserve existing read access only when explicitly preauthorized under the same lease and an enforceable read-only credential profile. It cannot:

- Reuse a broader write-capable credential.
- Create work or broaden scope.
- Extend the authority deadline.

Missing provider or inventory evidence denies maintenance. RFC 0034 retains its accounting and uncertainty rules.

In a selected future outage profile, finite enforcement leases would bound disconnected use while allowing expressly qualified reads to finish. Requiring current authority for writes and renewal makes the availability tradeoff explicit.

## Later Capability: Attached Children

This section specifies the Work lifecycle stage. Initial repository Work uses the root and subordinate-helper profile above. Independent child admission and continuation without a running coordinator are not initial release requirements.

### Admit distinct, bounded child work

An attached child has a distinct work identity, immutable parent/ancestor links, and its own original scope and duration policy bounded by its ancestors. An uncapped child cannot escape a finite ancestor horizon. Child admission requires current authority.

A child need not create another Agent. A logical child in a shared process gains no separate security boundary.

Separately admitted children require their own scope, authority, lineage, status and cleanup. Initial root/helper cancellation and physical stop remain mandatory independently of this later capability.

### Renew without a running parent process

Already-admitted children can receive fresh enforcement leases through the authority service's own narrow identity while logical ancestors remain open and authorized, even when no parent process runs. Renewal checks:

- Current lineage and workload permission.
- Original ceilings and eligible execution/receiver.
- Every applicable ancestor horizon and withdrawal target.

A child's longer ordinary withdrawal target cannot weaken a sensitive ancestor's shorter target.

Fresh authoritative issuance is not capped by a former parent execution lease's expiry. Local attenuation remains capped by its originating lease and cannot admit a child, renew authority or assign execution. Fresh issuance neither restores the parent execution's authority nor detaches the child.

### Preserve cancellation and required joins

Ancestor cancellation fences future descendant issuance and withdraws affected leases under RFC 0035's profile. A child cannot silently detach to survive it; independent work requires its own admission.

Parent computational completion waits for required child joins and preserves unresolved effects under the admitted completion policy.

For example, a coordinator can admit two attached repository reviews and wait without running. Each child renews from current authority. During an outage neither renews. Initial GitHub dispatch stops without current authority; a future qualified-read profile could continue only until the existing lease deadline. Canceling the coordinator's logical work governs both children regardless of which processes remain alive.

### Leave scheduling separate

General schedules and orchestration remain separate proposals. A schedule would require its own authorization and fresh work admission for each run. Durable attempts consume this work model; they cannot introduce competing authority records or permission to replay historical effects.

Attached lineage supports ordinary child work without requiring a general scheduler. Logical work avoids tying valid child authority to the lifetime of a coordinator process or provider token.

## Completion and Delivery

### Admit finite delivery before closure

Where completed-result delivery is supported, bind the completed result to RFC 0037's finite, separately admitted delivery responsibility before logical Work closes. Delivery may be admitted with the original Work; binding content at completion must satisfy the admitted output contract. This section does not admit GitHub publication: the publication stage separately requires exact publication scope and configured human approval. A delivered report cannot implicitly push a branch or create a PR.

The exact audience, destination and original absolute delivery horizon cannot grow. Creating delivery responsibility after closure requires fresh admission.

### Authorize task and Agent controls separately

Initial root/helper cancellation requires authority withdrawal, physical stop evidence and terminal closure. The Work lifecycle stage adds richer controls; earlier services may qualify narrower controls or delivery. Their permissions remain separate wherever exposed.

Stop task targets one exact work and its owned helpers or admitted descendants. Own-task, shared-task and Agent lifecycle permissions remain distinct; permission to invoke the service or view its inventory does not imply permission to stop other work. Each new control requires current exact-resource authorization and attributable durable acceptance. Already-admitted protective cleanup retains its independent stop responsibility when ordinary continuation authority is unavailable.

Stop Agent durably blocks new work and drives stopping of affected work. Incoming messages, stale queued dispatch and controller restart cannot undo that intent. Start Agent is separately authorized and cannot bypass administrative disable, revive terminal work or replay uncertain effects. RFC 0037 owns physical termination and truthful status; stop acceptance alone does not prove observed termination.

### Distinguish graceful stop from cancellation

The default Stop action and any graceful-drain option need explicit product semantics. Where selected, graceful Agent stop preserves pending delivery of an already completed, authorized result. A trusted executor can deliver independently of the worker, using its own narrow identity and current content, audience, Channel and provider authorization. It cannot continue computation, reopen work or choose a fallback audience.

Cancellation or security revocation withdraws affected delivery even after the Agent stops. RFC 0037 owns finite drain and physical termination. Stop cannot extend work, lease or delivery horizons.

Authority withdrawal, process termination, provider revocation and accepted effects remain separate. Cleanup retains independent authority that can only reduce recorded access.

### Preserve the original effect and uncertainty

Retries retain the original delivery horizon, operation identity and outcome. A definitive no-effect result may permit a policy-approved retry within remaining authority. Possible submission with an unknown outcome requires reconciliation; a new token, assignment or work record cannot justify reposting the uncertain effect.

The same rule applies to other business operations. Closure neither retracts an accepted effect nor proves it failed. Finite delivery avoids keeping a worker alive solely to post a completed report.

## Qualification Evidence

### Establish the actual boundary

This specification does not establish an implemented issuer, trusted transport or production guarantee. Qualification requires the actual Harness, verifier, connector, authority store, selected IAM suppliers and runtime isolation. Fixtures and declared interfaces cannot supply missing authority or protected origin.

### Cover the required behavior

| Area | Required evidence |
| --- | --- |
| Data and isolation | Shared-state eligibility, private-work isolation and rejection of original-work misuse by retained processes. |
| Authority changes | Allow/deny, shrinking permissions, expiry and policy recovery without scope growth. |
| Durable admission and effects | Duplicate admission, conflicting inputs, crash uncertainty and retained unknown provider outcomes. |
| Renewal and duration | Finite leases for explicit uncapped work; finite configured caps retained across turns and provider-token replacement; missing policy denied and no automatic horizon extension. |
| Helpers | Repository reads: shared original context and aggregate budget, cancellation and demonstrated physical stop custody; unsupported helper mechanisms denied. |
| Publication | Approved publication: exact content and destination, current repository access, configured human approval including an eligible requester, and no automatic publication authorization. |
| Durable children and continuations | Work lifecycle: separate child admission, parentless renewal, ancestor cancellation, required joins and qualified continuation across fresh attempts. |
| Controls and delivery | Initial root/helper stop and terminal closure; separate exact-resource control permissions wherever exposed. The Work lifecycle stage adds richer controls and selected graceful delivery, with exact audience and cancellation withdrawal. |
| Outage and restart | Initial GitHub reads and maintenance denied without current OCC authority; any future qualified-read profile distinguished from writes and admission; preserved deadlines, stale-issuer fencing and measured withdrawal for each selected profile. |
| Assignment and replacement | Initially: fresh Pod on permission changes, denial of old assignments while credentials remain valid, and observed old-writer termination before any successor writes retained state. Work lifecycle: qualified continuation of the same Work across replacement attempts. |

Unknown provider outcomes must remain unknown rather than becoming manufactured successful retries. Audit preserves attribution and safe references while excluding credentials and message bodies.

## Unresolved Questions

- Which shared-data classes, membership administration and isolation evidence qualify the initial baseline?
- Which selected IAM policies govern continued invocation eligibility, requester withdrawal and audience checks?
- Which protected origin and compartment mechanisms qualify each supported Harness and runtime?
- What numerical lease profiles, clock assumptions and issue/revoke protocol meet measured withdrawal targets?
- Which original invocation, State, execution and custody suppliers will complete and qualify the initial root Work flow?
- Which runtimes can demonstrate complete physical stop custody for subordinate helpers?
- For later stages, which child join, allowance and delivery-horizon policies should be admitted, and which Stop/graceful-drain semantics should be selected?
- For a later outage profile, which reads and providers can qualify bounded read-only credential maintenance?
- How should service-owner admission integrate with existing original-requester dependencies without weakening their cancellation or withdrawal behavior?
