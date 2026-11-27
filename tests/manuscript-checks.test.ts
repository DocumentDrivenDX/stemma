// The checks over a project's manuscript files (CONTRACT-002 C, "Reading the
// manuscript"). All text here is invented.
import { describe, expect, test } from "bun:test";
import { dependants, planAnnotation, recordStates, renderReport, type Result, runChecks } from "@stemma/core";
import { canonical, type Corpus, loadCorpus, sha256 } from "@stemma/records";
import { dataIdentity } from "@stemma/graph";
import { AT, citation, content, OTHER, project, type Rec, standard, VOLUME } from "./source-view-fixture.ts";

const CHAPTER = "chp-aaaaaaaaaaaa";
const PATH = `manuscript/${CHAPTER}.md`;
const bytes = (text: string) => new TextEncoder().encode(text);

interface Change { records?: Rec[]; listed?: string[]; files?: Record<string, string> }

function corpus(chapter: string | undefined, change: Change = {}): Corpus {
  const made = content(project({ records: change.records ?? [] }));
  made.settings = {
    path: "stemma.json",
    bytes: bytes(canonical({ schema: "stemma.project/0", format: 0, project_id: "sourceviewtest", ...(change.listed ? { bibliography_include: change.listed } : {}) })),
  };
  const files = { ...(chapter === undefined ? {} : { [PATH]: chapter }), ...change.files };
  made.manuscript = Object.entries(files).map(([path, text]) => ({ path, bytes: bytes(text) }));
  return loadCorpus(made);
}

const run = (c: Corpus) => runChecks(c, {}).body;
const of = (results: Result[], check: string) => results.filter((r) => r.check === check);
const verdicts = (results: Result[], check: string) => of(results, check).map((r) => [r.outcome, r.reason_code]);
// The invented source has a footnote of its own with no marker, which is not about the manuscript.
const open = (results: Result[]) => results.filter((r) => r.open && !r.check.startsWith("meta.") && r.check !== "source.footnotes")
  .map((r) => [r.check, r.reason_code]);
const value = (result: Result, name: string) => result.evidence.find((e) => e.name === name)?.value;

describe("quotations in a chapter file", () => {
  test("a right quotation on the right page passes every citation check, none left unrun", () => {
    const body = run(corpus(`# A chapter\n\nOne survey says "nothing more is known".[@volume1850 page="2"]\n`));
    for (const check of ["cite.key", "source.held", "quote.present", "quote.page", "locator.extent", "source.changed"]) {
      expect([check, ...verdicts(body.results, check)]).toEqual([check, ["pass", undefined]]);
    }
    // Only the needs-a-source mark, which this version still does not check, is left.
    expect(body.not_run.map((n) => n.check)).toEqual(["draft.marked"]);
    expect(open(body.results)).toEqual([]);
  });

  test("a wrong quotation fails, naming the file and line, with both texts", () => {
    const body = run(corpus(`# A chapter\n\nOne survey says "nothing more was known".[@volume1850 page="2"]\n`));
    expect(open(body.results)).toEqual([["quote.present", "near_match"]]);
    const found = body.results.find((r) => r.check === "quote.present")!;
    expect(found.subject).toBe(PATH);
    expect(value(found, "manuscript_position")).toBe(`${PATH}, line 3, column 17`);
    expect(value(found, "cited_text")).toBe("nothing more was known");
    expect(value(found, "source_passage")).toBe("nothing more is known");
    expect(found.sentence?.text).toBe('One survey says "nothing more was known".');
    expect(body.label).toBe("open_findings");
    expect(renderReport(body)).toContain(`${PATH}, line 3, column 17`);
  });

  test("marked spans and block quotes are compared; a quotation on another page fails quote.page", () => {
    const { results } = run(corpus([
      "# A chapter", "",
      `It calls them [few]{.quote cite="2"} and the reef old.[@volume1850 page="1"; @volume1850 page="3"]`, "",
      "It ends:", "",
      "> The islets were few.[@volume1850 page=\"2\"]", "",
    ].join("\n")));
    expect(verdicts(results, "quote.present")).toEqual([["pass", undefined], ["pass", undefined]]);
    const pages = of(results, "quote.page").map((r) => [r.reason_code, value(r, "cited_text")]);
    expect(pages).toContainEqual([undefined, "few"]);
    expect(pages).toContainEqual(["wrong_page", "The islets were few."]);
  });

  test("a quotation that no single citation can be given is unverifiable, unless marked not-quote", () => {
    const { results } = run(corpus(`# A chapter\n\nThe word "lagoon" came late.\n\nThe word ["atoll"]{.not-quote} did not.\n`));
    expect(verdicts(results, "quote.present")).toEqual([["unverifiable", "unattributed_quotation"]]);
    expect(of(results, "quote.present")[0]).toMatchObject({ open: true, subject: PATH });
  });

  test("a mark with no partner is reported, not skipped", () => {
    const { results } = run(corpus(`# A chapter\n\nIt says "nothing more.[@volume1850 page="2"]\n`));
    expect(verdicts(results, "quote.present")).toEqual([["unverifiable", "unpaired_quote_mark"]]);
    expect(value(of(results, "quote.present")[0]!, "manuscript_position")).toBe(`${PATH}, line 3, column 9`);
  });
});

