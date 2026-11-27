// Copies of sources, the private content store, extracted text, source.held,
// store verify and doctor, run through the built command line. Every source here
// is invented.
import { beforeAll, describe, expect, test } from "bun:test";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type CheckReport, pageSpans, type Result } from "@stemma/core";
import { canonical, checkPageSegments, pageLabels, sha256 } from "@stemma/records";
import { storeLocation } from "@stemma/workspace";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { ROOT, temporary } from "./helpers.ts";

const MATERIALS = join(ROOT, "fixtures/materials");
const material = (name: string) => join(MATERIALS, name);
const bytesOf = (path: string) => readFileSync(path);

let cli = "";
beforeAll(async () => {
  cli = await bundle(join(temporary(), "dist"));
});

interface Book { base: string; project: string; store: string }

/** Runs the command line. STEMMA_STORE_DIR is unset, so only --store-dir chooses a store. */
function run(args: string[], env: Record<string, string> = {}) {
  const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args], {
    cwd: dirname(dirname(cli)), env: { PATH: process.env.PATH ?? "", HOME: temporary(), ...env },
  });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
}

const inBook = (book: Book, ...args: string[]) => run([...args, "--project", book.project, "--store-dir", book.store]);
const asJson = (book: Book, ...args: string[]) => {
  const done = inBook(book, ...args, "--format", "json");
  return { code: done.code, json: JSON.parse(done.out) };
};

function newBook(): Book {
  const base = temporary();
  const book = { base, project: join(base, "book"), store: join(base, "store") };
  expect(run(["init", "--project", book.project]).code).toBe(0);
  return book;
}

const AUTHOR = ["--actor", "person:author", "--acquired-at", "2026-01-05T09:00:00Z"];

const addCopy = (book: Book, file: string, ...more: string[]) => asJson(book, "source", "add", file, ...AUTHOR, ...more);
const attach = (book: Book, capture: string, ...more: string[]) => asJson(book, "source", "text", capture, "--actor", "person:author", ...more);

const record = (book: Book, directory: string, id: string) =>
  JSON.parse(readFileSync(join(book.project, "records", directory, `${id}.json`), "utf8"));

function edit(book: Book, directory: string, id: string, change: (r: Record<string, any>) => void) {
  const value = record(book, directory, id);
  change(value);
  writeFileSync(join(book.project, "records", directory, `${id}.json`), canonical(value));
}

const blobPath = (store: string, digest: string) => join(store, "sha256", digest.slice(0, 2), digest);

const files = (root: string): string[] =>
  [...new Bun.Glob("**/*").scanSync({ cwd: root, dot: true, onlyFiles: false })].sort();

/** Gives a source a citation key and one citation of it. */
function cite(book: Book, source: string, key: string) {
  edit(book, "sources", source, (r) => { r.citation_key = key; });
  const input = join(book.base, `${key}.json`);
  writeFileSync(input, JSON.stringify({ key, sentence: { text: "The invented harbour charged a toll." } }));
  expect(inBook(book, "record", "add", "citation", "--input", input, "--actor", "person:author").code).toBe(0);
}

const check = (book: Book) => asJson(book, "check") as { code: number; json: CheckReport };
const held = (report: CheckReport): Result[] => report.body.results.filter((r) => r.check === "source.held");
const outcomes = (report: CheckReport) => held(report).map((r) => `${r.outcome} ${r.reason_code ?? ""}`.trim());
const unbuilt = (report: CheckReport) => report.body.not_run.filter((n) => n.reason === "not_implemented").map((n) => n.check);

/** A cited book with a plain-text copy and its text. */
function citedBook() {
  const book = newBook();
  const added = addCopy(book, material("harbour-note.txt")).json;
  const extraction = attach(book, added.capture).json;
  cite(book, added.source, "hartwell1998");
  return { book, source: added.source as string, capture: added.capture as string, copy: added.sha256 as string, text: extraction.text_sha256 as string, extraction: extraction.extraction as string };
}

