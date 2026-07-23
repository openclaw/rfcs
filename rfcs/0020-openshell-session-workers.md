---
title: OpenShell Session Workers and Local Inference
authors:
  - sallyom
created: 2026-07-16
last_updated: 2026-07-23
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/43
---

# Proposal: OpenShell Session Workers and Local Inference

## Summary

When the OpenShell plugin is installed and enabled, register OpenShell as an
OpenClaw worker provider so each dispatched session placement owns one
OpenShell sandbox, without placing the OpenClaw Gateway inside an outer
OpenShell sandbox. The worker can use the existing OpenClaw Gateway inference
proxy or an optional credential-free `inference.local` route whose provider
credential remains in the OpenShell Gateway. OpenShell scopes sandboxes,
providers, and one user inference provider/model route to a workspace, so
local inference is fixed for a placement and does not support in-session
provider or model switching.

## Motivation

NemoClaw's current deployment shape starts one OpenClaw Gateway inside one
OpenShell sandbox. That provides one containment and inference boundary for the
whole Gateway, but it does not provide an independently disposable sandbox for
each OpenClaw agent session. OpenClaw's cloud-worker placement model already
has the missing lifecycle semantics: a durable placement provisions one
environment, attaches exactly one session, runs the restricted `openclaw
worker` runtime, and destroys the environment when the session is reclaimed.

The OpenShell plugin's existing sandbox backend solves a different problem. If
that capability is enabled for a local agent, the agent loop stays on the
OpenClaw Gateway while exec and filesystem tools are redirected into an
OpenShell sandbox. Enabling that backend inside a NemoClaw-style outer sandbox
would require the child to receive OpenShell control-plane authority to create
another sandbox. If granted, it creates nested OpenShell sandboxes; if not,
provisioning fails. Neither outcome supplies the intended ownership model.

OpenShell also owns useful inference and credential machinery.
Operators create workspace-scoped provider records with
`openshell --workspace <name> provider create` and select the workspace-scoped
inference route with `openshell --workspace <name> inference set`. Sandbox
processes call `inference.local`; OpenShell resolves
and injects the selected provider credential at its privacy router. A worker
provider alone does not select that path because OpenClaw workers normally
proxy model calls back to the OpenClaw Gateway. Local inference therefore needs
an explicit provider-neutral worker contract, not an implicit OpenShell or
hostname special case in core.

## Goals

- Register the `openshell` worker provider only when the OpenShell plugin is
  installed and enabled.
- Provision one OpenShell sandbox for each OpenClaw worker environment and,
  through the existing placement invariant, attach at most one session to it.
- Keep the OpenClaw Gateway outside the OpenShell sandbox and avoid nested
  OpenShell lifecycle.
- Let the plugin use OpenShell for sandbox creation, policy, provider
  attachments, inspection, authenticated SSH sessions, and deletion.
- Support OpenShell's SSH `ProxyCommand` without weakening host-key pinning for
  direct-SSH worker providers.
- Preserve durable idempotency across OpenClaw Gateway restarts by deriving the
  OpenShell sandbox name from the OpenClaw provision operation id.
- Keep Gateway-proxied inference as the default and add an explicit,
  credential-free local-inference mode.
- Keep the OpenShell provider credential and OpenShell administrative identity
  out of the worker launch descriptor, worker record, and child process.
- State and enforce the current limit of one `inference.local` provider/model
  selection per OpenShell workspace.
- Keep the OpenShell tool-sandbox backend available as a separate execution
  shape when the plugin is enabled.

## Non-Goals

- Running the OpenClaw Gateway itself inside OpenShell.
- Enabling the OpenShell sandbox backend inside an OpenShell worker.
- Treating one OpenShell sandbox as a shared multi-session worker.
- Making OpenShell a built-in or always-available OpenClaw integration when its
  plugin is absent or disabled.
- Moving channel, plugin-service, forge, or general OpenClaw secret
  management into OpenShell.
- Making OpenClaw interpret, export, or persist OpenShell provider credential
  values.
- Adding per-sandbox or per-session inference routes to OpenShell; that needs a
  new upstream OpenShell contract beyond workspace-scoped routes.
- Supporting dynamic provider/model switching or fallback within one local
  inference placement.

## Proposal

### Plugin and runtime boundary

