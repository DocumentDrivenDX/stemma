---
ddx:
  id: stemma.data-design
  type: data-design
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.architecture
    - stemma.adr-002
    - stemma.adr-006
    - CONTRACT-001
    - CONTRACT-005
    - CONTRACT-006
  schemas:
    - id: stemma.record
      version: "0"
      title: Stemma records
      path: docs/stemma/02-design/contracts/schemas/stemma-record.umf.json
      schemaFormat: umf
---

# Data Design

## Data Summary

- Scope: storage for one author's project: the evidence graph, binaries, derived
  data, and their lifecycle. Shapes and rules are in CONTRACT-001; graph exports
  and the query port are in CONTRACT-005.
- Storage systems: record files in git, a separate private content-addressed
  store, a restricted store, a SQLite index, and generated outputs.
- Main concerns: one source of truth, deterministic rebuild, copyrighted and
  restricted material, large binaries, three operating systems.
- Data Architecture, the HELIX artifact for data pipelines, is not applicable:
  Stemma has no pipeline platform or medallion layers.

## Entities and Stores

| Entity or Store | Purpose | Key Fields | Volume / Growth | Notes |
|-----------------|---------|------------|-----------------|-------|
| Record files | The evidence graph and source of truth | `id`, `kind` (CONTRACT-001 C) | Hundreds of sources for a large humanities book (assumption); passages and links assumed in the thousands to tens of thousands | In git; one record per file |
| `stemma.json`, `rules.md` | Settings, trim size, and standing rules | `project_id`, rule IDs | One each | In git |
| `manuscript/` | Stemma's copy of the manuscript, marked-up Markdown (CONTRACT-006) | chapter ID file names | One book | In git; takeover and fixes write here, never to originals |
| Content store | Held copies, extracted text, original files and import bytes | SHA-256 | Gigabytes with scans and images (assumption) | Private, outside git; the author backs it up |
| Restricted store | Exact restricted coordinates | location ID | Small | Outside the project |
| Resolver responses | Saved network results that checks read | source, query, date | Per lookup | `resolution` records, in git |
| SQLite index | Disposable queries | record ID | Proportional to records | `.stemma/`, ignored |
| Reports | Latest check reports | corpus digest | Per run | `.stemma/`, ignored |
| Build outputs | PDFs, packages, build records | commit, report digest | Per build | `build/`, ignored; an author keeps releases deliberately |
| Graph export | arras module, graph, manifest, optional offline page | corpus digest, audience | Grows with records | `build/graph/`; never committed |

### What the repository holds

| Data | Committed |
|---|---|
| The graph as record files, settings, rules, manuscript text | Yes |
| Record excerpts of sources (passage quotes, note extracts) | Yes, inside records, so the repository is private material even when blobs are absent |
| Preserved legacy values | Yes, inside records |
| Held copies, full extracted text, original files | No; digests only. Preserved legacy values that hold a local path are also kept only there (CONTRACT-001 B) |
| Restricted exact values, and hashes of them | Never |
| Index and reports | Never |
| Generated browser graph, typeset outputs | Never; rebuilt when needed |

Record files are canonical. After a fresh clone, `graph export --audience author
--page` rebuilds the browser graph from the repository alone (CONTRACT-005 C).
An export is never edited or read back.

### Content store and large binaries

- Large binaries live in a separate private content-hash store. The repository
  holds references only, and the author backs the store up. Its location rule is
  in CONTRACT-001 B.
- A blob's address is the digest of its raw bytes: `sha256/<2>/<64>`.
  Blobs are immutable. A write goes to a temporary file, is verified, and is
  renamed into place.
- Records hold digests and sizes: captures, extractions, and import batches. The
  referenced set is the manifest of what a restore needs.
- Extracted and recognized text is stored as a blob and never regenerated in
  place, so checks read saved text even if a tool is later nondeterministic.
- Line-ending settings never apply to blobs.
- A missing or corrupt blob makes dependent results `unverifiable`.
- Removing a source retires records and keeps blobs. Stemma deletes no blob:
  `store verify --unreferenced` lists blobs that no record references, and the
  author may delete those files from the private store. A blob committed by
  mistake remains in git history until the history is rewritten.
