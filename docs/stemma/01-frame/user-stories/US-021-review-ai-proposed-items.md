---
ddx:
  id: US-021
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-005
    - stemma.prd
---

# US-021: Review AI-proposed items when I choose

**Feature**: FEAT-005 — Notes, claims, constructs
**Feature Requirements**: ACC-01, ACC-02, ACC-03, ACC-04
**PRD Requirements**: FR-23
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to use what the assistant proposes at once and review it whenever I like
**So that** my work is never held up and I can always tell what I have not looked at

## Context

Interpretation stays with the author, and review happens out of the line of writing. A review mark records what the author said; an agent or person with file access could write one.

## Walkthrough

1. Margit asks the assistant to take notes on an article.
2. The assistant records them, marked unreviewed, and carries on.
3. Later, Margit lists unreviewed items, marks one reviewed, and retires another.
4. Reports show what is still unreviewed.

## Acceptance Criteria

- [ ] **US-021-AC1** — Given an item the assistant proposed, when ledger-based work or checks run before any review, then the item is in effect and is shown as unreviewed.
- [ ] **US-021-AC2** — Given an unreviewed item, when the author marks it reviewed, then a dated review mark is recorded.
- [ ] **US-021-AC3** — Given an unreviewed item and no instruction from the author, when the assistant continues working, then it records no review mark and asks for none before continuing.
- [ ] **US-021-AC4** — Given a reviewed entry, when the assistant changes it, then it stays in effect and is unreviewed again; when the author edits it, then it stays reviewed.
- [ ] **US-021-AC5** — Given an explanation of a review mark, when Stemma describes it, then it says the record shows what was said and does not prove who wrote it.

## Edge Cases

- **Ambiguous reply such as "looks interesting"**: The assistant records no review mark.
- **Review of an extract that does not match**: Review does not change the failing check result.
- **Review mark written outside the agent**: Stemma cannot tell who wrote it.
- **The author retires an item that text relies on**: Reports show the text linked to a retired claim.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| At once | US-021-AC1 | Proposed claim | Use ledger and check | Used; shown unreviewed |
| Review | US-021-AC2 | Same item | Mark reviewed on 2026-04-02 | Marked and dated |
| No self-review | US-021-AC3 | Assistant asked only to draft | Continue | No mark; no request to review first |
| Changed | US-021-AC4 | Assistant rewords one reviewed claim; author rewords another | Check | Both in effect; the first unreviewed, the second reviewed |
| Limit | US-021-AC5 | Ask what review proves | Ask | Limit stated |

## Dependencies

- **Stories**: US-018, US-019, US-020 for the entry kinds; construct proposals arrive with M2.
- **Feature Spec**: FEAT-005 — Notes, claims, constructs
- **Feature Requirements**: ACC-01, ACC-02, ACC-03, ACC-04
- **PRD Requirements**: FR-23
- **External**: Review record shape belongs to Contract artifacts. Assistant behavior is model-dependent and needs recorded manual runs.

## Out of Scope

- Signed approval.
- Admitting candidate sources (FEAT-004).
