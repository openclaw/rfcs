# RFC 0010 — Implementation Plan: Component Breakdown

This document maps the ACL-based memory partitioning RFC to concrete components
in the OpenClaw codebase. The architecture splits into **core enforcement**
(always present, cannot be disabled) and an **enterprise plugin** (optional
IdP adapters and operational tooling).

---

## Architecture Split

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CORE (src/memory-acl/)                        │
│  Always loaded. Cannot be disabled. Security boundary lives here.    │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Principal    │ │ ACL          │ │ Memory      │ │ Prefilter   │ │
│  │ Resolver     │ │ Evaluator    │ │ Broker      │ │ SQL Builder │ │
│  └──────────────┘ └──────────────┘ └─────────────┘ └─────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Lineage      │ │ Exposure     │ │ Channel     │ │ Local IdP   │ │
│  │ Walker       │ │ Auditor      │ │ Membership  │ │ Adapter     │ │
│  └──────────────┘ └──────────────┘ └─────────────┘ └─────────────┘ │
│  ┌──────────────┐ ┌───────────────────────────────────────────────┐ │
│  │ IdP Adapter  │ │ Schema: acl_entry, lineage_edge, principal,   │ │
│  │ Contract     │ │ channel_identity, channel_member,            │ │
│  │ (interface)  │ │ exposure_audit (grants: deferred)           │ │
│  └──────────────┘ └───────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
        ▲ implements IdpAdapter contract
        │
┌───────┴──────────────────────────────────────────────────────────────┐
│               PLUGIN (extensions/memory-acl-enterprise/)              │
│  Optional. Adds richer identity + operational tooling.               │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Entra ID     │ │ Okta         │ │ Google       │ │ Cross-User  │ │
│  │ Adapter      │ │ Adapter      │ │ Workspace    │ │ Grant Tools │ │
│  └──────────────┘ └──────────────┘ └─────────────┘ └─────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐                 │
│  │ Anomaly      │ │ Group Sync   │ │ Admin CLI   │                 │
│  │ Detection    │ │ (IdP→local)  │ │ Commands    │                 │
│  └──────────────┘ └──────────────┘ └─────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
```

**Why this split:**

| Concern | Core | Plugin |
|---------|------|--------|
| Can it be disabled? | No | Yes |
| What happens without it? | N/A — always present | Local identity only; no enterprise IdP adapters, group sync, or anomaly detection |
| Failure mode if removed | N/A | Graceful: falls back to local adapter; core enforcement unaffected |
| Security boundary? | Yes — broker is the only path to memory | No — adds identity sources, not enforcement |
| Deployment coupling | Ships with OpenClaw | Installed when enterprise IdP is needed |

---

## Existing Seams (what we build on)

| Seam | Location | What it provides | Used by |
|------|----------|------------------|---------|
| Memory index manager | `extensions/memory-core/src/memory/manager.ts` | Per-agent SQLite memory with FTS + vector search | Core: Broker wraps it |
| Memory DB schema | `src/state/openclaw-agent-schema.sql` | `memory_index_chunks`, `memory_index_sources` | Core: schema additions |
| Channel identity resolution | `src/channels/message-access/runtime-identity.ts` | Normalizes `channel_user_id` → stable identifiers | Core: Principal Resolver |
| Ingress subject model | `src/channels/message-access/types.ts` | `ChannelIngressIdentifierKind` | Core: Principal Resolver |
| Plugin state store | `src/plugin-state/plugin-state-store.sqlite.ts` | Kysely-backed KV with TTL | Plugin: anomaly-detection state (grant metadata when RFC Appendix A lands) |
| Shared state DB | `src/state/openclaw-state-db.ts` | Global `~/.openclaw/state/openclaw.db` | Core: audit, bindings, membership |
| Agent DB registry | `src/state/openclaw-state-db.ts` | `agent_databases` tracks paths | Core: DB file routing |
| Access groups | `src/config/types.access-groups.ts` | Static + dynamic group membership | Plugin: IdP group mapping |
| Plugin SDK | `src/plugin-sdk/plugin-entry.ts` | `definePluginEntry` | Plugin: tool registration |
| Memory host SDK | `packages/memory-host-sdk/src/host/memory-schema.ts` | Schema helpers | Core: schema migrations |
| Scoped file reader | `packages/memory-host-sdk/src/host/read-file.ts` | Symlink-safe containment checks for memory file reads | Core: session file-view enforcement (RFC §2.1), content resolution at exposure time |

---

## Core Components (`src/memory-acl/`)

### C1: Principal Resolver (`src/memory-acl/principals.ts`)

**Purpose:** Resolves a **session envelope** into a `PrincipalSet` — the
identity used for all ACL evaluation for the session's lifetime. Attribution
is at **session granularity** (RFC §1.1): the gateway stamps the scope at
routing time; tool calls never carry or construct identity.

**Builds on:** the gateway's session routing (`session.dmScope`,
group-per-channel isolation) and
`src/channels/message-access/runtime-identity.ts` for sender normalization.

**Integration note:** memory tools today receive only `agentId`
(`extensions/memory-core/src/tools.ts`) — no per-message sender reaches the
tool layer, and it doesn't need to. The envelope is stamped once at session
creation and read from the session registry; this is deliberately *not* a
per-tool-call plumbing change.

```typescript
export type PrincipalKind =
  | 'user' | 'tenant' | 'group' | 'channel' | 'role' | 'agent' | 'source';

export type SessionScope = 'user' | 'channel' | 'agent';

