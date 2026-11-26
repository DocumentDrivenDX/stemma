---
ddx:
  id: US-019
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-005
    - stemma.prd
---

# US-019: Record why sources support a claim

**Feature**: FEAT-005 — Notes, claims, constructs
**Feature Requirements**: CLM-01, CLM-02, CLM-03, CLM-04
**PRD Requirements**: FR-21, FR-80
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to link each claim to its notes with a confidence level and my reason
**So that** I can see later what each claim rests on and which claims lack evidence.

## Context

Drafts come from the claim ledger. A claim without notes, confidence, or reason is not yet a usable entry.

## Walkthrough

1. Tomasz writes a claim about the survey results.
2. Tomasz links two notes, sets a confidence level, and states why the sources support it.
3. Stemma saves the entry.
4. Tomasz opens the claim and reaches both notes and their passages.

## Acceptance Criteria

- [ ] **US-019-AC1** — Given two anchored notes, when the author records a claim linked to them with confidence and reason, then the entry keeps the claim, both links, the confidence, and the reason.
- [ ] **US-019-AC2** — Given a claim with no note, when the ledger is checked, then it is reported incomplete.
- [ ] **US-019-AC3** — Given a claim missing a confidence level or reason, when the ledger is checked, then it is reported incomplete and names what is missing.
- [ ] **US-019-AC4** — Given a note that opposes a claim, when it is linked, then the ledger records it as opposing, distinct from support.
- [ ] **US-019-AC5** — Given claims that support, object to, or rival one another, and a thesis, when the relations are recorded, then each relation keeps its kind and the thesis is identified.

## Edge Cases

- **A linked note is removed**: The claim is flagged; with no remaining note it is incomplete.
- **A linked note is unreviewed**: It counts as evidence and is reported as unreviewed.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Complete | US-019-AC1 | Claim "Ploughing began on the lower terrace"; 2 notes; confidence stated; reason text | Save | All parts stored |
| No note | US-019-AC2 | Claim only | Check | Reported incomplete |
| Missing reason | US-019-AC3 | Note linked; no reason | Check | Incomplete: reason |
| Opposition | US-019-AC4 | One supporting and one opposing note | Save | Stances stored distinctly |
| Relations | US-019-AC5 | Thesis, one objection, one rival reading | Record relations | Kinds and thesis stored |

## Dependencies

- **Stories**: US-018.
- **Feature Spec**: FEAT-005 — Notes, claims, constructs
- **Feature Requirements**: CLM-01, CLM-02, CLM-03, CLM-04
- **PRD Requirements**: FR-21, FR-80
- **External**: AC4 and AC5 are delivery step M2. Confidence values are not defined by the PRD; shape belongs to Contract artifacts.

## Out of Scope

- Claim-support judgment (US-032).
- Outline derivation and drafting (FEAT-006).