describe("citations in a chapter file", () => {
  test("unknown and unbound keys, a source with no text, and a page outside the source", () => {
    const record = {
      schema: "stemma.record/0", id: "cit-takenover0001", kind: "citation", created: { at: AT, by: { kind: "software", name: "takeover" } },
      intake: "raw", as_found: "(Nobody 1850)",
    };
    const { results } = run(corpus([
      "# A chapter", "", "One.[@nobody1850]", "", `Two.[@? id="cit-takenover0001"]`, "", "Three.[@other1850]", "",
      `Four.[@volume1850 page="94"]`, "",
    ].join("\n"), { records: [record] }));
    expect(of(results, "cite.key").filter((r) => r.open).map((r) => r.reason_code).sort()).toEqual(["key_unbound", "key_unknown"]);
    const unbound = results.find((r) => r.reason_code === "key_unbound")!;
    expect([unbound.subject, value(unbound, "as_found")]).toEqual(["cit-takenover0001", "(Nobody 1850)"]);
    expect(of(results, "source.held").filter((r) => r.open).map((r) => [r.reason_code, r.source])).toEqual([["no_source_file", OTHER]]);
    const outside = of(results, "locator.extent").find((r) => r.open)!;
    expect([outside.reason_code, value(outside, "locator")]).toEqual(["outside_page_map", "page 94"]);
  });

  test("figures are looked for in the cited source, outside quotations and block quotes", () => {
    const { results } = run(corpus([
      "# A chapter", "", `It counted 47 islets.[@volume1850 page="3"]`, "",
      `It is dated "in 12 months".[@volume1850 page="3"]`, "",
      "> There were 58 of them.[@volume1850]", "",
      "It lists 63 and 64.[@volume1850 page=\"1\"; @volume1850 page=\"2\"]", "",
      "Both give 81.[@volume1850; @other1850]", "",
    ].join("\n")));
    expect(of(results, "number.present").map((r) => [r.reason_code, value(r, "figures"), r.open]).sort()).toEqual([
      ["figure_absent", "47", true],
      ["figure_absent", "63, 64", true],
      ["several_citations", "81", false],
      ["several_citations", "81", false],
    ]);
  });

  test("a source cited only in the manuscript is not uncited; one cited nowhere is", () => {
    const { results } = run(corpus(`# A chapter\n\nOne.[@volume1850]\n`, { listed: [VOLUME, OTHER] }));
    expect(of(results, "bib.uncited").map((r) => [r.source, r.outcome, r.reason_code]).sort()).toEqual([
      [OTHER, "fail", "not_cited"], [VOLUME, "pass", undefined]].sort());
  });

  test("a citation record is history: its old key, quotation and locator are not checked", () => {
    const { one } = standard();
    const old = citation("cit-onepage00001", one, { key: "gone1850", quotation: "words since rewritten", locator: { label: "page", value: "94" } });
    delete old.passage;
    const written = `# A chapter\n\nIt says "nothing more is known".[@volume1850 page="2" id="cit-onepage00001"]\n`;
    expect(open(run(corpus(written, { records: [old] })).results)).toEqual([]);
    // The same record without a manuscript is what is cited.
    const without = run(corpus(undefined, { records: [old] })).results;
    expect(of(without, "cite.key").map((r) => r.reason_code)).toEqual(["key_unknown"]);
  });

  test("a project whose manuscript/ holds no .md file is checked from its records", () => {
    const { one } = standard();
    const records = [one, citation("cit-onepage00001", one)];
    const bare = run(corpus(undefined, { records }));
    const beside = run(corpus(undefined, { records, files: { "manuscript/notes.txt": `"never said".[@nobody]` } }));
    expect(beside.results.filter((r) => r.check !== "coordinate.stray")).toEqual(bare.results.filter((r) => r.check !== "coordinate.stray"));
    expect(beside.inputs.profiles).not.toContain("sentence-split/0");
  });
});

describe("finding identity", () => {
  const sentence = `It says "nothing more was known".[@volume1850 page="2"]`;
  const keys = (text: string) => of(run(corpus(text)).results, "quote.present").map((r) => r.finding_key);

  test("edits elsewhere keep a finding's key, and a repeated sentence has its own", () => {
    const before = keys(`# A chapter\n\n${sentence}\n`);
    expect(keys(`# A longer title\n\nA new opening.\n\n${sentence}\n`)).toEqual(before);
    const twice = keys(`# A chapter\n\n${sentence}\n\n${sentence}\n`);
    expect(new Set(twice).size).toBe(2);
    expect(twice).toContain(before[0]!);
    expect(keys(`# A chapter\n\n${sentence.replace("was", "had been")}\n`)).not.toEqual(before);
  });

  test("a person's dismissal binds the sentence and source, and ends when the sentence changes", () => {
    const text = `# A chapter\n\n${sentence}\n`;
    const found = of(run(corpus(text)).results, "quote.present")[0]!;
    const note = planAnnotation(corpus(text), run(corpus(text)).results, {
      finding: found.finding_key, effect: "dismiss", reason: "an invented reason", actor: { kind: "person", name: "Author" },
      now: new Date(AT), token: () => "annotation0001",
    });
    const records = [JSON.parse(note.text) as Rec];
    const kept = of(run(corpus(text, { records })).results, "quote.present")[0]!;
    expect([kept.open, kept.annotations.length]).toEqual([false, 1]);
    const edited = of(run(corpus(text.replace("It says", "It once said"), { records })).results, "quote.present")[0]!;
    expect([edited.open, edited.annotations.length]).toEqual([true, 0]);
  });
});