export interface PrincipalSet {
  readonly tenantId: string;
  readonly sessionScope: SessionScope;
  readonly userId: string | null;     // user-scoped sessions only; NEVER from envelope assertion
  readonly channelUserId: string | null; // last resolved sender; audit + postbox only
  readonly principals: ReadonlySet<string>;
  readonly channelId: string;
  readonly agentId: string;
  readonly sensitivityCeiling: number;
}

export interface SessionEnvelope {
  // Stamped once by the gateway at session routing time; immutable.
  tenantId: string;
  sessionKey: string;
  sessionScope: SessionScope;
  channelId: string;
  agentId: string;
}

export interface SenderRef {
  channelUserId: string;              // transport-asserted sender (per message)
  conversationId?: string;
}

export interface PrincipalResolver {
  resolve(envelope: SessionEnvelope, sender: SenderRef | null): PrincipalSet;
}
```

**Key behavior:**
- `user` scope (DM): looks up `channel_identity` to derive `userId`
  from the sender; no binding → abort before any DB opens (`deny-identity`)
- `channel` scope (group): principal is `channel:{channelId}`; sender is
  resolved for audit rows and postbox targeting only — never for retrieval
- `agent` scope (cron/webhook/sub-agent): `agent:{agentId}` +
  `tenant:{tenantId}` only; nothing user-scoped is ever visible
- Delegates to registered `IdpAdapter` for canonical principal format
- Falls back to `LocalIdpAdapter` when no enterprise plugin is loaded
- Group principals come from the snapshot with **fail-closed bounded
  staleness** (see P6): stale-within-window → honored + audited; beyond
  window → dropped from the set
- **`dmScope` precondition (RFC §1.1):** a `user`-scope resolution is
  rejected when the session is a shared DM (`session.dmScope: main`) — such
  a session has no coherent single user. The broker refuses to mount user
  scopes for shared-DM sessions unconditionally; `openclaw doctor` flags
  multi-user installs that have not set `per-channel-peer` or stricter.

---

### C2: ACL Evaluator (`src/memory-acl/evaluator.ts`)

**Purpose:** Pure, stateless function. Given a `PrincipalSet`, an item header,
and ACL entries, returns a `Decision`. No I/O, no DB access — testable in
isolation.

```typescript
export type Perm = 'retrieve' | 'read' | 'derive' | 'sync' | 'admin';

export type Decision =
  | 'allow'
  | 'deny-explicit'
  | 'deny-default'
  | 'deny-scope'
  | 'deny-lineage'
  | 'deny-partition'
  | 'deny-stale'
  | 'deny-identity'
  | 'deny-membership';

export interface AclEntry {
  aclId: string;
  itemId: string;
  principalId: string;
  effect: 'allow' | 'deny';
  perm: Perm;
  expiresAt: number | null;
}

export interface ItemHeader {
  itemId: string;
  tenantId: string;
  ownerUserId: string | null;
  channelId: string | null;
  derived: boolean;
  sensitivity: number;
  effectiveLabel: string;
  deletedAt: number | null;
  expiresAt: number | null;
}

export interface AclEvaluator {
  evaluate(ctx: PrincipalSet, item: ItemHeader, acl: AclEntry[], perm: Perm): Decision;
  readableLabels(ctx: PrincipalSet): ReadonlySet<string>;
}
```

**Permission lattice (normative — from RFC §3.1):** allows imply down the
chain `admin ⇒ derive ⇒ read ⇒ retrieve` (`sync` independent; `admin ⇒ sync`).
Each requested perm P has a required set (required(`read`) =
{retrieve, read}, etc.); a deny matching any member of required(P) denies,
and every member must be covered — by **placement** (item's scope == the
session's own scope; the common case, no ACL rows — RFC §2) or by an allow
entry. Denies are honored even on placement-allowed items. The evaluator,
the prefilter (C6), and the property tests all derive from this one table.

**Evaluation order (normative — mirrors RFC §3.2 and broker design §4;
divergence between the three documents is a spec bug):**
1. Hard partition: `item.tenantId !== ctx.tenantId`, or item not in a
   mounted subtree/partition, or `item.deletedAt` set, or
   `item.expiresAt < now` → `deny-partition`
2. Sensitivity ceiling: `item.sensitivity > ctx.sensitivityCeiling` → `deny-scope`
3. Explicit deny: any deny entry matching any member of required(perm) → `deny-explicit`
4. Allow required: any member of required(perm) uncovered by placement or
   an allow entry → `deny-default`
5. Channel scope: `item.channelId` set but ≠ `ctx.channelId` or no live membership → `deny-scope` / `deny-membership`
6. Pass: `allow`

(Step 0 — session scope & identity resolution — happens in C1 before any
subtree or partition is mounted; step 6 of the RFC order —
`deny-lineage`/`deny-stale` — is produced by C4 and the staleness check in
the postfilter, outside this pure function.)

**Decision producers** (every `Decision` variant has exactly one producer —
no dead policy inputs):
- `sensitivity`: set at `remember` time from per-channel/per-agent runtime
  config defaults or trusted admin surfaces; `derive` takes `max()` over
  parents. Never from model text.
- `deny-stale`: embedding staleness (`embedding_meta.item_rev ≠
  memory_item.rev`) drops vector candidates in the postfilter.
- `deny-identity` / `deny-membership`: C1 resolution and C7 read-time
  membership check respectively.

---

### C3: Memory Broker (`src/memory-acl/broker.ts`)

**Purpose:** The ONLY surface agents use for memory access. Replaces direct
`MemoryIndexManager` usage. Wraps existing search with ACL enforcement.

```typescript
export interface MemoryBroker {
  query(req: MemoryQuery): Promise<MemoryQueryResult>;
  remember(req: MemoryWrite): Promise<WriteResult>;
  derive(req: DerivationRequest): Promise<DeriveResult>;
  forget(req: ForgetRequest): Promise<void>;
}