The OpenClaw Gateway runs normally on the operator host. The OpenShell
integration exists only when `@openclaw/openshell-sandbox` is installed and
enabled. The plugin then registers both its existing `SandboxBackend` and the
new `WorkerProvider` capability. If the plugin is absent or disabled,
`provider: "openshell"` is not registered and an OpenShell cloud-worker profile
cannot dispatch.

A configured `cloudWorkers.profiles.<id>` entry selects worker provider
`openshell`. On session dispatch, OpenClaw creates a durable worker environment
and calls the plugin with a stable provision operation id. The plugin derives a
bounded deterministic sandbox name, adopts or creates that exact OpenShell
sandbox, and returns its lease id and provider-authenticated SSH proxy
endpoint.

```text
OpenClaw Gateway
  ├─ session A placement ─ OpenShell sandbox A ─ restricted openclaw worker
  ├─ session B placement ─ OpenShell sandbox B ─ restricted openclaw worker
  └─ OpenShell CLI/control plane ─ creates, inspects, and deletes A and B
```

OpenClaw's existing rule that an attached worker environment has exactly one
session supplies the per-session boundary. A reclaimed or failed placement is
reconciled and its exact sandbox is deleted through the provider. There is no
outer sandbox and no second sandbox plugin inside the worker. General plugins
are not loaded in the restricted worker runtime.

### Multi-gateway workspace layout

An OpenShell workspace is the tenancy boundary for a configured OpenClaw
Gateway. Each workspace has one optional shared `inference.local` route. The
OpenShell Gateway brokers the provider credential for that route; session
workers receive neither that credential nor a per-session route. The diagram
below shows local-inference mode: each session worker runs its agent loop and
tools inside its own OpenShell sandbox, then calls the shared local route. The
OpenClaw Gateway is the control plane and tunnel endpoint in this mode; it does
not make the worker's model calls. Gateway-proxy inference is a distinct mode
and is not depicted here.

```text
OpenShell Gateway
├─ OpenShell Workspace A1 (configured by OpenClaw Gateway A, worker profile A1)
│  ├─ inference.local → OpenShell credential broker → Provider/model A
│  ├─ OpenShell Sandbox A1.1 → Session worker A1.1 (agent loop + tools; no provider credential)
│  │                              └─ model calls → inference.local
│  ├─ OpenShell Sandbox A1.2 → Session worker A1.2 (agent loop + tools; no provider credential)
│  │                              └─ model calls → inference.local
│  └─ OpenShell Sandbox A1.3 → Session worker A1.3 (agent loop + tools; no provider credential)
│                                 └─ model calls → inference.local
├─ OpenShell Workspace A2 (configured by OpenClaw Gateway A, worker profile A2)
│  ├─ inference.local → OpenShell credential broker → Provider/model B
│  ├─ OpenShell Sandbox A2.1 → Session worker A2.1 (agent loop + tools; no provider credential)
│  │                              └─ model calls → inference.local
│  ├─ OpenShell Sandbox A2.2 → Session worker A2.2 (agent loop + tools; no provider credential)
│  │                              └─ model calls → inference.local
│  └─ OpenShell Sandbox A2.3 → Session worker A2.3 (agent loop + tools; no provider credential)
│                                 └─ model calls → inference.local
├─ OpenShell Workspace B (configured by OpenClaw Gateway B)
│  ├─ inference.local → OpenShell credential broker → Provider/model C
│  ├─ OpenShell Sandbox B1 → Session worker B1 (agent loop + tools; no provider credential)
│  │                             └─ model calls → inference.local
│  ├─ OpenShell Sandbox B2 → Session worker B2 (agent loop + tools; no provider credential)
│  │                             └─ model calls → inference.local
│  └─ OpenShell Sandbox B3 → Session worker B3 (agent loop + tools; no provider credential)
│                                └─ model calls → inference.local
└─ OpenShell Workspace C (configured by OpenClaw Gateway C)
   ├─ inference.local → OpenShell credential broker → Provider/model D
   ├─ OpenShell Sandbox C1 → Session worker C1 (agent loop + tools; no provider credential)
   │                            └─ model calls → inference.local
   ├─ OpenShell Sandbox C2 → Session worker C2 (agent loop + tools; no provider credential)
   │                            └─ model calls → inference.local
   └─ OpenShell Sandbox C3 → Session worker C3 (agent loop + tools; no provider credential)
                                └─ model calls → inference.local
```

