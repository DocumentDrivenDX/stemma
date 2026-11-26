---
ddx:
  id: US-105
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-013
---

# US-105: Record places, sourced locations, and restrictions

**Feature**: FEAT-013 — Argument and geographic maps
**Feature Requirements**: PLC-01, PLC-02, PLC-03, PLC-04, LOC-08
**PRD Requirements**: FR-81
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to record each place with what each source says about where it is, and to mark the restricted ones
**So that** maps rest on sourced locations and I know which positions will be shown.

## Context

A place is public unless marked restricted. A restricted site nobody marks is shown and exported, and marking it later does not recall what was shared. Delivery step M3; who may propose and mark follows a PRD assumption.

## Walkthrough

1. Idris records a synthetic place with two names.
2. Idris adds a location from a source, with its uncertainty.
3. Stemma says an unmarked location will be shown and exported.
4. Idris marks a second site restricted.

## Acceptance Criteria

- [ ] **US-105-AC1** — Given a place, when it is recorded, then its names and its location assertions are kept, each assertion with a source and an uncertainty.
- [ ] **US-105-AC2** — Given a location not marked restricted, when it is recorded, then it is public and Stemma says its position will be shown and exported.
- [ ] **US-105-AC3** — Given a place the assistant adds, when the author has not reviewed it, then it is in effect and shown as unreviewed, and a location with no restriction mark is treated as public, which the product says when it records it.
- [ ] **US-105-AC4** — Given the assistant marks a location restricted, when the mark is saved, then it takes effect at once.
- [ ] **US-105-AC5** — Given a restricted location, when anyone but the author tries to make it public through Stemma's commands, then it stays restricted, and Stemma states that a direct file edit is not prevented.

## Edge Cases

- **Assertion with no source**: It is not treated as established.
- **Exact value already committed before marking**: Stemma says history and earlier exports may still hold it.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Record | US-105-AC1 | Place with 2 names; 1 sourced location | Save | All kept with source and uncertainty |
| Public default | US-105-AC2 | Unmarked location | Save | Public; disclosure stated |
| Unreviewed | US-105-AC3 | Assistant-added place | Build map | Shown as unreviewed |
| Restrict | US-105-AC4 | Assistant marks a location | Export | No exact position |
| Unrestrict | US-105-AC5 | Non-author change to public | Apply | Not applied by Stemma's commands; a direct file edit is not prevented |

## Dependencies

- **Stories**: US-019.
- **Feature Spec**: FEAT-013 — Argument and geographic maps
- **Feature Requirements**: PLC-01, PLC-02, PLC-03, PLC-04, LOC-08
- **PRD Requirements**: FR-81
- **External**: Place record shapes and the restricted store belong in Contracts.

## Out of Scope

- Map display (US-096) and keeping coordinates off maps (US-097).
- Detecting that a site ought to be restricted.
