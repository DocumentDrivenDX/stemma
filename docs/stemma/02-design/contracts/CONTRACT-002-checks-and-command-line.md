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
**Related**: ADR-003, ADR-004, ADR-005, ADR-009, ADR-010, FR-10, FR-29 to FR-34, FR-39, FR-49, FR-52 to FR-54, FR-61, FR-68, FR-73, FR-74, FR-75, FR-84 to FR-90, FR-92, FR-93, FR-98

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
  address, `source locate --fetch`, and `research` fetches may use the network, and they send only the
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
| `record add <kind> --input <file\|-> [--actor <kind>:<name>]` | Add one record from a JSON object of its fields. A citation that names a `passage` gets its `quotation` and `locator` copied from it, and a quotation or locator typed beside `passage` is refused. Fills an absent `id`, `schema`, `kind`, `created` (then `--actor` is required), `admission` (`candidate`), `intake` (`parsed`, assumption), and a citation's sentence digest (normalizing that text). For an `authorship_mark` it also fills an absent `marked` from `created` and an absent `text_sha256` from `text` (CONTRACT-001 G). It never overwrites. For a kind that carries a review mark (CONTRACT-001 G), an absent `review` is written as unreviewed. A `review` whose state is `reviewed` is accepted only when `--actor` is a person; the input's own `created.by` or `review.decided.by` does not stand in for it. If `--actor` is absent or names a model or software, or the `by.kind` of `created` or of a `review.decided` that is present is not exactly `person`, it exits 5 and writes nothing; otherwise an absent `content_sha256` and `decided` are filled. A record that breaks a rule is still written, with its findings; input that is not usable JSON, an unsafe ID, or a number the canonical form would change exits 5 | M1 |
| `doctor` | Report Bun, SQLite, and external tool versions, paths, and platform test status | M1 |
| `validate [paths]` / `fmt [paths]` | Check records against CONTRACT-001; `fmt` rewrites to canonical form without changing values | M1 |
| `rules check` | Report malformed or duplicated rule headings in `rules.md` (CONTRACT-001 J) as `record.valid` results; `validate` includes it | M1 |
| `migrate --list` / `migrate --apply <list digest>` | Move a project to a newer format (Data Design), only when the author asks. `--list` writes nothing and prints every file change and the review marks, support records, confirmations, and annotations that would end, with a digest of that list. `--apply` writes only when the digest still matches, otherwise exits 5 with `stale_input`. Neither prompts | With the first format change |
| `ingest [--plan <file>] [--originals <dir>]... [--fetch] [--reconvert] [--refresh-lookups] --actor <kind>:<name>` | Run stages 1 and 2 (Core Pipeline). For each plan entry not yet captured, take the original from the named file or fetch its address, record an `upstream`, and convert it with the entry's settings, proposing page labels from the printed numbers. For every upstream record, find the original by hash in `.stemma/originals/` and the `--originals` directories, or fetch it with `--fetch` from the locations it lists (B2); restore a source file whose text is not held when the original is at hand (B2); convert it again and record the comparison when no current one exists; with `--reconvert`, convert every one again, and record a comparison only where the result differs from the current one. With `--fetch`, make each lookup an upstream lists that has no saved response; `--refresh-lookups` makes all of them again. Then run `check` and print its report and coverage. A refused or failed fetch is reported with what to supply; nothing is retried another way | M1 |
| `source pages <original> [--text-layer <file>] [--page-numbers <file>] [--out <file>]` | Propose a page map from the numbers printed in the pages' own text. It writes nothing in the project; `--out` writes a `PageSegment` list to a file that does not exist yet. Page-number data (an Internet Archive page-number file, or a list of `{"page_index", "label"}`) and labels stated inside the file are compared and reported; they label nothing on their own. A warning names labels that more than one page would carry | M1 |
| `source convert [<original>] --source <id> --acquired-at <time> --actor <kind>:<name> [--origin <text>] [--source-version <text>] [--held-at <text>] [--description <text>] [--image <file>]... [--text-layer <file> \| --transcription <file>] [--method born_text\|text_layer\|markup\|ocr\|manual] [--recognition <text>] [--tool <name> --tool-version <version>] [--page-map <file> \| --auto-pages] [--page-numbers <file>] [--identity <file>] [--coverage-note <text>] [--note <text>] [--name <name>]` | Convert an original into a new source file (CONTRACT-007). Without an original file, a `physical` original needs `--description`, `--held-at`, and a transcription; page images (`--image`) need a transcription too. Text with nothing but white space, an encrypted or damaged file, or a limit passed (for a PDF, also its memory bound: B, "Reading a PDF") exits 5 and writes nothing. When a source file already holds the same original for another source, nothing is merged: the command exits 5 with `already_held`. `--auto-pages` applies the proposed runs, dropping a run whose labels a longer run also gives, and reports each dropped run | M1 |
| `source label <text id> --page-map <file> --actor <kind>:<name>` | Replace a source file's page labels from a page map; text is unchanged | M1 |
| `source seal <text id> --actor person:<name> [--note <text>]` | Record edits made to part files: update part digests and stamp `changed`. It reports the reviews, comparisons, and passages that the edit made stale. A model or software actor is refused | M1 |
| `source verify <text id> --original <file> --actor <kind>:<name>` | Match the file's hash with the source file's original, convert it again with the recorded settings, compare each part (with person corrections undone), and save a `comparison_run` | M1 |
| `source compare <text id> --with <text file> --against <text> [--independent] --actor <kind>:<name>` | Compare another text of the same pages (form feeds between them) and save a `supplied_text` `comparison_run` | M1 |
| `review add <text id> --scope <scope> [--pages <indexes>] [--passage <id>] [--fields <list>] --against <text> --outcome <outcome> [--flag <index>\|<reading>\|<suggestion>\|<note>]... [--original-sha256 <hex>] [--note <text>] --actor <kind>:<name>` / `review list [<text id>]` | Record a person's review or a model's flag (CONTRACT-001 G); list reviews and whether each is current | M1 |
| `coverage [<text id>]` | For each source file, report the method, parts reviewed whole by a person, flags, each current or stale comparison run with per-page agreement, and every disagreement with both readings. It emits no finding | M1 |
| `passage find --source <id> <words>` | List the passage addresses where words occur under the quotation rules, with page or chapter | M1 |
| `passage capture --address <address> --actor <kind>:<name> [--note <text>]` | Make a `passage` from an address such as `txt-…/105:main:120-240` or a range `txt-…/105:main:900-+106:main:0-80`, copying its exact text and locator, and print them with the quotation as the joining rules render it | M1 |
| `cite format --input <file\|->` | Format notes in order and the bibliography from source records with citeproc-js and the pinned Chicago notes-and-bibliography style and locale (CONTRACT-006 G): input `{"notes": [[{"key", "locator", "label"?}], …]}`. A key that names no source is shown marked and reported as `cite.format` (exit 1); nothing is made up | M1 |
| `build report [<dir>] [--check] [--pdf]` | Build the report in `<dir>` (default `report`) as CONTRACT-006 I defines: `report.md`, `report.typ`, `verification.md`, the evidence ledger `evidence.json` (CONTRACT-006 J), and with `--pdf` `report.pdf` typeset by the pinned Typst. `--check` writes nothing and exits 1 when a file differs from what the build gives. A quotation that cannot be copied as recorded stops the build and writes nothing (exit 5). `--pdf` fetches the pinned Typst into the plugin's data directory once and checks its SHA-256 before use; a refused or failed fetch exits 4 after the text files are written | M1 |
| `source capture <original> [--source <id\|key>] --acquired-at <time> [--origin <text>] [--source-version <text>] --actor <kind>:<name>` | Record an original for a new or named source in an `upstream` record, and keep a copy in `.stemma/originals/`, without converting it. An original already held writes nothing unless another source is named. A later `source convert` of it must name the source (else `already_held`) and takes the time, origin, and version from that record; a conversion identical to one the source holds writes nothing | M1 |
| `source locate <upstream id\|source id\|key> (--url <address> --kind publisher\|web_archive\|archive [--fetch] \| --private <label> [--original <file>]) [--note <text>] --actor <kind>:<name>` | Add a location to an upstream record, or compare one already listed (B2). A source is named only when it has one upstream record. It writes that upstream record and nothing else: no source file, passage, or other record changes. A location already listed is not added twice; its kind and note are kept. With `--fetch`, the address is requested once and the digest of what it gave is recorded; a refused or failed request leaves the location a reference and says so. With `--original`, the file is hashed and its digest recorded for the private copy; no path is recorded. Exit 1 when what was compared is not the original or could not be fetched | M1 |
| `source enrich <id\|key> [--from <text>] [--add-identifier <scheme>:<value>]... [--set <name>=<value>]... [--author <name>]... [--replace] --actor <kind>:<name>` / `source enrich <id\|key> --lookup <resolution id> --actor <kind>:<name>` | Add library details to a source record and log each in its `changes`. Typed values need `--from`. A value that differs from a recorded one is listed as a disagreement and not written (exit 1) unless `--replace` is given. A saved lookup only fills absent title, authors, date, publisher, and container title; it does not take the date of a record of one volume of a set. Writes no source file | M1 |
| `source tag <id\|key>... [--add <tag>]... [--remove <tag>]... [--from <text>] --actor <kind>:<name>` | Add and remove tags (CONTRACT-001 G) on one or more sources and log each. Any invalid tag or source writes nothing | M1 |
| `source list [--tag <tag\|namespace:>]... [--stage record\|captured\|text] [--has identifiers\|lookup\|tags]...` | List non-retired sources that match every filter, with tag counts. The stage is how far a source has come: a record only, an original captured, or text held. It is no judgment and no finding | M1 |
| `source history <id\|key>` | From the records, list what happened to a source, oldest first, with who, when, and where from: creation, captures, conversions, comparisons, lookups, passages, reviews, logged changes, and retirements. A record keeps only its latest edit of text labels or sealed text | M1 |
| `source admit <id> \| source reject <id>` | Record the author's optional admission decision | M1 |
| `key rename <source id> <key>` | Rename a citation key, keeping the old one as an alias | M1 |
| `check [--changed \| --all]` | Run scripted checks; `--changed` (default) covers what changed since the check baseline (below); `--all` covers the project | M1 |
| `resolve <source id>... [--via crossref\|internet_archive --identifier <value>] --actor <kind>:<name>` | Look up identifiers in a catalogue by its documented interface and save `resolution` records with the responses; without `--via`, make the lookups the source's upstream records list, or, with none listed, look up the identifiers on the source record | M1 |
| `excerpt (--passage <id> \| --citation <id> \| --quotation <id> \| --source <id> --pages <printed pages>)` | Print a bounded piece of source text; with a citation, passage, or report quotation, mark the quotation in it (G) | M1 |
| `unreviewed list` | List every record in effect whose review mark does not apply, with its content digest and its original passages or manuscript origins, shown as data (B1). It writes nothing. Nothing waits for it | M1 |
| `reviewed <id>@<sha256>... --actor person:<name>` | Record that the author said they reviewed the named records, each by the digest that was shown (B1). A model or software actor is refused. Nothing waits for it | M1 |
| `retire <id…> --reason <text> --actor <kind>:<name> [--replaced-by <id>]` | Set `retired` on records, such as a replaced source file or a record the author rejects. The files stay. It lists the notes, claims, and citations that `source.changed` now flags. `--replaced-by` takes one record of the same kind | M1 |
| `rounds status` / `rounds choose --action <remove\|repoint\|replace\|bind\|close\|restore_text> [--repeats] …` | List remaining failing references and intake items; apply the author's choice to records and the Stemma copy, recheck, and save a `round_choice`. `remove` takes an occurrence out of the text and retires its record, or, given a listed source, takes it off `bibliography_include`. `repoint` binds the occurrence to a source already in the project, or corrects its locator. `replace` binds it to a source the author newly supplies in its place and records both sources. `bind` settles an intake item by binding its occurrence to one of its candidates. `close` settles an intake item that needs no citation, such as an unclassified note that cites nothing; it changes no finding. `bind` also takes a source the author names for an author-date item that has no suitable candidate, including a `year_parenthesis` item, for which it writes the citation. `restore_text` puts an occurrence that is not a citation back as the text found and retires its record; it causes no `takeover.removal` finding. Binding a reference-list item also moves every citation linked to that entry to the chosen source, and retires a provisional source nothing else uses, taking it off `bibliography_include`. `--repeats` applies one `bind` or `close` to every open item in an exact-repeat group (CONTRACT-003 F7) as one staged write, with one `round_choice` and recheck for each item; if any item cannot take it, nothing is written and that item is named. `rounds status` also counts `year_parenthesis` items and lists them on request | M1 |
| `review import <comment file>` | Import reviewer comments (CONTRACT-005) | M3 |
| `support list` / `support prepare <claim id> --passage <passage id>` / `support record --input <file>` | List needed verdicts as claim and passage pairs; emit the input bundle for one pair; validate and save a verdict (H) | M1 |
| `annotate --finding <key> --effect explain\|dismiss --reason <text>` / `annotate list` | Save an annotation (F), or list annotations and whether each applies | M1 |
| `import <file> --kind <csl-json\|biblatex\|ris> [--again]` / `export --kind <…> --out <file> [--batch <import id>] [--policy report\|strict]` | CONTRACT-003; `--again` imports bytes already imported; `--batch` exports one import batch | M1 |
| `takeover <docx\|pdf> [--library <file>…] [--again] [--separate]` | CONTRACT-003 intake of one Word file (F) or PDF manuscript (I), told apart by content; run once for each file of a manuscript; `--again` reruns on bytes already taken over, keeping every author choice and edit. A changed file under an earlier file's name only saves an `original_changed` item, and a file that repeats text already taken over writes nothing and exits 5 with `repeated_chapter`; `--separate`, the statement that it is a different text, adds either (CONTRACT-003 I). `pdf_unreadable` and `pdf_no_text` exit 3 | M1 |
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
| `browse [--no-open] [--idle-minutes <n>] [--originals <path>]...` | Serve the explorer for the `author` audience to a browser on this computer under CONTRACT-005 M, from the record files, writing nothing in the project. To show originals it looks only in `.stemma/originals/` and in the files and folders named with `--originals` (relative to the project, as for `ingest`); it fetches nothing. It says where it will look, and warns of a named path that is missing, is a symbolic link, or is neither a file nor a folder; such a path is not looked in, and nothing stops. It opens the browser through a private one-time launch file, or with `--no-open` prints that file's path. It prints the address without code or secret, then the data identity, build time, and warnings; `--format json` prints one object with `address`, `data_identity`, `launch_file`, `opened`, `build_ms`, `warnings`, and `originals` (the named places looked in). When the one-time code is redeemed it prints that the link was opened, with the time and never the code or secret (CONTRACT-005 M, rule 7), on standard error with `--format json`. It runs until interrupted or until `--idle-minutes` (default 60) pass without use, then exits 0; 3 when the project cannot be read at the start, and 5 when the port cannot be opened, or another live server holds the project's lock (`already_served`, with its address and process number; CONTRACT-005 N). No finding stops it | M3 |
| `mcp [--project <dir>] [--idle-minutes <n>] [--opener <absolute program>]` | Serve CONTRACT-005 N's tools to an agent host over standard input and output until the input closes. The plugin manifest declares it with no option, and the host starts it; the project is `CLAUDE_PROJECT_DIR`, or `--project`. `--opener` names a program that is given the launch file's path, and nothing else, in place of the system's opener (for tests and unusual desktops); no tool argument can set it. Standard output carries protocol messages only; `--format` has no effect. Exits 0 when the input closes or it is signaled | M3 |
| `record show <id>` / `record search <text> [--kind <kind>]` | Print one record with its forward and reverse links and its states (CONTRACT-005 J), a support result being a recorded model judgment; search records under the `search-fold` profile | M3 |
| `record trace <record id \| sentence locus>` | From a linked sentence to its claims and their evidence, and from a claim or evidence back to each linked sentence; broken, missing, and withheld links are named | M3 |
| `graph neighbors <record id> [--depth <n>] [--limit <n>]` | List the records and links connected to one record, and say what was left out | M3 |
| `map argument [--chapter <id> \| --branch <claim id>]` / `map places` | Print the argument-map or places-map data of CONTRACT-005 J, including states and what cannot be drawn, filtered for `--audience <author\|reviewer>` | M3 |
| `review comment add --export <dir> --claim <id> --input <text file> --file <comment file> [--reviewer <name>]` / `review comment list --file <comment file>` / `review comment edit\|remove <comment id> --file <comment file>` | Create or change a reviewer comment file (CONTRACT-005 E2) against a reviewer export, with no project; `edit` takes `--input`. Writes only that file | M3 |
| `disclosure` | Generate the AI-use disclosure from records | M2 |
| `scan release <path>…` | Search outputs and tracked files for restricted values and coordinate-shaped text, and outputs for source text beyond short excerpts, and report what is found | M3 |
| `graph export --audience <author\|reviewer> [--chapter <chapter id>] [--page] [--out <dir>]` / `graph status` | CONTRACT-005; `--chapter` scopes the export as CONTRACT-005 E states. `graph export` exits 0 when written with nothing open, 1 when written with `restricted_in_project`, `records_left_out`, `broken_references`, a coordinate warning, `manuscript_unavailable`, or `manuscript_incomplete` (no finding blocks it), 3 only when project settings or a records or sources directory cannot be read, and 5 for a refused output directory, including one holding a file of an export's name that is not an export's own. `graph status` takes `--audience` and `--out`, and exits 0 when current and 1 when stale or when there is no export | M3 |

