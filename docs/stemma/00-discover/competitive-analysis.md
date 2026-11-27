---
ddx:
  id: stemma.competitive-analysis
  type: competitive-analysis
  activity: discover
  authoring:
    home: repo
  depends_on:
    - stemma.product-vision
  links:
    - { id: stemma.prd, kind: informs }
---

# Competitive Analysis

Citation checks, claim ledgers and gated agent workflows for scholarly writing
already exist. No page read described one tool that combines captured source
copies bound by hash, scripted quote and page checks, footnote-heavy book
manuscripts, and takeover of an existing project into a source graph that the
author reviews. This finding covers a limited search. No competitor was
installed or run, so each competitor capability is the maker's own description.

Evidence was gathered and checked on 2026-11-26. Each claim carries a basis:

| Mark | Meaning |
|------|---------|
| V | The linked page, file, or GitHub repository record was opened for this analysis. Some pages came back through a fetch tool as a summary, so check exact wording before quoting. |
| N | Taken from the prior art survey notes, which report opening the page. Not reopened. |
| U | Unverified: search summary, third-party statement, or not settled by the pages read. |
| S | Observed in a Stemma feasibility test on one macOS system with synthetic material. Linux, Windows, desktop apps, and files saved by real tools were not tested. |

Unmarked "Implication" text and ratings are analyst judgment. The
[PRD](../01-frame/prd.md) states what Stemma will do; "Planned" below means a
requirement there, not a working feature.

## Market Landscape

| Attribute | Assessment |
|-----------|------------|
| Market Maturity | Emerging. Several relevant projects are young or have few users (table below). |
| Growth Rate | Unknown. No sizing source was gathered and no market analysis exists. |
| Key Trends | Agent plugins package research and writing rules with checks. Publishers are setting different limits on AI use in books. Both desktop agent vendors support plugins, with uneven component support by surface. |
| Entry Barriers | Low for a skill with citation checks (assumption, from the number of such projects). Higher for measured accuracy on humanities books, where no benchmark was found (U). |
| Buyer Power | High (assumption). Authors can keep manual methods or use free and hosted tools. No pricing or demand research was done. |

### Publisher rules

These rules may limit the vision's core promise more than any competitor does.

