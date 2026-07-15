# ClawHub Account Feeds v1 Addendum Specification

This document is the implementer-facing account-feed addendum for RFC 0009
hosted feeds. It builds on the core feed specification and the signed-feed trust
addendum.

Status: draft addendum, tied to RFC 0009.

## Scope

This addendum defines:

- ClawHub account and publisher feed identity;
- account-feed metadata;
- account feed entries for plugins and skills;
- the boundary between following and install authority;
- user-facing account feed discovery states;
- downstream registry consumption of ClawHub account-feed facts;
- diagnostics and provenance requirements.

This addendum does not define:

- the core feed document shape;
- signed envelope mechanics;
- package artifact trust;
- security scanning implementation;
- self-service claim workflows;
- organization-admin approval workflows;
- notification delivery protocols beyond feed/follow semantics.

## Model

ClawHub can publish feeds for stable account or publisher identities. These
feeds let OpenClaw and downstream registries discover the packages associated
with a publisher without treating account following as a security or install
grant.

An account feed is still a normal hosted feed. It should use the core v1 feed
shape for entries and the signed-feed trust addendum for authenticity. The
account-feed addendum defines the feed identity and metadata conventions around
that core payload.

## Identity

Account feeds must use stable ClawHub identity, not mutable display names.

Recommended feed ids:

```text
clawhub-account:<account-id>
clawhub-publisher:<publisher-id>
clawhub-org:<organization-id>
```

Display handles, names, avatars, bios, and URLs are metadata. They may change
without changing feed identity.

## Feed Metadata

Account feeds should carry bounded account metadata in `metadata`.

```json
{
  "schemaVersion": 1,
  "id": "clawhub-publisher:openclaw",
  "generatedAt": "2026-07-15T00:00:00.000Z",
  "sequence": 17,
  "expiresAt": "2026-07-22T00:00:00.000Z",
  "metadata": {
    "kind": "clawhubPublisherFeed",
    "publisherId": "openclaw",
    "handle": "openclaw",
    "displayName": "OpenClaw",
    "profileUrl": "https://clawhub.ai/creators/openclaw",
    "officialState": "official"
  },
  "entries": []
}
```

Recommended metadata fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `kind` | string | Yes | `clawhubAccountFeed`, `clawhubPublisherFeed`, or `clawhubOrganizationFeed`. |
| `accountId` | string | Conditional | Stable account id for account feeds. |
| `publisherId` | string | Conditional | Stable publisher id for publisher feeds. |
| `organizationId` | string | Conditional | Stable organization id for organization feeds. |
| `handle` | string | Optional | Current display handle. |
| `displayName` | string | Optional | Current display name. |
| `profileUrl` | string | Optional | Human-facing ClawHub profile URL. |
| `claimState` | string | Optional | Publisher claim state when known. |
| `officialState` | string | Optional | ClawHub official-state fact when known. |
| `restrictionState` | string | Optional | Suspended, restricted, or normal state when known. |

Metadata fields are facts from ClawHub. They do not by themselves grant install
authority.

## Entry Requirements

Entries in account feeds must use the core feed entry shape. Account-feed
entries should preserve the account or publisher provenance in bounded metadata:

```json
{
  "type": "plugin",
  "id": "acpx",
  "title": "ACP-X",
  "version": "1.2.3",
  "state": "available",
  "publisher": {
    "id": "openclaw",
    "trust": "official"
  },
  "metadata": {
    "clawhub": {
      "publisherId": "openclaw",
      "packageId": "acpx",
      "packageUrl": "https://clawhub.ai/packages/acpx"
    }
  },
  "install": {
    "candidates": [
      {
        "sourceRef": "public-clawhub",
        "package": "acpx",
        "version": "1.2.3",
        "integrity": "sha512-..."
      }
    ]
  }
}
```

Account feeds may include plugins, skills, or both. Clients must not route a
skill through the plugin installer merely because both appear in one account
feed.

## Following Semantics

Following a ClawHub account, publisher, or organization is a discovery and
notification preference. It means:

- show the followed identity in the user's followed-publisher list;
- optionally include matching entries in discovery filters;
- optionally notify the user when the publisher adds or updates packages;
- preserve provenance so the user can see why an entry appeared.

Following does not mean:

- the publisher is official;
- the package is OpenClaw-reviewed;
- the package passed security scanning;
- the package is locally approved;
- the package is organization-approved;
- the package is installable;
- the package bypasses source-profile, artifact-integrity, or policy checks.

