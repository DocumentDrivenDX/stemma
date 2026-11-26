---
ddx:
  id: US-053
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-053: Typeset right-to-left quotations and multiple scripts

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: STR-03, STR-04
**PRD Requirements**: FR-37
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to typeset right-to-left quotations and passages in other scripts, with transliteration, inside a left-to-right book
**So that** my multilingual sources print readably and in the right order.

## Context

Tomasz quotes interview material in several scripts. Feasibility tests found silent font fallback and misplaced footnote markers, so these must be caught.

## Walkthrough

1. Tomasz adds an Arabic quotation with a footnote and its transliteration.
2. Tomasz builds a draft.
3. The quotation runs right to left, the footnote marker sits correctly, and the transliteration appears beside it.
4. A missing font is reported by name.

## Acceptance Criteria

- [ ] **US-053-AC1** — Given right-to-left text inside a left-to-right book, when it is built, then it displays in its writing direction with footnote markers on the correct side.
- [ ] **US-053-AC2** — Given text with transliteration diacritics, when it is built, then every character renders in the configured fonts.
- [ ] **US-053-AC3** — Given a script the configured fonts do not cover, when a build runs, then the gap is reported and no fallback is silent.

## Edge Cases

- **Right-to-left main text**: Experimental in v1 and not promised.
- **Mixed numbers and punctuation**: Layout errors found are recorded as defects, not hidden by manual page edits.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Direction | US-053-AC1 | English paragraph with Arabic quotation and footnote | Build | Correct direction and marker side |
| Transliteration | US-053-AC2 | Word with ʿayn and macron letters | Build | All glyphs in configured fonts |
| Gap | US-053-AC3 | Hebrew text, fonts without Hebrew | Build | Reported |

## Dependencies

- **Stories**: US-051.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: STR-03, STR-04
- **PRD Requirements**: FR-37
- **External**: Typst and configured fonts.

## Out of Scope

- Translation.
- A promise for right-to-left main text.
