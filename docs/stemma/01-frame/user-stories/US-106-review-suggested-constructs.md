---
ddx:
  id: US-106
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-015
---

# US-106: Review suggested constructs and methodology

**Feature**: FEAT-015 — Takeover of existing projects
**Feature Requirements**: SUG-01, SUG-02
**PRD Requirements**: FR-82
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to see the constructs and method that Stemma suggests from my existing work, each with the passages behind it
**So that** I can use suggestions at once and keep, change, or drop each as my framing when I choose

## Context

Delivery step M2, with the construct register; that timing and the P0 rank are PRD assumptions. The suggestions are model proposals, not findings.

## Walkthrough

1. Margit asks for suggestions on a taken-over chapter.
2. Stemma records suggestions with their supporting passages, marked unreviewed.
3. Margit marks one reviewed, retires one, and leaves the rest.
4. The register shows which are reviewed.

## Acceptance Criteria

- [ ] **US-106-AC1** — Given a taken-over project, when constructs and methodology are suggested, then each suggestion shows its supporting passages.
- [ ] **US-106-AC2** — Given a suggestion the author has not reviewed, when the register, drafting, or a check is used, then it is in effect and shown as unreviewed.
- [ ] **US-106-AC3** — Given a suggestion, when the author retires it, then it has no further effect.

## Edge Cases

- **No supporting passage**: The suggestion is not shown.
- **A suggested construct is borrowed**: It still needs its definition and source to pass the register check.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Passages | US-106-AC1 | Synthetic taken-over chapter | Suggest | Each suggestion with passages |
| Unreviewed | US-106-AC2 | One suggestion | Read register and run checks | Present; shown unreviewed |
| Retire | US-106-AC3 | Same suggestion | Retire | Not in effect |

## Dependencies

- **Stories**: US-099, US-020.
- **Feature Spec**: FEAT-015 — Takeover of existing projects
- **Feature Requirements**: SUG-01, SUG-02
- **PRD Requirements**: FR-82
- **External**: A model through the agent host; suggestion quality is untested. Project automation makes no paid model calls.

## Out of Scope

- Constructs stated at setup (US-002).
- Judging whether the methodology is sound.
