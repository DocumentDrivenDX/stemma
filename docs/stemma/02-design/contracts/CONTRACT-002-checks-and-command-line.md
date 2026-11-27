---
ddx:
  id: CONTRACT-002
  type: contract
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.adr-003
    - stemma.adr-004
    - stemma.adr-010
    - CONTRACT-001
    - CONTRACT-007
---

# Contract: Check results and command line

**Contract ID**: CONTRACT-002
**Type**: CLI
**Version**: 0 (provisional; see Proof Status)
**Related**: ADR-003, ADR-004, ADR-005, ADR-009, ADR-010, FR-10, FR-29 to FR-34, FR-39, FR-49, FR-52 to FR-54, FR-61, FR-68, FR-73, FR-74, FR-75, FR-84 to FR-90

## Purpose

Defines the commands the author, the agent, and tests run, the check identifiers
and outcomes, the report and its label, and exit codes. Checks and builds find
problems and explain them. No finding stops a command, a build, or the author's
work.

## Scope and Boundaries

- In scope: invocation, commands, results, reports, exit codes, builds, report
  redaction, and the excerpt and support-record exchanges.
- Out of scope: matching algorithms and thresholds (verification solution
  design), manuscript reading (CONTRACT-006), record shapes (CONTRACT-001),
  legacy codecs (CONTRACT-003), skill behaviour (CONTRACT-004).
- Owning modules: `packages/cli` and `packages/core`.

## Normative Surface

### A. Invocation

`sh <plugin root>/scripts/stemma.sh <data directory> <command> [options]`

The launcher (CONTRACT-004 D) is how the skill and the tests of the installed
plugin run a command. It sets up the pinned Bun in the data directory when
absent (exit 4 if it cannot) and then runs
`bun --no-install --no-env-file --config=/dev/null <plugin root>/dist/stemma.js <command> [options]`.

- Observed on Bun 1.4.5 (macOS): a `bunfig.toml` in the working directory ran
  preload code and a `.env` there set a store variable, with or without
  `--no-install`. Files beside the script were not loaded. The full invocation is
  therefore
  `bun --no-install --no-env-file --config=/dev/null <plugin root>/dist/stemma.js`,
  and with those two added flags neither file was loaded. The launcher
  starts Bun with the plugin root as the working
  directory; callers pass `--project` and every path as absolute paths. A relative
  path given to a command is resolved against the project directory. A command
  started without `--no-install` exits 4; `doctor` warns when another of these
  flags is missing, since a preload has already run by then. The `/dev/null`
  form is untested on Windows. A test with seeded files covers SEC-014.
- Common options: `--project <dir>` (default: nearest ancestor holding
  `stemma.json`), `--format text|json` (default `text`), `--restricted-dir`.
- No command calls a model, and no result depends on which model or host runs
  the agent. Only `resolve`, `ingest --fetch`, `ingest --plan` entries with an
  address, and `research` fetches may use the network, and they send only the
  address or identifier and a user-agent naming Stemma and its version. Every
  other command MUST work offline.
- On a Bun version other than the pinned one, a command exits 4. It
  MUST NOT download a package while running.
- With `--format json`, standard output carries exactly one JSON document.
  Messages for people go to standard error.

### B. Commands

