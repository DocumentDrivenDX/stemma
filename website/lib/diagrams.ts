// The site's explanatory drawings. Each is HTML with CSS lines, so the words in
// the drawing are its text equivalent. Counts and page ranges are read from real
// runs and record files, never typed here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { escape } from "./html.ts";

const ROOT = join(import.meta.dir, "../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

type Who = "You" | "Claude" | "Scripts";
const CYCLE: { name: string; who: Who[]; does: string }[] = [
  { name: "Gather", who: ["You", "Claude"], does: "Choose a work. Claude writes down what it is and where each detail came from." },
  { name: "Keep and read", who: ["Claude", "Scripts"], does: "Your copy goes into a private store. Its text is read page by page, and page numbers are proposed for review." },
  { name: "Write and cite", who: ["You", "Claude"], does: "Research and write. Each citation is recorded with its sentence, page and any quotation." },
  { name: "Check", who: ["Scripts"], does: "The records are compared with your copies. Every finding comes with its evidence and a suggestion." },
  { name: "Decide", who: ["You"], does: "Look at the page, then fix, replace or leave it. Nothing waits for you." },
];

/** The research cycle: five steps in order, and the way back to the start. */
export function cycle(): string {
  return `<figure class="cycle">
<ol aria-label="The research cycle">${CYCLE.map((s) => `<li><h3>${s.name}</h3><p class="who">${s.who.map((w, i) => (i > 0 && w === "Scripts" ? "scripts" : w)).join(" and ")}</p><p>${s.does}</p></li>`).join("")}</ol>
<p class="cycle-return">Then go round again: a new source, a better scan, a corrected sentence. Check as often as you like.</p>
</figure>`;
}

/** The demo's successive checks of one project, with the counts each run printed. */
export function rounds(): string {
  const demo = read("website/generated/transcripts/demo.txt");
  const step = (n: number) => {
    const start = demo.indexOf(`=============== ${n}.`);
    const found = /OPEN FINDINGS: (\d+) problem\(s\), (\d+) could not be checked, (\d+) kind/.exec(demo.slice(start));
    if (start < 0 || !found) throw new Error(`demo step ${n} no longer reports its counts`);
    return { problems: Number(found[1]), unchecked: Number(found[2]), notRun: Number(found[3]) };
  };
  const ROUNDS: [number, string, string][] = [
    [3, "First check", "A mistyped citation key, a listed work that is never cited, a file out of its standard layout, and a cited book with no copy."],
    [4, "After three fixes", "The key is corrected, the extra listing removed and the file tidied. Both citations of the book still have no copy to compare with."],
    [5, "A scan is added", "The copy is stored, but a picture of a page holds no text to compare."],
    [6, "Its text is added", "Nothing is left open among the checks that ran. Some kinds of check do not run, so the project is still not called checked clean."],
    [7, "The store goes missing", "On a machine without the copies, nothing passes by default. The report says it could not check."],
  ];
  return `<figure class="rounds">
<ol aria-label="Five checks of the demo project, in order">${ROUNDS.map(([n, title, what]) => {
    const r = step(n);
    return `<li><h3>${title}</h3><dl><div><dt>Problems</dt><dd>${r.problems}</dd></div><div><dt>Could not check</dt><dd>${r.unchecked}</dd></div><div><dt>Kinds not run</dt><dd>${r.notRun}</dd></div></dl><p>${what}</p></li>`;
  }).join("")}</ol>
<figcaption>This site's drawing of five runs in the <a href="examples.html#demo">demo</a>, with the counts each run printed. All names and sources in the demo are invented.</figcaption>
</figure>`;
}

/** Where a project's material is kept, and what reaches the AI model. */
export function places(): string {
  return `<figure class="places">
<ul aria-label="Where things are kept">
<li><h3>Your project folder</h3><p>Plain files you can open, compare and back up like any others.</p><ul><li>A record for each source, copy, text and citation</li><li>Your standing rules, in <code>rules.md</code></li><li>The project's settings, in <code>stemma.json</code></li></ul></li>
<li><h3>Your private store</h3><p>Kept outside the project. Stemma never copies it anywhere, so backing it up is your job.</p><ul><li>Your copies of sources</li><li>The text read from them</li></ul></li>
<li><h3>The AI model</h3><p>Claude is instructed to read only the pages a task needs.</p><ul><li>Stemma holds back no source: anything in a project may be sent</li><li>If something may not go to a hosted model, leave it out of the project</li></ul></li>
</ul>
</figure>`;
}

/** How the pages of the stored Darwin PDF map to the book's printed numbers. */
export function pageMap(): string {
  const runs: { first_index: number; last_index: number; first_label: string }[] = JSON.parse(read("examples/coral-reefs/page-map.json"));
  const extraction = JSON.parse(read("examples/coral-reefs/records/extractions/ext-kb8hzwcvz40x3yyaxnkt.json"));
  const total: number = extraction.page_spans.length;
  if (runs.length !== 1) throw new Error("the example's page map no longer has one run; redraw it");
  const run = runs[0]!;
  const lastLabel = Number(run.first_label) + run.last_index - run.first_index;
  const parts = [
    { pages: run.first_index, from: 0, to: run.first_index - 1, label: "No printed number given", mapped: false },
    { pages: run.last_index - run.first_index + 1, from: run.first_index, to: run.last_index, label: `Printed pages ${run.first_label} to ${lastLabel}`, mapped: true },
    { pages: total - run.last_index - 1, from: run.last_index + 1, to: total - 1, label: "No printed number given, including a publisher's list that has its own numbers", mapped: false },
  ];
  return `<figure class="pagemap">
<ol aria-label="Pages of the stored PDF, in order">${parts.map((p) => `<li${p.mapped ? ' class="mapped"' : ""} style="flex-grow: ${p.pages}"><p><strong>${escape(p.label)}</strong></p><p>PDF pages ${p.from} to ${p.to}, counting from 0 (${p.pages} pages)</p></li>`).join("")}</ol>
<figcaption>This site's drawing of the example's page map, which covers a PDF of ${total} pages. Widths are roughly in proportion.</figcaption>
</figure>`;
}
