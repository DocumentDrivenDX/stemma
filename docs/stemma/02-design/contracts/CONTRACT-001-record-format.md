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
**Related**: ADR-002, ADR-003, FR-6 to FR-14, FR-20 to FR-23, FR-32, FR-54, FR-62, FR-67, FR-68, FR-72, FR-73

## Purpose

Defines the files that make up a project's evidence graph: record layout,
identifiers, canonical form, digests, links, preserved legacy values, and
restricted coordinates. Any tool that reads or writes a Stemma project
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
| `.gitattributes` | `eol=lf` for the four paths above | yes |
| `.stemma/` | Derived index and reports | no |
| `build/` | Build outputs and graph exports (CONTRACT-005) | no, except as CONTRACT-005 allows |

The content store is a separate private directory that the author backs up. It
holds blobs (held copies, extracted text, original import bytes and files) at
`sha256/<first two hex>/<64 hex>`. The repository holds only their digests. It
is chosen by `--store-dir`, then `STEMMA_STORE_DIR`, then a per-user directory
keyed by `project_id` (location default is an assumption). A store inside a
git-tracked path MUST be refused.

Takeover and later fixes write only to `manuscript/` and records. Original
files are never changed.

Path fields that Stemma defines MUST be project-relative with `/` separators. A
record MUST NOT contain an absolute local path. Titles, names, and citation keys
MUST NOT form file names.

A preserved legacy value, such as a BibLaTeX `file` field, can hold a local path.
Assumption: when `LegacyField.value`, `LegacyBlock.text`, or
`LegacyEntry.entry_text` holds an absolute local path (a drive letter, a root or
home-directory path, or a `file:` address), the writer omits the plain field,
stores its exact UTF-8 bytes as a blob in the private content store, and records
the digest in `value_blob_sha256`, `text_blob_sha256`, or
`entry_text_blob_sha256`. Export reads the blob, so the same information is kept
(CONTRACT-003 C). Path detection can miss unusual forms.

### C. Record kinds and identifiers

A record ID is `<prefix><token>`, where the token matches `[0-9a-z]{8,40}`.
Tools SHOULD generate 20 random lowercase Crockford base32 characters. An ID is
assigned once, is never reused, and carries no meaning. The file name is
`<id>.json`.

| Kind | Prefix | Directory | Holds |
|---|---|---|---|
| `source` | `src-` | `sources` | The one official bibliography record per source: fields, rights, intake, admission |
| `agent` | `agt-` | `agents` | Person or organization |
| `capture` | `cap-` | `captures` | A held copy: hash and provenance |
| `extraction` | `ext-` | `extractions` | Versioned text, page map, quality |
| `passage` | `psg-` | `passages` | Anchor in one extraction, with typed locator |
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
| `resolution` | `res-` | `resolutions` | Saved resolver response |
| `import_batch` | `imp-` | `imports` | One legacy import |
| `confirmation` | `cnf-` | `confirmations` | The author's confirmation of source details against a stored page |
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
| Blob digest | Raw bytes; also the blob's store address |
| `content_sha256` (review) | Canonical form of the record without `review`, `created`, `changed`, `legacy`, and `x` |
| `claim_sha256`, `claim_text` | UTF-8 bytes of the claim's `text` |
| `passage_sha256`, `passage_text` | UTF-8 bytes of the passage's `quote.exact` |
| Sentence `sha256` | UTF-8 bytes of the sentence after each run of Unicode `White_Space` becomes one U+0020 and ends are trimmed; `text` stores that form |
| `SourceBinding.record_sha256` | Canonical form of an object holding the source's `type`, `subtype`, `title`, `contributions`, `issued`, `dates`, `bib`, `identifiers`, `relations`, `extents`, and `locator_label`, each if present |
| `SourceBinding.capture_sha256` | Blob digests of the source's non-retired captures, sorted |
| `ItemBinding.content_sha256` | For a source: canonical form of its current `SourceBinding`. For another record: its `content_sha256` as defined above |
| Corpus digest | UTF-8 lines `<path><TAB><digest>` LF, sorted by path code point, for every record file and `stemma.json` (record digest) and `rules.md` (digest of its text with LF endings) |

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

**Sources and captures.** `admission` records the author's decision on a source:
`candidate` until the author records one, then `admitted` or `rejected`. It
holds the decision as given: no check result, missing copy, or missing `rights`
withholds it. Each decision is also saved as a `decision` record, which keeps
the history; `admission` is the current value, and the latest `decision` by
`decided.at` sets it. A source's citations can be checked once it has a
non-retired capture with an extraction, whatever its admission (FR-9). A cited
source that is not `admitted` is counted with the unreviewed items in reports.
`intake` says how far intake got: `raw` (found text only), `parsed`, `resolved`
(matched by a saved resolution), or `confirmed` (details confirmed by the
author). No field gates model use: a project is for material that may be sent
to its model. `rights` records permissions and decides what is kept out of
reviewer outputs. `rights.unpublished` and `rights.community_restricted` are
`true`, `false`, or absent. Absent means the author has not said; reviewer
outputs treat an unstated flag as set (assumption). `bib[].name` and
`dates[].variable` use CSL (Citation Style Language) 1.0.2 variable names and
MUST be unique in their list. Names are in `contributions`, in order. `type` is
a CSL item type.

