---
ddx:
  id: CONTRACT-006
  type: contract
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-005
    - stemma.adr-009
    - CONTRACT-001
    - CONTRACT-002
---

# Contract: Manuscript markup and typesetting conversion

**Contract ID**: CONTRACT-006
**Type**: schema (text format) and library
**Version**: 0 (provisional in every part; see Proof Status)
**Related**: ADR-005, ADR-009, FR-14, FR-25, FR-29, FR-35 to FR-39, FR-65, FR-72, FR-73, FR-83, FR-92

## Purpose

Defines the Stemma copy of a manuscript: its files, markers, supported layout
features, what checks read from it, and how it becomes Typst for print and
browser preview.

## Scope and Boundaries

- In scope: syntax, reading rules, edits, takeover output, and conversion.
- Out of scope: book design values (fonts, margins), image records, and Word,
  LaTeX, or HTML export (deferred past v1). Authorship marks (FR-27) are
  records bound to exact text (CONTRACT-001 G), not markup.
- Owning module: `packages/manuscript` for the reader, model, and edits;
  `packages/cite` for citation text; `packages/publish` for the build.

## Normative Surface

### A. Files

- One file per chapter record: `manuscript/<chapter id>.md`, named by
  `chapter.manuscript_path`. `chapter.order` and `chapter.matter` (`front`,
  `body`, `back`) give book order. Titles never form file names.
- UTF-8 without a byte-order mark, LF line endings, no Unicode normalization.
- The base is CommonMark 0.31.2 (a Markdown specification), restricted to the
  features in E plus the markers below. Anything else is an error, never
  silently dropped or passed through. Raw HTML, HTML comments, raw Typst,
  includes, and remote resources are errors.

### B. Attributes

