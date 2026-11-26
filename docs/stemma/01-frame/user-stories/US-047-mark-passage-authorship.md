---
ddx:
  id: US-047
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-006
---

# US-047: Mark who wrote each passage

**Feature**: FEAT-006 — Composition
**Feature Requirements**: AUTH-01, AUTH-02
**PRD Requirements**: FR-27
**Priority**: P1

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to mark which passages were AI-drafted, human-written, or edited
**So that** I can show for any version what I declared about who wrote it.

## Context

Margit's reputation depends on an honest account. The marks are declarations kept with each version; they do not detect authorship.

## Walkthrough

1. Margit marks two passages as human-written and one as AI-drafted.
2. Margit edits the AI-drafted passage and marks it edited.
3. Margit saves the new version.
4. Margit opens the earlier version and sees its original marks.

## Acceptance Criteria

- [ ] **US-047-AC1** — Given a passage, when the author marks it, then it records AI-drafted, human-written, or edited.
- [ ] **US-047-AC2** — Given two versions with different marks, when the earlier version is read, then its own marks are shown unchanged.

## Edge Cases

- **Unmarked passage**: It shows as unmarked, never as human-written by default.
- **Marked passage changes without a new mark**: The new text is not presented as carrying the earlier mark with certainty.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Mark | US-047-AC1 | Paragraph 3 | Mark AI-drafted | Record shows AI-drafted |
| History | US-047-AC2 | Version 1 AI-drafted, version 2 edited | Read version 1 | Shows AI-drafted |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-006 — Composition
- **Feature Requirements**: AUTH-01, AUTH-02
- **PRD Requirements**: FR-27
- **External**: None.

## Out of Scope

- Detecting AI-written text.
- Disclosure generation (US-066).
