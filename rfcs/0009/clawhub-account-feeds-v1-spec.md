# ClawHub Publisher Feeds v1 Addendum Specification

This document defines the ClawHub publisher discovery-feed contract associated
with RFC 0009. The historical filename is retained to avoid breaking links
while the addendum is under review.

Status: draft addendum, tied to RFC 0009.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative.

## Scope

This addendum defines:

- stable publisher feed identity;
- the strict publisher-feed document and entry shapes;
- bounded pagination and refresh semantics;
- public publisher-follow discovery;
- item-watch and durable notification-inbox semantics;
- the boundary between following, discovery, trust, and installation;
- downstream registry provenance and diagnostics.

It does not define a separate account feed, installable catalog entries,
package candidates, concrete push or channel transports, organization
approval, artifact trust, or security scanning.

Publisher feeds are the first rollout target for the reusable query and change
contracts in `hosted-feed-distribution-v1-spec.md`. A publisher with hundreds of
skills or plugins must remain discoverable without requiring one unbounded
response.

Signed complete publisher snapshots use payload type
`openclaw.clawhub-publisher-feed-snapshot.v1`. Signed publisher query pages use
payload type
`openclaw.clawhub-publisher-feed-query-results.v1`. Signed publisher change
pages use `openclaw.clawhub-publisher-feed-changes.v1`. These payload types MUST
NOT be accepted as install catalogs. A sharded complete publisher-feed root uses
`openclaw.clawhub-publisher-feed-shard-root.v1`.

## Publisher Identity

ClawHub publishers are the public identity for both people and organizations.
Internal user or membership records are authentication and ownership details;
they are not separate public feed identities.

A publisher feed MUST use the stable publisher id, not a mutable handle,
display name, profile URL, linked user id, or organization membership id.

```text
clawhub.publisher.<stable-publisher-id>
```

Changing a handle, display name, members, or owners MUST NOT change the feed id.

## Relationship To Hosted Catalog Feeds

A publisher feed is a ClawHub discovery projection. It is not the Hosted Feed
v1 install catalog defined by `hosted-feed-v1-spec.md`.

Publisher-feed entries identify public skills and plugins associated with a
publisher. To install one, a client MUST resolve it through an accepted install
catalog or another explicit package resolver and MUST still apply source,
integrity, scan, approval, and runtime policy checks.

## Wire Contract

The normative v1 schema is the generated `PublisherFeedSchema` in the ClawHub
schema package. The schema is strict. Conforming publishers MUST NOT add unknown
fields to a v1 document or entry.

## Feed Document

```json
{
  "schemaVersion": 1,
  "feedId": "clawhub.publisher.publishers:01JEXAMPLE",
  "publisherId": "publishers:01JEXAMPLE",
  "handle": "openclaw",
  "displayName": "OpenClaw",
  "generatedAt": "2026-07-16T00:00:00.000Z",
  "sequence": 17,
  "entries": [],
  "nextCursor": null
}
```

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `schemaVersion` | integer | Yes | MUST be `1`. |
| `feedId` | string | Yes | `clawhub.publisher.<publisherId>`, 1 to 256 UTF-8 bytes. |
| `publisherId` | string | Yes | Stable ClawHub publisher id, 1 to 200 UTF-8 bytes. |
| `handle` | string or null | Yes | Current mutable public handle, 1 to 64 UTF-8 bytes when present. |
| `displayName` | string | Yes | Current public display name, 1 to 256 UTF-8 bytes. |
| `generatedAt` | RFC 3339 string | Yes | Generation time for this logical revision. |
| `sequence` | non-negative safe integer | Yes | Monotonic revision for this `feedId`. |
| `entries` | array | Yes | At most 200 ordered public discovery entries. |
| `nextCursor` | string or null | Yes | Opaque continuation cursor, at most 4096 UTF-8 bytes. |

Every page for one coherent revision SHOULD report the same `feedId`,
`generatedAt`, and `sequence`. A publisher MUST NOT derive `sequence` from the
newest visible entry timestamp because deletion or demotion could make it
decrease.

