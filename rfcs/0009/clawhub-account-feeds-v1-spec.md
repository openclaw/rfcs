# ClawHub Account Feeds v1 Addendum Specification

This document defines the ClawHub account and publisher discovery-feed contract
associated with RFC 0009.

Status: draft addendum, tied to RFC 0009.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative.

## Scope

This addendum defines:

- stable account and publisher feed identity;
- the strict account-feed document and entry shapes;
- bounded pagination and refresh semantics;
- the boundary between following, discovery, trust, and installation;
- downstream registry provenance and diagnostics.

It does not define an installable catalog entry, package candidate, signed
account-feed payload type, notification transport, organization approval,
artifact trust, or security-scanning implementation.

## Relationship To Hosted Catalog Feeds

An account feed is a ClawHub discovery projection. It is not the Hosted Feed v1
install catalog defined by `hosted-feed-v1-spec.md`.

Account-feed entries identify public skills and plugins associated with an
account or publisher. A client that wants to install one of those entries MUST
resolve it through an accepted install catalog or another explicit package
resolver and MUST still apply source, integrity, scan, approval, and runtime
policy checks.

This distinction allows users to follow people and organizations without
turning social discovery into install authority.

## Wire Contract

The normative v1 schema is the generated `AccountFeedSchema` in the ClawHub
`clawhub-schema` package. The schema is strict. Conforming publishers MUST NOT
add unknown fields to a v1 document or entry.

## Feed Document

```json
{
  "schemaVersion": 1,
  "feedId": "clawhub.publisher.publishers:01JEXAMPLE",
  "scope": "publisher",
  "accountId": "users:01JEXAMPLE",
  "publisherId": "publishers:01JEXAMPLE",
  "handle": "openclaw",
  "displayName": "OpenClaw",
  "generatedAt": "2026-07-15T00:00:00.000Z",
  "sequence": 17,
  "entries": [],
  "nextCursor": null
}
```

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `schemaVersion` | integer | Yes | MUST be `1`. |
| `feedId` | string | Yes | Stable feed identity. |
| `scope` | string | Yes | `account` or `publisher`. |
| `accountId` | string or null | Yes | Stable account id when applicable. |
| `publisherId` | string or null | Yes | Stable publisher id when applicable. |
| `handle` | string or null | Yes | Current mutable public handle. |
| `displayName` | string | Yes | Current public display name. |
| `generatedAt` | RFC 3339 string | Yes | Projection generation time. |
| `sequence` | non-negative safe integer | Yes | Monotonic revision for this `feedId`. |
| `entries` | array | Yes | Ordered public discovery entries. |
| `nextCursor` | string or null | Yes | Opaque continuation cursor. |

An account-scoped feed MUST have a non-null `accountId`. A publisher-scoped
feed MUST have a non-null `publisherId`. The other identity may be present when
ClawHub has a public relationship between them.

Feed ids use stable opaque ids, not mutable handles:

```text
clawhub.account.<stable-id>
clawhub.publisher.<stable-id>
```

Changing a handle or display name MUST NOT change `feedId`.

## Entry Object

Every account-feed entry has exactly these fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `kind` | string | Yes | `skill` or `plugin`. |
| `id` | string | Yes | Stable ClawHub object or package identity. |
| `name` | string | Yes | Current package name or slug. |
| `displayName` | string | Yes | User-facing title. |
| `summary` | string or null | Yes | Bounded public summary. |
| `url` | string | Yes | Absolute HTTPS URL or origin-relative URL-reference for the canonical public ClawHub page. |
| `updatedAt` | number | Yes | Finite, non-negative Unix epoch time in milliseconds used for ordering. |

Example:

```json
{
  "kind": "plugin",
  "id": "packages:01JEXAMPLE",
  "name": "@openclaw/acpx",
  "displayName": "ACP-X",
  "summary": "ACP integration for OpenClaw.",
  "url": "https://clawhub.ai/plugins/@openclaw/acpx",
  "updatedAt": 1784073600000
}
```

An entry intentionally has no install candidate, artifact URL, integrity claim,
trust label, approval state, or scan result. Those facts have separate owners.