/** A synthetic image-only PDF with a text layer and page map supplied for it. */
function scannedBook() {
  const book = newBook();
  const added = addCopy(book, material("ledger-scan.pdf")).json;
  cite(book, added.source, "ledger1911");
  return { book, source: added.source as string, capture: added.capture as string, copy: added.sha256 as string };
}

const LAYER = ["--text-layer", material("ledger-text-layer.txt")];
const MAP = ["--page-map", material("ledger-page-map.json")];

describe("source add", () => {
  test("US-007-AC1 stores the file, its hash and its provenance, with who added it", () => {
    const book = newBook();
    const done = addCopy(book, material("harbour-note.txt"), "--origin", "publisher download", "--source-version", "version of record");
    expect(done.code).toBe(0);
    const { capture, source, sha256: digest } = done.json;
    const original = bytesOf(material("harbour-note.txt"));
    expect(digest).toBe(sha256(original));
    expect(bytesOf(blobPath(book.store, digest))).toEqual(original);
    expect(record(book, "captures", capture)).toMatchObject({
      source, sha256: digest, size: original.length, media_type: "text/plain", origin: "publisher download",
      acquired_at: "2026-01-05T09:00:00Z", source_version: "version of record", admitted_by: { kind: "person", name: "author" },
    });
    expect(record(book, "sources", source)).toMatchObject({ admission: "candidate", intake: "raw" });
    expect(record(book, "sources", source).citation_key).toBeUndefined();
  });

  test("unstated provenance is shown as unknown, not guessed; the time acquired has to be given", () => {
    const book = newBook();
    const done = inBook(book, "source", "add", material("harbour-note.txt"), ...AUTHOR);
    expect(done.out).toContain("origin: unknown");
    expect(done.out).toContain("version: unknown");
    const refused = inBook(newBook(), "source", "add", material("harbour-note.txt"), "--actor", "person:author");
    expect([refused.code, refused.err.includes("does not guess")]).toEqual([2, true]);
  });

  test("US-007-AC4 the copy is only in the private store, the project holds its digest, and backup is stated", () => {
    const book = newBook();
    const done = inBook(book, "source", "add", material("harbour-note.txt"), ...AUTHOR);
    expect(done.out).toContain("backing it up is your task");
    expect(done.out).toContain("may be sent to a hosted model");
    const marker = "The toll was one invented coin.";
    for (const path of files(book.project)) {
      const full = join(book.project, path);
      if (Bun.spawnSync(["test", "-f", full]).exitCode === 0) expect(readFileSync(full, "utf8")).not.toContain(marker);
    }
    expect(files(book.store).filter((f) => /sha256\/..\/[0-9a-f]{64}$/.test(f))).toHaveLength(1);
  });

  test("US-007-AC3 a hostile name or content writes nothing outside the intended places and runs nothing", () => {
    const book = newBook();
    const inbox = join(book.base, "inbox");
    mkdirSync(inbox);
    const name = "..\\..\\$(touch pwned); '\n<script>.pdf";
    writeFileSync(join(inbox, name), "%PDF-1.4\n/OpenAction << /S /JavaScript /JS (app.launchURL('x')) >>\n$(touch pwned)\n");
    writeFileSync(join(inbox, "blob.pdf"), new Uint8Array([0, 1, 2, 3]));
    writeFileSync(join(inbox, "page.txt"), "<!DOCTYPE html><script>fetch('x')</script>");
    const before = files(book.base);
    const refused = addCopy(book, join(inbox, "blob.pdf"));
    expect([refused.code, refused.json.error.code]).toEqual([5, "unsupported_file"]);
    expect(addCopy(book, join(inbox, "page.txt")).json.error.code).toBe("unsupported_file");
    expect(files(book.base)).toEqual(before);
    const done = addCopy(book, join(inbox, name));
    expect(done.code).toBe(0);
    const made = files(book.base).filter((f) => !before.includes(f));
    for (const path of made) {
      expect(path).toMatch(/^(store(\/(sha256|tmp)(\/[0-9a-f]{2})?(\/[0-9a-f]{64})?)?|book\/records\/(sources|captures)(\/(src|cap)-[0-9a-z]+\.json)?)$/);
    }
    expect(files(book.base).some((f) => f.includes("pwned") && !f.startsWith("inbox/"))).toBe(false);
    expect(JSON.stringify(record(book, "captures", done.json.capture))).not.toContain("pwned");
  });

  test("the same bytes twice: the holder is named, nothing is merged, and the author may attach or restore", () => {
    const book = newBook();
    const first = addCopy(book, material("harbour-note.txt")).json;
    const before = files(book.project);
    const again = addCopy(book, material("harbour-note.txt"));
    expect([again.code, again.json.error.code, again.json.error.paths]).toEqual([5, "already_held", [first.source]]);
    expect(files(book.project)).toEqual(before);

    rmSync(blobPath(book.store, first.sha256));
    const restored = addCopy(book, material("harbour-note.txt"), "--source", first.source);
    expect([restored.json.state, restored.json.blob, restored.json.capture]).toEqual(["already_held", "stored", first.capture]);
    expect(files(book.project)).toEqual(before);

    writeFileSync(blobPath(book.store, first.sha256), "damaged");
    expect(addCopy(book, material("harbour-note.txt"), "--source", first.source).json.blob).toBe("restored");

    const other = addCopy(book, material("ledger-scan.pdf")).json.source;
    const attached = addCopy(book, material("harbour-note.txt"), "--source", other);
    expect([attached.code, attached.json.state, attached.json.source]).toEqual([0, "add", other]);
    expect(readdirSync(join(book.project, "records/captures"))).toHaveLength(3);
    expect(files(book.store).filter((f) => /[0-9a-f]{64}$/.test(f))).toHaveLength(2);
  });

  test("rights are recorded only as stated; a web address is refused as not built", () => {
    const book = newBook();
    const done = addCopy(book, material("harbour-note.txt"), "--unpublished", "yes", "--license", "invented terms").json;
    expect(record(book, "sources", done.source).rights).toEqual({ license: "invented terms", unpublished: true });
    expect(addCopy(book, material("ledger-scan.pdf"), "--unpublished", "maybe").code).toBe(2);
    expect(addCopy(book, "https://example.invalid/a.pdf").json.error.code).toBe("not_implemented");
  });

  test("an option a command does not take is refused, not dropped", () => {
    const done = inBook(newBook(), "check", "--origin", "x");
    expect([done.code, done.err.includes("--origin is not an option")]).toEqual([2, true]);
  });
});

