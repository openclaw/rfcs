# Hosted Feed v1 Core Specification

This document defines the interoperable v1 catalog feed contract for RFC 0009,
Hosted Feeds for Plugins and Skills. The RFC explains the motivation and
rollout plan; this sidecar defines the wire shape publishers and clients use.

Status: draft, tied to RFC 0009.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative.

## Scope

This specification defines:

- the catalog feed document and entry shapes;
- plugin and skill install candidates;
- locally configured source profiles;
- entry state, refresh, validation, and fallback behavior;
- publisher and client conformance requirements.

It does not define signed envelopes, publisher following, publisher-feed discovery,
organization approval, artifact signing, malware scanning, or runtime policy.
Those are separate contracts.

Large-feed sharding, signed server-side queries, and incremental change
projections are defined in `hosted-feed-distribution-v1-spec.md`. A publisher
MUST NOT truncate this atomic document to remain within a local limit; it must
fail publication or expose the scalable representation.

## Wire Contract

The normative v1 publisher schema is the generated `CatalogFeedSchema` in the
ClawHub `clawhub-schema` package. The matching OpenClaw consumer is the hosted
official external plugin catalog parser. If prose or examples in this document
disagree with those shipped artifacts, that disagreement is a specification bug
and must be corrected before adding a second interpretation.

Publishers SHOULD serve unsigned feeds as `application/json`. Signed transport
uses the payload type defined by the signed-feed trust addendum. Clients MUST
validate the body and MUST NOT infer compatibility from the HTTP content type.

The v1 publisher schema is strict. Conforming publishers MUST NOT add fields
that are not defined here. A client MAY retain unknown fields for forward
compatibility, but MUST NOT assign install, trust, approval, or policy meaning
to them.

## Feed Document

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `schemaVersion` | integer | Yes | MUST be `1`. |
| `id` | string | Yes | Stable feed identity. |
| `generatedAt` | RFC 3339 string | Yes | Publication generation time. |
| `sequence` | non-negative safe integer | Yes | Monotonically increasing for this `id`. |
| `expiresAt` | RFC 3339 string | Yes | MUST be later than `generatedAt`. |
| `description` | string | No | Bounded human-readable feed description. |
| `entries` | array | Yes | Catalog entries. |

Example:

```json
{
  "schemaVersion": 1,
  "id": "clawhub-official",
  "generatedAt": "2026-07-15T00:00:00.000Z",
  "sequence": 42,
  "expiresAt": "2026-07-22T00:00:00.000Z",
  "description": "Official OpenClaw plugins published on ClawHub.",
  "entries": []
}
```

Publishers MUST increment `sequence` by exactly one when publishing a new
accepted revision.
Deleting or demoting an entry MUST NOT make the sequence decrease. Republished
bytes at the same sequence MUST be identical.

The atomic document is intentionally not cursor-paginated. Pagination without a
pinned revision can combine different catalog states and cannot be accepted as
one signed snapshot. Large complete feeds use a signed root plus immutable
shards; interactive search and changed-since retrieval use signed projections.

## Entry Object

Every v1 entry has exactly these fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `type` | string | Yes | `plugin` or `skill`. |
| `id` | string | Yes | Stable entry identity. |
| `title` | string | Yes | User-facing title. |
| `version` | string | Yes | Exact package version or immutable source revision. |
| `state` | string | Yes | One of the states below. |
| `publisher` | object | Yes | Publisher identity and catalog trust label. |
| `install` | object | Yes | One or more artifact candidates. |

The v1 entry schema does not define arbitrary entry `metadata`, `revision`, or
`description` fields. A future schema version may add bounded presentation or
provenance fields.

### Entry States

| State | Meaning |
| --- | --- |
| `available` | May be offered when source and policy checks pass. |
| `recommended` | May be highlighted; no additional install authority. |
| `disabled` | Known but intentionally unavailable from this feed. |
| `blocked` | Explicitly denied by this feed. |
| `deprecated` | Retained for migration but not preferred for new installs. |

When a publisher composes multiple inputs, the final state precedence SHOULD be:

```text
blocked > disabled > deprecated > recommended > available
```

The feed communicates final state only. It does not standardize the policy or
review process that produced that state.

## Publisher Object

The publisher object has exactly two fields:

```json
{
  "id": "openclaw",
  "trust": "official"
}
```

`trust` MUST be `official` or `community`. It describes the publisher's catalog
classification. It does not assert package safety, organization approval,
artifact integrity, runtime permission, or account-follow state.

## Install Candidates

`install.candidates` MUST contain at least one candidate. Every candidate has:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `sourceRef` | string | Yes | Name of a locally configured source profile. |
| `package` | string | Yes | Package name or stable package coordinate. |
| `version` | string | Yes | Exact version or immutable revision. |
| `integrity` | string | Yes | Artifact or selected-content integrity value. |
| `github` | object | No | Immutable GitHub source details. |

Candidates MUST NOT contain credentials, source base URLs, bearer tokens, SSH
material, or trust roots.

### Package Candidate

```json
{
  "sourceRef": "public-clawhub",
  "package": "@openclaw/acpx",
  "version": "1.2.3",
  "integrity": "sha256:0123456789abcdef"
}
```

