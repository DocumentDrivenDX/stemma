---
ddx:
  id: US-065
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-065: Run a fresh-eyes review

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: REV-04
**PRD Requirements**: FR-44
**Priority**: P1

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to have a chapter reviewed in a context separate from the one that drafted it
**So that** the review is not steered by the drafting conversation.

## Context

A drafting session tends to agree with itself. Margit wants a reader that starts from the chapter, without managing sessions herself.

## Walkthrough

1. Margit asks for a fresh-eyes review.
2. The assistant runs it in a context separate from drafting.
3. The review reports its findings and states what it was given.
4. Margit decides what to act on.

## Acceptance Criteria

- [ ] **US-065-AC1** — Given a drafted chapter, when a fresh-eyes review runs, then it runs in a context separate from the drafting context.
- [ ] **US-065-AC2** — Given a host where a separate context cannot be provided, when the review is requested, then no result is reported as a fresh-eyes review.

## Edge Cases

- **Review disagrees with the audit**: Both are shown; the author decides.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Separate | US-065-AC1 | Chapter drafted in session A | Request review | Review context contains no drafting conversation; its inputs are listed |
| Unavailable | US-065-AC2 | Host without a separate context | Request review | States it cannot run a fresh-eyes review |

## Dependencies

- **Stories**: US-045.
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: REV-04
- **PRD Requirements**: FR-44
- **External**: A host that can provide a separate context (unverified per host).

## Out of Scope

- Claim-support checks (FEAT-007).
- Human peer review.
