// US-113: reference lists and author-date linking. All names, titles, and
// sentences here are invented.
import { describe, expect, test } from "bun:test";
import { type AuthorDateResult, type Bracket, checkAccount, type Document, type Location, matchAuthorDate, type Paragraph, readEntry, readReferenceLists } from "../packages/intake/src/index.ts";

type Spec = string | [Location, string] | { h: number; text: string };
const doc = (file: string, ...specs: Spec[]): Document => ({
  file,
  paragraphs: specs.map((s): Paragraph => (typeof s === "string" ? { text: s, location: "body" }
    : Array.isArray(s) ? { location: s[0], text: s[1] } : { text: s.text, location: "body", headingLevel: s.h })),
});

/** One chapter with the given entries and text. */
const chapter = (entries: string[], ...text: Spec[]) => doc("one.docx", ...text, { h: 1, text: "References" }, ...entries);

/** Each bracket as one line: what it ended as, with the entry's text or the reason. */
const outcome = (b: Bracket): string => (b.state === "unlinked" ? `${b.text} => unlinked ${b.reason}`
  : `${b.text} => ${b.items.map((i) => (i.state === "linked" ? `linked ${i.entry.asFound}` : `unresolved ${i.reason}`)).join(" | ")}`);
const outcomes = (r: AuthorDateResult) => r.brackets.map(outcome);
const one = (entries: string[], ...text: Spec[]) => outcomes(matchAuthorDate([chapter(entries, ...text)]));

