---
title: Hosted Feeds for Plugins and Skills
authors:
  - Vincent
  - Patrick
  - Gio
created: 2026-06-18
last_updated: 2026-06-18
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/19
---

# Proposal: Hosted Feeds for Plugins and Skills

## Summary

Define a hosted feed model for OpenClaw plugins and skills. A feed is a JSON
catalog document that describes available packages, named local package sources,
version and integrity metadata, and feed-level governance state such as
recommended, disabled, blocked, or update available. OpenClaw should move the
existing file-backed external plugin catalog to this feed model first, keep a
bundled fallback for offline environments, and later extend the same contract to
skills and organization-specific catalogs.

The first implementation should preserve the package model OpenClaw already
uses. External plugins can continue to install from npm or ClawHub, with Git
available for immutable source installs. The feed provides package selection,
version, and checksum data; local configuration supplies the source endpoint,
credentials, and trust policy. ClawHub can publish the default public feed.
Organizations can publish effective feeds by subsetting, filtering, or
augmenting ClawHub feeds with private entries and policy decisions.

## Motivation

OpenClaw is moving more plugins out of the base install and into external
packages. The current external plugin registry is local and file-backed, which
works as a bundle-time manifest but does not give OpenClaw or downstream
distributions a clean way to update recommendations, disable problematic
plugins, regionalize provider availability, or let enterprises expose only the
plugins they approve.

A hosted feed gives OpenClaw a small, cacheable, reviewable distribution
primitive. OpenClaw can fetch the public feed when online, detect changes through
HTTP metadata and checksums, and fall back to the bundled feed when offline or
blocked. ClawHub can curate the default public experience. Microsoft, other
enterprises, and regional mirrors can consume ClawHub feeds, apply their own
policy and private entries, and publish an effective feed to their clients.

This also aligns OpenClaw with proven package ecosystems. npm, Homebrew taps,
and marketplace catalogs separate package storage from catalog composition. The
feed should be the catalog and governance layer, while package registries such
as npm, ClawHub, private Git repositories, and enterprise registries remain the
package source layer.

## Goals

- Replace the bundled-only external plugin catalog with a hosted JSON feed plus
  bundled fallback.
- Preserve existing npm-backed and ClawHub-backed external plugin installs,
  including package version and artifact integrity checks.
- Define named local source profiles so deployments can select or override npm
  registry paths, ClawHub base URLs, Git hosts, and credentials without changing
  the feed format.
- Define immutable Git source installs using full commit hashes.
- Define a feed entry shape for plugins first, with room for skills and other
  package types.
- Support edge-hosted and regional feeds so provider availability can differ by
  geography or deployment environment.
- Let ClawHub publish one or more public feeds for OpenClaw clients.
- Let enterprises publish composed effective feeds that subset, block, pin, or
  augment public feeds.
- Support private organization and team feeds without forcing OpenClaw to own
  the private registry RBAC model.
- Let clients check feeds on a named, lifecycle-owned refresh schedule using
  HTTP `Last-Modified` and `ETag`.
- Support signed remote feeds and an optional, small trust envelope for signing
  key rotation without requiring a full update framework in the first version.
- Keep a bundled feed in every OpenClaw build so offline, Docker, and
  air-gapped environments continue to work.
- Create an RFC and implementation plan that ClawHub, Microsoft, Tencent,
  Xiaomi, and other regional ecosystems can align on before incompatible feed
  formats emerge.

## Non-Goals

- Replacing ClawHub as the public registry and discovery surface.
- Replacing npm, ClawHub package storage, private Git repositories, or private
  enterprise registries as package sources.
- Automatically installing or updating plugins or skills without user action.
- Defining the full end-user onboarding redesign.
- Defining runtime tool-call policy enforcement such as MCP method blocking or
  parameter clamping.
- Making feed membership a guarantee that package code is safe.
- Requiring every enterprise to use Microsoft MOS3 or any specific hosted
  registry.
- Solving private registry authentication or RBAC inside the feed format.
- Allowing a feed to define registry domains, credentials, or bootstrap trust
  keys for the client that consumes it.

## Proposal

OpenClaw should treat feeds as the catalog primitive underneath plugin and skill
marketplace experiences. A feed is fetched from an HTTP endpoint or loaded from a
local file. The client validates the document shape, verifies a configured
signature policy when present, and uses entry-level package metadata to drive
search, recommendation, install, update notices, and feed-level allow/block
decisions.

