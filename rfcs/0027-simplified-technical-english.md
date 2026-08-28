---
title: Simplified Technical English for OpenClaw Technical Documentation
authors:
  - Jacqueline Henriksen
created: 2026-07-25
last_updated: 2026-07-29
status: draft
issue:
rfc_pr: https://github.com/openclaw/rfcs/pull/53
---

# Proposal: Simplified Technical English for OpenClaw Technical Documentation

## Summary

OpenClaw will use ASD-STE100 Simplified Technical English for English technical
documentation in its active repositories. Each repository will declare its
source documents, generated documents, and approved OpenClaw terms. Maintainers
will move existing documents to STE in small review sets. A shared check will
help authors find possible errors, but human reviewers will approve the final
text.

## Motivation

OpenClaw has many repositories and many types of technical documentation. This
documentation includes user guides, operator procedures, API references,
specifications, contributor guides, and technical READMEs.

Different authors use different words and sentence structures for the same
concepts. Long sentences can hide conditions, limits, and important actions.
Unstable terminology also makes search and translation less reliable.

OpenClaw needs one writing standard for its English source documents.
ASD-STE100 is an international standard for controlled technical language. It
has writing rules and a controlled dictionary. It also permits approved terms
for a company, an industry, or a subject field.

OpenClaw can use this model and keep its technical names. Terms such as
`Gateway`, `plugin`, `skill`, and `context engine` can remain OpenClaw technical
terms. The OpenClaw term base will define their approved forms and meanings.

The English documentation is also the source for translated documentation.
Clear source text gives the translation system more stable terms and less
ambiguous sentence structure. This RFC does not claim that STE makes a
translation correct. Locale owners must still review translated text.

## Goals

- Use one controlled writing standard for English technical documentation.
- Use the same approved term for the same OpenClaw concept.
- Make procedures, conditions, limits, and results easier to identify.
- Include technical READMEs, contributor guides, specifications, and RFCs.
- Preserve the technical meaning of each document during its conversion.
- Give authors a short OpenClaw STE guide and an approved term base.
- Add useful checks, but do not treat a checker as a human reviewer.
- Keep English source documents and generated translations in the correct
  owner repositories.
- Let each repository complete the change in small, reviewable sets.

## Non-Goals

- This RFC does not change source code, code comments, CLI help, or UI text.
- This RFC does not change commands, identifiers, protocol values, or examples.
- This RFC does not require legal text or license text to use STE.
- This RFC does not rewrite quotations or third-party text.
- This RFC does not require translated documents to use English vocabulary.
- This RFC does not make machine translation a substitute for locale review.
- This RFC does not select a commercial STE checker.
- This RFC does not state that an automated check can certify STE conformance.
- This RFC does not require one organization-wide rewrite pull request.
- This RFC does not use STE work to make unmarked product or API changes.

## Proposal

### Standard

OpenClaw will use ASD-STE100 Issue 9 as the normative language standard. A later
issue does not apply automatically. Maintainers must review and approve a
standard update.

OpenClaw will also keep a shared term base. The term base will contain
approved OpenClaw technical nouns and technical verbs. Each entry will contain:

- the approved term;
- its part of speech;
- one definition;
- permitted forms or aliases;
- terms that authors must not use for the same concept;
- the owner of the term; and
- a short example when the meaning is not clear.

Repository owners can add local terms when a term only applies to one
repository. A local term must not conflict with the shared term base.

The shared author guide will summarize the rules that authors use most often:

- Use approved words and approved OpenClaw terms.
- Use one term for one concept.
- Use American English spelling.
- Use active voice when the agent is known.
- Put a necessary condition before its instruction.
- Put only one instruction in a sentence.
- Use no more than 20 words in a procedural sentence.
- Use no more than 25 words in a descriptive sentence.
- Put only one topic in a paragraph.
- Use no more than six sentences in a paragraph.
- Do not remove necessary articles or other words to make a sentence shorter.

The ASD-STE100 standard remains the authority when the short guide is not
sufficient.

ASD owns the standard and controls its distribution. OpenClaw must link to the
official copy. Shared files must not copy the standard or its dictionary
without permission.

The OpenClaw term base will contain only OpenClaw technical terms. A checker
must use standard data through a permitted license or another permitted method.

### Repository scope

This RFC applies to active repositories in the `openclaw` GitHub organization.
It does not apply to archived repositories. A repository owner can declare that
a repository has no technical documentation.

