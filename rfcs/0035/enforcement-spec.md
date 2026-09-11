# Workload identity enforcement specification

This supporting specification carries the detailed contracts for
[RFC 0035: Workload identity and runtime authority](../0035-workload-identity-and-runtime-authority.md).
[RFC 0027](../0027-openclaw-enterprise.md#iam-and-authority) continues to own
authorization, stable Agent identity, Namespace authorization and the single
active revision. SPIFFE supplies identity documents; SPIRE supplies registration
and attestation. Neither selects active revisions or grants OpenClaw permissions.

## Authentication profiles

Each Agent retains its OCC-created `WorkloadIdentity`. An internal assignment
binds it to an admitted revision and execution, without introducing a user-facing
resource between AgentRevision and its workload. The Agent resource may persist
indefinitely; its stable identity is distinct from an execution assignment, its
SVID and each finite authority lease. Gateways, registrars and cleanup
services use their own narrowly authorized identities; they cannot assume Agent
identity.

Installation configuration selects authentication; workloads cannot choose trust
roots. RFC 0027's pod-bound
ServiceAccount-token profile remains the baseline. RFC 0035 proposes an optional
X.509-SVID profile at explicitly selected OCC runtime boundaries. An X.509-SVID is
a certificate carrying a SPIFFE identity. The dedicated Kubernetes ServiceAccount
retains infrastructure authorization; IAM bindings remain attached to stable OCC
identities. No human permissions transfer.

Verification failure cannot switch profiles or admit another credential type.
Migration requires an explicit rollout, current assignment bindings and withdrawal
of the old acceptance path. Selecting SPIFFE for trusted services alone does not
select it for Agent-to-OCC authentication.

This proposal does not replace human login, OAG admission, IAMAdapter policy or
Kubernetes authorization. Cross-Installation federation and cross-Namespace
references remain outside its scope. Identity does not establish containment,
prevent all credential theft or prove physical termination from authorization.

## Execution registration

| Owner | Responsibility |
| --- | --- |
| OCC | Record admitted revision, stable identity, runtime assignment and lifecycle selection. |
| ComputeDriver | Provision and observe the exact workload; supply protected execution evidence. |
| Constrained registrar and SPIRE | Bind attested selectors to the server-selected execution subject and issue its SVID. |
| Transport verifier | Validate trust and expected peer; bind authentication evidence to the actual connection. |
| Accepting service | Resolve current purpose and authorize the exact operation where it is accepted. |

Assignments record Installation, Namespace, participant kind, stable identity,
applicable revision, opaque assignment ID, execution generation, qualified
compartment and registration reference. Restart or replacement creates a fresh
execution binding even with unchanged Agent, ServiceAccount or Pod UID.
Compartment selection must satisfy
[RFC 0036's shared-state or isolation requirements](https://github.com/openclaw/rfcs/pull/70);
identity labels cannot prove that isolation.

In the selected Kubernetes/gVisor profile, a permission increase or decrease
requires a fresh Pod/gVisor sandbox, assignment and execution-bound SVID. Another
container sharing the old Pod is insufficient. Withdraw old dispatch authority
before admitting dispatch under the changed scope; do not change permissions in
place while retaining old processes, memory, credentials or reusable state.
Approved workspace or context handoff requires explicit scope and isolation
checks; it cannot carry old authority or disallowed higher-authority data into
the successor.

An Agent may handle multiple messages and turns under one unchanged authorized
context; a message alone does not require a new Pod. Reusing a context across
assignments remains a future optimization requiring proof of unchanged effective
authority and data scope, currentness, work attribution and retained-state
isolation. Comparing one permission label cannot qualify reuse.

The registered SPIFFE ID identifies one execution binding and must never be
rebound to a successor. Attested selectors must distinguish that execution from
other workloads and earlier incarnations. A fresh registration name with
unchanged, insufficient selectors cannot do so. Renewal preserves the same
binding. If an old certificate remains valid after replacement, it still resolves
only to the old, retired assignment.

[RFC 0037's observations](https://github.com/openclaw/rfcs/pull/71) reference OCC's
canonical assignment; they cannot select another current execution. Lifecycle
intent has a separate generation: stop need not change execution generation;
replacement does.

Record registration intent before dispatch. The registrar uses its own authority
and protected Compute evidence, never the target's credential. Workloads cannot
choose subjects, parents or selectors. A timed-out create requires exact
reconciliation, not an unrelated registration.

Pre-activation registration grants no Harness execution, Channel traffic or
SecretBroker access. Independently authorized readiness paths preserve RFC 0027's
activation order. Logical work and execution assignment are separate: work may
survive a process, but selecting a replacement requires current authority and new
execution-bound evidence. Neither recovered work nor its old lease authorizes the
replacement.

## Request verification

For each protected request:

1. Validate configured trust, certificate validity and the expected X.509-SVID peer.
2. Resolve trusted registration and protected execution evidence to the exact
   assignment. Caller headers or serialized identity objects are insufficient.
3. Check permitted purpose: serving, bounded drain of admitted work, permitted
   control, or retained cleanup. Drain uses the original work ceiling and RFC
   0037's finite deadline; it admits no new work. Purpose checks use current
   authority or a qualified enforcement lease as specified below.
4. Apply existing IAM, Restrictions, logical-work and effect constraints. The
   service owner, verified requester and executing workload remain distinct under
   RFC 0036. Authentication grants no permission.

The transport produces a process-local verification handle bound to its connection
and evidence lifetime. Copying its serialized fields does not recreate that
handle. This is an API integrity boundary, not proof that a certificate's private
key is uncopyable: ordinary TLS establishes key possession.

Where an operation requires proof of the originating execution, the selected
protected transport must establish that origin; a copied workload key alone is
insufficient. A profile that cannot provide the required proof remains unavailable
for that operation.

[RFC 0034 mediation](https://github.com/openclaw/rfcs/pull/68) checks three bindings:
connector service assignment, represented Agent assignment through protected
runtime evidence, and RFC 0036's original work with the enforcement lease defined
here. Connector and gateway identities cannot replace caller authority.

## Outage operation

The first GitHub mediation profile requires online OCC authority for every
protected dispatch. It selects no outage exception for reads or credential maintenance.
The exception below is an optional profile proposal, requiring separate explicit
selection and qualification; finite leases alone do not enable it. Provider tokens
may be cached only while every use passes the selected current-authority checks.

Long-lived connections and streams recheck purpose before privileged dispatch or
protected delivery. Application writes, message posting, new admission, renewal,
expansion and new execution assignment require current authority. Only explicitly
qualified application reads may continue during an authority outage under an
existing unexpired enforcement lease. Eligibility follows operation semantics,
not the HTTP method.

Protected origin, local revocation state, trustworthy time and every other
mandatory check still apply; missing evidence denies the affected operation. OCC
and each resource's selected IAM authority still own permission decisions; a
connector cannot invent an outage profile. Read freshness and protected content
versions require explicit qualification. A lease for a resource does not by
itself authorize newly protected content at that resource.

This is a proposed refinement of RFC 0027's per-operation current-authority and
unavailable-state denial rules, including SecretBroker access. The accepted
baseline is unchanged until this refinement is accepted.

Trusted credential maintenance may preserve existing read access only when
expressly preauthorized under that same lease and qualified by RFC 0034. It cannot
create work, expand access or extend an authority deadline. This does not permit
application writes during an outage. Write interruption and restricted read
freshness are deliberate initial limitations; broader outage profiles require a
separate proposal.

## Lease issuance and ordering

OCC and the selected policy authorities issue leases for RFC 0036's admitted work.
Each lease records:

- Issuer and committed issuance version.
- Installation and Namespace.
- Work, immutable scope and the admitted finite-or-uncapped horizon selection.
- Exact assignment and generation.
- Intended accepting service and purpose.
- Applicable policy and ancestor scopes.
- Absolute expiry and synchronization requirements.

Issuance and renewal recheck current policy, workload eligibility and work/ancestor
closure. An authority service uses its own narrowly scoped identity; a certificate
or lease reference alone cannot authorize issuance.

Commit issuance and revocation in a defined authoritative order and fence stale
issuers. Revocation prevents subsequent affected issuance or renewal, including
descendants. Previously committed issuance returned late keeps its original
absolute expiry. Cached policy, delayed signing and future validity starts cannot
reset the interval from issuance commit.

Each selected IAM integration must establish its policy-observation and ordering
guarantees or remain unavailable for this profile.

## Lease bounds and ancestry

Execution duration and logical-work horizons may be explicitly uncapped under
the selected policy. An omitted or unknown policy is not evidence of uncapped
authority. Each enforcement lease still has a finite absolute expiry.

For issuance committed at `t`, expiry must satisfy:

```text
expiresAt <= min(t + maximumLeaseDuration, all applicable finite bounds)
```

`maximumLeaseDuration` is finite. An explicitly uncapped horizon contributes no
duration bound; any finite ancestor, purpose or stop deadline still applies.
Applicable bounds include:

- The issuance-time maximum.
- Any configured finite execution, original-work and ancestor horizons.
- Purpose and stop deadlines.
- Every applicable withdrawal target after clock and enforcement allowances.

Ordinary profiles may target minutes and sensitive profiles seconds. These are
tolerance scales, not chosen lifetimes or measured guarantees. A child cannot
weaken an ancestor's withdrawal target.

Fresh authoritative child renewal requires open, authorized logical ancestors,
not a running parent or a valid parent execution lease. Renewal cannot expand
scope, extend a configured cap or reopen terminal work. An uncapped horizon does
not authorize offline writes or replay of uncertain effects. Offline attenuation can
only narrow an existing lease and retains its expiry; it cannot admit children,
renew authority or reassign execution.

## Revocation and continuity

A trusted holder installs authenticated revocation state with complete scope
coverage and a monotonic cursor satisfying the lease's synchronization
requirements. Applying revocation and consuming authority must be locally ordered.
Gaps, rollback, incomplete scope coverage or lost clock continuity block affected
use until synchronization restores trustworthy state.

An initialized disconnected holder may continue only the qualified reads above.
Persisting a signed snapshot alone does not establish continuity after restore.
Concrete synchronization, retention and clock mechanisms remain implementation
choices requiring qualification.

Revocation acceptance, distribution, local observation and effective withdrawal
are separate outcomes. Effective withdrawal requires complete acknowledgements
from affected holders or proven expiry of outstanding leases, including
descendants and clock/enforcement allowances.

Qualified read leases trade a bounded withdrawal delay for availability during
authority outages. They cannot support an immediate withdrawal claim for an
unreachable holder.

Tightening a profile cannot retroactively shorten a disconnected holder's lease;
the tighter guarantee waits for affected old authority to end. Any bound measured
from an external IAM change also includes its observation delay. A bound from
OCC's observed revocation commit must be labeled as such.

Transient revocation entries may be removed only after no affected lease or
descendant can survive the applicable bounds and restore risks. Retain current
policy, permanent disable and terminal work state so collection cannot permit
fresh issuance.

## Dispatch and lifecycle

Dispatch permits bind assignment/generation, original work and authority version,
operation digest and evidence deadline. The accepting service rechecks mandatory
evidence at final submission; reservation or queuing cannot postpone submission
past the deadline. Offline allowance consumption requires a qualified
preallocation and durable accounting; exhaustion cannot authorize fresh credit.

The effective dispatch deadline is no later than any applicable certificate,
verification-handle, enforcement-lease, work-horizon, approval, broker-access,
provider-credential or purpose deadline. Identity renewal and reconnect cannot
extend work, lease or drain deadlines. Previously admitted provider effects may
finish; record their outcomes separately.

Reconnects obtain new verification handles. Renewal cannot extend a handle's
original evidence lifetime; fresh authentication produces fresh evidence. Missing
trust, expired evidence, untrustworthy revocation state or terminal invalidation
blocks use; late success cannot reopen a closed stream.

Permission changes use the fresh sandbox transition above. Withdrawal of old
dispatch authority and physical termination are separate facts: denying the old
assignment is not proof that its processes stopped or relinquished shared state.

Retirement withdraws authority under the selected bound and preserves cleanup
responsibility; report retirement as effective only after that withdrawal is
established. Registration deletion and certificate expiry do not prove
termination. Compute resolves uncertain creates and observes predecessor
termination before any writable successor, including initialization or restore.
Cleanup survives Agent deletion under its own retained authority. Termination,
provider revocation and accepted effects remain separate outcomes.

## Runtime qualification

The first deployment targets Kubernetes. gVisor attestation and transport must
distinguish actual sandbox callers; host process IDs or shared labels do not prove
inner-process identity. Selecting SPIRE supplies no gVisor implementation.
Accepting RFC 0035's identity and authority invariants does not qualify an
attestor, transport or lease profile; each remains unavailable until its mechanism
is specified and demonstrated.

Runtime qualification must demonstrate:

- Distinct identities for co-located workloads and restarts.
- Renewal, reconnect and warm-stream behavior.
- Retired-execution denial while certificates remain valid.
- Permission increases and decreases using fresh Pod/gVisor sandboxes, with old
  dispatch denied and retained-state handoff checked.
- Finite lease expiry and current-authority renewal for explicitly uncapped work,
  with any finite ancestor, stop and purpose deadlines preserved.
- Online-only profiles denying affected dispatch when current authority is
  unavailable; separately selected read exceptions stopping at lease deadlines.
- Write, renewal and reassignment denial without current authority.
- Registration timeouts, deletion cleanup and uncertain predecessor termination.

Measure withdrawal from the profile's declared start point, including
policy-observation, issuer-fencing, clock and holder-enforcement delays. Record
authorization closure, connection closure, physical stop and external revocation
separately. Unit fixtures cannot establish installed-runtime qualification.

The following mechanism questions remain unresolved:

- Which gVisor attestation and protected-origin mechanism satisfies exact-execution
  binding?
- Which protocol orders lease issuance, purpose withdrawal and accepting-service
  enforcement, including disconnected and restarted holders?
- Which read operations qualify for outage continuation, and what measured
  withdrawal bounds apply to each profile?
- What certificate, handle and lease lifetimes meet those bounds, and how are trust
  configuration and explicit profile migration qualified?
