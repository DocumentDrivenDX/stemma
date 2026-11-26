---
ddx:
  id: US-096
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-013
---

# US-096: Map sourced and disputed places

**Feature**: FEAT-013 — Argument and geographic maps
**Feature Requirements**: GEO-01, GEO-02, GEO-03, GEO-04, GEO-05, GEO-06, GEO-07
**PRD Requirements**: FR-67
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to see the places tied to my evidence on a map with their sources and uncertainty
**So that** I can tell where evidence lies and where sources disagree, without the map implying certainty.

## Context

Idris is an archaeologist whose sources may locate one place differently. Each location assertion must trace to a source. Viewing must not contact a map service, because requests can disclose the area being studied.

## Walkthrough

1. Idris opens the geographic map.
2. It shows places connected to the evidence over bundled background data.
3. He selects a disputed place.
4. Both location assertions appear with their sources and uncertainty.

## Acceptance Criteria

- [ ] **US-096-AC1** — Given places connected to evidence, when Idris opens the map, then they are projected from the graph.
- [ ] **US-096-AC2** — Given a drawn location assertion, when he inspects it, then its source is shown.
- [ ] **US-096-AC3** — Given an assertion with no source, when the map renders, then it is listed as untraced and not drawn as established.
- [ ] **US-096-AC4** — Given an uncertain location, when the map renders, then its uncertainty is shown.
- [ ] **US-096-AC5** — Given two sources giving different locations, when the map renders, then both assertions appear separately with their sources.
- [ ] **US-096-AC6** — Given a place or assertion that cannot be drawn, when the map renders, then it is listed with the reason.
- [ ] **US-096-AC7** — Given a network monitor, when he views and moves the map, then no network request is sent.
- [ ] **US-096-AC8** — Given the bundled background data, when its record is inspected, then its source and licence terms are recorded.
- [ ] **US-096-AC9** — Given the map is open, when he tries to change a place, then the map offers no editing.
- [ ] **US-096-AC10** — Given keyboard and screen-reader use, when he reads the map, then places, sources, and uncertainty are available as text.

## Edge Cases

- **Coarse background data**: The map does not suggest site-level accuracy.
- **Place name with no coordinates**: It is listed, not positioned by guess.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Projection | US-096-AC1 | Synthetic places linked to claims | Open map | Places shown |
| Source | US-096-AC2 | Assertion from source `s-1` | Select | `s-1` shown |
| Untraced | US-096-AC3 | Assertion with no source | Render | Listed as untraced |
| Uncertainty | US-096-AC4 | Assertion with a 10 km uncertainty | Render | Uncertainty shown |
| Disputed | US-096-AC5 | Invented place located two ways by `s-1` and `s-2` | Render | Two assertions with sources |
| Undrawable | US-096-AC6 | Place with a name only | Render | Listed with reason |
| Offline | US-096-AC7 | Network monitor | Pan and zoom | Zero requests |
| Licence | US-096-AC8 | Background data record | Inspect | Source and licence present |
| View only | US-096-AC9 | Open map | Look for edit actions | None; records unchanged |
| Text | US-096-AC10 | Same map | Keyboard and screen reader | Text list complete |

## Dependencies

- **Stories**: US-087; US-094.
- **Feature Spec**: FEAT-013
- **Feature Requirements**: GEO-01, GEO-02, GEO-03, GEO-04, GEO-05, GEO-06, GEO-07
- **PRD Requirements**: FR-67
- **External**: Background map data chosen in design.

## Out of Scope

- Online tiles, geocoding, and gazetteer lookups.
- Restricted site display (US-097).