Each covered repository must declare its documentation paths. The declaration
must identify each path as one of these types:

| Type | Treatment |
| --- | --- |
| English source | Authors and reviewers apply STE. |
| Generated English | Authors change the generator or its source data. |
| Generated translation | The translation workflow updates this output. |
| Third-party or vendored text | The STE check ignores this text. |
| Historical record | The repository owner defines a narrow exception. |

English source includes technical prose in these locations when present:

- `docs/` and other documentation source directories;
- technical sections of `README` files;
- `CONTRIBUTING`, `SECURITY`, and operator procedure files;
- design documents, specifications, and architecture documents;
- RFCs and RFC sidecar documents;
- technical examples and tutorials; and
- repository-owned agent instruction files.

The declaration can exclude nontechnical sections in a mixed file. The
repository owner must give a reason for each permanent exclusion.

The `openclaw/openclaw` repository remains the source for its English product
documentation. The `openclaw/docs` repository remains the publication mirror
and translation owner. Authors must not edit mirrored or translated pages to
satisfy this RFC.

### Shared files and ownership

The OpenClaw organization will keep these shared items in one policy
repository:

- the OpenClaw STE author guide;
- the shared OpenClaw term base;
- the schema for repository declarations;
- the shared checker configuration;
- a reusable CI workflow; and
- a report of repository migration states.

The `openclaw/.github` repository is the proposed owner because the policy
applies to the organization. Its maintainers can select a different owner
before implementation starts.

Each repository keeps a small local configuration file. This file declares:

- English source paths;
- generated paths;
- excluded paths;
- local technical terms;
- the migration state; and
- the repository owner for documentation decisions.

The shared configuration must use a versioned schema. A repository must pin the
shared workflow to a reviewed revision.

### Checker behavior

The shared checker is an author aid. It must not describe its result as
certification or complete STE conformance.

The checker must understand Markdown and MDX structure. It must ignore these
items unless a repository explicitly includes them:

- YAML front matter;
- code fences and inline code;
- commands and command output;
- URLs and file paths;
- API names and protocol literals;
- template syntax;
- tables that contain structured data; and
- quoted or third-party text.

The first checker version must find objective rule violations. It must check
sentence length, paragraph length, forbidden terms, and approved term forms.
It can warn about passive voice, word meaning, and part-of-speech errors.

A checker cannot know the intended technical meaning. It also cannot identify
all valid technical nouns and verbs without a current term base. Therefore, a
reviewer must examine each warning and each changed sentence.

The checker must support a narrow suppression. A suppression must name the
rule, the text range, the reason, and the approving owner. A repository-wide
suppression is not permitted.

The checker must not send repository text to an external service by default.
This rule protects private reports, security procedures, and unpublished
designs. Maintainers must approve any external service before use.

### Review rules

Each conversion pull request must have two types of review:

1. A subject owner must confirm that the technical meaning is correct.
2. An STE reviewer must confirm that the changed prose follows the standard.

One person can do both reviews when that person has both types of knowledge.
Security procedures need review from the applicable security owner.

The pull request must separate these change types in its description:

- language-only changes;
- verified technical corrections;
- term-base changes; and
- generator or translation changes.

A language-only change must not alter a command, default value, limit,
permission, API contract, or safety condition. If a reviewer finds a technical
error, the pull request must mark the correction. Maintainers can also move the
correction to a separate pull request.

Authors can use an AI system to help with a draft. The AI system cannot approve
the technical meaning or STE conformance. Humans remain responsible for the
pull request.

### Rollout

The rollout uses repository states. It does not use one fixed completion date.

| State | Requirement | CI result |
| --- | --- | --- |
| `inventory` | The owner declares source and excluded paths. | Report only. |
| `baseline` | The owner records existing findings and approves local terms. | New findings fail on changed prose. |
| `conversion` | Maintainers convert bounded document sets. | Changed prose must pass. Existing findings remain visible. |
| `complete` | No unapproved finding remains in the declared source. | All declared source must pass. |

The implementation starts with these foundation tasks:

1. Publish the shared author guide and term-base format.
2. Select or make the checker and test it against real OpenClaw documents.
3. Define the repository declaration and migration report.
4. Run a pilot in `openclaw/openclaw` and one smaller repository.
5. Adjust the rules from the pilot results.

