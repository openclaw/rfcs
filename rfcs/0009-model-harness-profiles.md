---
title: Model Harness Profiles
authors:
  - osolmaz
  - vincentkoc
created: 2026-06-17
last_updated: 2026-06-17
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/18
---

# Proposal: Model Harness Profiles

## Summary

Replace OpenClaw's binary `experimental.localModelLean` behavior with a
versioned Model Profile system. A Model Profile is a bounded, portable
description of how the OpenClaw agent harness should behave for a resolved
model: tool exposure, Tool Search defaults, named system-prompt recipes, and
supported reasoning defaults. It is separate from model identity, provider
drivers, and managed-local serving presets. Phase one preserves four
requested model-capacity classes as metadata, ships two capacity-derived
behavioral baselines, migrates existing Lean/GPT-5/Claude model-specific
behavior onto profiles, and leaves KV cache and engine tuning outside profiles.

## Motivation

`experimental.localModelLean` is a useful proof of a product need but the
wrong long-term abstraction:

- It makes locality stand in for agent-harness capability.
- It is binary where current behavior already needs model-family rules.
- GPT-5 personality prompt overlays and Claude/Opus thinking defaults live in
  separate model-specific paths rather than one inspectable policy system.
- It cannot cleanly distinguish portable harness policy from local server
  configuration.
- It encourages a future where a change intended to help local models can
  accidentally alter hosted-provider payloads or cache behavior.

OpenClaw needs a small, deterministic decision path:

1. Resolve canonical model identity and trusted metadata.
2. Select the Model Profile using explicit overrides and registry bindings.
3. Apply portable harness policy, constrained by driver capabilities.
4. Keep provider protocol behavior in the driver.
5. Apply engine/KV settings only through a separate Serving Preset for an
   OpenClaw-managed local service.

This gives local and open-weight models a first-class path without making
"local" a proxy for size, capability, or deployment control. It also gives
hosted providers a consistent way to opt into portable model-family policy.

## Goals

- Replace `experimental.localModelLean` with versioned, testable model profiles.
- Preserve current Lean behavior exactly during migration.
- Centralize existing GPT-5 personality and Claude/Opus thinking-default
  behavior under the profile resolution system.
- Keep four capacity classes available as model metadata and diagnostics.
- Ship a conservative phase-one fallback: lean behavior for trusted models up
  to 20B parameters and full behavior otherwise.
- Make model identity, harness policy, driver behavior, and local serving
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

- This RFC does not define a generic user-authored prompt-file system.
- This RFC does not add raw prompt text, arbitrary tool lists, or generic
  `extra` settings to model configuration.
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

The public name is **Model Profile**. In code and architecture documentation,
use **Model Harness Profile** where it must be distinguished from the existing
model-reference authentication suffix called `profile`.

`Model Driver` is not another name for profile:

| Layer | Owns | Does not own |
| --- | --- | --- |
| Model identity | canonical model id, family, artifact/revision/digest, parameter count, capacity class | prompt policy, server flags |
| Model Profile | portable harness policy: tools, Tool Search, named prompt recipe, reasoning default | HTTP payloads, auth, KV cache, server flags |
| Model Driver | provider protocol, auth, capabilities, payload transforms, streaming, native API settings | product harness policy |
| Serving Preset | local managed-engine/artifact settings | hosted provider behavior, portable agent policy |

A driver answers: "Can OpenClaw use this endpoint, and how?" A profile answers:
"What harness policy should OpenClaw use with this model?"

### Model identity and capacity classes

Profile selection consumes a prepared identity object:

```ts
type ModelCapacityClass = "tiny" | "small" | "medium" | "large";

type ResolvedModelIdentity = {
  providerId: string;
  requestedModelId: string;
  canonicalModelId: string | null;
  modelFamily: string | null;
  artifact: {
    source: "registry" | "ollama" | "configured" | "unknown";
    digest: string | null;
    revision: string | null;
    format: "safetensors" | "gguf" | "ollama" | "api" | "unknown";
  };
  parameterCountB: number | null;
  capacityClass: ModelCapacityClass | null;
  metadataTrust: "verified" | "declared" | "unknown";
};
```

