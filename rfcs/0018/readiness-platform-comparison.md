# Readiness Identity and Hosting Platform Comparison

Status: non-normative design evidence for RFC 0018  
Last updated: 2026-07-26

## Purpose

This sidecar compares RFC 0018 with established readiness and runtime identity
contracts. It tests whether OpenClaw is introducing unnecessary concepts and
records which adjacent-system features belong in readiness v1, in a host, or
in a later transport contract.

The comparison is semantic rather than lexical. RFC 0018 is an in-process
hostee contract, not a workload orchestrator, telemetry backend, or control
plane.

## Summary

RFC 0018 combines two patterns that mature systems usually expose separately:

1. a compact decision suitable for a container or service manager; and
2. structured current-state facts with enough identity to explain what was
   evaluated and whether that object was revised or replaced.

Kubernetes is the closest identity analogue. ASP.NET Core and Spring Boot are
the closest provider-composition analogues. Docker and systemd demonstrate why
the host-facing decision must remain small and bounded. OpenTelemetry confirms
the value of opaque instance identity and the danger of using dynamic identity
as unbounded metric dimensions.

No comparison justifies another required v1 field. The main actionable result
is an atomic-observation invariant: one readiness result must not combine a
condition from one owner generation with identity from another.

## Comparison Matrix

| System | Composition | Identity and lifetime | Host-facing decision | RFC 0018 disposition |
| --- | --- | --- | --- | --- |
| Kubernetes | Container probes, Pod conditions, and readiness gates contribute to readiness. | Object name is a stable role; UID identifies one historical occurrence; generation and observed generation distinguish desired-state revision from observed status. | Readiness removes a Pod from service endpoints; liveness may restart it; startup delays both. | Reuse the condition and replacement/revision distinctions. Do not copy Kubernetes API storage, watch, or controller semantics. |
| Docker | One `HEALTHCHECK` command produces one container health state; the engine supplies interval, timeout, start period, and retries. | Container identity and restart history are engine-owned, outside the health payload. | `starting`, `healthy`, or `unhealthy`, plus bounded recent probe output. | Keep `/readyz` compact. Let Docker own scheduling and retries while OpenClaw explains the internal decision. |
| systemd | A service can notify readiness, status, process identity, reload, stop, and watchdog progress. | The service manager owns unit and process lifetime. | `READY=1` is a concise transition consumed by the manager. | Keep supervision host-owned. OpenClaw conditions add detail behind the service-level decision rather than replacing the manager. |
| ASP.NET Core Health Checks | Registered checks can be selected by tags and grouped into readiness and liveness endpoints. | Check registration names components, but the standard result does not model replacement identity or parent lifetime. | Aggregated `Healthy`, `Degraded`, or `Unhealthy` results map to endpoints. | Reuse selectable providers and required/advisory aggregation; retain stronger execution bounds and subject identity. |
| Spring Boot Actuator | Health contributors form nested components and configurable health groups, including readiness and liveness groups. | Component paths are stable names; incarnation and semantic generation are not first-class health fields. | Group status is exposed through probe endpoints such as `/readyz`. | Reuse owner-contributed components and named compositions. Avoid pulling external dependencies into liveness or making every contributor required. |
| OpenTelemetry | Resources and entities attach identity to telemetry from services, processes, containers, and orchestrators. | `service.instance.id` distinguishes concurrently running service instances and should be opaque and unambiguous. | OpenTelemetry reports observations; it does not decide traffic admission. | Allow bounded diagnostic correlation. Do not turn subject IDs, generations, or node references into metric labels or authority identities. |

## Kubernetes Mapping

Kubernetes provides the strongest precedent for separating a logical role from
the object currently occupying it:

| RFC 0018 | Closest Kubernetes concept | Important difference |
| --- | --- | --- |
| Subject `ref` | Resource name and scope | A readiness reference is a diagnostic role within one result, not an API resource URL. |
| Subject `id` | Object UID | Both change when an object is replaced. RFC 0018 IDs are owner-scoped opaque values, not cluster-global resource identifiers. |
| Subject `generation` | `metadata.generation` plus status `observedGeneration` | RFC 0018 generation is an owner-defined revision of the active object, not a desired-state counter maintained by an API server. |
| Subject `parentRef` | Owner/dependent or workload hierarchy | RFC 0018 hierarchy expresses diagnostic lifetime and correlation only. It does not imply garbage collection, placement, or authorization. |
| `(subjectRef, condition.type)` | Condition type on one object | RFC 0018 makes the subject explicit because one Gateway result aggregates independently owned runtime objects. |
| `status`, `reason`, `message` | Kubernetes condition fields | RFC 0018 adds `requirement` so advisory degradation remains visible without removing traffic. |

Kubernetes `resourceVersion` is intentionally not an analogue for RFC 0018
generation. It is an opaque API-server concurrency and watch token. RFC 0018
has no object store or watch protocol in v1.

Kubernetes also validates the separation among startup, readiness, and
liveness. OpenClaw's shallow health/liveness surface answers whether the
process can respond. Canonical readiness answers whether the selected runtime
facts permit new work. Restart, retry, grace-period, and traffic-routing policy
remain host responsibilities.

## Application Framework Mapping

ASP.NET Core and Spring Boot show that reusable, owner-registered checks are a
normal application framework facility. Their filtering, tags, health groups,
contributors, and nested components are close to RFC 0018 criteria, selectors,
providers, and subjects.

RFC 0018 is intentionally stricter at the plugin boundary:

