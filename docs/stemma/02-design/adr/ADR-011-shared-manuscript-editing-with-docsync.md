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

Stemma's manifest declares docsync, listed in the same DocumentDrivenDX
marketplace, as a dependency, so installing Stemma with Claude Code installs it
too. It declares no version range. Using shared editing stays optional: writing,
checks, and builds call nothing in docsync.

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

**Trade-offs**: Claude Code does not load Stemma while docsync is missing, even
for an author who never shares a document, and every Stemma install takes docsync's
latest published version. An update does not always add a new dependency: in
Claude Code 2.1.236, updating an installed Stemma left docsync missing and Stemma
not loaded. Running `claude plugin install stemma@documentdrivendx` again added
docsync in isolated test profiles but not on one existing installation, so the
documented fix is `claude plugin install docsync@documentdrivendx`. Refreshing the
marketplace alone can show the same error before Stemma is updated.
The [plugin dependency documentation](https://code.claude.com/docs/en/plugins/dependencies)
says `claude plugin update` installs a missing dependency from 2.1.319.
Codex documents no plugin dependencies, so its users would install both. docsync
fetches its own copy of Bun. The shared document is a hosted copy of the whole manuscript, quotations
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
docs tools. docsync installed from the marketplace on GitHub and its command
line ran. With Claude Code 2.1.236 and a local copy of that marketplace,
installing a build of Stemma installed docsync too, and the update behaved as
above. The desktop app's handling of the dependency, and of an update, is
untested. Typing in the Docs interface, a real manuscript, Windows, Codex, and a
live session using the installed skill are untested.

## Concern Impact

- **No concern impact**: The decision applies `plain-file-graph` and
  `security-owasp` without changing them.
