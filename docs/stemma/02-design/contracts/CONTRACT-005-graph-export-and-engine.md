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
  upstream needs, the local server's HTTP surface, and its MCP tools.
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
| A relationship field returns at most 100 keys | Large hubs need paging; the true count of a hub's links is not shown | The arras "Show more" lists the other type for the rest; all 150 links of a test record were reached in each direction |
| A query searches 20 types and resolves 1,000 records | Other types are not searched | Offline: 20 searched types (F); others are reached by type lists and links. Served: Stemma's search covers every type (M) |
| A search takes the first 50 matches per type in key order and lists at most 50 in all; a query is 2 to 200 characters and at most 6 words; no diacritic folding | Matches past 50 are not listed; random keys make which appear arbitrary | Offline: `searchText` and a folded query; type filtering. Served: Stemma's search, with a Search view that pages through every match (M). Upstream request |
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
| Search paging: an `offset` or cursor on `_search`, a next page in the browser, and true total and per-type counts | arras | FR-64 | No; the served page has its own Search view (M) |
| Result limit above 50 a caller can set, and a status line that states how many of how many are listed (0.8.1 says "the best 50 of each type" while listing at most 50 in all) | arras | FR-64 | No; the served page writes the numbers into the result's `text` |
| Ranking before the cut: 0.8.1 cuts each type to its first 50 matches in key order, then ranks | arras | FR-64 | No; offline only |
| Configurable query limits: 20 searched types, 2 to 200 characters, 6 words; one-character search for scripts without word spaces | arras | FR-64 | No; offline and in arras's box |
| A public way for a host to supply its own search, in place of recognizing the browser's query text | arras | FR-64 | No; an arras upgrade can change the query, and a test fails if it does |
| A true count for a relationship with more than 100 links, and paging of it without scanning the other type | arras | FR-64 | No |
| Several types per relationship end; readable link properties | arras contracts | FR-63 fidelity | No; projection works without them |
| A way to attach and save claim comments from a node page | arras extension point or Stemma view | Reviewer comments | Unknown until composition is tried |
| Claims for larger graphs, other browsers, Windows | arras, or Stemma evidence | FR-64, FR-75 | Support claims only |

Stemma MUST NOT keep a private fork of the arras connected-graph view.

### H. `GraphStore` port

The local server (M) does not implement this port and builds no index: it runs
arras's own static loader and executor over an export held in memory, and its
search reads that memory (ADR-012).

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

The **data identity** is the SHA-256 of these lines, each followed by LF:

1. the corpus digest;
2. for each file whose bytes the corpus digest does not pin, in path order,
   `bytes `, the SHA-256 of its bytes, a tab, and its path. These are
   `stemma.json` and each record file under `records/` that is read but is not in
   canonical form, and each file under `sources/` that is not UTF-8 or begins
   with a byte-order mark;
3. for each manuscript file, in path order, the SHA-256 of its bytes (or
   `unreadable` for one that is missing or cannot be read), a tab, and its path;
4. when the report is not read for more than a file's own bytes, `problem ` and
   the reason (L).

Each path and reason is written as a JSON string, so that no name can be read as
part of another line. The manuscript files are those under `manuscript/` and,
when the project has `report/report.json`, that file and the template it names
(L); when report.json names no template that may be read, its line has the path
`""`. Paths count because what an export shows depends on them: a chapter's ID is
its file's name, a misnamed chapter file is refused, and of two files that use
one citation ID the first in path order keeps it (CONTRACT-006). With no line of
parts 2 to 4, the identity is the SHA-256 of the corpus digest and LF. Pages show
its first 12 characters. `graph status` compares it, so a manuscript edit or
rename makes an export stale. Research notes are outside it: nothing in them is
exported, and only their number is, as an omission count.

**States as built.** `unreviewed` (a record that the check report counts as
unreviewed or not admitted: a cited claim, its attestations and evidence notes,
or a cited source; and any record carrying a review mark that does not apply,
CONTRACT-001 G and CONTRACT-002 B1), `retired_link` (a reference to a retired record),
`annotated`, and `open_finding`. The last two come only from checks whose inputs
the data identity covers and that read no tool version or saved lookup:
`record.valid`, `source.held`, `source.pages`, `source.labels`,
`source.footnotes`, `source.changed`, `cite.key`, `bib.uncited`,
`quote.present`, `quote.page`, `locator.extent`, `number.present`, and
`claim.complete`. The manifest names the checks left out. `support_missing`, `support_stale`, and
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
fetched or preloaded, and the content security policy (D) is unchanged. The
offline page opens no original and says so where one would be. The served page
shows the original page beside the text (M, "Originals"); that is no part of the
source view, which is the same in both.

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
the printed PDF; the offline page also says that it cannot show originals, and the
served page that they are shown beside the text, marked only as M allows. Text
is rendered as text nodes, isolated and with hidden characters shown as in K. `*italic*` becomes
emphasis and a bare `http` or `https` address a link as in K; in a quotation only
the italics its list entry names are applied. A quotation, a citation, and a
bibliography entry each open a pane at their own route. The pane shows quotation
views under the K rules with the components of the record's source panel, taking
passage views from `stemma.sourceviews.json`. A bibliography entry's pane shows
one quotation of the work in its source, as a quotation pane does, saying which
it is: the first in the order of its places, else the first quoted without a
citation of its own. It then lists every place, and the others open from the
list. When the report quotes nothing from the work, the pane says so and
highlights nothing. On a narrow screen the pane lies over
the lower part of the window and can be closed. The content security policy (D)
is unchanged and the page sends no request.

### M. The local server

`browse` (CONTRACT-002 B; ADR-012) serves the explorer to a browser on the same
computer. It serves the `author` audience only. Its search is Stemma's own, with
no result limit ("Search" below). It shows original pages beside source text
("Originals" below). N offers it to an agent over MCP.

**What is served.** The author export of B, E, F, J, K, and L, made in memory
from the record files by the same functions, with no size cap on source views or
the manuscript view, so no view is `not_exported` and no
`source_views_cut` warning is given. The `large_graph` warning is left out: the
served page does not load the graph. All other omissions and warnings are the
export's. Where the module's description or a warning tells the reader of an
export what to do with it, the served one says the same of a served page. arras's pinned static loader loads the module and graph in the server,
and its static client answers the reads, except arras's search query ("Search").
The page's `ArrasClient` forwards each read; for `moduleQuery` it sends the
module name, query text, and variables unchanged, but for the search query's
`limit`, and gives arras the answer unchanged. The page folds search text before
that, as the offline page does. Nothing is written in the project, no index is
built, and `GraphStore` (H) is not implemented. An export directory is
neither read nor written.