**Command line first** (FR-49). Every function a user interface offers has a
command above, delivered no later than the interface. Both call one `core`
operation, so their results are equal. Zoom, pan, focus, selection, and layout
controls need no command. Browser compilation of preview pages (CONTRACT-005 D)
is a way of showing the manuscript; its command-line forms are `build draft`,
which typesets the same inputs, `graph export --page`, and `graph status`. A new
interface function needs its command added here first. The command-line forms of
the manuscript browser (CONTRACT-005 L) are `graph export`, which writes the same
manuscript view with each bibliography entry's citing places, and `excerpt` with
a report quotation's ID, which shows it in its source.

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

**Reading a PDF** (as built). `source pages` without `--text-layer`, `source
convert` of a PDF original (also with `--transcription` or `--text-layer`, which
count its pages), `source verify`, and `ingest` (when it captures and when it
compares again) parse a PDF. `source capture` and `check` do not. Each reading
is made in a process of its own, which gets the file's bytes, opens no listener,
makes no request, and writes no file. What the PDF library prints while it loads
is printed for a command's first reading only.

- **Memory bound.** A few KB of PDF can unpack to gigabytes, and the library
  unpacks them without yielding. A thread of the reading process, started before
  anything is read, looks at its resident memory every 5 ms and kills it once it
  is over 4 GiB (4,294,967,296 bytes; `doctor` shows it). Without that thread
  nothing is read. The command then names the file as the caller named it (for
  `ingest` comparing again, the path where it found the original) and the limit,
  and exits 5. No setting raises the limit.
