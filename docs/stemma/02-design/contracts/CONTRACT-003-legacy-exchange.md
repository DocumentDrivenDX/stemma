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
**Related**: ADR-002, FR-13, FR-71 to FR-73, FR-92, FR-93

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

1. The original file is read only and is not copied into the project. An
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

When every record of a batch is unchanged, the whole batch is requested, and the
author supplies the original file whose digest the batch records, an exporter MAY
emit those bytes.

### E. Export of Stemma data, and cross-format export

Export always produces a `stemma.loss-report/0` JSON document: target format and,
per record, items `{path, class, note?}` with class `unrepresented` (no home in
the target), `approximated`, or `representation_change`. Passages, notes, claims,
links, places, source files, and provenance are normally `unrepresented`. With
`--policy report` (default) output and report are written. With
`--policy strict` any item other than `representation_change` writes no output.
Exporting to a different format than the origin is never covered by C, and
preserved native fields of another format are `unrepresented`. Exports omit
restricted values.

### F. Word intake

`takeover` MUST:

1. Read body text, headings, tables, footnotes, and endnotes in document
   order, and leave the file unchanged. Word heading styles set heading levels.
   Table text is read; until the markup carries its layout (CONTRACT-006 E) it
   goes into an unconverted block. Each run reads one file. A further file of
   the same manuscript adds chapters and batches to the project and changes no
   earlier record or choice.
2. Recover embedded reference-manager data where present: Zotero and Mendeley
   citation fields or content controls carrying CSL-JSON, and EndNote fields
   carrying EndNote XML. Each variant has its own support level (A).
3. Treat embedded data as a claim to check, never as verified.
4. Report tracked changes, comments, text boxes, and fields it did not
   interpret. Each comment is saved as an `unread_content` item with its text and
   position. Text marked deleted by tracked changes MUST NOT produce citations;
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
   ambiguous, and unclassified, plus items under 4 and the support levels, the
   matching profiles used, and the author-date account of H. Every item that
   needs the author or was not read is also saved as an `intake_item` record.
   Items that share a cause are shown as one group with its count, its items,
   and a next step; grouping drops no item. The groups include exact repeats:
   open reference-entry items, from any batch, whose `as_found` strings are
   identical. Groups are computed from records and not saved.
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
12. Read author-date citations in text by the profile in H.

Model-proposed parses MAY be added only as unreviewed records with a `model`
actor, saved before any deterministic step reads them, and each parsed string MUST align to a
span of the document text.

### G. Untrusted input limits

All codecs MUST treat input as hostile: refuse archive entries with absolute or
parent paths; cap uncompressed size, entry count, nesting depth, and field
length; disable XML DTD and external entity processing; never fetch a URL found
in a file; and never interpret file text as instructions. Limits are published
by `doctor`. Cap values are set by the takeover solution design.

### H. Author-date profile

The profile is `author-date/0`. It is deterministic. Its rules are design
assumptions drawn from one private set of drafts and are untested. Adding a
form, a lead-in, or an entry layout makes a new profile version.

**Reference lists** (FR-92).

1. A list starts at a body paragraph whose whole text, ignoring case and outer
   spaces, is `References` or `Bibliography`, with or without a heading style.
   It ends at the next heading of the same or a higher level, at the next such
   start paragraph, or at the end of the file. A start paragraph with no
   heading style has no level, so the next heading of any level ends its list.
   Notes, tables, and captions neither start nor end a list. The report names
   the paragraph taken as the start.
2. Each non-empty body paragraph in a list is one entry. Its whole text is kept
   as `as_found`. A heading of a lower level inside the list is reported as a
   subheading and is not an entry. Notes, tables, and captions inside the list
   are not entries and are examined as text. A paragraph that may hold more or
   less than one entry is reported:
   - `line_break`: it holds a line break;
   - `several_entries`: after a line break or a sentence end, the rest reads as
     another entry that begins `Family, Given` and has the year after the
     authors. Such a paragraph is **unread**;
   - `continuation`: it is unread, follows another entry, and begins with a
     digit, punctuation, or a lower-case word that does not begin a name.
