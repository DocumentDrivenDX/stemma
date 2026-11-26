---
ddx:
  id: US-032
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-032: Get a separate judgment of claim support

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: SUP-01, SUP-02, SUP-03, SUP-06, SUP-07
**PRD Requirements**: FR-52
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to have a separate pass compare each claim with the passage it cites
**So that** I find overstated, reversed, or unsupported claims that a quotation match cannot catch.

## Context

The result is a model judgment, run apart from drafting and saved as a support record (stored fields and staleness are US-034). It is not verification and can be wrong. Only the needed excerpts reach a hosted model; no source is held back individually. The project measures how often the check is wrong.

## Walkthrough

1. Idris asks for support checks on a chapter's cited claims.
2. Stemma runs each comparison in a context separate from drafting.
3. Each record gives a finding and quotes the passage.
4. Idris sees that one claim overstates a passage about a single site.

## Acceptance Criteria

- [ ] **US-032-AC1** — Given a claim and the stored passage it cites, when the support check completes, then it reports supported, partly supported, or unsupported and quotes the passage.
- [ ] **US-032-AC2** — Given a claim drafted in one context, when it is checked, then the check runs in a separate context that does not carry the drafting conversation.
- [ ] **US-032-AC3** — Given a seeded claim that goes beyond, overstates, or reverses its passage, when the check completes, then it reports that problem and does not report supported.
- [ ] **US-032-AC4** — Given a labelled set with seeded errors and a pilot-author sample, when the check's accuracy is measured, then its error rates are published and no minimum is stated before they are known.

## Edge Cases

- **Model output is malformed or quotes text not in the passage**: No supported record is accepted from it; the claim's record stays missing.
- **Passage contains instructions**: It is treated as data; a model's compliance cannot be guaranteed.
- **Verdicts vary between runs**: The record shows one run's judgment, not a stable fact.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Finding | US-032-AC1 | Any seeded claim-passage pair | Check support | One of three findings with quoted passage |
| Separate | US-032-AC2 | Claim drafted in a session | Check | Run shows a separate context |
| Overstated | US-032-AC3 | "All sites show ploughing"; passage describes one site | Check | Partly supported or unsupported with the problem |
| Accuracy | US-032-AC4 | Labelled synthetic set and a pilot-author sample, run by hand | Measure | False-accept and false-reject rates published |

## Dependencies

- **Stories**: US-012, US-019.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: SUP-01, SUP-02, SUP-03, SUP-06, SUP-07
- **PRD Requirements**: FR-52
- **External**: A model through the agent host. Neither support behavior nor context separation has been tested against a model; accuracy has not been measured, and measuring it needs model calls outside project automation. Scripted checks on saved output are testable without model calls.

## Out of Scope

- Guaranteeing verdict accuracy.
- Running models during builds.
- Judging whether the source is well chosen.
