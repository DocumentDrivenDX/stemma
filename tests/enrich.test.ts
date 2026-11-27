// Iterative capture (FR-94; US-115), run through the built command line: a source
// is usable at every stage, details and tags are added later, and none of that
// changes a source file or a passage address. Every source is invented and
// nothing uses the network.
import { beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type CheckReport, planResolution, readLookup } from "@stemma/core";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { builtCli, temporary } from "./helpers.ts";

let cli = "";
beforeAll(async () => {
  cli = await builtCli(join(temporary(), "dist"));
});

const AUTHOR = ["--actor", "person:author"];
const WHEN = "2026-01-05T09:00:00Z";

function project() {
  const base = temporary();
  const root = join(base, "book");
  const run = (...args: string[]) => {
    const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args, "--project", root], { cwd: dirname(dirname(cli)), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
    return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
  };
  const json = (...args: string[]) => {
    const done = run(...args, "--format", "json");
    return { ...done, json: JSON.parse(done.out) };
  };
  const file = (name: string, content: string) => {
    writeFileSync(join(base, name), content);
    return join(base, name);
  };
  const files = (under = "**/*"): Record<string, string> => Object.fromEntries(
    [...new Bun.Glob(under).scanSync({ cwd: root, onlyFiles: true })].sort().map((p) => [p, readFileSync(join(root, p), "utf8")]));
  const check = (): CheckReport => json("check").json;
  const open = () => check().body.results.filter((r) => r.open).map((r) => `${r.check} ${r.reason_code}`);
  expect(run("init").code).toBe(0);
  return { root, run, json, file, files, check, open };
}

const ORIGINAL = "# The Invented Reef\n\n## One\n\nThe invented reef was old and the water deep.\n";

describe("a source at each stage", () => {
  test("is captured without text, mapped to text later, and neither step leaves anything open or is repeated", () => {
    const p = project();
    const original = p.file("reef.md", ORIGINAL);
    const captured = p.json("source", "capture", original, ...AUTHOR, "--acquired-at", WHEN, "--origin", "https://example.org/reef.md");
    expect(captured.code).toBe(0);
    const source = captured.json.source as string;
    expect(p.json("source", "list", "--stage", "captured").json.sources.map((s: any) => s.source)).toEqual([source]);
    expect(p.open()).toEqual([]);

    const before = p.files();
    const again = p.run("source", "capture", original, ...AUTHOR, "--acquired-at", WHEN);
    expect([again.code, again.out.includes("Nothing was written")]).toEqual([0, true]);
    delete before[".stemma/reports/check.json"];
    expect(p.files()).toMatchObject(before);
    // Converting it without naming the source would make a second source of one original.
    const unnamed = p.json("source", "convert", original, ...AUTHOR, "--acquired-at", WHEN);
    expect([unnamed.code, unnamed.json.error.code]).toEqual([5, "already_held"]);

    // When it was got and from where were recorded at capture, and are not asked again.
    const converted = p.json("source", "convert", original, "--source", source, ...AUTHOR);
    expect(converted.code).toBe(0);
    const manifest = p.files("sources/**/source.md");
    expect(Object.values(manifest)[0]).toContain(WHEN);
    expect(Object.values(manifest)[0]).toContain("https://example.org/reef.md");
    const text = p.files("sources/**/*");
    const repeated = p.run("source", "convert", original, "--source", source, ...AUTHOR);
    expect([repeated.code, repeated.out.includes("Nothing was written")]).toEqual([0, true]);
    expect(p.files("sources/**/*")).toEqual(text);
    expect(p.json("source", "list").json.sources.map((s: any) => s.stage)).toEqual(["text"]);
    expect(p.open()).toEqual([]);
  });
});

