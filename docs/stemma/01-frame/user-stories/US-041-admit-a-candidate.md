---
ddx:
  id: US-041
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-004
---

# US-041: Admit or decline a candidate

**Feature**: FEAT-004 — Research and Discovery
**Feature Requirements**: ADM-01, ADM-02, ADM-03, SRCH-02
**PRD Requirements**: FR-17
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to decide on each candidate when I choose
**So that** I can tell works I chose from ones I have not, and see which chosen works still lack a stored copy or fail a check

## Context

Margit distrusts assistant-supplied references. Admission records her decision and runs the corpus checks. A candidate cited before she decides is reported as unreviewed.

## Walkthrough

1. Margit picks a candidate from a search.
2. The assistant shows its details and origin, asks for a decision, and offers to record any rights or permission information; none is required.
3. Margit admits it and supplies a copy or asks the assistant to obtain one.
4. Source acquisition and corpus checks run.
5. The assistant shows the new source with its provenance, the query that found it, and Margit's decision.

## Acceptance Criteria

- [ ] **US-041-AC1** — Given a candidate and no author decision, when the assistant continues working, then the candidate is not marked admitted, and citing it is reported as unreviewed without stopping work.
- [ ] **US-041-AC2** — Given an admitted candidate with an obtainable copy, when admission completes, then acquisition and corpus checks have run and the query and decision are recorded.
- [ ] **US-041-AC3** — Given a candidate the author admits with no stored copy, when admission runs, then it is admitted, the missing copy is named, and its citations are reported as unchecked.
- [ ] **US-041-AC4** — Given a candidate the author declines, when the decision is given, then the refusal is recorded with its query and any citation of it is reported.

## Edge Cases

- **Candidate details disagree with the acquired file**: Both values are shown and the author decides; the checks do not overwrite either silently.
- **The candidate matches an existing source**: The match is shown before any second source is created.
- **The source carries a rights or permission limit**: It is recorded at admission; it does not keep the source from a hosted model.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| No decision | US-041-AC1 | Candidate pending | Ask the assistant to cite it | It cites it and says it is undecided and unchecked |
| Admit with copy | US-041-AC2 | A 20-page article PDF | Admit | Source, hash, provenance, query, and decision recorded; checks run |
| Paper-only book | US-041-AC3 | Book with no scan | Admit | Admitted; missing copy reported; a scan with machine-readable text suggested |
| Decline | US-041-AC4 | Candidate pending | Decline | Refusal and query recorded |

## Dependencies

- **Stories**: US-040.
- **Feature Spec**: FEAT-004 — Research and Discovery
- **Feature Requirements**: ADM-01, ADM-02, ADM-03, SRCH-02
- **PRD Requirements**: FR-17
- **External**: FEAT-002 acquisition and checks; FEAT-003 records. Interface surface belongs in Contract artifacts.

## Out of Scope

- Extraction and page mapping behavior (FEAT-002).
- Proof of who recorded the decision.
