---
ddx:
  id: stemma.product-vision
  type: product-vision
  activity: discover
  authoring:
    home: repo
---

# Product Vision

## Mission Statement

Stemma helps people research technical subjects, such as databases, protocols,
programming languages, systems, standards, and software, and write academically
rigorous research reports and books about them with AI. It is a plugin for
researching, writing, and typesetting them that keeps a checkable chain from each
original source to each citation and supported claim, checks citations with
scripts, and explains what it finds.

Technical research is the focus and the first market. Scholars in the humanities
and other fields work along the same chain and are still served.

Stemma is first and foremost a Claude plugin. The author asks Claude in plain
words; the skill, the command line, and later the graph engine, the explorer,
and the website exist to support the plugin. The one thing a person ever
installs is the plugin. Whatever it needs, it and Claude obtain and set up
themselves.

## What Stemma Does

Stemma keeps an unbroken chain from original source to citation to supported
thesis. Each upstream source is captured with its hashes, converted to Markdown
source files in the author's repository, cited by passage address, linked to
claims, and carried into the sentences and footnotes of the output. Every link is
deterministic and checkable from the repository. The only non-deterministic step
is writing the thesis support and discussion, and Stemma's goal is that it is
built from verified sources and written so that a person can easily verify them,
with detailed footnotes that quote verbatim.

A technical subject's sources are documentation for a particular release, release
notes, specifications and standards, papers and preprints, source code and
repositories, and engineering write-ups. Many have no pages, many change, and
some disappear. So the chain has to say which version was read, hold that text,
say where the original can be found again, and give a place a reader can find.
Today Stemma ties the text to the bytes that were read and records a version that
is stated to it. It also records several places an original can be had, and can
fetch missing text again (FR-98 and FR-104, with limits). Much of the rest is not
built: the [PRD](../01-frame/prd.md) says which of FR-98 to FR-108 are.

Claude drives this for the author as one pipeline: capture the upstream sources,
convert and reverify them, identify research questions and capture the relevant
references from the source files, and assemble the research outputs.

## Positioning

For technologists who research technical subjects with AI, and must answer for
what their reports and books say, Stemma is a research and publishing workspace
that keeps the sources they used, ties each quotation to the copy it came from,
finds citation problems, explains them honestly, and shows what was checked
against which source. Researchers in the humanities and other fields who face the
same risk use the same workspace. Unlike general chat assistants, it does not ask
the author to trust the model: the model proposes, scripts check what they can,
and every build says what is still open. Unlike gatekeeping tools, it never stops
the author from writing or building. Unlike reference managers, it covers the
path from sources through an evidence graph to a typeset report or book. Unlike
one-off prompt libraries, it keeps the rules, records, and history with the
manuscript.

## Vision

An author puts a technical question, or hands over a chapter or report section,
to an AI assistant and gets back faster research and fluent prose in their own
voice. Every citation either resolves to a record in the project and the source's
text in the repository or is shown as unchecked. Every quotation and footnote,
code and tables included, is copied from that text by script. A reader can see
which release, revision, or commit of a source was cited, and can find the cited
place in it. A check report lists, in plain language, which quotations and
locators disagree with the source text, which could not be checked, which claims
lack a recorded support judgment, and what no one has reviewed yet, each with its
evidence and a suggested next step. The author can follow any sentence back to
its evidence, see how claims, objections, constructs, and places connect, and
tell a reviewer plainly what was checked and what rests on a record alone. Review
happens when the author chooses. No check shows that a source is right, or that
it supports the sentence that cites it.

AI-written prose is welcome where the author's publisher permits it. Invented
evidence is not. Stemma is for material that may be sent to a language model.

**North Star**: Every problem Stemma's checks can find in a research report or
book is explained in its check report, and no output with open findings is
called checked clean.

## User Experience

A technologist asks whether PostgreSQL is a sound default for a web
application's primary datastore, and where that stops. They state a thesis that
could turn out wrong. The assistant captures the documentation for a named
release, release notes, papers, and engineers' own accounts, converts them to
text in the project, looks for evidence against the thesis, and revises it when
the sources do not carry it. A script copies each quotation. The build writes the
report with its notes and bibliography and says what is still open. The sources'
full text sits in the author's project, which they need not publish. A copy of the
project that does not hold some source's text says so and shows what could not be
checked. That text can be fetched again from a recorded location, or made from a
copy the author gives, and is written only where it matches what the project
recorded (FR-104; a page that has changed may no longer give it). Not built:
places a reader can find on a web page that has no pages (FR-101), code quoted
line for line (FR-102, FR-108), and source files cited by commit and line
(FR-100).

