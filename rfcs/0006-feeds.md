---
title: Feeds for Curated Skills and Plugins
authors:
  - giodl73-repo
created: 2026-05-28
last_updated: 2026-06-01
status: accepted
issue:
rfc_pr: TBD
---

# Proposal: Feeds for Curated Skills and Plugins

## Summary

Define a portable feed contract for curated skill and plugin catalog documents,
then add OpenClaw client support for consuming those feeds. Feeds are configured
sources that OpenClaw can validate, inspect, search, use for explicit installs,
check against Policy conformance rules, and compare against installed inventory
for update notices.

The design is deliberately file and URL based at the client boundary. ClawHub can
publish standard root feeds, enterprises or tenant admin systems can publish their
own feeds, and OpenClaw clients do not need to download or index the entire public
catalog unless they choose a feed that represents it.

## Motivation

Organizations want a manageable way to guide which OpenClaw skills and plugins
their users discover and install. The public catalog can be large, and a
company may only want to expose a curated subset based on provenance, approval,
owner, geography, review state, or local policy.

A feed gives operators a small, portable catalog artifact instead of requiring
OpenClaw itself to become an enterprise marketplace. A feed can be published by
a company, a team, a CI job, or ClawHub. OpenClaw clients subscribe to one or
more configured feed documents and use existing install paths for explicit
user-initiated installs.

Feeds should also support governance workflows:

- Platform teams can validate and hash feed artifacts before publishing.
- Compliance teams can require approved feed sources through Policy
  conformance.
- Subscribers can see when installed skills or plugins have newer approved
  versions in configured feeds.
- Operators can start with local files and later move to hosted feeds without
  changing the core OpenClaw contract.

## Goals

- Define a feed document contract for curated skill and plugin entries.
- Let OpenClaw configure feed sources under the bundled `feeds` extension.
- Validate feed source config through Doctor and plugin schema validation.
- Add read-only CLI discovery for configured feeds.
- Allow native `skills search` and `plugins search` to opt into configured feeds
  by flag or by explicit config.
- Allow explicit install from a selected feed entry through existing OpenClaw
  install commands.
- Add optional approved-only warn/enforce behavior for feed-backed installs.
- Add Policy conformance checks for required, pinned, and unsigned feed source
  posture.
- Add authoring and subscriber commands for validating, hashing, building,
  diffing, and checking updates from feed artifacts.
- Let ClawHub publish root feeds while keeping enterprise feed hosting possible
  outside ClawHub.
- Keep package publishing separate from feed publication: source systems own
  package upload, while feeds describe curated catalog metadata.

## Non-Goals

- Replacing ClawHub.
- Adding a background feed daemon or watch loop.
- Automatically installing or updating skills and plugins.
- Intercepting every non-feed install command.
- Requiring clients to download or index the full public catalog.
- Treating feed membership as proof that code is safe.
- Defining how packages are uploaded to ClawHub, MOS3, npm, or internal
  registries.

## Proposal

OpenClaw should ship a bundled `feeds` extension. The extension adds config,
Doctor validation, CLI commands, and a feed document parser. A configured feed
source points to a feed document by `https://` or `file://` URL and may pin the
document by `sha256:<hex>` integrity.

Example OpenClaw config:

```jsonc
{
  "plugins": {
    "entries": {
      "feeds": {
        "enabled": true,
        "config": {
          "sources": [
            {
              "id": "company-approved",
              "url": "https://feeds.example.com/openclaw/feed.json",
              "trust": "pinned",
              "integrity": "sha256:..."
            }
          ]
        }
      }
    }
  }
}
```

A feed document is a JSON document with a schema version, stable feed id, and
entries. Entries can describe skills or plugins, optional version metadata,
approval metadata, search metadata, and install metadata.

```jsonc
{
  "schemaVersion": 1,
  "id": "company-approved",
  "generatedAt": "2026-05-28T00:00:00.000Z",
  "entries": [
    {
      "type": "plugin",
      "id": "calendar-helper",
      "version": "1.2.0",
      "approval": {
        "status": "approved",
        "owner": "platform"
      },
      "install": {
        "source": "clawhub",
        "spec": "openclaw-calendar-helper"
      }
    }
  ]
}
```

The first feed commands are read-only:

```bash
openclaw feeds sources
openclaw feeds list
openclaw feeds search calendar --type plugin
```

A later PR in the same series adds explicit install:

```bash
openclaw feeds install calendar-helper --source company-approved --type plugin --dry-run
openclaw feeds install calendar-helper --source company-approved --type plugin
```

The command resolves exactly one feed entry, verifies pinned source integrity
before trusting install metadata, and then hands off to existing OpenClaw skill
or plugin install commands. It does not add a separate installer.

Feed-backed installs can be constrained through `installPolicy`:

```jsonc
{
  "plugins": {
    "entries": {
      "feeds": {
        "enabled": true,
        "config": {
          "installPolicy": {
            "mode": "enforce",
            "requireApproval": true
          },
          "sources": [
            {
              "id": "company-approved",
              "url": "file:///opt/openclaw/feeds/company.json"
            }
          ]
        }
      }
    }
  }
}
```

