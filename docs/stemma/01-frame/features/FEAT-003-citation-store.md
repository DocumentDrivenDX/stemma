---
ddx:
  id: FEAT-003
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.principles
    - stemma.concerns
    - FEAT-002
---

# Feature Specification: FEAT-003 — Citation store

**Feature ID**: FEAT-003
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 3. Citation store
**Covered PRD Requirements**: FR-11, FR-12, FR-13, FR-14, FR-15
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

The citation store is the project's official bibliography, held as Stemma records without an external reference manager (PRD FR-11). It provides citation keys and typed locators, and exchanges legacy libraries (FR-12 to FR-15).

## Ideal Future State

An author reads and builds the whole bibliography from the project. Each in-text citation names a stable key and says what kind of locator it uses. A library brought in from another tool can go back out in the same format with its information intact. Every build names any entry listed for the bibliography that the text never cites.

## Problem Statement

- **Current situation**: Bibliographies live in reference managers, word-processor fields, and hand-kept lists.
- **Pain points**: Tools drop fields and comments in transit, untyped locators confuse pages with folios or chapters, and uncited entries survive into the book.
- **Desired outcome**: One plain-text record per source is the authority, with no information lost in a same-format round trip.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Records and types | Where is my bibliography, and can it describe my sources? | One owned record per source |
| Exchange | Can I bring libraries in and send them back? | Lossless same-format round trip |
| Citing | How does the text point to a source and place? | Stable keys, typed locators, style setting |
| Bibliography completeness | Is every listed work cited? | Report uncited entries |

## Requirements

### Functional Requirements by Area

Domain terms: the **corpus** holds stored sources (FEAT-002). A **bibliography record** describes one source. A **built bibliography** is the list printed in a build; a corpus source need not appear in it. A **legacy library** is a BibLaTeX, CSL-JSON (Citation Style Language data), or RIS (a tagged reference format) file.

#### Records and types

REC-01 (FR-11, P0, M1). Stemma records must be the official bibliography: plain text owned by the project, one record per source.

REC-02 (FR-11, P0, M1). Creating, reading, and building the bibliography must need no external reference manager.

REC-03 (FR-12, P0, M1). Records must support the source types of the supported fields, including books, chapters, articles, theses, reports, archives, datasets, web pages, and code, with the information each type needs.

#### Exchange

XCH-01 (FR-13, P0, M1). Importing a BibLaTeX, CSL-JSON, or RIS library and exporting the same format must keep all of its information, including unrecognized fields and comments.

XCH-02 (FR-13, P0, M1). Layout, field order, shortcuts, and comment positions may change in a same-format round trip; values and comment text must not be lost.

XCH-03 (FR-13, P0, M1). Exporting Stemma data to a legacy format may omit only what that format cannot hold.

XCH-04 (FR-13, P0, M1). A library that cannot be read completely must be reported with the affected entries; no entry may be dropped silently.

#### Citing

KEY-01 (FR-14, P0, M1). In-text citations must use keys that stay stable and identify one record.

KEY-02 (FR-14, P0, M1). A locator must carry a type, so that a page, folio, chapter, or other kind of place stays distinct.

KEY-03 (FR-14, P0, M1). The citation style must be a project setting, and changing it must not require editing in-text citations.

#### Bibliography completeness

BIB-01 (FR-15, P0, M1). Each entry in a built bibliography must be cited in the text. The built bibliography is made from cited sources plus any source the project lists for inclusion (CONTRACT-006).

BIB-02 (FR-15, P0, M1). Every build must report an uncited listed entry by name until it is cited, removed from the list, or dismissed with an annotation bound to that entry and its current content (FR-32).

BIB-03 (FR-15, P0, M1). The corpus may hold sources the book does not cite; they must not cause that failure.

### Non-Functional Requirements

- **Reliability**: For each seeded round-trip library, a comparison of imported and re-exported information reports zero lost values and zero lost comments.
- **Security**: A library is untrusted input. Import executes nothing in it, including LaTeX macros.
- **Portability**: The same library imports to the same records on macOS, Linux, and Windows. Untested on Linux and Windows.

## User Stories

- [US-013 — Keep the bibliography in the project](../user-stories/US-013-own-the-bibliography.md)
- [US-014 — Record sources of many types](../user-stories/US-014-record-varied-source-types.md)
- [US-015 — Exchange a legacy library without loss](../user-stories/US-015-exchange-legacy-libraries.md)
- [US-016 — Cite with stable keys and typed locators](../user-stories/US-016-cite-with-typed-locators.md)
- [US-017 — Find uncited bibliography entries](../user-stories/US-017-find-uncited-entries.md)

## Edge Cases and Error Handling

- **Key collision on import**: Report both entries; do not overwrite or merge without the author's choice.
- **Possible duplicate works**: Propose the match; never merge automatically.
- **Source type outside the listed types**: Keep all its information and report that the type is not recognized.
- **Record without a stored copy**: The record may exist, for example after import, but a citation of it is reported as unchecked (FEAT-002 CIT-01).
- **Renamed key**: In-text citations that use the earlier key are never left to point at a different record.

## Constraints and Assumptions

- Records are canonical JSON files defined in UMF, the DocumentDrivenDX schema format (ADR-002); exact fields, key syntax, locator types, and loss reporting belong to Contract artifacts.
- **Risk**: a feasibility test on one system, using its own parsers, found that same-format round trips lost information unless native values were retained. Libraries saved by real tools are untested, including the independent reading of RIS output.
- citeproc-js formats citations (ADR-005). Its license review is open, and it did not produce every tested Chicago note form.
- Only Chicago notes and bibliography is guaranteed in the first version (FR-38, FEAT-008).

- Assumption (PRD): only a listed source can be an uncited entry. Takeover lists every entry of the original reference list (FR-72).
- Every legacy export produces a loss report (CONTRACT-003 E).

## Dependencies

- **Other features**: FEAT-002 for stored copies; FEAT-011 for records; FEAT-007 for the scripted checks and reports; FEAT-008 for formatting and building; FEAT-015 for takeover input.
- **External services**: None required. Citation formatting depends on a pinned processor. Exact interfaces belong to Contract artifacts.
- **PRD requirements**: FR-11 to FR-15 (P0, M1). The takeover pilot needs FR-15 in M1, because takeover lists the whole original reference list (FR-72).

## Out of Scope

- Word manuscript reading and embedded reference-manager fields (FEAT-015).
- Resolver checks of authors, titles, and identifiers (FEAT-007).
- Printed bibliography layout and approval of style examples (FEAT-008).
- Guaranteed styles other than Chicago notes and bibliography.
- Synchronizing with a reference manager.
