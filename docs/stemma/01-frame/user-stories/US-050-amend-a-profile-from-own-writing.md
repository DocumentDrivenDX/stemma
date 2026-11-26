---
ddx:
  id: US-050
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-014
---

# US-050: Amend a profile from the author's writing

**Feature**: FEAT-014 — Voice and Style
**Feature Requirements**: AMD-01, AMD-02, AMD-03, PRO-02
**PRD Requirements**: FR-70
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to show the assistant passages I wrote and have it amend the profile, visibly and reversibly
**So that** later drafts sound closer to my writing while quotations and claims stay as they were

## Context

Idris wants AI drafts in a recognizable voice. A change they cannot see, or one that rewrote evidence, would damage the book.

## Walkthrough

1. Idris provides two passages of Idris's own writing.
2. The assistant amends the profile, shows each change, and saves the passages with the project; the change is marked unreviewed.
3. Later drafts follow it; Idris retires one change they dislike when they like.
4. A restyled paragraph keeps its quotation unchanged.

## Acceptance Criteria

- [ ] **US-050-AC1** — Given an example from the author's own writing, when amendment is requested, then each profile change is shown, marked unreviewed.
- [ ] **US-050-AC2** — Given an unreviewed change, when a draft is written, then it applies.
- [ ] **US-050-AC3** — Given a change, when it is made, then the examples behind it are saved with the project, and the author can retire the change.
- [ ] **US-050-AC4** — Given a profile that favors different wording, when text with a quotation is restyled, then the quotation is identical.
- [ ] **US-050-AC5** — Given a profile that favors stronger wording, when a passage stating a hedged claim is restyled, then the claim asserts what it asserted before.

## Edge Cases

- **Example includes quoted text**: The quoted words are not learned as the author's voice, and the author is told.
- **Retired change**: The profile returns to its earlier version.
- **A restyled sentence says more than its claim**: The support record stays current (FR-54), so only the author can catch it.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Show | US-050-AC1 | 2 author passages | Request amendment | Changes shown, unreviewed |
| In effect | US-050-AC2 | Unreviewed 'prefer active voice' | Draft | Preference applies |
| Examples saved | US-050-AC3 | Same | Inspect and retire | Examples in project files; change retired |
| Quotation | US-050-AC4 | Paragraph with a 14-word quotation | Restyle | Quotation text identical |
| Hedge | US-050-AC5 | Claim 'may indicate trade' under a confident voice | Restyle | Hedge kept; recorded claim unchanged |

## Dependencies

- **Stories**: US-049.
- **Feature Spec**: FEAT-014 — Voice and Style
- **Feature Requirements**: AMD-01, AMD-02, AMD-03, PRO-02
- **PRD Requirements**: FR-70
- **External**: The assistant's hosted model; FEAT-007 checks. Interface surface belongs in Contract artifacts.

## Out of Scope

- Learning from third-party writing.
- Scripted proof that meaning is preserved.