The requested capacity classes use total parameter count:

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

Capacity-derived fallback requires trusted structured metadata:

1. A reviewed registry binding may provide verified artifact/model metadata.
2. Ollama metadata may provide a declared parameter size through structured
   `details.parameter_size` parsing.
3. Explicitly configured structured metadata may be declared if it has a
   validated owner and diagnostic provenance.
4. Bare names such as `foo-7b-instruct` are diagnostic only and must not
   select a compact profile.

Generic OpenAI-compatible endpoints, including common vLLM and SGLang
discovery paths, often expose only model ids. They report unknown capacity
unless a registry/artifact binding supplies the missing fact. Unknown capacity
uses the full profile.

### Registry and manifest format

Profiles and bindings live in a schema-validated built-in registry:

```ts
type ModelHarnessProfileRegistry = {
  schemaVersion: 1;
  profiles: ModelHarnessProfile[];
  bindings: ModelProfileBinding[];
};

type ModelHarnessProfile = {
  schemaVersion: 1;
  id: string;
  extends?: string;
  policy: ModelProfilePolicy;
  settings?: ModelProfileSettingsSchema;
};

type ModelProfileBinding = {
  id: string;
  selector: {
    providerId?: string;
    canonicalModelId?: string;
    modelFamily?: string;
    artifactDigest?: string;
    capacityClass?: ModelCapacityClass;
  };
  profile: string;
};
```

The initial implementation may represent this as JSON-compatible files or a
typed source module validated against the same schema. The contract is
declarative and JSON-compatible, similar in spirit to model manifests, but it
is not a request-time config file.

The built-in registry loads and validates once during process startup. The
process retains an immutable snapshot; an agent run receives a resolved policy
snapshot, not a mutable registry pointer. Invalid built-ins fail development or
build validation rather than falling back at request time.

Future installed packs require explicit owner-controlled installation, schema
validation, version/provenance attribution, and restart or explicit reload.
They must never be fetched during a model request.

Profiles support exactly one `extends` parent. The inheritance chain is linear
and materialized base-to-leaf. The registry rejects cycles, unknown parents,
ambiguous bindings, unknown prompt recipes, and invalid settings. Arrays and
maps must use field-specific replacement/merge semantics; generic deep merge is
not allowed.

### Selection order

Profile resolution is deterministic and chooses one profile:

1. Explicit agent profile.
2. Explicit global default profile.
3. Exact artifact-digest binding.
4. Exact canonical-model binding.
5. Provider-scoped model-family binding.
6. Trusted capacity-class binding.
7. `openclaw/full-agent-v1`.

```ts
type ModelHarnessProfileSelectionSource =
  | "agent-explicit"
  | "defaults-explicit"
  | "artifact"
  | "model"
  | "family"
  | "capacity"
  | "fallback";

type ResolvedModelHarnessProfile = {
  profile: ModelHarnessProfile;
  source: ModelHarnessProfileSelectionSource;
  bindingId: string | null;
  identity: ResolvedModelIdentity;
};
```

An ambiguous match at the same precedence level is a registry error. Exact
artifact binding always wins over model, family, and capacity. Family bindings
are provider scoped whenever native capabilities differ across routes.

Profile policy remains subject to driver capabilities. A profile can request an
adaptive thinking default, for example, but the driver remains authoritative on
whether the selected model/route supports it. Unsupported requested behavior
uses a named, testable fallback and emits bounded diagnostics; it does not
invent a provider payload.

### Initial profiles

Phase one deliberately keeps four capacity classes but ships two
capacity-derived behavioral baselines:

| Profile | Parent | Binding intent | Purpose |
| --- | --- | --- | --- |
| `openclaw/full-agent-v1` | none | fallback; Medium/Large | general harness baseline |
| `openclaw/lean-agent-v1` | `full-agent-v1` | trusted Tiny/Small; legacy config | exact Lean migration |
| `openclaw/gpt-5-agent-v1` | `full-agent-v1` | current GPT-5 family behavior | prompt recipe and personality setting |
| `openclaw/claude-opus-4-7-agent-v1` | `full-agent-v1` | current exact Opus 4.7/4.8 behavior | preserves thinking default |
| `openclaw/claude-4-6-agent-v1` | `full-agent-v1` | current direct Anthropic Claude 4.6 behavior | preserves adaptive thinking default |

