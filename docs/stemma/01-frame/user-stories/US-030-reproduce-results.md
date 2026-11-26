---
ddx:
  id: US-030
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-030: Reproduce and test scripted results

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: CHK-13, CHK-14, CHK-15
**PRD Requirements**: FR-34
**Priority**: P0

## Story

**As a** Priya, the technologist-researcher,
**I want** to rerun the checks and the seeded-error tests and get identical results
**So that** I can trust that a changed result means a changed input or tool version.

## Context

Scripted checks are deterministic and model-free. A seeded error and clean input for each check show that it detects what it claims to, on those fixtures only.

## Walkthrough

1. Priya runs the checks twice on one project.
2. Priya compares the results and finds them identical.
3. Priya runs the seeded-error test set locally.
4. Each check detects its seeded error and passes its clean input.

## Acceptance Criteria

- [ ] **US-030-AC1** — Given the same inputs and tool versions, when scripted checks run twice, then their results are identical.
- [ ] **US-030-AC2** — Given each scripted check, when the seeded-error set runs, then the check reports its seeded error as fail or unverifiable with the reason, and passes the clean input.
- [ ] **US-030-AC3** — Given a saved model judgment, when scripted results are computed, then no scripted result takes its value from the judgment.
- [ ] **US-030-AC4** — Given a model service that is unavailable, when scripted checks run, then all of them complete or report their own non-model reason.

## Edge Cases

- **Tool version differs**: The difference is visible in the run's recorded versions; equality is not promised.
- **Different operating system**: Matching results are required but untested on Linux and Windows.
- **Cached resolver input changes**: It is a changed input.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Repeat | US-030-AC1 | Fixture project run twice | Compare results | No difference |
| Seeded set | US-030-AC2 | One seeded and one clean fixture per check | Run set | Expected result for every fixture |
| No model | US-030-AC3 | Support record says supported; quotation absent from source | Run checks | Quotation fails |
| Model absent | US-030-AC4 | No model access | Run checks | Results unchanged |

## Dependencies

- **Stories**: US-022, US-023, US-024, US-025, US-029.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: CHK-13, CHK-14, CHK-15
- **PRD Requirements**: FR-34
- **External**: Pinned runtime and tools (ADR-004). Test automation is local and on release tags, advisory (ADR-007).

## Out of Scope

- Measuring support-verdict accuracy.
- Required CI.
