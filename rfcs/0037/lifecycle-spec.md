# Persistent Agent and runtime lifecycle specification

This supporting specification contains the detailed requirements of
[RFC 0037](../0037-persistent-agent-runtime-lifecycle.md). It extends
[RFC 0027's Agent deployment](../0027-openclaw-enterprise.md#agent-deployment)
with durable lifecycle intent, completed-state recovery, single-writer handoff,
and separately reported outcomes. These are proposed requirements, not claims of
implemented runtime behavior.

Work can outlive a process, but restart is not transparent continuation:
credentials change, writes remain unfinished, and provider operations may have
completed. Persisted stop intent, denied requests, process termination, and
credential cleanup are separate facts. The initial recovery profile preserves
Agent identity, completed context, files, and effect receipts on compatible
same-cluster retained storage. It does not restore authority or replay
interrupted actions.

## Ownership and records

OCC owns Agent state and lifecycle. Compute and Sandbox drivers realize admitted
intent and report observations; neither chooses policy nor rewrites revisions.
Internal records use existing resources, without adding an execution resource
between `AgentRevision` and its workload.

| Record | Required contents |
| --- | --- |
| Lifecycle intent | Agent; desired running, stopped, or disabled condition; monotonic generation; attributable accepted request. |
| Runtime observation | Canonical execution assignment and generation; exact revision, provider instance, and incarnation; readiness; writer ownership; termination or uncertainty. |
| Recovery head | Completed conversation boundary; workspace durability reference; exact compatibility fingerprint; interrupted or unresolved work. |
| Lifecycle operation | Stable idempotency key; expected generation; source and target references; admitted obligation; dispatch progress; observed outcomes. |

Use [RFC 0035's execution assignment](https://github.com/openclaw/rfcs/pull/69)
across registration, observations, and accepting services. OCC selects the
assignment; Compute supplies evidence. Lifecycle and execution generations are
distinct. Readiness grants no serving permission, and expired controller claims
prove neither death nor exclusive ownership. Agent authentication need not use
SPIFFE.

[RFC 0036](https://github.com/openclaw/rfcs/pull/70) owns logical work, its service
owner and requester attribution, immutable scope and any configured original
horizon, and attached-child lineage. This RFC owns runtime transitions and finite
completed-result delivery. Logical work, runtime execution, bounded drain, and
delivery have separate lifetimes. Work and delivery records retain their
identity across runtime replacement.

A message acknowledgement, completed model turn, or lost connection does not
close logical work; retained context does not authorize it. For independently
admitted children, renewal and required joins follow RFC 0036, including ancestor
cancellation when no parent process runs. The initial supported child subset is
an open selection: subordinate native helpers may share one work/attempt only
when its authority, aggregate limits, cancellation, and physical cleanup cover
them. Independent children require their own scope, authority, lineage, status,
and cleanup. A child name or Git worktree supplies no isolation boundary.

## Execution limits and authority

An Agent may exist indefinitely as a stable identity and configuration. Revision,
Pod, Harness, conversation, logical work, and execution-attempt lifetimes remain
separate. Persistence promises neither a failure-free process nor automatic
continuation on replacement.

Execution duration defaults to uncapped. An optional finite cap limits one
original attempt from its dispatch anchor, including startup, tool execution,
and waiting. Admission records the effective finite-or-uncapped selection and
its policy provenance immutably. Configuration changes affect future admission;
activity, model rounds, reconnects, and credential rotation cannot extend an
admitted cap. Applicable Restrictions may require or narrow a finite cap.
Missing authority or missing persisted policy is an error, not an uncapped
fallback. Extending an active budget is outside the initial scope.

Uncapped means elapsed time alone does not stop the attempt. Completion, explicit
stop, required-authority withdrawal, and independently configured resource or
spend limits still apply. Work horizons may be absent under an uncapped policy;
a configured finite work or ancestor horizon remains binding. Enforcement
leases, credentials, operation deadlines, drain deadlines, and completed-delivery
horizons remain finite. Lease and credential renewal requires current
exact-operation authority and cannot broaden scope, reopen terminal work, or
reset an existing cap or deadline.

Both modes retain an independently authorized stop owner for exact native
construction and owned helpers before execution can begin. Finite mode enforces
the original monotonic deadline with bounded timer waits; uncapped mode creates
no duration-expiry timer. Protective cleanup must remain usable when ordinary
continuation authority is unavailable. A cancellation acknowledgement, terminal
model event, or socket close does not prove physical closure of every mutator.
Retain capacity and writer ownership while closure or provider effects remain
uncertain. Identity and provider credential rotation require qualified client
behavior; a new token neither refreshes an existing process environment nor
extends its attempt.

## Inventory and user controls

Provide authorized Agent inventory and current-work observations showing intended
service state, observed execution state, observation time, exact work identity,
effective cap, pending controls, and unresolved outcomes. A recent response does
not refresh old runtime evidence. Agent visibility alone does not permit reading
private task content.

| Control | Required outcome |
| --- | --- |
| Stop task | Stop one exact task and its owned helpers or admitted descendants. Other work remains subject to normal admission and writer exclusion. |
| Stop Agent | Persist stopped intent, block new work including incoming messages and stale queued dispatch, and drive affected work to stop. Preserve Agent identity, configuration, retained files, and unresolved cleanup obligations. |
| Start Agent | Admit a separately authorized running transition. Do not bypass administrative disable, revive canceled work, replay uncertain operations, or bypass predecessor writer exclusion. |

Own-task, shared-task, and Agent lifecycle permissions are separate exact-resource
decisions. An administrator label is not itself authorization. Persist attributable
acceptance and its audit atomically. Keep acceptance, new-work blocking,
requested/effective authority withdrawal, stopping, observed stopped, failed
operation, termination unknown, and credential cleanup separately visible. Queue
completion and provider deletion acknowledgements do not prove observed stopped.

The default Stop action must be selected explicitly. Graceful drain and delivery
after stop are optional profiles described below, not an implicit consequence of
uncapped execution. Cancellation and security revocation override drain. Start
opens eligible new admission; it does not undo a prior task cancellation.

## Durable admission

Conceptually, `stopAgent` and `startAgent` take an Agent reference, expected
lifecycle generation, and idempotency key; an exact-task stop also binds the
original task identity and applicable concurrency check. OCC authenticates and
authorizes the exact actions and references, then atomically records intent,
operation, attribution, and reconciliation work with a compare-and-set against
the expected generation. Repeated keys identify the same operation; conflicting inputs or
stale generations are rejected.

The acceptance receipt reports durable admission, not completed startup or
teardown. Reconcile an unknown commit before asserting acceptance or duplicating
effects. Workers recheck current intent and ownership before dispatch, and
restart resumes the retained obligation. Audit export failure cannot reopen
denied authority or erase durable protective operations. These records separate
acceptance, dispatch, and observation so each outcome remains truthful.

## Activation and writer exclusion

Preserve RFC 0027's activation order:

1. Prepare an isolated, nonserving candidate with Harness execution disabled.
2. Verify containment and prepare the candidate's nonserving route.
3. Retire the predecessor and verify its Harness has stopped.
4. Select the candidate as the sole active revision and permit execution.
5. Enable routing only after readiness.

A candidate readiness probe is not runtime authority. Before predecessor
retirement, failures preserve prior serving. After retirement, service requires
verified activation or rollback.

Before any successor writes shared retained storage, including initialization,
repair, or restore, Compute must establish predecessor termination and resolve
earlier creates that could still produce writers. Names, lease expiry, route
withdrawal, and elapsed time are insufficient evidence. Earlier candidate
preparation remains isolated from shared writable state. If evidence that no
writer remains is missing, block replacement and retain the data.

## Recovery contract

The initial profile requires same-cluster retained volumes and exact compatible
Harness and build, configuration, adapter protocol, and recovery schema. Preserve
completed text, supported inert tool observations, and verified workspace
durability. Exclude RAM, interrupted shells, provider-private reasoning, and
unsupported native-session details. Compatibility profiles bound recovery
promises. Active-session migration/replay across containers, builds, or source
revisions, plus durable coordination for continuing active work and independent
children, are later capabilities. Changed builds require separately qualified compatibility or migration; neither
is a gate for the first completed-state retained-volume profile.

A recovery head is not a historical filesystem snapshot. Expose files changed
after the completed turn and require explicit disposition. Older context plus
residual files is not clean rollback, and a fresh container does not make
retained executable content safe.

After the no-writer barrier, a trusted offline adapter may import and read back
completed context without Harness execution. If import requires execution, OCC
must first select the candidate as the sole active revision. Ordinary-work
admission and routing stay closed until restore and readiness succeed. Restore
cannot execute model calls, historical tools, or restored startup instructions.
Verify compatibility and ownership or remain nonserving. Use a fresh incarnation
and current workload authorization; never restore credentials or historical
grants as authority.

Continuing still-open logical work also requires a fresh authoritative
assignment to the qualified successor and fresh enforcement authority within
the work's immutable scope and any original configured horizon. Preserve original
operation fingerprints, allowance reservations, submission receipts, and unknown
outcomes. Replacement cannot reopen terminal work, reset a configured horizon, or
convert an unresolved effect into a new attempt. The work model neither expands
recovery compatibility nor removes existing attempt limits. This is a constraint on any
later continuation profile, not a promise of initial active-session migration
or transparent retry as a new attempt.

Stopped intent survives restart and incoming messages. Resume requires fresh
explicit authorization and current build eligibility; failed recovery cannot
use revoked builds. Storage loss beyond the retained-storage guarantee requires
a separate recovery capability.

Cross-cluster recovery, arbitrary migration, process-memory restore, workflow
scheduling, automatic source merging, and historical tool replay are out of
scope. So are application-consistent snapshots, host wake, and remote bridge
protocols. [Gateway recovery](https://github.com/openclaw/rfcs/pull/46) proposes
application-consistent recovery and scale-to-zero;
[remote AgentHarness](https://github.com/openclaw/rfcs/pull/31) proposes bridge and
event protocols. Both remain proposals, and this RFC selects neither.

## Graceful stop and withdrawal

### Drain admission and bounds

Graceful stop durably records stopped intent, closes new ordinary-work
admission, and records a finite drain deadline for the exact execution. Eligible
existing work may finish only within its unchanged scope, any original configured
horizon, and that deadline. Current authoritative renewal may maintain access within those
bounds; stop cannot extend them or admit new work. Without a qualified drain
profile, OCC admits no draining execution authority.

Application writes, including message posting, require current authority.
During an authority outage, only explicitly qualified reads may continue under
an existing unexpired enforcement lease and all required local checks from
[RFC 0035](https://github.com/openclaw/rfcs/pull/69). The outage permits no
admission, renewal, expansion, or new execution assignment.

Each issued lease stays finite and must fit applicable configured work and
ancestor horizons, drain deadlines, and profile withdrawal bounds, including
clock and enforcement allowances. A newly imposed stop or tighter withdrawal target must account for
outstanding disconnected leases before claiming the new bound. Minutes for
ordinary work and seconds for sensitive work are tolerance scales to qualify,
not guaranteed values. Reconnect and restart cannot move an existing deadline.
A holder with untrustworthy clock or revocation state synchronizes before
serving.

### Withdrawal and retirement

At drain completion or deadline, withdraw remaining authority for that execution
before reporting drain complete. Runtime retirement withdraws the predecessor's
authority; it need not terminally close logical work eligible for fresh
assignment. Cancellation and security revocation close or withdraw affected
work, descendants, and delivery.

Record withdrawal durably and fence further issuance. Report withdrawal
effective only with evidence from accepting services or expiry under the
qualified profile. Requested withdrawal, effective withdrawal, and physical
termination remain distinct. Accepted provider effects may finish despite local
revocation.

Retain the verified completed boundary and newer uncertainty. Compute stops the
exact workload and observes termination before reporting stopped.
[Credential cleanup](https://github.com/openclaw/rfcs/pull/68) retains independent
authority. Report each of these facts separately from accepted stop:

- Admission closure.
- Drain deadline.
- Work state.
- Execution-authority withdrawal.
- Delivery state.
- Physical termination.
- Credential cleanup.

Unknown termination blocks writable replacement. A possible provider submission
remains outcome-unknown under its exact operation identity: reconcile through
supported read or idempotency mechanisms, or seek explicit disposition.
Replacement cannot automatically repeat writes, and local revocation cannot
retract accepted remote effects.

## Completed-result delivery

Graceful stop preserves pending delivery of an already completed result when a
separate finite delivery responsibility was admitted before logical-work
closure, possibly at original admission. For a profile supporting independent
children, completion follows its required child joins under RFC 0036. All
profiles preserve unresolved effects.

The delivery responsibility records its owner, originating work, cancellation
relationships, and operation receipt. It fixes the permitted output, exact
audience and destination, and original absolute horizon. Binding the completed
content must satisfy that admission.

A trusted delivery service can act independently of the stopped worker. At
posting time, it checks current authority, content access, audience eligibility,
exact Channel permission, and provider authorization. Missing required
membership evidence blocks delivery. It cannot complete unfinished computation,
use a fallback audience, or reopen work. A later delivery responsibility needs
fresh admission, and stopped intent alone permits none.

Cancellation or security revocation, including Agent disable, withdraws affected
delivery even if the Agent is already stopped. That path preserves outstanding
physical-termination and cleanup obligations and distinguishes requested from
effective withdrawal.

Retry reservations cannot reset the delivery horizon. A definitive no-effect
result may permit a policy-approved retry within the remaining horizon. An
unknown outcome retains its original receipt and cannot authorize reposting.

## Qualification

Qualification requires a real supported Harness. Source contracts and mocks do
not establish runtime guarantees. First qualify the selected same-build,
same-cluster completed-state retained-volume profile and its controls:

- Recover non-self-contained conversation and files; prove predecessor
  exclusion; survive controller restart; preserve stopped intent; expose
  incompatible restore and ambiguous effects.
- Demonstrate useful native execution beyond fifteen minutes with the default
  uncapped selection, plus configured finite expiry from the original anchor.
  Configuration edits and credential rotation preserve the original selection;
  missing persisted policy rejects rather than implying uncapped execution.
- Stop during construction, model streaming, and blocked tools; observe owned
  helper cleanup or report termination unknown. Incoming messages, stale queue
  work, concurrent controls, and restart cannot undo stopped intent. Start
  cannot bypass disabled intent or unresolved writers. Required-authority
  withdrawal interrupts affected work under the selected enforcement profile,
  including during blocked model/tool activity.
- Verify distinct own-task, shared-task, and Agent permissions, and prevent
  inventory reads from disclosing unauthorized task content.

Qualify optional drain, outage-read, delivery, and continuation profiles only
when selected; they are not evidence for unselected capabilities:

- With a live connection, deny new work, allow only eligible original work
  before deadline, deny new dispatch after effective withdrawal, and let
  cancellation or disable override drain.
- During authority outage, exercise qualified reads while denying writes,
  renewal, and reassignment. Measure withdrawal from the selected profile's
  start point through accepting-service enforcement.
- Retain the same deadline and operation across restart. Unknown
  execution-authority closure or termination must block writable replacement.
- Assign still-open work freshly without widening its scope or any configured
  horizon or losing effect receipts.
- Deliver completed results after graceful stop; exercise expiry without
  horizon reset, unknown posting outcomes, and cancellation or disable after
  the Agent is already stopped.

Full independent-child coordination and active-session or changed-build migration
need separate scope and evidence; they do not block the first completed-state
recovery profile.

## Open decisions

- Which Harness, build, and configuration combinations form the first profile?
- What is the default Stop action, and are graceful drain and post-stop delivery
  offered in the initial profile?
- Which subordinate helpers or independently admitted children are supported
  initially, with what aggregate limits and observable cleanup?
- What drain bounds and escalation apply when writers cannot be observed?
- Which withdrawal profiles, clock assumptions, and observation evidence bound
  qualified reads and prove effective closure?
- Which output paths enforce exact completed-result identity, audience, and
  cancellation while the Agent is stopped?
- Which workspace and context metadata must be retained, exported, or deleted
  together?
- How should operators resolve interrupted files and unknown provider outcomes?
- What evidence permits changed-build recovery or storage-independent restore?
