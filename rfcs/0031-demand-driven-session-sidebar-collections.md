---
title: Demand-driven session sidebar collections
authors:
  - Jesse Merhi
  - RoboClaw
created: 2026-08-23
last_updated: 2026-08-23
status: draft
issue:
rfc_pr:
---

# Proposal: Demand-driven session sidebar collections

## Summary

Replace the Control UI sidebar's paginated global session roster with a
demand-driven collection read model. The sidebar first receives lightweight,
authoritative summaries for its sections, then loads session rows only for the
collections that the current layout needs. Pinned and uncategorized sessions can
fill the initial viewport, collapsed or distant groups load no children, and an
expanded visible group such as Jesse loads its own rows through an independent
cursor. The UI renders the resulting async tree as one flattened virtual list.

## Motivation

The sidebar currently fetches a bounded page from the generic session list and
then partitions the loaded rows into persisted categories and derived sections.
That reverses the ownership boundary: pagination decides which rows exist before
the sidebar decides which collection owns them.

The visible consequences are misleading:

- A category can contain ten sessions while its expanded sidebar section shows
  only one because the other nine fall outside the global page.
- Loading another global page can make rows suddenly appear in several unrelated
  sections.
- A paginator rendered beside one section appears to own rows that are actually
  redistributed across the entire sidebar.
- Collapsed counts and attention indicators describe loaded rows rather than the
  complete collection.
- Fetching enough global pages to make every section complete loads sessions the
  operator may never view.

The sections also do not share one natural predicate. Named sections such as
Jesse and OpenClaw fixes are persisted categories. Groups is derived from session
kind. Coding is derived from worktree, exec-node, ACP, and catalog state. Other
is the remaining uncategorized collection. These collections share a visual
container, not one pagination lifecycle.