A scholar with a half-referenced manuscript in Word opens it with Stemma.
Stemma reads the manuscript and reference libraries without changing them and
lists what it found, marked unreviewed. As the scholar adds sources, the
assistant captures them, matches references, and runs the checks. A page number
falls outside an article's range: the assistant shows the note, the source text,
why it
matters, and the options, and the scholar repoints it when ready. Fixes go into a
Stemma copy; the original files stay unchanged. Another quotation cannot be
found, and the scholar removes the reference and rewrites the sentence. They
stop for the day and resume later. In the first pilot they can also typeset a
basic PDF of the chapter, with a report of what is open.

An author starting a new report or book states the thesis, audience, and
citation style, and may add the theoretical constructs and research methodology then or later.
Assistant-found sources are shown as the assistant's finds until the author
decides on them.

Any build completes at any time. Its report explains what is open and counts
what is still unreviewed; when no check finding is open, the build is labelled
checked clean. The author explores the evidence
graph, argument and geographic maps, and typeset pages, and sends a reviewer the
PDF, an offline explorer, the check report, and a disclosure of AI use. The
reviewer can attach comments to claims and send back a file the author imports.

### Worked examples

Two projects in the repository use real sources:
[PostgreSQL for web applications](../../../examples/postgres-web-apps/README.md),
technical research from versioned documentation, release notes, engineering
articles, and papers, and
[Darwin and coral reefs](../../../examples/coral-reefs/README.md), a historical
argument from scanned books and articles. An AI model made both, and no person
has reviewed their records. Neither is a pilot, and neither shows that an author
can use Stemma or that others need it. The PostgreSQL project is not checked
clean. What it could not do when it was made is the source of much of FR-98 to
FR-108.

## Target Market

| Attribute | Description |
|-----------|-------------|
| Who | First, technologists who research technical subjects and write research reports, books, or long articles about them. Also academic researchers in the humanities and other fields |
| Pain | AI produces plausible references that do not exist, wrong authors, wrong page numbers, and invented quotations. Checking by hand costs the time the AI saved. In technical work, sources also change between releases, move, or disappear, and a pasted link does not say what it held when it was read (assumption) |
| Current Solution | Chat assistants plus manual checking; links and bookmarks, a reference manager, a word processor or Markdown files, and a separate typesetting step (assumption) |
| Why They Switch | The report or book rests on text the author holds, verification is automatic and explains itself, so the author can spend review time where it matters without being stopped, and the same source of truth feeds the typeset report or book |

## Key Value Propositions

| Value Proposition | Customer Benefit |
|-------------------|------------------|
| Rigorous reports and books from the sources a technical subject has | Documentation, specifications, papers, code, and engineering accounts can carry a footnoted argument. Several of these source forms are only partly supported or not built (FR-99 to FR-103 and FR-106 to FR-108) |
| The whole research captured in the project | A cited claim traces to a passage of a source's text and to the original it came from, by hash, or is shown as unchecked. Anyone with a copy that holds that text can check it, even after the page has changed |
| Scripted checks while the author works, rerun at every build | Citation failures surface early, with evidence and a suggested fix, and every build says whether any remain |
| Takeover of existing manuscripts | Authors adopt Stemma without starting over |
| An evidence graph with argument and geographic views | The author sees how claims, evidence, constructs, and places connect |
| Records in plain files, with no external reference manager | The author's work stays readable, comparable, and theirs |
| Voice and style profiles amended from the author's writing | Drafts sound closer to the author without changing the evidence |
| Typeset from the same files | One source of truth from notes to finished PDF |
| Disclosure that states its limits | Reviewers and publishers see what the AI did and what the record can and cannot show |

## Success Definition

These strategic goals guide learning and priorities; they imply no delivery
gate.

| Metric | Target |
|--------|--------|
| Technical research | A technologist pilot completes a technical research report, and its readers can tell which version of each source was cited and find each cited place (hypothesis; the second part needs FR-99 and FR-101) |
| Findings an author can understand and act on | Every finding in a pilot report has evidence, a reason it matters, and a suggested action; pilot authors report no unexplained findings (hypothesis) |
| Author time spent on manual citation checking | A large reduction against the author's prior method (hypothesis; to be measured with pilot authors) |
| Takeover | A pilot author resolves the references of an existing chapter (hypothesis) |
| Book build | One command produces the camera-ready PDF from the project files (hypothesis until a pilot builds a chapter) |
| Adoption across personas | Pilots complete a report or a book chapter in each writing persona in the PRD (hypothesis) |

## Why Now

AI assistants now draft and search at a level that changes how research is done,
and technologists can ask one to survey a database or a protocol (assumption that
many do). An answer that does not say which version it read, or hold what it
read, cannot be checked later. The failure mode is well documented: fabricated citations have reached
government reports and journals, and scholarly communities are responding with
bans and disclosure rules. Some authors who use AI openly already maintain
hand-built governance documents and audits that catch the errors. Those practices work and are not yet a reusable tool.
Packaging them as scripts and plain reports puts them within reach of authors
with less time and less AI experience.
