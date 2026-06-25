---
title: Agent Profiles
authors:
  - osolmaz
  - vincentkoc
created: 2026-06-17
last_updated: 2026-06-25
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/18
---

# Proposal: Agent Profiles

## Summary

Replace OpenClaw's binary `experimental.localModelLean` behavior with a
versioned Agent Profile system. An Agent Profile is a bounded, declarative
artifact that tells an agent harness which shared behavior and harness-specific
behavior to use for a resolved model: tool exposure, Tool Search defaults,
system prompt sources, and supported thinking levels. It is separate from
model identity, provider drivers, and managed-local serving presets. Phase one
preserves four requested model-size classes as metadata, ships two size-derived
behavioral baselines, migrates existing Lean/GPT-5/Claude model-specific
behavior onto profiles, and leaves KV cache and engine tuning outside profiles.

## Motivation

`experimental.localModelLean` is a useful proof of a product need but the
wrong long-term abstraction:

- It makes locality stand in for agent-harness capability.
- It is binary where current behavior already needs model-family rules.
- GPT-5 response-style prompt overlays and Claude/Opus thinking defaults live
  in separate model-specific paths rather than one inspectable behavior system.
- It cannot cleanly distinguish portable harness behavior from local server
  configuration.
- It encourages a future where a change intended to help local models can
  accidentally alter hosted-provider payloads or cache behavior.

OpenClaw needs a small, deterministic decision path:

1. Resolve canonical model identity and trusted metadata.
2. Select the Agent Profile using explicit overrides and registry bindings.
3. Apply portable harness behavior, constrained by driver capabilities.
4. Keep provider protocol behavior in the driver.
5. Apply engine/KV settings only through a separate Serving Preset for an
   OpenClaw-managed local service.

This gives local and open-weight models a first-class path without making
"local" a proxy for size, capability, or deployment control. It also gives
hosted providers a consistent way to opt into portable model-family behavior.

## Goals

- Replace `experimental.localModelLean` with versioned, testable Agent Profiles.
- Preserve current Lean behavior exactly during migration.
- Centralize existing GPT-5 response-style and Claude/Opus thinking-default
  behavior under the profile resolution system.
- Keep four model size classes available as model metadata and diagnostics.
- Ship a conservative phase-one fallback: lean behavior for trusted models up
  to 20B parameters and full behavior otherwise.
- Make model identity, harness behavior, driver behavior, and local serving
  configuration separate ownership layers.
- Provide deterministic selection, clear precedence, and explainable
  diagnostics.
- Allow narrow, validated per-profile settings without adding a generic
  provider parameter bag.
- Preserve hosted provider payload and cache behavior unless a driver-owned
  change explicitly changes it.
- Establish a registry format that can later support reviewed model-family and
  artifact bindings.

## Non-Goals

- This RFC does not define arbitrary runtime prompt-file discovery outside
  profile packs.
- This RFC does not add arbitrary tool lists or generic `extra` settings to
  model configuration.
- This RFC does not claim parameter count alone can optimize a model.
- This RFC does not add vLLM, SGLang, llama.cpp, Ollama, or GGUF tuning to
  phase one.
- This RFC does not change hosted provider KV cache, prompt cache, headers, or
  request payloads.
- This RFC does not require every provider to supply parameter counts, artifact
  digests, or family metadata.
- This RFC does not make profiles dynamically fetched or evaluated at request
  time.
- This RFC does not expose profiles as a replacement for provider/model
  selection.

## Proposal

### Terminology and ownership

The public name is **Agent Profile**. An Agent Profile does not define an
agent. It describes shared and harness-specific behavior that a harness applies
after it has resolved the model identity and selected a matching profile.

`Model Driver` is not another name for Agent Profile:

| Layer | Owns | Does not own |
| --- | --- | --- |
| Model identity | provider model id, canonical model id, family, artifact digest, model size class | prompt behavior, server flags |
| Agent Profile | shared and harness-specific behavior: tools, Tool Search, system prompt source, thinking level | model identity, HTTP payloads, auth, KV cache, server flags |
| Model Driver | provider protocol, auth, capabilities, payload transforms, streaming, native API settings | product harness behavior |
| Serving Preset | local managed-engine/artifact settings | hosted provider behavior, portable agent behavior |

A driver answers: "Can the harness use this endpoint, and how?" An Agent Profile
answers: "What behavior should the agent harness use with this resolved model?"

### Model identity and model size classes

Profile selection consumes a prepared identity object:

```ts
type ModelSizeClass = "tiny" | "small" | "medium" | "large";

type ResolvedModelIdentity = {
  providerId: string;
  providerModelId: string;
  canonicalModelId: string | null;
  canonicalModelFamilyId: string | null;
  artifact: {
    digest: string;
  } | null;
  modelSizeClass: ModelSizeClass | null;
};
```

`artifact.digest` is an algorithm-prefixed content digest for an exact model
artifact, for example `sha256:<hex>`. The artifact object is `null` when the
resolver does not know an exact immutable artifact, including hosted API-only
models. Runtime ecosystems such as Ollama and delivery modes such as hosted
API are not artifact kinds.

The requested model size classes use total parameter count:

| Class | Total parameters |
| --- | --- |
| `tiny` | `<= 1B` |
| `small` | `> 1B` and `<= 20B` |
| `medium` | `> 20B` and `<= 50B` |
| `large` | `> 50B` |

This deliberately omits an `xsmall` class for phase-one simplicity. If later
benchmarking shows that the `small` range is too broad, OpenClaw may split it
into `small` and `xsmall` in a future schema version.

For mixture-of-experts models, phase one classifies by total parameters.
Future metadata may record active parameters, but active parameters must not
quietly change this selection contract.

The identity object stores the derived `modelSizeClass`, not the raw parameter
count. Raw parameter metadata remains resolver input or diagnostics.

Size-derived fallback requires trusted structured metadata:

1. A reviewed registry binding may provide verified artifact/model metadata.
2. Ollama metadata may provide a declared parameter size through structured
   `details.parameter_size` parsing.
3. Explicitly configured structured metadata may be declared if it has a
   validated owner and diagnostic provenance.
4. Bare names such as `foo-7b-instruct` are diagnostic only and must not
   select a compact profile.

Generic OpenAI-compatible endpoints, including common vLLM and SGLang
discovery paths, often expose only model ids. They report unknown model size
unless a registry/artifact binding supplies the missing fact. Unknown model
size uses the full profile.

### Registry and manifest format

Profiles and bindings live in a schema-validated registry. The in-process
contract is a materialized registry:

```ts
type AgentProfileRegistry = {
  schemaVersion: 1;
  profiles: AgentProfile[];
  bindings: AgentProfileBinding[];
};

type AgentProfile = {
  schemaVersion: 1;
  id: string;
  extends?: string;
  spec: AgentProfileSpec;
};

type AgentProfileSpec = {
  common: AgentProfileCommon;
  "openclaw.ai"?: OpenClawAgentProfileSpec;
  settings?: AgentProfileSettingsSchema;
};

type AgentProfileCommon = {
  systemPrompt?: AgentProfileSystemPromptSource;
  thinkingLevel?: AgentProfileThinkingLevel;
};

type AgentProfileThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

type AgentProfileSystemPromptSource =
  | {
      text: string;
    }
  | {
      file: {
        path: string;
        digest?: string;
      };
    };

type OpenClawAgentProfileSpec = {
  toolProfile?: "lean";
  contextPosture?: "constrained";
  thinkingLevel?: "adaptive" | "max";
};

type AgentProfileBinding = {
  selector: {
    providerId?: string;
    canonicalModelId?: string;
    canonicalModelFamilyId?: string;
    artifactDigest?: string;
    modelSizeClass?: ModelSizeClass;
  };
  profileId: string;
};
```

The initial implementation may represent the built-in registry as
JSON-compatible files or a typed source module validated against the same
schema. The contract is declarative and JSON-compatible, similar in spirit to
model manifests, but it is not a request-time config file.

An Agent Profile pack is a directory with a required `profile.yaml` file. The
folder is the boundary for any files the profile references:

```text
qwen3-6-35b-a3b-profile-v1/
├── profile.yaml
├── prompts/
│   └── system.md
└── README.md
```

The `profile.yaml` file contains one `AgentProfile` resource:

```yaml
apiVersion: agentprofiles.io/v1
kind: AgentProfile
metadata:
  namespace: openclaw
  name: qwen3-6-35b-a3b-profile-v1
spec:
  common:
    systemPrompt:
      file:
        path: ./prompts/system.md
    thinkingLevel: high
  openclaw.ai:
    toolProfile: lean
```

All behavior fields live under `spec`. The `common` section is the
harness-agnostic part. Domain-named sections such as `openclaw.ai` are owned
by the corresponding harness or project and can grow independently without
changing the common schema.

The resource `spec` may also include `settings` with the same closed settings
schema used by the materialized profile. For example, a GPT-5 profile artifact
can declare the supported response-style setting without adding a generic
config bag.

