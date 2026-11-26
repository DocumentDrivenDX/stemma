---
ddx:
  id: US-088
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-011
---

# US-088: Rebuild indexes from record files

**Feature**: FEAT-011 — Evidence graph and graph engine
**Feature Requirements**: IDX-01, IDX-02, IDX-03, IDX-04, IDX-05, IDX-06, IDX-07
**PRD Requirements**: FR-62
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to delete any index and rebuild it from my project files, including on a second machine
**So that** my queries never rest on facts or stale copies that my files do not hold.

## Context

Idris works across many sessions and with a collaborator, and needs every version traceable. Features read the graph through a disposable index until the engine exists, so the index must never become a second source of truth.

## Walkthrough

1. Idris edits a note record in his editor.
2. He runs a task that queries the graph.
3. Stemma detects the change after the last index build and does not answer from the stale index.
4. He deletes the index; the next rebuild gives the same results from the files alone.

## Acceptance Criteria

- [ ] **US-088-AC1** — Given a built index, when it is deleted and rebuilt from the record files alone, then queries give the same results.
- [ ] **US-088-AC2** — Given a record changed after the last build, when a query is made, then the change is detected before any answer comes from the index.
- [ ] **US-088-AC3** — Given the same records and tool versions, when two rebuilds run, then their canonical text dumps are identical.
- [ ] **US-088-AC4** — Given any delivered write, when it completes, then its fact is present in a record file.
- [ ] **US-088-AC5** — Given a write that fails before its record file is saved, when the index is queried, then the fact is absent.
- [ ] **US-088-AC6** — Given a stored name with diacritics, when Idris searches without them, then the record is found using the versioned folding.
- [ ] **US-088-AC7** — Given no graph engine installed, when a P0 feature reads the graph, then it works through the disposable index.
- [ ] **US-088-AC8** — Given a generated browser graph, when the repository is inspected, then it is not committed, and it can be rebuilt from the record files.

## Edge Cases

- **Interrupted rebuild**: The partial index is not used.
- **Different SQLite versions on two systems**: Compare canonical dumps, not database bytes.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Rebuild | US-088-AC1 | Synthetic project | Delete index; rebuild; query | Same results |
| Stale | US-088-AC2 | Edit one note after build | Query | Change detected; answer reflects the file |
| Determinism | US-088-AC3 | Same fixtures | Rebuild twice | Identical dumps |
| Write in file | US-088-AC4 | Record a synthetic claim | Inspect files | Claim record exists |
| Failed write | US-088-AC5 | Record file location made unwritable | Add a claim; query | Claim absent; failure reported |
| Folding | US-088-AC6 | Name stored as `Ṣaḥīḥ` | Search `sahih` | Record found |
| No engine | US-088-AC7 | M1 checks without engine | Run checks | Checks complete |
| Not committed | US-088-AC8 | Generate the browser graph | Inspect tracked files; delete and rebuild | Untracked; same graph |

## Dependencies

- **Stories**: US-087.
- **Feature Spec**: FEAT-011
- **Feature Requirements**: IDX-01, IDX-02, IDX-03, IDX-04, IDX-05, IDX-06, IDX-07
- **PRD Requirements**: FR-62
- **External**: SQLite. Query and dump surfaces belong in Contracts.

## Out of Scope

- Search ranking.
- The engine database (US-089).
