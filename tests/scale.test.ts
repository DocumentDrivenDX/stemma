// `check`, `graph export`, `unreviewed list` and `reviewed` must grow in proportion to a project. Work is
// counted, not timed: every read of a property of a loaded record. A rescan of
// all records for each item makes that count grow with the square of the size,
// so twice the project reads about four times as much.
import { expect, test } from "bun:test";
import { planAnnotation, planReviewed, runChecks, unreviewedListing } from "@stemma/core";
import { exportGraph } from "@stemma/graph";
import { type Corpus, digest, idOf, isRetired, loadCorpus, type LoadedFile, type ProjectContent } from "@stemma/records";
import { syntheticProject } from "../scripts/synthetic-project.ts";

/** A synthetic project with small pages, held in memory, with a note on one finding in three. */
function load(sources: number, unmatched: number): Corpus {
  const files = syntheticProject({ sources, unmatched, pages: [[2, 4], [6, 8]] });
  const content = (): ProjectContent => {
    const file = (path: string) => ({ path, bytes: new TextEncoder().encode(files.get(path)!) });
    const under = (directory: string) => [...files.keys()].filter((path) => path.startsWith(`${directory}/`)).sort().map(file);
    return { settings: file("stemma.json"), records: under("records"), sources: under("sources"), manuscript: [], research: [] };
  };
  const first = loadCorpus(content());
  const results = runChecks(first, {}).body.results;
  results.filter((r) => r.outcome !== "pass").filter((_, i) => i % 3 === 0).forEach((found, i) => {
    const note = planAnnotation(first, results, {
      finding: found.finding_key, effect: "explain", reason: "synthetic note", actor: { kind: "person", name: "synthetic" },
      now: new Date("2026-03-01T00:00:00Z"), token: () => `synnote${i.toString(36).padStart(13, "0")}`,
    });
    files.set(note.path, note.text);
  });
  return loadCorpus(content());
}

/** The same corpus, each record counting what is read of it. */
function counted(corpus: Corpus): { corpus: Corpus; reads: () => number } {
  let reads = 0;
  const wrapped = new Map<LoadedFile, LoadedFile>();
  const wrap = (file: LoadedFile): LoadedFile => wrapped.get(file) ?? wrapped.set(file, new Proxy(file, {
    get: (target, name) => {
      reads++;
      return Reflect.get(target, name) as unknown;
    },
  })).get(file)!;
  return {
    corpus: {
      ...corpus, records: corpus.records.map(wrap),
      byId: new Map([...corpus.byId].map(([id, file]) => [id, wrap(file)])),
      texts: new Map([...corpus.texts].map(([id, text]) => [id, { ...text, manifest: wrap(text.manifest) }])),
    },
    reads: () => reads,
  };
}

/** Every record that can be marked, named as `reviewed` takes it. */
const targets = (corpus: Corpus): string[] => corpus.records.flatMap((file) => {
  const data = file.data;
  if (!data || !["note", "claim", "attestation"].includes(String(data.kind)) || isRetired(data)) return [];
  const { review: _r, created: _c, changed: _m, legacy: _l, x: _x, ...content } = data;
  return [`${idOf(file)!}@${digest(content)}`];
});

type Run = (c: Corpus, wanted: string[]) => unknown;
const RUNS: Record<string, Run> = {
  check: (c) => runChecks(c, {}), export: (c) => exportGraph(c, { version: "0.0.0" }), unreviewed: (c) => unreviewedListing(c),
  reviewed: (c, wanted) => planReviewed(c, { targets: wanted, actor: { kind: "person", name: "synthetic" }, now: new Date("2026-03-02T00:00:00Z"), token: () => "synbatch" }),
};

for (const unmatched of [0, 100]) {
  test(`check, export and the review commands read records in proportion to the project, with ${unmatched}% of quotations unmatched`, () => {
    const [small, large] = [load(40, unmatched), load(160, unmatched)];
    for (const [name, run] of Object.entries(RUNS)) {
      const [a, b] = [counted(small), counted(large)];
      run(a.corpus, targets(small));
      run(b.corpus, targets(large));
      expect(a.reads()).toBeGreaterThan(small.records.length);
      // Four times the project: in proportion is about 4, with the square about 16.
      expect(`${name} ${(b.reads() / a.reads() < 5)} ${(b.reads() / a.reads()).toFixed(1)}`).toStartWith(`${name} true`);
    }
  });
}