export interface MemoryQuery {
  envelope: SessionEnvelope;
  queryText: string;
  tokenBudget: number;
  k?: number;
}

export interface MemoryQueryResult {
  contextBlock: string;
  exposed: ReadonlyArray<{ itemId: string; rev: number }>;
  batchId: string;
}
```

**Read pipeline:**
1. Resolve `PrincipalSet` (C1, session-scoped)
2. Resolve `SessionMounts` (C10): subtrees + index partitions for the
   session's scope + shared (+ live members' projections for group
   sessions). No cross-user read mount ships (deferred, RFC Appendix A).
3. Build prefilter CTE (C6, required(`retrieve`)) → fan out to FTS5 + vector
4. RRF merge + score
5. Postfilter: per-item ACL eval (C2, required(`read`)) + lineage check (C4)
   + `trust_tier` tagging (C11) so postboxed items render provenance-labeled
6. Trim to token budget
7. Record audit (C5)
8. Return

**Write path:**
- `remember`: owner = the session's resolved scope; reject any owner field
  that disagrees with it. The only cross-scope write is the postbox (C11),
  which **narrows** audience to one member — it can never widen scope.
- `derive`: check `derive` perm on every parent; compute effective label as
  intersection; write with lineage edges. **Compaction summaries are
  `derive` calls** (RFC §7) — they inherit the session's scope with lineage
  back to the transcript segment; no summary is persisted outside this path.
- `forget`: tombstone + purge FTS/vec rows + delete item file + quarantine
  descendants

**Integration with existing memory-core:**
```
Before:  memory_search tool → MemoryIndexManager.search() → raw results
After:   memory_search tool → MemoryBroker.query()
                                → PrincipalResolver.resolve()
                                → prefilter CTE + MemoryIndexManager.search()
                                → AclEvaluator.evaluate() per item
                                → ExposureAuditor.record()
                                → filtered results
```

The `MemoryIndexManager` is not removed — it remains the search/index engine.
The broker is a layer above it that adds policy enforcement.

---

### C4: Lineage Walker (`src/memory-acl/lineage.ts`)

**Purpose:** For derived items, walks the ancestor graph and denies if any
ancestor is tombstoned or fails ACL.

```typescript
export interface LineageWalker {
  checkAncestry(ctx: PrincipalSet, itemId: string, maxDepth?: number): Decision;
}
```

**Schema** (added to agent DB alongside existing memory tables):

```sql
CREATE TABLE lineage_edge (
  child_id   TEXT NOT NULL,
  parent_id  TEXT NOT NULL,
  relation   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (child_id, parent_id, relation)
);
CREATE INDEX ix_lineage_parent ON lineage_edge(parent_id);
```

**Walk:** Recursive CTE, depth-capped at 8. Any tombstoned or ACL-failing
ancestor → `deny-lineage`.

---

### C5: Exposure Auditor (`src/memory-acl/audit.ts`)

**Purpose:** Records what entered prompts. Enables revocation impact analysis
and write-after-exposure detection.

**Schema:** `exposure_audit` in the per-tenant `state.db`. The canonical
definition is broker design §3.5; the columns this component relies on are
`exposure_id`, `batch_id` (the `MemoryContextResult.exposureBatchId`),
`agent_id`, `policy_ctx_hash`, `item_id`, `item_rev`, `decision`, `reason`,
and `grant_id` (NULL until the deferred grant design of RFC Appendix A
lands). Do not re-declare a divergent copy here — extend the canonical table.

Retention: configurable; default 30 days. Compaction deletes `denied_*` rows
older than retention; `exposed` rows kept longer for revocation queries.

---

### C6: Prefilter SQL Builder (`src/memory-acl/prefilter.ts`)

**Purpose:** Generates a CTE that bounds candidate work before postfilter.
Optimization only — postfilter is the security boundary.

```typescript
export function buildPrefilterCte(ctx: PrincipalSet, now: number): {
  sql: string;
  params: Record<string, unknown>;
};
```

Generates (candidate stage = required(`retrieve`) from the lattice; the
postfilter, not this CTE, evaluates required(`read`)). The allow stage is
satisfied by placement **or** an allow row — without the placement branch
the prefilter would exclude every ACL-row-free item the evaluator allows,
violating the recall invariant:
```sql
WITH ctx_principals(pid) AS (VALUES (?), (?), ...),
authorized AS (
  SELECT item_id FROM memory_item
  WHERE deleted_at IS NULL
    AND tenant_id = ?
    AND (expires_at IS NULL OR expires_at > ?)
    AND (channel_id IS NULL OR channel_id = ?)
    -- deny: required(retrieve) = {retrieve}; honored even on placement items
    AND NOT EXISTS (SELECT 1 FROM acl_entry d
                    WHERE ... d.effect='deny' AND d.perm='retrieve' ...)
    AND (
      scope = :session_scope   -- placement allow: session's own scope, no ACL rows (RFC §2)
      OR EXISTS (SELECT 1 FROM acl_entry a
                 WHERE ... a.effect='allow'
                   AND a.perm IN ('retrieve','read','derive','admin') ...)
    )
)
```

---

### C7: Channel Membership (`src/memory-acl/membership.ts`)

**Purpose:** Tracks live channel membership. Scope-narrowing in C2 queries
this to confirm the requester is a current member of the item's channel.

**Schema:** `channel_member` in the per-tenant `state.db` — canonical
definition in broker design §3.2 (`channel_id`, `user_id`, `role`,
`joined_at`, `left_at`, PK `(channel_id, user_id)`). `left_at` is the
read-time authority: setting it revokes retrieval of the channel's items
immediately, with no re-labeling.

**Refresh:** Webhook-driven for Teams/Slack/Discord; periodic poll fallback;
on-demand check as last resort.

---

### C8: Local IdP Adapter (`src/memory-acl/idp-local.ts`)

**Purpose:** Default adapter for single-user and self-hosted installs. No
enterprise IdP needed — the user owns everything.

```typescript
// Implements the C9 contract in the degenerate way: there is no token to
// fetch, so the assertion path is skipped, not trusted-by-default — core
// constructs `local:{instanceId}:{user}` from its own pairing state.
export class LocalIdpAdapter implements IdpAdapter {
  readonly providerId = 'local';
  async fetchIdentityAssertion(): Promise<IdentityAssertion | null> {
    return null;
  }
  // Single-user: one principal owns all items — evaluator is a trivial pass
}
```

---

### C9: IdP Adapter Contract (`src/memory-acl/idp-contract.ts`)

**Purpose:** The interface that enterprise plugins implement to provide richer
identity resolution. Core depends only on this contract, never on specific
IdP implementations. Per RFC §5.1, **adapters fetch raw verification
material; core verifies it and constructs principals** — an adapter can deny
service but cannot forge identity.

```typescript
export interface IdentityAssertion {
  rawToken: string;          // token exactly as received from transport/OAuth
  jwksUri: string;           // from provider discovery, pinned in operator config
  expectedIssuer: string;
  expectedAudience: string;
}

