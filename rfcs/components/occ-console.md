# OCC Console

## Summary

The OCC Console is the product-owned browser interface for OpenClaw resources.
It is a server-rendered module in the OCC process, not a separate service,
authority, primitive, integration, or Backend extension point. It reads and
mutates resources only through the same OCC application/API interface used by
other clients and always acts as the verified browser actor.

## Goals

- Present authoritative resource fields, aggregate lifecycle conditions, and
  authorized non-secret evidence without putting the Console on a runtime data
  path.
- Submit every form through the canonical OCC authorization and mutation path.

## Non-goals

- Defining login, callback, logout, or anti-CSRF bootstrap routes. OAG owns them.
- Creating a presentation Adapter or allowing a Backend to add routes, scripts,
  forms, or executable UI.
- Defining Plugin-feed refresh or Channel approval workflows.
- Exposing Backend lifecycle, integration selection, OCC configuration,
  tenant-bootstrap, or audit-export workflows.
- Sending Channel messages, prompts, Plugin payloads, resolved runtime Secret
  values, or other runtime data through OCC.
- Standardizing a visual system or browser framework.

## Module and ingress boundary

The Console and OCC API are strict modules in one process and origin. The
Console owns HTML routes, page models, navigation, and forms. The OCC API owns
resources, authorization, mutations, operation state, integration dispatch,
RuntimeGrants, and audit evidence.

