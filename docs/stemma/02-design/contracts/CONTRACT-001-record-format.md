---
ddx:
  id: CONTRACT-001
  type: contract
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-002
    - stemma.adr-003
    - stemma.adr-010
    - stemma.architecture
  schemas:
    - id: stemma.record
      version: "0"
      title: Stemma records
      path: docs/stemma/02-design/contracts/schemas/stemma-record.umf.json
      schemaFormat: umf
---

# Contract: Stemma record format

**Contract ID**: CONTRACT-001
**Type**: schema
**Version**: 0 (provisional; see Proof Status)
**Related**: ADR-002, ADR-003, ADR-010, CONTRACT-007, FR-6 to FR-14, FR-20 to FR-23, FR-32, FR-54, FR-62, FR-67, FR-68, FR-72, FR-73, FR-88 to FR-90, FR-98

## Purpose

Defines the files that make up a project's evidence graph: record layout,
identifiers, canonical form, digests, links, preserved legacy values, and
restricted coordinates. Source files, whose manifests are records, are defined
in CONTRACT-007. Any tool that reads or writes a Stemma project
implements this contract.

## Scope and Boundaries

- In scope: record files, project settings, the standing-rules file, the
  restricted store, and the rules the schema cannot express.
- Out of scope: check outcomes (CONTRACT-002), legacy formats (CONTRACT-003),
  graph export (CONTRACT-005), and manuscript markup (CONTRACT-006). The shapes
  for plans, composition, voice, governance, audit, and images (G) are minimal
  and provisional; the design of each feature may extend them.
- Owning module: `packages/records` (see the Architecture).

## Normative Surface

### A. Schema authority

`schemas/stemma-record.umf.json` is the authority for record kinds, fields,
field types, cardinality, enumerated values, nested value types, and the allowed
target kinds of each reference. It is a UMF (Unified Modeling Fabric, the
DocumentDrivenDX schema format) core `0.10.0` document using the `umf.ddd`
`0.1.0` domain-modelling extension.

- A record kind is an `entity` element; a nested object is a `value` element.
- Each reference field, nested ones included, has a core relationship named
  `<kind>.<field path>` that lists every allowed target kind.
- This contract adds the rules below. The schema cannot express them.
- A conforming writer MUST enforce the schema and these rules. UMF validation
  alone MUST NOT be treated as enough.

### B. Project layout

| Path | Content | In git |
|---|---|---|
| `stemma.json` | One `Project` object, schema `stemma.project/0` | yes |
| `rules.md` | Standing rules (J) | yes |
| `records/<kind directory>/<id>.json` | One record per file | yes |
| `manuscript/` | Stemma's own copy of the manuscript, one marked-up Markdown file per chapter (CONTRACT-006) | yes |
| `sources/<name>/` | Source files: a manifest record and its page or section files (CONTRACT-007) | yes |
| `research/` | Research notes: Markdown that is not a record (L) | yes |
| `.gitattributes` | `eol=lf` for the five paths above, and for `research/**/*.md` | yes |
| `.stemma/` | Derived index, reports, and the originals cache `originals/<sha256>` | no |
| `build/` | Build outputs and graph exports (CONTRACT-005) | no, except as CONTRACT-005 allows |

Binaries and paper originals are not part of a project. Text captured from them
is in source files, tied to each original by hash and size or by description
(CONTRACT-007 C). This covers every binary file, the author's own drafts and
material brought in from elsewhere included: it stays where the author holds it,
and what is read or cited is converted to source files. `init` adds ignore
entries, in any letter case, for the document, ebook, slide, spreadsheet, and
archive formats `pdf`, `doc`, `docx`, `odt`, `rtf`, `pages`, `epub`, `mobi`,
`ppt`, `pptx`, `key`, `xls`, `xlsx`, `numbers`, and `zip`. `project.binary`
(CONTRACT-002 C) reports a binary file that git tracks or would add. How figures
for a typeset book are held is not decided yet (FEAT-008).

Takeover and later fixes write only to `manuscript/` and records. Original
files are never changed.

Path fields that Stemma defines MUST be project-relative with `/` separators. A
record MUST NOT contain an absolute local path. Titles and names MUST NOT form
file names; a source directory's name is taken from the citation key only when
that is a safe name (CONTRACT-007 A).

A preserved legacy value, such as a BibLaTeX `file` field, can hold a local
path. It is kept exactly as imported, and the import reports each such value so
that the author can decide whether to keep it.

### C. Record kinds and identifiers

