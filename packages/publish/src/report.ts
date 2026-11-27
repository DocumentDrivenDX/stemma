// A research report assembled from its manuscript and the project's passage and
// source records (CONTRACT-006 I). Every quotation is copied from a source file
// by the address in a passage record, never typed; notes and bibliography are
// formatted by citeproc-js; the outputs are Markdown, Typst source, and a
// verification table kept apart from the publication. The same inputs give the
// same bytes.
import { type Cluster, containerOf, formatCitations, sourceByKey } from "@stemma/cite";
import { SourceTexts, textAt } from "@stemma/core";
import { type Corpus, isObject, isRetired, type JsonObject } from "@stemma/records";

export class ReportError extends Error {}

export interface QuotationSpec {
  id: string;
  /** The citation key (or source ID) of the work the quotation is cited to. */
  cites: string;
  passages: { passage: string; join?: string; join_note?: string }[];
  /** The passage is a note on its page: the locator gains "n". */
  note?: boolean;
  corrections?: { was: string; now: string; by: string; basis: string }[];
  italic?: string[];
  keep_hyphens?: string[];
  /** How the quotation and its page were compared with the page. */
  checked?: string;
}
export interface ReportSpec {
  manuscript: string;
  quotations: QuotationSpec[];
  verification?: { preamble?: string[] };
}

export interface Rendered {
  id: string; cites: string; text: string; locator: string; joined: string[]; spec: QuotationSpec;
  provenance: { passage: string; address: string; labelBasis: string[] }[];
}
export interface Note { number: number; clusters: Cluster[]; passages: string[]; inline: string[]; comment?: string; text: string }

const QUOTE = /\{\{q:([A-Za-z0-9-]+)\}\}/g;
const NOTE = /\[\^([A-Za-z0-9,-]*)(?:\|((?:[^\]{]|\{\{q:[A-Za-z0-9-]+\}\})*))?\]/g;
const WORD = "[\\p{L}\\p{N}\\p{M}_]";

/** Chicago inclusive numbers: 510–11, 247–48, 93–94, 899–900. */
export function pageRange(a: string, b: string): string {
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return `${a}–${b}`;
  if (Number(a) < 100 || Number(a) % 100 === 0 || a.length !== b.length) return `${a}–${b}`;
  let keep = b.length;
  while (keep > 2 && a.slice(0, a.length - keep + 1) === b.slice(0, b.length - keep + 1)) keep--;
  return `${a}–${b.slice(-keep)}`;
}

/** One locator for several passages of a work: a page range when all are plain page numbers. */
export function span(locs: string[]): string {
  const bases = new Set(locs.map((l) => (l.endsWith(" n") ? l.slice(0, -2) : l)));
  if (bases.size === 1 && locs.length === 2) return `${[...bases][0]} and n`;
  const nums: number[] = [];
  for (const loc of locs) {
    const bare = loc.replace(/n+$/, "");
    if (bare.split("–").some((p) => !/^\d+$/.test(p))) return locs.join(", ");
    const first = bare.split("–")[0]!;
    let last = bare.split("–").at(-1)!;
    if (last.length < first.length) last = first.slice(0, first.length - last.length) + last;
    nums.push(Number(first), Number(last));
  }
  const [lo, hi] = [Math.min(...nums), Math.max(...nums)];
  return lo === hi ? String(lo) : pageRange(String(lo), String(hi));
}

