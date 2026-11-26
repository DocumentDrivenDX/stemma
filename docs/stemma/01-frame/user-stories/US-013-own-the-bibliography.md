---
ddx:
  id: US-013
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-003
    - stemma.prd
---

# US-013: Keep the bibliography in the project

**Feature**: FEAT-003 — Citation store
**Feature Requirements**: REC-01, REC-02
**PRD Requirements**: FR-11
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to create and read my bibliography in the project without installing a reference manager
**So that** my references stay readable files I own.

## Context

Working without an external reference manager is a stated user need. The records, one per source, are the official bibliography; every other form is derived.

## Walkthrough

1. Margit adds a source on a computer with no reference manager.
2. Stemma creates one plain-text record for it.
3. Margit reads the record and asks for the bibliography.
4. Stemma produces it from the records alone.

## Acceptance Criteria

- [ ] **US-013-AC1** — Given a new source, when its bibliography entry is created, then the project holds one plain-text record for that source.
- [ ] **US-013-AC2** — Given a machine with no reference manager, when the author creates, reads, and checks the bibliography, then each action completes from project files.
- [ ] **US-013-AC3** — Given a record edited as plain text, when the bibliography is next read, then the edited value is the one used.

## Edge Cases

- **A record file is malformed or has a repeated field**: It is reported and not silently skipped or half-read.
- **A derived index disagrees with the files**: The files win and the index is rebuilt.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| One record | US-013-AC1 | Add synthetic article by Hartwell | Create entry | Exactly one new record file |
| No manager | US-013-AC2 | 3 records; no reference manager installed | Create, read, check | All complete |
| Plain edit | US-013-AC3 | Change a year from 1998 to 1999 | Read | 1999 is used |

## Dependencies

- **Stories**: US-007.
- **Feature Spec**: FEAT-003 — Citation store
- **Feature Requirements**: REC-01, REC-02
- **PRD Requirements**: FR-11
- **External**: Record structure belongs to Contract artifacts and FEAT-011.

## Out of Scope

- Printed formatting and building (FEAT-008).
- Synchronization with a reference manager.