- **Time.** The 300-second limit is looked at between pages; the process is
  also ended 10 seconds past it, which covers a single page that does not end.
- **What is written.** The command that reads writes nothing from a reading
  that fails. `ingest` stops there: the source files and records it finished
  before stay, and it can keep a whole copy of the file it was capturing in the
  ignored `.stemma/originals/`.
- **How the limit was chosen** (one macOS system, Apple silicon; the system's
  peak resident figure for the reading process). The 14 originals of the worked
  example, 2.7 to 62 MB with 5,022 pages, needed at most 901 MiB (836 pages).
  Invented books needed more: 5,000 pages with 450 separately placed words
  each, 3.1 GiB; a scan of 494 MiB and 900 pages, near the input limit, 3.8
  GiB, of which the thread saw about 3.1 GiB. A file that needs more than the
  bound is not read, even if it is a real book; none is known.
- **What the bound does not do.** The process passes it by what is taken between
  two looks. The system's peak figure also counts memory the process has freed
  and the system has not taken back, which the thread's figure leaves out: with
  crafted files of a few KB, that figure reached 4.8 GiB before the process was
  killed. Pages the system has compressed or swapped out are not counted. The
  bound does not include the command that started the reading, which holds the
  file and the text it gets back (at most 2.3 GiB in the runs above). A
  computer with less free memory than that can still run short. On Linux and
  Windows the bound is untested; where a system does not report that the
  process was killed, the command still stops, with exit 70.