describe("US-113-AC1: reference entries", () => {
  const read = (text: string) => {
    const r = readEntry(text);
    return r.status === "read" ? `${r.authors.join("; ")}${r.whole ? " [whole]" : ""}${r.cutShort ? " [cut short]" : ""} ${r.year}${r.suffix} ${r.layout}` : `unread ${r.why}`;
  };
  test.each([
    ["Adair, J. 2017. Rivers and their names. Leeds: Invented Press.", "Adair 2017 after_authors"],
    ["Adair, J. (2017a). Rivers. Leeds.", "Adair 2017a after_authors"],
    ["Adair, J., & Brel, K. (2017). Rivers. Leeds.", "Adair; Brel 2017 after_authors"],
    ["Adair, John, and Karen Brel. 2017. Rivers. Leeds.", "Adair; Brel 2017 after_authors"],
    ["Adair, J., K. Brel and L. Corso. 2003. Fords.", "Adair; Brel; Corso 2003 after_authors"],
    ["Adair, J., Brel, K., Jr., and Corso, L. M. 2003. Fords.", "Adair; Brel; Corso 2003 after_authors"],
    ["van der Brel, Karen. 1999. Weirs.", "van der Brel 1999 after_authors"],
    ["García Dunmore, Á. & de Corso, L. 1999. Weirs.", "García Dunmore; de Corso 1999 after_authors"],
    ["Corso, L. (ed.). 2001. Locks.", "Corso 2001 after_authors"],
    ["Corso, L. and Brel, K., eds. 2001. Locks.", "Corso; Brel 2001 after_authors"],
    ["Adair, J. et al. 2017. Rivers.", "Adair [cut short] 2017 after_authors"],
    ["Office of Land and Water. 2004. Annual account.", "Office of Land and Water [whole] 2004 after_authors"],
    ["Dunmore, P. n.d. Undated notes.", "Dunmore n.d. after_authors"],
    ["Dunmore, P. Forthcoming. New notes.", "Dunmore forthcoming after_authors"],
    ["Brel, K. Weirs of the north. Leeds: Invented Press, 2003.", "Brel 2003 near_end"],
    ["Brel, Karen. Weirs of the north. Leeds: Invented Press, 2003.", "Brel 2003 near_end"],
    ["Brel, Karen, and Lee Corso. A history of 1812. Leeds: Invented Press, 1999.", "Brel; Corso 1999 near_end"],
    ["Brel, K., 'Weirs', Journal of Invented Water, 12 (1999), 1450–1470.", "Brel 1999 near_end"],
    ["Brel, K., 'Weirs', Journal of Invented Water 12 (1999): 1450.", "Brel 1999 near_end"],
    ["Brel, K., Weirs of the north (Leeds: Invented Press, 2003), pp. 12–19.", "Brel 2003 near_end"],
    ["Brel, K. \"Weirs.\" Invented Weekly, 3 June 2003. https://example.org/2019/weirs [Accessed 4 May 2020].", "Brel 2003 near_end"],
    ["Office of Land and Water. Annual account. Leeds, 2004.", "Office of Land and Water [whole] 2004 near_end"],
    ["Rowe, Q. Alden. 2001. Fords.", "Rowe 2001 after_authors"],
    ["Rowe, Q. R. Alden (2001). Fords.", "Rowe 2001 after_authors"],
    ["Rowe, Q. Alden, and Bea Stone. 2001. Fords.", "Rowe; Stone 2001 after_authors"],
    ["Rowe, Q. Alden, Bea Stone, and Cy Teal. 2001. Fords.", "Rowe; Stone; Teal 2001 after_authors"],
    ["Rowe, Alden, Bea Stone, et al. 2001. Fords.", "Rowe; Stone [cut short] 2001 after_authors"],
    ["XYZ (Example Society). 2001. Fords.", "XYZ [whole] 2001 after_authors"],
  ])("reads %s", (text, expected) => expect(read(text)).toBe(expected));

  test.each([
    ["Adair, J. Rivers without a date. Leeds: Invented Press.", "unread no_year"],
    ["———. 2017. More rivers.", "unread repeated_author"],
    ["___ 2017. More rivers.", "unread repeated_author"],
    ["Adair J, Brel K. 2017. Rivers.", "unread authors"],
    ["Adair, J., with K. Brel. 2017. Rivers.", "unread authors"],
    ["Adair, J. and the Ford Group. 2017. Rivers.", "unread authors"],
    ["Adair, J. and Brel. 2017. Rivers.", "unread authors"],
    // Two capitalized words after a comma may be a title or a person.
    ["Adair, J., Modern Rivers, Leeds, 2003.", "unread authors"],
    ["Adair, J., Water and Power, Leeds, 2003.", "unread authors"],
    // Each of these names a second author that a near-end reading must not drop.
    ["Brel, K.; Corso, L. Weirs. Leeds, 2003.", "unread authors"],
    ["Brel, K.; Corso, L., 'Weirs', 2003.", "unread authors"],
    ["Brel, K. Corso, L. Weirs. Leeds, 2003.", "unread authors"],
    ["Brel, Karen. Corso, L. Weirs. Leeds, 2003.", "unread authors"],
    ["Brel, K. (with L. Corso). Weirs. Leeds, 2003.", "unread authors"],
    ["Brel, Karen. With Lee Corso. Weirs. Leeds, 2003.", "unread authors"],
    ["Brel, K. … Corso, L. Weirs. Leeds, 2003.", "unread authors"],
    ["Brel, K. - Corso, L. Weirs. Leeds, 2003.", "unread authors"],
    ["Brel, K., and the Ford Group, Weirs, 2003.", "unread authors"],
    ["Brel, K. und L. Corso. Weirs. Leeds, 2003.", "unread authors"],
    ["Brel, K. und Corso. 2003. Weirs.", "unread authors"],
    ["Brel, K. et Corso, L. Weirs. Leeds, 2003.", "unread authors"],
    // What the forms for initials, `et al.`, and abbreviations must not stretch to.
    ["Brel, K. Lee Corso. 2003. Weirs.", "unread year_place"],
    ["Brel, K. Corso, L. 2003. Weirs.", "unread authors"],
    ["Brel, K. Corso and Dunmore. 2003. Weirs.", "unread year_place"],
    ["Brel, K., Modern Rivers and others, Weirs, Leeds, 2003, a copy by hand.", "unread authors"],
    ["Brel (Lee Corso). 2003. Weirs.", "unread authors"],
    ["XYZ (with Lee Corso). 2003. Weirs.", "unread authors"],
    ["Adair, J. 2014–2017. Rivers, in three parts.", "unread year_place"],
    ["Adair, J. Rivers since 1850", "unread year_place"],
    ["Adair, J. Rivers. Leeds, 2003, second printing by hand.", "unread year_place"],
    ["Adair, J. 2017. Rivers.\nBrel, K. 2018. Weirs.", "unread several_entries"],
    ["Adair, J. 2017. Rivers. Leeds. Adair, M. 2017. Weirs.", "unread several_entries"],
  ])("leaves unread: %s", (text, expected) => expect(read(text)).toBe(expected));

  test("no common way of joining a second author, set off from the title, leaves one author read alone", () => {
    const joins = [" ", ", ", ". ", "; ", " / ", " + ", " - ", " — ", " … ", " and ", " & ", ", with ", ". With ", " und ", " u. ", " et ", " y ", " och ", " (with "];
    const tails = [". Weirs. Leeds, 2003.", ", 'Weirs', 2003.", ". 2003. Weirs.", ", Weirs, Leeds, 2003."];
    const alone: string[] = [];
    for (const first of ["Brel, K.", "Brel, Karen", "Brel, K. L."]) {
      for (const join of joins) {
        for (const tail of tails) {
          const text = `${first}${join}Corso, L.${join === " (with " ? ")" : ""}${tail}`;
          const r = readEntry(text);
          if (r.status === "read" && !r.cutShort && r.authors.length < 2) alone.push(text);
        }
      }
    }
    expect(alone).toEqual([]);
  });

  test("keeps each entry as found, reports starts, subheadings, flags, and where a list ends", () => {
    const wrapped = "Corso, L. 2001. Locks. https://example.org/\nlocks";
    const lists = readReferenceLists(doc("a.docx",
      "See the references.",
      { h: 2, text: " BIBLIOGRAPHY " },
      { h: 3, text: "Printed works" },
      "Adair, J. 2017. Rivers.  ",
      "",
      ["footnote", "A note inside the list."],
      "and of their tributaries, revised.",
      wrapped,
      { h: 2, text: "Appendix" },
      "Brel, K. 2003. Not an entry.",
    ));
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ start: 1, end: 8, title: "BIBLIOGRAPHY", subheadings: [2] });
    expect(lists[0]!.entries.map((e) => [e.asFound, e.status, e.flags])).toEqual([
      ["Adair, J. 2017. Rivers.  ", "read", []],
      ["and of their tributaries, revised.", "unread", ["continuation"]],
      [wrapped, "read", ["line_break"]],
    ]);
  });

  test("a start with no heading style ends at the next heading of any level; a second start begins another list", () => {
    const lists = readReferenceLists(doc("a.docx", "References", "Adair, J. 2017. R.", { h: 4, text: "After" }, "Text.", "Bibliography", "Brel, K. 2003. W."));
    expect(lists.map((l) => [l.start, l.end, l.entries.length])).toEqual([[0, 2, 1], [4, 6, 1]]);
  });

  test("a file with no list is reported", () => {
    const r = matchAuthorDate([doc("a.docx", "A claim (Adair 2017).")]);
    expect(r.files).toEqual([{ file: "a.docx", lists: 0 }]);
    expect(outcomes(r)).toEqual(["(Adair 2017) => unresolved no_list"]);
  });
});