| Command | Effect | Step |
|---|---|---|
| `version` | Report the Stemma version and the pinned Bun version | M1 |
| `init` | Create `stemma.json`, `rules.md`, directories, `.gitattributes`, ignore entries (including the original formats of CONTRACT-001 B). Requires `--project`, because the documented working directory is the plugin root; overwrites nothing, and exits 5 if `stemma.json` exists | M1 |
| `record add <kind> --input <file\|-> [--actor <kind>:<name>]` | Add one record from a JSON object of its fields. A citation that names a `passage` gets its `quotation` and `locator` copied from it, and a quotation or locator typed beside `passage` is refused. Fills an absent `id`, `schema`, `kind`, `created` (then `--actor` is required), `admission` (`candidate`), `intake` (`parsed`, assumption), and a citation's sentence digest (normalizing that text). It never overwrites. A record that breaks a rule is still written, with its findings; input that is not usable JSON, an unsafe ID, or a number the canonical form would change exits 5 | M1 |
| `doctor` | Report Bun, SQLite, and external tool versions, paths, and platform test status | M1 |
| `validate [paths]` / `fmt [paths]` | Check records against CONTRACT-001; `fmt` rewrites to canonical form without changing values | M1 |
| `rules check` | Report malformed or duplicated rule headings in `rules.md` (CONTRACT-001 J) as `record.valid` results; `validate` includes it | M1 |
| `migrate --list` / `migrate --apply <list digest>` | Move a project to a newer format (Data Design), only when the author asks. `--list` writes nothing and prints every file change and the review marks, support records, confirmations, and annotations that would end, with a digest of that list. `--apply` writes only when the digest still matches, otherwise exits 5 with `stale_input`. Neither prompts | With the first format change |
| `ingest [--plan <file>] [--originals <dir>]... [--fetch] [--reconvert] [--refresh-lookups] --actor <kind>:<name>` | Run stages 1 and 2 (Core Pipeline). For each plan entry not yet captured, take the original from the named file or fetch its address, record an `upstream`, and convert it with the entry's settings, proposing page labels from the printed numbers. For every upstream record, find the original by hash in `.stemma/originals/` and the `--originals` directories, or fetch it with `--fetch`; convert it again and record the comparison when no current one exists; with `--reconvert`, convert every one again, and record a comparison only where the result differs from the current one. With `--fetch`, make each lookup an upstream lists that has no saved response; `--refresh-lookups` makes all of them again. Then run `check` and print its report and coverage. A refused or failed fetch is reported with what to supply; nothing is retried another way | M1 |
| `source pages <original> [--text-layer <file>] [--page-numbers <file>] [--out <file>]` | Propose a page map from the numbers printed in the pages' own text. It writes nothing in the project; `--out` writes a `PageSegment` list to a file that does not exist yet. Page-number data (an Internet Archive page-number file, or a list of `{"page_index", "label"}`) and labels stated inside the file are compared and reported; they label nothing on their own. A warning names labels that more than one page would carry | M1 |
| `source convert [<original>] --source <id> --acquired-at <time> --actor <kind>:<name> [--origin <text>] [--source-version <text>] [--held-at <text>] [--description <text>] [--image <file>]... [--text-layer <file> \| --transcription <file>] [--method born_text\|text_layer\|markup\|ocr\|manual] [--recognition <text>] [--tool <name> --tool-version <version>] [--page-map <file> \| --auto-pages] [--page-numbers <file>] [--identity <file>] [--coverage-note <text>] [--note <text>] [--name <name>]` | Convert an original into a new source file (CONTRACT-007). Without an original file, a `physical` original needs `--description`, `--held-at`, and a transcription; page images (`--image`) need a transcription too. Text with nothing but white space, an encrypted or damaged file, or a limit passed exits 5 and writes nothing. When a source file already holds the same original for another source, nothing is merged: the command exits 5 with `already_held`. `--auto-pages` applies the proposed runs, dropping a run whose labels a longer run also gives, and reports each dropped run | M1 |
| `source label <text id> --page-map <file> --actor <kind>:<name>` | Replace a source file's page labels from a page map; text is unchanged | M1 |
| `source seal <text id> --actor person:<name> [--note <text>]` | Record edits made to part files: update part digests and stamp `changed`. It reports the reviews, comparisons, and passages that the edit made stale. A model or software actor is refused | M1 |
| `source verify <text id> --original <file> --actor <kind>:<name>` | Match the file's hash with the source file's original, convert it again with the recorded settings, compare each part (with person corrections undone), and save a `comparison_run` | M1 |
| `source compare <text id> --with <text file> --against <text> [--independent] --actor <kind>:<name>` | Compare another text of the same pages (form feeds between them) and save a `supplied_text` `comparison_run` | M1 |
| `review add <text id> --scope <scope> [--pages <indexes>] [--passage <id>] [--fields <list>] --against <text> --outcome <outcome> [--flag <index>\|<reading>\|<suggestion>\|<note>]... [--original-sha256 <hex>] [--note <text>] --actor <kind>:<name>` / `review list [<text id>]` | Record a person's review or a model's flag (CONTRACT-001 G); list reviews and whether each is current | M1 |
| `coverage [<text id>]` | For each source file, report the method, parts reviewed whole by a person, flags, each current or stale comparison run with per-page agreement, and every disagreement with both readings. It emits no finding | M1 |
| `passage find --source <id> <words>` | List the passage addresses where words occur under the quotation rules, with page or chapter | M1 |
| `passage capture --address <address> --actor <kind>:<name> [--note <text>]` | Make a `passage` from an address such as `txt-…/105:main:120-240` or a range `txt-…/105:main:900-+106:main:0-80`, copying its exact text and locator, and print them with the quotation as the joining rules render it | M1 |
| `source admit <id> \| source reject <id>` | Record the author's optional admission decision | M1 |
| `key rename <source id> <key>` | Rename a citation key, keeping the old one as an alias | M1 |
| `check [--changed \| --all]` | Run scripted checks; `--changed` (default) covers what changed since the check baseline (below); `--all` covers the project | M1 |
| `resolve <source id>... [--via crossref\|internet_archive --identifier <value>] --actor <kind>:<name>` | Look up identifiers in a catalogue by its documented interface and save `resolution` records with the responses; without `--via`, make the lookups the source's upstream records list | M1 |
| `excerpt (--passage <id> \| --source <id> --pages <printed pages>)` | Print a bounded piece of source text (G) | M1 |
| `unreviewed list` / `reviewed <id@sha256…>` | List unreviewed records with their original passages and content digests; mark records the author has reviewed, each by the digest that was shown (a changed record is left unmarked and reported `stale_input`). Nothing waits for these commands | M1 |
| `retire <id…> --reason <text> --actor <kind>:<name> [--replaced-by <id>]` | Set `retired` on records, such as a replaced source file or a record the author rejects. The files stay. It lists the notes, claims, and citations that `source.changed` now flags. `--replaced-by` takes one record of the same kind | M1 |
| `rounds status` / `rounds choose --action <remove\|repoint\|replace\|bind\|close> …` | List remaining failing references and intake items; apply the author's choice to records and the Stemma copy, recheck, and save a `round_choice`. `remove` takes an occurrence out of the text and retires its record, or, given a listed source, takes it off `bibliography_include`. `repoint` binds the occurrence to a source already in the project, or corrects its locator. `replace` binds it to a source the author newly supplies in its place and records both sources. `bind` settles an intake item by binding its occurrence to one of its candidates. `close` settles an intake item that needs no citation, such as an unclassified note that cites nothing; it changes no finding | M1 |
| `review import <comment file>` | Import reviewer comments (CONTRACT-005) | M3 |
| `support list` / `support prepare <claim id> --passage <passage id>` / `support record --input <file>` | List needed verdicts as claim and passage pairs; emit the input bundle for one pair; validate and save a verdict (H) | M1 |
| `annotate --finding <key> --effect explain\|dismiss --reason <text>` / `annotate list` | Save an annotation (F), or list annotations and whether each applies | M1 |
| `import <file> --kind <csl-json\|biblatex\|ris> [--again]` / `export --kind <…> --out <file> [--batch <import id>] [--policy report\|strict]` | CONTRACT-003; `--again` imports bytes already imported; `--batch` exports one import batch | M1 |
| `takeover <docx> [--library <file>…] [--again]` | CONTRACT-003 Word intake; `--again` reruns on bytes already taken over, keeping every author choice and edit | M1 |
| `index rebuild` / `index status` / `index dump` | Manage the derived index | M1 |
| `research list` | List the Markdown files under `research/` by path (code-point order), each with the date its name starts with and its first level-one heading outside fenced code, both when present; a heading is cut at 200 characters, and one matching a coordinate form is not shown. Writes nothing and reports no finding; exit 0. JSON: `content_is` and `notes[]` (`path`, `date?`, `title?`, `problem?`: `cannot_read` or `title_withheld`) | M1 |
| `research record --input <file>` / `research corpus <query>` / `research admit <id>` / `research reject <id>` / `research coverage` | Save a search and its candidates; search source files offline; record the author's decision, as `source admit` or `reject` does; coverage is P1 | M2 |
| `setup --input <file>` | Write the stated thesis, audience, scope, style, constructs, methodology, and missing governing records; never overwrites without a named choice | M2 |
| `log add --record <governing record id> --input <file>` | Add a changelog, errata, decision-log, or register entry | M2 |
| `activity record --input <file>` | Save an `ai_activity` record | M2 |
| `plan record --input <file>` / `plan bundle <chapter>` | Save an outline or chapter specification, in effect and unreviewed; return the drafting inputs for one chapter with the review state of each | M2 |
| `voice record --input <file>` / `voice compare <before> <after>` | Save a profile change, in effect and unreviewed, with its examples as `voice_example` records; list changed quotations, citations, and claim sentences | M2 |
| `audit record --input <file>` | Save audit findings and rival-reading claims; rival readings are saved before repair findings | M2 |
| `checkpoint record --input <file>` / `authorship mark --input <file>` | Save a checkpoint answer or an authorship mark | P1 |
| `review baseline` / `review needed` | Save input digests; list what needs re-review since that baseline | P1 |
| `restricted set <location id> --input <file>` / `restricted get <location id>` / `restricted mark <location id> --class restricted\|public --release exact\|area\|withhold` | Write or read an exact value in the restricted store (`get` sends it to whatever reads the output, including a model); set a location's mark and release (CONTRACT-001 H), with `public` for a person only and `exact` for `public` only | M3 |
| `build draft` / `build camera-ready` / `build reviewer` | Typeset under the rules in F | Basic `draft` M1; `camera-ready` M2; `reviewer` M3 |
| `record show <id>` / `record search <text> [--kind <kind>]` | Print one record with its forward and reverse links and its states (CONTRACT-005 J), a support result being a recorded model judgment; search records under the `search-fold` profile | M3 |
| `record trace <record id \| sentence locus>` | From a linked sentence to its claims and their evidence, and from a claim or evidence back to each linked sentence; broken, missing, and withheld links are named | M3 |
| `graph neighbors <record id> [--depth <n>] [--limit <n>]` | List the records and links connected to one record, and say what was left out | M3 |
| `map argument [--chapter <id> \| --branch <claim id>]` / `map places` | Print the argument-map or places-map data of CONTRACT-005 J, including states and what cannot be drawn, filtered for `--audience <author\|reviewer>` | M3 |
| `review comment add --export <dir> --claim <id> --input <text file> --file <comment file> [--reviewer <name>]` / `review comment list --file <comment file>` / `review comment edit\|remove <comment id> --file <comment file>` | Create or change a reviewer comment file (CONTRACT-005 E2) against a reviewer export, with no project; `edit` takes `--input`. Writes only that file | M3 |
| `disclosure` | Generate the AI-use disclosure from records | M2 |
| `scan release <path>…` | Search outputs and tracked files for restricted values and coordinate-shaped text, and outputs for source text beyond short excerpts, and report what is found | M3 |
| `graph export --audience <author\|reviewer> [--chapter <chapter id>] [--page] [--out <dir>]` / `graph status` | CONTRACT-005; `--chapter` scopes the export as CONTRACT-005 E states | M3 |

