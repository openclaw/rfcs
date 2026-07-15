# Signed Feed Trust v1 Addendum Specification

This document defines signed transport and trust-anchor behavior for Hosted Feed
v1. It builds on `hosted-feed-v1-spec.md`.

Status: draft addendum, tied to RFC 0009.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative.

## Scope

This addendum defines:

- the signed feed envelope;
- exact DSSE pre-authentication encoding;
- Ed25519 verification and signature thresholds;
- local and bundled publisher public-key trust;
- expected feed-identity binding;
- fail-closed refresh, snapshot, and key-rotation behavior;
- bounded verification diagnostics.

It does not define package signing, malware scanning, runtime policy, account
following, organization approval, a remote trust bootstrap endpoint, or reuse
of release-signing identities as feed-signing identities.

## Trust Model

A valid signature proves that trusted key material signed the exact decoded feed
payload bytes for the declared payload type. It does not prove package safety,
organization approval, artifact integrity, or runtime permission.

An initial trust anchor MUST arrive through one of these channels:

- a public key bundled with OpenClaw for a built-in platform feed;
- operator-managed local configuration;
- another authenticated software or configuration distribution channel.

A feed endpoint MUST NOT bootstrap its own trust by advertising a key from an
ordinary endpoint such as `/v1/feeds/public-key`. Compromise of that endpoint
would otherwise compromise both content and trust.

Publisher private keys MUST remain in publisher-owned secret storage. Feed keys
MUST be distinct from OpenClaw release, package, TLS, account, and platform
signing identities even when the same secret-management system operates them.

## Signed Envelope

The v1 envelope has this exact shape:

```json
{
  "schemaVersion": 1,
  "payloadType": "openclaw.official-external-plugin-catalog-feed.v1",
  "payload": "eyJzY2hlbWFWZXJzaW9uIjoxLC4uLn0",
  "signatures": [
    {
      "keyId": "clawhub-feed-2026-q3",
      "algorithm": "ed25519",
      "signature": "base64url-signature"
    }
  ]
}
```

Envelope fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `schemaVersion` | integer | Yes | MUST be `1`. |
| `payloadType` | string | Yes | MUST be `openclaw.official-external-plugin-catalog-feed.v1`. |
| `payload` | string | Yes | Base64 or unpadded base64url encoding of the exact UTF-8 feed bytes. |
| `signatures` | array | Yes | Between 1 and 16 signature records. |

Signature fields:

| Field | Type | Required | Semantics |
| --- | --- | --- | --- |
| `keyId` | string | Yes | Non-empty configured publisher key id. |
| `algorithm` | string | Yes | MUST be `ed25519`. |
| `signature` | string | Yes | Base64url Ed25519 signature over the DSSE PAE bytes. |

Duplicate `keyId` values make the envelope invalid. Unknown fields MUST NOT be
assigned trust meaning.

## DSSE Pre-Authentication Encoding

Signatures MUST be calculated over the DSSE v1 pre-authentication encoding of
the decoded payload bytes, not over the base64 text in the envelope.

For UTF-8 `payloadType` bytes `T` and decoded payload bytes `P`, construct:

```text
PAE("DSSEv1", T, P) =
  "DSSEv1" || SP || decimal(byte_length(T)) || SP || T ||
  SP || decimal(byte_length(P)) || SP || P
```

For the required payload type this is equivalent to:

```text
"DSSEv1 " + utf8ByteLength(payloadType) + " " + payloadType +
" " + payloadByteLength + " " + payloadBytes
```

Lengths are unsigned decimal ASCII without leading signs or padding. `SP` is
one ASCII space (`0x20`). The final component is the exact decoded payload byte
sequence and may contain arbitrary bytes. Publishers SHOULD validate against
OpenClaw's signed-envelope test vectors before production use.

## Local Configuration

Custom signed feeds are configured under `marketplaces.feeds`:

```json
{
  "marketplaces": {
    "feeds": {
      "partner-catalog": {
        "url": "https://packages.example.com/openclaw/feed.json",
        "feedId": "partner-official",
        "verification": {
          "mode": "signed",
          "keys": [
            {
              "keyId": "partner-feed-2026-q3",
              "publicKey": "base64url-raw-ed25519-key-or-pem"
            }
          ],
          "threshold": 1
        }
      }
    }
  }
}
```

`feedId` is the expected signed payload identity. Signed profiles MUST bind the
decoded payload's `id` to this configured or built-in expected value. The local
profile name and payload feed id may differ; for example the built-in profile
`clawhub-public` expects payload id `clawhub-official`.

