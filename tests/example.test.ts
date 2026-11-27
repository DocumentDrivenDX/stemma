// The worked example, checked from the committed files alone, as in a clone with
// no originals: what is held, that its citations are what their passages copied,
// and exactly which findings are open.
import { beforeAll, describe, expect, test } from "bun:test";
import { cpSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { CheckReport } from "@stemma/core";
import { stampSpans } from "@stemma/extract";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { ROOT, temporary } from "./helpers.ts";

const EXAMPLE = join(ROOT, "examples/coral-reefs");
// A report written from the example is a work of its own, not part of the project.
const OUTSIDE = new Set([".stemma", "build", "report"]);

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .filter((e) => !OUTSIDE.has(e.name))
  .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const records = (kind: string): any[] => walk(join(EXAMPLE, "records", kind)).map((p) => JSON.parse(readFileSync(p, "utf8")));

let report: CheckReport;
let code = 0;
let stemma: (...args: string[]) => { code: number; out: string };
beforeAll(async () => {
  const work = temporary();
  const cli = await bundle(join(work, "plugin/dist"));
  const clone = join(work, "coral-reefs");
  cpSync(EXAMPLE, clone, { recursive: true, filter: (path) => !OUTSIDE.has(relative(EXAMPLE, path)) });
  stemma = (...args) => {
    const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args, "--project", clone],
      { cwd: dirname(cli), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
    return { code: done.exitCode, out: done.stdout.toString() };
  };
  const done = stemma("check", "--all", "--format", "json");
  code = done.code;
  report = JSON.parse(done.out) as CheckReport;
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

  test("leaves open exactly the differences its README describes, and runs every applicable check", () => {
    const key = new Map(records("sources").map((s) => [s.id, s.citation_key]));
    for (const name of readdirSync(join(EXAMPLE, "sources"))) {
      const text = readFileSync(join(EXAMPLE, "sources", name, "source.md"), "utf8");
      key.set(JSON.parse(text.slice(4, text.indexOf("\n---\n", 4))).id, name);
    }
    const open = report.body.results.filter((r) => r.open).map((r) => `${r.check} ${r.outcome} ${key.get(r.source ?? r.subject) ?? r.subject}`).sort();
    expect(open).toEqual([
      "meta.resolver unverifiable lyell1832",
      "meta.source unverifiable darwin1842",
      "meta.source unverifiable lyell1832",
      "source.labels fail geolsoc1838",
    ]);
    expect(report.body.not_run).toEqual([]);
    expect(report.body.label).toBe("open_findings");
    expect(code).toBe(1);
  });

  test("the misprinted-looking page number is explained and still open", () => {
    const found = report.body.results.find((r) => r.open && r.check === "source.labels")!;
    expect(found.annotations.map((a) => [a.effect, a.by])).toEqual([["explain", "model claude-sonnet-5-5"]]);
    expect(found.annotations[0]!.reason).toContain("one is printed 232 and the next 333");
  });

  // This runs in the throwaway clone with an invented reviewer. It commits nothing:
  // no person has looked at these pages for the example.
  test("what is left is a person's to settle: two reviews and one dismissal would check it clean", () => {
    const years = report.body.results.filter((r) => r.open && r.check === "meta.source");
    for (const finding of years) {
      const text = (report.body.verification as any[]).find((v) => v.source === finding.source)!.text;
      const page = finding.evidence.find((e) => e.name === "title_page_parts")!.value.replace("index ", "");
      expect(stemma("review", "add", text, "--scope", "source_details", "--pages", page, "--fields", "year", "--against", "the page image", "--outcome", "agrees", "--actor", "person:test-reviewer").code).toBeLessThan(2);
    }
    const jump = report.body.results.find((r) => r.open && r.check === "source.labels")!;
    expect(readFileSync(join(EXAMPLE, "README.md"), "utf8")).toContain(`--finding ${jump.finding_key}`);
    expect(stemma("annotate", "--finding", jump.finding_key, "--effect", "dismiss", "--reason", "invented for this test", "--actor", "person:test-reviewer").code).toBeLessThan(2);
    const after = stemma("check", "--all");
    expect(after.out).toStartWith("CHECKED CLEAN");
    expect(after.code).toBe(0);
  }, 120_000);
});