A record ID is `<prefix><token>`, where the token matches `[0-9a-z]{8,40}`.
Tools SHOULD generate 20 random lowercase Crockford base32 characters. An ID is
assigned once, is never reused, and carries no meaning. The file name is
`<id>.json`.

| Kind | Prefix | Directory | Holds |
|---|---|---|---|
| `source` | `src-` | `sources` | The one official bibliography record per source: fields, rights, intake, admission |
| `agent` | `agt-` | `agents` | Person or organization |
| `source_text` | `txt-` | `sources/<name>/source.md` | One conversion of an original: identity, ties to the original, converter, and part digests (CONTRACT-007) |
| `upstream` | `ups-` | `upstreams` | One fetched or supplied original: address, retrieval time, hash, other locations of it, identifiers, lookups to make |
| `text_review` | `rvw-` | `text-reviews` | One review of source text by a person, or a model's flag |
| `comparison_run` | `run-` | `comparison-runs` | One recorded comparison of source text, with each page's agreement |
| `passage` | `psg-` | `passages` | Selected text at a passage address, with typed locator |
| `note` | `nte-` | `notes` | Extract, paraphrase, or comment |
| `claim` | `clm-` | `claims` | Claim, thesis, rival reading, or objection |
| `attestation` | `att-` | `attestations` | Claim-to-evidence link with stance |
| `inference` | `inf-` | `inferences` | Argument relation among claims |
| `construct` | `con-` | `constructs` | Construct register entry |
| `method` | `mth-` | `methods` | Research methodology statement |
| `chapter` | `chp-` | `chapters` | Chapter identity and order |
| `citation` | `cit-` | `citations` | A citation occurrence captured by takeover |
| `intake_item` | `itm-` | `intake-items` | Something intake could not settle or read |
| `round_choice` | `chc-` | `round-choices` | The author's choice on a failing or ambiguous reference, with its recheck |
| `review_comment` | `rvc-` | `review-comments` | A reviewer's comment on a claim, imported by the author |
| `place` | `plc-` | `places` | Place identity |
| `place_name` | `pnm-` | `place-names` | Sourced name of a place |
| `place_location` | `loc-` | `place-locations` | Sourced location assertion |
| `place_assertion` | `pas-` | `place-assertions` | Sourced relation between a place and a place, passage, or claim |
| `search` | `sch-` | `searches` | Research search and its coverage |
| `decision` | `dec-` | `decisions` | The author's admission decision on a source |
| `support_record` | `sup-` | `support-records` | Saved claim-support verdict |
| `annotation` | `ann-` | `annotations` | A note that explains or dismisses one finding |
| `resolution` | `res-` | `resolutions` | Saved catalogue or identifier response |
| `import_batch` | `imp-` | `imports` | One legacy import |
| `plan` | `pln-` | `plans` | Outline or chapter specification |
| `checkpoint_input` | `ckp-` | `checkpoint-inputs` | The author's answer at a checkpoint |
| `authorship_mark` | `aum-` | `authorship-marks` | Who drafted an exact passage |
| `ai_activity` | `act-` | `ai-activities` | One recorded piece of AI work |
| `voice_profile` | `vop-` | `voice-profiles` | The project's extension of a built-in profile |
| `voice_example` | `vex-` | `voice-examples` | An accepted example of the author's writing |
| `governing_record` | `gvr-` | `governing-records` | Changelog, errata, decision log, or register |
| `governing_entry` | `gve-` | `governing-entries` | One entry in a governing record |
| `ai_role` | `rol-` | `ai-roles` | An AI role, as guidance |
| `audit_finding` | `aud-` | `audit-findings` | One finding of a chapter audit |
| `review_baseline` | `rbl-` | `review-baselines` | Input digests that a re-review list compares with |
| `image` | `img-` | `images` | Credit, rights, and permission of an image |
| `conversion` | `cnv-` | `conversions` | A recorded TIFF or EPS conversion |

A `source_text` record is the front matter of its manifest; every other record
is one JSON file under `records/`.

Every record has `schema` (`stemma.record/0`), `id`, `kind`, and `created`.
Removal sets `retired`; the file stays. `replaced_by` MUST name a record of the
same kind.

A source's `citation_key` matches `[A-Za-z0-9_]([A-Za-z0-9_:.-]{0,126}[A-Za-z0-9_])?`.
Keys and `key_aliases` MUST be unique across all sources, retired ones
included, compared without ASCII case. The one exception: the source named by a
retired source's `replaced_by` MAY take that source's keys as aliases. Renaming
a key moves the old one to `key_aliases`. A manuscript key resolves to the one
non-retired source that holds it as `citation_key` or alias; none or several is
an unknown key. Records link by ID; manuscript citations use keys.

