---
ddx:
  id: CONTRACT-007
  type: contract
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-002
    - stemma.adr-010
    - CONTRACT-001
  schemas:
    - id: stemma.record
      version: "0"
      title: Stemma records
      path: docs/stemma/02-design/contracts/schemas/stemma-record.umf.json
      schemaFormat: umf
---

# Contract: Source files

**Contract ID**: CONTRACT-007
**Type**: schema (text format)
**Version**: 0 (provisional; see Proof Status)
**Related**: ADR-010, FR-6, FR-8, FR-9, FR-10, FR-29, FR-84 to FR-89, FR-98, FR-104

## Purpose

Defines how the text of a source is held in the author's repository: one
directory for each conversion of an original, with a manifest and one Markdown
file for each page, or for each section of a source that has no pages.
Converters write it, a person may correct it, and checks, excerpts, builds, and
the explorer read it. A clone of the repository holds everything those readers
need.

## Scope and Boundaries

- In scope: layout, manifest, part files, block and inline annotations, the
  text streams, digests and passage addresses, ties to the original,
  conversion rules by format, and transcription input.
- Out of scope: record rules shared with other kinds, including the
  `text_review` and `comparison_run` records (CONTRACT-001), check outcomes and
  commands (CONTRACT-002), and the manuscript (CONTRACT-006).
- Binaries and paper or physical originals are not part of the project. A source
  file ties its text to them.
- No language model produces or changes source text.
- Owning modules: `packages/records` (format and reading) and `packages/extract`
  (converters).

## Normative Surface

### A. Layout

| Path | Content |
|---|---|
| `sources/<name>/source.md` | The manifest: one `source_text` record |
| `sources/<name>/pages/p<index>.md` | One page of a paged source; `<index>` has at least four digits |
| `sources/<name>/sections/s<index>.md` | One section of a source with no pages |

`<name>` matches `[a-z0-9][a-z0-9-]{0,79}`. It is there for people and carries
no meaning: the record ID in the manifest identifies the source file. A
converter takes the name from the citation key when that gives a free, safe name,
and from the record ID otherwise. `sources/` holds nothing else: any other file
there, a binary included, is reported.

All files are UTF-8 without a byte-order mark, with LF line endings and one
final newline, and no Unicode normalization. Each starts with a line `---`, one
JSON object in the canonical form of CONTRACT-001 D, and a line `---`. That JSON
is also valid YAML.

A page or section file is a **part**.

### B. Manifest

The manifest's front matter is a `source_text` record (ID prefix `txt-`) with
the common record fields of CONTRACT-001 C. The UMF schema is the authority for
its fields:

| Field | Holds |
|---|---|
| `source` | The bibliography record this text belongs to |
| `identity` | What the copy says it is, read from the file's own metadata, a library header, or its title page: `title`, `subtitle`, `contributors` as stated, `issued`, `edition`, `publisher`, `place`, `venue`, `identifiers` (such as `isbn`, `doi`, `gutenberg`, `ia`, `lccn`, `oclc`), `title_pages` (part indexes that show them), and `basis`, which says where the values were read. Each is present only when known |
| `original` | The tie to the original (C) |
| `conversion` | `method`, `tools` with versions, `recognition` (who or what recognized the characters, as far as known), `level`, `scripts`, and `note` |
| `paged` | Whether the parts are pages |
| `coverage` | `all`: every page, or the whole text, is in the parts, blank pages included. `partial`: some is not, and `coverage_note` says which and why |
| `pages` | The part list, in order: `index`, `file` (relative to the directory), and `sha256` of that file |

The manifest's body, after the front matter, is free Markdown for people. It is
not source text.

`method` is `born_text` (the original is text), `text_layer` (text carried inside
a PDF), `markup` (EPUB, HTML, DOCX, or Markdown), `ocr` (character recognition,
including a text layer that recognition made), or `manual` (a person typed it).
`level` is `unassessed`, `good`, `fair`, or `poor`, and is `unassessed` unless
the author or a stated rule sets it.

### C. Ties to the original

`original.form` is `file`, `page_images`, or `physical` (paper or any other
object with no digital file).

| Field | Rule |
|---|---|
| `files` | For each digital original: `sha256` and `size` of its bytes and its `media_type`. A page image may name the page `index` it shows. No file name or local path is recorded. Required for `file` and `page_images`; empty for `physical` |
| `page_count` | The number of pages in the original, when it has pages and the number is known |
| `description` | What the original is. Required for `physical` |
| `held_at` | Where it is held, as stated: a library and shelf mark, an archive, "the author's copy". Required for `physical` |
| `obtained_from` | Where the author got it; `unknown` when not stated |
| `acquired_at` | When it was acquired or consulted, as stated; never guessed |
| `version` | Edition, release, or item version of what was acquired |