**Command line first** (FR-49). Every function a user interface offers has a
command above, delivered no later than the interface. Both call one `core`
operation, so their results are equal. Zoom, pan, focus, selection, and layout
controls need no command. Browser compilation of preview pages (CONTRACT-005 D)
is a way of showing the manuscript; its command-line forms are `build draft`,
which typesets the same inputs, `graph export --page`, and `graph status`. A new
interface function needs its command added here first.

A command that is not yet implemented MUST exit 2 and say so. Commands that
record a review, decision, or annotation cannot establish who ran them.

**What `--changed` compares with** (assumption). The check baseline under
`.stemma/` holds digests of every input the last completed check read: records,
settings, rules, manuscript and source files, and profile and tool versions, with each subject's input set. It holds no result.
`--changed` selects every subject whose old or new input set meets a changed
input. Reverse-reference closure alone is not enough: removing an attestation or
renaming a key changes subjects that no reference reaches. With no baseline, or
when the effect cannot be bounded, the scope widens to `all`. Builds ignore the
baseline and run everything.

### C. Outcomes and check identifiers

A scripted result is `pass`, `fail`, or `unverifiable`. `unverifiable` means the
check could not check, and carries a `reason_code`. A check that does not apply
emits no result. Checks that depend on constructs or methodology run only once
those records exist (FR-60). Checks concern records in effect (CONTRACT-001 G),
reviewed or not.

