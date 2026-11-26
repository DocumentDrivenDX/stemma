// A short, real run of the built plugin in a fresh temporary directory, using
// the documented invocation. Run it with ./scripts/dev.sh demo.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const plugin = join(root, "dist/release");
const base = mkdtempSync(join(tmpdir(), "stemma-demo-"));
const book = join(base, "book");
const FLAGS = ["--no-install", "--no-env-file", "--config=/dev/null"];

function stemma(expected: number, project: string, ...args: string[]): string {
  console.log(`\n$ stemma ${args.join(" ").replaceAll(base, "$DEMO")} --project ${project.replace(base, "$DEMO")}`);
  // The working directory is the plugin root, and every path is absolute (CONTRACT-002 A).
  const run = Bun.spawnSync([process.execPath, ...FLAGS, join(plugin, "dist/stemma.js"), ...args, "--project", project], { cwd: plugin });
  const out = run.stdout.toString();
  process.stdout.write(out + run.stderr.toString());
  console.log(`[exit ${run.exitCode}]`);
  if (run.exitCode !== expected) {
    console.error(`demo: expected exit ${expected}, got ${run.exitCode}`);
    process.exit(1);
  }
  return out;
}

function expect(condition: boolean, what: string): void {
  if (condition) return;
  console.error(`demo: ${what}`);
  process.exit(1);
}

function add(kind: string, name: string, record: object): string {
  const input = join(base, `${name}.json`);
  writeFileSync(input, JSON.stringify(record));
  const out = stemma(0, book, "record", "add", kind, "--input", input, "--actor", "person:demo-author");
  return /^Added (\S+)/.exec(out)![1]!;
}

const heading = (text: string) => console.log(`\n=============== ${text}`);

console.log(`Stemma demo. All names and sources are invented.
DEMO=${base}
"stemma" below means: cd <plugin root> && bun ${FLAGS.join(" ")} <plugin root>/dist/stemma.js
Plugin root: ${plugin}`);

heading("1. Create a project and record two sources");
stemma(0, book, "init");
const harbour = add("source", "harbour", { citation_key: "hartwell1998", type: "book", title: { value: "Harbour tolls of an invented town" }, issued: { edtf: "1998" } });
const orphan = add("source", "orphan", { citation_key: "orphan1990", type: "book", title: { value: "An invented work nobody cites" }, issued: { edtf: "1990" } });

heading("2. Add two citations: one with a mistyped key");
add("citation", "cite-1", { key: "hartwell1998", sentence: { text: "The invented town charged a toll at its harbour." } });
const typo = add("citation", "cite-2", { key: "hartwel1998", sentence: { text: "The toll was doubled in the following century." } });
console.log("\nBy hand: list both sources for the bibliography in stemma.json (orphan1990 is never cited).");
const settingsPath = join(book, "stemma.json");
const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
writeFileSync(settingsPath, JSON.stringify({ ...settings, bibliography_include: [harbour, orphan] }));

heading("3. Check: the seeded errors are reported and explained");
const first = stemma(1, book, "check");
for (const needed of ["[cite.key]", "hartwel1998", "[bib.uncited]", "orphan1990", "canonical form"]) {
  expect(first.includes(needed), `the first report should mention ${needed}`);
}

heading("4. Fix them: correct the key, drop the uncited listing, reformat");
const typoPath = join(book, "records/citations", `${typo}.json`);
writeFileSync(typoPath, readFileSync(typoPath, "utf8").replace('"hartwel1998"', '"hartwell1998"'));
writeFileSync(settingsPath, JSON.stringify({ ...settings, bibliography_include: [harbour] }));
stemma(0, book, "fmt");
const second = stemma(1, book, "check");
expect(second.includes("OPEN FINDINGS: 0 problem(s), 0 could not be checked"), "the fixed project should have no problem left");
console.log(`
The seeded errors are gone. The project is still NOT called checked clean, on purpose:
it cites a source, and this version cannot yet check some things about cited sources
(listed under NOT CHECKED). Those count as open.`);

heading("5. What checked clean looks like today: sources recorded, nothing cited yet");
const shelf = join(base, "reading-list");
stemma(0, shelf, "init");
const input = join(base, "harbour.json");
stemma(0, shelf, "record", "add", "source", "--input", input, "--actor", "person:demo-author");
const clean = stemma(0, shelf, "check");
expect(clean.startsWith("CHECKED CLEAN"), "the second project should be checked clean");
console.log(`
Note: this label says nothing about citations, because this project has none.

Demo finished as expected. The files are in ${base}`);