export interface IdpAdapter {
  readonly providerId: string;

  /** Fetch raw material for a sender. NEVER returns a principal string. */
  fetchIdentityAssertion(
    channelId: string,
    channelUserId: string,
  ): Promise<IdentityAssertion | null>;

  /** Raw provider group IDs; core namespaces them as
   *  group:{provider}:{tenant}:{gid} — an adapter can only influence group
   *  principals under its own allowlisted prefix. */
  refreshGroupMembership?(userId: string): Promise<string[]>;
}

export interface IdpAdapterRegistry {
  /** Refuses unlisted providers (operator allowlist:
   *  memoryAcl.identity.providers), refuses duplicates, audit-logs every
   *  registration and refusal. Sealed before the first session is routed. */
  register(pluginId: string, adapter: IdpAdapter): void;
  get(providerId: string): IdpAdapter | undefined;
  active(): IdpAdapter;   // configured adapter, or LocalIdpAdapter
}
```

Core performs OIDC verification (signature against the pinned JWKS, issuer,
audience, expiry) in `src/memory-acl/` and builds the canonical principal
from the verified claims. `LocalIdpAdapter` (C8) is the degenerate case: no
token exists, so core constructs `local:{instance}:{user}` from its own
pairing state — the assertion path is skipped, not trusted-by-default.

The enterprise plugin registers adapters into this registry at startup. Core
always has at least `LocalIdpAdapter` available.

---

### C10: Session Mounts & File-View Enforcement (`src/memory-acl/mounts.ts`)

**Purpose:** Turns a resolved `PrincipalSet` into the concrete set of memory
subtrees and index partitions a session may touch (RFC §1.2/§2), and
enforces that `memory_search`/`memory_get` and file tools cannot escape it
(RFC §2.1). This is the structural boundary the RFC leans on — placement,
not row filters.

**Builds on:** the symlink-safe containment checks in
`packages/memory-host-sdk/src/host/read-file.ts` (reused, not reimplemented).

```typescript
export interface SessionMounts {
  readonly writable: ReadonlyArray<ScopeMount>;   // exactly one: the session's own scope
  readonly readable: ReadonlyArray<ScopeMount>;   // + shared; + live members' projections (group)
  // NOTE: no cross-user read mount — deferred grant design (RFC Appendix A)
}

export interface ScopeMount {
  readonly scope: string;            // 'user:{id}' | 'channel:{id}' | 'shared' | 'projection:{id}'
  readonly subtreeDir: string;       // absolute path under {workspace}/memory/
  readonly indexPartition: string;   // absolute path under ~/.openclaw/memory-acl/.../index/
  readonly mode: 'rw' | 'ro';
}