const LIST = [
  "Adair, J. 2017. Rivers.",
  "Brel, K. 1999. Weirs.",
  "Brel, K. 2003. More weirs.",
  "Corso, L. 2001. Locks.",
  "Corso, L., and P. Dunmore. 2008. Sluices.",
  "Ewart, R., Fane, S., & Gilby, T. 2010. Culverts.",
  "Office of Land and Water. 2004. Annual account.",
  "Müller-O’Hara, Z. 2012. Dams.",
];
const [, BREL99, BREL03, CORSO, CORSO2, EWART, OFFICE, MULLER] = LIST;

describe("US-113-AC2: citation forms", () => {
  test("groups, several years, and narrative forms give one item for each work, with prefix and locator", () => {
    const r = matchAuthorDate([chapter(LIST, "So it was (cf. Adair 2017: 14–19; Brel 1999, 2003). Corso (2001) agreed.")]);
    const items = r.brackets.flatMap((b) => (b.state === "unlinked" ? [] : b.items));
    expect(items.map((i) => [i.whole, i.year, i.prefix, i.locator, i.narrative, i.state])).toEqual([
      ["Adair", "2017", "cf.", "14–19", false, "linked"],
      ["Brel", "1999", undefined, undefined, false, "linked"],
      ["Brel", "2003", undefined, undefined, false, "linked"],
      ["Corso", "2001", undefined, undefined, true, "linked"],
    ]);
  });

  test.each([
    ["(see Adair 2017, 45)", ["see", "45"]],
    ["(See also Adair, 2017, p. 45)", ["See also", "45"]],
    ["(based on Adair 2017: pp. 4–9, 12)", ["based on", "4–9, 12"]],
    ["(Adair 2017 pp. 1012–15)", [undefined, "1012–15"]],
    ["(Adair 2017: xiv)", [undefined, "xiv"]],
    ["(Adair 2017: 45ff.)", [undefined, "45ff."]],
    ["(Adair 2017, 3-5)", [undefined, "3-5"]],
  ])("reads %s", (text, expected) => {
    const [b] = matchAuthorDate([chapter(LIST, `A claim ${text}.`)]).brackets;
    expect(b!.state).toBe("linked");
    if (b!.state !== "unlinked") expect([b!.items[0]!.prefix, b!.items[0]!.locator]).toEqual(expected);
  });

  test("series, whole names, folding, and narrative with a locator or several years", () => {
    expect(one(LIST,
      "(Corso and Dunmore 2008) (Corso & Dunmore, 2008) (Ewart, Fane, and Gilby 2010) (Ewart, Fane and Gilby 2010) (Ewart et al., 2010)",
      "(Office of Land and Water 2004) (Muller-O'Hara 2012). As Corso and Dunmore (2008: 7) show.",
      "However, Brel (1999, 2003) and Ewart et al. (2010) differ; so does the Office of Land and Water (2004).",
    )).toEqual([
      `(Corso and Dunmore 2008) => linked ${CORSO2}`,
      `(Corso & Dunmore, 2008) => linked ${CORSO2}`,
      `(Ewart, Fane, and Gilby 2010) => linked ${EWART}`,
      `(Ewart, Fane and Gilby 2010) => linked ${EWART}`,
      `(Ewart et al., 2010) => linked ${EWART}`,
      `(Office of Land and Water 2004) => linked ${OFFICE}`,
      `(Muller-O'Hara 2012) => linked ${MULLER}`,
      `(2008: 7) => linked ${CORSO2}`,
      `(1999, 2003) => linked ${BREL99} | linked ${BREL03}`,
      `(2010) => linked ${EWART}`,
      `(2004) => linked ${OFFICE}`,
    ]);
  });

  test.each([
    "(e.g. Adair 2017)", "(see, for example, Adair 2017)", "(also Adair 2017)", "(In Adair 2017)", "(Adair 2017 and elsewhere)",
    "(Adair 2017, n. 4)", "(Adair 2017/1850)", "(Adair 2014–2017)", "(Adair 2017–18)", "(Adair and Brel, Corso 2017)",
    "(June 2017)", "(a forthcoming study)", "(Adair 2017[1950])", "(the 1990s)",
  ])("leaves a form the profile does not define unlinked: %s", (text) => {
    expect(one(LIST, `A claim ${text}.`)).toEqual([`${text} => unlinked unrecognized_form`]);
  });

  test("a narrative form takes every name before the brackets and never drops one to find a match", () => {
    expect(one(LIST,
      "Brel and Corso (2001) differ.",
      "In Paris, Corso and Dunmore (2008) met.",
      "J. Corso (2001) differs.",
      "Professor Corso (2001) differs.",
      "Van Corso (2001) differs.",
      "Smythe et al. (1990) differ.",
    )).toEqual([
      "(2001) => unresolved no_entry",
      "(2008) => unresolved no_entry",
      "(2001) => unresolved no_entry",
      "(2001) => unresolved no_entry",
      "(2001) => unresolved no_entry",
      "(1990) => unresolved no_entry",
    ]);
  });

  test("a possessive is no part of the last name", () => {
    expect(one([...LIST, "Jones, A. 1990. Ponds."],
      "Corso's (2001) view, Corso and Dunmore’s (2008: 4) view, Ewart et al.'s (2010) view, and Jones' (1990) view.",
    )).toEqual([
      `(2001) => linked ${CORSO}`, `(2008: 4) => linked ${CORSO2}`, `(2010) => linked ${EWART}`, "(1990) => linked Jones, A. 1990. Ponds.",
    ]);
  });

  test("a possessive never drops a name, and an unlisted possessive stays unlinked", () => {
    expect(one(LIST, "Brel and Corso's (2001) view.", "Brel's and Corso's (2001) view.", "The year's (1999) harvest.", "Corso's study (2001).")).toEqual([
      "(2001) => unresolved no_entry", "(2001) => unresolved no_entry",
      "(1999) => unlinked no_author_form", "(2001) => unlinked no_author_form",
    ]);
  });

  test("an abbreviation and the full name after it are one author under either name", () => {
    const entry = "XYZ (Example Society of Rivers and Fords). 2001. Account.";
    expect(one([entry], "(XYZ 2001) (Example Society of Rivers and Fords 2001) XYZ's (2001) (Rivers 2001)")).toEqual([
      `(XYZ 2001) => linked ${entry}`, `(Example Society of Rivers and Fords 2001) => linked ${entry}`,
      `(2001) => linked ${entry}`, "(Rivers 2001) => unresolved unread_entry",
    ]);
  });

  test("other words before the brackets leave them unlinked, and a possible narrative form is marked", () => {
    const r = matchAuthorDate([chapter(LIST, "The treaty (1713) held. Zimmer (1999) wrote. Corso. (2001) Then Zimmer's (2001) view.", "(2017: 4)")]);
    expect(r.brackets.map((b) => [outcome(b), b.state === "unlinked" && b.possibleNarrative])).toEqual([
      ["(1713) => unlinked no_author_form", false],
      ["(1999) => unlinked no_author_form", true],
      ["(2001) => unlinked no_author_form", true],
      ["(2001) => unlinked no_author_form", true],
      ["(2017: 4) => unlinked no_author_form", false],
    ]);
  });

  test("mixed parts list how each part was read", () => {
    const [b] = matchAuthorDate([chapter(LIST, "(Adair 2017; see the map of 1850)")]).brackets;
    expect(b).toMatchObject({
      state: "unlinked", reason: "mixed_parts",
      parts: [{ text: "Adair 2017", read: "citation" }, { text: "see the map of 1850", read: "not_citation" }],
    });
  });

  test("nested and unpaired brackets", () => {
    const r = matchAuthorDate([chapter(LIST, "(a gloss, as in Corso (2001), applies in 1900)", "(Adair 2017 (reprint))", "An open (Adair 2017 bracket.", "Item 1) came in 1900.", "1850 (see) a)")]);
    expect(outcomes(r)).toEqual([
      "(a gloss, as in Corso (2001), applies in 1900) => unlinked unrecognized_form",
      `(2001) => linked ${CORSO}`,
      "(Adair 2017 (reprint)) => unlinked unrecognized_form",
    ]);
    expect(r.unpaired.map((u) => u.paragraph)).toEqual([2, 3]);
  });

  test("numbers that are part of longer numbers are no year", () => {
    expect(one(LIST, "(12000) (1,500) (10.1999) (2017.5) (A1999) (0999) (2100)")).toEqual([]);
  });
});

