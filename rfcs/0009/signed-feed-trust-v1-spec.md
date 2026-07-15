# Signed Feed Trust v1 Addendum Specification

This document is the implementer-facing trust addendum for RFC 0009 hosted
feeds. It builds on `hosted-feed-v1-spec.md`, which defines the core feed
document, entry, source-reference, refresh, fallback, and validation contract.

Status: draft addendum, tied to RFC 0009.

## Scope

This addendum defines:

- signed feed envelopes;
- payload media type binding;
- Ed25519 signature verification;
- configured and bundled publisher public-key trust;
- fail-closed signed feed behavior;
- key id and threshold rules;
- ClawHub platform feed-signing bootstrap;
- optional signed key-rotation documents;
- diagnostics requirements for feed verification failures.

This addendum does not define:

- package artifact signing or package malware scanning;
- runtime tool policy;
- account following or notifications;
- organization-admin approval workflows;
- a remote public-key bootstrap endpoint;
- reuse of OpenClaw release-signing identities as feed-signing identities.

## Trust Model

A signed feed proves that the exact feed payload bytes were signed by a
publisher key already trusted by the client or deployment. It does not prove
that package code is safe, reviewed, organization-approved, or installable.

Trust anchors come from one of these channels:

- a public key bundled with OpenClaw for the default ClawHub platform
  feed-signing identity;
- operator-managed local configuration for private, third-party, or development
  feeds;
- a signed key-rotation document that chains from an already trusted key.

A feed host must not bootstrap its own initial trust by serving a key from an
ordinary endpoint such as `/public-key`. Such endpoints may be informational for
operators, but clients must not trust them unless the key is already bundled,
locally configured, or delivered through a signed rotation chain.

## Signed Envelope

Signed feeds are served as an envelope containing the exact UTF-8 JSON feed
payload bytes encoded as base64url and one or more signatures.

```json
{
  "type": "openclaw.signed-envelope.v1",
  "payloadType": "application/vnd.openclaw.catalog-feed+json;v=1",
  "payload": "base64url(exact UTF-8 feed JSON bytes)",
  "signatures": [
    {
      "keyid": "clawhub-feed-2026-q3",
      "sig": "base64:..."
    }
  ]
}
```

Envelope fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `type` | string | Yes | Must be `openclaw.signed-envelope.v1`. |
| `payloadType` | string | Yes | Must identify the signed payload media type. |
| `payload` | string | Yes | Base64url encoded exact payload bytes. |
| `signatures` | array | Yes | One or more signatures over the envelope pre-authentication encoding. |

Signature fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `keyid` | string | Yes | Publisher key id selected from trusted keys. |
| `sig` | string | Yes | Base64 encoded signature bytes. |

Clients must verify the envelope before decoding and accepting the payload as a
feed. Signing exact payload bytes avoids a second JSON canonicalization contract
for feed documents.

## Signature Algorithm

The initial signature algorithm is Ed25519.

OpenClaw's verifier uses DSSE-style pre-authentication encoding for signed
payloads. Publishers should use the OpenClaw verifier, test vectors, or a
compatibility harness before treating a signature as compatible.

## Verification Rules

Clients must:

- reject unsupported envelope `type`;
- reject unsupported `payloadType`;
- reject malformed base64/base64url fields;
- reject empty `signatures`;
- bound the maximum signature count;
- reject duplicate `keyid` values in one envelope;
- resolve `keyid` only against locally trusted keys for the feed profile;
- require the configured threshold to be met by distinct trusted keys;
- reject signed feeds when only part of required key configuration is present;
- decode and validate the feed payload only after signature verification;
- compute and persist a local payload checksum after verification.

`verification.mode: "signed"` fails closed. A failure to fetch keys, malformed
local key config, missing key id, invalid signature, unsupported envelope, or
unsupported payload type means the hosted feed must not become install or search
authority.

This addendum is a verification layer, not a packaging requirement. Publishers
can still host ordinary core feeds, and clients can still use local or unsigned
development feeds through explicit local configuration. Signed verification
becomes a requirement only for profiles configured with `mode: "signed"` or for
default ClawHub-hosted feeds that OpenClaw treats as signed by platform policy.

## Source Profile Verification Configuration

A feed profile can require signed verification.