Referenced files must stay inside the profile folder. A path such as
`./prompts/system.md` is valid; a path such as `../shared/system.md` is invalid.

Profiles can still inherit from another profile by using `extends` in
`profile.yaml`. Inheritance is resolved before runtime selection. The resolved
output is one schema-validated profile with explicit provenance.

The built-in registry loads and validates once during process startup. The
process retains an immutable snapshot; an agent run receives a resolved
behavior snapshot, not a mutable registry pointer. Invalid built-ins fail
development or build validation rather than falling back at request time.

Future installed packs may be hosted by ClawHub, a public artifact registry, a
private enterprise registry, or an intranet mirror. They require explicit
owner-controlled installation, schema validation, version/provenance
attribution, digest pinning or equivalent immutable identity, and restart or
explicit reload. They must never be fetched during a model request.

Profile inheritance is resolved before runtime selection. The registry rejects
cycles, unknown parents, bindings that reference unknown profiles, ambiguous
bindings, prompt paths that escape the profile folder, invalid system prompt
sources, and invalid settings. Arrays and maps must use field-specific
replacement/merge semantics; generic deep merge is not allowed.

### Selection order

Profile resolution is deterministic and chooses one profile:

1. Explicit agent profile.
2. Explicit global default profile.
3. Exact artifact-digest binding.
4. Exact canonical-model binding.
5. Provider-scoped model-family binding.
6. Trusted model-size-class binding.
7. `openclaw/full-profile-v1`.

```ts
type AgentProfileSelectionSource =
  | "agent-explicit"
  | "defaults-explicit"
  | "artifact"
  | "model"
  | "family"
  | "model-size"
  | "fallback";

type ResolvedAgentProfile = {
  profile: AgentProfile;
  selectionSource: AgentProfileSelectionSource;
  modelIdentity: ResolvedModelIdentity;
};
```

An ambiguous match at the same precedence level is a registry error. Exact
artifact binding always wins over model, family, and model size. Family
bindings are provider scoped whenever native capabilities differ across routes.

Agent Profile behavior remains subject to driver capabilities. A profile can
request an adaptive thinking mode, for example, but the driver remains
authoritative on whether the selected model/route supports it. Unsupported
requested behavior uses a named, testable fallback and emits bounded
diagnostics; it does not invent a provider payload.

### Initial profiles

Phase one deliberately keeps four model size classes but ships two
size-derived behavioral baselines:

| Profile | Parent | Binding intent | Purpose |
| --- | --- | --- | --- |
| `openclaw/full-profile-v1` | none | fallback; Medium/Large | general harness baseline |
| `openclaw/lean-profile-v1` | `full-profile-v1` | trusted Tiny/Small; legacy config | exact Lean migration |
| `openclaw/gpt-5-profile-v1` | `full-profile-v1` | current GPT-5 family behavior | system prompt source and response-style setting |
| `openclaw/anthropic-profile-v1` | `full-profile-v1` | shared Anthropic/Claude behavior | base profile for Claude-family overrides |
| `openclaw/claude-opus-4-7-profile-v1` | `anthropic-profile-v1` | current exact Opus 4.7/4.8 behavior | preserves thinking default |
| `openclaw/claude-4-6-profile-v1` | `anthropic-profile-v1` | current direct Anthropic Claude 4.6 behavior | preserves adaptive thinking default |

The exact model aliases and family identities remain in canonical model/provider
catalogs. Registry bindings refer to normalized identity; profiles are not a
second model catalog.

`full-profile-v1` is behaviorally neutral:

```json
{
  "schemaVersion": 1,
  "id": "openclaw/full-profile-v1",
  "spec": {
    "common": {
      "systemPrompt": {
        "file": {
          "path": "./prompts/system.md"
        }
      }
    }
  }
}
```

`lean-profile-v1` is the exact migration target for
`experimental.localModelLean: true`:

```json
{
  "schemaVersion": 1,
  "id": "openclaw/lean-profile-v1",
  "extends": "openclaw/full-profile-v1",
  "spec": {
    "openclaw.ai": {
      "toolProfile": "lean",
      "contextPosture": "constrained"
    }
  }
}
```

The OpenClaw `lean` tool profile preserves today's behavior:

- filter `browser`, `cron`, and `message` from normal model tool exposure;
- preserve forced-direct `message` when the runtime requires it;
- default Tool Search to enabled only when the current setting is undefined;
- apply compact filtering both before and after Tool Search expansion.

The broader deny list proposed in local-model Lean PR `#87617` is not a
compatible migration. It may be a later explicitly selected and benchmarked
profile, such as `compact-profile-v2`, but must not alter `lean-profile-v1`.