For a paged source with `coverage` `all` and a `page_count`, the part list MUST
hold exactly the indexes `0` to `page_count - 1`. A part list always runs from
its first index upwards without repeating; a section list runs `0, 1, 2, …`.

**Which page of the original a part is.** The explorer shows a part beside the
original only where the record establishes which page that is. Nothing is worked
out from the text, a printed label, a file name, or the order of parts. A part's
`index` is established as a place in a digital original in two cases only:

- **A page of a PDF**: `form` is `file`; `files` holds exactly one file, of type
  `application/pdf`; the source file is `paged` and records `page_count`; and
  every listed part's index is below it. The part with index `n` is the PDF's
  page `n + 1`, counting the file's own pages. A converter records `page_count`
  only when it made one page of text for each page of the file, in file order: it
  read them itself, or a supplied text with form feeds had exactly as many pages
  as the file. A transcription that states its own indexes records no
  `page_count`, so nothing says its indexes count the file's pages. A reader that
  draws the PDF MUST also find that it has `page_count` pages, and shows no page
  otherwise.
- **A page image**: `form` is `page_images`; each listed part's index is named by
  exactly one file of `files`; and the file named for the part is a PNG or JPEG
  image. When some part has no image, or two files name one index, the numbers of
  the images and of the text need not be the same numbers, so no image is shown
  for any part.

In every other case, a source with no pages, a physical original, another kind of
file, and a TIFF image included, no page is established, and a reader says why.

### D. Part files

A part's front matter is a `SourcePage` value of the UMF schema:

| Field | Rule |
|---|---|
| `index` | For a page, its zero-based position in the original (for an original with no file pages, in the transcribed sequence). For a section, its position in reading order. Equal to the manifest entry and the file name |
| `label_status` | `labelled`, `none` (the page carries no printed number), `unreadable`, `undetermined` (not established), or `unpaged` (the source has no pages; every section) |
| `label` | The printed label, exactly as printed (`xii`, `12r`); present exactly when `labelled` |
| `label_basis` | How a `labelled`, `none`, or `unreadable` status was determined: `printed_sequence`, `embedded_label` (stated inside the file and confirmed or agreeing with the printed numbers), `source_marker` (a page marker the source's own markup carries), `page_image`, or `author_statement` |
| `section` | A section's heading text, when it has one |
| `chapter` | The chapter number or name a section belongs to, when the source states it, as in a heading "CHAPTER IV" |
| `method`, `level` | How this part's text was extracted, and its quality |
| `columns` | `1`, `2`, or `undetermined` |
| `undetermined` | Structural elements not determined in this part: any of `paragraphs`, `headings`, `footnotes`, `block-quotes`, `tables`, `captions`, `figures`, `running-heads`, `folio`, `reading-order` |
| `note` | Free text about this part's extraction |
| `removed` | What a rule of this contract removed from this part: for each, its `kind` (`download_stamp`), the `rule`, and the `rules_version`. The removed words are recorded nowhere |

No label is ever worked out from a page's position, and no page number is ever
given to a source that has no pages.

### E. Body: blocks

A part's body is read as plain text lines. Stemma interprets no Markdown syntax
in it, only the annotations below. Annotations are HTML comments: hidden when the
Markdown is rendered and visible in the file and its diffs.

A body is a sequence of blocks in reading order. Each begins with a line such as:

```text
<!-- stemma:block role="paragraph" basis="markup" -->
```

The block's content is the following lines up to the next block line or the end
of the file; blank lines at its edges are not content. A page with no text has no
block. Text before the first block line is an error.

| `role` | Meaning | Stream |
|---|---|---|
| `undetermined` | Text whose structure was not determined; line breaks are as found | main |
| `paragraph` | One paragraph | main |
| `heading` | A heading; `level` 1 to 6 when known | main |
| `blockquote` | A quotation set off by the layout | main |
| `list-item` | One list item | main |
| `table` | A table as pipe rows; a delimiter row of `-`, `:`, and pipes is layout; a literal pipe in a cell is written `\|` | main |
| `caption` | A caption | main |
| `footnote` | A note body, of a footnote or an endnote; `label` is its marker; `continued="yes"` when it carries over from an earlier page | notes |
| `running-head` | A running head or foot | furniture |
| `folio` | The printed page number standing alone | furniture |
| `boilerplate` | A library's or distributor's own text around the work, such as a license or header; kept, and never matched as source text | furniture |
| `figure` | A description of a picture, plate, map, or diagram, or its alternative text; `by` names who wrote it. The image stays with the original | none |
| `note` | A converter's or transcriber's remark; `by` names who | none |

A block may carry `level`, `label`, `continued`, `column` (`1` or `2`), `by`,
and `basis`, which names the rule a role rests on (`markup`, `blank-line`,
`chapter-line`, `repeated-line`, `printed-label`, `font-size`, `boundary-mark`,
`page-image`, or `author_statement`). A converter MUST assign a role only when a
stated rule determines it. Otherwise the text stays `undetermined` and the part
lists what was not determined. Line-end hyphens are kept as found.

### F. Inline annotations and escaping

| Form | Meaning |
|---|---|
| `<!--stemma:fnref label="1"-->1<!--/stemma:fnref-->` | A footnote or endnote marker as it appears. It is kept out of matching text |
| `<!--stemma:uncertain by="…" alt="…"-->word<!--/stemma:uncertain-->` | A reading marked as possibly wrong, by a converter or a person; `alt` gives another reading. The enclosed words are source text |
| `<!--stemma:corrected was="atol1" by="person:…" basis="page-image"-->atoll<!--/stemma:corrected-->` | A person's correction; `was` keeps what the conversion produced. `by` MUST name a person |

Inline annotations do not nest and close within the block that opens them.
Attribute values are in double quotes, with `&`, `"`, `<`, and `>` written
`&amp;`, `&quot;`, `&lt;`, and `&gt;`; they hold no line break. A writer puts
attributes in the order `role`, `level`, `label`, `continued`, `column`, `by`,
`basis` on blocks, and `label`, `was`, `by`, `alt`, `basis` inline.

**Escaping.** Source text is untrusted data. A `<` in source text MUST be
written `&lt;`, and an `&` that begins `&lt;` or `&amp;` MUST be written
`&amp;`. So no text from a source can form an annotation. A raw `<` that does not
begin a defined annotation is an error. Nothing in a source file is an
instruction to a person, a script, or a model.

### G. Text streams

For one part, each stream is its blocks' content in order, joined by a line
feed, with entities decoded, inline annotations removed (`fnref` with its
enclosed marker), and table delimiter rows and cell pipes removed:

- **main**: what a quotation of the work is compared with;
- **notes**: footnote bodies, searched separately;
- **furniture**: running heads, folios, and boilerplate, never searched for
  quotations.

A source file's main stream is its parts' non-empty main streams in order,
joined by a line feed, so a quotation that runs across a page or section break
matches without the running heads, folios, and footnotes between its parts, and
a word hyphenated across the break joins as at any line end. The notes stream is
joined the same way. Each offset range maps back to the parts it lies in.

### H. Digests and passage addresses

- A part entry's `sha256` is the digest of the part file's bytes with CRLF
  turned into LF.
- The **text digest** of a part is the digest of the canonical form of
  `{"furniture": …, "main": …, "notes": …}`, its three streams. A review and a
  comparison bind to it, so a layout change leaves them current and a change of
  words or of what counts as source text does not.
- A **passage address** names the source file and, for each part the passage
  lies in, in order: the part `index`, its text digest as `page_sha256`, the
  `stream` (`main` or `notes`), and `start` and `end` offsets in that part's
  stream, counted in Unicode code points. An address stays valid while those
  parts are unchanged, whatever changes elsewhere. Outputs cite passages by
  these addresses.
- A listed part whose file is missing or differs, and an unlisted file in the
  directory, are reported by `source.pages` (CONTRACT-002 C). Checks and
  excerpts do not use the text of such a source file.
- A person edits a part, using `corrected` where words change, then records the
  edit with `source seal`, which updates the digests and stamps `changed`. git
  holds the history. A model may flag a suspected error in a `text_review`; it
  never edits.
- A source file is retired, never deleted by a command (CONTRACT-001 C).

**Text that is not here (FR-104).** A copy of a project may hold a source file's
manifest and none of its parts, for example because the author does not commit
that text. This is the case **text not held** when the manifest is sound, it
lists at least one part, every listed part file is absent, and no other rule of
H is broken. The manifest, with each part's digest, is still the record of what
the text was. A source file with some parts missing or changed is **damaged**.
Either way the text is not used.

**Restoring text that is not held.** Given the original, a converter may write
the absent parts again. It converts with the settings the manifest records:
whether the text was recognized, and the original's type. Page labels are in the
parts, not the manifest, so it tries each way it knows to set them: the page map
and page-number data a supplied ingest plan names for that original, the labels
proposed from the pages' own text, and no labels. It writes parts only when one
conversion gives exactly the listed part files, each with the digest the
manifest records; then it writes only those files. Otherwise it writes nothing
and reports what differed. Supplied or typed text, text a person corrected or
relabelled by hand, and text made by other converter versions may not be
reproducible this way; it then has to come from wherever the author keeps it.
No step uses a part's expected digest to shape a conversion.

The same conversion and the same condition apply to bytes a recorded address
gave that are not the original, as when a page differs on each request. Parts
that all match are the recorded text; the bytes are still not the original and
are treated as nothing else.

### I. Conversion rules by format

| Original | Parts | Structure taken from | Identity taken from |
|---|---|---|---|
| Plain text | Pages at form feeds; otherwise sections at chapter lines | Blank lines (paragraphs); lines such as "CHAPTER IV" (headings) | A library header when present |
| Project Gutenberg plain text | Sections at chapter lines | As plain text; the text outside the `*** START OF` and `*** END OF` lines is `boilerplate` | The header: title, author, release and update dates, ebook number, language, credits |
| Markdown | Sections at level 1 and 2 headings | Markdown headings, paragraphs, quotations, lists, tables, and notes | The file's front matter when present |
| HTML and XHTML | Pages at source page markers, else sections at level 1 and 2 headings | Elements | `title` and `meta` elements |
| EPUB | Pages at page-break markers, else sections for each spine document and its level 1 and 2 headings | Elements; `epub:type` notes | The package document's Dublin Core metadata |
| DOCX | Sections at level 1 and 2 headings | Paragraph styles, tables, footnotes | The core properties |
| PDF | One page per PDF page, blank ones included | Text order, with the roles the rules below determine | The document information |

For PDF, a converter assigns `running-head` to a line among the first two or last
two of a page whose letters recur at that edge on at least three pages
(`repeated-line`); `folio` to an edge line that is exactly the page's label
(`printed-label`); `columns` `2` and left-then-right order only when no line
crosses a clear gutter and each side holds at least five lines. In a PDF not
marked as recognized text, it assigns `footnote` and `fnref` only when a small
raised marker that occurs once in the body and a smaller line at the foot of the
same page begin with the same marker, and `heading` only to a short line set at least 1.2 times
the body size. Everything else stays `undetermined`, a PDF original's endnotes
included: their text stays in the main stream, where it can be quoted, and is
not marked as notes (PRD FR-96, an open gap).

**Download stamps.** A library or publisher may add to the copy it serves a
line saying who downloaded it, from which network address, and when. That line is
no part of the work and is data about a person. Every converter, and every
reading of text to be compared or transcribed, MUST remove it and MUST record
the removal in the part's `removed`, never the words removed. A stamp is
recognized only by a rule that matches its whole form, so that the work's own
words are not taken for one. Rules version 1:

| Rule | Form it matches |
|---|---|
| `annual_reviews` | "Downloaded from" an annualreviews.org address, then a reader or institution, "IP:" with a network address, and "On:" with a date and time |
| `jstor` | "This content downloaded from" a network address "on" a date and time with its zone, with the line about terms that may follow it |
| `taylor_francis` | "Downloaded by [" a name "] at" a time and a date |
| `wiley` | "Downloaded from" an onlinelibrary.wiley.com address "by" a name, "Wiley Online Library on" a date in brackets, and the terms sentence's opening |

The rules are applied to a PDF's text as it is read, before lines, page labels,
and structure are worked out, so that converting the original again gives the
same text. The original is unchanged, and its digest still ties the source file
to it. A stamp in a form no rule matches is not removed: the author or an agent
who sees one reports it before the source file is published.

For markup, elements with roles that carry no stated meaning stay as paragraphs.
Images become `figure` blocks holding their alternative text, or a statement
that none is given. Scripts, styles, and external references are never run or
fetched.

An image-only or paper original has no built-in converter: its text enters as a
text made by a recognition tool the user runs (`ocr`, naming the tool) or typed
by a person (`manual`), as a transcription input (K).

### J. Determinism and round trip

- Reading a source file and writing it again gives the same bytes when it is in
  canonical form. `fmt` rewrites only layout: front matter form, line endings,
  and blank lines at block and file edges. It never changes a stream.
- A converter given the same original bytes, options, and tool versions MUST
  produce the same part files byte for byte. Part files hold no time, record ID,
  or machine detail.

### K. Transcription input

Text that a recognition tool made or a person typed is supplied to a converter
either as plain text with a form feed after each page, whose blocks stay
`undetermined`, or as one file in which each page starts with a line
`<!-- stemma:page index="0" label="88" basis="page_image" -->` and continues
with blocks and inline annotations. `label_status="none"` or `"unreadable"` with
a `basis` records those states; with neither, the page is `undetermined`.

## Precedence and Compatibility

- The UMF schema governs declared fields; this contract governs the format and
  the rules the schema cannot express; CONTRACT-001 governs record behaviour.
- `schema` carries the record major version. A reader MUST NOT rewrite a newer
  one.
- An unknown annotation, role, or attribute is reported, and the source file is
  not used until it is corrected.

## Error Semantics

| Condition | Outcome | Retry | Recovery Expectation |
|---|---|---|---|
| Front matter unreadable | `record_unreadable`; the source file is not used | no | Repair the file or restore it from git |
| A field or rule of B to D broken | `record_invalid` with the field | no | Correct the field |
| Unknown or unclosed annotation, raw `<`, text outside a block, a correction not by a person | `record_invalid` naming the file and line | no | Correct the markup |
| Some parts missing, or a part unlisted, edited without sealing, or out of sequence | `source.pages` fails; dependants cannot be checked | yes | Restore the file from git, or review the edit and run `source seal` |
| Every listed part absent, the manifest sound (text not held, H) | `source.pages` cannot check (`not_held`), once for the source file; dependants cannot be checked | yes | Fetch and convert it again with `ingest --fetch`, or give the original with `ingest --originals` |
| A binary or other stray file in `sources/` | `record_misplaced` | no | Move it out of the repository |
| A binary file elsewhere in the repository | `project.binary` fails (CONTRACT-002 C) | no | Keep it outside the repository; convert it if it is to be read or cited |

## Examples

All text is invented.

```text
---
{
  "columns": "undetermined",
  "index": 3,
  "label": "2",
  "label_basis": "printed_sequence",
  "label_status": "labelled",
  "level": "unassessed",
  "method": "text_layer",
  "undetermined": [
    "paragraphs"
  ]
}
---

<!-- stemma:block role="running-head" basis="repeated-line" -->
THE HARBOUR 2

<!-- stemma:block role="undetermined" -->
Some fields were aban-
doned by their holders.<!--stemma:fnref label="1"-->1<!--/stemma:fnref-->

<!-- stemma:block role="footnote" label="1" basis="font-size" -->
1 An invented note.
```

The main stream is the two lines of the middle block without the marker. The
note is in the notes stream, and the running head in the furniture stream.

## Non-Normative Notes

- HTML comments keep annotations out of rendered views while keeping each one
  next to the words it describes.
- Markdown headings and lists in a part body are not interpreted, so a line from
  a source that starts with `#` stays ordinary text.
- A copy of a project without some source files' parts is an ordinary state, not
  damage; what rests on them cannot be checked in that copy.
- A repository that holds source files shows their full text to anyone who can
  read it, so publishing the repository publishes them.

## Proof Status

| Element | Evidence | Not shown |
|---|---|---|
| Format, round trip, escaping, streams | Tests over synthetic sources on one macOS system | Right-to-left and complex scripts; very large works; other systems |
| Converters | Tests over synthetic PDF, DOCX, HTML, EPUB, Markdown, and Gutenberg-style text; the worked example converts real PDFs on one system | Real Gutenberg, EPUB, and DOCX files from the range of tools |
| Download stamps | Tests over invented stamps in each of the four forms; one real `annual_reviews` stamp | The other three forms in real files; any other form, which is left in place |
| Determinism | Repeat conversions compared byte for byte on one system | Across systems and runtime versions |

## Schema Basis

`SourceText`, `SourcePage`, and their value types are part of the UMF document in
`ddx.schemas` (UMF core 0.10.0 with `umf.ddd` 0.1.0). The block and annotation
grammar is local to this contract: UMF describes record structure, not marked-up
text. W3C Web Annotation and TEI (a text-encoding standard for the humanities)
were considered for vocabulary; their markup is too heavy for files a person
reads and corrects, and no claim of compatibility is made.