This is a configuration relationship, not a nesting relationship: the
OpenClaw Gateway remains outside the OpenShell sandboxes and selects its
workspace through the worker profile. OpenShell does not automatically allocate
one workspace per Gateway; deployments that need that tenant boundary must
configure unique workspace names. One OpenClaw Gateway may select more than one
workspace through distinct worker profiles (A1 and A2 above); each retains its
own `inference.local` route and credentials.

The OpenShell worker profile reuses the plugin's provider-owned settings where
applicable: CLI command, Gateway name or endpoint, workspace, sandbox source,
policy, attached provider names, GPU request, automatic provider attachment,
and timeout. `settings.workspace` defaults to `default`; it must name an
existing OpenShell workspace that the CLI identity can access. OpenClaw stores
the validated profile snapshot with the durable environment so reconciliation
does not depend on later profile edits.

### Provider-authenticated SSH transport

Direct-SSH worker providers return a host, port, user, private-key `SecretRef`,
and provisioning-supplied host key. OpenClaw keeps `StrictHostKeyChecking=yes`
and uses an isolated pinned `known_hosts` file for that transport.

OpenShell exposes a different trust shape. `openshell sandbox ssh-config`
returns a host alias and a `ProxyCommand` that invokes `openshell ssh-proxy`.
The proxy uses the operator's selected OpenShell Gateway metadata and mTLS
identity to mint a short-lived, sandbox-scoped SSH session for each connection.
Trust is rooted in that authenticated control-plane tunnel rather than a stable
sandbox SSH host key.

The plugin SDK therefore adds a discriminated provider-authenticated proxy
transport. Core persists only the bounded host, port, user, and credential-free
proxy command. It retains the existing forwarding, agent, X11, multiplexing,
batch, timeout, and process-lifetime restrictions. Direct SSH keeps its
existing identity resolution and host-key pinning unchanged. A proxy command
must not contain a bearer token or other persistent credential.

### Upstream reverse Unix-socket forwarding prerequisite

