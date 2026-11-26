---
ddx:
  id: US-046
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-006
---

# US-046: Add a section of alternative interpretations

**Feature**: FEAT-006 — Composition
**Feature Requirements**: ALT-01, DRFT-02, DRFT-03
**PRD Requirements**: FR-26
**Priority**: P1

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to add a section of alternative interpretations to a chapter
**So that** each chapter states the strongest counter-arguments before a reviewer does.

## Context

Idris keeps rival readings in every chapter. This is manuscript content, distinct from the audit pass that produces findings.

## Walkthrough

1. Idris asks for alternative interpretations for a chapter.
2. The assistant drafts adversarial counter-arguments against the chapter's claims.
3. Sourced counter-arguments carry keys and locators; others are shown as unsupported by the ledger.
4. Idris edits and keeps the section in the chapter.

## Acceptance Criteria

- [ ] **US-046-AC1** — Given a chapter with claims, when alternative interpretations are requested, then the chapter gains a section of counter-arguments that oppose its claims.
- [ ] **US-046-AC2** — Given a counter-argument marked as needing a source, when it is drafted, then it carries a key and locator or is reported as lacking them.

## Edge Cases

- **No opposing evidence in the ledger**: Counter-arguments are presented as arguments without attributed evidence; no rival scholar is invented.
- **Author removes the section**: The chapter remains valid; the section is optional.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Section | US-046-AC1 | Chapter claims a single origin | Request | Section argues at least one competing account |
| Unsupported rival | US-046-AC2 | No opposing entry | Mark rival assertion | Reported as lacking key and locator |

## Dependencies

- **Stories**: US-045.
- **Feature Spec**: FEAT-006 — Composition
- **Feature Requirements**: ALT-01, DRFT-02, DRFT-03
- **PRD Requirements**: FR-26
- **External**: The assistant's hosted model.

## Out of Scope

- The audit rival-readings pass (US-064).
- Deciding which reading is correct.
