// `takeover` from a Word chapter to records, the Stemma copy, `check`, and the
// first report. All text is invented, and no file saved by a real tool is tested.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planTakeover } from "../packages/intake/src/index.ts";
import { readManuscript, tidy, verifyChapter, writeChapter } from "../packages/manuscript/src/index.ts";
import { randomToken, readProject, withWriteLock, writeStaged } from "../packages/workspace/src/index.ts";
import { ROOT, temporary, zip } from "./helpers.ts";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r = (text: string) => `<w:r><w:t xml:space="preserve">${escape(text)}</w:t></w:r>`;
const p = (inner: string, style = "") => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${inner}</w:p>`;
const footnote = (id: number) => `<w:r><w:footnoteReference w:id="${id}"/></w:r>`;
const endnote = (id: number) => `<w:r><w:endnoteReference w:id="${id}"/></w:r>`;
const cell = (inner: string) => `<w:tbl><w:tr><w:tc>${p(r("Year"))}</w:tc><w:tc>${p(inner)}</w:tc></w:tr></w:tbl>`;

interface Parts { body: string; footnotes?: Record<number, string>; endnotes?: Record<number, string>; comments?: string[]; extra?: Record<string, string> }

function docx({ body, footnotes = {}, endnotes = {}, comments = [], extra = {} }: Parts): Uint8Array {
  const notes = (tag: string, all: Record<number, string>) =>
    `<w:${tag}s ${W}>${Object.entries(all).map(([id, text]) => `<w:${tag} w:id="${id}">${p(r(text))}</w:${tag}>`).join("")}</w:${tag}s>`;
  return zip({
    "word/document.xml": `<w:document ${W}><w:body>${body}</w:body></w:document>`,
    "word/styles.xml": `<w:styles ${W}><w:style w:styleId="H1"><w:name w:val="heading 1"/></w:style><w:style w:styleId="H2"><w:name w:val="heading 2"/></w:style></w:styles>`,
    "word/footnotes.xml": notes("footnote", footnotes),
    "word/endnotes.xml": notes("endnote", endnotes),
    "word/comments.xml": `<w:comments ${W}>${comments.map((c, i) => `<w:comment w:id="${i + 1}" w:author="R. Reader">${p(r(c))}</w:comment>`).join("")}</w:comments>`,
    ...extra,
  });
}

const list = (...entries: string[]) => p(r("References"), "H1") + entries.map((e) => p(r(e))).join("");

const WEIRS: Parts = {
  body: [
    p(r("The Weirs of an Invented River"), "H1"),
    p(r('# The toll was "paid in salt" (Adair 2017, 12). Others doubt it (cf. Brel 2001: 4-5; Corso 1999).') + footnote(2)),
    p(r('Adair (2017) calls the weir "a patched wall" and says no more. The river was "very low" that summer.')),
    p(r("A missing work is cited here (Dune 2010 [CHECK]). A range (1516–1850) is not a citation.") + footnote(3) + endnote(1)),
    cell(r("Toll (Adair 2017)") + footnote(5)),
    p(r("A heading citation (Brel 2001)"), "H2"),
    p(r("(Adair 2017, 40)")),
    p(r("Subject to *asterisks*, <angles>, {braces} & more_underscores! See [@fake] and `ticks`.")),
    list("Adair, Mary. 2017. Rivers of salt.", "Brel, K. 2001. Weirs.", "Corso, L. 1999. Locks.", "Eyre, J. 1988. Never cited.", "———. no year here"),
  ].join(""),
  footnotes: { 2: " (Brel 2001, 7)", 3: ' A discursive note says "so it was" (Corso 1999).', 5: " A table note (Adair 2017)." },
  endnotes: { 1: " Ibid., 9." },
  comments: ["Is that right?"],
};

const LOCKS: Parts = {
  body: [
    p(r("Locks on the Lower Reach"), "H1"),
    p(r("The lower reach had three locks, each with its own keeper and toll book (Adair 2017).")),
    list("Adair, Mary. 2017. Rivers of salt."),
  ].join(""),
};

const command = (project: string, ...args: string[]) => {
  const done = spawnSync(process.execPath, ["--no-install", "--no-env-file", "--config=/dev/null", join(ROOT, "dist/stemma.js"), ...args, "--project", project], { encoding: "utf8" });
  return { code: done.status, out: done.stdout, err: done.stderr };
};

function project(): { dir: string; root: string; file: (name: string, parts: Parts) => string } {
  const dir = temporary();
  const root = join(dir, "book");
  expect(command(root, "init").code).toBe(0);
  return {
    dir, root,
    file: (name, parts) => {
      const path = join(dir, name);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, docx(parts));
      return path;
    },
  };
}

/** Every project file outside .stemma, by path, with its content. */
function tree(root: string, at = ""): Record<string, string> {
  return Object.fromEntries(readdirSync(join(root, at), { withFileTypes: true }).filter((e) => !e.name.startsWith(".")).flatMap((e) => {
    const path = at ? `${at}/${e.name}` : e.name;
    return e.isDirectory() ? Object.entries(tree(root, path)) : [[path, readFileSync(join(root, path), "utf8")]];
  }));
}

const records = (root: string, directory: string): any[] =>
  Object.entries(tree(root)).filter(([path]) => path.startsWith(`records/${directory}/`)).map(([, text]) => JSON.parse(text));
const chapters = (root: string) => readManuscript(readProject(root).manuscript);
const digest = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("takeover of a Word chapter (US-099, US-113)", () => {
  const made = project();
  const original = made.file("weirs.docx", WEIRS);
  const before = digest(original);
  const taken = command(made.root, "takeover", original, "--format", "json");
  const report = JSON.parse(taken.out).body;
  const copy = chapters(made.root);
  const chapter = copy.chapters[0]!;

  test("leaves the original unchanged and keeps no copy of it", () => {
    expect([taken.code, taken.err]).toEqual([1, ""]);
    expect(digest(original)).toBe(before);
    expect(Object.keys(tree(made.root)).filter((f) => f.endsWith(".docx"))).toEqual([]);
    expect(records(made.root, "imports")).toMatchObject([{ format: "docx", original_name: "weirs.docx", original_sha256: before, entry_count: 5 }]);
    expect(Object.values(tree(made.root)).join("")).not.toContain(made.dir);
  });

  test("writes a copy the reader reads, with a marker for each citation and every note", () => {
    expect([copy.problems, copy.chapters.length]).toEqual([[], 1]);
    expect(chapter.citations.map((c) => [c.key, c.locator?.value, c.prefix, c.suffix, c.mode]).slice(0, 4)).toEqual([
      ["adair2017", "12", undefined, undefined, undefined], ["brel2001", "4-5", "cf.", undefined, undefined],
      ["corso1999", undefined, undefined, undefined, undefined], ["brel2001", "7", undefined, undefined, undefined],
    ]);
    expect(chapter.citations.filter((c) => c.key === "?").map((c) => c.suffix)).toEqual(["[CHECK]"]);
    expect(chapter.citations.filter((c) => c.mode === "suppress-author").map((c) => c.key)).toEqual(["adair2017"]);
    const texts = chapter.blocks.map((b) => b.text);
    expect(texts).toContain("Subject to *asterisks*, <angles>, {braces} & more_underscores! See [@fake] and `ticks`.");
    expect(texts.some((t) => t.startsWith("# The toll"))).toBe(true);
    expect(texts.some((t) => t.includes("(1516–1850)"))).toBe(true);
    // The reference list is carried as sources, not copied.
    expect(texts.join("\n")).not.toContain("Never cited");
    expect(chapter.blocks.filter((b) => b.noteKind === "endnote").map((b) => b.text)).toEqual(["Ibid., 9."]);
    // A table, and a note that only a table refers to, are kept as text no check reads.
    expect(chapter.blocks.filter((b) => b.kind === "unconverted").map((b) => b.text)).toEqual([
      "| Year | Toll (Adair 2017) |", "footnote 3: A table note (Adair 2017).",
    ]);
  });

  test("makes a record for each citation, source, and claim, all unverified and traced to the file", () => {
    const citations = records(made.root, "citations");
    expect(citations.map((c) => c.id).sort()).toEqual(chapter.citations.map((c) => c.id!).sort());
    for (const citation of citations) {
      const occurrence = chapter.citations.find((c) => c.id === citation.id)!;
      expect(citation.sentence.sha256).toBe(chapter.sentences[occurrence.sentence]!.sha256);
      expect(citation.document_position).toContain("paragraph ");
    }
    expect(citations.find((c) => c.as_found === "Adair (2017)")).toBeDefined();
    expect(citations.find((c) => c.quotation === "paid in salt")).toMatchObject({ key: "adair2017", locator: { label: "page", value: "12" } });
    const sources = records(made.root, "sources");
    expect(sources.map((s) => s.citation_key).sort()).toEqual(["adair2017", "brel2001", "corso1999", "entry5", "eyre1988"]);
    expect(new Set(sources.map((s) => s.admission))).toEqual(new Set(["candidate"]));
    expect(sources.every((s) => s.as_found && !s.title)).toBe(true);
    expect(JSON.parse(tree(made.root)["stemma.json"]!).bibliography_include.sort()).toEqual(sources.map((s) => s.id).sort());
    const claims = records(made.root, "claims");
    expect(claims.map((c) => c.id).sort()).toEqual(chapter.claims.flatMap((c) => c.ids).sort());
    expect(claims.every((c) => c.review.state === "unreviewed" && c.origins[0].document_position && !c.confidence && !c.reason)).toBe(true);
    // A claim for each sentence that carries a citation, in a heading and in a discursive note too.
    // The paragraph that is only a citation states nothing, so it has none.
    expect(claims.length).toBe(6);
  });

  test("accounts for every bracketed year, comment, and note (ADC-08, INT-10)", () => {
    expect(report.author_date).toMatchObject({ examined: 11, linked: 7, unresolved: 1, unlinked: 3, unlinkedByReason: { in_table: 2, year_range: 1 } });
    const items = records(made.root, "intake-items");
    const reasons = items.map((i) => i.reason).sort();
    for (const reason of ["citation_no_entry", "comment", "list_entry", "list_entry_unread", "note_not_in_text", "note_without_author_date", "table", "year_range", "in_table"]) {
      expect(reasons).toContain(reason);
    }
    // A note that cites nothing in a form that is read is listed, not dropped.
    expect(items.filter((i) => i.category === "unclassified_note").map((i) => i.as_found)).toEqual(["Ibid., 9."]);
    expect(items.find((i) => i.reason === "comment").as_found).toBe("R. Reader: Is that right?");
    expect(items.filter((i) => i.category === "year_parenthesis").length).toBe(report.author_date.unlinked);
  });

  test("check reads the copy, and the first report shows each cause once (FR-93)", () => {
    const checked = command(made.root, "check", "--format", "json");
    expect(checked.code).toBe(1);
    const body = JSON.parse(checked.out).body;
    const open = (check: string) => body.results.filter((x: any) => x.check === check && x.open);
    expect(open("record.valid")).toEqual([]);
    expect(open("cite.key").map((x: any) => x.reason_code)).toEqual(["key_unbound"]);
    expect(open("bib.uncited").length).toBe(2);
    expect(open("source.held").length).toBeGreaterThan(0);
    expect(body.not_run.map((n: any) => n.check)).not.toContain("record.valid");
    for (const check of ["cite.key", "source.held", "quote.present", "bib.uncited"]) expect(body.results.some((x: any) => x.check === check)).toBe(true);
    expect(body.takeover.groups.map((g: any) => [g.reason, g.count])).toContainEqual(["list_entry", 4]);
    expect(body.takeover.left_unlinked.count).toBe(report.author_date.unlinked);

    const text = command(made.root, "check").out;
    expect(text).toContain("WHERE TO START");
    expect(text).toContain("OPEN TAKEOVER ITEMS");
    expect(text.match(/A source is listed for the built bibliography but cited nowhere/g)).toHaveLength(1);
    expect(digest(original)).toBe(before);
  });
});

describe("takeover run again, and further files (INT-09, INT-11, INT-12)", () => {
  const made = project();
  const first = made.file("weirs.docx", WEIRS);
  expect(command(made.root, "takeover", first).code).toBe(1);
  // An author's own edit to the copy.
  const [path] = Object.keys(tree(made.root)).filter((f) => f.startsWith("manuscript/"));
  writeFileSync(join(made.root, path!), tree(made.root)[path!]!.replace("says no more", "says nothing more"));
  const kept = tree(made.root);

  test("the same bytes write nothing, under any name", () => {
    for (const file of [first, made.file("copy/renamed.docx", WEIRS)]) {
      const again = command(made.root, "takeover", file);
      expect([again.code, again.out]).toEqual([0, expect.stringContaining("already taken over")]);
    }
    expect(tree(made.root)).toEqual(kept);
    expect(command(made.root, "takeover", first, "--again").code).toBe(2);
  });

  test("a changed original saves one item, once, and changes nothing else", () => {
    const changed = made.file("later/weirs.docx", { ...WEIRS, comments: ["A second thought."] });
    const done = command(made.root, "takeover", changed);
    expect([done.code, done.out]).toEqual([1, expect.stringContaining("The change is not applied")]);
    const now = tree(made.root);
    const added = Object.keys(now).filter((f) => !(f in kept));
    expect(added.length).toBe(1);
    expect(JSON.parse(now[added[0]!]!)).toMatchObject({ category: "original_changed", import: records(made.root, "imports")[0].id });
    for (const file of Object.keys(kept)) expect(now[file]).toBe(kept[file]!);
    expect(command(made.root, "takeover", changed).out).toContain("An earlier run saved an item");
    expect(tree(made.root)).toEqual(now);
  });

  test("a file that repeats earlier text writes nothing unless the author says it is different", () => {
    const repeat = made.file("weirs-final.docx", { ...WEIRS, comments: [] });
    const held = tree(made.root);
    const refused = command(made.root, "takeover", repeat);
    expect([refused.code, refused.err]).toEqual([5, expect.stringContaining("weirs.docx")]);
    expect(tree(made.root)).toEqual(held);
    expect(command(made.root, "takeover", repeat, "--separate").code).toBe(1);
    expect(records(made.root, "imports").filter((b) => b.separate)).toMatchObject([{ original_name: "weirs-final.docx" }]);
    for (const file of Object.keys(held).filter((f) => f !== "stemma.json")) expect(tree(made.root)[file]).toBe(held[file]!);
  });

  test("another chapter adds to the project, with keys of its own and repeats left unmerged", () => {
    const held = tree(made.root);
    const done = command(made.root, "takeover", made.file("locks.docx", LOCKS), "--format", "json");
    expect(done.code).toBe(1);
    for (const file of Object.keys(held).filter((f) => f !== "stemma.json")) expect(tree(made.root)[file]).toBe(held[file]!);
    expect(records(made.root, "chapters").map((c) => c.order).sort()).toEqual([1, 2, 3]);
    const keys = records(made.root, "sources").map((s) => s.citation_key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("adair2017-3");
    expect(JSON.parse(done.out).body.takeover.repeats.find((x: any) => x.as_found === "Adair, Mary. 2017. Rivers of salt.").items.length).toBe(3);
    const checked = JSON.parse(command(made.root, "check", "--format", "json").out).body;
    expect(checked.results.filter((x: any) => x.check === "record.valid" && x.open)).toEqual([]);
  });
});

describe("takeover refusals (INT-08)", () => {
  test("a damaged file, a PDF, a library, and a missing project write nothing", () => {
    const made = project();
    const kept = tree(made.root);
    const broken = join(made.dir, "broken.docx");
    writeFileSync(broken, docx(WEIRS).slice(0, 200));
    expect(command(made.root, "takeover", broken).code).toBe(3);
    const pdf = join(made.dir, "chapter.pdf");
    writeFileSync(pdf, "%PDF-1.7\n");
    expect(command(made.root, "takeover", pdf)).toMatchObject({ code: 2, err: expect.stringContaining("PDF") });
    expect(command(made.root, "takeover", made.file("a.docx", LOCKS), "--library", "refs.bib").code).toBe(2);
    expect(command(made.root, "takeover").code).toBe(2);
    expect(tree(made.root)).toEqual(kept);
    expect(command(join(made.dir, "nowhere"), "takeover", broken).code).toBe(3);
  });

  test("a chapter with no reference list links nothing and says so", () => {
    const made = project();
    const done = command(made.root, "takeover", made.file("bare.docx", { body: p(r("A claim (Adair 2017).")) }));
    expect(done.out).toContain("No reference list was found");
    expect(records(made.root, "citations")).toMatchObject([{ key: "?" }]);
    expect(records(made.root, "intake-items")).toMatchObject([{ reason: "citation_no_list" }]);
    expect(records(made.root, "sources")).toEqual([]);
  });

  test("a chapter file that cannot be read stops a further takeover", () => {
    const made = project();
    command(made.root, "takeover", made.file("locks.docx", LOCKS));
    const [path] = Object.keys(tree(made.root)).filter((f) => f.startsWith("manuscript/"));
    writeFileSync(join(made.root, path!), "<b>raw</b>\n");
    const kept = tree(made.root);
    expect(command(made.root, "takeover", made.file("weirs.docx", WEIRS)).code).toBe(3);
    expect(tree(made.root)).toEqual(kept);
  });

  test("planning is repeatable apart from the identifiers", () => {
    const made = project();
    const plan = () => {
      let n = 0;
      return planTakeover({ content: readProject(made.root), file: { name: "weirs.docx", bytes: docx(WEIRS) }, actor: { kind: "software", name: "test" }, now: new Date("2026-01-02T03:04:05Z"), token: () => String(++n).padStart(20, "0"), version: "0" });
    };
    expect(plan()).toEqual(plan());
  });
});

describe("a staged write happens whole or not at all (BR-1501)", () => {
  const interrupted = (journal: boolean) => {
    const made = project();
    const staging = join(made.root, ".stemma/staging/abcdefgh/manuscript");
    mkdirSync(staging, { recursive: true });
    writeFileSync(join(staging, "chp-00000000000000000001.md"), "Staged.\n");
    if (journal) writeFileSync(join(made.root, ".stemma/journal.json"), JSON.stringify({ token: "abcdefgh", files: ["manuscript/chp-00000000000000000001.md"] }));
    return made;
  };

  test("the next command finishes a write whose journal was saved", () => {
    const made = interrupted(true);
    command(made.root, "check");
    expect(tree(made.root)["manuscript/chp-00000000000000000001.md"]).toBe("Staged.\n");
    expect(existsSync(join(made.root, ".stemma/journal.json"))).toBe(false);
  });

  test("files staged without a journal are discarded by the next takeover", () => {
    const made = interrupted(false);
    command(made.root, "takeover", made.file("locks.docx", LOCKS));
    expect(tree(made.root)["manuscript/chp-00000000000000000001.md"]).toBeUndefined();
    expect(existsSync(join(made.root, ".stemma/staging"))).toBe(false);
  });

  test("a lock held by a running process stops a second writer; a dead one does not", () => {
    const made = project();
    const file = made.file("locks.docx", LOCKS);
    mkdirSync(join(made.root, ".stemma"), { recursive: true });
    writeFileSync(join(made.root, ".stemma/write.lock"), `${process.pid}\n`);
    expect(command(made.root, "takeover", file)).toMatchObject({ code: 3, err: expect.stringContaining("Another Stemma command") });
    const ended = spawnSync(process.execPath, ["-e", ""]).pid;
    writeFileSync(join(made.root, ".stemma/write.lock"), `${ended}\n`);
    expect(command(made.root, "takeover", file).code).toBe(1);
  });

  test("a changed settings file, an existing file, and a path outside records and the copy are refused", () => {
    const made = project();
    const write = (files: { path: string; text: string }[], replacing = new Map<string, Uint8Array>()) =>
      () => withWriteLock(made.root, () => writeStaged(made.root, files, replacing));
    const chapter = { path: "manuscript/chp-00000000000000000001.md", text: "New.\n" };
    expect(write([chapter, { path: "stemma.json", text: "{}\n" }], new Map([["stemma.json", Buffer.from("as read before")]]))).toThrow();
    expect(write([chapter, { path: "rules.md", text: "x" }])).toThrow();
    expect(write([{ path: "manuscript/../../x.md", text: "x" }])).toThrow();
    expect(tree(made.root)[chapter.path]).toBeUndefined();
    expect(randomToken()).toHaveLength(20);
  });
});

describe("the writer's text reads back as it was (CONTRACT-006 B)", () => {
  const pieces = [..."ab C.d, 12) -#>+=|~:*_`[]{}<>@^&!\\\"'“”()/?\n", "amp;", "![", "[^1]", ":::", "1. ", " . ", "  ", "<!--", "&#38;", "{#sec-x}", "\u00a0", "\u3000", "\\!"];

  test("after a typed backslash, a `!` before a marker is not an image, and a heading may end in a non-breaking space", () => {
    for (const [text, level] of [["a\\!", undefined], ["A heading \u00a0", 2]] as const) {
      const tidied = tidy(text, [3]);
      const written = writeChapter({
        blocks: [{ kind: "text", text: tidied.text, ...(level ? { level } : {}), events: [{ at: tidied.offsets[0]!, cluster: [{ key: "k", id: "cit-00000000000000000001" }] }] }], notes: [],
      }, () => "clm-00000000000000000001");
      const read = readManuscript([{ path: "manuscript/chp-00000000000000000001.md", bytes: new TextEncoder().encode(written.text) }]);
      expect([read.problems, verifyChapter(read.chapters[0]!, written)]).toEqual([[], []]);
    }
  });

  test("over 3,000 seeded blocks of markup-like text with citations and notes", () => {
    let seed = 7;
    const random = (n: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
    const some = () => Array.from({ length: random(18) }, () => pieces[random(pieces.length)]).join("");
    const failures: string[] = [];
    for (let run = 0; run < 3000 && failures.length === 0; run++) {
      let n = 0;
      const id = (prefix: string) => () => `${prefix}-${String(++n).padStart(20, "0")}`;
      const [cit, clm] = [id("cit"), id("clm")];
      const block = () => {
        const raw = some();
        const tidied = tidy(raw, Array.from({ length: random(3) }, () => random(raw.length + 1)).sort((a, b) => a - b));
        const events = tidied.offsets.map((at) => ({ at, cluster: [{ key: "k", id: cit(), ...(random(2) ? { prefix: some(), suffix: some() } : {}) }] }));
        return tidied.text || events.length ? { kind: "text" as const, text: tidied.text, events: events as any[], ...(random(4) ? {} : { level: 1 + random(4) }) } : undefined;
      };
      const blocks = [block(), block()].flatMap((b) => b ?? []);
      const notes = [];
      const note = random(2) ? block() : undefined;
      if (blocks[0] && note) {
        const { level: _, ...plain } = note;
        notes.push({ label: "en-1", blocks: [plain] });
        blocks[0].events.push({ at: random(blocks[0].text.length + 1), marker: "en-1" });
        blocks[0].events.sort((a, b) => a.at - b.at);
      }
      const written = writeChapter({ blocks, notes }, clm);
      const read = readManuscript([{ path: "manuscript/chp-00000000000000000001.md", bytes: new TextEncoder().encode(written.text) }]);
      failures.push(...(read.problems.length ? read.problems.map((x) => x.detail) : verifyChapter(read.chapters[0]!, written)).map((f) => `${f}: ${JSON.stringify(written.text)}`));
    }
    expect(failures).toEqual([]);
  });
});