### D. Canonical form

A record, and `stemma.json`, MUST be written as:

1. UTF-8 without a byte-order mark, LF line endings, one final newline.
2. JSON with two-space indentation; object keys sorted by Unicode code point;
   empty arrays and objects written `[]` and `{}`.
3. String escaping as ECMAScript `JSON.stringify` produces it. A lone surrogate
   is invalid.
4. Numbers only as integers within plus or minus 2^53 minus 1. Decimals and
   coordinates are strings; a measurement is an integer in the unit its field
   names (`uncertainty_m`, `print_threshold_ppi`) or a string.
5. No `null`. An unset field is absent.
6. No duplicate keys. A reader MUST reject them.

Writers MUST NOT apply Unicode normalization to any stored string. CR and CRLF
inside a string become LF, except in `LegacyField.value`,
`LegacyBlock.text`, and `LegacyEntry.entry_text`, which keep their exact code
points. Normalization for comparison or search happens in derived keys under a
versioned profile and never changes a record.

Array order is significant. A writer MUST preserve it.

### E. Digests

All digests are lowercase hexadecimal SHA-256.

| Digest | Input |
|---|---|
| Record digest | The canonical form (D) of the parsed record, so working-tree line endings do not affect it. A file that cannot be parsed has no canonical form; the corpus digest uses its raw bytes |
| Original digest | Raw bytes of an original file |
| Part digest and text digest | CONTRACT-007 H |
| `content_sha256` (review) | Canonical form of the record without `review`, `created`, `changed`, `legacy`, and `x` |
| `claim_sha256`, `claim_text` | UTF-8 bytes of the claim's `text` |
| `response_sha256` | UTF-8 bytes of a resolution's saved `response` |
| `passage_sha256`, `passage_text` | UTF-8 bytes of the passage's `quote.exact` |
| Sentence `sha256` | UTF-8 bytes of the sentence after each run of Unicode `White_Space` becomes one U+0020 and ends are trimmed; `text` stores that form |
| `SourceBinding.record_sha256` | Canonical form of an object holding the source's `type`, `subtype`, `title`, `contributions`, `issued`, `dates`, `bib`, `identifiers`, `relations`, `extents`, and `locator_label`, each if present |
| `SourceBinding.text_sha256` | For each non-retired source file of the source, the digest of the canonical form of its list of part text digests; sorted |
| `ItemBinding.content_sha256` | For a source: canonical form of its current `SourceBinding`. For another record: its `content_sha256` as defined above |
| Corpus digest | UTF-8 lines `<path><TAB><digest>` LF, sorted by path code point, for every record file and `stemma.json` (record digest), every file under `sources/` (digest of its bytes with LF endings), and `rules.md` (digest of its text with LF endings) |

### F. Links

A link is stored in exactly one place; reverse links are derived.

| Form | When | Rules |
|---|---|---|
| Reference field | The link has no data of its own | Holds a record ID of an allowed kind |
| Owned link entry | The link has data, and no state, check, or annotation of its own (`contributions`, source `relations`, construct `relations`) | Lives in the owning record; carries `lid` matching `[0-9a-z]{1,32}`, unique in that record, stable and never reused |
| Link record | The link has its own review state, evidence, or annotation, or two links between one pair must both survive (`attestation`, `inference`, `place_assertion`, `place_location`) | A record with its own ID |

- A reference MUST resolve to an existing record of an allowed kind. A reference
  to a retired record stays valid and is reported (CONTRACT-002).
- A claim links to notes only through attestations. A claim with no
  non-retired attestation that reaches a note is incomplete (FR-21).
- Evidence for and against a claim is an attestation: stance `supports`,
  `partly_supports`, `contradicts`, `qualifies`, or `context`.
- A claim-to-claim relation is an `inference`: premises `supports`, `attacks`,
  or `undercuts` its conclusion. `undercuts` MUST conclude on an inference. The
  others MUST conclude on a claim. Several premises in one inference are linked
  support. A premise is a claim, or an attestation when the argument rests on
  that evidence link itself. The thesis is a claim with role `thesis`; rival
  readings and objections are claims with those roles.

### G. Rules by area

