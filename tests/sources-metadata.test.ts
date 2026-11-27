// Metadata and identifier checks, run through the built
// command line. Every source here is invented, and nothing uses the network.
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { catalogueTitleMatches, figuresIn, foldName, headingMatches, planResolution, readLookup, renderReport, titlesMatch } from "@stemma/core";
import { canonical, sha256 } from "@stemma/records";
import { makePdf } from "./pdf.ts";
import { AUTHOR, Book, bundleCli, evidence, of, reef, verdicts } from "./sources-book.ts";

bundleCli();

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
