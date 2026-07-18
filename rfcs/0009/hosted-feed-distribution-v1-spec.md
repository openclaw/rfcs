# Hosted Feed Distribution and Query v1 Addendum Specification

This document defines scalable snapshot, query, and incremental-refresh
transport for Hosted Feed v1. It builds on `hosted-feed-v1-spec.md` and the
signed transport in `signed-feed-trust-v1-spec.md`.

Status: draft addendum, tied to RFC 0009.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative.

## Scope

This addendum defines:

- signed root manifests and immutable catalog shards;
- signed, revision-bound query result pages;
- signed incremental change pages, including tombstones;
- cursor, consistency, retention-gap, and atomic-application rules.

It does not define ranking algorithms, access-control policy, package
installation, or artifact trust.

## Distribution Modes

A feed publisher MAY expose any combination of these representations:

1. **Atomic snapshot:** the complete Hosted Feed v1 document when it fits
   publisher and client limits.
2. **Sharded snapshot:** a signed root manifest referencing immutable,
   digest-addressed shards for complete synchronization.
3. **Query projection:** signed pages containing the ordered subset matching a
   bounded query at one feed revision.
4. **Change projection:** signed pages describing every change after a known
   sequence through one fixed target sequence.

Publishers MUST NOT silently truncate any representation. Query and change
projections do not prove that a client possesses the complete feed. A client
that requires complete offline state MUST accept an atomic or sharded snapshot.

## Payload-Type Binding

This addendum defines reusable representation shapes, not one universal signed
payload type. Each concrete feed contract MUST assign a distinct versioned
payload type to each representation it accepts. For example, ClawHub publisher
feeds use `openclaw.clawhub-publisher-feed-snapshot.v1`,
`openclaw.clawhub-publisher-feed-query-results.v1`, and
`openclaw.clawhub-publisher-feed-changes.v1`. Its sharded root uses
`openclaw.clawhub-publisher-feed-shard-root.v1`.

The official external plugin install catalog uses these exact scalable
representation types:

- `openclaw.official-external-plugin-catalog-shard-root.v1`;
- `openclaw.official-external-plugin-catalog-query-results.v1`;
- `openclaw.official-external-plugin-catalog-changes.v1`.

The official ClawHub skills catalog shard root uses
`openclaw.official-skills-catalog-shard-root.v1`. Any query or change
representations for that catalog, and all other install catalogs, MUST assign
their own distinct types before use. A verifier MUST reject a valid signature
whose payload type does not match the selected feed class and representation.

This prevents a signed discovery projection from being replayed as an install
catalog, or one feed operator's response from being interpreted under another
schema.

All v1 documents and nested objects in this addendum are strict and MUST reject
unknown fields. `feedId` is 1 to 256 UTF-8 bytes. Cursor strings are at most
4096 UTF-8 bytes. URLs are at most 2048 UTF-8 bytes. Timestamp strings are at
most 64 UTF-8 bytes and MUST be valid RFC 3339 instants.

## Sharded Snapshot Root

```json
{
  "schemaVersion": 1,
  "feedId": "clawhub-official",
  "sequence": 42,
  "generatedAt": "2026-07-16T00:00:00.000Z",
  "expiresAt": "2026-07-23T00:00:00.000Z",
  "metadata": {
    "description": "Official OpenClaw plugins published on ClawHub."
  },
  "entryCount": 2450,
  "shards": [
    {
      "index": 0,
      "url": "https://clawhub.ai/v1/feeds/plugins/shards/sha256-abc.json",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "byteLength": 524288,
      "entryCount": 500
    }
  ]
}
```

The root fields are strict:

| Field | Type | Semantics |
| --- | --- | --- |
| `schemaVersion` | integer | MUST be `1`. |
| `feedId` | string | Stable feed identity. |
| `sequence` | non-negative safe integer | Complete snapshot revision. |
| `generatedAt` | RFC 3339 string | Root publication time. |
| `expiresAt` | RFC 3339 string | Root and shard-set expiry. |
| `metadata` | object | Complete feed-level metadata defined by the concrete payload type. |
| `entryCount` | non-negative safe integer | Exact entries across all shards. |
| `shards` | array | Ordered immutable shard descriptors. Empty only when `entryCount` is zero. |

Each shard descriptor has exactly these fields:

| Field | Type | Semantics |
| --- | --- | --- |
| `index` | non-negative safe integer | Position in the root's shard array. |
| `url` | string | Immutable HTTPS shard URL. |
| `sha256` | string | Exact lowercase hexadecimal digest described below. |
| `byteLength` | positive safe integer | Exact response-byte length, at most 1 MiB. |
| `entryCount` | positive safe integer | Exact shard entry count, at most 10,000. |

When `entryCount` is zero, `shards` MUST be empty. Otherwise `shards` MUST be
non-empty and indexes MUST be contiguous from zero. URLs MUST use HTTPS and
satisfy the selected feed profile's origin policy. `sha256` is exactly 64
lowercase hexadecimal characters encoding the 32-byte SHA-256 digest of the
decoded representation-data bytes after HTTP content decoding. `byteLength`
is the length of those same decoded bytes, independent of gzip, Brotli, or
another transfer/content encoding. `entryCount` is exact. Publishers MUST serve
the same decoded representation bytes for a shard URL regardless of negotiated
HTTP encoding.

Descriptor URLs MUST be unique within a root, and descriptor digests MUST be
unique within a root. The sum of descriptor `entryCount` values MUST equal the
root `entryCount`; the sum of descriptor `byteLength` values is the aggregate
shard-set size used for the limit below.

A shard document has exactly these fields:

| Field | Type | Semantics |
| --- | --- | --- |
| `schemaVersion` | integer | MUST be `1`. |
| `feedId` | string | MUST match the signed root. |
| `sequence` | non-negative safe integer | MUST match the signed root. |
| `index` | non-negative safe integer | MUST match the descriptor. |
| `entries` | array | Entries validated by the concrete feed contract. |

Entries across the shard set MUST have unique identities and deterministic
global ordering. A root contains at most 1024 shards and 1,000,000 entries and
is at most 1 MiB. The aggregate shard set is at most 256 MiB. A concrete feed
contract MAY impose lower limits but MUST NOT raise these v1 maxima.

The official external plugin catalog root metadata has exactly `description`,
which is a string of at most 1024 UTF-8 bytes or null. Publisher-feed root
metadata has exactly `publisherId`, `handle`, and `displayName`, with the types
and bounds in the publisher-feed addendum. Other root payload types MUST define
their complete strict metadata object before use.

Publishers MUST write every immutable shard before publishing the signed root.
They MUST NOT mutate bytes at a published shard URL. Clients MUST verify the
signed root, enforce aggregate byte, shard, and entry limits, fetch every shard,
verify lengths and digests, validate all entries, and atomically replace the
prior root and shard set only after the entire snapshot succeeds.

Shards are authenticated by their exact byte length and digest in the signed
root and are not independently DSSE-signed. A client that persists a sharded
snapshot MUST retain the exact accepted root payload and exact shard bytes, or
an equivalent lossless representation. Before using that snapshot as fallback,
it MUST reverify the root under the currently selected trust policy, reject an
expired root using the current load time, and reverify every retained shard's
length and digest before parsing or exposing entries. A partial or expired
cached shard set MUST fail closed; it MUST NOT replace or extend the root's
validity window.

## Signed Query Projection

```json
{
  "schemaVersion": 1,
  "feedId": "clawhub.publisher.publishers:01JEXAMPLE",
  "sequence": 17,
  "generatedAt": "2026-07-16T00:00:00.000Z",
  "expiresAt": "2026-07-16T00:05:00.000Z",
  "query": {
    "text": "cuda",
    "kinds": ["plugin", "skill"]
  },
  "requestCursor": null,
  "pageIndex": 0,
  "startIndex": 0,
  "resultCount": 0,
  "entries": [],
  "nextCursor": null
}
```

The query object is a strict normalized representation of the request. A
concrete feed contract defines its allowed filters. ClawHub publisher-feed v1
allows `text` and `kinds`; the install catalog may additionally allow entry
states and publisher ids. Arrays MUST be sorted and deduplicated. Omitted
filters are absent from the normalized query object. Publisher-defined ranking is
allowed, but ordering MUST be deterministic for a given query and sequence.

Text normalization is exact: decode valid UTF-8, normalize to Unicode NFC,
trim leading and trailing ASCII whitespace characters (`U+0009` through
`U+000D` and `U+0020`), and replace each remaining run of those characters with
one `U+0020`. Case is preserved; matching and ranking may be case-insensitive
but do not change the signed query value. Enum values use the lowercase
spellings in their defining schema. Arrays are deduplicated and sorted by
lexicographic UTF-8 byte order. An omitted filter is absent from the query
object. Empty text and empty arrays are invalid and MUST NOT be treated as
omitted. Clients compare the parsed normalized query structurally, not by JSON
object member order.

