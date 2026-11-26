---
ddx:
  id: US-043
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-004
---

# US-043: Search the corpus first and report gaps

**Feature**: FEAT-004 — Research and Discovery
**Feature Requirements**: CORP-01, CORP-02, CORP-03
**PRD Requirements**: FR-19
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to ask a question of my own stored corpus first
**So that** I learn what my sources hold and what they lack before anything outside is searched.

## Context

Margit's collection is the starting point of the book. A report that silently skipped unreadable or badly extracted sources would read as absence when it is not.

## Walkthrough

1. Margit asks a question and directs the assistant to search the corpus first.
2. The assistant searches stored sources.
3. It reports what it found with source and locator.
4. It states what the corpus does not contain, which sources it searched, and which it could not search and why.
5. Margit decides whether to allow an outside search.

## Acceptance Criteria

- [ ] **US-043-AC1** — Given a direction to search the corpus first, when the assistant searches, then no outside location is searched before the corpus report.
- [ ] **US-043-AC2** — Given a question the corpus does not answer, when the report is produced, then it states what the corpus does not contain and lists the scope searched and not searched.
- [ ] **US-043-AC3** — Given a statement of absence, when it is reported, then it is limited to the searched corpus and makes no claim about the wider literature.

## Edge Cases

- **Source with no extracted text**: It is listed as not searched, with the reason.
- **Unreadable extraction**: The source is listed as not reliably searched.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Order | US-043-AC1 | Corpus-first direction | Ask about a trade route | Corpus report precedes any outside request |
| Gap | US-043-AC2 | 10 sources, 1 with no extracted text, none answer | Ask | Reports no answer in 9 examined and 1 not examined |
| Bounded absence | US-043-AC3 | Same corpus | Read report | Says the searched sources do not contain it, not that no evidence exists |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-004 — Research and Discovery
- **Feature Requirements**: CORP-01, CORP-02, CORP-03
- **PRD Requirements**: FR-19
- **External**: FEAT-002 extracted text. Interface surface belongs in Contract artifacts.

## Out of Scope

- Outside search (US-040).
- Support for local models.
