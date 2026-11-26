---
ddx:
  id: US-056
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-056: Send a co-author an editable format (deferred)

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: OUT-04
**PRD Requirements**: FR-40
**Priority**: P2

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to produce a Word, LaTeX, or HTML version from the same source
**So that** co-authors and publishers can review the text without my maintaining a second copy.

## Context

Deferred past v1. Tomasz's co-authors use Word or LaTeX. Which formats ship and what each keeps is decided when the work is taken up, so each output must say what it loses.

## Walkthrough

1. Tomasz requests a reviewer-friendly format.
2. The build produces it from the same source files.
3. It reports content or formatting that the format does not keep.
4. Tomasz sends it to a co-author.

## Acceptance Criteria

- [ ] **US-056-AC1** — Given manuscript source, when a supported reviewer-friendly format is requested, then it is produced from the same source as the PDF.
- [ ] **US-056-AC2** — Given content the format cannot keep, when it is produced, then the loss is reported.
- [ ] **US-056-AC3** — Given open findings, when a draft in that format is requested, then it is marked unverified and comes with the report.

## Edge Cases

- **Unsupported format**: The tool says which formats are supported.
- **Returned edits from a co-author**: They are not applied automatically.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Same source | US-056-AC1 | 2-chapter fixture | Export | Text matches the source chapters |
| Loss | US-056-AC2 | Chapter with index entries the format cannot hold | Export | Loss reported |
| Marked | US-056-AC3 | 1 failing check | Export draft | Marked unverified with report |

## Dependencies

- **Stories**: US-052, US-055.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: OUT-04
- **PRD Requirements**: FR-40
- **External**: Converters chosen in design.

## Out of Scope

- Importing co-author edits.
- Choosing which formats ship.
