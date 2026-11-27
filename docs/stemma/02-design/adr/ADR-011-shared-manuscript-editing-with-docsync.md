---
ddx:
  id: stemma.adr-011
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-004
    - stemma.adr-009
    - CONTRACT-006
---

# ADR-011: Shared manuscript editing uses the docsync plugin

## Problem

An author wants to edit and discuss a manuscript, with others, in a shared
document, without the repository ceasing to be the record. HELIX does this for
its documents with `draftsync`, a Python tool. A manuscript depends on block
quotes, footnotes, and the citation and span markers of CONTRACT-006, and
`draftsync` does not edit quotes, escapes underscores in new citation keys, and
leaves a paragraph with brackets to be written back by hand.

## Decision

We will use [docsync](https://github.com/DocumentDrivenDX/docsync), a separate
DocumentDrivenDX plugin, to keep a manuscript file and a Claude Doc in step. It
is a TypeScript port of `draftsync` on the same pinned Bun, with those
manuscript cases handled and nothing specific to Stemma or HELIX. Stemma adds no
sync code. Its skill says when to use docsync and what Stemma does around it:
run `check` after edits land, and say what that check does not read.

Shared editing is optional. Writing, checks, and builds never need it. docsync is
listed in the DocumentDrivenDX marketplace as `docsync@documentdrivendx`. Stemma
declares no plugin dependency on it; an author who wants shared editing installs
it too.

## Why We Chose This

### Over running HELIX's draftsync
It needs Python, uv, and PyYAML beside Bun (ADR-004), and its manuscript gaps
would still need fixing.

### Over a copy inside Stemma
Syncing Markdown with a document is not particular to manuscripts. One plugin can
serve Stemma, HELIX, and other repositories, and a copy in each would drift.

## Consequences

**Good**: One sync engine, on the runtime Stemma already pins. The manuscript
stays plain Markdown in the repository (ADR-009).

**Trade-offs**: A second plugin to install, against ADR-004's single
installation, unless Stemma declares it as a dependency; Codex documents no plugin
dependencies, so its users would install both. docsync fetches its own copy of
Bun. The shared document is a hosted copy of the whole manuscript, quotations
included, so the author is told before it is made (FR-61 concerns what Stemma
prepares for a hosted model, not this copy). Footnotes appear in the document as
plain text. docsync does not know CONTRACT-006: an editor can change or remove a
citation, a citation `id`, or a quotation, and nothing in docsync stops it.
Stemma has no manuscript reader yet (ADR-009), so `check` does not read the
manuscript and cannot report such a change; the diff is how it is seen.

**Drift signals to watch**: Sync code or a second merge engine in Stemma; a
manuscript exported over its file; Stemma saying that landed edits were checked.

## Assumptions

- Claude Docs keeps citation brackets and attribute lists as typed, reports
  changes since a revision, and accepts guarded edits to words. A change to any
  of these would invalidate this.

## Validation

**Result**: partly tested
**Evidence**: On one invented chapter in CONTRACT-006 markup, a docsync round
trip landed doc edits in the file and wrote repository edits back, through the
docs tools. The plugin installed from the marketplace on GitHub and its command
line ran. Typing in the Docs interface, a real manuscript, Windows, Codex, and a
live session using the installed skill are untested.

## Concern Impact

- **No concern impact**: The decision applies `plain-file-graph` and
  `security-owasp` without changing them.