**Processes.** The command holds the listener and the rules below. A child of it
holds one built snapshot and answers from it, so that the command can answer
while a rebuild runs. The child gets no secret and opens no listener. It ends
when the command ends.

**Surface.** Every request outside this table is refused. The target on the
request line is compared whole, as sent: nothing is decoded or resolved, and no
query string is accepted. No part of a request names or reaches a file: the
assets and the data pdf.js asks for are held in memory, and an original is looked
for by a digest the snapshot records, in places the command was given
("Originals").

| Method and path | Body | Answer |
|---|---|---|
| `GET /`, `GET /app.js`, `GET /app.css` | none | The page shell, script, and styles. They hold no project data |
| `GET /pdf-worker.js`, `GET /pdfjs/pdf.worker.min.js`, `GET /pdfjs/openjpeg_nowasm_fallback.js`, `GET /pdfjs/jbig2_nowasm_fallback.js` | none | The pinned pdf.js worker and its two image decoders. They hold no project data |
| `POST /api/session` | `{}`, signed with the one-time code | `{"secret"}`, once; after that the refusal `code_used` or `code_expired` |
| `POST /api/status` | `{}` | `{"state": "current" \| "rebuilding" \| "failed", "data_identity"?, "message"?}` |
| `POST /api/boot` | `{}` | Banner data and the manuscript view's state |
| `POST /api/arras` | `{"call"}` with `call` one of `version`, `viewer`, `meta`, `status`, `schemaCatalog`; or `{"call": "export", "request"}` | What arras's static client answers |
| `POST /api/query` | `{"module", "query", "variables"?}` | What arras's `moduleQuery` answers, or its refusal; for arras's search query, Stemma's answer in its shape |
| `POST /api/search` | `{"text", "type"?, "offset", "limit"}` and nothing else | One page of Stemma's search ("Search") |
| `POST /api/source-view` | `{"id"}` | The source view of that citation or passage, or none. The ID is only looked up in the snapshot |
| `POST /api/manuscript` | `{}` | The manuscript view |
| `POST /api/original-page` | `{"text", "index"}`, a source file ID and a part's index | Which page of which original the part is, or why none is established ("Originals") |
| `POST /original` | `{"sha256"}` | The bytes of the original with that digest, or why they cannot be given ("Originals") |
| `POST /api/original-highlight` | `{"passage", "index"}`, a passage ID and a part's index, and nothing else | Boxes to draw on that page of the original, or why none is drawn ("Highlighting on originals") |
| `POST /pdfjs-data` | `{"name"}` | A character map or standard font of the pinned pdf.js, looked up by name among those held in memory |

Each answer made from the snapshot is `{"data_identity", "result"}`. The
successful answers of `/original` and `/pdfjs-data` are bytes. A refusal
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
6. Every `POST` but `/api/session` must be signed with the run's secret, as
   "Proofs" below says, and its nonce is accepted once. The secret is 256 random
   bits made at each start. No request carries it. No cookie is set or read,
   since cookies are shared between ports.
7. The page gets the secret only from `session`, with a request signed with the
   one-time code (256 random bits). No request carries the code. The code is
   accepted once, within 10 minutes of the start. A request signed with it later
   is refused with `code_used` when the code was used, and `code_expired` when it
   expired unused, each proved with the code. A request not signed with it is
   refused with `code_refused`, without a proof, and uses nothing up. When the
   code is accepted, the command prints that the one-time link was opened, with
   the time on this computer, and what to do if it was not the author's page
   that opened it; with `--format json` this goes to standard error. It prints
   neither code nor secret.
8. The code reaches the browser in a file the command writes in a new directory
   of the system's temporary directory (directory mode 700, file mode 600). The
   file sends the browser to the server's address with the code in the fragment,
   which is sent in no request. The command opens the browser on that file, or
   prints the file's path for the author to open. So neither code nor secret is
   in a process argument, standard output, standard error, or a log; the server
   keeps no request log. The file is removed when the code is used or expires,
   and when the command ends. The secret is written to no file by Stemma.