| Check ID | Requirement | `fail` when | Typical `unverifiable` |
|---|---|---|---|
| `record.valid` | FR-62 | CONTRACT-001 error | unreadable file |
| `project.binary` | FR-84, FR-85 | A file outside `records/` and `sources/` that git tracks or would add is binary (a NUL byte in its first 8000 bytes, or a PDF or ZIP signature). Without git, every file outside hidden, `build/`, and `node_modules/` directories is read. A binary under `records/` or `sources/` is `record.valid`'s. One result for each file; one pass when there is none | none |
| `source.held` | FR-9 | A cited source has no non-retired source file holding text (`no_source_file`, `no_text`) | an unreadable or damaged source file |
| `source.pages` | FR-87 | A source file's part is missing, edited without sealing, unlisted, out of sequence, or its pages do not run `0` to the original's page count minus one | a part cannot be read |
| `source.labels` | FR-87 | A printed label repeats, goes backwards, or advances further than the pages do, or a folio differs from its page's label | none |
| `source.footnotes` | FR-87 | A note marker has no note on its page or section, or a note has no marker, unless the note is continued | none |
| `source.original` | FR-85, FR-88 | A source file's original matches no upstream record of its source, or the current fresh conversion of the original differs from it, person corrections undone | the newest fresh conversion no longer applies to the parts or tool versions |
| `source.changed` | FR-10, FR-90 | A note, claim, passage, or citation depends on a retired source file or source, on a passage whose pages or sections changed (`text_changed`), or on a passage whose `source_record_sha256` differs from the source's current bibliographic digest | a record it depends on cannot be read |
| `cite.key` | FR-29 | A citation key matches no source | a source record is unreadable |
| `bib.uncited` | FR-29, FR-15 | A source in `bibliography_include` is cited nowhere. Cited sources enter the built bibliography automatically, so no other entry can be uncited | no manuscript to read |
| `quote.present` | FR-29, FR-20, FR-90 | A quotation or note extract is absent from the source text; a passage's `quote.exact` is not the text at its address; or a citation made from a passage has a quotation or locator that differs from it | no usable text, only `poor` text without a pass, or a note anchor that cannot be found |
| `quote.page` | FR-29, FR-87 | The quoted words are not on the cited page or in the cited chapter or paragraph, or only partly on the cited pages | the pages they lie on have no label, or the source has no such locator |
| `quote.self` | FR-29 | A quotation attributed to a source duplicates a claim marked as the book's own | no claims |
| `locator.extent` | FR-29 | A locator is outside the recorded extent for its term, or else outside the printed pages, chapters, or paragraphs of the source file | no extent or map in the locator's numbering, a source with no pages for a page locator, a page between mapped pages with no label, or a locator that cannot be read |
| `meta.source` | FR-29, FR-86 | Title, authors, year, or venue disagree with what the copy states | the value cannot be found in the copy's stated identity or title page text, or its source file is damaged |
| `meta.resolver` | FR-29, FR-33 | The same fields disagree with a saved lookup | no saved lookup, or a lookup that states none of them |
| `id.resolves` | FR-29 | A saved lookup says the identifier is not found or names another work | no saved lookup for it |
| `number.present` | FR-29 | A figure in a cited sentence is not in the cited source's text | several citations or ambiguous separators, or no usable text |
| `construct.credit` | FR-29 | Text credits a construct to a party other than a registered originator | attribution not detectable |
| `claim.complete` | FR-21 | A claim reaches no note, or lacks a confidence level or a reason | none |
| `construct.complete` | FR-22 | A construct lacks a definition or ownership, or a borrowed one lacks its source | none |
| `claim.inactive` | FR-53 | A claim span points at a retired claim | no manuscript |
| `cite.unlinked` | FR-53 | A citation lies in no claim span; the author can link it | no manuscript |
| `takeover.removal` | FR-73 | A claim lost a citation by a `remove` choice and has neither another citation nor been rewritten or retired | none |
| `draft.marked` | FR-25 | A passage marked as needing a source has no key and locator | no manuscript |
| `support.current` | FR-52 to FR-54 | A cited claim (a claim in effect, in a claim span that contains a citation) lacks a current support record for each supporting passage, reaches no source passage (`no_source_passage`: reported as unsupported), or has a `partly_supported` or `unsupported` verdict | none |
| `restricted.leak` | FR-68 | A restricted value appears in a tracked file or output | restricted store absent |
| `coordinate.stray` | FR-68 | Text in a tracked file or output matches a coordinate form the scan lists, whether or not the site is restricted; a warning that names the file and position, never the value | file cannot be read |
| `image.resolution`, `image.alt` | FR-55, FR-57 | Effective resolution is below the set threshold; a figure lacks alternative text | image unreadable |
| `image.credit`, `image.permission` | FR-58 | An image lacks credit or recorded permission | no image record |
| `image.vector`, `image.font`, `image.placement` | FR-56 | A vector image would rasterize, lose content, or substitute a font; an image cannot be converted or placed | content cannot be inspected |
| `image.metadata` | SEC-031 (proposed) | A placed image holds location metadata; the file is not changed | image unreadable |
| `cite.format` | FR-36 | The citation processor cannot format a citation; the output shows it visibly | none |
| `build.uncommitted` | FR-39 | A build's project has uncommitted changes (a modified, staged, or untracked file that git does not ignore) or no commit | git unavailable |
| `changelog.missing` | FR-41 | A camera-ready or reviewer build has no dated changelog entry for its version | none |
| `package.leak` | FR-46 | Source text beyond short excerpts is in a package part Stemma cannot change, and the author did not include source files | a package part cannot be read |

A later feature adds IDs as needed. An ID is never reused. FR-29 lists error
classes; the table maps each to at least one ID. Without a print threshold,
`image.resolution` reports the effective resolution and emits no result.

`support.current` tests records only. Its `pass` MUST be described as "a current
support record is present and resolved", never as verification of support.

