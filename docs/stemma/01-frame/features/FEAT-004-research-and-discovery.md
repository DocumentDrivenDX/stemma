---
ddx:
  id: FEAT-004
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
---

# Feature Specification: FEAT-004 — Research and Discovery

**Feature ID**: FEAT-004
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 4. Research and discovery
**Covered PRD Requirements**: FR-16, FR-17, FR-18 (P1), FR-19
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Research and discovery lets the assistant look for literature without giving
anything it finds the standing of a source the author chose. It covers PRD FR-16 to FR-19: bounded
search, admission into the corpus, a coverage log, and corpus-first search. The
P0 requirements are in delivery step M2.

## Ideal Future State

An author states what the assistant may search and receives candidates that are
visibly not yet decided. The author decides which to admit when they like, and each admitted
source shows the query that found it and the decision that let it in. When the
author asks what their own corpus says, the answer names what it holds, what it
does not, and what was not examined.

## Problem Statement

- **Current situation**: Authors search with general assistants or databases and
  move results into a manuscript or reference library by hand.
- **Pain points**: Assistants invent references and mix real titles with wrong
  authors. A search result looks like a verified source, and the author cannot
  later show how a work entered the book or what was never searched.
- **Desired outcome**: A search result is never presented as a checked source
  without a source file, a cited candidate is reported as unreviewed, and each
  admission is traceable to a query and a decision.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Bounded search | What is out there within my limits? | Apply the limits and return candidates marked as undecided |
| Corpus-first search | What do my own sources say, and what is missing? | Search admitted sources first and report gaps with the scope examined |
| Admission | Should this work enter my corpus? | Take the author's decision and run acquisition and corpus checks |
| Coverage | Where have I not looked? | Keep a reviewable log of searches and decisions |

## Domain Objects

| Object | Meaning | In a citation |
|--------|---------|---------|
| Candidate | A work that a search returned. It may be wrong or may not exist | Reported as unreviewed |
| Source | A work with a record and, when captured, source files tied to its original (FEAT-002) | Checkable once it has a source file |
| Bibliography record | The official description of a work (FEAT-003) | Checkable only with a source file |
| Search record | A query, its limits, scope, date, and results | No |
| Admission decision | The author's dated admission or rejection of a candidate | No |
| Research note | Working prose in the project, named by date and subject and listed on request (CONTRACT-001 L). Not a search record, source, or evidence | No |

## Requirements

### Functional Requirements by Area

#### Bounded search

- **SRCH-01** (FR-16). The assistant must be able to search within limits the
  author sets, and must not search outside them.
- **SRCH-02** (FR-16). Each result must be presented as a candidate. A cited
  candidate must be reported as unreviewed, and as unchecked while it has no
  source file.
- **SRCH-03** (FR-16). A candidate must show where it was found and which of its
  details come from that origin.

#### Corpus-first search

- **CORP-01** (FR-19). When directed, the assistant must search the admitted
  corpus before any other location.
- **CORP-02** (FR-19). The result must state what the corpus does not contain
  for the question, together with the sources searched and the sources or parts
  not searched, with the reason.
- **CORP-03** (FR-19). A statement of absence must be limited to the searched
  corpus. It must not claim that no such literature or evidence exists.

#### Admission

- **ADM-01** (FR-17). Only an author decision admits a candidate.
- **ADM-02** (FR-17). Admission must record the author's decision, run source
  acquisition and the corpus checks owned by FEAT-002, and create or link the
  FEAT-003 record. A missing source file or a failed check is reported with the
  reason (FR-9); it never withholds admission, and admission requires no rights
  information.
- **ADM-03** (FR-17). Admission must record the search query and the author's
  decision as graph records. A rejection records the decision too (assumption).

#### Coverage (P1)

- **COV-01** (FR-18). Searches and decisions must be logged.
- **COV-02** (FR-18). The author must be able to review coverage by language,
  period, and region. Items without a recorded value must count as unknown, not
  be guessed or dropped.

### Non-Functional Requirements

- **Security**: Text returned by a search or read from a source is data. In a
  seeded test, instructions embedded in a result cause no admission, limit
  change, or record write.
- **Rights**: A search sends a hosted model only the excerpts the task needs
  (FR-61); no source is held back individually.
- **Reliability**: A search service that fails or times out is named in the
  result; 0 failed services are reported as searched.
- **Performance** and **Scalability**: N/A. The PRD sets no target.

## User Stories

- [US-040 — Search within the author's limits](../user-stories/US-040-search-within-author-limits.md)
- [US-041 — Admit or decline a candidate](../user-stories/US-041-admit-a-candidate.md)
- [US-042 — Review search coverage](../user-stories/US-042-review-search-coverage.md)
- [US-043 — Search the corpus first and report gaps](../user-stories/US-043-search-the-corpus-first.md)

## Edge Cases and Error Handling

- **Candidate that cannot be confirmed**: It stays a candidate. The assistant
  states what could not be confirmed and does not fill in missing details.
- **Candidate already in the corpus**: The match is reported with the existing
  source; no second source is created without an author decision.
- **Likely duplicate that cannot be settled**: It goes to the author.
- **Metadata found but no copy obtainable**: The candidate and decision are
  kept; its citations are reported as unchecked (FR-9). A paper-only work needs a transcription
  with machine-readable text.

- **Source with poor or no extracted text**: It is listed as not reliably
  searched; its silence is not reported as absence.
- **Offline**: Corpus search remains possible for local text; outside search
  reports that it could not run.

## Constraints and Assumptions

- Concerns: `rights-and-permissions` (excerpts only; rights can be recorded
  at admission, because they decide what a reviewer package may hold, but none
  are required), `security-owasp` (results are untrusted input),
  `citation-integrity` (candidates cannot satisfy a citation),
  `plain-file-graph` (search and admission records are record files),
  `ai-disclosure` (searches made by the assistant record model and role), and
  `honest-assurance` (an absence report states its scope; an admission record
  shows intent and is not proof of who wrote it).
- Search is model-assisted and may not repeat its results. It is not a scripted
  check, and no search result is a check result.
- Assumption: author limits can express at least where to search and what to
  exclude, such as date or language. The PRD does not enumerate limit types.
- Assumption: declined candidates are recorded, so that coverage can show
  decisions both ways.
- Unverified: no search service or metadata resolver was exercised, and book and
  chapter coverage in the humanities is unmeasured.

## Dependencies

- **Other features**: FEAT-002 (acquisition, corpus checks, flags), FEAT-003
  (bibliography records), FEAT-011 (graph records).
- **External services**: search and metadata services chosen in design; the
  exact surface belongs in Contract artifacts.
- **PRD requirements**: FR-16, FR-17, FR-18, FR-19; related FR-9 and FR-61.

## Out of Scope

- Capture, conversion, and change tracking of sources (FEAT-002).
- Notes and claims made from an admitted source (FEAT-005).
- Judging whether a source is correct or well chosen.
- Automatic admission, including bulk admission without an author decision.
- Importing existing libraries during takeover (FEAT-015).

## Open Questions

- [ ] Which outside search and metadata services does the first version use,
  under which terms? Design owner.
- [ ] Which kinds of limit must an author be able to set? Product owner.