9. The page removes the code from its address at once and keeps the secret in
   `sessionStorage` only. It signs with both and sends neither. When it cannot
   reach the server, other than because the page itself is being left, or an
   answer's proof is missing or wrong, it drops the secret, shows nothing it
   loaded, says that the server has stopped, tells the author to close the tab
   without reloading it, and asks no more. On `code_used`, when it has no secret
   already, it says that another page or program opened the link first, that
   unless that was the author another program may be reading the records, and to
   stop the command before running it again. On `code_expired` it says that the
   link expired.
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
    'none'`, which the pdf.js worker's script carries too. The one exception is a
    successful answer of `/original`, which is never to be a document or script:
    `Content-Type: application/octet-stream`,
    `Content-Disposition: attachment; filename="original"`, and the policy
    `default-src 'none'; sandbox; frame-ancestors 'none'`, with the other headers
    above. The served page is its own template: its script and styles are
    separate files, with none inline. No part of this policy is loosened for
    originals: nothing is evaluated, WebAssembly included, and no `blob:` or
    other address is added.
12. The server and its child make no outbound request.
13. A request's cost and answer are bounded. A search reads each entry's search
    text once, for at most 16 words of a text of at most 200 code points, and
    lists at most 200 entries (500 in arras's shape). An answer to `query`,
    `arras`, or `search` is at most 8 MiB; a larger one is not sent, and the call
    is refused with `answer_too_large` (422). arras's own limits bound its other
    queries. A source view and the manuscript view have no size cap: they are as
    large as the records make them, and a request gets at most one. An original
    is at most 256 MiB, at most two are held in memory at once, and others wait;
    an answer with an original that is not taken within 120 seconds is ended.

**Search.** The server searches every entry of every type in the served graph.
An entry of a searched type (F) is searched by its `searchText`; every other
entry by text made the same way from its heading and its own words, which no
export file holds. The same function makes both, from the same fields, so
nothing an export leaves out is searched.

- A search takes a text of 1 to 200 code points as sent, which is folded under
  `search-fold` and split at spaces into at most 16 words, and at least one.
- An entry matches when every word occurs, as a run of characters, in its search
  text. An entry whose record ID is the whole folded text, ignoring case, matches
  too, and comes first.
- Other matches are ranked by the sum over the words of: 4 when the word starts
  a word of the heading, 3 when it is elsewhere in the heading, 2 when it starts
  a word of the search text, and 1 otherwise. A word starts at the start of the
  text or after a space. Equal ranks follow type declaration order, then key by
  code point. The order is total, so for one snapshot the pages of a search
  neither repeat nor skip an entry.
- `/api/search` answers `text` (as folded), `total` (matches of the asked type,
  or of all types), `all` (matches of all types), `counts` (for each type with a
  match: `type`, `label`, `count`), `searched` (`entries` and `types`),
  `offset`, and `hits`, each with `rank` (from 1), `type`, `type_label`, `key`,
  `label` (the heading), and `excerpt`. An excerpt is at most 160 code points of
  the search text, which is folded and so in lower case and without diacritics,
  as parts each marked as matched or not; an entry found by its ID alone has
  none. `offset` is a whole number from 0, `limit` from 1 to 200, and `type` a
  type of the graph. Anything else is refused with `bad_request`.
- Scripts written without spaces between words (Chinese, Japanese, Thai, Lao,
  Khmer, and others): no words are separated, so a run typed without spaces must
  occur unbroken, and runs separated by spaces must each occur. A single
  character can be searched. The ranking's word starts are only the spaces and
  starts the text has. Arabic vowel signs, Hebrew points, and Latin and Greek
  diacritics are ignored, as `search-fold` defines; marks of other scripts are
  not.
- Not searched, since no entry holds it: source page text beyond what passages
  quote, manuscript files, research notes, standing rules, retired and left-out
  records, and what the export omits. The page says so.

**arras's search box.** The server recognizes exactly the search query of the
pinned arras and answers it from the same search, in arras's result shape. The
page sets that query's `limit` to 200 (arras asks for 50). `counts` holds the
true number of matches of each asked type, with `atLeast` false, so arras's type
chips show true totals, and `notSearched` is empty. When more entries match than
are listed, `text` says so with both numbers and names the Search view, and
`truncated` is false, because arras's words for a cut answer ("the best 50 of
each type") would be untrue. When the search is outside what arras itself
accepts, arras's refusal is given. Any other query that names `_search` is
refused, so that no search falls back to arras's limited one unseen. arras's box
still takes 2 to 200 characters and at most 6 words.

**The Search view.** The served page has a Search view beside the record browser,
with its own routes, `#/search` and `#/search/<type or all>/<page>/<text>`. It
shows the true total, the count for each type, 50 matches a page in rank order
with their rank numbers, and moves to the first, previous, next, last, or any
numbered page, so every match is reached. Each result opens its record in the
record browser, and Back returns to the same page of results. The text is in the
fragment, which no request carries, and so is in the browser's history. The view
takes the text last typed in arras's box when opened from the record browser.
The offline file has no Search view.

**Links and lists.** Every link of a record is reached through arras unchanged:
a relationship shows the first 20, "Show more" shows up to 100, and then
"Show more" reads the rest of that relationship from the other type, 100 at a
time, until none is left; arras counts such a relationship as "100 or more". A
type's list is read 50 at a time with "Show next 50" to its end. The
neighbourhood picture draws only some of a record's links; the lists beside it
hold all.

**Originals.** Beside the highlighted text of each page a passage lies on, the
served page shows that page of the original: a page of a PDF, drawn by the pinned
pdf.js, or the page image. This is so wherever a source view is shown: the record
panel, and a manuscript quotation, note citation, and bibliography entry (L). The
original is marked only as "Highlighting on originals" allows. Otherwise it is
**not highlighted**, and the page says so beside it, with why: the highlight is
then in the converted text only. When the original cannot be shown, the page says
which of these is so and why, and the text stays: the offline file; a physical
original; a type that is not shown (a TIFF image included, which is not
converted); no page established; not held; changed (the digest does not match);
too large; or it could not be drawn.

- **Which page.** The server applies CONTRACT-007 C to the source file as the
  snapshot holds it. `/api/original-page` answers `state` `pdf` (`sha256`,
  `size`, `page` counted from 1, and `page_count`), `image` (`sha256`, `size`,
  `media_type`), or `none` (`reason`: `physical`, `unsupported_type`, or
  `no_page_mapping`), with `why` in words. A view with no highlight has no page.
  No page is worked out any other way.
- **Where a file is looked for.** Only at `.stemma/originals/<sha256>` in the
  project, and in the files and folders named with `--originals`. Nothing else in
  the project is looked at, and no recorded address is ever fetched. No symbolic
  link is followed: `.stemma`, `originals`, and the file in it must be plain
  directories and a plain file, a named path that is a link is not looked in, and
  no link met inside a named folder is followed. Names inside a named folder that
  begin with a dot are passed over. Only files of the recorded size are read, and
  one search looks at no more than 100,000 entries.
- **The bytes served are the bytes hashed.** A file is opened without following
  a link, checked to be a regular file of the recorded size, read whole into
  memory, and hashed; those bytes in memory are sent only when their SHA-256 is
  the one asked for. A file that was swapped or edited gives other bytes, which
  are not sent. Where it was found is remembered only as a place to look first.
- **What is served.** `/original` gives a digest only when a source file in
  effect and usable in the snapshot records it among its original's files, as a
  PDF, PNG, or JPEG. Refusals, each proved, hold no path and no value from the
  request: `unknown_original` (404), `original_unsupported` (415),
  `original_too_large` (422, from the recorded size, before anything is read),
  `original_not_held` (404), `original_changed` (409: the file at the cache's
  name for the digest, or a file of the recorded size in a place looked in, holds
  other bytes), and `index_stale` as for any call.
- **Proofs.** The bytes of `/original` and `/pdfjs-data` are proved as every
  answer is. The page gives pdf.js, or draws, no byte before its proof has been
  checked, and checks too that an original's SHA-256 is the one it asked for.
  `/pdfjs-data` reads no snapshot, so it makes no scan.
- **pdf.js's own code** is a script of the page, with the same limit as the page's
  script (see below). So that nothing of it is asked for later, when another
  program might hold the port, the page starts the one worker as it loads, which
  loads the worker and both decoders then, and it never starts another. If that
  worker fails or stops answering, originals from PDFs cannot be drawn until the
  page is loaded again from a running server.
- **Drawing.** A PDF is given to pdf.js as bytes, never as an address, and never
  to the browser's own PDF viewer. XFA is off, nothing is evaluated (the policy
  forbids it, and WebAssembly is off, so the JavaScript decoders are used and
  embedded color profiles are not applied), pdf.js's scripting engine is not
  shipped or loaded, no font is installed in the page and no system font is used,
  and pdf.js fetches nothing itself. Only the page's own content is drawn, on a
  canvas: no annotation, form field, or link layer is made, so links are inert,
  and no attachment is read. A PDF whose page count is not the recorded one shows
  no page. A canvas is at most 16 million pixels, an image over 100 million
  pixels is not decoded, and drawing is given up after 60 seconds.