**Extraction and passages.** Extracted text is a blob. Re-extraction creates a
new extraction; an existing one MUST NOT be edited. `pages` maps zero-based file
page indexes to printed labels in segments. `position` counts Unicode code
points in the extraction text, `start` inclusive and `end` exclusive.
For a paged source, `page_spans` MUST give each file page's `start` and `end` in
that text, in the same units, so that page-range excerpts and page-bound checks
need no re-extraction. A segment with printed labels MUST carry `evidence`:
`printed_sequence`, `embedded_label` (confirmed by the author or agreeing with
the printed numbers), or `author_statement`. `metadata` holds the title,
contributors, date, and venue read from the held copy, each only when found;
`meta.source` compares with it.

`text_size` counts the bytes of the text blob, and `capture_sha256` MUST equal
the `sha256` of the capture the extraction names. An extraction of an
`application/pdf` capture MUST have `page_spans`; they are in page order, do not
overlap, and lie inside the text. Page-map segments MUST NOT overlap; an
`arabic` or roman segment has a `first_label` in that style, an `explicit`
segment one label for each of its pages, and an `unnumbered` segment neither.
`normalization_profile` `utf8-lf/0` removes a leading byte-order mark, turns CR
and CRLF into LF, and changes nothing else. In a text read or supplied under it,
each form feed (U+000C) ends a page; text after the last one is a further page
only if it holds something other than white space. The form feeds stay in the
text, outside every span. A plain-text copy without a form feed has no
`page_spans`.

A passage keeps `source_record_sha256`, the
source's `SourceBinding.record_sha256` when it was anchored. A
`locator.label` is a CSL locator term; `value` is the printed string
(`xii`, `12r`). Moving a passage to a new extraction leaves it unreviewed.

**Notes, claims, constructs, methods.** A note of type `extract` or
`paraphrase` MUST name at least one passage. A record is in effect from the
moment it is written until it is retired; nothing waits for approval. Records
that carry `review` are marked `unreviewed` or `reviewed`. The mark `reviewed`
applies while `review.content_sha256` equals the record's current content
digest. The author's own edits keep a record reviewed: a writer that applies an
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

**Confirmations.** When source details cannot be verified automatically, the
author MAY record a `confirmation`: which stored title page or equivalent was
checked (the capture, its file page indexes, and `page_basis`) and which fields
were confirmed. `confirmed.by.kind` MUST be `person`. It applies only while its
`source_record_sha256` and `capture_sha256` equal current values. Its absence is
reported. It states what the author said and is not verification or proof.

**Other feature records.** `plan` and `voice_profile` carry `review` as above.
`checkpoint_input` records an author's answer at a checkpoint; an unanswered
checkpoint stops nothing. `given.by.kind` MUST be `person`. An
`authorship_mark` applies to the exact `text` it holds; changed or unmarked text
is unmarked, never assumed human-written. An `ai_activity` is written for AI
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

**Takeover rounds.** `intake_item` and `round_choice` records are never edited.
There is no round or session record: remaining work is computed from failing
results and intake items that have no applicable choice, so stopping and
resuming needs no saved state. A `round_choice` names its action, what it
replaced, the affected claims, and the recheck results observed when it was
made. A stored recheck is history; current outcomes are always recomputed.
`remove` retires the citation and keeps the record. The latest choice by
`chosen.at` applies.

**Review comments.** A `review_comment` is untrusted text from outside the
project. It changes no claim. `claim_sha256` shows which claim text the
reviewer saw.

**Support records.** One record states one verdict for one claim and passage.
It is never edited. It is current only while `claim_sha256`, `passage_sha256`,
and `capture_sha256` all match. Staleness is computed and never stored.

**Annotations.** An annotation explains or dismisses one finding in reports. It
permits nothing, because no finding blocks anything. It binds `check` and
`finding_key` (CONTRACT-002) and at most one of:

- `sentence` and `source`, for a finding about a cited sentence;
- `item`, for a finding with no sentence about one record of any kind (such as
  a bibliography entry or an image): the record ID and its current item digest.

A finding with neither a sentence nor a record subject (such as
`build.uncommitted` or `package.leak`) binds only `check` and `finding_key`.

`effect` is `explain` or `dismiss`. An annotation about a near-match quotation
SHOULD hold `compared`: the cited text, the stored text, the match profile, and
the extraction. An annotation applies only while every bound value equals its
current value and it is not retired. `written.by` records who wrote it; a
`dismiss` takes effect only when `written.by.kind` is `person`. Which findings
can be dismissed is in CONTRACT-002. Annotations are listed in reports and the
disclosure. They record intent and are not forgery-proof.

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
| Blob absent from the store | Dependent checks are `unverifiable` | yes | Restore the blob |
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
- A support record is bound to the claim, passage, and capture digests, not to
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
