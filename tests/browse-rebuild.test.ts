// The built `browse` as the files under it change (US-119-AC4; CONTRACT-005 M):
// it never answers from data older than the record files.
import { afterAll, describe, expect, test } from "bun:test";
import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type ManuscriptPort, servedData } from "@stemma/graph";
import { manuscriptView } from "@stemma/publish";
import { loadCorpus } from "@stemma/records";
import { readProject } from "@stemma/workspace";
import { VERSION } from "../packages/cli/src/context.ts";
import { Browsing, childrenOf, endRuns } from "./browse-run.ts";
import { copyExample, temporary } from "./helpers.ts";

afterAll(endRuns);

function project(): string {
  const dir = join(temporary(), "coral");
  return copyExample(dir);
}

const filesOf = (dir: string, under: string) => (readdirSync(join(dir, under), { recursive: true }) as string[]).sort().map((f) => join(dir, under, f)).filter((f) => lstatSync(f).isFile());
const recordOf = (dir: string, prefix: string) => filesOf(dir, "records").find((f) => f.split("/").at(-1)!.startsWith(prefix))!;

const read = (dir: string) => {
  const corpus = loadCorpus(readProject(dir));
  const include = corpus.settings.data?.bibliography_include;
  const manuscript: ManuscriptPort = (exported) => manuscriptView(corpus, Array.isArray(include) ? include.map(String) : [], exported);
  return { corpus, request: { version: VERSION, manuscript } };
};

const timeless = (value: unknown) => JSON.stringify(value).replace(/"at":"[^"]*"/g, '"at":"-"');