**Sources.** `admission` records the author's decision on a source:
`candidate` until the author records one, then `admitted` or `rejected`. It
holds the decision as given: no check result, missing text, or missing `rights`
withholds it. Each decision is also saved as a `decision` record, which keeps
the history; `admission` is the current value, and the latest `decision` by
`decided.at` sets it. A source's citations can be checked once it has a
non-retired source file with text, whatever its admission (FR-9). A cited
source that is not `admitted` is counted with the unreviewed items in reports.
`intake` says how far intake got: `raw` (found text only), `parsed`, `resolved`
(matched by a saved lookup), or `confirmed` (details confirmed by a person).
`rights` is optional metadata the author states; no field gates model use,
checks, or outputs. `bib[].name` and `dates[].variable` use CSL (Citation Style
Language) 1.0.2 variable names and MUST be unique in their list. Names are in
`contributions`, in order. `type` is a CSL item type.

**Source files and upstream records.** A `source_text` is defined by
CONTRACT-007; its parts are never records of their own. An `upstream` record
states where one original came from: `url` when it was fetched (absent for a
file the author supplied), `retrieved_at` and `retrieved_by`, its `sha256`,
`size`, and `media_type`, its `identifiers`, the auxiliary files retrieved with
it (`page_numbers` data, which conversion may compare with, and a library's
`alternative_text`, which is recorded and not converted), and the `lookups` to
make for its source. Where a
source has upstream records, each of its source files' originals MUST match one
of them by hash (checked by `source.original`).

**Locations of an original (FR-98).** One upstream is one original, identified
by its `sha256` and `size`. `url` stays the address those bytes were retrieved
from. `locations` is optional: an ordered list of other places the author names
for the same original, such as the publisher's live address, a web archive's
snapshot, another archival copy, or a private copy the author keeps. A location
is a reference only: no copy is kept in the repository. A record without
`locations` means what it did before this field. A version of Stemma older than
the field reports it as an unknown field. Each entry (`UpstreamLocation`) holds:

| Field | Holds |
|---|---|
| `kind` | `publisher` (the publisher's or another live address), `web_archive` (a web archive's snapshot), `archive` (another archival copy at an address), or `private` (a copy the author keeps) |
| `url` | An `http` or `https` address, with no user name or password in it. Present for every kind but `private`, and absent for `private` |
| `label` | For `private` only: a name the author chooses, 1 to 80 letters, digits, spaces, and `. _ ' ( ) -`, starting with a letter or digit. It cannot hold a path separator or a colon, so it cannot be a path or an address |
| `added` | A stamp: when the location was recorded and by whom |
| `compared` | Optional. `at` and `sha256`: when bytes from this location were last compared, and their digest. They are the original exactly when `sha256` equals the upstream's. Absent means never compared: the location is only a reference |
| `note` | Free text |

No two entries have the same `url`, or the same `label`. A breach of these rules
is `record_invalid` (`bad_location`). A private copy's path is never recorded:
it is found by the original's digest in `.stemma/originals/` or in the files and
folders given when a command runs (CONTRACT-002 B). An address can hold an
access token in its query that no rule here recognizes, so a copy behind such an
address is recorded as `private`, by label. `compared` is a record of what one
request or one file gave at that time, not a promise about what the location
gives now: wherever bytes are used, their digest is matched again.

A web archive's ordinary page for a snapshot generally adds its own markup to an
HTML page, so its bytes are not the original's. The Internet Archive documents a
form that gives a capture as stored, with `id_` after the timestamp
(`https://web.archive.org/web/<timestamp>id_/<address>`). Observed on
2026-11-27: for two PDFs and two HTML pages that form gave bytes equal to the
recorded originals; for others it gave a different capture of the page. Stemma
rewrites no address; the author records the one to use, and the comparison says
what it gave.

**Saved lookups.** A `resolution` holds the resolver, the identifier looked up,
the address queried and when, the outcome, the response as received or reduced
as it states, its digest, and `found`, the title, contributors, issue date,
publisher, and venue read from the response, each only when present.

**Passages.** A passage records text selected from a source file: `text` (the
source file), `anchor` (the passage address of CONTRACT-007 H), `quote.exact`
(the stream text at that address, joined across parts by a line feed, copied by
script), and `locator`, derived from the printed labels of the pages it lies on,
or, for a source with no pages, from its chapter and paragraph. A passage wholly
on an unnumbered page that the source file's identity names as a title page has
the locator `title page`. A writer copies
`quote.exact` and `locator` from the source file; they are never typed.
`created.by` records who selected the passage. A passage keeps
`source_record_sha256`, the source's `SourceBinding.record_sha256` when it was
selected. A `locator.label` is a CSL locator term; `value` is the printed
string (`xii`, `12r`, `88-89`). A passage is never re-anchored silently.

**Citations from passages.** A citation made from a passage names it in
`passage`; its `quotation` is the passage's quotation under the approved joining
rules (CONTRACT-002 D) and its `locator` is the passage's, both copied by script.

