# Worked example: PostgreSQL for web applications

A Stemma project on when PostgreSQL is a sound default for a web application's
primary datastore, and where that default ends. It cites web documentation,
release notes, engineering articles and two papers: sources that mostly have no
pages, and many of which may be read and quoted but not republished.

All of it was made by an AI model (claude-sonnet-5-5). **No person has reviewed
any record, quotation, place, bibliographic detail, or the report.** The source
records are candidates that nobody has admitted.

## What is here

| Folder or file | What it holds |
|---|---|
| `sources/` | One folder per work: `source.md`, the manifest, and the converted text, one file per section of a web page or per page of a PDF. The text of seven works is **not committed** (see below); their manifests are |
| `records/` | A record of each work, with its licence and where that was read; where each original came from (address, retrieval time, SHA-256) and other [locations](#where-else-each-original-was-looked-for) of it; each comparison with the original; the passages quoted; paraphrase notes; claims, with confidence and reason, linked to the notes by attestations that support, qualify or contradict them; and one citation for each quotation |
| `plan.json` | What was captured, from which address, and how it was converted |
| `report/` | The research report, *The Cost of One Writer*: its manuscript (`report.src`), quotation list (`report.json`), the built `report.md` and `report.typ`, the verification table, the evidence ledger, and the research log |
| `research/` | A note on how sources were chosen, how they were reached, and what is missing |
| `NOTICE-PostgreSQL` | The copyright and permission notice for the committed PostgreSQL pages |

No original, PDF or image is committed. The typeset `report.pdf` is rebuilt, not
committed.

## The works

"Held" means the converted text is committed here. For the others, the records,
the address, retrieval time and SHA-256 of the original, the short quotations,
the citations and the report are committed, and the text has to be fetched again.
All licence statements were looked for on 2026-11-27. "None found" is a
statement about where we looked, not about what permission exists. The same
details are in the `rights` field of each source record.

| Key | Work | Licence | Where it was read | Text |
|---|---|---|---|---|
| `pg18arch` | PostgreSQL 18 documentation, Architectural Fundamentals | PostgreSQL License | [Legal notice](https://www.postgresql.org/docs/18/legalnotice.html), [licence page](https://www.postgresql.org/about/licence/) | Held |
| `pg18connections` | PostgreSQL 18, Connections and Authentication | PostgreSQL License | as above | Held |
| `pg18vacuum` | PostgreSQL 18, Routine Vacuuming | PostgreSQL License | as above | Held |
| `pg18hot` | PostgreSQL 18, Heap-Only Tuples | PostgreSQL License | as above | Held |
| `pg18standby` | PostgreSQL 18, Log-Shipping Standby Servers | PostgreSQL License | as above | Held |
| `pg18ha` | PostgreSQL 18, Comparison of Different Solutions | PostgreSQL License | as above | Held |
| `pg18isolation` | PostgreSQL 18, Transaction Isolation | PostgreSQL License | as above | Held |
| `pg18json` | PostgreSQL 18, JSON Types | PostgreSQL License | as above | Held |
| `pg19notes` | PostgreSQL 19 release notes | PostgreSQL License | [Legal notice, 19](https://www.postgresql.org/docs/19/legalnotice.html), [licence page](https://www.postgresql.org/about/licence/) | Held |
| `pg96notes` | PostgreSQL 9.6 release notes | PostgreSQL License | [Licence page](https://www.postgresql.org/about/licence/), [legal notice](https://www.postgresql.org/docs/18/legalnotice.html); the notes page itself was not found to carry its own statement | Held |
| `pgbouncer` | PgBouncer, Features | None found | [The page](https://www.pgbouncer.org/features.html), [the home page](https://www.pgbouncer.org/), and the root of the website's repository, which has no licence file. The program's licence was not taken to cover the website | Fetch again |
| `ports2012` | Ports and Grittner, 2012, *PVLDB* 5(12) | CC BY-NC-ND 3.0 | First page of [the paper](https://www.vldb.org/pvldb/vol5/p1850_danrkports_vldb2012.pdf). No-derivatives licences are treated here as not allowing a converted text to be republished | Fetch again |
| `wu2017` | Wu and others, 2017, *PVLDB* 10(7) | CC BY-NC-ND 4.0 | First page of [the paper](https://www.vldb.org/pvldb/vol10/p781-Wu.pdf). Treated the same way | Fetch again |
| `sentry2015` | Cramer, "Transaction ID Wraparound in Postgres" | None found | [The article](https://blog.sentry.io/transaction-id-wraparound-in-postgres/) | Fetch again |
| `notion2021` | Fidalgo, "Herding Elephants" | None found | [The article](https://www.notion.com/blog/sharding-postgres-at-notion), whose footer claims copyright | Fetch again |
| `figma2024` | Steele, "How Figma's Databases Team Lived to Tell the Scale" | None found | [The article](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) | Fetch again |
| `pavlo2023` | Pavlo and Zhang, "The Part of PostgreSQL We Hate the Most" | None found | [The article](https://www.cs.cmu.edu/~pavlo/blog/2023/04/the-part-of-postgresql-we-hate-the-most.html) | Fetch again |

The list that keeps those seven texts out of Git is in [`.gitignore`](.gitignore),
one line per work.

## Build and check it

From the repository root, after `./scripts/dev.sh build`:

```sh
stemma() { ./.tools/bun --no-install --no-env-file --config=/dev/null dist/stemma.js "$@" --project examples/postgres-web-apps; }

stemma check --all
STEMMA_DATA="$PWD/.tools" stemma build report report --pdf    # report.md and report.pdf
stemma build report report --check                            # fails if stale
```

`build report` needs the text of every quoted work. Fetch the missing text first.

### Fetching the text that is not committed

This uses the network. It asks for each original that is not already in the
project's ignored `.stemma/originals/` folder, those of the committed works
included. After the `stemma()` line above:

```sh
stemma ingest --fetch --actor person:<your name>
```

For each work, it asks the recorded address, then the other locations in the
work's upstream record, until one gives bytes with the recorded SHA-256. It then
converts the original again and writes the missing text only if every part has
the digest that the committed manifest records, so that each passage again
points at the words it was copied from. It says what each address gave.

When no address gives the recorded bytes, it converts what they did give, and
writes the text only under the same condition. It then says that the text is
restored and that the fetched copy is not the recorded original. This applies to
`notion2021`, whose server gave different bytes on each request seen: one fetch
restored its text this way, and an attempt with another fetch converted to
different text and gave none. Any web article can change at any time, so this may
stop working for any of them. A refused request is reported and not worked
around.

If you have a copy of an original, give its file or folder instead, with no
network: `stemma ingest --originals <folder> --actor person:<your name>`. It is
used only when its SHA-256 is the recorded one.

### Where else each original was looked for

Each upstream record in `records/upstreams/` lists one capture at the Internet
Archive, found with its
[availability API](https://archive.org/wayback/available?url=https://www.pgbouncer.org/features.html)
and asked for on 2026-11-27 with `stemma source locate --fetch`, in the form with
`id_` after the timestamp, which gives a capture without the archive's own
markup. No new capture was requested. The record holds the digest of what each
gave. A location is a reference: nothing from it is stored here, and it may give
something else later.

| Gave | Works |
|---|---|
| The recorded original, byte for byte | `pavlo2023`, `pgbouncer`, `ports2012`, `wu2017` |
| Other bytes, so it is not the original | the ten PostgreSQL pages, `figma2024`, `notion2021`, `sentry2015` |

For `pg18arch`, the one capture compared line by line, the differences are those
of an earlier day's page, such as its news banner and style-sheet versions. The
others were not examined. `notion2021` also lists its live address, which gave
other bytes than the recorded ones.

## Without the text that is not committed

In a copy holding only what is committed:

- `build report` and `build report --check` stop with exit code 5, naming the
  first quotation whose text is not held. They write nothing, and say that
  whether the report is current cannot be told.
- `check --all` does not pass those works. For each of the seven it reports once
  that the source's text is not held here. Their quotations, pages and places,
  and what rests on them, could not be checked. Nothing is reported as damaged or
  as failed for this.

The report as committed, with its quotations, can still be read. Its quotations
from those seven works cannot be checked from this repository alone.

## What the check finds

With all the text present, the project is **not checked clean**: two findings
are open, and this version of Stemma does not run two kinds of check that apply
(your own claims presented as quotations, and claim-support records).

| Finding | Where | Why it is open |
|---|---|---|
| `meta.source` | `pg96notes` | The captured page's title is the general "PostgreSQL: Release Notes". Stemma compares the record with that title and with the first parts of the converted page, which are navigation, so it finds neither the record's title nor its author, year or series there. The page does state "Release 9.6" and the date 2016-09-29 further down. The record was not changed to match the page title, which would make the reference worse |
| `source.footnotes` | `pg18json` | The page has one footnote, 7. Conversion captured the note's body but not its marker as a marker: the page marks it with a link of the class `footnote`, which the converter reads as a note rather than a reference to one. The marker's characters and the note's words are both in the text. No quotation comes from the note |

Checked results mean only that those checks found nothing wrong. No check says
that a source supports the sentence that cites it. The 14 claims, with their
confidence and reasons, are the model's own judgements.

## What was compared

| Compared | How |
|---|---|
| The five quotations from the two papers, and their page numbers | A model read images of those PDF pages |
| The other quotations | A script looked for each in a second extraction of the same stored HTML, made with Python's HTML parser. All were found. No live or rendered web page was compared |
| Every source file | A fresh conversion of the same original, which shows the text is reproducible, not that it is right |

## Reading the places in the notes

The two papers are cited by printed page. The web pages have none, so a note says
"para. 87". That number is Stemma's count of paragraph-like blocks through the
whole converted page, menus and tag lists included. It is not printed on the page
and cannot be found by counting what a browser shows. To find a quoted place, use
the quoted words, or `stemma excerpt --passage <id>` with the text present.

The documentation is cited at versioned addresses. A versioned page still changes
with minor releases; the retrieval time and SHA-256 in `records/upstreams/` say
which copy was read.

## Gaps

- **OpenAI's 2026 article on scaling PostgreSQL** is not used: OpenAI's
  [terms of use](https://openai.com/policies/terms-of-use/) cover its websites
  and do not allow programmatic extraction.
- **Uber's 2016 article on leaving PostgreSQL** is not used: the address refused
  the request (406), and it was not fetched any other way.
- **Notion's terms** could not be read, because the page is drawn by script. Its
  robots.txt allows the article that is cited.
- Nothing here measures PostgreSQL 18 or 19, compares current releases with
  other databases, or shows how often applications meet the limits discussed.
- Sources were chosen by a model from what it already knew; no systematic search
  was run.

See [`research/`](research/) and
[`report/research-log.md`](report/research-log.md).
