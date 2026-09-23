---
title: Guest foreground work and visible restart stops
authors:
  - Vincent Koc
created: 2026-09-22
last_updated: 2026-09-23
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/74
---

# Proposal: Guest foreground work and visible restart stops

## Summary

Limit guest execution on participating shared Gateways to bounded foreground turns. Preserve conversation history, but stop interrupted guest turns instead of automatically resuming them after a Gateway restart. Show a durable explanation in the thread and require a fresh, currently authorized request to continue. Reuse existing SQLite session, transcript, and sandbox registry payloads for the admission and allocation retirement restrictions. Add no table, column, database, sidecar, or schema-version bump. Durable guest execution remains a separate proposal.

## Motivation

A guest's original request must not acquire broader authority because a Gateway
restarts, a role changes, or a visitor receives a new invitation. Supporting durable
guest work requires preserving and rechecking that original authority across every
recovery path. We can defer that complexity by declining durable guest execution.

The result still needs a clear user experience. An endless spinner, a silent stop,
or an unexplained failed thread gives the user no useful next step. Deleting the
conversation would also discard useful output. We need to stop execution while
keeping its history and explaining why automatic recovery did not happen.

## Goals

- Allow useful, bounded guest conversation and qualified foreground tools.
- Prevent guest work from surviving its admitted turn as autonomous execution.
- Stop guest restart recovery before any model, tool, or child dispatch.
- Preserve history and show one durable, truthful interruption notice.
- Reauthorize each fresh request against current access, model, and sandbox policy.
- Keep staff behavior and deployments without this guest policy unchanged.
- Avoid a new SQLite schema or a general durable-work authorization system.

## Non-Goals

This proposal does not add durable guest jobs, change conversation retention, or
delete workspaces. It does not change thread sharing, archiving, model permissions,
Cloudflare authentication, or host privilege boundaries. Those controls remain
necessary and keep their existing owners. It does not impose a new policy on
personal Gateways or replace the Enterprise work-lifecycle proposals.

## Proposal

### 1. Define foreground work precisely

A foreground turn has one admitted request, a finite deadline, and an owner that
can stop every supported operation. Waiting for a permitted answer or tool result
does not extend that deadline. The visitor plugin selects the guest posture and
checks its prerequisites. Core admission and execution owners enforce the generic
lifecycle restriction, without hardcoding a plugin ID.

Extend the existing host-held gateway access authority with one negative execution
restriction. The visitor plugin supplies it for guest admission. This is a proposed
extension to that contract, not an existing role option. Ordinary maintainer
admission does not receive the restriction. Reuse existing role and tool controls
where they suffice, without introducing a separate policy registry.

| Request or event | Required behavior |
| --- | --- |
| Ordinary guest message | Admit one bounded turn under current permissions. |
| Another guest message while the thread is busy | Reject visibly and ask the user to wait or stop the active turn. Do not queue later execution. |
| Qualified foreground tool | Keep its authority, deadline, and stop ownership inside that turn. |
| Durable child, collector, goal, schedule, or deferred follow-up | Reject before registering or dispatching autonomous work. Explain the restriction. |
| Browser disconnect | Let the already admitted bounded turn continue. Reconnect may observe that same live run. |
| Cancellation, grant expiry, or revocation | Withdraw execution authority and stop owned work through its lifecycle owner. |
| Gateway restart interrupts the turn | Record a terminal interruption and suppress automatic resumption. |
| Fresh user request after interruption | Check current authority and admit a new run, subject to resource-stop checks. |

Apply the restriction to every route into these producers: tools, RPC, direct HTTP
invocation, Code Mode, hooks, and internal dispatch. Hiding a tool helps users and
models discover available capabilities, but does not enforce the policy.
Synchronous internal operations remain possible when the parent owns their entire
lifetime. Independently continuing child sessions are outside the initial scope.

Arbitrary shell execution needs separate qualification. Disabling a tool's managed
background mode does not prove that shell-created descendants or remote jobs stop.
Expose only tools whose execution owner demonstrates the required containment and
stop behavior. An unqualified capability is unavailable for guests, with a visible
reason. Staff tools and sandbox requirements remain unchanged.

