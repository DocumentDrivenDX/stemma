---
ddx:
  id: FEAT-013
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
    - stemma.feature-registry
---

# Feature Specification: FEAT-013 — Argument and geographic maps

**Feature ID**: FEAT-013
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 13. Argument and geographic maps
**Covered PRD Requirements**: FR-66, FR-67, FR-68, FR-81
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

This feature owns place records (FR-81) and projects two view-only maps from
the evidence graph: how an
argument holds together (FR-66) and where its evidence is (FR-67). It also keeps
exact coordinates of restricted sites out of the repository, maps, and exports
(FR-68).

## Ideal Future State

An author opens a chapter's argument map and sees its claims, what supports and
opposes them, the rival readings, the thesis, and the constructs, with
unverified links marked. They open the geographic map and see each place with
the source behind it and how certain its location is, including disagreement.
A restricted site never appears at its exact position, and a scan before release
reports coordinates that slipped into files or prose.

## Problem Statement

- **Current situation**: The family tools offer no argument or geographic map,
  according to a keyword search and reading of their vocabularies.
- **Pain points**: An author cannot see where an argument is thin or contested,
  or where its evidence lies. A site location can leak through a note, a figure,
  or an exported file.
- **Desired outcome**: Every mapped item traces to records, and seeded stray
  coordinates are reported before release.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Argument map | What supports or challenges this chapter? | A scoped, view-only projection of the argument |
| Places | What places does the book rest on, and which are restricted? | Place records, sourced location assertions, restriction marks |
| Geographic map | Where is the evidence, and how sure am I? | A view-only projection of sourced places with uncertainty |
| Restricted locations | What must not be located? | Coordinates outside the repository, safe display, release scan |

These location objects differ:

| Object | Meaning |
|--------|---------|
| Place | A graph record for a place connected to evidence |
| Location assertion | One source's statement of where a place is, with its uncertainty |
| Restricted coordinate | An exact coordinate of a restricted site; held outside the repository |
| Broad area | A coarse area that may stand in for a restricted site on a map or export |

## Task Model

N/A — the user stories name the tasks.

## Requirements

### Functional Requirements by Area

#### Place records (FR-81)

- PLC-01. The project must record each place with its names.
- PLC-02. Each location assertion must trace to a source and state its
  uncertainty.
- PLC-03. Each location must be able to carry a restriction mark. A location not
  marked restricted is public.
- PLC-04. The assistant may add place records, which take effect at once,
  marked unreviewed (FR-23). Anyone, the assistant included, may mark a location
  restricted, effective at once; only the author may make it public again
  through Stemma's commands. A direct file edit is not prevented (assumption,
  as in CONTRACT-001). The mark applies to a location; place names,
  gazetteer identifiers, relations, another public location, and prose can still
  disclose the site.

#### Argument map (FR-66)

- ARG-01. The system must show an argument map scoped to a chapter or a branch.
- ARG-02. The map must project claims, supporting evidence, opposing evidence,
  rival readings, the thesis, and constructs from the graph, using the ledger
  relations of FR-80. Rival readings come from claim records, such as those an
  audit records (FR-43); FR-26 is not required.
- ARG-03. The user must be able to tell these kinds of item and link apart
  without relying on color alone.
- ARG-04. The map must mark which links are unverified.
- ARG-05. The map must show only relations that records state; it must not infer
  support or opposition.
- ARG-06. The map must offer no editing.
- ARG-07. The user must be able to open the record behind a mapped item.

#### Geographic map (FR-67)

- GEO-01. The system must show a view-only geographic map of the places
  connected to the evidence, projected from the graph.
- GEO-02. Each location assertion must trace to a source.
- GEO-03. The map must show each location assertion's uncertainty.
- GEO-04. When sources disagree about a location, the map must show each
  assertion with its source and must not merge them into one position.
- GEO-05. The map must list places and assertions it cannot draw, with the
  reason.
- GEO-06. Viewing a map must send no network request, including for background
  map data.
- GEO-07. Background map data must be bundled, and its source and licence terms
  recorded.

#### Restricted locations (FR-68)

- LOC-01. Exact coordinates of restricted sites must be kept outside the
  repository. The agent may read them when a task needs them; the product must
  say that they then reach its model.
- LOC-02. The repository must hold no value, including a hash, that allows a
  restricted coordinate to be guessed.
- LOC-03. Maps and exports must show nothing or a broad area for a restricted
  site.
- LOC-04. Removal or generalization must happen before map or export data is
  written; hiding a value on screen is not enough.
- LOC-05. A release scan must report stray coordinates, including coordinates
  typed into prose, with the file and place of each finding.
- LOC-06. The release scan must state which file kinds and coordinate forms it
  checks. A clean result must not be presented as proof that no location leaks.
