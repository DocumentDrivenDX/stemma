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
    - CONTRACT-001
---

# Contract: Graph export and graph engine interface

**Contract ID**: CONTRACT-005
**Type**: library and file formats
**Version**: 0 (provisional; see Proof Status)
**Related**: ADR-002, ADR-006, ADR-008, FR-46, FR-62 to FR-68, FR-76

## Purpose

Defines the graph files generated from record files, how arras (the
DocumentDrivenDX graph application) reads them in a browser with no server
application, and the query interface shared by the disposable index and the
later graph engine.

## Scope and Boundaries

- In scope: export files, audiences, mapping, freshness, rebuilding,
  the reviewer comment file, the `GraphStore` port, arras compatibility, and
  upstream needs.
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

**The Stemma host page.** The plugin ships a page template, built with Stemma
from the host, arras, React, and their styles, with the licenses of that code.
An export fills three `application/json` script elements: the banner data, the
module, and the graph. Nothing is bundled on the author's machine. The page's
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
  research note, or standing rule. Each is counted.
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
  passage text.
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
`GraphStore` and the `ArrasClient` read calls. It opens no network listener, and
this version defines no HTTP surface.

### J. Derived view data

These files are generated with an export for the Stemma explorer. They are
derived, never read back, hold no time or machine value, and are listed with
digests in the manifest. Shapes are provisional and minimal; the explorer and
maps designs extend them in a later revision. The page computes no state or
filtering of its own.

The **data identity** is the SHA-256 of the corpus digest and then each
manuscript file's digest (SHA-256 of its bytes), in digest order, each followed
by LF; pages show its first 12 characters. `graph status` compares it, so a
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
| `--out` names a path git would track, or another refused place (C) | Exit 5; nothing written | no | Use an ignored path |
| The output directory holds something with an export file's name that no export manifest there lists as its own (C) | Exit 5; nothing written or removed | no | Use another directory, or move it |
| A restricted location holds more than was released | Geometry left out; `restricted_in_project` warning; export written; exit 1 | no | Move the value to the restricted store |
| The installed copy lacks its page template | Exit 70; nothing written | no | Install Stemma again |
| `--audience reviewer` or `--chapter` in this version | Exit 2, not implemented: a partial filter could disclose withheld text | no | None yet |
| Graph beyond the measured size | Export succeeds with a warning and the counts | yes | Scope by chapter |
| Browser refuses to load | The page names the failing file or record | no | Re-export; report |

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
| Maps | Argument and geographic views over synthetic data rendered quickly; a 300-claim map was unreadable without scope | Real data |
| `GraphStore`, preview data, sentence and map files, engine conformance | Design only; a one-file indexer rebuilt 25,000 synthetic records in about 1 s with a stable dump | All |

## Schema Basis

The module is a generated projection of the CONTRACT-001 UMF schema into the
subset arras reads (UMF core `0.10.0`, `umf.ddd` `0.1.0`, `arras.view`). It is
not a second authored schema. Losses: nesting, multi-target relationships, and
link data change shape as in F.