The initial implementation should refactor the existing external plugin catalog
rather than introduce a parallel catalog. Today the relevant OpenClaw entry
points are:

- `src/plugins/official-external-plugin-catalog.ts`, the generated TypeScript
  catalog entry point.
- `scripts/lib/official-external-plugin-catalog.json`, the actual package data.
- `openclaw.install.npmSpec`, the existing npm package install metadata.
- `src/wizard/setup.official-plugins.ts`, the onboarding reader.
- `src/commands/onboarding-plugin-install.ts`, the install executor.

The first feed version should preserve those semantics while moving the catalog
source from bundled-only JSON to hosted JSON with bundled fallback.

### Feed document

A feed document should be a deterministic JSON document with a schema version,
feed id, generated timestamp, monotonic sequence number, expiry, and entries.
Entry ids must be stable. Entries select a configured local source by name rather
than embedding a registry domain, credentials, or trust roots.

```jsonc
{
  "schemaVersion": 1,
  "id": "clawhub-official",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "sequence": 42,
  "expiresAt": "2026-06-25T00:00:00.000Z",
  "entries": [
    {
      "type": "plugin",
      "id": "acpx",
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
            "sourceRef": "public-npm",
            "package": "@openclaw/acpx",
            "version": "1.2.3",
            "integrity": "sha512-..."
          }
        ]
      },
      "regions": {
        "include": ["global"]
      }
    }
  ]
}
```

The initial states should cover the known plugin catalog needs:

- `available`: entry can be shown and installed.
- `recommended`: entry can be highlighted in onboarding or search.
- `disabled`: entry is known but not currently installable from this feed.
- `blocked`: entry should not be installed through this feed.
- `deprecated`: entry remains visible for migration but should not be selected
  for new installs.

The exact enum names can change during implementation, but the RFC should keep
these concepts separate. A recommended package is not the same as a merely
available package. A disabled package is not the same as a blocked package.

### Local feed and source configuration

Feed names and source profile names are deployment-local. There is no
`enterprise` feed or registry shape. A deployment can name feeds and sources
after its own topology, while a feed entry refers only to a configured
`sourceRef`.

```jsonc
{
  "catalog": {
    "feeds": {
      "clawhub-public": {
        "url": "https://registry.openclaw.ai/feeds/plugins",
        "refresh": {
          "onStartup": "if-stale",
          "interval": "6h",
          "jitter": "10m",
          "timeout": "10s",
          "maxStale": "7d"
        },
        "verification": {
          "mode": "signed",
          "rootKeys": [
            { "id": "root-2026", "publicKey": "base64:..." }
          ],
          "rootThreshold": 1,
          "trustUrl": "https://registry.openclaw.ai/feeds/plugins/trust"
        }
      },
      "acme": {
        "url": "https://packages.acme.example/openclaw/feed",
        "auth": {
          "scheme": "bearer",
          "secret": "<SecretRef>"
        },
        "refresh": { "interval": "6h", "timeout": "10s", "maxStale": "7d" },
        "verification": { "mode": "unsigned" }
      }
    },
    "sources": {
      "public-npm": {
        "type": "npm",
        "registry": "https://registry.npmjs.org/"
      },
      "acme-npm": {
        "type": "npm",
        "registry": "https://packages.acme.example/npm/",
        "auth": { "scheme": "npm-token", "secret": "<SecretRef>" }
      },
      "acme-clawhub": {
        "type": "clawhub",
        "baseUrl": "https://packages.acme.example/clawhub/",
        "auth": { "scheme": "bearer", "secret": "<SecretRef>" }
      },
      "acme-git": {
        "type": "git",
        "baseUrl": "ssh://git.acme.example/openclaw/",
        "auth": { "scheme": "ssh-agent" }
      }
    }
  }
}
```

`refresh.interval` names the normal feed check frequency. `onStartup`,
`jitter`, `timeout`, and `maxStale` make the lifecycle behavior explicit without
turning catalog freshness into a request-time polling concern. The refresh
service starts after the gateway is ready; onboarding, search, and installation
consume the current snapshot. The initial implementation belongs in the gateway
scheduled-service lifecycle in `src/gateway/server-runtime-services.ts`, not the
user-visible cron scheduler in `src/gateway/server-cron.ts`.

Feed and source authentication resolve existing secret references. The feed
document never contains an access token, registry credentials, SSH material, or
the source base URL. Unknown `sourceRef` values make an entry invalid rather than
allowing a remote feed to introduce a new artifact source.

