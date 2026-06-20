---
title: Iroh Gateway transport
authors:
  - Benjamin Jesuiter
created: 2026-06-20
last_updated: 2026-06-20
status: draft
issue:
rfc_pr:
---

# Proposal: Iroh Gateway transport

## Summary

Add Iroh as an optional OpenClaw Gateway transport so clients can discover and
connect to a Gateway without requiring a VPN such as Tailscale. The first version should coexist with the existing Gateway connection options and use Iroh endpoint identity, address lookup, NAT traversal, and relay fallback while preserving OpenClaw's existing Gateway authorization model.

## Motivation

OpenClaw currently relies on existing reachable Gateway URLs, remote URLs,
Tailscale Serve/Funnel, or LAN/custom bind addresses during pairing. Tailscale is a strong option for desktop and trusted-network workflows, but it is a high-friction dependency for mobile clients because users need to install and configure a VPN and, most importantly, keep it running to be able to reach the gateway from the phone. This might increase battery draw and greatly reduces friction for low-bandwith or high-latency networks.

One concrete example is mobile app testing (or production usage, too) against a local Gateway. A user may have an OpenClaw Gateway bound to localhost only, especially when only using Telegram as a transport iwth message polling mode. To test from an iPhone, they would need to open the Gateway port and then either forward it through a VPN such as NetBird or expose it through a reverse proxy. That feels more complex and less secure than directly pairing the phone with the Gateway over an application-level Iroh connection.

Iroh v1 provides a stable wire protocol and supported APIs for Rust, Python,
Node.js, Swift, and Kotlin. It exposes a Node package, `@number0/iroh`, and native mobile bindings for Swift and Kotlin. This makes it a plausible transport layer for OpenClaw clients that need to connect to a user-owned Gateway through NATs without asking users to set up a VPN. Also, this might be more performant than tunneling https trafic over a VPN, since it sets up on the transport protocol layer (QUIC) directly, including encrypting the connection.

## Glossary

- **Iroh ticket**: A shareable connection bootstrap value. For OpenClaw, it is
  similar to a pairing code, but it can carry more network data, such as the
  Gateway's Iroh endpoint identity, relay hints, and direct IP/port addresses
  when they are available.
- **Iroh `EndpointId`**: The stable public identity of an Iroh endpoint. It is
  derived from the endpoint's secret key. If the Gateway persists that secret key
  across restarts, clients can remember the Gateway's `EndpointId` and use Iroh
  discovery to find its current address instead of depending on old ticket data.

## Goals

- Provide an optional Gateway connection path that is as simple to use as
  starting the localhost Gateway and using it with the Telegram provider.

- Provide an optional Gateway transport that works without requiring Tailscale or another VPN.
- Let clients pair with a Gateway using an Iroh ticket or endpoint identity.
- Allow paired clients to reconnect after Gateway network changes without
  requiring a new QR code or setup flow.
- Preserve OpenClaw Gateway authentication, authorization, and device-pairing
  semantics.
- Add Iroh as a Gateway bind option because it provides a client connection
  entrypoint, while keeping Iroh-specific endpoint configuration aligned with
  normal Iroh configuration.
- Keep Tailscale and existing Gateway URL discovery paths available.
- Make the first implementation small enough to validate with mobile clients
  first before committing to Iroh as a default transport.
- Leave room for a browser-based frontend to connect to the Iroh endpoint if the
  Iroh WASM implementation proves suitable, so contributors do not need the full
  OpenClaw app development environment to try the flow.

## Non-Goals

- Replacing Tailscale as a supported Gateway connection path.
- Treating Iroh endpoint identity as sufficient application authorization.
- Requiring all clients to implement Iroh before existing Gateway transports keep
  working.
- Designing a fully self-hosted relay service as part of the first version.
- Exposing public unauthenticated Gateway access.

## Proposal

Add Iroh as an experimental Gateway bind target:

```jsonc
{
  "gateway": {
    "bind": "iroh",
    "iroh": {
      "secretKeyPath": "~/.openclaw/iroh-gateway.key",
      "endpoint": {}
    }
  }
}
```

`gateway.bind: "iroh"` means the local Gateway publishes an Iroh endpoint as its
client connection entrypoint. It belongs with the existing bind policies because
`gateway.bind` already describes how clients reach the local Gateway:
`"loopback"` for localhost-only, `"lan"` for local-network exposure,
`"tailnet"` for a Tailscale address, and `"custom"` for an explicit host.

`gateway.iroh.endpoint` is the Iroh-owned endpoint configuration. Its shape should
mirror normal Iroh configuration instead of translating through OpenClaw-specific
names. An empty object uses Iroh's default endpoint behavior, including the
default public relay and discovery infrastructure. If the RFC or implementation
needs custom relay maps, relay presets, or other Iroh endpoint options, those
fields should be exposed under `gateway.iroh.endpoint` using Iroh's native names.
OpenClaw UI and help text can explain those native fields in product language.

