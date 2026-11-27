# Stemma

**Create academically rigorous research reports and books.**

Research and write with Claude. The Stemma plugin keeps your sources in your
project, checks your citations and quotations against them, and explains what it
finds in plain language. Ask in plain words; there is nothing else to set up.

A *stemma codicum* is the family tree of a text's manuscripts: it shows which copy
derives from which. Stemma gives your citations a line of descent back to each
original source.

Pre-release. [Read more on the website](https://documentdrivendx.github.io/stemma/),
including [how it works](https://documentdrivendx.github.io/stemma/how.html) and a
[worked example](https://documentdrivendx.github.io/stemma/darwin.html).

## Research in rounds

1. **Gather:** record each work, saying where each detail came from.
2. **Capture and read:** convert your copy to Markdown in your project, page by
   page, with a record of where it came from.
3. **Write and cite:** choose a passage and let a script copy its words and
   page, or record a citation you already have.
4. **Check:** scripts compare those records with your source files.
5. **Decide:** look at the page, then fix, replace, or leave it. Nothing is
   blocked.

Then go round again with a new source, a better scan, or a corrected sentence.

## Install

Installing the plugin is the only installation there is. The plugin and Claude
set up everything else themselves.

Install it from the DocumentDrivenDX marketplace with Claude Code. On Windows,
setup needs Git Bash.

```sh
claude plugin marketplace add DocumentDrivenDX/plugins
claude plugin install stemma@documentdrivendx
```

That also installs [docsync](https://github.com/DocumentDrivenDX/docsync), which
Stemma uses when you want to edit a manuscript with others, in a Claude Doc or in
a Word file in a shared OneDrive, Dropbox or iCloud Drive folder. If an update
leaves Claude saying that docsync is not installed, install it by name:

```sh
claude plugin install docsync@documentdrivendx
```

On first use Claude fetches a pinned copy of the Bun runtime, checks it against a
digest shipped in the plugin, and keeps it in the plugin's own data directory. It
changes no system or shell setting, and Claude's usual permission prompts apply.

## What to ask Claude

- "Start a Stemma project in this folder."
- "Add a source record for this book, taking the details from its title page."
- "Capture this PDF as my copy of that source. I downloaded it from the library today."
- "Tag these three as arguing against the theory, then list them."
- "Find where that book discusses atolls, and capture the passage I choose."
- "Record the citations in this chapter."
- "Check the project and explain what is open."
- "What does that book say on page 89?"
- "Are any of my source files missing or changed?"
- "Let me browse and search my evidence."

## Before you add material

Your project holds the full text of your sources, so anyone who can read the
repository can read them, and publishing it publishes them. Anything in a project
may also be sent to the AI model: Stemma is for material that may be sent to a
language model, and it holds back no individual source. Original files such as
PDFs and page images stay out of the repository.

## What it does

- Keeps sources and citations as plain record files in your project.
- Lets a source start as just its file and gain text, identifiers, catalogue
  details, and tags over time, without changing its text or your passages. It
  lists sources by tag and stage and shows each one's history.
- Converts your sources into Markdown source files in your project: PDF with a
  text layer, EPUB, HTML, DOCX, Markdown, Project Gutenberg and plain text, and
  text that you or your recognition tool supply for paper or page images. Each
  file is tied to its original by a digest, with where and when it came from.
- Keeps one file per PDF page, or per chapter or section where there are no
  pages, with the structure marked. What cannot be determined is marked as such.
  Printed page numbers are proposed from the numbers on the pages, for review.
- Checks that each cited source is held and its files are unchanged, that
  quotations are in its text and on the cited page, that cited pages fall inside
  the work, that source details agree with the title page and with saved
  catalogue lookups, that citation keys resolve, that listed bibliography entries
  are cited, that record files are well formed, and that no coordinate text slips
  into the project. It lists what rests on a retired source.
- Captures a passage by its address, so that a script copies the quotation and
  its page, and shows a few pages or one passage, marked as quoted data.
- Tracks comparisons and reviews of the text, such as a check of recognized text
  against another reading of the same page. They are reported as coverage; none
  is required.
- Makes one offline page where you search your records and follow the links
  between them in both directions, with or without diacritics. It marks records
  that are unreviewed, rest on something retired, or have open findings from many
  of the checks; it does not yet show the state of claim support. The page holds
  your records' text, passages included, so anyone you give it to can read them.
  It is not a reviewer copy.
- Explains every finding: what is wrong, the evidence, why it matters, and what
  to do. Nothing is blocked. A project is called checked clean only when nothing
  is open, and a report lists any applicable check it could not run.

A quotation passes when it is in the source text apart from white space and line
breaks, soft hyphens, Latin ligatures, two Unicode spellings of the same
characters, straight against curly quotation marks of the same level, and a word
split by a hyphen at a line end. A close but different passage is reported with
both texts. A match shows agreement with the source text, which can be wrong,
above all where it was recognized from a scan: Stemma compares no text with page
images and recognizes no characters. While it reads a PDF, the PDF library warns
that no native drawing module is there; the plugin ships none, and reading text
draws nothing. Manuscript files are not read yet: quotations and pages are
checked from citation records.

## Layout

```text
.claude-plugin/   the plugin manifest
skills/stemma/    the single public skill
packages/         the command line inside the plugin, and its libraries
scripts/          the plugin's launcher, and tools for building the plugin
examples/         a worked example: records and source files; no originals
fixtures/, tests/
website/          microsite sources and generated documentation
docs/stemma/      Stemma's own governed documents
```

[`website/`](website/) is a static microsite whose examples and screenshots are
generated from real runs; recorded runs of the worked example are kept under
`website/recorded/`. The product requirements and design are under
[`docs/stemma/`](docs/stemma/).

## Developing Stemma

Stemma's own documents are specified and designed with
[HELIX](https://github.com/DocumentDrivenDX/helix). You need it to work on those
documents. Authors who use Stemma do not need it.

To install HELIX in Claude Code, from a terminal:

```sh
claude plugin marketplace add https://github.com/DocumentDrivenDX/helix
claude plugin install helix@helix --scope user
```

Then, in a session in this repository, use `/helix` to frame, design, evolve, or
align the documents under `docs/stemma/`. For Codex and other hosts, follow
HELIX's [install guide](https://github.com/DocumentDrivenDX/helix/blob/main/docs/install/README.md).
Rules for working in this repository are in [AGENTS.md](AGENTS.md).

## License

MIT
