---
title: Iroh Gateway transport
authors:
  - Benjamin Jesuiter
created: 2026-06-20
last_updated: 2026-06-20
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/23
---

# Proposal: Iroh Gateway transport

## Summary

Add Iroh as an experimental OpenClaw Gateway transport so clients can pair with and reconnect to a Gateway through Iroh endpoint identity, discovery, NAT traversal, and relay fallback, without requiring Tailscale or another VPN. OpenClaw Gateway authorization remains the source of trust.

## Motivation

OpenClaw Nodes currently depend on reachable Gateway URLs, Tailscale Serve/Funnel, or LAN access if the Node is not on localhost. These work, but they add friction. A phone user may need to install a VPN, configure it, and keep it running just to reach a Gateway. Users behind carrier-grade NAT (CGNAT) need complicated DDNS and reverse-proxy setups to publish their OpenClaw Gateway so external OpenClaw Nodes can connect to their home instance. Iroh solves this by exposing the Gateway as an application-level encrypted connection instead.

[Iroh v1](https://www.iroh.computer/blog/v1) provides a stable wire protocol plus APIs for Node.js, Rust, Python, Swift, and Kotlin. The `@number0/iroh` package and native mobile bindings make it a plausible transport for OpenClaw Gateway access through NATs.

This fits OpenClaw’s focus on setup reliability, first-run UX, companion apps, and safe defaults by making phone-to-Gateway access simpler.

## Goals

- Add an optional Gateway connection path, not a replacement for existing paths.
- Let clients pair with an Iroh ticket, then reconnect using the stored Gateway `EndpointId`.
- Add `gateway.iroh.enabled` as the experiment switch without changing `gateway.bind` semantics.
- Keep Iroh endpoint configuration under `gateway.iroh.endpoint` using Iroh-native field names.
- Treat Iroh as remote Gateway exposure in setup, logs, diagnostics, and security audit.
- Keep the first implementation small and experimental.
- Keep Tailscale, remote URL, LAN, loopback, and custom bind paths working.

## Non-Goals

- Not replacing Tailscale.
- Not using Iroh endpoint identity as application authorization or exposing unauthenticated public Gateway access.
- Not requiring all clients to support Iroh.
- Not designing self-hosted relays in the first version.

## Proposal

- Iroh ticket: A shareable bootstrap value with endpoint identity, relay hints, and direct addresses when available.
- Iroh `EndpointId`: A stable public endpoint identity derived from the endpoint secret key. If the Gateway persists that key, clients can remember the `EndpointId` and rediscover the Gateway after network changes.

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

`gateway.iroh.enabled` publishes an Iroh endpoint in addition to the normal Gateway listener. `gateway.bind` should keep its existing meaning: the local TCP bind policy for Gateway HTTP/WebSocket, Control UI, existing clients, and any validation-only Iroh-to-localhost bridge spike. Keeping Iroh separate avoids overloading `bind` with a non-IP transport and lets the normal listener stay loopback-only while Iroh is treated as remote exposure.

`gateway.iroh.endpoint` should mirror Iroh’s native endpoint configuration. An empty object uses Iroh defaults, including default public relay and discovery infrastructure. OpenClaw should either pass this object through to Iroh or validate only the minimal subset needed for safety and diagnostics; it should not maintain a parallel full schema. Custom relay maps, relay presets, and related Iroh options should live under this object with Iroh’s own field names.

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

The setup-code payload should include the Gateway `EndpointId`, an `EndpointTicket`, and setup UI relay/discovery metadata. The exact additive or versioned payload shape should be defined during the spike or implementation and must preserve existing setup-code clients. Clients should use the ticket for first pairing and store the Gateway `EndpointId` for reconnects after network changes.

Bootstrap token persistence over Iroh should require transport pinning: clients may persist bootstrap-issued device/operator tokens only when the connected Gateway `EndpointId` matches the setup-code or stored Gateway `EndpointId` and the connection uses the expected OpenClaw ALPN. On mismatch or missing pinning, clients should refuse token persistence and require re-pairing or explicit user confirmation.

V1 should add Gateway-side Iroh support. Native mobile is the intended validation path, but Gateway support should not depend on a specific first client. Browser/WASM support is not a v1 product requirement; include it only if needed for development, review, or testing. Browser support must account for current limits, including relay-only traffic and the need for an application-specific WASM wrapper.

V1 should use a full native Iroh Gateway transport: native Gateway protocol framing over Iroh QUIC bidirectional streams using the OpenClaw ALPN. The Iroh path should be modeled, tested, diagnosed, and secured as a first-class Gateway transport rather than as a proxy into the local HTTP/WebSocket listener.

An Iroh-to-localhost HTTP bridge inside the Gateway process may be used only as a validation spike. It can de-risk endpoint persistence, pairing, relay behavior, and mobile connectivity before the native transport is complete, but it should not be accepted as the v1 architecture.

Iroh support must be treated as public remote Gateway exposure. OpenClaw must reject `gateway.iroh.enabled: true` with unauthenticated Gateway mode.

Security and audit integration is part of v1. Doctor/security audit should surface Iroh exposure, weak or missing Gateway auth, unsafe Iroh key files, relay dependency and metadata implications, and ticket logging hazards.

For v1, Gateway-side enforcement of client Iroh `EndpointId`s is left for later. Existing device tokens and pairing records remain the client authorization boundary. Logs and diagnostics should avoid full Iroh tickets because tickets may include direct IP addresses.

## Rationale

Iroh fits the Gateway problem: stable public-key endpoint identity, QUIC streams, NAT traversal, and relay fallback without VPN setup. Its v1 protocol and Node, Swift, and Kotlin APIs make Gateway plus mobile support realistic.

Choosing the full native Iroh Gateway path costs more than an Iroh-to-localhost HTTP bridge because OpenClaw must define Gateway protocol framing over QUIC streams and test auth, reconnects, diagnostics, and failure modes on a second transport. That extra implementation work is preferable to shipping a proxy architecture. A bridge has lower initial implementation cost because it reuses the existing HTTP Gateway, but it also adds proxying behavior, duplicates exposure/security decisions around the local listener, and can hide transport-specific failure modes that production Iroh support needs to handle directly.

Keeping Iroh optional limits risk. Tailscale remains mature and already works. Iroh adds new questions around public relays, address discovery, native bindings, browser packaging, and mobile integration. An experimental transport lets OpenClaw test pairing and reconnect flows before committing to Iroh as a permanent option.

Keeping low-level endpoint configuration close to Iroh’s native config avoids a parallel naming layer while still allowing custom relay maps and other Iroh options to pass through cleanly.

## Unresolved questions

Relevant follow-up questions that do not block accepting this RFC:

- Should OpenClaw run its own relay servers? Decide after measuring the user flow with Iroh’s existing relay and discovery infrastructure.
- Should a later version store and enforce each paired client’s stable Iroh `EndpointId` as additional defense in depth? This depends on mobile clients persisting Iroh secret keys reliably and having clear recovery for reinstalls or key rotation.
