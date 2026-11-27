// Several places an original can be had from, and text that a copy of a project
// does not hold (FR-98, FR-104; CONTRACT-001 G, CONTRACT-002 B2 and C, CONTRACT-007 H).
// Every source is invented. Nothing uses the network: where a request would be
// made, `fetch` is replaced and the command runs in this process, with addresses
// written as numbers so that no name is looked up.
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { addressesOf, validateRecord } from "@stemma/records";
import { ingest } from "../packages/cli/src/ingest.ts";
import { sourceLocate } from "../packages/cli/src/locate.ts";
import type { Options } from "../packages/cli/src/context.ts";
import { AUTHOR, Book, bundleCli, evidence, of, reefPdf, verdicts } from "./sources-book.ts";

bundleCli();

const sha = (content: string | Uint8Array) => createHash("sha256").update(content).digest("hex");

/** An invented web page, with two sections. */
const PAGE = "<!doctype html><html><head><title>The Invented Reef</title></head><body><h1>The Invented Reef</h1><p>The reef was old and the water deep.</p><h2>Islets</h2><p>We counted 37 islets on the rim.</p></body></html>\n";
const LIVE = "https://203.0.113.1/reef.html";
const SNAPSHOT = "https://203.0.113.2/web/20260105000000id_/reef.html";
const MIRROR = "https://203.0.113.3/reef.html";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Answers each address as given, and lists what was asked. An address not named fails like a dead one. */
function fakeFetch(answers: Record<string, { status?: number; body?: string }>): string[] {
  const asked: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const address = String(input);
    asked.push(address);
    const answer = answers[address];
    if (!answer) throw new Error("connection refused");
    return new Response(answer.body ?? "", { status: answer.status ?? 200 });
  }) as unknown as typeof fetch;
  return asked;
}

/** Runs a command in this process and returns what it printed. */
async function inProcess(run: () => number | Promise<number>) {
  const write = process.stdout.write;
  let out = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    out += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    return { code: await run(), out };
  } finally {
    process.stdout.write = write;
  }
}

const options = (book: Book, more: Partial<Options> = {}): Options => ({ project: book.project, format: "text", actor: "person:author", ...more });
const runIngest = (book: Book, more: Partial<Options> = {}) => inProcess(() => ingest(options(book, more), () => 0));

/** A captured web page whose upstream records `LIVE` as the address it came from. */
function page() {
  const book = new Book();
  const source = book.source("reefpage");
  book.file("reef.html", PAGE);
  const plan = book.file("plan.json", JSON.stringify({ captures: [{ source, file: "reef.html", url: LIVE, retrieved_at: "2026-01-05T09:00:00Z" }] }));
  expect(book.run("ingest", "--plan", plan, ...AUTHOR).code).toBe(0);
  const name = readdirSync(join(book.project, "records/upstreams"))[0]!;
  const record = `records/upstreams/${name}`;
  return { book, source, plan, record, upstream: name.replace(/\.json$/, "") };
}

const cached = (book: Book) => join(book.project, ".stemma/originals", sha(PAGE));
const forget = (book: Book) => rmSync(join(book.project, ".stemma"), { recursive: true, force: true });
const upstreamData = (book: Book, record: string) => JSON.parse(book.read(record));
/** Every tracked file except the one named, with its content. */
const others = (book: Book, except: string) => Object.fromEntries(book.files().filter((f) => !f.startsWith(".stemma/") && f !== except).map((f) => [f, book.read(f)]));

/** Removes every part file of the project's one source file, as a copy without that text has none. */
function dropText(book: Book, directory = "sources/reefpage") {
  const folder = directory.endsWith("reefpage") ? "sections" : "pages";
  const held = Object.fromEntries(readdirSync(join(book.project, directory, folder)).map((f) => [f, book.read(`${directory}/${folder}/${f}`)]));
  rmSync(join(book.project, directory, folder), { recursive: true });
  return held;
}

