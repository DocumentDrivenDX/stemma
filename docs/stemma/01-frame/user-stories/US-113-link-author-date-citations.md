---
ddx:
  id: US-113
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-015
---

# US-113: Link author-date citations to the chapter's reference list

**Feature**: FEAT-015 — Takeover of existing projects
**Feature Requirements**: ADC-01, ADC-02, ADC-03, ADC-04, ADC-05, ADC-06, ADC-07, ADC-08, CPY-01, CPY-02
**PRD Requirements**: FR-73, FR-92
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities
**I want** takeover to connect the citations I typed in author-date form to my reference lists, and to tell me about every one it could not
**So that** the checks cover what I actually cite, and no citation is attached to a work I did not mean.

## Context

Many manuscripts hold no reference-manager data: citations are ordinary text such as "(Adair 2017)", and each chapter ends with its own list. Without linking, listed works would be reported as never cited and the citations would go unchecked. A wrong link is worse than a missing one, so only a fixed rule links, and only on one match. Linking verifies nothing about the cited work.

## Walkthrough

1. Tomasz takes over a chapter that cites in author-date form.
2. Stemma reads the chapter's reference list and finds the citations in the text.
3. It links each citation that exactly one entry matches and writes it as a marker in the Stemma copy.
4. It reports the rest: unresolved citations with their candidates, and parentheses it left unlinked with the reason.
5. Checks run from the Stemma copy.

## Acceptance Criteria

- [ ] **US-113-AC1** — Given reference lists under a references or bibliography heading, with the year after the authors or near the end, when takeover reads them, then each entry's authors, year, and suffix are read, the entry is kept as found, and an unreadable entry is listed.
- [ ] **US-113-AC2** — Given grouped, multi-year, and narrative citations, lead-ins, and page ranges, when takeover reads them, then each work cited is a separate citation item with its prefix and page locator.
- [ ] **US-113-AC3** — Given a solo entry and a co-authored entry by the same first author in the same year, when each citation form appears, then each links only to the entry with those authors.
- [ ] **US-113-AC4** — Given a citation that no entry or more than one entry in its chapter's list matches, when takeover runs, then it is reported as unresolved with any candidates, and no source is linked to it.
- [ ] **US-113-AC5** — Given a matching entry only in another chapter's list, when takeover runs, then it is shown as a candidate and not linked.
- [ ] **US-113-AC6** — Given an entry takeover could not read that names the cited author and year, when another entry matches, then the citation stays unresolved.
- [ ] **US-113-AC7** — Given a range of dates in parentheses, when takeover runs, then no citation is made and it is listed as left unlinked with that reason.
- [ ] **US-113-AC8** — Given any manuscript, when takeover completes, then every parenthesis that holds a year, in body text, notes, and tables, is linked, unresolved, or listed with its location and reason, in the project files.
- [ ] **US-113-AC9** — Given a linked citation, when the Stemma copy and records are inspected, then the marker carries its locator and prefix, its original text and position are kept, and the original file is unchanged.
- [ ] **US-113-AC10** — Given a taken-over chapter, when checks run, then the citation, source, quotation, page, figure, and uncited-entry checks read the Stemma copy, and a listed entry cited in author-date form is not reported as uncited.
- [ ] **US-113-AC11** — Given the same files and tool versions, when takeover runs into two empty projects, then the links, the unlinked list, and the check results are the same, and no model call decides any of them.

## Edge Cases

- **No reference list**: Every author-date citation is unresolved, and the report says no list was found.
- **Several matches**: All are shown as candidates for the author to choose from.
- **A year with no author before it**: It is listed as left unlinked; it is never given an author from further away.

## Test Scenarios

All text is invented. It copies the patterns of real manuscripts, not their words.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Two layouts | US-113-AC1 | Entries with the year after the author and near the end; one with no year | Take over | Both layouts read; the third listed |
| Forms | US-113-AC2 | `(cf. Adair 2017: 14–19; Brel 1999, 2003)` and `Corso (2001)` | Take over | 4 items; prefix and range kept |
| Look-alikes | US-113-AC3 | `(Adair 2017)` and `(Adair et al. 2017)`, two entries | Take over | Each links to its own entry |
| Missing | US-113-AC4 | `(Dunmore 1997)` with no such entry | Take over | Unresolved; no source linked |
| Other list | US-113-AC5 | The entry is only in another chapter's list | Take over | Shown as candidate; not linked |
| Unread entry | US-113-AC6 | One readable and one unreadable `Adair … 2017` entry | Take over | Unresolved with both |
| Dates | US-113-AC7 | `(1516–1850)` and `(c. 1600–1850)` | Take over | Both listed as date ranges |
| Accounting | US-113-AC8 | Seeded set with known count, some in a table and a note | Take over | Linked, unresolved, and listed together equal the count |
| Marker | US-113-AC9 | A linked citation with a page | Inspect; hash original | Marker, original text, and position present; hash equal |
| Checks | US-113-AC10 | One wrong quotation; one entry cited only in author-date form | Check | Quotation fails; entry not uncited |
| Repeat | US-113-AC11 | Same files | Take over twice | Same results |

## Dependencies

- **Stories**: US-099.
- **Feature Spec**: FEAT-015
- **Feature Requirements**: ADC-01, ADC-02, ADC-03, ADC-04, ADC-05, ADC-06, ADC-07, ADC-08, CPY-01, CPY-02
- **PRD Requirements**: FR-73, FR-92
- **External**: FEAT-007 (checks). The matching rules are CONTRACT-003 H; markers are CONTRACT-006.

## Out of Scope

- Verifying that a linked work says what the sentence says.
- Typesetting in an author-date style.
- Author-date forms the matching profile does not define; they are listed.
