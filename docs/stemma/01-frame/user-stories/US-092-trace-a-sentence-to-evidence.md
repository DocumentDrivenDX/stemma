---
ddx:
  id: US-092
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-092: Trace a sentence to its evidence and back

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: TPG-01, TPG-02, TPG-03, TPG-04
**PRD Requirements**: FR-65
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** to select a sentence on a typeset page and see what supports it
**So that** I can check what a sentence rests on without searching through files.

## Context

Margit distrusts references she cannot trace. The link must work in both directions, and a sentence with no linked claim must not look supported. Typeset SVG (Scalable Vector Graphics) pages carry no readable text by themselves.

## Walkthrough

1. Margit opens a typeset page in the explorer.
2. She selects a sentence.
3. The explorer shows its claim, then the note, passage, and source.
4. From the passage she returns to the claim and then to the sentence on its page.

## Acceptance Criteria

- [ ] **US-092-AC1** — Given a project with typeset pages, when Margit opens the explorer, then the pages are shown.
- [ ] **US-092-AC2** — Given a sentence linked to a claim, when she selects it, then she reaches the claim and its evidence.
- [ ] **US-092-AC3** — Given a claim or passage linked to sentences, when she asks where it is used, then she reaches each linked sentence on its page.
- [ ] **US-092-AC4** — Given a sentence with no linked claim, when she selects or reviews it, then it is not shown as supported.
- [ ] **US-092-AC5** — Given keyboard and screen-reader use, when she moves from a sentence to evidence and back, then the same path works and page content has a text alternative.

## Edge Cases

- **Sentence split across lines or pages**: Every part leads to the same claim.
- **One sentence with several claims**: All are offered.
- **Link target removed**: The explorer reports the broken link.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Pages | US-092-AC1 | Synthetic chapter | Open explorer | Pages shown |
| Forward | US-092-AC2 | Sentence linked to claim `c-1` | Select it | Claim, note, passage, source reachable |
| Back | US-092-AC3 | Claim used in two sentences | Ask where used | Both sentences reachable |
| Unlinked | US-092-AC4 | Sentence with no claim | Select it | No support indicated |
| Keyboard | US-092-AC5 | Same chapter | Keyboard only, then screen reader | Path completes; page text available |

## Dependencies

- **Stories**: US-090.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: TPG-01, TPG-02, TPG-03, TPG-04
- **PRD Requirements**: FR-65
- **External**: FEAT-008 build output. The sentence-link data belongs in a Contract.

## Out of Scope

- How drafting records which sentence states which claim (FEAT-006).
- Judging whether the evidence supports the sentence.
