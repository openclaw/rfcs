# Claw Test v1 Specification

This document defines the bounded project-only test format used by the Claw
project lifecycle in RFC 0016. It provides static package and lifecycle
assertions plus an explicitly live model-evaluation lane without executing
arbitrary project or downloaded package code.

Status: experimental draft, tied to RFC 0016 and the Claw Project v1
Specification.

Addendum PR: [openclaw/rfcs#56](https://github.com/openclaw/rfcs/pull/56).

## Scope and Ownership

Files matching `tests/*.claw-test.yml` are authoring inputs. They are excluded
from built Claw packages and never become applied state. The OpenClaw project
test runner owns parsing and orchestration; canonical package and lifecycle
owners produce the facts being asserted.

The format is strict. Duplicate YAML keys, aliases, custom tags, merge keys,
unknown fields, unknown check kinds, unsafe paths, links, special files, and
content beyond existing project limits fail validation.

The runner never interprets shell commands, JavaScript, TypeScript, Python,
package scripts, hooks, or executable snippets from a test file.

## Document Shape

Each file contains one test:

```yaml
schemaVersion: 1
name: travel-concierge-static
mode: static
checks:
  - kind: package-valid
  - kind: build-includes
    paths:
      - CLAW.md
      - profiles/openclaw.yml
      - schemas/travel-plan.schema.json
  - kind: build-excludes
    paths:
      - tests/smoke.claw-test.yml
  - kind: plan-action-kinds
    includes:
      - agent
      - workspaceFile
      - package
      - mcpServer
  - kind: plan-blocker-codes
    equals: []
  - kind: plan-readiness
    ready: false
    includes:
      - kind: environment
        mcpServer: expedia
        name: EXPEDIA_API_KEY
```

Top-level fields are:

- `schemaVersion`: required integer `1`.
- `name`: required stable identifier, 1-80 characters, unique within the
  project under the package specification's portable collision key.
- `mode`: required `static` or `live`.
- `checks`: required nonempty ordered list of checks.
- `live`: required only for `mode: live` and forbidden for `mode: static`.

## Checks

V1 supports only these check kinds:

- `package-valid`: canonical project and package validation succeeds.
- `build-includes`: the canonical built package contains every confined path in
  `paths`.
- `build-excludes`: the canonical built package contains none of the confined
  paths in `paths`.
- `plan-action-kinds`: the add dry-run contains every kind in `includes` and no
  kind in optional `excludes`.
- `plan-blocker-codes`: stable blocker codes contain every value in optional
  `includes` or exactly equal `equals` when supplied.
- `plan-readiness`: `ready` exactly matches the plan readiness boolean and each
  structured prerequisite in optional `includes` is present in the plan's
  canonical `requirements` list.
- `json-schema`: the JSON fixture at `document` validates against the packaged
  JSON Schema at `schema`.
- `text-contains`: the UTF-8 project file at `path` contains every literal
  string in `values`.
- `live-output-schema`: in live mode, the final structured model output
  validates against the packaged JSON Schema at `schema`.

Check fields are exact:

| Kind | Required fields | Optional fields |
| --- | --- | --- |
| `package-valid` | none | none |
| `build-includes` | nonempty `paths: string[]` | none |
| `build-excludes` | nonempty `paths: string[]` | none |
| `plan-action-kinds` | nonempty `includes: string[]` | nonempty `excludes: string[]` |
| `plan-blocker-codes` | exactly one of `includes: string[]` or `equals: string[]` | none |
| `plan-readiness` | `ready: boolean` | nonempty `includes: prerequisite[]` |
| `json-schema` | `document: string`, `schema: string` | none |
| `text-contains` | `path: string`, nonempty `values: string[]` | none |
| `live-output-schema` | `schema: string` | none |

`live-output-schema` is valid only in live mode; every other check is valid in
either mode and runs before a live turn. `plan-action-kinds` values are limited
to `agent`, `workspace`, `workspaceFile`, `package`, `mcpServer`, and `cronJob`,
the canonical V1 `ClawAddPlanAction.kind` values. Blocker codes are exact stable
codes from canonical add-plan diagnostics.

A readiness prerequisite has exactly one of these canonical shapes:

```yaml
- kind: environment
  mcpServer: expedia
  name: EXPEDIA_API_KEY
- kind: oauth
  mcpServer: github
- kind: plugin-setup
  plugin: github
  provider: github
  envVars: [GITHUB_TOKEN]
  authMethods: [oauth]
```

Prerequisite arrays compare as sets of exact structured objects after canonical
owner normalization; document ordering is not significant. `includes: []` is
invalid except where an empty exact result is intentionally expressed with
`equals: []`. Paths are project-relative, use forward slashes, and must resolve
to regular files within the project. Checks compare structured owner output and
exact package bytes; they do not scrape human CLI text.

Test inputs and fixtures belong under `tests/`. The entire directory is
project-only and excluded from built artifacts. A check may read a confined
fixture there, but package-path assertions and schemas intended for recipients
must still point to ordinary selected package content outside `tests/`.

Static execution validates the project, builds in a temporary directory,
re-reads the artifact, and creates an add dry-run against empty disposable
state. It does not apply the Claw, install dependencies, start an agent, invoke
a provider, access the network, activate schedules, or deliver messages.

## Live Evaluation

A live test has this additional shape:

```yaml
schemaVersion: 1
name: travel-concierge-live
mode: live
checks:
  - kind: package-valid
  - kind: live-output-schema
    schema: schemas/travel-plan.schema.json
live:
  promptFile: tests/fixtures/travel-request.md
  maxTurns: 3
```

`live` fields are:

- `promptFile`: required confined UTF-8 project file containing the user test
  prompt. The prompt is not copied into the built package unless independently
  selected as ordinary package content.
- `maxTurns`: required integer from 1 through 10.

The only V1 live-specific check is `live-output-schema`, whose `schema` points
to a packaged JSON Schema. The runner validates the final structured output
against that schema. Text quality scoring, model-graded assertions, tool-call
scripts, and arbitrary callbacks are outside V1.

Live tests run only when all of these conditions hold:

1. The test declares `mode: live`.
2. The operator passes `openclaw claws test --live`.
3. The runner displays the selected model, provider, maximum turns, available
   budget or cost information, and all external capability effects.
4. The operator consents to the integrity-bound lifecycle plan.

If the provider cannot enforce a monetary or token ceiling, the runner must
label the displayed budget as informational and must not call it a limit.
Credentials and resolved secret values remain in canonical local owners and
must not appear in the test document, result, transcript artifact, or package.

Recurring schedules and outbound channel delivery remain disabled during live
tests. Network-capable tools, plugins, and MCP servers remain blocked unless
they are separately selected and disclosed in the live plan. A general
`--live` flag is not blanket capability consent.

## Results

Machine-readable results identify:

- test schema version, name, mode, and source digest;
- project and built artifact digests;
- applying OpenClaw and builder versions;
- each check, owner, status, and stable reason code;
- selected model and maximum turns for live tests; and
- whether budget information was enforced or informational.

Statuses are `passed`, `failed`, `blocked`, or `skipped`. The result must
distinguish framework, package, lifecycle-owner, environment/readiness, and
model-output failures. Human output may explain remediation but does not replace
the structured result.

Raw live prompts, responses, transcripts, credentials, and user files are not
included in normal results. An explicit local debug option may retain a
redacted transcript outside the project and package; it must disclose the path
and retention behavior before the run.

## Conformance

A conforming runner proves:

1. Strict parsing rejects unknown fields and executable content.
2. Static tests run with network and providers unavailable.
3. Static plan checks use empty disposable state and perform no mutation.
4. Test files and project-only fixtures are absent from built artifacts.
5. Live tests cannot start without both a live declaration and `--live`.
6. Live execution honors maximum turns and reports whether budget information
   is enforced or informational.
7. Schedules and delivery stay disabled, and each other external effect needs
   separate plan disclosure and consent.
8. Structured results classify failures without retaining private transcripts
   or secret values.

## Evolution

New check kinds, model graders, multi-turn scripts, network fixtures, and
cross-harness result comparison require a new reviewed contract. V1 consumers
must reject rather than ignore unknown checks.
