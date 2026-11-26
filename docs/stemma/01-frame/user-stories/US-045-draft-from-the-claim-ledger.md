---
ddx:
  id: US-045
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-006
---

# US-045: Draft a section from the claim ledger

**Feature**: FEAT-006 — Composition
**Feature Requirements**: DRFT-01, DRFT-02, DRFT-03
**PRD Requirements**: FR-25
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to have a section drafted from selected ledger entries
**So that** every assertion marked as needing a source either carries a key and locator or is shown to me as lacking one.

## Context

Drafting is where invented citations enter. Idris drafts much of the prose with AI and needs it tied to ledger entries.

## Walkthrough

1. Idris selects a chapter specification and its ledger entries and asks for a draft.
2. The assistant drafts from those entries.
3. It marks assertions that need a source and attaches keys and typed locators from the entries' notes.
4. One requested point has no entry; the assistant says so and leaves no invented citation.
5. The report lists marked assertions that lack a key or locator.

## Acceptance Criteria

- [ ] **US-045-AC1** — Given ledger entries in effect, some unreviewed, when a draft is written, then its sourced content comes from those entries, not from retired ones, and the assistant says which are unreviewed.
- [ ] **US-045-AC2** — Given an assertion marked as needing a source, when it is drafted with support, then it carries a citation key and a typed locator.
- [ ] **US-045-AC3** — Given a marked assertion without a key or without a locator, when the draft is checked, then the assertion is reported.
- [ ] **US-045-AC4** — Given requested text that no entry supports, when drafting runs, then the assistant says no entry supports it and invents no source, locator, or quotation.

## Edge Cases

- **Author marks an assertion later**: It is reported until it carries a key and locator.
- **Draft overstates its entry**: The claim-support check (FEAT-007) reports it; drafting does not certify support.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| From ledger | US-045-AC1 | 2 reviewed entries, 1 unreviewed, 1 retired | Draft | Uses the first three; names the unreviewed one |
| Carry citation | US-045-AC2 | Entry with note at page 44 | Draft marked sentence | Key and page locator 44 present |
| Missing locator | US-045-AC3 | Marked sentence with key only | Check | Reported |
| No support | US-045-AC4 | Ask for a trade-volume figure absent from ledger | Draft | States no support; no number or citation invented |

## Dependencies

- **Stories**: US-044.
- **Feature Spec**: FEAT-006 — Composition
- **Feature Requirements**: DRFT-01, DRFT-02, DRFT-03
- **PRD Requirements**: FR-25
- **External**: FEAT-005 ledger; FEAT-007 checks. Interface surface belongs in Contract artifacts.

## Out of Scope

- Support verdicts.
- Detecting assertions nobody marked.
