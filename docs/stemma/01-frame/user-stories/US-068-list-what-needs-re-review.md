---
ddx:
  id: US-068
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-068: List what needs re-review after a change

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: HST-04
**PRD Requirements**: FR-47
**Priority**: P1

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to see what needs re-review when my thesis, a construct, the methodology, or evidence changes
**So that** I do not leave chapters, claims, or registers resting on an outdated basis.

## Context

Registers drift. This list turns a change into a bounded set of things to reread; it judges none of them.

## Walkthrough

1. Idris revises a construct's definition.
2. Idris runs the re-review check.
3. It lists the chapters, claims, and registers affected.
4. Idris works through them.

## Acceptance Criteria

- [ ] **US-068-AC1** — Given a changed thesis, when the check runs, then it lists the chapters, claims, and registers that need re-review.
- [ ] **US-068-AC2** — Given a changed construct, when the check runs, then it lists the chapters, claims, and registers that need re-review.
- [ ] **US-068-AC3** — Given a changed methodology, when the check runs, then it lists the chapters, claims, and registers that need re-review.
- [ ] **US-068-AC4** — Given changed evidence, when the check runs, then it lists the chapters, claims, and registers that need re-review.
- [ ] **US-068-AC5** — Given unchanged records and tool versions, when the check runs twice, then the lists are identical.

## Edge Cases

- **Item with no recorded dependency**: It cannot be derived; the list says only recorded links were followed.
- **Change reverted**: The list reflects the current state against the last reviewed state.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Thesis | US-068-AC1 | Thesis edited; 3 chapters specified from it | Check | Lists the 3 chapters and linked items |
| Construct | US-068-AC2 | Construct used by chapters 2 and 5 | Check | Lists them and its claims and register |
| Methodology | US-068-AC3 | Methodology revised | Check | Lists dependents |
| Evidence | US-068-AC4 | Note changed under 2 claims | Check | Lists both claims and their chapters |
| Repeat | US-068-AC5 | Same state | Check twice | Identical |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: HST-04
- **PRD Requirements**: FR-47
- **External**: FEAT-001, FEAT-005, FEAT-011 records. Interface surface belongs in Contract artifacts.

## Out of Scope

- Deciding whether an item is still valid.
- Source-change flags (FR-10, FEAT-002).