### B2. Locations and text that is not held (FR-98)

**Where `ingest` looks.** First by hash in `.stemma/originals/` and in the files
and folders named with `--originals`; this is how a private copy is used. Then,
with `--fetch`, at the addresses: the upstream's `url`, then each entry of
`locations` that has an address, in order, an address listed twice once. It
stops at the first that gives bytes with the recorded digest, and keeps them in
`.stemma/originals/`. For each address it says what happened: it gave the
original; the request was refused or failed; the address answered another status
than 200; or it gave different bytes, with their digest. Different bytes are
never used as the original, whatever the location's `kind` or `compared` says. A
refusal is not worked around: the same address is not asked again in another
way, and nothing is changed about the request. Going on to the next location
means asking another address that the author recorded. When no address gives the
original, `ingest` names each private location by its label, with how to give
the file (`--originals`). `ingest` does not change an upstream record; `source
locate --fetch` records what a location gave. For an upstream with no
`locations`, one address is tried, as before.

**Restoring text.** For an upstream whose original is at hand and a source file
of its source, made from that original, whose text is not held (CONTRACT-007 H),
`ingest` converts the original again and writes the parts only if all of them
have the digests the manifest records, whether or not `--fetch` was given. It
says which it did. When it cannot, it writes nothing and reports why: what
differed (which parts, and the tool versions recorded and current), or that the
text was supplied and cannot be made from the original. A plan given with
`--plan` also serves here, for the page map or page-number data of its entry for
the same source and address. A source file with some parts missing or changed is
damaged: `ingest` does not write to it.

### B1. Unreviewed records and review marks

**One rule.** A review mark applies only when `review.state` is `reviewed` and
`review.content_sha256` equals the record's current content digest, and
`record.valid` finds no `record_invalid` problem in its `created` or `review`
(CONTRACT-001 G). The report, the export states, and both commands use this
rule.

