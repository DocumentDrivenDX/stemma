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

# Contract: Legacy import, export, and manuscript intake

**Contract ID**: CONTRACT-003
**Type**: schema and CLI
**Version**: 0 (provisional; see Proof Status)
**Related**: ADR-002, FR-13, FR-71 to FR-73, FR-92, FR-93, FR-95

## Purpose

Defines how CSL-JSON (Citation Style Language item data), BibLaTeX (a LaTeX
bibliography format), RIS (a tagged reference format), Word files, and PDF
manuscripts enter a project, how libraries leave it, and what "keeps all of its information" means.

## Scope and Boundaries

- In scope: codec behaviour, equivalence, loss reports, Word and PDF manuscript
  intake outputs, and limits on untrusted input.
- Out of scope: BibTeX, EndNote library files, Zotero database or API access,
  LaTeX manuscripts, recognition of scanned pages, and Word, LaTeX, or HTML
  export (deferred past v1).
- Owning module: `packages/intake`.

## Normative Surface

### A. Directions and support level

| Input | Import | Export | Same-format guarantee |
|---|---|---|---|
| CSL-JSON | yes | yes | yes |
| BibLaTeX | yes | yes | yes |
| RIS | yes | yes | yes, for files the codec accepts without error |
| Word `.docx` | yes | no | not applicable; the original is never modified |
| PDF manuscript with a text layer (I) | yes | no | not applicable; the original is never modified |

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
7. A failed import names the line of each fault the codec can locate, and the
   entry's key when it has one. After a fault the codec SHOULD resume at the
   next entry it can find, so that several faults are named at once, and MUST
   say how many entries it accounted for, read and unread. Text is read as
   UTF-8, with or without a byte-order mark; other bytes are an error naming
   the line.

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
  - A value is preserved with `encoding` `tex`: `#` parts are joined and each
    `@string` macro defined earlier in the file is replaced by its value.
  - A value that uses a macro with no such definition, the month macros
    included, has no known value. It is preserved with `encoding` `raw` as an
    expression: each unknown name as written, each other part in braces, joined
    by ` # `. It is not mapped to a record field, except a month read as part
    of a date. The report lists the unknown names other than months.
  - Text between entries is a comment. Outside entries, `%` starts a comment
    that runs to the end of its line, so a commented-out entry stays a comment.
    A `%` comment between the fields of an entry is kept as a file-level
    comment. (Assumption: no BibTeX or Biber reader was run to confirm either
    `%` rule.) A line that starts with `@` and a word, with no opening
    delimiter after it, is an error.
  - A repeated field in one entry is kept, in order, and reported. An entry
    with no key is an error.
- **RIS**: tags and their order of repetition per record, and values exactly,
  after joining continuation lines by the producer's rule. The report names the
  detected variant. A line the codec cannot attribute to a tag is kept as a
  block and fails the import if it cannot be placed.
  - A tag line is two characters (a capital, then a capital or digit), two
    spaces, a hyphen, and a space or the end of the line. A record starts at
    `TY` and ends at `ER`.
  - Until a producer's rule is established from its real files, one rule
    applies: inside a record, a line that is not a tag line continues the value
    above it, joined by a line feed. Empty lines just before a tag line are
    dropped; other characters are kept. Line endings are read as line feeds.
  - Text outside records is kept as `header` blocks before the first record
    and `other` blocks after it. Outside a record, a line that starts like a
    tag, whatever its spacing, is an error, as are a `TY` inside an open record
    and a file that ends inside one. Inside a record, a line that starts like a
    tag with other spacing is a continuation, and is reported.
- **CSL-JSON**, as preserved: each member of an item is one `LegacyField` with
  `encoding` `json`, holding the value's own source text. The file is an array
  of objects; anything else is an error.

Equivalence MUST be tested by an equivalence comparator that is independent of
the exporter, and, where a native reader exists, by that reader as well.

### D. Export after edits