export function render(corpus: Corpus, texts: SourceTexts, spec: QuotationSpec): Rendered {
  const cited = sourceByKey(corpus, spec.cites);
  if (!cited) throw new ReportError(`${spec.id}: no source record has the key ${spec.cites}`);
  const container = containerOf(corpus, cited);
  const pieces: string[] = [];
  const locators: string[] = [];
  const provenance: Rendered["provenance"] = [];
  spec.passages.forEach((segment, n) => {
    const passage = corpus.byId.get(segment.passage)?.data;
    if (passage?.kind !== "passage" || isRetired(passage)) throw new ReportError(`${spec.id}: no passage record in effect has the ID ${segment.passage}`);
    if (passage.source !== cited.id && passage.source !== container?.id) {
      throw new ReportError(`${spec.id}: ${segment.passage} is a passage of ${String(passage.source)}, not of ${spec.cites} or the work it is part of`);
    }
    const at = textAt(texts, passage);
    if (at.state === "changed") throw new ReportError(`${spec.id}: page ${at.index} of ${String(passage.text)} has changed since ${segment.passage} was captured`);
    if (at.state !== "ok" || !isObject(passage.quote) || at.text !== passage.quote.exact) {
      throw new ReportError(`${spec.id}: the source file no longer gives the text ${segment.passage} captured`);
    }
    const anchors = (passage.anchor as JsonObject[]);
    provenance.push({
      passage: segment.passage,
      address: `${String(passage.text)}/${anchors.map((a) => `${String(a.index)}:${String(a.stream)}:${String(a.start)}-${String(a.end)}`).join("+")}`,
      labelBasis: anchors.flatMap((a) => {
        const part = at.view.part(Number(a.index));
        const basis = part?.part.front.label_basis;
        return basis === "author_statement" ? [`the label of page index ${String(a.index)} is the author's statement, not printed on the page`] : [];
      }),
    });
    if (n > 0) pieces.push(segment.join ?? " ");
    pieces.push(at.text);
    locators.push(String((passage.locator as JsonObject).value));
  });
  let text = pieces.join("");
  const keep = new Set(spec.keep_hyphens ?? []);
  const joined: string[] = [];
  text = text.replace(new RegExp(`(${WORD}+)-\\n(${WORD}+)`, "gu"), (_, a: string, b: string) => {
    const word = `${a}-${b}`;
    if (keep.has(word)) {
      joined.push(`${a}-|${b} kept as ${word}`);
      return word;
    }
    joined.push(`${a}-|${b} joined as ${a}${b}`);
    return a + b;
  });
  text = text.replaceAll("\n", " ");
  for (const c of spec.corrections ?? []) {
    if (text.split(c.was).length !== 2) throw new ReportError(`${spec.id}: the correction ${JSON.stringify(c.was)} does not match exactly once`);
    text = text.replace(c.was, c.now);
  }
  for (const word of spec.italic ?? []) {
    if (!text.includes(word)) throw new ReportError(`${spec.id}: the italic ${JSON.stringify(word)} is not in the quotation`);
    text = text.replaceAll(word, `*${word}*`);
  }
  const seen = [...new Set(locators)];
  let locator = seen.length === 1 ? seen[0]! : pageRange(seen[0]!, seen.at(-1)!);
  if (spec.note) locator += /\d$/.test(locator) ? "n" : " n";
  return { id: spec.id, cites: spec.cites, text, locator, joined, spec, provenance };
}

/**
 * A quotation as a note gives it, before the citation that supports it
 * (quotation, then source): in quotation marks, with a full stop inside them
 * unless it already ends with one, a question mark or an exclamation mark.
 */
export const quotedInNote = (text: string): string => `“${text}${/[.?!]$/.test(text) ? "" : "."}”`;

/** What a note's citation is made from: one quotation, with no page and no text when it cannot be built. */
export interface Member { id: string; locator?: string; text?: string }

/**
 * The citations of one note. Each run of consecutive quotations from the same
 * work and the same page is given, then one citation of that work at that
 * page; a quotation on another page starts another citation, so a locator is
 * never repeated and each quotation is followed by its own page. Each citation
 * keeps the IDs of the quotations it supports.
 */
function noteCitations(note: number, groups: { cites: string; members: Member[] }[]): { cluster: Cluster; quotations: string[] }[] {
  const citations: { cluster: Cluster; quotations: string[] }[] = [];
  for (const { cites, members } of groups) {
    for (const p of members) {
      const before = p.text === undefined ? "" : `${quotedInNote(p.text)} `;
      const last = citations.at(-1);
      const item = last?.cluster.items[0];
      if (last && item && p.locator !== undefined && item.key === cites && item.locator === p.locator && last.cluster.items.length === 1) {
        item.before = `${item.before}${before}`;
        last.quotations.push(p.id);
      } else {
        citations.push({
          cluster: { note, items: [{ key: cites, ...(p.locator === undefined ? {} : { label: "page", locator: p.locator }), before }] },
          quotations: [p.id],
        });
      }
    }
  }
  return citations;
}

/** The citations of one note, without the IDs of their quotations. */
export const noteClusters = (note: number, groups: { cites: string; members: { locator: string; text: string }[] }[]): Cluster[] =>
  noteCitations(note, groups.map((g) => ({ cites: g.cites, members: g.members.map((m) => ({ ...m, id: "" })) }))).map((c) => c.cluster);

