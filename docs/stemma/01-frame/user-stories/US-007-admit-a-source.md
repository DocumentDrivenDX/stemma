---
ddx:
  id: US-007
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-007: Admit a source with its file and provenance

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: STO-01, STO-02, STO-03
**PRD Requirements**: FR-6
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to add an article from my own collection and record where it came from
**So that** I can later show which exact copy my citations rest on.

## Context

Margit's corpus is a career-long collection. A citation rests on a held file, so the file, its hash, and its provenance are recorded together. The file is untrusted input.

## Walkthrough

1. Margit gives Stemma a PDF and says it is a publisher download of the version of record.
2. Stemma shows the provenance it will record and asks for anything missing.
3. Margit confirms admission.
4. Stemma stores the file, its content hash, and provenance, and shows the new source.

## Acceptance Criteria

- [ ] **US-007-AC1** — Given a file and its origin, when the author admits it, then the corpus holds the file, its content hash, and provenance giving origin, date, version, and who admitted it.
- [ ] **US-007-AC2** — Given an admitted source whose stored file was altered, when checks run, then the mismatch is reported and the file is not treated as the admitted copy.
- [ ] **US-007-AC3** — Given a file whose name or content tries to place output outside the project or to run code, when it is admitted or rejected, then nothing is written outside the intended locations and none of its content runs.
- [ ] **US-007-AC4** — Given an admitted file, when the project is inspected, then the file is in the private content-hash store, the repository holds only its reference, and the author has been told to back up the store.

## Edge Cases

- **Same hash already stored**: Stemma names the existing source and asks what to do.
- **A provenance value is unknown**: It is recorded as unknown, not guessed.
- **Unsupported file type**: Stemma reports it with the reason, records no extracted text, and does not mark the source as checked.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Admit | US-007-AC1 | Synthetic file hartwell-1998.pdf; origin "publisher download"; version "version of record"; admitted by the project author | Admit | File, hash, and four provenance values stored |
| Altered file | US-007-AC2 | One byte changed in the stored file | Run checks | Hash mismatch reported; dependents flagged |
| Hostile input | US-007-AC3 | Synthetic file with a path-traversal name and embedded script | Admit | No outside write; nothing executed; any rejection is explained |
| Private store | US-007-AC4 | Synthetic PDF | Admit; inspect repository and store | Reference in repository; file in store; backup stated |

## Dependencies

- **Stories**: US-001. In M1 the project may exist through takeover without the other setup records.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: STO-01, STO-02, STO-03
- **PRD Requirements**: FR-6
- **External**: Source record shape and admission interface belong to Contract artifacts.

## Out of Scope

- Searching for candidates and logging the search decision (FEAT-004).
- Rights fields (US-008).
- Text extraction (US-009).
