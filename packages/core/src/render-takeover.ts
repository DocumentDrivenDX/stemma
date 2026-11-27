// The plain-language takeover report, and what a check report adds for a
// taken-over project (FR-93; SD-015). One cause is shown once, with a count, the
// places it affects, and a next step. Text cut short here is whole in the JSON
// report: nothing is dropped from the findings or the items.
import { compareCodePoints } from "@stemma/records";
import type { OpenTakeover, TakeoverGroup } from "./intake-groups.ts";
import { CHECK_DESCRIPTIONS } from "./checks/not-run.ts";
import type { ReportBody } from "./report.ts";
import { printable } from "./render.ts";

const PLACES = 8;
const WIDTH = 110;

const short = (text: string): string => {
  const line = printable(text);
  return line.length > WIDTH ? `${line.slice(0, WIDTH - 1)}…` : line;
};

function groupLines(group: TakeoverGroup, n: number): string[] {
  return [
    "", `${n}. ${group.label[0]!.toUpperCase()}${group.label.slice(1)}: ${group.count}  [${group.reason}]`, `   What to do: ${group.next_step}`,
    ...group.items.slice(0, PLACES).map((i) => `   - ${printable(i.position ?? i.id)}${i.as_found === undefined ? "" : `: ${short(i.as_found)}`}`),
    ...(group.count > PLACES ? [`   - and ${group.count - PLACES} more`] : []),
  ];
}

const unlinkedLine = ({ left_unlinked: left }: OpenTakeover): string[] => (left.count === 0 ? [] : ["",
  `${left.count} bracketed year(s) were left as text and linked to nothing: ${Object.entries(left.by_reason).sort(([a], [b]) => compareCodePoints(a, b)).map(([r, c]) => `${r.replaceAll("_", " ")} ${c}`).join(", ")}.`,
  "They are not findings and do not change the label. Each is listed in the project's intake items."]);

export function renderOpenTakeover(open: OpenTakeover): string[] {
  const lines: string[] = [];
  if (open.groups.length > 0) {
    lines.push("", "OPEN TAKEOVER ITEMS: what takeover could not settle or read. They are not findings and do not change the label.");
    open.groups.forEach((group, i) => lines.push(...groupLines(group, i + 1)));
  }
  if (open.repeats.length > 0) {
    lines.push("", `${open.repeats.length} reference-list entr${open.repeats.length === 1 ? "y is" : "ies are"} repeated word for word. Nothing was merged:`,
      ...open.repeats.slice(0, PLACES).map((r) => `   - ${r.items.length} times: ${short(r.as_found)}`),
      ...(open.repeats.length > PLACES ? [`   - and ${open.repeats.length - PLACES} more`] : []));
  }
  lines.push(...unlinkedLine(open));
  return lines;
}

/** Every open cause in one line, the largest first, so that the author can see where to begin. */
export function whereToStart(body: ReportBody): string[] {
  const causes = new Map<string, { check: string; reason: string; places: number; sources: Set<string>; next: string }>();
  for (const result of body.results.filter((r) => r.open)) {
    const key = `${result.check}\u0000${result.reason_code ?? ""}`;
    const cause = causes.get(key) ?? { check: result.check, reason: result.reason_code ?? result.outcome, places: 0, sources: new Set<string>(), next: result.suggestions[0] ?? "" };
    causes.set(key, cause);
    cause.places++;
    if (result.source) cause.sources.add(result.source);
  }
  const open = body.takeover!.groups;
  const items = open.reduce((n, g) => n + g.count, 0);
  const takeoverLine = items === 0 ? [] : [`   Also ${items} open takeover item(s) in ${open.length} group(s), listed under OPEN TAKEOVER ITEMS after the findings.`];
  if (causes.size === 0) return takeoverLine.length > 0 ? ["", ...takeoverLine] : [];
  const ordered = [...causes.values()].sort((a, b) => b.places - a.places || compareCodePoints(a.check, b.check) || compareCodePoints(a.reason, b.reason));
  return ["", "WHERE TO START: each cause once, with how many results it has. Every result is listed below.",
    ...ordered.flatMap((c) => [
      `   ${String(c.places).padStart(5)}  ${CHECK_DESCRIPTIONS[c.check] ?? c.check}: ${c.reason.replaceAll("_", " ")}${c.sources.size > 0 ? `, ${c.sources.size} source(s)` : ""}  [${c.check}]`,
      ...(c.next ? [`          What to do: ${c.next}`] : []),
    ]), ...takeoverLine];
}