/** A piece of the manuscript as the template gives it. */
export type Segment = { kind: "text"; text: string } | { kind: "quotation"; id: string } | { kind: "note"; number: number };
export type Paragraph = { kind: "bibliography" } | { kind: "text"; segments: Segment[] };
export interface AssembledNote {
  number: number;
  /** In order. A quotation with no known work has no cluster, so no citation is formatted for it. */
  citations: { quotations: string[]; cluster?: Cluster }[];
  /** The IDs the note cites. */
  passages: string[];
  /** The IDs quoted in the text or the comment since the note before, that this note does not cite. */
  inline: string[];
  comment?: Segment[];
}
export interface Assembly { paragraphs: Paragraph[]; notes: AssembledNote[] }

/** What the assembly needs of a quotation: the work it is cited to and, when it can be built, its page and words. */
export type Resolve = (id: string, where: string) => { cites?: string; locator?: string; text?: string };

/** The manuscript template as segments: the one reading of it, behind both `report.md` and the manuscript view. */
export function assemble(manuscript: string, resolve: Resolve): Assembly {
  const notes: AssembledNote[] = [];
  const paragraphs: Paragraph[] = [];
  for (const raw of manuscript.split("\n\n")) {
    const para = raw.replace(/^\n+|\n+$/g, "");
    if (para === "{{bibliography}}") {
      paragraphs.push({ kind: "bibliography" });
      continue;
    }
    let quotedSinceNote = new Set<string>();
    const tokens = [
      ...[...para.matchAll(QUOTE)].map((m) => ({ m, kind: "q" as const })),
      ...[...para.matchAll(NOTE)].map((m) => ({ m, kind: "n" as const })),
    ].sort((a, b) => a.m.index! - b.m.index!);
    const segments: Segment[] = [];
    const text = (value: string) => {
      if (value !== "") segments.push({ kind: "text", text: value });
    };
    const quotation = (id: string, where: string): Segment => {
      quotedSinceNote.add(id);
      resolve(id, where);
      return { kind: "quotation", id };
    };
    let pos = 0;
    for (const { m, kind } of tokens) {
      if (m.index! < pos) continue; // a quotation inside a note's comment, rendered with the note
      text(para.slice(pos, m.index));
      pos = m.index! + m[0].length;
      if (kind === "q") {
        segments.push(quotation(m[1]!, "the text"));
        continue;
      }
      const ids = m[1]!.split(",").filter(Boolean);
      let comment: Segment[] | undefined;
      if (m[2]) {
        comment = [];
        let at = 0;
        for (const q of m[2].matchAll(QUOTE)) {
          if (q.index > at) comment.push({ kind: "text", text: m[2].slice(at, q.index) });
          comment.push(quotation(q[1]!, "a note"));
          at = q.index + q[0].length;
        }
        if (at < m[2].length) comment.push({ kind: "text", text: m[2].slice(at) });
      }
      const number = notes.length + 1;
      const citations: AssembledNote["citations"] = [];
      let groups: { cites: string; members: Member[] }[] = [];
      const close = () => {
        citations.push(...noteCitations(number, groups));
        groups = [];
      };
      for (const id of ids) {
        const found = resolve(id, "a note");
        if (found.cites === undefined) {
          close();
          citations.push({ quotations: [id] });
          continue;
        }
        if (groups.at(-1)?.cites !== found.cites) groups.push({ cites: found.cites, members: [] });
        groups.at(-1)!.members.push({ id, ...(found.locator === undefined ? {} : { locator: found.locator }), ...(found.text === undefined ? {} : { text: found.text }) });
      }
      close();
      notes.push({
        number, citations, passages: ids, inline: [...quotedSinceNote].filter((id) => !ids.includes(id)).sort(),
        ...(comment ? { comment } : {}),
      });
      segments.push({ kind: "note", number });
      quotedSinceNote = new Set();
    }
    text(para.slice(pos));
    paragraphs.push({ kind: "text", segments });
  }
  return { paragraphs, notes };
}

/** Every citation of the report, in note order. */
export const clustersOf = (notes: AssembledNote[]): Cluster[] => notes.flatMap((n) => n.citations.flatMap((c) => (c.cluster ? [c.cluster] : [])));

export interface Built { files: Record<string, string>; notes: Note[]; words: number; problems: string[] }