The exact model aliases and family identities remain in canonical model/provider
catalogs. Registry bindings refer to normalized identity; profiles are not a
second model catalog.

`full-agent-v1` is behaviorally neutral:

```json
{
  "schemaVersion": 1,
  "id": "openclaw/full-agent-v1",
  "policy": {
    "toolExposure": "standard-v1",
    "toolSearchDefault": "inherit",
    "promptRecipe": "standard-v1",
    "reasoningDefault": "inherit",
    "contextPosture": "standard"
  }
}
```

`lean-agent-v1` is the exact migration target for
`experimental.localModelLean: true`:

```json
{
  "schemaVersion": 1,
  "id": "openclaw/lean-agent-v1",
  "extends": "openclaw/full-agent-v1",
  "policy": {
    "toolExposure": "lean-v1",
    "toolSearchDefault": "lean-v1",
    "contextPosture": "constrained"
  }
}
```

Phase-one `lean-v1` preserves today's behavior:

- filter `browser`, `cron`, and `message` from normal model tool exposure;
- preserve forced-direct `message` when the runtime requires it;
- default Tool Search to enabled only when the current setting is undefined;
- apply compact filtering both before and after Tool Search expansion.

The broader deny list proposed in local-model Lean PR `#87617` is not a
compatible migration. It may be a later explicitly selected and benchmarked
profile, such as `compact-agent-v2`, but must not alter `lean-agent-v1`.

The routing mechanism explored in `#87587`, where named tools can remain
direct, is useful as an implementation detail:

```ts
type ToolExposurePolicy = {
  mode: "standard-v1" | "lean-v1";
  alwaysDirectToolIds: readonly string[];
};
```

It does not change phase-one Lean semantics without an explicit product
decision.

The GPT-5 profile owns the migrated personality setting and a code-owned named
prompt recipe:

```json
{
  "schemaVersion": 1,
  "id": "openclaw/gpt-5-agent-v1",
  "extends": "openclaw/full-agent-v1",
  "policy": {
    "promptRecipe": "gpt-5-v1"
  },
  "settings": {
    "personality": {
      "type": "enum",
      "values": ["friendly", "off"],
      "default": "friendly"
    }
  }
}
```

The Claude/Opus profiles migrate only existing thinking-default selection:

```json
{
  "schemaVersion": 1,
  "id": "openclaw/claude-opus-4-7-agent-v1",
  "extends": "openclaw/full-agent-v1",
  "policy": {
    "reasoningDefault": "off"
  }
}
```

```json
{
  "schemaVersion": 1,
  "id": "openclaw/claude-4-6-agent-v1",
  "extends": "openclaw/full-agent-v1",
  "policy": {
    "reasoningDefault": "adaptive"
  }
}
```

The profile selects a default; the driver continues to own allowed thinking
levels, native parameter names, and final request validation. There is no
current Claude prompt overlay to migrate, and this RFC does not create one.

### Policy surface

The phase-one policy surface is closed:

```ts
type ModelProfilePolicy = {
  toolExposure?: "standard-v1" | "lean-v1";
  toolSearchDefault?: "inherit" | "lean-v1";
  promptRecipe?: "standard-v1" | "gpt-5-v1";
  reasoningDefault?: "inherit" | "off" | "adaptive";
  contextPosture?: "standard" | "constrained";
};
```

| Field | Owner | Consumer | Phase-one meaning |
| --- | --- | --- | --- |
| `toolExposure` | agent harness | tool preparation | standard or Lean filter |
| `toolSearchDefault` | agent harness | embedded run planning | preserves undefined-only default semantics |
| `promptRecipe` | core prompt composition | system-prompt builder | selects code-owned contribution |
| `reasoningDefault` | resolver plus capability gate | current thinking-default callers | replaces model-id branching |
| `contextPosture` | diagnostics/future policy | no hidden automatic rewrite | records compact/full intent |