describe("enrichment", () => {
  /** A source with text, one captured passage, and a citation of it. */
  function cited() {
    const p = project();
    const original = p.file("reef.md", ORIGINAL);
    const source = p.json("source", "capture", original, ...AUTHOR, "--acquired-at", WHEN).json.source as string;
    expect(p.run("source", "convert", original, "--source", source, ...AUTHOR).code).toBe(0);
    expect(p.run("source", "enrich", source, ...AUTHOR, "--set", "citation_key=reef1850", "--from", "the author").code).toBe(0);
    const found = () => p.json("passage", "find", "--source", source, "the water deep").json.found;
    const passage = p.json("passage", "capture", "--address", found()[0].address, ...AUTHOR).json.passage as string;
    const sentence = "The invented author says that the water deep.";
    expect(p.run("record", "add", "citation", "--input", p.file("cit.json", JSON.stringify({ key: "reef1850", passage, sentence: { text: sentence } })), ...AUTHOR).code).toBe(0);
    return { ...p, source, passage, found };
  }

  test("adding details and tags leaves source text, passages and addresses byte for byte, and opens nothing", () => {
    const p = cited();
    expect(p.open()).toEqual([]);
    const fixed = () => ({ ...p.files("sources/**/*"), ...p.files("records/{passages,citations,upstreams}/*") });
    const before = fixed();
    const addresses = p.found().map((f: any) => f.address);

    expect(p.run("source", "enrich", "reef1850", ...AUTHOR, "--from", "the title page", "--set", "title=The Invented Reef", "--set", "type=book",
      "--set", "issued=1850", "--set", "publisher=A. Press", "--author", "Author, A. N.", "--add-identifier", "doi:10.5555/reef").code).toBe(0);
    expect(p.run("source", "tag", "reef1850", ...AUTHOR, "--add", "position:subsidence", "--add", "boring", "--from", "the introduction").code).toBe(0);
    expect(p.run("source", "tag", "reef1850", ...AUTHOR, "--remove", "boring").code).toBe(0);

    expect(fixed()).toEqual(before);
    expect(p.found().map((f: any) => f.address)).toEqual(addresses);
    expect(p.open()).toEqual([]);
    // The passage was selected before the details were added: adding contradicts nothing it rested on.
    const dependent = p.check().body.results.filter((r) => r.check === "source.changed");
    expect(dependent.length).toBeGreaterThan(0);
    expect(dependent.map((r) => r.outcome)).toEqual(dependent.map(() => "pass"));
  });

  test("a recorded value is never replaced unasked; replacing one re-evaluates only what rests on it", () => {
    const p = cited();
    expect(p.run("source", "enrich", p.source, ...AUTHOR, "--from", "the title page", "--set", "title=The Invented Reef", "--add-identifier", "doi:10.5555/reef").code).toBe(0);
    const record = () => p.files(`records/sources/${p.source}.json`);
    const kept = record();
    const clash = p.json("source", "enrich", p.source, ...AUTHOR, "--from", "a catalogue", "--set", "title=Another Reef", "--add-identifier", "doi:10.5555/other");
    expect(clash.code).toBe(1);
    expect(clash.json.disagreements).toEqual([
      { field: "identifier doi", recorded: "10.5555/reef", offered: "10.5555/other" },
      { field: "title", recorded: "The Invented Reef", offered: "Another Reef" },
    ]);
    expect(record()).toEqual(kept);
    const same = p.run("source", "enrich", p.source, ...AUTHOR, "--from", "again", "--set", "title=The Invented Reef");
    expect([same.code, same.out.includes("nothing was written")]).toEqual([0, true]);
    expect(record()).toEqual(kept);

    const text = p.files("sources/**/*");
    const before = p.check().body.results;
    expect(p.run("source", "enrich", p.source, ...AUTHOR, "--from", "the author", "--set", "title=The Invented Reefs", "--replace").code).toBe(0);
    expect(p.files("sources/**/*")).toEqual(text);
    const changed = p.check().body.results.filter((r) => r.check === "source.changed" && r.open);
    expect(changed.map((r) => r.reason_code)).toContain("source_details_changed");
    const textual = (results: CheckReport["body"]["results"]) => results.filter((r) => /^(quote|locator|source\.pages|source\.labels)/.test(r.check)).map((r) => `${r.check} ${r.outcome}`);
    expect(textual(p.check().body.results)).toEqual(textual(before));
    expect(Object.values(record())[0]).toContain('"previous": "The Invented Reef"');
  });

  test("a saved lookup fills only what is missing, shows where it differs, and can be run again", () => {
    const p = cited();
    expect(p.run("source", "enrich", p.source, ...AUTHOR, "--from", "the title page", "--set", "title=The Invented Reef", "--set", "issued=1850").code).toBe(0);
    const response = { message: { DOI: "10.5555/reef", title: ["The Invented Reef"], author: [{ given: "A. N.", family: "Author" }], issued: { "date-parts": [[1851]] }, publisher: "A. Press" } };
    const saved = planResolution({
      source: p.source, resolver: "crossref", scheme: "doi", value: "10.5555/reef", url: "https://api.crossref.org/works/10.5555%2Freef",
      lookup: readLookup("crossref", 200, new TextEncoder().encode(JSON.stringify(response))), actor: { kind: "software", name: "test" },
      now: new Date(WHEN), token: () => "invented0lookup00001",
    });
    // As `resolve` writes it, without the network.
    mkdirSync(join(p.root, dirname(saved.path)), { recursive: true });
    writeFileSync(join(p.root, saved.path), saved.text);
    const taken = p.json("source", "enrich", p.source, ...AUTHOR, "--lookup", saved.id);
    expect(taken.code).toBe(1);
    expect(taken.json.added.map((d: any) => d.field)).toEqual(["authors", "publisher"]);
    expect(taken.json.disagreements).toEqual([{ field: "issued", recorded: "1850", offered: "1851" }]);
    const record = p.files(`records/sources/${p.source}.json`);
    expect(Object.values(record)[0]).toContain(`"from": "${saved.id} (crossref record of doi:10.5555/reef`);
    const rerun = p.json("source", "enrich", p.source, ...AUTHOR, "--lookup", saved.id);
    expect([rerun.json.added, rerun.json.disagreements.length]).toEqual([[], 1]);
    expect(p.files(`records/sources/${p.source}.json`)).toEqual(record);
    expect(p.json("source", "list", "--has", "lookup").json.sources.length).toBe(1);
    const overwrite = p.run("source", "enrich", p.source, ...AUTHOR, "--lookup", saved.id, "--replace");
    expect(overwrite.code).toBe(5);
  });

  test("sources are listed by tag, namespace and stage, and a source's history says who, when and from where", () => {
    const p = cited();
    const other = p.json("record", "add", "source", "--input", p.file("other.json", JSON.stringify({ citation_key: "other1860" })), ...AUTHOR).json.added.id;
    expect(p.run("source", "tag", "reef1850", "other1860", ...AUTHOR, "--add", "topic:reefs").code).toBe(0);
    expect(p.run("source", "tag", "reef1850", ...AUTHOR, "--add", "position:subsidence", "--from", "the introduction").code).toBe(0);
    const listed = (...args: string[]) => p.json("source", "list", ...args).json.sources.map((s: any) => s.citation_key);
    expect(listed("--tag", "topic:reefs")).toEqual(["other1860", "reef1850"]);
    expect(listed("--tag", "position:")).toEqual(["reef1850"]);
    expect(listed("--tag", "topic:reefs", "--stage", "record")).toEqual(["other1860"]);
    expect(listed("--stage", "text")).toEqual(["reef1850"]);
    const events = p.json("source", "history", "reef1850").json.events;
    for (const what of ["source record created", "original captured", "mapped to text", "passage captured", "added citation_key: reef1850", "added tags: position:subsidence"]) {
      expect(events.some((e: any) => e.what.startsWith(what) && e.by === "person author"), what).toBe(true);
    }
    expect(events.find((e: any) => e.what === "added tags: position:subsidence").from).toBe("the introduction");
    expect(p.json("source", "history", other).json.events.length).toBe(2);

    // One bad request among several writes nothing.
    const all = p.files("records/sources/*");
    for (const args of [["reef1850", "nobody", "--add", "x"], ["reef1850", "--add", "Not A Tag"], ["reef1850", "--add", "a:b:c"]]) {
      expect(p.run("source", "tag", ...args, ...AUTHOR).code).toBe(5);
    }
    expect(p.files("records/sources/*")).toEqual(all);
    expect(p.run("source", "enrich", "reef1850", ...AUTHOR, "--set", "titel=x", "--from", "x").code).toBe(5);
    expect(p.run("source", "enrich", "reef1850", ...AUTHOR, "--set", "publisher=x").code).toBe(5);
  });

  test("a detail changed by hand still reports the passage selected before it", () => {
    const p = cited();
    const path = `records/sources/${p.source}.json`;
    const record = JSON.parse(readFileSync(join(p.root, path), "utf8"));
    writeFileSync(join(p.root, path), `${JSON.stringify({ ...record, title: { value: "Typed in by hand" } }, null, 2)}\n`);
    expect(p.open()).toContain("source.changed source_details_changed");
  });
});
