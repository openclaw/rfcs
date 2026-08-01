---
title: Multi-slot memory role architecture
authors:
  - Kyle / Schwi
created: 2026-06-20
last_updated: 2026-06-20
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/22
---

# Proposal: Multi-slot memory role architecture

## Summary

Introduce purpose-specific memory role slots for OpenClaw plugins — `memory.recall`, `memory.compaction`, `memory.capture`, `memory.dreaming`, and `memory.userModel` — while preserving the existing `plugins.slots.memory` selector as deprecated shorthand for `memory.recall`. This gives memory plugins a first-class way to compose by responsibility instead of competing for one global “memory” slot, and it is implemented in openclaw/openclaw#88504 for concrete review.

## Motivation

The [memory-plugin interop research pass](0009/memory-plugin-interop-research.md) validates this RFC as necessary architecture work, not optional extensibility: OpenClaw’s own documentation already describes memory as a composable ecosystem where builtin/QMD recall, Honcho user/session modeling, LanceDB recall/capture, Active Memory orchestration, dreaming/consolidation, and Memory Wiki compilation can coexist, but current `origin/main` collapses every `kind: "memory"` provider into one exclusive `plugins.slots.memory` owner, making those documented combinations impossible or dependent on brittle exceptions. This RFC closes that product/docs/runtime gap by replacing the single memory owner with explicit role slots — `memory.recall`, `memory.capture`, `memory.compaction`, `memory.dreaming`, and `memory.userModel` — while preserving legacy `memory` as a recall shorthand, so the documented memory-plugin interop story becomes actually representable in config and runtime behavior.

OpenClaw currently has one effective memory plugin selector:

```jsonc
{
  "plugins": {
    "slots": {
      "memory": "memory-core"
    }
  }
}
```

That worked when “memory” mostly meant factual recall/search. It is no longer enough for the shape of OpenClaw’s memory system.

Memory now has several distinct responsibilities:

- factual recall / vector search
- capture and persistence
- compaction and summarization support
- dreaming / consolidation
- user-model or persona-like durable state

These are related, but they are not the same job. A plugin that handles recall should not necessarily own capture. A plugin that handles compaction should not need to replace factual recall. A user-model plugin should not have to masquerade as the single global memory provider.

With only `plugins.slots.memory`, these roles either compete for one selector, require ad-hoc plugin-specific config, or risk being routed through unrelated extension points such as `contextEngine`.

The result is unclear ownership:

- Which plugin owns factual recall?
- Which plugin participates in compaction?
- Which plugin captures or consolidates memory?
- Can an agent override one memory responsibility without replacing every other memory behavior?
- Which plugins should validation, startup preload, uninstall cleanup, doctor repair, status, skills, and hooks treat as intentionally selected?

PR #88504 proposes a role-level vocabulary for those questions.

## Goals

- Add canonical memory role slots:
  - `plugins.slots["memory.recall"]`
  - `plugins.slots["memory.compaction"]`
  - `plugins.slots["memory.capture"]`
  - `plugins.slots["memory.dreaming"]`
  - `plugins.slots["memory.userModel"]`

- Preserve existing user configs:
  - keep accepting `plugins.slots.memory`
  - treat legacy `memory` as deprecated shorthand for `memory.recall`
  - provide doctor warnings and safe migration behavior

- Support per-agent memory role overrides through:

  ```jsonc
  {
    "agents": {
      "list": [
        {
          "id": "example-agent",
          "plugins": {
            "slots": {
              "memory.recall": "memory-lancedb",
              "memory.capture": "memory-lancedb"
            }
          }
        }
      ]
    }
  }
  ```

- Keep `contextEngine` separate from memory role slots.

- Make runtime behavior role-aware:
  - plugin validation should understand all selected memory roles
  - startup/preload should include role-selected memory plugins
  - uninstall should clear global and per-agent memory role references
  - status and doctor output should point users toward `memory.recall`
  - disabled `"none"` role slots should be respected

- Let plugins compose by memory responsibility without requiring every memory plugin to implement every role.

## Non-Goals

This RFC does not propose removing `plugins.slots.memory` immediately.

It does not remove, rename, or replace `plugins.slots.contextEngine`.

It does not add per-agent `contextEngine` overrides. Per-agent slot overrides are intentionally limited to memory role slots and legacy `memory`.

It does not introduce a new object-valued slot format, ownership/provenance schema, or machine-readable plugin responsibility object. Slot values remain scalar plugin IDs.

It does not require existing or third-party memory plugins to support every role.

It does not make non-recall roles own factual recall dispatch. The factual recall runtime continues to resolve through `memory.recall`.

It does not try to settle every future memory-provider composition question. The intent is to establish a compatible role-slot foundation that future work can build on.

## Proposal

### Canonical global memory role slots

