---
ddx:
  id: US-040
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-004
---

# US-040: Search within the author's limits

**Feature**: FEAT-004 — Research and Discovery
**Feature Requirements**: SRCH-01, SRCH-02, SRCH-03
**PRD Requirements**: FR-16
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to ask the assistant to search for literature within limits I set
**So that** every result I get is inside those limits and none is mistaken for a source I chose and checked.

## Context

Idris has a large corpus and wants to find what it lacks. A search result that looks like a reference is the main route for invented or misattributed citations, so results must stay visibly apart from sources.

## Walkthrough

1. Idris states a question and limits: which places may be searched, a date range, and languages.
2. The assistant confirms the limits it will apply.
3. The assistant searches and lists candidates, each with where it was found and the details that origin supplied.
4. Idris reads the list and sees that every entry is a candidate that no one has decided on or checked.

## Acceptance Criteria

- [ ] **US-040-AC1** — Given limits set by the author, when the assistant searches, then no search runs outside the limits.
- [ ] **US-040-AC2** — Given a completed search, when results are presented, then each is marked as a candidate and shows where it was found.
- [ ] **US-040-AC3** — Given a manuscript citation that points to an unadmitted candidate, when the corpus checks run, then the citation is reported as unreviewed, and as unchecked while it has no source file.

## Edge Cases

- **A limit cannot be applied by a search location**: The assistant does not search it, or asks first, and says why.
- **No result is found**: The assistant reports the searched scope and returns no filler candidates.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Bounded search | US-040-AC1 | Limits: 1990 to 2010, French and English, one named catalog | Search a topic | Only that catalog is queried with those limits |
| Candidate marking | US-040-AC2 | The search returns 3 works | View results | 3 candidates, each with its origin |
| Citing a candidate | US-040-AC3 | Chapter cites candidate 2 before admission | Run corpus checks | Reported unreviewed and unchecked |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-004 — Research and Discovery
- **Feature Requirements**: SRCH-01, SRCH-02, SRCH-03
- **PRD Requirements**: FR-16
- **External**: Search services chosen in design. Interface surface belongs in Contract artifacts.

## Out of Scope

- Admission (US-041).
- Ranking or judging candidate quality.