**`source.held`** (assumptions). It emits one result for each citation record
that names exactly one source (a key naming none is `cite.key`'s finding). It
passes only when the source has a non-retired source file with text and none of
its non-retired source files is damaged. While `manuscript/` holds files this
version cannot read, it is `not_implemented`. A pass says nothing about whether
the text is a faithful reading of the original; its evidence states the method
and the review coverage.

**Structure checks.** `source.pages` emits a result for every non-retired source
file, `source.labels` for every paged one with a labelled page, and
`source.footnotes` for every one with a note or marker. `source.labels` compares
consecutive labelled pages of one numbering style: a label equal or lower, or
one that advances by more than the page index does, is an anomaly; unlabelled
pages in between are not. `source.original` emits a result for a source file
whose source has upstream records or that has a comparison run of its original.
A source file whose parts fail `source.pages` is not used by other checks.

**Recognized text and review coverage.** Recognized text that no person has
reviewed is not a finding. Reports state review coverage for each source file
(`body.verification`), and `coverage` shows each comparison's disagreements with
both readings.

**Metadata checks** (assumptions beyond SD-007 BR-716). `meta.source` emits a
result for every source that has a source file, and `meta.resolver` for every
source that has one or is cited or listed. Values compare after case, diacritics, punctuation, line-end
hyphens, and white space are folded, and a letter followed by a digit is read
as two words, so that a note mark set against a name does not hide it. A title matches when it equals the other,
or equals the other's main title before a colon or full stop; `meta.source`
also accepts the record title found as consecutive words on a title page. Each
author's family name must appear among the stated contributors or on a title
page. The year must be the stated issue year or appear on a title page, in figures or as a roman numeral; a venue
is compared only when the record names one. A field the lookup does not state is
listed as not compared. `meta.source` fails when the copy's stated identity
disagrees and the title page text does not bear out the record; a value found in
neither is `unverifiable`. `id.resolves` covers `doi`, `ia`, and `gutenberg`
identifiers with lookups; other identifiers are `unverifiable` (`no_lookup`).

**`source.changed`** (assumptions). It follows the links records hold: a citation
to its passage and claims; a claim through its non-retired attestations to notes
and passages; a note to its passages and source; a passage to its source file
and source. A citation with no passage also rests on each source file of its
source that was retired at or after the citation record was created; times are
compared to the second and a tie is flagged. A passage whose part digests differ
from its address is `text_changed`; an edit elsewhere in the source file does
not affect it. It emits one result for each non-retired note, claim, passage, or
citation that reaches a source or source file. Reason codes are
`depends_on_retired`, `text_changed`, `source_details_changed`, and
`record_unreadable`. Until annotations are built, nothing can record that the
author has looked, so a finding stays listed. While `manuscript/` holds files
this version cannot read, citations are left out and the check is also
`not_implemented`.

**`locator.extent`** (assumptions beyond SD-007 BR-715). It emits one result for
each citation record with a locator that names exactly one source. A value is a
printed label, a range with both ends in full (`41-43`), or a list of those;
`--` and dashes count as range marks, and a label a page map holds whole, such
as a folio, is taken whole. A recorded extent for the locator's term is the
whole work: anything outside every recorded range fails. Against page labels, a
number beyond the lowest or highest labelled number of its style fails
(`outside_page_map`), and one between them that no page carries is
`unverifiable` (`page_not_mapped`). Chapter and paragraph locators compare with
the chapters stated by the source file's sections and the paragraphs counted
within them. A page locator for a source file with no pages, or any locator with
no matching extent or map, is `no_extent`. A range that runs backwards, mixes
styles, or abbreviates its end, and forms such as `41ff.`, are
`unparsable_locator`. A partial source file's labels cover only its pages, and
the finding says so. `quote.present`, `quote.page`, and `locator.extent` emit
nothing for a citation whose key names no single source (`cite.key` reports it),
and are `not_implemented` while manuscript files are present.

**Every finding is explained.** Each `fail` or `unverifiable` result MUST say in
plain language what is wrong or could not be checked, show its evidence, say why
it matters, and suggest what to do. A finding without these, a repeated finding
that adds nothing, or a finding the author cannot act on or dismiss with reason
is a Stemma defect. Reports group findings so that one cause is shown once with
the items it affects.

**Confirmed source details.** When `meta.source` or `meta.resolver` is
`unverifiable` and a current person's `source_details` review (CONTRACT-001 G)
covers every field the result could not compare, the result keeps its outcome,
gains `confirmed_by`, and is not open. It is shown as confirmed by the author, never
as verified. A `fail` from either check is unaffected. Such a review confirms no
other check, including `id.resolves` (assumption).

**Applicability.** A check emits results only for what the project holds, and a
report lists nothing for a check that does not apply. `body.not_run[]` lists each
check that applies to the project's contents but that this version cannot run,
with reason `not_implemented`.

**Open findings and the label.** A finding is open when its result is `fail` or
`unverifiable`, no applicable annotation dismisses it, and no source-details
review confirms it. A `not_implemented` entry also counts as open. A report with scope
`all` and nothing open is labelled `checked_clean`; otherwise `open_findings`,
with counts. Assumption: a could-not-check result counts as open, which is the
conservative reading. `checked clean` means these checks found nothing open. It
does not mean that the book is correct or that support verdicts were verified.
A report with scope `changed` carries no label.

**Unreviewed items.** The label reflects checks only. Records that the
manuscript reaches (a linked claim, its evidence, relations, constructs, and
methods, a cited source, or the plan or profile in use) and that are
unreviewed, and cited sources that are not admitted, are listed in
`body.unreviewed[]` and counted in `body.summary`. They are not findings, are
never open, and do not affect the label. "Unverified" means only that something
has not yet been checked; it is not open by itself.

**Disclosure risks.** A report with a `restricted.leak` or `coordinate.stray` finding, or whose scan
could not run because the restricted store is absent, MUST say on screen and in
the report that the output can disclose a restricted site's position (a packaged
report says so without the location, E1).

**What a clean label cannot show.** Text with no claim span and no citation is
not checked. A claim edited after its support verdict is caught; a manuscript
sentence strengthened while its claim is unchanged is not. An agent or person
with file access can edit verdicts, review marks, annotations, and reviews.

