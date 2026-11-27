---
ddx:
  id: CONTRACT-005
  type: contract
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-002
    - stemma.adr-006
    - stemma.adr-008
    - stemma.adr-012
    - CONTRACT-001
---

# Contract: Graph export and graph engine interface

**Contract ID**: CONTRACT-005
**Type**: library and file formats
**Version**: 0 (provisional; see Proof Status)
**Related**: ADR-002, ADR-006, ADR-008, ADR-012, FR-46, FR-62 to FR-68, FR-76

## Purpose

Defines the graph files generated from record files, how arras (the
DocumentDrivenDX graph application) reads them in a browser, from an offline
file or from Stemma's server on the author's computer (ADR-012), and the query
interface shared by the disposable index and the later graph engine.

## Scope and Boundaries

- In scope: export files, audiences, mapping, freshness, rebuilding,
  the reviewer comment file, the `GraphStore` port, arras compatibility,
  upstream needs, and the local server's HTTP surface.
- Out of scope: explorer screens, map layouts, typeset-page linking, index
  tables (Data Design).
- Owning module: `packages/graph`.

## Normative Surface

### A. What is canonical

The evidence graph stored in the author's repository is the record files
(CONTRACT-001). The arras files below are a one-way projection of them. A tool
MUST NOT read a graph export as input to a record, a check, or a build decision,
and MUST NOT accept an edited export. Deleting every export and index loses no
fact.

### B. Export files

`graph export --audience <author|reviewer>` writes one directory:

| File | Content |
|---|---|
| `stemma.umf.json` | Generated arras module: UMF core `0.10.0` with only the `umf.ddd` `0.1.0` and `arras.view` extensions |
| `stemma.graph.json` | `arras.graph` version 1 file with `complete` true when no record type was dropped |
| `arras-static.json` | arras static configuration naming the two files by relative path, for hosted delivery |
| `stemma.states.json` | Record states (J), for exported records |
| `stemma.sourceviews.json` | Source views (K) of exported passages and citations, `author` audience only |
| `stemma.manuscript.json` | The manuscript view (L), `author` audience only. Written by every export; it says so when the project has no report |
| `stemma.export.json` | Manifest, schema `stemma.graph-export/0`: `audience`, `scope`, `corpus_digest`, `data_identity` (J), `exporter`, `arras`, `arras_view`, `search_fold`, SHA-256 of each other file (`files`), `counts`, `omissions[]` (type, reason, count), `dropped_links[]` (relationship, reason, count), `states` (computed, not computed, the checks used and those left out with why), `warnings[]` (code, message, records) |
| `explorer.html` | With `--page`: one self-contained page with the module and graph texts inlined |

The same data identity, exporter version, audience, and scope MUST produce
byte-identical files. They hold no time, user, machine path, or git revision.
Every JSON file writes `<` as `\u003c`, so the page inlines the module and graph
byte for byte and their digests match the manifest.
The default output is `build/graph/<audience>/`. An export without `--page`
removes an `explorer.html` that an earlier export left there.

### C. Never committed; rebuilt when needed

Record files in the repository are canonical. The generated browser graph is not
committed: `init` MUST ignore `build/`, and no command adds an export to git.
Every output directory, the default included, MUST be refused when:

- it holds the project, or is under `records/`, `sources/`, `manuscript/`, or
  `research/`;
- it is in a git work tree, in the project or not, and git does not ignore every
  file to be written there (git never ignores a tracked file), or git cannot say;
- no git repository holds it, and it is inside the project but not under
  `build/`.

An export overwrites or removes only its own files. In the output directory,
those are a `stemma.export.json` whose schema is `stemma.graph-export/0` and the
export files (B) that it lists, each a plain file. When any other thing has the
name of any export file, `explorer.html` and the manifest included, with or
without `--page`, the directory MUST be refused. The manifest is written first,
so that an export cut short still lists its files, can be made again, and is
reported stale because their digests differ.

Links are followed before the test. A relative `--out` is relative to the
project. `graph status` reports an existing export stale when the data identity,
the exporter version, or a file digest differs.

**A fresh clone** holds no graph files. To browse, the author:

1. Installs the plugin and the pinned Bun.
2. Runs `graph export --audience author --page`. It validates the records,
   leaves out and names what cannot be used (E), and builds the module, graph,
   and page from files in the repository and assets shipped with Stemma. It needs no network, index, originals, or restricted
   store.
3. Opens `build/graph/author/explorer.html`.

The agent runs step 2 when asked to browse, and again after records change.
Someone without Stemma cannot browse a clone. Typeset pages and live preview
need further build outputs defined with the explorer design. Anyone given an
export sees everything in it: the arras static profile has no per-reader access
control.

### D. Reading in the browser

The explorer uses the arras static read-only profile (arras CONTRACT-012,
marked draft by arras). The browser loads the module and graph text, and an
`ArrasClient` in the page answers every read from memory. There is no server
application, database, or write path.

| Delivery | How files reach the page | Requirement |
|---|---|---|
| Hosted or locally served | The page fetches `arras-static.json` and the two files | Any static file host that answers `GET` and `HEAD` |
| Single offline file | The page and both texts are built into one HTML file | Opens from the local file system with no network request; required for the reviewer package (FR-46) |
| Local server (`browse`, M) | A server on the author's computer answers the page's reads from data it holds in memory | Listens on the loopback address only, under the rules of M; the author's own export, never a reviewer package |

The statements below about a single page, its policy, and reloading after an edit
are about the offline file. The served page follows M.

**The Stemma host page.** The plugin ships a page template, built with Stemma
from the host, arras, React, and their styles, with the licenses of that code.
An export fills five `application/json` script elements: the banner data, the
module, the graph, the source views (K), and the manuscript view (L), the last
two byte for byte as written. Nothing is bundled on the author's machine. The page's
content security policy is `default-src 'none'; script-src 'sha256-<script>';
style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action
'none'; base-uri 'none'`. arras routes in the URL fragment. The host folds the
search text of each query under `search-fold` before arras reads it. A banner
shows the project ID, audience, data identity, omission counts, the states not
computed, warnings, and that support results are recorded model judgments. It
says that a time arras shows is when the page was opened. A module or graph that
does not load is reported with the file and record.