`mapped_to` is one of `title`, `issued`, `contributions/<role>`,
`dates/<variable>`, `bib/<name>`, or `identifiers/<scheme>`. The mapped value
that `mapped_sha256` covers is, in that order: the title; the issue date; the
array of that role's `as_printed` names, in order; the date; the `bib` value; or
the array of that scheme's identifier values. Several preserved fields, such as
a repeated author tag, or a year and a month, MAY map to one path and then share
its digest. The record's `type` has no `mapped_to`: it is mapped from the
native entry type.

An exporter that cannot yet produce a native value for an edited record MUST NOT
emit the stale one: it writes no output and names the records and paths.

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
    as an intake item without applying it (assumption). How a file is told to
    be the same, changed, or another one is **Which file this is** in I, for
    Word and PDF files alike.
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

**The Word reader** (items 1, 3, and 4; SD-015 BR-1502 and BR-1503). It takes
the file's bytes and returns paragraphs in document order, comments, fields,
tracked changes, reported items, and a disposition for every archive part. It
writes nothing and fetches nothing. These rules are design assumptions until
tests on files saved by real tools pass.

- **Parts.** The main document is the one the package relationships name, and
  its footnotes, endnotes, comments, and styles are those its own
  relationships name. A file with no relationship part is read by Word's usual
  names. Each part is exactly one of: **read** (the main document, notes, and
  comments); **reported** (any other XML or text part, such as headers,
  footers, document properties, custom data, charts, diagrams, a glossary, or
  an imported chunk, whose text is reported and not converted); **not read**
  (any other part, such as an image or embedded object, reported by name); or
  **support** (package, relationship, style, numbering, setting, font, theme,
  and comment-threading parts, which are taken to hold no document text and are
  not examined for any).
- **Revision view.** Insertions and move destinations are applied. Deletions,
  move sources, and deleted table rows and cells are removed. A paragraph whose
  paragraph mark is deleted or moved away joins the next paragraph of the same
  container, which gives the joined paragraph its style. Current formatting is
  used. Each tracked change is reported with its position and any stated author
  and date. Removed text appears nowhere in the reading.
- **Paragraphs.** A paragraph with only white space is left out, unless it
  refers to a note. A tab becomes
  a space, a page break a space, any other break a line break, and a
  non-breaking hyphen `-`; an optional hyphen is left out. A note reference
  adds no text; its place is kept with the paragraph, and the note's paragraphs
  follow it. Footnotes and endnotes are each numbered from 1 in the order of
  their first reference; these labels are Stemma's, not Word's printed marks.
  A heading level comes from the paragraph's own outline level or else its
  style or the styles it is based on (a built-in heading or title name, or an
  outline level). A body paragraph whose style is named Caption is a caption;
  a paragraph in a table is `table`, with its table, row, and cell. Other
  headings and captions are read as body text. Hidden text set on the text
  itself is read and reported; hiding set only by a style is not detected.
- **Comments.** Every comment in the comments part is returned with its text,
  any stated author and date, and the place its range or mark gives, with the
  text in that range when it is in one paragraph. A comment with no place, or a
  place with no comment, is said to be so.
- **Fields.** A field's visible result is read as typed text. Its instruction
  is never paragraph text. Each field is returned with its instruction, any
  stored field data, and the place of its result. Zotero, Mendeley, EndNote,
  Citavi, and Word's own citation and bibliography fields, citation content
  controls, and Zotero citation bookmarks are named by kind. **No embedded
  reference data is decoded yet** (item 2), and every such field says so.
- **Reported content.** Text boxes, equations, symbol characters, text that
  Word generates (list numbers, page numbers, dates), image descriptions and
  other text held in attributes (WordArt text, link tooltips), embedded
  objects, imported chunks, headers and footers, content-control placeholders,
  notes that no read text refers to, and every element the reader does not know
  are each reported with their part, a raw location, any text they hold, and,
  where they sit in a read paragraph, their offset. Their text is not
  converted. Where a file offers alternative forms of one element, the reader
  takes the first form whose requirements it knows, otherwise the fallback, and
  reports any other form whose text differs.