### GitHub Candidate

A GitHub candidate retains the common candidate fields and adds a strict nested
`github` object:

```json
{
  "sourceRef": "public-github",
  "package": "@openclaw/review-pr",
  "version": "8d6b6f7f0d9d4d1e2e6d3d1234567890abcdef12",
  "integrity": "sha256:0123456789abcdef",
  "github": {
    "repo": "openclaw/skills",
    "path": "skills/review-pr",
    "commit": "8d6b6f7f0d9d4d1e2e6d3d1234567890abcdef12",
    "contentHash": "0123456789abcdef"
  }
}
```

`github.repo`, `github.path`, `github.commit`, and `github.contentHash` are all
required when `github` is present. `commit` MUST be immutable; branch names,
tags, and shortened commit hashes are invalid.

## Complete Entry Examples

Plugin:

```json
{
  "type": "plugin",
  "id": "@openclaw/acpx",
  "title": "ACP-X",
  "version": "1.2.3",
  "state": "recommended",
  "publisher": {
    "id": "openclaw",
    "trust": "official"
  },
  "install": {
    "candidates": [
      {
        "sourceRef": "public-clawhub",
        "package": "@openclaw/acpx",
        "version": "1.2.3",
        "integrity": "sha256:0123456789abcdef"
      }
    ]
  }
}
```

Community skill from GitHub:

```json
{
  "type": "skill",
  "id": "@example/review-pr",
  "title": "Review Pull Request",
  "version": "8d6b6f7f0d9d4d1e2e6d3d1234567890abcdef12",
  "state": "available",
  "publisher": {
    "id": "example",
    "trust": "community"
  },
  "install": {
    "candidates": [
      {
        "sourceRef": "public-github",
        "package": "@example/review-pr",
        "version": "8d6b6f7f0d9d4d1e2e6d3d1234567890abcdef12",
        "integrity": "sha256:0123456789abcdef",
        "github": {
          "repo": "example/skills",
          "path": "skills/review-pr",
          "commit": "8d6b6f7f0d9d4d1e2e6d3d1234567890abcdef12",
          "contentHash": "0123456789abcdef"
        }
      }
    ]
  }
}
```

## Source Profile Configuration

Feed and source profiles are local OpenClaw configuration under
`marketplaces`, not data supplied by a feed:

```json
{
  "marketplaces": {
    "feeds": {
      "partner-catalog": {
        "url": "https://packages.example.com/openclaw/feed.json"
      }
    },
    "sources": {
      "partner-packages": {
        "type": "npm"
      },
      "partner-github": {
        "type": "git"
      }
    }
  }
}
```

Source profile `type` MUST be `npm`, `clawhub`, or `git`. Endpoint and
credential selection are resolver concerns and are not fields in the v1 feed
wire contract. Unknown `sourceRef` values make that candidate unusable. If an
entry has no usable candidate, the client MUST NOT offer it for installation.

## Refresh And Fallback

Clients SHOULD:

1. Load a bundled fallback when one exists.
2. Refresh after runtime startup or through an explicit refresh command.
3. Use conditional HTTP requests with `ETag` or `Last-Modified`.
4. Bound URL, response size, read time, entry count, and string sizes.
5. Validate the complete feed before accepting a new snapshot.
6. Store accepted payload bytes and metadata atomically.
7. Reject signed rollback attempts with a lower sequence.
8. Use the last accepted snapshot during transient failures.
9. Report expired or stale content without silently granting new authority.

If a complete atomic feed exceeds configured limits, clients SHOULD discover a
sharded root representation when the selected profile supports it. Clients MAY
use signed query projections for interactive discovery and signed change
projections for incremental refresh, but MUST NOT mistake either for possession
of a complete snapshot.

Search and install rendering MUST consume accepted local state rather than
performing an unbounded request-time refresh.

## Rejection And Diagnostics

Clients MUST reject a feed before it affects install or search authority when:

- `schemaVersion` is unsupported;
- feed identity, timestamps, sequence, entries, or candidates are malformed;
- duplicate entry identities create ambiguity;
- no candidate resolves to a configured `sourceRef`;
- an immutable selector or required integrity value is missing;
- configured transport, payload, or shape limits are exceeded;
- signed verification required by the profile fails.

Diagnostics SHOULD identify the local profile, payload feed id when available,
sequence, failure category, and fallback source. They MUST NOT expose secrets,
credential-bearing URLs, local private paths, or package payload bytes.

## Publisher Conformance

A v1 publisher:

- emits the strict schema above with stable feed and entry identities;
- increments sequence monotonically;
- emits exact versions and required integrity values;
- keeps source endpoints, credentials, and trust roots out of entries;
- publishes positive and negative compatibility fixtures;
- serves stored publication bytes rather than rebuilding a different document
  for every read.

## Client Conformance

A v1 client:

- validates shape before accepting entries;
- keeps source and trust configuration local;
- separates discovery, install resolution, artifact integrity, and runtime
  policy;
- stores accepted snapshots atomically and preserves last-known-good fallback;
- preserves feed id, sequence, entry id, source ref, version, and integrity in
  install provenance;
- provides bounded refresh, verification, rejection, and fallback diagnostics.