**Author edits and the offline preview.** With no backend, a page cannot see
files that change after it loads. After an edit the agent MUST rebuild the
offline preview (export or build again) and tell the author to reload it. The reloaded page compiles Typst in the browser from the rebuilt manuscript data
(CONTRACT-006 H). An open page does not update by itself, so it MUST show its
data identity (J), which the rebuild also prints, so that the author can see
whether the page holds the latest rebuild. No export file holds a time (B).
Browser compilation is untried.

Stock arras static pages do not open from a local file. The single file is a
Stemma-built page until arras offers one. A page that opens from a repository
checkout therefore needs either the single file or a static host. Writes are
refused by the profile; edits go to record files, followed by a new export.

### E. Audiences

Filtering happens before any file is written; the page does no filtering.

- Both audiences omit restricted store values, local paths, `legacy`, and `x`
  (the top-level extension object only; `Region.x` is a coordinate and stays).
  Local paths are these fields: `LegacyField.native_path`,
  `ImportBatch.original_name`, `LossItem.path`, `Image.file_path`,
  `Chapter.manuscript_path`, `GoverningRecord.path`, and `PageEntry.file`; and
  any value that begins as a path on a machine (`file:`, `~/`, a drive letter, a
  network share, or a system directory such as `/Users/`, `/home/`, or
  `/nix/`). In a field that says where something is, a value is also left out
  when it is an absolute POSIX path of two or more segments in any directory, or
  a `~user/` path: `Original.held_at`, `Original.obtained_from`, `Upstream.url`,
  `Upstream.note` (also after the words `Obtained from: ` that Stemma writes),
  `AuxiliaryFile.url`, `Resolution.url`, `CandidateOrigin.location`,
  `InputDigest.input`, `GoverningRecord.identity`, `SourceChange.value` and
  `previous` and `from`, and the value of a bibliography field named `file`,
  `local-url`, `localfile`, `pdf`, or `path`. A web address is not such a path.
  A path written inside prose is not detected. Nor, in any other field, is a
  path outside the named system directories. `ImportBatch.blocks` is legacy content.
