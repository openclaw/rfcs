# UI artifact v1 specification

This document defines a renderer-neutral UI artifact projected by
`@openclaw/control-model`. An artifact lets a host select native first-party
presentation while preserving structured output and sandboxed third-party
fallback.

Status: draft. This is a fork-only preview.

## Principles

- An artifact is data and identity, not executable code.
- Installed and enabled extensions determine which artifacts can be produced.
- The client determines which native artifact renderers it supports and trusts.
- A template URI is a lookup key, not a trust or authorization claim.
- Native rendering is host-registered and allowlist-only.
- Unknown artifacts remain useful through structured/text output.
- Third-party executable UI remains sandboxed through MCP Apps or another
  explicitly supported sandbox contract.
- UI actions never bypass model commands or Gateway authorization.

## Artifact shape

```ts
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface UiArtifact {
  version: 1;
  id: string;
  revision: number;
  templateUri: string;
  dataVersion: number;
  data: JsonValue;
  structuredContent?: JsonValue;
  state: "pending" | "ready" | "failed" | "expired";
  source: UiArtifactSource;
  error?: UiArtifactError;
  fallback?: UiArtifactFallback;
}

export interface UiArtifactSource {
  sessionKey: string;
  messageId?: string;
  toolCallId?: string;
  toolName?: string;
}
```

The final field names may change during implementation, but every accepted
shape must retain the semantics below.

## Identity and revisions

`id` is stable for one logical artifact in one conversation. It must not be
derived only from `templateUri`.

`revision` is a non-negative integer that increases monotonically for accepted
updates to that artifact. A duplicate revision with byte-equivalent normalized
content is ignored. A duplicate revision with different content is a
structured conflict. A lower revision is stale and must not replace current
state.

An artifact from a retired connection epoch may be reconciled only through
authoritative history. It must not update live state directly.

## Template URI

`templateUri` is a bounded absolute URI. Schemes are not globally trusted.
Hosts may register product-specific schemes such as
`clawpilot://widgets/calendar` or use a standardized `ui://` resource
identifier.

The URI:

- does not identify a JavaScript module to import;
- does not grant network, tool, command, credential, or DOM authority;
- does not select native rendering unless the host registry contains an exact
  compatible registration; and
- must be preserved as opaque data when unknown.

Hosts should match exact URIs or an explicitly versioned registry rule. Generic
wildcard registrations require a separate security review.

`dataVersion` is a positive integer interpreted only by the exact host
registration. A registration declares the versions it accepts and any pure,
bounded migration into its current schema. Tool output cannot declare a
migration.

## Data and structured content

`data` contains component-shaped untrusted JSON. A native renderer registration
must provide a schema and reject invalid data before component construction.

`structuredContent` contains model- or transcript-relevant domain output when
available. It is not a private channel for secrets, hidden instructions,
credentials, or host-only state. Hosts may show it when native rendering is
unavailable.

Artifact data must have finite encoded bytes, depth, collection lengths, and
string lengths. Oversized artifacts become structured failures while ordinary
text/tool output remains available.

## Lifecycle

- `pending`: identity is known but complete render data is not ready.
- `ready`: the current revision passed model-level validation.
- `failed`: artifact materialization failed; `error` contains a safe code and
  message.
- `expired`: a referenced resource or interactive view is no longer available.

Lifecycle transitions are monotonic within one revision unless a higher
revision explicitly recovers the artifact. Expired interactive fallback must
not be reopened with stale credentials or capability URLs.

## Native renderer registry

The host registry maps a supported template URI and artifact version to:

- a local component factory;
- a validation schema;
- optional migration from older data versions;
- named action bindings;
- presentation metadata such as supported surfaces; and
- an explicit fallback policy.

Registration is deployment-owned code or configuration. Tool output cannot add
or modify registrations.

Registration provenance follows the host's ordinary component supply chain,
including code review, dependency policy, signing, and deployment controls
where those controls apply. The Control Model does not create a second runtime
component marketplace.

The Control Model does not import or execute registry components. A framework
adapter reads artifacts and invokes the host registry.

## Capability discovery

An exact local renderer registration is the authority for native-renderer
support. A client may advertise a bounded set of supported template URI and
data-version pairs during connection or tool invocation when the Gateway
contract provides such a carrier.

Capability advertisement:

- is optional and may be stale;
- lets an extension omit an unsupported optional native artifact;
- does not install a component or grant trust;
- does not authorize an OpenClaw operation; and
- must not be required for structured/text or sandboxed fallback output.

An extension that emits an artifact remains responsible for useful structured
or text output when practical. The client independently resolves the artifact
against its current registry. If no exact compatible registration exists, it
uses the declared safe fallback or renders the structured/text result.

## Actions

A native component may emit only a named action declared by its local
registration. The action handler receives:

- artifact ID and revision;
- normalized action name;
- schema-validated action data;
- current session/message/tool source; and
- an abort signal.

The handler maps the action to a supported Control Model command or a
product-owned operation. It must verify that the artifact revision is current.
Every OpenClaw operation re-enters Gateway authorization.

The host records a safe correlation tuple for attempted actions: registration
identity/version, artifact ID/revision, action name, session key, and tool call
ID when present. It must not record raw artifact data by default.

Artifact data must not contain an executable callback, JavaScript expression,
module reference, or unrestricted Gateway method name.

## Fallback

Candidate fallback kinds are:

```ts
type UiArtifactFallback =
  | {
      kind: "mcp-app";
      viewId: string;
      uiResourceUri?: string;
    }
  | {
      kind: "canvas";
      viewId?: string;
      url: string;
      sandbox: "strict" | "scripts";
    };
```

Fallback is explicit. An unknown URI does not cause arbitrary HTML, URL, or
module execution.

MCP App fallback uses the existing OpenClaw materialization, sandbox, CSP,
bridge, expiry, and authorization contracts. Canvas fallback uses existing
host URL and sandbox policy. Structured/text output remains available when no
executable fallback is accepted.

## Streaming

V1 exposes complete immutable artifact revisions. A source may update an
artifact progressively by publishing higher revisions.

V1 does not standardize:

- RFC 6902 patches;
- JSONL framing;
- JSON Render component trees;
- renderer-owned state mutation; or
- client-authored merge semantics.

A future dialect may add patches if it defines:

- a base revision;
- finite patch count and bytes;
- atomic validation;
- failure and resynchronization;
- unknown operation handling;
- history persistence; and
- conformance across at least two renderers.

## History and portability

The Gateway's sanitized history projection must preserve enough artifact
identity, data, source, revision, and explicit fallback metadata to reproduce
the same safe presentation after reload.

If the source contract cannot persist an interactive artifact, history must
retain structured content and mark the interactive state expired or
unavailable. It must not silently omit the entire tool result.

## Security failures

The following fail artifact rendering without failing the surrounding message:

- unknown artifact version;
- invalid or unsupported URI;
- data schema failure;
- size/depth/count violation;
- stale/conflicting revision;
- unknown native registration;
- expired fallback;
- unsupported sandbox request; and
- action requested against a stale revision.

Failures are observable and safe to log after redaction. They must not contain
raw credentials, capability URLs, hidden model context, or unbounded tool data.

## Required conformance evidence

Fixtures must cover:

- registered native URI;
- unknown URI with structured output only;
- unknown URI with accepted MCP App fallback;
- malformed and oversized data;
- duplicate, stale, conflicting, and increasing revisions;
- history reload;
- reconnect with a retired live revision;
- expired fallback;
- allowed, denied, unknown, and stale-revision actions;
- component schema evolution;
- registration provenance and data-version rejection/migration; and
- proof that tool output cannot register or import native code.
