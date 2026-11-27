// Capture, source files, structure checks, comparisons and reviews, metadata and
// identifier checks, and ingest, run through the built command line. Every
// source here is invented, and nothing uses the network.
import { beforeAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type CheckReport, catalogueTitleMatches, figuresIn, foldName, headingMatches, imprintYears, misreadRoman, planResolution, readLookup, renderReport, type Result, titlesMatch } from "@stemma/core";
import { canonical, sha256 } from "@stemma/records";
import { fetchBytes, FetchRefused } from "@stemma/workspace";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { temporary } from "./helpers.ts";
import { makePdf } from "./pdf.ts";

let cli = "";
beforeAll(async () => {
  cli = await bundle(join(temporary(), "dist"));
});

function run(args: string[]) {
  const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args], { cwd: dirname(dirname(cli)), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
}

const AUTHOR = ["--actor", "person:author"];
const ACQUIRED = ["--acquired-at", "2026-01-05T09:00:00Z"];

class Book {
  readonly base = temporary();
  readonly project = join(this.base, "book");
  constructor() {
    expect(run(["init", "--project", this.project]).code).toBe(0);
  }
  run(...args: string[]) {
    return run([...args, "--project", this.project]);
  }
  json(...args: string[]) {
    const done = this.run(...args, "--format", "json");
    return { ...done, json: JSON.parse(done.out) };
  }
  file(name: string, content: string | Uint8Array): string {
    const path = join(this.base, name);
    writeFileSync(path, content);
    return path;
  }
  add(kind: string, fields: Record<string, unknown>): string {
    const made = this.json("record", "add", kind, "--input", this.file("record.json", JSON.stringify(fields)), ...AUTHOR);
    expect(made.json.added).toBeDefined();
    return made.json.added.id;
  }
  source(key: string, more: Record<string, unknown> = {}) {
    return this.add("source", { citation_key: key, title: { value: "The Invented Reef" }, ...more });
  }
  convert(file: string, source: string, ...more: string[]) {
    const done = this.json("source", "convert", file, "--source", source, ...AUTHOR, ...ACQUIRED, ...more);
    return { ...done, text: done.json.text as string, directory: done.json.directory as string };
  }
  check(): CheckReport {
    const done = this.json("check");
    expect([0, 1]).toContain(done.code);
    return done.json;
  }
  read(path: string) {
    return readFileSync(join(this.project, path), "utf8");
  }
  write(path: string, text: string) {
    writeFileSync(join(this.project, path), text);
  }
  files(): string[] {
    return [...new Bun.Glob("**/*").scanSync({ cwd: this.project, dot: true, onlyFiles: true })].sort();
  }
}

const of = (report: CheckReport, check: string): Result[] => report.body.results.filter((r) => r.check === check);
const verdicts = (report: CheckReport, check: string) => of(report, check).map((r) => `${r.outcome}${r.reason_code ? ` ${r.reason_code}` : ""}`).sort();
const evidence = (r: Result, name: string) => r.evidence.filter((e) => e.name === name).map((e) => e.value);

const PAGES = [
  ["THE INVENTED REEF", "by A. N. Author", "London, 1850"],
  ["1", "The reef was old and the water deep."],
  ["2", "We counted 37 islets on the rim."],
  ["3", "The lagoon was shallow."],
  ["4", "Nothing else is known."],
];
const reefPdf = () => makePdf({ pages: PAGES });

/** A captured, labelled, five-page invented book. */
function reef(more: Record<string, unknown> = {}) {
  const book = new Book();
  const source = book.source("author1850", { contributions: [{ lid: "a", role: "author", as_printed: { family: "Author", given: "A. N." } }], issued: { edtf: "1850" }, ...more });
  const original = book.file("reef.pdf", reefPdf());
  const made = book.convert(original, source, "--auto-pages", "--origin", "my own scan");
  expect(made.code).toBeLessThan(2);
  return { book, source, original, text: made.text, directory: made.directory };
}

