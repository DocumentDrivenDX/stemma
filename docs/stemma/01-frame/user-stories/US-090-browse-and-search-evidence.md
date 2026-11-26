---
ddx:
  id: US-090
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-090: Browse and search the evidence

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
**PRD Requirements**: FR-64
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to search my records and follow links from one record to the next
**So that** I can find any piece of evidence and see what it connects to, including what is still unverified.

## Context

Idris has a corpus of hundreds of articles. The explorer builds on arras, whose search did not match across diacritics in a feasibility test. A support result is a recorded model judgment and must not look like verification.

## Walkthrough

1. Idris opens the explorer on his project.
2. He searches for a transliterated name without its diacritics.
3. He opens a matching record and follows its links to a claim and its source.
4. The record views show which claim and support records are unverified or stale.

## Acceptance Criteria

- [ ] **US-090-AC1** — Given a project graph, when Idris browses it, then he can open each record and follow its links in both directions.
- [ ] **US-090-AC2** — Given records containing a term, when he searches for it, then the matching records are listed and can be opened.
- [ ] **US-090-AC3** — Given a stored name with diacritics, when he searches without them, then the record is found.
- [ ] **US-090-AC4** — Given an unverified, missing, or stale item, when its record view opens, then that state is shown.
- [ ] **US-090-AC5** — Given a support record, when its view opens, then it is presented as a recorded model judgment and not as verification.
- [ ] **US-090-AC6** — Given the explorer source, when its record browser is inspected, then it is built on arras.

## Edge Cases

- **No matches**: The explorer says nothing matched.
- **A record with many links**: All links remain reachable.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Browse | US-090-AC1 | Synthetic graph | Open a source, then a note, then back | Links work both ways |
| Search | US-090-AC2 | Claim containing `irrigation` | Search `irrigation` | Claim listed |
| Folding | US-090-AC3 | Source author `Ḥusayn` | Search `husayn` | Source found |
| Stale state | US-090-AC4 | Support record whose source changed | Open it | Shown as stale |
| Honest label | US-090-AC5 | Record with verdict supported | Open it | Labelled as model judgment |
| Built on arras | US-090-AC6 | Explorer dependencies | Inspect | arras browser used |

## Dependencies

- **Stories**: US-087; US-088.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
- **PRD Requirements**: FR-64
- **External**: arras. Explorer data belongs in a Contract.

## Out of Scope

- The connected-graph view (US-091).
- Editing records.