- These rules rely on a record's shape. A record with a `record_invalid`
  problem (CONTRACT-001) is therefore left out whole, as is a file that cannot
  be read, has a newer version, or does not belong under `records/` or
  `sources/`. Each is counted by type (`File` when the kind is not known) and
  reason (`invalid_record`, `unreadable`, `newer_version`, `stray_file`), and
  the warning `records_left_out` names the files. A record that is only
  misplaced, or has an unknown field or a dangling reference, stays. A
  reference to a missing record, or to one of a kind the field does not allow,
  gives no link; it is counted in `dropped_links`, and the warning
  `broken_references` names the records that hold it. A `content_sha256` of a
  bound item (an annotation's) is emitted only when the record it names was read
  whole with no `record_invalid` problem; otherwise it is omitted and counted
  `unchecked_digest`, or `restricted_digest` as below.
- The graph holds no page text, part list of a source file, manuscript file,
  research note, or standing rule. Each is counted. The `author` export's
  manuscript view (L) does hold the text of the report it reads, which may be
  unpublished. The `author` export's source
  views (K) do hold the text of pages that exported passages lie on: the
  `page_text` count is of the parts none of whose text is in the export. No
  other source text is added.
- Retired records, and views that would be `retired`, are in no export. `rights`
  fields filter nothing (CONTRACT-001 G): a source marked in any way has its
  cited pages in the author export like any other.
- `stemma.sourceviews.json` and `stemma.manuscript.json` are never part of a
  reviewer package or reviewer export, however they are filtered.
- A project record can wrongly hold restricted data. For a location whose
  `sensitivity.class` is `restricted`, an export MUST emit its geometry only
  when `release` is `area` and the geometry is a polygon. Otherwise it emits
  none, and omits `content_sha256` values made from that record (its review
  mark and annotations of it), counts them, and warns `restricted_in_project`.
  This is looked for in every record that can be read, invalid ones included. A
  location too malformed to be recognized as restricted is invalid, so none of
  it is emitted. The export is still written. The corpus digest and data
  identity cover every record file, that one included (CONTRACT-001 H, a
  proposed exception).
- `author` is for the author's own machine or private repository. It MAY include
  passage text and the text of cited pages (K). Anyone given it can read both.
  The export runs the coordinate scan over the source text, citing sentences,
  recorded quotations, and review readings in its source views and warns
  `coordinates_in_views` with the record IDs; files are written.
- `reviewer` MUST include only fields on its allow list. It omits source files
  unless the author includes them, and otherwise all source text (passage quotes
  and context, note extracts, manuscript origins that quote sources,
  support-record passage and quoted text, lookup responses) apart from excerpts
  allowed under CONTRACT-002 E1; it gives restricted locations only the
  author-set broad area or nothing, and shows all other locations. A field with no
  allow-list entry is omitted. Report data in the package follows
  CONTRACT-002 E1.
  Until the excerpt limit is set, no excerpt is kept.
- A new record field is absent from `reviewer` until added to the allow list.
- A reviewer export runs `scan release`. Stemma removes any withheld source
  text it finds in the files it generates and reports what it cannot remove
  (CONTRACT-002 E1). A restricted coordinate hit, such as one typed in prose, is
  a `restricted.leak` or `coordinate.stray` warning: files are written, and the warning says the export can disclose the
  site. Structured restricted values are excluded before writing in every case.
  Short matching excerpts may stay only under the CONTRACT-002 E1 allowance.

An export MAY be scoped to a chapter with `--chapter`: the chapter, its claims, their
attestations, inferences, evidence chains, constructs, and places.

### E2. Reviewer comment file

A reviewer attaches comments to claims and saves one file, which the author
imports: on the command line with `review comment` (CONTRACT-002 B), or in the
offline explorer, which uses the same operation. Nothing is sent anywhere.

| Field | Rule |
|---|---|
| `schema` | `stemma.review-comments/0` |
| `package` | `corpus_digest` and `audience` copied from the export manifest |
| `reviewer` | Optional name as typed; self-asserted |
| `comments[]` | `comment_id` (random, `[0-9a-z]{16,40}`), `claim` (record ID), `claim_sha256` of the claim text shown, `text` (plain text), `commented_at` |

The file is canonical JSON (CONTRACT-001 D). `review import` treats it as
untrusted: it caps file size, count, and text length, never interprets text as
markup or instructions, and writes only `review_comment` records. A repeated
`comment_id` with equal content is skipped and with different content is
refused. A comment on an unknown claim is reported and not imported. One whose
`claim_sha256` no longer matches is imported and shown as made on earlier text.
Saved but unexported comments live only in the page and can be lost; the page
MUST say so. Saving a file from a page opened locally is untested.

### F. Mapping

| Canonical | Projection |
|---|---|
| Record kind | Entity type in PascalCase (`SupportRecord`) |
| Record ID | Required string property `recordId`, the primary key |
| Link record (`attestation`, `inference`, `place_assertion`, `place_location`) | Entity; evidence stance and claim-to-claim relation stay readable as its properties |
| Owned link entry (`contributions`, `relations`) | Entity `Contribution`, `SourceRelation`, or `ConstructRelation` with key `<record id>.<lid>` |
| Reference with several target kinds | One relationship per source and target type pair, named `<sourceType><Field><TargetType>` in camel case, with inverse `<name>Inverse` |
| Nested value | Flat string properties; repeated scalars as lists |
| Decimal, partial date, coordinate, geometry | String |
| `kind`, `type`, `version` fields | Renamed `recordKind`, `recordType`, `recordVersion`; arras reserves such names |
| Multilingual text | The value, with original, romanized, and translated lists. The language and scheme of each other form are omitted and counted |
| Repeated nested value | One list entry of `name: value` parts for each item; its references are also links. A list of integers is a list of strings |
| Unrecognized field | Dropped and counted in the manifest |
| Name that arras reserves | Prefixed `record`, as `recordCreatedAt` |

Entity types, properties, relationships, and owned entry types (value types with
a `lid` and a reference) come from the record schema. A module declares the
types, properties, and relationships its graph uses.

Stemma adds these properties. `heading` is the record's title in lists, made
from its own fields. `searchText`, on searched types only, is the record's words,
and for a source its keys and contributor names, folded under `search-fold`.
`stemmaStates` is a read-only list of the record's states (J), present only when
it has one. `stemmaNotice`, on a support record, says that it is a recorded model
judgment and not verification; the type's label says so too.

- The searched types, declared first and in this order, are `Source`, `Claim`,
  `Passage`, `Note`, `Citation`, `Agent`, `Chapter`, `Construct`, `Method`,
  `SupportRecord`, `Attestation`, `Inference`, `Annotation`, `SourceText`,
  `Place`, `PlaceName`, `PlaceLocation`, `PlaceAssertion`, `Search`, and `Plan`.
  Every other type declares an empty search list, or arras would search it.
- View vocabulary `0.1.0` is pinned. Every single string field declares `text`
  or `prose`; left alone, arras shows some as links or badges by their names, and
  each badge field widens the search query. The `markdown` format and
  `brand.wordmark` are never used.

- Every property except `recordId` is optional, so records with missing fields load.
- Keys fit `[A-Za-z0-9._:-]{1,128}`: `lid` MUST match `[0-9a-z]{1,32}`.
- The exporter MUST emit each (relationship, source, target) triple once and
  only when both endpoints are exported. A dropped link is counted.
- Records are ordered by type declaration order, then key by code point; links
  by relationship declaration order, source, target.
- Retired records are omitted.
- Names MUST satisfy arras rules (`[A-Za-z][A-Za-z0-9_]{0,63}`, unique without
  case, not reserved); the exporter fails on a name that does not.
- Module and graph are generated together. The test is that the arras static
  loader accepts them; UMF validation is not enough.

### G. arras limits and upstream needs

Limits at arras 0.8.1:

| Limit | Effect | Stemma handling |
|---|---|---|
| One type per relationship end | Multi-target links cannot be one relationship | Pair relationships (F) |
| Relationship records have no readable properties; a link is identified by its triple | Link data and parallel links would be lost | Link records and owned entries become entities, adding nodes and hops |
| ASCII keys; reserved names; integers only | Limits names and numbers | F |
| One bad record fails the whole load | No partial graph | Generate together; test the load |
| A relationship field returns at most 100 keys | Large hubs need paging | The arras "Show more" lists the other type for the rest; all 150 links of a test record were reached in each direction |
| A query searches 20 types and resolves 1,000 records | Other types are not searched | 20 searched types (F); others are reached by type lists and links |
| A search takes the first 50 matches per type in key order and lists at most 50 in all; a query is 2 to 200 characters and at most 6 words; no diacritic folding | Matches past 50 are not listed; random keys make which appear arbitrary | `searchText` and a folded query; type filtering; upstream request |
| A query selects at most 50 fields | A record with many fields or links needs several | arras splits its record-page queries |
| A document's view terms are at most 128 KiB, a type's 16 KiB | A label on every field of the full schema does not load | Leave out what arras gives anyway; about 103 KB for the full schema, tested |
| A list value is drawn as badges that do not wrap | Long list entries widen the page | A style in the host page lets them wrap |
| Neighbourhood picture is one hop, at most 40 nodes; the console canvas draws at most 150 and is not in the static page | No book-scale connected view | Upstream (below) |
| Support claim: Chromium on macOS, up to 1,024 nodes and 7.9 MB | Larger graphs and other browsers unclaimed | Chapter scope; measure before claiming |
| Static page content security policy | Likely blocks WebAssembly and workers, needed for Typst preview | Stemma host page; confirm by test |
| No custom view or node-page slot; closed view vocabulary; Markdown drops relative links | Maps and page preview cannot plug in | Compose views beside the browser through its `client` and `location` properties, if that proves sufficient |

| Change | Where | Needed by | Blocks |
|---|---|---|---|
| Larger connected-graph view | arras contribution | FR-64 (ADR-008) | Explorer release |
| Supported single-file or local-file build | arras, or Stemma host | FR-46 | Not blocking if Stemma builds the host |
| Extension point for views and node-page sections | arras | FR-65 to FR-67 | Unknown until composition is tried |
| Search folding and ranked candidate selection | arras | FR-64 | No; partial workaround |
| Several types per relationship end; readable link properties | arras contracts | FR-63 fidelity | No; projection works without them |
| A way to attach and save claim comments from a node page | arras extension point or Stemma view | Reviewer comments | Unknown until composition is tried |
| Claims for larger graphs, other browsers, Windows | arras, or Stemma evidence | FR-64, FR-75 | Support claims only |

Stemma MUST NOT keep a private fork of the arras connected-graph view.

### H. `GraphStore` port

The local server (M) does not implement this port and builds no index: it runs
arras's own static loader and executor over an export held in memory.

The disposable index (M1) and the graph engine (FR-63, P1) implement the same
read interface, so features do not change at the switch.

| Operation | Result |
|---|---|
| `rebuild()` | Index built from record files only |
| `status()` | Corpus digest, indexed digest, index schema version, `fresh` |
| `get(id)` / `list(kind, filter, after, limit)` | Records; lists ordered by ID in code point order with keyset paging |
| `links(id, direction, relation?)` | Forward or derived reverse references with the field path |
| `dependants(ids)` | Transitive reverse references, cycle-safe: one input to `check --changed` (which also uses each check's declared inputs, CONTRACT-002 B) and to change flags |
| `search(text, kinds, limit)` | Matches under the `search-fold` profile, ordered by rank then ID |
| `dump()` | Canonical logical dump (Data Design) |

- There is no write operation. A change is made to record files and then
  indexed.
- A query MUST NOT answer from a stale index: it refreshes first or returns
  `index_stale`.
- An incremental refresh MUST give the same dump as a full rebuild.
- Both implementations MUST pass one conformance suite.

### I. First engine scope

The first engine, in TypeScript on SQLite, serves the data reads that the arras
static-profile `ArrasClient` needs, behaving as that profile does, checked
against the arras read corpus (253 requests) and view cases. It writes nothing:
write, journal, and SQL members return `501` as in that profile.

Writes and wider server compatibility, including the arras Python backend
contract (reads as Weft SQL; Weft is the family query compiler) and provider actions, come later and need a further surface in this contract.

Transport (assumption): the first engine is a library called in process behind
`GraphStore` and the `ArrasClient` read calls, and it opens no network listener
of its own. It is not built. The one HTTP surface this version defines is the
local server's (M), which uses arras's static executor and not this engine; when
the engine is built, it may take the executor's place behind the same surface.

### J. Derived view data

These files are generated with an export for the Stemma explorer. They are
derived, never read back, hold no time or machine value, and are listed with
digests in the manifest. Shapes are provisional and minimal; the explorer and
maps designs extend them in a later revision. The page computes no state or
filtering of its own.

The **data identity** is the SHA-256 of the corpus digest and then each
manuscript file's digest (SHA-256 of its bytes), in digest order, each followed
by LF. The manuscript files are those under `manuscript/` and, when the project
has `report/report.json`, that file and the template it names (L); one that is
missing or cannot be read counts as `unreadable`; pages show its first 12 characters. `graph status` compares it, so a
manuscript edit makes an export stale.

**States as built.** `unreviewed` (a cited claim or source that the check report
counts as unreviewed or not admitted, and any record whose review mark does not
apply, CONTRACT-001 G), `retired_link` (a reference to a retired record),
`annotated`, and `open_finding`. The last two come only from checks whose inputs
the data identity covers and that read no tool version or saved lookup:
`record.valid`, `source.held`, `source.pages`, `source.labels`,
`source.footnotes`, `source.changed`, `cite.key`, `bib.uncited`,
`quote.present`, `quote.page`, `locator.extent`, and `number.present`. The
manifest names the checks left out. `support_missing`, `support_stale`, and
`support_unsupported` are not computed; the manifest and page say so, and a
record with no state is not shown to be clear.

| File (schema) | Content |
|---|---|
| `stemma.preview.json` (`stemma.preview/0`), with `--page` for `author` | `data_identity`, `chapters[]` (id, order, manuscript text), `citations[]` (CSL-JSON items), style and locale digests, `assets[]` (SHA-256, kind; bytes inlined in the page), pinned compiler version, an optional print reference, and optional `built_pages[]` (linked page images from a native build of the same manuscript inputs, with that build's identity and watermark state). Whether the reviewer audience gets preview data is open |
| `stemma.sentences.json` (`stemma.sentences/0`) | `loci[]`: locus, chapter, sentence digest, `claims[]`, `citations[]` (CONTRACT-006 D, H) |
| `stemma.states.json` (`stemma.states/0`) | `records{id: states[]}` computed by `core`: `unreviewed`, `retired_link`, `support_missing`, `support_stale`, `support_unsupported`, `annotated`, `open_finding` |
| `stemma.maps.json` (`stemma.maps/0`) | `argument`: `nodes[]` (record ID, kind, label, states), `links[]` (from, to, stance or relation, states). `places`: `assertions[]` (place, location record, geometry or `withheld`, certainty, `uncertainty_m?`, sources), `not_drawn[]` (record ID, reason). Audience filtering (E) applies before writing |

### K. Source views

A **source view** (`stemma.sourceview/0`) answers one question about one ID: a
citation record, a passage record, or a quotation of an assembled report
(CONTRACT-006 I). `core` makes it from the corpus alone. It holds no time,
machine value, local path, or fact about which originals are on a machine. The
local server (M) returns the same object, made with no size cap. A page reads it and computes no state,
offset, or filtering of its own.

| Field | In | Holds |
|---|---|---|
| `schema`, `kind`, `id` | all | `kind` is `citation`, `passage`, or `quotation` |
| `state`, `why` | all | The state, and in plain words why |
| `work` | all, when known | `id`, `key?`, `title?`, and `part_of?` with the same three. For a citation or report quotation it is the cited work; for a passage, the passage's source |
| `locator` | passage, citation | As recorded on that record |
| `citation` | citation | `key?`, `source?`, `quotation?`, `sentence?` as recorded |
| `quotation` | report quotation | `cites`, and `note?`, `corrections?`, `italic?`, `keep_hyphens?`, `checked?` as listed. None is applied to source text |
| `passages` | citation, report quotation | Pointers, in order: `passage`, `join?`, `join_note?`. The passage views are separate; nothing of them is copied |
| `source_text` | passage | `id`, `method`, `level`, `recognition?`, `note?`, `paged`, `coverage`, `coverage_note?` |
| `segments` | passage, only when `highlighted` | One for each page or section, in reading order: `index`, `place`, `stream`, `printed_label?`, `label_status`, `label_basis?`; `before`, `quoted`, `after`, already cut; `trimmed_before?`, `trimmed_after?`; `quality` (`method`, `level`, `note?`); `comparisons[]`; `reviews[]` |
| `original` | passage | From the source file's `original` (CONTRACT-007 C) |

The `quoted` pieces of a passage's segments, joined with line feeds, are exactly
the passage's `quote.exact`. A page's text is given in each passage view that
lies on it.

**States.** Segments, and any highlight, exist only for `highlighted`.

| State | Meaning |
|---|---|
| `highlighted` | All the conditions below hold |
| `changed` | A page's text digest or the words at the address no longer match |
| `no_source_file` | The passage names no source file the project can read as one |
| `damaged_file` | The source file is damaged or breaks a rule, so its text is not used |
| `invalid_anchor` | The address is malformed, out of range, not one continuous stretch, names a file of another source, or the passage record breaks a rule |
| `no_passage` | A citation with no passage, or one naming no readable passage record |
| `citation_differs` | A citation, or report quotation, that disagrees with its passage |
| `retired` | The record, the passage, its source file, or its source is retired. Command line only |
| `not_exported` | Left out of an export by its size cap |

A passage is `highlighted` only when it is not retired and breaks no record rule;
its source file exists, is not retired, is intact, and its `source` is the
passage's `source`; its address is one continuous stretch of one stream, with
each offset in range; every page's digest matches; and the address gives exactly
`quote.exact`. A citation is `highlighted` only when its passage is, its
`quotation` equals the passage's words in the rendered form that
`passage capture` writes (CONTRACT-002 G), its `locator` equals the passage's,
and its `key` (and `source`, when it has one) names exactly one source in effect
that is the passage's source or a part of it (`part_of`). A report quotation is
`highlighted` only when every one of its passages is and `cites` names such a
source. When a citation's or quotation's state is not `highlighted`, nothing is
highlighted for it, whatever the passage's own view shows. A citation takes the
state of a passage that is not highlighted.

**Quality.** A segment's `comparisons` are the comparison runs of that source
file whose digest for that page still matches: `run`, `method`, `against`,
`independent`, `agreement_permille`, `words`, `differing_words`. Its `reviews`
are text reviews, of scope `whole_page`, `page_number`, `quotations`, or
`passage` (this passage), that list that page and whose page digests all still
match. A person's review gives `review`, `scope`, `outcome`, `against`, and its
flags for that page. A model's or software's review is given only when it flags
that page, and then only as flags, with no outcome. None of these is proof.

**Original.** `form`, `page_count?`, `description?`, `held_at?`,
`obtained_from?`, `acquired_at?`, `version?`, and `files[]`: `sha256`, `size`,
`media_type`, `index?` (a page image), and `upstreams[]` (`record`, `url?`,
`retrieved_at`, `version?`) of the upstream records whose `sha256` equals the
file's. An upstream's auxiliary addresses are not originals. A file with an
`index` is given only for the pages the passage lies on;
`other_page_files` counts the rest. Every address and holding statement passes
the local-path rules of E.

**Source text bounds.** A part of a paged source is given whole, up to 20,000
code points on each side of the quoted piece. A part of a source with no pages
is chapter sized, so it is cut to 1,500 code points on each side. A cut is marked
`trimmed_before` or `trimmed_after`.

**The file.** `stemma.sourceviews.json` is `{"schema":
"stemma.sourceviews/0", "views": {<id>: <view>}}`: one view for each exported
citation and passage, except a `retired` one, counted as `SourceView`
`retired`. Report quotations are not records and are not in it. It is a derived
file under J: listed with its digest in the manifest and byte-identical for the
same data. The passage views that hold source text are capped at 8,000,000 bytes
in all, as written; citation views and views without text are not counted.
Those that a highlighted citation, or a highlighted report quotation of the
manuscript view (L), points to are kept first, then the rest, each in ID order. A view that does not fit is written as `not_exported` with no
source text, counted as `SourceView` `size_cap`, and warned
`source_views_cut`; the citation and the command line still reach it. Parts with
trimmed text are counted as `SourceText` `page_text_trimmed`.

**Showing it.** The host page shows a panel beside the record browser when the
route is a Citation or Passage record. It renders text nodes only. Each piece of
text is isolated (`dir="auto"` and `unicode-bidi: isolate`), and bidirectional,
format, and control characters other than line feed and tab are shown as visible
code points. The highlight is a `mark` element. An address is a link only when
its scheme is `http` or `https`, with `rel="noreferrer noopener"`; nothing is
fetched or preloaded, and the content security policy (D) is unchanged. The panel
does not open originals.

### L. The manuscript view

`stemma.manuscript.json` (`stemma.manuscript/0`) is the assembled report
(CONTRACT-006 I) as the export read it, for reading in the page and opening its
sources. It is derived, never read back, holds no time or machine value, and is
listed with its digest in the manifest.

**What is read.** `report/report.json` and the template its `manuscript` names:
the directory `build report` uses when none is named. Other report directories,
the generated `report.md`, `report.typ`, `report.pdf`, and `verification.md`,
and the files under `manuscript/` are not read. The template name is a relative
path that stays inside `report/`. It, `report.json`, and each directory on the
way are read only when they are plain files and directories, never links.

**Made by the builder.** `publish` assembles the report once, into the segments
from which `build report` writes `report.md`: for each block, text, quotations,
and note references; for each note, its citations in order and its comment. The
view is made from the same assembly. citeproc-js formats the citations and
bibliography again (CONTRACT-006 G) and gives the source IDs of each
bibliography entry. No link comes from reading the Markdown output or from
matching text. Where `build report` would refuse a quotation, the view's
assembly collects why and goes on. `build report` is unchanged: it fails, and its
output for the same inputs keeps the same bytes. `graph` receives the view
through a port and does not import `publish`; `cli` composes them.

| Field | Holds |
|---|---|
| `schema`, `state`, `why?` | `state` is `none` (no `report/report.json`), `unavailable` (the report cannot be read; `why` says why), or `read` |
| `inputs?` | `directory` (`report`) and `template`, project relative |
| `blocks[]` | In order: `kind` `text` with `level?` (1 to 3, a heading) and `parts[]`, or `kind` `bibliography`, where the template places it |
| a part | `{kind: "text", text}`, `{kind: "quotation", id}`, `{kind: "note", number}`, or `{kind: "withheld"}` (a local path was left out). Text is the Markdown subset the Typst output reads: `*italic*` and bare web addresses |
| `notes[]` | `number`, `citations[]`, `comment?` (parts). A citation is `quotations[]` (quotation IDs, in order), `text?` (the formatted citation without the quotations before it), `withheld?` (why it has no text), `source?` (the cited source), `entry?` (the source whose bibliography entry lists it) |
| `quotations{}` | By quotation ID, for each one the report gives: `text?`, `italic?`, `changes[]` (how the report's text differs from the source text: corrections, joined words, join notes, and labels that are the author's statement), and `view`, a source view of `kind` `quotation` (K) |
| `bibliography[]` | In the formatter's order: `source?`, `text?`, `withheld?`, `places[]` (`note`, `citation`: every note citation listed under the entry, by its index in the note) and `quoted[]` (quotations of a work listed there, given in the text or a comment and listed by no citation: `quotation`, and `note?` or `block?`) |
| `works{}` | By source ID, for each linked source: `id`, `key?`, `title?`, `part_of?` |
| `problems[]` | Citation keys the formatter could not use, in words |

**Broken quotations.** A quotation's `text` is present only when `build report`
would give it and its view is `highlighted` (K), or was cut only by the size cap.
Otherwise the page shows a marker, the state, and why, and highlights nothing.
The view is not `highlighted` when the builder refuses the quotation for any
reason, a correction or italic that does not match included; such a view carries
`citation_differs` where K gives it no other state. A quotation that lists no
passage is `no_passage`: its citation still names the source and links to it. A
broken quotation's citation is formatted without a page.

**Disclosure (E).** The same rules apply as to the rest of an author export.

- A string that begins as a path on a machine is left out: a text part becomes
  `withheld`; a quotation's text, change, or reason, and a citation or
  bibliography entry formatted from a record that holds such a value, are
  replaced by a statement that they were withheld.
- Nothing rests on a record the export leaves out. A quotation whose passage or
  cited source is not an exported entity, or whose view would be `retired`, is
  `not_exported`, with no text, passage pointer, or recorded detail. A citation
  or bibliography entry of a source that is not exported has no text and no
  link.
- The export runs the coordinate scan over each block, note, quotation, change,
  citation, and bibliography entry, and warns `coordinates_in_manuscript`, naming
  the places; the file is written.
- A broken quotation or something withheld warns `manuscript_incomplete`, naming
  the places; a report that cannot be read warns `manuscript_unavailable`.
- A view whose file would exceed 8,000,000 bytes is `unavailable` instead, with
  that reason (a design assumption).

A passage view that the source views' cap left out (K) makes each quotation view
that rests on it `not_exported`.

**Showing it.** When the state is not `none`, the host page shows a control that
opens the manuscript, at the fragment route `#/manuscript`, in place of the
record browser. It says that this is the manuscript as the export read it, not
the printed PDF, and that originals are not opened yet. Text is rendered as text
nodes, isolated and with hidden characters shown as in K. `*italic*` becomes
emphasis and a bare `http` or `https` address a link as in K; in a quotation only
the italics its list entry names are applied. A quotation, a citation, and a
bibliography entry each open a pane at their own route. The pane shows quotation
views under the K rules with the components of the record's source panel, taking
passage views from `stemma.sourceviews.json`. A bibliography entry's pane
highlights nothing and lists its places. On a narrow screen the pane lies over
the lower part of the window and can be closed. The content security policy (D)
is unchanged and the page sends no request.

### M. The local server

`browse` (CONTRACT-002 B; ADR-012) serves the explorer to a browser on the same
computer. It serves the `author` audience only. This version has no search beyond
the limits of G, opens no original, and has no MCP surface.

**What is served.** The author export of B, E, F, J, K, and L, made in memory
from the record files by the same functions, with no size cap on source views or
the manuscript view, so no view is `not_exported` and no
`source_views_cut` warning is given. The `large_graph` warning is left out: the
served page does not load the graph. All other omissions and warnings are the
export's. Where the module's description or a warning tells the reader of an
export what to do with it, the served one says the same of a served page. arras's pinned static loader loads the module and graph in the server,
and its static client answers the reads. The page's `ArrasClient` forwards each
read; for `moduleQuery` it sends the module name, query text, and variables
unchanged, and gives arras the answer unchanged. The page folds search text
before that, as the offline page does. Nothing is written in the project, no
index is built, and `GraphStore` (H) is not implemented. An export directory is
neither read nor written.

**Processes.** The command holds the listener and the rules below. A child of it
holds one built snapshot and answers from it, so that the command can answer
while a rebuild runs. The child gets no secret and opens no listener. It ends
when the command ends.

**Surface.** Every request outside this table is refused. The target on the
request line is compared whole, as sent: nothing is decoded or resolved, and no
query string is accepted. No part of a request names or reaches a file, since
the three assets are held in memory.

| Method and path | Body | Answer |
|---|---|---|
| `GET /`, `GET /app.js`, `GET /app.css` | none | The page shell, script, and styles. They hold no project data |
| `POST /api/session` | `{"code"}` | `{"secret"}`, once |
| `POST /api/status` | `{}` | `{"state": "current" \| "rebuilding" \| "failed", "data_identity"?, "message"?}` |
| `POST /api/boot` | `{}` | Banner data and the manuscript view's state |
| `POST /api/arras` | `{"call"}` with `call` one of `version`, `viewer`, `meta`, `status`, `schemaCatalog`; or `{"call": "export", "request"}` | What arras's static client answers |
| `POST /api/query` | `{"module", "query", "variables"?}` | What arras's `moduleQuery` answers, or its refusal |
| `POST /api/source-view` | `{"id"}` | The source view of that citation or passage, or none. The ID is only looked up in the snapshot |
| `POST /api/manuscript` | `{}` | The manuscript view |

Each answer made from the snapshot is `{"data_identity", "result"}`. A refusal
is `{"error": {"code", "message"}}` with an HTTP status; a refusal under the
rules below holds no value taken from the request, and arras's own refusal
(`arras_refusal`) holds the message arras gives. No call writes anything; arras's write, journal, and SQL calls
are refused in the page as the static profile refuses them.

**Rules.** Each is tested.

1. The listener is bound to `127.0.0.1` only, on a port the system picks. A
   header that a rule reads and that comes more than once is refused, and so is a
   request that sends `Expect`.
2. Every request must carry `Host` exactly `127.0.0.1:<port>`; `localhost`, any
   other name, address, or port, or no `Host`, is refused. This stops DNS
   rebinding.
3. Every `POST` must carry `Origin` exactly `http://127.0.0.1:<port>`. A `GET`
   that carries an `Origin` must carry that one.
4. No answer carries a cross-origin permission header, and `OPTIONS` and every
   method other than `GET` and `POST` are refused, so a preflight fails.
5. Every `POST` must carry `Content-Type` exactly `application/json` and the
   header `X-Stemma-Request: 1`.
6. Every `/api/` call but `session` must carry the run's secret in
   `X-Stemma-Secret`. The secret is 256 random bits made at each start and is
   compared in constant time. No cookie is set or read, since cookies are shared
   between ports.
7. The page gets the secret only by sending a one-time code (256 random bits) to
   `session`. The code is accepted once, within 10 minutes of the start; after
   that it is refused. A wrong code uses nothing up.
8. The code reaches the browser in a file the command writes in a new directory
   of the system's temporary directory (directory mode 700, file mode 600). The
   file sends the browser to the server's address with the code in the fragment,
   which is sent in no request. The command opens the browser on that file, or
   prints the file's path for the author to open. So neither code nor secret is
   in a process argument, standard output, standard error, or a log; the server
   keeps no request log. The file is removed when the code is used or expires,
   and when the command ends. The secret is written to no file by Stemma.
9. The page removes the code from its address at once, keeps the secret in
   `sessionStorage` only, and sends it only as the header. When it cannot reach
   the server, other than because the page itself is being left, it drops the
   secret, shows nothing it loaded, and asks no more.
10. A request's headers may take at most 16 KiB and its body at most 64 KiB; a
    request must arrive whole within 10 seconds of its connection; at most 64
    connections are open at once, and each carries one request.
11. Every answer carries `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: no-referrer`, `Cache-Control: no-store`,
    `Cross-Origin-Resource-Policy: same-origin`,
    `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY`, and the
    content security policy `default-src 'none'; script-src 'self'; worker-src
    'self'; style-src 'self'; img-src 'self' data:; connect-src 'self';
    frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action
    'none'`. The served page is its own template: its script and styles are
    separate files, with none inline.
12. The server and its child make no outbound request.

**Freshness.** Data older than the record files is never presented as current.

- The inputs are those of the data identity (J) and the export: `stemma.json`,
  `rules.md`, and every file under `records/`, `sources/`, `manuscript/`,
  `research/`, and `report/`.
- Before it answers any `/api/` call but `session`, the server makes a stat scan
  of the inputs (name, kind, size, inode, and modification and change times, to
  about a microsecond where the system keeps it) that started after the request
  arrived. Calls waiting together share one scan.
- While the scan finds nothing changed, the answer is from the current snapshot.
- When it finds a change, every call but `status` is refused with
  `index_stale` (503) until a snapshot of the new files is current. When the
  data may be unchanged (the research files are the same set, and no file
  outside `research/` and `report/` came, went, or changed size), the child
  recomputes the data identity, and when that is unchanged the snapshot is kept.
  Otherwise a new child builds the whole export again.
- The scan a snapshot is compared with is the one made before its files were
  read, so a change during a build leads to another build.
- A build that fails leaves state `failed` with what is wrong; nothing is served
  from the earlier snapshot, and the next change to the inputs starts another
  build. A start whose first build fails ends the command.
- The page asks for `status` every 2 seconds, every 30 while it is hidden, and
  when it is shown again. When the state is not `current`, a data answer is
  refused or names another data identity, it takes down what it shows and says
  that the records changed and are being read again; when current again it loads
  afresh at the same route. A page that has had no confirmation for 8 seconds
  while visible, as after being hidden, covers what it shows until it has one.

**Lifetime.** The command runs until it is interrupted or terminated, or 60
minutes (`--idle-minutes`) pass with no accepted call. An open page keeps it
running. It then removes the launch file and ends its child.

**What this does not defend against.** A process that runs as the author can read
the launch file, the browser's storage, and either process's memory, as it can
already read the project. A browser extension allowed on the page reads what the
page shows. Another user of the computer can connect to the port and use up
connections; without the secret it reads nothing. The page notices a change or a stopped server at its next call, so an open page
can show what it last loaded for up to its polling interval, or 8 seconds after
it comes back into view; if another program took the same port within that
interval, the page would send it the ended run's secret and believe its answers.
Two writes to one input within the file system's time resolution that keep its
size can pass the scan unseen. On Windows the file modes of rule 8 are not
applied, and the temporary directory's own permissions are all that guard it.

## Precedence and Compatibility

- Versioning: the manifest schema, mapping, and port share this contract's
  version. The arras version is pinned; an upgrade regenerates the conformance
  data and reruns the load test.
- Precedence: record files, then CONTRACT-001, then this mapping. Where arras
  contracts differ from this text, arras governs what loads.
- Added types, properties, and manifest fields are compatible. Renaming a type,
  property, or relationship is not.
- Deprecation: exports are regenerated, so old export versions are not migrated.

## Error Semantics

| Condition | Outcome | Retry | Recovery Expectation |
|---|---|---|---|
| A record cannot be read, is a newer version, is a stray file, or breaks a rule (`record_invalid`) | Left out whole, counted, `records_left_out` warning; export written; exit 1 | no | Run `check`, fix, export again |
| A reference to a missing record or one of the wrong kind | No link; counted, `broken_references` warning; export written; exit 1 | no | Run `check`, repoint or remove |
| `stemma.json` cannot be read as an object or is a newer version, or `records/` or `sources/` cannot be listed | Exit 3 (`project_unreadable`); no export, since it would be wrong | no | Fix the file or directory |
| Name or key violates arras rules | `export_mapping_error`; no export | no | Defect in the exporter or schema |
| arras loader rejects the output | Export test fails; nothing is shipped | no | Fix the mapping |
| Withheld source material found in a reviewer export | Removed from generated files; anything that cannot be removed is a `package.leak` finding and a warning; export written | no | The author checks the named part before sending it |
| Restricted coordinate found by the scan | Warning with the location; export written | no | The author removes it or accepts the disclosure |
| Export stale | `graph status` exits 1 | yes | Re-export |
| `report/report.json` or its template cannot be read (L) | The manuscript view says why; `manuscript_unavailable` warning; export written; exit 1 | no | Fix the report, export again |
| A quotation `build report` would refuse, or something withheld (L) | Shown broken or withheld; `manuscript_incomplete` warning; export written; exit 1 | no | Fix the quotation or passage, export again |
| Coordinate-shaped text in the manuscript view (L) | `coordinates_in_manuscript` warning; export written; exit 1 | no | The author checks it before passing the export on |
| Source views exceed the size cap (K) | Export written without the text that does not fit; counted, `source_views_cut` warning | no | Use `excerpt` for those |
| `--out` names a path git would track, or another refused place (C) | Exit 5; nothing written | no | Use an ignored path |
| The output directory holds something with an export file's name that no export manifest there lists as its own (C) | Exit 5; nothing written or removed | no | Use another directory, or move it |
| A restricted location holds more than was released | Geometry left out; `restricted_in_project` warning; export written; exit 1 | no | Move the value to the restricted store |
| The installed copy lacks its page template | Exit 70; nothing written | no | Install Stemma again |
| `--audience reviewer` or `--chapter` in this version | Exit 2, not implemented: a partial filter could disclose withheld text | no | None yet |
| Graph beyond the measured size | Export succeeds with a warning and the counts | yes | Scope by chapter |
| Browser refuses to load | The page names the failing file or record | no | Re-export; report |
| A served request breaks a rule of M | Refused with a status and code; nothing is read from the snapshot | no | Open the page from `browse` |
| The inputs changed (M) | `index_stale` until rebuilt; the page says so | yes | Wait; the page loads again |
| A rebuild fails (M) | State `failed` with what is wrong; no earlier data is served | after a change | Fix the project; run `check` |
| The one-time code was already used or has expired (M) | The page says so and shows nothing | no | Stop `browse` and run it again |

## Examples

```text
stemma graph export --audience reviewer --out build/graph/reviewer
```

```json
{
  "records": [
    {"key": "att-2n8d5k0y7g4qv1xb6e9r", "properties": {"recordId": "att-2n8d5k0y7g4qv1xb6e9r", "stance": "partly_supports"}, "type": "Attestation"},
    {"relationship": "attestationEvidenceNote", "source": "att-2n8d5k0y7g4qv1xb6e9r", "target": "nte-9t1h6r3w8f2mz5pj7c4s"}
  ]
}
```

The fragment is illustrative and omits the endpoint records. A conformance test
exports a seeded corpus twice, compares bytes, loads the pair with the arras
static loader, checks that no structured restricted value is in the reviewer
output, and checks that a coordinate seeded in prose is warned about.

## Non-Normative Notes

- Rebuilding avoids a large generated file that would conflict on merge and go
  stale; the cost is one command before browsing a clone.
- Argument and geographic maps are Stemma projections of the same records. Their
  data files are defined with the maps solution design.

## Proof Status

| Element | Evidence | Not shown |
|---|---|---|
| Projection loads | The pinned 0.8.1 loader accepts the export of the worked example and of a synthetic project with every kind, field, and pair of linked types (44 types, 275 relationships) | A real author's project |
| Author export, `graph export`, `graph status` | Local tests: byte determinism, omissions, restricted geometry, invalid and unreadable records, local paths, refusals, files that are not an export's own, a fresh clone, and a run from the installed plugin | `reviewer` filtering; `--chapter` |
| Offline page | In headless Chromium on one macOS system (Apple silicon), from a local file with the network off: search, diacritic search, links in both directions, Back, reload, 150 links on one record, hostile record text shown as text, no request, no console error. axe-core reported no violation on the arras home, list, and record views it was run on, or on the Stemma banner | Other browsers, systems, and desktop hosts; keyboard and screen-reader use by hand |
| Scale | The stock static browser loaded 10,000 synthetic nodes in about 0.28 s and 100,000 in 2.5 to 2.9 s in an earlier feasibility test | This projection at that size, real note text; arras claims support for 1,024 nodes and 7.9 MB, past which an export warns |
| arras limits | Search types, 100 keys, 50 fields, 128 KiB of views, and no folding are tested against the pinned package (`tests/arras.test.ts` and the build spike) | Later arras releases |
| Source views (K) | Tests over invented sources for every state, and the worked example: 4 citations and 125 passages highlighted, 748,172 bytes of source views in a 2.7 MB page, of which about 212 KB is page text repeated for passages that share a page. A synthetic page at the cap (8.0 MB of source views, 9.2 MB in all, 450 passages) opened in about 0.13 s and showed its first citation in about 0.04 s, in headless Chromium from a local file on one macOS system (Apple silicon) | A real large project; slower machines and other browsers; right-to-left and complex-script page text; keyboard and screen-reader use by hand |
| Manuscript view (L) | Local tests over invented reports for broken, withheld, and hostile cases; the worked example's report (116 quotations, 80 note citations, and 19 bibliography entries all linked; 228,368 bytes, in a 3.0 MB page); headless Chromium from a local file on one macOS system (Apple silicon) | A real author's report; other browsers; keyboard and screen-reader use by hand |
| Local server (M) | Local tests of each rule against raw requests, the built command, and headless Chromium on one macOS system (Apple silicon), with a hostile page on another loopback port and a name mapped to this computer; the installed plugin served the worked example. Worked example: ready in 2.6 s, rebuilt in 2.5 s after an edit, 7 ms a call for the scan; the holding process used up to 0.9 GB while building and 0.1 GB after. Synthetic project of 5,000 sources (172,873 inputs, 79,020 entries, no report): ready in 31 s, rebuilt in 32 s after an edit, 11 s after a touch that changed nothing; the scan adds about 0.2 s to each call (a search took 0.25 s; the page opened in 0.9 s); the holding process used up to 9.4 GB while building and 1.5 GB half a minute after (its resident size still showed 11.6 GB) | Linux and Windows, where the launch file, the opener, and the file modes are untried; desktop apps and the system's real opener; other browsers; a real author's project; a computer with 16 GB or less; a network file system; keyboard and screen-reader use by hand; any outside security review |
| Maps | Argument and geographic views over synthetic data rendered quickly; a 300-claim map was unreadable without scope | Real data |
| `GraphStore`, preview data, sentence and map files, engine conformance | Design only; a one-file indexer rebuilt 25,000 synthetic records in about 1 s with a stable dump | All |

## Schema Basis

The module is a generated projection of the CONTRACT-001 UMF schema into the
subset arras reads (UMF core `0.10.0`, `umf.ddd` `0.1.0`, `arras.view`). It is
not a second authored schema. Losses: nesting, multi-target relationships, and
link data change shape as in F.