describe("where the content store may be", () => {
  const add = (project: string, store: string) =>
    run(["source", "add", material("harbour-note.txt"), ...AUTHOR, "--project", project, "--store-dir", store, "--format", "json"]);

  test("never inside the project, also through a link", () => {
    const book = newBook();
    mkdirSync(join(book.project, "kept"));
    symlinkSync(join(book.project, "kept"), join(book.base, "link"));
    for (const store of [join(book.project, "store"), "store", book.project, join(book.base, "link"), book.base]) {
      const done = add(book.project, store);
      expect([done.code, JSON.parse(done.out).error.code]).toEqual([5, "unsafe_store"]);
    }
    expect(existsSync(join(book.project, "records/captures"))).toBe(false);
    expect(files(join(book.project, "kept"))).toEqual([]);
  });

  test("not in a git working tree unless git ignores it and tracks nothing there", () => {
    const book = newBook();
    const repository = join(book.base, "repository");
    mkdirSync(repository);
    const git = (...args: string[]) => Bun.spawnSync(["git", "-C", repository, ...args]);
    expect(git("init", "--quiet").exitCode).toBe(0);
    writeFileSync(join(repository, ".gitignore"), "private/\n");
    expect(JSON.parse(add(book.project, join(repository, "store")).out).error.code).toBe("unsafe_store");
    mkdirSync(join(repository, "private/tracked"), { recursive: true });
    writeFileSync(join(repository, "private/tracked/file"), "x");
    git("add", "--force", "private/tracked/file");
    expect(add(book.project, join(repository, "private/tracked")).code).toBe(5);
    expect(add(book.project, join(repository, "private/store")).code).toBe(0);
  });

  test("--store-dir, then STEMMA_STORE_DIR, then a per-user directory named by a plain project_id", () => {
    const env = { HOME: "/invented/home", STEMMA_STORE_DIR: "/invented/env-store" };
    expect(storeLocation("/invented/book", "abcdefgh", "/invented/option", env)).toMatchObject({ path: "/invented/option", chosen_by: "--store-dir" });
    expect(storeLocation("/invented/book", "abcdefgh", undefined, env)).toMatchObject({ path: "/invented/env-store", chosen_by: "STEMMA_STORE_DIR" });
    const fallback = storeLocation("/invented/book", "abcdefgh", undefined, { HOME: "/invented/home" });
    expect([fallback.chosen_by, fallback.path.startsWith("/invented/home/"), fallback.path.endsWith("/abcdefgh")]).toEqual(["default", true, true]);
    expect(() => storeLocation("/invented/book", "../../escape", undefined, env && {})).toThrow("--store-dir");
  });
});

