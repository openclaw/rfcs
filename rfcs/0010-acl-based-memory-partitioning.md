---
title: ACL-Based Memory Partitioning and Cross-User Access
authors:
  - Galin Iliev
created: 2026-07-06
last_updated: 2026-07-06
status: draft
issue:
rfc_pr:
---

# Proposal: ACL-Based Memory Partitioning and Cross-User Access

## Summary

Introduce ACL-enforced memory partitioning in OpenClaw where memory items are
scoped to the **session** that produced them — user-scoped for verified DM
sessions, channel-scoped for group sessions. When the upstream identity
provider is an enterprise directory (Entra ID, Okta, Google Workspace, Teams),
the tenant ID and user ID from that directory become the canonical ACL
principals. This enables per-user memory isolation and channel-scoped access,
with deliberate sharing via tenant-shared placement and per-item projections.
A direct cross-user grant mechanism is sketched but deferred (Appendix A);
cross-instance federation is out of scope (see Non-Goals).

**Isolation strength, stated up front:** Phase 0 provides retrieval- and
tool-layer isolation. Deployments with untrusted channel members and `exec`
enabled require the out-of-process broker tier before claiming adversarial
isolation — see §2.1 and risk 1 in the Security Posture section.

## Motivation

Today, OpenClaw's memory system indexes content into per-agent SQLite databases
without fine-grained access control tied to the *source identity* of
contributions. In multi-user and multi-channel deployments — particularly
enterprise environments with Teams, Slack, or Discord channels — several
problems arise:

1. **No user-level isolation.** Memory learned from user A's messages is
   retrievable by user B if they share the same agent, even when the content is
   personal or sensitive.

2. **No channel-scoped boundaries.** Facts observed in a private channel can
   surface in a different channel's context without the contributor's awareness.

3. **Enterprise identity is ignored.** Organizations already have authoritative
   identity (Entra ID tenant + object ID, Okta org + user ID) but the memory
   layer does not use these as access principals.

4. **Cross-user sharing is absent.** Two users of the same OpenClaw instance
   (e.g., colleagues in the same tenant) have no controlled way to share a
   slice of memory — it is either fully shared (same agent, no isolation) or
   requires copying content out of band. There is no explicit, auditable,
   revocable grant mechanism between users.

These gaps prevent enterprise adoption and violate the principle that data
should flow only along paths the contributing user's identity authorizes.

## Goals

1. **Session-scoped partitioning.** Every memory item records the scope of the
   session that produced it: the canonical user for verified DM sessions, the
   channel for group sessions. That scope is the primary ACL principal
   controlling read access.

2. **Channel-as-scope.** Memory observed in a channel is readable only within
   that channel's context by live members, unless explicitly declassified.

3. **Enterprise IdP integration.** When an identity provider (Entra ID, Okta,
   Google Workspace) is connected, use its `tenant_id` / `user_id` pair as the
   canonical principal. Channel identities (Teams user ID, Slack member ID) bind
   to these canonical principals through a verified pairing flow.

4. **Deny-by-default cross-user boundaries, with deliberate sharing paths.**
   No user's sessions can read another user's memory. Sharing across users
   happens by deliberate placement: tenant-`shared/` or a per-item
   projection (§1.2). A direct user-to-user grant mechanism is deferred
   (§4, Appendix A).

5. **Deny-by-default evaluation.** A memory item is invisible unless an explicit
   allow rule matches the requesting principal set and no deny rule matches.

## Non-Goals

