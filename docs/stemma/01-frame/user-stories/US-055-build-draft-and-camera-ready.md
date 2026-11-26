---
ddx:
  id: US-055
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-055: Build a draft or camera-ready book at any time

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: BLD-05, BLD-06, BLD-07
**PRD Requirements**: FR-39
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to build a draft or camera-ready copy at any time and see plainly what is still open
**So that** I can read my pages and never mistake a book with open findings for a checked one

## Context

Margit needs to see pages early and decides herself when to publish. Every build completes.

## Walkthrough

1. Margit builds a draft while one quotation check fails.
2. The draft is produced with a visible unverified watermark and a report explaining the failure.
3. Margit builds camera-ready.
4. It completes, records the commit and tool versions, and is labelled as having open findings.

## Acceptance Criteria

- [ ] **US-055-AC1** — Given any check results, when a draft build runs, then a draft PDF is produced with a visible unverified watermark and a report of what is open.
- [ ] **US-055-AC2** — Given open findings, when a camera-ready build runs, then it produces the PDF and report, and the output is not labelled checked clean.
- [ ] **US-055-AC3** — Given a cited claim with no support record, when a reviewer build runs, then it completes and reports the claim.
- [ ] **US-055-AC4** — Given a record edited outside the agent so that a quotation no longer matches, when a camera-ready build runs, then the rerun check reports it.
- [ ] **US-055-AC5** — Given nothing open, when any build succeeds, then the commit, tool versions, and checked-clean label are recorded.
- [ ] **US-055-AC6** — Given uncommitted changes, when a camera-ready or reviewer build runs, then it completes and reports them.

## Edge Cases

- **Nothing open**: A draft is still a draft and keeps the watermark.
- **Camera-ready with open findings**: The pages carry no mark; the report states the status.
- **Compile error**: The build reports a tool failure and presents no older PDF as its result.
- **Stale support record**: It appears in every build report.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Draft | US-055-AC1 | 1 failing quotation | Build draft | Watermarked PDF and report |
| Camera-ready | US-055-AC2 | Same | Build camera-ready | PDF; open findings label |
| Reviewer | US-055-AC3 | Missing support record | Build reviewer | Completes; reported |
| Outside edit | US-055-AC4 | Quotation changed in a record by hand | Build camera-ready | Reported |
| Clean | US-055-AC5 | Nothing open | Build camera-ready | PDF, build record, checked clean |
| Tree state | US-055-AC6 | Uncommitted edit | Build reviewer | Completes; reported |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: BLD-05, BLD-06, BLD-07
- **PRD Requirements**: FR-39
- **External**: FEAT-007 results and annotations. Interface surface belongs in Contract artifacts.

## Out of Scope

- How checks compute results.
- The reviewer package (US-067).
