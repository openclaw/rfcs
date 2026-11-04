# Current behavior proof and illustrative mocks

This is a supporting evidence artifact for RFC 0066, not a second RFC.
Existing behavior was verified on 2026-09-22 against OpenClaw commit
[`d1d05aea8a1127150c1aa2ae0955f7a8232a557e`](https://github.com/openclaw/openclaw/commit/d1d05aea8a1127150c1aa2ae0955f7a8232a557e).
The observed baseline and executed unit-test results below describe current
behavior. Every proposed mock is illustrative and non-normative; none claims
that the proposed behavior exists.

## Executed existing-behavior proof

### Gateway supervision

Command:

```text
node scripts/run-vitest.mjs run src/infra/gateway-supervision.test.ts
```

Machine-independent result excerpt:

```text
✓ src/infra/gateway-supervision.test.ts (16 tests)
Test Files  1 passed (1)
Tests       16 passed (16)
```

The relevant assertions verify:

- external-mode normalization, including a case-insensitive, whitespace-padded
  `EXTERNAL` value;
- native service mutation is blocked with the exact generic supervisor
  guidance; and
- self-update guidance explains why the external supervisor must own the
  stop, update, finalization, and restart workflow.

See the pinned
[gateway supervision tests](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/src/infra/gateway-supervision.test.ts#L16-L37),
[self-update assertion](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/src/infra/gateway-supervision.test.ts#L143-L147),
and
[current implementation](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/src/infra/gateway-supervision.ts#L5-L37).

### Control UI update projection

Command:

```text
node scripts/run-vitest.mjs run ui/src/app/update-overlay-helpers.test.ts
```

Machine-independent result excerpt:

```text
✓ ui/src/app/update-overlay-helpers.test.ts (24 tests)
Test Files  1 passed (1)
Tests       24 passed (24)
```

The relevant assertion, `keeps external supervisor refusals visible without
launching failure triage`, verifies that the refusal remains a warning, shows
the generic external-supervisor update guidance, does not mention
`openclaw triage`, and does not create a failure-triage model.

See the pinned
[unit test](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/ui/src/app/update-overlay-helpers.test.ts#L332-L347),
[reason mapping](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/ui/src/app/update-overlay-helpers.ts#L45-L60),
and
[localized message](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/ui/src/i18n/locales/en.ts#L654-L666).

The existing
[browser E2E source](https://github.com/openclaw/openclaw/blob/d1d05aea8a1127150c1aa2ae0955f7a8232a557e/ui/src/e2e/update-external-supervisor.e2e.test.ts#L20-L149)
asserts that the generic external-update report is retained in Settings with
no retry or triage path. It also writes capture screenshots when that lane
runs. This source is supporting current-behavior evidence, not part of the
executed unit-test proof above.

## Exact observed baseline examples

### CLI native service mutation

The gateway supervision test asserts this exact current message:

```text
OpenClaw gateway lifecycle is managed by an external supervisor (OPENCLAW_SUPERVISOR_MODE=external). Use that supervisor to restart the gateway.
```

That test exercises a blocked native service mutation. Ordinary external-mode
`openclaw gateway restart` remains the separate in-Gateway handoff documented
by RFC 0066.

### Control UI update refusal

The current English locale contains this exact guidance:

```text
This Gateway is managed by an external supervisor. Use your server or deployment's update workflow to update OpenClaw and restart the Gateway. The Control UI and `openclaw update` cannot update this installation. No package changes or Gateway restart were attempted.
```

The focused unit test verifies that this refusal stays visible without opening
failure triage.

## Illustrative proposed mocks

Every mock in this section is non-normative. Surface-native wording, layout,
styling, and copy affordances remain implementation-owned. Commands are opaque
display strings: a renderer may wrap them for presentation, but must not
rewrite or execute them, and copying must yield the validated string.

### CLI: `clawctl` start

Current generic form:

```text
OpenClaw gateway lifecycle is managed by an external supervisor (OPENCLAW_SUPERVISOR_MODE=external). Use that supervisor to start the gateway.
```

Illustrative actionable form:

```text
OpenClaw gateway lifecycle is managed by clawctl (OPENCLAW_SUPERVISOR_MODE=external).
Start (Windows host session): clawctl gateway-service start
```

### CLI: Docker Compose start

Current generic form:

```text
OpenClaw gateway lifecycle is managed by an external supervisor (OPENCLAW_SUPERVISOR_MODE=external). Use that supervisor to start the gateway.
```

Illustrative actionable form:

```text
OpenClaw gateway lifecycle is managed by Docker Compose (OPENCLAW_SUPERVISOR_MODE=external).
Start (Docker host): docker compose up -d gateway
```

### Control UI: update refusal and retained report

Current generic form:

```text
This Gateway is managed by an external supervisor. Use your server or deployment's update workflow to update OpenClaw and restart the Gateway. The Control UI and `openclaw update` cannot update this installation. No package changes or Gateway restart were attempted.
```

Illustrative actionable form:

```text
This Gateway is managed by Docker Compose.
Update (Docker host): docker compose pull gateway && docker compose up -d gateway
The Control UI and `openclaw update` cannot update this installation. No package changes or Gateway restart were attempted.
```

In this non-normative mock, the Docker Compose command is the illustrative
producer-supplied display string. A real UI copies it unchanged; no button
executes it.

## What this proves and does not prove

This evidence proves the current generic behavior and the motivating gap on
both CLI and Control UI surfaces. The mocks give reviewers concrete examples
of the proposal's intended information architecture.

It does not prove implementation, RFC acceptance, final wording or layout, or
the validity and availability of any displayed command.