After the pilot, repository owners add their declarations. They then convert
documents by owner or topic. A pull request should contain one reviewable
document set, not an arbitrary number of files.

### Contributor adoption and ClawSweeper

The migration must also reach contributors who change code, configuration, and
documentation. Maintainers should publish the short author guide, examples,
and term base before the first pilot. During the first weeks, contributors and
AI-assisted contributors can use these materials to prepare new prose. Review
comments should teach the rule and point to the guide instead of treating an
old document as a reason to block unrelated work.

ClawSweeper should adopt this rule in stages. In `inventory` and `baseline`, it
reports these cases without blocking a pull request:

- the pull request changes declared English source documentation; or
- the pull request changes a command, configuration value, API, permission,
  safety condition, operator workflow, or other user-facing behavior that
  needs a documentation decision.

For the second case, the pull request must either update the applicable source
documentation or state why no documentation change is needed. A missing
decision is a review finding, not an automatic product failure.

After the pilot, maintainers can make ClawSweeper required for these cases. A
required check must be source-aware, must understand generated-document
boundaries, and must allow a narrow owner-approved disposition. It must not
block unrelated code changes, require manual edits to generated translations,
or claim that a passing check proves full STE conformance.

For `openclaw/openclaw`, authors change English pages under `docs/`. The normal
documentation workflow then copies the pages to `openclaw/docs`. Translation
jobs update locale output after the English changes merge.

Generated documentation needs a source-first change. Maintainers must not edit
generated files alone. The applicable generator check must show that generated
output agrees with its source.

New or changed source prose must follow STE after a repository enters
`baseline`. This rule prevents new findings while maintainers convert old text.

### Completion and evidence

The organization migration is complete when:

- each active repository has a scope declaration or a no-documentation
  declaration;
- each covered repository has an approved technical term list;
- each covered repository has reached the `complete` state;
- shared CI checks all declared English source paths;
- generated documents come from compliant sources or generators;
- the documentation publication flow still works; and
- locale workflows have processed the changed English source.

The migration report must show the source revision, checker revision, term-base
revision, repository state, finding count, and approved suppressions. It must
not state that zero findings prove STE conformance.

## Rationale

### Why use ASD-STE100

A local style guide can ask for clear prose. It cannot give OpenClaw a complete
controlled language without another large design effort. ASD-STE100 already
defines writing rules, approved general words, and a model for technical terms.

OpenClaw still needs its own term base. The standard does not contain product
terms such as `Gateway`, `plugin`, or `skill`. A shared term base keeps these
terms stable across repositories.

### Why cover all repositories

Users often start with a repository README, not the product documentation site.
Contributors also use specifications, agent instructions, and local guides.
If this RFC covers only the primary documentation site, inconsistent technical
language remains in other entry points.

A declared-scope model makes the organization-wide rule practical. It also
shows which files are source, generated output, or third-party text.

### Why use phased conversion

One large rewrite would make technical review difficult. It would also create
many merge conflicts while product work continues.

Small document sets keep one owner and one topic in view. Changed-prose checks
prevent new violations while existing documents move through review.

### Why require human review

The official STE guidance states that checker tools are aids. A checker cannot
confirm that a sentence has the intended meaning. This limit is important for
commands, permissions, limits, security instructions, and API contracts.

The subject owner protects technical meaning. The STE reviewer protects the
language standard. This split also makes AI-assisted drafts safer to review.

### Why preserve the current translation flow

The `openclaw/openclaw` repository owns the English product documentation. The
`openclaw/docs` repository mirrors that source and makes locale output.

If authors edit both repositories, they create two English sources. If authors
edit locale output by hand, they also conflict with the translation workflow.
A source-first conversion keeps the current owner boundary.

## Unresolved questions

- Which team will own the shared policy files and reusable workflow?
- Which checker can support Issue 9 and an OpenClaw term base?
- Who can approve a repository-wide `complete` state?
- How will maintainers schedule repositories that have no regular docs owner?
- Should public package API comments join the scope in a later RFC?

## References

- [ASD-STE100 Simplified Technical English, Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)
- [Official ASD-STE100 FAQ](https://www.asd-ste100.org/STE_faq.html)
- [Official guidance for STE software](https://www.asd-ste100.org/software.html)
- [OpenClaw documentation publication and translation flow](https://github.com/openclaw/docs#readme)
- [RFC 0024: Localization Runtime and Product Coverage](0024-localization-runtime-and-coverage.md)