Clients should label followed-account results as followed or from a followed
publisher, not as trusted or approved.

## Claim, Official, And Scan State

ClawHub may expose publisher facts such as claim state, official state,
restriction state, scan state, or registry review state. These facts should be
explicit fields or metadata; clients and downstream registries must not infer
them from following state.

Recommended separation:

| Fact | Meaning |
| --- | --- |
| `claimState` | Whether the publisher identity is claimed or claimable. |
| `officialState` | Whether ClawHub marks the publisher as official. |
| `restrictionState` | Whether the publisher is restricted, suspended, or normal. |
| `scanState` | Whether a package has scan metadata, if ClawHub exposes it. |
| `registryReviewState` | Whether a downstream registry has reflected review state. |
| `followState` | Whether the current user follows the publisher. |

Each fact has a separate source of authority. Clients should show labels and
diagnostics that preserve the distinction.

## Follow Privacy And Abuse Controls

Follow state is user-specific preference data. ClawHub should treat follower
lists as private by default unless a user or organization explicitly publishes a
public list. Account-feed publication must not expose who follows an account.

Follow and unfollow operations should be reversible, idempotent, and bounded.
Implementations should rate-limit follow changes, suppress self-follow
notifications, and provide a way to mute or disable notifications without
unfollowing the publisher.

Blocked, suspended, deleted, or private publishers should not silently remain in
normal followed-discovery results. Clients should show an actionable status such
as unavailable, restricted, or private rather than treating the feed as a
successful empty feed.

## Downstream Registry Consumption

Downstream registries can consume ClawHub account feeds as source input. They
may subset, block, pin, scan, or re-publish account-feed entries into their own
effective feeds.

When a downstream registry emits an effective feed, it should preserve bounded
provenance:

- ClawHub feed id;
- ClawHub feed sequence or checksum;
- ClawHub publisher id;
- ClawHub package id;
- selected version or revision;
- downstream policy state.

Downstream registries should not treat account following as approval. They must
run their own review, scan, allow-list, block-list, or organization policy before
calling an entry approved.

## Discovery And UI Requirements

Clients and ClawHub surfaces should make account-feed state explainable:

- profile pages should show package entries without implying install approval;
- follow buttons should say follow or following, not trust;
- official labels should be separate from scan or review labels;
- unavailable, blocked, or restricted publishers should have actionable status;
- discovery results should say when an entry appears because of a followed
  publisher.

Empty or restricted account feeds should be explicit. A missing account feed,
private feed, deleted publisher, or blocked publisher should not silently look
like an empty successful feed.

## API Shape

The exact ClawHub HTTP routes can evolve, but account feed APIs should preserve
these capabilities:

```text
GET /v1/feeds/accounts/{accountId}
GET /v1/feeds/publishers/{publisherId}
GET /v1/feeds/organizations/{organizationId}
POST /v1/publisher-follows
DELETE /v1/publisher-follows/{publisherId}
GET /v1/publisher-follows
```

Feed routes should return hosted feed payloads or signed envelopes. Follow
routes are user-specific application APIs and should not be confused with the
feed payload itself.

## Diagnostics And Audit

Clients and ClawHub should emit bounded diagnostics for:

- account-feed fetch result;
- account-feed verification result;
- missing, private, deleted, restricted, or blocked publisher state;
- follow and unfollow actions;
- discovery results sourced from followed publishers;
- downstream registry import of account-feed entries.

Diagnostics must not include raw tokens, private profile data, unbounded URLs,
prompt contents, tool arguments, package payload bytes, or raw user identifiers
unless the local deployment explicitly permits them.

## Publisher Checklist

ClawHub account-feed publication is compatible with this addendum when it:

- uses stable account, publisher, or organization ids;
- keeps mutable display fields in metadata;
- signs account feeds through the ClawHub platform feed-signing path;
- preserves entry provenance for publisher and package identity;
- separates follow, official, scan, registry review, and install state;
- makes empty, private, restricted, and blocked feed states distinguishable.

## Client Checklist

An OpenClaw client is compatible with this addendum when it:

- treats account feeds as discovery input, not install authority;
- verifies ClawHub-hosted account feeds according to the signed-feed trust
  addendum when configured;
- preserves followed-publisher provenance in discovery results;
- keeps source-profile and artifact-integrity checks on the install path;
- displays follow state separately from official, scan, review, or approval
  state;
- produces bounded diagnostics for account-feed failures and followed-publisher
  discovery.