Add these canonical memory role slots under `plugins.slots`:

```jsonc
{
  "plugins": {
    "slots": {
      "memory.recall": "memory-core",
      "memory.compaction": "none",
      "memory.capture": "none",
      "memory.dreaming": "none",
      "memory.userModel": "none",
      "contextEngine": "legacy"
    }
  }
}
```

The proposed defaults are:

- `memory.recall`: `memory-core`
- `memory.compaction`: `none`
- `memory.capture`: `none`
- `memory.dreaming`: `none`
- `memory.userModel`: `none`
- `contextEngine`: `legacy`

The role meanings are:

- `memory.recall`: factual recall/search provider
- `memory.compaction`: memory provider used for compaction or summarization-related memory behavior
- `memory.capture`: capture/ingestion/persistence owner
- `memory.dreaming`: dreaming/consolidation owner
- `memory.userModel`: user-model or persona-memory owner

### Legacy compatibility

Existing configs using the legacy memory slot remain valid:

```jsonc
{
  "plugins": {
    "slots": {
      "memory": "memory-core"
    }
  }
}
```

The legacy `memory` slot is interpreted as shorthand for:

```jsonc
{
  "plugins": {
    "slots": {
      "memory.recall": "memory-core"
    }
  }
}
```

Only the recall role uses legacy `memory` fallback. Non-recall roles do not infer behavior from the legacy slot.

### Doctor migration behavior

`openclaw doctor --fix` should migrate safe cases and avoid guessing in ambiguous cases.

Safe case:

```jsonc
{
  "plugins": {
    "slots": {
      "memory": "memory-lancedb"
    }
  }
}
```

can be migrated toward:

```jsonc
{
  "plugins": {
    "slots": {
      "memory.recall": "memory-lancedb"
    }
  }
}
```

Conflicting case:

```jsonc
{
  "plugins": {
    "slots": {
      "memory": "old-memory",
      "memory.recall": "new-memory"
    }
  }
}
```

should warn rather than mutate automatically. The config contains two different user signals, so the tool should not guess which one is intended.

The same conservative migration applies to per-agent legacy memory slots.

### Per-agent memory role overrides

Agents may override memory role slots:

```jsonc
{
  "agents": {
    "list": [
      {
        "id": "research-agent",
        "plugins": {
          "slots": {
            "memory.recall": "memory-lancedb",
            "memory.capture": "memory-lancedb",
            "memory.dreaming": "none"
          }
        }
      }
    ]
  }
}
```

Per-agent overrides are limited to memory role slots and legacy `memory`.

This is intentionally not valid in this proposal:

```jsonc
{
  "agents": {
    "list": [
      {
        "id": "research-agent",
        "plugins": {
          "slots": {
            "contextEngine": "some-context-engine"
          }
        }
      }
    ]
  }
}
```

`contextEngine` remains global.

### Runtime behavior

The implementation resolves memory ownership through role-aware slot resolution.

Expected behavior:

- `memory.recall` controls factual recall runtime selection.
- `plugins.slots.memory` aliases only the recall role.
- `"none"` disables a role slot.
- Disabled plugins, denylisted plugins, and global `plugins.enabled = false` remain honored.
- Plugins selected only for non-recall roles can still be loaded/activated for their role.
- A plugin selected for `memory.capture`, `memory.compaction`, `memory.dreaming`, or `memory.userModel` does not automatically become the factual recall owner.
- Plugin validation checks global and per-agent memory role references.
- Startup/preload includes memory role-selected plugin IDs.
- Uninstall cleanup resets global and per-agent memory role slots referencing the removed plugin.
- Status, doctor, and user-facing enablement guidance prefer `plugins.slots["memory.recall"]` over the deprecated legacy slot.

### Implementation-backed draft

This RFC is paired with implementation PR:

https://github.com/openclaw/openclaw/pull/88504

The PR updates config schema, runtime resolution, plugin loading, validation, doctor repair, uninstall/update behavior, status output, docs, and tests.

Important implementation areas include:

- `src/plugins/slot-resolution.ts`
- `src/plugins/slots.ts`
- `src/plugins/config-normalization-shared.ts`
- `src/plugins/loader.ts`
- `src/plugins/gateway-startup-plugin-ids.ts`
- `src/plugins/memory-runtime.ts`
- `src/plugins/memory-state.ts`
- `src/plugins/effective-plugin-ids.ts`
- `src/plugins/uninstall.ts`
- `src/commands/doctor/shared/legacy-memory-slot.ts`
- `src/commands/doctor/shared/stale-plugin-config.ts`
- `src/commands/status.scan.shared.ts`
- `src/commands/doctor-memory-search.ts`
- `src/memory-host-sdk/dreaming.ts`
- `src/agents/embedded-agent-runner/extensions.ts`
- `src/skills/loading/plugin-skills.ts`
- `src/hooks/plugin-hooks.ts`
- `src/gateway/tools-invoke-shared.ts`