The routing mechanism explored in `#87587`, where named tools can remain
direct, is useful as an implementation detail:

```ts
type OpenClawToolProfilePolicy = {
  toolProfile?: "lean";
  directToolIds: readonly string[];
};
```

It does not change phase-one Lean semantics without an explicit product
decision.

The GPT-5 profile owns the migrated response-style setting and a system prompt
source:

```json
{
  "schemaVersion": 1,
  "id": "openclaw/gpt-5-profile-v1",
  "extends": "openclaw/full-profile-v1",
  "spec": {
    "common": {
      "systemPrompt": {
        "file": {
          "path": "./prompts/gpt-5-v1.md"
        }
      }
    },
    "settings": {
      "responseStyle": {
        "allowedValues": ["friendly", "off"],
        "default": "friendly"
      }
    }
  }
}
```

The Claude/Opus profiles migrate only existing thinking-default selection:

```json
{
  "schemaVersion": 1,
  "id": "openclaw/claude-opus-4-7-profile-v1",
  "extends": "openclaw/anthropic-profile-v1",
  "spec": {
    "common": {
      "thinkingLevel": "off"
    }
  }
}
```

```json
{
  "schemaVersion": 1,
  "id": "openclaw/claude-4-6-profile-v1",
  "extends": "openclaw/anthropic-profile-v1",
  "spec": {
    "openclaw.ai": {
      "thinkingLevel": "adaptive"
    }
  }
}
```

The profile selects a default; the driver continues to own allowed thinking
levels, native parameter names, and final request validation. There is no
current Claude prompt overlay to migrate, and this RFC does not create one.

### Agent Profile surface

The phase-one Agent Profile surface is closed. `spec.common` contains the small
set of behavior fields that may be useful across agent harnesses. Domain-named
sections such as `spec.openclaw.ai` contain harness-specific fields owned by
that project.

```ts
type AgentProfileSpec = {
  common: AgentProfileCommon;
  "openclaw.ai"?: OpenClawAgentProfileSpec;
  settings?: AgentProfileSettingsSchema;
};

type AgentProfileCommon = {
  systemPrompt?: AgentProfileSystemPromptSource;
  thinkingLevel?: AgentProfileThinkingLevel;
};

type AgentProfileThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

type AgentProfileSystemPromptSource =
  | {
      text: string;
    }
  | {
      file: {
        path: string;
        digest?: string;
      };
    };

type OpenClawAgentProfileSpec = {
  toolProfile?: "lean";
  contextPosture?: "constrained";
  thinkingLevel?: "adaptive" | "max";
};
```

| Field | Section | Owner | Consumer | Phase-one meaning |
| --- | --- | --- | --- | --- |
| `systemPrompt` | `spec.common` | prompt composition | system-prompt builder | loads inline text or a profile-pack file |
| `thinkingLevel` | `spec.common` | agent harness | current thinking-default callers | selects a portable default thinking level |
| `toolProfile` | `spec.openclaw.ai` | OpenClaw agent harness | tool preparation and Tool Search | applies current Lean behavior |
| `contextPosture` | `spec.openclaw.ai` | OpenClaw diagnostics/future behavior | no hidden automatic rewrite | records compact intent |
| `thinkingLevel` | `spec.openclaw.ai` | OpenClaw agent harness | provider capability gate | OpenClaw-only `adaptive` or `max` thinking |

`contextPosture` is not a context-window override. It remains diagnostic until
a concrete behavior has benchmark and compatibility evidence.

The schema must not add arbitrary user tool allow/deny lists, endpoint data,
transport headers, provider request fragments, server launch arguments, cache
controls, or generic `extra` maps.

### System prompt composition

Agent Profiles can choose the stable system prompt text for a model. The source
is explicit: a profile may carry inline text, or it may point at a prompt file
inside the same profile pack.

```ts
type AgentProfileSystemPromptSource =
  | {
      text: string;
    }
  | {
      file: {
        path: string;
        digest?: string;
      };
    };
```

The resolver enforces these rules:

- exactly one source type is set;
- `file.path` is relative to the `AgentProfile` resource file;
- file paths cannot escape the profile pack root;
- if `file.digest` is present, the resolved file content must match it;
- child profiles replace `systemPrompt` as a whole unless a later RFC defines
  explicit merge behavior.

OpenClaw's built-in profiles can keep prompt text in source-controlled prompt
files. Installed profile packs can carry their own prompt files, but they are
resolved and validated before runtime use. The runtime must not fetch or read a
new prompt file during a model request.

The implementation defines and tests one composition order:

1. Prepare model identity, driver capabilities, and resolved profile.
2. Resolve `spec.common.systemPrompt` to text, or use the built-in default when
   it is omitted.
3. Build the generic OpenClaw system prompt around that profile prompt text.
4. Add core-owned dynamic channel, session, bootstrap, heartbeat, tool, and
   runtime fragments.
5. Add existing generic provider/plugin prompt contributions.
6. Let the driver perform protocol-specific request shaping.

The existing GPT-5 contribution in `src/plugins/provider-runtime.ts` is
replaced by the GPT-5 profile's `systemPrompt` source before generic
provider/plugin contributions. Snapshot tests must prove that existing
`friendly`, `off`, and heartbeat behavior keep their effective prompt order and
contents.

Channels remain transport implementations. They render portable actions and
enforce transport constraints; they do not choose an agent profile or own
profile prompt text. Channel-specific dynamic instructions remain core-owned.

Native Codex app-server `personality: "none"` behavior remains in the Codex
driver. It is a protocol parameter used when OpenClaw owns instructions, not a
portable profile personality mode.

### Driver boundary

Drivers publish prepared facts and enforce wire contracts. Representative
capabilities:

```ts
type ModelDriverCapabilities = {
  supportsToolUse: boolean;
  supportedThinkingLevels: readonly (
    | "off"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "adaptive"
    | "max"
  )[];
  supportsPromptCaching: boolean;
};
```

The implementation should extend existing capability contracts rather than
create a competing registry. Drivers retain ownership of:

- auth, endpoint setup, provider/model discovery, and aliases;
- request/response/streaming protocol;
- native thinking/reasoning parameter encoding;
- OpenAI reasoning compatibility, verbosity, and strict-tool settings;
- Anthropic native thinking, service tier, cache markers, beta headers, and
  stream wrappers;
- Codex app-server protocol fields;
- request-level error behavior.

Agent Profiles must not bypass those contracts.

### Serving presets and KV cache

Agent Profiles do not alter KV cache behavior for hosted or unmanaged providers.
They contain no cache headers, TTLs, cache-control markers, provider payload
fields, or engine flags.

This protects the current hosted-provider boundary:

- Anthropic prompt caching remains owned by existing Anthropic payload policy.
- OpenAI payload compatibility remains owned by OpenAI runtime policy.
- A third-party or self-hosted OpenAI-compatible endpoint receives no serving
  or KV settings merely because a profile is selected.

A later **Serving Preset** layer owns managed local performance:

```ts
type ServingPreset = {
  schemaVersion: 1;
  id: string;
  servingRuntime: "vllm" | "sglang" | "llama-cpp" | "ollama";
  servingRuntimeVersionRange: string;
  artifactSelector: ArtifactSelector;
  runtime: {
    maxContextTokens?: number;
    kvCacheDataType?: string;
    maxGpuMemoryFraction?: number;
  };
};
```

A Serving Preset may apply only when all of the following are true:

1. OpenClaw manages the local service.
2. The engine and version are recognized.
3. The model artifact digest is trusted.
4. A compatible preset exists.
5. The selected preset and reason are visible to the operator.

Agent Profiles may eventually express a high-level context or serving intent,
but they do not contain vLLM versions, GGUF filenames, engine flags, or KV cache
settings. Do not add `driverBindings` or serving presets to the phase-one
profile manifest.

### User configuration

Phase one adds one narrow selector at defaults and agent scope:

```json
{
  "agents": {
    "defaults": {
      "agentProfileId": "auto"
    },
    "list": [
      {
        "id": "local-helper",
        "agentProfileId": "openclaw/lean-profile-v1"
      }
    ]
  }
}
```

`"auto"` is the default and invokes binding resolution. A registered profile id
is an explicit operator choice. It is useful for a local model whose metadata
is unknown but whose behavior has been evaluated.

Settings are namespaced to the selected profile's closed settings schema:

```json
{
  "agents": {
    "defaults": {
      "agentProfileId": "openclaw/gpt-5-profile-v1",
      "settings": {
        "responseStyle": "off"
      }
    }
  }
}
```

The final field names should match existing agent-default conventions, but the
surface remains one selector plus settings for that selected profile. Do not
add equivalent settings at provider, driver, and agent scope.

Validation rules:

- `"auto"` and registered ids are accepted selectors.
- Unknown profile ids fail validation.
- Profile settings require an explicit non-`"auto"` profile at the same scope.
  An inherited explicit profile is valid when its ownership is unambiguous.
- Settings fail validation when the selected profile does not own them.
- Prompt text is accepted only through `spec.common.systemPrompt`, not as a
  setting.