describe("US-113-AC3 to AC6: one match, or unresolved", () => {
  const solo = "Adair, J. 2017. Rivers.";
  const team = "Adair, J., K. Brel, and L. Corso. 2017. Rivers together.";
  const pair = "Adair, J. and K. Brel. 2017. Rivers in two.";

  test("AC3: solo and co-authored look-alikes link only to the entry with those authors", () => {
    expect(one([team, solo, pair], "(Adair 2017) (Adair et al. 2017) (Adair and Brel 2017) (Brel and Adair 2017) (Adair, Brel, and Corso 2017)")).toEqual([
      `(Adair 2017) => linked ${solo}`,
      // The pair has more authors than the one named, as does the team.
      "(Adair et al. 2017) => unresolved several_entries",
      `(Adair and Brel 2017) => linked ${pair}`,
      "(Brel and Adair 2017) => unresolved no_entry",
      `(Adair, Brel, and Corso 2017) => linked ${team}`,
    ]);
    expect(one([solo, team], "(Adair 2017) (Adair et al. 2017) (Adair, Brel et al. 2017)")).toEqual([
      `(Adair 2017) => linked ${solo}`, `(Adair et al. 2017) => linked ${team}`, `(Adair, Brel et al. 2017) => linked ${team}`,
    ]);
  });

  test("AC3: a form never matches an entry of the other kind", () => {
    expect(one([team], "(Adair 2017)")).toEqual(["(Adair 2017) => unresolved no_entry"]);
    expect(one([solo], "(Adair et al. 2017) Adair et al. (2017)")).toEqual(["(Adair et al. 2017) => unresolved no_entry", "(2017) => unresolved no_entry"]);
  });

  test("authors cut short in a list match only an et al. citation of names the entry shows", () => {
    const cut = "Adair, J. et al. 2017. Rivers.";
    expect(one([cut], "(Adair 2017) (Adair et al. 2017) (Adair, Brel et al. 2017)")).toEqual([
      "(Adair 2017) => unresolved no_entry", `(Adair et al. 2017) => linked ${cut}`, "(Adair, Brel et al. 2017) => unresolved no_entry",
    ]);
  });

  test("AC4: no match and several matches are unresolved with their candidates; suffixes must be equal", () => {
    const entries = ["Adair, J. 2017a. A.", "Adair, M. 2017a. B.", "Adair, J. 2017b. C."];
    const r = matchAuthorDate([chapter(entries, "(Dunmore 1997) (Adair 2017a) (Adair 2017) (Adair 2017b)")]);
    expect(outcomes(r)).toEqual([
      "(Dunmore 1997) => unresolved no_entry", "(Adair 2017a) => unresolved several_entries",
      "(Adair 2017) => unresolved no_entry", "(Adair 2017b) => linked Adair, J. 2017b. C.",
    ]);
    const several = r.brackets[1]!;
    if (several.state === "unlinked") throw new Error("not read");
    expect(several.items[0]!.candidates.map((c) => [c.asFound, c.why])).toEqual([[entries[0]!, "matches"], [entries[1]!, "matches"]]);
  });

  test("AC5: an entry only in another chapter's list is a candidate and is not linked", () => {
    const r = matchAuthorDate([
      doc("one.docx", "A claim (Corso 2001). Corso (2001) too.", "References", "Adair, J. 2017. Rivers."),
      doc("two.docx", "Nothing.", "References", "Corso, L. 2001. Locks."),
    ]);
    expect(outcomes(r)).toEqual(["(Corso 2001) => unresolved no_entry", "(2001) => unresolved no_entry"]);
    const b = r.brackets[0]!;
    if (b.state === "unlinked") throw new Error("not read");
    expect(b.items[0]!.candidates).toEqual([{ file: "two.docx", paragraph: 2, asFound: "Corso, L. 2001. Locks.", why: "other_list" }]);
  });

  test("AC5: of several lists in one file, each serves only the text before it", () => {
    const r = matchAuthorDate([doc("book.docx",
      "(Adair 2017) (Corso 2001)", { h: 2, text: "References" }, "Adair, J. 2017. Rivers.",
      { h: 1, text: "Two" }, "(Adair 2017) (Corso 2001)", { h: 2, text: "References" }, "Corso, L. 2001. Locks.",
      { h: 1, text: "Appendix" }, "(Corso 2001)")]);
    expect(outcomes(r)).toEqual([
      "(Adair 2017) => linked Adair, J. 2017. Rivers.", "(Corso 2001) => unresolved no_entry",
      "(Adair 2017) => unresolved no_entry", "(Corso 2001) => linked Corso, L. 2001. Locks.",
      "(Corso 2001) => unresolved no_list",
    ]);
  });

  test.each([
    ["one that has no readable authors", ["Adair J, Brel K. 2017. Other rivers."]],
    ["one with the year out of place", ["Adair, J. Other rivers. Leeds, 2017, a second state."]],
    ["one with another suffix", ["Adair J. 2017b. Other rivers."]],
    ["a repeated-author mark after the same name", ["Adair, J. 2016. Earlier.", "———. 2017. Other rivers."]],
    ["a second mark in a row", ["Adair, J. 2015. Earlier.", "———. 2016. Later.", "———. 2017. Other rivers."]],
    ["an entry split over two paragraphs", ["Adair, M., and the others of the ford", "2017. Other rivers."]],
    ["two entries run together", ["Brel, K. 2001. Weirs. Adair, M. 2017. Other rivers."]],
    ["a name with no comma read as a whole name", ["Mary Adair. 2017. Other rivers."]],
  ])("AC6: an entry that could be the one meant blocks the link: %s", (_, extra) => {
    const r = matchAuthorDate([chapter([solo, ...extra], "(Adair 2017)")]);
    expect(outcomes(r)).toEqual(["(Adair 2017) => unresolved unread_entry"]);
    const b = r.brackets[0]!;
    if (b.state === "unlinked") throw new Error("not read");
    expect(b.items[0]!.candidates.map((c) => c.why)).toContain("could_fit");
    expect(b.items[0]!.candidates[0]).toMatchObject({ asFound: solo, why: "matches" });
  });

  test("a wrapped line that adds no year and no author does not block the entry above it", () => {
    for (const line of ["https://example.org/2017/rivers", "and of their tributaries."]) {
      expect(one([solo, line], "(Adair 2017)")).toEqual([`(Adair 2017) => linked ${solo}`]);
    }
  });

  test("AC6: an unread entry alone gives its own reason, and an unrelated one blocks nothing", () => {
    expect(one(["Adair J. 2017. R."], "(Adair 2017)")).toEqual(["(Adair 2017) => unresolved unread_entry"]);
    expect(one([solo, "Adairson J. 2017. R.", "Adair J. 2016. R."], "(Adair 2017)")).toEqual([`(Adair 2017) => linked ${solo}`]);
  });
});