- LOC-09. A stray-coordinate finding must be a warning that gives the file and
  place and says that outputs can disclose the site; a packaged copy must not
  give the place. Like any finding, it is open until fixed or dismissed
  (FR-30). Structured restricted values stay excluded from outputs (LOC-04).
- LOC-08. A location not marked restricted must be treated as public and shown. The
  product must say, where places are recorded, that an unmarked site's position
  will be shown and exported.

### Non-Functional Requirements

- **Security**: In a seeded project, 0 restricted coordinates appear in map data,
  map output, or the repository after export from structured records.
- **Scan coverage**: The release scan reports every item in a seeded set that
  uses a coordinate form the scan states it checks.
- **Privacy**: 0 network requests while viewing a map.
- **Accessibility**: Maps meet WCAG (Web Content Accessibility Guidelines) 2.2
  level AA as part of the explorer. 100% of mapped items, links, uncertainty, and
  unverified marks have a text alternative reachable by keyboard.
- **Reliability**: The same records and tool versions give the same set of mapped
  items and links.
- **Performance**: N/A — no target is set; a map is scoped to a chapter or
  branch for readability.

## User Stories

- [US-105 — Record places, sourced locations, and restrictions](../user-stories/US-105-record-places-and-locations.md)
- [US-095 — Read a chapter argument map](../user-stories/US-095-read-a-chapter-argument-map.md)
- [US-096 — Map sourced and disputed places](../user-stories/US-096-map-sourced-and-disputed-places.md)
- [US-097 — Keep restricted sites off maps and exports](../user-stories/US-097-keep-restricted-sites-off-maps.md)
- [US-098 — Scan for stray coordinates before release](../user-stories/US-098-scan-for-stray-coordinates.md)

## Edge Cases and Error Handling

- **Scope with no claims**: The map says it is empty and why.
- **Missing thesis, constructs, or rival readings**: The map is shown without
  them and does not invent them. Constructs are optional (FR-60).
- **Location assertion with no source**: It is not drawn as established; the map
  lists it as untraced.
- **Place name that implies a restricted position**: Neither the map nor the
  scan can be assumed to detect it; the product states this limit.
- **Restricted-value store unavailable**: Maps and exports still build and show
  no exact restricted position.

## Success Metrics

N/A — requirement verification covers this feature.

## Constraints and Assumptions

- Delivery step M3. Maps are view-only; editing on maps is parked.
- Maps live inside the explorer (FEAT-012) and follow the
  `rights-and-permissions`, `honest-assurance`, and `a11y-wcag-aa` concerns.
- This feature owns the meaning of place records, location assertions, and
  restriction marks (FR-81). FEAT-011 owns their structure.
- **Risk**: A coordinate typed in prose can reach a book, preview, or reviewer
  package, because the scan only warns.
- **Risk**: Unmarked places are public. A restricted site that nobody marks is
  shown on maps and in exports and packages, and its coordinates can sit in the
  repository and its history. Marking it later does not recall what was shared.
- **Assumption**: LOC-02 and LOC-04 apply the `plain-file-graph` and
  `rights-and-permissions` concerns.
- **Unverified**: Prototype maps of 30 and 300 claims and 200 points rendered
  with synthetic data in headless Chromium on one macOS machine. The 300-claim
  map was too wide to read without scoping.
- **Unverified**: In a prototype, restricted coordinates did not leak from
  structured fields. They leaked when typed into prose, when misclassified as
  public, and through an unclassified place name.
- **Risk**: No scan detects every way to disclose a location. Images, git
  history, and text already sent to a hosted model are leak routes.
- **Risk**: A coarse background map may be too coarse for site-scale places, and
  its borders may matter to a press.

## Dependencies

- **Other features**: FEAT-005, FEAT-011, and FEAT-012 (required). FEAT-001
  supplies thesis and methodology inputs; FEAT-009 redacts or reports protected
  source material and warns of stray coordinates; FEAT-007 owns reports.
- **External services**: Map layout, projection, and background map data chosen
  in design. Map data, restricted-store, and scan interfaces belong in Contracts.
- **PRD requirements**: FR-66, FR-67, FR-68, FR-81 (P0, M3).

## Out of Scope

- Editing on maps.
- Online map tiles, geocoding, or gazetteer lookups during viewing.
- Satellite imagery and historical basemaps.
- Judging whether an argument is sound.
- Placing maps as printed figures in the book (FEAT-008 and FR-58).
- Package failure rules (FEAT-009, FR-46).

## Open Questions

- [ ] Which states make a link "unverified"? Blocks ARG-04; product owner.
- [ ] When is a broad area shown instead of nothing, and how broad may it be?
  Blocks LOC-03; product owner.
- [ ] What does the release scan cover? Blocks LOC-05; product owner.

- [ ] Is the default location of the outside coordinate store (CONTRACT-001 H)
  acceptable? Design owner.