`contextPosture` is not a context-window override. It remains diagnostic until
a concrete policy has benchmark and compatibility evidence.

The schema must not add raw system prompt bodies, arbitrary user tool
allow/deny lists, endpoint data, transport headers, provider request fragments,
server launch arguments, cache controls, or generic `extra` maps.

### System prompt composition

Profiles select named prompt recipes. They do not contain arbitrary prompt text.

```ts
type PromptRecipeId = "standard-v1" | "gpt-5-v1";

type PromptRecipeContribution = {
  id: string;
  text: string;
};
```

Prompt text stays in source-controlled OpenClaw code. This keeps prompt
changes reviewable, versioned, testable with snapshots, deterministic for
prompt caching, and safe from unreviewed remote registry content.

The implementation defines and tests one composition order:

1. Prepare model identity, driver capabilities, and resolved profile.
2. Build the generic OpenClaw system prompt.
3. Add the selected profile recipe contribution.
4. Add core-owned dynamic channel, session, bootstrap, heartbeat, tool, and
   runtime fragments.
5. Add existing generic provider/plugin prompt contributions.
6. Let the driver perform protocol-specific request shaping.

The existing GPT-5 contribution in `src/plugins/provider-runtime.ts` is
replaced by the selected `gpt-5-v1` recipe contribution before generic
provider/plugin contributions. Snapshot tests must prove that existing
`friendly`, `off`, and heartbeat behavior retain their effective prompt order
and contents.

Channels remain transport implementations. They render portable actions and
enforce transport constraints; they do not choose a model profile or own
profile prompt text. Channel-specific dynamic instructions remain core-owned.

Native Codex app-server `personality: "none"` behavior remains in the Codex
driver. It is a protocol parameter used when OpenClaw owns instructions, not a
portable profile personality mode.

### Driver boundary

Drivers publish prepared facts and enforce wire contracts. Representative
capabilities:

```ts
type ModelDriverCapabilities = {
  supportsTools: boolean;
  supportsToolSearch: boolean;
  reasoningModes: readonly ("off" | "adaptive")[];
  supportsNativePromptCaching: boolean;
  managedServing: boolean;
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

Profiles must not bypass those contracts.

### Serving presets and KV cache

Profiles do not alter KV cache behavior for hosted or unmanaged providers.
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
  engine: "vllm" | "sglang" | "llama-cpp" | "ollama";
  engineVersionRange: string;
  artifact: ArtifactSelector;
  settings: {
    contextWindow?: number;
    kvCacheDtype?: string;
    gpuMemoryUtilization?: number;
    parallelism?: number;
  };
};
```

A Serving Preset may apply only when all of the following are true:

1. OpenClaw manages the local service.
2. The engine and version are recognized.
3. The model artifact/revision/format is trusted.
4. A compatible preset exists.
5. The selected preset and reason are visible to the operator.

Profiles may eventually express a high-level context or serving intent, but
they do not contain vLLM versions, GGUF filenames, engine flags, or KV cache
settings. Do not add `driverBindings` or serving presets to the phase-one
profile manifest.

### User configuration

Phase one adds one narrow selector at defaults and agent scope:

