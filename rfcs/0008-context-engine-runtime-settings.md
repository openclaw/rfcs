---
title: Context Engine Runtime Settings
authors:
  - ragesaq
created: 2026-06-15
last_updated: 2026-06-15
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/14
---

# Proposal: Context Engine Runtime Settings

Assistance note: this RFC is proposed by ragesaq with drafting and review assistance from Forge/Codex. Related implementation work: openclaw/openclaw#88750.

## Summary

Add an optional, versioned `ContextEngineRuntimeSettings` payload to selected context-engine lifecycle hook parameter objects.

OpenClaw is the producer of this payload. A context engine is the consumer. The payload gives the consumer a host-produced, per-invocation snapshot of the runtime facts OpenClaw used for that lifecycle call: selected context engine, execution host, model/provider identity, budget limits, and bounded fallback/degraded diagnostics.

This is a core OpenClaw plugin API improvement. It is not specific to HyperMem or any other context engine.

## Motivation

Context engines make runtime-sensitive decisions. A memory or context assembly engine may need to know which model/provider is active, how much prompt budget is available, whether OpenClaw is running in fallback/degraded mode, and which context engine OpenClaw selected for the lifecycle stage being invoked.

Today, plugin authors have to infer those facts from configuration, global state, logs, host internals, or duplicated implementation knowledge. Those approaches are brittle and make it harder for third-party context engines to behave consistently across OpenClaw hosts and harnesses.

This RFC defines a small producer/consumer contract:

- OpenClaw produces an authoritative runtime snapshot for a lifecycle invocation.
- The selected context engine receives that snapshot as optional data.
- The context engine may consume the snapshot to make local decisions.
- OpenClaw never reads consumer-mutated snapshot data back into model, provider, context-engine selection, routing, auth, or fallback policy.

For example, a context engine can adjust recall depth or compaction behavior based on the resolved model and token budget without scraping OpenClaw config or assuming a specific product integration.

## Goals

- Provide a typed `ContextEngineRuntimeSettings` payload for selected context-engine lifecycle hooks.
- Let context engines observe the selected context engine and runtime facts for the current lifecycle invocation.
- Keep the payload optional and additive so existing context engines can ignore it.
- Make unknown or unavailable runtime facts explicit through nullable fields, not omitted fields.
- Use host-curated diagnostic codes rather than raw provider or exception text.
- Support end-to-end behavior proof through a configured context engine that consumes the payload OpenClaw produces.
- Keep the merge path narrow: one optional payload, one schema version, no metadata negotiation, no UI, and no product-specific behavior.

## Non-Goals

- This RFC does not define product-specific policy.
- This RFC does not require any context engine to consume `runtimeSettings`.
- This RFC does not add a live query endpoint that context engines can call at arbitrary times.
- This RFC does not allow context engines to influence OpenClaw model, provider, fallback, auth, routing, or context-engine selection policy by mutating the payload.
- This RFC does not define plugin metadata negotiation.
- This RFC does not define a strict-validator retry or deprecation mechanism for legacy engines.
- This RFC does not expand `runtimeSettings` to ingest, batch ingest, subagent, or disposal hooks in v1.

## Proposal

Introduce this public SDK type:

```ts
export type ContextEngineRuntimeMode = "normal" | "fallback" | "degraded";

export type ContextEngineSelectionSource = "configured" | "default" | "unknown";

export type ContextEngineRuntimeReasonCode =
  | "provider_timeout"
  | "provider_unavailable"
  | "rate_limited"
  | "context_overflow"
  | "runtime_unavailable"
  | "unknown";

export type ContextEngineRuntimeSettings = {
  schemaVersion: 1;
  runtime: {
    host: "openclaw";
    mode: ContextEngineRuntimeMode;
    harnessId: string | null;
    runtimeId: string | null;
  };
  contextEngineSelection: {
    selectedId: string | null;
    source: ContextEngineSelectionSource;
  };
  executionHost: {
    id: string | null;
    label: string | null;
  };
  model: {
    requested: string | null;
    resolved: string | null;
    provider: string | null;
    family: string | null;
  };
  limits: {
    promptTokenBudget: number | null;
    maxOutputTokens: number | null;
  };
  diagnostics: {
    fallbackReason: ContextEngineRuntimeReasonCode | null;
    degradedReason: ContextEngineRuntimeReasonCode | null;
  };
};
```

This shape is the canonical public contract for the linked implementation work.
The implementation must expose `contextEngineSelection`, `executionHost`,
`limits.promptTokenBudget`, and closed diagnostic reason codes before merge.
Earlier implementation names such as `contextEngine.hostId`,
`contextEngine.hostLabel`, `contextEngine.capabilities`,
`model.fallbackActive`, `limits.tokenBudget`, and free-string diagnostic
reasons are not part of this RFC's v1 contract.

### Delivery Contract

`runtimeSettings` is delivered as an optional field on selected lifecycle hook parameter objects.

| Hook | v1 delivery | Notes |
| --- | --- | --- |
| `bootstrap(params)` | `params.runtimeSettings?: ContextEngineRuntimeSettings` | Best effort. Many model/provider facts may be `null` at bootstrap time. |
| `assemble(params)` | `params.runtimeSettings?: ContextEngineRuntimeSettings` | Carries the runtime facts OpenClaw has for the assembly invocation. |
| `maintain(params)` | `params.runtimeSettings?: ContextEngineRuntimeSettings` | May sit beside existing `runtimeContext`; it is not a replacement for it. |
| `afterTurn(params)` | `params.runtimeSettings?: ContextEngineRuntimeSettings` | May restate facts already available as native hook params for uniform consumption. |
| `compact(params)` | `params.runtimeSettings?: ContextEngineRuntimeSettings` | Only when the configured context engine owns compaction and OpenClaw is driving the compact hook. |

