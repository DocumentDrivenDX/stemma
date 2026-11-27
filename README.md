# Stemma

**Create academically rigorous research reports and books.**

Research and write with Claude. The Stemma plugin keeps your sources in order,
checks your citations against your own copies of them, and explains what it finds
in plain language. Ask in plain words; there is nothing else to set up.

A *stemma codicum* is the family tree of a text's manuscripts: it shows which copy
derives from which. Stemma gives your citations a line of descent to a stored
source.

Pre-release. [Read more on the website](https://documentdrivendx.github.io/stemma/),
including [how it works](https://documentdrivendx.github.io/stemma/how.html) and a
[worked example](https://documentdrivendx.github.io/stemma/darwin.html).

## Research in rounds

1. **Gather:** record each work, saying where each detail came from.
2. **Keep and read:** store your copy privately, read its text, and review its
   page numbers.
3. **Write and cite:** record each citation with its sentence, page, and any
   quotation.
4. **Check:** scripts compare those records with your copies.
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

On first use Claude fetches a pinned copy of the Bun runtime, checks it against a
digest shipped in the plugin, and keeps it in the plugin's own data directory. It
changes no system or shell setting, and Claude's usual permission prompts apply.

## What to ask Claude

- "Start a Stemma project in this folder."
- "Add a source record for this book, taking the details from its title page."
- "Keep this PDF as my copy of that source. I downloaded it from the library today."
- "Read the text of that copy and work out its page numbers."
- "Record the citations in this chapter."
- "Check the project and explain what is open."
- "What does that book say on page 89?"
- "Is anything missing from my source store?"

## Before you add material

Anything in a project may be sent to the AI model. Stemma is for material that
may be sent to a language model, and it holds back no individual source. Your
copies and their text live in a private store outside the project, and backing it
up is your job.

## What it does

- Keeps sources and citations as plain record files in your project.
- Keeps copies of your sources and their text in a private store outside the
  project, with where and when each came from. Backing that store up is your job.
- Reads the text layer of a PDF page by page, and proposes a map of printed page
  numbers, from the numbers on the pages, for review.
- Checks that each cited source has a stored copy with text that still matches,
  that quotations are in that text, that cited pages fall inside the work or the
  pages mapped in your copy, that citation keys resolve, that listed
  bibliography entries are cited, that record files are well formed, and that no
  coordinate text slips into the project. It lists what rests on a retired copy
  or source.
- Shows a few pages or one passage of a stored source, marked as quoted data.
- Explains every finding: what is wrong, the evidence, why it matters, and what
  to do. Nothing is blocked. A project is called checked clean only when nothing
  is open, and a report lists any check it did not run.

A quotation passes when it is in the stored text apart from white space and line
breaks, soft hyphens, Latin ligatures, two Unicode spellings of the same
characters, straight against curly quotation marks of the same level, and a word
split by a hyphen at a line end. A close but different passage is reported with
both texts. A match shows agreement with the stored text, which can be wrong:
Stemma compares no text with page images and recognizes no characters in a scan.
While it reads a PDF, the PDF library warns that no native drawing module is
there; the plugin ships none, and reading text draws nothing. Manuscript files
are not read yet: quotations and pages are checked from citation records.

## Layout

```text
.claude-plugin/   the plugin manifest
skills/stemma/    the single public skill
packages/         the command line inside the plugin, and its libraries
scripts/          the plugin's launcher, and tools for building the plugin
examples/         a worked example (records only; no source copies)
fixtures/, tests/
website/          microsite sources and generated documentation
docs/stemma/      Stemma's own governed documents
```

[`website/`](website/) is a static microsite whose examples and screenshots are
generated from real runs; the worked example's runs that need its private copy
are recorded under `website/recorded/`. The product requirements and design are
under [`docs/stemma/`](docs/stemma/).

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