Source profiles define the installer contract:

- `npm` selects a custom registry path and optional scoped authentication. The
  same profile must apply to both metadata resolution and package installation.
- `clawhub` selects a ClawHub-compatible base URL and optional bearer token.
- `git` selects an allowed Git host or base path. A feed candidate must name a
  full immutable commit hash, not a branch, tag, or floating ref. Git credentials
  remain local, normally through an SSH agent or configured credential helper.

`npm` and `clawhub` candidates use `package` and `version`. A `git` candidate
uses a repository path relative to its source profile and a full `commit` hash.
Every installable candidate carries the artifact integrity data appropriate to
its source type.

Plugin entries are the first installable feed type. Skill entries can use the
same discovery contract, but skill installation remains staged until the native
skill installer accepts catalog candidates. A ClawHub skill must not be routed
through the plugin installer merely because both appear in a feed.

### Feed discovery and fallback

OpenClaw should have a default feed URL for the ClawHub public feed. At build or
deploy time, OpenClaw should also bundle the latest generated feed file. At
runtime the client should:

1. Load the bundled feed as the fallback catalog.
2. Start the lifecycle-owned refresh service after the gateway is ready.
3. On the configured schedule, make a conditional request using the last
   validated `ETag` or `Last-Modified` value.
4. On `304 Not Modified`, record a successful check without replacing the
   snapshot. On new content, validate the envelope, feed shape, signatures, and
   package-source references before accepting it.
5. Store the latest verified snapshot, HTTP validators, feed sequence, expiry,
   and signature metadata atomically in `state/openclaw.sqlite`.
6. Use the verified cached snapshot during transient failures. Once it exceeds
   `maxStale`, fall back to the bundled feed and report stale catalog status.

### Feed authenticity and rotating trust

HTTP validators detect a likely change but do not establish who authored it. A
signed feed uses a small envelope that carries the exact feed bytes and one or
more Ed25519 signatures:

```jsonc
{
  "type": "openclaw.signed-envelope.v1",
  "payloadType": "application/vnd.openclaw.catalog-feed+json;v=1",
  "payload": "base64url(exact UTF-8 feed JSON bytes)",
  "signatures": [
    { "keyid": "publisher-2026-q3", "sig": "base64:..." }
  ]
}
```

The client verifies the envelope before decoding the payload. Signing exact bytes
avoids a second JSON canonicalization contract. The configured public keys and
threshold are the initial trust anchor; a remote feed cannot bootstrap or replace
them. `verification.mode: "signed"` fails closed. An unsigned HTTPS feed requires
the explicit local `verification.mode: "unsigned"` opt-in.

Most feeds can use directly configured public keys. When remote signing-key
rotation is needed, the same envelope format can wrap a small trust document:

```jsonc
{
  "feedId": "clawhub-official",
  "sequence": 3,
  "expiresAt": "2026-09-01T00:00:00.000Z",
  "threshold": 1,
  "feedKeys": [
    { "id": "publisher-2026-q3", "publicKey": "base64:..." }
  ]
}
```

The configured root-key quorum verifies the trust envelope. The verified
`feedKeys` quorum then verifies feed envelopes. A trust update must be signed by
the currently trusted root quorum, and the client persists the accepted sequence
and expiry to reject rollback and freeze attempts. Root-key replacement remains a
local operator action for emergency recovery. The bundled fallback is trusted as
part of the shipped OpenClaw artifact, not as an unsigned replacement for a
configured signed remote feed. `verification.trustUrl` is optional; when absent,
the configured root keys directly verify feed envelopes.

```mermaid
flowchart LR
  subgraph Sources[Package sources]
    NPM[npm: @openclaw/acpx]
    Hub[ClawHub: teams-plugin]
    Third[External package: risky-plugin]
  end

  subgraph Feed[OpenClaw public feed]
    A["acpx v1.2.3<br/>recommended<br/>sha256 pinned"]
    B["teams-plugin v2.0.0<br/>available<br/>sha256 pinned"]
    C["risky-plugin v1.0.0<br/>blocked"]
  end

  NPM --> A
  Hub --> B
  Third --> C
  Feed --> Hosted[Hosted feed endpoint]
  Feed --> Bundled[Bundled fallback feed]
  Hosted --> Client[OpenClaw catalog]
  Bundled --> Client
  Client --> Search["Search and onboarding<br/>show A and B"]
  Client --> Install["Explicit install<br/>uses existing installers"]
  Client --> Block["Blocked install<br/>reject C"]
  Client --> Updates["Update notices<br/>A v1.2.4 available"]
```