- **Page images.** The bytes must begin as the recorded type does, and the size
  stated in them must be at most 100 million pixels. They are decoded by the
  browser's image decoder (`createImageBitmap`) and drawn on a canvas: no image
  address is made.
- **What is shown is the whole file's page.** An original can show what the
  source text and an export leave out, such as a download stamp that names a
  person, or a restricted position. It is shown on the author's computer only,
  and no export holds it.

**Highlighting on originals.** A box on an original is a claim that the quoted
words are there. A wrong one is the worst failure this page can have, so every
doubt draws nothing, and the page says why. The text beside it stays highlighted.

- **Who decides.** Only the server decides. The page matches no text, reads no
  text layer, and works out no position: it draws the boxes the server gives, or
  none.
- **What is asked.** `/api/original-highlight` takes a passage ID and a part's
  index. Both are only looked up in the snapshot. The passage's view must be
  `highlighted` (K) and have a segment on that part, and the record must establish
  that the part is a page of a PDF (CONTRACT-007 C). A page image holds no word
  positions, so it is never marked.
- **The same bytes.** The server finds the original as `/original` does, and reads
  only bytes whose SHA-256 it has just found to be the recorded one. The answer
  names that digest, page, and page count, and the page draws boxes only over a
  drawing of that page of that digest.
- **Text equality.** The server reads that one page again with the pinned pdf.js,
  by the same code that converts a PDF: no compatibility folding, download stamps
  removed, lines without ink dropped, control characters made spaces. The page's
  text is those lines in the order the file gives them. The part's text is every
  line of every block of the source file's part, in file order, with annotation
  tags removed, the words and note markers inside them kept, and escapes decoded.
  The two must be equal, character for character. Nothing is folded, trimmed,
  reordered, or matched approximately, so an edited or corrected part, a
  transcription that differs, and a page whose columns the converter reordered
  get no box. The quoted words are then found by their recorded offsets in the
  part, never by search.
- **Positions.** Boxes come from the page's drawing operators, not from the text
  layer's word list. Every non-space character of the page's text must come, in
  order, from a glyph the operators draw: the two sequences must be equal for the
  whole page. Glyphs that begin off the page, which pdf.js's text content leaves
  out, are left out by the same rule as its own. Each quoted glyph's box is its advance width and its outline.
  As a cross-check, each quoted glyph must lie on the baseline of, and within, the
  piece of pdf.js's text content that holds its character.
- **Drawn to be seen.** A quoted glyph must be filled (text rendering mode 0) in
  a dark color, fully opaque, in normal blend mode, at least 4 units high, inside
  the page and inside every clipping rectangle, with an outline that lies within
  its advance width. Nothing else may be painted where a box lies, before or
  after: an image, a path (a white fill painted before the text excepted), a
  shading, or other text. Other text counts by its advance width, and by all its
  shape reaches where that is not about its width. The operators the server knows are listed in its code;
  a page with any other, with a transparency group, a soft mask, optional content,
  a Type 3 font, a text clipping mode, or a non-rectangular clipping path that
  reaches a box, gets no box.
- **Symbol fonts.** No box is given for a quoted glyph of a font whose name holds
  `Symbol`, `Dingbats`, `Wingdings`, or `Webdings`, in any letter case, whose
  shapes are signs whatever letters the text layer gives them. The name decides
  whether or not the file gives the font a `ToUnicode` map: pdf.js does not say
  whether it did. For the same reason the font descriptor's "symbolic" flag is
  not used: fonts embedded in part carry it as a rule (25 of 26 fonts in local
  Typst and browser-made PDFs and fixtures), almost any born-digital page would
  be refused, and which of them lack a map cannot be told. A font whose name
  merely holds such a word is refused with the rest.
- **Annotations.** Neither drawing of the page shows annotations, but other
  viewers do. So no box is given where a box meets the rectangle of any
  annotation that may be seen, on screen or in print, with or without a stored
  appearance, since viewers draw many kinds without one: a shape, a stamp, a
  note, a text box, a form field, or a reader's own highlight. Only an
  annotation flagged hidden, or not shown on screen and neither printed nor able
  to be turned on, is left out. A link, or a note's window, with no stored
  appearance shows nothing over its area. A link's border is lines: it counts
  when it has a color and a width and, at a width of 1 or less, its top or bottom
  line meets the quoted words' middle; when wider, any of its lines may; with
  rounded corners, its whole rectangle counts. The width is the stated one, also
  where pdf.js cuts it down. An annotation that pdf.js itself cannot read is not
  detected.
- **Unclear geometry.** No box is given for a rotated page; rotated, skewed, or
  mirrored text; vertical text; right-to-left text on a quoted line; a quoted
  ligature (one glyph for several characters); a quotation that joins, begins, or
  ends at a word split by a hyphen at a line end, a page break included; or a
  quoted glyph with no width.
- **A scan with a recognition layer gets no box.** Such a page shows an image, and
  its text is drawn invisibly over it (rendering mode 3). The positions are the
  recognition engine's estimate of where words are in that image. Nothing the
  server can check ties them to the image: the layer may be shifted, scaled, or
  made for another rendering of the scan, and its glyph widths are not those of
  the printed letters. Equal text shows only that the layer says what the source
  file says. So the page says that the only positions are a recognition layer's,
  and marks nothing. Showing them, labelled as such, is not done.
- **What the page checks.** Before it marks anything, the page checks in its own
  drawing that each box holds both dark and light pixels. A box that does not is a
  disagreement between the two drawings, and then no box is drawn. This check can
  only remove a highlight.
- **What the page says.** With boxes, it says that they are positions from the
  PDF's text layer, that the server read the page again, found its text equal to
  the source text, and found glyphs drawn there that the file's text layer names
  as those letters, with nothing detected over or under them, and that it cannot
  tell whether the printed shapes are those letters. Without, it says that the original is not highlighted, and why.
  The answer is `state` `boxes` (`sha256`, `page`, `page_count`, and `boxes`,
  each `left`, `top`, `width`, and `height` as fractions of the page as drawn) or
  `none` (`reason` and `why`). `why` holds fixed words, and no path or text from
  the file.
