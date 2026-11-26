---
ddx:
  id: US-042
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-004
---

# US-042: Review search coverage

**Feature**: FEAT-004 — Research and Discovery
**Feature Requirements**: COV-01, COV-02
**PRD Requirements**: FR-18
**Priority**: P1

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to review what has been searched and decided by language, period, and region
**So that** I can name the gaps in my literature coverage before a chapter is finished.

## Context

Coverage bias is invisible without a log. Idris wants to see which languages, periods, and regions were never searched, and what was declined.

## Walkthrough

1. Idris asks for a coverage review of one chapter topic.
2. The system gathers the logged searches and admission decisions.
3. It groups them by language, period, and region, with unknown values separate.
4. Idris sees no search recorded in one language and directs a new search.

## Acceptance Criteria

- [ ] **US-042-AC1** — Given completed searches and decisions, when the log is reviewed, then each search and decision appears.
- [ ] **US-042-AC2** — Given logged items with and without language, period, and region values, when coverage is grouped, then items lacking a value count as unknown.

## Edge Cases

- **Searches made outside Stemma**: They are absent, and the review states it covers logged searches only.
- **An empty log**: The review says nothing is logged; it does not report full or zero coverage of the literature.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Log review | US-042-AC1 | 2 searches, 1 admission, 1 refusal | Review | All 4 appear |
| Unknown values | US-042-AC2 | 5 candidates, 2 with no language | Group by language | 2 counted as unknown |

## Dependencies

- **Stories**: US-040, US-041.
- **Feature Spec**: FEAT-004 — Research and Discovery
- **Feature Requirements**: COV-01, COV-02
- **PRD Requirements**: FR-18
- **External**: None.

## Out of Scope

- Judging whether coverage is adequate.
- Inferring a missing language or region.
