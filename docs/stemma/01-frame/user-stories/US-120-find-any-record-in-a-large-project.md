---
ddx:
  id: US-120
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-120: Find any record in a large project

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: SRV-08, SRV-09
**PRD Requirements**: FR-64
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** every record that matches a search to be reachable, however many there are
**So that** nothing in a project of thousands of sources is hidden from me by a result limit.

## Context

The offline explorer lists at most 50 matches, picked from the first 20 types,
and has no next page. The product owner requires that the browser is not limited
to a few dozen. The served explorer can search the whole project.

## Walkthrough

1. Margit opens the Search view and types a word. It says how many records match, and how many of each type.
2. She moves through the pages, or narrows to one type, and opens a record; Back returns her to the same page.
3. On a record with hundreds of links, she keeps choosing "Show more" until the last one is listed.
4. She types in the record browser's own search box. It lists the best matches and says how many there are in all.

## Acceptance Criteria

- [ ] **US-120-AC1** — Given a project, when she searches, then the matches are exactly the records whose search text holds every word, across diacritics, of every type shown, and the total and the count of each type are true.
- [ ] **US-120-AC2** — Given more matches than one page, when she goes through every page, then each match appears once, in one stable ranked order, and any numbered page can be opened.
- [ ] **US-120-AC3** — Given the record browser's own search box and more matches than it lists, then it says how many of how many it lists and where all are, and its type counts are true.
- [ ] **US-120-AC4** — Given a record with more than 100 links of one kind, in either direction, when she keeps asking for more, then every link is listed.
- [ ] **US-120-AC5** — Given text in Latin, Greek, Arabic, Japanese, or Thai script, and words of one or two characters, when she searches, then the matches are those a scan of the search text finds.
- [ ] **US-120-AC6** — Given a search request outside its bounds, or an answer past the size bound, then it is refused; and a search at the bounds stays within them.
- [ ] **US-120-AC7** — Given hostile text in records or in the search box, then it is shown as text.

## Edge Cases

- **Nothing matches**: The page says so, and what was searched.
- **A page past the end**: The page says there is no such page and leads to the last one.
- **The records change while she pages**: The page takes down what it showed and loads the new data at the same route.
- **Source page text**: Not searched, and the Search view says so.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Completeness | US-120-AC1 | Synthetic project | Many queries; compare with a brute-force scan | Same matches and counts |
| Every page | US-120-AC2 | A broad query | Read every page | Each match once |
| arras's box | US-120-AC3 | A broad query | Type it | Counts and numbers stated |
| Every link | US-120-AC4 | A record with 260 links | Show more to the end | 260 listed |
| Scripts | US-120-AC5 | Mixed-script records | Search | As the scan |
| Bounds | US-120-AC6 | Crafted requests | Send | Refused or bounded |
| Hostile | US-120-AC7 | Markup in titles and queries | Search | Shown as text; nothing runs |

## Dependencies

- **Stories**: US-090; US-119.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: SRV-08, SRV-09
- **PRD Requirements**: FR-64
- **External**: arras static client and browser.

## Out of Scope

- Searching source page text, manuscript files, or research notes.
- Search in the offline file beyond arras's limits.
