---
ddx:
  id: US-002
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-001
    - stemma.prd
---

# US-002: Add constructs and methodology when ready

**Feature**: FEAT-001 — Workspace and governance
**Feature Requirements**: SET-05, SET-06, SET-07
**PRD Requirements**: FR-60
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to skip my theoretical constructs and research methodology at setup, then add or revise them later
**So that** I can start work without settling theory first and still have dependent checks apply once I state it.

## Context

Theoretical framing and method stay with the author. FEAT-001 asks for both at setup, requires neither, and keeps dependent checks from claiming a result before their input exists.

## Walkthrough

1. Idris starts a project and Stemma asks for constructs and methodology alongside the thesis.
2. Idris skips both and finishes setup.
3. Weeks later Idris adds one construct with its definition.
4. Stemma records it in the construct register, and construct-dependent checks begin to run.

## Acceptance Criteria

- [ ] **US-002-AC1** — Given project setup, when Stemma asks for the thesis, then it also asks for constructs and research methodology and marks both optional.
- [ ] **US-002-AC2** — Given both questions skipped, when setup finishes, then setup is complete and construct- or methodology-dependent steps are reported as not run, not as passed.
- [ ] **US-002-AC3** — Given a project without constructs, when the author adds one with a definition, then construct-dependent checks run from the next check run.
- [ ] **US-002-AC4** — Given a recorded methodology, when the author revises it, then the project holds the revised statement as the current one.

## Edge Cases

- **Only methodology is supplied**: Methodology-dependent steps run; construct-dependent steps stay not run.
- **The assistant suggests a construct**: It takes effect at once, marked unreviewed (US-021).

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Asked | US-002-AC1 | New project | Reach the thesis step | Both are asked and marked optional |
| Skipped | US-002-AC2 | No constructs; no methodology | Finish setup and run checks | Setup complete; dependent steps not run |
| Added later | US-002-AC3 | Add "charter community" with a definition | Run checks | Construct checks now run |
| Revised | US-002-AC4 | Methodology "prosopography" revised to "prosopography and landscape survey" | Save revision | Revised statement is current |

## Dependencies

- **Stories**: US-001.
- **Feature Spec**: FEAT-001 — Workspace and governance
- **Feature Requirements**: SET-05, SET-06, SET-07
- **PRD Requirements**: FR-60
- **External**: Construct reference checks and advice are specified in US-020.

## Out of Scope

- Register rules for borrowed constructs (US-020).
- Re-review lists after a change (FR-47, FEAT-009).
- Suggesting constructs from a taken-over manuscript (US-106).