describe("US-119-AC4 the served data is never older than the files", () => {
  test("every kind of change: the first call after it never gets the old data, and the rebuilt answers are those of a fresh build", async () => {
    const dir = project();
    const one = await Browsing.start(dir);
    let identity = one.info.data_identity;
    const sourceFile = recordOf(dir, "src-");
    const source = JSON.parse(readFileSync(sourceFile, "utf8")) as { id: string; title: { value: string } };
    const titleNow = async () => (await one.query(`query { source(key: "${source.id}") { title } }`)).json.result?.data?.source?.title as string | undefined;
    const write = (path: string, change: (text: string) => string) => writeFileSync(path, change(readFileSync(path, "utf8")));

    /** `moves`: whether the data identity changes. */
    const after = async (what: string, change: () => void, moves: boolean) => {
      change();
      const first = await one.call("/api/source-view", { id: source.id });
      expect([what, first.status, first.json.error?.code]).toEqual([what, 503, "index_stale"]);
      const now = await one.current();
      expect([what, now !== identity]).toEqual([what, moves]);
      identity = now;
      expect([what, (await one.call("/api/boot")).json.data_identity]).toEqual([what, identity]);
    };

    await after("a record edited", () => write(sourceFile, (t) => {
      const record = JSON.parse(t) as { title: { value: string } };
      record.title.value = "Zebra retitled work";
      return `${JSON.stringify(record, null, 2)}\n`;
    }), true);
    expect(await titleNow()).toBe("Zebra retitled work");

    // Rewritten to the same size with its modification time put back, as some tools do.
    const before = lstatSync(sourceFile);
    await after("same size and mtime", () => {
      write(sourceFile, (t) => t.replace("Zebra retitled work", "Okapi retitled work"));
      utimesSync(sourceFile, before.atime, before.mtime);
    }, true);
    expect(await titleNow()).toBe("Okapi retitled work");

    await after("a file replaced by renaming another onto it", () => {
      writeFileSync(`${dir}/replacement`, readFileSync(sourceFile, "utf8").replace("Okapi retitled work", "Tapir retitled work"));
      renameSync(`${dir}/replacement`, sourceFile);
    }, true);
    expect(await titleNow()).toBe("Tapir retitled work");

    const passage = recordOf(dir, "psg-");
    const kept = readFileSync(passage, "utf8");
    const gone = JSON.parse(kept).id as string;
    await after("a record removed", () => rmSync(passage), true);
    expect((await one.call("/api/source-view", { id: gone })).json.result).toBeNull();
    await after("a record added", () => writeFileSync(passage, kept), true);
    expect((await one.call("/api/source-view", { id: gone })).json.result.id).toBe(gone);

    const part = filesOf(dir, "sources").find((f) => /p\d+\.md$/.test(f))!;
    await after("a source page edited", () => write(part, (t) => `${t}\nAn added line.\n`), true);
    await after("the report's template edited", () => write(join(dir, "report", JSON.parse(readFileSync(join(dir, "report/report.json"), "utf8")).manuscript), (t) => `${t}\nZebra closing paragraph.\n`), true);
    expect(JSON.stringify((await one.call("/api/manuscript")).json.result)).toContain("Zebra closing paragraph.");
    await after("the rules added or edited", () => writeFileSync(join(dir, "rules.md"), "# Rules\nZebra.\n"), true);
    await after("the settings edited", () => write(join(dir, "stemma.json"), (t) => JSON.stringify({ ...JSON.parse(t), x: { note: "zebra" } }, null, 2)), true);
    await after("a new manuscript file in a new directory", () => {
      mkdirSync(join(dir, "manuscript/part"), { recursive: true });
      writeFileSync(join(dir, "manuscript/part/one.md"), "Zebra.\n");
    }, true);

    const chapter = join(dir, "manuscript/chp-aaaaaaaaaaaa.md");
    await after("a chapter added", () => writeFileSync(chapter, "# A chapter\n\nZebra.\n"), true);
    // Nothing but the name changes, and the name is the chapter's ID.
    await after("a chapter renamed", () => renameSync(chapter, join(dir, "manuscript/chp-bbbbbbbbbbbb.md")), true);

    // The data identity does not cover research notes, but the export counts them.
    const omitted = async () => ((await one.call("/api/boot")).json.result.banner.omissions as { type: string; count: number }[]).find((o) => o.type === "ResearchNote")?.count ?? 0;
    const notes = await omitted();
    await after("a research note added", () => {
      mkdirSync(join(dir, "research"), { recursive: true });
      writeFileSync(join(dir, "research/2026-01-05-zebra.md"), "# Zebra\n");
    }, false);
    expect(await omitted()).toBe(notes + 1);

    // Bytes touched with nothing changed: taken out of service, then served again without a rebuild.
    const rebuilds = () => one.run.stderr.split("Read again in").length;
    const built = rebuilds();
    await after("a file only touched", () => utimesSync(sourceFile, new Date(), new Date()), false);
    expect([rebuilds(), one.run.stderr.includes("the data is the same")]).toEqual([built, true]);

    // A hidden file, as an editor leaves beside what it edits, is no input.
    const hidden = join(dirname(sourceFile), ".swap");
    writeFileSync(hidden, "x");
    expect((await one.call("/api/boot")).status).toBe(200);
    rmSync(hidden);
    expect((await one.call("/api/boot")).status).toBe(200);

    const { corpus, request } = read(dir);
    const fresh = servedData(corpus, request);
    expect(identity).toBe(fresh.data_identity);
    expect((await one.call("/api/manuscript")).json.result).toEqual(JSON.parse(JSON.stringify(fresh.manuscript)));
    expect(timeless((await one.call("/api/boot")).json.result.banner)).toBe(timeless(fresh.banner));
    for (const view of Object.values(fresh.views)) expect((await one.call("/api/source-view", { id: view.id })).json.result).toEqual(JSON.parse(JSON.stringify(view)));
    await one.stop();
  }, 180_000);

  test("while it rebuilds, calls answer index_stale at once and status says rebuilding", async () => {
    const dir = project();
    const one = await Browsing.start(dir);
    writeFileSync(join(dir, "rules.md"), "# Rules\nZebra.\n");
    const states: string[] = [];
    let slowest = 0;
    for (;;) {
      const began = Date.now();
      const status = (await one.call("/api/status")).json.state as string;
      const query = await one.query("query { __typename }");
      slowest = Math.max(slowest, Date.now() - began);
      if (status === "current" && query.status === 200) break;
      states.push(`${status} ${query.status === 200 ? "answered" : query.json.error.code}`);
      await Bun.sleep(100);
    }
    expect(states.length).toBeGreaterThan(2);
    expect(states.filter((s) => s !== "rebuilding index_stale").length).toBeLessThanOrEqual(1);
    expect(slowest).toBeLessThan(1500);
    await one.stop();
  }, 60_000);

  test("a change that breaks the project: nothing is served and status says why; the next change recovers", async () => {
    const dir = project();
    const one = await Browsing.start(dir);
    const settings = readFileSync(join(dir, "stemma.json"), "utf8");
    writeFileSync(join(dir, "stemma.json"), "{ not json");
    let status = (await one.call("/api/status")).json;
    for (let i = 0; i < 200 && status.state !== "failed"; i++, await Bun.sleep(100)) status = (await one.call("/api/status")).json;
    expect(status.state).toBe("failed");
    expect(status.message).toContain("stemma.json");
    for (const path of ["/api/boot", "/api/manuscript", "/api/query"]) expect((await one.call(path)).json.error.code).toBe("index_stale");
    expect(childrenOf(one.run.child.pid)).toEqual([]);
    writeFileSync(join(dir, "stemma.json"), settings);
    expect(await one.current()).toBe(one.info.data_identity);
    await one.stop();
  }, 60_000);

  test("if the process holding the data ends, another is built", async () => {
    const one = await Browsing.start(project());
    const [worker] = childrenOf(one.run.child.pid);
    process.kill(worker!.pid, "SIGKILL");
    await Bun.sleep(200);
    expect(await one.current()).toBe(one.info.data_identity);
    const [next] = childrenOf(one.run.child.pid);
    expect(next!.pid).not.toBe(worker!.pid);
    await one.stop();
  }, 60_000);
});
