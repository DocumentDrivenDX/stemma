---
ddx:
  id: US-095
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-013
---

# US-095: Read a chapter argument map

**Feature**: FEAT-013 — Argument and geographic maps
**Feature Requirements**: ARG-01, ARG-02, ARG-03, ARG-04, ARG-05, ARG-06, ARG-07
**PRD Requirements**: FR-66
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to open an argument map of one chapter or branch
**So that** I can see which claims are contested, which links are unverified, and what to examine next.

## Context

Idris keeps rival readings in every chapter. The map projects only what records state: ledger stances and claim relations (FR-80), including rival readings recorded by an audit. Which states make a link unverified is open. A large map is unreadable without scoping.

## Walkthrough

1. Idris opens the explorer and chooses a chapter's argument map.
2. The map shows the thesis, claims, supporting and opposing evidence, rival readings, and constructs.
3. Unverified links are marked.
4. He selects a claim and its record opens.

## Acceptance Criteria

- [ ] **US-095-AC1** — Given a chapter or branch with claims, when Idris opens its map, then only items in that scope and their stated connections appear.
- [ ] **US-095-AC2** — Given fixtures with claims, support, opposition, a rival reading, a thesis, and a construct, when the map renders, then each kind appears.
- [ ] **US-095-AC3** — Given the rendered map viewed without color, when he compares items and links, then the kinds remain distinguishable.
- [ ] **US-095-AC4** — Given an unverified link, when the map renders, then it is marked as unverified.
- [ ] **US-095-AC5** — Given two claims with no recorded relation, when the map renders, then no support or opposition link is drawn between them.
- [ ] **US-095-AC6** — Given the map is open, when he tries to change an item or link, then the map offers no editing and records stay unchanged.
- [ ] **US-095-AC7** — Given a mapped item, when he selects it, then its record opens.
- [ ] **US-095-AC8** — Given keyboard and screen-reader use, when he reads the map, then items, links, and unverified marks are available as text.
- [ ] **US-095-AC9** — Given a rival reading recorded by a chapter audit and no alternative-interpretations section, when the map opens, then the rival reading and its relation can be shown from records.

## Edge Cases

- **Empty scope**: The map says it has no claims.
- **No constructs or rival readings**: The map renders without inventing them.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Scope | US-095-AC1 | Two chapters of synthetic claims | Map chapter 2 | No chapter 1 only items |
| Kinds | US-095-AC2 | One item of each kind | Render | All appear |
| No color | US-095-AC3 | Grayscale view | Inspect | Kinds distinguishable |
| Unverified | US-095-AC4 | One unverified support link | Render | Marked unverified |
| No inference | US-095-AC5 | Two unrelated claims | Render | No link |
| View only | US-095-AC6 | Open map | Drag a link target; look for edit actions | No record changes |
| Open | US-095-AC7 | Claim node | Select | Claim record opens |
| Text | US-095-AC8 | Same map | Keyboard and screen reader | Text equivalent complete |
| Audit rival | US-095-AC9 | Rival reading from an audit | Open map | Shown with its relation |

## Dependencies

- **Stories**: US-090.
- **Feature Spec**: FEAT-013
- **Feature Requirements**: ARG-01, ARG-02, ARG-03, ARG-04, ARG-05, ARG-06, ARG-07
- **PRD Requirements**: FR-66
- **External**: FEAT-005 claim records. The projection data belongs in a Contract.

## Out of Scope

- Editing on maps.
- Judging argument strength.
- Print figures of maps.
