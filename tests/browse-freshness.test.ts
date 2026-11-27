// What the local server serves (US-119-AC2 to AC4; CONTRACT-005 M): the
// export's own data with no size cap, arras's own answers over it, and never
// data older than the record files.
import { afterAll, describe, expect, test } from "bun:test";
import { lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createStaticClient, loadStore } from "@documentdrivendx/arras-ui/static";
import { exportGraph, FILES, type ManuscriptPort, servedData } from "@stemma/graph";
import { manuscriptView } from "@stemma/publish";
import { loadCorpus } from "@stemma/records";
import { type Built, createSearch, ProcessGone, queryOf, type SnapshotProcess, Snapshots } from "@stemma/server";
import { inputsChanged, mayShowTheSame, readProject, researchFiles, scanInputs } from "@stemma/workspace";
import { VERSION } from "../packages/cli/src/context.ts";
import { Browsing, endRuns, post } from "./browse-run.ts";
import { copyExample, ROOT, temporary } from "./helpers.ts";
import { smallProject } from "./small-project.ts";

afterAll(endRuns);

/** The small invented project: what is tested with it does not depend on what the worked example says. */
const project = (): string => smallProject();
/** The worked example, where a search finds many matches. */
const example = (): string => copyExample(join(temporary(), "coral"));

const filesOf = (dir: string, under: string) => (readdirSync(join(dir, under), { recursive: true }) as string[]).sort().map((f) => join(dir, under, f)).filter((f) => lstatSync(f).isFile());
const recordOf = (dir: string, prefix: string) => filesOf(dir, "records").find((f) => f.split("/").at(-1)!.startsWith(prefix))!;

const read = (dir: string) => {
  const corpus = loadCorpus(readProject(dir));
  const include = corpus.settings.data?.bibliography_include;
  const manuscript: ManuscriptPort = (exported) => manuscriptView(corpus, Array.isArray(include) ? include.map(String) : [], exported);
  return { corpus, request: { version: VERSION, manuscript } };
};

const timeless = (value: unknown) => JSON.stringify(value).replace(/"at":"[^"]*"/g, '"at":"-"');

describe("US-119-AC2 the served data is the export's, with no cap", () => {
  const dir = join(ROOT, "examples/coral-reefs");

  test("under the export's caps it holds the same graph, source views and manuscript", () => {
    const { corpus, request } = read(dir);
    const exported = exportGraph(corpus, request);
    const served = servedData(corpus, request);
    expect(served.graphText).toBe(exported.files.find((f) => f.name === FILES.graph)!.text);
    expect(served.views).toEqual(exported.sourceViews);
    expect(served.manuscript).toEqual(exported.manuscript);
    expect(served.data_identity).toBe(exported.manifest.data_identity);
    // The module differs only in what it says of itself.
    const module = exported.files.find((f) => f.name === FILES.module)!.text;
    expect(served.moduleText).toBe(module.replace("as they were when exported", "as Stemma last read them from its files"));
  }, 60_000);

  test("past the export's caps, where the export leaves text out, the served data leaves none out", () => {
    const { corpus, request } = read(dir);
    const capped = exportGraph(corpus, { ...request, sourceViewsCap: 20_000, manuscriptCap: 1000 });
    const cut = Object.values(capped.sourceViews).filter((v) => v.state === "not_exported");
    expect(cut.length).toBeGreaterThan(50);
    expect(capped.manuscript.state).toBe("unavailable");
    const served = servedData(corpus, request);
    expect(Object.values(served.views).filter((v) => v.state === "not_exported")).toEqual([]);
    for (const view of cut) expect(served.views[view.id]!.segments.length).toBeGreaterThan(0);
    expect(served.manuscript.state).toBe("read");
    expect(served.banner.warnings.map((w) => w.code)).not.toContain("source_views_cut");
  }, 60_000);
});

