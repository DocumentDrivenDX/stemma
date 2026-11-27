# Worked example: Darwin and coral reefs

A Stemma project on the old argument over how coral reefs form. It holds fourteen
real works as Markdown source files, and four citations of Darwin's 1842 book,
each with a short quotation copied from its pages.

## What is here

| Folder or file | What it holds |
|---|---|
| `sources/` | One folder per work: `source.md`, the manifest, and one file for each page of the PDF it came from, blank pages included. About 13.6 MB of text in some 5,000 files |
| `records/` | A record of each work; where its original came from (address, retrieval time, SHA-256); each comparison with the original; saved catalogue lookups; one flag on a page number; four passages; four citations |
| `plan.json` | What was captured, from where, and how it was converted |
| `tools/render-pages.swift` | Draws page images on macOS, for comparing text with the page. The images are not committed |

Where the copy a repository serves carries a download stamp, naming a network
address and a time, the stamp is left out of the source files, and each page it
was on says so. The digest of the original is unchanged.

No PDF and no page image is committed. The files retrieved for these works,
including the libraries' page-number data and full-text files, are listed by
address, size, and SHA-256 in `records/upstreams/`.

## The works

| Key | Work | Text from |
|---|---|---|
| `lyell1832` | Lyell, *Principles of Geology*, volume 2, 1832 | Recognized |
| `geolsoc1838` | *Proceedings of the Geological Society of London*, volume 2, 1838 | Recognized |
| `darwin1842` | Darwin, *The Structure and Distribution of Coral Reefs*, 1842 | Recognized |
| `murray1880` | *Proceedings of the Royal Society of Edinburgh*, volume 10, 1880 (a reprint) | Recognized |
| `semper1881` | Semper, *Animal Life as Affected by the Natural Conditions of Existence*, 1881 | Recognized |
| `darwinletters1887` | *The Life and Letters of Charles Darwin*, volume 3, 1887 | Recognized |
| `darwin1889` | Darwin, *The Structure and Distribution of Coral Reefs*, third edition, 1889 | Recognized |
| `dana1890` | Dana, *Corals and Coral Islands*, third edition, 1890 | Recognized |
| `agassiz1903` | Agassiz, *The Coral Reefs of the Tropical Pacific*, 1903 | Recognized |
| `funafuti1904` | Coral Reef Committee of the Royal Society, *The Atoll of Funafuti*, 1904 | Recognized |
| `daly1915` | Daly, "The Glacial-Control Theory of Coral Reefs", 1915 | Recognized |
| `ladd1960` | Ladd and Schlanger, *Drilling Operations on Eniwetok Atoll*, 1960 | Recognized |
| `blanchon2014` | Blanchon and others, 2014, in *Scientific Reports* | The PDF's own text |
| `steibl2024` | Steibl and others, "A Renaissance of Atoll Ecology", 2024 | The PDF's own text |

**Recognized text has errors.** For twelve of these works the text is the
character recognition already inside the library's or publisher's PDF. The files
do not name the engine, and the quality is recorded as unassessed. No person has
reviewed a whole page of any of them. A quotation that matches such text agrees
with the recognition, which is not the same as agreeing with the page. Where the
layout could not be determined, such as paragraphs and footnotes in these scans,
each page file says so.

## Run it

From the repository root:

```sh
./scripts/dev.sh example                          # originals you already hold in .stemma/originals/
./scripts/dev.sh example --originals <directory>  # originals in a directory of yours
./scripts/dev.sh example --fetch                  # download them from the recorded addresses
```

Each original is matched by its SHA-256, converted again, and compared with the
committed text, and the project is then checked. A comparison is recorded only if
its result differs from the one already recorded. Without the originals, every
check still runs from the files here; only the fresh conversion is skipped. A
download that is refused is reported, and is not tried another way: obtain the
file yourself and use `--originals`.

## What the check finds

The project is not checked clean. These are open, and each is a real difference
to look at rather than something to tune away:

| Work | What differs |
|---|---|
| `lyell1832`, `murray1880`, `geolsoc1838` | The Internet Archive catalogue gives 1830, 1834, and 1826, the first years of the sets these volumes belong to; the records give the years on the volumes' title pages |
| `ladd1960` | The DOI's title begins with the series title, "Bikini and nearby atolls, Marshall Islands" (two checks report it) |
| `funafuti1904` | The catalogue, and the details in the PDF, name the committee in another word order; the recognized text of the title page is too garbled to settle it (two checks report it) |
| `darwin1842`, `lyell1832` | The year cannot be found in the recognized text of the title page. The page images show 1842 and, in roman numerals, 1832. A person who looks can record that |
| `geolsoc1838` | Printed page 232 is followed by 333. The page images show those two numbers, with the text running on, so it looks like a misprint in the original; a flag on the page says so |

All four quotations are in the source text, on the pages cited. One needed
"deny-" and "ing" joined across a line end, which the report points out.

## What was compared with the page images

A model (claude-sonnet-5-5) drew these pages with macOS PDFKit and read them.
**No person has read any of them for this example, confirmed any value, or
reviewed any record.** The source records are candidates that nobody has
admitted.

| Looked at | What was seen |
|---|---|
| The pages of `darwin1842` printed 2, 88, and 89 | The four quoted passages and their page numbers match the images. The image of page 89 shows "deny-" at the end of one line and "ing" at the start of the next |
| Each work's title page, or its first page | The titles, names, and years in the source records. Ladd and Schlanger's cover names no author, so the identity points to the inner title page |
| `geolsoc1838`, the pages numbered 232 and 333 | As in the table above |
| `darwin1842`, PDF pages 239 and 252, counting from 0 | A publisher's list of other books, numbered 2 and 15 on its own. Conversion left that run of fourteen pages unlabelled because it repeats numbers of the book |

Printed page labels were proposed from the numbers in each work's own text. They
were not compared with page images, apart from those named here.

The recognition is imperfect even where the quotations are right. On page 2 of
Darwin the image shows ‘atoll,’ and the recognized text has a space after the
opening mark. Spaces inside a line are not among the differences a quotation
check passes over, so a quotation typed from the page would be reported as a near
match.

## Writing from it

Each citing sentence in `records/citations/` is this example's own wording around
a quotation. Choosing the passages was a model's judgement, recorded on each
passage. Their words and page numbers were copied by `passage capture`, not typed.
