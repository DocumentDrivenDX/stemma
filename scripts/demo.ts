// A short, real run of the built plugin in a fresh temporary directory, using
// the documented invocation. Run it with ./scripts/dev.sh demo.
import { cpSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const plugin = join(root, "dist/release");
const base = mkdtempSync(join(tmpdir(), "stemma-demo-"));
const book = join(base, "book");
// The private content store lies outside the project. The demo keeps it in its own directory.
const store = join(base, "store");
const materials = join(base, "materials");
cpSync(join(root, "fixtures/materials"), materials, { recursive: true });
const FLAGS = ["--no-install", "--no-env-file", "--config=/dev/null"];

function stemma(expected: number, project: string, ...args: string[]): string {
  console.log(`\n$ stemma ${args.join(" ").replaceAll(base, "$DEMO")} --project ${project.replace(base, "$DEMO")}`);
  // The working directory is the plugin root, and every path is absolute (CONTRACT-002 A).
  const run = Bun.spawnSync([process.execPath, ...FLAGS, join(plugin, "dist/stemma.js"), ...args, "--project", project], {
    cwd: plugin, env: { ...process.env, STEMMA_STORE_DIR: store },
  });
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
STEMMA_STORE_DIR is set to $DEMO/store, the private content store, outside the project.
"stemma" below means: cd <plugin root> && bun ${FLAGS.join(" ")} <plugin root>/dist/stemma.js
Plugin root: ${plugin}`);

heading("1. Create a project and record two sources");
stemma(0, book, "init");
// Fixed IDs keep the transcript the same on every run (website/generate.ts).
const harbour = add("source", "harbour", { id: "src-demo0harbour01", citation_key: "hartwell1998", type: "book", title: { value: "Harbour tolls of an invented town" }, issued: { edtf: "1998" } });
const orphan = add("source", "orphan", { id: "src-demo0orphan001", citation_key: "orphan1990", type: "book", title: { value: "An invented work nobody cites" }, issued: { edtf: "1990" } });

heading("2. Add two citations: one with a mistyped key");
add("citation", "cite-1", { id: "cit-demo0toll00001", key: "hartwell1998", sentence: { text: "The invented town charged a toll at its harbour." } });
const typo = add("citation", "cite-2", { id: "cit-demo0toll00002", key: "hartwel1998", sentence: { text: "The toll was doubled in the following century." } });
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
expect(second.includes("OPEN FINDINGS: 2 problem(s), 0 could not be checked"), "only the two unheld citations should be left");
expect(second.includes("[source.held, 2 places]"), "both citations of the unheld source should be reported");

heading("5. A paper-only book: add its scan. A scan alone is not yet checkable");
const addArgs = ["--actor", "person:demo-author", "--acquired-at", "2026-01-05T09:00:00Z"];
const added = stemma(0, book, "source", "add", join(materials, "ledger-scan.pdf"), "--source", harbour, "--origin", "my own scan", ...addArgs);
const capture = /recorded it as (cap-[0-9a-z]+)/.exec(added)![1]!;
const bare = stemma(1, book, "check");
expect(bare.includes("has a stored copy but no extracted text"), "a scan without text should not count as checkable");

heading("6. Attach the scan's text layer, page by page, with a page map that states its evidence");
const text = stemma(0, book, "source", "text", capture, "--actor", "person:demo-author", "--text-layer", join(materials, "ledger-text-layer.txt"),
  "--page-map", join(materials, "ledger-page-map.json"), "--method", "ocr");
expect(text.includes("without a printed label (file page indexes, from 0): 2"), "the unnumbered plate should stay unlabelled");
const heldReport = stemma(1, book, "check");
expect(heldReport.includes("OPEN FINDINGS: 0 problem(s), 0 could not be checked"), "the held citations should now pass");
console.log(`
No finding is left. The project is still NOT called checked clean, on purpose: it cites
a source, and this version cannot yet check some things about cited sources (listed
under NOT CHECKED). Those count as open.`);

heading("7. Without the store, nothing passes by default: could not check");
renameSync(store, `${store}-elsewhere`);
const lost = stemma(1, book, "check");
expect(lost.includes("COULD NOT CHECK") && lost.includes("Content store looked in"), "a missing store should be could-not-check");
stemma(1, book, "store", "verify");
renameSync(`${store}-elsewhere`, store);
stemma(0, book, "store", "verify");

heading("8. What checked clean looks like today: sources recorded, nothing cited yet");
const shelf = join(base, "reading-list");
stemma(0, shelf, "init");
const input = join(base, "harbour.json");
stemma(0, shelf, "record", "add", "source", "--input", input, "--actor", "person:demo-author");
const clean = stemma(0, shelf, "check");
expect(clean.startsWith("CHECKED CLEAN"), "the second project should be checked clean");
console.log(`
Note: this label says nothing about citations, because this project has none.

Demo finished as expected. The files are in ${base}`);
