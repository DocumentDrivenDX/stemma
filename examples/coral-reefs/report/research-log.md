# Research log: Foundations Out of Sight

Working notes kept separate from the report. Written by an AI model (claude-opus-5-5) on 2026-11-26. No person has reviewed this work.

## Candidate theses considered

1. *Textbook arc*: Darwin inferred subsidence from reef forms; rivals objected; drilling confirmed him. Rejected as a summary rather than an arguable thesis, and because the first reading of Darwin 1842 (pp. 88–94) showed that he himself denied that form decides the question.
2. *Funafuti as a failed test*: the 1904 report did not settle the controversy. Too narrow on its own, and the sources showed that contributors (David et al., p. 156; Judd, p. 180) did draw subsidence inferences, so "settled nothing" overstated it.
3. *Equifinality and the argument from number* (chosen): Darwin conceded that a reef like an atoll could form on any foundation at the proper depth, rested subsidence on the improbability of so many such foundations, and his critics attacked that premise; the dispute therefore had to move beneath the reef, and drilling answered the foundation question, not the form question. Testable against these sources: does Darwin make the concession (yes, 1842 p. 89, 1879 letter p. 182, 1881 letter p. 184)? Do the critics attack the frequency premise (Murray pp. 510–11 explicitly; Daly and Agassiz by supplying platforms; Semper by denying that reef structure is evidence)? Did the decisive evidence come from beneath (Ladd and Schlanger pp. 863, 899)?
4. Considered and set aside: a thesis about Darwin's distribution map as the real evidence. The map is not examined closely enough here to carry it.

## Testing the thesis; revisions made

- **Strongest contrary evidence found:** Dana 1890 p. 273 claims "positive" surface evidence of subsidence (drowned valleys). Revised the thesis from "no surface evidence could decide" to "surface evidence offered by either side admitted a second reading", and the report sets Daly's 1915 rereading (p. 224) against Dana. It also confines the claim to atolls where no land remains.
- **Darwin did not rest on number alone:** the 1837 abstract cites Keeling (p. 553) and the 1842 book proposes distribution tests (p. 116). Added as an explicit qualification in section 3 rather than ignored.
- **Funafuti:** the original thought was "Funafuti settled nothing". Revised to "did not reach a foundation, and its subsidence inferences were of the same indirect kind", because David, Halligan and Finckh (p. 156) and Judd (p. 180) did argue for subsidence.
- **Daly against Darwin:** Daly (pp. 247–48) says the Bermuda boring does not favour subsidence. Reported in the text.
- **Enewetak overreach:** narrowed to "one atoll", with interrupted subsidence (p. 900) and a deeper-water flank (p. 900), and with Blanchon et al. (p. 1) as the statement that drilling confirmed subsidence but not the link between reef types.
- **Steibl et al. 2024** rests on Droxler and Jorry 2021, which is not in the source set; said so in a note.

## Relation to the owner's worked example (origin/main, 4987176 and earlier)

Read with git show only. The microsite example follows the 1842 first edition from title page to four quotations on pages 2, 88 and 89, and presents the research cycle (gather, keep and read, write and cite, check, decide). It sets no thesis. This report builds on the same copy and the same pages (88–89 are the core of section 3) and extends the cycle to a written argument; it does not depart from the example's framing. The example's quotations are not reused verbatim as records; this report's passages were captured afresh with the passage commands.

## Method and tooling

- First draft (2026-11-26): passages were captured against scratch conversions of the 14 stored PDFs. Second pass (2026-11-27): every passage was located again in the worked example's committed source files (`examples/coral-reefs/sources/`, all 14 works), and captured afresh with `stemma passage capture` against a copy of that project. All 117 quoted segments were found unchanged, once each, on the same page indexes, so no quotation, correction or page number changed. The passage records in `records/passages/` name the committed text IDs and source records; the build reads only the repository.
- The committed Agassiz introduction and Funafuti preface pages carried no page labels, so `passage capture` refused them. Their printed roman numbers were added to the committed source files with `stemma source label` (evidence `page_image`, actor the model): Agassiz file indexes 22–41 as xiii–xxxii, Funafuti 19–20 as xii–xiii, the ends of each run read from page images. The words are unchanged, and the example's check output is the same before and after.
- `passage capture` still refuses the first page of the Funafuti preface, which carries no printed number. Two passages there are selected by character offsets in `records/passages.json`, with the page digest, and the locator vii taken from the contents page.
- Located passages with `passage find` (typed search words only locate a range; the text comes from the source file) or by exact character offsets.
- Cross-page passages are two captures joined by the build; running heads, footnotes and note reference marks between them are omitted and the omissions listed in verification.md.
- Every quoted page was rendered with `examples/coral-reefs/tools/render-pages.swift` and read by the model. Sixteen corrections (fifteen distinct text-layer errors, one of them in two overlapping passages) are recorded as model-read corrections in `records/passages.json` (see verification.md); none was silently fixed.
- Italics in quotations (*Challenger*, *Halimeda*, *Globigerina*, *in situ*) are applied from a list checked against the images; the text layer does not carry them.
- Note 9 carries a comment added by the coordinating agent on the doubled negative ("might not be formed"). Checked against the page images of both editions (1842 p. 89, file index 106; 1889 p. 120, index 147): both print it. Its quoted phrases are now passages, and the note cites the 1889 page.
- The Typst PDF is built with Typst 0.15.1 (the version pinned in the design documents), fetched from the typst GitHub release into the git-ignored `.tools/`; its SHA-256 matched the digest GitHub publishes for the asset.

## What the tooling could not yet do

- No record, check or command connects a passage to the sentence that uses it; the report's template and `tools/build.py` do that outside Stemma.
- `passage capture` stores the exact text with line breaks and line-end hyphens; turning it into a quotation (joining hyphens, deciding which hyphens belong to the word, joining segments across pages, omitting note markers) is done by the build script with listed decisions.
- There is no way to record a correction to a quotation made by a model; the format's `corrected` annotation requires a person. Corrections are therefore kept in this report's records, marked as model readings not reviewed by a person.
- Running heads that include the folio were not classified as furniture in these IA scans, so a cross-page range includes them; the build joins two captures instead.
- Footnotes in the scans stay in the main stream (structure undetermined), so the note locator "n" was added by hand from the images.
- Italics are not in the text layer.
- No Chicago-style note or bibliography generator exists yet; `records/works.json` holds hand-built templates read from title pages.
- Passage records live in this report's `records/passages/`, not in the project's `records/`, so that the example's own record set and check results stay as they are; they name the project's text and source records.