describe("US-113-AC7 and AC8: ranges, and the account", () => {
  test.each(["(1516–1850)", "(c. 1600–1850)", "(ca. 1600-50)", "(1914–present)", "(r. 1509–47; 1553–58)", "(1516–1850 CE)", "(2001–2003)"])(
    "AC7: %s is a range of dates, even after a listed name", (text) => {
      expect(one(LIST, `The reign ${text}.`, `Corso ${text}.`)).toEqual([`${text} => unlinked year_range`, `${text} => unlinked year_range`]);
    });

  test("AC8: every location outside a list is examined, and a table's brackets are listed with that reason", () => {
    const r = matchAuthorDate([doc("a.docx",
      { h: 1, text: "Rivers (Adair 2017)" },
      ["footnote", "(Adair 2017)"], ["endnote", "(1516–1850)"], ["caption", "A weir (Corso 2001)."],
      ["table", "(Adair 2017)"], ["table", "(1516–1850)"],
      { h: 1, text: "References" }, "Adair, J. 2017. Rivers (second edition 1990).", ["footnote", "(Brel 1999)"], ["table", "(Brel 1999)"], "Corso, L. 2001. Locks.")]);
    expect(r.brackets.map((b) => [b.paragraph, b.location, outcome(b).split(" => ")[1]!.split(" ")[0], b.state === "unlinked" ? b.reason : ""])).toEqual([
      [0, "body", "linked", ""], [1, "footnote", "linked", ""], [2, "endnote", "unlinked", "year_range"], [3, "caption", "linked", ""],
      [4, "table", "unlinked", "in_table"], [5, "table", "unlinked", "in_table"],
      [8, "footnote", "unresolved", ""], [9, "table", "unlinked", "in_table"],
    ]);
    for (const b of r.brackets) expect(["a.docx", b.text]).toEqual([b.file, expect.stringMatching(/^\(.*\)$/)]);
    expect(r.counts).toMatchObject({ examined: 8, linked: 3, unresolved: 1, unlinked: 4 });
  });

  test("AC8: a bracket with one unresolved item counts as unresolved", () => {
    const r = matchAuthorDate([chapter(LIST, "(Adair 2017; Zimmer 1990)")]);
    expect(r.counts).toMatchObject({ examined: 1, linked: 0, unresolved: 1, items: { linked: 1, unresolved: 1 } });
  });

  test("AC8: the check fails when the counts do not add up", () => {
    const r = matchAuthorDate([chapter(LIST, "(Adair 2017)")]);
    expect(() => checkAccount(r, 1)).not.toThrow();
    expect(() => checkAccount(r, 2)).toThrow("does not add up");
    expect(() => checkAccount({ ...r, brackets: [] }, 1)).toThrow("does not add up");
  });
});