- **Bounds.** The page is read in a process of its own, which gets the file's
  bytes and the target, gets no secret, opens no listener, makes no outbound
  request, and writes nothing. It is ended when it has answered, and after 20
  seconds. One runs at a time; at most 8 requests wait, and a further one gets
  `none` with `reason` `busy`. A page with more than 300,000 operators or 100,000
  glyphs, or a highlight of more than 500 boxes, gets no box. Its memory is
  bounded: a few megabytes of PDF can unpack to gigabytes in under a second, and
  pdf.js unpacks them without yielding. A thread of its own, started before the
  page is read, looks at the process's resident memory every 5 ms and kills the
  process once it is over 1.5 GiB (1,610,612,736 bytes); without that thread
  nothing is read. The answer is then `too_much_memory`, as it is when the system
  kills the process. The peak passes the bound by what is taken between two
  looks: on one macOS system (Apple silicon), it was 1.75 GiB at most over files
  of 16 to 64 one-bit images that each unpack to 200 MB and content streams that
  unpack to 2 GB, where an unbounded reading of 16 images reached 4.0 GiB. An
  original of 255 MiB with a plain page needed 1.13 GiB. Only resident memory counts, not
  pages the system has compressed or swapped out. pdf.js's image size limit is
  not used: it would leave an image out, and one left out could be what covers
  the words. The original it
  reads counts among the two held at once (rule 13). The server keeps no result.
  The commands that convert an original read it in the same kind of process,
  under a bound of their own (CONTRACT-002 B, "Reading a PDF").
- **What this does not show.** That a glyph's outline looks like the character the
  file's text layer gives it: a font can draw one letter and name another, and the
  text, taken from that layer, then agrees with itself. That nothing in a way of
  hiding the operators do not show, such as a color the same as an unusual
  background that nothing painted, hides the words; the page's pixel check
  narrows this. Nor that the converted text is right: that is what comparing it
  with the original is for, and the highlight is where to look.

**Proofs.** Once a server stops, another program can take its port at once, and
an open page would reach it. So each side shows the other, on every `POST`, that
it holds a key, without sending the key.

- The key of `session` is the one-time code; the key of every other call is the
  secret. A key is the UTF-8 bytes of its base64url text. A MAC and a proof are
  HMAC-SHA-256 in base64url without padding.
- What is signed is a list of fields, each written as its length in bytes (4
  bytes, big-endian) and then its bytes, so that no two lists give the same
  bytes. Text is UTF-8. A body hash is the 32 bytes of the SHA-256 of the body
  as sent.
- A request carries `X-Stemma-Nonce` and `X-Stemma-Mac`. The nonce is the time
  it was made, in milliseconds since 1970, a dot, and 128 fresh random bits in
  base64url. The MAC is over: request tag, method, path, body hash, nonce.
- An answer carries `X-Stemma-Proof`, over: response tag, the request's nonce,
  path, status in decimal, body hash.
- The four tags are `stemma-browse-1 code request`,
  `stemma-browse-1 code response`, `stemma-browse-1 call request`, and
  `stemma-browse-1 call response`.
- The server compares a MAC in constant time. A header of the wrong shape is
  refused before the body is read; the MAC covers the body, so it is checked
  after the body, within the bounds of rule 10.
- The server accepts a call's nonce once, and only when its time is within 60
  seconds of the server's clock, either way. It remembers each accepted nonce
  until its time is older than that, and accepts none as old as one it has
  forgotten, even if the clock is set back. It remembers at most 50,000. Only a
  call signed with the secret is remembered, so nothing without the secret can
  use this memory, which stays within a few megabytes. When it is full, a signed
  call is refused with `too_many_calls` (503) rather than one forgotten that
  could still be sent again. The exchange needs no such memory: its code works
  once. A repeated or untimely nonce is refused with `replayed` (401), without a
  proof.
- Every answer to a request whose MAC held, a refusal included, carries a proof,
  except `replayed`. So every successful answer is proved. A refusal made before
  that carries none.
- The page gives each request a new nonce. It checks the proof, with WebCrypto's
  `verify`, over the status and the bytes received, before it reads any of them,
  whatever the status. This covers every answer it uses: the secret, status,
  banner, arras's answers over the module and graph, source views, and the
  manuscript, originals, and pdf.js's data. A proof therefore answers one request only: it fails for a changed
  body or status, another path, or another request. The page's script and styles
  are not covered (see below). WebCrypto is available because a browser treats a
  loopback address as a secure context.

**Freshness.** Data older than the record files is never presented as current.

- The inputs are those of the data identity (J) and the export: `stemma.json`,
  `rules.md`, and every file under `records/`, `sources/`, `manuscript/`,
  `research/`, and `report/`.
- Before it answers any `/api/` call but `session`, and `/original`, the server makes a stat scan
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

**What this does not defend against.**

- A process that runs as the author can read the launch file, the browser's
  storage, and either process's memory, as it can already read the project. If it
  reads the launch file and redeems the code before the author's page does, it
  gets in; the author's page and the command's output then show that the link was
  opened first (rules 7 and 9), but only after the fact. One that does so with
  `--no-open`, or before the author opens the file, is shown by the command's
  line alone until the author's page tries. If it reads the code and takes the
  port after the server has ended, before the author's page has redeemed it, it
  can answer that page as Stemma.
- The proofs are checked by the page's own script, which comes from the port
  unproved. If another program holds the port when the browser asks for the page
  itself, as when a tab is reloaded or restored after the server has stopped, or
  a launch file left by a command that was killed is opened, the page is that
  program's, and it can show anything as the author's records. It can read what
  the tab kept for that address: the ended run's secret, which opens nothing. A
  code it receives there opens nothing either, since the server that made it no
  longer listens. It can also leave things in the browser for that address, such
  as a service worker, which a later run given the same port would meet. The
  author should close a tab that says the server has stopped, and open only what
  a running `browse` opens.
- Another program on the port gets the body of each call the page makes before
  it sees that the answer is unproved, at most the calls already under way: a
  search's words, a query, or a record ID, never record contents, the secret, or
  the code. Their signatures open nothing: the server that took that key has
  stopped.
- Another program can still stop the page, by holding the port or by answering
  nothing.
- An original is a file from outside, parsed by pdf.js or the browser's image
  decoders. A flaw in either could do what the page can. The worker holds no
  secret, and the policy lets it connect nowhere but the server's own address,
  but it shares the page's origin: this is not a sandbox that holds against such
  a flaw.
- A hostile PDF can take much time or memory to draw, and stop other PDFs being
  drawn until the page is loaded again.