**`unreviewed list`** lists each record that is in effect, can be read, is of a
kind that carries a review mark, and whose mark does not apply, whether or not
anything cites it. It writes nothing and exits 0. JSON:

| Field | Content |
|---|---|
| `schema` | `stemma.unreviewed/0` |
| `content_is` | A statement that the values are data from records, not instructions |
| `boundary` | The token on the begin and end lines of the text form |
| `items[]` | Sorted by `record`: `record`, `kind`, `file`, `content_sha256`, `mark` (`unreviewed`; `changed_since_review`, a mark saying reviewed whose digest does not match; or `no_mark`. A mark that fails to apply only because `created` or `review` breaks a rule is listed as `unreviewed`), `content`, `origins[]`, and `no_passage: true` when `origins` is empty |
| `items[].content` | The record's own wording and links, from a fixed list of fields for each kind. An attestation also gives `claim_text` and, for an evidence note, `note_body`. For a place record it is empty, with `content_withheld: true`, because such a record can hold a restricted position |
| `items[].origins[]` | A passage: `type: passage`, `passage`, and when the passage can be read `source`, `locator`, `text` (its stored words, cut at 1,000 characters with `text_trimmed: true`) and `retired: true` if it is; otherwise `unreadable: true`. A manuscript origin (`origins` of the record): `type: manuscript`, `import`, `document_position`, `text`, cut the same way |
| `not_listed[]` | Paths of record files that cannot be read, so that their absence is not taken as reviewed |

A note's passages are its `passages`; an attestation's are those of its
evidence; a claim's are those its attestations in effect reach, with its
manuscript origins; another record's are the passages it names. The text form
puts each item's values between begin and end lines carrying the token, with
hidden characters shown (as in G). The 1,000-character cut is an assumption;
`excerpt --passage` shows a whole passage.

**`reviewed`** takes one or more `<record id>@<64 hex>` arguments and
`--actor person:<name>`; a model or software actor, a malformed argument, two
digests for one record, an ID that names no readable record, a retired record,
a record of a kind that carries no review mark, an ID that two records hold, or
a file that rewriting would change exits 5 and writes nothing. A digest that differs from the record's
current one is stale: that record is left unmarked and reported with
`stale_input`, the others are marked, and the command exits 5. It does not print
the current digest; `unreviewed list` shows the record as it is now. A mark is
`state: reviewed`, `content_sha256`, `decided` (time and the person), and, when
the command names more than one record, one `batch` token that they share.
Nothing else in the record changes. JSON gives `marked[]` (`record`,
`content_sha256`), `stale[]` (`record`, `code`), `batch?`, and the
`record.valid` results of the files written. With nothing stale it exits 0, or
1 if a written record has a record finding. The output says that a mark records
what the author said and is not proof of who wrote it or that the record is
right.

No command edits a record, so the part of FR-23 that keeps a mark through the
author's own edit is not built: an edit made by hand reads as unreviewed until
the record is marked again (CONTRACT-001 G).

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
| `source.held` | FR-9 | A cited source has no non-retired source file holding text (`no_source_file`, `no_text`) | an unreadable or damaged source file, or one whose text is not held (`text_not_held`) |
| `source.pages` | FR-87 | A source file's part is missing (while others are present), edited without sealing, unlisted, out of sequence, or its pages do not run `0` to the original's page count minus one | a part cannot be read, or no listed part is here (`not_held`, FR-98) |
| `source.labels` | FR-87 | A printed label repeats, goes backwards, or advances further than the pages do, or a folio differs from its page's label | none |
| `source.footnotes` | FR-87 | A note marker has no note on its page or section, or a note has no marker, unless the note is continued | none |
| `source.original` | FR-85, FR-88 | A source file's original matches no upstream record of its source, or the current fresh conversion of the original differs from it, person corrections undone | the newest fresh conversion no longer applies to the parts or tool versions, or the text is not held (`text_not_held`, coverage) |
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
| `claim.complete` | FR-21 | A claim reaches no note, or lacks a confidence level or a reason | no note is reached and a record that could lead to one cannot be read |
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
its non-retired source files is damaged. With a manuscript, it emits one result
for each citation item there instead (see "Reading the manuscript"). A pass says
nothing about whether the text is a faithful reading of the original; its
evidence states the method and the review coverage.

**Structure checks.** `source.pages` emits a result for every non-retired source
file, `source.labels` for every paged one with a labelled page, and
`source.footnotes` for every one with a note or marker. `source.labels` compares
consecutive labelled pages of one numbering style: a label equal or lower, or
one that advances by more than the page index does, is an anomaly; unlabelled
pages in between are not. A jump is not an anomaly but a recorded observation,
in a passing result and the coverage summary, when all of these hold
(assumptions): the source file holds every page of the original and is sound;
the two pages are neighbours in it; the numbers run in step on both sides of the
jump; and the text runs on across it, shown by a word split between the two
pages that the source writes whole elsewhere, or by a run-in heading of two or
more words opening the second page, whose words the first page announces. A
sentence left unfinished is not enough. These signs can be absent where nothing
is missing, and then the jump stays a finding; they do not prove the original
was complete when it was made into a file. `source.original` emits a result for a source file
whose source has upstream records or that has a comparison run of its original.
A source file that does not pass `source.pages` is not used by other checks.