Every page MUST repeat the same normalized query, feed id, sequence, and expiry.
It MUST include `requestCursor`, exactly matching the cursor sent for that
request or null for the first page, plus a zero-based `pageIndex`. The opaque
`nextCursor` MUST be integrity-protected and bound to those values plus any
access-control context needed to prevent replay across principals. A client
MUST verify `requestCursor` and the expected page index before accepting a page.
A cursor MUST NOT continue against a newer feed revision. Publishers SHOULD
return a bounded conflict or reset response when the pinned revision is gone.

A valid signature authenticates the returned projection and the publisher's
claim that it matches the bound query at that revision. It does not make an
entry installable or prove that the client has synchronized the complete feed.

A query page has exactly these fields:

| Field | Type | Semantics |
| --- | --- | --- |
| `schemaVersion` | integer | MUST be `1`. |
| `feedId` | string | Bound feed identity. |
| `sequence` | non-negative safe integer | Pinned feed revision. |
| `generatedAt` | RFC 3339 string | Page generation time. |
| `expiresAt` | RFC 3339 string | MUST be later than `generatedAt`. |
| `query` | object | Strict normalized filters defined by the concrete payload type. |
| `requestCursor` | string or null | Exact request cursor; null on page zero. |
| `pageIndex` | non-negative safe integer | Zero-based page position. |
| `startIndex` | non-negative safe integer | Global result offset of the first entry. |
| `resultCount` | non-negative safe integer | Exact matching entries across all pages. |
| `entries` | array | At most 200 entries using the concrete feed entry schema. |
| `nextCursor` | string or null | Integrity-protected continuation. |

A query page is at most 1 MiB. For publisher-feed query payloads, `query` has
only optional `text` and `kinds` fields. `text` is 1 to 256 UTF-8 bytes after
normalization. `kinds` is a sorted, deduplicated, non-empty subset of `plugin`
and `skill`. At least one query field MUST be present. The official install
catalog query has only optional `text`, `types`, `states`, and `publisherIds`.
`text` has the same bound; `types` is a non-empty subset of `plugin` and
`skill`; `states` is a non-empty subset of the Hosted Feed v1 entry states; and
`publisherIds` is a sorted, deduplicated array of 1 to 100 publisher ids, each
1 to 256 UTF-8 bytes. At least one query field MUST be present.

The first query page MUST have `startIndex: 0`. Every continuation page's
`startIndex` MUST equal the prior page's `startIndex + entries.length`.
`resultCount` MUST be identical on every page, and a terminal page MUST end
exactly at `resultCount`. Clients MUST reject a gap, overlap, or premature
terminal page.

## Signed Change Projection

```json
{
  "schemaVersion": 1,
  "feedId": "clawhub.publisher.publishers:01JEXAMPLE",
  "fromSequence": 14,
  "toSequence": 16,
  "generatedAt": "2026-07-16T00:00:00.000Z",
  "expiresAt": "2026-07-16T00:05:00.000Z",
  "requestCursor": null,
  "pageIndex": 0,
  "startIndex": 0,
  "changeCount": 2,
  "changes": [
    {
      "sequence": 15,
      "operation": "upsert",
      "entry": {
        "kind": "skill",
        "id": "skills:01JEXAMPLE",
        "name": "cuda-helper",
        "displayName": "CUDA Helper",
        "summary": "Tools for CUDA development.",
        "url": "/example/cuda-helper",
        "updatedAt": 1784160000000
      }
    },
    {
      "sequence": 16,
      "operation": "remove",
      "entryId": "skills:01JRETIRED",
      "entryKind": "skill"
    }
  ],
  "nextCursor": null
}
```

`fromSequence` is the client's accepted revision and is exclusive.
`toSequence` is the fixed target revision and is inclusive. Every continuation
page MUST remain pinned to this range and carry the exact request cursor and
expected zero-based page index as defined for query projections. Changes MUST
be ordered by sequence and a stable within-sequence order. An `upsert` carries
the complete current entry. A `remove` tombstone carries the stable entry id and
type.

A concrete change payload MAY also carry a metadata record with exactly
`sequence`, `operation: "metadata"`, and `metadata`. The metadata object is the
same complete strict object used by that feed's sharded root. A publisher-feed
metadata record therefore replaces `publisherId`, `handle`, and `displayName`
together; an install-catalog metadata record replaces `description`.