Markers attach attributes written `{ … }` immediately after a bracketed span,
heading, or fence opener. Items are `.class`, `#id`, or `name="value"`,
separated by spaces. A value escapes `"` and `\` with `\`. A span is
`[inline content]{attributes}`. An unknown class or attribute is an error. A
literal `[`, `]`, `{`, `}`, or `@` that would be read as markup is escaped with
`\`.

### C. Markers

**Citation.** A cluster is one or more items separated by `;`:

```text
cluster  = "[" item *( ";" SP item ) "]"
item     = "@" key *( SP name "=" quoted-value )
key      = CONTRACT-001 citation key, or "?" for an unbound occurrence
```

| Item attribute | Rule |
|---|---|
| One locator, named by a CSL (Citation Style Language) locator term, such as `page`, `folio`, `chapter`, `line`, `verse`, `section` | At most one per item; the value is the printed string; ranges use an en dash or hyphen as printed |
| `prefix`, `suffix` | Plain text around the item |
| `mode` | `suppress-author` or `author-only` |
| `id` | A `citation` record ID. Required on every occurrence from takeover and kept through edits; absent on authored occurrences. Required when the key is `?` |

A locator is never inferred from untyped text. An item with key `?` renders as
the record's `as_found` text and fails `cite.key`.

**Quotation.** `[quoted words]{.quote cite="1"}` marks a quotation. `cite` is
the one-based position, among citation items in the same sentence, of the item
it quotes. Surrounding quotation marks are not part of the quoted text. `cite`
MAY be omitted when the sentence has exactly one item. A block quote is a
quotation of the item named by a `.quote` attribute line, or of the only item in
the quote or in the sentence that introduces it.

**Claim anchor.** `[sentence or passage text]{.claim ids="clm-… clm-…"}` says
this text asserts those claims. It MUST enclose the citation clusters that
support them, MUST stay within one block, and MUST NOT overlap another claim
span; nesting a quotation span inside is allowed. This span is the only saved
link from manuscript text to claims.

**Needs a source.** `[text]{.needs-source}` records the FR-25 mark. It passes
`draft.marked` only when it contains, or is in the same sentence as, a citation
item with a bound key and a locator.

**Not a quotation.** `[words]{.not-quote}` excludes quoted words, such as a term
under discussion, from quotation reading. The report lists the count and
locations.

### D0. The output reads as scholarship

The manuscript is the work itself: ordinary scholarly prose that states a thesis
and argues it. Its text and notes MUST NOT carry process or tool commentary:
nothing about Stemma, records, checks, what cites what, or verification status,
and no narration of "the source". Evidence appears through normal scholarly
citation, quotation, and footnotes: full citation, locator, and verbatim
quotation. Passage addresses, digests, review state, and reports live in the
records and in separate reports, never in the body or footnotes. Footnote
quotations and locators are generated from passage records by script (FR-91),
never typed. The argument is assembled from a thesis, the passages that bear on
it, contrary evidence included, and a test of whether they support it.

### D. What checks read

Checks, build, and preview use one parsed model from one reader: chapters,
blocks, sentences, citation occurrences, quotations, claim spans, marks, notes,
cross-references, and index entries. No check reads generated Typst or PDF to
find them.

**Sentences.** A versioned profile, `sentence-split/0`, splits each block's
plain text. **A footnote or an endnote is a note**, and every rule of this
contract about notes or footnotes applies to both; only their syntax and where a
build prints them differ. A citation cluster that directly follows sentence-ending
punctuation belongs to the preceding sentence. A footnote's sentences are
separate; a note holding only citations belongs to the sentence carrying its
marker. A sentence's `text` is its plain text with citation clusters and marker
syntax removed, then normalized as CONTRACT-001 E defines. The abbreviation
rules of the profile are set by the verification solution design.

**Quotations.** Besides marked spans and block quotes, text between double
quotation marks in running text or notes is a quotation. It is attributed only
when its sentence has exactly one citation item. An unattributed quotation gives
`quote.present` `unverifiable` with `unattributed_quotation`, unless marked
`.not-quote`. Single quotation marks count only inside a marked span. Other
quotation conventions are not detected; the report states this. These inference
rules are design assumptions.

**Locus.** A finding's locus is the citation `id` when present; otherwise
chapter ID, sentence digest, key, locator, and the occurrence's ordinal among
equal ones in that sentence. Edits elsewhere do not change it. CONTRACT-002 C,
"Reading the manuscript", settles repeated sentences and quotation results.

| Check | Reads |
|---|---|
| `cite.key`, `locator.extent`, `source.held` | Citation items |
| `bib.uncited` | All items, against `bibliography_include` |
| `quote.page` | Quotations with an attributed item and its locator |
| `quote.present`, `quote.self` | Quotations and their attributed item |
| `draft.marked` | `.needs-source` spans |
| `number.present`, `construct.credit` | Sentences with citation items |
| `support.current` | Claim spans containing citations: each claim in effect there is a cited claim |
| `claim.inactive` | Claim spans whose claim is retired |
| `cite.unlinked` | Citations in no claim span |

**One writable copy.** The manuscript is authoritative for the current key,
locator, quotation, sentence, and claim links. A `citation` record keeps what
intake found: `as_found`, position, and the sentence, key, source, locator,
quotation, and claims as first written. Those fields are history and are never
updated. The record's current source is the one the manuscript key resolves to.

### E. Supported layout features

| Feature | Syntax | Available |
|---|---|---|
| Paragraphs, emphasis, strong emphasis, hard line break | CommonMark | M1 |
| Headings, levels 1 to 4; level 1 is the chapter title | `#`, optional `{#sec-id}` | M1 |
| Block quotes | `>`; optional attribute line directly under the last quoted line | M1 |
| Ordered and bulleted lists | CommonMark | M1 |
| Footnotes | `[^label]` with `[^label]: text`; continuation lines indented. A footnote label does not begin `en-` | M1 |
| Endnotes | `[^en-label]` with `[^en-label]: text`; continuation lines indented | M1 |
| Citations, quotations, claim anchors, marks | C | M1 |
| Language and direction | `[text]{lang="ar" dir="rtl"}`; the same attribute line on a block quote | M1 spans and quotations |
| Unconverted content | `::: unconverted {id="itm-…"}` … `:::` | M1 |
| Bibliography | Generated at the end of the book from cited sources plus `bibliography_include` in `stemma.json`; no manuscript syntax | M1 |
| Front and back matter | `chapter.matter` | M2 |
| Alternative interpretations section (FR-26) | `::: alternatives {#alt-id}` … `:::`, holding ordinary blocks and markers | P1 |
| Figure | `::: figure {#fig-id sha256="<sha256>" media="image/svg+xml" alt="…" width="80%"}`, caption, `:::` | M2 |
| Table with caption | `::: table {#tbl-id}`, a pipe table, caption, `:::` | M2 |
| Cross-reference | `[](#id){.ref form="number"}` or `form="page"` | M2 |
| Index entry | `[]{.index term="…" sub="…" sort="…" index="subjects"}` | M2 |