Docs touched by the implementation include:

- `docs/tools/plugin.md`
- `docs/cli/memory.md`
- `docs/plugins/memory-lancedb.md`
- `docs/plugins/manifest.md`
- `docs/cli/plugins.md`
- `docs/cli/status.md`
- `docs/concepts/active-memory.md`
- `docs/concepts/context-engine.md`
- `docs/gateway/configuration-reference.md`

Notable test coverage includes:

- config schema acceptance/rejection for global and per-agent memory role slots
- plugin validation for missing global and per-agent memory role plugin refs
- doctor migration from legacy `memory` to `memory.recall`
- conflict warnings for incompatible legacy/canonical slot values
- memory runtime resolution through `memory.recall`
- per-agent `memory.recall` runtime overrides
- disabled recall slot behavior
- plugin loader activation for non-recall memory roles
- plugin loader cache invalidation when agent memory slots change
- uninstall cleanup for global and per-agent memory role slots
- status output for disabled or explicitly selected recall slots
- docs/help/label coverage for the new config keys

### Live-use and validation notes

PR #88504 has been used as live OpenClaw code in an active development environment while repeatedly rebasing and updating the running service. No regressions have been observed in that usage.

The PR body contains detailed proof notes, including exact-head checks, doctor/config validation, runtime checks, upgrade behavior from the prior public release, and focused source tests.

Current PR head after CI remediation:

```text
c447e22033ca104cb9d5292edf4313bcb74f81cf
```

The latest remediation commit fixed a PR-owned `check-prod-types` failure caused by an unused active-memory config parameter after the memory tool allowlist behavior changed.

Local verification at that head:

```bash
pnpm tsgo:prod
```

passed before push.

Earlier exact-head proof at:

```text
3f1f547042220aee42b3e39b8cb7ecb15cfac993
```

covered the role-slot contract, per-agent overrides, legacy compatibility, disabled recall slots, doctor migration/repair behavior, role-slot plugin activation/validation, upgrade behavior, and live gateway/source runtime behavior.

The latest type-only remediation did not change the architecture. It removed unused code left by the implementation after the runtime behavior had already been proven.

## Rationale

### Why role slots instead of a single memory slot?

The single-slot model is simple, but it forces unrelated memory responsibilities to compete for ownership. That makes composition awkward and encourages plugins to overclaim responsibilities.

Role slots preserve the existing plugin-slot mental model while adding enough vocabulary to describe the memory system OpenClaw already has.

### Why keep `memory` as legacy shorthand?

Removing or immediately rejecting `plugins.slots.memory` would break existing configs and third-party assumptions.

Treating it as deprecated shorthand for `memory.recall` is the least surprising compatibility path because historical “memory” behavior most closely maps to factual recall/search.

### Why not make every memory role required?

Most installations should not need five memory plugins. Most plugins should not need to implement five roles.

Defaulting non-recall roles to `"none"` keeps the default behavior close to today’s behavior while creating explicit extension points for richer memory systems.

### Why allow per-agent memory role overrides?

Agents can have different memory needs. A research agent might use a different recall index than a lightweight assistant. A specialized agent might capture memory differently or disable recall entirely.

Per-agent memory role overrides allow that without turning every memory behavior into a global setting.

### Why not add per-agent `contextEngine` here?

`contextEngine` has different runtime implications and should be considered separately. Adding per-agent memory role overrides does not require also adding per-agent context-engine selection.

Keeping `contextEngine` global limits the scope of this RFC and avoids mixing two architectural decisions.

### Why scalar plugin IDs instead of richer slot objects?

Scalar plugin IDs match the existing config style and keep migration small.

A future RFC can extend slot ownership/provenance if needed. This proposal is intended to be compatible with that direction, but not blocked on it.

## Unresolved questions

- Are these the right first-class memory roles?
  - `memory.recall`
  - `memory.compaction`
  - `memory.capture`
  - `memory.dreaming`
  - `memory.userModel`

- Should any role be renamed before this becomes public config surface?

- Is `memory.userModel` the right name, or should it be broader/narrower?

- Is `plugins.slots.memory` as deprecated shorthand for `memory.recall` the right compatibility path?

- Should doctor eventually remove the legacy `memory` key after migration, or keep it when plugin compatibility might still depend on it?

- Should per-agent slot overrides remain limited to memory roles for now?

- Is `"none"` the right explicit disabled value for every memory role?

- Are scalar plugin IDs sufficient for this phase, assuming future ownership/provenance work can extend the shape later?

- Does this RFC need any sidecar examples showing before/after config migration, or is the inline proposal sufficient?
