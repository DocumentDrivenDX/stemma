---
ddx:
  id: US-048
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-006
---

# US-048: Answer interpretive checkpoints

**Feature**: FEAT-006 — Composition
**Feature Requirements**: CHK-01, CHK-02
**PRD Requirements**: FR-28
**Priority**: P1

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to be asked for my own interpretation at set points in a chapter, as many or as few as I choose
**So that** the interpretive moves I want to make are mine and recorded, without my work being halted

## Context

Interpretation stays with the author. A checkpoint asks; it never halts the work, and a fluent author may turn all of them off.

## Walkthrough

1. Margit drafts a chapter with checkpoints turned on.
2. At a checkpoint the assistant states what Margit might decide and carries on.
3. Margit answers when she chooses, and the answer is recorded.
4. Unanswered checkpoints appear in reports.

## Acceptance Criteria

- [ ] **US-048-AC1** — Given a checkpoint without author input, when work continues, then nothing halts and the unanswered checkpoint is reported.
- [ ] **US-048-AC2** — Given a checkpoint setting, when it is changed, then the number of checkpoints that apply changes accordingly, down to none.
- [ ] **US-048-AC3** — Given an answer the assistant proposes, when the checkpoint is read, then it does not count as the author's input.

## Edge Cases

- **The assistant proposes an answer**: A proposal does not count as the author's input.
- **Build with an open checkpoint**: The build completes.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| No halt | US-048-AC1 | Open checkpoint | Continue drafting | Continues; reported |
| Off | US-048-AC2 | Setting set to none by a fluent author | Run chapter | No checkpoints appear |
| Not the author | US-048-AC3 | Assistant suggestion | Read checkpoint | Still unanswered |

## Dependencies

- **Stories**: US-044.
- **Feature Spec**: FEAT-006 — Composition
- **Feature Requirements**: CHK-01, CHK-02
- **PRD Requirements**: FR-28
- **External**: Persona defaults (FEAT-010, FR-51).

## Out of Scope

- Halting work or builds at checkpoints.
- Proving the input came from the author.
