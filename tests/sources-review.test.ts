// Comparisons, reviews, and annotations, run through the built
// command line. Every source here is invented, and nothing uses the network.
import { describe, expect, test } from "bun:test";
import { renderReport } from "@stemma/core";
import { canonical } from "@stemma/records";
import { makePdf } from "./pdf.ts";
import { AUTHOR, Book, bundleCli, of, reef, verdicts } from "./sources-book.ts";

bundleCli();

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
