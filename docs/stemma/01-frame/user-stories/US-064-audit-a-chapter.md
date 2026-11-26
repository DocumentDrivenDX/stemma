---
ddx:
  id: US-064
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-064: Audit a chapter

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: REV-01, REV-02, REV-03, REV-05
**PRD Requirements**: FR-43
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to audit a chapter, with rival readings before citation repair
**So that** I challenge the argument before polishing its citations and can tell what is established from what is only suspected.

## Context

Citation errors pass a quick check and fail on a close read. Repairing citations first would bias the rival readings.

## Walkthrough

1. Idris requests an audit of chapter 4.
2. The assistant produces rival readings first.
3. It then looks for citation problems and offers repairs.
4. Each finding is marked confirmed or suspected.
5. Idris chooses which repairs to make.

## Acceptance Criteria

- [ ] **US-064-AC1** — Given a chapter, when an audit runs, then rival readings are completed before citation repair starts.
- [ ] **US-064-AC2** — Given audit findings, when they are reported, then each is marked confirmed or suspected.
- [ ] **US-064-AC3** — Given a proposed repair, when the author has not chosen it, then the manuscript and ledger are unchanged.
- [ ] **US-064-AC4** — Given a failing scripted result, when the audit discusses it, then the result is reported as the script gave it and no annotation is recorded unasked.
- [ ] **US-064-AC5** — Given a rival reading from an audit, when the audit records it, then it is a claim related to the claim it answers, in effect and marked unreviewed.

## Edge Cases

- **Source that could not be examined**: The audit lists it as not examined.
- **No findings**: The audit says what it examined; it does not certify the chapter.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Order | US-064-AC1 | Chapter with one weak citation | Audit | Rival readings precede repairs |
| Marks | US-064-AC2 | One wrong page and one doubtful reading | Audit | Every finding marked |
| Choice | US-064-AC3 | Repair proposed | Do nothing | No change |
| Honest result | US-064-AC4 | Failing page check | Audit | Shown as fail |
| Rival record | US-064-AC5 | Audit producing 1 rival reading | Inspect the ledger | Unreviewed claim with a rival-reading relation |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: REV-01, REV-02, REV-03, REV-05
- **PRD Requirements**: FR-43
- **External**: FEAT-007 results; the assistant's hosted model.

## Out of Scope

- Fresh-context review (US-065).
- Automatic repair.
