// The worked example, checked from the committed files alone, as in a clone with
// no originals: what is held, that its citations are what their passages copied,
// and that it checks clean.
import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CheckReport } from "@stemma/core";
import { stampSpans } from "@stemma/extract";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { copyExample, ROOT, temporary } from "./helpers.ts";

const EXAMPLE = join(ROOT, "examples/coral-reefs");
// A report written from the example is a work of its own, not part of the project.
const OUTSIDE = new Set([".stemma", "build", "report"]);

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .filter((e) => !OUTSIDE.has(e.name))
  .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const records = (kind: string): any[] => walk(join(EXAMPLE, "records", kind)).map((p) => JSON.parse(readFileSync(p, "utf8")));

let report: CheckReport;
let code = 0;
beforeAll(async () => {
  const work = temporary();
  const cli = await bundle(join(work, "plugin/dist"));
  const clone = join(work, "coral-reefs");
  copyExample(clone, [...OUTSIDE]);
  const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, "check", "--all", "--format", "json", "--project", clone],
    { cwd: dirname(cli), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
  code = done.exitCode;
  report = JSON.parse(done.stdout.toString()) as CheckReport;
}, 120_000);

describe("the worked example", () => {
  test("holds only UTF-8 text: no original and no image", () => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    for (const path of walk(EXAMPLE)) {
      const bytes = readFileSync(path);
      expect(() => decoder.decode(bytes), path).not.toThrow();
      expect(bytes.includes(0), path).toBe(false);
      expect(statSync(path).size, path).toBeLessThan(2 * 1024 * 1024);
    }
  });

  test("holds no download stamp, and says on each page where one was removed", () => {
    for (const path of walk(EXAMPLE)) expect(stampSpans(readFileSync(path, "utf8")).length, path).toBe(0);
    const stamped = walk(join(EXAMPLE, "sources/steibl2024/pages")).map((path) => readFileSync(path, "utf8"));
    expect(stamped.length).toBe(22);
    for (const page of stamped) expect(page).toContain('"kind": "download_stamp"');
  });

  test("every capture in the plan has an upstream record and a source file tied to the same original", () => {
    const plan = JSON.parse(readFileSync(join(EXAMPLE, "plan.json"), "utf8")).captures as any[];
    const upstreams = records("upstreams");
    const manifests = readdirSync(join(EXAMPLE, "sources")).map((name) => {
      const text = readFileSync(join(EXAMPLE, "sources", name, "source.md"), "utf8");
      return JSON.parse(text.slice(4, text.indexOf("\n---\n", 4)));
    });
    expect(plan.length).toBe(14);
    expect(upstreams.length).toBe(plan.length);
    expect(manifests.length).toBe(plan.length);
    for (const entry of plan) {
      const upstream = upstreams.find((u) => u.source === entry.source)!;
      expect(upstream.url).toBe(entry.url);
      expect(upstream.retrieved_at).toBe(entry.retrieved_at);
      expect((upstream.auxiliary ?? []).map((a: any) => a.url)).toEqual((entry.auxiliary ?? []).map((a: any) => a.url));
      const manifest = manifests.find((m) => m.source === entry.source)!;
      expect(manifest.original.files.map((f: any) => f.sha256)).toEqual([upstream.sha256]);
    }
  });

  test("has a recorded fresh conversion of every original in which every part agrees", () => {
    const verification = report.body.verification as any[];
    expect(verification.length).toBe(14);
    for (const source of verification) {
      const fresh = source.runs.find((r: any) => r.method === "reconversion" && r.current);
      expect(fresh, source.directory).toBeDefined();
      expect(fresh.differing_parts, source.directory).toBe(0);
      expect(fresh.parts, source.directory).toBe(source.parts);
      expect(source.reviewed_by_person, source.directory).toBe(0);
    }
  });

  test("its four citations were made from passages, and their quotations and pages agree with the source", () => {
    const passages = new Map(records("passages").map((p) => [p.id, p]));
    const citations = records("citations");
    expect(citations.map((c) => [c.id, c.locator.value]).sort()).toEqual([
      ["cit-darwinreefs0001", "88"], ["cit-darwinreefs0002", "89"], ["cit-darwinreefs0003", "2"], ["cit-darwinreefs0004", "89"],
    ]);
    for (const citation of citations) {
      const passage = passages.get(citation.passage)!;
      expect(citation.locator).toEqual(passage.locator);
      expect(citation.sentence.text).toContain(citation.quotation);
    }
    for (const check of ["quote.present", "quote.page", "locator.extent", "cite.key", "source.held"]) {
      const results = report.body.results.filter((r) => r.check === check && r.subject.startsWith("cit-"));
      expect(results.map((r) => r.outcome), check).toEqual(results.map(() => "pass"));
    }
    expect(report.body.results.filter((r) => r.check === "quote.present" && r.subject.startsWith("cit-")).length).toBe(4);
  });

  test("tags every work with its place in the argument, by command, with who and from what", () => {
    for (const source of records("sources")) {
      expect(source.tags.some((t: string) => /^(position|evidence):/.test(t)), source.citation_key).toBe(true);
      const logged = source.changes.filter((c: any) => c.field === "tags");
      expect(logged.map((c: any) => c.value).sort(), source.citation_key).toEqual(source.tags);
      expect(logged.every((c: any) => c.by.kind === "model" && c.from.startsWith("report/report.md")), source.citation_key).toBe(true);
    }
  });

  test("is checked clean: every applicable check runs and nothing is open", () => {
    expect(report.body.results.filter((r) => r.open)).toEqual([]);
    expect(report.body.not_run).toEqual([]);
    expect(report.body.label).toBe("checked_clean");
    expect(code).toBe(0);
  });

  test("says what was borne out by other means and what was seen in an original, without any person's act", () => {
    const key = new Map(records("sources").map((s) => [s.id, s.citation_key]));
    expect(report.body.summary.confirmed).toBe(0);
    expect(report.body.summary.dismissed).toBe(0);
    expect(report.body.results.filter((r) => r.coverage_only)).toEqual([]);
    const darwin = report.body.results.find((r) => r.check === "meta.source" && key.get(r.source!) === "darwin1842")!;
    expect(darwin.evidence.find((e) => e.name === "year_corroborated_by")!.value).toContain("internet_archive record of ia:b29331213");
    const lyell = report.body.results.find((r) => r.check === "meta.source" && key.get(r.source!) === "lyell1832")!;
    expect(lyell.evidence.find((e) => e.name === "year_result")!.value).toContain('"MDCCCXXXir"');
    const jumps = report.body.results.flatMap((r) => r.evidence.filter((e) => e.name === "observation").map((e) => e.value));
    expect(jumps.length).toBe(1);
    expect(jumps[0]).toContain('printed page 232 is followed by 333');
    expect(jumps[0]).toContain('"Northern Drift"');
  });

});