- A browser extension allowed on the page reads what the page shows.
- The secret crosses the loopback interface once, in the answer to the exchange,
  and record contents cross it unencrypted. A program able to capture loopback
  traffic, which needs administrator rights, reads them.
- Another user of the computer can connect to the port and use up connections;
  without a key it reads nothing.
- The page notices a change or a stopped server at its next call, so an open page
  can show what it last loaded from Stemma for up to its polling interval, or 8
  seconds after it comes back into view. Another program on the port cannot add
  to or change what is shown; one that answers nothing leaves it covered, not
  removed.
- If the computer's clock is set by more than 60 seconds while a page makes a
  call, or back past nonces already forgotten, calls are refused and the page
  says that the server has stopped.
- Two writes to one input within the file system's time resolution that keep its
  size can pass the scan unseen.
- On Windows the file modes of rule 8 are not applied, and the temporary
  directory's own permissions are all that guard it.

### N. The MCP server

`mcp` (CONTRACT-002 B; ADR-012, "Agents over MCP") offers the local server of M
to an AI agent over the Model Context Protocol (MCP). The host starts it as a
child process and exchanges messages with it on its standard input and output.
Its tools only read. It serves the `author` audience.

**Declaration.** The plugin manifest declares one server, `stemma`:

```json
"mcpServers": {"stemma": {"command": "sh", "args": [
  "-c", "<guard>", "stemma-mcp", "${CLAUDE_PLUGIN_ROOT}", "${CLAUDE_PLUGIN_DATA}"]}}
```

The guard is a constant script that holds neither variable. It takes the two as
its arguments, and unless both begin as absolute paths (`/…`, or a drive letter
and a separator) it says that they were not filled in and ends with 4, having
run nothing. Otherwise it replaces itself with
`sh "$1/scripts/stemma.sh" "$2" mcp`. The declaration names no project and sets
no environment.

**Why the guard.** A host may read this declaration and start it without
replacing the variables, and starts it in the session's directory. The plain form
`sh ${CLAUDE_PLUGIN_ROOT}/scripts/stemma.sh` would then be a relative path, and a
cloned repository holding a directory of that literal name would have its script
run at session start. Codex 0.150.1 did exactly this with a planted script
("Proof Status"). No form of the declaration may put an unfilled variable where
a shell or a host would read it as a path or as part of a script.

**Idle until asked.** A host starts the server in every session with the plugin,
whatever the session is about. Until a tool is called it downloads nothing,
creates and writes no file, opens no listener, starts no other long-lived
process, and reads no project file. The launcher does not fetch Bun for `mcp`,
does not create the data directory, and turns Bun's transpiler cache off. Only
protocol messages are written to standard output.

**Without Bun.** When the data directory holds no pinned Bun, the launcher
answers the protocol itself, in shell: the same tool list (from the file
`dist/mcp-tools.json` that the command line also reads), and for every tool call
a result saying that Stemma's one-time setup has not been run and how the agent
runs it. It repeats nothing from a request but its ID, and only an ID that is a
number or a short plain string. Once the pinned Bun is there, the next tool call
hands the connection to the command line, which answers that call and the rest.
A line over 64 KiB gets -32700 and is not parsed, and no more than one byte over
that is held of a line, ended or not. POSIX `read` has no such bound, so this
part runs in bash, to which the launcher hands itself when `sh` is another shell;
without bash it takes a `sh` whose `read` has `-n`, and otherwise ends with 4,
having read nothing. It parses in one process, which a kill ends whole.

**Protocol.** JSON-RPC 2.0, one message on each line. Answered: `initialize`,
`ping`, `tools/list`, and `tools/call`. Notifications are taken and not
answered. Any other request gets error -32601. The server offers tools only: no
resources, prompts, sampling, elicitation, or roots, and it asks the host
nothing. It answers `initialize` with the version the host asked for when it is
one of `2024-11-05`, `2025-03-26`, `2025-06-18`, and `2025-11-25`, and with the
last of these otherwise. A line over 64 KiB is not parsed (-32700). Tool calls
run one at a time; at most 16 wait, and a further one is refused. `ping` and
`tools/list` are answered while a tool runs.

**The project** is the session's. The command takes it from the environment
variable `CLAUDE_PROJECT_DIR`, which the host sets for the server's process, or
from `--project` on its own command line: that directory, or its nearest
ancestor that holds `stemma.json`. **No tool takes a project, a path, a file, or
an address.** Nothing falls back to the working directory, which is the plugin's
own. With no such variable, or no project there, every tool says what is so and
what to do, and does nothing else.

**Tools.** Each rejects an argument it does not name, a wrong type, and a value
outside its bounds, and then does nothing.

| Tool | Arguments | Does and gives |
|---|---|---|
| `status` | none | The project, or why there is none; whether its data is held (`not_read`, `reading`, `held`, or `failed`; it makes no scan, so it never says the data is current); whether the HTTP server runs, its address, and the times its one-time links were opened. It reads no project file but the presence of `stemma.json`, builds nothing, and starts nothing |
| `search` | `text` (1 to 200 code points), `type?`, `limit?` (1 to 20, default 10), `offset?` | M's search: `total`, `all`, counts by type, and hits with `rank`, `type`, `id`, `label` (at most 200 code points), and `excerpt` (at most 160, from the folded search text, so not for quoting) |
| `source_view` | `record`, a citation or passage ID | A bounded form of the source view (K): `state`, `why`, work, locator, and the citation's sentence and quotation; and for `highlighted` each page's place, printed label, quality, the quoted words, and at most 300 code points on each side |
| `open` | `record?`, a record ID | Starts the HTTP server of M if it is not running and has the system's browser open a new one-time link, at that record or at the start. Gives the address without a code or secret, the record's type and label, and whether the system took the file |
| `stop` | none | Stops the HTTP server, lets the held data go, and removes launch files and the lock. The MCP server goes on answering |

`search`, `source_view`, and `open` with a record look a value up in the
snapshot of M and nowhere else. A record ID that is not an entry of the
snapshot, whatever it looks like, is `unknown_record`, and nothing is opened. A
report quotation is not a record and has no tool.

**Data and freshness** are M's: the same child process holds the same snapshot,
built on the first call that needs it, and each call that reads it is preceded
by M's scan. While the files are read, a call waits up to 100 seconds and then
says to call again. A failed build gives its reason and no data.

