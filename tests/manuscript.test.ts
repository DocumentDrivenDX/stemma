// The CONTRACT-006 reader. All manuscript content here is invented.
import { describe, expect, test } from "bun:test";
import { readManuscript, splitSentences } from "@stemma/manuscript";

const PATH = "manuscript/chp-fixture0chapter1.md";
const bytes = (text: string) => new TextEncoder().encode(text);
const read = (text: string) => readManuscript([{ path: PATH, bytes: bytes(text) }]);

function chapter(text: string) {
  const out = read(text);
  expect(out.problems).toEqual([]);
  return out.chapters[0]!;
}

const keys = (items: { key: string }[]) => items.map((c) => c.key);

// The example in CONTRACT-006.
const EXAMPLE = `# Harbours {#sec-harbours}

[The mole was rebuilt at least once.[@example-1987 page="41"]]{.claim ids="clm-4q7m2c9x0b5ke8dn1v3a"}
One survey calls it ["a patched wall"]{.quote cite="1"}.[@example-1990 page="12"; @? id="cit-3k9d2m7q0x5v8b1n4c6t"][^dates]

[Trade fell afterwards.]{.needs-source}

[^dates]: The dates are disputed; see [@example-2001 chapter="3" prefix="especially"].
`;

describe("the contract example", () => {
  test("its first sentence has one claim, one citation and the plain sentence text", () => {
    const read = chapter(EXAMPLE);
    const sentence = read.sentences.find((s) => s.text.startsWith("The mole"))!;
    expect(sentence.text).toBe("The mole was rebuilt at least once.");
    expect(keys(sentence.citations)).toEqual(["example-1987"]);
    expect(sentence.citations[0]!.locator).toEqual({ label: "page", value: "41" });
    expect(read.claims).toHaveLength(1);
    expect(read.claims[0]!.ids).toEqual(["clm-4q7m2c9x0b5ke8dn1v3a"]);
    expect(keys(read.claims[0]!.citations)).toEqual(["example-1987"]);
  });

  test("a changed page changes the locator and keeps the sentence digest", () => {
    const before = chapter(EXAMPLE);
    const after = chapter(EXAMPLE.replace('page="41"', 'page="42"'));
    expect(after.citations[0]!.locator!.value).toBe("42");
    expect(after.sentences.map((s) => s.sha256)).toEqual(before.sentences.map((s) => s.sha256));
  });

  test("a marked quotation takes the citation cite names, and a footnote keeps its own sentences", () => {
    const read = chapter(EXAMPLE);
    expect(read.quotations.map((q) => [q.form, q.text, q.citation?.key])).toEqual([["marked", "a patched wall", "example-1990"]]);
    const note = read.sentences.find((s) => s.note === "dates")!;
    expect(note.text).toBe("The dates are disputed; see .");
    expect(note.citations[0]).toMatchObject({ key: "example-2001", prefix: "especially", locator: { label: "chapter", value: "3" } });
    expect(read.citations.find((c) => c.key === "?")!.id).toBe("cit-3k9d2m7q0x5v8b1n4c6t");
  });

  test("a passage marked as needing a source is unsourced until a keyed citation with a locator is there", () => {
    expect(chapter(EXAMPLE).needsSource.map((n) => n.sourced)).toEqual([false]);
    expect(chapter('[Trade fell.]{.needs-source}[@a1 page="2"]\n').needsSource[0]!.sourced).toBe(true);
    expect(chapter("[Trade fell.]{.needs-source}[@a1]\n").needsSource[0]!.sourced).toBe(false);
  });
});

