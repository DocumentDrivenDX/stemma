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
- "Attach the text of that copy, with its page breaks."
- "Record the citations in this chapter."
- "Check the project and explain what is open."
- "Is anything missing from my source store?"

## What it does

- Keeps sources and citations as plain record files in your project.
- Keeps copies of your sources and their text in a private store outside the
  project, with where and when each came from. Backing that store up is your job.
- Checks that each cited source has a stored copy with text that still matches,
  that citation keys resolve, that listed bibliography entries are cited, that
  record files are well formed, and that no coordinate text slips into the
  project.
- Explains every finding: what is wrong, the evidence, why it matters, and what
  to do. Nothing is blocked. A project is called checked clean only when nothing
  is open, and a report lists any check it did not run.

For a PDF or scan, the text comes from a text layer given to Stemma with its page
breaks. Stemma does not read a PDF's text itself and does not compare a supplied
text layer with the pages.

## Where it has been tried

On one Mac with Apple silicon: the checks, and installation through the
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