export interface MountResolver {
  resolve(ctx: PrincipalSet): SessionMounts;
  /** Throws if `absPath` is outside every mounted subtree. Used by the
   *  memory tools and by file-tool path validation for memory/ paths. */
  assertPathMounted(mounts: SessionMounts, absPath: string): void;
}
```

**Key behavior:**
- Group sessions never receive a `user:{other}` mount — the personal subtree
  is not in `readable`, so it is never indexed into the candidate set nor
  resolvable via `memory_get`.
- `assertPathMounted` is wired into `memory_get`/`memory_search` path
  resolution and into file-tool path validation for `memory/` paths, so an
  unmounted memory subtree is treated exactly like a path outside the
  workspace.
- **Honest limit (RFC §2.1):** with in-process, unsandboxed `exec`, this
  boundary holds against retrieval-path bugs and model behavior, not against
  a deliberately injected shell; the adversarial boundary is the
  out-of-process broker (broker design §12 Option B). `openclaw doctor`
  warns when a multi-user config leaves `exec` unconfined over `memory/`.

---

### C11: Postbox Write Valve (`src/memory-acl/postbox.ts`)

**Purpose:** The single write path from a group session into a member's
personal store (RFC §1.2/§1.3). Narrows audience; never widens or reads.

```typescript
export interface PostboxWrite {
  targetUserId: string;              // must be a sender resolved in THIS session
  content: string;
  sourceChannelId: string;           // provenance
  sourceItemId: string;              // lineage parent (channel-scoped source)
}
```

**Key behavior:**
- Writes a markdown item under `memory/users/{target}/postbox/` with
  `allow read user:{target}` only, channel provenance in frontmatter, and a
  `lineage_edge` back to the channel-scoped source — delivered through the
  broker write queue, never a directly opened foreign handle.
- **Low-trust tier (RFC §1.3):** postboxed items are tagged so retrieval
  renders them as provenance-labeled results only — never promoted into
  system-prompt-level (`MEMORY.md`) memory, never treated as an instruction
  source — until the owner explicitly promotes them out of `postbox/`.
- **Rate limits + notification:** per-channel cap (default 20/day; over-cap
  writes dropped and audited); first postbox from a not-previously-seen
  channel emits a notification.
- **Deployment posture (`memoryAcl.postbox.mode`, RFC §1.3):** `labeled`
  (default for single-user/local), `review-required` (default when an
  enterprise IdP is configured — items quarantined until owner approval),
  or `off` (no postbox writes at all). Enterprise defaults conservative;
  tenants opt down, not up. `openclaw doctor` reports the active mode in
  multi-user installs.

**Schema addition** (item catalog):

```sql
ALTER TABLE memory_item ADD COLUMN trust_tier TEXT NOT NULL DEFAULT 'normal';
  -- 'normal' | 'postbox-unreviewed' | 'quarantined'
```

---

## Enterprise Plugin Components (`extensions/memory-acl-enterprise/`)

### P1: Entra ID Adapter (`extensions/memory-acl-enterprise/src/entra.ts`)

**Implements:** `IdpAdapter` contract from core (C9)

- Fetches the Entra ID token + pinned OIDC discovery/JWKS material; **core**
  validates signature/issuer/audience/expiry and extracts `tid` + `oid`
  from the verified claims (RFC §5.1)
- Canonical format (constructed by core): `entra:{tenantId}:{objectId}`
- Teams auto-binding: requires a verified Bot Framework token, not a bare
  envelope object ID; opt-in policy is Unresolved Q5
- Group membership: calls Microsoft Graph `/me/memberOf` on refresh; core
  namespaces results as `group:entra:{tid}:{gid}`

---

### P2: Okta Adapter (`extensions/memory-acl-enterprise/src/okta.ts`)

**Implements:** `IdpAdapter`

- Fetches Okta session/access tokens + pinned introspection/JWKS material;
  core validates and extracts `org_id` + `uid` (RFC §5.1)
- Canonical format (constructed by core): `okta:{orgId}:{userId}`
- Group membership: calls Okta `/api/v1/users/{id}/groups`

---

### P3: Google Workspace Adapter (`extensions/memory-acl-enterprise/src/google.ts`)

**Implements:** `IdpAdapter`

- Fetches Google ID tokens + pinned OIDC discovery material; core validates
  and extracts `hd` (hosted domain) + `sub` (subject) (RFC §5.1)
- Canonical format (constructed by core): `google:{domain}:{subject}`
- Group membership: calls Directory API

---

### P4: Cross-User Grant Tools (`extensions/memory-acl-enterprise/src/grant-tools.ts`) — DEFERRED

**Status: deferred with the grant design itself (RFC §4 / Appendix A).**
Nothing in this component ships until the grant design graduates from the
appendix; it is kept here so the plugin surface is planned for.

**Purpose:** Agent-facing tools for managing cross-user grants (e.g., Alice
grants Bob `retrieve` over her `#project-x` items). Registered via plugin
SDK. Cross-instance federation is out of scope (RFC Non-Goals §6).

Tools:
- `memory_grant` — create a time-bounded grant to another user
- `memory_revoke` — revoke an active grant
- `memory_grants_list` — list grants given/received
- `memory_grant_audit` — show what was accessed under a specific grant

**Schema** (shared state DB, owned by core but populated by plugin tools):

```sql
CREATE TABLE memory_access_grant (
  grant_id           TEXT PRIMARY KEY,
  grantor_principal  TEXT NOT NULL,
  grantee_principal  TEXT NOT NULL,
  source_tenant_id   TEXT NOT NULL,   -- must equal both users' tenant (same instance)
  scope_channel_id   TEXT,
  perm               TEXT NOT NULL,
  purpose            TEXT,
  granted_at         INTEGER NOT NULL,
  expires_at         INTEGER NOT NULL,
  revoked_at         INTEGER,
  revoked_by         TEXT
);
CREATE INDEX ix_grant_grantee ON memory_access_grant(grantee_principal)
  WHERE revoked_at IS NULL;
CREATE INDEX ix_grant_grantor ON memory_access_grant(grantor_principal);
```

Grants would be exercised only from the grantee's **user-scoped sessions**; a
group session the grantee participates in could not wield the grant.

When this design graduates (RFC Appendix A): the grant *schema* lives in
core (the broker queries it during the read path to determine which
additional subtrees/index partitions to mount read-only), while the grant
*management tools* live in the plugin. Until then neither the table nor the
tools exist, and the broker has no grant-aware read path.

---

### P5: Anomaly Detection (`extensions/memory-acl-enterprise/src/anomaly.ts`)

**Purpose:** Detects potential semantic laundering by comparing new writes
against recently-exposed cross-principal items.