describe("sentences (SD-007 BR-711 to BR-713)", () => {
  const split = (text: string) => splitSentences(text).map((r) => text.slice(r.start, r.end));

  test("a boundary needs a following capital, or the end of the block", () => {
    expect(split("It fell. Then it rose? Yes! so it seems.")).toEqual(["It fell.", "Then it rose?", "Yes! so it seems."]);
  });

  test("abbreviations and initials do not end a sentence", () => {
    expect(split("See p. 4 and cf. Hart, e.g. J. R. Hart. Next.")).toEqual(["See p. 4 and cf. Hart, e.g. J. R. Hart.", "Next."]);
  });

  test("an unlisted abbreviation before a capital does", () => {
    expect(split("Tolls, tithes, etc. The rest.")).toEqual(["Tolls, tithes, etc.", "The rest."]);
  });

  test("ideographic stops need no space", () => {
    expect(split("甲。乙。")).toEqual(["甲。", "乙。"]);
  });

  test("no boundary falls inside double quotation marks", () => {
    expect(chapter('He wrote "It fell. It rose." Then he left.\n').sentences.map((s) => s.text))
      .toEqual(['He wrote "It fell. It rose."', "Then he left."]);
  });

  test("a citation after the sentence's space still belongs to it", () => {
    const read = chapter("A sentence. [@hartwell1998]\n\nA second one. [@b2] Then more.\n");
    expect(read.sentences.map((s) => [s.text, keys(s.citations)])).toEqual([
      ["A sentence.", ["hartwell1998"]], ["A second one.", ["b2"]], ["Then more.", []],
    ]);
  });

  test("a footnote holding only citations belongs to the sentence with its marker", () => {
    const read = chapter('The toll rose.[^1] It fell.\n\n[^1]: [@a1 page="3"]; [@b2].\n');
    expect(read.sentences.map((s) => [s.text, keys(s.citations)])).toEqual([["The toll rose.", ["a1", "b2"]], ["It fell.", []]]);
  });

  test("an endnote is read as a footnote is, and each note keeps its kind", () => {
    // Labels of equal length, so that every position is the same in both.
    const text = (first: string, second: string) =>
      `[The toll rose.[^${first}]]{.claim ids="clm-fixture0claim001"} It fell.[^${second}]\n\n`
      + `[^${first}]: [@a1 page="3"].\n[^${second}]: The roll says "less" there.[@b2 page="4"]\n\n  It says no more.\n`;
    const foot = chapter(text("abc1", "abc2"));
    const end = chapter(text("en-1", "en-2"));
    const unlabelled = (read: typeof foot) => JSON.parse(JSON.stringify(read, (key, value) => (key === "note" || key === "noteKind" ? undefined : value)));
    expect(unlabelled(end)).toEqual(unlabelled(foot));
    expect(keys(end.claims[0]!.citations)).toEqual(["a1"]);
    expect(end.quotations.map((q) => [q.text, q.citation?.key])).toEqual([["less", "b2"]]);
    for (const [read, kind] of [[foot, "footnote"], [end, "endnote"]] as const) {
      expect(read.blocks.map((b) => b.noteKind)).toEqual([undefined, kind, kind, kind]);
      expect(read.sentences.map((s) => s.noteKind)).toEqual([undefined, undefined, kind, kind]);
    }
  });

  test("footnotes and endnotes in one chapter each keep their own kind", () => {
    const read = chapter("One.[^1] Two.[^en-1]\n\n[^en-1]: At the end.\n\n[^1]: At the foot.\n");
    expect(read.sentences.filter((s) => s.note).map((s) => [s.text, s.note, s.noteKind]))
      .toEqual([["At the end.", "en-1", "endnote"], ["At the foot.", "1", "footnote"]]);
  });

  test("equal citations in one sentence are told apart by their ordinal", () => {
    const read = chapter('Twice [@a1 page="3"] and again [@a1 page="3"] and [@a1 page="4"].\n');
    expect(read.citations.map((c) => c.ordinal)).toEqual([0, 1, 0]);
  });

  test("a citation keeps its line and column", () => {
    expect(chapter("# Title\n\n- An item\n  that cites [@a1].\n").citations[0]).toMatchObject({ line: 4, column: 14 });
  });
});

