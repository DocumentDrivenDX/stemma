# Worked example: Darwin and coral reefs

A Stemma project with one real source and four citations of it, each holding a
short quotation. Only record files and digests are committed. The copy and its
full text are not.

## What is committed

- One source record, its capture and extraction records, and four citation
  records. Each citing sentence is this example's own wording around a short
  quotation from the source.
- `page-map.json`, the reviewed page map given to `source text`.
- `tools/render-pages.swift`, which drew the page images the quotations and page
  numbers were compared with. The images are not committed.

## Checks need the private content store

`check` can compare anything here only on a machine whose content store holds the
two files named by the digests in the records (the store used was the
git-ignored `examples/.sources/store`). Anywhere else the citations and their
quotations are reported **could not check**, never passed. The page-range check
still runs, since the page map is in the records.

With the store, on 2026-11-26, nothing was open among the checks that ran. The
project is not checked clean: `meta.resolver`, `meta.source`, and
`number.present` are not built, and count as open.

## What a quotation check showed

All four quotations match the stored text under `quote-fold/0`. All four needed
line breaks to be read as spaces, and one also needed `deny-` / `ing` joined
across a line end, which the report points out.

A match is agreement with the stored text, which here is unverified character
recognition. That cuts both ways. This quotation of page 2 is right as the page
image shows it:

> hence I have invariably used in this volume the term ‘atoll,’ which is the name
> given to these circular groups of coral islets

Tried on 2026-11-26 in a copy of this project, it was reported as a near match,
because the stored text has a space after the opening mark: `‘ atoll`. Spaces
inside a line are not on the approved list of harmless differences. It is not
committed as a record. In the same trial, changing "greater" to "smaller" in the
second quotation gave a near match showing both texts, and citing page 412 was
reported as outside the mapped pages 2-214.

## Where the facts come from

"Page image" below means an image of the stored PDF's page, drawn with macOS
PDFKit and read by a model (claude-sonnet-5-5). **No person has read any of
these pages for this example, confirmed any value, or reviewed any record.**

| Item | Basis |
|---|---|
| Title, author, publisher, place, year 1842 | Page image of the title page (file page index 8, from 0). The OCR text of that page reads "1882 to 1836"; the image reads "1832 to 1836", and gives the year 1842, which the OCR text layer does not hold |
| First quotation, page 88 | Compared word by word, punctuation included, with the page image at index 105 |
| Second and fourth quotations, page 89 | Compared the same way with the page image at index 106. The image shows "deny-" at the end of a line and "ing" at the start of the next |
| Third quotation, page 2 | Compared the same way with the page image at index 19 |
| Origin and version of the copy | The address it was downloaded from, as logged. The acquisition time is the downloaded file's modification time |
| Text layer | The unverified OCR layer inside the Internet Archive PDF, read by `source text` with pdfjs-dist 6.5.438. Only the pages named here were compared with their images |
| Page map: indexes 19 to 231 are pages 2 to 214 | `source pages` proposed this run: the number appears near the top or bottom of the text on 191 of its 213 pages. Internet Archive's page-number file and the labels inside the PDF give the same label on all 213. The page images at indexes 19, 105, 106, and 231 show 2, 88, 89, and 214. The other images were not looked at |
| Page map: a second run left out | `source pages` also proposed indexes 239 to 252 as pages 2 to 15, and warned that those labels repeat. The page images at indexes 239 and 252 show 2 and 15 on a publisher's list of other books bound at the back. Those numbers do not number this work, so the run was removed from the map. Those and all other pages are left without a label |

A model made these readings and wrote these records. No record is marked
reviewed, and the source is a candidate that nobody has admitted.
