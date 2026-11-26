---
ddx:
  id: US-066
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-066: Generate an AI-use disclosure

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: REL-01, REL-02, REL-03
**PRD Requirements**: FR-45
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to generate an AI-use disclosure from my project's records
**So that** I can tell a publisher accurately what the AI did and what the record cannot show.

## Context

Disclosure written from memory is incomplete. It must state its limits and stay apart from the research methodology.

## Walkthrough

1. Idris requests the disclosure.
2. The system reads records of models, rules, AI actions, review marks, open findings, and annotations.
3. It produces a disclosure with the two stated limits and any gaps.
4. Idris reads it before sending it.

## Acceptance Criteria

- [ ] **US-066-AC1** — Given records of models, rules, and AI actions, when the disclosure is generated, then it states which models and rules were used and what the AI did.
- [ ] **US-066-AC2** — Given unreviewed items, open findings, and a current annotation, when the disclosure is generated, then it states the unreviewed and open counts and lists the annotation.
- [ ] **US-066-AC3** — Given any project, when the disclosure is generated, then it states that support verdicts were not rerun at build and that review marks and annotations are not forgery-proof.
- [ ] **US-066-AC4** — Given a project with a research methodology, when the disclosure is generated, then it is separate from the methodology.
- [ ] **US-066-AC5** — Given a record gap, when the disclosure is generated, then the unknown is stated rather than filled in.

## Edge Cases

- **No recorded AI use**: It says no AI use is recorded, not that none occurred.
- **Ended annotation**: It is not listed as applying to current text.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Models | US-066-AC1 | Records name 1 model, rules R-1 and R-3, drafting | Generate | All listed |
| State | US-066-AC2 | 3 unreviewed, 2 open, 1 dismissal | Generate | Counts and annotation listed |
| Limits | US-066-AC3 | Any project | Generate | Both limit statements present |
| Separate | US-066-AC4 | Methodology present | Generate | Methodology text not merged |
| Gap | US-066-AC5 | A draft record with no model identity | Generate | Model shown as unknown |

## Dependencies

- **Stories**: US-047 (marks, when present).
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: REL-01, REL-02, REL-03
- **PRD Requirements**: FR-45
- **External**: FEAT-001 rules; FEAT-007 annotation records. Interface surface belongs in Contract artifacts.

## Out of Scope

- Publisher-specific forms.
- Judging whether the use is permitted.