describe("quotations", () => {
  const quoted = (text: string) => chapter(text).quotations.map((q) => [q.form, q.text, q.citation?.key ?? null]);

  test("double quotation marks count, attributed only with exactly one citation", () => {
    expect(quoted("It was “very small” [@a1].\n")).toEqual([["double", "very small", "a1"]]);
    expect(quoted('It was "small" [@a1; @b2].\n')).toEqual([["double", "small", null]]);
    expect(quoted('It was "small".\n')).toEqual([["double", "small", null]]);
  });

  test("single quotation marks count only inside a marked span", () => {
    expect(quoted("It was 'small' [@a1].\n")).toEqual([]);
    expect(quoted("It was ['small']{.quote} [@a1].\n")).toEqual([["marked", "'small'", "a1"]]);
  });

  test("marks around or inside a marked span are not read twice", () => {
    expect(quoted('It was "[a small wall]{.quote}" [@a1].\n')).toEqual([["marked", "a small wall", "a1"]]);
    expect(quoted('It was ["a small wall"]{.quote} [@a1].\n')).toEqual([["marked", "a small wall", "a1"]]);
  });

  test("a term marked as not a quotation is listed and not read", () => {
    const read = chapter('The so-called ["mole"]{.not-quote} stood.\n');
    expect(read.quotations).toEqual([]);
    expect(read.notQuotes.map((n) => n.text)).toEqual(['"mole"']);
  });

  test("a mark with no partner is reported, not silently passed over", () => {
    expect(chapter("A 5\" pipe.\n").unpairedQuoteMarks).toEqual([{ line: 1, column: 4 }]);
  });

  test("a block quote takes the only citation in the introducing sentence", () => {
    expect(quoted("The survey says this: [@a1]\n\n> The wall is patched.\n> It leans.\n"))
      .toEqual([["block", "The wall is patched. It leans.", "a1"]]);
  });

  test("a block quote prefers its own citation, and an attribute line chooses between several", () => {
    expect(quoted("It says: [@a1]\n\n> Patched. [@b2]\n")).toEqual([["block", "Patched.", "b2"]]);
    expect(quoted('Both say: [@a1; @b2]\n\n{.quote cite="2"}\n> Patched.\n')).toEqual([["block", "Patched.", "b2"]]);
    expect(quoted("Both say: [@a1; @b2]\n\n> Patched.\n")).toEqual([["block", "Patched.", null]]);
  });

  test("a language attribute line does not change what is quoted", () => {
    expect(quoted('He wrote: [@a1]\n\n{lang="ar" dir="rtl"}\n> نص\n')).toEqual([["block", "نص", "a1"]]);
  });
});

describe("layout features (CONTRACT-006 E, M1)", () => {
  test("headings, lists, emphasis, escapes, hard breaks, spans and unconverted blocks", () => {
    const read = chapter(`## A *small* heading

1. First **item**
2. Second _item_ with snake_case_name, 2 * 3 and \\[brackets\\] \\@here.\\
   And a [word]{lang="fr"}.

::: unconverted {id="itm-fixture0item0001"}
| kept [@never-read] as text
:::
`);
    expect(read.blocks.map((b) => [b.kind, b.list, b.text])).toEqual([
      ["heading", false, "A small heading"],
      ["paragraph", true, "First item"],
      ["paragraph", true, "Second item with snake_case_name, 2 * 3 and [brackets] @here.\nAnd a word."],
      ["unconverted", false, "| kept [@never-read] as text"],
    ]);
    expect(read.citations).toEqual([]);
  });

  test("a claim around a footnote marker holds the note's citations", () => {
    const read = chapter('[The toll rose.[^1]]{.claim ids="clm-fixture0claim001"}\n\n[^1]: Compare the roll. [@a1]\n');
    expect(keys(read.claims[0]!.citations)).toEqual(["a1"]);
  });

  test("a checkout's CRLF line ends read as LF", () => {
    expect(chapter("One line [@a1].\r\nAnother.\r\n").sentences.map((s) => s.text)).toEqual(["One line .", "Another."]);
  });
});

