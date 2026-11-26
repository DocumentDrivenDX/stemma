---
ddx:
  id: US-087
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-011
---

# US-087: Follow the evidence graph in plain record files

**Feature**: FEAT-011 — Evidence graph and graph engine
**Feature Requirements**: REC-01, REC-02, REC-03, REC-04, REC-05, REC-06, REC-07, INT-01, INT-02, INT-03, INT-04
**PRD Requirements**: FR-62
**Priority**: P0

## Story

**As a** Priya, the technologist-researcher
**I want** to read my project's records as plain files and follow their links
**So that** I can trace a claim to its source with ordinary tools and find every broken record by name.

## Context

Records are the source of truth and must outlive any tool. Legacy bibliography formats cannot hold passages, claims, or places. A silent drop or merge would make a trace look complete when it is not.

## Walkthrough

1. Priya opens the record file for a claim and reads it.
2. They follow its links to a note, a passage, and a source record.
3. After editing a file by hand, they load the graph.
4. Stemma names the link they broke, the file, and the reason, and does not present the graph as complete.

## Acceptance Criteria

- [ ] **US-087-AC1** — Given a fixture with one of each record kind in FR-62 and its references, when the graph loads, then each is a separate plain JSON file with a UMF definition for its type.
- [ ] **US-087-AC2** — Given a claim linked through a note and passage to a source, when Priya follows the links, then each link resolves to exactly one record.
- [ ] **US-087-AC3** — Given a record that does not match its definition, when the graph loads, then the failure names the file and reason.
- [ ] **US-087-AC4** — Given a duplicate identity or a dangling link, when the graph loads, then each is reported and none is silently merged or dropped.
- [ ] **US-087-AC5** — Given any load failure, when the graph is used, then it is not presented as complete.
- [ ] **US-087-AC6** — Given a record file with a duplicate key, when it is loaded, then it is rejected.
- [ ] **US-087-AC7** — Given the same record content, when it is written twice, then the two files have identical bytes.
- [ ] **US-087-AC8** — Given two record file names that differ only by case, or a Windows-reserved name, when records are validated on any system, then the names are rejected.
- [ ] **US-087-AC9** — Given seeded definitions that the graph's consumers reject, when validation runs, then each is reported, even when a UMF validator accepts it.
- [ ] **US-087-AC10** — Given records in an older format, when the migration runs twice, then the second run changes nothing.
- [ ] **US-087-AC11** — Given a record with a value preserved from a legacy file, when it is normalized for hashing, then the stored legacy value is unchanged.
- [ ] **US-087-AC12** — Given a takeover finding, an author's round choice, and an imported reviewer comment, when the graph loads, then each is a record in its own plain JSON file.

## Edge Cases

- **Merge conflict markers**: The file is named as unreadable.
- **Record type from a newer version**: It is reported and left unchanged.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| One file per record | US-087-AC1 | Synthetic project with all listed kinds | Load | Each record in its own JSON file with a definition |
| Trace | US-087-AC2 | Claim `c-1` to note to passage to source | Follow links | One record at each step |
| Bad field | US-087-AC3 | Claim whose confidence field has the wrong kind of value | Load | File and reason named |
| Dangling | US-087-AC4 | Note linked to a deleted source; two files with one identity | Load | Both problems reported |
| Incomplete | US-087-AC5 | Same fixture | Request the graph | Marked as not complete |
| Duplicate key | US-087-AC6 | File with `title` twice | Load | Rejected |
| Stable bytes | US-087-AC7 | One construct record | Write twice | Identical bytes |
| File names | US-087-AC8 | `Note-A.json` and `note-a.json`; `CON.json` | Validate | Rejected |
| Consumer rejection | US-087-AC9 | Seeded definition using a name the arras loader rejects | Validate | Reported |
| Migration | US-087-AC10 | Old-format fixture | Migrate twice | No change on second run |
| Legacy value | US-087-AC11 | Preserved field with composed and decomposed accents | Hash and reread | Stored value unchanged |
| New kinds | US-087-AC12 | One of each | Load | Three separate record files |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-011
- **Feature Requirements**: REC-01, REC-02, REC-03, REC-04, REC-05, REC-06, REC-07, INT-01, INT-02, INT-03, INT-04
- **PRD Requirements**: FR-62
- **External**: UMF. Record structures and the graph export belong in Contracts.

## Out of Scope

- What each record kind means and how it is reviewed.
- Legacy bibliography conversion (FEAT-003).