### 2. Record the decision when accepting the turn

Derive the restriction from the authenticated admission, not from a later lookup
of the session creator or the user's current role. A shared thread can have several
callers. Promotion or reinvitation cannot convert an old guest turn into resumable
work.

Record a minimal **do not resume after restart** decision in the existing persisted
run/session payload. Bind it to the exact accepted session and run identity. Carry
it through any recovery-cycle bookkeeping without converting it into a grant.
Commit it with turn admission, before acknowledging acceptance or dispatching work.
If that commit fails, reject the request visibly.

This is a new typed payload contract inside existing storage. It is not a new
SQLite schema, and it is not zero persistence. The implementation must update the
owning types, serializers, normalizers, projections, and tests together. The marker
contains no credential, reusable permission snapshot, or invitation secret. The
existing visitor-grant store continues to own grants and revocation.
Only the host writes the marker. Public session edits cannot set or clear it.
Reset, fork, and accepted-run replacement must preserve the original terminal
receipt without copying its execution authority into another run.
Malformed or unsupported marker values remain nonresumable, with an explicit
diagnostic. Do not normalize them to absence and enter ordinary recovery. Preserve
the history. Legacy absence follows the inventory policy below, not an inferred
staff or system identity.

| Persisted fact | Owner and purpose |
| --- | --- |
| Exact run identity and nonresumable admission decision | Existing session/run payload. Prevent recovery of that accepted turn. |
| Terminal outcome and interruption reason | Existing lifecycle state. Let reconnect and status reads explain the outcome. |
| User-visible notice | Existing transcript. Preserve the explanation alongside the interrupted work. |
| Terminal request identity | Existing terminal-source bookkeeping and the exact scoped notice. Recognize the stopped run while either receipt remains. |
| Allocation retirement policy | Existing sandbox registry payload. Reserve cleanup for the original foreground owner, separately from the session's no-resume decision. |

The marker must survive recovery-state replacement until terminal settlement. A
subsequent staff turn in the same thread receives its own admission decision. It
must neither inherit the guest restriction accidentally nor make the stopped
guest turn resumable.

### 3. Stop recovery and explain it in the thread

Enforce the admission decision in ordinary chat recovery as well as child and job
recovery. The startup orphan scan and duplicate-request recovery must both reach
the same lifecycle owner before they can dispatch work.

For an interrupted guest turn, that owner must:

1. Match the exact session, run, and recovery revision. An older recovery attempt
   must not stop a newer foreground turn.
2. Commit a nonretryable terminal outcome, retire the active recovery claim, and
   retain the original request's terminal identity.
3. Include one idempotent Control UI notice and cancellation or removal of that
   run's resumable pending-input custody in the same SQLite transaction.
4. Stop showing the turn as running. Reconnect, history, and API status must agree
   that it ended without automatic resumption.

Use existing supported lifecycle states plus a diagnostic reason. Do not add a
new protocol status solely for this presentation. The notice is application
output, so it needs no model call, system-agent run, or recovered guest authority.

Suggested thread label: **Stopped after restart**.

> This turn stopped when the Gateway restarted. Guest work is not resumed
> automatically for security reasons. Your conversation history is preserved.
> Send a new request to continue.

If an operation might already have changed external state, also show:

> Some actions may already have completed. Check their results before repeating
> the request.

Use the restart wording only when lifecycle evidence establishes a restart.
Otherwise show **Interrupted — not resumed**, explain that the cause is unknown,
and retain the same security-policy explanation. Never claim rollback of external
effects or physical process termination from a database status alone.

Do not permanently tombstone the conversation. The stopped turn stays terminal,
while an authorized user can send a new request in the same thread. A **Write a
new request** action may focus the composer. It must not resend the old prompt,
reuse an approval, or silently change an old idempotency key into a new request.
If access expired, show that access must be restored before a new request.

