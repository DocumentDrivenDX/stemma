// Records the worked example's runs that the site shows: the check of the example
// as committed, and the check of a throwaway copy with two planted mistakes.
//   ./scripts/dev.sh record-example
// The example holds its source files, so every machine can make these runs. The
// test run compares website/recorded/ with a fresh run.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { normalise } from "./generate.ts";

const ROOT = join(import.meta.dir, "..");
export const RECORDED = join(import.meta.dir, "recorded");
const EXAMPLE = join(ROOT, "examples/coral-reefs");
// Not part of the project: caches, builds, and any report written from the example.
const OUTSIDE = new Set([".stemma", "build", "report"]);

export async function recordExample(): Promise<Map<string, string>> {
  const work = mkdtempSync(join(tmpdir(), "stemma-example-"));
  try {
    const cli = await bundle(join(work, "plugin/dist"));
    const run = (args: string[]) => {
      const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args], { cwd: join(work, "plugin") });
      if (done.exitCode > 1) throw new Error(`${args.join(" ")}: ${done.stderr.toString()}`);
      return { code: done.exitCode, out: done.stdout.toString() };
    };
    const copy = (name: string) => {
      const project = join(work, name);
      cpSync(EXAMPLE, project, { recursive: true, filter: (path) => !OUTSIDE.has(relative(EXAMPLE, path)) });
      return project;
    };
    const check = (project: string, name: string) => {
      const done = run(["check", "--all", "--project", project]);
      const places: [string, string][] = [[realpathSync(project), `$PROJECTS/${name}`], [project, `$PROJECTS/${name}`]];
      return normalise(`$ stemma check --all --project $PROJECTS/${name}\n${done.out}[exit ${done.code}]\n`, places);
    };

    const files = new Map<string, string>();
    files.set("example-check.txt", check(copy("coral-reefs"), "coral-reefs"));

    // Deliberate mistakes, made in a throwaway copy. None of this is committed to the example.
    const trial = copy("coral-reefs-trial");
    const edit = (id: string, change: (record: any) => void) => {
      const path = join(trial, "records/citations", `${id}.json`);
      const record = JSON.parse(readFileSync(path, "utf8"));
      change(record);
      writeFileSync(path, JSON.stringify(record));
    };
    // Each is made a citation an author typed: without its link to the captured passage.
    edit("cit-darwinreefs0002", (r) => { delete r.passage; r.quotation = r.quotation.replace("greater", "smaller"); });
    edit("cit-darwinreefs0001", (r) => { delete r.passage; r.locator.value = "412"; });
    run(["fmt", "--project", trial]);
    files.set("example-trial.txt", check(trial, "coral-reefs-trial"));
    return files;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const files = await recordExample();
  mkdirSync(RECORDED, { recursive: true });
  for (const [path, text] of files) writeFileSync(join(RECORDED, path), text);
  console.log(`wrote ${files.size} files to website/recorded/`);
}
