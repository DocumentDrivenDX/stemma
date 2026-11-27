// The quotation profile quote-fold/0. The first block is the owner-approved list,
// one difference at a time; the second is everything that must not pass.
import { describe, expect, test } from "bun:test";
import { findClosest, findQuotation, fold } from "@stemma/core";

const find = (stored: string, quotation: string) => findQuotation(fold(stored, "stored"), quotation);
const folds = (stored: string, quotation: string) => find(stored, quotation)?.folds;

describe("the approved differences pass, and say which was used", () => {
  test("a verbatim quotation is exact, with nothing allowed", () => {
    expect(find("The toll was paid in salt.", "paid in salt")).toMatchObject({ match: "exact", folds: [], joined: [] });
  });

  test("white space and line breaks", () => {
    expect(folds("paid  in\nsalt\f", "paid in salt")).toEqual(["white_space"]);
    expect(folds("paid in salt", "paid\n in salt")).toEqual(["white_space"]);
  });

  test("soft hyphens, on either side", () => {
    expect(folds("the har­bour toll", "the harbour toll")).toEqual(["soft_hyphen"]);
    expect(folds("the harbour toll", "the har­bour toll")).toEqual(["soft_hyphen"]);
  });

  test("each Latin presentation ligature stands for its letters, and no other compatibility form does", () => {
    for (const [ligature, letters] of [["ﬀ", "ff"], ["ﬁ", "fi"], ["ﬂ", "fl"], ["ﬃ", "ffi"], ["ﬄ", "ffl"], ["ﬅ", "ſt"], ["ﬆ", "st"]] as const) {
      expect(folds(`a ${ligature}x b`, `a ${letters}x b`)).toEqual(["ligature"]);
    }
    expect(find("a ﬅop", "a stop")).toBeUndefined();
    for (const [stored, quoted] of [["x² fields", "x2 fields"], ["Ｓalt fields", "Salt fields"], ["½ share", "1⁄2 share"], ["œuvre", "oeuvre"]] as const) {
      expect(find(stored, quoted)).toBeUndefined();
    }
  });

  test("canonical equivalence, and never a bare letter for an accented one", () => {
    expect(folds("the café toll", "the café toll")).toEqual(["canonical_form"]);
    expect(folds("the café toll", "the café toll")).toEqual(["canonical_form"]);
    expect(find("the café toll", "the cafe toll")).toBeUndefined();
    expect(find("the café toll", "the cafe")).toBeUndefined();
  });

  test("straight against curly marks of the same level only", () => {
    expect(folds("the “toll” was", 'the "toll" was')).toEqual(["quotation_marks"]);
    expect(folds("the 'toll' was", "the ‘toll’ was")).toEqual(["quotation_marks"]);
    expect(folds("the reef’s edge", "the reef's edge")).toEqual(["quotation_marks"]);
    for (const quoted of ["the 'toll' was", "the «toll» was", "the „toll” was", "the toll was"]) {
      expect(find("the “toll” was", quoted)).toBeUndefined();
    }
  });

  test("a word the stored text splits at a line end is joined, and the join is recorded", () => {
    for (const stored of ["rich agri-\nculture here", "rich agri‐\r\n  culture here", "rich agri­\nculture here"]) {
      expect(find(stored, "rich agriculture here")).toMatchObject({ match: "normalized", joined: ["agri-|culture"] });
    }
    // BR-707: a true compound broken at its own hyphen is joined too, so quoting it correctly does not pass.
    expect(find("a well-\nknown reef", "a well-known reef")).toBeUndefined();
    expect(find("a well-\nknown reef", "a wellknown reef")?.folds).toContain("line_end_join");
  });

  test("no join without a hyphen directly before a line break inside a word, and never in the quotation", () => {
    expect(find("agri- \nculture", "agriculture")).toBeUndefined();
    expect(find("agri- culture", "agriculture")).toBeUndefined();
    expect(find("agri\nculture", "agriculture")).toBeUndefined();
    expect(find("agri-\f culture", "agriculture")).toBeUndefined();
    expect(find("pages 12-\n14", "pages 1214")).toBeUndefined();
    expect(find("agriculture", "agri-\nculture")).toBeUndefined();
  });

  test("the stored text is never changed, and a span points into it as it is", () => {
    const stored = "x ﬁsh-\neries y";
    const found = find(stored, "fisheries")!;
    expect(stored.slice(found.start, found.end)).toBe("ﬁsh-\neries");
  });
});

describe("everything else does not pass", () => {
  const stored = "Some fields were abandoned, the agri-culture failed; the Reef’s edge held.";
  test.each([
    ["another word", "all fields were abandoned"],
    ["a change of case", "some fields were abandoned"],
    ["changed punctuation", "Some fields were abandoned; the"],
    ["a hyphen dropped within a line", "the agriculture failed"],
    ["an omitted word", "Some fields abandoned"],
    ["an added word", "Some fields were all abandoned"],
    ["an ellipsis", "Some fields … the agri-culture failed"],
    ["a bracketed edit", "[Some] fields were abandoned"],
    ["a fragment of a longer word", "ome fields were abandoned"],
    ["a word cut short", "Some fields were abandon"],
    ["part of a hyphenated word", "culture failed"],
    ["part of a word with an apostrophe", "s edge held"],
    ["nothing", "   "],
  ])("%s", (_name, quotation) => {
    expect(find(stored, quotation)).toBeUndefined();
  });

  test("text in a script written without spaces can still be quoted in part", () => {
    expect(find("港の通行税", "通行")).toMatchObject({ match: "exact" });
  });

  test("the closest stored text is near within 15 percent of the quotation's length, and never a pass", () => {
    const folded = fold("In that year some fields were abandoned by their holders.", "stored");
    const near = findClosest(folded, "some fields were abandoned by the holders")!;
    expect(near.near).toBe(true);
    expect(folded.original.slice(near.start, near.end)).toBe("some fields were abandoned by their holders");
    const far = findClosest(folded, "all fields were abandoned")!;
    expect(far.near).toBe(false);
    expect(folded.original.slice(far.start, far.end)).toBe("some fields were abandoned");
    expect(findClosest(folded, "the harbour toll was paid in salt every spring")).toBeUndefined();
  });
});
