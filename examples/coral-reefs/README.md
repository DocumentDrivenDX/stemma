# Worked example: Darwin and coral reefs

A Stemma project on the old argument over how coral reefs form. It holds fourteen
real works as Markdown source files, and four citations of Darwin's 1842 book,
each with a short quotation copied from its pages.

## What is here

| Folder or file | What it holds |
|---|---|
| `sources/` | One folder per work: `source.md`, the manifest, and one file for each page of the PDF it came from, blank pages included. About 13.6 MB of text in some 5,000 files |
| `records/` | A record of each work; where its original came from (address, retrieval time, SHA-256); each comparison with the original; saved catalogue lookups; two flags a model recorded, on a page number and a collective title, and one retired flag; a note explaining one finding; four passages; four citations |
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

The project is not checked clean. Four findings are open, and each needs a
person:

| Work | What is open | What would settle it |
|---|---|---|
| `darwin1842` | The year is not in the recognized text of the title page, which leaves out the last line. The page image shows 1842 | A person looks at the title page and records it |
| `lyell1832` | The recognized text garbles the roman numeral for the year. The page image shows 1832 in roman numerals. The catalogue gives only 1830 for the volume "v. 2", the date of the set, so neither the copy nor the catalogue shows the year to the check (two findings) | One review by a person of the year settles both |
| `geolsoc1838` | Printed page 232 is followed by 333. This is what the original prints: the page images show the two numbers, with the text running on. A note on the finding explains it | A person who agrees dismisses the finding |

A model's reading of a page image is not a person's review, so it closes none of
these. To record your own, after looking at the page:

```sh
stemma review add txt-bm6whwjm6vv9ce26mgbr --scope source_details --pages 8 --fields year \
  --against "<what you looked at>" --outcome agrees --actor person:<you>
stemma review add txt-g5myzs9ef0b53mhq2pe1 --scope source_details --pages 10 --fields year \
  --against "<what you looked at>" --outcome agrees --actor person:<you>
stemma annotate --finding c9fbbe4b77b7081004447a6d911532099c281c8f32c099381d73e0b708eaf12b \
  --effect dismiss --reason "<why>" --actor person:<you>
```

Three kinds of difference between a record and a catalogue are the catalogue's
way of writing things, and the check reads them by rule:

| Work | The difference |
|---|---|
| `ladd1960` | The DOI's title gives the collective title, "Bikini and nearby atolls, Marshall Islands", before the report's own. The title page prints both, and the record holds the collective title as `collection-title` |
| `funafuti1904` | The catalogue files the committee under its society, "Royal Society (Great Britain). Coral Reef committee". The title page, and the record, say "Coral Reef Committee of the Royal Society" |
| `murray1880`, `geolsoc1838` | The Internet Archive gives 1834 and 1826, when the sets began. Each volume's statement ends with the year on its title page, 1880 and 1838 |

All four quotations are in the source text, on the pages cited. One needed
"deny-" and "ing" joined across a line end, which the report points out.

## What was compared with the page images

A model (claude-sonnet-5-5) drew these pages with macOS PDFKit and read them.
**No person has read any of them for this example, confirmed any value, or
reviewed any record.** The source records are candidates that nobody has
admitted. The titles and names each source file says its copy states are the
PDF's own document information, not words read from the page.

| Looked at | What was seen |
|---|---|
| The pages of `darwin1842` printed 2, 88, and 89 | The four quoted passages and their page numbers match the images. The image of page 89 shows "deny-" at the end of one line and "ing" at the start of the next |
| Each work's title page, or its first page | The titles, names, and years in the source records. Ladd and Schlanger's cover names no author, so the identity points to the inner title page, which also prints the collective title |
| `geolsoc1838`, PDF pages 247 and 248, counting from 0 | Printed 232 and 333. Page 232 announces a second part on the "northern drift", and the next page begins under that heading |
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
