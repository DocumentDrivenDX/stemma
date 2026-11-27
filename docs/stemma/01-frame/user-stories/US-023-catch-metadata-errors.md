---
ddx:
  id: US-023
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-023: Catch wrong source metadata and identifiers

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: CHK-04, CHK-05, CHK-18
**PRD Requirements**: FR-29
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to find a real title with the wrong author, a wrong year or venue, or an identifier for another work
**So that** I catch plausible AI references that pass a quick look.

## Context

AI assistants attach real titles to wrong authors. The check compares record values with what the captured copy states or a saved catalogue lookup. It shows disagreement; it does not decide which side is right.

## Walkthrough

1. Idris checks a record whose author the assistant supplied.
2. The script compares it with source metadata and any cached resolver result.
3. Stemma shows both author values and marks a failure.
4. Idris corrects the record and the rerun passes.

## Acceptance Criteria

- [ ] **US-023-AC1** — Given a record whose author, title, year, or venue disagrees with source metadata or a resolver result, when the check runs, then it fails and shows both values.
- [ ] **US-023-AC2** — Given an identifier whose cached resolution found no work, when the check runs, then it fails with the query and date.
- [ ] **US-023-AC3** — Given an identifier that resolves to a different work, when the check runs, then it fails and shows both works.
- [ ] **US-023-AC4** — Given no source metadata and no resolver result for a value, when the check runs, then it reports unverifiable.
- [ ] **US-023-AC5** — Given source details that cannot be verified automatically, when a person records a review of the title page or equivalent confirming the details, then the result is shown as confirmed by the author, not verified, and is no longer open; without that record it stays open and the report says so.
- [ ] **US-023-AC6** — Given a confirmation, when a detail disagrees with the copy or a saved lookup, then the mismatch is still reported until fixed or dismissed.

## Edge Cases

- **Resolver error such as a timeout**: It is not evidence that the identifier does not exist; the item is unverifiable.
- **Sources disagree with each other**: Both are shown and the record does not pass silently.
- **Name or script variants**: Matching rules are design decisions; an uncertain comparison is not reported as pass.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Wrong author | US-023-AC1 | Record author "M. Ashby"; source metadata "R. Hartwell" | Check | Fail showing both |
| No such DOI | US-023-AC2 | Cached not-found for fixture DOI 10.5555/none, dated 2026-02-01 | Check | Fail with query and date |
| Other work | US-023-AC3 | Cached result titled "Soil Chemistry" for a record titled "River Terraces" | Check | Fail showing both titles |
| Nothing to compare | US-023-AC4 | Offline; no cache; source has no metadata | Check | Unverifiable |
| Confirmed | US-023-AC5 | Scan with no extractable title metadata | Confirm the title page | Shown as confirmed by the author |
| Mismatch | US-023-AC6 | Confirmed source with a seeded wrong year | Check | Mismatch reported |

## Dependencies

- **Stories**: US-013, US-029.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: CHK-04, CHK-05, CHK-18
- **PRD Requirements**: FR-29
- **External**: Optional DOI and metadata resolvers; comparison rules and cached-result shape belong to design and Contract artifacts. Resolver services are untested.

## Out of Scope

- Automatic metadata correction.
- Retraction checking, which no requirement defines.
