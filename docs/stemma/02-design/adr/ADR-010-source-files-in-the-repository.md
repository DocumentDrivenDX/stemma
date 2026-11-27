---
ddx:
  id: stemma.adr-010
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-002
---

# ADR-010: Source files live in the repository as page-split Markdown

## Problem

The author's repository has to capture the whole body of research behind a book,
so that a finished output can be traced to it and checked again from a clone
(FR-6, FR-85). Originals are binaries or paper. Checks must also verify that a
conversion is complete and in order, and that a cited page is the right one,
which flat extracted text cannot show (FR-87).

## Decision

We will hold every captured source in the author's repository as Markdown source
files with Stemma annotations: one directory for each conversion, a manifest
record, and one file for each page of a paged original, in the format of
CONTRACT-007. Binaries and paper originals stay outside the repository and are
tied by content hash and size, or by a description and where they are held.
Checks, excerpts, builds, and the explorer read the source files. A copy of a
project may hold a source's records and manifest and not its text; what needs
that text is then reported as not held and could not be checked (FR-104,
CONTRACT-007 H). Verifying
against an original held elsewhere is optional, by path and digest.

Text-native originals are the core path: plain text, Markdown, HTML, EPUB, DOCX,
and text-layer PDF, whether from a library such as Project Gutenberg or supplied
by the author. Recognized text from scans is secondary and labelled as such.
Source text comes only from deterministic converters, a recognition tool, or a
person. No language model produces or corrects it, so that errors stay
recognizable transcription errors that checks, comparisons, and reviews can find.

Stemma drives four stages, and Claude runs them for the author: capture the
upstream sources; convert them to source files with metadata and reverify them;
identify research questions and capture the relevant references from the source
files; and assemble the research outputs.

## Why We Chose This

### Over a private content store outside the repository
The research behind the book would not travel with it. A clone could check
nothing, and the record would depend on one person's backups.

### Over committing the originals
Binaries do not compare in git and grow without bound, and paper cannot be
committed.

### Over one text file for each source
Page boundaries, running heads, footnotes, and page numbers would be mixed or
lost. Completeness and page claims could not be verified from the repository.

### Over a structured JSON text format
An author could not comfortably read or correct it.

## Consequences

**Good**: A clone that holds the source files holds the text every check reads. Corrections and comparisons
are visible in git. A missing, reordered, or edited page is detected by script.

**Trade-offs**: The repository holds full source texts, many under copyright, and
anyone who can read it can read them. A large corpus means many files. Layout
that a converter cannot determine stays marked undetermined. Stemma owns the
format and its converters. A conversion can be wrong, so what was compared with
the original is recorded and shown.

**Drift signals to watch**: A binary anywhere in the repository (`project.binary`
reports it); a check that needs a file
outside the clone to read text; a converter that assigns structure with no stated
rule; a page file edited and not sealed.

## Assumptions

- Source texts for a book stay small enough for git: a corpus of many hundred
  megabytes of text would invalidate this.
- Text-native files, existing text layers, and text the author supplies cover
  most sources authors hold: many image-only or paper originals would call for a
  built-in recognition engine (SD-002).

## Validation

**Result**: partly tested
**Evidence**: The worked example converts public originals into source files on
one macOS system, and the checks run from the committed files. Large corpora,
other systems, and an author's own material are untested.

## Concern Impact

- **No concern impact**: The decision applies `plain-file-graph`,
  `citation-integrity`, `deterministic-checks`, and `security-owasp`. It
  narrows `rights-and-permissions` to recording what the author states.
