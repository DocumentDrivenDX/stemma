---
ddx:
  id: US-033
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-033: See open support findings in every build

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: FBK-03, BLK-03, BLK-04, BLK-05, BLK-08
**PRD Requirements**: FR-53
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to keep drafting past support findings and see every open one in each build report
**So that** support problems never stall writing and never go unseen

## Context

Support findings are reports. A build reads records; it calls no model, so an altered verdict goes undetected.

## Walkthrough

1. Idris drafts while a claim has a partly supported finding, shown in the agent.
2. Idris builds a camera-ready copy; it completes and lists the finding, a claim with no record, and a citation with no claim.
3. Idris narrows the claim, obtains a new record, and links the citation when ready.
4. The next report is shorter.

## Acceptance Criteria

- [ ] **US-033-AC1** — Given a partly supported, unsupported, missing, or stale support state, when ordinary work continues, then the agent reports it and does not stop the work.
- [ ] **US-033-AC2** — Given a cited claim with a missing or stale record, when a camera-ready or reviewer build runs, then it completes and its report names the claim.
- [ ] **US-033-AC3** — Given a current partly supported or unsupported finding, or a cited claim with no source passage, when such a build runs, then the report shows it, the passage case as unsupported.
- [ ] **US-033-AC4** — Given a citation linked to no recorded claim and text linked to a retired claim, when a build runs, then both are reported with how to link or revise them.
- [ ] **US-033-AC5** — Given no model or network access, when a build reports on support, then it completes without calling a model or rerunning a verdict.

## Edge Cases

- **Verdict edited by hand to supported**: A well-formed alteration goes undetected; the disclosure states that verdicts were not rerun.
- **Claim cites several passages**: How records and findings combine is defined in design; no passage is silently ignored.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Warn | US-033-AC1 | One finding and one claim without record | Keep editing | Reported; editing continues |
| Missing | US-033-AC2 | Cited claim with no record | Camera-ready build | Completes; claim named |
| Unsupported | US-033-AC3 | One partly supported record and one claim with no passage | Reviewer build | Both reported |
| Unlinked | US-033-AC4 | One of each | Build | Both reported with actions |
| No model | US-033-AC5 | Model unavailable | Camera-ready build | Report made from records |

## Dependencies

- **Stories**: US-028, US-032, US-034.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: FBK-03, BLK-03, BLK-04, BLK-05, BLK-08
- **PRD Requirements**: FR-53
- **External**: Support record Contract artifacts. A missing or stale record is fixed by obtaining a record.

## Out of Scope

- Draft watermarking (FR-39).
- Disclosure generation (FR-45).