export function buildReport(corpus: Corpus, spec: ReportSpec, manuscript: string, include: string[] = []): Built {
  const texts = new SourceTexts(corpus);
  const passages = new Map<string, Rendered>();
  for (const q of spec.quotations) {
    if (passages.has(q.id)) throw new ReportError(`the quotation ${q.id} is listed twice`);
    passages.set(q.id, render(corpus, texts, q));
  }
  const get = (id: string, where: string) => {
    const p = passages.get(id);
    if (!p) throw new ReportError(`unknown quotation ${id} in ${where}`);
    return p;
  };
  const assembly = assemble(manuscript, get);
  const written = (segments: Segment[]) => segments.map((s) => (
    s.kind === "text" ? s.text : s.kind === "note" ? `[^${s.number}]` : `“${passages.get(s.id)!.text}”`)).join("");
  const notes: Note[] = assembly.notes.map((n) => {
    const comment = n.comment ? written(n.comment) : undefined;
    return {
      number: n.number, clusters: clustersOf([n]), passages: n.passages, inline: n.inline, ...(comment ? { comment } : {}), text: "",
    };
  });
  const paragraphs = assembly.paragraphs.map((p) => (p.kind === "bibliography" ? "{{bibliography}}" : written(p.segments)));
  const formatted = formatCitations(corpus, clustersOf(assembly.notes), include);
  const problems = formatted.problems.map((p) => `note ${p.note}: ${p.problem === "no_source" ? `no source has the key ${p.key}` : `the record of ${p.key} holds characters the formatter reserves`}`);
  let at = 0;
  for (const n of notes) {
    const cited = formatted.citations.slice(at, at + n.clusters.length).join(" ");
    at += n.clusters.length;
    n.text = [cited, n.comment].filter(Boolean).join("\n\n    ");
  }
  const body = paragraphs.flatMap((p) => (p === "{{bibliography}}" ? ["## Bibliography", ...formatted.bibliography] : [p]));
  const md = `${body.join("\n\n")}\n\n${notes.map((n) => `[^${n.number}]: ${n.text}`).join("\n")}\n`;
  const prose = body.join("\n\n").split("## Bibliography")[0]!.replace(/\[\^\d+\]/g, "");
  const words = (prose.match(/[A-Za-z’'-]+/g) ?? []).length;
  return {
    files: { "report.md": md, "report.typ": toTypst(body, notes), "verification.md": verification(corpus, spec, notes, passages, formatted.items) },
    notes, words, problems,
  };
}

// ---------- Typst ----------

const TYPST_SPECIAL = /([\\#$*_`<>@[\]~=/+-])/g;
const escapeTypst = (s: string): string => s.replace(TYPST_SPECIAL, "\\$1");

/** Escapes Markdown-subset text for Typst markup, keeping *italic* and links. Nothing from input becomes Typst code. */
export function typstText(s: string): string {
  const out: string[] = [];
  let pos = 0;
  for (const m of s.matchAll(/\*([^*]+)\*|https?:\/\/\S+?(?=[.,;)]?(?:\s|$))/g)) {
    out.push(escapeTypst(s.slice(pos, m.index)));
    out.push(m[1] !== undefined ? `_${escapeTypst(m[1])}_` : `#link("${m[0].replace(/["\\]/g, "\\$&")}")`);
    pos = m.index! + m[0].length;
  }
  out.push(escapeTypst(s.slice(pos)));
  return out.join("");
}

function toTypst(body: string[], notes: Note[]): string {
  const byNumber = new Map(notes.map((n) => [n.number, n.text]));
  const title = body.find((p) => p.startsWith("# "))?.slice(2) ?? "";
  const lines = [
    `#set document(title: "${title.replace(/["\\]/g, "\\$&")}", date: none)`,
    '#set page(paper: "a4", margin: (x: 2.6cm, y: 2.8cm), numbering: "1")',
    '#set text(font: ("Libertinus Serif", "New Computer Modern"), size: 11pt, lang: "en")',
    "#set smartquote(enabled: false)",
    "#set par(justify: true, leading: 0.62em, first-line-indent: 1.2em, spacing: 0.62em)",
    "#show heading: set block(above: 1.4em, below: 0.8em)",
    "#show heading.where(level: 2): set text(size: 12.5pt)",
    '#show heading.where(level: 3): set text(size: 11pt, style: "italic", weight: "regular")',
    "#set footnote.entry(gap: 0.5em, indent: 0em)",
    "#show footnote.entry: set text(size: 8.6pt)",
    "",
  ];
  const note = (text: string) => text.split("\n\n    ").map(typstText).join("\n\n");
  let inBibliography = false;
  let previous = "";
  for (const para of body) {
    const after = previous;
    previous = para;
    if (para.startsWith("# ")) {
      lines.push(`#align(center, text(size: 20pt, weight: "bold")[${typstText(para.slice(2))}])`);
      continue;
    }
    if (para.startsWith("## ") && after.startsWith("# ")) {
      // A second-level heading straight after the title is its subtitle.
      lines.push(`#align(center, text(size: 13pt, style: "italic")[${typstText(para.slice(3))}])\n#v(1.2em)`);
      continue;
    }
    if (para.startsWith("### ")) {
      lines.push(`#align(center)[#text(weight: "bold")[${typstText(para.slice(4))}]]`);
      continue;
    }
    if (para.startsWith("## ")) {
      inBibliography = para.slice(3) === "Bibliography";
      if (inBibliography) lines.push("#pagebreak(weak: true)");
      lines.push(`== ${typstText(para.slice(3))}`);
      continue;
    }
    if (inBibliography) {
      lines.push(`#par(first-line-indent: 0em, hanging-indent: 1.5em)[${typstText(para)}]`);
      continue;
    }
    const pieces: string[] = [];
    let pos = 0;
    for (const m of para.matchAll(/\[\^(\d+)\]/g)) {
      pieces.push(typstText(para.slice(pos, m.index)));
      pieces.push(`#footnote[${note(byNumber.get(Number(m[1]))!)}]`);
      pos = m.index! + m[0].length;
    }
    pieces.push(typstText(para.slice(pos)));
    lines.push(pieces.join(""));
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

// ---------- verification table ----------

/** How a quotation as the report gives it differs from the source text, and what its locator rests on. */
export const changesOf = (p: Rendered): string[] => [
  ...(p.spec.corrections ?? []).map((c) => `correction “${c.was}” → “${c.now}”, read from the ${c.basis} by ${c.by}${c.by.startsWith("person:") ? "" : ", not reviewed by a person"}`),
  ...p.joined, ...(p.spec.italic ?? []).map((w) => `italic: ${w} (as on the page)`),
  ...p.spec.passages.flatMap((s) => (s.join_note ? [s.join_note] : [])),
  ...p.provenance.flatMap((pr) => pr.labelBasis.map((b) => `locator: ${b}`)),
];

function verification(corpus: Corpus, spec: ReportSpec, notes: Note[], passages: Map<string, Rendered>, items: Record<string, unknown>): string {
  const rows = [
    "# Verification of the report’s notes", "",
    "This table is generated by `stemma build report` from the project's passage and source records and the report's quotation list (`report.json`). It is separate from the report and is not part of the publication.", "",
    ...(spec.verification?.preamble ?? []).flatMap((p) => [p, ""]),
    "| Note | Passage | Source file, page index, characters | Printed page | How verified | Changes from the text layer |",
    "|---|---|---|---|---|---|",
  ];
  for (const n of notes) {
    if (n.passages.length === 0) rows.push(`| ${n.number} | (comment only) | | | | |`);
    for (const id of [...n.inline, ...n.passages]) {
      const p = passages.get(id)!;
      const address = p.provenance.map((pr) => `\`${pr.address}\` (record \`${pr.passage}\`)`).join("<br>");
      const changes = changesOf(p);
      rows.push(`| ${n.number} | ${id}${n.inline.includes(id) ? " (quoted in the text)" : ""} | ${address} | ${p.locator} | ${p.spec.checked ?? "not recorded"} | ${changes.join("; ") || "none"} |`);
    }
  }
  rows.push("", "## Bibliographic details", "",
    "Where each detail of the cited works was read, as each source record's change log states it. Details recorded when a record was made are listed as recorded at intake.", "",
    "| Work | Recorded by | Where the details were read |", "|---|---|---|");
  for (const id of Object.keys(items).sort((a, b) => keyOf(corpus, a).localeCompare(keyOf(corpus, b)))) {
    const record = corpus.byId.get(id)?.data;
    if (!record) continue;
    const created = isObject(record.created) && isObject(record.created.by) ? `${String(record.created.by.kind)} ${String(record.created.by.name)}` : "unknown";
    const changes = (Array.isArray(record.changes) ? record.changes.filter(isObject) : []).filter((c) => c.field !== "tags");
    const by = [...new Set([created, ...changes.map((c) => (isObject(c.by) ? `${String(c.by.kind)} ${String(c.by.name)}` : ""))])].filter(Boolean).join(", ");
    const from = [...new Set(changes.map((c) => `${String(c.field)}: ${String(c.from)}`))];
    rows.push(`| ${keyOf(corpus, id)} | ${by} | ${["recorded at intake", ...from].join("<br>")} |`);
  }
  return `${rows.join("\n")}\n`;
}

const keyOf = (corpus: Corpus, id: string): string => {
  const record = corpus.byId.get(id)?.data;
  return typeof record?.citation_key === "string" ? record.citation_key : id;
};