**Text reviews and comparison runs.** A `text_review` names the source file, a
`scope` (`whole_page`, `passage`, `quotations`, `page_number`, or
`source_details`), the pages with the digest of what was reviewed (the page's
text digest, or the digest of its label for `page_number`), what it was compared
`against` and that original's hash when known, who reviewed it and when, the
`outcome` (`agrees`, `corrected`, `disagrees`, or `flagged`), flags with the
reading questioned and any suggestion, and a note. `source_details` also names
the `fields` confirmed and the source's `record_sha256`. A review by a model or
software actor is a flag or note, never a person's verification; a model's
outcome MUST be `flagged`. A review is current only while its digests equal
current values. A `comparison_run` records an automated comparison: `method`
(`reconversion`, a fresh conversion of the original with the recorded settings;
or `supplied_text`, another text of the same pages), whether it is
`independent` of the converter, the tools, what it compared against and that
file's hash, and for each part a digest of what was compared (the part's text
digest; for a reconversion, joined with its as-converted reading, so that
marking a correction ends the run), the words compared, the words differing, agreement in thousandths, and the differing readings (up to 20
a part, with the full count). It is current only while the part digests are
unchanged and its tool versions match the current ones.

**Notes, claims, constructs, methods.** A note of type `extract` or
`paraphrase` MUST name at least one passage. A record is in effect from the
moment it is written until it is retired; nothing waits for approval. Records
that carry `review` are marked `unreviewed` or `reviewed`. The mark `reviewed`
applies while `review.content_sha256` equals the record's current content
digest, and never while the record's `created` or `review` breaks a rule of
this contract. The author's own edits keep a record reviewed: a writer that applies an
edit whose `changed.by.kind` is `person` to a reviewed record updates
`review.content_sha256` in the same write. An edit by a `model` or `software`
actor sets `review.state` to `unreviewed`; the record stays in effect. A
changed digest that no such write explains, such as a hand edit outside a
Stemma command, reads as unreviewed until the author marks the record again. A
record written by a model or software actor starts `unreviewed`; one the author
writes MAY start `reviewed`. The author reviews when they choose, one record or
a batch with a shared `batch` token, and retires or edits what is wrong.
`review` records what the author said and is not proof of who wrote it.
`origins` holds the manuscript passages behind a claim, or behind a construct or
method that takeover suggested. A construct needs `ownership` (`author` or
`borrowed`) and a definition to be complete; `borrowed` also needs
`origin_source`. `originators` is the registered originator used by the
construct-credit check.

**Own claims.** `claim.own` set to `true` marks a claim as the book's own
argument, which `quote.self` reads (assumption: an unset value counts as own for
role `thesis`, and as not own otherwise).

**Confirmed source details.** A person MAY record a `text_review` with scope
`source_details`: the title page or equivalent checked and the fields it shows.
No check requires one. It adds to coverage and applies only while the pages'
digests and the source's bibliographic digest are unchanged. It states what the
person said and is not verification or proof.

**Other feature records.** `plan` and `voice_profile` carry `review` as above.
`checkpoint_input` records an author's answer at a checkpoint; an unanswered
checkpoint stops nothing. `given.by.kind` MUST be `person`. An
`authorship_mark` applies to the exact `text` it holds, in the `version` it
names; changed or unmarked text is unmarked, never assumed human-written. Its
`chapter` is optional, since an assembled report has no chapter records.
`text_sha256` MUST be the SHA-256 of `text` normalized as E defines; otherwise
`record.valid` reports it and the mark applies to nothing. `marked` says who
declared the mark and when. A mark is a declaration, not proof of authorship.
How a report's
evidence ledger reads marks is CONTRACT-006 J. An `ai_activity` is written for AI
work that record stamps cannot show, such as drafting prose; the disclosure
reads it and is only as complete as these records. Examples of the author's
writing behind a profile change are saved as `voice_example` records, so they
are committed with the project. A governing record exists even with no entries;
an entry without a `date` is undated. `ai_role` is guidance and not access
control. `Project.persona.checkpoints` set to `0` turns every checkpoint off.
`Project.book_style` holds the book design settings, `Project.tools` the pinned
tools, and `Project.voice_profile` the profile in use.

**Project settings.** `Project.citation_style` is optional: it is absent until a
style file is chosen (`init` ships none yet).

**Citations.** A `citation` record is written only for an occurrence in the
author's existing manuscript: by takeover for an imported one, or with
`record add` (CONTRACT-002 B) for one Stemma has not imported (assumption). Occurrences in a Stemma-authored manuscript are read from
its text and MUST NOT be duplicated as records. The record keeps what intake
found. The manuscript, which links to it by the record ID, is authoritative for
the current key, locator, quotation, sentence, and claim links (CONTRACT-006
D); those record fields are never updated.