3. The profile reads authors' family names in order, the year, and any
   one-letter year suffix, in two layouts: the year directly after the authors,
   and the year near the end of the entry. An entry whose authors or year cannot
   be read is **unread**. When in doubt it is unread, because an entry read with
   too few authors could take another work's citations.
   - **Authors.** A person is `Family, Given`. A later author may also be
     `Given Family` or `I. Family`. Authors are joined by commas, `and`, or `&`.
     Editor marks such as `(ed.)` and `eds` are not names. `et al.` or `and
     others` marks the authors as cut short. A name with no comma and no
     initials is a corporate author, or a single name, and is one **whole
     name**. A later `Given Family` with no initials, joined only by commas,
     is a person only where `and` or `&` comes at or after it, or, in the
     year-after-authors layout, where `et al.` or `and others` ends the authors. An abbreviation in capitals followed by its
     full name in round brackets is one whole name, and a citation of either
     matches it. Initials with no comma, and text after `and`, `&`, or `with` that
     is not a name, leave the entry unread.
   - **Year after the authors.** All the text before the first year form reads
     as authors, apart from an opening bracket and punctuation. In this layout
     only, the first author's initials may be followed by one given name, as in
     `Family, I. Given`, when that author stands alone or a comma follows.
   - **Year near the end.** The authors are read from the start and must end at
     an opening quotation mark, at a full stop, after initials followed by
     only a space and a title, or at a comma that no name follows. A whole name
     ends at a comma only before a quoted title. If anything just past that
     point could name another author, such as `with`, `and`, `und`, `et`, or a second
     `Family, I.` after any punctuation, the entry is unread. The year is the last year form that is not in a page
     range or a web address. It follows a comma, colon, semicolon, full stop,
     or opening bracket, with at most a day and a month between. Only
     punctuation, volume, issue, and page details, and a web address or DOI may
     follow it.
   - An entry that begins with a repeated-author mark (a long dash, or two or
     more dashes or underscores) types no author and is unread.
4. Every entry, read or unread, is carried forward by F11.
5. A list serves the chapters read from its own file. In a file with one list,
   it serves all the file's text. In a file with several, each serves the text
   after the list before it (or the start of the file) and up to its own start,
   so a list never serves another chapter's citations; text after the last list
   has no list. A file with no list is reported, and so is one with several.

**What is examined.** Every pair of round brackets that holds a year form, in
body text, headings, footnotes, endnotes, tables, and captions, outside the
reference lists. A year form is a number from 1000 to 2099 with an optional
lower-case suffix letter, or `n.d.`, `forthcoming`, or `in press`, ignoring
case. A number that is part of a longer number, such as `12000` or `1,500`, is
not one. A pair is examined when a year form stands in it outside any pair
nested inside it. A pair that holds a nested pair is never a citation. A
bracket with no partner in its paragraph makes no pair; one followed by a year
form is reported apart from the counts. The content is split into parts at
semicolons.

**Citation forms.**

| Form | Rule |
|---|---|
| Names and year | `Name Year`, with an optional comma between. Names are one name, two joined by `and` or `&`, a series ending in `and` or `&`, or one or more followed by `et al.` |
| Several years | Further year forms after a comma share the part's names, one item each |
| Narrative | The brackets hold only year forms and locators, and names in a form above stand directly before them in the same sentence |
| Lead-in | `cf.`, `see`, `see also`, or `based on` before the names, kept as `prefix` |
| Page locator | After the year: any page or range after a colon or after `p.` or `pp.`, or after a comma when it is not a year form. Kept as printed, as a `page` locator |

- A **name** is one or more words that begin with a capital letter, or with a
  letter of a script without capitals. It may hold name particles such as `van`
  or `de` before or between them, and `of`, `for`, `the`, or `on` between them.
  A capitalized sentence word such as `In`, `As`, `Compare`, or `Although`
  does not begin a name in brackets. A month or season is not a name unless
  some list of the project has it as a family name.
- A lead-in is read ignoring case.
- A **working marker** is text in square brackets at the end of a part, set off
  by a space, with at least one letter, no year form, and no square bracket
  inside, as in `(Adair 2017, 12 [CHECK])`. Markers do not stop a part from
  being a citation form. Those at the end of a part, one or several, are kept
  exactly as typed with its last item, as its `suffix` (CONTRACT-006 F). Their
  words are not read. A marker changes no state, and a link says nothing about
  what the marker asks. Brackets anywhere else in a part, or with a year form
  inside, such as `[1850]`, are other text. A semicolon inside square brackets
  does not split parts, a part that is only a marker is not a citation form,
  and markers are not names when looking for a range of dates.
- A page is a number, optionally followed by `f` or `ff`, or a lower-case Roman
  numeral. A range joins two with a hyphen or en dash. Further pages after a
  comma belong to the same locator, until a year form. The locator leaves out
  the colon, `p.`, or `pp.`.