**How it works:**
1. Hooks into broker `remember` calls (via plugin hook)
2. Queries `exposure_audit` for recent cross-principal exposures
3. Computes embedding similarity between new write and exposed items
4. Flags if similarity > threshold (default 0.85)
5. Advisory only: logs metric + emits event. Does not block the write.

**Why plugin, not core:** False positives are common (user legitimately writes
about the same topic). Blocking writes would break workflows. This is an
operational signal for security teams, not an enforcement boundary.

---

### P6: Group Sync (`extensions/memory-acl-enterprise/src/group-sync.ts`)

**Purpose:** Periodically refreshes IdP group membership and updates local
principal snapshots.

- Calls `IdpAdapter.refreshGroupMembership()` on configurable schedule
- Updates a local `idp_group_membership` table
- Principal resolver includes group principals in the resolved set
- **Fail-closed with a bounded staleness window (default).** When the IdP is
  unreachable, the last-known snapshot is honored only within
  `maxStalenessHours` (default 24); every use of a stale snapshot is audited
  with a `stale` flag. Beyond the window, group-derived principals are
  dropped from the resolved set while `user:`/`tenant:` principals (anchored
  by the locally stored verified binding) are retained — group-gated access
  tightens, personal memory keeps working. A user removed from a group is
  therefore locked out no later than the window, even if sync never
  recovers. Deployments may shorten the window or drop stale groups
  immediately. Unbounded trust in the stale snapshot is **break-glass, not
  configuration**: the value is deliberately named `fail-open-unsafe` so it
  cannot read as a peer of the defaults, and `openclaw doctor` reports it
  as a security finding (a standing deny-by-default violation), not a
  notice

---

### P7: Plugin Entry (`extensions/memory-acl-enterprise/index.ts`)

```typescript
export default definePluginEntry({
  id: 'memory-acl-enterprise',
  register(api) {
    const config = api.getConfig<EnterpriseAclConfig>();
    const registry = api.getService<IdpAdapterRegistry>('memory-acl:idp-registry');

    // Register enterprise IdP adapters. The registry enforces the operator
    // allowlist (memoryAcl.identity.providers → plugin id), refuses
    // duplicates, and audit-logs the registration (RFC §5.1); a plugin
    // cannot self-authorize a provider prefix.
    if (config.identity?.provider === 'entra')
      registry.register('memory-acl-enterprise', new EntraIdpAdapter(config.identity));
    else if (config.identity?.provider === 'okta')
      registry.register('memory-acl-enterprise', new OktaIdpAdapter(config.identity));
    else if (config.identity?.provider === 'google')
      registry.register('memory-acl-enterprise', new GoogleIdpAdapter(config.identity));

    // P4 grant tools (memory_grant, memory_revoke, memory_grants_list,
    // memory_grant_audit) are registered here once the deferred grant
    // design (RFC Appendix A) graduates — no tool surface ships until then.

    // Register anomaly detection hook
    api.registerHook('memory-write', anomalyDetectionHook(config.anomaly));

    // Start group sync background job
    if (config.groupSync?.enabled)
      api.registerService('group-sync', new GroupSyncService(registry, config.groupSync));
  },
});
```

**Manifest** (`extensions/memory-acl-enterprise/openclaw.plugin.json`):

```json
{
  "id": "memory-acl-enterprise",
  "activation": { "onCapabilities": ["memory-acl"] },
  "contracts": {
    "tools": []
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "identity": {
        "type": "object",
        "properties": {
          "provider": { "enum": ["entra", "okta", "google"] },
          "tenantId": { "type": "string" },
          "clientId": { "type": "string" },
          "clientSecret": { "type": "string" }
        },
        "required": ["provider", "tenantId", "clientId"]
      },
      "anomaly": {
        "type": "object",
        "properties": {
          "threshold": { "type": "number", "default": 0.85 }
        }
      },
      "groupSync": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean", "default": false },
          "intervalMinutes": { "type": "number", "default": 60 },
          "stalePolicy": { "enum": ["fail-closed", "fail-open-unsafe"], "default": "fail-closed" },
          "maxStalenessHours": { "type": "number", "default": 24 }
        }
      }
    }
  }
}
```

---

## Dependency Graph (revised with core/plugin split)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PLUGIN: extensions/memory-acl-enterprise/             │
│                                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │P1 Entra │  │P2 Okta  │  │P3 Google│  │P4 Grant  │  │P5 Anomaly │  │
│  │ Adapter │  │ Adapter │  │ Adapter │  │  Tools   │  │ Detection │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘  └─────┬─────┘  │
│       └─────────────┼───────────┘             │               │        │
│                     │ implements               │               │        │
└─────────────────────┼─────────────────────────┼───────────────┼────────┘
                      │                         │               │
══════════════════════╪═════════════════════════╪═══════════════╪════════════
                      │                         │               │