**PDF manuscripts.** Takeover of a PDF (CONTRACT-003 I) uses these records
unchanged, with one addition to the record schema that is made with the code that
writes it (SD-015, step P5): `ImportBatch.format` gains `pdf`, and the batch
gains a field listing the words in which a line-end hyphen was kept (CONTRACT-003
I). Until then the schema accepts neither.

**Takeover batches and chapters.** `ImportBatch.separate` is `true` when the
author said at takeover that the file is a different text from those already
taken over (CONTRACT-003 I). Each record takeover makes, the chapter included,
names its batch in `created.import`; the repeated-text comparison finds a
batch's chapters by it. A chapter's `manuscript_path`, when set, MUST be
`manuscript/<chapter id>.md`.

**Takeover rounds.** `intake_item` and `round_choice` records are never edited.
There is no round or session record: remaining work is computed from failing
results and intake items that have no applicable choice, so stopping and
resuming needs no saved state. A `round_choice` names its action, what it
replaced, the affected claims, and the recheck results observed when it was
made. A stored recheck is history; current outcomes are always recomputed.
`remove` retires the citation and keeps the record. The latest choice by
`chosen.at` applies. A `year_parenthesis` item records brackets that
intake left unlinked; it asks for nothing, so it is counted and listed but is
not remaining work. A `round_choice` with action `restore_text` records that an
occurrence read as a citation is not one.

**Review comments.** A `review_comment` is untrusted text from outside the
project. It changes no claim. `claim_sha256` shows which claim text the
reviewer saw.

**Support records.** One record states one verdict for one claim and passage.
It is never edited. It is current only while `claim_sha256`, `passage_sha256`,
and the passage's page digests (`page_sha256`) all match. Staleness is computed and never stored.

**Annotations.** An annotation explains or dismisses one finding in reports. It
permits nothing, because no finding blocks anything. It binds `check` and
`finding_key` (CONTRACT-002) and at most one of:

- `sentence` and `source`, for a finding about a cited sentence;
- `item`, for a finding with no sentence about one record of any kind (such as
  a bibliography entry or an image): the record ID and its current item digest.

A finding with neither a sentence nor a record subject (such as
`build.uncommitted` or `package.leak`) binds only `check` and `finding_key`.

`effect` is `explain` or `dismiss`. An annotation about a near-match quotation
SHOULD hold `compared`: the cited text, the source text, the match profile, and
the source file. An annotation applies only while every bound value equals its
current value and it is not retired. `written.by` records who wrote it; a
`dismiss` takes effect only when `written.by.kind` is `person`. Which findings
can be dismissed is in CONTRACT-002. Annotations are listed in reports and the
disclosure. They record intent and are not forgery-proof.

**Tags and logged changes (FR-94).** A source's `tags` are unique, sorted
strings of at most 80 characters: lowercase letters (or letters with no case),
digits, `-`, `_`, and `.`, starting with a letter or digit, with an optional
namespace of the same form before one colon, such as `position:subsidence`. A
source's `changes` is an append-only log of what commands changed on it: `at`,
`by`, `action` (`added`, `replaced`, `removed`), `field` (`tags`,
`identifiers`, `authors`, a source field, or `bib.<name>`), `value`, and where
known `previous` and `from`. Neither is part of `SourceBinding` (E), so tagging
makes nothing stale. Commands enforce the tag form; `record.valid` does not yet.

### H. Places and restricted coordinates

- Restriction applies to a location, not to a place. A place name, a gazetteer
  identifier, a relation such as `near`, another public location of the same
  place, or prose can still disclose the site. No tool derives or removes these.
- `geometry` positions are WGS 84 (the World Geodetic System), longitude then
  latitude, as decimal strings. A `Polygon` is one closed ring. Digits MUST NOT
  be read as uncertainty; `uncertainty_m` and `certainty` carry it.
- A location is restricted only when `sensitivity.class` is `restricted`. A
  location without `sensitivity` is public and is shown.
- A restricted location MUST NOT hold exact geometry. With `release` `area` it
  MAY hold an author-set broad `Polygon`; with `withhold` it MUST hold no
  geometry. Only class `public` may use `release` `exact`.
- Who stated what is recorded: `created` on every place record, `review` on
  place records (an unreviewed record is in effect and reported), and
  `sensitivity.decided` for the restriction. Any actor MAY
  mark a location restricted, effective at once. Only a `person` MAY change it
  to public.
