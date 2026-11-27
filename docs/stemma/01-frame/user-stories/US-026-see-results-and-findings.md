---
ddx:
  id: US-026
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-026: See evidence and meaning for every finding

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: CHK-09, BLK-01, BLK-06, BLK-07
**PRD Requirements**: FR-30
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to read a report that shows each finding, its evidence, why it matters, and what I can do
**So that** I can judge each one myself without taking the assistant's word

## Context

Could-not-check is distinct from pass. Nothing in a report stops a build. The same report later accompanies a reviewer build.

## Walkthrough

1. Tomasz builds a reviewer copy.
2. Each scripted check reports pass, fail, or unverifiable with evidence.
3. The build completes, labelled with its open findings, each explained with a suggested action.
4. Tomasz fixes some and dismisses one with a reason when he chooses; the next report shows the change.

## Acceptance Criteria

- [ ] **US-026-AC1** — Given a set of checked items, when checks finish, then each result is pass, fail, or unverifiable and carries its evidence, and each fail or unverifiable result says what is wrong, why it matters, and what to do.
- [ ] **US-026-AC2** — Given open findings of any kind, including images, coordinates, support, or uncommitted changes, when a draft, camera-ready, or reviewer build is requested, then the build completes.
- [ ] **US-026-AC3** — Given any open finding, including a could-not-check result that is not coverage, when a build reports, then the output is not labelled checked clean.
- [ ] **US-026-AC4** — Given every finding is fixed, dismissed, or confirmed and some items are unreviewed, when a build reports, then the output is labelled checked clean, dismissed findings stay listed, and unreviewed items are counted separately.
- [ ] **US-026-AC5** — Given an ordinary tool failure such as a compile error, when a build runs, then it reports a tool failure and presents no older output as current.
- [ ] **US-026-AC6** — Given several findings with one cause, when the report is produced, then they are grouped and none is shown without an explanation.

## Edge Cases

- **A check does not finish**: Its items are reported as could not check.
- **Nothing in scope**: The report says no items were checked.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Three states | US-026-AC1 | One matching quote, one absent quote, one source without text | Run | pass, fail, unverifiable; findings explained |
| Nothing stops | US-026-AC2 | One of each | Each build | All complete |
| Label | US-026-AC3 | Only one unverifiable item | Build camera-ready | Open findings label |
| Clean | US-026-AC4 | One dismissed failure; two unreviewed notes | Build | Checked clean; dismissal listed; 2 unreviewed counted |
| Tool failure | US-026-AC5 | Broken typesetting input | Build | Tool failure named |
| Grouped | US-026-AC6 | One missing source cited five times | Check | One explained group of five |

## Dependencies

- **Stories**: US-022, US-028.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: CHK-09, BLK-01, BLK-06, BLK-07
- **PRD Requirements**: FR-30
- **External**: Report and result shapes belong to Contract artifacts. Watermarking belongs to FEAT-008 (FR-39).

## Out of Scope

- Support findings (US-033).
- Reviewer package assembly (FEAT-009).
- Draft watermark.