describe("source text", () => {
  test("plain UTF-8 text is read as it is, with no pages and the tool and version saved (US-009-AC2)", () => {
    const { book, extraction, text, copy } = citedBook();
    expect(text).toBe(copy);
    const saved = record(book, "extractions", extraction);
    expect(saved).toMatchObject({
      capture_sha256: copy, tool: { name: "stemma" }, normalization_profile: "utf8-lf/0",
      quality: { method: "born_text", level: "unassessed" }, text_sha256: text,
    });
    expect([saved.page_spans, saved.pages, saved.metadata]).toEqual([undefined, undefined, undefined]);
  });

  test("a byte-order mark and CRLF are the only changes, and a second run gives the same bytes", () => {
    const book = newBook();
    const file = join(book.base, "crlf.txt");
    writeFileSync(file, "﻿An invented é\r\nline\rend ﬁ\n");
    const { capture } = addCopy(book, file).json;
    const [a, b] = [attach(book, capture).json, attach(book, capture).json];
    expect(a.extraction).not.toBe(b.extraction);
    expect(b.text_sha256).toBe(a.text_sha256);
    expect(readFileSync(blobPath(book.store, a.text_sha256), "utf8")).toBe("An invented é\nline\nend ﬁ\n");
  });

  test("US-009-AC2 and AC3 a supplied text layer keeps its page boundaries; a page with no evidence stays unlabelled", () => {
    const { book, capture } = scannedBook();
    const done = attach(book, capture, ...LAYER, ...MAP, "--method", "ocr", "--tool", "invented-ocr", "--tool-version", "2.1");
    expect(done.code).toBe(0);
    expect([done.json.pages, done.json.unmapped]).toEqual([4, [2]]);
    const saved = record(book, "extractions", done.json.extraction);
    expect(saved.tool).toEqual({ name: "invented-ocr", version: "2.1" });
    expect(saved.quality).toEqual({ level: "unassessed", method: "ocr" });
    const characters = [...readFileSync(blobPath(book.store, done.json.text_sha256), "utf8")];
    const pages = saved.page_spans.map((s: { start: number; end: number }) => characters.slice(s.start, s.end).join(""));
    expect(pages).toEqual(readFileSync(material("ledger-text-layer.txt"), "utf8").split("\f").slice(0, 4));
    expect([...pageLabels(saved.pages)]).toEqual([[0, "ix"], [1, "1"], [3, "3"]]);
  });

  test("without a page map every page is unlabelled, and an unstated maker is recorded as unknown", () => {
    const { book, capture } = scannedBook();
    const done = inBook(book, "source", "text", capture, "--actor", "person:author", ...LAYER);
    expect(done.out).toContain("without a printed label (file page indexes, from 0): 0-3");
    expect(done.out).toContain("No label is worked out from a page's position.");
    expect(done.out).toContain("did not compare it with the copy");
    const [name] = readdirSync(join(book.project, "records/extractions"));
    expect(record(book, "extractions", name!.replace(".json", ""))).toMatchObject({ tool: { name: "unknown", version: "unknown" }, quality: { method: "text_layer" } });
  });

  test("a scan with no text layer saves nothing; a bad page map saves nothing", () => {
    const { book, capture } = scannedBook();
    const done = attach(book, capture);
    expect([done.code, done.json.error.code]).toEqual([5, "invalid_input"]);
    expect(done.json.error.message).toContain("no page of this PDF has a text layer");
    const bad = join(book.base, "map.json");
    for (const map of [
      [{ first_index: 0, last_index: 0, style: "arabic", first_label: "1" }],
      [{ first_index: 0, last_index: 9, style: "arabic", first_label: "1", evidence: "author_statement" }],
      [{ first_index: 0, last_index: 0, style: "arabic", first_label: "one", evidence: "author_statement" }],
      { pages: [] },
    ]) {
      writeFileSync(bad, JSON.stringify(map));
      expect(attach(book, capture, ...LAYER, "--page-map", bad).code).toBe(5);
    }
    expect(existsSync(join(book.project, "records/extractions"))).toBe(false);
  });

  test("US-010-AC3 a scan with no machine-readable text does not count as checkable", () => {
    const { book, capture } = scannedBook();
    const empty = join(book.base, "empty.txt");
    writeFileSync(empty, " \n\f\n\f");
    const refused = attach(book, capture, "--text-layer", empty);
    expect([refused.code, refused.json.error.code]).toEqual([5, "invalid_input"]);
    const { code, json } = check(book);
    expect([code, outcomes(json), json.body.label]).toEqual([1, ["fail no_text"], "open_findings"]);
    expect(held(json)[0]!.suggestions.join(" ")).toContain("--text-layer");
  });

  test("text is not tied to a copy the store cannot show", () => {
    const { book, capture, copy } = scannedBook();
    rmSync(blobPath(book.store, copy));
    expect(attach(book, capture, ...LAYER).json.error.code).toBe("copy_not_held");
  });
});