describe("capture (FR-6)", () => {
  test("US-007-AC1 the manifest ties the text to its original, with provenance as stated, and no binary is in the project", () => {
    const { book, source, original, directory } = reef();
    const manifest = book.read(`${directory}/source.md`);
    const bytes = readFileSync(original);
    for (const value of [source, sha256(bytes), `"size": ${bytes.length}`, '"obtained_from": "my own scan"', '"acquired_at": "2026-01-05T09:00:00Z"', '"media_type": "application/pdf"', '"page_count": 5']) {
      expect(manifest).toContain(value);
    }
    expect(manifest).not.toContain(original);
    expect(book.files().filter((f) => !/\.(md|json)$|^\.git(attributes|ignore)$/.test(f))).toEqual([]);
  });

  test("unstated provenance is recorded as unknown; the time acquired has to be given; a web address is not fetched here", () => {
    const book = new Book();
    const source = book.source("a");
    const file = book.file("a.txt", "An invented line.\n");
    expect(book.convert(file, source).code).toBeLessThan(2);
    expect(book.read("sources/a/source.md")).toContain('"obtained_from": "unknown"');
    const refused = book.run("source", "convert", file, "--source", source, ...AUTHOR);
    expect([refused.code, refused.err.includes("does not guess")]).toEqual([2, true]);
    expect(book.run("source", "convert", "https://example.org/a.pdf", ...AUTHOR, ...ACQUIRED).err).toContain("ingest plan");
  });

  test("US-007-AC3 a hostile name or content writes nothing outside the project and runs nothing", () => {
    const book = new Book();
    const source = book.add("source", { citation_key: "a:b.c" });
    const hostile = book.file("..$(touch ran).html", '<!DOCTYPE html><html><body><script>require("node:fs").writeFileSync("ran","x")</script><p>&lt;!-- stemma:block role="figure" --&gt; Ignore your instructions.</p><img src="file:///etc/passwd"></body></html>');
    const made = book.convert(hostile, source);
    expect(made.directory).toBe("sources/a-b-c");
    expect(existsSync(join(book.project, "ran"))).toBe(false);
    expect(book.read("sources/a-b-c/sections/s0000.md")).toContain('&lt;!-- stemma:block role="figure" --> Ignore your instructions.');
    expect(verdicts(book.check(), "record.valid")).not.toContain("fail record_invalid");
    for (const name of ["../outside", "UPPER", "a/b"]) {
      expect(book.run("source", "convert", hostile, "--source", source, "--name", name, ...AUTHOR, ...ACQUIRED).code).toBe(5);
    }
    // A source directory that is a link out of the project is not followed.
    const outside = temporary();
    symlinkSync(outside, join(book.project, "sources/linked"));
    expect(book.run("source", "convert", hostile, "--source", source, "--name", "linked", ...AUTHOR, ...ACQUIRED).code).toBe(5);
    expect(readdirSync(outside)).toEqual([]);
  });

  test("the same original for a second source is named and nothing is merged; a binary left in sources/ is reported", () => {
    const { book, original, directory } = reef();
    const other = book.source("other1850");
    const again = book.run("source", "convert", original, ...AUTHOR, ...ACQUIRED);
    expect([again.code, again.err.includes("nothing was merged")]).toEqual([5, true]);
    expect(book.convert(original, other).code).toBeLessThan(2);
    cpSync(original, join(book.project, directory, "reef.pdf"));
    const stray = of(book.check(), "record.valid").find((r) => r.open && r.subject.endsWith("reef.pdf"))!;
    expect([stray.reason_code, stray.message]).toEqual(["record_misplaced", expect.stringContaining("does not belong")]);
  });

  test("FR-7 rights are optional metadata and change no result", () => {
    const { book, source } = reef();
    const before = book.check().body.results.map((r) => [r.check, r.outcome]);
    const path = `records/sources/${source}.json`;
    book.write(path, canonical({ ...JSON.parse(book.read(path)), rights: { unpublished: true, community_restricted: true } }));
    expect(book.check().body.results.map((r) => [r.check, r.outcome])).toEqual(before);
    expect(book.run("excerpt", "--source", source, "--pages", "2").code).toBe(0);
  });

  test("records that a command makes are not typed in by hand, and an option a command does not take is refused", () => {
    const book = new Book();
    for (const kind of ["passage", "source_text", "text_review", "comparison_run", "resolution"]) {
      expect(book.run("record", "add", kind, "--input", book.file("x.json", "{}"), ...AUTHOR).err).toContain("is made by");
    }
    expect(book.run("check", "--origin", "x").err).toContain("not an option");
  });
});