- A project MUST NOT hold a restricted exact value, or a hash derived from one,
  in any tracked or derived file.
- **Whole-corpus digest exception.** The
  corpus digest (E) and the data identity (CONTRACT-005 J) are computed over
  every record file. When a record wrongly holds a restricted exact value, both
  are therefore hashes derived from it, and check reports, exports, and explorer
  pages write them. The value cannot be read from them, but someone who has
  every other input could test a guessed value against one. These two digests are
  excepted from the rule above, so that stale output can still be detected. No
  other digest is excepted. A graph export warns `restricted_in_project`.
- The restricted store is a directory outside the project tree, chosen by the
  `--restricted-dir` option, then `STEMMA_RESTRICTED_DIR`, then a per-user
  configuration directory keyed by `project_id`. A path inside the project MUST
  be refused.
- The agent MAY read the restricted store when a task needs exact coordinates.
  What it reads goes to its model. It MUST NOT write an exact restricted value
  into a tracked or derived file or a reviewer output; Stemma cannot enforce
  this.
- It holds `<location id>.json`:
  `{"schema":"stemma.restricted/0","location_id":…,"geometry":{…}}` in canonical
  form, with optional `strings`, a list of other text forms the author wants the
  release scan to report.

### I. Provenance and preserved legacy data

`created` and `changed` are stamps: time (RFC 3339 with offset), actor, and
optional `activity` and `import`. A `model` actor SHOULD carry `version` and
`prompt_version`. `changed` records only the last change; git holds history.

`legacy` holds one entry per import that produced the record. `LegacyField`
keeps each native value under its native path. `mapped_to` names the record path
that received it, and `mapped_sha256` is the digest of that mapped value's
canonical JSON at import. `LegacyBlock` on the import batch keeps file-level
content. `legacy` values are data, MUST NOT be executed, and MUST survive every
rewrite. CONTRACT-003 defines their use.

### J. Standing rules

`rules.md` is UTF-8 plain text. Each rule begins with a level-two heading
`## RULE-<three or more digits> <title>`. A rule ID is never reused. Reports and
records cite rules by that ID.

### K. Extensions

Any record MAY hold `x`, an object whose keys are namespaced `<owner>.<name>`.
It is outside the UMF schema. Another unknown field is reported as a warning.
A writer MUST preserve unknown fields.

### L. Research notes

A research note is working prose: a search write-up, a source inventory, a
thesis test, open questions. It is not a record. It is not source text or
evidence, nothing cites it, and it admits no source and records no search or
decision. The corpus digest (E) leaves it out; a check report lists note
digests beside it, because `coordinate.stray` reads notes (CONTRACT-002 C). The
rule on restricted values (H) covers notes as it covers every tracked file.

A writer that creates a note names it `research/YYYY-MM-DD-<slug>.md`: the date
the note was started, then a slug matching `[a-z0-9]+(-[a-z0-9]+)*` of at most
60 characters. The slug says what the note is about; this is the one place where
a tool forms a file name from words, since a note has no ID. A writer MUST NOT
overwrite a different note: it appends `-2`, then `-3`. The first line is
`# <title>`. There is no front matter.

This grammar binds writers only. A reader MUST accept any name and form, in any
folder below `research/`, and MUST NOT report or rewrite a note for either.
`record.valid`, `validate`, and `fmt` ignore notes.

No index file exists. The index is worked out when asked for (`research list`,
CONTRACT-002 B). A committed index would conflict between branches and go stale
after a hand edit; numbers or random IDs would add a counter to allocate or make
names unreadable.

## Precedence and Compatibility

- Versioning: `schema` carries the record major version; `Project.format`
  carries the project format. A change that an older reader would misread
  increments both and ships with a repeatable migration.
- Precedence: record files outrank every index, export, and report. The UMF file
  governs declared shape; this contract governs behaviour and the rules it adds.
  A conflict between them is a defect in the newer change.
- Backward compatibility: new optional fields and new record kinds are additive.
  A reader MUST NOT rewrite a record whose major version is newer than it knows.
- Deprecation: field names and enumerated values are not reused.
- Merges: after a git merge, a tool MUST validate every record; conflict
  markers, duplicate keys, duplicate citation keys, and dangling references are
  errors.

## Error Semantics