describe("anything else is refused with its position", () => {
  const unsupported: [string, string][] = [
    ["raw HTML", "A <b>bold</b> word.\n"], ["an HTML comment", "<!-- hidden -->\n"], ["an automatic link", "See <http://example.org>.\n"],
    ["a link", "See [this](http://example.org).\n"], ["an image", "![alt](a.png)\n"], ["a code span", "Run `this`.\n"],
    ["a code fence", "```\ncode\n```\n"], ["indented code", "    code\n"], ["a thematic break", "One.\n\n---\n"],
    ["an underlined heading", "Title\n=====\n"], ["a table", "| a | b |\n|---|---|\n"], ["a deep heading", "##### Deep\n"],
    ["a figure", "::: figure {#fig-a}\nCaption\n:::\n"], ["a cross-reference", "[](#sec-a){.ref}\n"],
    ["an index entry", '[]{.index term="x"}\n'], ["an unknown class", "[x]{.loud}\n"], ["a character reference", "A &amp; B.\n"],
    ["an unknown citation attribute", '[@a1 pg="2"]\n'], ["a lazy quotation line", "> One\ntwo\n"],
  ];
  for (const [what, text] of unsupported) {
    test(what, () => {
      const out = read(text);
      expect(out.chapters).toEqual([]);
      expect(out.problems.map((p) => p.code)).toEqual(["manuscript_unsupported"]);
    });
  }

  const malformed: [string, string][] = [
    ["a stray bracket", "A [bracket.\n"], ["a stray brace", "A {brace}.\n"], ["an unbound citation without a record", "[@?]\n"],
    ["two locators", '[@a1 page="1" folio="2"]\n'], ["overlapping claims", '[[a]{.claim ids="clm-fixture0claim001"}]{.claim ids="clm-fixture0claim002"}\n'],
    ["a claim without a claim ID", '[a]{.claim ids="src-fixture0claim001"}\n'], ["a cite out of range", '["a"]{.quote cite="3"} [@a1].\n'],
    ["a marker without a note", "A.[^1]\n"], ["a note without a marker", "A.\n\n[^1]: Lost.\n"],
    ["an endnote marker without a note", "A.[^en-1]\n"], ["an endnote without a marker", "A.\n\n[^en-1]: Lost.\n"],
    ["an endnote defined twice", "A.[^en-1]\n\n[^en-1]: One.\n\n[^en-1]: Two.\n"],
    ["an endnote label with nothing after en-", "A.[^en-]\n\n[^en-]: One.\n"],
    ["a misplaced attribute line", '{lang="fr"}\nText.\n'], ["an unclosed unconverted block", '::: unconverted {id="itm-fixture0item0001"}\n'],
  ];
  for (const [what, text] of malformed) {
    test(what, () => expect(read(text).problems.map((p) => p.code)).toEqual(["manuscript_syntax"]));
  }

  const nested: [string, string, string][] = [
    ["an endnote in a footnote", "A.[^1]\n\n[^1]: B.[^en-1]\n\n[^en-1]: C.\n", "endnote inside a footnote"],
    ["a footnote in an endnote", "A.[^en-1]\n\n[^en-1]: B.[^1]\n\n[^1]: C.\n", "footnote inside an endnote"],
    ["an endnote referred to twice", "A.[^en-1] B.[^en-1]\n\n[^en-1]: C.\n", "an endnote referred to twice"],
    ["an endnote defined in a list", "- A.[^en-1]\n\n  [^en-1]: C.\n", "endnote definition inside another block"],
  ];
  for (const [what, text, detail] of nested) {
    test(what, () => expect(read(text).problems.map((p) => [p.code, p.detail])).toEqual([["manuscript_unsupported", detail]]));
  }

  test("the position is the file's line and column, and a problem holds no manuscript text", () => {
    const [problem] = read("# Fine\n\n> A secret <i>word</i>.\n").problems;
    expect(problem).toMatchObject({ path: PATH, line: 3, column: 12 });
    expect(JSON.stringify(problem)).not.toContain("secret");
  });

  test("a repeated citation id, in one file or across two", () => {
    const one = 'A [@a1 id="cit-fixture0good00001"].\n';
    expect(read(`${one}\n${one}`).problems.map((p) => p.code)).toEqual(["manuscript_duplicate_id"]);
    const two = readManuscript([
      { path: PATH, bytes: bytes(one) }, { path: "manuscript/chp-fixture0chapter2.md", bytes: bytes(one) },
    ]);
    expect([two.chapters.length, two.problems.map((p) => p.code)]).toEqual([1, ["manuscript_duplicate_id"]]);
  });

  test("a wrong file name, a byte-order mark or bad UTF-8 is a problem, and other files are listed as unread", () => {
    const out = readManuscript([
      { path: "manuscript/Introduction.md", bytes: bytes("A.\n") },
      { path: "manuscript/chp-fixture0chapter1.md", bytes: bytes("﻿A.\n") },
      { path: "manuscript/chp-fixture0chapter2.md", bytes: new Uint8Array([0xff, 0xfe]) },
      { path: "manuscript/draft.docx", bytes: bytes("x") },
    ]);
    expect(out.chapters).toEqual([]);
    expect(out.problems).toHaveLength(3);
    expect(out.unread).toEqual(["manuscript/draft.docx"]);
  });
});
