// `stemma.sourceviews.json` (CONTRACT-005 K): one source view, as `core` makes
// it, for each citation and passage the graph holds. It carries the text of
// cited pages, so it is for the `author` audience only and is never part of a
// reviewer package. It holds nothing about which originals a machine has, so the
// same records give the same bytes everywhere. `rights` fields filter nothing.
import { findCoordinates, SOURCE_VIEW_SCHEMA, type SourceView, SourceViews } from "@stemma/core";
import { compareCodePoints, type Corpus } from "@stemma/records";
import { jsonText } from "./module.ts";
import type { Count, Projection, Warning } from "./project.ts";

export const SOURCE_VIEWS_SCHEMA = "stemma.sourceviews/0";
/** The most the passage views may take, in bytes as written (CONTRACT-005 K). A design assumption. */
export const SOURCE_VIEWS_CAP = 8_000_000;

export interface SourceViewsFile {
  text: string;
  views: Record<string, SourceView>;
  /** What was left out, including the parts none of whose text is in the export. */
  omissions: Count[];
  warnings: Warning[];
}

/** Everything in a view that came from source text or prose, which could hold a coordinate. */
function proseOf(view: SourceView): string[] {
  return [
    view.citation?.sentence, view.citation?.quotation,
    ...view.segments.flatMap((s) => [
      // Run together, so that a coordinate cut by the highlight is still found.
      s.before + s.quoted + s.after, s.place, s.quality.note,
      ...s.reviews.flatMap((r) => r.flags.flatMap((f) => [f.reading, f.suggested, f.note])),
    ]),
    view.source_text?.note,
  ].filter((text): text is string => text !== undefined);
}

const bytesOf = (view: SourceView): number => Buffer.byteLength(jsonText({ views: { [view.id]: view } }));

export function sourceViewsFile(corpus: Corpus, projection: Projection, cap = SOURCE_VIEWS_CAP, quoted: ReadonlySet<string> = new Set()): SourceViewsFile {
  const make = new SourceViews(corpus);
  const idsOf = (type: string) => projection.entities.filter((e) => e.type === type).map((e) => e.key).sort(compareCodePoints);
  let retired = 0;
  const kept = (view: SourceView): boolean => {
    if (view.state !== "retired") return true;
    retired++;
    return false;
  };
  const citations = idsOf("Citation").map((id) => make.view({ kind: "citation", id })).filter(kept);
  const passages = idsOf("Passage").map((id) => make.view({ kind: "passage", id })).filter(kept);

  // Those a highlighted citation or report quotation points to come first, so that the cap takes them last.
  const cited = new Set([...quoted, ...citations.filter((v) => v.state === "highlighted").flatMap((v) => v.passages.map((p) => p.passage))]);
  const views: Record<string, SourceView> = Object.fromEntries(citations.map((v) => [v.id, v]));
  const parts = new Set<string>();
  const trimmed = new Set<string>();
  let used = 0;
  let cut = 0;
  for (const view of [...passages.filter((v) => cited.has(v.id)), ...passages.filter((v) => !cited.has(v.id))]) {
    // Only a view that holds source text counts against the cap.
    const size = view.segments.length > 0 && cap !== Number.POSITIVE_INFINITY ? bytesOf(view) : 0;
    if (used + size > cap) {
      cut++;
      views[view.id] = {
        schema: SOURCE_VIEW_SCHEMA, kind: "passage", id: view.id, state: "not_exported",
        why: "This export left the text out to stay within its size limit. Use `excerpt` to see it.",
        ...(view.work ? { work: view.work } : {}), ...(view.locator ? { locator: view.locator } : {}), passages: [], segments: [],
      };
      continue;
    }
    used += size;
    views[view.id] = view;
    for (const s of view.segments) {
      const part = `${view.source_text!.id}/${s.index}`;
      parts.add(part);
      if (s.trimmed_before || s.trimmed_after) trimmed.add(part);
    }
  }

  const omissions: Count[] = ([
    ["SourceText", "page_text", corpus.partFiles.length - parts.size],
    ["SourceText", "page_text_trimmed", trimmed.size],
    ["SourceView", "retired", retired],
    ["SourceView", "size_cap", cut],
  ] as const).flatMap(([type, reason, count]) => (count > 0 ? [{ type, reason, count }] : []));
  const warnings: Warning[] = [];
  if (cut > 0) {
    warnings.push({
      code: "source_views_cut",
      message: `${cut} passage(s) are in this export without their source text, to keep the source views within ${cap} bytes. \`excerpt\` shows each one.`,
      records: Object.values(views).filter((v) => v.state === "not_exported").map((v) => v.id).sort(compareCodePoints),
    });
  }
  const located = Object.values(views).filter((v) => proseOf(v).some((text) => text.split("\n").some((line) => findCoordinates(line).length > 0)));
  if (located.length > 0) {
    warnings.push({
      code: "coordinates_in_views",
      message: "Source text or other prose in these source views holds what looks like a coordinate. The export was written with it, so anyone given the export can read it. If it locates a restricted site, do not pass the export on.",
      records: located.map((v) => v.id).sort(compareCodePoints),
    });
  }
  // Written only when asked for: with no cap, as the local server makes them, the text can be very large.
  let text: string | undefined;
  return { get text() { return (text ??= jsonText({ schema: SOURCE_VIEWS_SCHEMA, views })); }, views, omissions, warnings };
}