describe("US-119-AC3 the server answers as arras's static client does", () => {
  test("the same queries give the same answers through the server as in process", async () => {
    const dir = project();
    const one = await Browsing.start(dir);
    const { corpus, request } = read(dir);
    const served = servedData(corpus, request);
    const local = createStaticClient(await loadStore(served.moduleText, served.graphText), served.moduleText);
    const source = (JSON.parse(served.graphText) as { records: { type?: string; key?: string }[] }).records.find((r) => r.type === "Source")!.key!;
    const queries: [string, Record<string, unknown> | undefined][] = [
      [`query($key: ID!) { source(key: $key) { key title citationKey passageSourceSource { key heading } } }`, { key: source }],
      [`query { source(key: "no-such-key") { key } }`, undefined], ["query { nothing }", undefined], ["not graphql", undefined], ["mutation { x }", undefined],
    ];
    for (const [query, variables] of queries) {
      const got = await one.query(query, variables);
      let expected: unknown;
      try {
        expected = await local.moduleQuery("stemma", query, variables);
      } catch (error) {
        expected = { refused: (error as Error).message };
      }
      const given = got.status === 200 ? got.json.result : { refused: got.json.error.message };
      expect(timeless(given).replace(/static:[0-9a-f]{16}/g, "")).toBe(timeless(expected).replace(/static:[0-9a-f]{16}/g, ""));
    }
    for (const call of ["version", "viewer", "meta", "status", "schemaCatalog"] as const) {
      expect(timeless((await one.call("/api/arras", { call })).json.result)).toBe(timeless(await local[call]()));
    }
    for (const view of Object.values(served.views).slice(0, 40)) {
      expect((await one.call("/api/source-view", { id: view.id })).json.result).toEqual(JSON.parse(JSON.stringify(view)));
    }
    expect((await one.call("/api/manuscript")).json.result).toEqual(JSON.parse(JSON.stringify(served.manuscript)));
    expect((await one.call("/api/arras", { call: "invoke" })).status).toBe(400);
    expect((await one.call("/api/query", { module: 1, query: "q" })).status).toBe(400);
    await one.stop();
  }, 60_000);
});

describe("US-119-AC4 which snapshot may answer", () => {
  /** A project that is a number: each build reads it, and takes as long as the test says. */
  function pretend() {
    let files = 1;
    let research = "";
    const log: string[] = [];
    const gates: (() => void)[] = [];
    let held = false;
    const spawn = (): SnapshotProcess => {
      let read = 0;
      let end!: () => void;
      const ended = new Promise<void>((resolve) => (end = resolve));
      return {
        async build() {
          read = files;
          log.push(`build ${read}`);
          if (held) await new Promise<void>((resolve) => gates.push(resolve));
          return { data_identity: `id${read}`, entries: 0, warnings: [] } satisfies Built;
        },
        identity: async () => `id${files}`,
        ask: async () => ({ status: 200, body: `answer ${read}` }),
        stop: () => (log.push(`stop ${read}`), end()),
        ended,
      };
    };
    const inputs = {
      scan: async () => ({ files, research }),
      changed: async (since: { files: number; research: string }) => since.files !== files || since.research !== research,
      mayShowTheSame: (a: { research: string }, b: { research: string }) => a.research === b.research,
    };
    return { inputs, spawn, log, set: (n: number) => (files = n), hold: (on: boolean) => (held = on), release: () => gates.splice(0).forEach((g) => g()) };
  }
  const settle = () => Bun.sleep(5);

  test("a change during a build leads to another build, and the one in between is never current", async () => {
    const p = pretend();
    const snapshots = new Snapshots(p.inputs, p.spawn);
    await snapshots.start();
    p.hold(true);
    p.set(2);
    expect((await snapshots.check()).state).toBe("rebuilding");
    await settle();
    p.set(3);
    p.release();
    await settle();
    // The build of 2 has ended, but 3 is what there is.
    expect((await snapshots.check()).state).toBe("rebuilding");
    await settle();
    p.release();
    await settle();
    const now = await snapshots.check();
    expect([now.state, now.state === "current" && now.data_identity]).toEqual(["current", "id3"]);
    await snapshots.stop();
  });

  test("a verdict rests on a scan that began after the call: a change just before it is seen", async () => {
    const p = pretend();
    let open: (() => void) | undefined;
    let slow = false;
    const scans: number[] = [];
    let files = 1;
    const snapshots = new Snapshots({
      scan: async () => files,
      changed: async (since: number) => {
        const seen = files;
        scans.push(seen);
        if (slow) await new Promise<void>((resolve) => (open = resolve));
        return since !== seen;
      },
      mayShowTheSame: () => true,
    }, p.spawn);
    await snapshots.start();
    slow = true;
    const first = snapshots.check();
    await settle();
    // This change comes while the first scan runs; calls made now must not be answered by that scan.
    files = 2;
    p.set(2);
    const second = snapshots.check();
    const third = snapshots.check();
    expect(second).toBe(third);
    slow = false;
    open!();
    expect((await first).state).toBe("current");
    expect((await second).state).toBe("rebuilding");
    expect(scans).toEqual([1, 2]);
    await snapshots.stop();
  });

  test("a failed first build throws, and stop ends a build that is under way", async () => {
    const failing = new Snapshots({ scan: async () => 0, changed: async () => false, mayShowTheSame: () => true },
      () => ({ build: () => Promise.reject(new ProcessGone()), identity: async () => "", ask: async () => ({ status: 200, body: "" }), stop: () => {}, ended: Promise.resolve() }));
    await expect(failing.start()).rejects.toThrow(ProcessGone);
    const p = pretend();
    p.hold(true);
    const stopped = new Snapshots(p.inputs, p.spawn);
    const starting = stopped.start();
    starting.catch(() => {});
    await settle();
    await stopped.stop();
    expect(p.log).toContain("stop 1");
    p.release();
    await expect(starting).rejects.toThrow("stopping");
  });

  test("the identity is computed first only when the data may be the same", async () => {
    const dir = project();
    const record = recordOf(dir, "src-");
    const was = readFileSync(record, "utf8");
    mkdirSync(join(dir, "research"), { recursive: true });
    writeFileSync(join(dir, "research/note.md"), "# A note\n");
    const first = await scanInputs(dir);
    const then = async (change: () => void) => {
      const before = await scanInputs(dir);
      change();
      return mayShowTheSame(before, await scanInputs(dir));
    };
    // A touch, a research note rewritten, and a report's outputs rebuilt may leave the data as it was.
    expect(await then(() => utimesSync(record, new Date(), new Date()))).toBe(true);
    expect(await then(() => writeFileSync(join(dir, "research/note.md"), "# A longer note\n"))).toBe(true);
    expect(await then(() => writeFileSync(join(dir, "report/report.md"), "rebuilt\n"))).toBe(true);
    // A record that changed size, a file that came or went, and another set of research files cannot.
    expect(await then(() => writeFileSync(record, `${was}\n`))).toBe(false);
    expect(await then(() => writeFileSync(join(dir, "rules.md"), "# Rules\n"))).toBe(false);
    expect(await then(() => rmSync(record))).toBe(false);
    expect(await then(() => writeFileSync(join(dir, "research/another.md"), "# Another\n"))).toBe(false);
    expect(mayShowTheSame(first, first)).toBe(true);
  }, 60_000);

  test("the scan sees what readProject reads and ignores what it skips", async () => {
    const dir = project();
    const scan = await scanInputs(dir);
    const content = readProject(dir);
    for (const file of [content.settings, ...content.records, ...content.sources, ...content.manuscript, ...content.research, content.report!.spec, content.report!.template!]) {
      expect([file.path, scan.marks.has(file.path)]).toEqual([file.path, true]);
    }
    expect(await inputsChanged(dir, scan)).toBe(false);
    mkdirSync(join(dir, ".stemma"), { recursive: true });
    writeFileSync(join(dir, "records/.hidden"), "x");
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(join(dir, "notes.txt"), "x");
    expect(await inputsChanged(dir, scan)).toBe(false);
    expect(researchFiles(scan)).toBe(content.research.map((f) => f.path).sort().join("\n"));
    writeFileSync(join(dir, "report/.template.md"), "x");
    expect(await inputsChanged(dir, scan)).toBe(true);
  }, 60_000);
});