┌─────────────────────┼─────────────────────────┼───────────────┼────────┐
│                     ▼  CORE: src/memory-acl/   │               │        │
│              ┌──────────────┐                  │               │        │
│              │ C9: IdP      │                  │               │        │
│              │ Contract     │                  │               │        │
│              └──────┬───────┘                  │               │        │
│                     │ used by                  │               │        │
│              ┌──────▼───────┐                  │               │        │
│              │ C1: Principal│                  │               │        │
│              │ Resolver     │                  │               │        │
│              └──────┬───────┘                  │               │        │
│                     │                         │               │        │
│              ┌──────▼────────────────────────────────────────────────┐  │
│              │           C3: Memory Broker                           │  │
│              │           (the single entry point)                    │  │
│              └─┬─────┬─────┬─────┬─────┬─────┬─────┬────────────────┘  │
│                │     │     │     │     │     │     │                   │
│         ┌──────▼┐ ┌──▼──┐ ┌▼───┐ ┌▼────┐ ┌──▼───┐ ┌▼──────┐ ┌───────┐│
│         │C2 ACL │ │C4   │ │C5  │ │C6   │ │C7    │ │C10    │ │C11    ││
│         │Eval   │ │Linge│ │Audt│ │Prflt│ │Membr │ │Mounts │ │Postbox││
│         └───────┘ └─────┘ └────┘ └──┬──┘ └──────┘ └───┬───┘ └───────┘│
│                                     │                 │              │
│              ┌──────────────────────▼─────────────────▼─────────┐    │
│              │ C8: Local IdP Adapter (default, always available) │    │
│                                           │                          │
│              ┌────────────────────────────▼─────────────────────┐    │
│              │ Existing: MemoryIndexManager                      │    │
│              │ (extensions/memory-core/ — unchanged engine)      │    │
│              └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase Mapping

| Phase | Scope | Components | Exit criteria |
|-------|-------|-----------|---------------|
| **0 — Core enforcement** | Core | C1, C2, C3, C5, C6, C8, C10 | Property tests: prefilter never excludes evaluator-allowed items (results ⊇ evaluator-allowed); cross-channel blocked; spoofed identity rejected; personal subtree unreachable from a group session; shared-DM session refuses user-scope mount; single-user install works with zero config |
| **1 — Lineage & compaction** | Core | C4, schema: `lineage_edge`; compaction-as-derive integration (RFC §7) | Tombstoned ancestor poisons descendants; summary-leak red-team green; compaction summary inherits session scope with lineage |
| **2 — Channel membership** | Core | C7, schema: `channel_member` | Leave-channel → immediate retrieval denial; webhook-driven refresh for Teams/Slack/Discord |
| **3 — Postbox** | Core | C11, schema: `trust_tier` | Group session files into member's postbox; item invisible to the group; hydrates low-trust in owner's DM; rate limit + notification; review-required quarantine |
| **4 — Enterprise IdP** | Plugin | P1, P2, P3, P6, P7 | Entra/Okta/Google binding e2e (core-side token verification, §5.1); registry allowlist rejects unlisted/duplicate providers; group membership resolves to principals; stale-IdP fail-closed window enforced (removed user loses group access ≤ `maxStalenessHours`) |
| **5 — Anomaly detection** | Plugin | P5 | High-similarity write after cross-user exposure → flag raised; no false-positive blocking |
| **— Cross-user grants (DEFERRED)** | Core schema + Plugin tools | Deferred until the grant design (RFC Appendix A) graduates. Core: grant schema, broker grant-aware read path. Plugin: P4 | Grant lifecycle e2e; expired/revoked denied; grant unusable from group sessions; audit correlation works |

**Single-user installs (no enterprise plugin):** Phases 0–2 give full
enforcement with `LocalIdpAdapter`. One principal owns everything; the evaluator
is a trivial pass. No performance overhead, no configuration. The security
invariant (all access through broker) is established from Phase 0.

---

## Integration with Existing Code

### How core replaces direct memory access

The broker becomes the **mandatory** intermediary. The existing `memory_search`
and `memory_get` tools in `extensions/memory-core/` are re-pointed to go through
the broker rather than calling `MemoryIndexManager` directly:

```
Current flow:
  memory_search tool → MemoryIndexManager.search() → results

Phase 0 flow:
  memory_search tool → MemoryBroker.query()
                         → C1: resolve principal set
                         → C6: build prefilter CTE
                         → MemoryIndexManager.search(with prefilter)
                         → C2: postfilter each candidate
                         → C5: audit
                         → results
```

The `MemoryIndexManager` remains the search/index engine, and **markdown
files remain the content store** (RFC §2): the broker's catalog rows are
pointers (`path` + span + `content_hash`), content is read at exposure time
through the symlink-safe scoped reader
(`packages/memory-host-sdk/src/host/read-file.ts`), and `memory_get` path
resolution is confined to the session's mounted subtrees (RFC §2.1). No
existing memory-core code is deleted — it's wrapped.

### Channel identity bridge

Existing `ChannelIngressSubject` from `src/channels/message-access/` carries
`stable-id` — the transport-asserted sender. The Principal Resolver (C1) takes
this and resolves through `channel_identity` to get the canonical
principal. Existing identity normalization is reused without modification.

### Session transcripts & compaction (RFC §7)

The memory store is not the only durable representation of a conversation;
transcripts and compaction summaries must not bypass the broker.

- **Transcript placement.** Session transcript files live under the same
  scoped layout as memory subtrees and fall under C10 file-view enforcement
  — a group transcript is channel-scoped and unreadable from another user's
  DM session; a DM transcript is never readable from a group session.
- **Compaction is derivation.** The runtime's compaction/summarization step
  writes through the broker as a `derive` call (C3) whose parent is the
  transcript segment; the summary inherits the session's scope with lineage.
  This is the one integration point in the existing agent loop that must be
  re-pointed at the broker — a summary written directly to disk would be an
  unscoped, unlineaged laundering channel.
- **Revocation scrub.** Because C5 records which item revisions entered
  which sessions, a revocation-triggered transcript scrub is a well-defined
  optional job (not a retroactive guarantee).

### Store layout (backward-compatible migration path)