| Condition | Outcome | Retry | Recovery Expectation |
|---|---|---|---|
| Unparseable JSON, duplicate key, lone surrogate | `record_unreadable`; the file is named; checks over it cannot run | no | Fix the file; no tool guesses its content |
| Valid JSON, not canonical form | `record_noncanonical` warning | yes | Run the formatter |
| Schema or contract rule violated | `record_invalid` with field path | no | Correct the record |
| ID does not match file name or kind directory | `record_misplaced` | no | Rename or correct |
| Reference missing or of the wrong kind | `reference_dangling` | no | Repoint or remove |
| Newer major version | `version_unsupported`; no write | no | Update Stemma |
| A source file's part is missing or differs from its manifest digest | `source.pages` fails; dependent checks are `unverifiable` | yes | Restore from git, or `source seal` after review |
| Restricted store absent while a record needs it | The release scan is `unverifiable` | yes | Supply the store |
| Exact geometry on a non-public location | `restricted_in_project`: a warning that blocks nothing; no output includes the geometry (assumption) | no | Move the value to the restricted store; git history may still hold it |

## Examples

All names, titles, and values are invented. The record is shown in canonical
form.

```json
{
  "basis": "The passage reports one harbour, not the whole coast.",
  "claim": "clm-4q7m2c9x0b5ke8dn1v3a",
  "created": {
    "at": "2026-01-05T09:58:00Z",
    "by": {
      "kind": "model",
      "name": "example-model",
      "prompt_version": "note-1"
    }
  },
  "evidence": "nte-9t1h6r3w8f2mz5pj7c4s",
  "id": "att-2n8d5k0y7g4qv1xb6e9r",
  "kind": "attestation",
  "review": {
    "content_sha256": "<64 hex>",
    "decided": {
      "at": "2026-01-05T10:00:00Z",
      "by": {
        "kind": "person",
        "name": "author"
      }
    },
    "state": "reviewed"
  },
  "schema": "stemma.record/0",
  "stance": "partly_supports"
}
```

A conformance test canonicalizes it twice and compares bytes. It edits `basis`
with a `model` actor in `changed` and expects the record to read as unreviewed
while staying in effect, then repeats the edit with a `person` actor and
expects it to stay reviewed.

## Non-Normative Notes

- `Project.bibliography_include` lists sources that belong in the built
  bibliography even when nothing cites them. Takeover adds every entry of the
  original reference list (CONTRACT-003 F). A listed source that is cited
  nowhere fails `bib.uncited` (CONTRACT-002) until the author removes it from
  the list or dismisses the finding with an annotation.
- A support record is bound to the claim, passage, and page digests, not to
  a manuscript sentence. A strengthened sentence leaves it current.
- Treating places as public unless marked means a site marked late may already
  be in git history, in an export, or sent to a model.
- A project whose material may not go to a hosted model can run its whole
  process on a local model. That is an unsupported experiment in v1; nothing in
  this format depends on which model is used.
- Field vocabulary borrows CSL variables and locator terms, Web Annotation text
  selectors (the W3C model for pointing into text), and PROV (the W3C
  provenance model) ideas of actor and activity.
- One flat directory per kind keeps paths short. Sharding would be a format
  migration.

## Proof Status

| Element | Evidence | Not shown |
|---|---|---|
| Upstream locations | Tests with invented records and faked fetches on one macOS system; the PostgreSQL worked example records real web-archive locations and what each gave on one day | That any location keeps giving what it gave |
| UMF schema file | UMF SDK 0.10.13 reported it valid, with and without the `umf.ddd` package, on one macOS system, run again after the latest record additions; every diagnostic was a warning (unknown extension, uninterpreted relationship qualifier, unchecked extension semantics). A generation-time check confirmed members, value targets, reference target kinds, and unique relationship names | UMF checks no `umf.ddd` semantics, and in a feasibility test accepted a bad scalar, a field mismatch, and a multi-source relationship that arras rejects. No record has been validated against this schema, and no validator has been generated from it |
| Canonical form | A feasibility test wrote 70 synthetic records canonically on one system. It applied Unicode normalization, which this contract forbids | This exact form, on any system |
| Digest and applicability rules, links, `LegacyField` mapping | Design only | All |
| Restricted store | In a feasibility test, structured restricted coordinates did not leak, but typed prose, misclassified records, and place names did | Completeness of any scan |

## Schema Basis

Inspected: UMF core `0.10.0` and the `umf.ddd` `0.1.0` extension, SDK release
`0.10.13`. Reused: records, fields, scalar families, keys, allowed values,
relationships with several target types, and `umf.ddd` entities and values.
Local additions: reference target rules and the behaviour in this contract.
Gaps: tagged variants are optional fields plus rules (`PartialDate`); `x` and
conditional requiredness are outside the schema. No citation vocabulary was
found in the UMF extensions that research examined, and UMF domain packs were
not searched for one. UMF is used at development time; the product ships no UMF
runtime (see the Architecture).
