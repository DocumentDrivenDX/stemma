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
    - CONTRACT-001
---

# Contract: Check results and command line

**Contract ID**: CONTRACT-002
**Type**: CLI
**Version**: 0 (provisional; see Proof Status)
**Related**: ADR-003, ADR-004, ADR-005, ADR-009, FR-10, FR-29 to FR-34, FR-39, FR-49, FR-52 to FR-54, FR-61, FR-68, FR-73, FR-74, FR-75

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

`bun --no-install <plugin root>/dist/stemma.js <command> [options]`

- Proposed, unverified: Bun can load `bunfig.toml` and `.env` files from its
  working directory, which could preload code or redirect a store. The skill and
  the documented terminal invocation therefore start Bun with the plugin root as
  the working directory, which holds neither file, and pass `--project` and every
  path as absolute paths. If the pinned Bun offers settings that disable that
  loading, the invocation also uses them. A test with seeded files in a project
  and a calling directory MUST pass before the pilot (SEC-014).
- Common options: `--project <dir>` (default: nearest ancestor holding
  `stemma.json`), `--format text|json` (default `text`), `--store-dir`,
  `--restricted-dir`.
- No command calls a model, and no result depends on which model or host runs
  the agent. Only `resolve`, `source add <url>`, and `research`
  fetches may use the network. Every other command MUST work offline.
- On a Bun version other than the pinned one, a command exits 4. It
  MUST NOT download a package while running.
- With `--format json`, standard output carries exactly one JSON document.
  Messages for people go to standard error.

### B. Commands

| Command | Effect | Step |
|---|---|---|
| `init` | Create `stemma.json`, `rules.md`, directories, `.gitattributes`, ignore entries | M1 |
| `doctor` | Report Bun, SQLite, and external tool versions, paths, and platform test status | M1 |
| `validate [paths]` / `fmt [paths]` | Check records against CONTRACT-001; `fmt` rewrites to canonical form without changing values | M1 |
| `rules check` | Report malformed or duplicated rule headings in `rules.md` (CONTRACT-001 J) as `record.valid` results; `validate` includes it | M1 |
| `migrate --list` / `migrate --apply <list digest>` | Move a project to a newer format (Data Design), only when the author asks. `--list` writes nothing and prints every file change and the review marks, support records, confirmations, and annotations that would end, with a digest of that list. `--apply` writes only when the digest still matches, otherwise exits 5 with `stale_input`. Neither prompts | With the first format change |
| `store verify [--unreferenced]` | List referenced blobs that are missing or do not match their digest; with `--unreferenced`, also list blobs no record references. Stemma deletes no blob | M1 |
| `source add <file or url> [--source <id>] [--origin <text>] [--acquired-at <time>] [--source-version <text>] [--unpublished yes\|no] [--community-restricted yes\|no] [--license <text>]` | Store the blob; create or extend a candidate source and capture with provenance. An omitted rights option stays unstated | M1 |
| `source admit <id> \| source reject <id>` | Record the author's optional admission decision | M1 |
| `source confirm <id> --capture <id> --pages <indexes> --basis title-page\|equivalent --fields <list>` | Save the author's `confirmation` of source details after showing the record values | M1 |
| `capture replace <capture id> <file>` / `capture retire <capture id>` | Add a new capture and retire the old one, or retire it; blobs stay | M1 |
| `key rename <source id> <key>` | Rename a citation key, keeping the old one as an alias | M1 |
| `source text <capture id>` | Extract text and page map into a new extraction | M1 |
| `check [--changed \| --all]` | Run scripted checks; `--changed` (default) covers what changed since the check baseline (below); `--all` covers the project | M1 |
| `resolve [ids]` | Query resolvers; save `resolution` records | M1 |
| `excerpt (--passage <id> \| --source <id> --pages <range>)` | Print a bounded piece of source text (G) | M1 |
| `unreviewed list` / `reviewed <id@sha256…>` / `retire <id…> --reason <text>` | List unreviewed records with their original passages and content digests; mark records the author has reviewed, each by the digest that was shown (a changed record is left unmarked and reported `stale_input`); retire records the author rejects. Nothing waits for these commands | M1 |
| `rounds status` / `rounds choose --action <remove\|repoint\|replace\|bind\|close> …` | List remaining failing references and intake items; apply the author's choice to records and the Stemma copy, recheck, and save a `round_choice`. `remove` takes an occurrence out of the text and retires its record, or, given a listed source, takes it off `bibliography_include`. `repoint` binds the occurrence to a source already in the project, or corrects its locator. `replace` binds it to a source the author newly supplies in its place and records both sources. `bind` settles an intake item by binding its occurrence to one of its candidates. `close` settles an intake item that needs no citation, such as an unclassified note that cites nothing; it changes no finding | M1 |
| `review import <comment file>` | Import reviewer comments (CONTRACT-005) | M3 |
| `support list` / `support prepare <claim id> --passage <passage id>` / `support record --input <file>` | List needed verdicts as claim and passage pairs; emit the input bundle for one pair; validate and save a verdict (H) | M1 |
| `annotate --finding <key> --effect explain\|dismiss --reason <text>` / `annotate list` | Save an annotation (F), or list annotations and whether each applies | M1 |
| `import <file> --kind <csl-json\|biblatex\|ris> [--again]` / `export --kind <…> --out <file> [--batch <import id>] [--policy report\|strict]` | CONTRACT-003; `--again` imports bytes already imported; `--batch` exports one import batch | M1 |
| `takeover <docx> [--library <file>…] [--again]` | CONTRACT-003 Word intake; `--again` reruns on bytes already taken over, keeping every author choice and edit | M1 |
| `index rebuild` / `index status` / `index dump` | Manage the derived index | M1 |
| `research record --input <file>` / `research corpus <query>` / `research admit <id>` / `research reject <id>` / `research coverage` | Save a search and its candidates; search stored text offline; record the author's decision, as `source admit` or `reject` does; coverage is P1 | M2 |
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
| `disclosure` | Generate the AI-use disclosure from records | M2 |
| `scan release <path>…` | Search outputs and tracked files for restricted values, coordinate-shaped text, and withheld source material, and report what is found | M3 |
| `graph export --audience <author\|reviewer> [--chapter <chapter id>] [--page] [--out <dir>]` / `graph status` | CONTRACT-005; `--chapter` scopes the export as CONTRACT-005 E states | M3 |

