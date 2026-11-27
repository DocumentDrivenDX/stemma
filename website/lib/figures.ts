// A generated diagram written into a page: the committed SVG, so the site's
// tokens color it, and the text equivalent made from the same definition. Reads
// website/generated/diagrams/; it draws nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Diagram, files } from "./graphs.ts";
import { escape } from "./html.ts";

const DIAGRAMS = join(import.meta.dir, "../generated/diagrams");
/** A drawing that scrolls keeps at least this share of its size, so that its text stays legible. */
const SMALLEST_SCALE = 0.8;

/** One committed drawing, sized to shrink, after checking that it shows every box of its definition. */
function svg(d: Diagram, file: string, scrolls: boolean): string {
  const text = readFileSync(join(DIAGRAMS, file), "utf8");
  for (const node of d.nodes) {
    // The renderer writes an apostrophe as a named entity.
    if (!text.includes(`>${escape(node.label).replaceAll("'", "&apos;")}</text>`)) {
      throw new Error(`${file} does not show “${node.label}”. Run ./scripts/dev.sh docs`);
    }
  }
  const width = Number(/<svg [^>]*\bwidth="([0-9.]+)"/.exec(text)?.[1]);
  if (!(width > 0)) throw new Error(`${file} has no width`);
  const size = scrolls ? `max-width:${width}px;min-width:${Math.ceil(width * SMALLEST_SCALE)}px` : `max-width:${width}px`;
  return text.trim().replace("<svg ", `<svg style="${size}" `);
}

/** The drawing alone: a wide and a one-column layout, or one in a region that scrolls on narrow screens. */
export function drawing(d: Diagram): string {
  const [wide, narrow] = files(d);
  if (narrow) return `<div class="drawing drawing-wide">${svg(d, wide!, false)}</div>\n<div class="drawing drawing-narrow">${svg(d, narrow, false)}</div>`;
  return `<div class="drawing drawing-scroll" tabindex="0" role="region" aria-label="${escape(`Drawing: ${d.title}. It scrolls sideways on a narrow screen.`)}">${svg(d, wide!, true)}</div>`;
}

/** The text equivalent: the same items, links and relation words, always in view. `note` shows more beside an entry. */
export function equivalent(d: Diagram, note: (check: string) => string = (check) => `<code>${escape(check)}</code>`): string {
  const tag = d.text.ordered ? "ol" : "ul";
  return `<div class="equivalent equivalent-${d.name}"><${tag} aria-label="${escape(d.text.label)}">${d.text.entries.map((e) =>
    `<li><p class="equivalent-term">${escape(e.term)}</p><p>${escape(e.says)}</p>${e.checks ? `<p class="equivalent-checks">${e.checks.map(note).join(" ")}</p>` : ""}</li>`).join("")}</${tag}></div>`;
}

/** What the two line styles mean, for a drawing that has both. */
const LEGEND = `<p class="legend"><span><i class="line-solid" aria-hidden="true"></i>Solid line, arrowhead: leads to, supports or qualifies</span> <span><i class="line-opposing" aria-hidden="true"></i>Dashed line, bar end: opposes, as a note that contradicts does</span></p>`;

const legend = (d: Diagram) => (d.edges.some((e) => e.opposing) ? LEGEND : "");

/** A drawing in a numbered plate. `caption` is trusted HTML and says what the drawing was made from. */
export function figure(d: Diagram, caption: string, classes = ""): string {
  const scrolls = files(d).length === 1;
  const kind = scrolls ? " scrolls" : "";
  const hint = scrolls ? `<p class="scroll-hint">Scroll the drawing sideways to see all of it. The list holds the same.</p>\n` : "";
  return `<figure class="plate diagram diagram-${d.name}${kind}${classes ? ` ${classes}` : ""}">\n${hint}${drawing(d)}\n<figcaption>${caption}</figcaption>${legend(d)}\n</figure>`;
}

/** A plate and its text, together. */
export const diagram = (d: Diagram, caption: string): string => `${figure(d, caption)}\n${equivalent(d)}`;
