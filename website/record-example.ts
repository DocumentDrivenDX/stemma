// Records the worked examples' runs that the site shows, into website/recorded/.
//   ./scripts/dev.sh record-example
// Darwin: the check of the example as committed, and of a throwaway copy with two
// planted mistakes. The example holds its source files, so every machine can make
// these runs.
// PostgreSQL: the same two runs on a copy holding only what is committed, which
// leaves out the text of some works whatever this tree holds (lib/held.ts), so
// that every machine can make them too. A third run, with that text, is made
// only where the tree holds it; elsewhere its file is left as it is.
// The test run compares website/recorded/ with fresh runs.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { normalise } from "./generate.ts";
import { copyExample, textMissingHere } from "./lib/held.ts";

const ROOT = join(import.meta.dir, "..");
export const RECORDED = join(import.meta.dir, "recorded");
const EXAMPLE = join(ROOT, "examples/coral-reefs");
const POSTGRES = join(ROOT, "examples/postgres-web-apps");
/** The PostgreSQL run that only a tree holding all the text can make. */
export const WITH_ALL_TEXT = "postgres-check-full.txt";
// Not part of the project: caches, builds, and any report written from the example.
const OUTSIDE = new Set([".stemma", "build", "report"]);

/** A deliberate mistake in a citation record of a throwaway copy. */
function plant(project: string, id: string, change: (record: any) => void) {
  const path = join(project, "records/citations", `${id}.json`);
  const record = JSON.parse(readFileSync(path, "utf8"));
  // It is made a citation an author typed: without its link to the captured passage.
  delete record.passage;
  change(record);
  writeFileSync(path, JSON.stringify(record));
}

/** Replaces words that must be there, so that a changed record cannot make a mistake that plants nothing. */
function replaced(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`the quotation no longer holds “${from}”`);
  return text.replace(from, to);
}

export async function recordExample(): Promise<Map<string, string>> {
  const work = mkdtempSync(join(tmpdir(), "stemma-example-"));
  try {
    const cli = await bundle(join(work, "plugin/dist"));
    const run = (args: string[]) => {
      const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args], { cwd: join(work, "plugin") });
      if (done.exitCode > 1) throw new Error(`${args.join(" ")}: ${done.stderr.toString()}`);
      return { code: done.exitCode, out: done.stdout.toString() };
    };
    const check = (project: string, name: string) => {
      const done = run(["check", "--all", "--project", project]);
      const places: [string, string][] = [[realpathSync(project), `$PROJECTS/${name}`], [project, `$PROJECTS/${name}`]];
      return normalise(`$ stemma check --all --project $PROJECTS/${name}\n${done.out}[exit ${done.code}]\n`, places);
    };
    const files = new Map<string, string>();

    const darwin = (name: string) => {
      const project = join(work, name);
      cpSync(EXAMPLE, project, { recursive: true, filter: (path) => !OUTSIDE.has(relative(EXAMPLE, path)) });
      return project;
    };
    files.set("example-check.txt", check(darwin("coral-reefs"), "coral-reefs"));

    // Deliberate mistakes, made in a throwaway copy. None of this is committed to the example.
    const trial = darwin("coral-reefs-trial");
    plant(trial, "cit-darwinreefs0002", (r) => { r.quotation = replaced(r.quotation, "greater", "smaller"); });
    plant(trial, "cit-darwinreefs0001", (r) => { r.locator.value = "412"; });
    run(["fmt", "--project", trial]);
    files.set("example-trial.txt", check(trial, "coral-reefs-trial"));

    const postgres = (folder: string, name: string, withText = false) => {
      const project = join(work, folder, name);
      copyExample(POSTGRES, project, { withText });
      return project;
    };
    files.set("postgres-check.txt", check(postgres("held", "postgres-web-apps"), "postgres-web-apps"));

    // Both citations are of documentation pages whose text is committed.
    const changed = postgres("held", "postgres-web-apps-trial");
    plant(changed, "cit-hfmzynsaf9666zt1attb", (r) => { r.quotation = replaced(r.quotation, "does not immediately remove", "does immediately remove"); });
    plant(changed, "cit-cs670qx1rx2s7se8ydx7", (r) => { r.locator.value = "32"; });
    run(["fmt", "--project", changed]);
    files.set("postgres-trial.txt", check(changed, "postgres-web-apps-trial"));

    if (textMissingHere(POSTGRES).length === 0) {
      files.set(WITH_ALL_TEXT, check(postgres("all-text", "postgres-web-apps", true), "postgres-web-apps"));
    }
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
  if (!files.has(WITH_ALL_TEXT)) {
    console.log(`NOT RECORDED: website/recorded/${WITH_ALL_TEXT} was left as it was. This tree does not hold the text of: ${textMissingHere(POSTGRES).join(", ")}. examples/postgres-web-apps/README.md says how to fetch it.`);
  }
}