**Text that is not held** (FR-98; CONTRACT-007 H). When every listed part of a
source file is absent and its manifest is sound, `source.pages` gives one result
for the source file, `unverifiable` with `not_held`, not one failure for each
part. It is never a pass and is not called damage. It names the command that
fetches the text again. It is open, and no annotation dismisses it, so a project
with text that is not held is never labelled `checked_clean`; an annotation can
explain it. What rests on that text stays could-not-be-checked as for a damaged
source file, with wording that says the text is not here: `source.held`
(`text_not_held`), `meta.source` (`text_not_held`), `locator.extent`
(`text_not_held`, when no source file of the source is damaged or unread),
`quote.present`, `number.present`, and `source.changed`. `source.original` still
fails `original_not_upstream`, which needs only the manifest; otherwise it is
`unverifiable` (`text_not_held`) as coverage, whether or not a comparison is
recorded: the same cause has its open finding in `source.pages`. The verification
coverage of such a source file says its text is not here. A source file with
some parts missing or changed keeps the damage failures, one for each. No result
depends on why the text is not there.

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
listed as not compared.

Three rules read a catalogue's conventions (assumptions). A catalogue title
also matches when it is the record's `collection-title` followed by the record's
title, both whole. A name the record writes whole (`literal`) is also stated by
a heading of the form "Parent (qualifier). Body" when it is exactly "Body of
Parent" or "Body of the Parent". An Internet Archive item with a `volume`
statement is a volume of a set or serial, and its date may be the set's first
year. Where the record's year is later than that date: if the volume statement
ends with years in parentheses, the record's year must be the last of them, and
the first must not precede the catalogue date; otherwise `meta.resolver` fails.
With no such years, the year is listed as not compared when the copy bears it
out as `meta.source` would; otherwise the result is `unverifiable` (`set_date`),
as coverage. A record year earlier than the catalogue date, and every other
catalogue, compare as above.

**Corroboration, contradiction, and coverage.** A finding is evidence that
something is wrong. `meta.source` fails when the copy's stated identity disagrees
and the title page text does not bear out the record, or when the record's year
is not on the title page and an imprint line there gives another: a line that is
a year, or ends with one after a comma, colon, or semicolon. A year inside a
line, as in a span of years or a library stamp, is not read this way
(assumption). The year may also be read from a roman numeral in which an I was
recognized as `i`, `r`, `l`, `1`, `|`, or `!`, when the whole token then reads
as the record's year. A field the copy does not show passes when a saved lookup
agrees with the record on it, by the rules above, and no saved lookup differs on
it; the result names the lookup. This is evidence recorded independently of the
recognized text; what a model says it read is not evidence here. A catalogue
that differs is `meta.resolver`'s `fail`. A field neither shown, corroborated,
nor contradicted leaves the result `unverifiable` as **coverage**.

A source is valid at every stage of capture: metadata not yet recorded is never
a finding. These are coverage, with `coverage_only` set and `open` false:
`meta.source` `not_found_in_copy` and `nothing_to_compare`; `meta.resolver`
`no_lookup`, `lookup_silent`, and `set_date`; `id.resolves` `no_lookup`,
`lookup_error`, and `lookup_silent`; and `number.present` `several_citations`.
`id.resolves` covers `doi`, `ia`, and `gutenberg` identifiers with lookups;
other identifiers have `no_lookup`. A text report ends its findings with a
coverage summary: what was corroborated and how, what was not covered, and what
was observed in an original, with the sources concerned. It asks for nothing.

**`source.changed`** (assumptions). It follows the links records hold: a citation
to its passage and claims; a claim through its non-retired attestations to notes
and passages; a note to its passages and source; a passage to its source file
and source. A citation with no passage also rests on each source file of its
source that was retired at or after the citation record was created; times are
compared to the second and a tie is flagged. A passage whose part digests differ
from its address is `text_changed`; an edit elsewhere in the source file does
not affect it. Source details differ (`source_details_changed`) when they are
not those the passage was selected under, except that details only added since,
as the record's `changes` show, are not reported (FR-94). It emits one result for each non-retired note, claim, passage, or
citation that reaches a source or source file. Reason codes are
`depends_on_retired`, `text_changed`, `source_details_changed`, and
`record_unreadable`. Nothing yet records that the author has looked, other than a dismissal (F), so a finding otherwise stays listed.

