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

Add Iroh as an experimental OpenClaw Gateway transport.

Clients should be able to pair with and reconnect to a Gateway through Iroh endpoint identity, discovery, NAT traversal, and relay fallback, without requiring Tailscale or another VPN. OpenClaw Gateway authorization remains the source of trust.

## Motivation

OpenClaw Nodes currently depend on reachable Gateway URLs, Tailscale Serve/Funnel, or LAN access if the Node is not on localhost. These work, but they add friction. A phone user may need to install a VPN, configure it, and keep it running just to reach a Gateway. Users behind carrier-grade NAT (CGNAT) need complicated DDNS and reverse-proxy setups to publish their OpenClaw Gateway so external OpenClaw Nodes can connect to their home instance. Iroh solves this by exposing the Gateway as an application-level encrypted connection instead.

Iroh v1 provides a stable wire protocol plus APIs for Node.js, Rust, Python, Swift, and Kotlin. The `@number0/iroh` package and native mobile bindings make it a plausible transport for OpenClaw Gateway access through NATs.

## Product fit

This fits OpenClaw’s focus on setup reliability, first-run UX, companion apps, and safe defaults by making phone-to-Gateway access simpler without replacing Gateway auth.

## Terms

- Iroh ticket: A shareable bootstrap value with endpoint identity, relay hints, and direct addresses when available.
- Iroh `EndpointId`: A stable public endpoint identity derived from the endpoint secret key. If the Gateway persists that key, clients can remember the `EndpointId` and rediscover the Gateway after network changes.

## Goals

- Add an optional Gateway connection path, not a replacement for existing paths.
- Let clients pair with an Iroh ticket, then reconnect using the stored Gateway `EndpointId`.
- Preserve OpenClaw authentication, authorization, and device-pairing semantics.
- Add `gateway.iroh.enabled` as the experiment switch while keeping `gateway.bind` as the local HTTP/WebSocket bind policy.
- Keep Iroh endpoint configuration under `gateway.iroh.endpoint` using Iroh-native field names.
- Treat Iroh as remote Gateway exposure in setup, logs, diagnostics, and security audit.
- Keep the first implementation small and experimental.
- Keep Tailscale, remote URL, LAN, loopback, and custom bind paths working.
- Leave room for browser/WASM support if it proves practical.

## Non-goals

- Not replacing Tailscale.
- Not treating Iroh endpoint identity as application authorization.
- Not requiring all clients to support Iroh.
- Not designing self-hosted relays in the first version.
- Not exposing unauthenticated public Gateway access.

## Proposal

Add an experimental Iroh exposure flag:

```jsonc
{
  "gateway": {
    "bind": "loopback",
    "iroh": {
      "enabled": true,
      "secretKeyPath": "~/.openclaw/iroh-gateway.key",
      "endpoint": {}
    }
  }
}
```

`gateway.iroh.enabled` publishes an Iroh endpoint in addition to the normal Gateway listener. `gateway.bind` should keep its existing meaning: the local TCP bind policy for Gateway HTTP/WebSocket, Control UI, existing clients, and any localhost bridge. Keeping Iroh separate avoids overloading `bind` with a non-IP transport and lets the normal listener stay loopback-only while Iroh is treated as remote exposure.

`gateway.iroh.endpoint` should mirror Iroh’s native endpoint configuration. An empty object uses Iroh defaults, including default public relay and discovery infrastructure. Custom relay maps, relay presets, and related Iroh options should live under this object with Iroh’s own field names.

`gateway.iroh.secretKeyPath` is OpenClaw-owned. The Gateway should create the key on first use and reuse it so the Gateway keeps a stable `EndpointId`. The default path should live under the OpenClaw state directory. Key handling must:

- create parent directories with owner-only permissions
- write the key atomically with owner-only file permissions
- reject symlink paths
- fail startup if an existing key is unreadable or unsafe

When `gateway.iroh.enabled` is `true`, Gateway startup should:

1. Load or create the persisted Iroh secret key.
2. Build an Iroh endpoint from `gateway.iroh.endpoint` plus OpenClaw runtime values, including the secret key and ALPN.
3. Bring the endpoint online with an OpenClaw ALPN, for example `openclaw-gateway-v1`.
4. Add Iroh pairing data to the existing setup-code payload.

The setup-code payload should include the Gateway `EndpointId`, an `EndpointTicket`, and relay/discovery metadata useful for setup UI. The exact additive or versioned payload shape should be defined during the spike or implementation and must preserve existing setup-code clients. Clients should use the ticket for first pairing, then store the Gateway `EndpointId` for reconnects. This should let paired clients survive Gateway network changes without requiring a new QR code or setup flow.

Bootstrap token persistence over Iroh should require transport pinning: the connected Gateway `EndpointId` must match the setup-code or stored Gateway `EndpointId`, and the connection must use the expected OpenClaw ALPN. Iroh endpoint identity is still not application authorization, but it can decide whether the transport is trusted enough to persist bootstrap-issued device/operator tokens. On mismatch or missing pinning, clients should refuse token persistence and require re-pairing or explicit user confirmation.

The first release should focus on native mobile clients. A browser frontend can be part of the experiment only if Iroh WASM is practical. Browser support must account for current limits, including relay-only traffic and the need for an application-specific WASM wrapper.

The Gateway protocol mapping remains open for maintainer review:

- Preferred long term: native Gateway protocol framing over Iroh QUIC bidirectional streams.
- Lower-effort spike: an Iroh-to-localhost bridge inside the Gateway process, documented as experimental.

Iroh support must be treated as public remote Gateway exposure. OpenClaw must reject `gateway.iroh.enabled: true` with unauthenticated Gateway mode. Pairing must continue to use OpenClaw authorization, tokens, passwords, device records, or an equivalent application-level control.

Security and audit integration is part of v1. Doctor/security audit should surface Iroh exposure, weak or missing Gateway auth, unsafe Iroh key files, relay dependency and metadata implications, and ticket logging hazards.

After pairing, OpenClaw should consider binding client records to Iroh peer `EndpointId`s or requiring a bootstrap token before accepting a new peer. Logs and diagnostics should avoid full Iroh tickets because tickets may include direct IP addresses.

## Rationale

Iroh fits the Gateway problem: stable public-key endpoint identity, QUIC streams, NAT traversal, and relay fallback without VPN setup. Its v1 protocol and Node, Swift, and Kotlin APIs make Gateway plus mobile support realistic.

Keeping Iroh optional limits risk. Tailscale remains mature and already works. Iroh adds new questions around public relays, address discovery, native bindings, browser packaging, and mobile integration. An experimental transport lets OpenClaw test pairing and reconnect flows before committing to Iroh as a permanent option.

`gateway.iroh.enabled` is intentionally separate from `gateway.bind`: `bind` remains the local HTTP/WebSocket listener policy, while Iroh is an additional non-TCP exposure path. This keeps existing Gateway semantics, security checks, and Control UI behavior clear while still allowing either native Iroh streams or a localhost bridge during the experiment. Low-level endpoint configuration should stay close to Iroh’s native config so OpenClaw does not need to maintain a parallel naming layer.

## Future question

- Should OpenClaw run its own relay servers? Decide after measuring the user flow with Iroh’s existing relay and discovery infrastructure.

## Unresolved questions

- Should v1 use native Gateway protocol streams or a localhost bridge?
- Should paired client records store and enforce client Iroh `EndpointId`s?
- Which Iroh endpoint fields should OpenClaw expose 1:1?
- Should v1 support native mobile only, or require browser/WASM support too?
- How should setup UI explain public relay dependency and metadata exposure?