interface TakeoverSummary {
  original: { name: string };
  chapter: { path: string; title: string; division: string };
  counts: {
    footnotes: number; endnotes: number; citations: number; bound: number; ambiguous: number; unclassified: number; sources: number; claims: number;
    quotations: { attributed: number; unattributed: number };
  };
  author_date: { examined: number; linked: number; unresolved: number; unlinked: number };
  reference_lists: { title: string; paragraph: number; entries: number; read: number; unread: number }[];
  look_at: { with_working_marker: number; to_entries_with_a_bracketed_note: number; to_entries_with_a_long_surname_form: number };
  takeover: OpenTakeover;
  comments: number;
  tracked_changes: number;
  not_converted: string[];
  revision_view: string;
  coverage: string[];
}

export function renderTakeover(body: TakeoverSummary): string {
  const { counts, author_date: dates, look_at: look } = body;
  const lines = [
    `Took over ${printable(body.original.name)} into ${body.chapter.path} ("${short(body.chapter.title)}"; ${body.chapter.division}).`,
    "Everything is unverified: nothing here has been checked against a source. The original was only read.",
    "No Word file saved by a real tool has been tested, so compare the chapter with your original.",
    "",
    body.reference_lists.length === 0 ? "No reference list was found, so no citation is linked."
      : body.reference_lists.map((l) => `Reference list "${printable(l.title)}" at paragraph ${l.paragraph}: ${l.entries} entries, ${l.read} read and ${l.unread} unread.`).join("\n"),
    `Bracketed years examined: ${dates.examined}: ${dates.linked} linked, ${dates.unresolved} unresolved, ${dates.unlinked} left as text.`,
    `Citations written: ${counts.citations}: ${counts.bound} linked to one list entry, ${counts.ambiguous} unresolved (key ?). A link names an entry; it verifies nothing.`,
    `Footnotes: ${counts.footnotes}. Endnotes: ${counts.endnotes}. Notes with no author-date citation: ${counts.unclassified}.`,
    `Sources made from list entries: ${counts.sources}. Claims, unreviewed: ${counts.claims}.`,
    `Quotations in double quotation marks: ${counts.quotations.attributed} tied to one citation, ${counts.quotations.unattributed} not. Each one not tied to a citation is an open finding in \`check\`.`,
    `Word comments: ${body.comments}. Tracked changes: ${body.tracked_changes}.${body.tracked_changes > 0 ? ` ${body.revision_view}` : ""}`,
  ];
  if (look.with_working_marker + look.to_entries_with_a_bracketed_note + look.to_entries_with_a_long_surname_form > 0) {
    lines.push(`Linked citations to look at by hand: ${look.with_working_marker} with a working marker, ${look.to_entries_with_a_bracketed_note} to an entry with a bracketed note, ${look.to_entries_with_a_long_surname_form} to an entry whose author names may run together.`);
  }
  lines.push(...renderOpenTakeover(body.takeover));
  lines.push("", "Not carried into the chapter:", ...body.not_converted.map((n) => `   - ${short(n)}`));
  lines.push("", "Limits of this version:", ...body.coverage.map((n) => `   - ${n}`));
  lines.push("", "Next: run `check` for the findings, grouped by cause.");
  return lines.join("\n");
}