- registration is activation-scoped and enumerable;
- configured unknown criteria fail closed;
- provider work is observational and cancellation-aware;
- per-provider and outer deadlines bound response time even when a callback
  ignores cancellation;
- cardinality, strings, relationships, and output are bounded;
- malformed or incomplete output becomes structured `Unknown`; and
- one reconciled identity package makes object replacement visible.

Those constraints are necessary because OpenClaw plugins are a broader and more
dynamic extension surface than ordinary application-local dependency injection.

## Container and Service-Manager Mapping

Docker and systemd consume a small answer and own the reaction. That is the
correct boundary for OpenClaw too:

```text
OpenClaw owners and plugins -> canonical current-state conditions
                            -> one bounded ready decision
Docker / Kubernetes / systemd -> polling, retries, routing, restart, rollout
```

The host does not need to understand every OpenClaw subsystem to decide whether
to send work. OpenClaw does not need to own container IDs, restart policy, probe
cadence, or deployment history. Detailed authenticated or local output explains
the same decision used by the compact probe; it must not become a second result.

## Telemetry Mapping

OpenTelemetry's `service.instance.id` supports the RFC's choice of opaque
incarnation IDs. It also highlights an integration rule: identity is useful
only when its producer and lifetime are unambiguous. A host correlation value
may add an optional fingerprinted host subject, but it cannot replace the
Gateway-generated serving-incarnation identity.

Signals, logs, and support bundles may preserve bounded subject IDs and
generations for diagnostic joins. Metrics may use bounded dimensions such as
condition type, status, requirement, reason, and subject kind. Dynamic IDs,
generations, node references, messages, and related-subject lists must not
become metric labels.

## Gap Assessment

### Required for v1

- **Atomic observation binding.** Every emitted condition and related subject
  must resolve against one reconciled evaluation snapshot. If an owner or
  plugin activation changes during evaluation, generation fencing must discard
  the late result or fail the evaluation closed rather than mix lifetimes.
- **Lifecycle replacement proof.** Conformance must prove stable identity
  across repeated polls and changed IDs across process, Gateway, plugin, node,
  and owner-resource replacement at their documented renewal boundaries.
- **Incomplete-result diff safety.** Consumers must not infer success,
  deselection, or deletion from an absent condition when
  `ReadinessEvaluationComplete` is `False` or `Unknown`.
- **Projection consistency.** `/ready`, `/readyz`, authenticated health/status,
  and the optional CLI must expose the same observed decision and identity.

### Deliberately host-owned

- probe cadence, timeout, retry threshold, startup grace period, and restart;
- traffic removal, draining orchestration, rollout, and rollback;
- retained history, fleet indexing, alerting, and tenant routing; and
- authorization identity, workload placement, and control-plane resource IDs.

### Deferred until a transport requires them

- `lastTransitionTime`, because OpenClaw does not retain readiness history;
- a `resourceVersion`, ETag, monotonic sequence, or watch cursor, because v1 is
  a current polling contract rather than a list/watch API;
- a condition freshness TTL, because synchronous evaluation is bounded and an
  incomplete evaluation already fails closed; stored projections must apply
  their own staleness policy; and
- a generic lifecycle phase, because explicit conditions describe startup,
  serving, degradation, and drain without creating an ambiguous state machine.

If OpenClaw later adds cached remote reads, a readiness watch, or retained
transition events, that transport should define cursor, freshness, and
transition semantics without changing the meaning of the v1 current result.

## Validation Consequences

The implementation and release proof should include this matrix:

| Transition | Expected identity behavior | Expected decision behavior |
| --- | --- | --- |
| Repeated poll, no owner change | Same refs, IDs, and generations | Same condition keys; timestamps may advance. |
| Condition failure and recovery | Same subject ID and generation unless the owner revised | Required `200 -> 503 -> 200`; advisory remains `200`. |
| Config revision in one Gateway lifecycle | Same Gateway ID; changed config generation | Conditions bind to the new reconciled generation only. |
| Gateway dispose and restart in one process | New Gateway ID; stable process ID | No late condition from the prior Gateway appears. |
| Process or container replacement | New process ID; host identity follows its documented boundary | Host decides restart and routing behavior. |
| Plugin reload or node replacement | New owner ID or generation according to that owner's contract | Late provider output is discarded or represented as incomplete. |

The exact packaged container restart matrix remains a landing proof item. Unit
tests establish the schema and generation fences but do not replace that host
integration evidence.

## Primary Sources

- [Kubernetes object names and UIDs](https://kubernetes.io/docs/concepts/overview/working-with-objects/names/)
- [Kubernetes API concepts and `resourceVersion`](https://kubernetes.io/docs/reference/using-api/api-concepts/)
- [Kubernetes API conventions for conditions and generations](https://github.com/kubernetes/community/blob/main/contributors/devel/sig-architecture/api-conventions.md)
- [Kubernetes liveness, readiness, and startup probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/)
- [Dockerfile `HEALTHCHECK`](https://docs.docker.com/reference/dockerfile/#healthcheck)
- [systemd service notification protocol](https://www.freedesktop.org/software/systemd/man/latest/sd_notify.html)
- [ASP.NET Core health checks](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks)
- [Spring Boot Actuator endpoints and Kubernetes probes](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html#actuator.endpoints.kubernetes-probes)
- [OpenTelemetry service resource conventions](https://opentelemetry.io/docs/specs/semconv/resource/service/)