`keys` MUST contain distinct key ids and distinct normalized Ed25519 public key
material. `threshold` defaults to 1, MUST be positive, and MUST NOT exceed the
number of configured distinct keys. Private signing keys MUST NOT appear in
OpenClaw configuration.

## Verification

Before accepting a signed refresh, a client MUST:

1. Parse and validate the bounded envelope.
2. Require the supported `schemaVersion` and exact `payloadType`.
3. Decode `payload` and each candidate signature.
4. Construct the exact DSSE PAE bytes above.
5. Resolve signature key ids only against the selected profile's trusted keys.
6. Count only valid signatures from distinct trusted public key material.
7. Require the configured threshold.
8. Parse the decoded payload as Hosted Feed v1.
9. Require payload `id` to equal the profile's expected `feedId`.
10. Apply schema, source-profile, expiry, and monotonic sequence checks.

Failure at any step MUST reject the new payload. A client MUST NOT retry the
same bytes as unsigned content or silently replace the configured signed profile
with an unsigned feed.

## Snapshots And Rollback Protection

An accepted signed snapshot SHOULD persist:

- exact envelope bytes;
- exact decoded payload bytes or their checksum;
- payload feed id and sequence;
- accepted signature key ids, count, and threshold;
- verification time;
- HTTP validators and fetch metadata.

Clients MUST reverify a stored signed snapshot before using it. A newly fetched
valid feed with a lower sequence than the previously accepted feed id MUST be
rejected as rollback. A verification-policy change MUST NOT make it impossible
to compare a newly valid feed against metadata from the previously accepted
snapshot; the old snapshot remains the rollback baseline even when it no longer
satisfies the new key set.

The old snapshot may be served as fallback only if it satisfies the currently
configured verification policy. Otherwise the client MUST fail closed with a
clear diagnostic.

## Bundled ClawHub Trust

The official ClawHub feed uses a dedicated ClawHub feed-signing identity:

- ClawHub stores and uses the private Ed25519 key;
- OpenClaw bundles the matching public key and stable key id;
- the built-in `clawhub-public` profile expects feed id `clawhub-official`;
- normal users do not configure the official key manually;
- an environment override MAY exist for development or staged rollout, but
  MUST fail closed when only part of the key pair configuration is present.

Bundling a public key is source-controlled trust distribution. It is not secret
storage and it does not put the private key in the OpenClaw release.

## Rotation And Revocation

Signed Feed v1 does not define an in-band key-rotation document. Rotation uses
the same authenticated channel that established the trust anchor.

A normal rotation SHOULD proceed as follows:

1. Generate a new dedicated feed-signing key.
2. Add the new public key to bundled or operator-managed trust configuration.
3. Publish envelopes signed by enough old trusted keys to satisfy the current
   threshold, optionally also signed by the new key.
4. Distribute the updated trust configuration.
5. After the update window, sign with the new active set and remove retired keys
   in a later configuration or release update.

Merely including a signature from one old key is insufficient when the current
threshold is greater than one. Emergency revocation may intentionally make the
last snapshot unusable; clients must fail closed and identify the revoked or
missing trust state without revealing key material beyond public key ids.

Future in-band rotation requires a separately versioned payload type, exact wire
schema, replay rules, and threshold transition semantics. Implementations MUST
NOT invent incompatible rotation documents under this v1 payload type.

## Diagnostics

Clients SHOULD distinguish:

- malformed envelope;
- unsupported payload type;
- malformed feed payload;
- expected feed-id mismatch;
- unknown key id;
- invalid signature;
- duplicate key id or duplicate public key material;
- threshold not met;
- expired feed;
- rollback sequence;
- snapshot rejected under the current policy.

Diagnostics MAY expose feed profile, expected and actual feed ids, sequence,
public key ids, threshold, verification time, and fallback source. They MUST NOT
expose private keys, bearer tokens, credential-bearing URLs, or payload bytes.

## Publisher Conformance

A signed v1 publisher:

- signs the exact stored feed payload bytes using the DSSE PAE above;
- uses the required envelope and payload type;
- keeps sequence monotonic across deletion and demotion;
- keeps private keys in publisher-owned secret storage;
- publishes stable public key ids through an authenticated trust channel;
- provides positive, tampered-payload, wrong-key, and rollback test vectors.

## Client Conformance

A signed v1 client:

- obtains initial trust independently of the feed endpoint;
- binds signed payload identity to the selected profile;
- enforces distinct-key thresholds and fail-closed behavior;
- stores and reverifies last-known-good signed snapshots;
- preserves rollback metadata across verification-policy changes;
- reports bounded, actionable verification diagnostics.