**Record findings.** CONTRACT-001 calls a non-canonical file and an unknown
field warnings. Each is reported as a `record.valid` `fail`
(`record_noncanonical`, `unknown_field`), so that it is explained and counted
like any finding (assumption). CRLF line endings from a checkout alone do not
make a file non-canonical. An unreadable or newer-version file is
`unverifiable`.

**Citation items without a manuscript reader.** The manuscript is authoritative
(CONTRACT-006 D). When `manuscript/` holds no `.md` file, `cite.key` and
`bib.uncited` read the non-retired `citation` records; a record's `key`, or its
`source` when it has no key, names the source. With no citation record either,
each listed entry is `unverifiable` (`no_manuscript`). While a version cannot
read manuscript files that are present, no citation record stands in for them:
`bib.uncited` is `unverifiable` (`manuscript_not_read`) and `cite.key` is
`not_implemented`. `cite.key` is `unverifiable` (`source_unreadable`) when a key
matches no source and some source record cannot be read; `bib.uncited`
likewise (`citation_unreadable`) for unread citation records (assumptions).

**Coordinate forms.** `coordinate.stray` recognizes, within one line: a `geo:`
URI; degrees with a degree sign and a latitude then a longitude hemisphere
letter, with optional minutes and seconds; and two decimal numbers with at least
three decimal places each, separated by a comma, within coordinate ranges
(assumption). In `check` it reads `stemma.json`, `rules.md`, and the files under
`records/`, `manuscript/`, `sources/`, and every non-hidden file under
`research/` as text. A source file gets one result that lists its positions. It does not read structured geometry fields, other
files, or builds. Other forms are missed, so a pass is no proof.

**What counts as input for a check not yet implemented** (assumption). A check
applies when the project holds something it would test: for `quote.self`, a
claim and a quotation; for `construct.credit` and `construct.complete`, a
construct; for `claim.*`, `support.current`, and `cite.unlinked`, a claim or
manuscript; for image checks, an image record; for `restricted.leak`, a
restricted location; build checks only in a build. A record of a kind whose
CONTRACT-001 rules a version does not all check makes `record.valid` itself
`not_implemented`.

### D. Quotation matching

A `quote.present` result carries `match`: `exact`, `normalized`, `near`, or
`none`, the `profile` that normalized the comparison, and the closest stored
text when not exact. `exact` and `normalized` pass; `near` and `none` fail.
`normalized` means the texts differ only by harmless differences that the
profile lists. A near match is reported with both texts and
stays open until the text is fixed or the author dismisses it with an
annotation, which then holds `compared`.

The first profile, `quote-fold/0`, is approved by the product owner and
untested. It allows only: runs of white space and line breaks; soft hyphens;
Latin presentation ligatures against their letters; Unicode canonical
equivalence; straight against typographic quotation marks of the same level; and
joining a word that the source text splits with a hyphen at a line end. Pilot
sources test the list. Changes of word, case, punctuation, or a hyphen within a
line, and any omission, insertion, or ellipsis, are not on it. The line-end join
can pass a wrong quotation when the source's hyphen belongs to the word (a
compound broken at that hyphen); a result that used the join MUST say so in its
evidence. A profile MUST be versioned, MUST NOT apply Unicode compatibility
folding to whole texts, and MUST NOT change source text.

Quotations are searched in a source file's main stream (CONTRACT-007 G), which
joins the pages without running heads, folios, boilerplate, or notes between
them, and separately in its notes stream. A quotation that spans a page break
matches and is reported with every page it lies on. The quotation a passage
yields is its exact text with only the line-end join, soft-hyphen removal, and
runs of white space made one space.

`quote-fold/0` as built. The ligatures are U+FB00 to U+FB06 as their own
letters (U+FB05 is long s and t). Curly marks are U+2018, U+2019, U+201C, and
U+201D; guillemets, low-9 marks, and primes are not on the list. The join applies
only to the source text: a letter, then a hyphen (U+002D, U+2010) or soft hyphen
directly before a line break, then, after any indent, a letter, a page break
included. Evidence is in the result's evidence entries: `match`, `profile`,
`cited_text`, `differences_allowed`, `joined_at_line_end`, `source_passage`,
`found_on`, `address`, and `text_method`. Reason codes are `near_match`,
`absent`, `passage_differs`, and `citation_differs` for `fail`, and
`text_unavailable`, `poor_quality`, and `anchor_not_found` for `unverifiable`.
A near match fails even if another source file of the source could not be used;
with no close text and some text unusable, the result is `text_unavailable`. The
closest source text is shown, widened to whole words, when its edit distance to
the folded quotation is at most 40 percent of the quotation's length; it is
`near` at 15 percent or less, measured on the words shown. Quotations over 2,000
folded characters get no closest-text search (assumptions). `quote.present` does
not test the cited page; `quote.page` does, over every occurrence of the words,
and passes when one occurrence lies wholly on cited pages.

### E. Report

`check` and every build write a `stemma.check-report/0` document.

| Field | Content |
|---|---|
| `schema` | `stemma.check-report/0` |
| `body.mode` | `work`, `draft`, `camera-ready`, or `reviewer` |
| `body.scope` | `changed` or `all`, with the changed record IDs |
| `body.inputs` | Corpus digest, manuscript and research file digests (research notes are outside the corpus digest), and profiles used |
| `body.tools` | Stemma, Bun, SQLite, and every library or program that affected a result |
| `body.results[]` | `finding_key`, `check`, `outcome`, `reason_code?`, `subject` (record ID or manuscript location), `sentence?`, `source?`, `item?`, `evidence[]` (E1), `fixes[]` (codes), `rules[]` (rule IDs), `message`, `why`, `suggestions[]`, `annotations[]` (IDs and effect), `confirmed_by?`, `open` |
| `body.not_run[]` | `check`, `reason`; only checks that apply |
| `body.verification[]` | For each source file: ID, method, parts, parts reviewed whole by a person, flags, and the current comparison runs with the number of parts that disagree |
| `body.unreviewed[]` | `record` (ID), `kind`, `reason` (`unreviewed` or `not_admitted`), and the manuscript locations that reach it; never part of the label |
| `body.redaction` | `none` or `reviewer` |
| `body.label` | `checked_clean` or `open_findings`; absent for scope `changed` |
| `body.summary` | Counts by outcome, open, dismissed, confirmed, unreviewed, and could-not-check |
| `run` | Start time, duration, platform |