Publishers MUST emit tombstones when an entry is deleted, made private, or
otherwise leaves the requesting principal's effective feed. In a discovery
feed, a blocked entry that is no longer publicly discoverable uses a tombstone.
In an install catalog, `blocked` is an explicit deny with composition precedence
and MUST be emitted as a complete upsert carrying that state; it MUST NOT be
converted to a removal. A changed-items endpoint that omits required removals
or explicit deny-state upserts is not conformant.

A change page has exactly these fields:

| Field | Type | Semantics |
| --- | --- | --- |
| `schemaVersion` | integer | MUST be `1`. |
| `feedId` | string | Bound feed identity. |
| `fromSequence` | non-negative safe integer | Exclusive accepted revision. |
| `toSequence` | non-negative safe integer | Inclusive pinned target; not below `fromSequence`. |
| `generatedAt` | RFC 3339 string | Page generation time. |
| `expiresAt` | RFC 3339 string | MUST be later than `generatedAt`. |
| `requestCursor` | string or null | Exact request cursor; null on page zero. |
| `pageIndex` | non-negative safe integer | Zero-based page position. |
| `startIndex` | non-negative safe integer | Global change-record offset of the first record. |
| `changeCount` | non-negative safe integer | Exact records across all pages. |
| `changes` | array | At most 500 ordered change records. |
| `nextCursor` | string or null | Integrity-protected continuation. |

An upsert record has exactly `sequence`, `operation: "upsert"`, and `entry`.
The entry uses the concrete feed entry schema. A remove record has exactly
`sequence`, `operation: "remove"`, `entryId`, and the concrete schema's entry
discriminator: `entryKind` for publisher feeds or `entryType` for install
catalogs. Sequence values are
non-negative safe integers in `(fromSequence, toSequence]`; entry ids are 1 to
256 UTF-8 bytes. A change page is at most 1 MiB.

Every feed revision in `(fromSequence, toSequence]` MUST have at least one
change record, including a metadata record for a metadata-only revision. The
first page MUST have `startIndex: 0`. Every continuation page's `startIndex`
MUST equal the prior page's `startIndex + changes.length`; `changeCount` MUST be
identical on every page; and a terminal page MUST end exactly at `changeCount`.
These offsets, page indexes, cursor chaining, and per-revision records make
gaps and overlaps detectable.

Clients MUST verify and collect every page through `nextCursor: null`, reject a
missing revision, offset gap, overlap, identity mismatch, or range change, then
apply the full change set atomically. They MUST NOT advance their accepted
sequence after only part of a paginated change set.

Publishers MAY retain a bounded change history. If `fromSequence` predates that
history, the endpoint MUST return an explicit reset-required response and the
current snapshot/root location or revision. It MUST NOT return a partial delta
as if it were complete. Clients then perform a full atomic or sharded refresh.

The reset response is signed with the same concrete change payload type and is
a strict alternative to a change page. It contains exactly `schemaVersion: 1`,
`feedId`, `fromSequence`, `currentSequence`, `generatedAt`, `expiresAt`,
`resetRequired: true`, and `snapshotUrl`. The sequence values are non-negative
safe integers, `currentSequence` is greater than `fromSequence`, and
`snapshotUrl` is an HTTPS URL for the feed's atomic snapshot or signed shard
root. It MUST satisfy the selected feed profile's origin policy before any
request is made. Clients MUST NOT forward credentials across origins and MUST
verify this response before changing accepted state.

## Access Control

For private publisher, named, organization, or composed feeds, the publisher
MUST authorize the request before selecting or signing entries. Cursors MUST be
bound to the authorization context without exposing user identifiers or ACLs.
A signed response authenticates what the feed operator served; it does not
grant access to another principal or bypass downstream policy.

## Conformance

A conforming publisher:

- never silently truncates snapshots, query results, or change history;
- pins every paginated operation to one immutable revision or range;
- emits removal tombstones and explicit reset-required responses;
- publishes immutable shards before the signed root;
- signs each atomic snapshot, root, query page, and change page with the
  concrete feed contract's distinct payload type.

A conforming client:

- enforces per-response and aggregate bounds;
- binds query and change continuations to the initial request and revision;
- verifies all shard digests and all signed projection pages;
- reverifies current root trust, expiry, and retained shard bytes before using
  a cached sharded snapshot;
- applies complete snapshots and complete change ranges atomically;
- falls back to a full snapshot after an explicit retention gap.
