# Stemma

A Claude plugin that helps scholars write books with checked citations. Ask
Claude in plain words; Stemma's scripts check your project against your own
stored copies of your sources and explain what they find. Its own documents are
specified with [HELIX](https://github.com/DocumentDrivenDX/helix), which authors
do not need.

A *stemma codicum* is the family tree of a text's manuscripts: it shows which copy
derives from which. Stemma gives a book's citations a line of descent to a stored
source.

Pre-release.

## Install

Installing the plugin is the only installation there is. The plugin and Claude
set up everything else themselves.

Stemma is not published to a marketplace, so there is no install command to
give here.

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

## Where it has been tried

On one Mac with Apple silicon: the checks, reading PDFs (synthetic ones and one
old scan with a text layer), and installation through the
marketplace entry with the Claude command-line tool, using a local stand-in for
the distribution repository. The Claude desktop app, a live Claude session using
the skill, Windows, and Linux are untested. Setup on Windows needs Git Bash.

Stemma is for material that may be sent to a language model. It holds back no
individual source.

## Layout

```text
.claude-plugin/   plugin and marketplace manifests
skills/stemma/    the single public skill
packages/         the command line inside the plugin, and its libraries
scripts/          the plugin's launcher, and tools for building the plugin
examples/         a worked example (records only; no source copies)
fixtures/, tests/
website/          microsite sources and generated documentation
docs/stemma/      Stemma's own governed documents
```

[`website/`](website/) is a static microsite whose examples and screenshots are
generated from real runs. The product requirements and design are under
[`docs/stemma/`](docs/stemma/).

## License

MIT
