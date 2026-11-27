// A developer script, not a Stemma command: runs the Word reader, the
// reference-list reader and the author-date matcher (CONTRACT-003 F and H) over
// local DOCX files and writes what they found to a JSON file outside the
// repository. It reads the inputs and writes only that file. It prints counts
// only, never the manuscript's text.
//
//   ./.tools/bun scripts/author-date-report.ts --out <report.json> <file.docx>...
//
// The report holds manuscript text. Never commit it. `takeover` is the command
// that writes records; this script writes none.
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { type AuthorDateResult, type EntryFlag, matchAuthorDate, readWord, WORD_COVERAGE, type WordItemKind, type WordReading, yearForms } from "../packages/intake/src/index.ts";

export const COVERAGE = [
  ...WORD_COVERAGE,
  "Comment text is not examined for citations. Comment counts are given per file.",
  "A field's visible result is read as typed text, so citations a reference manager inserted are matched like typed ones.",
  "A reference list laid out as a table is not found as entries.",
];

export interface FileCoverage {
  comments: number;
  textBoxes: number;
  /** Bracketed years in text boxes, which are not part of the account. */
  textBoxBracketedYears: number;
  headerAndFooterParts: number;
  fields: number;
  trackedDeletions: number;
  symbols: number;
  equations: number;
  unreferencedNotes: number;
  missingNotes: number;
}

const bracketedYears = (text: string): number => (text.match(/\([^()]*\)/g) ?? []).filter((b) => yearForms(b).length > 0).length;

/** What the reading did not convert, as counts. */
export function fileCoverage(reading: WordReading): FileCoverage {
  const of = (...kinds: WordItemKind[]) => reading.items.filter((i) => kinds.includes(i.kind));
  return {
    comments: reading.comments.length,
    textBoxes: of("text_box").length,
    textBoxBracketedYears: of("text_box").reduce((n, i) => n + bracketedYears(i.text), 0),
    headerAndFooterParts: new Set(of("header", "footer").map((i) => i.place.part)).size,
    fields: reading.fields.length,
    trackedDeletions: reading.revisions.filter((r) => r.kind === "deletion" || r.kind === "move_from").length,
    symbols: of("symbol").length,
    equations: of("equation").length,
    unreferencedNotes: of("unreferenced_note").length,
    missingNotes: of("missing_note").length,
  };
}

/** Linked items that carry a working marker, and the flagged entries to look at, with how many items link to each. */
export function linkedAside(result: AuthorDateResult) {
  const linked = result.brackets.flatMap((bracket) => (bracket.state === "unlinked" ? [] : bracket.items.flatMap((item) =>
    (item.state === "linked" ? [{ bracket, item }] : []))));
  const flagged = (flag: EntryFlag) => result.lists.flatMap((list) => list.entries.filter((e) => e.flags.includes(flag)).map((e) => ({
    file: list.file, paragraph: e.paragraph, asFound: e.asFound, status: e.status,
    ...(flag === "long_surname_form" && e.status === "read" ? { authors: e.authors, longer: e.longer } : {}),
    linkedItems: linked.filter(({ item }) => item.entry.file === list.file && item.entry.paragraph === e.paragraph).length,
  })));
  return {
    marked: linked.filter(({ item }) => item.marker !== undefined),
    noted: flagged("bracketed_note"),
    longSurnames: flagged("long_surname_form"),
  };
}