**Figure 1.** OpenClaw uses feeds as the catalog layer. The feed can recommend,
show, block, pin, and notify updates for individual plugin entries while package
artifacts remain in npm, ClawHub, or another package source. The hosted feed
provides fresh catalog state, the bundled fallback preserves offline behavior,
and OpenClaw continues to use existing plugin and skill installers for explicit
installs.

The fallback is required. Users run OpenClaw in Docker, offline networks,
restricted enterprise environments, and regions where the public ClawHub endpoint
may not be reachable. Feed support must improve the online catalog without
breaking those installs.

### Feed composition

Feeds should support composition by convention, even if the first OpenClaw
client only consumes the final effective feed. A composed feed can start from a
parent feed and apply local rules: include only some entries, block entries,
change recommendation state, pin versions, add private entries, or publish a
regional variant.

The screen-share model from the design discussion used `register.openclaw.ai` as
the public OpenClaw feed endpoint and a tenant endpoint such as
`tenant.msft.azure.example` as a composed feed. Those names are illustrative,
but the RFC should preserve the topology: clients consume a feed, and feed
entries select local package-source profiles for the actual artifact.

```mermaid
flowchart TD
  NPM[npm package registry] --> Public[register.openclaw.ai public feed]
  Hub[ClawHub packages and review metadata] --> Public
  Public --> Global[Microsoft global tenant skills registry]
  MSPrivate[Microsoft first-party and private feeds] --> Global
  MetaOS[MetaOS/MOS3 registry integration] --> Global
  Regional[Regional feed overlays] --> Global
  Global --> TenantAdmin[Tenant admin feed controls]
  TenantAdmin --> Tenant[tenant.msft.azure.example effective feed]
  TeamFeeds[Team and org private feeds] --> Tenant
  TenantPolicy[Allow, block, pin, scan, publisher trust] --> Tenant
  Tenant --> Scout[Scout]
  Tenant --> Cowork[Cowork]
  Tenant --> Copilot[Copilot]
  Tenant --> OC[OpenClaw]
```

**Figure 2.** Enterprise composition keeps package sources such as npm and
ClawHub separate from the feed that clients consume, while allowing a global
enterprise registry, tenant admins, teams, and regional overlays to shape the
final effective feed.

Microsoft is one example of this pattern. ClawHub can publish the public feed at
an endpoint like `register.openclaw.ai`. MetaOS/MOS3 can integrate that feed
into a Microsoft global tenant skills registry, combine it with Microsoft
first-party and private feeds, and apply regional overlays. Tenant admins can
then further subset, block, pin, require scans, or restrict publishers before
publishing a tenant-scoped effective feed such as `tenant.msft.azure.example`.
Teams or organizations can contribute private feeds into that tenant layer when
the tenant permits it. Scout, Cowork, Copilot, and OpenClaw clients consume the
same effective feed contract. Other enterprises can publish the same shape from
their own registry, CI job, private Git repository, or static hosting service.

### Regional feeds

The feed model should allow regional variants. Some providers are only useful in
certain markets. Some providers may be unavailable or blocked in certain regions.
The feed endpoint can use edge routing, or the client can be configured with an
explicit regional feed URL. The feed document should make regional intent visible
so reviewers and mirrors can reason about it.

```mermaid
flowchart TD
  Root["ClawHub root feed<br/>teams, slack, zalo, wechat"] --> Global["Global feed<br/>teams recommended<br/>slack available"]
  Root --> VN["Vietnam feed<br/>zalo recommended<br/>teams available"]
  Root --> CN["China feed<br/>wechat recommended<br/>regional mirror required"]
  Rules["Regional rules<br/>provider availability<br/>legal or network blocks"] --> Global
  Rules --> VN
  Rules --> CN
  Mirror[China package mirror] --> CN
  Global --> DefaultClient[Default OpenClaw clients]
  VN --> VietnamClient[Vietnam OpenClaw clients]
  CN --> ChinaClient[China OpenClaw clients]
```

**Figure 3.** Regional feeds can share a root catalog while producing different
effective catalogs. One region can recommend Zalo, another can use a regional
mirror and recommend WeChat, and another can keep the default provider set.

Examples:

- A Vietnam feed can recommend Zalo during onboarding.
- A China feed can include providers and mirrors that only work in China.
- A region can temporarily disable or block an entry without requiring an
  OpenClaw application update.

### Feed governance versus runtime policy

Feeds own catalog governance. They decide what is present, recommended,
disabled, blocked, pinned, or eligible for update. They can carry metadata that
helps a policy engine make decisions.

Runtime policy remains separate. Tool-level MCP controls, such as disabling a
`send email` tool while allowing read-only tools, and parameter clamping, such
as restricting tool arguments to tenant-approved schemas, should not be hidden
inside the catalog contract. The RFC should leave room for feed entries to
reference policy metadata, but it should not make the feed format the runtime
policy engine.

### Marketplace naming

The user-facing surface can still be called a marketplace. The RFC should use
"feed" for the underlying protocol and artifact because it describes how the
catalog propagates through ClawHub, mirrors, enterprise registries, and clients.
A marketplace can be implemented on top of one or more feeds.

## Rationale

A hosted feed is the smallest change that unlocks remote catalog control without
requiring OpenClaw to become a hosted marketplace. It builds directly on the
existing external plugin catalog and npm install metadata. It also gives ClawHub
and enterprise administrators the same primitive: publish a catalog, let clients
verify it, and use existing package installers for the actual artifact.

A static JSON feed is easier to cache, mirror, review, and bundle than an API-only
registry. It can be hosted on edge infrastructure such as Cloudflare. It can be
copied into OpenClaw builds for fallback. It can be diffed in pull requests. It
can be mirrored by Tencent or other regional operators. It can also be generated
from richer systems such as ClawHub, MOS3, private Git repositories, or CI jobs.

This proposal deliberately separates the feed from package storage and source
configuration. npm already solves package distribution for current external
plugins. ClawHub can remain the public registry and package discovery surface.
Organizations can keep private artifacts in their own registries or Git hosts.
The feed only selects approved package candidates and records immutable
integrity data; local source profiles decide where those candidates resolve and
how the client authenticates.

The trust envelope is intentionally smaller than a full updater framework.
Directly configured keys cover the normal case. The optional trust document adds
remote publisher-key rotation and expiry without making the first implementation
own generic delegation, mirror, or artifact-update roles.

The bundled fallback is not optional. Without it, a feed outage or blocked
endpoint would break onboarding and plugin discovery. With it, hosted feeds add
freshness and control while preserving today’s offline behavior.

## Rollout plan

1. Refactor the existing external plugin manifest so the current local catalog
   shape can be generated from a feed document.
2. Add named feed and source profiles, including npm registry overrides,
   ClawHub-compatible base URLs, Git base paths, and secret-reference
   authentication.
3. Publish the first ClawHub-hosted feed for the existing official external
   plugins.
4. Update OpenClaw to load the bundled fallback, refresh hosted feeds after
   gateway startup, and store verified snapshots in SQLite.
5. Add conditional HTTP update detection with `ETag` and `Last-Modified`.
6. Add signed feed envelopes with directly configured keys, then add the
   optional rotating trust envelope when publisher-key rotation is required.
7. Add regional feed support once the default hosted feed path is stable.
8. Extend the same discovery contract to skills after the skill installer
   accepts catalog candidates.
9. Add composition guidance and examples for Microsoft/MOS3 and other
   tenant-admin systems.
10. Align Tencent, Xiaomi, and other regional mirrors before the spec is treated
    as stable.

## Unresolved questions

- Should the default ClawHub feed include only official entries, reviewed
  entries, trusted publisher entries, or several named feeds?
- Which `npm`, `clawhub`, and `git` source-profile fields should become stable
  user configuration, and which should remain installer implementation details?
- Should regional selection be client-configured, edge-routed, tenant-driven, or
  a combination?
- What user-facing noun should OpenClaw use: feed, marketplace, registry, or
  another term?
- Should a signed public feed be required from the first release, or should
  unsigned HTTPS feeds remain an explicit opt-in for self-hosted deployments?
- When should the optional trust envelope be introduced, and do public feeds need
  separate offline root keys from online publisher keys from day one?
- Which runtime policy metadata should feed entries be allowed to reference
  without turning the feed into a policy engine?
- How many stable OpenClaw releases should ship hosted feed fallback before
  Scout, Microsoft, and other clients depend on the contract?
- How should ClawHub represent trusted, verified, official, and reviewed
  publishers in the public feed?