- The `BlobStore` port is `has`, `get`, `put`, `verify`. `store verify`
  (CONTRACT-002) lists referenced digests that are missing or corrupt, which is
  how a restore on a clean checkout is confirmed (FR-59). Stemma moves no blob off the
  machine: copying the store to another machine or backup is the author's step.
  git LFS (Large File Storage) is not used.

## Relationships

Allowed target kinds for each reference are in the UMF schema's relationships.
The ones that shape storage:

| From | To | Type | Cardinality | On Delete |
|------|----|------|-------------|-----------|
| capture | source | held copy of | N:1 | RESTRICT: retire, flag dependants |
| extraction | capture | derived from | N:1 | RESTRICT; never edited |
| passage | extraction, capture, source | anchored in | N:1 each | RESTRICT |
| note | passage, source | reports | N:M, N:1 | RESTRICT |
| attestation | claim, note or passage | evidence with stance | N:1 each | RESTRICT |
| inference | claims or attestations; claim or inference | argument relation | N:M; N:1 | RESTRICT |
| citation | source, claims | occurrence | N:1, N:M | RESTRICT |
| round_choice | citation or intake item; sources; claims | author's resolution | N:1 | Kept as history |
| review_comment | claim | outside comment | N:1 | Kept; marked when claim text differs |
| support_record | claim, passage | saved verdict | N:1 each | Kept; becomes stale |
| annotation | sentence and source, one item of any kind, or only the finding | explains or dismisses a finding | N:1 | Kept; ends when bound content changes |
| confirmation | source, capture | author-checked title page | N:1 each | Kept; ends when bindings change |
| plan, ai_activity, audit_finding, governing, voice, image, and other feature records | chapters, claims, sources | CONTRACT-001 G | N:M | Kept |
| place records | place, evidence | sourced assertion | N:1, N:M | RESTRICT |

Deletion is retirement: no record file is removed by a Stemma command, so no
reference silently dangles. A file deleted by hand yields `reference_dangling`.

## Access Patterns and Constraints

| Access Pattern | Frequency | Performance Need | Supporting Index or Cache |
|----------------|-----------|------------------|---------------------------|
| Record by ID or citation key | Constant | Interactive | `record`, `source_key` |
| Changed records and dependants (FR-10, FR-31) | Each agent edit | Within the `check --changed` target | Digest comparison, reverse `link` closure |
| Uncited entries, incomplete claims, stale support | Each check | Seconds | `link` anti-joins |
| Search names, titles, claims, and optionally passages across scripts | Often | Interactive | Folded `search_text` |
| Evidence chain, argument and map subgraphs | Views | Interactive | `link` traversal |
| Full export | On request | Seconds | Ordered scans |
| Quotation matching | Each affected check | Bounded by cited sources | Extraction blob, per-run cache |

Logical index tables (internal; they may change with the index version):

| Table | Primary key | Content |
|---|---|---|
| `meta` | name | Index schema version, corpus digest, fold profile |
| `record` | id | Kind, relative path, record digest, canonical JSON, retired flag |
| `link` | source ID, field path, ordinal | Target ID and expected kinds |
| `source_key` | folded key | Source ID, alias flag |
| `search_text` | record ID, field | Text under `search-fold` |
| `problem` | path, code | Load errors |

A full-text virtual table may be built over `search_text`.

**Rebuild determinism**

- Input is only the record files, `stemma.json`, and `rules.md`. The index holds
  no fact of its own: no generated ID, sequence, or timestamp.
- Files are processed in path order by code point, never directory order.
- `index dump` writes each logical table in the order above, rows sorted by
  primary key by code point, one canonical JSON object per line, LF. It excludes
  full-text structures and anything machine specific.
- Two rebuilds, and an incremental refresh against a rebuild, MUST give equal
  dumps. Database bytes are not compared: they differed between runtimes, and on
  macOS Bun uses the system SQLite, so a Bun pin does not pin SQLite.
- Sorting and folding are Stemma code, not SQLite collations or tokenizers.
  `search-fold` is versioned; a version change forces a rebuild.
- Before a query, the corpus digest is compared with the indexed one. A
  difference refreshes the index or fails with `index_stale`. File times are not
  trusted as proof of sameness.
