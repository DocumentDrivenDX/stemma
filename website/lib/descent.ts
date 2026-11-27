// The worked example's records drawn as a stemma: the source record at the head,
// the original and its source files on one branch, and each citation on its own.
// A nested list with CSS lines, so the drawing and its text are the same thing.
// Everything in it is read from the example's files.
import { darwinBook } from "./example.ts";
import { escape } from "./html.ts";

const id = (value: string) => `<p class="record"><code>${escape(value)}</code></p>`;

/** `onExample` drops the link when the drawing is on the worked example's own page. */
export function descent(onExample = false): string {
  const { source, upstream, manifest, pages, citations } = darwinBook();
  if (manifest.conversion.method !== "ocr" || manifest.conversion.level !== "unassessed") throw new Error("the example's text is no longer unassessed character recognition; reword the drawing");
  const author = source.contributions[0].as_printed;
  const title = String(source.title.value).split(". ")[0]!;
  return `<figure class="descent plate">
<div class="descent-head"><p class="descent-title"><cite>${escape(title)}</cite></p>
<p>${escape(`${author.given} ${author.family}, ${source.issued.edtf}`)}. The source record.</p>${id(source.id)}</div>
<ul class="descent-tree" aria-label="What descends from the source record">
<li><div class="held"><p class="descent-kind">The original</p><p>A PDF, known by its fingerprint and not published here</p>${id(upstream.id)}</div>
<ul><li><p class="descent-kind">Its source files</p><p>${pages.length} pages of unverified character recognition</p>${id(manifest.id)}</li></ul></li>
${citations.map((c) => `<li><p class="descent-kind">${escape(`Cited at ${c.locator.label} ${c.locator.value}`)}</p><blockquote><p>${escape(c.quotation)}</p></blockquote>${id(c.id)}</li>`).join("\n")}
</ul>
<figcaption>This site's drawing of the files in ${onExample ? "this example" : 'the <a href="darwin.html">Darwin worked example</a>'}; it is not a Stemma screen. A script copied the quotations from passages an AI model chose, and the model compared them with images of the pages; no person has confirmed them.</figcaption>
</figure>`;
}