describe("locations of an original (FR-98)", () => {
  test("a record without locations is as before: valid, canonical, and fetched from its one address", async () => {
    const { book, record } = page();
    const before = book.read(record);
    expect(upstreamData(book, record).locations).toBeUndefined();
    expect(book.run("validate").code).toBe(0);
    expect(book.run("fmt").code).toBe(0);
    expect(book.read(record)).toBe(before);
    forget(book);
    const asked = fakeFetch({ [LIVE]: { body: `${PAGE}<!-- changed -->` } });
    const done = await runIngest(book, { fetch: true });
    expect(asked).toEqual([LIVE]);
    expect(done.out).toContain(`reefpage: what the address gives now differs from the recorded original (sha256 ${sha(`${PAGE}<!-- changed -->`)}). It was not used.`);
    expect(done.out).not.toContain("location 1 of");
  });

  test("source locate adds a location that validates, changes only the upstream record, and adds nothing twice", () => {
    const { book, record, upstream } = page();
    const before = others(book, record);
    const added = book.run("source", "locate", "reefpage", "--url", SNAPSHOT, "--kind", "web_archive", "--note", "a snapshot", ...AUTHOR);
    expect(added.code).toBe(0);
    expect(added.out).toContain("It was not compared, so it is a reference only.");
    expect(others(book, record)).toEqual(before);
    const data = upstreamData(book, record);
    expect(data.url).toBe(LIVE);
    expect(data.locations).toEqual([{ added: { at: data.changed.at, by: { kind: "person", name: "author" } }, kind: "web_archive", note: "a snapshot", url: SNAPSHOT }]);
    expect(validateRecord(data, record).problems).toEqual([]);
    expect(book.run("validate").code).toBe(0);
    expect(book.run("fmt").out).toContain("Rewrote 0 file(s)");
    const again = book.run("source", "locate", upstream, "--url", SNAPSHOT, "--kind", "archive", ...AUTHOR);
    expect(again.out).toContain("already listed with the kind web_archive, which was kept");
    expect(again.out).toContain("Nothing new, so nothing was written.");
    expect(book.run("source", "history", "reefpage").out).toContain("location recorded: web_archive");
    expect(book.check().body.label).toBe("checked_clean");
  });

  test("a private copy is recorded by a name and compared from its file; no path is ever written", () => {
    const { book, record } = page();
    const copy = book.file("my private copy.html", PAGE);
    const done = book.run("source", "locate", "reefpage", "--private", "My NAS (reading copies)", "--original", copy, ...AUTHOR);
    expect(done.code).toBe(0);
    expect(done.out).toContain("It was seen to give the recorded original.");
    const [location] = upstreamData(book, record).locations;
    expect(location).toMatchObject({ kind: "private", label: "My NAS (reading copies)", compared: { sha256: sha(PAGE) } });
    expect(location.url).toBeUndefined();
    for (const f of book.files().filter((f) => !f.startsWith(".stemma/"))) {
      expect(book.read(f)).not.toContain(book.base);
      expect(book.read(f)).not.toContain("my private copy.html");
    }
    const other = book.file("other.html", PAGE.replace("37", "73"));
    const differs = book.run("source", "locate", "reefpage", "--private", "an older download", "--original", other, ...AUTHOR);
    expect(differs.code).toBe(1);
    expect(differs.out).toContain("different bytes");
    expect(differs.out).toContain("never used as it");
    const written = book.read(record);
    for (const label of [copy, "~/copy.html", "C:\\copy.html", "file:copy", "https://203.0.113.9/x?token=abc", "../copy"]) {
      expect(book.run("source", "locate", "reefpage", "--private", label, ...AUTHOR).code).toBe(5);
    }
    expect(book.run("source", "locate", "reefpage", "--url", "https://me:secret@203.0.113.9/x", "--kind", "archive", ...AUTHOR).code).toBe(5);
    expect(book.run("source", "locate", "reefpage", "--url", `file://${copy}`, "--kind", "archive", ...AUTHOR).code).toBe(5);
    expect(book.read(record)).toBe(written);
    // A private copy is found by its digest; without it, ingest names it.
    forget(book);
    const without = book.run("ingest", ...AUTHOR);
    expect(without.out).toContain('a private copy is recorded as "My NAS (reading copies)"');
    const text = dropText(book);
    const found = book.run("ingest", "--originals", copy, ...AUTHOR);
    expect(found.out).toContain("restored 2 section file(s) of sources/reefpage/");
    for (const [name, content] of Object.entries(text)) expect(book.read(`sources/reefpage/sections/${name}`)).toBe(content);
  });

  test("a hand-written location that holds a path, an address with a password, or a repeat is record_invalid", () => {
    const { book, record } = page();
    const added = { at: "2026-01-05T09:00:00Z", by: { kind: "person", name: "author" } };
    const bad = [
      { added, kind: "private", label: "/Users/someone/papers/reef.pdf" },
      { added, kind: "private", label: "copy", url: MIRROR },
      { added, kind: "archive", url: "https://user:pw@203.0.113.3/x" },
      { added, kind: "archive", url: "/srv/papers/reef.pdf" },
      { added, kind: "archive", url: MIRROR },
      { added, kind: "publisher", url: MIRROR },
      { added, kind: "publisher", label: "x" },
    ];
    const problems = validateRecord({ ...upstreamData(book, record), locations: bad }, record).problems;
    expect(problems.map((p) => `${p.code} ${p.field}`)).toEqual([0, 1, 2, 3, 5, 6].map((i) => `bad_location /locations/${i}`));
  });

  test("the retrieval address is asked first, then each listed address once", () => {
    const added = { at: "2026-01-05T09:00:00Z", by: { kind: "person", name: "author" } };
    expect(addressesOf({ url: LIVE, locations: [{ added, kind: "web_archive", url: SNAPSHOT }, { added, kind: "private", label: "x" }, { added, kind: "publisher", url: LIVE }] })
      .map((a) => a.url)).toEqual([LIVE, SNAPSHOT]);
  });

  test("ingest --fetch falls through a refusal and different bytes, says so, and never uses what differs", async () => {
    const { book } = page();
    book.run("source", "locate", "reefpage", "--url", SNAPSHOT, "--kind", "web_archive", ...AUTHOR);
    book.run("source", "locate", "reefpage", "--url", MIRROR, "--kind", "archive", ...AUTHOR);
    forget(book);
    const wrapped = `<!-- an archive's toolbar -->${PAGE}`;
    const files = others(book, "");
    let asked = fakeFetch({ [LIVE]: { status: 403 }, [SNAPSHOT]: { body: wrapped }, [MIRROR]: { body: PAGE } });
    const done = await runIngest(book, { fetch: true });
    expect(asked).toEqual([LIVE, SNAPSHOT, MIRROR]);
    expect(done.out).toContain(`location 1 of 3, ${LIVE}: 203.0.113.1 answered 403, so nothing was fetched. Nothing was retried another way.`);
    expect(done.out).toContain(`location 2 of 3, ${SNAPSHOT} (web_archive): it gives different bytes from the recorded original (sha256 ${sha(wrapped)}). They were not used.`);
    expect(done.out).toContain(`location 3 of 3, ${MIRROR} (archive): it gave the recorded original.`);
    expect(readdirSync(join(book.project, ".stemma/originals"))).toEqual([sha(PAGE)]);
    // ingest changes no record about the locations.
    expect(others(book, "")).toEqual(files);

    forget(book);
    asked = fakeFetch({ [SNAPSHOT]: { body: wrapped }, [MIRROR]: { status: 404, body: "gone" } });
    const none = await runIngest(book, { fetch: true });
    expect(asked).toEqual([LIVE, SNAPSHOT, MIRROR]);
    expect(none.out).toContain("The request to 203.0.113.1 failed");
    expect(none.out).toContain("The address answered 404.");
    expect(none.out).toContain("no listed address gave the recorded original.");
    expect(none.out).toContain("No original was available for: reefpage");
    expect(() => readFileSync(cached(book))).toThrow();
  });

  test("source locate --fetch records what an address gave, and a refusal leaves a reference", async () => {
    const { book, record } = page();
    const locate = (url: string) => inProcess(() => sourceLocate(options(book, { url, kind: "web_archive", fetch: true }), "reefpage"));
    fakeFetch({ [SNAPSHOT]: { body: PAGE }, [MIRROR]: { body: "<!doctype html><p>another capture</p>" } });
    expect((await locate(SNAPSHOT)).code).toBe(0);
    const differs = await locate(MIRROR);
    expect(differs.code).toBe(1);
    expect(differs.out).toContain("It is not the original and is never used as it.");
    const refused = await locate(LIVE);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain("not compared:");
    expect(refused.out).toContain("It was not compared, so it is a reference only.");
    const listed = upstreamData(book, record).locations;
    expect(listed.map((l: { compared?: { sha256: string } }) => l.compared?.sha256)).toEqual([sha(PAGE), sha("<!doctype html><p>another capture</p>"), undefined]);
    // The same answer again writes nothing.
    const before = book.read(record);
    expect((await locate(SNAPSHOT)).out).toContain("Nothing new, so nothing was written.");
    expect(book.read(record)).toBe(before);
  });
});