- Agent scope wins over defaults, which wins over registry binding.
- Explicit selection still passes through driver capability gates.

Runtime reads only canonical profile configuration. Doctor owns migration of
legacy fields; steady-state runtime does not read both legacy and canonical
shapes.

### Migration and refactor plan

`openclaw doctor --fix` is the sole migration owner:

| Legacy input | Canonical output | Notes |
| --- | --- | --- |
| default `experimental.localModelLean: true` | default `agentProfileId: "openclaw/lean-profile-v1"` | preserves explicit Lean intent |
| agent `experimental.localModelLean: true` | agent `agentProfileId: "openclaw/lean-profile-v1"` | preserves stronger scope |
| legacy Lean `false` | remove legacy field | no explicit full profile needed |
| GPT-5 overlay personality | GPT response-style setting | preserves `friendly`/`off` |
| OpenAI plugin personality fallback | GPT response-style setting when no more-specific canonical value exists | preserves current precedence |

Doctor must validate rewritten config, be idempotent, avoid duplicating
settings across scopes, remove legacy fields after success, and report
same-precedence conflicts rather than guessing.

The following current code moves to the profile system:

| Current surface | Current responsibility | Required result |
| --- | --- | --- |
| `src/agents/local-model-lean.ts` | boolean resolution and compact tool behavior | profile behavior implementation; delete boolean resolver |
| `src/agents/agent-tools.ts` | normal-tool filtering | consume resolved OpenClaw `toolProfile` |
| `src/agents/embedded-agent-runner/run/attempt.ts` | Tool Search default and pre/post-search filtering | consume resolved profile at both boundaries |
| `src/agents/gpt5-prompt-overlay.ts` | GPT detection, personality precedence, contribution | `gpt-5-v1` system prompt source plus response-style setting |
| `src/plugins/provider-runtime.ts` | direct GPT helper call | resolve profile system prompt source before generic provider contribution |
| `extensions/openai/prompt-overlay.ts` | GPT helper facade/re-export | remove after caller migration |
| `extensions/codex/prompt-overlay.ts` | GPT helper facade/re-export | remove after caller migration |
| `src/config/zod-schema.agent-defaults.ts` | GPT overlay config | canonical profile schema and doctor migration |
| `src/agents/model-thinking-default.ts` | model-id thinking defaults | profile resolver plus capability gate |
| `docs/concepts/experimental-features.md` | Lean documentation | Agent Profiles docs and migration guidance |

The following remain in their current owners:

| Current surface | Why it stays |
| --- | --- |
| `src/plugins/provider-claude-thinking.ts` | driver-supported thinking levels/defaults |
| `packages/llm-core/src/model-contracts/anthropic.ts` | canonical Anthropic identity and native support |
| `extensions/anthropic/register.runtime.ts` | catalog, context, max token, and native maps |
| `extensions/anthropic/stream-wrappers.ts` | provider stream/beta/service behavior |
| `src/agents/anthropic-payload-policy.ts` | service tier, cache markers, boundary splitting |
| `extensions/openai/thinking-policy.ts` | OpenAI protocol policy |
| `src/agents/openai-reasoning-compat.ts` | OpenAI wire compatibility |
| `src/agents/openai-text-verbosity.ts` | OpenAI parameter policy |
| `src/agents/openai-strict-tool-setting.ts` | OpenAI tool wire policy |
| Codex thread lifecycle/conversation binding personality calls | Codex native protocol behavior |

The implementation creates one pure resolver:

```ts
resolveAgentProfile({
  identity,
  agentConfig,
  registry,
  driverCapabilities,
}): ResolvedAgentProfile
```

It is resolved once with prepared model facts and carried through tool
construction, run planning, prompt composition, thinking-default resolution,
diagnostics, and future managed-service planning. Callers must not repeat
provider/model discovery in each hot path.

### Rollout

#### Phase 1: OpenClaw-owned Agent Profile platform

Phase one covers the complete OpenClaw-owned implementation path. It establishes
the local schema, resolver, built-in registry, migration path, and managed-local
serving boundary before any ClawHub or community registry is trusted.

1. Accept this RFC.
2. Open an implementation issue with owners across agent runtime, config/doctor,
   OpenAI, Anthropic, Codex, and local serving.
3. Freeze initial profile ids and model size boundaries.
4. Confirm that `lean-profile-v1` is an exact migration rather than an
   opportunity to expand its tool deny list.
5. Add identity/model size types, registry schema, built-in registry,
   resolver, binding validation, and diagnostics.
