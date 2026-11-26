---
ddx:
  id: US-063
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-063: Record an erratum

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: HST-03
**PRD Requirements**: FR-42
**Priority**: P1

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to record each error found with its date, cause, and fix
**So that** I can show a publisher what went wrong and how it was corrected.

## Context

Margit wants a record she can show. An erratum is separate from a changelog entry: it explains an error.

## Walkthrough

1. A wrong page locator is found.
2. Margit records an erratum.
3. Margit adds the cause and, after correcting the error, the fix.
4. The register shows the dated entry.

## Acceptance Criteria

- [ ] **US-063-AC1** — Given a found error, when it is recorded, then the errata register holds its date, cause, and fix.
- [ ] **US-063-AC2** — Given an error whose cause or fix is not yet known, when it is recorded, then the missing part shows as open.

## Edge Cases

- **Fix reverted**: The original entry stays; a new entry records the reversal.
- **Taken-over project**: The register exists from setup (FR-1).

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Full entry | US-063-AC1 | Date 2027-03-02, cause 'OCR page offset', fix 'repointed to p. 44' | Record | Entry holds all three |
| Open | US-063-AC2 | Cause unknown | Record | Cause shown as open |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: HST-03
- **PRD Requirements**: FR-42
- **External**: FEAT-001 register creation.

## Out of Scope

- Automatic error detection.
- Publisher errata sheets.