Clients MUST resolve an origin-relative `url` against the origin of the account
feed request, not against an unrelated configured catalog origin. Publishers
MUST order entries by descending `updatedAt` and MUST use a stable identity
tie-breaker when timestamps are equal.

## Pagination And Sequence

Account feeds are bounded projections. `nextCursor` is opaque and MUST NOT be
constructed or interpreted by clients. A client follows `nextCursor` until it
is null or until a local page/entry bound is reached.

The sequence identifies the logical feed revision, not an individual page.
Every page for one coherent revision SHOULD report the same `feedId`,
`generatedAt`, and `sequence`. A publisher MUST NOT derive sequence from the
newest visible entry timestamp because deletion or demotion could make it
decrease.

Cursor errors SHOULD return a bounded client error rather than silently
restarting at the first page. ClawHub MUST bound page size, scan work, response
size, and cursor lifetime.

## Public API

The initial ClawHub routes are:

```text
GET /api/v1/accounts/{accountId}
GET /api/v1/accounts/{accountId}/feed
GET /api/v1/publishers/{publisherId}
GET /api/v1/publishers/{publisherId}/feed
```

Detail routes expose public identity and profile facts. Feed routes expose the
strict discovery projection above. APIs SHOULD distinguish missing, non-public,
restricted, suspended, and temporarily unavailable identities without exposing
private moderation evidence.

## Following Semantics

Following is a reversible user preference. It MAY:

- include the identity in a followed-publisher list;
- include matching entries in discovery filters;
- produce bounded update notifications;
- explain why an entry appeared.

Following MUST NOT mean that:

- the publisher is official, reviewed, or trusted;
- an entry passed security scanning;
- an entry is locally or organization approved;
- an entry is installable;
- source, integrity, or runtime policy checks may be bypassed.

UI and APIs MUST use follow/following language rather than trust or approval
language.

## Privacy And Abuse Controls

Follower lists are private by default. Publishing an account feed MUST NOT
reveal who follows it.

Follow and unfollow operations SHOULD be authenticated, reversible, idempotent,
rate-limited, and separately mutable from notification preferences. Systems
SHOULD suppress self-follow notifications and make blocked, deleted, private,
or suspended identities explicit rather than representing them as successful
empty feeds.

## Trust And Signing Boundary

The signed-feed trust v1 addendum currently defines only the catalog payload
type `openclaw.official-external-plugin-catalog-feed.v1`. It MUST NOT be reused
for account-feed bytes.

Signed account feeds require a separately specified payload type, expected
identity binding, test vectors, and client implementation. Until that lands,
HTTPS transport and ClawHub origin identify the API source, but account-feed
content still grants discovery only and never install authority.

## Downstream Registry Consumption

A downstream registry MAY consume account feeds as discovery input, then
resolve selected entries through an install catalog and apply its own review,
scan, allow-list, block-list, and organization policy.

Derived records SHOULD preserve:

- account `feedId`, sequence, and cursor or page checksum;
- account and publisher ids when present;
- entry kind and stable id;
- the separately resolved catalog feed id, sequence, package version, source
  reference, and integrity value;
- downstream policy state and decision time.

Following state MUST NOT be translated into approval.

## Diagnostics

ClawHub and clients SHOULD distinguish:

- malformed account feed;
- missing, private, restricted, suspended, or deleted identity;
- invalid or expired cursor;
- bounded-scan or page-limit exhaustion;
- follow and unfollow outcomes;
- discovery results included because of a follow;
- catalog resolution failure for a discovered entry.

Diagnostics MUST NOT expose tokens, private profile data, moderation evidence,
unbounded URLs, package payload bytes, or private follower identities.

## ClawHub Conformance

A v1 account-feed publisher:

- emits the strict schema above using stable opaque identity;
- keeps mutable presentation values separate from feed identity;
- paginates deterministically with monotonic revision semantics;
- exposes public discovery facts only;
- keeps following separate from official, scan, approval, and install state;
- distinguishes unavailable identity states from successful empty feeds.

## Client Conformance

A v1 client:

- treats account entries as discovery references only;
- preserves account and publisher provenance;
- uses opaque bounded pagination;
- resolves installation through a separate accepted catalog path;
- displays follow state separately from trust, scan, review, and approval;
- provides bounded diagnostics for feed, follow, and catalog-resolution errors.