// A hand-made answer list over two chapters with solo and co-authored
// look-alikes, a missing entry, and an unread one.
describe("US-113: hand-made answer list", () => {
  const files = [
    doc("ch1.docx",
      { h: 1, text: "Chapter one" },
      "Fords were old (Quill 2011). Later work disagrees (Quill et al. 2011; Rusk 2004: 31).",
      "Quill and Sorrel (2011) hold a third view, which Rusk (2004, 2006) rejects (cf. Tamsin 1988).",
      ["footnote", "See also Tamsin (1988) and the survey (Vell 1975)."],
      { h: 1, text: "References" },
      "Quill, A. 2011. Fords.",
      "Quill, A., B. Sorrel, and C. Teal. 2011. Fords revisited.",
      "Quill, A., and B. Sorrel. 2011. Two on fords.",
      "Rusk, D. 2004. Ferries.",
      "Rusk, D. 2006. Piers.",
      "———. 2006. Jetties.",
      "Tamsin, E. Causeways. Leeds: Invented Press, 1988."),
    doc("ch2.docx",
      "Bridges came later (Vell 1975; Quill 2011).",
      { h: 1, text: "References" },
      "Vell, F. 1975. Bridges."),
  ];
  const ANSWERS = [
    "(Quill 2011) => linked Quill, A. 2011. Fords.",
    "(Quill et al. 2011; Rusk 2004: 31) => unresolved several_entries | linked Rusk, D. 2004. Ferries.",
    "(2011) => linked Quill, A., and B. Sorrel. 2011. Two on fords.",
    "(2004, 2006) => linked Rusk, D. 2004. Ferries. | unresolved unread_entry",
    "(cf. Tamsin 1988) => linked Tamsin, E. Causeways. Leeds: Invented Press, 1988.",
    "(1988) => linked Tamsin, E. Causeways. Leeds: Invented Press, 1988.",
    "(Vell 1975) => unresolved no_entry",
    "(Vell 1975; Quill 2011) => linked Vell, F. 1975. Bridges. | unresolved no_entry",
  ];
  test("matches the answers, with no wrong link", () => expect(outcomes(matchAuthorDate(files))).toEqual(ANSWERS));
  test("AC11: two runs give identical output, and the input is not changed", () => {
    const before = JSON.stringify(files);
    expect(JSON.stringify(matchAuthorDate(files))).toBe(JSON.stringify(matchAuthorDate(structuredClone(files))));
    expect(JSON.stringify(files)).toBe(before);
  });
});

