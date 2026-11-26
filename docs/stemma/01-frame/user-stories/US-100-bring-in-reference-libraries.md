---
ddx:
  id: US-100
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-015
---

# US-100: Bring in reference libraries

**Feature**: FEAT-015 — Takeover of existing projects
**Feature Requirements**: INT-02, INT-03, INT-05, INT-06, INT-07, INT-08, GRF-02
**PRD Requirements**: FR-71, FR-72
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities
**I want** to take over my reference manager's exported libraries with my manuscript
**So that** I keep the references I already collected and my library files stay as they were.

## Context

Tomasz relies on a reference manager and fears a method that breaks his workflow. Takeover reads BibLaTeX, CSL-JSON, and RIS libraries; whether information survives a round trip is FEAT-003 behavior. Library entries can themselves be wrong, so they enter unverified. FR-72 is included only because reading a library
and marking its entries unverified happen in the same step.

## Walkthrough

1. Tomasz exports a library from his reference manager.
2. He includes it in takeover.
3. Stemma reads it, reports entries it could not read, and builds unverified references.
4. His library file is unchanged.

## Acceptance Criteria

- [ ] **US-100-AC1** — Given a BibLaTeX library, when takeover reads it, then its entries become unverified references.
- [ ] **US-100-AC2** — Given a CSL-JSON library, when takeover reads it, then its entries become unverified references.
- [ ] **US-100-AC3** — Given a RIS library, when takeover reads it, then its entries become unverified references.
- [ ] **US-100-AC4** — Given any of these libraries, when takeover completes, then the library file's content hash is unchanged.
- [ ] **US-100-AC5** — Given a library with a malformed entry, when takeover reads it, then the entry is reported with its location and is not silently dropped.
- [ ] **US-100-AC6** — Given a library format and producing tool without passing real-file tests, when he reads the support statement, then it is not promised as supported.

## Edge Cases

- **Same work in two libraries**: Candidates are shown to the author and not merged silently.
- **Unreadable file**: A named failure results.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| BibLaTeX | US-100-AC1 | Synthetic `.bib` with 3 entries | Take over | 3 unverified references |
| CSL-JSON | US-100-AC2 | Synthetic file with 3 items | Take over | 3 unverified references |
| RIS | US-100-AC3 | Synthetic file with 3 records | Take over | 3 unverified references |
| Unchanged | US-100-AC4 | All three files | Hash before and after | Equal |
| Malformed | US-100-AC5 | `.bib` with one unclosed entry | Take over | Reported with location |
| Support | US-100-AC6 | No real-file test for a producer | Read statement | Listed as untested |

## Dependencies

- **Stories**: US-099.
- **Feature Spec**: FEAT-015
- **Feature Requirements**: INT-02, INT-03, INT-05, INT-06, INT-07, INT-08, GRF-02
- **PRD Requirements**: FR-71, FR-72
- **External**: FEAT-003 owns library import fidelity and export (FR-13).

## Out of Scope

- Export back to legacy formats.
- Synchronizing with a reference manager.
