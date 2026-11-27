// A short, real run of the built plugin in a fresh temporary directory, using
// the documented invocation. Run it with ./scripts/dev.sh demo.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const plugin = join(root, "dist/release");
const base = mkdtempSync(join(tmpdir(), "stemma-demo-"));
const book = join(base, "book");
const materials = join(base, "materials");
cpSync(join(root, "fixtures/materials"), materials, { recursive: true });
const FLAGS = ["--no-install", "--no-env-file", "--config=/dev/null"];
const AUTHOR = ["--actor", "person:demo-author"];
const WHEN = "2026-01-05T09:00:00Z";

function stemma(expected: number, project: string, ...args: string[]): string {
  console.log(`\n$ stemma ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ").replaceAll(base, "$DEMO")} --project ${project.replace(base, "$DEMO")}`);
  // The working directory is the plugin root, and every path is absolute (CONTRACT-002 A).
  const run = Bun.spawnSync([process.execPath, ...FLAGS, join(plugin, "dist/stemma.js"), ...args, "--project", project], { cwd: plugin });
  const out = run.stdout.toString();
  // In a terminal the PDF library's warnings come while a PDF is read, before the result is printed.
  process.stdout.write(run.stderr.toString() + out);
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

function add(project: string, kind: string, name: string, record: object): string {
  const input = join(base, `${name}.json`);
  writeFileSync(input, JSON.stringify(record));
  const out = stemma(0, project, "record", "add", kind, "--input", input, ...AUTHOR);
  return /^Added (\S+)/.exec(out)![1]!;
}

const heading = (text: string) => console.log(`\n=============== ${text}`);

console.log(`Stemma demo. All names and sources are invented. Nothing uses the network.
DEMO=${base}
"stemma" below is the command line inside the plugin. In use, Claude runs it for the author.`);

heading("1. Create a project and record two sources");
stemma(0, book, "init");
// Fixed IDs keep the transcript the same on every run (website/generate.ts).
const ledger = add(book, "source", "ledger", { id: "src-demo0ledger001", citation_key: "ledger1911", type: "book", title: { value: "An invented harbour ledger" }, issued: { edtf: "1911" } });
const orphan = add(book, "source", "orphan", { id: "src-demo0orphan001", citation_key: "orphan1990", type: "book", title: { value: "An invented work nobody cites" }, issued: { edtf: "1990" } });

heading("2. Add two citations: one with a mistyped key");
add(book, "citation", "cite-1", { id: "cit-demo0toll00001", key: "ledger1911", sentence: { text: "The invented town charged a toll at its harbour." } });
const typo = add(book, "citation", "cite-2", { id: "cit-demo0toll00002", key: "ledgr1911", sentence: { text: "The toll was doubled in the following century." } });
console.log("\nBy hand: list both sources for the bibliography in stemma.json (orphan1990 is never cited).");
const settingsPath = join(book, "stemma.json");
const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
writeFileSync(settingsPath, JSON.stringify({ ...settings, bibliography_include: [ledger, orphan] }));

heading("3. Check: the seeded errors are reported and explained");
const first = stemma(1, book, "check");
for (const needed of ["[cite.key]", "ledgr1911", "[bib.uncited]", "orphan1990", "canonical form", "[source.held]"]) {
  expect(first.includes(needed), `the first report should mention ${needed}`);
}

heading("4. Fix them: correct the key, drop the uncited listing, reformat");
const typoPath = join(book, "records/citations", `${typo}.json`);
writeFileSync(typoPath, readFileSync(typoPath, "utf8").replace('"ledgr1911"', '"ledger1911"'));
writeFileSync(settingsPath, JSON.stringify({ ...settings, bibliography_include: [ledger] }));
stemma(0, book, "fmt");
const fixed = stemma(1, book, "check");
expect(fixed.includes("[source.held, 2 places]") && !fixed.includes("[cite.key]") && !fixed.includes("[bib.uncited]"), "the three fixed problems should be gone");

heading("5. A scan alone is not text. Its recognized text enters as such, page by page, labelled as recognized");
const scan = join(materials, "ledger-scan.pdf");
const captureArgs = [...AUTHOR, "--acquired-at", WHEN, "--origin", "my own scan", "--source", ledger];
const refused = stemma(0, book, "source", "pages", scan);
expect(refused.includes("no page is labelled"), "a scan without text has no numbers to propose");
const captured = stemma(0, book, "source", "convert", scan, ...captureArgs, "--text-layer", join(materials, "ledger-text-layer.txt"),
  "--method", "ocr", "--tool", "invented-ocr", "--tool-version", "1.0", "--page-map", join(materials, "ledger-page-map.json"));
expect(captured.includes("pages with a printed label: 3 of 4"), "three pages should be labelled");
const heldReport = stemma(0, book, "check");
expect(heldReport.startsWith("CHECKED CLEAN"), "nothing should be left open");
expect(!heldReport.includes("NOT CHECKED"), "only checks that apply are run");
for (const needed of ["not corroborated", "not compared with a catalogue"]) {
  expect(heldReport.includes(needed), `the coverage summary should say ${needed}`);
}
console.log(`
The copy's text never shows the title, and this invented work is in no catalogue. Nothing contradicts the record,
so neither is a finding: the report says what was not covered. Recognized text is a coverage figure too.`);

heading("6. A born-digital PDF: one command captures it, converts it page by page, compares and checks");
// A second project, so that this part stands on its own.
const quoting = join(base, "quoting-book");
stemma(0, quoting, "init");
add(quoting, "source", "levy", { id: "src-demo0levybook1", citation_key: "levy1911", type: "book", title: { value: "An invented book of harbour levies" }, issued: { edtf: "1911" } });
const plan = join(base, "plan.json");
writeFileSync(plan, JSON.stringify({ captures: [{ source: "src-demo0levybook1", file: "materials/harbour-book.pdf", retrieved_at: WHEN }] }));
console.log("\nThe PDF library's warnings are shown as it prints them: the plugin ships no native drawing module, and reading text draws nothing.");
const ingested = stemma(0, quoting, "ingest", "--plan", plan, ...AUTHOR);
expect(/converted again; \d+ of \d+ parts agree/.test(ingested), "the fresh conversion should be compared");

heading("7. Evidence is selected by address; its words and page are copied by script");
const found = stemma(0, quoting, "passage", "find", "--source", "src-demo0levybook1", "paid in salt, and the agriculture");
const address = /^(txt-\S+)$/m.exec(found)![1]!;
const taken = stemma(0, quoting, "passage", "capture", "--address", address, ...AUTHOR);
const passage = /Captured (psg-\S+),/.exec(taken)![1]!;
add(quoting, "citation", "from-passage", { id: "cit-demo0quote0001", passage, sentence: { text: "The invented levy was paid in kind." } });

heading("8. Typed quotations and page numbers are checked against the same text");
const quote = (n: number, page: string, quotation: string, sentence: string) => add(quoting, "citation", `quote-${n}`, {
  id: `cit-demo0quote000${n}`, key: "levy1911", locator: { label: "page", value: page }, quotation, sentence: { text: sentence },
});
quote(2, "2", "All fields were abandoned by their holders.", "The invented book says: “All fields were abandoned by their holders.”");
quote(3, "41", "The last ship sailed in spring.", "“The last ship sailed in spring.”");
const quoted = stemma(1, quoting, "check");
for (const needed of ["[quote.present]", "Some fields were abandoned", "[locator.extent]", "[quote.page]", "agri-|culture"]) {
  expect(quoted.includes(needed), `the quotation report should mention ${needed}`);
}

heading("9. An excerpt: only the pages asked for, marked as quoted data");
const shown = stemma(0, quoting, "excerpt", "--source", "src-demo0levybook1", "--pages", "2");
expect(shown.includes("Some fields were abandoned") && !shown.includes("last ship"), "the excerpt should hold page 2 only");

heading("10. A clone has everything the checks read: the originals are not needed");
const clone = join(base, "clone");
cpSync(quoting, clone, { recursive: true });
rmSync(join(clone, ".stemma"), { recursive: true });
const cloned = stemma(1, clone, "check");
const body = (text: string) => text.split("\nThe whole project is checked")[0];
expect(body(cloned) === body(quoted), "the clone should give the same report");

heading("11. What checked clean looks like: sources recorded, nothing cited");
const shelf = join(base, "reading-list");
stemma(0, shelf, "init");
const input = join(base, "ledger.json");
stemma(0, shelf, "record", "add", "source", "--input", input, ...AUTHOR);
const clean = stemma(0, shelf, "check");
expect(clean.startsWith("CHECKED CLEAN"), "this project should be checked clean");
console.log(`
Note: this label says nothing about citations, because this project has none.

Demo finished as expected. The files are in ${base}`);
