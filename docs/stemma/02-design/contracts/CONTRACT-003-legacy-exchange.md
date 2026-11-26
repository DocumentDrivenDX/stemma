---
ddx:
  id: CONTRACT-003
  type: contract
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-002
    - CONTRACT-001
    - CONTRACT-002
---

# Contract: Legacy import, export, and Word intake

**Contract ID**: CONTRACT-003
**Type**: schema and CLI
**Version**: 0 (provisional; see Proof Status)
**Related**: ADR-002, FR-13, FR-71 to FR-73

## Purpose

Defines how CSL-JSON (Citation Style Language item data), BibLaTeX (a LaTeX
bibliography format), RIS (a tagged reference format), and Word files enter a
project, how libraries leave it, and what "keeps all of its information" means.

## Scope and Boundaries

- In scope: codec behaviour, equivalence, loss reports, Word intake outputs, and
  limits on untrusted input.
- Out of scope: BibTeX, EndNote library files, Zotero database or API access,
  LaTeX manuscripts, and Word, LaTeX, or HTML export (deferred past v1).
- Owning module: `packages/intake`.

## Normative Surface

### A. Directions and support level

| Input | Import | Export | Same-format guarantee |
|---|---|---|---|
| CSL-JSON | yes | yes | yes |
| BibLaTeX | yes | yes | yes |
| RIS | yes | yes | yes, for files the codec accepts without error |
| Word `.docx` | yes | no | not applicable; the original is never modified |

A format, producer, or embedded-field variant is **supported** only after tests
on files saved by real tools pass (FR-71). Until then the intake report labels
it `untested`.

### B. Common import rules

1. The original file is read only. Its bytes go to the content store, and an
   `import_batch` records format, codec version, original name, size, digest,
   entry count, file-level `blocks`, and losses.
2. Each entry creates or proposes one `source` with `intake` `parsed` (or `raw`),
   `admission` `candidate`, and a `legacy` entry. Import admits nothing and
   marks nothing verified.
3. Every native field, including unrecognized ones, is kept as a `LegacyField`,
   whether or not it maps to a record field.
4. Possible duplicates are reported. A codec MUST NOT merge records on its own.
5. Import is atomic: on error, no record is written.
6. A repeated import of identical bytes is reported and writes nothing without
   `--again`.

### C. Same information

Let A be an imported file and B the export of that batch in the same format with
no intervening edit. B MUST be equivalent to A under this definition.

| Part | Must be equal | May differ |
|---|---|---|
| Entries | The set of entries, matched by native key or, without one, by position; duplicates keep their count | Entry order |
| Entry type | Native type string | none |
| Fields | Every field name and value of every entry, unknown ones included | Field order, indentation, quoting and delimiter style, line wrapping that the format defines as insignificant |
| Repeated values | Order within a repeated field or tag, and name order | none |
| Comments and file-level content | The text of every comment, preamble, and file header | Position |
| Shortcuts | The value each shortcut produces, and fields set by inheritance, which stay recoverable | A BibLaTeX `@string` reference may be written expanded. Unused definitions are kept |

Format rules:

- **CSL-JSON**: equality of parsed JSON. Object member order is free; array
  order, value types, number text, and `null` are significant. Duplicate member
  names are an import error.
- **BibLaTeX**: field names and entry types compare without ASCII case; values
  compare as TeX source after removing the outer delimiters. Inner braces,
  commands, and `verbatim`-type field bytes are significant. `crossref`,
  `xdata`, and `related` stay as fields. No LaTeX is executed.
- **RIS**: tags and their order of repetition per record, and values exactly,
  after joining continuation lines by the producer's rule. The report names the
  detected variant. A line the codec cannot attribute to a tag is kept as a
  block and fails the import if it cannot be placed.

Equivalence MUST be tested by an equivalence comparator that is independent of
the exporter, and, where a native reader exists, by that reader as well.

### D. Export after edits

For each preserved field with `mapped_to`: if the current mapped value's digest
equals `mapped_sha256`, export the preserved native value; otherwise generate
the native value from the record. A preserved field without a mapping is
re-emitted unchanged. A field removed from the record is removed from output and
listed in the loss report. A new record field with a native home is added. When
a preserved unmapped value and an edited mapped value claim the same native
field, the record wins and the report shows the conflict. Retired sources are
not exported.

An exporter MAY emit the original bytes when every record of a batch is
unchanged, the whole batch is requested, and the blob is present.

### E. Export of Stemma data, and cross-format export

Export always produces a `stemma.loss-report/0` JSON document: target format and,
per record, items `{path, class, note?}` with class `unrepresented` (no home in
the target), `approximated`, or `representation_change`. Passages, notes, claims,
links, places, captures, and provenance are normally `unrepresented`. With
`--policy report` (default) output and report are written. With
`--policy strict` any item other than `representation_change` writes no output.
Exporting to a different format than the origin is never covered by C, and
preserved native fields of another format are `unrepresented`. Exports omit
restricted values.

### F. Word intake

`takeover` MUST:

1. Read body, footnotes, and endnotes in document order, and leave the file
   unchanged.
2. Recover embedded reference-manager data where present: Zotero and Mendeley
   citation fields or content controls carrying CSL-JSON, and EndNote fields
   carrying EndNote XML. Each variant has its own support level (A).