- `finding_key` is the digest of the canonical form of
  `{check, subject, source, locus}`, where `locus` is the check's stable pointer
  to what it tested. It excludes evidence text and time.
- Results are sorted by `check`, `subject`, `finding_key`. For equal `inputs`
  and `tools`, `body` MUST be byte-identical in canonical form. `run` is
  excluded from comparison.
- An annotation never changes `outcome`. A dismissal only makes the result not
  open; it stays listed with the reason.
- `--changed` results MUST equal the corresponding results of `--all`.
- `message`, `why`, and `suggestions` are generated from fixed templates and
  structured values, and hold no source text.

#### E1. Evidence and redaction

Each evidence entry is `{name, class, value}` or `{name, class, record}`.
`class` is `source_text` (any text taken from a source file, note extract,
passage, or saved lookup), `manuscript`, `metadata`, or `location` (file and
position). A check MUST NOT put a restricted value in any report field; a leak
finding gives only the location. `reason_code`, `locus`, `finding_key`, and
messages MUST NOT contain source text.

A report that leaves the project (reviewer package) MUST be produced with
`redaction: reviewer`. It shortens each `source_text` entry to the excerpt limit
(FR-46) and applies the same to `compared` texts in listed annotations.
Outcomes, check IDs, and counts stay. Rights fields change nothing.

**Excerpt limit** (FR-46). The limit is not set (open question). Until it is
set, a packaged report replaces each `source_text` value with
`{"redacted": true}`. A package holds no source files unless the author asks to
include them; then nothing is shortened for their sake.

The package scan MUST search the generated parts for long runs of source-file
text (a limited check: it cannot find paraphrase or altered copies). Stemma
removes a hit from any part it generates. A hit it cannot remove, such as one in
the PDF, is a `package.leak` finding: the package is still written, and it is
not labelled checked clean. Removing structured restricted values is part of how
an output is constructed; no finding stops it. In a redacted report a
`restricted.leak` or `coordinate.stray` result keeps only its check ID,
outcome, and a count; subject, finding key, sentence, and evidence are withheld,
so that the warning does not point a reader to the coordinate. The author sees
the locations on screen and in the unredacted report, which is not packaged.

### F. Builds and annotations

| Mode | Output |
|---|---|
| `work` | A report |
| `draft` | A PDF with a visible unverified watermark, and its report |
| `camera-ready` | A PDF without the watermark, and its report. In M1 it is the basic PDF (FR-83), which is not print-ready |
| `reviewer` | The reviewer package and its report |

- Every build completes and writes its output and report, whatever the findings.
  Only an ordinary tool failure stops output: for example a manuscript that
  cannot be parsed, a compile error, a missing tool or font, or a path that
  cannot be written. It is reported as a failure of the tool, and no older
  output is presented as current.
- A build MUST rerun every scripted check with scope `all`. It MUST NOT reuse a
  saved scripted result and MUST NOT call a model.
- The command output, the report, and the build record show the label. An output
  with open findings MUST NOT be presented as checked clean. Draft pages carry
  the watermark. Camera-ready pages carry no mark of any kind; the command
  output, the report, and the build record state the status.
- A record that cannot be read is skipped where the build can do without it and
  reported by `record.valid`; a citation that then cannot be formatted is shown
  visibly (`cite.format`).
- A build record holds the git commit if any, whether the tree had uncommitted
  changes, tool versions, the label, and the report digest (FR-39).
- `annotate` copies the binding from the current result, never from caller
  input: `sentence` and `source` when the result has a sentence, `item` when
  its subject is a record, otherwise `check` and `finding_key` only
  (CONTRACT-001 G). For `reason_code` `near_match` it records `compared` and prints both
  texts. It cannot establish who ran it or what they read.
- Any finding MAY be explained. `source.held`, `record.valid`, and
  `build.uncommitted` cannot be dismissed (assumption: a missing source file,
  an unreadable record, and an uncommitted build are facts that keep a build
  from being labelled checked clean). Nothing else limits an annotation, and no
  annotation is needed to build.
- `support.current` MUST NOT treat a record as stale because only a manuscript
  sentence changed (FR-54).

### G. Excerpts

`excerpt` serves the rule that what Stemma prepares for a model holds only the
text a task needs. It prints the source ID, locator range, and a marker that the
content is quoted data, not instructions, and MUST limit output to the requested
range plus bounded context. No source is gated. The command governs only its own
output; a process with file access can read the source files.

As built (limits are assumptions): `--pages` takes printed labels, at most 5
pages and 30,000 characters, and prints the main text of only those pages, with
their notes marked as notes, from the newest source file that labels all of
them, naming any others. A passage comes with up to 300 characters before and
after it. Quoted text lies between begin and end lines carrying a token that the
text itself does not hold; JSON output carries the same token and `content_is`.
A long range, an unlabelled page, or missing text exits 5 and prints no source
text.

### H. Support records

