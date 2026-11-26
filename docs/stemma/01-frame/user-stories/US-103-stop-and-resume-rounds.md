---
ddx:
  id: US-103
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-015
---

# US-103: Stop and resume resolution rounds

**Feature**: FEAT-015 — Takeover of existing projects
**Feature Requirements**: RND-02, RND-06
**PRD Requirements**: FR-73
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** to stop in the middle of resolving references and continue on another day
**So that** I can work through my chapter in short sittings without losing or redoing decisions.

## Context

Takeover of a chapter can take several sittings. The PRD success criteria require that a pilot get the same scripted results after stopping and resuming. Progress must live in project files, not only in a chat session.

## Walkthrough

1. Margit resolves several failing references and stops.
2. On another day she opens a new session on the same project.
3. She resumes the round.
4. Her completed choices remain, open items are listed, and unchanged records give the same scripted results.

## Acceptance Criteria

- [ ] **US-103-AC1** — Given a partly finished round, when Margit stops and resumes in a new session, then completed choices are kept.
- [ ] **US-103-AC2** — Given a resumed round, when she views it, then unresolved references are still listed.
- [ ] **US-103-AC3** — Given a removal made before stopping, when she resumes, then the affected claim is still reported as left without a citation.
- [ ] **US-103-AC4** — Given unchanged records and tool versions, when checks run before stopping and after resuming, then the scripted results are identical.
- [ ] **US-103-AC5** — Given completed choices, when the project files are inspected without the chat session, then each choice and its recheck result is present.
- [ ] **US-103-AC6** — Given a session that ends in the middle of one choice, when she resumes, then that choice is shown as either complete and rechecked or not complete.

## Edge Cases

- **Source changed between sittings**: Dependent items are flagged and rechecked.
- **Original changed between sittings**: The difference is reported and not applied silently.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Keep | US-103-AC1 | 10 failures; 4 resolved | Stop; resume in new session | 4 choices kept |
| Open items | US-103-AC2 | Same | View round | 6 listed |
| Removal | US-103-AC3 | One of the 4 was a removal | Resume | Claim still reported |
| Same results | US-103-AC4 | No file changes | Run checks before and after | Identical |
| In files | US-103-AC5 | Copy of project, no chat history | Inspect | 4 choices and rechecks present |
| Interrupted | US-103-AC6 | Session closed while applying a fifth choice | Resume | Fifth shown complete or not complete, never half-applied as complete |

## Dependencies

- **Stories**: US-102.
- **Feature Spec**: FEAT-015
- **Feature Requirements**: RND-02, RND-06
- **PRD Requirements**: FR-73
- **External**: None beyond the project files. The record of choices belongs in a Contract.

## Out of Scope

- Several authors resolving one project at once.
- Synchronizing projects between machines.
