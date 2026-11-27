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

Stemma is a plugin that helps scholars research, write, and typeset books with
AI, keeping a checkable chain from each original source to each citation and
supported claim, and explaining what its checks find.

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

Claude drives this for the author as one pipeline: capture the upstream sources,
convert and reverify them, identify research questions and capture the relevant
references from the source files, and assemble the research outputs.

## Positioning

For academic researchers who want AI to speed up research and composition but
cannot accept fabricated or misattributed sources, Stemma is a book research and
publishing workspace that finds citation problems, explains them honestly, and
shows what was checked against which source. Unlike general chat
assistants, it does not ask the author to trust the model: the model proposes,
scripts check what they can, and every build says what is still open. Unlike
gatekeeping tools, it never stops the author from writing or building. Unlike
reference managers, it covers the path from sources through an evidence graph to
a typeset book. Unlike one-off prompt libraries, it keeps the rules, records,
and history with the manuscript.

## Vision

An author hands a chapter to an AI assistant and gets back faster research and
fluent prose in their own voice. Every citation either resolves to a record in
the project and the source's text in the repository or is shown as unchecked.
Every quotation and footnote is copied from that text by script. A report
lists, in plain language, which quotations and page locators disagree with the
source text, which could not be checked, which claims lack a recorded support
judgment, and what no one has reviewed yet, each with its evidence and a
suggested next step. The author can follow any sentence back to its evidence,
see how claims, objections, constructs, and places connect, and tell a reviewer
plainly what was checked and what rests on a record alone. Review happens when
the author chooses.

AI-written prose is welcome where the author's publisher permits it. Invented
evidence is not. Stemma is for material that may be sent to a language model.

**North Star**: Every problem Stemma's checks can find in a book is explained in
its report, and no output with open findings is called checked clean.

## User Experience

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

A scholar starting a new book states the thesis, audience, and citation style,
and may add the theoretical constructs and research methodology then or later.
Assistant-found sources are shown as the assistant's finds until the scholar
decides on them.

Any build completes at any time. Its report explains what is open and counts
what is still unreviewed; when no check finding is open, the build is labelled
checked clean. The scholar explores the evidence
graph, argument and geographic maps, and typeset pages, and sends a reviewer the
PDF, an offline explorer, the check report, and a disclosure of AI use. The
reviewer can attach comments to claims and send back a file the scholar imports.

## Target Market

| Attribute | Description |
|-----------|-------------|
| Who | Academic researchers writing books or long articles: first in the humanities, then technologists researching technology and scholars in other fields |
| Pain | AI produces plausible references that do not exist, wrong authors, wrong page numbers, and invented quotations. Checking by hand costs the time the AI saved |
| Current Solution | Chat assistants plus manual checking, a reference manager, a word processor, and a separate typesetting step |
| Why They Switch | Verification is automatic and explains itself, so the author can spend review time where it matters without being stopped, and the same source of truth feeds the typeset book |

## Key Value Propositions

| Value Proposition | Customer Benefit |
|-------------------|------------------|
| Scripted checks while the author works, rerun at every build | Citation failures surface early, with evidence and a suggested fix, and every build says whether any remain |
| Takeover of existing manuscripts | Authors adopt Stemma without starting over |
| The whole research captured in the repository | A cited claim traces to a passage of a source's text and to the original it came from, or is shown as unchecked, and anyone with a clone can check it |
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
| Findings an author can understand and act on | Every finding in a pilot report has evidence, a reason it matters, and a suggested action; pilot authors report no unexplained findings (hypothesis) |
| Author time spent on manual citation checking | A large reduction against the author's prior method (hypothesis; to be measured with pilot authors) |
| Takeover | A pilot author resolves the references of an existing chapter (hypothesis) |
| Book build | One command produces the camera-ready PDF from the project files (hypothesis until a pilot builds a chapter) |
| Adoption across personas | Pilots complete a book chapter in each writing persona in the PRD (hypothesis) |

## Why Now

AI assistants now draft and search at a level that changes how scholars work,
and the failure mode is well documented: fabricated citations have reached
government reports and journals, and scholarly communities are responding with
bans and disclosure rules. Some authors who use AI openly already maintain
hand-built governance documents and audits that catch the errors. Those practices work and are not yet a reusable tool.
Packaging them as scripts and plain reports puts them within reach of scholars
with less time and less AI experience.
