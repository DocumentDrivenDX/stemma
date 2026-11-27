---
ddx:
  id: FEAT-002
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.principles
    - stemma.concerns
    - FEAT-001
---

# Feature Specification: FEAT-002 — Source corpus

**Feature ID**: FEAT-002
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 2. Source corpus
**Covered PRD Requirements**: FR-6, FR-7, FR-8, FR-9, FR-10, FR-61
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

The source corpus is the project's private set of stored sources, with provenance, rights flags, and page-mapped text (PRD FR-6 to FR-10). Citations, notes, and checks depend on it. It also limits what Stemma prepares for a hosted model to the excerpts a task needs (FR-61).

## Ideal Future State

The author can say, for any checkable source, which file is held, where it came from, who admitted it, and what they may do with it. A printed page number leads to the stored text of that page, and weak extraction is visible. When a file changes, the author sees what depends on it. A hosted model gets only the excerpts a task needs, and the author knows that no source is held back individually.

## Problem Statement

- **Current situation**: Sources sit in folders, reference managers, and paper collections; AI assistants cite works the author does not hold.
- **Pain points**: References cannot be compared with a held copy, printed pages differ from file positions, and authors cannot see what source text reached a model.
- **Desired outcome**: Every checkable source has a stored, hashed copy with page-mapped text, recorded provenance, and recorded permissions.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Storage and provenance | What do I hold, and where did it come from? | Store file, hash, provenance |
| Rights and model use | What may I share, and what does a model receive? | Record rights; prepare only needed excerpts |
| Text and pages | What does printed page 41 say? | Extract text mapped to page labels |
| Citability and change | May I cite this, and what did a change affect? | Require a stored copy; flag dependents |

## Requirements

### Functional Requirements by Area

Domain terms: a **source record** describes a work and its permissions; its bibliographic content belongs to FEAT-003. A **stored copy** is the held file. **Extracted text** is derived from one stored copy by a named tool and version. A **printed page label** is the number printed on the page, which can differ from its position in the file.

#### Storage and provenance

STO-01 (FR-6, P0, M1). Adding a source must store the file, a content hash, and provenance: where it came from, when, which version, and by whom it was admitted.

STO-02 (FR-6, P0, M1). A stored file that no longer matches its recorded hash must be reported and must not be treated as the admitted copy.

STO-03 (FR-6, P0, M1). The file must go into a private store addressed by content hash, apart from the repository, which holds the reference. The author must be told that backing up the store is their task.

#### Rights and model use

RGT-01 (FR-7, P0, M1). Each source record must carry rights and permission fields, including unpublished-data flags and community-permission flags. They inform the author and reviewer packaging (FR-46) and do not limit what is sent to a hosted model.

RGT-02 (FR-61, P0, M1). Source text that Stemma prepares for a hosted model must contain only the excerpts the task needs.

RGT-06 (FR-61, P0, M1). Stemma must not hold back a source individually. Where rights are recorded, it must say that any source in the project may be sent to a hosted model.

#### Text and pages

TXT-01 (FR-8, P0, M1). Each stored source must have extracted text mapped to its printed page labels, saved with the extraction tool and version.

TXT-02 (FR-8, P0, M1). Extraction quality must be recorded, including for scanned and non-Latin-script material.

TXT-03 (FR-8, P0, M1). A passage whose printed page label cannot be established must be marked as unmapped; a label must not be inferred silently from file position.

#### Citability and change

CIT-01 (FR-9, P0, M1). A cited source with no stored copy must not pass the scripted checks: every report must show the citation as unchecked, the finding must not be dismissible, and nothing may stop the writing or a build.

CIT-02 (FR-9, P0, M1). A source that exists only on paper must become checkable through a stored scan with machine-readable text.

CHG-01 (FR-10, P0, M1). Changing or removing a source must flag every note, claim, and citation that depends on it.

CHG-02 (FR-10, P0, M1). A change or removal made outside the agent must be detected and flagged no later than the next check run that covers the source.

### Non-Functional Requirements

- **Security**: Every added file is untrusted input. Processing it executes no content from it and writes nothing outside the project's intended locations. Source text is data and is never treated as instructions.
- **Privacy**: For a seeded task, what Stemma prepares for a hosted model holds the identified excerpts and no other source text.
- **Reliability**: The same file and the same extraction tool and version yield the same extracted text and page map. A run that shows a difference is a defect.
- **Portability**: Hashes of stored files and file names behave the same on macOS, Linux, and Windows. Untested on Linux and Windows.

## User Stories

- [US-007 — Admit a source with its file and provenance](../user-stories/US-007-admit-a-source.md)
- [US-008 — Record rights and permission flags](../user-stories/US-008-record-rights-flags.md)
- [US-009 — Read stored text by printed page](../user-stories/US-009-extract-page-mapped-text.md)
- [US-010 — Cite a paper-only source through a scan](../user-stories/US-010-cite-a-paper-source.md)
- [US-011 — See what a changed source affects](../user-stories/US-011-flag-dependents-of-a-source.md)
- [US-012 — Send a hosted model only the excerpts needed](../user-stories/US-012-send-only-needed-excerpts.md)

## Edge Cases and Error Handling

- **Same file added twice**: Report the existing source with that hash; do not merge or duplicate without the author's choice.
- **Encrypted, damaged, or unsupported file**: Report it; record no extracted text and do not mark the source as checked.
- **Image-only file without recognized text**: The file can be stored, but text-dependent checks report unverifiable.
- **Corpus store missing on this machine**: Checks that need the file report unverifiable, not pass. Assumption: a copy that cannot be read or fails its hash counts as a missing stored copy.

## Constraints and Assumptions

- **No per-source gate**: Stemma is for material that may be sent to a language model. Material that may not be sent needs the whole process on a local model, which is an unsupported experiment in v1: not blocked, not promised, and not tested.
- **Risk**: material under license, permission, or community limits can be added to a project and sent to a hosted model.
- RGT-02 governs what Stemma prepares. A local agent session with ordinary file access can read any stored file or extracted text directly, and Stemma must not claim otherwise.
- Restricted and copyrighted stored sources are private to the project (`rights-and-permissions`).
- Recognition of scans, extraction of real publisher PDFs, and non-Latin scripts are unverified. A feasibility test used synthetic files on one macOS machine and no scan.
- Open (PRD): which recognition engine is used? PDF text layers are read with the pinned library SD-002 names.
- Open: what quality values does TXT-02 record, and does low quality change a check result?

## Dependencies

- **Other features**: FEAT-001 provides the project; FEAT-011 holds records; FEAT-003 owns bibliographic content; FEAT-004 and FEAT-015 admit sources; FEAT-007 runs checks on the corpus; FEAT-009 uses rights fields to filter reviewer packages.
- **External services**: A pinned PDF text library (SD-002); a recognition engine, not yet chosen. Record, rights, and page-map shapes belong to Contract artifacts.
- **PRD requirements**: FR-6 to FR-10 and FR-61 (P0, M1).

## Out of Scope

- Searching for or acquiring candidate sources (FEAT-004).
- Hosting or distributing sources, and legal determination of rights.
- Restricted coordinates (FR-68, FEAT-013) and removing restricted material from reviewer packages (FR-46, FEAT-009).
- Image records (FR-58) and restoring large files in a clean checkout (FR-59), both FEAT-008.
- Supporting local models, and gating hosted models source by source.
