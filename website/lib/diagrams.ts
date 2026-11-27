// The site's explanatory drawings. Each is HTML with CSS lines, so the words in
// the drawing are its text equivalent. Counts and page ranges are read from real
// runs and the example's files, never typed here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { darwinBook, labelRuns } from "./example.ts";
import { escape } from "./html.ts";

const ROOT = join(import.meta.dir, "../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

type Who = "You" | "Claude" | "Scripts";
const CYCLE: { name: string; who: Who[]; does: string }[] = [
  { name: "Gather", who: ["You", "Claude"], does: "Choose a work. Claude writes down what it is and where each detail came from." },
  { name: "Capture and read", who: ["Claude", "Scripts"], does: "Your copy becomes text files in your project, page by page. Page numbers are proposed for review." },
  { name: "Write and cite", who: ["You", "Claude"], does: "Research and write. Each citation is recorded with its sentence, page and any quotation." },
  { name: "Check", who: ["Scripts"], does: "The records are compared with your sources. Every finding comes with its evidence and a suggestion." },
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
  const from = demo.indexOf("=============== 3.");
  const to = demo.indexOf("=============== 6.");
  if (from < 0 || to < 0) throw new Error("the demo's steps changed; redraw its rounds");
  // A run that checked clean prints no counts: both are none.
  const counts = [...demo.slice(from, to).matchAll(/^(?:OPEN FINDINGS: (\d+) problem\(s\), (\d+) could not be checked|CHECKED CLEAN)/gm)]
    .map((found) => ({ problems: Number(found[1] ?? 0), unchecked: Number(found[2] ?? 0) }));
  const ROUNDS: [string, string][] = [
    ["First check", "A mistyped citation key, a listed work that is never cited, a file out of its standard layout, and a cited book that is not in the project."],
    ["After three fixes", "The key is corrected, the extra listing removed and the file tidied. There is still no text of the cited book to compare with."],
    ["Its text is added", "Text for a scan of the book is supplied. Nothing is open. The report says what it could not cover: nothing shows the title page, and the invented book is in no catalogue."],
  ];
  if (counts.length !== ROUNDS.length) throw new Error(`the demo now checks that project ${counts.length} times; redraw its rounds`);
  return `<figure class="rounds">
<ol aria-label="Three checks of the demo project, in order">${ROUNDS.map(([title, what], i) => `<li><h3>${title}</h3><dl><div><dt>Problems</dt><dd>${counts[i]!.problems}</dd></div><div><dt>Could not check</dt><dd>${counts[i]!.unchecked}</dd></div></dl><p>${what}</p></li>`).join("")}</ol>
<figcaption>This site's drawing of three runs in the <a href="examples.html#demo">demo</a>, with the counts each run printed. All names and sources in the demo are invented.</figcaption>
</figure>`;
}

/** Where a project's material is kept, and what reaches the AI model. */
export function places(): string {
  return `<figure class="places">
<ul aria-label="Where things are kept">
<li><h3>Your project folder</h3><p>Plain files you can open, compare and back up like any others.</p><ul><li>The text of your sources, with its pages</li><li>A record for each source, passage and citation</li><li>Your standing rules, in <code>rules.md</code></li></ul><p>Anyone who can read the folder can read your sources, so publishing it publishes them.</p></li>
<li><h3>Your original files</h3><p>PDFs, page images and the like stay out of the project's published files.</p><ul><li>The project notes where each came from and its digital fingerprint</li><li>Keep them to convert and compare again</li></ul></li>
<li><h3>The AI model</h3><p>Claude is instructed to read only the pages a task needs.</p><ul><li>Stemma holds back no source: anything in a project may be sent</li><li>If something may not go to a hosted model, leave it out of the project</li></ul></li>
</ul>
</figure>`;
}

/** Which pages of the Darwin PDF carry the book's printed numbers. */
export function pageMap(): string {
  const { pages } = darwinBook();
  const runs = labelRuns(pages);
  const parts = runs.map((run, i) => ({
    pages: run.to - run.from + 1, from: run.from, to: run.to, mapped: run.first !== undefined,
    label: run.first !== undefined ? `Printed pages ${run.first} to ${run.last}`
      : i === runs.length - 1 ? "No page label, including a publisher's list that has its own numbers" : "No page label",
  }));
  if (parts.length !== 3 || !parts[1]!.mapped) throw new Error("the example's page labels no longer form one run; redraw them");
  return `<figure class="pagemap">
<ol aria-label="Pages of the PDF, in order">${parts.map((p) => `<li${p.mapped ? ' class="mapped"' : ""} style="flex-grow: ${p.pages}"><p><strong>${escape(p.label)}</strong></p><p>PDF pages ${p.from} to ${p.to}, counting from 0 (${p.pages} pages)</p></li>`).join("")}</ol>
<figcaption>This site's drawing of the page labels in the book's source files, which cover a PDF of ${pages.length} pages. Widths are roughly in proportion.</figcaption>
</figure>`;
}
