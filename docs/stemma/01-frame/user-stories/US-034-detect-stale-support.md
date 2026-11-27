---
ddx:
  id: US-034
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-034: Know when a support record is stale

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: SUP-04, SUP-05, SUP-08
**PRD Requirements**: FR-54
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to change claims and sources and see which support records no longer match them
**So that** I never rely on a judgment carried over from text or evidence that has changed

## Context

A record shows what a model judged on recorded inputs. A change to any of them makes it stale.

## Walkthrough

1. Idris has a claim with a current support record.
2. Idris replaces the cited source.
3. Stemma marks the record stale and reports it.
4. Every build report shows it until a current record exists.

## Acceptance Criteria

- [ ] **US-034-AC1** — Given a current support record, when the claim text changes, then the record is stale.
- [ ] **US-034-AC2** — Given a current support record, when the cited passage changes, then the record is stale.
- [ ] **US-034-AC3** — Given a current support record, when the source hash changes, then the record is stale.
- [ ] **US-034-AC4** — Given a record lacking any FR-54 field, when currency is checked, then it does not count as current.
- [ ] **US-034-AC5** — Given a completed support check, when its record is saved, then it holds the model, prompt version, claim text, passage, and source hash.
- [ ] **US-034-AC6** — Given a current support record, when only the manuscript sentence changes and the recorded claim, passage, and source do not, then the record stays current.

## Edge Cases

- **Change made outside the agent**: The build's comparison detects it.
- **Change is reverted**: Currency follows the compared content, not the edit date.
- **Manuscript sentence changes but the ledger claim does not**: The record stays current (US-034-AC6), so a strengthened sentence can pass.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Claim | US-034-AC1 | "some fields" changed to "all fields" | Check currency | Stale |
| Passage | US-034-AC2 | A page of the passage changes | Check currency | Stale |
| Source | US-034-AC3 | Source file replaced | Check currency | Stale |
| Incomplete record | US-034-AC4 | Record with no prompt version | Check | Not current |
| Record | US-034-AC5 | Completed check | Read record | All five present |
| Sentence only | US-034-AC6 | Sentence changed from `some` to `all`; claim record unchanged | Check staleness | Current; the stated limit applies |

## Dependencies

- **Stories**: US-011, US-032.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: SUP-04, SUP-05, SUP-08
- **PRD Requirements**: FR-54
- **External**: Content comparison and normalization rules belong to design and Contract artifacts.

## Out of Scope

- Re-running the judgment automatically.
- Proving the record was not altered.
