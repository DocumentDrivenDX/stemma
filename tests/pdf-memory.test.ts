// The memory bound on reading a PDF (CONTRACT-002 B, "Reading a PDF"), for
// every command that reads one. Every PDF is invented.
import { beforeAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { constants, deflateRawSync, deflateSync } from "node:zlib";
import { LIMITS } from "@stemma/core";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { readInOwnProcess } from "../packages/cli/src/pdf-reading.ts";
import { temporary } from "./helpers.ts";
import { rawPdf, stream } from "./highlight-pdf.ts";
import { makePdf } from "./pdf.ts";

/**
 * A few KB that unpack to `mib` MiB of text operators, each placing a letter by
 * itself, so that the items read pile up: a page's content, compressed twice. The inner data is one compressed block repeated, so that
 * making it does not take the memory that reading it does.
 */
function unpacksLarge(mib: number): Uint8Array {
  const unit = "1 0 0 1 40 700 Tm (a) Tj 1 0 0 1 300 100 Tm (b) Tj\n";
  const block = Buffer.from(`BT /F1 10 Tf\n${unit.repeat(Math.floor(1048576 / unit.length))}ET\n`);
  // A full flush ends on a byte and refers to nothing before it, so the bytes can be repeated.
  const once = deflateRawSync(block, { level: 9, finishFlush: constants.Z_FULL_FLUSH });
  const inner = Buffer.concat([Buffer.from([0x78, 0xda]), ...Array.from({ length: mib }, () => once), Buffer.from([0x03, 0x00])]);
  return rawPdf({ content: "", objects: [], contents: stream("/Filter [/FlateDecode /FlateDecode]", deflateSync(inner, { level: 9 }).toString("latin1")) });
}

const LIMIT_SAID = "needed more than the limit of 4 GiB of memory";
const worker = [process.execPath, ...ISOLATION_FLAGS, join(import.meta.dir, "../packages/cli/src/highlight-worker.ts")];
const limits = { pages: LIMITS.parts, text_bytes: LIMITS.text_bytes, milliseconds: 60_000 };

let cli = "";
/** The same build with a bound no reading fits in, to meet the bound from every command with a small file. */
let tight = "";
beforeAll(async () => {
  cli = await bundle(join(temporary(), "dist"));
  const copy = join(temporary(), "dist");
  cpSync(dirname(cli), copy, { recursive: true });
  tight = join(copy, "stemma.js");
  const built = readFileSync(tight, "utf8");
  const bound = /pdf_memory_bytes: [^,\n]+/g;
  expect(built.match(bound)).toHaveLength(1);
  writeFileSync(tight, built.replace(bound, `pdf_memory_bytes: ${32 * 1048576}`));
});

function run(bin: string, args: string[]) {
  const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, bin, ...args], { cwd: dirname(dirname(bin)), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
}

const everything = (root: string) => [...new Bun.Glob("**/*").scanSync({ cwd: root, dot: true })].sort()
  .map((path) => `${path} ${Bun.hash(readFileSync(join(root, path)))}`);

function book() {
  const base = temporary();
  const project = join(base, "book");
  expect(run(cli, ["init", "--project", project]).code).toBe(0);
  const record = join(base, "source.json");
  writeFileSync(record, JSON.stringify({ citation_key: "tides1911", title: { value: "An invented tide book" } }));
  const added = run(cli, ["record", "add", "source", "--input", record, "--actor", "person:author", "--project", project, "--format", "json"]);
  const file = join(base, "tides.pdf");
  writeFileSync(file, makePdf({ pages: [["An invented tide table."]] }));
  return { base, project, file, source: JSON.parse(added.out).added.id as string };
}
const AUTHOR = ["--actor", "person:author"];
const CAPTURED = ["--acquired-at", "2026-01-05T09:00:00Z"];

describe("the reading process", () => {
  test("is ended near its bound while a few KB unpack, and says that it was the memory", async () => {
    const bytes = unpacksLarge(1024);
    expect(bytes.length).toBeLessThan(20_000);
    expect(await readInOwnProcess(worker, { bytes, limits, memory: 768 * 1048576 })).toEqual({ problem: "too_much_memory" });
  }, 60_000);

  test("gives what the file holds within the bound, and reads nothing without one", async () => {
    const bytes = makePdf({ pages: [["An invented tide table."], []] });
    const read = await readInOwnProcess(worker, { bytes, limits, memory: LIMITS.pdf_memory_bytes });
    expect("text" in read && read.text.pages).toEqual(["An invented tide table.", ""]);
    expect(await readInOwnProcess(worker, { bytes, limits, memory: 0 })).toEqual({ failed: "no bound" });
  });

  test("one that outlasts the time limit within a page is ended", async () => {
    const bytes = unpacksLarge(256);
    expect(await readInOwnProcess(worker, { bytes, limits: { ...limits, milliseconds: -9_900 }, memory: LIMITS.pdf_memory_bytes })).toEqual({ problem: "too_slow" });
  });
});

describe("every command that reads a PDF is bounded, writes nothing, and exits 5", () => {
  test("a file of a few KB, at the real bound", () => {
    const made = book();
    const bomb = join(made.base, "unpacks.pdf");
    writeFileSync(bomb, unpacksLarge(512));
    const before = everything(made.project);
    const done = run(cli, ["source", "convert", bomb, "--source", made.source, ...AUTHOR, ...CAPTURED, "--project", made.project, "--format", "json"]);
    expect(done.code).toBe(5);
    // With --format json the error is the one document on standard output.
    const { error } = JSON.parse(done.out);
    expect([error.code, error.message]).toEqual(["invalid_input", expect.stringContaining(`Reading the PDF ${bomb} ${LIMIT_SAID}`)]);
    expect(everything(made.project)).toEqual(before);
  }, 120_000);

  test("source pages, source convert, and source convert with a supplied text", () => {
    const made = book();
    const before = everything(made.project);
    const map = join(made.base, "map.json");
    const layer = join(made.base, "layer.txt");
    writeFileSync(layer, "A supplied tide table.\n");
    const convert = ["source", "convert", made.file, "--source", made.source, ...AUTHOR, ...CAPTURED];
    for (const args of [["source", "pages", made.file, "--out", map], convert, [...convert, "--text-layer", layer, "--method", "manual"]]) {
      const done = run(tight, [...args, "--project", made.project]);
      expect([done.code, done.out]).toEqual([5, ""]);
      expect(done.err).toContain(`Reading the PDF ${made.file} needed more than the limit of 0.03125 GiB of memory`);
      expect(done.err).toContain("Nothing was written.");
    }
    expect(existsSync(map)).toBe(false);
    expect(everything(made.project)).toEqual(before);
    // A supplied text alone does not read the PDF for its page numbers.
    expect(run(tight, ["source", "pages", made.file, "--text-layer", layer, "--project", made.project]).code).toBe(0);
  });

  test("source verify and ingest, both when it captures and when it compares again", () => {
    const made = book();
    const plan = join(made.base, "plan.json");
    writeFileSync(plan, JSON.stringify({ captures: [{ source: made.source, file: made.file, retrieved_at: "2026-01-05T09:00:00Z" }] }));
    const ingest = ["ingest", ...AUTHOR, "--project", made.project];
    const unwritten = everything(made.project);
    const capture = run(tight, [...ingest, "--plan", plan]);
    expect(capture.code).toBe(5);
    expect(capture.err).toContain(`Reading the PDF ${made.file} needed more than the limit`);
    expect(capture.err).toContain("what ingest wrote before it stays");
    // The whole copy of the original, which git ignores, is kept before its conversion; nothing else is new.
    expect(everything(made.project).filter((f) => !f.startsWith(".stemma/"))).toEqual(unwritten.filter((f) => !f.startsWith(".stemma/")));

    expect(run(cli, [...ingest, "--plan", plan]).code).toBeLessThan(2);
    const [text] = [...new Bun.Glob("sources/*/source.md").scanSync({ cwd: made.project })];
    const id = /^\s*"id": "(txt-[a-z0-9]+)"/m.exec(readFileSync(join(made.project, text!), "utf8"))![1]!;
    const before = everything(made.project);
    for (const args of [["source", "verify", id, "--original", made.file, ...AUTHOR, "--project", made.project], [...ingest, "--reconvert"]]) {
      const done = run(tight, args);
      expect(done.code).toBe(5);
      expect(done.err).toContain("needed more than the limit");
    }
    expect(everything(made.project)).toEqual(before);
  });
});