`mode: "off"` performs no approval check. `mode: "warn"` reports unapproved
feed entries but continues. `mode: "enforce"` blocks unapproved feed entries.
If an operator sets `mode: "enforce"` without `requireApproval`, approval is
required by default. If an operator sets `requireApproval: true` without a
mode, the config defaults to enforce rather than silently doing nothing.

Policy conformance can require feed source posture:

```jsonc
{
  "feeds": {
    "sources": {
      "require": ["company-approved"],
      "requirePinned": true,
      "allowUnsigned": false
    }
  }
}
```

These are config conformance checks. They report whether active OpenClaw config
matches the approved policy file. They do not enforce runtime install behavior.
Policy evidence records configured source ids, config source paths, enabled
posture, trust mode, and whether valid pinned integrity is present. URL evidence
is redacted to origin plus a short hash so attestation detects URL drift without
exposing path, query, credentials, or local file paths.

Feed authoring and subscriber workflows remain explicit:

```bash
openclaw feeds validate ./company-feed.json --json
openclaw feeds hash ./company-feed.json
openclaw feeds build --inventory ./inventory.json --out ./company-feed.json --id company-approved
openclaw feeds diff --previous ./previous-feed.json --current ./company-feed.json --json
openclaw feeds updates --installed ./installed.json --approved-only --json
openclaw feeds notices --installed ./installed.json --approved-only --json
```

This lets a publisher generate and review curated artifacts while subscribers
can learn that installed skills or plugins have newer approved versions in
configured feeds. The initial subscriber commands report candidates only; they
do not auto-update.

## Enterprise feed consumption flow

The same client contract works when a feed is created outside ClawHub. For
example, an internal catalog service, tenant admin tool, or CI job can emit a
`company-approved.json` feed using the schema above and host it at an HTTPS URL
or a local `file://` path.

The publisher side can use the feeds CLI to keep that artifact reviewable:

```bash
openclaw feeds build --inventory ./inventory.json --out ./company-approved.json --id company-approved
openclaw feeds validate ./company-approved.json --json
openclaw feeds hash ./company-approved.json
openclaw feeds diff --previous ./previous-company-approved.json --current ./company-approved.json --json
```

The subscriber side configures the published artifact as a feed source and can
make native skills/plugins search use that source by default:

```jsonc
{
  "plugins": {
    "entries": {
      "feeds": {
        "enabled": true,
        "config": {
          "sources": [
            {
              "id": "company-approved",
              "url": "https://catalog.example.com/openclaw/company-approved.json",
              "trust": "pinned",
              "integrity": "sha256:..."
            }
          ],
          "search": {
            "default": true,
            "sources": ["company-approved"]
          }
        }
      }
    }
  }
}
```

Users can then stay on familiar OpenClaw commands while searching the configured
enterprise feed:

```bash
openclaw skills search excel
openclaw plugins search calendar
openclaw feeds install calendar-helper --source company-approved --type plugin --dry-run
openclaw feeds install calendar-helper --source company-approved --type plugin
```

Operators can verify that a workspace is configured for the approved feed and
check subscriber update state without requiring a marketplace service:

```bash
openclaw policy check
openclaw feeds updates --installed ./installed.json --approved-only --json
openclaw feeds notices --installed ./installed.json --approved-only --json
```

OpenClaw does not need to know whether the feed was produced by ClawHub, a
static file publisher, a tenant catalog, or CI. The interoperability point is
the feed document plus optional pinned integrity.

## Producer and consumer roles

The final design separates package supply, feed production, and OpenClaw
consumption:

| Role | Examples | Responsibility |
|---|---|---|
| Package producer | Skill/plugin authors, internal platform teams | Publish package artifacts and source metadata to a source system. |
| Source supplier | ClawHub, MOS3, npm, internal registries, static inventory files | Expose package metadata and artifact coordinates. |
| Feed producer | ClawHub root feeds, enterprise catalog tools, tenant admin systems, CI jobs | Emit deterministic feed documents using the shared feed schema. |
| Feed curator | Platform, compliance, tenant admins | Decide which entries are approved, denied, pinned, deprecated, or visible. |
| Feed consumer | OpenClaw clients | Verify configured feed sources, search entries, hand off installs, and report approved updates. |

This is why the RFC does not require every enterprise to run a marketplace or
ClawHub fork. A tool such as an internal catalog service can consume ClawHub or
other source metadata, materialize an approved tenant feed, and let OpenClaw use
that feed through the same config and commands.

## ClawHub root feeds

ClawHub can improve the public producer story by publishing first-party root
feeds that already use the OpenClaw feed schema. The initial lanes are:

| Feed | Intended contents |
|---|---|
| `all` | Public feedable skills and plugins. |
| `official` | Entries carrying ClawHub official ownership/channel metadata. |
| `community` | Public community entries that are not official. |
| `reviewed` | Entries with the best currently available review posture, such as clean scans or non-suspicious/non-deprecated skill metadata. |