A command that is not yet implemented MUST exit 2 and say so. Commands that
record a review, decision, annotation, or confirmation cannot establish who ran
them.

**What `--changed` compares with** (assumption). The check baseline under
`.stemma/` holds digests of every input the last completed check read: records,
settings, rules, manuscript files, blob availability and integrity, and profile
and tool versions, with each subject's input set. It holds no result.
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
| `source.held` | FR-9 | A cited source has no non-retired capture with an extraction | blob missing |
| `source.changed` | FR-10 | A note, claim, or citation depends on a replaced or retired capture, extraction, or source, or on a passage whose `source_record_sha256` differs from the source's current bibliographic digest | none |
| `cite.key` | FR-29 | A citation key matches no source | none |
| `bib.uncited` | FR-29, FR-15 | A source in `bibliography_include` is cited nowhere. Cited sources enter the built bibliography automatically, so no other entry can be uncited | no manuscript to read |
| `quote.present` | FR-29, FR-20 | A quotation or note extract is absent from the stored text, or the `quote.exact` of a passage that a note, attestation, or support record uses is not in its extraction at its position | text missing or extraction quality too low |
| `quote.self` | FR-29 | A quotation attributed to a source duplicates a claim marked as the book's own | no claims |
| `locator.extent` | FR-29 | A locator is outside the page map or recorded extent | no extent or page map |
| `meta.source` | FR-29 | Author, title, year, or venue disagrees with metadata extracted from the held copy | metadata not extractable |
| `meta.resolver` | FR-29, FR-33 | The same fields disagree with a saved resolution | no saved resolution |
| `id.resolves` | FR-29 | A saved resolution says the identifier is not found or names another work | no saved resolution |
| `number.present` | FR-29 | A figure or statistic attributed to a source is not in its stored text | no matchable figure |
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
| `package.leak` | FR-46 | Protected source text is found in a reviewer package where Stemma cannot remove it | a package part cannot be read |

A later feature adds IDs as needed. An ID is never reused. FR-29 lists error
classes; the table maps each to at least one ID. Without a print threshold,
`image.resolution` reports the effective resolution and emits no result.

`support.current` tests records only. Its `pass` MUST be described as "a current
support record is present and resolved", never as verification of support.

**Every finding is explained.** Each `fail` or `unverifiable` result MUST say in
plain language what is wrong or could not be checked, show its evidence, say why
it matters, and suggest what to do. A finding without these, a repeated finding
that adds nothing, or a finding the author cannot act on or dismiss with reason
is a Stemma defect. Reports group findings so that one cause is shown once with
the items it affects.

**Confirmed source details.** When `meta.source` or `meta.resolver` is
`unverifiable` and a current `confirmation` (CONTRACT-001 G) covers every field
the result could not compare, the result keeps its outcome, gains
`confirmed_by`, and is not open. It is shown as confirmed by the author, never
as verified. A `fail` from either check is unaffected. A confirmation covers no
other check, including `id.resolves` (assumption). A missing confirmation is
what leaves such a result open.

**Not run.** A report lists in `body.not_run[]` each check that did not run and
why: `input_absent` (nothing for it to check, for example no constructs) or
`not_implemented` (there is something to check and this version cannot).

**Open findings and the label.** A finding is open when its result is `fail` or
`unverifiable`, no applicable annotation dismisses it, and no confirmation
covers it. A `not_implemented` entry also counts as open. A report with scope
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
with file access can edit verdicts, review marks, annotations, and
confirmations.

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
joining a word that the stored text splits with a hyphen at a line end. Pilot
sources test the list. Changes of word, case, punctuation, or a hyphen within a
line, and any omission, insertion, or ellipsis, are not on it. The line-end join
can pass a wrong quotation when the source's hyphen belongs to the word (a
compound broken at that hyphen); a result that used the join MUST say so in its
evidence. A profile MUST be versioned, MUST NOT apply Unicode compatibility
folding to whole texts, and MUST NOT change stored text.