describe("source.held", () => {
  test("a cited source with no copy fails with an explanation, and nothing is blocked", () => {
    const book = newBook();
    const input = join(book.base, "s.json");
    writeFileSync(input, JSON.stringify({ id: "src-invented0001", citation_key: "ellery1911" }));
    inBook(book, "record", "add", "source", "--input", input, "--actor", "person:author");
    cite(book, "src-invented0001", "ellery1911");
    const { code, json } = check(book);
    expect([code, outcomes(json)]).toEqual([1, ["fail no_copy"]]);
    const [finding] = held(json);
    expect([finding!.open, finding!.why.includes("unchecked"), finding!.suggestions.length > 0]).toEqual([true, true, true]);
    expect(inBook(book, "check").out).toContain("Nothing is blocked");
    // The store is not even opened while no record names anything in it.
    expect(existsSync(book.store)).toBe(false);
  });

  test("a copy without text fails; with intact text it passes and the other gaps stay listed", () => {
    const { book, capture } = scannedBook();
    expect(outcomes(check(book).json)).toEqual(["fail no_text"]);
    attach(book, capture, ...LAYER, ...MAP);
    const { code, json } = check(book);
    expect(outcomes(json)).toEqual(["pass"]);
    expect(json.body.results.filter((r) => r.open)).toEqual([]);
    expect(unbuilt(json)).toEqual(["meta.resolver", "meta.source", "number.present"]);
    expect([code, json.body.label]).toEqual([1, "open_findings"]);
    expect(json.body.inputs.blobs).toHaveLength(2);
  });

  test("US-007-AC2 an altered copy is reported and is not treated as the admitted copy", () => {
    const { book, copy } = citedBook();
    const bytes = bytesOf(blobPath(book.store, copy));
    bytes[0] = bytes[0]! ^ 1;
    writeFileSync(blobPath(book.store, copy), bytes);
    const { json } = check(book);
    expect(outcomes(json)).toEqual(["unverifiable copy_altered"]);
    expect(json.body.inputs.blobs).toEqual([]);
  });

  test("an altered copy of an uncited source is reported too", () => {
    const book = newBook();
    const { sha256: digest, source } = addCopy(book, material("harbour-note.txt")).json;
    expect(outcomes(check(book).json)).toEqual([]);
    appendFileSync(blobPath(book.store, digest), "x");
    expect(held(check(book).json).map((r) => [r.subject, r.reason_code])).toEqual([[source, "copy_altered"]]);
  });

  test("without the store the result is could-not-check, never pass, and the report says where it looked", () => {
    const { book } = citedBook();
    const elsewhere = { ...book, store: join(book.base, "no-store-here") };
    const { json } = check(elsewhere);
    expect([outcomes(json), json.body.summary.could_not_check]).toEqual([["unverifiable copy_missing"], 1]);
    const text = inBook(elsewhere, "check").out;
    expect(text).toContain("COULD NOT CHECK");
    expect(text).toContain(`Content store looked in: ${elsewhere.store}`);
    expect(JSON.stringify(json.body)).not.toContain(book.base);
    expect(existsSync(elsewhere.store)).toBe(false);
  });

  test("missing and altered text, and a record that does not fit its text, are could-not-check", () => {
    const first = citedBook();
    const { text } = attach(first.book, first.capture).json;
    expect(text).toBeUndefined();
    const a = scannedBook();
    const added = attach(a.book, a.capture, ...LAYER).json;
    edit(a.book, "extractions", added.extraction, (r) => { r.page_spans.at(-1).end += 1000; });
    expect(outcomes(check(a.book).json)).toEqual(["unverifiable text_inconsistent"]);
    edit(a.book, "extractions", added.extraction, (r) => { r.page_spans.at(-1).end -= 1000; });
    writeFileSync(blobPath(a.book.store, added.text_sha256), "other text");
    expect(outcomes(check(a.book).json)).toEqual(["unverifiable text_altered"]);
    rmSync(blobPath(a.book.store, added.text_sha256));
    expect(outcomes(check(a.book).json)).toEqual(["unverifiable text_missing"]);
  });

  test("a retired extraction no longer counts, and an unreadable record is could-not-check", () => {
    const { book, extraction } = citedBook();
    edit(book, "extractions", extraction, (r) => { r.retired = { stamp: r.created }; });
    expect(outcomes(check(book).json)).toEqual(["fail no_text"]);
    writeFileSync(join(book.project, "records/extractions", `${extraction}.json`), "{");
    expect(outcomes(check(book).json)).toEqual(["unverifiable record_unreadable"]);
  });

  test("while manuscript files cannot be read, source.held is listed as not run", () => {
    const { book } = citedBook();
    writeFileSync(join(book.project, "manuscript/chp-invented0001.md"), "An invented chapter.\n");
    const { json } = check(book);
    expect([held(json), unbuilt(json).includes("source.held")]).toEqual([[], true]);
  });

  test("report bodies are equal for equal inputs, wherever the store is", () => {
    const { book } = citedBook();
    const moved = { ...book, store: join(book.base, "moved") };
    mkdirSync(moved.store);
    expect(Bun.spawnSync(["cp", "-R", join(book.store, "sha256"), moved.store]).exitCode).toBe(0);
    expect(canonical(check(moved).json.body)).toBe(canonical(check(book).json.body));
  });
});