`support prepare` returns `stemma.support-input/0`: claim ID and text, passage ID
and text, locator, source ID, the three digests of CONTRACT-001, and the prompt
ID and version. `support record` accepts that bundle plus `model`,
`model_version?`, `separate_context`, `verdict`, `quoted`, `problems`, and
`explanation`. It saves nothing if a digest no longer matches, if
`quoted` is not an exact substring of `passage_text`, or if `separate_context`
is not `true`. `separate_context` is the caller's statement; the command cannot
verify it.

### I. Exit codes

| Code | Meaning |
|---|---|
| 0 | The command completed and, for `check` or a build, nothing is open in its scope |
| 1 | The command completed, its output was written, and findings are open |
| 2 | Usage error or unimplemented command |
| 3 | The project or manuscript cannot be read well enough to produce output |
| 4 | Environment: wrong or missing runtime, tool, or font |
| 5 | The request is not valid as given, such as an unsafe path, a stale input, or an annotation effect that does not apply |
| 70 | Internal error; no result may be read as a pass |

Exit 1 is a signal for scripts. Stemma, including its skill and its other
commands, MUST NOT treat it as a reason to refuse or stop work.

## Precedence and Compatibility

- Versioning: the report, support-input, and command surface share the version
  of this contract. Added commands, options, report fields, and check IDs are
  compatible. Removing or changing meaning needs a new major version.
- Precedence: options, then environment, then `stemma.json`, then defaults. No
  setting, persona, or option hides an open finding or changes the label rule. An
  absent restricted store leaves its scan `unverifiable`.
- Readers MUST ignore unknown report fields.
- Deprecation: a removed command exits 2 and names its replacement.

## Error Semantics

| Condition | Outcome | Retry | Recovery Expectation |
|---|---|---|---|
| A check throws | That result is `unverifiable` with `check_error`; exit 70 | yes | Report the defect; never record a pass |
| Report cannot be written | Exit 70; the build is reported as failed | yes | Fix the output path |
| No network or a refused request during `resolve` or `ingest` | No record written; dependants stay `unverifiable` or use the cached record and report its date | yes | Run again online |
| Support input stale | `support record` saves nothing and exits 5 with `stale_input` | yes | Prepare again and rerun the verdict |
| Typst or font missing | Exit 4; no output | yes | The plugin's setup obtains the pinned tool |
| Another Stemma command is writing | Exit 3 with `busy` | yes | Wait |

Errors in JSON mode are `{"error":{"code":…,"message":…,"paths":[…]}}`.

## Examples

```text
bun --no-install <plugin root>/dist/stemma.js check --changed --format json
```

```json
{
  "check": "locator.extent",
  "evidence": {
    "extent": "31-60",
    "locator": "p. 412"
  },
  "finding_key": "<64 hex>",
  "fixes": ["repoint", "replace_source", "remove_citation"],
  "outcome": "fail",
  "message": "The cited page is outside the article's pages.",
  "open": true,
  "rules": [],
  "sentence": {"sha256": "<64 hex>", "text": "<the cited sentence>"},
  "source": "src-7c2m9q4t1v8b5n0k3x6d",
  "subject": "cit-0a5h2w8j4p9r1e7y3u6f",
  "suggestions": ["Check the page in the source and correct the locator."],
  "why": "A reader could not find the cited material there."
}
```

A conformance test runs `check --all` twice on a seeded project and compares
`body` bytes, then confirms that `build camera-ready` writes a PDF and report,
exits 1, and labels the build `open_findings`.

## Non-Normative Notes

- Stated risks: nothing stops a book with open findings from being published; a
  coordinate warning can be ignored and the site disclosed; a claim left by a
  removal can stand without a source; a strengthened sentence keeps its support
  record current. The control is the report and its label.
- References recovered by `takeover` with no source file fail `source.held`;
  that is the intended starting state.
- Advice from the agent about inconsistent construct use or methodology is not a
  check.
- How accurate support verdicts are is measured on a labelled set with seeded
  errors plus a pilot-author sample, with published error rates. That is test
  design, not part of this surface.
- Diagnostic telemetry: not applicable; reports are the diagnostics.

## Proof Status

| Element | Evidence | Not shown |
|---|---|---|
| Quote and page checks | A feasibility test scored 20 of 20 with no false passes after tuning (19 of 20 first run) on two synthetic layouts, byte-identical across runs, one macOS system | Real publisher PDFs, scans, other scripts; probes passed a changed hyphen and a joined ellipsis |
| Rebuild recheck | Recomputed quote and page checks caught edited records; a forged "supported" verdict passed | Nothing prevents the forgery |
| `meta.*`, `id.resolves`, `number.present` | Tests over synthetic sources and saved responses on one macOS system; the worked example uses real catalogue responses | Other catalogues; works whose title pages convert badly |
| `construct.credit`, `quote.self` | None | All |
| `--no-install` | Observed to stop Bun's automatic package install | Linux, Windows |
| This command surface, report, and exit codes | Partly built: `version`, `doctor`, `init`, `record add`, `validate`, `fmt`, `rules check`, `ingest`, the `source` commands except `admit` and `reject`, `review`, `coverage`, `passage`, `resolve` (Crossref and Internet Archive), `excerpt`, `retire`, `research list`, and `check` with `record.valid`, the `source.*` checks, `cite.key`, `bib.uncited`, `quote.present`, `quote.page`, `locator.extent`, `meta.source`, `meta.resolver`, `id.resolves`, `number.present`, and `coordinate.stray`, tested on one macOS system (Apple silicon). No change baseline is kept, so `check` always widens to `all`. `record.valid` does not yet check CSL type, variable, or locator terms, or the kind-specific rules of other record kinds. Annotations are not applied. No project lock is taken | The other commands and checks; Linux, Windows; an author's real project |

## Schema Basis

Reports and the support bundle are command envelopes, not graph records. They
reuse CONTRACT-001 value shapes by name. A separate UMF description is not added:
UMF validates no instances at project scale, so it would be a second unenforced
description.
