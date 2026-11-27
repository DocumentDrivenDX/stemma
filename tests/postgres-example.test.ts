// The PostgreSQL worked example, which does not commit the text of some of the
// works it cites. Most of this runs on a copy holding only what is committed,
// made the same way as the site's recorded runs (website/lib/held.ts), so it
// gives the same result whatever else this tree holds. What needs all the text
// is skipped where it is missing, and scripts/browser-note.ts says so.
import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { CheckReport } from "@stemma/core";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { copyExample, keysNotCommitted, manifest, textMissingHere, textNotCommitted } from "../website/lib/held.ts";
import { ROOT, temporary } from "./helpers.ts";

const NAME = "examples/postgres-web-apps";
const EXAMPLE = join(ROOT, NAME);
const ALL_TEXT_HERE = textMissingHere(EXAMPLE).length === 0;
// A source archive has no Git repository to compare with.
const IN_GIT = existsSync(join(ROOT, ".git"));

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const filesOf = (dir: string): string[] => walk(dir).map((p) => relative(dir, p)).sort();

let cli: string;
let published: string;
const run = (args: string[]) => {
  const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args],
    { cwd: dirname(cli), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
};
const check = (project: string) => {
  const done = run(["check", "--all", "--format", "json", "--project", project]);
  return { code: done.code, report: JSON.parse(done.out) as CheckReport };
};

beforeAll(async () => {
  cli = await bundle(join(temporary(), "plugin/dist"));
  published = join(temporary(), "postgres-web-apps");
  copyExample(EXAMPLE, published);
}, 120_000);

describe("a copy of the PostgreSQL example as it is published", () => {
  test.skipIf(!IN_GIT)("holds the files Git tracks or would add, and no others", () => {
    const git = Bun.spawnSync(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "."], { cwd: EXAMPLE });
    expect(git.exitCode, git.stderr.toString()).toBe(0);
    expect(filesOf(published)).toEqual(git.stdout.toString().split("\0").filter((f) => f && existsSync(join(EXAMPLE, f))).sort());
  });

  test("leaves out text that a tree holds, and nothing else that is ignored comes with the text", () => {
    // A tree holding every kind of thing that must stay behind, whatever this one holds.
    const tree = join(temporary(), "tree");
    copyExample(EXAMPLE, tree);
    const add = (path: string) => { mkdirSync(dirname(join(tree, path)), { recursive: true }); writeFileSync(join(tree, path), "x\n"); };
    for (const folder of textNotCommitted(tree)) add(`${folder}/extra.md`);
    for (const path of [".stemma/originals/a", "report/build/b", "report/report.pdf", "paper.PDF", ".DS_Store"]) add(path);

    const without = join(temporary(), "without");
    copyExample(tree, without);
    expect(filesOf(without)).toEqual(filesOf(published));
    const withText = join(temporary(), "with");
    copyExample(tree, withText, { withText: true });
    expect(filesOf(withText).filter((f) => !filesOf(published).includes(f)))
      .toEqual(textNotCommitted(tree).map((folder) => `${folder}/extra.md`).sort());
  });

  test("holds none of the text of the works its .gitignore names, and all the text of the others", () => {
    const left = keysNotCommitted(published);
    expect(left.length).toBe(7);
    expect(textMissingHere(published)).toEqual(left);
    for (const key of readdirSync(join(published, "sources"))) {
      const parts = manifest(published, key).pages.map((p: { file: string }) => existsSync(join(published, "sources", key, p.file)));
      expect(new Set(parts), key).toEqual(new Set([!left.includes(key)]));
    }
  });

  test("holds only UTF-8 text: no original and no image", () => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    for (const path of walk(published)) {
      const bytes = readFileSync(path);
      expect(() => decoder.decode(bytes), path).not.toThrow();
      expect(bytes.includes(0), path).toBe(false);
      expect(bytes.length, path).toBeLessThan(2 * 1024 * 1024);
    }
  });

  test("has valid records, and open only two problems and what the missing text leaves unchecked", () => {
    const { code, report } = check(published);
    expect(code).toBe(1);
    expect(report.body.label).not.toBe("checked_clean");
    const records = report.body.results.filter((r) => r.check === "record.valid");
    expect(records.length).toBeGreaterThan(0);
    expect(records.filter((r) => r.outcome !== "pass")).toEqual([]);
    const open = report.body.results.filter((r) => r.open);
    expect(open.filter((r) => r.outcome === "fail").map((r) => r.check).sort()).toEqual(["meta.source", "source.footnotes"]);
    expect(open.filter((r) => r.outcome === "unverifiable").length).toBe(155);
    // Nothing is called damaged: each of the works left out is reported once as not held.
    const notHeld = open.filter((r) => r.check === "source.pages");
    expect(notHeld.map((r) => r.outcome)).toEqual(keysNotCommitted(published).map(() => "unverifiable"));
    expect(new Set(notHeld.map((r) => r.reason_code))).toEqual(new Set(["not_held"]));
  });

  test("says that whether its report is current cannot be told, and writes nothing", () => {
    const before = readFileSync(join(published, "report/report.md"), "utf8");
    const done = run(["build", "report", "report", "--check", "--project", published]);
    expect(done.code).toBe(5);
    expect(done.out + done.err).toContain("it is not held here");
    expect(done.out + done.err).toContain("Whether the report's files are current cannot be told.");
    expect(readFileSync(join(published, "report/report.md"), "utf8")).toBe(before);
  });
});

describe.skipIf(!ALL_TEXT_HERE)("the PostgreSQL example with all its text", () => {
  let project: string;
  beforeAll(() => {
    project = join(temporary(), "postgres-web-apps");
    copyExample(EXAMPLE, project, { withText: true });
  });

  test("has two problems open and nothing that could not be checked", () => {
    const { report } = check(project);
    expect(report.body.results.filter((r) => r.open).map((r) => `${r.outcome} ${r.check}`).sort()).toEqual(["fail meta.source", "fail source.footnotes"]);
    expect(report.body.not_run.length).toBe(2);
  });

  test("has a report whose generated files are current", () => {
    const done = run(["build", "report", "report", "--check", "--project", project]);
    expect(done.out + done.err).toContain("are current: 42 notes.");
    expect(done.code).toBe(0);
  });
});
