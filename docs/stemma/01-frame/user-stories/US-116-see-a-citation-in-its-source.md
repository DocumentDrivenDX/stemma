---
ddx:
  id: US-116
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-116: See a citation in its source

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: SRC-01, SRC-02, SRC-03, SRC-04
**PRD Requirements**: FR-64, FR-61
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** to open a citation and see its words marked on the page of its source
**So that** I can read them in their surroundings and judge them myself.

## Context

A quotation lifted from its page can mislead. The page text Stemma holds is
converted or recognized text, so it can be wrong, and a marked passage looks
authoritative. A mark that may be on the wrong words is worse than none.

## Walkthrough

1. Margit opens a citation in the explorer, or asks the agent to show it.
2. She sees the sentence that cites, the work, the printed page, and the page text
   with the quotation marked.
3. She reads how the text was made, what was compared or reviewed, and where the
   original came from.
4. When the text no longer agrees with the records, she sees why nothing is
   marked.

## Acceptance Criteria

- [ ] **US-116-AC1** — Given a citation with a passage that agrees with it, when Margit opens it, then she sees its sentence, its quotation marked in the source page's text, and the printed page label.
- [ ] **US-116-AC2** — Given a changed page, a damaged or missing source file, an address that is not valid, or a citation that disagrees with its passage, when she opens it, then nothing is marked and the reason is named.
- [ ] **US-116-AC3** — Given a citation with no passage, when she opens it, then the source and the cited place are named and nothing is marked.
- [ ] **US-116-AC4** — Given any source view, when she reads it, then it says the text is converted or recognized, shows its recorded quality, and presents no review or comparison as proof.
- [ ] **US-116-AC5** — Given a recorded original, when she reads the view, then it names the original without a local path, and viewing sends no request.
- [ ] **US-116-AC6** — Given the same question to the agent, when it runs `excerpt`, then the source text is marked as quoted data, the quotation is marked inside it, and the excerpt limits hold.

## Edge Cases

- **A quotation across pages**: Each page's piece is marked, in order.
- **A quotation in a footnote**: The notes text of the page is shown and marked.
- **A source with no pages**: A bounded stretch around the quotation is shown, and the view says text was trimmed.
- **Hostile source text**: It is shown as text.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Highlight | US-116-AC1 | Worked example citation, local file, offline | Open it | Sentence, mark, page label |
| Changed | US-116-AC2 | Page edited and sealed after capture | Open the citation | No mark; `changed` |
| Differs | US-116-AC2 | Citation locator unlike its passage | Open it | No mark; `citation_differs` |
| No passage | US-116-AC3 | Citation without a passage | Open it | Source and place named |
| Honest quality | US-116-AC4 | Model review with flags | Open it | Shown as a flag only |
| Original | US-116-AC5 | Original recorded with a local path | Open it | Path withheld; no request |
| Agent | US-116-AC6 | Six cited pages | `excerpt` | Refused; no source text |

## Dependencies

- **Stories**: US-090; US-112.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: SRC-01, SRC-02, SRC-03, SRC-04
- **PRD Requirements**: FR-64, FR-61
- **External**: None.

## Out of Scope

- Opening or highlighting an original or a page image.
- Manuscript occurrences of a citation.
- Judging whether the source supports the sentence.