Running heads, folios, and table of contents are generated from structure
(M2). Right-to-left main text is experimental; v1 covers left-to-right books
with right-to-left quotations. A feature not listed needs a revision of this
contract. An unresolved ID or cross-reference is reported.

### F. Takeover output and edits

- Takeover does not copy the original reference list into a chapter; it adds
  its entries to `bibliography_include` (CONTRACT-003 F).
- Takeover writes each footnote as a footnote and each endnote as an endnote
  (FR-96), with its definition in the chapter file that holds its marker. A note
  whose marker was not found is kept as a note definition, with an
  `intake_item`; how a definition without a marker is written is set with the
  writer.
- Takeover writes one chapter file per detected chapter and says how it chose
  the divisions. Every citation item it writes carries an `id`.
- It converts only features in E available at its step. Other content that
  carries text goes into an `unconverted` block holding the extracted text, with
  an `intake_item`; content without text is reported with its position. Nothing
  is dropped silently. Word styling with no feature in E is not carried, and the
  intake report lists the kinds lost.
- Claim spans are written around passages for extracted claims. Those claims
  are in effect at once, unreviewed. A span whose claim is retired is reported
  by `claim.inactive` and links nothing.
- An unbound or ambiguous reference is written with key `?`.
- An author-date parenthesis whose every part is a citation form (CONTRACT-003
  H) is replaced by one cluster, one item per work and year. Lead-ins become
  `prefix` and pages a `page` locator. A working marker that CONTRACT-003 H
  keeps with an item is written as its `suffix`, exactly as typed, so it stays
  with the citation. Here the locator comes from the form the
  intake profile names, not from a guess by the markup reader. Each item has its
  own `citation` record, whose `as_found` keeps the bracketed text as typed,
  with any narrative names, and whose `document_position` keeps where it was.