- A range of years is a year joined by a dash or slash to another number or to
  `present`, where a page is not expected.

Other text in a part, such as another lead-in or a form the table does not
define, makes the part unrecognized. No citation form takes a range of years as
its year, so a part that has one in that place is never linked.

**Matching.** A citation is compared with the entries of its own chapter's
list. Family names compare after folding case, diacritics, and apostrophe and
hyphen forms. A whole name also matches when it equals all the cited names with
their joining words, as in `Office of Land and Water 2004`. It matches an entry
only when:

- without `et al.`, the entry has exactly the named authors, in order;
- with `et al.`, the entry's first authors are the named ones, in order, and it
  has more authors than are named; and
- the year and suffix are equal, a missing suffix matching only a missing one.

Authors cut short in a list match only an `et al.` citation, and only when
every cited name is among those the entry shows.

Exactly one matching read entry links the citation, unless another entry could
be the one meant:

- an unread entry whose text holds the first named family name and the year, as
  whole words, whatever suffix either has;
- an unread entry with a repeated-author mark, read with the text of the nearest
  earlier entry that has none;
- an unread `continuation` paragraph; one that holds a year or an author's
  initials, outside a web address, is read together with the paragraph before
  it; or
- another entry with the same year and suffix whose whole name has the first
  cited name as one of its words.

In every other case the citation is unresolved: no entry (`no_entry`), several
(`several_entries`), an entry that could fit (`unread_entry`), or no list
(`no_list`), the first of `no_list`, `several_entries`, `unread_entry`, and
`no_entry` that applies. Matching
entries in other lists or in a library are listed as candidates and never
linked. Model judgment never links.

A linked citation takes the source its entry is bound to under F11. A narrative
form is a citation form when its names match an entry as above. It is also one,
and unresolved, when it uses `et al.` or when a name in it, or the last word of
one, is a family name in some list of the project. Other words before the
brackets leave them unlinked. The names are all the names, with their joining
words and commas, that stand directly before the brackets, with only spaces
between. A possessive ending on the last of them, `'s`, or an apostrophe after
a final `s`, is not part of the name, also after `et al.` A comma joins names
only in a series that ends in `and` or `&`.
Capitalized sentence words that begin the first name are dropped. No other word
or name is dropped to find a match, so `Brel and Corso (2001)` never matches an
entry for Corso alone.

**Account.** Each examined pair of brackets ends in exactly one state:

| State | When | Output |
|---|---|---|
| Linked | Every part is a citation form and every item links | One `citation` record per item |
| Unresolved | Every part is a citation form and any item does not link | One `citation` record per item. An unresolved item has key `?` and an `ambiguous_reference` item with its reason and candidates |
| Left unlinked | Any part is not a citation form | A `year_parenthesis` item with its position, text, and one reason code |

Reason codes for left unlinked, the first that applies: `in_table` (until the
markup carries citations in tables), `year_range` (a range of dates, with no
part holding names, that is, a capitalized word, such as `(1516–1850)` or
`(c. 1600–1850)`),
`no_author_form` (every part is year forms and locators only, with no readable
narrative names), `mixed_parts` (some parts are
citation forms and some are not; the item lists how each part was read), and
`unrecognized_form`. A `no_author_form` item that follows a capitalized word is
marked as a possible narrative citation and listed first.

The report gives the count in each state, by reason, and the three counts MUST
add up to the number examined. An unresolved citation fails `cite.key` and so is
open. A left-unlinked item is not a finding and does not affect the label; the
report says so.

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
| Original file not supplied | Byte replay unavailable; regeneration still meets C | yes | Supply the original |

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
| Author-date profile (H) | `packages/intake` reads lists and links citations by these rules over a neutral document; its tests use invented text from the same agent that wrote the rules and code, including a seeded set with no wrong link. Earlier, a throwaway script on one private set of drafts, matching only the first family name and first year against each file's list, found exactly one entry for most parts it could read as author and year. Later, a developer script ran these rules, before working markers were added, on one private set of older drafts: most bracketed years linked, and hand checks of a sample of links found none wrong | Whether every link there is correct, or any link against the cited work; how the rules do on other manuscripts; the working-marker rule on real text; Word reading and list detection beyond that one set |

## Schema Basis

Native formats stay native and are not relabelled as UMF. Preserved data and
import batches use CONTRACT-001. Loss and intake reports are command envelopes.
UMF's interchange contracts were the pattern for retaining source, locating
loss, and choosing a loss policy; their adapters cover schema documents, not
bibliography records.