[openclaw/openclaw#126701](https://github.com/openclaw/openclaw/issues/126701)
records the user-visible failure.
[openclaw/openclaw#126708](https://github.com/openclaw/openclaw/pull/126708)
moves the global paginator out of Other as an immediate repair, but deliberately
does not make a truncated global roster authoritative for complete groups.

## Goals

- Make every sidebar section an explicit collection with one authoritative
  membership predicate.
- Return exact collection counts for local sidebar sections without loading
  their child rows.
- Return a collapsed attention signal from canonical session-attention facts,
  independent of loaded children.
- Load pinned and uncategorized rows needed for the initial viewport without
  scanning unrelated categories.
- Load children only for expanded collections that enter the virtualized
  viewport's overscan range.
- Complete ordinary small collections automatically in one request.
- Page unusually large collections automatically while the operator scrolls.
- Apply owner, status, agent, and other global filters identically to summaries
  and child pages.
- Keep section failures visible and independently retryable.
- Preserve user-defined section ordering, expansion state, drag and drop, and
  session actions.
- Bound row caches, request sizes, and rendered DOM size.

## Non-Goals

- Replacing the full Sessions page or its general-purpose grouping modes.
- Changing persisted category semantics or session-category mutation APIs.
- Adding an active-session count to collapsed headers.
- Treating running work as attention. Activity and attention remain distinct.
- Loading every collection at sidebar startup.
- Defining new persistent session state or advancing a SQLite schema version.
- Requiring every external catalog provider to expose an exact count before it
  can participate. Providers without exact summaries must report that
  limitation explicitly.

## Proposal

### Model the sidebar as an async tree

The sidebar becomes an async tree whose root contains collection summaries and
whose children are independently paginated sessions.

~~~text
Sidebar
├── Pinned
├── Other (uncategorized)
├── Jesse
├── OpenClaw fixes
├── Groups
├── Coding
└── Catalog-backed coding sections
~~~

The tree is a read model for navigation. It does not replace canonical session
storage or category ownership.

Each root node has a stable collection identifier and a typed collection kind:

~~~ts
type SidebarCollectionKind =
  | "pinned"
  | "uncategorized"
  | "category"
  | "group-conversations"
  | "coding"
  | "catalog";

type SidebarCollectionSummary = {
  id: string;
  kind: SidebarCollectionKind;
  label: string;
  totalCount: number | null;
  attention: "present" | "none" | "unknown";
  capabilities: {
    createSession: boolean;
    reorder: boolean;
  };
};
~~~

For OpenClaw-owned collections, `totalCount` is exact. `null` is reserved for
external providers that cannot produce an exact total without enumerating their
entire remote source. Unknown values must never be presented as zero.

### Keep membership precedence in one owner

The Gateway collection layer owns the same mutually exclusive membership
precedence for OpenClaw sessions:

1. pinned;
2. explicit persisted category;
3. group conversation;
4. coding session;
5. uncategorized.

An explicit category therefore continues to win over smart Groups or Coding
classification. The UI must not reproduce this precedence from row fields.

Catalog-backed sections remain provider-owned collections. Their adapter exposes
the same summary and page shapes, while preserving provider-specific errors and
capabilities.

### Separate summaries from children

The logical data source exposes two operations:

~~~ts
type SidebarFilters = {
  agentId?: string;
  owner?: string;
  involvement?: "all" | "mine";
  status: "active" | "archived" | "all";
};

type SidebarManifest = {
  generation: string;
  collections: SidebarCollectionSummary[];
};

type SidebarPage = {
  collectionId: string;
  rows: GatewaySessionRow[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
};

interface SidebarSessionDataSource {
  describe(filters: SidebarFilters): Promise<SidebarManifest>;
  load(input: {
    generation: string;
    filters: SidebarFilters;
    collectionId: string;
    first: number;
    after?: string;
  }): Promise<SidebarPage>;
}
~~~

The wire protocol may batch `describe` with known initial child demands to avoid
an extra round trip. Batching is a transport optimization; summaries and child
connections remain separate ownership concepts.

The `generation` is stale-response fencing and correlation only. It is not
authorization. A Gateway restart, filter change, or manifest replacement creates
a new generation and invalidates outstanding child work.

### Load according to rendered demand

The client keeps one cache entry per `(normalized filters, collection id)`.
Expansion and the virtualized render range determine demand:

| Section state | Summary | Child rows | Fetch behavior |
| --- | --- | --- | --- |
| Collapsed | Loaded | None required | No child request |
| Expanded, outside overscan | Loaded | Cached rows only | No new request |
| Expanded, entering overscan | Loaded | First page | Fetch automatically |
| Expanded small collection | Loaded | All rows | Complete in the first page |
| Expanded large collection | Loaded | Bounded pages | Fetch when its loader row nears overscan |
| Collapsed after loading | Loaded | Retained in bounded cache | Stop fetching |

The default initial demand gives pinned and uncategorized sessions enough rows to
fill the top viewport. If the operator reorders those sections outside the
initial range, they follow the same demand rules as every other collection.

The first-page bound should exceed the normal category size so a group such as
Jesse with ten sessions completes in one request. Very large collections use an
opaque cursor and automatic continuation. Normal navigation does not expose a
manual global **Load more sessions** control.

### Use one flattened virtual list

The UI flattens the expanded async tree into one render sequence:

~~~text
uncategorized-session
uncategorized-session
jesse-header
jesse-session
jesse-session
openclaw-fixes-header
coding-header
~~~

One virtualizer owns DOM range and overscan. It does not issue business queries
directly; it reports visible loader nodes to the sidebar data source. This avoids
one `IntersectionObserver` and request lifecycle per DOM section.

Section headers share one component with fixed trailing slots for:

- exact total count when available;
- attention dot when attention is present;
- provider error or unsupported-summary state when needed.

This also makes count and indicator alignment consistent across Coding, named
categories, Groups, Other, and catalog-backed sections.

### Derive attention from authoritative facts

The collapsed attention dot means at least one member requires operator
attention. It does not mean merely running, recently updated, or unread.

OpenClaw-owned collection summaries aggregate the canonical attention sources
already used by session rows:

- pending questions;
- pending approvals;
- unacknowledged failed or timed-out runs;
- unexpired agent-declared attention.

The summary predicate and child-page predicate must be identical. Attention must
not be inferred by scanning loaded children. Providers that cannot report this
fact return `unknown`; the client must not silently coerce unknown to none.

### Use stable per-collection cursors

Every collection connection has its own opaque cursor. Cursors bind to:

- normalized global filters;
- collection identity and membership predicate;
- stable ordering fields;
- the query generation.

Implementations should use keyset pagination over the canonical ordering tuple
rather than numeric offsets. A cursor from one collection or filter generation
is invalid for another and returns a typed stale-cursor result that tells the
client to reopen the collection.

### Apply global filters once

Global sidebar controls produce one normalized `SidebarFilters` value. The
Gateway applies that value to:

- every collection summary;
- every child page;
- every continuation;
- attention aggregation.

The UI never reconstructs continuation requests from a subset of filter fields.
Changing a global filter atomically replaces the manifest generation and all
visible child connections.

### Keep live updates collection-aware

Session and attention events invalidate or update the affected collection
summaries at their authoritative producer. Category changes name both the old
and new collections. Updates to unloaded collections change only their summary.
Updates to loaded collections patch the row when ordering remains valid or
refresh that collection when it does not.

The first implementation may use bounded collection invalidation rather than a
new granular delta protocol. It must not make the UI rederive membership from a
partial row cache.

### Preserve visible failure states

Manifest failure renders one sidebar-level retry state. A child-page failure
renders a retry row inside that section while leaving other sections usable.
Provider failure remains distinguishable from a successful empty collection.
Collapse cancels pending continuation where cancellation is available; late
responses are ignored by generation fencing.

### Bound caches and work

- Child page sizes have a hard maximum.
- The client cache is bounded by rows and least-recently-used collections.
- Collapsing retains useful cached rows but stops continuation.
- Reconnecting or changing global filters cancels or fences prior requests.
- Summaries may use one batched database query internally.
- Catalog adapters may batch provider work, but the UI sees the same collection
  contract.
- No runtime path repeatedly reloads process-stable plugin or catalog metadata.

### Implementation sequence

1. Introduce typed collection identities, membership predicates, and summary
   tests at the Gateway owner boundary.
2. Add the manifest and independent page contract with cursor/filter fencing.
3. Add a client sidebar data source keyed by filters and collection identity.
4. Replace row-derived counts and collapsed attention with summary data.
5. Flatten the async tree through the existing Lit virtualization stack.
6. Migrate persisted categories, Other, Groups, Coding, pinned rows, and catalog
   adapters one collection type at a time.
7. Add live invalidation, bounded caching, per-section retry, and cancellation.
8. Delete the sidebar's generic global-roster pagination and client-side
   completeness assumptions.

Each migration slice must preserve current drag and drop, menus, navigation,
owner/status filters, archived views, and session-attention behavior. The
implementation issue created after acceptance should define boundary tests and
real-browser proof for each slice.

## Rationale

### Prior art

The proposal follows established sidebar data-source patterns:

- [VS Code Tree Views](https://code.visualstudio.com/api/extension-guides/tree-view)
  separate top-level items from `getChildren(element)`, so collapsed nodes do
  not require child enumeration.
- [MUI Rich Tree View lazy loading](https://mui.com/x/react-tree-view/rich-tree-view/lazy-loading/)
  keeps child counts and child loading in a data-source cache rather than the
  rendered tree item.
- [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction)
  virtualizes one flattened range with bounded overscan. OpenClaw already uses
  the Lit adapter, so this proposal does not require a new virtualization
  dependency.
- The [Relay Cursor Connections specification](https://relay.dev/graphql/connections.htm)
  provides the conventional opaque-cursor and `pageInfo` shape used here
  without requiring GraphQL.

### Why not keep the global roster and regroup it?

Pagination happens before grouping, so no category count or expanded section can
be authoritative until every global page is loaded. Moving the paginator makes
the behavior less misleading but does not repair ownership or wasted work.

### Why not fetch every group at startup?

It makes counts accurate at the cost of loading every child row. Operators with
many categories or remote catalogs pay for sections they never open.

### Why not add only a category filter?

A category predicate fixes Jesse but not Other, Groups, Coding, pinned rows, or
catalog-backed sections. It creates a second pagination model without giving the
sidebar one collection abstraction.

### Why not attach an observer to every section?

DOM observation is useful for presentation, but making each header own request
state couples transport to rendering and produces uncontrolled request fanout.
One flattened virtual range and one data source provide the same lazy behavior
with centralized cancellation, caching, and stale-response fencing.

### Why an async tree?

The visual hierarchy already behaves like a tree: cheap section nodes expand
into session children. Async-tree data sources are a conventional fit for file
browsers and IDE sidebars because child ownership, caching, expansion, and
pagination remain explicit while rendering stays flat and virtualized.

## Unresolved questions

- What first-page and overscan budgets give the best initial latency on small
  and very large gateways?
- Should exact counts be mandatory for catalog providers, or should an explicit
  lower-bound count be supported in addition to `unknown`?
- Should pinned sessions remain a collection in the manifest or a separate
  bounded root payload?
- Which collection summaries can be maintained incrementally, and which should
  use invalidation plus a bounded refresh?
- Should the manifest and initial child demands share one Gateway method, or
  should batching remain an internal transport optimization?
- Which attention states should external catalog adapters be required to
  support before they can claim `attention: "none"`?
