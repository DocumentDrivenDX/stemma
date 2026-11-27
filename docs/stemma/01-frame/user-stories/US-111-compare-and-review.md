---
ddx:
  id: US-111
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-111: Compare and review source text

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: VER-01, VER-02, VER-03, VER-04
**PRD Requirements**: FR-88, FR-89
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to see what has been compared with my sources and record my own reviews when I choose
**So that** I know how much of the text rests on a machine and how much someone has verified.

## Context

Recognized text cannot be verified by script. Comparisons and reviews narrow the risk and are tracked; nothing waits for them.

## Walkthrough

1. Margit asks how well her sources are verified.
2. Stemma shows coverage: methods, comparisons with their disagreements and both readings, and pages a person has reviewed.
3. She compares a page with the printed book and records that it agrees.
4. Later the page is corrected, and her earlier review shows as stale.

## Acceptance Criteria

- [ ] **US-111-AC1** — Given another text of a page that differs, when it is compared, then the run records per-page agreement and both readings.
- [ ] **US-111-AC2** — Given a person's review of a page, when it is listed, then who, when, scope, original, digest, and outcome are shown, and after the page changes it shows as stale.
- [ ] **US-111-AC3** — Given a model's flag, when coverage is shown, then it is listed as a flag and not counted as a person's review.
- [ ] **US-111-AC4** — Given recognized text no one reviewed, when checks run, then it appears as a coverage figure and not as a finding.

## Edge Cases

- **A layout-only change**: Reviews stay current.
- **A model asked to correct text**: It records a flag; it does not edit.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Disagreement | US-111-AC1 | Second text with one different word | Compare | Agreement below 100 percent with both readings |
| Stale | US-111-AC2 | Review then edit | List reviews | Shown stale |
| Flag | US-111-AC3 | Model flag on a page | Show coverage | One flag, no reviewed pages |
| Coverage | US-111-AC4 | Recognized text, no reviews | Check | No finding about reviews |

## Dependencies

- **Stories**: US-009.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: VER-01, VER-02, VER-03, VER-04
- **PRD Requirements**: FR-88, FR-89
- **External**: Records (CONTRACT-001); commands (CONTRACT-002).

## Out of Scope

- A recognition engine.