describe("what a citation rests on", () => {
  const retired = { retired: { reason: "replaced by a better copy", stamp: { at: "2026-02-01T00:00:00Z", by: { kind: "person", name: "Author" } } } };
  const replaced = (chapter: string, records: Rec[] = []) => {
    const made = content(project({ records, manifest: retired }));
    made.manuscript = [{ path: PATH, bytes: bytes(chapter) }];
    return loadCorpus(made);
  };

  test("a citation with a record made before a source file was retired is listed", () => {
    const record = {
      schema: "stemma.record/0", id: "cit-takenover0001", kind: "citation", created: { at: AT, by: { kind: "software", name: "takeover" } },
      intake: "raw", key: "volume1850",
    };
    const c = replaced(`# A chapter\n\nOne.[@volume1850 id="cit-takenover0001"]\n`, [record]);
    expect(verdicts(run(c).results, "source.changed")).toEqual([["fail", "depends_on_retired"]]);
    expect(dependants(c).map((d) => [d.subject, d.path, d.source])).toEqual([["cit-takenover0001", PATH, VOLUME]]);
    expect(recordStates(c).records.get("cit-takenover0001")).toContain("open_finding");
  });

  test("a citation with no record says what it could not follow, and is not open for it", () => {
    const found = of(run(replaced(`# A chapter\n\nOne.[@volume1850]\n`)).results, "source.changed")[0]!;
    expect([found.outcome, found.reason_code, found.open, found.coverage_only]).toEqual(["unverifiable", "retired_text_not_followed", false, true]);
  });

  test("claim spans and citations in the manuscript reach unreviewed records", () => {
    const claim = { schema: "stemma.record/0", id: "clm-aaaaaaaaaaaa", kind: "claim", created: { at: AT, by: { kind: "model", name: "m" } }, text: "An invented claim." };
    const body = run(corpus(`# A chapter\n\n[A statement.[@volume1850]]{.claim ids="clm-aaaaaaaaaaaa"}\n`, { records: [claim] }));
    expect(body.unreviewed.map((u) => u.record)).toContain("clm-aaaaaaaaaaaa");
    expect(body.unreviewed.map((u) => u.record)).toContain(VOLUME);
  });
});

describe("chapter files and identity", () => {
  test("a refused chapter is reported with its place and no manuscript text; the others are checked", () => {
    const other = "chp-bbbbbbbbbbbb";
    const { results } = run(corpus(`# A chapter\n\nSecret words <br>.\n`, {
      listed: [VOLUME],
      files: { [`manuscript/${other}.md`]: "# Another\n\nOne.[@nobody1850]\n", "manuscript/draft.txt": "loose" },
    }));
    const refused = results.find((r) => r.reason_code === "manuscript_unsupported")!;
    expect([refused.check, refused.outcome, refused.open]).toEqual(["record.valid", "unverifiable", true]);
    expect(JSON.stringify(refused)).not.toContain("Secret");
    expect(results.find((r) => r.reason_code === "manuscript_file_unread")).toMatchObject({ coverage_only: true, open: false });
    expect(verdicts(results, "cite.key")).toEqual([["fail", "key_unknown"]]);
    expect(verdicts(results, "bib.uncited")).toEqual([["unverifiable", "manuscript_unreadable"]]);
  });

  test("a citation or claim ID that names no record is a dangling reference", () => {
    const { results } = run(corpus(
      `# A chapter\n\n[One.[@volume1850 id="cit-missing000001"]]{.claim ids="clm-missing000001"}\n`));
    expect(results.filter((r) => r.reason_code === "reference_dangling").map((r) => value(r, "points_at")).sort())
      .toEqual(["cit-missing000001", "clm-missing000001"]);
  });

  test("chapter files are inputs of the report and of the data identity", () => {
    const one = corpus("# A chapter\n\nOne.\n");
    const two = corpus("# A chapter\n\nTwo.\n");
    expect(run(one).inputs.manuscript).toEqual([{ path: PATH, sha256: sha256("# A chapter\n\nOne.\n") }]);
    expect(run(one).inputs.profiles).toContain("sentence-split/0");
    expect(run(two).inputs.manuscript).not.toEqual(run(one).inputs.manuscript);
    expect(dataIdentity(two).data_identity).not.toBe(dataIdentity(one).data_identity);
    expect(dataIdentity(two).corpus_digest).toBe(dataIdentity(one).corpus_digest);
  });
});