describe("text that is not held (FR-104)", () => {
  /** The page project with a passage and a citation of it. */
  function cited() {
    const made = page();
    const found = made.book.json("passage", "find", "--source", made.source, "We counted 37 islets on the rim.").json.found[0];
    const passage = made.book.json("passage", "capture", "--address", found.address, ...AUTHOR).json.passage as string;
    made.book.add("citation", { key: "reefpage", passage, sentence: { text: "There were islets." } });
    expect(made.book.check().body.label).toBe("checked_clean");
    return made;
  }

  test("every part absent is one could-not-check finding, never a pass, and never checked clean", () => {
    const { book } = cited();
    dropText(book);
    const report = book.check();
    expect(report.body.label).toBe("open_findings");
    expect(report.body.results.filter((r) => r.outcome === "fail")).toEqual([]);
    expect(verdicts(report, "source.pages")).toEqual(["unverifiable not_held"]);
    const found = of(report, "source.pages")[0]!;
    expect(found.message).toContain("not held here");
    expect(found.message).toContain("Nothing shows that anything is damaged.");
    expect(found.suggestions.join(" ")).toContain("ingest --fetch");
    expect(evidence(found, "parts")).toEqual(["none of the 2 listed section files is here"]);
    expect(evidence(found, "rests_on_it")).toEqual(["1 passage(s) and 1 citation record(s) taken from this text cannot be checked"]);
    expect(verdicts(report, "source.held")).toEqual(["unverifiable text_not_held"]);
    expect(verdicts(report, "quote.present").every((v) => v.startsWith("unverifiable"))).toBe(true);
    expect(verdicts(report, "source.original")).toEqual(["unverifiable text_not_held"]);
    expect(of(report, "source.original")[0]!.open).toBe(false);
    expect(verdicts(report, "meta.source")).toEqual(["unverifiable text_not_held"]);
    const said = book.run("check").out;
    expect(said).toContain("its text is not held here");
    expect(said).not.toMatch(/damaged(?!\.)|Restore the file from git/);
    const dismiss = book.run("annotate", "--finding", found.finding_key, "--effect", "dismiss", "--reason", "known", ...AUTHOR);
    expect(dismiss.code).toBe(5);
    expect(dismiss.err).toContain("can be explained, not dismissed");
  });

  test("some parts absent or changed is damage, as before", () => {
    const { book } = cited();
    rmSync(join(book.project, "sources/reefpage/sections/s0001.md"));
    const report = book.check();
    expect(verdicts(report, "source.pages")).toEqual(["fail part_missing"]);
    expect(verdicts(report, "source.held")).toEqual(["unverifiable source_damaged"]);
    const done = book.run("ingest", ...AUTHOR);
    expect(done.out).toContain("sources/reefpage is damaged, so it was not compared.");
    expect(() => book.read("sources/reefpage/sections/s0001.md")).toThrow();
  });

  test("ingest --fetch restores the text from a later location, exactly, and records nothing new", async () => {
    const { book } = cited();
    book.run("source", "locate", "reefpage", "--url", SNAPSHOT, "--kind", "web_archive", ...AUTHOR);
    const clean = book.check();
    const tracked = others(book, "");
    const text = dropText(book);
    forget(book);
    const asked = fakeFetch({ [LIVE]: { status: 403 }, [SNAPSHOT]: { body: PAGE } });
    const done = await runIngest(book, { fetch: true });
    expect(asked).toEqual([LIVE, SNAPSHOT]);
    expect(done.out).toContain("restored 2 section file(s) of sources/reefpage/. Each has the digest the manifest records.");
    expect(done.out).toContain("1 already had a current comparison");
    expect(done.out).not.toContain("damaged");
    expect(Object.keys(text)).toHaveLength(2);
    expect(others(book, "")).toEqual(tracked);
    expect(book.check().body.results).toEqual(clean.body.results);
  });

  test("a page that differs on each request restores the text only if every part matches, and is not called the original", async () => {
    const { book, record } = cited();
    const text = dropText(book);
    forget(book);
    // The same words and structure; only a script's value differs.
    const served = PAGE.replace("</head>", '<script>var request = "8f2c";</script></head>');
    fakeFetch({ [LIVE]: { body: served } });
    const before = book.read(record);
    const done = await runIngest(book, { fetch: true });
    expect(done.out).toContain("what the address gives now differs from the recorded original");
    expect(done.out).toContain(`restored 2 section file(s) of sources/reefpage/ from what ${LIVE} gave. Each has the digest the manifest records. The text is restored, and the fetched copy is not the recorded original (its sha256 is ${sha(served)})`);
    for (const [name, content] of Object.entries(text)) expect(book.read(`sources/reefpage/sections/${name}`)).toBe(content);
    expect(() => readFileSync(cached(book))).toThrow();
    expect(book.read(record)).toBe(before);
    expect(book.check().body.label).toBe("checked_clean");
  });

  test("when no address gives the original or its text, nothing is written", async () => {
    const { book } = cited();
    dropText(book);
    forget(book);
    const before = book.files();
    fakeFetch({ [LIVE]: { body: PAGE.replace("37", "73") } });
    const done = await runIngest(book, { fetch: true });
    expect(done.out).toContain("Its bytes are not the recorded original, and converting them does not give the recorded text:");
    expect(done.out).toContain("1 of 2 listed parts differ (index 1)");
    expect(done.out).toContain("its original was not available, so it was not restored.");
    expect(book.files().filter((f) => !f.startsWith(".stemma/"))).toEqual(before.filter((f) => !f.startsWith(".stemma/")));
  });

  test("a PDF's pages are restored from the original, with their labels", () => {
    const book = new Book();
    const source = book.source("reefpage");
    const original = book.file("reef.pdf", reefPdf());
    book.convert(original, source, "--auto-pages", "--name", "reefbook");
    book.run("source", "capture", original, "--source", source, ...AUTHOR, "--acquired-at", "2026-01-05T09:00:00Z");
    const text = dropText(book, "sources/reefbook");
    forget(book);
    const done = book.run("ingest", "--originals", original, ...AUTHOR);
    expect(done.out).toContain("restored 5 page file(s) of sources/reefbook/ (converted with page labels proposed from the printed numbers)");
    for (const [name, content] of Object.entries(text)) expect(book.read(`sources/reefbook/pages/${name}`)).toBe(content);
  });

  test("text a person corrected cannot be made from the original, so nothing is written and the difference is said", () => {
    const { book, source, text } = (() => {
      const made = page();
      return { ...made, text: made.book.json("source", "list").json };
    })();
    expect(text.sources.map((s: { source: string }) => s.source)).toEqual([source]);
    const part = "sources/reefpage/sections/s0001.md";
    book.write(part, book.read(part).replace("37 islets", '<!--stemma:corrected was="37" by="person:author" basis="page-image"-->39<!--/stemma:corrected--> islets'));
    const id = JSON.parse(book.read("sources/reefpage/source.md").split("---\n")[1]!).id;
    expect(book.run("source", "seal", id, ...AUTHOR).code).toBeLessThan(2);
    dropText(book);
    const done = book.run("ingest", ...AUTHOR);
    expect(done.out).toContain("was not restored, and nothing was written.");
    expect(done.out).toContain("1 of 2 listed parts differ (index 1)");
    expect(book.files().filter((f) => f.startsWith("sources/"))).toEqual(["sources/reefpage/source.md"]);
  });
});
