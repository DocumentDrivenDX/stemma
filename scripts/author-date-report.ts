// A developer script, not a Stemma command: runs the reference-list reader and
// the author-date matcher (CONTRACT-003 H) over local DOCX files and writes
// what they found to a JSON file outside the repository. It reads the inputs and
// writes only that file. It prints counts only, never the manuscript's text.
//
//   ./.tools/bun scripts/author-date-report.ts --out <report.json> <file.docx>...
//
// The report holds manuscript text. Never commit it.
//
// This is not the FR-71 Word reader. `COVERAGE` states what it does not read.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { type Element, find, localName, textOf, tree } from "../packages/extract/src/markup.ts";
import { readZip } from "../packages/extract/src/zip.ts";
import { type AuthorDateResult, type Document, type Location, matchAuthorDate, type Paragraph, yearForms } from "../packages/intake/src/index.ts";

export const COVERAGE = [
  "Read: body text, headings, tables, footnotes, and endnotes, with insertions applied and tracked deletions and moved-from text left out.",
  "Comments are not read, and their text is not examined. Comment counts are given per file.",
  "Text boxes and shapes are not read. Their count and the bracketed years in them are given per file, outside the account.",
  "Headers, footers, document properties, and image descriptions are not read.",
  "A field's visible result is read as typed text, so citations a reference manager inserted are matched like typed ones. Field codes and embedded reference data are not read.",
  "Symbol characters, equations, automatic list numbers, and other generated text are left out.",
  "Hidden text is read as ordinary text.",
  "Headings are found from paragraph styles and outline levels, and captions from a style named Caption. Other headings and captions are read as body text.",
  "A reference list laid out as a table is not found as entries.",
  "No Word file saved by a named tool and version has been tested against this script; its Word support is untested.",
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

const SKIPPED = new Set(["w:del", "w:movefrom", "w:deltext", "w:instrtext", "w:ppr", "w:rpr", "mc:fallback", "w:txbxcontent"]);

const child = (node: Element | undefined, name: string): Element | undefined =>
  node?.children.find((c): c is Element => typeof c !== "string" && c.name === name);
const value = (node: Element | undefined, name: string): string | undefined => child(node, name)?.attrs["w:val"];

const bracketedYears = (text: string): number => (text.match(/\([^()]*\)/g) ?? []).filter((b) => yearForms(b).length > 0).length;

export function docxDocument(file: string, bytes: Uint8Array): { document: Document; coverage: FileCoverage } {
  const zip = readZip(bytes);
  const main = zip.text("word/document.xml");
  if (!main) throw new Error(`${file}: the DOCX has no document part`);
  const part = (name: string) => {
    const xml = zip.text(name);
    return xml ? tree(xml) : undefined;
  };
  const root = tree(main);

  const styles = new Map((part("word/styles.xml") ? find(part("word/styles.xml")!, "style") : []).map((s) => [s.attrs["w:styleid"] ?? "", s]));
  /** The heading level and caption role a style gives, its own or from the style it is based on. */
  const styled = (id: string | undefined): { level?: number; caption?: boolean } => {
    for (let at = id, depth = 0; at && depth < 10; depth++) {
      const style = styles.get(at);
      const name = value(style, "w:name") ?? at;
      if (/^caption$/i.test(name)) return { caption: true };
      const heading = /^heading ?([1-9])$/i.exec(name)?.[1];
      if (heading) return { level: Number(heading) };
      if (/^title$/i.test(name)) return { level: 1 };
      const outline = value(child(style, "w:ppr"), "w:outlinelvl");
      if (outline !== undefined && Number(outline) < 9) return { level: Number(outline) + 1 };
      at = value(style, "w:basedon");
    }
    return {};
  };

  const notes = (name: string, element: string) => new Map((part(name) ? find(part(name)!, element) : [])
    .filter((e) => !e.attrs["w:type"]).map((e) => [e.attrs["w:id"] ?? "", e]));
  const footnotes = notes("word/footnotes.xml", "footnote");
  const endnotes = notes("word/endnotes.xml", "endnote");
  const used = new Set<Element>();
  let missingNotes = 0;
  let noteNumber = 0;
  const paragraphs: Paragraph[] = [];
  let waiting: { element: Element; location: Location; label: string }[] = [];

  const phrase = (node: Element): string => node.children.map((c) => {
    // A text box sits inside a run; the paragraph's own text leaves it out.
    if (typeof c === "string" || SKIPPED.has(c.name)) return "";
    if (c.name === "w:t") return textOf(c);
    if (c.name === "w:tab") return " ";
    if (c.name === "w:br" || c.name === "w:cr") return c.attrs["w:type"] === "page" ? " " : "\n";
    if (c.name === "w:nobreakhyphen") return "-";
    if (c.name === "w:footnotereference" || c.name === "w:endnotereference") {
      const foot = c.name === "w:footnotereference";
      const note = (foot ? footnotes : endnotes).get(c.attrs["w:id"] ?? "");
      if (!note) missingNotes++;
      else {
        used.add(note);
        waiting.push({ element: note, location: foot ? "footnote" : "endnote", label: String(++noteNumber) });
      }
      return "";
    }
    return phrase(c);
  }).join("");

  const paragraph = (p: Element, location: Location, note?: string) => {
    const properties = child(p, "w:ppr");
    const style = styled(value(properties, "w:pstyle"));
    const outline = value(properties, "w:outlinelvl");
    const level = outline !== undefined && Number(outline) < 9 ? Number(outline) + 1 : style.level;
    const at: Location = location === "body" && style.caption ? "caption" : location;
    const text = phrase(p);
    if (text.trim()) {
      paragraphs.push({
        text, location: at,
        ...(at === "body" && level !== undefined ? { headingLevel: level } : {}),
        ...(note ? { note } : {}),
      });
    }
  };

  const walk = (node: Element, location: Location, note?: string) => {
    for (const c of node.children) {
      if (typeof c === "string" || SKIPPED.has(c.name)) continue;
      if (c.name === "w:p") {
        paragraph(c, location, note);
        // Each note follows the paragraph that refers to it.
        if (note === undefined) {
          for (const next of waiting.splice(0)) walk(next.element, next.location, next.label);
        }
      } else walk(c, localName(c.name) === "tbl" ? "table" : location, note);
    }
  };
  walk(root, "body");

  const boxes = find(root, "txbxcontent");
  // Word writes a text box twice, once as a fallback; count the fallback copy only if it is the only one.
  const inFallback = new Set(find(root, "fallback").flatMap((f) => find(f, "txbxcontent")));
  const counted = boxes.filter((b) => !inFallback.has(b)).length > 0 ? boxes.filter((b) => !inFallback.has(b)) : boxes;
  const comments = part("word/comments.xml");
  const parts = [root, part("word/footnotes.xml"), part("word/endnotes.xml")].filter((p): p is Element => p !== undefined);
  const count = (name: string, when: (e: Element) => boolean = () => true) => parts.reduce((n, p) => n + find(p, name).filter(when).length, 0);
  return {
    document: { file, paragraphs },
    coverage: {
      comments: comments ? find(comments, "comment").length : 0,
      textBoxes: counted.length,
      textBoxBracketedYears: counted.reduce((n, b) => n + find(b, "p").reduce((m, p) => m + bracketedYears(find(p, "t").map(textOf).join("")), 0), 0),
      headerAndFooterParts: zip.names.filter((n) => /^word\/(?:header|footer)\d*\.xml$/.test(n)).length,
      fields: count("fldsimple") + count("fldchar", (e) => e.attrs["w:fldchartype"] === "begin"),
      trackedDeletions: count("del") + count("movefrom"),
      symbols: count("sym"),
      equations: count("omath"),
      unreferencedNotes: [...footnotes.values(), ...endnotes.values()].filter((n) => !used.has(n) && textOf(n).trim()).length,
      missingNotes,
    },
  };
}

/** The report: coverage limits, counts, lists, and each linked, unresolved, and unlinked item. The same inputs give the same text. */
export function report(inputs: { file: string; bytes: Uint8Array }[]): { text: string; result: AuthorDateResult; coverage: Record<string, FileCoverage> } {
  const read = inputs.map((i) => ({ ...docxDocument(i.file, i.bytes), sha256: createHash("sha256").update(i.bytes).digest("hex") }));
  const result = matchAuthorDate(read.map((r) => r.document));
  const documents = new Map(read.map((r) => [r.document.file, r.document]));
  /** The paragraph's text just before a place, to find it by and to check it. */
  const placed = <T extends { file: string; paragraph: number; start: number }>(item: T) => {
    const paragraph = documents.get(item.file)!.paragraphs[item.paragraph]!;
    return { ...item, before: paragraph.text.slice(Math.max(0, item.start - 80), item.start), ...(paragraph.note ? { note: paragraph.note } : {}) };
  };
  const of = (state: string) => result.brackets.filter((b) => b.state === state).map(placed);
  const coverage = Object.fromEntries(read.map((r) => [r.document.file, r.coverage]));
  const text = JSON.stringify({
    profile: result.profile,
    coverageLimits: COVERAGE,
    files: read.map((r) => ({ file: r.document.file, sha256: r.sha256, paragraphs: r.document.paragraphs.length, coverage: r.coverage })),
    counts: result.counts,
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
  console.log([
    `files ${inputs.length}, reference lists ${lists.length}, files with no list ${made.result.files.filter((f) => f.lists === 0).length}`,
    `entries ${entries.length}: read ${entries.filter((e) => e.status === "read").length}, unread ${entries.filter((e) => e.status === "unread").length}`,
    `bracketed years ${counts.examined}: linked ${counts.linked}, unresolved ${counts.unresolved}, left unlinked ${counts.unlinked}`,
    `left unlinked by reason ${JSON.stringify(counts.unlinkedByReason)}`,
    `citation items: linked ${counts.items.linked}, unresolved ${counts.items.unresolved} ${JSON.stringify(counts.items.unresolvedByReason)}`,
    `unpaired brackets before a year ${made.result.unpaired.length}`,
    ...Object.values(made.coverage).map((c, i) => `file ${i + 1} not fully read: ${JSON.stringify(c)}`),
    "Limits:", ...COVERAGE.map((l) => `- ${l}`),
  ].join("\n"));
}