describe("US-120 search through the built command", () => {
  const ask = { text: "reef", offset: 0, limit: 200 };

  test("AC1, AC6: it is signed and proved like every call, bounded, and never older than the files", async () => {
    const dir = example();
    const one = await Browsing.start(dir);
    // `Browsing.call` fails unless the answer carries its right proof.
    const first = await one.call("/api/search", ask);
    expect([first.status, first.proved, first.json.data_identity]).toEqual([200, true, one.info.data_identity]);
    const served = (() => {
      const { corpus, request } = read(dir);
      return servedData(corpus, request);
    })();
    expect(first.json.result).toEqual(createSearch(served.search).page(queryOf("reef")!, undefined, 0, 200));
    expect(first.json.result.total).toBeGreaterThan(50);
    const unsigned = await post(one.info, "/api/search", ask);
    expect([unsigned.status, unsigned.json.error.code]).toEqual([401, "unauthorized"]);
    expect((await one.call("/api/search", { ...ask, limit: 100_000 })).status).toBe(400);
    expect((await one.call("/api/search", { ...ask, text: "x".repeat(100_000) }).catch((e: Error) => ({ status: e.message.includes("413") ? 413 : 0 }))).status).toBe(413);
    const sourceFile = recordOf(dir, "src-");
    const record = JSON.parse(readFileSync(sourceFile, "utf8")) as { id: string; title: { value: string } };
    record.title.value = "Zebra retitled work";
    writeFileSync(sourceFile, `${JSON.stringify(record, null, 2)}\n`);
    expect((await one.call("/api/search", { ...ask, text: "zebra retitled" })).json.error.code).toBe("index_stale");
    await one.current();
    const after = await one.call("/api/search", { ...ask, text: "zebra retitled" });
    expect(after.json.result.hits.map((h: { key: string }) => h.key)).toContain(record.id);
    await one.stop();
  }, 90_000);
});