describe("record rules for captures and extractions (CONTRACT-001 G)", () => {
  test("other bytes, labels without evidence, and a PDF extraction without page spans are invalid", () => {
    const { book, capture } = scannedBook();
    const { extraction } = attach(book, capture, ...LAYER, ...MAP).json;
    edit(book, "extractions", extraction, (r) => {
      r.capture_sha256 = "0".repeat(64);
      delete r.pages[0].evidence;
      delete r.page_spans;
    });
    const fields = check(book).json.body.results.filter((r) => r.check === "record.valid" && r.open)
      .map((r) => r.evidence.find((e) => e.name === "field")?.value);
    expect(fields.sort()).toEqual(["/capture_sha256", "/page_spans", "/pages/0"]);
  });

  test("overlapping or ill-fitting segments are found; page spans count code points", () => {
    expect(checkPageSegments([
      { first_index: 0, last_index: 3, style: "unnumbered" },
      { first_index: 3, last_index: 4, style: "arabic", first_label: "1", evidence: "author_statement" },
      { first_index: 5, last_index: 6, style: "explicit", labels: ["a"], evidence: "author_statement" },
    ]).map((p) => p.code)).toEqual(["bad_page_range", "bad_page_labels"]);
    expect(pageSpans("𝔸b\fc\f")).toEqual([{ page_index: 0, start: 0, end: 2 }, { page_index: 1, start: 3, end: 4 }]);
    expect(pageSpans("a\f\fb")).toHaveLength(3);
  });
});