// A seeded set. Each citation is written from a chosen work, so its answer is
// known when it is written: the one entry it may link to, or none.
describe("US-113: seeded set", () => {
  function seeded(seed: number) {
    let state = seed;
    const random = (n: number) => {
      state = (state * 48271) % 2147483647;
      return state % n;
    };
    const pick = <T>(all: T[]) => all[random(all.length)]!;
    // Few names and years, so that look-alikes and repeats are common.
    const NAMES = ["Quill", "Rusk", "Sorrel", "van Teal"];
    const YEARS = ["2001", "2002", "2002a"];
    interface Work { authors: string[]; year: string; text: string; read: boolean }
    const files: Document[] = [];
    const expected: (string | null)[] = [];
    const lists: Work[][] = [];
    let brackets = 0;
    for (let c = 0; c < 4; c++) {
      const works: Work[] = [];
      for (let w = 3 + random(6); w > 0; w--) {
        const authors = [...new Set(Array.from({ length: pick([1, 1, 2, 3]) }, () => pick(NAMES)))];
        const year = pick(YEARS);
        const first = `${authors[0]}, A.`;
        const rest = authors.slice(1).map((a, i, all) => `${i === all.length - 1 ? "and " : ""}B. ${a}`);
        const names = [first, ...rest].join(", ");
        const layout = pick(["after", "after", "end", "unread"]);
        const title = `Work ${c}-${w}`;
        const text = layout === "after" ? `${names} ${year}. ${title}.`
          : layout === "end" ? `${names}${rest.length ? "." : ""} ${title}. Leeds: Invented Press, ${year}.`
          : `${authors.join(" and ")} (with others) ${year}. ${title}.`;
        works.push({ authors, year, text, read: layout !== "unread" });
      }
      lists.push(works);
    }
    for (const [c, works] of lists.entries()) {
      const paragraphs: Spec[] = [];
      for (let p = 0; p < 40; p++) {
        // Sometimes a work from another chapter, or one that no list has.
        const roll = random(10);
        const meant = roll === 0 ? pick(pick(lists)) : roll === 1 ? { authors: [pick(NAMES)], year: pick(YEARS) } : pick(works);
        const { authors, year } = meant;
        const etAl = authors.length > 2;
        const named = etAl ? `${authors[0]} et al.` : authors.join(" and ");
        const narrative = random(3) === 0;
        paragraphs.push(narrative ? `As ${named} (${year}) wrote.` : `A claim (${pick(["", "cf. ", "see "])}${named} ${year}${pick(["", ": 4", ", 12–19"])}).`);
        if (random(8) === 0) paragraphs.push("A reign (1516–1850).");
        // The answer: the only entry of this list with these authors in this form, unless an unread one could be it.
        const fits = works.filter((w) => w.read && w.year === year &&
          (etAl ? w.authors.length > 1 && w.authors[0] === authors[0] : w.authors.join() === authors.join()));
        const blocked = works.some((w) => !w.read && w.year.slice(0, 4) === year.slice(0, 4) && w.authors.includes(authors[0]!));
        expected.push(fits.length === 1 && !blocked ? `ch${c}: ${fits[0]!.text}` : null);
      }
      brackets += paragraphs.length;
      files.push(doc(`ch${c}.docx`, ...paragraphs, { h: 1, text: "References" }, ...works.map((w) => w.text)));
    }
    return { files, expected, brackets };
  }

  test("has no wrong link and no missed one, its counts add up, and two runs are identical", () => {
    let linked = 0;
    let unresolved = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { files, expected, brackets } = seeded(seed);
      const r = matchAuthorDate(files);
      const cited = r.brackets.filter((b) => !(b.state === "unlinked" && b.reason === "year_range"));
      // Narrative et al. and listed names are always citation forms; an unlisted narrative name may be left unlinked.
      const got = cited.map((b) => {
        if (b.state === "unlinked") {
          expect(b.reason).toBe("no_author_form");
          return null;
        }
        expect(b.items).toHaveLength(1);
        const item = b.items[0]!;
        if (item.state !== "linked") return null;
        expect(item.entry.file).toBe(b.file);
        return `${item.entry.file.replace(".docx", "")}: ${item.entry.asFound}`;
      });
      expect(got).toEqual(expected);
      expect(r.counts.examined).toBe(brackets);
      expect(r.counts.linked + r.counts.unresolved + r.counts.unlinked).toBe(brackets);
      expect(JSON.stringify(matchAuthorDate(files))).toBe(JSON.stringify(r));
      linked += r.counts.linked;
      unresolved += r.counts.unresolved;
    }
    // The set exercises both outcomes.
    expect(linked).toBeGreaterThan(5000);
    expect(unresolved).toBeGreaterThan(5000);
  });
});
