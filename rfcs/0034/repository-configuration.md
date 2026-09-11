# Repository configuration and CredentialGatewayDriver

Proposed configuration and ownership for [RFC 0034](../0034-github-app-credentials.md).
The current public Agent create/update API has no repository field, and the
current Driver capability list has no credential gateway. The shapes below are
proposals, not existing endpoints or released capabilities. Existing internal
credential selection contains `repository { profile, binding, grant }`; it does
not expose this administrator workflow or establish production access.

## Administrator workflow

1. An Installation operator selects the credential gateway implementation and
   protected storage. A Namespace administrator enrolls an exact GitHub App
   installation and verifies its organization, repositories, and permissions.
2. The administrator selects repository access on an Agent using the typed
   structure below. Repository selection is platform configuration, separate
   from model instructions or repository-supplied files.
3. OCC authenticates the administrator and authorizes the exact Namespace,
   Agent create/update, selected Configuration, integration binding, broker,
   and referenced Secret. Permission to edit the Agent alone cannot grant use
   of another binding. Cross-Namespace or unresolved references deny admission.
4. A separately authorized deployment resolves the checkout ref to a full
   commit OID, verifies repository identity and scope, and freezes the draft
   selection and referenced generations into `AgentRevision`. Saving the draft
   does not admit or activate a revision. Independently authorized withdrawal
   can deny current access immediately without deploying the draft.

This is native, admin-managed OCE configuration. Entra integration and personal
GitHub ACL synchronization are not prerequisites. User/channel allowlists
authorize invocation separately; they neither confer repository permission nor
lend the requester's GitHub credentials to the Agent.

## Proposed typed Agent selection

Propose an optional `repositoryAccess: AgentRepositorySelection` property on
both Agent create and update requests. This field does not exist in the current
public API. Omission on create selects no repository access; omission on update
preserves the draft selection. Supplying `repositoryAccess` replaces the full
draft selection with its `repositories` array; an empty array selects no
repository access. Saving changes only the draft and grants no new authority.
A separately authorized deployment freezes it into a new immutable revision
before activation. A repository with publication `disabled` selects eligible
reads only. Independently authorized withdrawal can deny removed or restricted
grants on active Work immediately, without activating the draft. Serving
changed permissions requires the fresh Pod/gVisor boundary.

```ts
type AgentRepositorySelection = {
  schemaVersion: 1;
  repositories: Array<{
    bindingRef: OccReference;
    repositoryId: number;
    checkoutRef: string;
    readProfile: "checkout" | "views";
    publication:
      | { mode: "disabled" }
      | {
          mode: "human-approval";
          approverRefs: PrincipalReference[];
          refs: Array<{
            baseRef: string;
            targetRef: string;
            allowCreate: boolean;
          }>;
          approvalLifetime: Duration;
        };
  }>;
};
```

Field names are illustrative. References and durations need validated codecs;
lists, refs, and inputs need finite profile limits. Reject unknown versions,
unsupported fields, missing policy, empty approver sets for publication, and
ambiguous repository selections. Publication must be explicitly disabled or
configured. Stage A admits `checkout` with publication `disabled`; stage B adds
`views` and `human-approval`.

The admitted revision retains the binding generation, GitHub App/installation
identity, canonical repository name and ID, resolved commit, read profile,
publication policy, and policy generation. IDs govern authority; names aid
review and cannot redirect access. Public resources contain references and safe
metadata, never signing keys or tokens. The [GitHub access record](github-app-v1-spec.md#admitted-data)
derives from this selection.

Effective access is the intersection of current OCC/IAM service authority,
the admitted Agent revision, the original Work selection, applicable restrictions,
and the App installation's available repository permissions. The gateway
requests one repository and an exact supported permission subset. It denies
unsupported intersections; it cannot fall back to installation-wide access.

Each runtime repository operation still needs genuine original Work, its current
assignment and operation authority. Preparation is separately admitted; cleanup
uses independently retained platform authority after Work or assignment closure.
Configuration, admission snapshots, and successful enrollment are ceilings, not
reusable authorization decisions.

## Proposed CredentialGatewayDriver

The proposal adds `credential_gateway` to the Driver capability registry, with
`CredentialGatewayDriver` as its interface. The Installation selects its
implementation through the Driver model. Selection names an implementation; only trusted composition can supply the admitted
Work, IAM, inventory, custody, and runtime handles required to serve requests.
Configuration strings or reconstructed objects cannot manufacture those handles.

| Owner | Responsibility |
| --- | --- |
| OCC/IAM | Sole platform authorizer for configuration, work admission, current operations, withdrawal, and independently authorized cleanup. GitHub also enforces provider permissions. |
| `CredentialGatewayDriver` | Hosts protocol mediation and composes the broker and provider issuers; consumes admitted handles, enforces exact operations, and owns startup, quiesce, recovery, and disposal of this capability. |
| `SecretBroker` and issuer | Broker retains leases, protected custody, durable inventory and cleanup obligations; issuer performs exact authorized GitHub issuance/revocation. |
| `SecretDriver` | Backend secret storage. |
| `ServiceAccountDriver` | Service-account provisioning and its existing credential contract; no expansion into general GitHub mediation. |
| Compute and SandboxDriver | Execution, safe checkout and termination observations; network/runtime containment and protected origin attachment. |

The proposed Driver offers these narrow local operations:

- **Admit access:** consume OCC's exact admitted selection and assignment,
  returning an opaque access reference. It cannot create Work or widen a grant.
- **Mediate:** consume current operation authority and protected origin; validate
  the canonical provider request, acquire an eligible credential, and dispatch.
- **Close and recover:** close local access, retain unresolved effects and
  credential obligations, and run cleanup under separate current authority.
- **Quiesce/dispose:** stop new calls and join bounded work while preserving
  durable records. Process shutdown does not mean provider revocation.

The [broker operations](credential-broker-v1-spec.md#broker-operations) and
[issuer ports](credential-broker-v1-spec.md#issuer-interface) supply the detailed
contracts. This capability adds no public Token, Lease, Issuer, or gateway
resource. The credential gateway is separate from the Agent's messaging
gateway. A deployment may cohost broker and mediator outside Agent execution;
process layout does not change authority or custody boundaries.

## Publication modes and delivery

Stage B uses explicit human approval. Any configured, currently authorized human,
including the requester, may approve; an Agent or its helper cannot self-approve.
For this new approval operation, OCC calls the selected IAM Driver with the
human principal, existing `operate` action, and the exact Agent resource,
including its Installation and Namespace. It also requires membership in the
revision's configured human approver list and current candidate/repository
policy. This mapping is proposed, not an existing approval endpoint. Neither
Agent invocation permission alone nor list membership alone suffices. Each
publication effect rechecks this approval's current eligibility alongside the
Agent's own Work and repository authority.

Later revisions may add two separately selected modes: independent-human
approval, or scoped automatic authorization under current policy. Automatic
authorization would record a decision for the exact candidate and effects,
without requiring a human approval for each operation. Neither later mode is
enabled in the MVP, and absent policy never selects automation.

All modes retain the same exact repository/ref/object constraints, current Work
and IAM checks, durable push/PR effects, and handling of unknown outcomes.
See [trusted publication](github-app-v1-spec.md#trusted-publication).

Stage A qualifies mediated metadata and clone/fetch first; B qualifies the
coding workflow and publication. Broader durable Work and separately admitted
children, together with Stop task / Stop Agent / Start Agent controls, follow
in C. Root Work and operation authority are prerequisites from A; the broader
features are not. [Acceptance](lifecycle.md#acceptance-matrix) must prove the
selected stage through genuine owners and runtime integration.
