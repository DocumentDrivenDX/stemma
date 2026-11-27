---
ddx:
  id: FEAT-005
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.principles
    - stemma.concerns
    - FEAT-002
    - FEAT-003
---

# Feature Specification: FEAT-005 — Notes, claims, constructs

**Feature ID**: FEAT-005
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 5. Notes, claims, and constructs
**Covered PRD Requirements**: FR-20, FR-21, FR-22, FR-23, FR-80
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

This feature records what the author takes from sources and what the book asserts: anchored reading notes, a claim ledger, and a construct register (PRD FR-20 to FR-22). Entries the assistant proposes take effect at once, marked unreviewed, and the author reviews or corrects them whenever they like (FR-23). The ledger also records which notes support or oppose a claim and how claims relate (FR-80).

## Ideal Future State

From any claim, the author can reach the notes behind it, the source passages behind each note, and the stated reason the sources support it. Each concept the book uses has one definition, with its origin when borrowed. The author can tell what they have reviewed from what they have not.

## Problem Statement

- **Current situation**: Notes, claims, and concept definitions live in separate documents and chat sessions.
- **Pain points**: Extracts drift from source wording, claims lose their evidence, concepts drift in meaning or are credited to the wrong person, and assistant suggestions pass as the author's judgment.
- **Desired outcome**: Every claim traces to notes anchored in source text or is shown as not doing so, and everything unreviewed is visible.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Reading notes | What did the source say, and where? | Anchor to source and locator; match extracts |
| Claim ledger | Why do I hold this claim, and what stands against it? | Link claims to notes with confidence, reason, and stance; relate claims |
| Construct register | What does this concept mean here, and whose is it? | Definitions, chapters, originators |
| Review | What have I looked at? | Mark and report what is unreviewed |

## Requirements

### Functional Requirements by Area

Domain terms: a **note** records an extract (source wording) or a paraphrase (the same content in other words) at a place in a source. A **claim** is an assertion in the **claim ledger**, linked to notes. A **construct** is a concept in the **construct register**. A **support record** is a model's judgment about a claim and a passage; it belongs to FEAT-007 and is not a note or a review.

#### Reading notes

NOTE-01 (FR-20, P0, M1). A reading note must anchor each extract or paraphrase to a source and a locator.

NOTE-02 (FR-20, P0, M1). A scripted check must compare each extract with the source text at its anchor and must not pass an extract that does not match.

NOTE-03 (FR-20, P0, M1). A paraphrase must remain distinguishable from an extract, and a check of its anchor must not be reported as a match of its wording.

#### Claim ledger

CLM-01 (FR-21, P0, M1). A claim-ledger entry must link a claim to one or more notes, with a confidence level and the reason the sources support it.

CLM-02 (FR-21, P0, M1). An entry with no note, confidence level, or reason must be reported as incomplete.

CLM-03 (FR-80, P0, M2). The ledger must record whether each linked note supports or opposes its claim.

CLM-04 (FR-80, P0, M2). The ledger must record relations between claims, including support, objection, and rival reading, and which claim is the thesis.

#### Construct register

CON-01 (FR-22, P0, M2). A construct register must hold each concept the book uses, with its definition and the chapters that use it.

CON-02 (FR-22, P0, M2). A construct taken from a source must name that source.

CON-03 (FR-22, P0, M2). Author-stated constructs from FR-60 must be entries in the same register.

CON-04 (FR-22, P0, M2). A register check must fail a borrowed construct that lacks a definition or its source.

CON-05 (FR-22, P0, M2). The author's own construct must be marked as the author's, and the register check must fail one that lacks a definition.

CON-06 (FR-22, P0, M2). Scripted checks must verify that each reference to a construct resolves to a register entry.

CON-07 (FR-22, P0, M2). The agent must advise on inconsistent use of a construct or of the methodology. That advice is not a check result.

#### Review

ACC-01 (FR-23, P0, M1). Notes, claims, and constructs the assistant proposes must take effect at once, marked unreviewed. No review may be required to continue.

ACC-02 (FR-23, P0, M1). The assistant must not mark an item reviewed unless the author says so, naming the items or batch.

ACC-03 (FR-23, P0, M1). A review mark must be recorded with its date, and must be described as what the author said and not as proof of who wrote it.

ACC-04 (FR-23, P0, M1). A change the assistant makes to a reviewed entry must make it unreviewed again while it stays in effect; the author's own edit keeps it reviewed. The author may edit or retire any entry at any time, and reports must show what is unreviewed.

### Non-Functional Requirements

- **Reliability**: The extract and register checks give identical results on repeated runs with the same inputs and tool versions.
- **Traceability**: An entry from the assistant records the model and role that made it (`ai-disclosure`).
- **Security**: Text quoted from a source into a note is data. A project test with instruction-bearing source text must cause no review mark and no record change that the author did not ask for. Model behavior cannot be guaranteed.

## User Stories

- [US-018 — Anchor a reading note to source text](../user-stories/US-018-anchor-a-reading-note.md)
- [US-019 — Record why sources support a claim](../user-stories/US-019-record-a-claim.md)
- [US-020 — Register the constructs the book uses](../user-stories/US-020-register-constructs.md)
- [US-021 — Review AI-proposed items](../user-stories/US-021-review-ai-proposed-items.md)

## Edge Cases and Error Handling

- **Source changes after a note is reviewed**: The note and dependent claims are flagged (FEAT-002 CHG-01); review does not clear the flag or make an extract match.
- **No extracted text at the anchor**: The extract check reports unverifiable.
- **Locator that resolves to repeated or ambiguous text**: Report the ambiguity; do not move an anchor without the author's choice.
- **Edit outside the agent**: A person or agent with file access can write a review mark. The record cannot show who wrote it; scripted checks still recompute at build.
- **Removed note**: A claim that loses its last note is reported incomplete.

## Constraints and Assumptions

- A review mark is a plain record and is not forgery-proof (ADR-003).
- Record shapes, anchor forms, and confidence values belong to Contract artifacts or design (ADR-002).
- **Risk**: matching an extract against real scans, publisher PDFs, and hyphenated or non-Latin text is unverified. A feasibility test used two synthetic layouts and found probes that passed wrongly.
- CON-01 to CON-07 are M2, and the FR-29 construct-credit check arrives with them.
- A retired entry is not a basis for drafting, and checks report text still linked to it.
- An entry the author writes themselves starts reviewed, and the author's own edits keep an entry reviewed.
- An extract passes NOTE-02 only when it differs from the source text by defined harmless differences; another near match is reported as FR-29 states. The harmless differences are the approved, untested list in CHK-16 (FEAT-007).
- Claims that takeover extracts take effect at once and can be reviewed in batches shown with their original passages (FR-72, FEAT-015).
- Open: what confidence scale does CLM-01 use?
- Takeover suggests constructs and methodology, which take effect at once, unreviewed (FR-82, FEAT-015).

## Dependencies

- **Other features**: FEAT-002 source files, passages, and change flags; FEAT-003 keys and locators; FEAT-001 project and FR-60 inputs; FEAT-007 checks and reports; FEAT-006 drafting; FEAT-011 records.
- **External services**: None. Exact interfaces belong to Contract artifacts.
- **PRD requirements**: FR-20, FR-21, FR-23 (P0, M1); FR-22, FR-80 (P0, M2).

## Out of Scope

- Judging whether a passage supports a claim (FR-52, FEAT-007).
- Outlines, drafting, and rival readings (FEAT-006).
- Argument maps (FEAT-013).
- Takeover extraction of unverified claims (FR-72, FEAT-015).
- Preventing an agent or person from editing records.