- **Account.** Every non-white-space text value in every XML part the reader
  examines ends in exactly one of: converted (paragraph or comment text),
  removed by the revision view, reported (with an item, field, or comment),
  layout (a number or keyword that places a drawing), or duplicate (a repeat,
  in another offered form, of text already taken). The reading gives the
  counts, and a value left over is an error that stops the reading. Attributes
  are outside this count; only those named above are reported.
- **Damage.** `docx_unreadable` is given for a file that is not a ZIP archive
  (an encrypted or old binary Word file included), an encrypted, ZIP64,
  damaged, or unsupported archive entry, a stated size that is false, an entry
  name that is absolute, holds `..`, or occurs twice ignoring case, a missing
  main document or relationship target that is needed, two notes or two
  comments with one ID, XML that is not
  well-formed or not UTF-8 or UTF-16, a document type declaration, or a field
  that does not open and close in order. Entity references other than XML's
  five and character references are not well-formed here.

### G. Untrusted input limits

All codecs MUST treat input as hostile: refuse archive entries with absolute or
parent paths; cap uncompressed size, entry count, nesting depth, and field
length; disable XML DTD and external entity processing; never fetch a URL found
in a file; and never interpret file text as instructions. A codec that expands
shortcuts MUST also cap the total expanded text. Limits are published by
`doctor`. Cap values are set by the takeover solution design; SD-003 sets any
further cap that only a library codec needs. A cap is checked before the work
it bounds is done where the size is stated in advance, and again while it is
done, so a false statement cannot pass it.

### H. Author-date profile

The profile is `author-date/2`. It is deterministic. Its rules are design
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

   An entry that holds text in square brackets with at least one letter, other
   than a note that begins `accessed`, `last accessed`, or `retrieved`, is
   flagged `bracketed_note`. The flag changes no reading and no link. A link to
   such an entry identifies it and verifies nothing, whatever the note says.

   A read entry is flagged `long_surname_form` where some later author keeps two
   or more longer forms of a family name (item 3), so that three or more
   written-out words could be one name. Two authors with no separator between
   them can look like this. The flag changes no reading and no link, and asks
   for a look at the entry: many flagged names are right, and two authors run
   together with fewer words are not flagged.
