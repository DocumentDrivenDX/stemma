// The worked example's records drawn as a stemma: the source record at the head,
// the stored copy and its text on one branch, and each citation on its own. A
// nested list with CSS lines, so the drawing and its text are the same thing.
// Everything in it is read from the record files.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { escape } from "./html.ts";

const RECORDS = join(import.meta.dir, "../../examples/coral-reefs/records");
const load = (kind: string) =>
  readdirSync(join(RECORDS, kind)).filter((f) => f.endsWith(".json")).sort()
    .map((f) => JSON.parse(readFileSync(join(RECORDS, kind, f), "utf8")));
function only(kind: string) {
  const all = load(kind);
  if (all.length !== 1) throw new Error(`the drawing expects one record in ${kind}, found ${all.length}`);
  return all[0]!;
}

const id = (value: string) => `<p class="record"><code>${escape(value)}</code></p>`;

/** `onExample` drops the link when the drawing is on the worked example's own page. */
export function descent(onExample = false): string {
  const source = only("sources");
  const capture = only("captures");
  const extraction = only("extractions");
  if (extraction.capture !== capture.id || capture.source !== source.id) throw new Error("the example's records no longer form one line of descent");
  if (extraction.quality.method !== "ocr" || extraction.quality.level !== "unassessed") throw new Error("the example's text is no longer unassessed character recognition; reword the drawing");
  const citations = load("citations").sort((a, b) => Number(a.locator.value) - Number(b.locator.value));
  if (citations.some((c) => c.key !== source.citation_key)) throw new Error("a citation in the example names another source");
  const author = source.contributions[0].as_printed;
  const title = String(source.title.value).split(". ")[0]!;
  return `<figure class="descent">
<div class="descent-head"><p class="descent-title"><cite>${escape(title)}</cite></p>
<p>${escape(`${author.given} ${author.family}, ${source.issued.edtf}`)}. The source record.</p>${id(source.id)}</div>
<ul class="descent-tree" aria-label="What descends from the source record">
<li><div class="held"><p class="descent-kind">Stored copy</p><p>A PDF, kept privately</p>${id(capture.id)}</div>
<ul><li><p class="descent-kind">Its text</p><p>Unverified character recognition</p>${id(extraction.id)}</li></ul></li>
${citations.map((c) => `<li><p class="descent-kind">${escape(`Cited at ${c.locator.label} ${c.locator.value}`)}</p><blockquote><p>${escape(c.quotation)}</p></blockquote>${id(c.id)}</li>`).join("\n")}
</ul>
<figcaption>This site's drawing of the record files in ${onExample ? "this example" : 'the <a href="darwin.html">worked example</a>'}; it is not a Stemma screen. An AI model compared the quotations with images of the pages; no person has confirmed them.</figcaption>
</figure>`;
}
