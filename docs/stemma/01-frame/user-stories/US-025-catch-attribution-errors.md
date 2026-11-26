---
ddx:
  id: US-025
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-025: Catch borrowed arguments, figures, and constructs

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: CHK-06, CHK-07, CHK-08
**PRD Requirements**: FR-29
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to find my own argument quoted back as a source, statistics a source does not contain, and misplaced construct credit
**So that** the book does not attribute my ideas, numbers, or concepts to the wrong place.

## Context

These three recorded error classes concern attribution. Scripted matching covers only what text and registers allow; the rest must be reported as unchecked. The PRD defines no matching rules.

## Walkthrough

1. Idris checks a chapter after several AI drafting sessions.
2. The scripts compare quotations with the book's argument, attributed figures with source text, and construct credit with the register.
3. Stemma reports each finding with the compared texts.
4. Idris fixes the attributions.

## Acceptance Criteria

- [ ] **US-025-AC1** — Given a quotation attributed to a source that duplicates the book's own recorded argument, when the check runs, then it fails and shows both texts.
- [ ] **US-025-AC2** — Given a figure attributed to a source whose matchable text lacks it, when the check runs, then it fails and shows the claim and the text searched.
- [ ] **US-025-AC3** — Given an attributed figure where the source text cannot be matched, when the check runs, then it reports unverifiable.
- [ ] **US-025-AC4** — Given a registered originator, when text credits the construct to someone else in a form the check can read, then it fails and shows both names.
- [ ] **US-025-AC5** — Given no constructs exist, when checks run, then the construct-credit check is reported as not run and not as passed.

## Edge Cases

- **Credit phrased so that the script cannot read it**: The report states what was not checked.
- **Number written in words or another unit**: An uncertain match is not a pass.
- **Source independently contains the same sentence as the thesis**: The author sees both texts and may dismiss the finding (FR-32).

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Own argument | US-025-AC1 | Recorded thesis sentence repeated as a quotation from ellery1911rolls | Check | Fail showing both |
| Borrowed figure | US-025-AC2 | Text credits "73 percent" to a source containing no such figure | Check | Fail with evidence |
| Unmatchable | US-025-AC3 | Figure appears only in an image of a chart | Check | Unverifiable |
| Wrong credit | US-025-AC4 | Register: Hartwell; text: "Ellery's charter community" | Check | Fail showing both |
| No constructs | US-025-AC5 | Empty register | Run checks | Not run |

## Dependencies

- **Stories**: US-009, US-019, US-020 (M2 register).
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: CHK-06, CHK-07, CHK-08
- **PRD Requirements**: FR-29
- **External**: Matching rules are design decisions. The construct-credit check (AC4, AC5) is delivery step M2, with the register. No spike covered these three checks.

## Out of Scope

- Detecting unattributed borrowing across the corpus.
- Any model judgment as a scripted result.
