---
ddx:
  id: US-114
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-015
---

# US-114: Work through a usable first report

**Feature**: FEAT-015 — Takeover of existing projects
**Feature Requirements**: RPT-01, RPT-02, RPT-03
**PRD Requirements**: FR-93
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** the first report on my book to show each problem once, with what to do
**So that** I can start working instead of facing hundreds of near-identical lines.

## Context

A whole book starts with most cited sources not held and extracted claims without support. Chapter reference lists also repeat entries, so the same question can arise many times.

## Walkthrough

1. Margit takes over several chapters.
2. The report groups what is open by cause, each with a count, places, and a next step.
3. She opens one group to see its items.
4. She settles an entry repeated in several chapters' lists with one choice.

## Acceptance Criteria

- [ ] **US-114-AC1** — Given many citations of one source with no copy, when the report is shown, then that cause appears once with its count, places, and next step, and its items can be listed.
- [ ] **US-114-AC2** — Given many extracted claims without support, when the report is shown, then they are grouped by cause.
- [ ] **US-114-AC3** — Given identical reference entries in several chapters' lists, when takeover completes, then they are shown as one group and nothing has been merged.
- [ ] **US-114-AC4** — Given such a group, when Margit makes one choice for it, then it applies to every exact repeat, each is rechecked, and each has its own saved choice.
- [ ] **US-114-AC5** — Given entries that differ in any character, when repeats are grouped, then they are not in one exact-repeat group.
- [ ] **US-114-AC6** — Given grouped and ungrouped views of one run, when they are compared, then they hold the same findings with the same results.

## Edge Cases

- **A later file adds another repeat**: It joins the group as an open item; the earlier choice is not applied to it without the author.
- **A choice that fails for one repeat**: The failure is named, and no item is shown as settled when it is not.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Not held | US-114-AC1 | 40 citations of one source with no copy | Report | One group of 40 |
| Claims | US-114-AC2 | 100 unsupported claims | Report | One group per cause, with counts |
| Repeats | US-114-AC3 | One entry in 3 lists | Take over | One group of 3; no merge |
| One choice | US-114-AC4 | That group | Bind to one source | 3 rechecked; 3 choices saved |
| Near repeat | US-114-AC5 | A 4th entry differing by one comma | Group | Not in the group |
| Same findings | US-114-AC6 | Any run | Compare | Same findings and results |

## Dependencies

- **Stories**: US-099; US-102; US-113.
- **Feature Spec**: FEAT-015
- **Feature Requirements**: RPT-01, RPT-02, RPT-03
- **PRD Requirements**: FR-93
- **External**: FEAT-007 (report grouping). Command surfaces belong in a Contract.

## Out of Scope

- Merging near-duplicate sources.
- Hiding or lowering any finding.
