// Records the worked example's runs that need the private copy of Darwin's book,
// so they cannot be part of website/generated/, which every machine must be able
// to rebuild. Run it where the content store is:
//   ./scripts/dev.sh record-example <content store directory>
// The test run compares website/recorded/ with a fresh run wherever the store is
// at examples/.sources/store, and skips that comparison elsewhere.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { normalise } from "./generate.ts";

const ROOT = join(import.meta.dir, "..");
export const RECORDED = join(import.meta.dir, "recorded");

export async function recordExample(store: string): Promise<Map<string, string>> {
  const work = mkdtempSync(join(tmpdir(), "stemma-example-"));
  try {
    const cli = await bundle(join(work, "plugin/dist"));
    const run = (args: string[]) => {
      const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args, "--store-dir", store], { cwd: join(work, "plugin") });
      if (done.exitCode > 1) throw new Error(`${args.join(" ")}: ${done.stderr.toString()}`);
      return { code: done.exitCode, out: done.stdout.toString() };
    };
    const copy = (name: string) => {
      const project = join(work, name);
      cpSync(join(ROOT, "examples/coral-reefs"), project, { recursive: true, filter: (path) => !path.endsWith(".stemma") });
      return project;
    };
    const check = (project: string, name: string) => {
      const done = run(["check", "--all", "--project", project]);
      const places: [string, string][] = [[realpathSync(project), `$PROJECTS/${name}`], [project, `$PROJECTS/${name}`],
        [realpathSync(store), "$STORE"], [store, "$STORE"]];
      return normalise(`$ stemma check --all --project $PROJECTS/${name} --store-dir $STORE\n${done.out}[exit ${done.code}]\n`, places);
    };

    const files = new Map<string, string>();
    files.set("example-with-copy.txt", check(copy("coral-reefs"), "coral-reefs"));

    // Deliberate mistakes, made in a throwaway copy. None of this is committed to the example.
    const trial = copy("coral-reefs-trial");
    const edit = (id: string, change: (record: any) => void) => {
      const path = join(trial, "records/citations", `${id}.json`);
      const record = JSON.parse(readFileSync(path, "utf8"));
      change(record);
      writeFileSync(path, JSON.stringify(record));
    };
    edit("cit-darwinreefs0002", (r) => { r.quotation = r.quotation.replace("greater", "smaller"); });
    edit("cit-darwinreefs0001", (r) => { r.locator.value = "412"; });
    run(["fmt", "--project", trial]);
    files.set("example-trial.txt", check(trial, "coral-reefs-trial"));
    return files;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const store = process.argv[2];
  if (!store) throw new Error("usage: record-example <content store directory>");
  const files = await recordExample(resolve(store));
  mkdirSync(RECORDED, { recursive: true });
  for (const [path, text] of files) writeFileSync(join(RECORDED, path), text);
  console.log(`wrote ${files.size} files to website/recorded/`);
}