Restored browser state, old request retries, and late approvals must not resume a
stopped turn while its receipt remains. Same-ID admission must recognize either a
retained terminal request ID or the exact notice scoped to that session and run.
Return the recorded terminal result before dispatch. Treat a failed lookup as
unavailable, not as proof that no receipt exists.

Control UI reconnect retains the original request ID. Exact interrupted
pending-input custody can cause automatic resubmission. Terminal settlement must
prevent automatic resubmission of the stopped run. A missing receipt for an
attempted send leaves delivery unconfirmed and requires manual review.

Eviction from the bounded terminal-ID list does not end this protection while the
exact notice remains. This proposal does not change retention or promise
indefinite deduplication after explicit destruction of all relevant receipts.
Absence then proves neither freshness nor nonexecution. Preserve the UI's
unconfirmed state and manual-review path. A genuinely new request uses a new ID
and current authorization, and can continue in the same conversation.

### 4. Reuse the existing lifecycle and storage owners

The following source anchors refer to OpenClaw commit
[`b6bd69d6`](https://github.com/openclaw/openclaw/commit/b6bd69d6e85f9a2d6ae5f0bf15e5fcfe6dd88490).
They show reusable mechanisms, not an implementation of this guest policy.

- [Chat restart admission and retry handling](https://github.com/openclaw/openclaw/blob/b6bd69d6e85f9a2d6ae5f0bf15e5fcfe6dd88490/src/gateway/server-methods/chat-restart-recovery.ts)
  already persist accepted request identities and distinguish recovery from fresh
  admission. Suppressing guest child tools alone would leave this path.
- [Startup orphan marking](https://github.com/openclaw/openclaw/blob/b6bd69d6e85f9a2d6ae5f0bf15e5fcfe6dd88490/src/agents/main-session-recovery/main-session-restart-recovery-marking.ts)
  and [recovery dispatch](https://github.com/openclaw/openclaw/blob/b6bd69d6e85f9a2d6ae5f0bf15e5fcfe6dd88490/src/agents/main-session-recovery/main-session-restart-recovery-runtime.ts)
  own recovery of interrupted main sessions, including durable Control UI claims.
- [Recovery failure notices](https://github.com/openclaw/openclaw/blob/b6bd69d6e85f9a2d6ae5f0bf15e5fcfe6dd88490/src/agents/main-session-recovery/main-session-restart-recovery-failure.ts#L114-L176)
  already combine a guarded lifecycle patch and an idempotent transcript append
  in one transaction for the local thread. Reuse that pattern, not its current
  conversation-tombstone behavior or replacement-session wording.
- [Terminal-source bookkeeping](https://github.com/openclaw/openclaw/blob/b6bd69d6e85f9a2d6ae5f0bf15e5fcfe6dd88490/src/config/sessions/restart-recovery-state.ts)
  owns claim cleanup and bounded terminal request IDs. Keep this as the canonical
  flow rather than adding a parallel guest replay registry.
- [SQLite session payload decoding](https://github.com/openclaw/openclaw/blob/b6bd69d6e85f9a2d6ae5f0bf15e5fcfe6dd88490/src/config/sessions/session-entry-json.ts)
  reads the existing `entry_json` representation. The proposal adds no sidecar
  files, table, column, or database. It proposes no schema-version increment,
  subject to the rollout and rollback requirements below.
- [Sandbox registry storage](https://github.com/openclaw/openclaw/blob/b6bd69d6e85f9a2d6ae5f0bf15e5fcfe6dd88490/src/agents/sandbox/registry.ts)
  persists allocation metadata in `sandbox_registry_entries.entry_json`. Reuse
  this payload for the allocation retirement policy described below.

Additional retry and retention evidence comes from commit
[`8c001ebd`](https://github.com/openclaw/openclaw/commit/8c001ebde9333e0dfe4402e6b0cdc0778d16a079):

- [Control UI outbox reconciliation](https://github.com/openclaw/openclaw/blob/8c001ebde9333e0dfe4402e6b0cdc0778d16a079/ui/src/pages/chat/chat-outbox-drain.ts#L133-L244)
  requires positive interrupted custody for automatic replay of attempted input.
  [Restart-input tests](https://github.com/openclaw/openclaw/blob/8c001ebde9333e0dfe4402e6b0cdc0778d16a079/ui/src/pages/chat/chat-restart-input.test.ts)
  cover same-ID resubmission, missing receipts, and replacement sessions.
- [Terminal-source bookkeeping](https://github.com/openclaw/openclaw/blob/8c001ebde9333e0dfe4402e6b0cdc0778d16a079/src/config/sessions/restart-recovery-state.ts)
  retains at most 64 terminal run IDs. The proposed notice lookup extends
  recognition while the exact receipt remains, without enlarging that list.
- [Scoped transcript identity lookup](https://github.com/openclaw/openclaw/blob/8c001ebde9333e0dfe4402e6b0cdc0778d16a079/src/config/sessions/session-accessor.sqlite-transcript-store.ts#L650-L702)
  provides the existing lookup mechanism. [Transcript deletion](https://github.com/openclaw/openclaw/blob/8c001ebde9333e0dfe4402e6b0cdc0778d16a079/src/config/sessions/session-accessor.sqlite-transcript-state.ts#L367-L382)
  deletes these identities with their events. A missing receipt cannot establish
  that the old request never ran.

The first delivery target is the Control UI. Any additional supported channel must
use the same terminal fact and a qualified notice-delivery path. A failed external
notice delivery cannot reopen computation or cause repeated messages.

#### Keep allocation cleanup with its original owner

Record `retirementPolicy: 'foreground-owner'` in the existing
`sandbox_registry_entries.entry_json` payload for an allocation owned by a
restricted foreground turn. This is a typed payload addition, not a new table,
column, schema version, or sidecar. It grants no resumable guest authority.

The session marker prevents recovery of the accepted turn. The allocation marker
keeps cleanup with its original foreground owner. A terminal session outcome does
not establish that the allocation's processes stopped.

Generic cleanup must retain marked allocations and rows with unknown retirement
policy or ownership. Cleanup may remove only the exact allocation after its
original owner confirms whole-process shutdown, including owned descendants.
Cleanup must not remove another allocation that later reuses the same session.
It must preserve conversation history and unrelated workspace data.

A lost owner or shutdown receipt, a failed stop, or uncertain process state leaves
the allocation and its registry row retained. Report unresolved cleanup and block
unsafe resource reuse. Do not resume guest work to reconstruct cleanup authority.
Engine-specific containment and shutdown remain implementation qualification
requirements, not guarantees established by this RFC.

### 5. Qualify rollout and rollback

Before enabling this posture, stop new guest admission and inventory outstanding
guest work. Finish or explicitly stop identified legacy guest work through its
owner. Preserve history, files, and effects that already happened. Unknown legacy
origin must not become a guest, staff, or system identity by inference. If that
uncertainty can affect recovery, block activation until the operator resolves it.

The session and allocation markers are not old-binary safety barriers. An older
build can ignore both while using the same SQLite schema. Name and test compatible
restart and rollback builds before admission. Before an incompatible downgrade,
quiesce guest admission and reconcile outstanding work and allocations under
compatible code. Original owners must confirm shutdown before allocation removal.
Retain unresolved allocations and block a downgrade that could ignore their
cleanup restriction. Schema compatibility alone does not make rollback safe.
Disabling the visitor plugin alone does not stop old recovery or cleanup paths
from ignoring these markers.

If the supported rollout cannot meet this requirement without a reader-version
barrier, return to RFC review. Do not hide a schema bump inside implementation or
claim compatibility that the existing store cannot enforce.

Stopping application dispatch also does not prove that every old process stopped.
Before a fresh request can reuse writable resources, the execution owner must
establish that the predecessor cannot still write them. Show unresolved cleanup
and keep execution blocked when that proof is missing. Retain the conversation.

### 6. Required implementation proof

| Scenario | Required observation |
| --- | --- |
| Restart during guest generation or a tool call | No recovery model/tool dispatch. One persistent notice and terminal outcome. |
| Hard crash before or after admission commit | No accepted execution without the marker. No false claim about an unproven interruption cause. |
| Crash between terminal settlement and notice handling | Atomic terminal state, notice, and cancellation or removal of exact resumable pending custody. Repeated startup creates no duplicate notice. |
| Promotion, revocation, or reinvitation before restart | Original guest work stays nonresumable. A fresh request uses current permissions. |
| Shared thread with later staff work | Old recovery cannot stop the new run. Staff admission retains its ordinary behavior. |
| Tab disconnect and reconnect without restart | The same bounded live turn remains observable without duplicate execution. |
| Old request retry, stale browser queue, or late approval with a retained receipt | Return the recorded terminal result without dispatch or implicit conversion into a fresh request. |
| Eviction from the 64-ID list with the exact scoped notice retained | Same-ID admission still recognizes the stopped run and does not dispatch. |
| Receipt lookup unavailable | Report unavailable. Do not treat lookup failure as receipt absence. |
| Explicit deletion of all relevant receipts | No indefinite deduplication claim. An attempted UI send remains unconfirmed for manual review, without passive replay. |
| New request after interruption | A new ID and current authorization can start a new run in the same conversation, subject to resource-stop checks. |
| Alternate tool, RPC, HTTP, hook, or Code Mode producer | Durable work fails before registration or dispatch, with a visible reason. |
| Unknown external effect or surviving process | No blind effect replay or overlapping writer. Uncertainty is visible. |
| Generic cleanup encounters a marked allocation or unknown policy or ownership | Retain the allocation and registry row. Do not infer cleanup authority from age or a terminal session outcome. |
| Original owner confirms whole-process shutdown | Remove only the exact original allocation. Preserve unrelated allocations, workspace data, and conversation history. |
| Owner or shutdown receipt is lost, or shutdown is uncertain | Retain the allocation and row, report unresolved cleanup, and block unsafe reuse without resuming guest work. |
| Compatible restart and supported rollback | History survives and interrupted guest work does not resume. |
| Downgrade to a build that ignores either marker | Quiesce and reconcile under compatible code first. Unresolved execution or cleanup custody blocks an unsafe downgrade. |

Use an authenticated Gateway and the real lifecycle/storage path for these proofs.
Mocks alone cannot establish restart, process containment, or rollback behavior.
This RFC changes documentation only. It does not claim these tests or a deployment
are complete.

## Rationale

Foreground-only guest work trades restart continuity and autonomous jobs for a
smaller authority model. Users retain useful history and can explicitly start a
new request. We avoid serializing a reusable guest execution grant or designing a
general guest job-recovery service in this first stage.

Purely in-memory classification is insufficient after a crash. Checking the user's
current role can widen old work after promotion. A dedicated guest agent can help
separate capabilities, but does not inherently stop its ordinary chat recovery.
It also applies its restrictions to staff who use that agent. An exact admission
marker makes the policy belong to the accepted turn.

A new schema version can fence incompatible readers, but affects more than guest
execution. It is unnecessary for the proposed data shape. The cost is an explicit,
qualified rollout and rollback boundary rather than a universal downgrade promise.

The related drafts for [service-owned work authority](https://github.com/openclaw/rfcs/pull/70)
and [persistent Agent lifecycle](https://github.com/openclaw/rfcs/pull/71) address
broader durable execution. This proposal shares their separation of history,
authority, and physical termination. It does not require their Enterprise service
architecture or supersede their work. Future durable guest execution needs its
own accepted authority and recovery design.

## Unresolved questions

- Which existing foreground tools can prove complete containment and stop
  ownership for the first supported runtime?
- What finite turn and approval-wait limits should the visitor posture select
  from existing controls?
- Which exact builds and legacy-work dispositions qualify the first rollout and
  rollback path?
- Which additional channels should receive the notice after the Control UI path
  passes its end-to-end proof?

The proposal remains draft pending maintainer discussion and acceptance. The
implementation issue stays blank until acceptance.