- A schema or fold version change deletes and rebuilds the index.
- Change flags and staleness also depend on inputs that are not references:
  citation keys, blob digests, rules, settings, and saved resolutions. The
  closure includes them.

A relational interface specification (UMF TableSpec per table) is omitted: no
other component reads these tables, and the `GraphStore` port is the interface.
The graph engine design revisits this if the schema becomes long-lived, as does
the `relational-data-modeling` concern.

Evidence: a one-file indexer rebuilt 25,000 synthetic records in about 1 s with
equal dumps across rebuilds and two runtimes on one macOS system. Full-text
search alone found 3 of 12 diacritic cases; a custom fold found 12 of 12 on six
seeded phrases. Hashing every record before each query, incremental refresh, and
other systems are unmeasured.

**Consistency**

- One writer: a project lock covers commands that write. Agent and hand edits
  bypass it, so every command validates what it reads.
- A multi-record command writes all files to a staging directory, validates the
  resulting graph, writes a journal of intended renames under `.stemma/`, then
  renames. An interrupted write is completed or rolled back at the next command.
  This is design only; atomicity across three file systems is unproven.
- After a git merge, `validate` reports duplicate keys, dangling references, and
  conflict markers. Correctness does not depend on a custom merge driver.

## Validation and Security

| Field or Data Type | Rules / Classification | Protection or Error Handling |
|--------------------|------------------------|------------------------------|
| All records | Schema and CONTRACT-001 rules | Reject on read; no partial repair |
| Record file names | Lowercase prefix and token | Safe on case-insensitive systems and Windows |
| Source text, library fields, manuscript text, resolver payloads | Untrusted data | Size limits, no execution, never instructions |
| Rights fields | Permissions, unpublished and community markers, each possibly unstated | Govern reviewer outputs; they do not gate model use |
| Source excerpts in records | Often copyrighted | Private repository assumed; left out of reviewer outputs apart from allowed short excerpts |
| Unpublished and community-restricted sources | Sensitive | Withheld from reviewer exports and reports |
| Source text quoted in check evidence | Often copyrighted | Classed `source_text`; redacted in any report that leaves the project (CONTRACT-002 E1) |
| Reviewer comment files | Untrusted | Limits, plain text only, writes only comment records |
| Restricted coordinates | Sensitive; only locations marked restricted | Outside store, no derived hash; the agent reads it only when a task needs exact values, which then reach its model; structured values excluded from outputs. Release and package scans warn of stray coordinates. Unmarked locations are public; other identifiers can still disclose a site |
| Place names and prose | Can disclose a site | Scan reports listed forms only; author review |
| Review marks, support records, annotations, confirmations | Records of what was said or judged | Not forgery-proof; applicability and staleness recomputed |

The restricted store is not encrypted by Stemma. Its protection is the author's
account and disk protection.

## Migration Strategy

- Tooling: a versioned `migrate` step in the command line, one per format
  increment; no database migration tool, because the index is rebuilt.
- Approach: a migration runs only on the author's request. `migrate --list`
  lists every file change and the review marks, support records,
  confirmations, and annotations that will end, and writes nothing;
  `migrate --apply` with that list's digest writes them (CONTRACT-002 B). A
  migration is deterministic and repeatable, needs a project whose records are
  valid, writes through the staged write above, and reports every changed file.
  Running it twice changes nothing. It preserves `legacy`, `x`, unknown fields,
  and IDs. It changes no blob, and it never rewrites a binding to keep one
  alive.
- Rollback: the author commits before migrating, and rollback is git. `migrate`
  warns when the tree is not clean. Older tools open newer projects read-only.
- Backfill or cleanup: takeover is an import (CONTRACT-003), not a migration.
  The move from the disposable index to the graph engine needs no data
  migration.

## Schema Basis

The record model is the UMF document named in `ddx.schemas`; CONTRACT-001 lists
reuse, local additions, limits, and validation evidence. The graph module is a
generated projection (CONTRACT-005). Index tables are internal.

## Cross-References

- Architecture: module ownership and ports.
- CONTRACT-001, CONTRACT-003, CONTRACT-005: exact shapes and rules.
- Data quality expectations: not authored; the check catalogue in CONTRACT-002
  is the executable rule set.