1. **Preventing semantic laundering through the context window.** Once a memory
   item is loaded into a model's context for an authorized request, the model
   may reason over it, rephrase it, and produce outputs influenced by it. This
   is inherent to how transformer inference works — there is no token-level
   provenance inside the context window. A model can rephrase "Alice prefers
   morning meetings" as original text, and to the broker a subsequent write of
   that rephrased content looks indistinguishable from something the current
   user said directly.

   **What the broker CAN enforce (structural boundaries):**
   - Directory-level write isolation: a session running under user B's scope
     never mounts user A's subtree; the only path into it is the write-only
     postbox (§1.2). Subject to the file-view enforcement limits in §2.1.
   - Explicit derivation gating: the `derive` API accepts parent item IDs and
     checks `derive` permission on each parent. Calling `derive(parents=[A's item])`
     under B's principal is denied.
   - Cross-principal write blocking: the broker rejects `remember` calls that
     specify an `owner_user_id` different from the resolved requesting principal.

   **What the broker CANNOT enforce (semantic boundary):**
   - Content rephrased by the model and written as a "new" observation under the
     current user's principal. The broker sees a fresh write with no declared
     lineage — it cannot prove the content originated from another user's memory.
   - Indirect influence: the model's behavior is shaped by everything in context.
     A response to user B may reflect patterns learned from A's memory in the
     same context window.

   **Mitigations (detect, not prevent):**
   - Exposure-correlated write anomaly detection: flag elevated write volume
     immediately following cross-user memory exposure.
   - Semantic similarity checks: compare new writes against recently-exposed
     cross-user items; flag high-similarity writes for review.
   - Rate limiting on writes after cross-principal reads.
   - Audit trail: the `exposure_audit` table records what was exposed, enabling
     post-hoc forensic queries ("did any writes by user B suspiciously correlate
     with items exposed from user A?").

   This is the "you can't un-read information" problem — the same reason DLP
   systems cannot prevent a human from reading a document and typing a summary
   into a different system. The enforceable boundary is structural (file
   isolation, derivation API gating). Beyond that, operational controls provide
   detection and deterrence, not prevention.

2. **Content-level DLP or classification.** This RFC does not introduce
   sensitivity classification of content beyond what the source identity and
   channel scope imply. Content-aware DLP (PII detection, regulatory labeling)
   is a future concern layered on top — and is the natural place to add
   semantic similarity checks against the exposure log.

3. **Sync protocol.** Cloud reconciliation and multi-device sync are covered by
   the broader Memory Broker design and are not in scope here.

4. **Model-side enforcement.** Preventing the model from surfacing memorized
   content from its weights (training data) is out of scope. This RFC concerns
   only the retrieval-augmented memory store.

5. **Plugin state.** Plugin KV storage (`plugin_state_entries`) is a separate
   system with its own isolation model and is not affected by this proposal.

6. **Cross-instance federation.** Everything in this RFC operates within a
   **single OpenClaw instance** — one broker, one host, one set of identity
   bindings; the deferred grant sketch (Appendix A) is same-instance too.
   Sharing memory between *different instances* (different hosts or
   different tenants) requires transport authentication, offline-verifiable
   capabilities, revocation propagation, and audit exchange — a federation
   protocol that deserves its own RFC. The evaluation semantics here are
   deliberately shaped so a capability-token federation layer can be added
   later without changing them.

## Proposal

### What Accepting This RFC Means (Normative Core vs. Follow-Ups)

This proposal covers a lot of surface. To keep the acceptance decision
tractable, it is split explicitly: accepting this RFC accepts the **normative
core** below — the invariants every deployment gets — and nothing more. The
follow-up column is design direction, individually revisitable without
reopening the core.

| Normative core (this RFC) | Follow-ups / non-normative |
|---|---|
| Session-scoped attribution and the mount model (§1.1–§1.2) | Cross-user grants (§4, Appendix A — sketch only) |
| Postbox mechanism + trust tiering, deployment-controlled enablement (§1.3) | Cross-instance federation (Non-Goals §6 — future RFC) |
| Scoped subtree partitioning; SQLite as index + policy catalog (§2) | Out-of-process broker / sandboxed agents (broker design §12 Option B — required for adversarial isolation; designed separately) |
| Session file-view enforcement and its stated limits (§2.1) | Enterprise plugin internals (P1–P6 — evolve with the plugin) |
| Permission lattice + evaluation order (§3) | Anomaly detection tuning (advisory-only signal) |
| Identity binding framework + adapter registry hardening (§5, §5.1) | Sync/reconciliation semantics (broker design §10) |
| Retrieval flow (§6) and transcript/compaction scoping (§7) | Teams auto-binding policy (Unresolved Q5) |

Note that §7 (transcripts/compaction) is deliberately in the core: it closes
a laundering channel, and deferring it would leave the core invariants
bypassable. The postbox (§1.3) is core as a *mechanism* — whether a tenant
enables it is a deployment decision (`postbox.mode`, including `off`).

### 0. Architecture: Core vs. Plugin Split

The ACL memory system is split into a **core enforcement layer** and optional
**enterprise plugins**:

**Core** (`src/memory-acl/`) — always present, cannot be disabled:
- ACL evaluator (deny-by-default evaluation logic)
- Memory broker contract (the only surface agents use for memory access)
- Principal resolver framework (resolves identity → principal set)
- Directory-level memory isolation (scoped subtree layout + session mounts)
- Prefilter SQL builder (CTE generation for candidate queries)
- Lineage walker (derived-item ancestry check)
- Exposure auditor (records what entered prompts)
- Channel membership state (scope-narrowing enforcement)
- Local identity adapter (`local:{instance}:{user}` for single-user installs)

**Enterprise plugin** (`extensions/memory-acl-enterprise/`) — optional:
- IdP adapters (Entra ID, Okta, Google Workspace OAuth flows)
- Anomaly detection (write-after-exposure semantic similarity)
- IdP group → principal mapping and refresh
- *Deferred with the grant design (Appendix A):* cross-user grant management
  tools and grant admin CLI commands — no grant surface ships with this RFC

**Rationale:** Security boundaries must not be optional. A plugin can be
disabled, uninstalled, or fail to load — if the ACL evaluator lived in a
plugin, raw memory access would be the fallback state. Core enforcement means
every memory read/write passes through the broker regardless of which plugins
are installed. The enterprise plugin adds *richer identity sources* and
*operational tooling*, not the enforcement itself.

**The dividing test:** core owns anything whose absence would change an
allow/deny decision — the broker entry point, session-scope resolution,
the evaluator, mount/file-view rules, audit hooks, and deny-by-default
behavior. Plugins own anything whose absence only removes an identity source
or an operational convenience — IdP adapters, group sync, admin UX, anomaly
detection, and (when they land) grant tools. If disabling a component could
widen access, it was never plugin material.

For single-user local installs, the core resolves a single
`local:{instance}:{user}` principal that owns everything. No configuration
required, no performance overhead beyond the (trivially fast) evaluator
confirming owner === requester.

This mirrors existing OpenClaw architecture: channels are core
(`src/channels/`) while channel implementations are plugins
(`extensions/telegram/`, `extensions/discord/`). The plugin SDK is core
(`src/plugin-sdk/`) while plugins are extensions.

### 1. Identity Model

Sender identity is derived from the channel transport's verified assertion,
resolved through the identity binding table to a canonical user:

```
Channel transport assertion (e.g., Teams webhook signature)
  → channel_user_id (transport-specific, e.g., Teams AAD object ID)
  → channel_identity binding (verified via OAuth/pairing)
  → canonical user_id (enterprise IdP: {provider}:{tenant_id}:{user_id})
```

Supported identity providers and their canonical principal format:

| Provider | Principal format | Source of truth |
|----------|-----------------|-----------------|
| Entra ID / Teams | `entra:{tenant_id}:{object_id}` | Azure AD token claims |
| Okta | `okta:{org_id}:{user_id}` | Okta session / token |
| Google Workspace | `google:{domain}:{user_id}` | Google OAuth subject |
| Local / self-hosted | `local:{instance_id}:{user_id}` | Local pairing code |

The `channel_identity` table binds transport-asserted sender IDs to these
canonical principals. A Teams user ID, Slack member ID, or Discord snowflake is
never used directly as an ACL principal — it is always resolved to the canonical
form first.

### 1.1 Session-Scoped Attribution

ACL principals are resolved at **session granularity, not per tool call**.
OpenClaw already routes every inbound message to a session whose scope is
fixed at routing time by the gateway (group chats are isolated per channel;
DMs are isolated per peer with `session.dmScope: per-channel-peer`). The
gateway stamps the session with its scope at creation, and every memory read
and write inside that session inherits it:

| Session kind | Scope | ACL principal for reads/writes |
|---|---|---|
| DM with a verified identity binding | `user` | `user:{canonical_user_id}` |
| Group channel | `channel` | `channel:{channel_id}` |
| Cron / webhook / autonomous run | `agent` | `agent:{agent_id}` |

A mid-run steering message from another member does **not** change the
session principal — "who is the requesting user" is a property of the
session, not of the last message received. Per-message sender identity is
still resolved through the binding table and retained for auditing and for
postbox targeting (§1.2), but it is never the retrieval principal in a group
session.

**Rationale.** In a shared session the context window is already shared: a
run triggered by Alice and steered by Bob has no single "requesting user."
Attributing individual tool calls to one of them is a fiction that produces
both leaks (Bob reading under Alice's principal because Alice triggered the
run) and breakage (mid-run denials when the sender changes). Attributing at
the session level aligns the ACL boundary with the real information
boundary: the session transcript.

**Autonomous scopes.** Cron runs, webhooks, and sub-agents carry no user
principal at all. They resolve to `agent:{agent_id}` with access to
tenant-shared and agent-owned items only. Deny-by-default applies:
user-scoped items are invisible to autonomous sessions unless an explicit
grant exists.

**DM session scope is a precondition, not an assumption.** OpenClaw's
default `session.dmScope: main` shares one DM session across all users —
such a session has no coherent single user and MUST NOT mount a personal
store. Multi-user deployments MUST set `session.dmScope` to
`per-channel-peer` (or stricter); the broker refuses to mount user scopes
for shared-DM sessions regardless of configuration, and `openclaw doctor`
flags multi-user installs that have not set an isolating `dmScope`.

### 1.2 Multiplayer with Privacy: the Mount Model

The privacy guarantee in group ("multiplayer") scenarios comes from
controlling **which stores a session mounts**, not from per-message ACL
juggling:

| Store | DM session (user A) | Group session (channel C) |
|---|---|---|
| A's personal store | read/write | **not mounted** (postbox writes only) |
| Channel C store | not mounted | read/write, live members' sessions only |
| Tenant-shared store | read | read |
| A's shareable projection | read/write (managed here) | read, while A is a live member |

Four mechanisms make "participate in a group without leaking personal
memory" concrete:

1. **Channel memory is the group default.** Everything the agent learns in
   channel C's session is written channel-scoped (`allow read channel:C`).
   It was said in front of the channel, so the channel may remember it.
   Members who leave lose access immediately (live-membership check at read
   time).

2. **Personal stores are never readable from group sessions.** "What do you
   know about @alice?" asked in a group resolves against channel memory
   only. A channel-scoped session never mounts another user's personal
   subtree — the files are outside its view and their index rows outside
   its scope; this is structural placement (§2), not a row filter.

3. **Personal postbox — a one-way write valve.** During a group session the
   agent may *file* an observation into a member's personal store
   (`remember` with `postbox: user:A`), provided A's sender identity was
   resolved in this session. The broker writes it as a markdown item file
   under `memory/users/{A}/postbox/` with channel provenance in its
   frontmatter, `allow read user:A` only, plus lineage back to its
   channel-scoped source. The group session cannot read it back — the
   postbox subtree is never in a group session's mounts.
   This lets the agent get smarter about Alice from group interactions
   (visible later in her DM sessions) without widening the group's access.
   Nothing confidential is lost at write time: the content originated in
   front of the channel. A hostile channel can at worst *pollute* a
   member's store, never read it; postbox items carry channel provenance so
   the owner can review and purge them.

4. **Shareable projection — opt-in, audited declassification.** A user may
   mark specific personal items as *shareable to channels I am in* (working
   hours, pronouns, dietary preferences). These items receive an additional
   allow entry scoped to the projection, and group sessions read them only
   while the user is a live member of that channel. This is an explicit,
   revocable, per-item grant recorded with `granted_by` — never a default,
   never inferred by the model.

The failure mode this prevents: user B in a shared channel pulling A's
inferred preferences merely by sharing a channel with her. B gets channel
memory plus whatever A deliberately projected — nothing else.

### 1.3 Postbox Trust Tiering

Hydration is where postbox risk concentrates: a hostile channel member can
steer the agent into filing crafted content into a member's store, and that
content later loads into the member's private DM context — where the agent
may hold broader tool permissions than it did in the channel. A postboxed
item is therefore a **distinct trust tier**, not ordinary personal memory:

1. **Low-trust by default.** A postboxed item hydrates only as a retrieval
   result, rendered with its provenance label (*"filed from #project-x,
   2026-07-06, unreviewed"*). It is never loaded into system-prompt-level /
   always-loaded memory (the `MEMORY.md` tier), and it is treated as data,
   never as an instruction source.

2. **Promotion is explicit.** The owner may promote an item into their
   curated personal memory — the file moves out of `postbox/` and only then
   gains the normal trust tier. Purging is one command
   (`openclaw memory postbox --purge --channel <id>`).

3. **Notification and rate limits.** The first postbox write from a channel
   the user has not previously received postbox items from triggers a
   notification. Per-channel rate limits (default: 20 items/day) bound
   flooding; writes over the limit are dropped and audited.

4. **Deployment-controlled enablement.** The postbox is a core *mechanism*
   with an explicit posture knob — `memoryAcl.postbox.mode`:

   | Mode | Behavior | Default for |
   |---|---|---|
   | `labeled` | Items retrievable with provenance labels (the tier rules above) | Single-user / local installs |
   | `review-required` | Items quarantined — excluded from retrieval — until the owner approves | Installs with an enterprise IdP configured |
   | `off` | No postbox writes at all; group sessions cannot touch personal stores in any direction | Available everywhere; recommended until a tenant has validated the notification/review UX |

   The enterprise default is deliberately the conservative one, consistent
   with the fail-closed posture elsewhere in this RFC; tenants opt *down* to
   `labeled`, not up from it. `openclaw doctor` reports the active mode in
   multi-user installs.

These limits ship with the postbox itself, not as a follow-up (see Resolved
Questions).

### 2. Memory Partitioning

**Memory stays markdown files.** OpenClaw's memory source of truth today is
markdown in the agent workspace (`MEMORY.md`, `memory/*.md`), indexed into
SQLite for FTS and vector search. This RFC keeps that model — users can still
read, hand-edit, and git-sync their memory — and makes the **directory tree
the partition primitive**:

```
{workspace}/memory/
  users/{canonical_user_id}/     # personal store; mounted rw only in that
    ...                          #   user's DM sessions
    postbox/                     # machine-filed items from group sessions
  channels/{channel_id}/         # channel store; mounted rw only in that
                                 #   channel's group sessions
  shared/                        # tenant-shared; read-only everywhere
  projections/{user_id}/         # user-curated shareable items; read-only in
                                 #   channels the user is a live member of
```

Partitioning operates at three levels:

**Directory-level isolation (structural boundary):** a session's memory view
is the union of the subtrees its scope mounts (§1.2). The group session for
channel C indexes and retrieves from `channels/{C}/`, `shared/`, and live
members' `projections/` — every other subtree is outside its view entirely:
never indexed into its candidate set, not resolvable via `memory_get`, not
part of any retrieval code path. Isolation comes from placement, not from a
per-item policy decision. Cross-user access has no exception path in this
RFC (§4; a grant mechanism is deferred to Appendix A).

**Index-level scope (SQLite):** the existing memory index gains a `scope`
column derived from the file path at indexing time. The broker's prefilter
and postfilter evaluate scope and ACL against the session's principal set.
The SQLite layer is an **index plus policy catalog** — scope, ACL entries,
lineage, exposure audit, grants — never the content store. Content lives in
the files; the index holds pointers, hashes, and search structures (see the
broker design §3).

**Row-level ACL (fine grain, only where placement is insufficient):**
per-item ACL entries apply to items in `shared/`, projection items, postboxed
items, and declassified derived items. The common cases — personal and
channel memory — are handled entirely by directory placement, so most items
never need an ACL row at all.

### 2.1 Session File-View Enforcement (and its limits)

Path partitioning is only as strong as the session's file and exec
confinement. This RFC therefore requires:

- `memory_search` and `memory_get` resolve paths strictly inside the
  session's mounted subtrees, using the same symlink-safe containment checks
  the memory file reader performs today
  (`packages/memory-host-sdk/src/host/read-file.ts`).
- File tools (`read`/`write`/`edit`/`apply_patch`) treat unmounted memory
  subtrees as outside the workspace for path-validation purposes — a group
  session's file tools cannot open `memory/users/*` any more than they can
  open a path outside the workspace root.
- For multi-user deployments with `exec` enabled, the exec root (or sandbox
  profile) must exclude unmounted memory subtrees. `openclaw doctor` warns
  when a multi-user configuration leaves exec unconfined over the memory
  tree.

**Honest threat model.** With an in-process runtime and an unsandboxed exec
tool, this boundary holds against retrieval-path bugs, prompt-level probing,
and ordinary model behavior — not against a deliberately prompt-injected
`exec` reading arbitrary paths. That is consistent with OpenClaw's existing
security posture ("session or memory scoping reduces context bleed, but does
not create per-user host authorization boundaries" — SECURITY.md). Deployments
that need an adversarial boundary against exec-enabled agents must run the
out-of-process broker with sandboxed agent processes described in the broker
design (§8, §12) — that is the hardening tier, not the Phase 0 baseline.
This RFC makes the boundary's strength explicit instead of implying a
guarantee the deployment mode cannot deliver.

### 3. ACL Evaluation

#### 3.1 Permission lattice

Permissions form an explicit implication chain for allows:

```
admin ⇒ derive ⇒ read ⇒ retrieve        (sync is independent; admin ⇒ sync)
```

An allow entry for a stronger permission satisfies requests for the
permissions it implies. Each requested permission has a **required set** that
must be fully satisfied:

| Requested perm | Required set |
|---|---|
| `retrieve` | `{retrieve}` |
| `read` | `{retrieve, read}` |
| `derive` | `{retrieve, read, derive}` |
| `sync` | `{sync}` |
| `admin` | `{admin}` |

A request for permission P is **denied** if any deny entry matches any member
of required(P); it is **allowed** only if every member of required(P) is
satisfied — either by **placement** (the item's scope is the session's own
scope, §2: the common case, which carries no ACL rows) or by some allow
entry (directly or via implication). Deny entries are always honored even on
placement-allowed items. Consequences:
`deny retrieve` blocks all content flow for that principal; `deny read`
still permits candidate citation (retrieve) but never content exposure. The
prefilter evaluates required(`retrieve`); the postfilter evaluates
required(`read`) before content enters a prompt — the two stages check
different rungs of the same lattice, by design.

This lattice is **normative** — the broker design doc, the prefilter SQL, and
the evaluator implementation must all derive from this table, and the
property-test suite asserts the recall invariant against it: **the prefilter
never excludes an item the evaluator would allow** (prefilter results ⊇
evaluator-allowed). The prefilter is a deliberate over-approximation — it may
pass items the postfilter then denies (that mismatch is the audited drift
signal); the postfilter is the security boundary, so prefilter looseness is a
performance question, never a disclosure.

#### 3.2 Evaluation order

This order is normative and shared verbatim with the broker design and the
implementation plan (a single evaluator implements it; divergence between
documents is a spec bug):

0. **Session scope & identity** — the session envelope is stamped at routing
   time by the gateway. For user-scoped (DM) sessions,
   `(channel_id, channel_user_id)` must resolve to a verified, unrevoked
   binding; no binding = no user principal, denied before any subtree or
   index is mounted (`deny-identity`). For group sessions the principal is
   the channel; the sender binding is used for membership and postbox
   targeting only.

1. **Hard partition** — `item.tenant_id == ctx.tenant_id`; the item's file
   lives in a subtree (and index partition) the session mounts;
   `deleted_at IS NULL`; `expires_at` not passed (`deny-partition`).

2. **Sensitivity ceiling** — `item.sensitivity > ctx.sensitivityCeiling` →
   `deny-scope`. Sensitivity is assigned only by trusted producers: runtime
   configuration defaults (per channel/agent), explicit values from admin
   surfaces, and `max()` over parents on derivation — never from model text.

3. **Explicit deny wins** — any `deny` entry matching any principal in the
   resolved set, for any member of required(P), blocks access
   (`deny-explicit`). No override possible.

4. **Allow required** — every member of required(P) must be satisfied,
   either by placement (item's scope == the session's own scope; no ACL
   rows needed) or by a matching, unexpired `allow`. Otherwise default deny
   (`deny-default`).

5. **Channel scope narrowing** — channel-scoped items require
   `ctx.channel_id == item.channel_id` AND live membership in that channel
   (`deny-scope` / `deny-membership`). A user-level grant alone does not make
   channel-scoped items visible in other channels.

6. **Lineage re-check** — derived items walk their ancestor graph; any
   tombstoned or ACL-failing ancestor denies (`deny-lineage`). Stale
   embedding candidates (embedded rev ≠ current rev) are dropped from vector
   results (`deny-stale`).

#### 3.3 Structural write-back controls

The broker enforces what is structurally enforceable:
   - The `derive` API requires parent item IDs; `derive` permission is checked
     on each parent against the requesting principal. Explicit re-attribution
     through the derivation path is blocked.
   - `remember` calls cannot specify an owner other than the session's
     resolved scope (the broker ignores/rejects mismatched owner fields).
     The only exception is the postbox path (§1.2), which *narrows* the
     audience to a single member's personal scope — it can never widen it.
   - Directory-level isolation prevents reads of another user's subtree
     entirely; postbox writes go through the broker's write path, which
     files the item into the target's postbox directory — a session never
     holds a direct write handle into a foreign subtree.

   These controls prevent *structured* re-attribution but cannot prevent
   *semantic* laundering (model rephrases content as a "new" observation).
   Operational mitigations (write-after-exposure anomaly detection, semantic
   similarity flagging) supplement the structural boundary. See Non-Goals §1
   for the full enforcement analysis.

### 4. Cross-User Access (Deferred)

Cross-user access is **deny-by-default, and this RFC ships no exception
path**: there is no mechanism by which one user's sessions read another
user's memory. The mount model never opens another user's subtree, and the
supported ways to share across users are deliberate placement — `shared/`
(tenant-wide) or a per-item projection (§1.2).

A direct grant mechanism (Alice hands Bob time-bounded, revocable, audited
read access to a slice of her memory — e.g., a project handover) is a real
need, but it drags in its own UX and policy questions: how a user issues,
reviews, and reasons about grants; delegation; admin override; revocation
residuals. Rather than bolt a thin version onto this proposal, the grant
design is **deferred**. A worked sketch is preserved in Appendix A so the
schema and evaluation semantics stay forward-compatible with it; nothing in
Appendix A is normative until it graduates into a proposal section.

Cross-instance federation remains out of scope entirely (Non-Goals §6).

### 5. Enterprise IdP Integration

When an enterprise identity provider is configured:

```json
{
  "identity": {
    "provider": "entra",
    "tenantId": "contoso.onmicrosoft.com",
    "clientId": "...",
    "discovery": "https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration"
  }
}
```

The pairing flow uses the IdP's OAuth token to verify the user's identity and
create the `channel_identity` binding:

1. User initiates pairing via channel command (`/pair`) or web flow.
2. OpenClaw redirects to IdP OAuth consent.
3. On callback, extracts `tid` (tenant) + `oid` (user object ID) from the
   ID token.
4. Writes `channel_identity` row: `(channel_id, channel_user_id) → entra:{tid}:{oid}`.
5. Subsequent messages from that `channel_user_id` resolve to the canonical
   principal automatically.

For Teams specifically, the bot framework already provides the AAD object ID in
the activity envelope — the binding can be established on first interaction
without an explicit pairing step, since the transport itself is the IdP.

### 5.1 Adapter Registry Hardening

Identity resolution is the most security-critical input to the ACL system,
and the enterprise plugin supplies it. An unguarded registry would let a
malicious or compromised plugin register an adapter that resolves any sender
to any principal — which core would then faithfully enforce. Three rules
close this:

1. **Core verifies; adapters only fetch.** Adapters never return principal
   strings. The adapter contract returns raw verification material — the
   token as received plus the provider's pinned discovery/JWKS metadata —
   and **core** validates signature, issuer, audience, and expiry, then
   constructs the canonical principal (`entra:{tid}:{oid}`, …) from the
   verified claims itself. A lying adapter can deny service; it cannot forge
   identity. Group refresh results are namespaced per provider
   (`group:{provider}:{tenant}:{gid}`) and constructed by core, so an
   adapter can only influence group principals under its own allowlisted
   prefix.

2. **Provider allowlist in operator config.** A plugin may serve a provider
   prefix only if operator-owned configuration names it explicitly
   (`memoryAcl.identity.providers: { "entra": "memory-acl-enterprise" }`).
   Unlisted registrations are refused, duplicate registrations for a prefix
   are refused, and every registration — accepted or refused — is
   audit-logged.

3. **Registration is startup-only.** Adapters register during plugin
   initialization from manifest-declared capabilities, and the registry is
   sealed before the first session is routed. There is no runtime swap of
   identity resolution.

### 6. Retrieval Flow Integration

The retrieval pipeline from the Memory Broker design gains ACL enforcement:

```
Agent request (query + session envelope, stamped at routing time)
  → Resolve PolicyContext (session scope → principal set; DM: verified binding)
  → Resolve session mounts (subtrees + index scopes per §1.2/§2)
  → FTS5 + Vector candidates (prefiltered by ACL CTE, required(retrieve))
  → Postfilter: per-item ACL re-eval (required(read)) + lineage check
    + channel membership
  → Write-back check: tag exposed items for derivation prohibition tracking
  → Trim to token budget
  → Audit exposure (item, rev, principal)
  → Return context block
```

### 7. Session Transcripts and Compaction

The memory store is not the only durable representation of a conversation.
Session transcripts are persisted and reloaded across turns, and compaction
(summarizing a long session to fit the context window) produces derived
artifacts. Without rules here, a compaction summary of a multi-user session
would be a derived memory with no lineage, no ACL, and no broker
involvement — channel memory that skipped every control in this RFC.

1. **Transcripts carry the session's scope.** A session's transcript is
   state of that session's scope: a group transcript is channel-scoped, a
   DM transcript user-scoped. Transcript files on disk live under the same
   scoped layout and fall under the same session file-view enforcement
   (§2.1) as memory subtrees — a group session's transcript is not readable
   from another user's DM session, and a user's DM transcript is never
   readable from a group session.

2. **Compaction artifacts are derived memories.** A compaction summary MUST
   be written through the broker as a `derive` operation whose source is
   the transcript segment it summarizes: it inherits the session's scope
   (channel-scoped for group sessions), records lineage back to that
   segment, and is subject to normal retrieval evaluation thereafter.
   Compaction never persists an unscoped artifact, and no code path outside
   the broker writes summaries to disk.

3. **In-session sharing is by construction, not a leak.** Within a live
   group session, all members see the shared context — that is what a group
   conversation is, and no memory ACL changes it. The rules above govern
   *persistence and reuse*: what the transcript becomes once it outlives
   the session.

4. **Revocation residuals are enumerable, and scrubbing is implementable.**
   When an access path is withdrawn — a member leaves a channel, a
   projection is revoked, or (once the deferred grant design of Appendix A
   lands) a grant is revoked — content already exposed persists in the
   affected sessions' transcripts. The exposure audit records exactly which
   item revisions entered which sessions, so a revocation-triggered scrub —
   redacting those items' content from retained transcripts of affected
   sessions — is a well-defined operational job. This RFC requires the
   audit linkage that makes the scrub possible and defines the scrub as an
   optional operational tool, not a retroactive guarantee.

## Rationale

**Why core enforcement rather than a plugin?**
A plugin can be disabled, uninstalled, or fail to load. If the ACL layer were a
plugin, the failure mode would be "all memory accessible without authorization"
— the worst possible default. Core enforcement means the broker is the *only*
path to memory, always. Enterprise features (IdP adapters, grant UX, anomaly
detection) are deployment-specific and belong in a plugin that registers into
the core framework, not replaces it.

**Why session-scoped partitioning over tag-based classification?**
Tag-based systems require every write path to correctly classify content. A
forgotten tag or misconfigured default silently over-shares. Session-scoped
partitioning is structural — the scope is inherent in where the conversation
happened (which session, fixed at routing time by the gateway), not in a
policy decision that must be made per-item, and not in a per-tool-call guess
about which participant is "the" requester. Tags can layer on top for finer
control, but the base isolation must be scope-driven.

**Why directory-level isolation for users?**
A WHERE clause bug, SQL injection, or ORM misconfiguration in a
single-store-with-row-filters model exposes all users. Separate subtrees with
per-scope index partitions mean a bug in ACL evaluation cannot cross a user
boundary — the unmounted subtree's files are never read and its index rows
are never in the queried partition. This is the same rationale as process
isolation vs. thread isolation, applied to the store OpenClaw actually has:
markdown files plus a derived index.

**Why enterprise IdP principals rather than channel-native IDs?**
Channel-native IDs (Discord snowflakes, Slack member IDs) are platform-specific
and can't federate. Enterprise IdPs provide stable, cross-platform identity that
HR already manages. When Alice leaves the company, disabling her Entra account
revokes all her memory grants without touching each channel individually.

**Why prohibit write-back rather than attempting to track downstream usage?**
Once content enters a model's context, tracking what the model "does" with it
is intractable. The enforceable boundary is the broker's write path: the broker
knows who is writing and can check lineage. Attempting to restrict in-context
reasoning would require model-level enforcement that doesn't exist reliably.

## Resolved Questions

1. **Offline/degraded IdP behavior: fail closed, with a bounded cache.**
   Deny-by-default must hold under degraded conditions, so fail-open is not an
   acceptable default. When the IdP is unreachable, the broker operates from
   the last-known group/binding snapshot **only within a bounded staleness
   window** (default 24 hours). Within the window, cached group principals are
   honored and every use is audited with a `stale` flag. Beyond the window,
   group-derived principals are dropped from the resolved set — `user:` and
   `tenant:` principals (anchored by the locally stored, verified binding)
   are retained, so personal memory keeps working while group-gated access
   tightens. Deployments may shorten the window or opt into strict
   fail-closed (drop group principals immediately). Loosening beyond the
   bounded default is **break-glass, not configuration**: the value is named
   `fail-open-unsafe`, it is never a peer of the defaults, and `openclaw
   doctor` reports it as a security finding (a standing deny-by-default
   violation), not a notice.

2. **Postbox abuse limits: ship with the postbox, as a trust tier.**
   Resolved in §1.3 — postboxed items are low-trust by default
   (provenance-labeled retrieval only, never system-prompt-level memory),
   promotion is explicit, first-contact notification and per-channel rate
   limits (default 20/day) are built in, and `postbox.mode` controls the
   posture: `labeled` (single-user default), `review-required` (default when
   an enterprise IdP is configured), or `off` (postbox disabled entirely).

## Unresolved Questions

1. **Group principal semantics.** Should Entra security groups / Okta groups
   map directly to ACL principals, or should OpenClaw maintain its own group
   abstraction? Direct mapping is simpler but couples tightly to IdP schema.

2. **Delegation depth for cross-user grants** *(applies to the deferred
   grant design, Appendix A)*. Can a grantee re-grant to a third user?
   Sketch position: no — grants are non-transferable; a new grant from the
   original owner is required.

3. **Tenant admin override scope** *(applies to the deferred grant design,
   Appendix A)*. Should a tenant admin be able to grant cross-user access to
   any user's memory, or only tenant-shared items? This has significant
   privacy implications for personal workspace content.

4. **Channel membership freshness.** How frequently should the broker refresh
   channel membership state from the transport? Real-time (webhook-driven) vs.
   periodic polling vs. on-demand check at retrieval time. Each has different
   latency/cost/consistency trade-offs.

5. **Teams auto-binding policy.** §5.1's core-side token verification means a
   bare envelope object ID can no longer bind an identity, but the policy
   question remains: should first-interaction binding (from a verified Bot
   Framework token) be per-tenant opt-in, and should step-up pairing be
   required before an auto-bound identity can issue cross-user grants?
   (See risk 4 in the Security Posture section.)

## Implementation

[Implementation plan](0010/implementation-plan.md) — component breakdown,
dependency graph, phase mapping, and integration points with existing OpenClaw
code.

## Security Posture & Risk Assessment

This section records the honest security posture of the proposal as written:
what the design enforces, what it deliberately does not, and the residual
risks ranked by severity. Reviewers should evaluate the RFC against this
assessment rather than against an implied stronger guarantee.

### What the design enforces

- **Layered boundaries in the right order.** Structural placement first
  (unmounted subtrees are never read; unmounted index partitions are never
  attached), then index-level scope, then per-item ACL, with the postfilter
  as the authoritative check — property-tested (the prefilter never excludes
  what the evaluator allows; results ⊇ evaluator-allowed) and monitored
  (postfilter-deny-after-prefilter-pass as a drift alarm).
- **Deny-by-default survives degradation.** Fail-closed group snapshots with
  a bounded staleness window; no identity binding → no user principal;
  autonomous sessions carry no user scope.
- **Attribution cannot be confused mid-run.** Session scope is stamped at
  routing time and immutable; steering by another member never switches the
  principal; a `user_id` field is unrepresentable in the envelope.
- **Cross-user flows only narrow.** The postbox narrows channel → one
  member; there is no cross-user read path at all in this RFC (grants
  deferred, Appendix A); derived items take the intersection of parent
  labels; declassification is explicit and audited.
- **Limits are stated in-text** (§2.1): in-process enforcement with an
  unsandboxed `exec` tool is policy hygiene, not an adversarial boundary.

### Residual risks (ranked)

| # | Risk | Severity | Status |
|---|------|----------|--------|
| 1 | **In-process exec ceiling.** All controls hold against retrieval-path bugs and ordinary model behavior; a deliberately prompt-injected `exec` can read unmounted subtrees. The adversarial boundary is the out-of-process broker + sandboxed agents (broker design §12 Option B), which is sketched, not designed. | High | Accepted for Phase 0; **Option B is a MUST for deployments with untrusted channel members**. Stated in §2.1. |
| 2 | **Session transcripts bypass the broker.** The group transcript is shared context, persisted and reloaded; compaction summaries of multi-user sessions would otherwise be derived memories with no lineage, ACL, or broker involvement. | High | **Addressed in §7.** Transcripts carry the session's scope under §2.1 file-view enforcement; compaction artifacts MUST be written through the broker as scoped `derive` operations with lineage; revocation scrub is enabled by audit linkage. |
| 3 | **Identity injection via the IdP adapter registry.** A malicious or compromised plugin that registers an adapter could resolve any sender to any principal, and core would faithfully enforce the forged identity. | High | **Addressed in §5.1.** Adapters return raw token + pinned JWKS material only; core verifies and constructs principals; operator-config provider allowlist; duplicate registrations refused; registry sealed at startup. |
| 4 | **Teams auto-binding.** Binding on first interaction makes the enterprise identity exactly as strong as the channel plugin's webhook validation; a forged activity envelope becomes a silent identity binding — the root credential for everything else. | Medium-High | **Open.** Should be per-tenant opt-in with an audit event; step-up pairing required before an auto-bound identity can issue grants. (§5.1's core-side token verification narrows this: the envelope's object ID alone is no longer sufficient to bind.) |
| 5 | **Postbox poisoning as persistent prompt injection.** A hostile channel member can steer the agent into postboxing crafted content into a member's store; it later hydrates into that user's private DM context, where the agent may hold broader tool permissions. | Medium-High | **Addressed in §1.3.** Postboxed items are a low-trust tier: provenance-labeled retrieval only, never system-prompt-level memory, never an instruction source; explicit promotion; first-contact notification + per-channel rate limits; `postbox.mode` posture knob — `review-required` quarantine is the enterprise-IdP default, and `off` disables the mechanism entirely. |
| 6 | **`dmScope` default undermines user-scoped sessions.** OpenClaw's default (`dmScope: main`) shares one session across all DM users; such a session has no coherent single user yet would be the one mounting a personal store. | Medium | **Addressed in §1.1.** The broker refuses to mount user scopes for shared-DM sessions unconditionally; multi-user deployments MUST set `per-channel-peer` or stricter; `openclaw doctor` flags violations. |
| 7 | **Index partitions are content-bearing at rest.** The catalog holds pointers, but `memory_fts` stores chunk text and embeddings are invertible — index files under `~/.openclaw/memory-acl/` contain recoverable content. | Low-Medium | Accepted under the OS-FDE baseline (§8 of the broker design); noted so the index directory is not treated as metadata-only. |
| 8 | **Membership freshness window** (Unresolved Q4): an ex-member can read channel memory until the membership snapshot refreshes. | Low-Medium | Open question; webhook-driven refresh narrows the window on Teams/Slack/Discord. |
| 9 | **Audit metadata sensitivity.** `memory_exposure_audit` records who saw what — itself sensitive; no access control on the audit surface is specified. Group snapshot "signing" has no specified key infrastructure. | Low | Open; to be specified with the admin/ops tooling. |
| 10 | **Migration misclaiming.** The `doctor --fix` interactive step that claims legacy unscoped files into a user scope can misclaim; defaulting to `shared/` preserves (never widens) the pre-migration audience. | Low | Accepted; misclaiming narrows audience, so the failure mode is availability, not disclosure. |

### Explicitly out of scope (restated)

Semantic laundering through the context window (Non-Goals §1), model-weight
memorization (Non-Goals §4), cross-instance federation (Non-Goals §6), and
content-level DLP (Non-Goals §2) are not addressed by this design; the
mitigations available for them are detection and audit, not prevention.

### Bottom line

For the core scenario — a multi-user channel in which no participant can read
another member's or the owner's private memory — the posture is sound at the
retrieval and tool layer and honestly labeled at the exec layer. Risks 2, 3,
5, and 6 are resolved in-document (§7, §5.1, §1.3, §1.1 respectively). Risk 1
remains the deployment-mode requirement: installs with untrusted channel
members and `exec` enabled need the out-of-process broker tier. Risk 4
(Teams auto-binding policy) is the remaining open design question of
consequence.

## Appendix A — Deferred: Cross-User Access Grants

*Non-normative. Preserved so the schema and evaluation semantics stay
forward-compatible with a future grant mechanism; see §4 for why this is
deferred.*

The scenario: Alice ran weeks of research with the agent in `#project-x`;
Bob takes over the project and needs her project memory in his own sessions.
Alice grants Bob time-bounded retrieval over exactly that slice:

```
Tenant: contoso — one OpenClaw instance, one broker
  Alice (entra:contoso:alice)          Bob (entra:contoso:bob)
    memory/users/alice/                  memory/users/bob/
       │                                     │
       │  ┌───────────────────────────┐     │
       └──│  Access grant             │─────┘
          │  grantor: entra:contoso:alice
          │  grantee: entra:contoso:bob
          │  scope:   channel:project-x
          │  perm:    retrieve
          │  expires: 2026-08-01
          └───────────────────────────┘
```

Under such a grant, Bob's user-scoped sessions would mount a **read-only
view** of the granted slice of Alice's subtree (and its index partition),
prefiltered to `scope_channel_id` — Bob sees her project-x items, not her
personal memory. Both users resolve through the same instance's identity
bindings, and the same broker enforces both sides; nothing crosses a host
boundary (that constraint is load-bearing — the broker enforces grants by
opening files it already controls under identities it already verified;
cross-instance sharing is a different problem, Non-Goals §6).

**Sketched grant structure:**

```sql
CREATE TABLE memory_access_grant (
  grant_id        TEXT PRIMARY KEY,
  grantor_principal TEXT NOT NULL,     -- who issued the grant
  grantee_principal TEXT NOT NULL,     -- who receives access
  source_tenant_id TEXT NOT NULL,      -- belt-and-braces: must equal both users' tenant
  scope_channel_id TEXT,              -- NULL = all grantor-owned items
  perm             TEXT NOT NULL CHECK (perm IN ('retrieve','read','derive')),
  purpose          TEXT,              -- human-readable reason
  granted_at       INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,  -- mandatory expiry
  revoked_at       INTEGER,
  revoked_by       TEXT
);
```

**Sketched rules:**
- Only the item owner (source user) or a tenant admin can issue a grant.
- Grants are always time-bounded (`expires_at` required). Permanent grants
  accumulate and become unauditable; mandatory expiry forces periodic
  re-evaluation, matching enterprise access-review practice.
- Grants are revocable at any time; revocation takes effect immediately for
  retrieval. Content already exposed into the grantee's session transcripts
  is not retroactively erased; the exposure audit records exactly what was
  seen under the grant (§7.4), making the residual exposure enumerable and
  scrub-able.
- Grants are exercised only from the grantee's **user-scoped sessions** — a
  group session the grantee participates in cannot wield the grant, so a
  grant never becomes channel-wide access by accident.
- The broker mounts the grantor's slice read-only; the grantee's sessions
  never gain a write path into the grantor's subtree or index partition.
- Exposure is audited with the grant ID as provenance.
- `derive` permission in a grant allows the grantee's agent to produce
  summaries, but the derived item's ACL inherits the intersection rule (the
  grantee can read it; the grantor's deny rules still apply to further
  propagation).

**Open questions parked with this design:** grant issuance/review UX (how
Alice actually creates, sees, and reasons about her outstanding grants),
delegation depth (sketch: non-transferable), and tenant-admin override scope
(see Unresolved Questions 2–3).