**The HTTP server** is M, with every rule and proof unchanged. It starts only at
the first `open`. A later `open` uses the same server and the same secret and
makes a **new one-time code**: at most one code can be redeemed at a time, so a
new one ends an unused earlier one (which is then `code_expired`), and a used
one stays `code_used`. The code's launch file is rule 8's, one for each `open`,
removed when its code is used or ends. The launch address may name a record, as
`#code=<code>&to=explore/stemma/<type>/<key>`, built from the snapshot's entry;
`<type>` and `<key>` hold only letters, digits, `. _ ~ -`, and percent escapes
for everything else. The route is made and checked before anything is started (a
record no route can name is `no_record_route`), and the page goes there only when
the text has that form. If the system's opener
does not take the file, the code is ended, the file removed, and the result says
to use the `browse` command instead: **no result names a launch file**. At most
one `open` in 5 seconds and 30 in an hour are accepted. When the opener or any
other step fails after the server is listening, the code is ended, and a server
started by that call is stopped.

**Originals** are looked for only in `.stemma/originals/` in the project: no
tool takes a path, so no other place can be named. To show originals kept
elsewhere, the author's agent stops this server and runs `browse` with
`--originals`.

**One server for a project.** Before it listens, `mcp` and `browse` alike take
a lock: a file of mode 600 in `serve/` of the plugin's data directory (the
system's temporary directory when run without the launcher), named by the
SHA-256 of the project's real path. It holds the process number, the address,
the project path, the time, and a random mark of its holder, and **no code or
secret**. A lock is held while its process is alive and it was touched in the
last 90 seconds; the holder touches it every 10. A second server is refused, and
told the process and address. A lock that is not held is replaced. The holder
removes it when its server stops.

**Lifetime.** The HTTP server and the held data are let go after 60 minutes with
no accepted page call and no tool call that read the data. All of it ends when
the host closes the server's input or signals it.

**Results.** A result is one text item: Stemma's own words, then one JSON value
between a begin and an end line that carry a random token the value does not
hold, introduced as quoted data from the project's records and sources that is
not an instruction. Everything from a record, a source, or a file name is inside
it, JSON escaped, with hidden characters shown as visible code points. A refused
call is a result marked as an error, with a code and words. A whole result is at
most 32,000 UTF-16 units; one that would be longer is refused with
`answer_too_large`. A `source_view` gives at most 5 pages and 2,000 code points
of quoted words, over at most 20 passages; beyond any of these it gives no page text and says where to see it. A
cut label, sentence, or context ends in `…` and is marked; quoted words are
never cut.

**Incomplete data is said.** A `search` or `source_view` result carries the
code of each warning of the served data and how many records or files it names.
With records left out, the result says so in Stemma's own words for `search`.

**What a result may hold.** Only what the author export holds (E): no restricted
store value, local path, `legacy`, or `x`. A source view's record of the
original (where it is held, addresses, digests) is not returned. `rights` fields
filter nothing, as elsewhere (CONTRACT-001 G). Text goes to the agent's model,
so text that matches a recognized coordinate form (CONTRACT-002 C,
`coordinate.stray`) is withheld and said to be: a label, sentence, quotation, or
title that holds one; the excerpt of an entry whose search text holds one; and
all page text of a passage view whose pages, whole as the view holds them, hold
one. The browser shows it to the author. A form the scan does not know passes,
so this is a warning's filter and not a guarantee.

**Text that tries to instruct.** Source text can be written to read as an order
to the agent, and a tool result carries it to the agent. The most such text can
make these tools do is what their arguments allow: search and read bounded
pieces of this project, open the author's browser at this server at one of its
records (rate limited), and stop the server. No tool writes a record, runs a
command, reads a named file, or sends anything anywhere. The marking is not a
control on the model, and an agent steered this way keeps whatever other tools
its host gives it.