**Phase 0 (immediate):** memory files stay exactly where they are. For
single-user installs the whole existing `memory/` tree is one scope
(`user:{local}`), so there are **no file moves and no behavior change** —
the scope column and ACL/catalog tables are added alongside the existing
index tables in the per-agent DB
(`~/.openclaw/agents/{agentId}/agent/openclaw-agent.sqlite`), and the
broker treats that DB as the single scope's index partition.

**Multi-user (doctor migration):** enabling multi-user memory runs
`openclaw doctor --fix`, which reorganizes the memory tree into the scoped
subtree layout (`memory/users/{id}/`, `memory/channels/{id}/`,
`memory/shared/`, `memory/projections/{id}/` — RFC §2), splits the index
into per-scope partitions
(`~/.openclaw/memory-acl/tenants/{tenantId}/index/...`), and enables session
file-view enforcement. Existing un-scoped files migrate to `shared/` by
default with an interactive option to claim them into a user scope — the
conservative default is the *wider* store here because pre-migration content
was already visible to every session, so `shared/` preserves, not widens,
its existing audience. The index is rebuilt from files, never trusted across
the migration.

### Grant schema ownership (deferred with the grant design)

When the grant design graduates (RFC Appendix A), the `memory_access_grant`
table lives in the **shared state DB** and is created by a core schema
migration. The broker reads it during the read path to determine which
additional subtrees/index partitions to mount read-only. The enterprise
plugin provides the *tools* to manage grants, but enforcement doesn't depend
on the plugin being loaded. Until then, no grant table exists and the broker
has no grant-aware code path.

---

## Testing Strategy

| Layer | Scope | Approach |
|-------|-------|----------|
| ACL evaluator | Core | Property-based: fuzz principal sets × ACL entries × items. Invariant: prefilter SQL never excludes what evaluator allows. |
| Prefilter SQL | Core | Generate random ACL state, run prefilter, assert results ⊇ evaluator decisions. |
| Lineage walker | Core | Depth graphs with tombstoned ancestors; verify poisoning propagates correctly. |
| Channel scope | Core | Leave-channel → immediately denied. Join → immediately allowed. |
| Broker integration | Core | End-to-end: multi-user scenario with channel isolation, personal items, shared items. |
| Single-user passthrough | Core | LocalIdpAdapter: confirm zero-config single-user has no regressions vs. current behavior. |
| Mounts & file-view (C10) | Core | Group session never mounts a `user:{other}` subtree; `assertPathMounted` rejects `memory_get` / file-tool paths outside the session's mounts (incl. symlink-escape attempts via the reused reader checks). |
| Postbox tiering (C11) | Core | Postboxed item invisible to the writing group session; hydrates low-trust (never `MEMORY.md`, never instruction) in owner's DM; over-cap writes dropped; `mode: review-required` quarantines until approval; `mode: off` → postbox writes rejected outright. |
| Compaction scoping | Core | Compaction summary of a group session is written via `derive`, inherits `channel:C` scope + lineage; no unscoped summary reaches disk. |
| Identity binding | Core + Plugin | Spoofed `channel_user_id` → denied. Revoked binding → denied. Valid Entra token → resolves. Adapter returning a forged principal string is impossible (contract returns raw material; core builds the principal); unlisted/duplicate provider registration refused. |
| Cross-user grants (deferred) | Core + Plugin | With the Appendix A design: grant → access from grantee's user-scoped session. From a group session → denied. Expire → denied. Revoke → denied. Re-grant attempt by grantee → rejected. Until then: assert no cross-user read path exists at all. |
| Session attribution | Core | Group session: retrieval principal is `channel:C` regardless of who triggered/steered the run. Steering by B mid-run never switches to B's user principal. Autonomous session → no user-scoped items. Postbox write lands with `user:A` allow only; unreadable from the writing session. |
| Anomaly detection | Plugin | High-similarity write after exposure → flag. Low-similarity → no flag. Advisory only. |
| E2E scenario | All | Multi-user Teams: shared channel memory visible to members; personal stores unreadable from the group session; postbox items land in the member's store and are invisible to the group; user leaves → channel memory revoked; user A's memory never retrievable from user B's sessions. |

---

## File Layout Summary

```
src/memory-acl/
  index.ts                  -- exports, wires core components
  principals.ts             -- C1: PrincipalResolver
  evaluator.ts              -- C2: AclEvaluator (pure function)
  broker.ts                 -- C3: MemoryBroker
  lineage.ts                -- C4: LineageWalker
  audit.ts                  -- C5: ExposureAuditor
  prefilter.ts              -- C6: buildPrefilterCte
  membership.ts             -- C7: channel membership state
  idp-local.ts              -- C8: LocalIdpAdapter
  idp-contract.ts           -- C9: IdpAdapter interface + registry (core-side verification)
  mounts.ts                 -- C10: SessionMounts + file-view enforcement
  postbox.ts                -- C11: postbox write valve + trust tiers
  schema.sql                -- all core ACL schema additions
  evaluator.test.ts         -- property-based tests
  broker.test.ts            -- integration tests
  prefilter.test.ts         -- recall invariant: prefilter results ⊇ evaluator-allowed
  mounts.test.ts            -- file-view escape + cross-user non-mount tests

extensions/memory-acl-enterprise/
  index.ts                  -- P7: plugin entry
  openclaw.plugin.json      -- manifest
  src/
    entra.ts                -- P1: Entra ID adapter
    okta.ts                 -- P2: Okta adapter
    google.ts               -- P3: Google Workspace adapter
    grant-tools.ts          -- P4: grant management tools (DEFERRED — RFC Appendix A)
    anomaly.ts              -- P5: anomaly detection hook
    group-sync.ts           -- P6: IdP group refresh
    types.ts                -- shared plugin types
```
