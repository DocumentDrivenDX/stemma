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

# US-007: Capture a source with its provenance

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: STO-01, STO-02, STO-03
**PRD Requirements**: FR-6
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to add an article from my own collection or a library and record where it came from
**So that** I can later show which exact original my citations rest on, and anyone with my repository can read the text.

## Context

A citation rests on the text of a source captured in the project and tied to its original. The original is untrusted input and is not committed.

## Walkthrough

1. Margit gives Stemma a PDF and says it is a publisher download of the version of record.
2. Stemma converts it into source files and records the original's hash and size, where it came from, and when.
3. Margit sees the new source files in her project; the PDF is not among them.

## Acceptance Criteria

- [ ] **US-007-AC1** — Given a file and its origin, when it is captured, then source files hold its whole text, and the original's hash, size, origin, version, acquisition time, and who captured it are recorded.
- [ ] **US-007-AC2** — Given a captured source, when the repository is inspected, then it holds no binary of the source.
- [ ] **US-007-AC3** — Given a file whose name or content tries to place output outside the project or to run code, when it is captured, then nothing is written outside the project and none of its content runs.
- [ ] **US-007-AC4** — Given a library that refuses an automated fetch, when capture runs, then the refusal is reported with what to supply, and no other route is tried.

## Edge Cases

- **Same original already captured**: Stemma names the existing source file and asks what to do.
- **A provenance value is unknown**: It is recorded as unknown, not guessed.
- **Unsupported file type**: Stemma reports it with the reason and writes no source file.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Capture | US-007-AC1 | Synthetic file hartwell-1998.pdf; origin "publisher download" | Capture | Source files and every provenance value saved |
| No binary | US-007-AC2 | Same project | List the repository | Only text and record files |
| Hostile input | US-007-AC3 | Synthetic file with a path-traversal name and embedded script | Capture | No outside write; nothing executed; any rejection explained |
| Refused fetch | US-007-AC4 | A server that answers with a refusal | Capture by address | Refusal reported; no retry elsewhere |

## Dependencies

- **Stories**: US-001. In M1 the project may exist through takeover without the other setup records.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: STO-01, STO-02, STO-03
- **PRD Requirements**: FR-6
- **External**: Source file format (CONTRACT-007) and commands (CONTRACT-002).

## Out of Scope

- Searching for candidates and logging the search decision (FEAT-004).
- Rights fields (US-008).
- Conversion detail (US-107).
