// Structure checks on source files, run through the built
// command line. Every source here is invented, and nothing uses the network.
import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { imprintYears, misreadRoman, renderReport } from "@stemma/core";
import { canonical } from "@stemma/records";
import { makePdf } from "./pdf.ts";
import { ACQUIRED, AUTHOR, Book, bundleCli, evidence, of, reef, verdicts } from "./sources-book.ts";

bundleCli();

describe("structure checks (FR-87)", () => {
  test("a sound source file passes; a missing, edited, unlisted, or reordered page is each reported and the text goes unused", () => {
    const { book, directory } = reef();
    expect(verdicts(book.check(), "source.pages")).toEqual(["pass"]);
    const page = (i: number) => `${directory}/pages/p000${i}.md`;
    const saved = book.read(page(2));
    rmSync(join(book.project, page(2)));
    expect(verdicts(book.check(), "source.pages")).toEqual(["fail part_missing"]);
    book.write(page(2), saved.replace("37 islets", "73 islets"));
    expect(verdicts(book.check(), "source.pages")).toEqual(["fail part_edited"]);
    book.write(page(2), saved);
    book.write(page(7), saved);
    expect(verdicts(book.check(), "source.pages")).toEqual(["fail part_unlisted"]);
    rmSync(join(book.project, page(7)));
    // Two pages swapped: both digests and both indexes disagree.
    const third = book.read(page(3));
    book.write(page(3), saved);
    book.write(page(2), third);
    const swapped = verdicts(book.check(), "source.pages");
    expect(swapped.filter((v) => v === "fail part_edited")).toHaveLength(2);
    expect(swapped).toContain("fail part_index");
    book.write(page(2), saved);
    book.write(page(3), third);
    expect(verdicts(book.check(), "source.pages")).toEqual(["pass"]);
  });

  test("a manifest that drops a page no longer matches the original's page count", () => {
    const { book, directory } = reef();
    const manifest = book.read(`${directory}/source.md`);
    const front = JSON.parse(manifest.split("---\n")[1]!);
    front.pages.splice(2, 1);
    rmSync(join(book.project, `${directory}/pages/p0002.md`));
    book.write(`${directory}/source.md`, `---\n${canonical(front)}---\n`);
    const finding = of(book.check(), "source.pages")[0]!;
    expect([finding.reason_code, evidence(finding, "detail")[0]]).toEqual(["page_count", "the original has 5 pages and 4 are listed; missing index 2"]);
    expect(finding.why && finding.suggestions[0]).toBeTruthy();
  });

  test("label anomalies: repeated, backwards, a jump, and a folio that differs; unnumbered plates are no anomaly", () => {
    const labelled = (map: object[]) => {
      const { book, text } = reef();
      expect(book.run("source", "label", text, "--page-map", book.file("map.json", JSON.stringify(map)), ...AUTHOR).code).toBe(0);
      return verdicts(book.check(), "source.labels");
    };
    const explicit = (labels: string[]) => [{ first_index: 1, last_index: labels.length, style: "explicit", labels, evidence: "author_statement" }];
    expect(labelled(explicit(["1", "2", "3", "4"]))).toEqual(["pass"]);
    expect(labelled([{ first_index: 1, last_index: 2, style: "arabic", first_label: "1", evidence: "author_statement" }, { first_index: 4, last_index: 4, style: "arabic", first_label: "3", evidence: "author_statement" }])).toContain("fail folio_differs");
    expect(labelled(explicit(["1", "1", "2", "3"]))).toContain("fail label_repeated");
    expect(labelled(explicit(["7", "2", "3", "4"]))).toContain("fail label_backwards");
    expect(labelled(explicit(["1", "2", "9", "10"]))).toContain("fail label_jump");
  });

  /** Four pages numbered 1, 2, 9 and 10, whose second and third are given here. */
  function jump(second: string[], third: string[], more: { last?: string; elsewhere?: string; labels?: string[]; coverage?: string } = {}) {
    const book = new Book();
    const source = book.source("jump");
    const pdf = makePdf({ pages: [["An opening page about the sea.", more.elsewhere ?? "Nothing more."], second, third, ["A closing page."]] });
    const made = book.convert(book.file("jump.pdf", pdf), source);
    const labels = more.labels ?? ["1", "2", "9", "10"];
    book.run("source", "label", made.text, "--page-map", book.file("map.json", JSON.stringify([{ first_index: 0, last_index: 3, style: "explicit", labels, evidence: "author_statement" }])), ...AUTHOR);
    return { book, report: book.check() };
  }
  const announced = [["The next part is given under the head of the Northern Shoals."], ["Northern Shoals.\u2014These differ from the reef."]] as const;

  test("a jump in the numbers with text that runs on is recorded as an observation, not a problem", () => {
    const heading = jump([...announced[0]], ["Northern Shoals.\u2014These differ from the reef."]);
    expect(verdicts(heading.report, "source.labels")).toEqual(["pass"]);
    expect(evidence(of(heading.report, "source.labels")[0]!, "observation")[0]).toContain("printed page 2 is followed by 9");
    expect(renderReport(heading.report.body)).toContain("observed in an original");
    const split = jump(["The swell broke on the reef with great vio-"], ["lence all that night."], { elsewhere: "Its violence was remarked." });
    expect(verdicts(split.report, "source.labels")).toEqual(["pass"]);
    expect(evidence(of(split.report, "source.labels")[0]!, "observation")[0]).toContain("is written whole elsewhere");
  });

  test("a jump stays a problem when nothing shows that the text runs on, as where pages are missing", () => {
    const open = (made: ReturnType<typeof jump>) => verdicts(made.report, "source.labels").filter((v) => v !== "pass");
    // Pages lost from the middle of a sentence or between paragraphs.
    expect(open(jump(["The water was deep and"], ["we returned to the ship."]))).toEqual(["fail label_jump"]);
    expect(open(jump(["That ends the account."], ["Northern Shoals.\u2014These differ from the reef."]))).toEqual(["fail label_jump"]);
    expect(open(jump([...announced[0]], ["Southern Shoals.\u2014These differ from the reef."]))).toEqual(["fail label_jump"]);
    expect(open(jump([...announced[0]], ["The Northern Shoals differ from the reef."]))).toEqual(["fail label_jump"]);
    // A split word that the source never writes whole.
    expect(open(jump(["The swell broke with great vio-"], ["lence all that night."]))).toEqual(["fail label_jump"]);
    // The numbers do not run in step on both sides.
    expect(open(jump([...announced[0]], ["Northern Shoals.\u2014These differ from the reef."], { labels: ["1", "2", "9", "12"] }))).toContain("fail label_jump");
  });

  test("an imprint year and a misread roman numeral are read narrowly", () => {
    expect(imprintYears("LONDON:\n1842.\nWASHINGTON : 1960\nLondon, 1850\nMDCCCLXXX.")).toEqual(["1842", "1960", "1850", "1880"]);
    expect(imprintYears("DURING THE YEARS 1882 TO 1836.\nNOVEMBER 1878 to JULY 1880.\nJUN 03 1987\nof 1832\nMDCCCXXXir.")).toEqual([]);
    expect(misreadRoman("LONDON\nMDCCCXXXir.", 1832)).toBe("MDCCCXXXir");
    for (const year of [1831, 1833, 1837]) expect(misreadRoman("MDCCCXXXir.", year)).toBeUndefined();
    expect(misreadRoman("MDCCCXXXI.", 1832)).toBeUndefined();
    expect(misreadRoman("MDCCCXXXIrs", 1832)).toBeUndefined();
  });

  test("a note marker without its note, and a note without its marker, are reported; a continued note is not", () => {
    const book = new Book();
    const source = book.source("notes");
    const supplied = (body: string) => book.file("t.txt", `<!-- stemma:page index="0" -->\n${body}`);
    const convert = (name: string, body: string) => book.run("source", "convert", "--source", source, ...AUTHOR, ...ACQUIRED, "--description", "d", "--held-at", "h", "--method", "manual", "--name", name, "--transcription", supplied(body));
    convert("bad", '<!-- stemma:block role="paragraph" -->\nOne<!--stemma:fnref label="1"-->1<!--/stemma:fnref-->.\n<!-- stemma:block role="footnote" label="2" -->\n2 Stray.\n');
    convert("good", '<!-- stemma:block role="footnote" label="9" continued="yes" -->\ncontinued.\n<!-- stemma:block role="paragraph" -->\nTwo<!--stemma:fnref label="1"-->1<!--/stemma:fnref-->.\n<!-- stemma:block role="footnote" label="1" -->\n1 Paired.\n');
    expect(verdicts(book.check(), "source.footnotes")).toEqual(["fail marker_without_note", "fail note_without_marker", "pass"]);
  });

  test("coordinates in a source file are one finding for that source file, with every position and no value", () => {
    const book = new Book();
    const source = book.source("atlas");
    book.convert(book.file("a.txt", "At 12.34567, -45.67891 lay one islet.\nAnother at 12°34′S 45°6′E.\n"), source);
    const found = of(book.check(), "coordinate.stray").filter((r) => r.open);
    expect([found.length, found[0]!.subject, evidence(found[0]!, "count")[0]]).toEqual([1, "sources/atlas", "2 position(s)"]);
    expect(JSON.stringify(found)).not.toContain("12.34567");
  });

  test("fmt restores layout without changing any words", () => {
    const { book, text, directory } = reef();
    const path = `${directory}/pages/p0001.md`;
    const saved = book.read(path);
    book.write(path, `${saved.replace('\n\n<!-- stemma:block', '\n\n\n<!-- stemma:block')}\n\n`);
    expect(verdicts(book.check(), "record.valid")).toContain("fail record_noncanonical");
    book.run("fmt");
    expect(book.read(path)).toBe(saved);
    expect(verdicts(book.check(), "source.pages")).toEqual(["pass"]);
    expect(text).toStartWith("txt-");
  });
});
