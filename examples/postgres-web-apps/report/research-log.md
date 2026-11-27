# Research log: The Cost of One Writer

Working notes kept separate from the report. Written by an AI model (claude-sonnet-5-5) on 2026-11-27. No person has reviewed this work.

## How the sources were chosen

The model chose candidate sources from what it already knew of the subject, then captured the ones it could fetch and read them. No systematic search was run and no search records were made. This favors well-known documents. The source list and the gaps are in `research/2026-11-27-source-choice-and-gaps.md`.

## Candidate theses considered

1. *Throughput ceiling* (the starting hypothesis): PostgreSQL is a sound default until an application's write throughput exceeds what one server can do. Rejected after reading. Notion's account says vacuum stalled and that upkeep tends to degrade before hardware limits are reached; Sentry's outage was exhaustion of transaction IDs; Figma names vacuum trouble beside an input and output limit. A thesis about throughput alone would have missed what two of the three accounts describe first or most prominently.
2. *Upkeep fails first*: the first limit a growing application meets is vacuum upkeep. Rejected as overstated. Figma's account says its earlier scaling work was aimed at processor use, so upkeep was not the first pressure it met, and no source measures which limit ordinary applications meet first.
3. *The costs of one writer* (chosen): PostgreSQL 18 is a sound default while writes fit comfortably on one primary and its upkeep is attended to; the limits to plan for follow from that single primary (connections, old row versions and transaction IDs, replication that does not divide writes). It makes no claim about which limit comes first or at what size. It could be defeated by evidence that ordinary applications routinely meet these limits, or that a missing feature, not the single writer, is what usually forces a change. The sources read here contain neither, and could not be expected to.
4. *Storage design as disqualifier* (rival, recorded as the claim of role `rival_reading`): the multiversion design is poor enough that PostgreSQL should not be the default where updates are common. Not established; see below.

## Testing the thesis; contrary evidence and revisions

- **Pavlo's critique** is the strongest contrary reading. The documentation confirms parts of the mechanism (old versions remain until vacuumed; new index entries are avoided only under two conditions). It does not support the ranking against other systems. The article says it first appeared on the website of OtterTune and speaks of that company's product for handling these problems, which is a reason to weigh its emphasis; the report says so in a note.
- **Wu et al. 2017** was sought as research bearing on that critique. It cuts both ways: delta storage did about twice as well on rows of 100 attributes with one touched (p. 789), and append-only did better on the TPC-C-based test (p. 790). The first was added to the report after the first draft had given only the second, which would have misrepresented the paper. The paper measures Peloton, not PostgreSQL, with newest-first chains in the storage comparison where its Table 1 classes PostgreSQL as oldest-first. Andrew Pavlo is among its authors, so it is not independent of the critique. The report therefore limits the objection to "test before committing" and does not rank products.
- **Sentry 2015** is the only outage account. It predates PostgreSQL 9.6, whose release notes say frozen pages can be skipped by the anti-wraparound vacuum, and version 18's documentation withdraws the single-user-mode recovery the account used. The report keeps it as evidence that the limit is real and drops any inference about outage length or recovery. The account's statement of intent to leave SQL is reported as such; whether it happened was not examined.
- **Figma** is evidence both ways: it hit limits and it stayed. Its reasons for staying (migration risk, an existing relational application) are reasons of an incumbent, and the report says so.
- **Serializable performance** rests on the implementers' own 2012 results. The claim was held at medium confidence and the report calls the release old.
- **PostgreSQL 19** was released on 2026-11-19, eight days before the sources were captured. The report pins version 18 and uses the 19 release notes only to show which costs are being worked on.
- **Selection.** Companies that publish accounts of hitting limits are not a sample of PostgreSQL users. This is recorded as a claim of role `objection` and stated in the report; it is why the thesis says where to look and not how often.

## Method

- Documentation was read at versioned addresses (`/docs/18/`, `/docs/19/`, `/docs/release/9.6.0/`), never `/docs/current/`.
- Passages were located with `stemma passage find`, whose search words only mark the two ends of a range, and copied with `stemma passage capture`. No quotation was typed into a record. Passages captured and then not used were deleted before the first commit.
- The first draft of the report ran well over its intended length and was cut; four more passages left with the cut text.
- The model compared the five quotations from the two papers, and their printed page numbers, with images of those pages. A script looked for each of the other quotations in a second extraction of the same stored HTML made with Python's HTML parser; all were found. The second check shares the original with the first, so it tests conversion and copying, not the publisher's page. See `report/verification.md`.
- Citation records bind each quotation to the report sentence that uses it, as the sentence stood when they were made.

## What the tooling could not yet do

- A web page has no pages, and these have no numbered chapters, so a place is a paragraph number counted over the whole converted page, navigation menus included. A reader cannot count to it on the live page. Section headings and anchors, which a reader could use, are not offered as places.
- Conversion keeps page navigation, footers and "related posts" lists as ordinary text.
- No command brings back converted text that is deliberately left out of the repository. `tools/restore-text.ts`, a script of this project, does it with `stemma ingest --fetch` in a throwaway project and compares digests.
- A project cannot say that a text is deliberately not held. In a copy without it, checks report a damaged source file and advise restoring it from git.
