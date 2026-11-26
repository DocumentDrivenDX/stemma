---
ddx:
  id: US-006
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-001
    - stemma.prd
---

# US-006: Record AI roles as guidance

**Feature**: FEAT-001 — Workspace and governance
**Feature Requirements**: ROL-01, ROL-02
**PRD Requirements**: FR-5
**Priority**: P1

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to write down each AI role, what it may read and write, and which checks it runs
**So that** I and a collaborator can brief separate sessions consistently without believing the record locks anything.

## Context

Idris separates research, drafting, and review sessions. The role record informs those sessions. It is not access control, and an agent with file access can ignore it.

## Walkthrough

1. Idris asks Stemma to define a research role.
2. Idris states what the role may read and write and which checks it runs.
3. Stemma saves the role and describes it as guidance.
4. A collaborator reads the record before starting a session in that role.

## Acceptance Criteria

- [ ] **US-006-AC1** — Given a new role with read scope, write scope, and checks, when the author saves it, then the project record holds all of them.
- [ ] **US-006-AC2** — Given a recorded role, when Stemma explains or reports it, then it is described as guidance and not as access control.

## Edge Cases

- **A session writes outside its role**: Stemma makes no claim that this is prevented.
- **A role names a check that does not exist**: The name is reported as unknown.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Saved | US-006-AC1 | Role "researcher": reads corpus, writes proposed notes, runs extract check | Save | All values recorded |
| Limit stated | US-006-AC2 | Same role | Ask what the role can do | Answer says it is guidance and does not restrict file access |

## Dependencies

- **Stories**: US-001, US-003.
- **Feature Spec**: FEAT-001 — Workspace and governance
- **Feature Requirements**: ROL-01, ROL-02
- **PRD Requirements**: FR-5
- **External**: Role record shape belongs to Contract artifacts.

## Out of Scope

- Permission enforcement.
- Running the separate-context support check (US-032).