Each new accepted publisher-feed revision MUST increment `sequence` by exactly
one. Re-serving the same revision MUST preserve the same sequence and logical
content.

## Entry Object

Every publisher-feed entry has exactly these fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `kind` | string | Yes | `skill` or `plugin`. |
| `id` | string | Yes | Stable ClawHub object or package identity, 1 to 256 UTF-8 bytes. |
| `name` | string | Yes | Current package name or slug, 1 to 256 UTF-8 bytes. |
| `displayName` | string | Yes | User-facing title, 1 to 256 UTF-8 bytes. |
| `summary` | string or null | Yes | Public summary, at most 1024 UTF-8 bytes. |
| `url` | string | Yes | Canonical public ClawHub page URL or safe origin-relative reference, at most 2048 UTF-8 bytes. |
| `updatedAt` | number | Yes | Finite, non-negative Unix epoch time in milliseconds. |

An entry intentionally has no install candidate, artifact URL, integrity claim,
official status, approval state, or scan result. Those facts have separate
owners.

Clients MUST resolve an origin-relative `url` against the origin of the
publisher-feed request. Publishers MUST reject backslashes, control characters,
protocol-relative references, and any reference that resolves away from that
origin.

Publishers MUST order entries by descending `updatedAt` and MUST use stable
kind and object-identity tie-breakers when timestamps are equal.

## Pagination And Revision

`nextCursor` is opaque and MUST NOT be constructed or interpreted by clients. A
client follows it until it is null or a local page or entry bound is reached.

ClawHub MUST preserve deterministic ordering across page boundaries and MUST
NOT report `nextCursor: null` when a bounded scan stopped before all eligible
entries were considered. Cursor errors SHOULD return a bounded client error
rather than silently restarting at the first page.

ClawHub MUST bound requested and effective page size, indexed scan work,
response bytes, and cursor lifetime. A page contains at most 200 entries and is
at most 1 MiB; a cursor is at most 4096 UTF-8 bytes and expires within 15
minutes. Cursor expiry MUST return a bounded client error rather than restart.

If ClawHub cannot yet provide coherent monotonic revisions and deterministic
continuation, it MUST label the route experimental rather than publish it as a
stable v1 feed contract.

### Search And Changed-Since Retrieval

ClawHub SHOULD expose signed publisher-feed query projections for bounded text
and kind filters. Query cursors MUST bind the stable publisher id, feed
revision, normalized query, and authorization context.

ClawHub SHOULD also expose signed publisher-feed change projections from a
caller's accepted sequence. The change stream MUST include complete upserts and
tombstones for content that is deleted, blocked, made private, or transferred
away from the publisher. All pages MUST be pinned to one `toSequence`, and a
client MUST apply them atomically.

If the requested publisher-feed revision is older than retained change history,
ClawHub MUST require a full publisher-feed refresh. It MUST NOT silently return
only the retained tail. These projections remain discovery data; installation
still resolves entries through an accepted install catalog.

### Signed Complete Snapshot

`GET /api/v1/publishers/{publisherId}/feed/snapshot` returns a DSSE envelope
whose payload type is `openclaw.clawhub-publisher-feed-snapshot.v1`. Its decoded
payload is a strict complete publisher feed with exactly `schemaVersion`,
`feedId`, `publisherId`, `handle`, `displayName`, `generatedAt`, `expiresAt`,
`sequence`, and `entries`. It has no cursor and MUST NOT be truncated.

The payload repeats the identity and entry bounds above, contains at most 400
entries, and is at most 1 MiB. `expiresAt` is an RFC 3339 instant later than
`generatedAt`. A client MUST verify the envelope, expected payload type,
publisher-derived feed id, expiry, response bounds, and entry uniqueness before
atomically replacing accepted state. This discovery snapshot does not grant
install authority.

## Public API

The initial publisher routes are:

```text
GET /api/v1/publishers/{publisherId}
GET /api/v1/publishers/{publisherId}/feed
GET /api/v1/publishers/{publisherId}/feed/snapshot
```

ClawHub does not expose parallel `/accounts` feed routes. Publisher detail may
include public profile facts and a canonical feed URL, but MUST NOT expose
private owner, member, linked-user, moderation, or authentication records.