These lanes are convenience roots, not hard-coded client trust. Enterprises can
consume them directly, layer their own curation on top, or ignore them and
publish their own compatible feeds from another source system.

## PR plan

The implementation is split into five OpenClaw client PRs plus one ClawHub
producer PR:

1. [openclaw/openclaw#87824](https://github.com/openclaw/openclaw/pull/87824) -
   **Read-only feed discovery**: bundled feeds extension, source config schema,
   Doctor validation, feed document parser, read-only `sources`, `list`, and
   `search` commands, install hints, docs, and plugin inventory wiring.
2. [openclaw/openclaw#87825](https://github.com/openclaw/openclaw/pull/87825) -
   **Approved feed installs**: explicit `feeds install`, pinned integrity
   verification, existing installer handoff, `installPolicy`, schema, Doctor
   validation, and tests.
3. [openclaw/openclaw#87826](https://github.com/openclaw/openclaw/pull/87826) -
   **Policy conformance**: config-only Policy checks for required feed sources,
   pinned posture, unsigned posture, evidence, check ids, docs, and tests.
4. [openclaw/openclaw#87827](https://github.com/openclaw/openclaw/pull/87827) -
   **Lifecycle tooling**: feed validate/hash/build/diff/update/notice commands
   for publisher and subscriber workflows.
5. [openclaw/openclaw#88732](https://github.com/openclaw/openclaw/pull/88732) -
   **Native search defaults**: opt-in config and Policy hooks so native
   `openclaw skills search` and `openclaw plugins search` can search configured
   feeds by flag, by default, or by selected source ids. This preserves the
   familiar CLI surface while letting managed environments redirect discovery
   to approved feeds.
6. [openclaw/clawhub#2460](https://github.com/openclaw/clawhub/pull/2460) -
   **ClawHub root feed lanes**: public `all`, `official`, `community`, and
   `reviewed` feed documents that use the same feed schema and deterministic
   attestation hashing as the OpenClaw client stack.

This split keeps the client contract usable with any file or URL feed while also
letting ClawHub expose first-party root feeds for common discovery paths. The
enterprise path is to publish a feed using the same schema, configure it as an
OpenClaw feed source, optionally make native search use it, and optionally require
it through Policy conformance. Source-management helper commands can be layered
on later, but the core contract remains ordinary config plus feed documents.

## Rationale

A feed artifact is simpler and more deployable than asking every enterprise to
stand up a marketplace. It can be hosted on a static file server, checked into a
repo, generated by CI, or eventually published by ClawHub. The same artifact can
be validated, hashed, pinned, searched, used for explicit installs, and checked
by Policy.

Keeping the client contract independent of ClawHub avoids a hard cross-service
dependency. OpenClaw can support useful enterprise catalog workflows with any
hosted or local feed artifact. ClawHub root feeds improve the default public
producer story by emitting the same documents that enterprise publishers can
emit themselves, and external catalog tools can build smaller feeds from those
roots without changing OpenClaw.

The explicit install model keeps user intent clear. Feed presence alone should
not mutate a workspace. Feed install enforcement applies only to the explicit
feed-backed install command, while Policy conformance reports whether the
workspace is configured to use approved feed sources.

The lifecycle commands are intentionally synchronous and file-based. They fit
CI publication workflows and local validation without adding long-running
client state. If OpenClaw later adds feed subscriptions, watches, or native
ClawHub APIs, those features can build on the same document and source
contracts.

## Compatibility and migration

The initial feeds extension is opt-in. Workspaces without
`plugins.entries.feeds` are unaffected.

Feed config uses normal plugin config validation. Unknown feed config keys are
rejected by the plugin schema. Feed source ids are local stable identifiers; they
do not need to match a remote service id. The feed document itself uses `id`
for its stable feed identity; CLI and Policy evidence may expose that value as a
`feedId` field when it needs to distinguish the feed document from the
configured source id.

Pinned feed sources must declare `sha256:<64 hex>` integrity. Integrity is
checked before entries from a pinned source are trusted. Unsigned sources remain
available because local file feeds and early hosted feeds may not have a
publication pipeline yet, but Policy can require pinned sources and disallow
unsigned posture.

Policy feed checks are active only when the policy file declares feed rules.
This avoids changing policy attestation hashes for workspaces that have no feed
policy posture. Policy evaluates configured source posture and native-search
posture; it should not fetch feed documents or make package safety claims.

## Security considerations

Feeds are catalog metadata, not code execution proof. Installing an entry still
uses OpenClaw's existing install paths and trust model. Feed approval metadata is
operator-supplied and should be treated as governance signal, not cryptographic
attestation of safety.

Policy evidence should not leak secrets embedded in feed URLs. Evidence should
record stable source ids and redacted URL identity, not full local paths,
queries, credentials, or tokens. Feed attestation hashes should be deterministic
for the feed document content so publishers and subscribers can detect drift
without treating feed membership as a code-safety guarantee.