| Publisher | Rule relevant to Stemma | Basis |
|-----------|-------------------------|-------|
| University of Chicago Press (revised 2026-10-21) | Bars authors from using AI for core authorial functions, including writing or rewriting text and generating arguments. Lists online research, citation formatting, and surface grammar correction as permitted. Restricts AI illustration changes; allows disclosed charts of the author's own data. Authors disclose generative AI use in writing or figures to the acquisitions editor at submission, and disclosure does not replace verification. The author sections state no citation-checking rule and do not mention translation, indexing, or source summaries. | [policy](https://press.uchicago.edu/resource/ai_guidelines.html), V |
| Oxford University Press (undated; subject to change) | Generative AI should not carry primary authorial duties; the examples are developing arguments and insights, written analysis, and conclusions. Including AI-created content needs written permission. Requires early disclosure, a detailed statement at submission, a declaration form, and acknowledgement in the work. Names reference checking as a possible use of enterprise tools with clear content protection; bars uploading OUP-intended work to tools without a training and reuse opt-out. | [policy](https://academic.oup.com/pages/for-authors/books/author-use-of-artificial-intelligence), V |
| Taylor & Francis | Book authors disclose planned use early and need approval. The preface or introduction names the tool, version, method, and reason. Generating text without rigorous revision is listed as unacceptable. | [policy](https://taylorandfrancis.com/our-policies/ai-policy/), V |

**Implication**: The University of Chicago Press guidelines bar AI-drafted text
for its book authors, and Oxford's guidance on authorship conflicts with it in
part. The first version offers no mode that prevents agent writing, so Stemma
must tell such authors that it enforces no publisher rule. Voice profiles make
AI drafting easier, which raises the same issue. Chicago citation style and
University of Chicago Press AI policy are separate matters. Whether a given use
is permitted is for the author's editor. Cambridge, Springer Nature, Wiley, and
other presses were not verified.

## Competitive Forces

| Force | Pressure | Evidence / Confidence | Implication |
|-------|----------|-----------------------|-------------|
| Direct Rivalry | High for gated workflows; Low to Medium for the integrated book chain | Competitor profiles below. Medium confidence; search was limited, mostly English-language GitHub and arXiv. | "Gates plus a claim ledger" does not set Stemma apart. |
| Substitutes | High | Manual checking, a reference manager, and a word processor ([product vision](product-vision.md), assumption). Gemini Notebook (the current help-page name for NotebookLM) cites passages from author-chosen sources, can make mistakes, and its help page says chat works with or without sources ([help](https://support.google.com/notebooklm/answer/16179559?hl=en), V). For very short sources it cites the whole document ([FAQ](https://support.google.com/notebooklm/answer/16269187?hl=en), V). | Stemma has to beat "chat with my sources, then check by hand" on author time. |
| New Entrants | High | Recent MIT-licensed quote and citation checkers with few or no users, for example [citefact](https://github.com/hearthresearch/citefact) (9 stars, V) and [evidence-ledger-agent](https://github.com/aamirmalik-dr/evidence-ledger-agent) (0 stars, V). | Re-check the field before design decisions are fixed. |
| Buyer Power | High | Assumption; no author interviews on tool choice were done. | Install effort and author time are part of the product. |
| Platform dependence | High | Each host loads a different subset of a plugin (see Platform Constraints), V. | Full function can be promised only on surfaces that run local scripts. |

### Platform Constraints

A hook is a command a host runs at a set point in an agent session. MCP (Model
Context Protocol) is an open protocol for connecting tools to AI hosts. A local
MCP server runs as a program on the author's machine.

| Surface | Documented behavior | Basis |
|---------|---------------------|-------|
| Claude chat (web, desktop, mobile) | Loads skills. Ignores hooks and local MCP servers. A plugin with a top-level `bin/` folder cannot be installed. Skill scripts run in a hosted code sandbox, not on the author's machine. | [support table](https://claude.com/docs/plugins/platform-support.md), [skills](https://claude.com/docs/skills/how-to.md), V |
| Claude Cowork (delegated tasks) | Loads hooks. Loads local MCP only when the session runs on the author's computer. One help page says Cowork runs tasks in the cloud and reaches local files through the desktop app; another describes tasks that run on the computer, with shell commands in a virtual machine, where pushing to GitHub is blocked unless all domains are allowed. | [support table](https://claude.com/docs/plugins/platform-support.md), [get started](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork), [network](https://claude.com/docs/cowork/guide/network-access), V |
| Claude desktop, Code tab, local session | Loads skills, hooks, and local MCP. Plugins installed locally at user or local scope are absent from cloud sessions; plugins are unavailable in WSL (Windows Subsystem for Linux) sessions. The Linux desktop app is a beta for Debian-family systems; other distributions must use the command-line tool. The command sandbox is off by default and does not support native Windows; when on, it denies writes to `.git/hooks` and `.git/config`. | [support table](https://claude.com/docs/plugins/platform-support.md), [desktop](https://code.claude.com/docs/en/desktop), [sandbox](https://code.claude.com/docs/en/sandboxing), V (long pages read in part); [Linux](https://code.claude.com/docs/en/desktop-linux), N |
| Claude install | A user can add a Git marketplace in the app: Customize, Plugins, Add, Add marketplace. Directory review does not cover marketplaces added by URL. Team and Enterprise owners can control sources. Claude is also merging chat and Cowork in stages. | [plugins](https://claude.com/docs/plugins/overview), [merge](https://support.claude.com/en/articles/16761823-claude-cowork-and-chat-are-one-claude), V |
| ChatGPT desktop (Chat, Work, Codex) | Plugins work in Chat, Work, and Codex (OpenAI's coding agent, inside the desktop app). Local MCP apps run only in the desktop app. Plugin hooks are unsupported in cloud-run Work. The build guide says hooks work for plugins installed manually in Codex desktop. Each plugin hook must be reviewed and trusted, again after changes, and OpenAI describes tool hooks as an incomplete enforcement boundary. | [plugins](https://learn.chatgpt.com/docs/plugins.md), [help](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt), [build](https://developers.openai.com/codex/plugins/build), [hooks](https://learn.chatgpt.com/docs/hooks), V |
| ChatGPT install | Official pages read show adding a marketplace by command line (`codex plugin marketplace add`) or by workspace admin import. The build guide says the desktop app can read a `.claude-plugin/marketplace.json` file. | [build](https://developers.openai.com/codex/plugins/build), [admin import](https://learn.chatgpt.com/docs/enterprise/plugin-management), V |
| ChatGPT install, personal account | A third-party README describes Plugins, then Add plugin marketplace, in the desktop app, with the plugin running only in Codex mode and no web option. No official page read confirms it. | [README](https://github.com/kintopp/kintopp-plugins), U |
| Codex sandbox and systems | Default workspace mode has network off and keeps `.git` read-only. Windows runs natively with several sandbox modes. The Linux desktop app is in preview. | [security](https://learn.chatgpt.com/docs/agent-approvals-security.md), [Windows](https://learn.chatgpt.com/docs/windows/windows-sandbox), [Linux](https://learn.chatgpt.com/docs/linux/linux-app.md), V |
| OpenAI public directory | Plugins with lifecycle hooks are ineligible. Local MCP submissions are limited to approved partners. Desktop-only plugins work only in local threads. | [build](https://developers.openai.com/codex/plugins/build), [desktop-only](https://developers.openai.com/plugins/deploy/desktop-only.md), V |
| Anthropic directory | Holds for human review: compiled binaries, `uvx` and `uv run` (Python package launchers) and `npx` launchers, lockfile installs, hook or MCP programs its validator cannot read through (it follows plain shell scripts), files of 256 KiB or more other than images and fonts, and more than 512 files. | [checklist](https://claude.com/docs/plugins/pre-submission-checklist.md), V |

Implications:

- **Distribution**: A self-hosted marketplace avoids directory review. A Git
  marketplace can be added in Claude desktop. For a personal ChatGPT account it
  needs a hands-on test. v1 installs from the project's repository marketplace;
  a directory listing is later (PRD). One repository layout installed in both
  the Claude Code and Codex command-line tools without sign-in (S). The first
  version promises full function only in Claude desktop's local Code tab on
  macOS and Windows, with no desktop-app promise on Linux.
- **Enforcement**: Agent hooks and Git hooks can be skipped or altered; in tests
  an agent with file access defeated a commit gate every way tried (S). Stemma
  enforces nothing: every build reruns the scripted checks, completes, and
  reports what is open.
  A forged model verdict passed that rerun (S).
- **Runtime**: No script runtime is guaranteed across surfaces. Claude Code runs
  shell-form hooks in `sh`, Git Bash, or PowerShell depending on the system; its
  direct form needs a real executable on Windows
  ([hooks](https://code.claude.com/docs/en/hooks), V, read in part). Authors
  install Bun. With a runtime missing, the author saw a raw "not found" error
  (S).
- **Project testing**: This repository is public, and standard GitHub-hosted
  runners are free for public repositories
  ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), V).
  The survey found no headless test method for either desktop app (U), so
  desktop checks are manual.

## Competitor Profiles

| Competitor | Type | Positioning | Target Segment | Strengths | Weaknesses | Source / Confidence |
|------------|------|-------------|----------------|-----------|------------|---------------------|
| Academic Research Skills (ARS) | Direct | Gated pipeline from research to final paper; can draft whole papers | Paper authors | About 58.7k stars. Two mandatory integrity gates. Opt-in claim audit. Entry mid-pipeline for an existing paper. Learns style from past work. Claude marketplace install; separate Codex distribution. | License is CC BY-NC 4.0 (Creative Commons, non-commercial). Rules are protocol the agent follows, not runtime guarantees. No live judge calibration recorded. A separate audit found problems in 21 of 68 final references. Windows support is partial. Books not mentioned. | [README](https://github.com/Imbad0202/academic-research-skills), V; medium |
| K-Dense `scientific-writing` | Direct | Evidence ledger with local validators and human attestation | Scientific authors | Claim-text hashes, method and result consistency records, network-free scripts, explicit list of what only a person can attest. MIT collection, about 58.6k stars. | Opening sources, confirming support and locators, and checking quotations stay manual. Scripts check structure, not facts. | [skill](https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/skills/scientific-writing/SKILL.md), V; medium |
| co-researcher | Direct (literature reviews) | Reviews whose sentences trace to verbatim quotes | Researchers writing reviews | Offline script checks quotes, citation mapping, and agreement on numbers, negation, and direction. Claude Code, Codex, and others. MIT, about 140 stars. | Cannot judge meaning. After repair attempts it labels the draft invalid; blocking is not described. Windows not mentioned. Optional PDF dependency is AGPL-3.0 (GNU Affero license). | [README](https://github.com/poemswe/co-researcher), V; medium |
| citefact | Direct (audit tool) | Checks a manuscript against the full text of its sources | Authors with a bibliography and source PDFs | Scripted citation and quote checks, optional model claim verdicts with evidence, severity exit codes, Zotero collection input. Version 0.3.0 adds page-locator and block-quote checks. MIT. | README limits input to Markdown and author-year citations, so footnote-style books are outside it; DOCX is planned. Author supplies PDFs. No accuracy figures seen. | [README](https://github.com/hearthresearch/citefact), [changelog](https://raw.githubusercontent.com/hearthresearch/citefact/main/CHANGELOG.md), V; medium |
| claude-research-kit | Direct (starter kit) | LaTeX paper kit with Claude Code hooks | LaTeX authors | Blocks fake-shaped DOIs (Digital Object Identifiers), protects source folders, gates citation keys and compile. Documents adoption in an existing manuscript repository. MIT, 3 stars. | Environment variables bypass gates. Hooks run only from the folder where the session opened. | [README](https://github.com/tansuasici/claude-research-kit), V; medium |
| citation-audit | Direct (takeover task) | Audits and repairs citations in an existing LaTeX manuscript | LaTeX authors | Model checks metadata and claim accuracy. Asks the author before removals and claim rewrites. MIT collection, 344 stars. | Applies metadata fixes without confirmation. The skill file describes no graph, persistent store, or commit gate. | [skill](https://github.com/mathews-tom/armory/blob/main/skills/citation-audit/SKILL.md), V; medium |

**Indirect Competitors**:

- **Reference checkers** (threat: low as products; possible components).
  [RefChecker](https://github.com/markrussinovich/refchecker) (MIT) checks
  metadata against scholarly indexes, with desktop builds for three systems and
  no described claim-support check (V). In a test of 104 references from three
  documents, it and four other checkers each flagged 20 to 53 of 71 genuine
  references, and missed 1 to 15 of 33 problem ones
  ([study](https://arxiv.org/html/2607.22693v2), V). A hard block on any checker
  flag would stop honest work. The sample is small and may not predict book
  bibliographies.
- **Corpus question answering** (medium).
  [PaperQA2](https://raw.githubusercontent.com/Future-House/paper-qa/main/README.md)
  (Apache-2.0 per repository record) cites page ranges from a local folder and
  states no accuracy guarantee (V). Anthropic's
  [Citations API](https://platform.claude.com/docs/en/build-with-claude/citations)
  guarantees that returned pointers resolve into supplied documents; it cannot
  cite images, including scan-only PDFs, or combine with structured output (V).
  A valid pointer does not show that the passage supports the claim.
- **Claim graphs** (low now).
  [Discourse Graphs](https://community.obsidian.md/plugins/discourse-graphs)
  gives Obsidian, a note-taking app, Question, Claim, Evidence, and Source
  nodes; relations including supports and opposes; custom types; and a canvas
  (V). Qualitative analysis software such as
  [ATLAS.ti](https://atlastihelp.helpscoutdocs.com/article/727-how-to-create-networks-in-atlas-ti)
  draws named networks of codes and quotations (N).
- **Style tools** (low). [Vale](https://docs.vale.sh/) is an MIT, cross-platform
  prose linter with extensible YAML rules; the page read describes no learning
  from examples (V). ARS builds a style profile from three or more author
  samples and ranks it below discipline and journal norms; the protocol read
  does not describe amending it
  ([protocol](https://github.com/Imbad0202/academic-research-skills/blob/main/shared/style_calibration_protocol.md), V).
  A search also listed community voice-profile skills, some described with
  feedback loops; none was opened (U).
- **Typesetting stacks** (substitute for the last step). See Typst evidence below.
- **Manual practice** (high): hand-kept registers, audits, and library checks.

## Feature Comparison

"ND" means the pages read did not describe the feature. It is not evidence of
absence, and these cells cannot be filled further without reading code or running
the tools. Competitor ratings rest on the sources in the profiles; parts
marked N were not reopened.

| Feature | Stemma | ARS | K-Dense | co-researcher | citefact | research-kit | citation-audit |
|---------|--------|-----|---------|---------------|----------|--------------|----------------|
| Reference existence and metadata check | Planned | Full (N for index detail) | Partial | Full (N) | Partial | Partial | Full (model-run) |
| Scripted quotation match | Planned | ND | None (human) | Full | Full | ND | ND |
| Page or locator check | Planned | Partial (N) | None (human) | ND | Partial | ND | ND |
| Model claim-support judgement | Planned | Partial (opt-in) | None (human) | ND | Partial (optional) | Partial (N) | Partial |
| Hash-bound stored source copies | Planned | ND | ND (claim hashes only) | ND | ND | ND | None |
| Enforced gate | None by design (report and label) | Partial (agent protocol) | Partial (validators, human sign-off) | Partial (invalid label) | Partial (exit code) | Partial (bypassable hooks) | None at commit |
| Takes over an existing manuscript | Planned | Partial | ND | ND | Partial (audit only) | Partial (setup) | Partial (audit and fix) |
| Source graph with visual explorer | Planned | ND | ND | ND | ND | ND | None |
| Constructs and method as starting input | Planned | Partial (experiment declaration) | Partial (method records) | ND | ND | Partial (thesis and contribution map) | ND |
| Style profile from examples, amendable | Planned | Partial (build only described) | ND | ND | ND | ND | ND |
| Book footnote styles and camera-ready build | Planned | ND (books) | ND | ND | None (footnote styles) | ND (LaTeX paper kit) | ND (LaTeX) |
| Plugin install on Claude and Codex | Planned | Full | ND | Full | ND | Partial | ND |

**Legend**: Full | Partial | Planned | None | ND (not described in pages read)

### Technical limits that shape the product

- **Claim support is a judgement.** In one study of eight model judges, the best
  factual-support F1 (a combined precision and recall score) was 0.75, with
  overlapping confidence intervals; false-negative rates ran from 0.18 to 0.47.
  The data came from one long report
  ([study](https://arxiv.org/html/2607.08700v1), V). No benchmark for
  book-length humanities writing was found (U). This supports reporting verdicts as
  judgments the author weighs, and argues for measuring false accepts and false
  rejects separately.
- **Takeover starts with hard parsing.** On footnotes in four law and
  humanities articles, GROBID (an open-source reference parser) in its default
  setup recalled 0.21 to 0.27 on the three fields scored; resolving ibid.
  remained open
  ([FOSSIL preprint](https://arxiv.org/html/2606.01109), V). On German
  footnote-only documents it scored 0.16 end-to-end F1 against 0.60 for the best
  model tested; neither score covers resolving ibid.-type short forms
  ([preprint](https://arxiv.org/html/2603.13651), V). Where a Word file keeps
  citation-manager fields, structured data may be readable without parsing; the
  format description warns it may be partly wrong
  ([format notes](https://raw.githubusercontent.com/fiduswriter/biblatex-csl-converter/HEAD/CITATIONS_IN_DOCS.md), V).
  A reader without packages recovered footnotes and embedded Zotero and EndNote
  references from hand-built files; a rule for short forms missed German and
  author-date forms (S). A "not found" lookup is not proof of fabrication.
  Crossref, a DOI registration agency, says its retraction data is incomplete
  ([docs](https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/), V).
- **Quote and page checks are feasible but narrow.** On a seeded set, they
  caught every planted error; the first run got 19 of 20 cases right, and some
  hyphen and ellipsis attacks passed (S). The same author wrote the cases and the
  code. Scans and recognition were not tested.
- **Sources carry use limits.** Takeover and claim checks may send source text
  to hosted models. The survey reports publisher and database terms that
  restrict this; it did not read most vendor terms, and gives no legal
  conclusion. [JSTOR terms](https://about.jstor.org/terms/) restrict AI
  training and bulk download, and the extract read did not directly address
  inference uploads (N). Stemma does not gate sources individually: the
  [PRD](../01-frame/prd.md) treats project material as sendable to a model,
  names this as a risk, and leaves local models an unsupported experiment.
- **Graph storage and view.** Plain record files with a rebuildable index
  answered evidence queries quickly at 25,000 synthetic records (S). The arras
  browser loaded large synthetic graphs, but its connected-graph view stops at
  150 nodes, it does not match words across diacritics, and its stock build does
  not open from a local file (S). One embedded graph database the survey checked,
  [Kuzu](https://github.com/kuzudb/kuzu), is archived (V). Claude Desktop renders
  local MCP Apps (interactive views served over the Model Context Protocol) in
  its examples, with some display features limited
  ([docs](https://claude.com/docs/connectors/building/mcp-apps/getting-started), V).
- **Maps.** Read-only argument and geographic maps rendered in a test; a
  300-claim argument map was too wide to read without narrowing (S). Restricted
  coordinates leaked when typed into prose or marked public (S).
- **Constructs and method.** The survey found no widely adopted humanities
  ontology of theory or method in a limited search (U). Qualitative analysis
  tools model constructs mainly as codes; the
  [REFI-QDA standard](https://openqda.github.io/refi-tools/docs/standard/REFI-QDA-1-5.pdf)
  exchanges codes, notes, links, and graphs (N).

### Typst evidence

Stemma typesets with Typst and formats citations with citeproc-js (ADR-005).

| Question | Evidence for | Evidence against or gap |
|----------|--------------|-------------------------|
| Install and license | Apache-2.0. Release 0.15.1 ships archives for macOS and Windows on x86-64 and ARM64, and for Linux ([releases](https://github.com/typst/typst/releases/tag/v0.15.1), V). Two builds with a fixed timestamp matched byte for byte (S). | How each host may obtain the program is untested. Matching output across systems is unverified. |
| Citations | citeproc-js produced usable Chicago notes, passing 12 of 14 test notes against expectations not checked with the manual (S). | Typst's own engine printed some locators and back-references wrongly (S). citeproc-js license terms need review. |
| Print and accessible PDF | PDF/A and PDF/UA-1 (archival and accessible profiles) compiled by Typst's own check (S; [docs](https://typst.app/docs/reference/pdf/), V). | No PDF/X ([request](https://github.com/typst/typst/issues/6012), V); no color separation (CMYK) under PDF/A; bleed wrote a trim box only; TIFF and EPS were rejected (S). |
| Scripts and indexes | A one-line helper fixed footnote markers beside right-to-left quotations; two indexes worked with a third-party package (S). | Right-to-left main text was tried only on a few paragraphs (S). Fonts fell back without warning (S). |
| Output in the explorer | Page images with clickable sentence overlays linked all test sentences both ways (S). | Image text cannot be selected or read by screen readers (V). Compiling Typst in the browser was not tried. |
| Exchange with co-authors | None found. | No native Word export was found (U). Manuscript export is deferred past v1 (PRD). |

## Differentiation Strategy

These are candidates to test, not proven advantages.

| Differentiator | Why It Matters | Defensibility |
|----------------|----------------|---------------|
| Source custody: source text in the repository tied to its original by hash, with page files and digests; verdicts go stale when source, claim, or checker changes | The author can show what was checked against which bytes. | Medium. Hash and offset binding exists at toy scale in [evidence-ledger-agent](https://github.com/aamirmalik-dr/evidence-ledger-agent) (V). |
| Takeover of a partly referenced book into a reviewable graph, with the author deciding to remove, repoint, or replace | Authors with existing drafts can adopt without starting over. | Medium if it works on real footnotes; unproven and technically hard. |
| Footnote-heavy book scale: short forms, printed-page locators, editions, archival and non-DOI sources, other scripts | This is the first persona's work. | Medium. Effort is the barrier; no accuracy evidence yet. |
| Separate verdicts for existence, metadata, quotation, locator, support, and the author's review mark; "could not check" never counts as pass | Prevents a model opinion from reading as verification. | Low to copy; valuable for trust. |
| Support check with published false-accept and false-reject rates on the target writing | No reviewed competitor page reported such rates for books. | Medium; needs a project test set that is kept current. |
| Explained reports and a checked-clean label that do not depend on host hooks, with annotations and limits in the disclosure | Authors are never stopped, and every build states what is open. | Low to copy. Anyone who controls the files can alter verdicts and review marks. |

Weak or non-differentiators on their own: citation existence checks, quote
matching, claim ledgers, agent hooks, style learning from samples, and plugin
packaging.

A claim the evidence can support, once built and tested: each quotation and
locator Stemma passes was matched to the source's text, and each output
labelled checked clean had no open finding in those checks. It cannot support "no
misattributed claims" or "tamper-proof", and it says nothing about whether a
source is right.

**Positioning**: For scholarly book authors who use AI and must answer for every
citation, Stemma is a candidate book-length evidence and publishing workspace
that shows what was checked, how, and by whom, including in a manuscript started
elsewhere. Unlike the paper and review tools above, it would connect stored
source copies, footnote-style locators, author decisions, and the book build.
The [product vision](product-vision.md) states the positioning.

## Strategic Implications

- **Attack**: the join between captured sources, footnote-style books, takeover
  with author review, and an honest audit record.
- **Defend**: truthful verdict labels, explained findings, recorded annotations, local handling of
  restricted sources and locations, and low author effort.
- **Avoid**: competing as a general paper-writing pipeline or reference checker;
  promising identical behavior on every desktop surface; presenting a model
  support verdict as verification.

### Build versus reuse

Family entries come from a code and documentation reading of DocumentDrivenDX
tools (N); family code was not run apart from the parts the feasibility tests
used (S). External candidates are untested for fit, quality, and license.
Unlicensed code gives no clear reuse right.

| Capability | Candidates seen | Position |
|------------|-----------------|----------|
| Record definitions | UMF (DocumentDrivenDX schema format) | Use for definitions (ADR-002); its WebAssembly (browser-portable binary) build validated a test definition and is large (S) |
| Explorer | arras | Build on it and contribute a larger graph view (ADR-008); no argument or geographic map found in family tools (N) |
| Graph engine | Truss, Weft, Ashlar (family storage, query, and table layers) | Porting candidates; the engine design decides (ADR-006) |
| Metadata and quotation checks | RefChecker, citefact, co-researcher | No family tool found (N) |
| Voice and style profiles | HELIX voice profile structure, Vale, ARS protocol | No amendment from examples found in HELIX (N) |
| Intake and parsing | Embedded-field readers, GROBID, other parsers | No family tool found (N) |
| Typesetting | Typst, citeproc-js | No family tool found (N) |

Product questions that remain open are in the
[PRD](../01-frame/prd.md#open-questions).

### Evidence gaps to close

- Tests of install, local scripts, and explorer rendering in each promised host
  and on Linux and Windows.
- A takeover trial on a real footnote-heavy manuscript saved by real tools.
- A recognition test on pilot scans.
- A browser Typst compilation trial, including citation formatting.
- A labeled humanities test set for quotation and support checks.
- A wider competitor search, including commercial author tools and publisher
  integrity services, which the survey did not research.
- Author interviews on demand and willingness to pay; market size is unknown.
