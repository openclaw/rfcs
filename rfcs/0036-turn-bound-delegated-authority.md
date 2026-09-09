---
title: Service-owned work authority for Enterprise Agents
authors:
  - Free Wortley
created: 2026-09-08
last_updated: 2026-09-09
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/70
---

# Proposal: Service-owned work authority for Enterprise Agents

## Summary

Give Enterprise Agents explicit authority for service-owned logical work that can span messages, model turns and runtime replacements. OCC records the verified requester, service owner, immutable scope and finite horizon; trusted services enforce shorter leases bound to the original work and exact execution. Invocation permission, service permission and data access remain separate. This extends [RFC 0027](0027-openclaw-enterprise.md#iam-and-authority) with bounded authority renewal, attached children and completed-result delivery, while preserving independent workload authorization, credential mediation and truthful effect outcomes.

## Motivation

A repository review can take longer than its initiating conversation turn or provider token. Its coordinator may stop running while child reviews continue. Tying authority to any of those events either interrupts valid work or encourages implicit, unbounded background access.

A persistent shared Agent must also distinguish work requested by different people. An old process must not acquire a later request's permissions, and access to a shared repository must not make one person's private attachment available to other users. Work identity, runtime identity and the right to share data answer different questions.

## Goals

- Bind protected operations to their original admitted work and qualified execution.
- Separate requester, service owner and workload without transferring human permissions.
- Support finite logical work and attached children beyond individual turns or processes.
- Preserve original scope, bounded withdrawal, exact audiences and immutable effect attempts.
- Reuse OCC, selected IAM authorities, Restrictions and trusted broker enforcement.

## Non-Goals

- User-owned execution, human impersonation or cross-Namespace access.
- General scheduling, arbitrary detached delegation or a new IAM system.
- Treating logical subagents in one process as isolated security principals.
- Offline application writes, historical-effect replay or guaranteed exactly-once provider effects.

## Proposal

### Separate invocation, ownership and execution

The access gateway verifies ingress identity and requested scope; OCC resolves existing principals and obtains invocation authorization from the selected IAM authority. OCC separately authorizes the service's work, referenced resources, data eligibility and purpose. Gateways and adapters do not own work admission or choose another policy authority.

The **requester** is the attributable actor who invoked the service. The **owner** is the principal whose service authority supports the work and whose lifecycle policy governs it. The **workload** is the Agent execution performing operations. The record models both user and service ownership, but initial admission supports service owners only. Unsupported user-owned work is rejected, not silently converted. Each workload independently needs its own applicable permissions; naming a service owner cannot bypass them.

For example, Alice may be allowed to ask a review service to inspect an approved repository without holding that service's provider permissions. Admission must authorize the invocation and exact service access. Alice's identity supplies attribution, not an inherited provider session. Her private attachment and the report's intended recipients need separate data and audience checks.

Record which requester, membership and session relationships remain conditions of the work. A session reference cannot be omitted or relabeled to escape an admitted cancellation dependency. Session closure withdraws work explicitly bound to it; service-owned work may otherwise outlive the initiating session. Changing the owner cannot preserve withdrawn user authority. Requester withdrawal behavior is an explicit admission policy, not a choice by a connector.

### Bound shared and isolated work

OCC admits an Agent maximum `M`, an explicitly shared baseline `B`, and each work ceiling `W`. These resource/action ceilings do not grant permission on their own:

- Shared baseline execution requires `W` to be within `B`, and `B` within `M`.
- Additional authority still requires `W` within `M`, applicable approval, and a qualified isolated execution compartment.
- Private data requires protected isolation even when its requested operations fit the shared baseline.

Admission records eligible data/state classes and the applicable membership epoch. Repository read access alone does not admit private prompts, attachments, memory or intermediate results into shared state. Membership changes must affect subsequent access under the selected freshness contract. The [memory ACL proposal](https://github.com/openclaw/rfcs/pull/30) remains a separate resource policy; this proposal supplies no blanket permission to share memory.

The compartment must prevent retained code or state from acquiring another work's handles, private data or authority. Request labels, different logical subagents and narrowed opaque handles do not prove isolation. Unsupported isolation denies the affected work.

### Record work separately from leases and effects

OCC owns internal durable records attached to existing Agent and request identities. These are not a new user-facing execution resource between an AgentRevision and its workload.

| Record | Required contents |
| --- | --- |
| Logical work | Stable work ID; owner kind/principal; verified requester and provenance; Installation/Namespace; Agent/revision; selected authority; immutable resource/action ceiling and original absolute horizon; data class; audience; cancellation owner/dependencies; parent/ancestor references. |
| Execution assignment | Exact current workload incarnation, generation and qualified compartment, using [RFC 0035's assignment contract](https://github.com/openclaw/rfcs/pull/69). |
| Enforcement lease | Work, assignment, accepting service and policy profile; authoritative issuance ordering; scope ceiling; absolute expiry and withdrawal bounds, as specified by RFC 0035. |
| Operation receipt | Original work, idempotency key, canonical request fingerprint, authorization observations, reserved allowance, submission state and external outcome reference. |
| Completed-result delivery | Completed content identity, exact audience/destination, original finite horizon, cancellation relationships and original submission receipt, under [RFC 0037's lifecycle contract](https://github.com/openclaw/rfcs/pull/71). |

Logical work can span bounded execution attempts. A message acknowledgement, model response, certificate renewal, provider-token refresh or lost connection neither completes work nor renews its authority. Work closes terminally on completion, cancellation or expiry according to its admitted policy. Recovery cannot reopen it.

OCC admits and closes logical work and authorizes bounded lease renewal. RFC 0035 owns enforcement-lease issuance and withdrawal; RFC 0037 owns execution/recovery and delivery lifecycle. Wire formats remain open. Durably record work admission before acknowledging it. Duplicate keys resolve to the same admission; conflicting inputs deny. An admission receipt proves neither tool dispatch nor completion and creates no implicit execution queue.

An opaque work reference is bound to an authenticated presenter and protected original-work origin; possession alone grants nothing. [Broker access leases](https://github.com/openclaw/rfcs/pull/68) are distinct from enforcement leases. The work record retains admitted provider selections and scopes; broker leases may only narrow them. Credential issuance and cleanup have separate operation identities correlated with business-operation receipts.

### Admit and enforce each operation

1. Authorize invocation, service access, workload access, data eligibility and exact scope through OCC and selected authorities. Freeze the work's ceiling and finite horizon.
2. Select a qualified execution under current authority. Replacement requires RFC 0037's predecessor evidence; an old assignment's lease cannot authorize its successor.
3. Issue a finite enforcement lease in an authoritative order with cancellation and revocation, bound to the work, assignment and accepting service.
4. At dispatch, authenticate the workload and establish original-work origin through the protected connector path. Derive action/resource from the actual operation, including relevant body and redirect behavior. Check the lease, applicable policies, purpose, scope, allowances and mandatory evidence under the selected freshness profile.
5. Durably reserve dispatch responsibility and allowances under the original operation key. Keep request identity and bytes immutable through submission; record the observed outcome. Duplicates resolve the original dispatch state; pending or unknown submission cannot trigger another submission.

Only RFC 0027's active revision and exact authorized workload may perform Agent execution. Enforcement remains outside Agent-controlled execution, and no denied decision is retried against another adapter. Current policy can narrow access. Later permission growth cannot expand `W`, admitted provider selections or the original horizon. Policy recovery restores access only within an unchanged, still-open work record.

Streams and queued operations retain their original-work bindings and obey the same dispatch and withdrawal rules. An open connection or surviving process cannot adopt later authority. A late successful check cannot revive an expired lease or closed stream.

Model credentials, provider credentials and work references have distinct purposes. [RFC 0034](https://github.com/openclaw/rfcs/pull/68) owns broker mediation and credential replacement. Provider bearer credentials remain in trusted mediation; identity certificates and short token lifetimes alone do not make leaked provider tokens harmless. A model proxy does not supply GitHub mediation or authorize native fallback.

### Renew within explicit withdrawal bounds

Authority renewal is a fresh decision through OCC and the selected policies while work remains open, within its original ceiling and horizon. RFC 0035's issuer must bound every lease by its issuance-time maximum, applicable work/ancestor horizons, purpose/stop deadlines and withdrawal targets, including clock and enforcement allowances. Inputs must be finite, consistent and authoritative. A deadline calculator does not supply their authority.

Ordinary profiles may target withdrawal on the scale of minutes; sensitive profiles may target seconds with reduced availability. These are tolerance scales, not selected TTLs or measured guarantees. RFC 0035 owns each profile's withdrawal start point, external-IAM observation delay, issuer fencing, holder enforcement delay, trusted-clock assumptions and provider-effect boundary.

A disconnected holder denies new dispatch by its original deadline. Reconnection or restart cannot move it. Tightening a target must account for outstanding leases before advertising the tighter guarantee; a new policy cannot retroactively shorten an unseen old lease.

### Preserve qualified reads during authority outages

The series proposes an explicit bounded-read freshness profile as an amendment to RFC 0027's default current-authority checks. Authentication does not imply cached permission. Only application reads expressly qualified for the profile may continue during an authority outage under an existing, unexpired enforcement lease. Eligibility follows operation semantics, not HTTP method. Protected origin, local revocations, scope, inventory, approval, freshness and every other mandatory check still apply. Missing required evidence denies the affected operation.

Application writes, message posting, new admission, renewal, expansion and new execution assignment require current authority. Trusted credential maintenance may preserve existing read access only when explicitly preauthorized under the same lease and an enforceable read-only credential profile. It cannot reuse a broader write-capable credential, create work, broaden scope or extend the authority deadline. Missing provider or inventory evidence denies maintenance; RFC 0034 retains accounting and uncertainty rules.

RFC 0035 owns ordered issuance/revocation, issuer fencing and durable, monotonic holder synchronization. A restarted holder with untrustworthy clock or revocation state synchronizes before serving. Requested withdrawal and proven effective withdrawal remain distinct. Collection of obsolete enforcement entries must not erase terminal work, current policy or descendant withdrawal obligations; effect receipts and cleanup retain their own lifetimes.

### Include attached children

An attached child has a distinct work identity, immutable parent/ancestor links, and its own original scope and horizon bounded by its ancestors. Child admission requires current authority. It need not create another Agent, and a logical child in a shared process gains no separate security boundary.

Already-admitted children can receive fresh enforcement leases through the authority service's own narrow identity while logical ancestors remain open and authorized, even when no parent process runs. Renewal checks current lineage, workload permission, original ceilings, eligible execution/receiver and every applicable ancestor horizon and withdrawal target. A child with a longer ordinary withdrawal target cannot weaken a sensitive ancestor's shorter target.

Fresh authoritative issuance is not capped by a former parent execution lease's expiry. Any local attenuation remains capped by its originating lease and cannot admit a child, renew authority or assign execution. This distinction does not restore the parent execution's authority or detach the child.

Ancestor cancellation fences future descendant issuance and withdraws affected leases under RFC 0035's profile. A child cannot silently detach to survive it; independent work requires its own admission. Parent computational completion waits for required child joins and preserves unresolved effects under the admitted completion policy.

For example, a coordinator can admit two attached repository reviews and wait without running. Each child renews from current authority. During an outage neither renews; qualified reads stop at their existing deadlines. Canceling the coordinator's logical work governs both children regardless of which processes remain alive.

General schedules and orchestration remain separate proposals. A schedule would require its own authorization and fresh work admission for each run. Durable attempts consume this same work model and cannot introduce competing authority records or permission to replay historical effects.

### Close work and preserve finite delivery

Before logical work closes, bind its completed result to RFC 0037's finite, separately admitted delivery responsibility. It may be admitted with the original work; binding content at completion must satisfy the admitted output contract. Its exact audience, destination and original absolute horizon cannot grow. Creating delivery responsibility after closure requires fresh admission.

Graceful Agent stop preserves pending delivery of an already completed, authorized result. A trusted executor can deliver independently of the worker, using its own narrow identity and current content, audience, Channel and provider authorization. It cannot continue computation, reopen work or choose a fallback audience.

Cancellation or security revocation withdraws affected delivery even after the Agent stops. RFC 0037 owns finite drain and physical termination; stop cannot extend work, lease or delivery horizons. Authority withdrawal, process termination, provider revocation and accepted effects remain separate. Cleanup retains independent authority that can only reduce recorded access.

Retries retain the original delivery horizon, operation identity and outcome. A definitive no-effect result may permit a policy-approved retry within remaining authority. Possible submission with an unknown outcome requires reconciliation; a new token, assignment or work record cannot justify reposting the uncertain effect. The same rule applies to other business operations. Closure neither retracts an accepted effect nor proves it failed.

### Qualify the boundary

This RFC specifies behavior; it does not establish an implemented issuer, trusted transport or production guarantee. Qualification requires the actual Harness, verifier, connector, authority store, selected IAM suppliers and runtime isolation. Fixtures and declared interfaces do not supply missing authority or protected origin.

Evidence must cover shared-state eligibility and private-work isolation; allow/deny, shrink, expiry and policy recovery; duplicate admission and crash uncertainty; renewal across turns and provider-token replacement; original-work misuse by retained processes; child renewal without a parent process; ancestor cancellation; and exact-audience delivery after graceful stop versus cancellation.

Outage/restart tests must distinguish qualified reads from writes and admission, preserve deadlines, fence stale issuers and measure withdrawal for each selected profile. Replacement must prove predecessor exclusion and deny old assignments while their credentials remain valid. Retain unknown provider outcomes instead of manufacturing successful retries. Audit preserves attribution and safe references, excluding credentials and message bodies.

## Rationale

Logical work provides one bounded authority record across turns, tokens and executions. Shorter enforcement leases bound disconnected use while allowing qualified reads to finish during outages. Requiring current authority for writes and renewal makes the availability tradeoff explicit.

Service ownership separates permission to invoke a service from its access. Shared-data eligibility and isolated work prevent the shared baseline from becoming permission to disclose private inputs. Attached lineage supports ordinary child work without requiring a general scheduler.

Credentials authenticate or enable provider access; they do not record work scope, cancellation or immutable effects. Durable receipts preserve uncertainty, and finite delivery avoids keeping a worker alive solely to post a completed report.

## Unresolved questions

- Which shared-data classes, membership administration and isolation evidence qualify the initial baseline?
- Which selected IAM policies govern continued invocation eligibility, requester withdrawal and audience checks?
- Which protected origin and compartment mechanisms qualify each supported Harness and runtime?
- What numerical lease profiles, clock assumptions and issue/revoke protocol meet measured withdrawal targets?
- Which operations qualify as outage reads, and which providers support bounded read-only credential maintenance?
- What child join, allowance, approval and delivery-horizon policies should the first supported services admit?