```json
{
  "agents": {
    "defaults": {
      "modelProfile": "auto"
    },
    "list": [
      {
        "id": "local-helper",
        "modelProfile": "openclaw/lean-agent-v1"
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
      "modelProfile": "openclaw/gpt-5-agent-v1",
      "modelProfileSettings": {
        "personality": "off"
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
- Raw prompt bodies are never accepted as settings.
- Agent scope wins over defaults, which wins over registry binding.
- Explicit selection still passes through driver capability gates.

Runtime reads only canonical profile configuration. Doctor owns migration of
legacy fields; steady-state runtime does not read both legacy and canonical
shapes.

### Migration and refactor plan

`openclaw doctor --fix` is the sole migration owner:

| Legacy input | Canonical output | Notes |
| --- | --- | --- |
| default `experimental.localModelLean: true` | default `modelProfile: "openclaw/lean-agent-v1"` | preserves explicit Lean intent |
| agent `experimental.localModelLean: true` | agent `modelProfile: "openclaw/lean-agent-v1"` | preserves stronger scope |
| legacy Lean `false` | remove legacy field | no explicit full profile needed |
| GPT-5 overlay personality | GPT profile setting | preserves `friendly`/`off` |
| OpenAI plugin personality fallback | GPT setting when no more-specific canonical value exists | preserves current precedence |

Doctor must validate rewritten config, be idempotent, avoid duplicating
settings across scopes, remove legacy fields after success, and report
same-precedence conflicts rather than guessing.

The following current code moves to the profile system:

| Current surface | Current responsibility | Required result |
| --- | --- | --- |
| `src/agents/local-model-lean.ts` | boolean resolution and compact tool policy | profile policy implementation; delete boolean resolver |
| `src/agents/agent-tools.ts` | normal-tool filtering | consume resolved `toolExposure` |
| `src/agents/embedded-agent-runner/run/attempt.ts` | Tool Search default and pre/post-search filtering | consume resolved profile at both boundaries |
| `src/agents/gpt5-prompt-overlay.ts` | GPT detection, personality precedence, contribution | code-owned `gpt-5-v1` recipe plus profile setting |
| `src/plugins/provider-runtime.ts` | direct GPT helper call | resolve profile contribution before generic provider contribution |
| `extensions/openai/prompt-overlay.ts` | GPT helper facade/re-export | remove after caller migration |
| `extensions/codex/prompt-overlay.ts` | GPT helper facade/re-export | remove after caller migration |
| `src/config/zod-schema.agent-defaults.ts` | GPT overlay config | canonical profile schema and doctor migration |
| `src/agents/model-thinking-default.ts` | model-id thinking defaults | profile resolver plus capability gate |
| `docs/concepts/experimental-features.md` | Lean documentation | Model Profiles docs and migration guidance |

The following remain in their current owners:

| Current surface | Why it stays |
| --- | --- |
| `src/plugins/provider-claude-thinking.ts` | driver-supported thinking levels/default profiles |
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
resolveModelHarnessProfile({
  identity,
  agentConfig,
  registry,
  driverCapabilities,
}): ResolvedModelHarnessProfile
```

It is resolved once with prepared model facts and carried through tool
construction, run planning, prompt composition, thinking-default resolution,
diagnostics, and future managed-service planning. Callers must not repeat
provider/model discovery in each hot path.

### Rollout

#### Phase 1: OpenClaw-owned profile platform

Phase one covers the complete OpenClaw-owned implementation path. It establishes
the local schema, resolver, built-in registry, migration path, and managed-local
serving boundary before any ClawHub or community registry is trusted.

1. Accept this RFC.
2. Open an implementation issue with owners across agent runtime, config/doctor,
   OpenAI, Anthropic, Codex, and local serving.
3. Freeze initial profile ids and capacity boundaries.
4. Confirm that `lean-agent-v1` is an exact migration rather than an
   opportunity to expand its tool deny list.
5. Add identity/capacity types, registry schema, built-in registry, resolver,
   binding validation, and diagnostics.
6. Add `full-agent-v1` and `lean-agent-v1`.
7. Thread the resolved profile through run planning, tools, and prompt
   composition.
8. Move Lean logic and doctor-migrate legacy Lean config.
9. Add `gpt-5-agent-v1`, migrate personality config, and replace direct prompt
   overlay resolution.
10. Add exact Claude/Opus profiles and move only existing thinking-default
    selection branches.
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

#### Phase 2: ClawHub model profile registry

Phase two turns the profile system into a ClawHub-backed distribution and
discovery surface for open-weight models. This is the community and publisher
registry layer proposed for moving beyond `localModelLean`; it must build on
the phase-one schema, resolver, provenance, and safety boundaries rather than
replacing them.