**`claim.complete`** (assumptions beyond SD-005 BR-508). It emits one result for
each claim record in effect, the thesis included. It passes when the claim has a
`confidence` of `low`, `medium`, or `high`, a `reason` that is not blank, and an
attestation in effect for it whose evidence is a note in effect. An
attestation or note with a `record_invalid` problem does not count, as the graph
export leaves it out. The
attestation's stance does not matter, and review plays no part. A passage
cited directly is not a note. Otherwise it is `fail` with `claim_incomplete`,
and the evidence names each missing part (`note`, `confidence`, `reason`) and
each attestation of the claim that does not count, with why. When no note is
reached and either an attestation file cannot be read (it could be this claim's)
or the evidence of one of the claim's attestations that has no
`record_invalid` problem cannot be read, the result is
`unverifiable` with `record_unreadable`; the evidence still names a missing
confidence or reason. The finding may be explained or dismissed like any other.
It reads records only, so it also runs when manuscript files are present.

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
nothing for a citation whose key names no single source (`cite.key` reports it).

**Every result that did not pass is explained.** Each `fail` or `unverifiable`
result MUST say in plain language what is wrong or was not covered, show its
evidence, say why it matters, and say what can be done, or that nothing need be.
An open finding is evidence that something is wrong, or that a check that
applies to what an output relies on could not run; one the author cannot act on
is a Stemma defect. No result requires a person's review, approval, or dismissal
for a project to be checked clean, except that a printed page jump the checks
cannot account for stays open until the copy or its page map changes or the
author dismisses it. Reports group findings so that one cause is shown once with
the items it affects. Each group shows its count and a next step; for example,
every citation of one source with no source file is one group. Grouping is
presentation: `body.results[]` keeps one result for each subject, and no
outcome, count, or label changes (FR-93).

**Recorded details.** A person MAY record, in a current `source_details` review
(CONTRACT-001 G), what a title page shows. Where it covers every field a
`meta.source` or `meta.resolver` coverage result names, the result gains
`confirmed_by` and is shown as confirmed by the author, never as verified. It is
an optional addition to coverage. A `fail` from either check is unaffected, and
such a review confirms no other check.

**Applicability.** A check emits results only for what the project holds, and a
report lists nothing for a check that does not apply. `body.not_run[]` lists each
check that applies to the project's contents but that this version cannot run,
with reason `not_implemented`.

**Open findings and the label.** A finding is open when its result is `fail`,
or `unverifiable` and not coverage, and no applicable annotation dismisses it. A
`not_implemented` entry also counts as open. A report with scope `all` and
nothing open is labelled `checked_clean`; otherwise `open_findings`, with
counts. A could-not-check result that is not coverage counts as open, such as a
source file that is damaged or a record that cannot be read (assumption).
`checked clean` means these checks found nothing open. It does not mean that the
book is correct, that everything was covered, or that support verdicts were
verified. A report with scope `changed` carries no label.

**Unreviewed items.** The label reflects checks only. Records that the
manuscript reaches (a linked claim, its evidence, relations, constructs, and
methods, a cited source, or the plan or profile in use) and whose review mark
does not apply (B1), and cited sources that are not admitted, are listed in
`body.unreviewed[]` and counted in `body.summary`. They are not findings, are
never open, and do not affect the label. "Unverified" means only that something
has not yet been checked; it is not open by itself. As built, citation records,
or with a manuscript its claim spans and the citation items in them, reach
claims, each claim's attestations in effect, and
the notes in effect that are their evidence. Relations, constructs, methods,
plans, and profiles are not yet followed; `unreviewed list` lists every record,
reached or not.

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

**Citation items without a manuscript.** A project **has a manuscript** when
`manuscript/` holds at least one `.md` file. Without one, `cite.key` and
`bib.uncited` read the non-retired `citation` records; a record's `key`, or its
`source` when it has no key, names the source. With no citation record either,
each listed entry is `unverifiable` (`no_manuscript`). `cite.key` is
`unverifiable` (`source_unreadable`) when a key matches no source and some
source record cannot be read; `bib.uncited` likewise (`citation_unreadable`) for
unread citation records (assumptions).

**Reading the manuscript.** With a manuscript, `cite.key`, `source.held`,
`quote.present`, `quote.page`, `locator.extent`, `number.present`,
`bib.uncited`, and `source.changed` read it through the one reader of
CONTRACT-006 D. The manuscript says what is cited, quoted, and located now. A
citation record's `key`, `sentence`, `quotation`, and `locator` are then history:
none is checked, and a record that no occurrence names is not a citation.
`quote.present` still compares passages and note extracts, and a passage a
citation record names still counts as used. `body.inputs.manuscript` lists every
file under `manuscript/` with its digest, and `body.inputs.profiles` names
`sentence-split/0` when a chapter was read.

The rules below fill what CONTRACT-006 leaves open (assumptions).

- **Subject and place.** A result about an occurrence has as `subject` the
  citation record ID it carries, or else the chapter file's path. Its evidence
  names the file, line, and column, and the citing sentence. A subject holds no
  line number, so that an edit elsewhere does not change the finding key.
- **Locus.** The CONTRACT-006 D locus. Where one chapter holds the same sentence
  twice, the ordinal counts equal citations through both, so that no two share a
  key. A quotation's result adds the quotation's digest and its ordinal among
  equal ones, so that changed words are a new finding.
- **Annotations** bind the citing sentence and, where one is named, the source
  (F), never the citation record.
- **Quotations.** `quote.present` emits one result for each quotation whose
  citation names exactly one source, and `unverifiable`
  (`unattributed_quotation`) for one that cannot be attributed. For one
  attributed to a key that names no single source it emits nothing (`cite.key`
  reports it). A double quotation mark with no partner is `unverifiable`
  (`unpaired_quote_mark`), one result for each line that holds one, because what
  it quotes was not read. `quote.page` reads each attributed quotation whose
  citation has a page, folio, chapter, or paragraph locator.
- **Keys.** A citation with key `?` fails `cite.key` (`key_unbound`) and shows the
  text found at takeover when its record holds it. No other check reads it.
- **Figures.** `number.present` reads each sentence that has a citation, apart
  from its quotations and locators, and apart from the sentences of a block
  quotation, whose figures are quoted words. Citations that name one source count
  once. A sentence that cites more than one source is `several_citations` for
  each source.
- **Bibliography.** An entry is cited when a citation item names it. When it is
  not found cited and a chapter file could not be read, `bib.uncited` is
  `unverifiable` (`manuscript_unreadable`).
- **What a citation rests on.** `source.changed` follows the source the key names
  (a retired source that held the key, when none in effect does) and the claims
  of the claim spans around the citation. For an occurrence with a record, it
  also follows the record's `passage` while that passage belongs to a source the
  key names; otherwise the retired source files rule above applies from the
  record's creation. An occurrence with no record has no time from which to apply
  that rule. When its source has a retired source file and nothing else changed,
  the result is `unverifiable` (`retired_text_not_followed`) as coverage; the
  quotation, page, and locator checks still read the current text.
- **Files that cannot be read.** `record.valid` reports each chapter file the
  reader refuses as `unverifiable` with the reader's code
  (`manuscript_unsupported`, `manuscript_syntax`, or `manuscript_duplicate_id`),
  its line and column, and no manuscript text. No other check reads that file;
  the other files are still checked. `check` writes its report and exits 3
  (CONTRACT-006, Error Semantics). A file under `manuscript/` that is not a
  `.md` file is a coverage result (`manuscript_file_unread`).
- **References.** `record.valid` fails (`reference_dangling`) for a citation `id`
  or claim span ID that names no record of that kind. A record that cannot be
  read has its own finding.
- **Unreviewed items** are those the manuscript's citations and claim spans
  reach.

`claim.inactive`, `cite.unlinked`, `draft.marked`, and `quote.self` are not
built and stay `not_implemented` where they apply. The report does not yet list
the `.not-quote` passages (CONTRACT-006 C), and `validate` reads record files
only.

**Checks over a taken-over copy.** A version that provides `takeover` MUST read
the Stemma copy: after takeover, `cite.key`, `source.held`, `quote.present`,
`quote.page`, `locator.extent`, `number.present`, and `bib.uncited` run from it,
and none is left `not_implemented` or unread because manuscript files are present
(FR-73, FR-92). A citation with key `?` fails `cite.key`.
Each of these reads endnotes as it reads footnotes (FR-96).

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

**Quotations from a PDF chapter (not built).** In a chapter taken over from a
PDF, a quotation holding a hyphen that was kept at a line end also matches with
that hyphen removed. A pass that needs the removal says so in its evidence, as
for the join in source text (CONTRACT-003 I, **Quotations in the copy**).

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
| `body.results[]` | `finding_key`, `check`, `outcome`, `reason_code?`, `subject` (record ID or manuscript location), `sentence?`, `source?`, `item?`, `evidence[]` (E1), `fixes[]` (codes), `rules[]` (rule IDs), `message`, `why`, `suggestions[]`, `annotations[]` (ID, effect, who wrote it, and the reason), `coverage_only?`, `confirmed_by?`, `open` |
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

**A quotation in its source.** `--passage`, `--citation <id>`, and
`--quotation <id>` (a quotation ID of `report/report.json`, CONTRACT-006 I) mark
the quotation inside the printed text with a begin and an end mark that carry the
same token. The rules for when it is marked are those of the source view
(CONTRACT-005 K). The limits above do not change.

- `--passage` prints as before, up to 300 characters on each side, now as one
  block with the passage marked. JSON keeps its three `parts`; the quoted one has
  `quoted: true`. A passage that cannot be marked exits 5 and prints no source
  text.
- `--citation` and `--quotation` print the source view: the state and why; the
  cited work and the work it is part of; for a citation, its sentence, key,
  locator, and recorded quotation; for a report quotation, its listed
  `corrections`, `keep_hyphens`, join notes, and `checked` note, none of them
  applied to the source text. Each passage then has, for each page it lies on,
  that page's text in the passage's stream (main or notes) with the quoted piece
  marked, the printed label and its status, the recorded quality, and the
  original. A source with no pages gets at most 300 characters on each side, and
  the output says text was trimmed. At most 5 distinct pages and 30,000
  characters of source text: over either, the command exits 5 and prints no
  source text.
- The citing sentence, recorded quotation, source text, and review readings lie
  inside the token's data blocks. Bidirectional and other control characters are
  printed visibly, as `[U+202E]`.
- For each file of the original, the command hashes at read time any file of the
  recorded size in the originals cache or the project and says whether a file
  with the recorded digest is held. It prints no local path.
- A state other than `highlighted` prints the state and why, with no source text
  and exit 1. `retired` is reported only here. An ID that names no readable
  record or listed quotation exits 5.
- JSON output holds the views (CONTRACT-005 K) as printed, `held`, the boundary
  token, and `content_is`.

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
| One of several locations refused, failed, or gave different bytes during `ingest` | Reported for that address; the next location is tried | yes | None when a later one gives the original |
| No network or a refused request during `resolve` or `ingest` | No record written; dependants stay `unverifiable` or use the cached record and report its date | yes | Run again online |
| Support input stale | `support record` saves nothing and exits 5 with `stale_input` | yes | Prepare again and rerun the verdict |
| A digest given to `reviewed` is stale | That record is left unmarked and listed with `stale_input`; the others are marked; exit 5 | yes | Run `unreviewed list` and look at the record as it is now |
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
| This command surface, report, and exit codes | Partly built: `version`, `doctor`, `init`, `record add`, `validate`, `fmt`, `rules check`, `ingest`, the `source` commands except `admit` and `reject`, `review`, `coverage`, `passage`, `resolve` (Crossref and Internet Archive), `excerpt`, `retire`, `research list`, `graph export` for the `author` audience without `--chapter`, `graph status`, `browse` (its evidence and limits are in CONTRACT-005), `unreviewed list`, `reviewed`, and `check` with `record.valid`, `claim.complete`, the `source.*` checks, `cite.key`, `bib.uncited`, `quote.present`, `quote.page`, `locator.extent`, `meta.source`, `meta.resolver`, `id.resolves`, `number.present`, and `coordinate.stray`, tested on one macOS system (Apple silicon). No change baseline is kept, so `check` always widens to `all`. `record.valid` does not yet check CSL type, variable, or locator terms, or the kind-specific rules of other record kinds. `annotate` and annotations are built; `annotate list` is not, and nothing is redacted. No project lock is taken | The other commands and checks; Linux, Windows; an author's real project |

| Locations and text not held (B2, C) | Tests with invented sources and faked fetches on one macOS system; the PostgreSQL worked example's text was restored from its recorded addresses on one day | That a web address keeps giving the same bytes; restoring from supplied page maps in real use |

## Schema Basis

Reports and the support bundle are command envelopes, not graph records. They
reuse CONTRACT-001 value shapes by name. A separate UMF description is not added:
UMF validates no instances at project scale, so it would be a second unenforced
description.