6. Add `full-profile-v1` and `lean-profile-v1`.
7. Thread the resolved profile through run planning, tools, and prompt
   composition.
8. Move Lean logic and doctor-migrate legacy Lean config.
9. Add `gpt-5-profile-v1`, migrate response-style config, and replace direct
   prompt overlay resolution.
10. Add `anthropic-profile-v1` plus exact Claude/Opus derived profiles, and move
    only existing thinking-default selection branches.
11. Add profile inspection and documentation.
12. Remove retired runtime config reads and helper/re-export paths.
13. Add reviewed artifact/family bindings only with canonical identity,
    driver/engine conditions, benchmark evidence, rationale, and
    removal/rollback criteria. Start with a small number of high-value
    families. Do not bulk import model-card claims as operational policy.
14. Add a separate Serving Preset resolver for OpenClaw-managed local services.
    It validates engine/version/artifact compatibility, exposes applied
    settings to the operator, and is where KV cache tuning may be added.
15. Consider signed/reviewed installed profile packs only after built-ins have
    proven stable. They remain startup or explicit-reload metadata, never
    request-time remote configuration.

Phase one is complete only when profiles exist, wiring is in use, current
behavior is covered by tests, legacy config has a doctor migration, family
bindings and Serving Presets have owner-reviewed evidence, and any installed
pack mechanism has explicit provenance and reload semantics.

#### Phase 2: ClawHub profile registry

Phase two turns the profile system into a ClawHub-backed distribution and
discovery surface for open-weight models. This is the community and publisher
registry layer proposed for moving beyond `localModelLean`; it must build on
the phase-one schema, resolver, provenance, and safety boundaries rather than
replacing them.

ClawHub should allow Hugging Face model publishers, artifact publishers, and
community maintainers to submit agent profiles that target specific model
families, revisions, artifacts, or quantized files. Hugging Face identity should
be treated as a primary source for open-model ownership and artifact identity
where possible, including exact `hf://` model URIs, revisions, file paths, and
stable publisher identifiers. Profiles for the same model may be official,
publisher-authored, OpenClaw-reviewed, or community-authored, but their
provenance must be visible to operators.

The same artifact model should support enterprise and pre-release workflows.
An organization should be able to host private profile packs in an enterprise
registry or intranet mirror while it optimizes an unreleased model, then later
promote the same profile chain, or a reviewed derivative, to a public ClawHub
profile when the model is released.

The ClawHub registry should support:

- deterministic lookup by canonical model identity and exact artifact identity,
  not fuzzy model names;
- profile provenance, owner, version, review status, download/install counts,
  benchmark evidence, and rollback metadata;
- public, private, and intranet-hosted profile artifacts with immutable
  versions or digests;
- publisher and community submission flows with schema validation before a
  profile can be installed;
- benchmark-informed profile recommendations for high-value open-weight models;
- AI-assisted profile generation only as a proposal step, with reviewed output
  before distribution;
- profile discovery from a ClawHub UI that can search Hugging Face models,
  list available artifacts or quantizations, and show matching profiles;
- explicit user installation, startup loading, and visible diagnostics in
  OpenClaw.

ClawHub profiles must not be fetched or evaluated during a model request. A
downloaded profile pack still uses the phase-one installed-pack contract:
schema validation, version/provenance attribution, restart or explicit reload,
and driver capability gates. Remote content may provide a `systemPrompt` source,
but it must not inject credentials, provider payload fragments, cache controls,
server flags, or unreviewed code.

Phase two is complete only when ClawHub can publish, discover, install, verify,
and inspect agent profiles for at least a small set of benchmarked open-weight
families without weakening the built-in registry guarantees or hosted-provider
boundaries.

### Verification requirements

Registry and resolver:

- reject duplicate ids, unknown parents, cycles, bindings that reference
  unknown profiles, ambiguous bindings, invalid system prompt sources, and
  invalid settings;
- load profile folders into stable registry snapshots;
- reject missing `profile.yaml` files, prompt paths that escape the profile
  folder, request-time remote fetches, and ambiguous inherited outputs;
- table-test every model size boundary;
- prove unknown/untrusted model size selects `full-profile-v1`;
- prove exact artifact beats model, family, and model size;
- prove explicit agent/default selection precedence;
- prove selection source and selector diagnostics are stable.

Lean:

- preserve exactly current `browser`, `cron`, and `message` filtering;
- preserve forced-direct `message`;
- preserve undefined-only Tool Search defaulting;
- filter before and after Tool Search expansion;
- prove migrated configuration matches current Lean fixtures.

GPT:

- preserve current prompt snapshots for `friendly`, `off`, and heartbeat cases;
- preserve contribution order before generic provider contributions;
- prove non-GPT profiles receive no GPT contribution;
- prove legacy overlay/plugin settings migrate and invalid settings fail.

Claude/Opus:

- preserve exact current Opus 4.7/4.8 off defaults;
- preserve direct Anthropic Claude 4.6 adaptive behavior only where driver
  capabilities support it;
- retain existing provider tests as the source of truth for payload behavior.

Hosted provider regression:

- Anthropic cache-marker and service-tier request tests remain unchanged;
- OpenAI reasoning/verbosity/strict-tool request tests remain unchanged;
- unmanaged endpoints receive no Serving Preset or KV settings from profile
  resolution.

Diagnostics:

- expose canonical model, model size/provenance, selected profile/version,
  selection source, matching selector, and driver capability fallback;
- never expose prompt text, credentials, raw provider errors, or local paths.

The preferred operator surface is an existing model inspection namespace, for
example:

```text
openclaw models profile <provider/model>
```

The final command name should follow current CLI ownership rather than adding a
new top-level command.

## Rationale

### Agent Profile versus Model Driver

The terms answer different questions and should remain distinct. Calling the
registry a driver would pull transport, auth, and engine assumptions into a
portable harness behavior system. Calling a driver a profile would hide its
protocol and payload responsibilities. The split makes ownership clear and
prevents a local performance setting from reaching a public provider.

### Four model size classes, two phase-one baselines

The four requested model size classes are useful for reporting, bindings, and
later benchmarking. They do not yet justify four different prompt/tool
configurations. An `xsmall` class is intentionally omitted for now to keep
phase one simple; it can be added later if evidence shows the `small` range
needs to be split.

Two initial behavior baselines have a concrete purpose:

- `lean-profile-v1` is a compatibility target for existing explicit Lean users
  and trusted models up to 20B.
- `full-profile-v1` is the safe fallback for larger and unknown models.

This avoids premature tuning policy while retaining a stable place to add
benchmark-backed profiles later.

### Explicit system prompt sources

Prompt content is security- and cache-sensitive. The profile must name exactly
where the prompt comes from: inline `text` or a `file.path` inside the profile
pack. File paths are resolved during profile materialization, not during a model
request.

### Separate Serving Presets

KV cache dtype, context limits, and engine flags depend on serving engine,
version, hardware, artifact format, and deployment ownership. They cannot be
safely inferred from model size or profile id. Separating Serving Presets
protects hosted providers and avoids embedding high-churn operational details
into the portable profile registry.

### Exact migration before tuning

The existing Lean boolean is already user-configured behavior. Reinterpreting
it with a broader deny list would be a behavior change hidden inside a
refactor. This RFC migrates it exactly, then makes stricter or family-specific
profiles an explicit later product decision.

### Static built-in registry first

A startup-loaded built-in registry is small, deterministic, and easy to test.
It establishes the schema and resolution contract before introducing the
security, provenance, reload, and compatibility burden of an installed remote
registry ecosystem.

### Profile folders

Agent Profiles should use a folder format like Agent Skills: one required
`profile.yaml` file, plus any referenced files in the same folder. This keeps
authoring simple and makes the trust boundary obvious.

The runtime still consumes a fully resolved profile snapshot. Profile folders
must not require executable code to resolve, request-time remote fetches, or
provider payload fragments.

The artifact model also fits enterprise distribution. A profile pack can be
public on ClawHub, private in a provider's pre-release registry, or mirrored on
an intranet. In all cases, OpenClaw resolves and validates the dependency chain
before use, records the resolved profile ancestry, and applies driver
capability gates after materialization.

## Unresolved Questions

1. Should the public config field be `agentProfileId` or `harnessProfileId`?
   This RFC recommends `agentProfileId` publicly and `AgentProfile` in
   implementation types.
2. Should an explicit profile be selectable per run in phase one? The
   recommendation is defaults and agent scope only until a concrete run-level
   use case appears.
3. Which existing CLI inspection command should display the resolved profile?
4. Should Ollama parameter metadata be marked `declared` rather than
   `verified` unless an artifact digest is registry-bound? This RFC recommends
   `declared`, while still allowing size fallback with visible provenance.
5. Should a future compact profile keep tools such as `exec` direct? This is a
   benchmark/product decision and must not be folded into Lean migration.
6. What signature and provenance contract is sufficient before installed
   registry packs can carry prompt files and artifact bindings?
7. Does future local size-based policy need hardware/memory facts? Those
   belong to Serving Presets unless a concrete portable harness behavior needs
   them.
