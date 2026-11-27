# Worked example: Darwin and coral reefs

A Stemma project with one real source and three citations of it. Only record
files and digests are committed. The copy and its full text are not.

## What is committed

- One source record, its capture and extraction records, and three citation
  records. The citing sentences are this example's own paraphrases. There are no
  quotations.
- `page-map.json`, the page map given to `source text`.
- `tools/text-layer.swift`, which made the supplied text layer.

## Checks need the private content store

`check` can pass `source.held` here only on a machine whose content store holds
the two files named by the digests in the records (the store used was the
git-ignored `examples/.sources/store`). Anywhere else all three citations are
reported **could not check**, never passed.

With the store, on 2026-11-26, nothing was open among the checks that ran. The
project is not checked clean: `locator.extent`, `meta.resolver`, `meta.source`,
`number.present`, and `source.changed` are not built yet, and count as open.

## Where the facts come from

| Item | Basis |
|---|---|
| Title, author, publisher, place, year 1842 | Read by a model from the image of the title page (file page index 8, from 0) of the stored PDF, rendered with macOS PDFKit. The OCR text of that page reads "1882 to 1836"; the image reads "1832 to 1836", and gives the year 1842, which the OCR text layer does not hold |
| First citation, page 88 | Page image, index 105: chapter V and its title |
| Second citation, page 89 | Page image, index 106: the paragraph on Chamisso's theory |
| Third citation, page 2 | Page image, index 19: the paragraph on the term "atoll" |
| Origin and version of the copy | The address it was downloaded from, as logged. The acquisition time is the downloaded file's modification time |
| Text layer | The unverified OCR layer inside the Internet Archive PDF, read page by page with PDFKit on macOS 27.0.1. Its words were not proofread. Internet Archive's `_djvu.txt` was not used because it has no page breaks |
| Page map: indexes 19 to 231 are pages 2 to 214 | Internet Archive's page-number file gives the same number for all 213 pages (154 with a confidence value; the rest look filled in from the sequence). The expected number appears near the top or bottom of the OCR text on 198 of them. The page images at indexes 19, 105, 106, and 231 show 2, 88, 89, and 214. The other images were not looked at. All other pages are left without a label |

A model made these readings and wrote these records. No person has confirmed
them, and no record is marked reviewed. Stemma did not compare the text layer
with the page images.