/** The report: coverage limits, counts, lists, and each linked, unresolved, and unlinked item. The same inputs give the same text. */
export function report(inputs: { file: string; bytes: Uint8Array }[]): { text: string; result: AuthorDateResult; coverage: Record<string, FileCoverage> } {
  const read = inputs.map((i) => {
    const reading = readWord(i.file, i.bytes);
    return { document: reading.document, coverage: fileCoverage(reading), sha256: reading.sha256 };
  });
  const result = matchAuthorDate(read.map((r) => r.document));
  const documents = new Map(read.map((r) => [r.document.file, r.document]));
  /** The paragraph's text just before a place, to find it by and to check it. */
  const placed = <T extends { file: string; paragraph: number; start: number }>(item: T) => {
    const paragraph = documents.get(item.file)!.paragraphs[item.paragraph]!;
    return { ...item, before: paragraph.text.slice(Math.max(0, item.start - 80), item.start), ...(paragraph.note ? { note: paragraph.note } : {}) };
  };
  const of = (state: string) => result.brackets.filter((b) => b.state === state).map(placed);
  const aside = linkedAside(result);
  const coverage = Object.fromEntries(read.map((r) => [r.document.file, r.coverage]));
  const text = JSON.stringify({
    profile: result.profile,
    coverageLimits: COVERAGE,
    files: read.map((r) => ({ file: r.document.file, sha256: r.sha256, paragraphs: r.document.paragraphs.length, coverage: r.coverage })),
    counts: result.counts,
    // A link to check by hand: it identifies a list entry and verifies nothing.
    linkedWithMarker: aside.marked.map(({ bracket, item }) => {
      const { items: _, ...place } = placed(bracket);
      return { ...place, item };
    }),
    entriesWithBracketedNote: aside.noted,
    // Two authors run together can look like one long surname.
    entriesWithLongSurnameForm: aside.longSurnames,
    unpairedBrackets: result.unpaired.map(placed),
    lists: result.lists.map((l) => ({
      ...l, startText: documents.get(l.file)!.paragraphs[l.start]!.text,
      subheadings: l.subheadings.map((i) => ({ paragraph: i, text: documents.get(l.file)!.paragraphs[i]!.text })),
    })),
    linked: of("linked"),
    unresolved: of("unresolved"),
    // Possible narrative citations come first.
    unlinked: of("unlinked").sort((a, b) => Number("possibleNarrative" in b && b.possibleNarrative) - Number("possibleNarrative" in a && a.possibleNarrative)),
  }, null, 2);
  return { text: `${text}\n`, result, coverage };
}

/** Whether a path lies in a Git working tree, this repository's included. */
export function inRepository(path: string): boolean {
  for (let at = realpathSync(dirname(resolve(path))); ; at = dirname(at)) {
    if (existsSync(join(at, ".git"))) return true;
    if (dirname(at) === at) return false;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = args.indexOf("--out");
  const out = flag >= 0 ? args[flag + 1] : undefined;
  const files = args.filter((_, i) => flag < 0 || (i !== flag && i !== flag + 1));
  const stop = (message: string): never => {
    console.error(message);
    process.exit(2);
  };
  if (!out || files.length === 0) stop("usage: author-date-report.ts --out <report.json outside the repository> <file.docx>...");
  if (!existsSync(dirname(resolve(out!)))) stop("The folder for --out does not exist.");
  if (inRepository(out!)) stop("The report holds manuscript text. Choose a path outside any Git repository.");
  if (existsSync(out!)) stop("The --out file already exists. Nothing is overwritten.");
  // A file is named by its base name, or by its whole path where two share one.
  const names = files.map((f) => basename(f));
  const inputs = files.map((path, i) => ({
    file: names.filter((n) => n === names[i]).length > 1 ? path : names[i]!,
    bytes: new Uint8Array(readFileSync(path)),
  }));
  const made = report(inputs);
  writeFileSync(out!, made.text, { flag: "wx", mode: 0o600 });
  const { counts, lists } = made.result;
  const entries = lists.flatMap((l) => l.entries);
  const aside = linkedAside(made.result);
  console.log([
    `files ${inputs.length}, reference lists ${lists.length}, files with no list ${made.result.files.filter((f) => f.lists === 0).length}`,
    `entries ${entries.length}: read ${entries.filter((e) => e.status === "read").length}, unread ${entries.filter((e) => e.status === "unread").length}`,
    `bracketed years ${counts.examined}: linked ${counts.linked}, unresolved ${counts.unresolved}, left unlinked ${counts.unlinked}`,
    `left unlinked by reason ${JSON.stringify(counts.unlinkedByReason)}`,
    `citation items: linked ${counts.items.linked}, unresolved ${counts.items.unresolved} ${JSON.stringify(counts.items.unresolvedByReason)}`,
    `linked citation items with a working marker ${aside.marked.length}`,
    `entries with a bracketed note ${aside.noted.length}, citation items linked to them ${aside.noted.reduce((n, e) => n + e.linkedItems, 0)}`,
    `entries with a long surname form to look at ${aside.longSurnames.length}, citation items linked to them ${aside.longSurnames.reduce((n, e) => n + e.linkedItems, 0)}`,
    `unpaired brackets before a year ${made.result.unpaired.length}`,
    ...Object.values(made.coverage).map((c, i) => `file ${i + 1} not fully read: ${JSON.stringify(c)}`),
    "Limits:", ...COVERAGE.map((l) => `- ${l}`),
  ].join("\n"));
}
