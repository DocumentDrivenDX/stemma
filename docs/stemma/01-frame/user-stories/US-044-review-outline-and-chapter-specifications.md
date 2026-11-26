---
ddx:
  id: US-044
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-006
---

# US-044: Use and review a derived outline

**Feature**: FEAT-006 — Composition
**Feature Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04
**PRD Requirements**: FR-24
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to get an outline and chapter specifications derived from my inputs and ledger, use them at once, and review or edit them when I like
**So that** drafting follows a structure I can see and change without waiting

## Context

Structure stays with the author. Idris has a thesis, a ledger, and a methodology, and wants to see how each shaped the proposal.

## Walkthrough

1. Idris asks for an outline.
2. The system derives an outline and chapter specifications from the thesis, audience, scope, ledger, and the methodology present, marked unreviewed.
3. Each chapter specification names the constructs and methodology it uses and shows where ledger support is thin.
4. Idris moves one chapter, edits a specification, and marks it reviewed when ready.
5. Drafting uses the current version throughout.

## Acceptance Criteria

- [ ] **US-044-AC1** — Given a thesis, audience, scope, and ledger, when derivation runs, then an outline and chapter specifications are produced, marked unreviewed.
- [ ] **US-044-AC2** — Given a project with constructs or a methodology, when derivation runs, then the chapter specifications name them.
- [ ] **US-044-AC3** — Given a project with neither constructs nor methodology, when derivation runs, then it completes without requiring them.
- [ ] **US-044-AC4** — Given an unreviewed outline, when drafting is requested, then drafting uses it without asking for approval and says it is unreviewed.
- [ ] **US-044-AC5** — Given a reviewed plan that then changes, when drafting runs, then it uses the current version, shown as unreviewed, and the earlier version stays in history.

## Edge Cases

- **Chapter with no supporting entry**: It is shown as unsupported; no claim is invented.
- **Inputs change**: The plan stays until changed; FR-47 lists re-review work (US-068).

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Derive | US-044-AC1 | Thesis on port cities, 12 ledger entries | Derive | Plan with chapter specifications, unreviewed |
| With methodology | US-044-AC2 | Methodology 'comparative case study' | Derive | Specifications name it |
| Without | US-044-AC3 | No constructs, no methodology | Derive | Completes |
| No wait | US-044-AC4 | Unreviewed outline | Draft chapter 1 | Drafted; unreviewed noted |
| Changed plan | US-044-AC5 | Reviewed plan; reordered | Draft | Uses the new order; unreviewed |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-006 — Composition
- **Feature Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04
- **PRD Requirements**: FR-24
- **External**: FEAT-001 inputs; FEAT-005 ledger. Interface surface belongs in Contract artifacts.

## Out of Scope

- Drafting prose (US-045).
- Settling which argument is right.