The OpenClaw worker transport needs one sandbox-local listener that the
authenticated worker SSH client bridges to the OpenClaw Gateway's loopback
listener in both Gateway-proxy and local-inference modes. It relies on the
OpenShell implementation in
[`sallyom/openshell-openclaw-worker-tunnel`](https://github.com/sallyom/OpenShell/tree/openshell-openclaw-worker-tunnel)
before the worker provider can support either inference mode. The associated
draft OpenClaw implementation is in
[`sallyom/openshell-session-workers`](https://github.com/sallyom/openclaw/tree/openshell-session-workers).

The proposed OpenShell contract is deliberately generic and default-deny. A
sandbox policy may opt in with `ssh.remote_streamlocal_forward_root`; the SSH
server then accepts only a reverse Unix listener at
`<root>/<private-client-directory>/<socket-name>`. The child directory must
already exist, be non-symlinked, and have no group or other permissions. TCP
forwarding and paths outside that root remain rejected. The supervisor creates
the listener with owner-only permissions and removes it when forwarding is
cancelled or the SSH session ends.

This is an SSH capability for any approved sandbox harness, rather than an
OpenClaw socket convention. The OpenClaw plugin chooses a private directory and
socket name for each worker environment. The OpenShell policy owner explicitly
decides whether that sandbox may expose such a listener; OpenShell cannot
inspect the SSH client's host-side forwarding target.

An OpenClaw worker policy must opt in explicitly, for example:

```yaml
ssh:
  remote_streamlocal_forward_root: /tmp
```

### Gateway-proxy inference mode

Gateway-proxy inference remains the default. The agent loop and tools run
inside the OpenShell sandbox, while inference requests travel over the worker
tunnel to the OpenClaw Gateway. This mode provides per-session OpenShell
isolation and OpenShell-controlled tool egress without moving model credential
ownership or provider routing away from OpenClaw.

### OpenShell-local inference mode

A worker provider may return an optional, provider-neutral local inference
route with its lease:

- `mode: "local"`;
- `api`: `anthropic-messages`, `openai-completions`, or `openai-responses`;
- a credential-free HTTPS `baseUrl`;
- the OpenClaw provider id and model id expected by the route; and
- an optional provider-owned route version.

For an OpenShell worker profile, `settings.inference` supplies four values:

- `provider`: the OpenShell provider record selected by `openshell inference
  set`;
- `openclawProvider`: the OpenClaw model provider id selected by the session;
- `model`: the fixed model id; and
- `api`: the model API protocol used by the route.

Before sandbox allocation, the plugin runs `openshell --workspace
<settings.workspace> inference get` against the selected OpenShell Gateway. It
requires the effective workspace inference provider and model to match the
profile. A mismatch fails closed before
allocation; OpenClaw does not mutate the OpenShell route and does not fall back
to Gateway inference. Repeated provisioning with the same operation id performs
the same validation before adopting the deterministic sandbox.

Anthropic Messages uses `https://inference.local`. OpenAI Chat Completions and
Responses use `https://inference.local/v1`. The Gateway validates that a local
route is bounded, credential-free HTTPS without user info, query, or fragment,
then stores it immutably with the lease in the shared state database. Clearing
the lease clears the route.

At turn launch, the requested OpenClaw provider and model must exactly match the
persisted route. The worker admission handshake must advertise
`worker-local-inference-v1` before the Gateway sends a local route. The worker
constructs its normal model stream against that route and supplies only the
non-secret placeholder required by the model SDK. OpenShell injects its provider
credential at the privacy router. Transcript commits, live events, ownership
fencing, cancellation, and workspace reconciliation continue over the worker
protocol.

The route version is captured and persisted with the lease at provisioning;
OpenShell does not currently expose a per-request route-version precondition.
OpenClaw therefore does not revalidate or pin the route on every model request.

### Current route cardinality

OpenShell's current cluster inference API configures the reserved
`inference.local` route at OpenShell workspace scope. It does not configure a
different user route for each sandbox, provider attachment, OpenClaw agent, or
OpenClaw session. Consequently:

- one OpenShell workspace exposes one selected provider/model pair to all
  worker sandboxes using `inference.local` in that workspace;
- one OpenShell Gateway may host multiple OpenClaw profiles with different
  provider/model pairs when each profile selects a distinct workspace;
- profiles that select the same workspace must use the same provider/model
  pair; and
- OpenClaw must not present arbitrary per-session model selection as supported
  by one OpenShell workspace.

Provider attachments remain sandbox-specific and may authorize other
policy-proxied tools, but they do not change inference route cardinality.

### Phased delivery and inference isolation boundary

This RFC deliberately separates session isolation from inference isolation so
that the narrow worker-provider integration can be reviewed and delivered
without requiring a new OpenShell inference API.

**Phase 1: per-session worker sandboxes.** Each OpenClaw worker placement owns
one disposable OpenShell sandbox and attaches at most one session. Reclaiming
the placement deletes that exact sandbox. This is the execution and tool-egress
isolation boundary delivered by this RFC. Phase 1 supports two inference modes:
Gateway-proxy inference is the default, while optional `inference.local` keeps
the provider credential in OpenShell and binds a fixed provider/model route to
the worker lease.

The optional local-inference mode is isolated at the OpenShell workspace, not
the session: workers in the same workspace share the selected provider, model,
credential authority, and quota or billing boundary. Deployments that need
distinct local-inference routes must use distinct, route-stable workspaces (for
example, one per OpenClaw profile or tenant). Phase 1 must not be described as
per-session inference isolation.

Phase 1 acceptance requires tests that prove two concurrent placements receive
different sandbox identities, reclaiming one cannot delete or reuse the other,
and a local-inference worker receives no OpenShell provider credential. It must
also fail provisioning before allocation when the configured workspace route
does not exactly match the fixed profile provider and model.

**Phase 2: sandbox-scoped inference bindings.** True per-session inference
isolation requires a separately reviewed OpenShell API that creates an
inference-route binding for one sandbox or lease, authorizes requests only from
that sandbox, exposes a machine-readable route version, and removes the binding
with the lease. That API should provide per-binding audit and quota attribution.
It is intentionally not part of this RFC's implementation branches. Until it
exists, the plugin must not imply that one workspace provides different
inference routes or credentials to different sessions.

### Configuration

The OpenShell plugin and CLI must already be installed, enabled, and
authenticated. Create a dedicated workspace and configure its inference route
before dispatch:

```bash
openshell workspace create --name openclaw-workers
openshell --workspace openclaw-workers provider create --name openclaw-anthropic --type anthropic \
  --credential ANTHROPIC_API_KEY
openshell --workspace openclaw-workers inference set \
  --provider openclaw-anthropic \
  --model claude-opus-4-7
```

Then configure an OpenClaw worker profile:

```json5
{
  cloudWorkers: {
    profiles: {
      "openshell-claude": {
        provider: "openshell",
        install: "bundle",
        settings: {
          gateway: "local",
          workspace: "openclaw-workers",
          from: "openclaw",
          policy: "/etc/openshell/openclaw.yaml",
          autoProviders: false,
          inference: {
            mode: "local",
            provider: "openclaw-anthropic",
            openclawProvider: "anthropic",
            model: "claude-opus-4-7",
            api: "anthropic-messages",
          },
        },
      },
    },
  },
}
```

`settings.inference` is optional. Omitting it selects Gateway-proxy inference.
The sandbox source must provide a supported Node.js runtime. Setup commands
must remain credential-free and idempotent because provisioning can replay.

### Relationship to the OpenShell sandbox backend

When the OpenShell plugin is enabled, it exposes two independent capabilities:

- `SandboxBackend` redirects tools from an agent loop that remains on the
  OpenClaw Gateway; and
- `WorkerProvider` places the agent loop and tools in a disposable OpenShell
  sandbox owned by cloud-worker lifecycle.

An operator selects one execution shape for a session. The worker-provider path
does not recursively activate the sandbox backend because the worker runtime
does not load general plugins. Enabling both plugin capabilities does not add a
second sandbox around a worker placement.

## Rationale

The proposal reuses OpenClaw's existing per-session placement, bootstrap,
fencing, transcript, and workspace contracts instead of duplicating them in a
tool-sandbox backend. It also keeps the long-lived Gateway, channel state, and
durable session state outside disposable OpenShell sandboxes.

The main benefits are:

- independently disposable isolation for each dispatched session placement;
- no privileged nesting and no OpenShell control-plane identity inside the
  worker;
- OpenShell custody of the provider credential in local-inference mode;
- a generic local-inference lease contract that does not place OpenShell ids or
  policy in core;
- explicit protocol negotiation and legacy Gateway-proxy compatibility; and
- continued use of OpenClaw's durable transcript, live-event, fencing, and
  workspace behavior in both inference modes.

The tradeoffs are:

- none of this behavior exists unless the OpenShell plugin is installed and
  enabled, and the OpenShell CLI is authenticated;
- local inference moves provider selection, credential injection, and request
  routing out of the OpenClaw Gateway's inference proxy and into OpenShell;
- one OpenShell workspace currently supplies only one provider/model route, so
  dynamic switching and fallback are rejected; multiple routes require
  multiple workspaces;
- the plugin currently parses human-readable `openshell inference get` output;
- route drift is checked during provisioning or deterministic adoption, not on
  every turn, so operators must not change the route while matching placements
  are active;
- provider-authenticated SSH trusts the OpenShell mTLS control plane instead of
  a provisioning-supplied SSH host key; and
- the generic route, protocol feature, persistence column, and worker runtime
  path add core surface even though OpenShell policy remains plugin-owned.

Running the whole OpenClaw Gateway inside OpenShell remains a valid
single-boundary deployment, but it does not supply individual disposable
session sandboxes without privileged nesting. Inferring local routing from a
magic provider id, model id, hostname, or environment variable would silently
change credential and billing paths; the explicit lease and launch-descriptor
contracts make that decision reviewable and testable.

OpenClaw must not copy an OpenShell provider credential into its own secret
store. Doing so would duplicate refresh and revocation ownership and erase the
primary security value of `inference.local`.

## Unresolved questions

- Should OpenShell add authoritative machine-readable CLI output for the
  effective inference provider, model, protocols, and route version, or should
  the plugin use a versioned OpenShell API directly?
- Should OpenClaw revalidate an OpenShell route before each turn if OpenShell
  adds a cheap route-version precondition, or is placement-time pinning
  sufficient?
- Should a future OpenShell API support sandbox-scoped inference routes, and if
  so, should OpenClaw bind them at environment creation or session attachment?
- Does the proxy transport need a provider refresh callback if OpenShell
  Gateway metadata paths can change without an OpenClaw Gateway restart?
- How should OpenClaw surface that an `openshell` worker profile is unavailable
  because the plugin is absent or disabled before a user attempts dispatch?
