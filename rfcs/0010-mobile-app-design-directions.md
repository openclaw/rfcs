---
title: OpenClaw Mobile App Design Directions
authors:
  - OpenClaw maintainers
created: 2026-07-04
last_updated: 2026-07-04
status: draft
issue:
rfc_pr:
---

# Proposal: OpenClaw Mobile App Design Directions

## Summary

Create a lightweight design-direction RFC for the OpenClaw mobile apps so contributors can share early iOS and Android product/design directions as reviewable PR comments before anyone spends time turning an idea into a full app implementation.

## Motivation

OpenClaw now has mobile surfaces on both iOS and Android, and the apps need a clearer shared direction without flattening them into the same UI. Volunteers have useful ideas at different levels of fidelity: rough sketches, screenshots, written concepts, app references, platform-specific ideas, and stronger product visions. Asking for a full app PR too early raises the cost of contribution and can push people to build before there is alignment.

This RFC gives the project a lower-pressure place to compare directions. The goal is to make good ideas visible early, gather feedback in one place, and decide which direction or directions deserve prototyping or implementation.

## Goals

- Give volunteers a clean place to share one mobile design direction per top-level PR comment.
- Encourage broad, rough, and early ideas, not only polished mocks or implementation plans.
- Align the iOS and Android apps where shared product behavior, language, structure, or feature expectations help users.
- Preserve platform-specific navigation, controls, motion, system integrations, and visual patterns where they make each app feel native.
- Keep discussion separate from implementation until a direction is selected for prototype or build work.
- Capture open questions and tradeoffs before maintainers ask contributors to invest in a full app PR.

## Non-Goals

- This RFC does not select a final mobile app design.
- This RFC does not require contributors to build the direction they propose.
- This RFC does not define a full mobile roadmap, release plan, or implementation milestone.
- This RFC does not require iOS and Android to use identical layouts or interaction patterns.
- This RFC does not replace focused bug reports, feature requests, or implementation PRs after a direction is chosen.

## Proposal

Use this draft RFC PR as the collection point for possible OpenClaw mobile app design directions across iOS and Android.

Each top-level PR comment should describe one possible direction for the mobile app. Replies to that comment should hold discussion, critique, questions, and refinements for that direction. If a direction changes materially, the original top-level comment should be updated so the latest version is easy to find.

A design direction can be broad, specific, polished, rough, practical, experimental, native-first, chat-first, dashboard-first, agent-first, or something else entirely.

### OpenClaw context

The mobile apps are part of the OpenClaw system. They should make it easier to connect to a user's Gateway, work with agents, and handle mobile-native workflows without making the phone app feel like a copy of the desktop or web surface.

A good direction might align iOS and Android around shared ideas such as:

- First-run setup and pairing
- Chat, voice, and agent interaction
- Gateway and node status
- Approvals and controls
- Settings and diagnostics
- Mobile-specific notifications, shortcuts, and system integrations
- The overall feeling of what OpenClaw on a phone should be

It is also fine for a direction to argue that a feature should look or behave differently on iOS and Android when platform conventions or user expectations are different.

### What a direction can include

A direction may include:

- A high-level concept for the app
- New screen ideas
- Navigation or information architecture ideas
- Interaction patterns
- Visual design references
- Platform-specific ideas for iOS or Android
- Sketches, screenshots, mocks, links, or written descriptions
- Tradeoffs or open questions

Posting a direction does not commit anyone to building it, and discussion does not mean the direction has been selected. This is a place to explore, compare, and refine ideas before choosing what should move forward.

Contributors should avoid mixing multiple unrelated directions in one top-level comment. If someone has several different ideas, they should post them separately so each one can be discussed and compared cleanly.

### Suggested comment template

Contributors can take the format wherever it needs to go. This template is only a starting point, not a requirement.

```md
## Direction Name

### Core Idea

What is the overall design direction?

### New Designs Or Screens

What screens, flows, navigation, or interaction ideas are part of this direction?

### Why This Direction

What user need, product goal, or app identity does this improve?

### Shared Mobile Direction

What should feel aligned across iOS and Android?

### Platform Notes

How should this direction work across iOS and Android? What should be shared, and what should stay platform-specific?

### References

Mocks, sketches, screenshots, apps, patterns, links, or inspiration.

### Tradeoffs

What gets better, worse, simpler, or more complex?

### Open Questions

What needs feedback or a decision?
```

### Expected outcome

After directions have been collected and discussed, maintainers can compare them and decide which direction or directions should move into prototype, implementation, or further exploration.

The best outcome is not that everyone writes a perfect spec. The best outcome is that good mobile ideas become visible early enough that volunteers can help shape the app before time is spent building the wrong thing.

## Rationale

The main alternative is to ask contributors to open implementation PRs or detailed design specs for each direction. That produces more concrete artifacts, but it is too expensive for early mobile design alignment and may waste contributor time if the project chooses a different direction.

Another alternative is to keep the discussion in the main OpenClaw issue tracker. That works mechanically, but the RFC repo already defines the project's longer-form design proposal process. A draft RFC PR is a better fit because it keeps the proposal explicitly in draft status, makes review visible, and avoids treating early design exploration as an accepted implementation issue.

This RFC also avoids forcing iOS and Android into identical product surfaces. Shared direction is useful when it reduces confusion, but the apps should still use native patterns when platform-specific behavior produces a better mobile experience.

## Unresolved questions

- Should accepted mobile design directions become one implementation issue, multiple platform-specific issues, or separate follow-up RFCs?
- How long should this draft remain open for initial direction gathering before maintainers summarize and choose next steps?
- Should there be a separate visual sidecar folder for sketches and screenshots if contributors want to attach durable references?
- Who should own the final summary of submitted directions and the recommendation for what moves forward?