The following hooks are out of scope for v1: `ingest`, `ingestBatch`, `prepareSubagentSpawn`, `onSubagentEnded`, and `dispose`.

### Field Semantics

| Field | Type | Nullable | Meaning |
| --- | --- | --- | --- |
| `schemaVersion` | `1` | No | Schema version for this payload. |
| `runtime.host` | `"openclaw"` | No | The producer of the payload. |
| `runtime.mode` | `"normal" \| "fallback" \| "degraded"` | No | Summary runtime state for this invocation. |
| `runtime.harnessId` | `string` | Yes | Host-provided harness identity when available. |
| `runtime.runtimeId` | `string` | Yes | Host-provided runtime identity when available. |
| `contextEngineSelection.selectedId` | `string` | Yes | The context engine id OpenClaw selected for this invocation, or `null` if unknown. |
| `contextEngineSelection.source` | `"configured" \| "default" \| "unknown"` | No | Whether selection came from config, OpenClaw defaulting, or could not be determined. |
| `executionHost.id` | `string` | Yes | The OpenClaw execution surface invoking the hook, such as embedded runner, app-server harness, or CLI backend. |
| `executionHost.label` | `string` | Yes | Human-readable execution host label when available. |
| `model.requested` | `string` | Yes | Requested model id when known. |
| `model.resolved` | `string` | Yes | Resolved model id actually used when known. |
| `model.provider` | `string` | Yes | Resolved provider id when known. |
| `model.family` | `string` | Yes | Model family when known. |
| `limits.promptTokenBudget` | `number` | Yes | Prompt token budget for this invocation when known. |
| `limits.maxOutputTokens` | `number` | Yes | Maximum output token setting when known. |
| `diagnostics.fallbackReason` | `ContextEngineRuntimeReasonCode` | Yes | Host-curated fallback reason. Never raw provider or exception text. |
| `diagnostics.degradedReason` | `ContextEngineRuntimeReasonCode` | Yes | Host-curated degraded reason. Never raw provider or exception text. |

### Invariants

- `runtimeSettings` is host-owned and consumer-read-only.
- Hosts should pass a frozen object or equivalent immutable snapshot when practical.
- The snapshot reflects only the current lifecycle invocation and must not aggregate state from other sessions or invocations.
- If `runtimeSettings` restates a fact that the hook already provides through a native parameter, the native parameter remains authoritative for that invocation and the values must not diverge.
- `contextEngineSelection.selectedId` is descriptive. It is not an auth, trust, routing, privilege, or feature-negotiation signal.
- `executionHost.id` describes the OpenClaw execution surface invoking the hook. It is not the selected context engine id.
- `runtime.mode` is the summary state. `diagnostics.*Reason` fields are bounded details for that summary state.
- `fallbackReason` must be `null` unless `runtime.mode` is `"fallback"`.
- `degradedReason` must be `null` unless `runtime.mode` is `"degraded"`.
- Reason fields must be host-curated closed reason codes and must never contain raw provider errors, stack traces, file paths, URLs, credentials, token prefixes, or exception messages.

### Compatibility

`runtimeSettings` is optional. Existing engines that do not read it continue to compile and run unchanged.
The optionality boundary is the `runtimeSettings` object itself; when OpenClaw provides it, the object is a complete schema-versioned v1 envelope.

For schema version 1:

- `schemaVersion` is required.
- When `runtimeSettings` is present, the listed top-level envelopes and listed v1 fields are required.
- Unknown or unavailable values in listed nullable fields are represented as `null`, not by omitting the field.
- `contextEngineSelection.source` uses `"unknown"` when the producer cannot determine the selection source.
- `runtime.mode` is host-owned runtime state and is never `"unknown"`; when neither fallback nor degraded state applies, the producer uses `"normal"`.
- New fields added to schema version 1 must be optional, and consumers must ignore unknown optional keys.
- Removing a listed v1 field, changing a nullable field to non-nullable, changing a nullable unknown representation, or changing a closed enum's meaning requires a new schema version.

This RFC does not require v1 implementations to define a strict-validator retry mechanism. That can be considered separately if needed for legacy engines that fail on unknown optional keys.

## Rationale

The selected design uses a per-hook snapshot instead of a live query API.

A live query API would let a context engine ask OpenClaw for state at arbitrary times. That increases the risk of cross-session bleed, stale reads, policy confusion, and consumers treating mutable host state as a control surface. A per-hook snapshot is simpler and safer: OpenClaw produces the exact facts for the invocation it is performing, and the consumer receives those facts with the lifecycle call.

The payload is delivered as `runtimeSettings` rather than by expanding `ContextEngineRuntimeContext` in v1. `runtimeContext` already exists on some hooks and carries broader caller/runtime context with different stability guarantees. `bootstrap` and `assemble` do not consistently receive `runtimeContext` today. A dedicated `runtimeSettings` field keeps this contract typed, narrow, and visible across the hooks that need it.

The selected context engine identity is included because consumers may need to make decisions based on OpenClaw's actual selection for the lifecycle stage. That field is intentionally limited to descriptive selection state. Capability negotiation, routing authority, and trust decisions are out of scope.

## Unresolved Questions

- Should a future schema version include execution host capabilities? v1 includes only execution host identity and label.
- Should a future schema version include plugin metadata negotiation? This RFC defers it.
- Should OpenClaw later define a legacy retry mechanism for strict validators that reject unknown optional keys? This RFC defers it.
- Should future versions expose session, run, or deployment identity? This RFC defers those fields until a concrete consumer need and privacy boundary are defined.
- Should additional lifecycle hooks receive `runtimeSettings` after v1? This RFC limits v1 to the selected hooks listed above.