Every Console route follows the canonical
[`browser_session` contract](./access-gateway.md#route-authentication-contract).
OCC verifies the assertion received over the trusted Gateway hop before
invoking a Console handler. A `NoAuth` route cannot target the Console.

Login start, OIDC callback, logout, and anti-CSRF bootstrap remain on OAG's
separate browser-facing surface. The Console receives verified actor context,
not browser credentials, provider tokens, cookies, or a raw actor assertion.

The Console has no independent `PlatformComponentIdentity` or service
principal. It cannot import or call an IAMAdapter, Adapter, or Driver. A route
handler calls only the OCC application/API interface under the initiating
actor, and that interface returns an authorized page model.

## Route authorization

Routes convey navigation, not authority. An `/admin` prefix, visible link,
rendered button, hidden control, or operation ID grants no Permission. OCC
reauthorizes every read and mutation against current committed state.

Collection pages require the ordinary OCC `list` operation on the exact
containing Installation or Namespace. Detail pages require `read` on the exact
committed resource named by the route. Denial or unavailability of either
required operation returns no protected page model.

Rendering the exact entity in its direct successful creation response is part
of that authorized mutation, not a detail-page read. A later navigation,
refresh, or lost-response recovery is an ordinary exact-resource `read`.

A multi-resource summary authorizes each collection panel independently and
omits a denied panel. Parent-owned fields and reference identities may appear
under the required parent read. A referenced-resource expansion is optional,
requires `read` on that exact resource, and is omitted when denied or
unavailable.

Audit routes and detailed authorization, operation, integration, Kubernetes, or
runtime evidence require `openclaw.audit.read` on the exact Installation or
Namespace. When a Namespace-scoped binding lists or reads an
installation-published Harness or Plugin, OCC supplies the session Namespace as
server-owned candidate-consumer context. Browser input cannot override it.
Recorded stale evidence never substitutes for current authorization.

## V1 route families

The v1 Console exposes only route families backed by canonical OCC operations.
Nested tabs and forms do not create new authorization targets.

| Route family | Purpose |
| --- | --- |
| `/` | Authorized Namespace summary of Agents and AgentInstances. |
| `/agents` and `/agents/{agentId}` | Agent authoring, publication, revision browsing, and AgentInstance deployment through canonical OCC APIs. |
| `/agent-instances` and `/agent-instances/{instanceId}` | AgentInstance detail, current Cell summary, lifecycle condition, and lifecycle forms. |
| `/agent-instances/{instanceId}/{plugins,channels,policy}` | Views of the exact resources referenced by the selected AgentRevision; changes use canonical Agent and AgentInstance APIs. |
| `/agent-instances/{instanceId}/activity` | Namespace-scoped authorized audit evidence filtered to the instance. The AgentInstance is a filter, not the audit authorization target. |
| `/admin/namespaces` | Namespace browsing and creation. |
| `/admin/iam` | Principals, ServicePrincipals, Groups, aggregate Group synchronization status, ExternalGroupLinks, AccessBindings, and fixed Role navigation through canonical IAM APIs; GroupMember and ExternalGroupSnapshot contents are excluded. |
| `/admin/restrictions` | Restriction administration and aggregate projection condition. |
| `/admin/plugins` and `/admin/channels` | Plugin browsing plus PluginConnection binding and Channel administration. |
| `/admin/audit` | Installation- or Namespace-scoped audit evidence. |

Fixed Role identifiers are server-defined navigation, not a collection
response. Rendering one Role's fields requires `openclaw.roles.read` on that
exact Role.

## Page model

An authorized resource page contains only OCC fields and aggregate lifecycle,
readiness, and integration conditions permitted by its authorizing creation
result or underlying reads.
Resource reads do not expose operation records.

Detailed authorization, operation, integration, Kubernetes, and runtime
evidence is audit evidence. OCC includes it only after exact
`openclaw.audit.read` authorization on the applicable Installation or Namespace.
Recorded evidence remains bound to its exact target and observation time. The
Console labels stale or incomplete evidence and never presents it as current
authority or effective state.

Apart from IAMAdapter evaluation required by the read, ordinary navigation
dispatches no integration call. An operation ID is correlation data, not
authority, and the Console never resubmits an indeterminate operation.

Page models never contain raw actor assertions, cookies, access or refresh
tokens, provider credentials, Kubernetes credentials, secret values, resolved
configuration secrets, Channel messages, Plugin payloads, provider payloads, or
unescaped provider HTML.

## Mutations

Forms submit ordinary OCC operations under the browser actor. Every unsafe
request must pass OAG's canonical
[Origin and anti-CSRF contract](./access-gateway.md#browser-session) before OCC
invokes a handler; there is no alternate form path.

Each submission follows the canonical IAM
[control-plane request](./iam.md#control-plane-request). External work follows
the [operation-dispatch contract](./integrations.md#operation-dispatch), and
resource reconciliation follows the owning
[primitive lifecycle](./primitives.md). The Console adds no authorization,
commit, dispatch, or reconciliation path of its own.

After an accepted creation, its authorized mutation may return the exact
committed entity directly to the initiating actor. The same commit records that
Principal or ServicePrincipal as immutable creator. Ordinary `create`, Agent
publication creating an AgentRevision, and initial AgentInstance deployment use
this rule; they perform no second `read` request or decision. The response
cannot expand a referenced resource or include audit detail without the
corresponding checks.

After another accepted non-delete mutation, OCC independently authorizes
`read` on the exact resulting resource before the Console renders its page. If
that read denies or is unavailable, the Console returns a non-resource
acknowledgement containing no resource or operation detail. After a delete, OCC
authorizes `list` on the exact containing scope before returning the collection;
otherwise it returns the same acknowledgement.

Until OCC persists a downstream operation, the resulting resource may show only
its current aggregate lifecycle condition and no operation ID or result.
Operation detail requires scoped `openclaw.audit.read`. Creator-read supplies
only the permission-ceiling basis for exact-resource read and does not imply
readiness, reference expansion, audit detail, operation detail, or mutation
authority. Acceptance of any other mutation grants no read authority.

## One-time credential response

A successful ServicePrincipal creation or rotation returns exactly one
non-resource credential receipt as the immediate result of the committed
mutation instead of a resource page. Creation records immutable creator
evidence for a later ordinary read of the exact ServicePrincipal; rotation does
not change its creator. The receipt contains the new secret and no resource or
operation detail, and creator-read never rediscloses that secret. The receipt
is non-cacheable and never retained in a page model, session, or log. Lost
delivery requires another authorized rotation.

## HTML and browser security

The Console returns complete server-rendered HTML. Templates escape all resource
and provider data, form actions remain same-origin, and Backend- or
provider-supplied markup or script never executes.
Browser history, cached HTML, and client-side state never authorize an
operation.

## Representative flows

**Create an AgentInstance.** The form passes Origin and CSRF checks, and OCC
authorizes and commits the exact creation. The Console renders the committed
identity-provisioning state directly under that decision and records the
initiating actor as immutable creator. It performs no second read decision.

**Read an AgentInstance.** Gateway and OAG authenticate the browser, OCC verifies
the actor assertion, and the OCC API authorizes the exact AgentInstance read. An
exact creator match may satisfy the OCC permission ceiling, but the selected
IAMAdapter must still allow. OCC returns permitted fields and aggregate
lifecycle state. A referenced-resource expansion requires its own exact read,
while detailed evidence requires scoped `openclaw.audit.read` before the Console
includes it.

**Update an AgentInstance.** The form passes Origin and CSRF checks, and OCC
authorizes `openclaw.agent_instances.update` on the exact AgentInstance. Adopting
another revision also requires `openclaw.agent_instances.deploy` on that exact
AgentRevision. OCC commits the accepted mutation and reconciliation intent,
then independently authorizes the resulting AgentInstance read. The Console
returns either the AgentInstance page with its aggregate lifecycle condition or
a non-resource acknowledgement. An audit-authorized panel may show detailed
downstream operation evidence after OCC persists it.

**Deny a request.** Failed actor verification, required authorization,
dependency validation, or structural invariants produce no page model, mutation,
or integration dispatch.

## Rationale

Keeping the Console inside OCC removes a second service identity and a
presentation extension point. Using the ordinary OCC application/API interface
keeps browser and automation behavior consistent, while explicit page-state and
sensitive-data boundaries prevent the UI from becoming a parallel authority or
runtime data path.
