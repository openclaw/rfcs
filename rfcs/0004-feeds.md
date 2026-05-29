---
title: Feeds for Curated Skills and Plugins
authors:
  - giodl73-repo
created: 2026-05-28
last_updated: 2026-05-28
rfc_pr: TBD
---

# Proposal: Feeds for Curated Skills and Plugins

## Summary

Add a generic OpenClaw feeds extension for curated skill and plugin catalog
documents. Feeds are configured sources that OpenClaw can validate, inspect,
search, use for explicit installs, check against Policy conformance rules, and
compare against installed skill/plugin inventory for update notices.

The initial design is deliberately file and URL based. It does not require
ClawHub to add a native feed service, and it does not require every client to
download or index the entire public catalog. A later ClawHub-native PR can make
public feed publication and search more integrated once the local feed contract
has proved useful.

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
- Allow explicit install from a selected feed entry through existing OpenClaw
  install commands.
- Add optional approved-only warn/enforce behavior for feed-backed installs.
- Add Policy conformance checks for required, pinned, and unsigned feed source
  posture.
- Add authoring and subscriber commands for validating, hashing, building,
  diffing, and checking updates from feed artifacts.
- Keep the first implementation independent of ClawHub server changes.

## Non-Goals

- Replacing ClawHub.
- Adding a background feed daemon or watch loop.
- Automatically installing or updating skills and plugins.
- Intercepting every non-feed install command.
- Requiring clients to download or index the full public catalog.
- Defining a native ClawHub feed API in the first PR series.
- Treating feed membership as proof that code is safe.

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

## PR plan

The first implementation can land as four reviewable PRs:

1. **Read-only feed discovery**: bundled feeds extension, source config schema,
   Doctor validation, feed document parser, read-only `sources`, `list`, and
   `search` commands, install hints, docs, and plugin inventory wiring.
2. **Approved feed installs**: explicit `feeds install`, pinned integrity
   verification, existing installer handoff, `installPolicy`, schema, Doctor
   validation, and tests.
3. **Policy conformance**: config-only Policy checks for required feed sources,
   pinned posture, unsigned posture, evidence, check ids, docs, and tests.
4. **Lifecycle tooling**: feed validate/hash/build/diff/update/notice commands
   for publisher and subscriber workflows.

A possible fifth PR is **ClawHub-native feed support**. That PR is intentionally
not part of the initial series. It could add ClawHub-hosted public feeds,
feed-aware search, server-side feed generation from catalog filters, or a native
subscription endpoint. The local feed contract should land first so ClawHub
integration has a stable target instead of defining the entire feature.

## Rationale

A feed artifact is simpler and more deployable than asking every enterprise to
stand up a marketplace. It can be hosted on a static file server, checked into a
repo, generated by CI, or eventually published by ClawHub. The same artifact can
be validated, hashed, pinned, searched, used for explicit installs, and checked
by Policy.

Keeping the first series independent of ClawHub avoids a cross-service
dependency. OpenClaw can support useful enterprise catalog workflows even when
ClawHub has no native feed API. If ClawHub later adds native feeds, it can
produce the same feed documents and improve search/discovery without changing
client-side policy or install semantics.

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
do not need to match a remote service id.

Pinned feed sources must declare `sha256:<64 hex>` integrity. Integrity is
checked before entries from a pinned source are trusted. Unsigned sources remain
available because local file feeds and early hosted feeds may not have a
publication pipeline yet, but Policy can require pinned sources and disallow
unsigned posture.

Policy feed checks are active only when the policy file declares feed rules.
This avoids changing policy attestation hashes for workspaces that have no feed
policy posture.

## Security considerations

Feeds are catalog metadata, not code execution proof. Installing an entry still
uses OpenClaw's existing install paths and trust model. Feed approval metadata is
operator-supplied and should be treated as governance signal, not cryptographic
attestation of safety.

Policy evidence should not leak secrets embedded in feed URLs. Evidence should
