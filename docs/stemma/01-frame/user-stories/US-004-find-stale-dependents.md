---
ddx:
  id: US-004
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-001
    - stemma.prd
---

# US-004: Find documents left stale by a changed decision

**Feature**: FEAT-001 — Workspace and governance
**Feature Requirements**: DOC-01
**PRD Requirements**: FR-3
**Priority**: P1

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to see which documents depend on a decision I changed and have not been updated
**So that** I can update every listed document before it drifts from the decision.

## Context

Hand-maintained registers drift after a decision changes. The check relies on dependencies that documents declare; it cannot find an undeclared one.

## Walkthrough

1. Idris changes a recorded decision about transliteration.
2. Idris runs the project checks.
3. Stemma lists the dependent documents not updated since the change.
4. Idris updates them and reruns the check, which no longer lists them.

## Acceptance Criteria

- [ ] **US-004-AC1** — Given two documents that declare a dependency on a decision and have not changed since it did, when the check runs, then both are listed with the decision.
- [ ] **US-004-AC2** — Given a dependent document updated after the decision changed, when the check runs, then it is not listed.

## Edge Cases

- **A document declares a dependency on a missing decision**: The check reports the broken reference.
- **A document uses a decision without declaring it**: The check cannot detect it, and the result claims coverage of declared dependencies only.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Stale listed | US-004-AC1 | Decision D (transliteration) changed; style checklist and name list declare it | Run check | Both documents listed with D |
| Updated | US-004-AC2 | Style checklist updated after D changed | Run check | Only the name list is listed |

## Dependencies

- **Stories**: US-001.
- **Feature Spec**: FEAT-001 — Workspace and governance
- **Feature Requirements**: DOC-01
- **PRD Requirements**: FR-3
- **External**: What counts as a change or an update is a design decision. The result is reported like any other finding.

## Out of Scope

- Re-review lists for thesis, construct, methodology, or evidence changes (FR-47).
- Rewriting stale documents automatically.
