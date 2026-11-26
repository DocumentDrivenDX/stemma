---
ddx:
  id: US-058
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-058: Keep vector figures vector

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: IMG-04, IMG-05, IMG-06
**PRD Requirements**: FR-56
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to place maps and line drawings as vectors
**So that** they stay sharp in print and I hear about any part that would be lost or rasterized.

## Context

Some vector content disappears, changes font, or is rasterized without warning. Idris needs each such case reported.

## Walkthrough

1. Idris places an SVG map and a converted EPS plan.
2. The build places them as vectors.
3. Fonts are embedded or outlined.
4. A filter effect in one figure would be rasterized, and the build reports it.

## Acceptance Criteria

- [ ] **US-058-AC1** — Given a vector image that can stay vector, when the PDF is built, then it remains vector with fonts embedded or converted to outlines.
- [ ] **US-058-AC2** — Given a converted EPS image that cannot stay vector, when a build runs, then it is reported.
- [ ] **US-058-AC3** — Given a vector image with content that would be rasterized, dropped, or set in a substitute font, when a build runs, then the image and problem are reported.

## Edge Cases

- **SVG with embedded HTML labels**: Labels that would vanish are reported.
- **Placed PDF figure in a PDF/A output**: If the tool refuses it under that standard, the build says the tool could not produce the output and names the figure. This is a tool limit.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Vector | US-058-AC1 | SVG map with text | Build | Vector paths in PDF; fonts embedded or outlined |
| EPS | US-058-AC2 | EPS whose conversion yields raster content | Build | Reported |
| Missing font | US-058-AC3 | SVG naming an unsupplied font | Build | Reported |

## Dependencies

- **Stories**: US-057.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: IMG-04, IMG-05, IMG-06
- **PRD Requirements**: FR-56
- **External**: Pinned converters.

## Out of Scope

- Redrawing figures.
- Maps generated from the graph (FEAT-013).