describe("store verify and doctor", () => {
  test("store verify names missing and altered digests and unreferenced blobs, and deletes nothing", () => {
    const { book, capture, copy } = scannedBook();
    const { text_sha256: text } = attach(book, capture, ...LAYER).json;
    expect(asJson(book, "store", "verify").json).toMatchObject({ referenced: 2, intact: 2, problems: [] });
    const stray = sha256("stray");
    mkdirSync(dirname(blobPath(book.store, stray)), { recursive: true });
    writeFileSync(blobPath(book.store, stray), "stray");
    writeFileSync(blobPath(book.store, copy), "altered");
    rmSync(blobPath(book.store, text));
    const before = files(book.store);
    const done = asJson(book, "store", "verify", "--unreferenced");
    expect(done.code).toBe(1);
    expect(done.json.problems.map((p: { sha256: string; state: string }) => [p.sha256, p.state]).sort())
      .toEqual([[copy, "altered"], [text, "missing"]].sort());
    expect(done.json.unreferenced).toEqual([stray]);
    expect(files(book.store)).toEqual(before);
    expect(inBook(book, "store", "verify").out).toContain("What to do:");
  });

  test("a link in the store is not followed", () => {
    const { book, copy } = citedBook();
    const outside = join(book.base, "outside.txt");
    copyFileSync(material("harbour-note.txt"), outside);
    rmSync(blobPath(book.store, copy));
    symlinkSync(outside, blobPath(book.store, copy));
    expect(asJson(book, "store", "verify").json.problems[0].state).toBe("unreadable");
    expect(outcomes(check(book).json)).toEqual(["unverifiable copy_missing"]);
  });

  test("doctor reports the store, what is present, a refused place and the limits, and creates nothing", () => {
    const fresh = newBook();
    const empty = asJson(fresh, "doctor");
    expect(empty.json.store).toMatchObject({ path: fresh.store, chosen_by: "--store-dir", exists: false, blobs_named: 0 });
    expect(existsSync(fresh.store)).toBe(false);
    expect(empty.json.source_limits.pages).toBe(5000);
    const { book, copy } = citedBook();
    rmSync(blobPath(book.store, copy));
    // The copy and its text are the same bytes here, so one blob is named.
    expect(asJson(book, "doctor").json.store).toMatchObject({ exists: true, blobs_named: 1, blobs_present: 0 });
    expect(inBook({ ...book, store: join(book.project, "s") }, "doctor").out).toContain("WARNING: this location is refused");
  });
});