APIs SHOULD distinguish missing, non-public, restricted, suspended, and
temporarily unavailable publishers without exposing private moderation
evidence.

## Following And Timeline

Following a publisher is a reversible discovery preference. It MAY:

- include the publisher in public follower and following lists;
- include matching entries in discovery filters;
- populate a pull-based activity timeline;
- explain why an entry appeared.

Follower and following lists are public social-discovery data. Notification and
mute preferences remain private. Follow and unfollow operations SHOULD be
authenticated, idempotent, rate-limited, and based on stable publisher ids.

ClawHub SHOULD prefer a timeline over per-publication notification fanout. A
high-volume publisher can publish hundreds of entries, and following that
publisher does not imply that every publish deserves an alert.

ClawHub SHOULD separately support authenticated item watches and a durable
account notification inbox using the distribution addendum's watch contract.
An item watch is explicit alert intent and may synchronize across OpenClaw,
Control UI, and ClawHub clients. Following a publisher MUST NOT automatically
create one item alert per publication.

OpenClaw MAY offer to watch installed content and synchronize those watches to
the account inbox. That synchronization requires an explicit account setting
because it discloses installed-item identities. Without it, OpenClaw may keep
installed-item watches local while still consuming explicit account watches.

Inbox delivery is a hint. OpenClaw or Control UI MUST verify the referenced
signed publisher or catalog change before presenting an actionable update, and
an alert MUST NOT install, update, enable, approve, or remove content.

Following MUST NOT mean that a publisher is official, reviewed, trusted,
scanned, approved, or installable. UI and APIs MUST use follow/following
language rather than trust or approval language.

## Client Consumption

A client MAY expose a command such as:

```text
openclaw publisher follow <handle>
```

The handle is a lookup convenience only. The client MUST resolve it through
ClawHub and persist or transmit the stable publisher id. Feed URLs remain
machine-readable API discovery, not a required profile-page control.

## Trust And Signing Boundary

The atomic publisher-feed snapshot MUST use
`openclaw.clawhub-publisher-feed-snapshot.v1` and MUST NOT reuse
`openclaw.official-external-plugin-catalog-feed.v1`. Its complete sharded
representation, plus signed query and change projections, use the distinct
payload types defined above and the strict distribution-addendum schemas. Each
requires expected publisher-feed identity binding, test vectors, and explicit
client verifier registration.

All publisher-feed representations MAY use the same dedicated ClawHub platform
feed-signing key and bundled public trust anchor as other ClawHub-operated
feeds, but each payload type remains distinct from install-catalog authority.

Until the corresponding producer and verifier for a representation land, HTTPS
transport and ClawHub origin identify the API source, but publisher-feed content
still grants discovery only and never install authority.

## Downstream Registry Consumption

A downstream registry MAY consume publisher feeds as discovery input, resolve
selected entries through an install catalog, and apply its own review, scan,
allow-list, block-list, and organization policy.

Derived records SHOULD preserve the publisher feed id and revision, publisher
id, entry kind and stable id, separately resolved catalog provenance, and the
downstream decision. Following state MUST NOT be translated into approval.

## Diagnostics

ClawHub and clients SHOULD distinguish malformed feeds, non-public publishers,
invalid cursors, bounded-scan exhaustion, follow outcomes, timeline query
limits, and catalog resolution failures.

Diagnostics MUST NOT expose tokens, private profile or membership data,
moderation evidence, package payload bytes, or private notification settings.

## Conformance

A v1 publisher-feed producer:

- uses stable publisher identity only;
- exposes only public publisher and entry facts;
- emits deterministic bounded pages and monotonic revisions;
- keeps following separate from trust and install authority;
- does not expose internal account, ownership, or moderation state.

A client:

- treats the feed as discovery rather than install authority;
- resolves entries through an accepted catalog before installation;
- stores stable publisher ids rather than mutable handles;
- bounds pagination and reports unavailable or malformed state;
- keeps item-watch alerts separate from ClawHub publisher following;
- verifies referenced signed feed state before presenting actionable alerts.
