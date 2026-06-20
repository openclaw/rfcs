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
connect to a Gateway without requiring a VPN such as Tailscale. The first version
should coexist with the existing Gateway connection options and use Iroh endpoint
identity, address lookup, NAT traversal, and relay fallback while preserving
OpenClaw's existing Gateway authorization model.

## Motivation

OpenClaw currently relies on existing reachable Gateway URLs, remote URLs,
Tailscale Serve/Funnel, or LAN/custom bind addresses during pairing. Tailscale is
a strong option for desktop and trusted-network workflows, but it is a high-friction
dependency for mobile clients because users need to install and configure a VPN and, most importantly, keep it running to be able to reach the gateway from the phone. This might increase battery draw and greatly reduces friction for low-bandwith, high-latency networks

One concrete example is mobile app testing (or production usage, too) against a local Gateway. A developer may have an OpenClaw Gateway bound to localhost only. To test from an iPhone,
they would need to open the Gateway port and then either forward it through a VPN such as NetBird or expose it through a reverse proxy. That feels more complex and less secure than directly pairing the phone with the Gateway over an
application-level Iroh connection.

Iroh v1 provides a stable wire protocol and supported APIs for Rust, Python,
Node.js, Swift, and Kotlin. It exposes a Node package, `@number0/iroh`, and native mobile bindings for Swift and Kotlin. This makes it a plausible transport layer for OpenClaw clients that need to connect to a user-owned Gateway through NATs without asking users to set up a VPN. Also, this might be more performant than tunneling https trafic over a VPN, since it sets up on the transport protocol layer (QUIC) directly, including encrypting the connection 

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

Add an experimental Iroh Gateway transport behind explicit configuration:

```jsonc
{
  "gateway": {
    "bind": "iroh",
    "iroh": {
      "secretKeyPath": "~/.openclaw/iroh-gateway.key",
      "endpoint": {
        "relayMode": "default"
      }
    }
  }
}
```

`gateway.bind` should gain an `"iroh"` option because Iroh provides a Gateway
entrypoint in the same broad family as the existing bind policies. Today
`gateway.bind` describes how clients can reach the local Gateway: `"loopback"`
for localhost-only, `"lan"` for local-network exposure, `"tailnet"` for a
Tailscale address, and `"custom"` for an explicit host. `"iroh"` would mean the
Gateway remains locally owned but publishes an Iroh endpoint for client
connections.

The shape under `gateway.iroh.endpoint` should be a 1:1 representation of normal
Iroh endpoint configuration wherever possible. OpenClaw should not invent
product-level config names that map onto Iroh concepts. If OpenClaw needs
additional values for Gateway lifecycle, persistence, or UI, those values should
live next to `endpoint` under `gateway.iroh` and be merged with the Iroh endpoint
config when constructing the endpoint.

`gateway.iroh.endpoint.relayMode` is an example of this approach if that is the
native Iroh configuration name. The first supported relay mode should represent
Iroh's default public relay and address-discovery infrastructure. OpenClaw UI and
help text should describe this as public relay infrastructure rather than hiding
or renaming the native Iroh field in configuration. Future values may include a custom relay map for self-hosted or OpenClaw-operated
relay deployments if those match Iroh's configuration surface.

`gateway.iroh.secretKeyPath` is an OpenClaw-specific value for persisted Gateway
identity unless Iroh provides an equivalent config field. Its name follows the
existing Gateway config style for filesystem-backed credentials such as
`gateway.tls.certPath` and `gateway.tls.keyPath`. The Gateway should create this
key on first use and reuse it so the Gateway keeps a stable Iroh `EndpointId`
across restarts.

When enabled, the Gateway should bind an Iroh endpoint with an OpenClaw-specific
ALPN such as `openclaw-gateway-v1`. The Gateway should publish Iroh pairing data
alongside the existing setup-code payload. The pairing payload may include:

- the Gateway Iroh `EndpointId`
- an `EndpointTicket` for QR/bootstrap pairing
- relay mode metadata suitable for UI display

Long-term reconnect should store the Gateway `EndpointId` and rely on Iroh
address lookup. Tickets are useful for bootstrap pairing, but they may contain
direct IP address information and can become stale.

The RFC process should decide between two transport designs before
implementation:

1. Native Gateway protocol over Iroh QUIC bidirectional streams.
   - This is the preferred long-term design.
   - It avoids exposing a local HTTP/WebSocket server through a bridge.
   - It requires clients to implement an Iroh transport for the Gateway protocol.
2. Iroh-to-localhost bridge inside the Gateway process.
   - This may be faster to prototype.
   - Incoming Iroh streams proxy to `127.0.0.1:<gatewayPort>`.
   - It carries more proxy, WebSocket, and security complexity.

The initial release should be experimental and optimized for mobile pairing and
connectivity validation. A browser-based frontend may also be part of the
experiment if Iroh's WASM implementation can connect to the same Gateway endpoint with acceptable packaging, browser compatibility, and security constraints. This would make the prototype easier for reviewers and contributors who are not set up to build the native OpenClaw app.

Iroh support must be audited as public/remote Gateway exposure. The Gateway must
not allow Iroh transport with unauthenticated Gateway mode. Pairing should keep
using OpenClaw authorization, tokens, passwords, device records, or equivalent
application-level controls. After pairing, OpenClaw should consider binding
client records to Iroh peer `EndpointId`s or requiring a bootstrap token before a new peer is accepted.

The Gateway should avoid logging full Iroh tickets because tickets may include
direct IP addresses. Configuration audit warnings should explain that public
relay mode uses public n0 infrastructure for relay and discovery fallback while
traffic remains encrypted end-to-end by Iroh.

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