ClawHub should allow Hugging Face model publishers, artifact publishers, and
community maintainers to submit model profiles that target specific model
families, revisions, artifacts, or quantized files. Hugging Face identity should
be treated as a primary source for open-model ownership and artifact identity
where possible, including exact `hf://` model URIs, revisions, file paths, and
stable publisher identifiers. Profiles for the same model may be official,
publisher-authored, OpenClaw-reviewed, or community-authored, but their
provenance must be visible to operators.

The ClawHub registry should support:

- deterministic lookup by canonical model identity and exact artifact identity,
  not fuzzy model names;
- profile provenance, owner, version, review status, download/install counts,
  benchmark evidence, and rollback metadata;
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
and driver capability gates. Remote content must not inject raw prompt text,
credentials, provider payload fragments, cache controls, server flags, or
unreviewed code. If ClawHub eventually references prompt behavior, it should
select reviewed named prompt recipes rather than carrying arbitrary prompt
bodies.

Phase two is complete only when ClawHub can publish, discover, install, verify,
and inspect model profiles for at least a small set of benchmarked open-weight
families without weakening the built-in registry guarantees or hosted-provider
boundaries.

### Verification requirements

Registry and resolver:

- reject duplicate ids, unknown parents, cycles, unknown bindings, ambiguous
  bindings, unknown recipes, and invalid settings;
- table-test every capacity boundary;
- prove unknown/untrusted capacity selects `full-agent-v1`;
- prove exact artifact beats model, family, and capacity;
- prove explicit agent/default selection precedence;
- prove selection source and binding diagnostics are stable.

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

- expose canonical model, capacity/provenance, selected profile/version,
  selection source, binding id, and driver capability fallback;
- never expose prompt text, credentials, raw provider errors, or local paths.

The preferred operator surface is an existing model inspection namespace, for
example:

```text
openclaw models profile <provider/model>
```

The final command name should follow current CLI ownership rather than adding a
new top-level command.

## Rationale

### Model Profile versus Model Driver

The terms answer different questions and should remain distinct. Calling the
registry a driver would pull transport, auth, and engine assumptions into a
portable harness policy system. Calling a driver a profile would hide its
protocol and payload responsibilities. The split makes ownership clear and
prevents a local performance setting from reaching a public provider.

### Four capacity classes, two phase-one baselines

The four requested classes are useful for reporting, bindings, and later
benchmarking. They do not yet justify four different prompt/tool configurations.
An `xsmall` class is intentionally omitted for now to keep phase one simple; it
can be added later if evidence shows the `small` range needs to be split.

Two initial behavior baselines have a concrete purpose:

- `lean-agent-v1` is a compatibility target for existing explicit Lean users
  and trusted models up to 20B.
- `full-agent-v1` is the safe fallback for larger and unknown models.

This avoids premature tuning policy while retaining a stable place to add
benchmark-backed profiles later.

### Named prompt recipes instead of prompt text in manifests

Prompt content is security- and cache-sensitive product code. Keeping it in
source provides code review, snapshots, deterministic order, and versioned
rollouts. A profile manifest selects a recipe; it does not become a remote
prompt patch system.

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

## Unresolved Questions

1. Should the public config field be `modelProfile` or `harnessProfile`?
   This RFC recommends `modelProfile` publicly and `ModelHarnessProfile` in
   implementation types.
2. Should an explicit profile be selectable per run in phase one? The
   recommendation is defaults and agent scope only until a concrete run-level
   use case appears.
3. Which existing CLI inspection command should display the resolved profile?
4. Should Ollama parameter metadata be marked `declared` rather than
   `verified` unless an artifact digest is registry-bound? This RFC recommends
   `declared`, while still allowing capacity fallback with visible provenance.
5. Should a future compact profile keep tools such as `exec` direct? This is a
   benchmark/product decision and must not be folded into Lean migration.
6. What signature and provenance contract is sufficient before installed
   registry packs can reference reviewed prompt recipes and artifact bindings?
7. Does future local capacity policy need hardware/memory facts? Those belong
   to Serving Presets unless a concrete portable harness behavior needs them.
