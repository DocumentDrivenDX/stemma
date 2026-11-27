// A tool of this example project, not of Stemma. It brings back the converted text
// that the project holds but does not commit (see .gitignore and README.md).
//
// For each source whose text folder is absent, it runs `stemma ingest --fetch` in
// a throwaway project, from the address in plan.json, so that fetching and
// conversion are Stemma's own. The new files are copied here only if every part
// has the digest the committed manifest records. Anything else is reported, and
// nothing is copied for that source.
//
//   bun examples/postgres-web-apps/tools/restore-text.ts <path to stemma.js>
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const project = resolve(import.meta.dir, "..");
const stemma = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!stemma) throw new Error("Give the path of the built stemma.js.");

const run = (...args: string[]) => spawnSync(process.execPath, ["--no-install", "--no-env-file", "--config=/dev/null", stemma, ...args], { encoding: "utf8" });
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
/** A source.md manifest: JSON between two lines of three hyphens, or JSON alone. */
const manifest = (path: string) => json_(readFileSync(path, "utf8"));
const json_ = (text: string) => JSON.parse(text.replace(/^---\n/, "").replace(/\n---\n?[\s\S]*$/, ""));
const digests = (m: { pages: { sha256: string }[] }) => m.pages.map((p) => p.sha256).join();

const records = join(project, "records", "sources");
const keys = new Map<string, { id: string; file: string }>();
for (const name of readdirSync(records)) {
  const record = json(join(records, name));
  keys.set(record.citation_key, { id: record.id, file: join(records, name) });
}
const plan = json(join(project, "plan.json")) as { captures: { source: string }[] };

let missing = 0;
for (const [key, { id, file }] of [...keys].sort()) {
  const directory = join(project, "sources", key);
  const held = manifest(join(directory, "source.md"));
  const folder = held.paged ? "pages" : "sections";
  if (existsSync(join(directory, folder))) continue;
  const entry = plan.captures.find((c) => c.source === id);
  const scratch = mkdtempSync(join(tmpdir(), "restore-text-"));
  try {
    const temporary = join(scratch, "project");
    run("init", "--project", temporary);
    cpSync(file, join(temporary, "records", "sources", `${id}.json`));
    writeFileSync(join(temporary, "plan.json"), JSON.stringify({ captures: [entry] }));
    const made = run("ingest", "--project", temporary, "--plan", "plan.json", "--fetch", "--actor", "software:restore-text");
    const fresh = join(temporary, "sources", key);
    if (!existsSync(join(fresh, "source.md"))) {
      missing++;
      console.log(`${key}: not restored. ${made.stdout.split("\n").filter((l) => l.startsWith(`  ${key}:`)).join(" ") || made.stderr.trim()}`);
    } else if (digests(manifest(join(fresh, "source.md"))) !== digests(held)) {
      missing++;
      console.log(`${key}: not restored. The address now converts to different text from the text the passages were copied from.`);
    } else {
      cpSync(join(fresh, folder), join(directory, folder), { recursive: true });
      console.log(`${key}: restored. Every part has the recorded digest.`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
console.log(missing === 0 ? "No text is missing." : `${missing} source(s) still have no text.`);
process.exit(missing === 0 ? 0 : 1);