3. Treat embedded data as a claim to check, never as verified.
4. Report tracked changes, comments, text boxes, and fields it did not
   interpret. Text marked deleted by tracked changes MUST NOT produce citations;
   the report states which revision view was read.
5. Create `citation` records with the sentence, quotation and locator where
   found, `as_found` text, and `document_position`; provisional `source`
   records for full and partial references; and quotations and claims. Every
   record it creates takes effect at once and is marked unreviewed
   (CONTRACT-001 G).
6. Bind a typed footnote, short form, or "ibid." to a source only when a
   deterministic rule yields one candidate. Otherwise it goes to the author with
   the candidates (FR-72). A note the reader did not classify is listed as
   unclassified, not dropped.
7. Write `stemma.intake-report/0`: counts of notes read, citations created, bound,
   ambiguous, and unclassified, plus items under 4 and the support levels. Every
   item that needs the author or was not read is also saved as an `intake_item`
   record.
8. Write the Stemma copy under `manuscript/` as CONTRACT-006 defines. Later
   fixes go to that copy and the records, never to the original.
9. From M2 (FR-82), suggest constructs and methodology as unreviewed records
   with their supporting manuscript passages in `origins`. The author reviews
   these and the extracted claims, singly or in batches with their original
   passages, whenever they choose.
10. When run again, keep existing author choices, and report a changed original
    as an intake item without applying it (assumption).
11. Carry the whole original reference list forward. For each entry of a
    reference list or bibliography section found in the manuscript, bind it to
    one source by the same deterministic rules, or create a provisional source
    holding its `as_found` text with an intake item for the author, and add that
    source to `bibliography_include`. The list is not copied into the Stemma
    copy, because the built bibliography is generated (CONTRACT-006 E). The
    intake report states how many entries were found, or that no list was
    detected. An entry that is cited nowhere then fails `bib.uncited` until the
    author removes it from the list or dismisses the finding.

Model-proposed parses MAY be added only as unreviewed records with a `model`
actor, saved before any deterministic step reads them, and each parsed string MUST align to a
span of the document text.

### G. Untrusted input limits

All codecs MUST treat input as hostile: refuse archive entries with absolute or
parent paths; cap uncompressed size, entry count, nesting depth, and field
length; disable XML DTD and external entity processing; never fetch a URL found
in a file; and never interpret file text as instructions. Limits are published
by `doctor`. Cap values are set by the takeover solution design.

## Precedence and Compatibility

- Versioning: each codec has a version recorded on every batch. A codec change
  that alters mapping increments it.
- Precedence: edited record values outrank preserved legacy values (D).
- A newer codec MUST export batches imported by older versions under the same
  guarantee, or refuse with `codec_incompatible`.
- Deprecation: a format is not removed while a project can hold batches of it.

## Error Semantics

| Condition | Outcome | Retry | Recovery Expectation |
|---|---|---|---|
| Unparseable library entry | `import_parse_error` with line; nothing written | no | Fix the file or remove the entry |
| Limit exceeded | `input_limit`; nothing written | no | Inspect the file |
| Corrupt or encrypted `.docx` | `docx_unreadable` | no | Save an unencrypted copy |
| Embedded field present but undecodable | Intake continues; listed with raw location | no | Author resolves manually |
| Strict export would lose data | Exit 5, report only | yes | Use `report` policy |
| Original blob missing | Byte replay unavailable; regeneration still meets C | yes | Restore the blob |
| Blob of a preserved value that holds a local path is missing (CONTRACT-001 B) | Export writes the rest, lists each missing value in the loss report, and makes no same-information claim | yes | Restore the blob |

## Examples

```text
stemma import library.bib --kind biblatex
stemma export --kind biblatex --batch imp-5f8k2m0q7t3w9c1z4n6b --out again.bib
stemma export --kind ris --out all.ris --policy report
```

```json
{
  "items": [
    {"class": "unrepresented", "path": "relations[r1]"}
  ],
  "record": "src-7c2m9q4t1v8b5n0k3x6d"
}
```

A conformance test imports a library with an unknown field, a comment, a string
macro, and a repeated tag; exports it; and runs the comparator in C. It then
edits one title and expects every other value to stay equal.

## Non-Normative Notes

- The guarantee is defined by information, not bytes, because the owner allows
  layout, order, shortcuts, and comment positions to change.
- A reader of another project's converters, or Pandoc, can serve as an
  independent oracle; neither is a product dependency.

## Proof Status

| Element | Evidence | Not shown |
|---|---|---|
| Preserve-native approach | A feasibility test on hand-written fixtures (18 BibLaTeX, 16 CSL-JSON, 15 RIS entries) kept the same information when regenerating with native values retained, and showed 43, 20, and 31 differences without them, on one system | Real library files. One author wrote fixtures and mapper; RIS was compared only by the spike's own parser |
| Editing | Adding or removing a field fell back to regenerating the entry; the per-field rule in D is design only | D |
| Word intake | A package-free reader recovered all footnotes and embedded Zotero and EndNote references from hand-built files; a short-form rule resolved 9 of 10 with none wrong and missed German "a.a.O." and author-date citations | Files saved by Word, Zotero, Mendeley, or EndNote; Mendeley fields at all |

## Schema Basis

Native formats stay native and are not relabelled as UMF. Preserved data and
import batches use CONTRACT-001. Loss and intake reports are command envelopes.
UMF's interchange contracts were the pattern for retaining source, locating
loss, and choosing a loss policy; their adapters cover schema documents, not
bibliography records.