### E. Report

`check` and every build write a `stemma.check-report/0` document.

| Field | Content |
|---|---|
| `schema` | `stemma.check-report/0` |
| `body.mode` | `work`, `draft`, `camera-ready`, or `reviewer` |
| `body.scope` | `changed` or `all`, with the changed record IDs |
| `body.inputs` | Corpus digest, manuscript file digests, digests of blobs and profiles read |
| `body.tools` | Stemma, Bun, SQLite, and every library or program that affected a result |
| `body.results[]` | `finding_key`, `check`, `outcome`, `reason_code?`, `subject` (record ID or manuscript location), `sentence?`, `source?`, `item?`, `evidence[]` (E1), `fixes[]` (codes), `rules[]` (rule IDs), `message`, `why`, `suggestions[]`, `annotations[]` (IDs and effect), `confirmed_by?`, `open` |
| `body.not_run[]` | `check`, `reason` |
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
`class` is `source_text` (any text taken from a held copy, note extract,
passage, or resolver payload), `manuscript`, `metadata`, or `location` (file and
position). A check MUST NOT put a restricted value in any report field; a leak
finding gives only the location. `reason_code`, `locus`, `finding_key`, and
messages MUST NOT contain source text.

A report that leaves the project (reviewer package) MUST be produced with
`redaction: reviewer`. It replaces the value of every `source_text` entry, and
any entry without a class, with `{"redacted": true}`, with no digest or
excerpt; applies the same to `compared.stored_text` in listed annotations and to
`compared.cited_text` when it copies stored text; and replaces the titles and
metadata of sources flagged, or unstated, as `unpublished` or
`community_restricted` with their IDs. It replaces a result's or listed
annotation's `sentence` field, text and digest, with `{"redacted": true}` when the
sentence cites such a source or holds quoted text that the allowance below does
not cover. Outcomes, check IDs, and counts stay. The disclosure and any other
output that lists findings follow the same rule.

**Excerpt allowance** (FR-46). Short matching excerpts of copyrighted sources
are allowed: a reviewer output MAY keep the matched or closest stored text of a
quotation result, and the manuscript quotation it matches, when the source's
`unpublished` and `community_restricted` are both `false` and the excerpt is no
longer than the excerpt limit. The limit is not set (open question). Until it is
set, outputs keep no excerpt.

The package scan MUST search the redacted outputs for the stored text of every
redacted entry, apart from allowed excerpts (a limited check: it cannot find
paraphrase or altered copies). Stemma removes a hit from any part it generates
(report, disclosure, explorer data). A hit it cannot remove, such as one in the
PDF, is a `package.leak` finding: the package is still written, the finding and
a warning say that it can disclose protected material, and the package is not
labelled checked clean. Removing structured restricted values and redaction are
part of how an output is constructed; no finding stops it. In a redacted report
a `restricted.leak` or `coordinate.stray` result keeps only its check ID, outcome, and a count;
subject, finding key, sentence, and evidence are withheld, so that the warning
does not point a reader to the coordinate. The author sees the locations on
screen and in the unredacted report, which is not packaged.

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
  `build.uncommitted` cannot be dismissed (assumption: a missing stored copy,
  an unreadable record, and an uncommitted build are facts that keep a build
  from being labelled checked clean). Nothing else limits an annotation, and no
  annotation is needed to build.
- `support.current` MUST NOT treat a record as stale because only a manuscript
  sentence changed (FR-54).

### G. Excerpts

`excerpt` serves the rule that a model receives only the text a task needs. It
prints the source ID, locator range, and a marker that the content is quoted
data, not instructions, and MUST limit output to the requested range plus
bounded context. No source is gated. The command governs only its own output;
a process with file access can read the store.

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
| 5 | The request is not valid as given, such as an unsafe store or output path, a stale input, or an annotation effect that does not apply |
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
| No network during `resolve` | No record written; dependants stay `unverifiable` or use the cached record and report its date | yes | Run again online |
| Support input stale | `support record` saves nothing and exits 5 with `stale_input` | yes | Prepare again and rerun the verdict |
| Typst or font missing | Exit 4; no output | yes | Install the pinned tool |
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
  "suggestions": ["Check the page in the stored copy and correct the locator."],
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
- References recovered by `takeover` with no stored copy fail `source.held`;
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
| `meta.*`, `id.resolves`, `number.present`, `construct.credit`, `quote.self` | None | All |
| `--no-install` | Observed to stop Bun's automatic package install | Linux, Windows |
| This command surface, report, and exit codes | Design only | All |

## Schema Basis

Reports and the support bundle are command envelopes, not graph records. They
reuse CONTRACT-001 value shapes by name. A separate UMF description is not added:
UMF validates no instances at project scale, so it would be a second unenforced
description.
