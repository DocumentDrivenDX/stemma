---
ddx:
  id: US-005
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-001
    - stemma.prd
---

# US-005: Find two documents with one identity

**Feature**: FEAT-001 — Workspace and governance
**Feature Requirements**: DOC-02, DOC-03
**PRD Requirements**: FR-4
**Priority**: P1

## Story

**As a** Priya, the technologist-researcher,
**I want** to detect copies of a project document that declare the same identity
**So that** I can keep one authoritative version after branching or copying files.

## Context

Copying files in a git repository can leave two documents claiming to be the same one. Each document has one canonical location.

## Walkthrough

1. Priya copies the decision log into a drafts folder.
2. Priya runs the project checks.
3. Stemma reports one identity at two locations.
4. Priya removes the copy, and the check passes.

## Acceptance Criteria

- [ ] **US-005-AC1** — Given two documents that declare the same identity, when the check runs, then it fails and names both locations.
- [ ] **US-005-AC2** — Given every document declares a distinct identity, when the check runs, then it reports no duplicate.

## Edge Cases

- **A document declares no identity**: It is reported as unchecked rather than assumed unique.
- **Which copy is canonical is unclear**: Stemma reports both and does not delete or choose one.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Duplicate | US-005-AC1 | Decision log copied to a drafts folder | Run check | Fail naming both paths |
| Clean | US-005-AC2 | Copy removed | Run check | No duplicate reported |

## Dependencies

- **Stories**: US-001.
- **Feature Spec**: FEAT-001 — Workspace and governance
- **Feature Requirements**: DOC-02, DOC-03
- **PRD Requirements**: FR-4
- **External**: Document identity form belongs to Contract artifacts.

## Out of Scope

- Merging document contents.
- Detecting duplicate bibliography works (FEAT-003).
