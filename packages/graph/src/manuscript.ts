// `stemma.manuscript.json` (CONTRACT-005 L): the manuscript view `publish` makes,
// as the export writes it. `graph` does not read the report: it takes the view
// through a port, keeps it within its size limit and the export's source views,
// scans it, and says what in it is broken. It holds the report's text, so it is
// for the `author` audience only.
import { emptyManuscript, findCoordinates, type ManuscriptPart, type ManuscriptView, type SourceView } from "@stemma/core";
import { compareCodePoints, type Corpus } from "@stemma/records";
import { jsonText } from "./module.ts";
import type { Projection, Warning } from "./project.ts";

/** The most the manuscript view may take, in bytes as written. A design assumption. */
export const MANUSCRIPT_CAP = 8_000_000;

/** Makes the view, told which records the export holds. */
export type ManuscriptPort = (exported: (type: "Source" | "Passage", id: string) => boolean) => ManuscriptView;

export function manuscriptOf(corpus: Corpus, projection: Projection, port: ManuscriptPort | undefined): ManuscriptView {
  if (!corpus.report) return emptyManuscript("none");
  if (!port) return emptyManuscript("unavailable", "This export was made without the report builder.");
  const keys = new Set(projection.entities.map((e) => `${e.type} ${e.key}`));
  return port((type, id) => keys.has(`${type} ${id}`));
}

/** The passages the report's highlighted quotations point to, which the source views' cap takes last. */
export const quotedPassages = (view: ManuscriptView): Set<string> => new Set(Object.values(view.quotations)
  .filter((q) => q.view.state === "highlighted").flatMap((q) => q.view.passages.map((p) => p.passage)));

/** Everything in the view that a reader sees, by the place it is in. A coordinate cut by a link is still found. */
function proseOf(view: ManuscriptView): [string, string[]][] {
  const run = (parts: ManuscriptPart[]) => parts.map((p) => (p.kind === "text" ? p.text : p.kind === "quotation" ? `“${view.quotations[p.id]?.text ?? ""}”` : " ")).join("");
  return [
    ...view.blocks.flatMap((b, i): [string, string[]][] => (b.kind === "text" ? [[`paragraph ${i + 1}`, [run(b.parts)]]] : [])),
    ...view.notes.map((n): [string, string[]] => [`note ${n.number}`, [...n.citations.map((c) => c.text ?? ""), run(n.comment ?? [])]]),
    ...Object.entries(view.quotations).map(([id, q]): [string, string[]] => [`quotation ${id}`, [q.text ?? "", ...q.changes, q.view.why]]),
    ...view.bibliography.map((e, i): [string, string[]] => [`bibliography entry ${i + 1}`, [e.text ?? ""]]),
  ];
}

/** The places where something is broken or withheld. */
function incomplete(view: ManuscriptView): string[] {
  const held = (parts: ManuscriptPart[]) => parts.some((p) => p.kind === "withheld");
  return [
    ...Object.entries(view.quotations).filter(([, q]) => q.text === undefined).map(([id]) => `quotation ${id}`),
    ...view.blocks.flatMap((b, i) => (b.kind === "text" && held(b.parts) ? [`paragraph ${i + 1}`] : [])),
    ...view.notes.filter((n) => held(n.comment ?? []) || n.citations.some((c) => c.withheld !== undefined)).map((n) => `note ${n.number}`),
    ...view.bibliography.flatMap((e, i) => (e.withheld === undefined ? [] : [`bibliography entry ${i + 1}`])),
    ...view.problems,
  ];
}

export interface ManuscriptFile { text: string; view: ManuscriptView; warnings: Warning[] }

/**
 * The file as written. A quotation whose passage view the cap left out is
 * `not_exported`: it keeps its words, and nothing is highlighted for it.
 */
export function manuscriptFile(made: ManuscriptView, sources: Record<string, SourceView>, cap = MANUSCRIPT_CAP): ManuscriptFile {
  const view: ManuscriptView = {
    ...made,
    quotations: Object.fromEntries(Object.entries(made.quotations).map(([id, q]) => {
      if (q.view.state !== "highlighted" || q.view.passages.every((p) => sources[p.passage]?.state === "highlighted")) return [id, q];
      return [id, {
        ...q, view: {
          ...q.view, state: "not_exported" as const,
          why: "This export left a passage's source text out to stay within its size limit. Use `excerpt` to see it.",
        },
      }];
    })),
  };
  let text = jsonText(view);
  const size = Buffer.byteLength(text);
  const warnings: Warning[] = [];
  if (size > cap) {
    const why = `The report's view is ${size} bytes, more than the ${cap} an export holds, so it was left out.`;
    const empty = emptyManuscript("unavailable", why);
    return { text: jsonText(empty), view: empty, warnings: [{ code: "manuscript_unavailable", message: why, records: [] }] };
  }
  if (view.state === "unavailable") {
    warnings.push({
      code: "manuscript_unavailable",
      message: `The report is not in this export: ${view.why} Fix it, then export again.`,
      records: [],
    });
  }
  // A quotation only the cap affected is already warned about with the source views.
  const broken = incomplete(made);
  if (broken.length > 0) {
    warnings.push({
      code: "manuscript_incomplete",
      message: `${broken.length} part(s) of the report are shown as broken or withheld, with nothing highlighted for them; build report may refuse the report as it stands. Open the manuscript in the page to see why for each, or run \`build report report\`.`,
      records: broken,
    });
  }
  const located = proseOf(view).filter(([, texts]) => texts.some((t) => t.split("\n").some((line) => findCoordinates(line).length > 0))).map(([place]) => place);
  if (located.length > 0) {
    warnings.push({
      code: "coordinates_in_manuscript",
      message: "The report's text, notes, quotations or bibliography hold what looks like a coordinate. The export was written with it, so anyone given the export can read it. If it locates a restricted site, do not pass the export on.",
      records: located.sort(compareCodePoints),
    });
  }
  return { text, view, warnings };
}
