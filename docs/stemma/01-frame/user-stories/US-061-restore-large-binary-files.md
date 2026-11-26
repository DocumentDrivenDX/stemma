---
ddx:
  id: US-061
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-061: Restore large files in a clean checkout

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: BIN-01, BIN-02
**PRD Requirements**: FR-59
**Priority**: P1

## Story

**As a** Priya, the technologist-researcher,
**I want** to restore the book's large files in a clean checkout
**So that** a second checkout can build from the same bytes without bloating the repository.

## Context

Priya works in git. Large scans, images, and source files sit in a separate private store, identified by content hash. Priya backs up that store.

## Walkthrough

1. Priya adds a large image.
2. Stemma stores it by content hash and records the hash in the repository.
3. Priya makes a clean checkout with store access.
4. Priya restores the files and they match their hashes.

## Acceptance Criteria

- [ ] **US-061-AC1** — Given a large binary file, when it is added, then it is stored by content hash and the repository records the hash.
- [ ] **US-061-AC2** — Given a clean checkout with access to the file store, when files are restored, then each restored file matches its recorded hash.
- [ ] **US-061-AC3** — Given a file missing from the store or with a wrong hash, when restore runs, then the file is named and not accepted.
- [ ] **US-061-AC4** — Given the file store, when Stemma explains it, then it says the store is private, apart from the repository, and the author's to back up.

## Edge Cases

- **No store access**: Restore says what cannot be restored; dependent checks report unverifiable.
- **Restricted coordinate data**: It is not placed in the repository, nor a hash that allows guessing it.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Store | US-061-AC1 | 40 MB TIFF | Add | Hash recorded in repository |
| Restore | US-061-AC2 | Clean checkout | Restore | Hash matches |
| Corrupt | US-061-AC3 | One byte changed in store | Restore | File named and rejected |
| Backup | US-061-AC4 | New store | Read the explanation | Backup responsibility stated |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: BIN-01, BIN-02
- **PRD Requirements**: FR-59
- **External**: The private content-hash store. Interface surface belongs in Contract artifacts.

## Out of Scope

- Backing up the store for the author.
- Sharing sources with people without rights to them.