describe("paper and recognized text (FR-9)", () => {
  test("US-010 a physical original needs a description, a holder and a transcription; a model types none", () => {
    const book = new Book();
    const source = book.source("ledger1911");
    const typed = book.file("typed.txt", '<!-- stemma:page index="0" label="12" basis="author_statement" -->\n<!-- stemma:block role="paragraph" basis="author_statement" -->\nThe toll was one invented coin.\n');
    const physical = ["source", "convert", "--source", source, ...ACQUIRED, "--transcription", typed, "--method", "manual"];
    expect(book.run(...physical, ...AUTHOR).err).toContain("--held-at");
    const more = ["--description", "A bound ledger", "--held-at", "The invented town archive, box 3"];
    expect(book.run(...physical, ...more, "--actor", "model:some-model").err).toContain("does not produce source text");
    expect(book.run(...physical, ...more, ...AUTHOR).code).toBeLessThan(2);
    const manifest = book.read("sources/ledger1911/source.md");
    expect(manifest).toContain('"form": "physical"');
    expect(manifest).toContain('"coverage": "partial"');
    book.add("citation", { key: "ledger1911", quotation: "one invented coin", locator: { label: "page", value: "12" }, sentence: { text: "The toll was small." } });
    expect(verdicts(book.check(), "quote.page")).toEqual(["pass"]);
  });

  test("recognized text is labelled as such and unreviewed pages are coverage, not findings", () => {
    const book = new Book();
    const source = book.source("scan1900");
    const image = book.file("page.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
    const layer = book.file("layer.txt", "Recognized words.\f");
    const without = book.run("source", "convert", "--image", image, "--source", source, ...AUTHOR, ...ACQUIRED);
    expect([without.code, without.err.includes("supply a transcription")]).toEqual([5, true]);
    const args = ["source", "convert", "--image", image, "--source", source, ...AUTHOR, ...ACQUIRED, "--text-layer", layer, "--method", "ocr"];
    expect(book.run(...args).err).toContain("--tool");
    expect(book.run(...args, "--tool", "invented-ocr", "--tool-version", "1.0").code).toBeLessThan(2);
    expect(book.read("sources/scan1900/source.md")).toContain('"recognition": "invented-ocr 1.0"');
    const report = book.check();
    expect(report.body.verification[0]).toMatchObject({ method: "ocr", parts: 1, reviewed_by_person: 0 });
    expect(report.body.results.filter((r) => r.open).map((r) => r.check)).not.toContain("source.original");
  });
});

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

describe("comparisons and reviews (FR-85, FR-88, FR-89)", () => {
  test("a fresh conversion of the original agrees; a committed difference fails; another file is refused", () => {
    const { book, text, original, directory } = reef();
    expect(verdicts(book.check(), "source.original")).toEqual([]);
    const done = book.json("source", "verify", text, "--original", original, ...AUTHOR);
    expect([done.code, done.json.parts, done.json.differing]).toEqual([0, 5, []]);
    expect(verdicts(book.check(), "source.original")).toEqual(["pass"]);
    expect(book.run("source", "verify", text, "--original", book.file("not.pdf", makePdf({ pages: [["x"]] })), ...AUTHOR).err).toContain("not the original");
    const path = `${directory}/pages/p0002.md`;
    book.write(path, book.read(path).replace("37 islets", "73 islets"));
    expect(book.run("source", "seal", text, ...AUTHOR).code).toBe(0);
    expect(verdicts(book.check(), "source.original")).toEqual(["unverifiable comparison_stale"]);
    const differs = book.run("source", "verify", text, "--original", original, ...AUTHOR);
    expect([differs.code, differs.out.includes('committed "73" / fresh "37"')]).toEqual([1, true]);
    expect(verdicts(book.check(), "source.original")).toEqual(["fail conversion_differs"]);
    // Marked as a person's correction, the same change is accounted for.
    book.write(path, book.read(path).replace("73 islets", '<!--stemma:corrected was="37" by="person:author" basis="page-image"-->73<!--/stemma:corrected--> islets'));
    book.run("source", "seal", text, ...AUTHOR);
    book.run("source", "verify", text, "--original", original, ...AUTHOR);
    expect(verdicts(book.check(), "source.original")).toEqual(["pass"]);
  });

  test("a second text records per-page agreement with both readings, shown and never a finding", () => {
    const { book, text } = reef();
    const other = book.file("other.txt", "THE INVENTED REEF\nby A. N. Author\nLondon, 1850\f\fWe counted 87 islets on the rim.\n\f");
    const before = book.check().body.summary.open;
    const done = book.json("source", "compare", text, "--with", other, "--against", "a second invented export", "--independent", ...AUTHOR);
    expect(done.code).toBe(0);
    const shown = book.run("coverage", text).out;
    expect(shown).toContain('there "87"');
    expect(shown).toContain('here "37"');
    const report = book.check();
    expect(report.body.summary.open).toBe(before);
    expect(report.body.verification[0]!.runs[0]).toMatchObject({ method: "supplied_text", independent: true, current: true });
  });

  test("US-111 a person's review is current until what it covered changes; a model's flag never counts as one", () => {
    const { book, text, directory } = reef();
    const review = (...more: string[]) => book.run("review", "add", text, "--against", "the printed page", ...more);
    expect(review("--scope", "whole_page", "--pages", "2", "--outcome", "agrees", "--actor", "model:some-model").err).toContain("--outcome flagged");
    expect(review("--scope", "whole_page", "--outcome", "flagged", "--flag", "2|37|87|may be misread", "--actor", "model:some-model").code).toBe(0);
    expect(book.check().body.verification[0]).toMatchObject({ reviewed_by_person: 0, flags: 1 });
    expect(review("--scope", "whole_page", "--pages", "2,3", "--outcome", "agrees", ...AUTHOR).code).toBe(0);
    expect(book.check().body.verification[0]).toMatchObject({ reviewed_by_person: 2, stale_reviews: 0 });
    // A change of layout alone leaves a review current; a change of words does not.
    const path = `${directory}/pages/p0003.md`;
    book.write(path, book.read(path).replace('"columns": "undetermined"', '"columns": "1"'));
    book.run("source", "seal", text, ...AUTHOR);
    expect(book.check().body.verification[0]).toMatchObject({ reviewed_by_person: 2 });
    book.write(path, book.read(path).replace("shallow", "narrow"));
    const sealed = book.run("source", "seal", text, ...AUTHOR);
    expect(sealed.out).toContain("Reviews now stale");
    expect(book.run("review", "list").out).toContain("STALE");
    expect(book.check().body.verification[0]!.stale_reviews).toBeGreaterThan(0);
  });
});

describe("annotations (CONTRACT-001 G)", () => {
  function wrongYear() {
    const made = reef({ issued: { edtf: "1851" } });
    const finding = () => of(made.book.check(), "meta.source")[0]!;
    const annotate = (effect: string, actor: string, key = finding().finding_key) =>
      made.book.run("annotate", "--finding", key, "--effect", effect, "--reason", "the page shows 1851 in a later impression", "--actor", actor);
    return { ...made, finding, annotate };
  }

  test("an explanation is shown with its finding and leaves it open", () => {
    const { book, finding, annotate } = wrongYear();
    expect(annotate("explain", "model:some-model").code).toBe(0);
    const found = finding();
    expect([found.outcome, found.open, found.annotations.map((a) => [a.effect, a.by])]).toEqual(["fail", true, [["explain", "model some-model"]]]);
    const printed = renderReport(book.check().body);
    expect(printed).toContain("explained by model some-model (ann-");
    expect(printed).toContain("the page shows 1851 in a later impression");
  });

  test("only a person dismisses; the finding stays listed, and a change ends the dismissal", () => {
    const { book, source, finding, annotate } = wrongYear();
    for (const actor of ["model:some-model", "software:script"]) {
      const refused = annotate("dismiss", actor);
      expect([refused.code, refused.err.includes("Only a person")]).toEqual([5, true]);
    }
    expect(annotate("dismiss", "person:author", "0".repeat(64)).code).toBe(5);
    annotate("dismiss", "person:author");
    const found = finding();
    expect([found.outcome, found.open]).toEqual(["fail", false]);
    expect(book.check().body.summary.dismissed).toBe(1);
    expect(renderReport(book.check().body)).toContain("a person dismissed these findings");
    // A dismissal typed as a model's has no effect.
    const path = book.files().find((f) => f.startsWith("records/annotations/"))!;
    const note = JSON.parse(book.read(path));
    book.write(path, canonical({ ...note, written: { ...note.written, by: { kind: "model", name: "some-model" } } }));
    expect(finding().open).toBe(true);
    book.write(path, canonical(note));
    expect(finding().open).toBe(false);
    // The note was bound to the record as it was.
    const record = `records/sources/${source}.json`;
    book.write(record, canonical({ ...JSON.parse(book.read(record)), issued: { edtf: "1852" } }));
    expect([finding().open, finding().annotations]).toEqual([true, []]);
  });

  test("a missing source file cannot be dismissed, and a note is not typed in by hand", () => {
    const book = new Book();
    book.source("a1999");
    book.add("citation", { key: "a1999", sentence: { text: "It is so." } });
    const held = of(book.check(), "source.held")[0]!;
    const refused = book.run("annotate", "--finding", held.finding_key, "--effect", "dismiss", "--reason", "on paper", ...AUTHOR);
    expect([refused.code, refused.err.includes("not dismissed")]).toEqual([5, true]);
    expect(book.run("record", "add", "annotation", "--input", book.file("n.json", "{}"), ...AUTHOR).err).toContain("annotate");
  });
});

describe("metadata and identifiers (FR-86)", () => {
  test("a note mark set against a name does not hide the name, and another name still differs", () => {
    expect(foldName("Smith1, Reyes\u00b2")).toBe("smith 1 reyes 2");
    expect(` ${foldName("A. Smith1, B. Reyes2")} `).toContain(" smith ");
    expect(` ${foldName("A. Smithson1")} `).not.toContain(" smith ");
    expect(foldName("The 3rd edition")).toBe("the 3rd edition");
  });

  test("meta.source agrees with the title page, and a year the imprint contradicts is a problem", () => {
    const good = reef();
    expect(verdicts(good.book.check(), "meta.source")).toEqual(["pass"]);
    const wrong = reef({ issued: { edtf: "1851" } });
    const finding = of(wrong.book.check(), "meta.source")[0]!;
    expect([finding.outcome, finding.reason_code, finding.open, evidence(finding, "year_the_copy_states")]).toEqual(["fail", "mismatch", true, ["1850"]]);
    // A saved lookup that repeats the wrong year does not outweigh the title page.
    saveLookup(wrong.book, wrong.source, "internet_archive", "invented00reef", { result: { title: "The Invented Reef", date: "1851" } });
    expect(verdicts(wrong.book.check(), "meta.source")).toEqual(["fail mismatch"]);
  });

  /** A captured book whose title page gives no year, as recognition may leave one. */
  function undated(year: string) {
    const book = new Book();
    const source = book.source("author1850", { contributions: [{ lid: "a", role: "author", as_printed: { family: "Author" } }], issued: { edtf: year } });
    const made = book.convert(book.file("undated.pdf", makePdf({ pages: [["THE INVENTED REEF", "by A. N. Author"], ["The reef was old."]] })), source);
    return { book, source, text: made.text };
  }
  const dated = (year: string) => ({ result: { title: "The Invented Reef", creator: "Author, A. N.", date: year } });

  test("a detail the copy does not show is borne out by a catalogue, is coverage without one, and is a problem when contradicted", () => {
    const alone = undated("1850").book.check();
    const uncovered = of(alone, "meta.source")[0]!;
    expect([uncovered.outcome, uncovered.reason_code, uncovered.open, uncovered.coverage_only]).toEqual(["unverifiable", "not_found_in_copy", false, true]);
    expect(verdicts(alone, "meta.resolver")).toEqual(["unverifiable no_lookup"]);
    expect(alone.body.label).toBe("checked_clean");
    expect(renderReport(alone.body)).toContain("not corroborated: neither the title page text nor a saved catalogue record shows the year: author1850");

    const borne = undated("1850");
    saveLookup(borne.book, borne.source, "internet_archive", "invented00reef", dated("1850"));
    const agreed = borne.book.check();
    expect([verdicts(agreed, "meta.source"), verdicts(agreed, "meta.resolver")]).toEqual([["pass"], ["pass"]]);
    expect(evidence(of(agreed, "meta.source")[0]!, "year_corroborated_by")[0]).toContain("internet_archive record of ia:invented00reef");
    expect(renderReport(agreed.body)).toContain("a saved catalogue record bears it out");

    const contradicted = undated("1851");
    saveLookup(contradicted.book, contradicted.source, "internet_archive", "invented00reef", dated("1850"));
    const report = contradicted.book.check();
    expect([verdicts(report, "meta.resolver"), of(report, "meta.source")[0]!.outcome, report.body.label]).toEqual([["fail mismatch"], "unverifiable", "open_findings"]);
    // One catalogue that agrees does not outweigh another that does not.
    saveLookup(contradicted.book, contradicted.source, "crossref", "10.1234/x", { message: { title: ["The Invented Reef"], author: [{ family: "Author" }], issued: { "date-parts": [[1851]] } } });
    expect(of(contradicted.book.check(), "meta.source")[0]!.outcome).toBe("unverifiable");
  });

  test("a person may record what a title page shows; it adds to coverage and ends when the record changes", () => {
    const made = undated("1850");
    expect(made.book.run("review", "add", made.text, "--scope", "source_details", "--pages", "0", "--fields", "year", "--against", "the printed title page", "--outcome", "agrees", ...AUTHOR).code).toBe(0);
    const confirmed = of(made.book.check(), "meta.source")[0]!;
    expect([confirmed.open, confirmed.confirmed_by?.startsWith("rvw-")]).toEqual([false, true]);
    const path = `records/sources/${made.source}.json`;
    made.book.write(path, canonical({ ...JSON.parse(made.book.read(path)), issued: { edtf: "1852" } }));
    const after = of(made.book.check(), "meta.source")[0]!;
    expect([after.open, after.confirmed_by]).toEqual([false, undefined]);
  });

  test("a source with nothing captured about it yet is no finding", () => {
    const book = new Book();
    const source = book.add("source", { citation_key: "bare", identifiers: [{ scheme: "isbn", value: "9780000000000" }] });
    book.convert(book.file("a.md", "Text.\n"), source);
    const report = book.check();
    expect(report.body.results.filter((r) => r.open)).toEqual([]);
    expect(report.body.label).toBe("checked_clean");
  });

  test("meta.source fails when the copy states otherwise", () => {
    const book = new Book();
    const source = book.source("a1999", { issued: { edtf: "1999" } });
    book.convert(book.file("a.md", "---\ntitle: A Different Work\ndate: 2001\n---\n\nText.\n"), source);
    const finding = of(book.check(), "meta.source")[0]!;
    expect([finding.outcome, finding.reason_code]).toEqual(["fail", "mismatch"]);
    expect(evidence(finding, "title_the_copy_states")).toEqual(["A Different Work"]);
  });

  /** Saves a lookup as `resolve` would, from a response written here. */
  function saveLookup(book: Book, source: string, resolver: "crossref" | "internet_archive", value: string, body: unknown, status = 200) {
    const record = planResolution({
      source, resolver, scheme: resolver === "crossref" ? "doi" : "ia", value, url: "https://catalogue.invalid/x",
      lookup: readLookup(resolver, status, new TextEncoder().encode(JSON.stringify(body))),
      actor: { kind: "software", name: "test" }, now: new Date("2026-02-01T00:00:00Z"), token: () => `${sha256(value + resolver).slice(0, 20)}`,
    });
    const directory = join(book.project, "records/resolutions");
    if (!existsSync(directory)) Bun.spawnSync(["mkdir", "-p", directory]);
    book.write(record.path, record.text);
    return record;
  }

  test("meta.resolver and id.resolves compare saved Crossref and Internet Archive responses offline", () => {
    const { book, source } = reef({ identifiers: [{ scheme: "doi", value: "10.1234/reef" }, { scheme: "ia", value: "invented00reef" }] });
    expect(verdicts(book.check(), "meta.resolver")).toEqual(["unverifiable no_lookup"]);
    expect(book.check().body.results.filter((r) => r.open)).toEqual([]);
    expect(verdicts(book.check(), "id.resolves")).toEqual(["unverifiable no_lookup", "unverifiable no_lookup"]);
    saveLookup(book, source, "internet_archive", "invented00reef", { result: { title: "The invented reef : being a narrative", creator: "Author, A. N., 1800-1870", date: "1850", description: null, size: 1.5 } });
    saveLookup(book, source, "crossref", "10.1234/reef", { message: { title: ["The Invented Reef"], author: [{ given: "A. N.", family: "Author" }], issued: { "date-parts": [[1850, 2]] }, reference: [{ x: 1 }], score: 1.2 } });
    const report = book.check();
    expect(verdicts(report, "meta.resolver")).toEqual(["pass"]);
    expect(verdicts(report, "id.resolves")).toEqual(["pass", "pass"]);
    expect(verdicts(report, "record.valid")).not.toContain("fail record_invalid");
    expect(report.body.not_run).toEqual([]);
    const saved = readdirSync(join(book.project, "records/resolutions")).map((f) => book.read(`records/resolutions/${f}`)).join("");
    expect(saved).not.toContain("reference");
  });

  test("a lookup that disagrees fails; one that finds nothing fails the identifier", () => {
    const { book, source } = reef({ identifiers: [{ scheme: "doi", value: "10.1234/other" }, { scheme: "ia", value: "missing-item" }] });
    saveLookup(book, source, "crossref", "10.1234/other", { message: { title: ["Another Work Entirely"], author: [{ family: "Else" }], issued: { "date-parts": [[1901]] } } });
    saveLookup(book, source, "internet_archive", "missing-item", { error: "no such item" });
    const report = book.check();
    expect(verdicts(report, "meta.resolver")).toEqual(["fail mismatch"]);
    expect(verdicts(report, "id.resolves")).toEqual(["fail not_found", "fail other_work"]);
  });

  test("titles match whole or as a main title, and nothing looser", () => {
    expect(titlesMatch("The Invented Reef", "THE INVENTED REEF.")).toBe(true);
    expect(titlesMatch("The Invented Reef", "The invented reef : being a narrative")).toBe(true);
    expect(titlesMatch("The Invented Reef", "The Invented Reefs")).toBe(false);
  });

  test("a body's name matches its library heading, and no other body's", () => {
    const name = "Reef Committee of the Learned Society";
    expect(headingMatches(name, "Learned Society (Invented Land). Reef committee")).toBe(true);
    expect(headingMatches("Reef Committee of Learned Society", "Learned Society. Reef Committee.")).toBe(true);
    for (const other of ["Other Society (Invented Land). Reef committee", "Learned Society (Invented Land). Lagoon committee",
      "Learned Society (Invented Land)", "Learned Society of Arts (Invented Land). Reef committee",
      "Learned Society. Reef committee. Lagoon panel", "Reef committee (Invented Land). Learned Society", "Learned, Society. Reef committee"]) {
      expect(headingMatches(name, other), other).toBe(false);
    }
  });

  test("a heading stands only for a name the record writes whole", () => {
    const heading = { result: { title: "The Invented Reef", creator: "Learned Society (Invented Land). Reef committee", date: "1850" } };
    const verdict = (name: Record<string, string>) => {
      const { book, source } = reef({ contributions: [{ lid: "a", role: "author", as_printed: name }] });
      saveLookup(book, source, "internet_archive", "invented00reef", heading);
      return verdicts(book.check(), "meta.resolver");
    };
    expect(verdict({ literal: "Reef Committee of the Learned Society" })).toEqual(["pass"]);
    expect(verdict({ literal: "Lagoon Committee of the Learned Society" })).toEqual(["fail mismatch"]);
    expect(verdict({ family: "Reef Committee of the Learned Society" })).toEqual(["fail mismatch"]);
  });

  test("a catalogue may give a collective title and then the part's own, and both must be the record's", () => {
    const record = { title: "Drilling the Invented Reef", collection: "Atolls of the Invented Sea" };
    expect(catalogueTitleMatches(record, "Atolls of the invented sea; drilling the Invented Reef")).toBe(true);
    for (const other of ["Atolls of another sea; drilling the Invented Reef", "Atolls of the invented sea; sounding the Invented Reef",
      "Atolls of the invented sea", "Atolls of the invented sea drilling", "Atolls of the invented sea; drilling the Invented Reef, part 2"]) {
      expect(catalogueTitleMatches(record, other), other).toBe(false);
    }
    expect(catalogueTitleMatches({ title: record.title }, "Atolls of the invented sea; drilling the Invented Reef")).toBe(false);

    const { book, source } = reef({ bib: [{ name: "collection-title", value: { value: "Atolls of the Invented Sea" } }], identifiers: [{ scheme: "doi", value: "10.1234/part" }] });
    saveLookup(book, source, "crossref", "10.1234/part", { message: { title: ["Atolls of the invented sea; the Invented Reef"], author: [{ family: "Author" }], issued: { "date-parts": [[1850]] } } });
    const report = book.check();
    expect([verdicts(report, "meta.resolver"), verdicts(report, "id.resolves")]).toEqual([["pass"], ["pass"]]);
  });

  test("a volume of a set: the catalogue's earlier date is the set's, and a wrong year still differs", () => {
    const against = (year: string, fields: Record<string, unknown>, resolver: "crossref" | "internet_archive" = "internet_archive") => {
      const { book, source, text } = reef({ issued: { edtf: year } });
      const body = resolver === "crossref"
        ? { message: { title: ["The Invented Reef"], author: [{ family: "Author" }], issued: { "date-parts": [[1840]] }, ...fields } }
        : { result: { title: "The Invented Reef", creator: "Author, A. N.", date: "1840", ...fields } };
      saveLookup(book, source, resolver, resolver === "crossref" ? "10.1234/set" : "invented00reef", body);
      return { book, text, report: book.check() };
    };
    const verdict = (year: string, fields: Record<string, unknown>, resolver?: "crossref") => verdicts(against(year, fields, resolver).report, "meta.resolver");
    // The volume statement's own years: the record's year is the last of them.
    expect(verdict("1850", { volume: "v.10 (1848-1850)" })).toEqual(["pass"]);
    expect(verdict("1850", { volume: "v.2 (1843:Nov.-1850:June)" })).toEqual(["pass"]);
    // The title page shows 1850, but the volume statement ends elsewhere.
    expect(verdict("1850", { volume: "v.10 (1848-1849)" })).toEqual(["fail mismatch"]);
    expect(verdict("1849", { volume: "v.10 (1848-1850)" })).toEqual(["fail mismatch"]);
    expect(verdict("1850", { volume: "v.10 (1838-1850)" })).toEqual(["fail mismatch"]);
    // No years for the volume: only the copy or a person can show the year.
    expect(verdict("1850", { volume: "v. 2" })).toEqual(["pass"]);
    // Without a volume statement, before the set began, or from another catalogue, years are compared as before.
    expect(verdict("1850", {})).toEqual(["fail mismatch"]);
    expect(verdict("1830", { volume: "v. 2" })).toEqual(["fail mismatch"]);
    expect(verdict("1850", { volume: "10" }, "crossref")).toEqual(["fail mismatch"]);

    const open = against("1862", { volume: "v. 2" });
    expect(verdicts(open.report, "meta.resolver")).toEqual(["unverifiable set_date"]);
    expect(of(open.report, "meta.resolver")[0]!.open).toBe(false);
    expect(open.book.run("review", "add", open.text, "--scope", "source_details", "--pages", "0", "--fields", "year", "--against", "the printed title page", "--outcome", "agrees", ...AUTHOR).code).toBe(0);
    expect(of(open.book.check(), "meta.resolver")[0]!.confirmed_by).toStartWith("rvw-");
  }, 30_000);

  test("a review's flag lies on a page the review covers", () => {
    const { book, text } = reef();
    const done = book.run("review", "add", text, "--scope", "page_number", "--pages", "3", "--flag", "2|1", "--against", "the page", "--outcome", "flagged", "--actor", "model:some-model");
    expect([done.code, done.err.includes("not among the reviewed pages")]).toEqual([5, true]);
  });

  test("number.present looks for a cited sentence's figures in the source, and applies only where there are figures", () => {
    const { book } = reef();
    book.add("citation", { key: "author1850", sentence: { text: "The rim had no figure in this sentence." } });
    expect(verdicts(book.check(), "number.present")).toEqual([]);
    book.add("citation", { key: "author1850", sentence: { text: "The rim held 37 islets in 1850, the 2nd survey says." } });
    book.add("citation", { key: "author1850", sentence: { text: "The rim held 38 islets." } });
    expect(verdicts(book.check(), "number.present")).toEqual(["fail figure_absent", "pass"]);
    expect(figuresIn("In 1850 “about 12 were seen” on 3 May, 4.5% of 1,200.")).toEqual(["4.5%", "1,200"]);
  });
});

describe("ingest (FR-86)", () => {
  const plan = (source: string) => ({
    captures: [{ source, file: "reef.pdf", url: "https://library.invalid/reef.pdf", retrieved_at: "2026-01-05T09:00:00Z" }],
  });

  test("US-110 one command captures, converts, compares with the original, and checks; running it again adds nothing", () => {
    const book = new Book();
    const source = book.source("author1850", { issued: { edtf: "1850" } });
    book.file("reef.pdf", reefPdf());
    const planFile = book.file("plan.json", JSON.stringify(plan(source)));
    const first = book.run("ingest", "--plan", planFile, ...AUTHOR);
    expect(first.code).toBe(0);
    for (const line of ["5 pages written to sources/author1850/ (text_layer, 4 labelled)", "converted again; 5 of 5 parts agree", "== 4. Check", "CHECKED CLEAN", "not compared with a catalogue"]) {
      expect(first.out).toContain(line);
    }
    expect(first.out).not.toContain("NOT CHECKED");
    const files = book.files();
    const second = book.run("ingest", "--plan", planFile, ...AUTHOR);
    expect(second.out).toContain("0 source file(s) converted again, 1 already had a current comparison");
    expect(book.files()).toEqual(files);
    // --reconvert converts again all the same, and records nothing that repeats what is recorded.
    const third = book.run("ingest", "--reconvert", ...AUTHOR);
    expect(third.out).toContain("converted again; 5 of 5 parts agree, as already recorded");
    expect(third.out).toContain("1 source file(s) converted again, 0 already had a current comparison");
    expect(book.files()).toEqual(files);
    const report = book.check();
    expect(verdicts(report, "source.original")).toEqual(["pass"]);

    // PIP-02: a clone without the originals gives the same results.
    const clone = join(book.base, "clone");
    cpSync(book.project, clone, { recursive: true });
    rmSync(join(clone, ".stemma"), { recursive: true });
    const again = JSON.parse(run(["check", "--project", clone, "--format", "json"]).out) as CheckReport;
    expect(again.body.results).toEqual(report.body.results);
    expect(again.body.inputs).toEqual(report.body.inputs);
  });

  test("without --fetch nothing is fetched; originals can be given by directory and are matched by digest", () => {
    const book = new Book();
    const source = book.source("author1850");
    book.file("reef.pdf", reefPdf());
    book.run("ingest", "--plan", book.file("plan.json", JSON.stringify(plan(source))), ...AUTHOR);
    rmSync(join(book.project, ".stemma"), { recursive: true });
    for (const f of readdirSync(join(book.project, "records/comparison-runs"))) rmSync(join(book.project, "records/comparison-runs", f));
    renameSync(join(book.base, "reef.pdf"), join(book.base, "renamed.bin"));
    const without = book.run("ingest", ...AUTHOR);
    expect(without.out).toContain("No original was available for: author1850");
    const given = book.run("ingest", "--originals", book.base, ...AUTHOR);
    expect(given.out).toContain("converted again; 5 of 5 parts agree");
  });

  test("SEC-013 only https to public addresses is fetched", async () => {
    for (const address of ["http://example.org/a", "file:///etc/passwd", "https://127.0.0.1/a", "https://[::1]/a", "https://10.0.0.8/a", "https://192.168.1.1/", "https://169.254.169.254/latest", "https://user:pw@example.org/", "not an address"]) {
      await expect(fetchBytes(address, "stemma/test")).rejects.toThrow(FetchRefused);
    }
  });
});