3. The profile reads authors' family names in order, the year, and any
   one-letter year suffix, in two layouts: the year directly after the authors,
   and the year near the end of the entry. An entry whose authors or year cannot
   be read is **unread**. When in doubt it is unread, because an entry read with
   too few authors could take another work's citations.
   - **Authors.** A person is `Family, Given`. A later author may also be
     `Given Family`, `I. Family`, or `I. Given Family` (initials, then one given
     name). Authors are joined by commas, `and`, or `&`.
     Editor marks such as `(ed.)` and `eds` are not names. `et al.` or `and
     others` marks the authors as cut short. A name with no comma and no
     initials is a corporate author, or a single name, and is one **whole
     name**. A later `Given Family` with no initials, or `I. Given Family`,
     joined only by commas, is a person only where `and` or `&` comes at or
     after it, or, in the year-after-authors layout, where `et al.` or `and
     others` ends the authors.
   - **Where a later family name begins.** In a later author in natural order,
     the family name is read as the last word with any lower-case particles
     before it. Each written-out word standing directly before that, a
     capitalized particle included, may belong to the family name too, as long
     as a given name or initial is left before it. The entry then keeps each
     longer form as another form of that author's family name: `Given Other
     Family` keeps `Family` and `Other Family`, and so does `I. Other Family`.
     The reading does not say which form is right. `I. Given Family` is not
     read where the one written-out word is a joining word or `the`, `of`,
     `for`, or `on`, or where `y` joins the last word to the one before.
     Initials both before and after a given name, as in `I. Given I. Family`,
     are not read, because two authors with no separator look the same.
   - **Abbreviations.** An abbreviation in capitals followed by its full name in
     round brackets is one whole name, and a citation of either matches it. Only
     there, the full name may also hold `in`, `at`, or `to` between its words.
     A full name with commas is not read.
   - **Refusals.** Initials with no comma, and text after `and`, `&`, or `with` that
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
  inside, as in `(Adair 2017, 12 [CHECK])`. One comma may come before that
  space, as in `(Adair 2017, [CHECK])`; it is kept with the marker. Markers do not stop a part from
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

Where an author has more than one form of family name, a cited name matches
that author if it equals any of them. This adds no match to the count: two
entries that match are still `several_entries`. Its risk is a citation of a
different work, missing from the list, by an author whose name is one of the
forms and whose co-authors and year are the same.

**Given names in text.** A narrative citation of one name, with or without
`et al.`, may write the first author's given name, as in `Given Family (2001)`.
It matches an entry this way only when all the cited words, folded as above, are
that entry's first given names followed by its first family name, as typed in
the entry:

- the given names hold at least one written-out word, and are cited whole or
  without the initials that end them (`Given I.` may be cited as `Given`);
- no other word or initial is left out, added, or expanded, so an initial in an
  entry never stands for a written-out name, and given names that end in a
  particle are not used; and
- the rest of the form matches as above.

Such a citation links only when that entry is also the one entry that could be
meant by the family name alone: any other entry that matches the family name in
the same form, year, and suffix makes it `several_entries`, and any entry that
could fit the family name blocks it as below. Bracketed names do not match this
way.

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
form is a citation form when its names match an entry as above, by family or by
given names. It is also one,
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
report says so. The report also lists, apart from the counts, the linked
citations that carry a working marker, and the entries flagged `bracketed_note`
or `long_surname_form` with the number of citation items linked to each.

### I. PDF manuscript intake

The layout profile is `pdf-layout/1`. Its rules and numbers are design
assumptions that no test has yet exercised. A change to a rule makes a new
version. It covers born-digital, single-column drafts, as exported by a word
processor or LaTeX. Other layouts are read by the same rules, and more of them
is reported.

A PDF places characters on a page. It does not state paragraphs, notes, or
tables, so the reader sets structure only by a rule here, and reports what it
cannot establish. No model reads the pages, sets structure, or links a citation.

**What `takeover` produces.** For a PDF it MUST do what F requires of a Word
file, in items 5 to 12 and the one-file-per-run, earlier-records, and unchanged
original rules of item 1: the same records, intake items, Stemma copy, intake
report, rounds, and author-date account, from the same neutral document. Where
this section differs, it governs. F items 2 to 4 do not apply.

**The reader** takes the file's bytes and returns the neutral document; for each
paragraph the page, the rectangle, and the text offsets of each line it was made
from; each page's state; comments; reported items; removed lines; the account;
the support level (`untested` for every producer until A is met); the producer
and creator the file states; and the coverage statements below. It writes
nothing, fetches nothing, and runs nothing found in the file. Text is read from
the text layer with the pinned PDF library (SD-002), with characters kept as the
file maps them, ligature characters (U+FB00 to U+FB06) included. No fold is
added for them: the name comparison of H and `quote-fold/0` already read them as
their letters.

**Pages.** Each page has exactly one state:

| State | When | Converted |
|---|---|---|
| `converted` | It has text and none is drawn invisibly | yes |
| `blank` | It has no text and paints no image or shape | nothing to convert |
| `no_text` | It has no text and paints something, as a scan or a full-page figure does | no |
| `invisible_text` | Any of its text is drawn in a rendering mode that neither fills nor strokes it, as a recognition layer over a scan is | no |

`no_text` and `invisible_text` pages are **unread**. Each is an `unread_content`
item with its page number, its state, and, for invisible text, the number of
characters not converted. Stemma recognizes no text. If no page is `converted`,
the command fails with `pdf_no_text` and writes nothing. If any page is unread,
the report's first line says the import is partial and names the pages. A
recognition layer drawn as visible text, under a page image, cannot be told from
typed text.

**Removed lines.** Before structure is read, only these are taken out. Each
removal is listed with its page, rule, and text:

| Rule | Removes |
|---|---|
| `download_stamp` | What CONTRACT-007 I removes. Its words are not recorded |
| `repeated-line` | A running head or foot by the CONTRACT-007 I rule |
| `page-number` | A line among the first two or last two of a page that is only an arabic or Roman number, where on at least three pages such numbers differ from the page's index by the same amount |
| `list-heading-repeat` | A line among the first two of a page that is only `References` or `Bibliography`, on a page that continues a list |

**Reading order.** Text is taken in the file's order.

- A page that meets the CONTRACT-007 I test for two columns is read left column,
  then right.
- A page is **order-uncertain** when two pieces of text share a line's height
  with a gap between them of more than 4% of the page's width, as columns,
  tables, text boxes, and printed comment balloons do, or when a line in the
  file's order stands higher than the line before it, other than at a change of
  column. Its text is kept in the file's order and the page is reported.

**Footnotes.** A note is a footnote only by the CONTRACT-007 I pairing of a
small raised marker with a smaller line at the foot of the same page. Its
paragraphs have location `footnote`, follow the paragraph that refers to them,
and are labelled `p<page>-<marker>`, counting pages from 1. The paired marker
leaves the body text, and its place is kept as a note reference.

- Smaller text at the foot of a page that no marker pairs, including the rest of
  a footnote carried over from the page before, becomes its own body paragraph,
  with a seam at each end, and is reported `unpaired_foot_text`.
- A raised marker that nothing pairs stays in the text as typed, with a seam on
  each side, and is reported `unpaired_marker`.
- **Endnotes are not recognized.** Their text is read as the body text it
  appears as, so no paragraph has location `endnote`. Their markers are not
  tied to it: each marker the pairing rule sees is an `unpaired_marker`, and
  its seams withhold any link that would cross it, including a narrative
  citation whose names it follows or precedes closely. Nothing typed in an
  endnote is read as a note: F6 does not bind its full references, short forms,
  or "ibid.", it is not listed as unclassified, and the report's counts of
  notes cover footnotes only. A bracketed year in that text is examined as in
  any body text. A manuscript that cites in endnotes therefore gets no
  note-style citations from its PDF.

**Paragraphs and headings.** Lines in reading order form one paragraph until
one of these: the next line is indented from the left margin and the line before
was not; the gap to it is more than 1.4 times the usual line spacing; it is, or
follows, a heading, a line that is only `References` or `Bibliography`, or
unpaired foot text. A change of page or column alone ends no paragraph. A
paragraph is never ended while a round bracket opened in it is unclosed, unless
a heading or unpaired foot text comes next. Lines are joined with one space. A
line that ends in a hyphen is joined to a following letter or digit with no
space, and the hyphen is kept: the reader does not choose whether it belongs to
the word. A heading is found only by the CONTRACT-007 I size rule; the sizes
found give levels 1 to 4, largest first, and smaller sizes take level 4.
`table` and `caption` are never assigned. Takeover writes one chapter for each
PDF file and states that basis.

**Seams and hyphens.** The reader marks in a paragraph where it cannot vouch
for its text. A **seam** is an offset where what stands on the two sides may not
belong together. Offset 0 or the paragraph's length means that its start or end
may be false. A **hyphen mark** is the offset after a hyphen kept at a join. A
seam goes:

- at each join across a page or column, including a join across unread pages;
- at each line join on an order-uncertain page;
- at offset 0 of a body or footnote paragraph when the paragraph before it in
  the body, or in the same note, is not a heading and does not end with `.`,
  `?`, `!`, or `:`, with any closing quotation mark or bracket after it; and
- where **Footnotes** says.

In a list with separable entries (below), the layout shows where entries begin,
so seams come only from joins inside an entry and from order-uncertain pages.

**List entries.** A list starts and ends as H rule 1 says. Its entries are
**separable** only when, from its start to that end, apart from removed lines,
paired footnotes, and subheadings:

- every line is set in one size and stands at one of two left positions, the
  entry position and one deeper continuation position, within 2 points. The two
  may shift together from page to page;
- at least one line stands at the continuation position; and
- no three lines in a row stand at the entry position and each reach within
  three times the text size of the farthest right end of any body line, as the
  lines of running prose do.

An entry is then one line at the entry position and the continuation lines after
it. This is the hanging indent. A list set any other way, for example with only
a space between entries, is not separable. Other text that follows a list with
no heading the reader finds usually breaks one of these rules, which makes the
list not separable; text that breaks none is read as entries, and each one the
list reader cannot read is listed. A list that is not separable has no
entries and ends at its start paragraph. Its lines are read as ordinary text,
the list is marked incomplete, and the report names the first line that broke
the rule, says that no entry was carried forward for the bibliography (F11),
and says that exporting each chapter as its own file, or taking over its Word
file, can help.

**Quotations in the copy.** The copy keeps line-end hyphens, and the line-end
join of `quote-fold/0` (CONTRACT-002 D) applies only to source text. A quotation
read from a PDF could then fail only because the draft's line broke inside a
word. So the batch keeps, for its chapter, each word in which a hyphen was kept
at a join: the text between the white space on either side, without surrounding
punctuation, folded as `quote-fold/0` folds. The record schema gains that field
with the `format` value (CONTRACT-001). In `quote.present` and `quote.page` over
that chapter, a hyphen in a quotation is **uncertain** when the word holding it
is one of those kept. The check compares the quotation as printed and with each
combination of its uncertain hyphens removed. If every reading gives the same
outcome, that outcome stands, with the evidence of the printed reading.
Otherwise the outcome is `unverifiable`, reason `uncertain_hyphen`, and the
evidence shows each reading, what it matched, and where. The author compares the
words with the original page and removes a hyphen from the copy if it is not
part of the word; the quotation is then checked as it stands. If the hyphen does
belong, the result stays open until a person dismisses it (CONTRACT-001,
Annotations). So no quotation passes or fails on a reading Stemma chose. The
same word typed within a line elsewhere in the chapter is treated the same way.
`quote-fold/0` itself is unchanged, and a chapter from Word has no such words.
Whether such a quotation should instead pass and say which reading matched, as
the source-side join does, is a PRD open question.

**What the matcher does with the marks.** H applies unchanged to a document that
has no seams, hyphen marks, unread pages, or unseparated lists, which is every
Word document. For a document that has them, these rules also apply. Each only
removes or withholds a link; none adds one.

- **Entries.** An entry with a seam anywhere in it, either end included, is
  unread (`uncertain_boundary`). The text searched to decide whether it could be
  the one cited joins it with the entry before and the entry after.
- **Hyphens in entries.** An entry with a hyphen mark is read twice, with those
  hyphens kept and removed. It is read only when both give the same authors,
  family-name forms, year, suffix, and layout; otherwise it is unread
  (`uncertain_hyphen`), and both texts are searched. A hyphen in a title changes
  none of these.
- **Citations.** A pair of brackets that H would link or leave unresolved is
  instead left unlinked, reason `uncertain_layout`, when a seam lies inside it,
  or, for a narrative form, anywhere from the end of the word before the names
  (or the paragraph's start) to the opening bracket. The same applies when a
  hyphen mark in the brackets or the narrative names would, with the hyphen
  removed, give a different state, entry, year, suffix, or locator. A pair that
  H already leaves unlinked keeps H's reason.
- **Incomplete lists.** A list is incomplete when its entries are not separable,
  or when an unread page lies between the first paragraph it serves and the
  page after its last line, that page included: an entry or another list's
  heading may be on it. A citation that an incomplete list serves is never
  linked. It is unresolved, reason `list_incomplete`, which ranks directly after
  `no_list`, with its candidates listed.

`uncertain_layout` and `list_incomplete` join H's counts, so the three states
still add up to the number examined. The report names both profiles.

**Reported content.** Each has its page and, where there is one, its rectangle.

- **Comments.** Every annotation that holds text or marks up text is a comment,
  with any stated author and date and its text, saved as an `unread_content`
  item (FR-71). Which words it marks is not established.
- Form-field values are reported, not converted. Link annotations are counted
  and their addresses listed; none is fetched, and no link is used to match a
  citation. Attachments are listed by name and not opened. Optional content
  (layers) is reported as present. Images are counted by page.
- Characters the file maps to no readable character (the replacement character
  or a private-use code) are counted by page, and their paragraphs listed.
- A round bracket with no partner, in a paragraph that holds a year form, is
  reported `unpaired_bracket`. A citation that a paragraph break divided is
  therefore listed even though H does not examine it.

**What a PDF cannot show.** Every report MUST state all of these, whatever the
file holds:

- Whether it was made showing tracked changes. If it was, deleted text is read
  as current text and can produce citations; export with changes accepted, or
  take over the Word file. F4's rule for deleted text cannot be met.
- Comments printed onto the page are read as page text.
- Endnotes are not recognized. Their text is read as body text, their markers
  are unpaired, and no citation in them is handled as a note.
- Hidden, white, struck-through, covered, and switched-off-layer text is read
  like other text. Text placed wholly off the page may not be returned at all.
- Tables, captions, block quotations, emphasis, and each passage's language and
  direction are not recognized. Table text becomes ordinary text, so
  citations in tables are not listed as `in_table`. Block quotations are not
  attributed, and quotation checks do not cover them.
- A PDF holds no reference-manager fields, so no embedded reference is recovered.
- Text in images or drawn as shapes is not read.
- Recognized text drawn visibly cannot be told from typed text.
- Spaces and character order are as the PDF library rebuilds them from the
  page. Right-to-left text is untested.

**Account.** Every non-white-space character the library returns on a converted
page ends in exactly one of: paragraph text, a paired note marker, or a listed
removal (stamps by count only).
Form-field values and comment texts are reported apart. A difference stops the
reading as an internal error. Unread pages are outside this count and are named.

**Which file this is** (Word and PDF alike). Before writing, `takeover`
compares the new file with the manuscript files already taken over. The first of
these that applies decides:

1. **The same file.** Its bytes are those of an earlier takeover's original. B6
   and F10 apply: without `--again` it is reported and nothing is written; with
   `--again` takeover reruns, keeping every author choice and edit.
2. **A changed original** (assumption). Its bytes differ, and its base name is
   the `original_name` of an earlier takeover's batch. F10 applies: takeover
   saves one `intake_item` of category `original_changed`, which names that
   batch and states the new file's SHA-256 and size, and writes nothing else.
   No chapter or other record is added, the Stemma copy is unchanged, and the
   change is not applied, with or without `--again`. The report says so, and
   that `--separate` adds the file as a different text. Where an item that is
   not retired already states those bytes, nothing is written and that item is
   reported. If earlier files with different bytes share the name, the item
   names the one whose chapters hold the most of the new file's runs (3), and
   of equals the latest.
3. **Repeated text.** One file for each chapter: takeover takes every run of 12
   consecutive words in the new file's body text outside reference lists, folded
   as in H, with bracketed text and line-end hyphens removed. When 20% or more
   of the runs occur in the chapters that came from one earlier file, it writes
   nothing, fails with `repeated_chapter`, and names that file and the share.
   The message also says that if the new file is a revision of that one under
   another name, Stemma does not apply revisions, and that `--separate` would
   add it as a second chapter. A file with fewer than 12 such words is not
   compared. The threshold is an assumption.

`--separate` is the author's statement that the file is a different text from
those already taken over. It skips 2 and 3, never 1, and the batch records the
statement. A revision saved under another name is not recognized as a changed
original: no `original_changed` item is saved for it (PRD open question).
Applying a revision, and replacing a chapter taken over from one file with
another file, are not defined.

**Limits and damage.** `pdf_unreadable` is given for a file that is not a PDF,
is encrypted, is damaged, or has a page that cannot be read; `input_limit` for a
file over 200 MiB, 2,000 pages, 20 MiB of extracted text, 2,000,000 pieces of
text, 10,000 annotations, or 300 seconds. Both write nothing. Document scripts,
actions, forms, links, attachments, and external references are never run,
opened, or fetched. The reading runs in a separate process that is stopped at
the time limit. **G is not wholly met for PDF:** the library expands compressed
page data itself, and no cap on expanded size or memory is designed.

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
| Corrupt or encrypted PDF | `pdf_unreadable`; nothing written | no | Export an unencrypted copy |
| PDF with no page that can be converted | `pdf_no_text`; nothing written | no | Supply the Word file or a born-digital PDF; recognition is not offered |
| Changed original under an earlier file's name | One `original_changed` item; nothing else written; the change is not applied | yes | Keep working in the Stemma copy, or pass `--separate` for a different text that has the same name |
| File repeats text already taken over | `repeated_chapter`; nothing written | yes | Take one file per chapter, or pass `--separate` for a different text |
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
| Word intake | The Word reader of F (`packages/intake`) reads hand-built files holding invented text, written by the same agent that wrote the reader and these rules: its tests cover the revision view, notes, comments, fields, reported content, the account, damaged and hostile files, and the limits. An earlier package-free reader recovered all footnotes and embedded Zotero and EndNote references from other hand-built files; a short-form rule resolved 9 of 10 with none wrong and missed German "a.a.O." and author-date citations | Any file saved by Word, Zotero, Mendeley, EndNote, or another tool: Word support is untested. Decoding of embedded reference data (not built in the reader); field and content-control forms, which come from research reading; Mendeley fields at all. Run time and memory near the limits. Nothing uses the reader yet |
| PDF manuscript intake (I) | A probe of the pinned PDF library on one invented file showed that invisible, white, struck-through, and switched-off-layer text arrives unmarked; off-page text did not arrive; rendering modes, comment and form annotations, and attachment names are available apart from the text. The source converter's rules that I reuses have their own synthetic tests | Every rule, number, and guard of I: no reader is built, and neither the file comparison nor the quotation rule exists. A run of the matcher on invented text, not on a PDF, linked a name holding U+FB03 whether the ligature was in the entry or in the citation. Any PDF from a real producer: PDF manuscript support is untested |
| Author-date profile (H) | `packages/intake` reads lists and links citations by these rules over a neutral document; its tests use invented text from the same agent that wrote the rules and code, including a seeded set with no wrong link. Earlier, a throwaway script on one private set of drafts, matching only the first family name and first year against each file's list, found exactly one entry for most parts it could read as author and year. Later, a developer script ran these rules on one private set of older drafts, adding forms between runs, including working markers with and without a comma before them: most bracketed years linked, and hand checks of samples of the links found none wrong. Some marker texts say the linked work is a stand-in or in doubt, or the linked entry is itself a placeholder. Those runs used the rules of `author-date/0`. A run of `author-date/1` on the same drafts found no wrong link among those it added, but leaving later authors of unknown surname length unread lost correct links, mostly for ordinary names; `author-date/2`, which keeps each form instead, restored those links on the same drafts, and a check of the changed links found none wrong; most longer forms it kept were a middle name before the surname, and two authors with a separator missing between them can read as one, which that run did not find in the entries holding longer forms | Whether every link there is correct, or any link against the cited work; how the rules do on other manuscripts; Word reading and list detection beyond that one set |

## Schema Basis

Native formats stay native and are not relabelled as UMF. Preserved data and
import batches use CONTRACT-001. Loss and intake reports are command envelopes.
UMF's interchange contracts were the pattern for retaining source, locating
loss, and choosing a loss policy; their adapters cover schema documents, not
bibliography records.
