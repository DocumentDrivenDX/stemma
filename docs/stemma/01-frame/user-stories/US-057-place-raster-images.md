---
ddx:
  id: US-057
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-057: Place raster images at print quality

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: IMG-01, IMG-02, IMG-03, IMG-09
**PRD Requirements**: FR-55
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to place my photographs and scans and be told when one will print poorly
**So that** I see every image below the print threshold before I publish.

## Context

Idris's book has site photographs. The build must place the pixels as supplied and measure resolution at the placed size.

## Walkthrough

1. Idris places a PNG and a TIFF photograph.
2. The build converts the TIFF by a recorded step.
3. It reports each image's effective resolution at its placed size.
4. The TIFF is below the threshold, so the build reports it and names it.
5. Idris reduces its placed size and rebuilds.

## Acceptance Criteria

- [ ] **US-057-AC1** — Given a raster image, when it is placed, then it is not resampled.
- [ ] **US-057-AC2** — Given placed raster images, when a build runs, then each image's effective resolution at placed size is reported.
- [ ] **US-057-AC4** — Given a TIFF or EPS image, when a build places it, then a recorded conversion step precedes placement and the original is unchanged.
- [ ] **US-057-AC6** — Given an image below the project's print threshold, when any build runs, then the image and its effective resolution are reported with a suggested action.

## Edge Cases

- **Conversion would lose color or bit depth**: The loss is reported.
- **No pinned converter for EPS**: The build names the missing tool.
- **Low resolution reaches the finished book**: This can happen, because the finding only reports.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| No resample | US-057-AC1 | 3000 by 2000 PNG | Build | Embedded image is 3000 by 2000 |
| Report | US-057-AC2 | 1200 pixel wide image placed 6 inches wide | Build | Reports 200 pixels per inch |
| TIFF | US-057-AC4 | RGB TIFF | Build | Conversion recorded; original hash unchanged |
| Report only | US-057-AC6 | Threshold set to 300; one image at 200 pixels per inch | Camera-ready | PDF built; the image is reported |

## Dependencies

- **Stories**: US-052.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: IMG-01, IMG-02, IMG-03, IMG-09
- **PRD Requirements**: FR-55
- **External**: Pinned image converters. Interface surface belongs in Contract artifacts.

## Out of Scope

- Upscaling or editing images.
- The default threshold value.