**What this does not defend against**, beyond M: the agent, which runs as the
author, can read a launch file and the project with its other tools; the skill
tells it not to touch launch files, which is an instruction only. Repeated calls
read the project a piece at a time into the agent's context, which `excerpt` and
file access already allow. A server that is killed outright leaves its lock,
which is then replaced, and may leave a launch file whose code opens nothing.
Whether a host asks the author before a tool call is the host's setting.

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
| An original cannot be shown (M, "Originals") | The page says which reason and why, and keeps the text | no | Name where the originals are with `--originals`, or none |
| A served answer would be larger than 8 MiB, or a search is outside its bounds (M) | `answer_too_large` or `bad_request`; nothing else is affected | no | Ask for less; use the Search view |
| The inputs changed (M) | `index_stale` until rebuilt; the page says so | yes | Wait; the page loads again |
| A rebuild fails (M) | State `failed` with what is wrong; no earlier data is served | after a change | Fix the project; run `check` |
| The one-time code was already used (M) | The page says that another page or program opened the link first; the command has printed when it was opened | no | Stop `browse`, then run it again |
| The one-time code expired unused (M) | The page says that the link expired | no | Stop `browse` and run it again |
| An answer's proof is missing or wrong (M) | The page shows nothing it loaded, drops the secret, and says that the server has stopped | no | Close the tab; run `browse` again |

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
| Local server (M) | Local tests of each rule against raw requests, the built command, and headless Chromium on one macOS system (Apple silicon), with a hostile page on another loopback port and a name mapped to this computer; another program taking a stopped server's port before and after the page has data, answering 200 with no proof, a made-up one, and a real answer repeated; real answers with a changed body; changed paths, statuses, and nonces and repeated requests against the signing code; the installed plugin served the worked example. Worked example: ready in 2.6 s, rebuilt in 2.5 s after an edit, 7 ms a call for the scan; the holding process used up to 0.9 GB while building and 0.1 GB after. Synthetic project of 5,000 sources (172,873 inputs, 79,020 entries, no report): ready in 31 s, rebuilt in 32 s after an edit, 11 s after a touch that changed nothing; the scan adds about 0.2 s to each call (a search took 0.25 s; the page opened in 0.9 s); the holding process used up to 9.4 GB while building and 1.5 GB half a minute after (its resident size still showed 11.6 GB) | Linux and Windows, where the launch file, the opener, and the file modes are untried; desktop apps and the system's real opener; other browsers; a real author's project; a computer with 16 GB or less; a network file system; keyboard and screen-reader use by hand; any outside security review |
| Originals (M, "Originals") | Local tests over invented PDFs and images: the page rule on every case and on the worked example's records (every part of its 14 source files is a page of its one PDF); links, swapped, changed, and unrecorded files; each refusal; headless Chromium from every place a source view appears, with each reason, a PDF with scripts, links, a form, XFA, and an attachment (no policy violation, other request, dialog, window, or download), JPEG 2000 and CCITT images drawn with every later script blocked, a character map, and changed answers. The installed plugin served an invented original and pdf.js's parts. One local run, not in the tests, with the worked example's own PDFs on one macOS system (Apple silicon): for one passage of each of the 14 source files, the passage's words were on the page the rule gives when that PDF was read again, and each page was drawn in 0.2 to 3.8 s from opening the passage, with no console message. The release grew by about 2.3 MB: the worker 1.33 MB, the two decoders 0.47 MB, and the served page's script from 0.42 to 0.94 MB | Other browsers, systems, and slower machines; PDFs of other kinds, very large ones, and those with embedded color profiles (not applied); a JBIG2 image in the tests (CCITT, which the same decoder reads, is tested); a JPEG page image drawn in the browser; Windows, which has no flag to refuse a link at opening; keyboard and screen-reader use by hand; any outside security review |
| Served search (M, "Search") | Local tests against a brute-force scan on a synthetic project of 150 sources, every substring of 1 to 6 code points of Latin, Greek, Arabic, Japanese, Thai, and hostile test titles, bounds, and headless Chromium (every page of a search, and all 260 links of a record in each direction). Synthetic project of 5,000 sources (79,020 entries of 14 types, 20 million characters of search text, one macOS machine): 400 queries gave the matches, counts, and order of a brute-force scan over all 38,690 pages (7.7 million listed matches, up to 78,441 for one query); 542 records of every type were found by ID, and 294 by words read from their record files. One page took a median of 13 ms in the process (95th percentile 22 ms, at most 62 ms; 60 ms for 16 words), and about 0.2 s through the server, nearly all of it the freshness scan. Preparing search took 0.12 s and 22 MB of heap at the start of each snapshot; against the previous version the holding process's footprint grew from 1.42 GB to 1.46 GB, half a minute after a build that took 30.3 s before and 30.8 s after. The largest page of 200 matches measured 431 KB. In the page: the Search view showed a first page in 0.3 to 0.8 s and another page in 0.2 to 0.3 s; arras's box showed 200 matches in about 0.8 s, its 0.25 s typing delay included, at up to 3,400 elements (500 matches: up to 8,200, and narrowing to one type took 0.44 s against 0.30 s); a chapter's 375 citations and 125 claims were all listed after 12 presses of "Show more", each 0.3 to 0.5 s | A real author's project; much larger projects; other browsers, systems, and slower machines; a record with thousands of links; keyboard and screen-reader use by hand |
| Maps | Argument and geographic views over synthetic data rendered quickly; a 300-claim map was unreadable without scope | Real data |
| MCP: how hosts start it (spike, one macOS system, throwaway profiles, a stand-in model API on 127.0.0.1 and no sign-in) | Claude Code 2.1.236 started a probe plugin's server from `plugin.json`, both through `claude mcp list` and at the start of a headless session (`claude -p`), before any tool call: it filled `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the arguments, set `CLAUDE_PROJECT_DIR` to the directory the session was started in (also a subdirectory of a git repository, not its root), used that as the working directory, had made the data directory, offered the tool to the model as `mcp__plugin_probe_probe__status`, and ended the server with SIGINT. A declared plugin dependency was still installed. **Codex CLI 0.150.1** read the same `mcpServers` from `.claude-plugin/plugin.json`, listed the variables unfilled, and in a session started the plain form from the session's directory, with its read-only sandbox: a script planted there under the literal name ran. With the guard, in the same setup, nothing ran, and Claude Code still connected. Anthropic's documentation says that claude.ai chat ignores local MCP servers and that Cowork loads them only for sessions on the author's computer (fetched 2026-11-27) | A tool call made by a real session's model; the desktop app; the interactive terminal; Cowork, claude.ai, ChatGPT desktop; Windows and Linux; how Codex shows the guard's refusal; later releases of any host |
| MCP server (N) | Local tests on one macOS system (Apple silicon) of the built command: quiet starts with and without a project (no file written, listener, or child process), each tool on the worked example with a stand-in opener, the project unchanged, the code and secret searched for in both outputs, process arguments, the lock, and the kept files, hostile arguments and lines, an invented source whose text gives orders and one that holds a coordinate, one server across two MCP processes and `browse`, endings by closed input, signals, idle time, and a call under way; the shell answers without Bun, and hands over when it appears; the declared command run with unfilled variables from a directory holding planted scripts. In headless Chromium, `open` led to the cited record's page. The install check ran the declared command from the installed copy: Claude Code 2.1.236 connected to it before setup, when it wrote nothing, and after; a test client got status, search, a highlighted source view, and with a stand-in opener an explorer at the record. Once, by hand, a headless Claude Code 2.1.236 session with the installed plugin in a throwaway profile and a stand-in model API connected to the server in 98 ms, offered its five tools to the model as `mcp__plugin_stemma_stemma__<tool>`, and ended it with SIGINT, leaving no process and no change in the data directory | A tool call chosen by a real model; the desktop app; the interactive terminal; the system's real opener from the server; Windows and Linux; a large project through the tools; any outside security review |
| Marks on originals (M) | Local tests on one macOS system: each refusal over invented one-page PDFs; the memory bound, with the reader's peak measured, on invented files that unpack to gigabytes (images and content streams); boxes compared with the pixels headless Chromium draws, over one invented layout with scaling, character and word spacing, narrowed letters, kerning, leading, and a raised run; the worked example's 125 passage segments, 6 marked and looked at by eye, measured before the refusals for symbol fonts and annotations and the memory bound | The worked example with those refusals and that bound; the bound on Linux (the tests measure it where they run) and Windows, and under memory pressure; legitimate pages that need more than 1.5 GiB; Fonts embedded in the many forms publishers use, beyond the two born-digital originals of the worked example; other browsers and systems; a font whose shapes differ from the letters it names is not detected |
| MCP: protocol module (spike) | The official SDKs bundle with no unresolved import: `@modelcontextprotocol/sdk` 1.32.2 installs 92 packages and a minimal tools server bundles to 530 KB; `@modelcontextprotocol/server` 2.4.0 installs 3 and bundles to 805 KB; each bundle holds a `new Function`. Stemma's own module is used (ADR-012) | Another host's protocol behaviour |
| `GraphStore`, preview data, sentence and map files, engine conformance | Design only; a one-file indexer rebuilt 25,000 synthetic records in about 1 s with a stable dump | All |

## Schema Basis

The module is a generated projection of the CONTRACT-001 UMF schema into the
subset arras reads (UMF core `0.10.0`, `umf.ddd` `0.1.0`, `arras.view`). It is
not a second authored schema. Losses: nesting, multi-target relationships, and
link data change shape as in F.