- In a narrative form the author's names stay in the prose and each item has
  `mode="suppress-author"`. How a note style typesets it is not settled (PRD
  open question on the pilot's citation style).
- A parenthesis left unlinked stays as text, escaped as B requires. So do the
  author's own bracketed working markers, other than those written as an item's
  `suffix`.
- A tool edit (round choice, retired claim, repoint) MUST change only the
  affected byte span and leave the rest of the file identical. It MUST refuse if
  the file changed since it was read.
- Originals are never written.

### G. Conversion to Typst

1. Parse and validate all chapters. A syntax error stops that build and names
   file, line, and column; no older PDF is presented as current.
2. Project cited records to CSL-JSON deterministically.
3. Number notes in book order. A citation in running text becomes a note under a
   note style; a citation inside an author's note is formatted within it.
4. citeproc-js formats every cluster in book order, given each note number, so
   that repeated and short forms and back-references can resolve. Typst's
   bibliography engine is not used.
5. A Stemma output format turns citeproc-js results into Typst markup. All
   manuscript, record, and processor text is escaped; no input becomes Typst
   code.
6. Generate `.typ` files under `build/`. They are never edited or read back.
7. Compile with the pinned Typst version, vendored pinned fonts and packages,
   file access limited to the build directory, no network, and a fixed creation
   timestamp. A missing glyph or substituted font is reported, never silent.

Trim size is `trim_size` in `stemma.json`: `6x9in`, `5.5x8.5in`, or `a5`. A
draft carries the unverified watermark; a `camera-ready` build carries none
(CONTRACT-002 F). Both are written whatever the findings. The first special PDF
standard is PDF/A, for black-and-white or RGB books. If the pinned Typst cannot
produce it, for example from a placed figure or without alternative text
(unverified), the build reports a tool limit and still writes the other outputs.
No output is claimed to conform to PDF/A or to be accessible unless verified.
The build checks that Typst's note numbers equal those given to citeproc-js; a
mismatch is a tool failure, because the citations would be wrong.

### H. Browser preview and sentence links (M3)

- The preview uses the same reader, projection, citeproc-js version, output
  format, style, locale, fonts, and packages as the print build, as
  browser-safe TypeScript, with a Typst compiler compiled to WebAssembly.
- A preview whose compiler version differs from the pinned one, or whose layout
  is not shown to match print, MUST say so on screen.
- A linked build wraps each sentence in a link to its locus and writes a map
  from locus to claim IDs and citation items. Nested links are flattened in that
  build only. Hanging punctuation is off in both builds so that linking does not
  move text.
- The print PDF carries no Stemma sentence links.
- An edit reaches the preview when the agent rebuilds it and the author reloads
  the page (CONTRACT-005 D). The page compiles the rebuilt text; it does not
  update while open.

### I. Assembled reports (M1)

`graph export` also reads the report in `report/` and shows it in the explorer
with links to its sources (CONTRACT-005 L), from the same assembly that writes
`report.md`.

Before the manuscript reader exists, a report is built from a template and the
project's records by `build report` (CONTRACT-002 B). Its directory holds:

- `report.json`: `manuscript` (the template's file name), `quotations` (each with
  an `id`, `cites` (a citation key), `passages` (passage IDs in order, with an
  optional `join` string and `join_note`), and optional `note` (the passage is a
  note on its page: the locator gains `n`), `corrections` (`was`, `now`, `by`,
  `basis`; each must match exactly once), `italic`, `keep_hyphens`, and
  `checked`), and `verification.preamble`.
- The template: paragraphs separated by blank lines. `{{q:<id>}}` is replaced by
  the quotation in curly double quotation marks; `[^<id>,<id>…]` is a note citing
  those quotations; `[^<ids>|<comment>]` adds the author's comment, which may hold
  `{{q:<id>}}`; `{{bibliography}}` is replaced by the bibliography.

A quotation is copied from each passage's address, which must still give the
passage's `quote.exact`, and the passage must belong to the cited source or the
work it is `part_of`. Line-end hyphens are joined unless listed in
`keep_hyphens`; line breaks become spaces; `corrections` and `italic` apply.
Template text is never changed.

**Notes: quotation, then source.** Each note gives its quotations verbatim, each
in quotation marks with a full stop inside them unless it ends with a full stop,
question mark or exclamation mark, then the citation formatted by citeproc-js
(G), so the locator appears once. Consecutive quotations from the same work and
page share one citation; a quotation from another page or work is followed by
its own citation, shortened as the style shortens a repeated one. The author's
comment follows as a separate paragraph. A letter printed in a collection is
cited as the collection at its page, preceded by the style's own description of
the letter (author to recipient, date), so that a shortened note still names the
volume and page. The order follows the practice that secondary guides attribute
to the Chicago Manual of Style, 17th edition, 14.38; neither that text nor the
18th edition's wording has been checked against the manual.

`verification.md` lists, for each note, each passage's address, record, printed
page, how it was checked, and every change from the source text; and, for each
cited work, where its details were read, from the source record's change log. It
is not part of the publication. `report.typ` escapes all text (G5).

## Precedence and Compatibility

- Versioning: `Project.format` covers the markup version; `sentence-split` has
  its own. A profile change can end annotations, so it ships as a migration
  that lists them first (Data Design).
- Precedence: this contract, then CommonMark for the features it admits. The
  manuscript is authoritative over citation records for current text (D).
- A new feature or attribute is compatible for newer readers; an older reader
  reports it as unsupported.
- Deprecation: a removed syntax is converted by migration.

## Error Semantics

| Condition | Outcome | Retry | Recovery Expectation |
|---|---|---|---|
| Unsupported construct, unknown attribute, raw content | `manuscript_unsupported` with position; checks over that file cannot run; the command exits 3 | no | Use a defined feature |
| Malformed marker or overlapping claim spans | `manuscript_syntax` with position; exit 3 | no | Correct the marker |
| `id` or claim ID missing or of the wrong kind | `reference_dangling` | no | Repoint or remove |
| Same citation `id` used twice | `manuscript_duplicate_id` | no | Remove one |
| `unconverted` block present | Build lists it and typesets its text marked as unconverted | yes | Convert by hand |
| citeproc-js cannot format a cluster | The output shows it visibly and the report lists it (`cite.format`); text is not hand-made | yes | Correct the record or style |
| Note numbers disagree | `note_numbering_mismatch`; build fails | no | Report the defect |
| File changed during a tool edit | `stale_input`; nothing written | yes | Re-read and apply again |

## Examples

All content is invented.

```markdown
# Harbours {#sec-harbours}

[The mole was rebuilt at least once.[@example-1987 page="41"]]{.claim ids="clm-4q7m2c9x0b5ke8dn1v3a"}
One survey calls it ["a patched wall"]{.quote cite="1"}.[@example-1990 page="12"; @? id="cit-3k9d2m7q0x5v8b1n4c6t"][^dates]

[Trade fell afterwards.]{.needs-source}

[^dates]: The dates are disputed; see [@example-2001 chapter="3" prefix="especially"].
```

A cluster placed after the claim span's closing brace would not make that claim
cited.

A conformance test reads this file and expects, for its first sentence, one
claim, one citation item, and the sentence text `The mole was rebuilt at least once.`; changes the
page and expects a new locus and the same sentence digest; and converts a file
containing raw HTML, expecting `manuscript_unsupported`.

## Non-Normative Notes

- The citation form resembles Pandoc's but is not compatible with it: locators
  are named, never guessed.
- A reader MAY be built on a pinned CommonMark library or written for this
  subset; the choice is open to the solution design.

## Proof Status

| Element | Evidence | Not shown |
|---|---|---|
| Reader, sentence and quotation rules, and the checks that read them | Tests over invented text on one macOS system | Real manuscripts, Linux, Windows, whether authors tolerate the syntax |
| Edits and takeover output | None. Design only | All |
| citeproc-js to Typst | A feasibility test with 10 records and a 14-note sequence passed 12 of 14 Chicago rows, byte-identical across runs, one macOS system; expected strings were not checked against the manual | This markup, the output format, note-number agreement |
| Typst features | Feasibility tests: footnote markers after Arabic or Hebrew quotations needed a direction-mark helper; indexes and per-chapter endnotes worked with the packages in-dexter 0.7.2 and deixis 0.2.0; TIFF and EPS were rejected; bleed wrote no BleedBox; fixed timestamps gave identical bytes | Conversion from this markup; right-to-left quotations at book length |
| Sentence links | 43 test sentences linked both ways, with hanging punctuation off and nested links flattened | Converter-generated links |
| Browser Typst | Not tried | All of H |

## Schema Basis

This is a text format. UMF (the DocumentDrivenDX schema format) describes
record structure and is not used for the grammar. Record IDs, claim links, and
keys reuse CONTRACT-001.