`gateway.iroh.secretKeyPath` is an OpenClaw-owned Gateway lifecycle field. The
Gateway should create the secret key on first use and reuse it across restarts so
it keeps a stable Iroh `EndpointId`. Other OpenClaw-owned fields, if needed,
should live beside `endpoint` under `gateway.iroh` and be merged with the Iroh
endpoint config when constructing the endpoint.

When `gateway.bind` is `"iroh"`, Gateway startup should:

1. Load or create the persisted Iroh secret key.
2. Construct an Iroh endpoint from `gateway.iroh.endpoint` plus OpenClaw-owned
   runtime values such as the secret key and ALPN.
3. Bring the endpoint online with an OpenClaw-specific ALPN such as
   `openclaw-gateway-v1`.
4. Publish Iroh pairing data alongside the existing setup-code payload.

The setup-code payload should include enough Iroh data for bootstrap pairing,
such as the Gateway `EndpointId`, an `EndpointTicket`, and relay/discovery
metadata suitable for UI display. Clients should use tickets for bootstrap
pairing, then store the Gateway `EndpointId` for reconnects. This lets paired
clients reconnect after network changes without requiring a new QR code or setup
flow.

The initial release should be experimental and mobile-first. A browser-based
frontend may also be part of the experiment if Iroh's WASM implementation can
connect to the same Gateway endpoint with acceptable packaging, browser
compatibility, and security constraints. Existing Tailscale, remote URL, LAN, and
loopback Gateway paths should continue to work.

The RFC intentionally leaves the Gateway protocol mapping unresolved. The first
implementation must choose between native Gateway protocol framing over Iroh QUIC
bidirectional streams and an Iroh-to-localhost bridge inside the Gateway process.
Native streams are the preferred long-term shape, while a localhost bridge may be
a lower-risk spike if it preserves existing Gateway behavior.

Iroh support must be treated as public/remote Gateway exposure. The Gateway must
not allow `gateway.bind: "iroh"` with unauthenticated Gateway mode. Pairing must
continue to use OpenClaw authorization, tokens, passwords, device records, or an
equivalent application-level control. After pairing, OpenClaw should consider
binding client records to Iroh peer `EndpointId`s or requiring a bootstrap token
before accepting a new peer. Logs and diagnostics should avoid full Iroh tickets
because tickets may include direct IP addresses.

## Rationale

Iroh is a good fit for the Gateway problem because it gives OpenClaw stable
public-key endpoint identities, QUIC streams, NAT traversal, and relay fallback
without asking users to configure a VPN. The v1 release and official Node,
Swift, and Kotlin APIs make it realistic for the Gateway and mobile clients.

Keeping Iroh optional reduces risk. Tailscale remains mature, user-controlled,
and already integrated into OpenClaw's connection flow. Iroh introduces new
operational questions around public relay dependency, address discovery,
packaging native bindings, browser/WASM viability, and mobile client
implementation. Treating it as an experimental transport lets OpenClaw learn from real pairing and reconnect flows without disrupting existing users.

Modeling Iroh as `gateway.bind: "iroh"` fits the existing Gateway mental model
better than adding a separate `gateway.iroh.enabled` or `gateway.iroh.mode` flag:
it selects the entrypoint clients use to reach the local Gateway. The low-level
endpoint configuration should still mirror Iroh's native configuration surface so
OpenClaw does not introduce a product-level mapping layer that must be maintained
separately from Iroh. OpenClaw-specific fields should follow existing Gateway
config conventions, such as `*Path` for filesystem-backed material and nested
objects for transport-owned config. When OpenClaw needs extra Gateway-specific
values, it can merge those values with the Iroh config at endpoint construction
time. UI and help text can still explain that the default relay mode uses public
relay and discovery infrastructure.

Native Gateway protocol over Iroh streams is cleaner than a localhost bridge,
but the bridge may be useful for a short spike. This RFC intentionally leaves the
native-streams-versus-bridge decision unresolved so maintainers can decide it
during review with more implementation evidence.

## Future questions

- Do we want to run OpenClaw relay servers to make this easier for users? The
  suggested answer for now is to decide after measuring the impact on the user
  flow when using Iroh's existing relay and discovery infrastructure.

## Unresolved questions

- Should the first implementation use native Gateway protocol framing over Iroh
  streams, or an Iroh-to-localhost bridge?
- What exact fields should the setup-code payload expose for Iroh pairing?
- Should paired client records store and enforce client Iroh `EndpointId`s?
- What exact Iroh endpoint configuration fields should OpenClaw expose 1:1 under
  `gateway.iroh.endpoint` for self-hosted or OpenClaw-operated relay
  deployments?
- Should the first supported client be native mobile only, or should the RFC also
  require a browser frontend using Iroh WASM for easier review and contribution?
- How should OpenClaw present public relay dependency and metadata implications
  in setup UI and security audits?
