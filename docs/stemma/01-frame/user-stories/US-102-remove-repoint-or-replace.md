---
ddx:
  id: US-102
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-015
---

# US-102: Remove, repoint, or replace a failing reference

**Feature**: FEAT-015 — Takeover of existing projects
**Feature Requirements**: RND-01, RND-03, RND-04, RND-07, RND-08, RND-09
**PRD Requirements**: FR-73
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to remove, repoint, or replace each failing reference myself
**So that** each fix is rechecked, and I am told which claims a removal leaves without a source.

## Context

A failing reference might have a wrong page, point to the wrong work, or rest on a source that does not say it. The assistant explains and proposes; Idris decides. Fixes are written to a Stemma copy; the originals are never changed.

## Walkthrough

1. Idris starts a round and sees a failing reference with its evidence.
2. He repoints a wrong page locator.
3. Stemma rechecks the reference and the records that depend on it.
4. He removes another reference; Stemma reports its claim as left without a citation.

## Acceptance Criteria

- [ ] **US-102-AC1** — Given checks have failures, when Idris starts a round, then he is shown failing references with their evidence.
- [ ] **US-102-AC2** — Given a failing reference, when he chooses to remove it, then the reference is removed in the project.
- [ ] **US-102-AC3** — Given a failing reference, when he repoints it, then it points where he chose.
- [ ] **US-102-AC4** — Given a failing reference, when he replaces it, then his chosen replacement takes its place.
- [ ] **US-102-AC5** — Given the assistant proposes a choice, when Idris has not chosen, then the round changes nothing and other work continues.
- [ ] **US-102-AC6** — Given any choice, when it is applied, then the reference and its dependent records are rechecked.
- [ ] **US-102-AC8** — Given any choice in a round, when results are read, then each scripted result is the script's own and the round recorded no annotation.
- [ ] **US-102-AC9** — Given any choice, when takeover's originals are hashed, then they are unchanged.
- [ ] **US-102-AC10** — Given a choice that changes manuscript text or a reference, when it is applied, then the change appears in the marked-up Markdown of the Stemma copy.
- [ ] **US-102-AC11** — Given a claim whose only reference is removed, when the recheck or a build runs, then the claim is reported as left without a citation, with what to do about it.

## Edge Cases

- **Replacement without a source file**: It is reported as unchecked.
- **Repoint that still fails**: The new failure is shown.
- **One source used by several claims**: Every dependent record is rechecked.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| List | US-102-AC1 | Seeded chapter with `p. 412` on pages 31 to 60 | Start round | Failure and range shown |
| Remove | US-102-AC2 | Failing reference `r-1` | Remove | `r-1` removed |
| Repoint | US-102-AC3 | Same locator | Repoint to `p. 41` | Locator is 41 |
| Replace | US-102-AC4 | Reference with wrong work | Replace with source `s-2` | `s-2` cited |
| Proposal | US-102-AC5 | Assistant suggests removal | Do nothing | No change |
| Dependents | US-102-AC6 | Two claims using one note | Repoint | Both rechecked |
| Results | US-102-AC8 | Any round | Compare with direct check run | Same results; no new annotation |
| Originals | US-102-AC9 | After choices | Hash originals | Unchanged |
| Stemma copy | US-102-AC10 | Repoint a locator | Inspect the copy and originals | Copy changed; originals unchanged |
| Removal | US-102-AC11 | Claim with one reference; no other finding | Remove it; build | Claim reported; build completes |

## Dependencies

- **Stories**: US-101.
- **Feature Spec**: FEAT-015
- **Feature Requirements**: RND-01, RND-03, RND-04, RND-07, RND-08, RND-09
- **PRD Requirements**: FR-73
- **External**: FEAT-007 (checks, annotations), FEAT-002 (admission of replacements).

## Out of Scope

- Recording annotations.
- Writing fixes into the original manuscript format.
