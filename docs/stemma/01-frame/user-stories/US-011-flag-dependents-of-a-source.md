---
ddx:
  id: US-011
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-011: See what a changed source affects

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: CHG-01, CHG-02
**PRD Requirements**: FR-10
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to replace or remove a stored source and see everything that depended on it
**So that** I recheck every affected note, claim, and citation instead of trusting stale ones.

## Context

Better copies and corrected editions replace earlier files. Dependents recorded against the old copy may no longer hold.

## Walkthrough

1. Idris replaces a cited source's file with a corrected version.
2. Stemma records the new file and hash.
3. Stemma flags and lists the dependent notes, claims, and citations.
4. Idris reviews the flagged items, and checks recompute against the new file.

## Acceptance Criteria

- [ ] **US-011-AC1** — Given a source with dependent notes, claims, and citations, when its file is replaced, then every one of them is flagged.
- [ ] **US-011-AC2** — Given the same dependencies, when the source is removed, then every dependent is flagged and none is silently deleted.
- [ ] **US-011-AC3** — Given a source record or file changed outside the agent, when the next check run covers it, then its dependents are flagged.

## Edge Cases

- **Claim depends on the source only through a note**: It is flagged too.
- **Source has no dependents**: Stemma records the change and reports that nothing depends on it.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Replace | US-011-AC1 | Source with 2 notes, 1 claim, 3 citations | Replace file | All 6 flagged |
| Remove | US-011-AC2 | Same state | Remove source | 6 flagged; none deleted |
| Outside edit | US-011-AC3 | Stored file replaced with a file manager | Run checks | Dependents flagged |

## Dependencies

- **Stories**: US-007, US-018, US-019.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: CHG-01, CHG-02
- **PRD Requirements**: FR-10
- **External**: Dependency links are record links (FEAT-011). Support-record staleness is US-034.

## Out of Scope

- Repairing dependents automatically.
- Takeover repair rounds (FEAT-015).