```json
{
  "catalog": {
    "feeds": {
      "acme": {
        "url": "https://packages.acme.example/openclaw/feed",
        "verification": {
          "mode": "signed",
          "rootKeys": [
            {
              "id": "acme-feed-2026-q3",
              "publicKey": "base64:..."
            }
          ],
          "rootThreshold": 1
        }
      }
    }
  }
}
```

`rootKeys` are public keys. They are not secrets. Private signing keys must stay
outside OpenClaw client configuration.

The default ClawHub platform feed should not require ordinary users to paste
`rootKeys`. OpenClaw can ship the ClawHub public feed-signing key as part of the
OpenClaw release. Explicit `rootKeys` remain useful for private ClawHub
deployments, third-party publishers, development, emergency override, and
operator-managed deployments.

## ClawHub Platform Signing

ClawHub-hosted feeds can use a ClawHub platform feed-signing key. The same
platform signing path can sign:

- `clawhub-public`;
- ClawHub named feeds;
- ClawHub account feeds;
- ClawHub organization feeds;
- ClawHub-served composed feeds.

OpenClaw verifies these feeds with the bundled ClawHub public key when the feed
identity in the signed payload matches a ClawHub-hosted feed profile. ClawHub
enforces ACLs before serving private or organization-scoped feeds; feed
verification proves payload authenticity, not viewer authorization.

ClawHub private signing material should live in ClawHub secret storage or a
signing service. It must not be checked into feed documents, OpenClaw config, or
public source.

The feed-signing key is a feed integrity key. It should not reuse OpenClaw
release-signing identities, Apple Developer ID certificates, notarization
credentials, npm tokens, GitHub tokens, or package-publishing credentials.
Keeping these identities separate limits blast radius when a feed-signing key or
package-publishing path needs emergency rotation.

## Key Rotation

If a publisher needs remote key rotation, it should publish a signed rotation
document verified by an already trusted key. A rotation document is separate
from an ordinary feed.

```json
{
  "type": "openclaw.feed-key-rotation.v1",
  "feedId": "clawhub-public",
  "sequence": 3,
  "expiresAt": "2026-09-01T00:00:00.000Z",
  "threshold": 1,
  "feedKeys": [
    {
      "id": "clawhub-feed-2026-q4",
      "publicKey": "base64:..."
    }
  ]
}
```

Clients that support rotation should persist accepted rotation sequence and
expiry metadata to prevent rollback and freeze attacks. Emergency root
replacement remains a local operator or OpenClaw release action.

## Refresh And Snapshot Trust State

When a signed hosted feed is accepted, clients should persist bounded trust
state with the cached snapshot:

- feed profile name;
- feed id from the verified payload;
- payload checksum;
- feed sequence;
- expiry;
- verification mode;
- signed/unsigned outcome;
- signature count;
- threshold;
- accepted key ids or bounded key fingerprints;
- verification failure category when rejected.

Diagnostics must not include private keys, raw bearer tokens, credential-bearing
URLs, full payload bytes, or unbounded identity values.

## Unsigned Feeds

Unsigned remote feeds require explicit local opt-in through
`verification.mode: "unsigned"`. Unsigned remote feeds should still require
HTTPS unless a local development profile explicitly allows loopback or local
file input.

Clients must make unsigned state visible in diagnostics so operators can tell
that a feed is accepted without signature verification.

## Publisher Checklist

A signed-feed publisher is compatible with this addendum when it:

- signs exact feed payload bytes through the v1 envelope;
- uses Ed25519 keys with stable key ids;
- keeps private signing material outside feed documents and client config;
- publishes test vectors for valid signatures and expected failures;
- documents who owns key rotation and emergency revocation;
- provides a rotation story before retiring old keys;
- avoids using ordinary `/public-key` endpoints as trust bootstrap.

## Client Checklist

An OpenClaw client is compatible with this addendum when it:

- verifies signed envelopes before decoding feed payloads;
- fails closed for configured signed feeds;
- rejects malformed, duplicate, or unbounded signature inputs;
- verifies thresholds against distinct trusted keys;
- supports bundled ClawHub public-key trust for default ClawHub feeds;
- keeps direct public-key config as an operator override path;
- records bounded verification diagnostics with accepted snapshots.
