// The site's generated diagrams, as data (DESIGN.md, Generated diagrams). Each
// definition gives the boxes and lines of one drawing and the text equivalent
// that holds the same items. The drawing is made from it by ./scripts/dev.sh
// docs (lib/render-diagrams.ts); the site build writes the text beside it. This
// module reads record files and loads nothing heavy.
import { exampleDir, readRecords } from "./example.ts";

/** The longest label a box may have: the renderer does not wrap them. */
export const LONGEST_LABEL = 26;

export interface DiagramNode {
  id: string;
  label: string;
  shape?: "document" | "cylinder";
  /** Drawn with a heavier border. */
  focus?: boolean;
  /** Drawn with a double border: the thesis. */
  doubled?: boolean;
}

export interface DiagramEdge {
  from: string;
  to: string;
  /** Contradicts, attacks or undercuts: dashed, with a bar end. */
  opposing?: boolean;
}

export interface TextEntry {
  term: string;
  says: string;
  /** Check IDs the entry is about, shown small. */
  checks?: string[];
}

export interface Diagram {
  name: string;
  title: string;
  /** The drawing's description for a screen reader. */
  desc: string;
  /**
   * A grid with its reading order and a one-column order for narrow screens; or
   * a flow from left to right, which has no readable one-column layout and so
   * keeps its size in a scrolling region on narrow screens.
   */
  layout: { kind: "grid"; columns: number; order: string[]; narrow: string[] } | { kind: "flow" };
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** The text equivalent: the same items, links and relation words. */
  text: { label: string; ordered: boolean; entries: TextEntry[] };
}

const path = (ids: string[]): DiagramEdge[] => ids.slice(1).map((to, i) => ({ from: ids[i]!, to }));

/** From an original source to a footnote: the links Stemma keeps. */
export function chain(): Diagram {
  const links: [string, string, string, DiagramNode["shape"]?][] = [
    ["original", "Original source", "The paper, page or book as you got it, such as a PDF or a saved web page. It is not added to your project.", "document"],
    ["upstream", "Upstream record", "Where the original came from, and its digital fingerprint, which no other file shares."],
    ["files", "Source files", "Its text, kept in your project: one file for each page, or for each section where there are no pages.", "document"],
    ["passage", "Passage", "Words you chose by their place. A script copies them, with their page, chapter or paragraph."],
    ["citation", "Citation", "A record that ties your sentence to the source, with the place and any quotation."],
    ["claim", "Claim", "What your report asserts, where you record it, with how sure you are and why. Notes on passages bear on it."],
    ["footnote", "Sentence and footnote", "The sentence in your report, with a footnote that gives the quotation and then its citation."],
  ];
  const ids = links.map(([id]) => id);
  // Read left to right, then right to left, and so on: a path that turns at each row.
  const order = ["original", "upstream", "passage", "files", "citation", "claim", "footnote"];
  return {
    name: "chain",
    title: "From an original source to a footnote",
    desc: `${links.length} links, each leading to the next: ${links.map(([, label]) => label.toLowerCase()).join(", ")}.`,
    layout: { kind: "grid", columns: 2, order, narrow: ids },
    nodes: links.map(([id, label, , shape]) => ({ id, label, ...(shape ? { shape } : {}), ...(id === "original" || id === "footnote" ? { focus: true } : {}) })),
    edges: path(ids),
    text: { label: "The seven links, each leading to the next", ordered: true, entries: links.map(([, term, says]) => ({ term, says })) },
  };
}

/** Pairs read across: what is on the left leads to, or is compared with, what is on the right. */
function pairs(name: string, title: string, what: string, rows: { left: DiagramNode["label"]; right: string; says: string; checks?: string[] }[]): Diagram {
  const nodes: DiagramNode[] = rows.flatMap((r, i) => [{ id: `l${i}`, label: r.left }, { id: `r${i}`, label: r.right, shape: "document" as const }]);
  const ids = nodes.map((n) => n.id);
  return {
    name, title,
    desc: `${rows.length} ${what}. Each box on the left leads to the box beside it on the right.`,
    // In one column, only the two boxes of a pair are joined, so each pair still reads as one.
    layout: { kind: "grid", columns: 2, order: ids, narrow: ids },
    nodes,
    edges: rows.map((_, i) => ({ from: `l${i}`, to: `r${i}` })),
    text: { label: `${rows.length} ${what}`, ordered: false, entries: rows.map((r) => ({ term: `${r.left} → ${r.right}`, says: r.says, ...(r.checks ? { checks: r.checks } : {}) })) },
  };
}

/** What a check compares with what. The check IDs are verified against the list of checks when the site is built. */
export const compare = (): Diagram => pairs("compare", "What a check compares with what",
  "comparisons the checks make, from what is checked to what it is compared with", [
    { left: "Your quotation", right: "The source's own text", checks: ["quote.present", "quote.page"],
      says: "The words must be in the text of the source you cite and, where you give a page, chapter or paragraph, in that place." },
    { left: "The place you cite", right: "What the work holds", checks: ["locator.extent"],
      says: "A cited page or other place must fall within what is recorded for the work or within what its text holds." },
    { left: "A figure in a sentence", right: "That source's text", checks: ["number.present"],
      says: "A figure in a sentence that cites one source must appear somewhere in that source's text." },
    { left: "Author, title and date", right: "Title page and catalogues", checks: ["meta.source", "meta.resolver"],
      says: "A source's details are compared with what its captured copy says about itself, its title page, and catalogue records saved in your project." },
    { left: "A source's text files", right: "A fresh conversion", checks: ["source.original"],
      says: "The record of converting the original again must still apply to your files and agree with them." },
  ]);

/** The kinds of source Stemma reads, and how a place in each is cited. */
export const locators = (): Diagram => pairs("locators", "What Stemma reads, and how each is cited",
  "kinds of source, from each to how a place in it is cited", [
    { left: "PDF paper or manual", right: "Printed page number",
      says: "One file for each page. Page numbers are taken from those printed on the pages, where they support them. A passage on a page with no established number gets no page." },
    { left: "Web page you saved", right: "Paragraph or chapter",
      says: "Documentation, release notes and articles usually have no pages: a passage is cited by paragraph number, or by chapter where the headings number chapters. A page that marks its own page numbers keeps them." },
    { left: "EPUB book", right: "Page where it is marked",
      says: "Cited by page where the book marks its page numbers, and otherwise by chapter or paragraph." },
    { left: "Word document", right: "Never a page number",
      says: "A Word file has no fixed pages, so it is cited by chapter or paragraph. To cite pages, export a PDF and capture that." },
    { left: "Markdown or plain text", right: "Chapter or paragraph",
      says: "This includes Project Gutenberg texts. Plain text that marks its page breaks is kept page by page instead." },
    { left: "Scan or page images", right: "Text you supply",
      says: "Stemma cannot read words from a picture of a page. You supply them, from a recognition tool or typed, page by page." },
  ]);

/** What goes into a report build, and what comes out. */
export function reportBuild(): Diagram {
  const inputs: [string, string, string][] = [
    ["manuscript", "Your manuscript", "The report's own words. The build never changes them."],
    ["quotations", "List of quotations", "Which passages the report quotes, and where."],
    ["passages", "Passage records", "The words and place of each quotation, as a script copied them."],
    ["sources", "Source records", "The details of each work, from which its citations are written."],
  ];
  const outputs: [string, string, string][] = [
    ["report", "Report with footnotes", "Markdown and a typesetting file, and a PDF if you ask. Each note gives a quotation, then its citation."],
    ["verification", "Verification table", "A table, kept apart from the report, of where each quotation was copied from and how it was checked, as recorded."],
    ["ledger", "Evidence ledger", "What is recorded behind each sentence. It does not judge whether a sentence is supported."],
  ];
  return {
    name: "report-build",
    title: "What goes into a report",
    desc: "Four inputs lead into the report build, which leads to three outputs.",
    layout: { kind: "flow" },
    nodes: [
      ...inputs.map(([id, label]) => ({ id, label })),
      { id: "build", label: "Build the report", focus: true },
      ...outputs.map(([id, label]) => ({ id, label, shape: "document" as const })),
    ],
    edges: [...inputs.map(([from]) => ({ from, to: "build" })), ...outputs.map(([to]) => ({ from: "build", to }))],
    text: { label: "What goes into the build and what comes out", ordered: false, entries: [
      ...inputs.map(([, term, says]) => ({ term: `${term} → Build the report`, says })),
      ...outputs.map(([, term, says]) => ({ term: `Build the report → ${term}`, says })),
    ] },
  };
}

const STANCES: Record<string, { word: string; opposing: boolean }> = {
  supports: { word: "Supports", opposing: false },
  qualifies: { word: "Qualifies", opposing: false },
  contradicts: { word: "Contradicts", opposing: true },
};

/**
 * The notes drawn against the PostgreSQL example's thesis: each note's ID, the
 * stance the drawing expects it to have, and short names for the note and its
 * source. The stance, the note's words and the counts are read from the records.
 */
const EVIDENCE: { note: string; stance: string; about: string; key: string; source: string }[] = [
  { note: "nte-pd90f85235xyze7vw8fc", stance: "supports", about: "a process each", key: "pg18arch", source: "Docs: architecture" },
  { note: "nte-z9sqdkahbc2zfpdz1wag", stance: "supports", about: "one writer", key: "pg18ha", source: "Docs: replication" },
  { note: "nte-557w7g02frgy189wr6zk", stance: "qualifies", about: "version 19", key: "pg19notes", source: "Release notes: 19" },
  { note: "nte-e3pkjfnm60np9wjepk6h", stance: "contradicts", about: "storage", key: "pavlo2023", source: "Pavlo and Zhang, 2023" },
];

/** Part of an example's evidence: its thesis, some notes that bear on it, and their sources. */
export function evidence(example = exampleDir("postgres-web-apps")): Diagram {
  const byId = new Map(["claims", "attestations", "notes", "sources", "passages"].flatMap((kind) => readRecords(example, kind)).map((r) => [r.id as string, r]));
  const theses = [...byId.values()].filter((r) => r.kind === "claim" && r.role === "thesis");
  if (theses.length !== 1) throw new Error("the example no longer has one thesis; redraw its evidence");
  const thesis = theses[0]!;
  const links = [...byId.values()].filter((r) => r.kind === "attestation" && r.claim === thesis.id);
  const unreviewed = (r: any) => r.review?.state === "unreviewed";
  const drawn = EVIDENCE.map((row) => {
    const link = links.find((a) => a.evidence === row.note);
    const note = byId.get(row.note);
    const source = note && byId.get(note.source);
    if (!link || !note || !source) throw new Error(`${row.note} no longer bears on the thesis; redraw the evidence`);
    if (link.stance !== row.stance) throw new Error(`${row.note} now ${link.stance} the thesis, not ${row.stance}; redraw the evidence`);
    if (source.citation_key !== row.key) throw new Error(`${row.note} no longer rests on ${row.key}; redraw the evidence`);
    for (const passage of note.passages) if (!byId.has(passage)) throw new Error(`${row.note} names a missing passage`);
    if (![thesis, link, note].every(unreviewed)) throw new Error("part of the drawn evidence has been reviewed; reword its caption");
    return { ...row, ...STANCES[row.stance]!, body: String(note.body), passages: note.passages.length as number, title: String(source.title.value) };
  });
  return {
    name: "evidence",
    title: "What bears on a thesis",
    desc: `A thesis and ${drawn.length} of the notes linked to it: ${drawn.map((d) => `one ${d.word.toLowerCase()} it`).join(", ")}. Each note rests on one source.`,
    layout: { kind: "flow" },
    nodes: [
      ...drawn.map((d, i) => ({ id: `s${i}`, label: d.source, shape: "document" as const })),
      ...drawn.map((d, i) => ({ id: `n${i}`, label: `${d.word}: ${d.about}` })),
      { id: "thesis", label: "Thesis", focus: true, doubled: true },
    ],
    edges: [
      ...drawn.map((_, i) => ({ from: `s${i}`, to: `n${i}` })),
      ...drawn.map((d, i) => ({ from: `n${i}`, to: "thesis", ...(d.opposing ? { opposing: true } : {}) })),
    ],
    text: {
      label: `The thesis, and ${drawn.length} of the ${links.length} notes linked to it`, ordered: false,
      entries: [
        { term: `Thesis (confidence: ${thesis.confidence})`, says: String(thesis.text) },
        ...drawn.map((d) => ({
          term: `${d.source} → ${d.word}: ${d.about} → Thesis`,
          says: `${d.body} This note ${d.word.toLowerCase()} the thesis. It rests on ${d.passages === 1 ? "one passage" : `${d.passages} passages`} of “${d.title}”.`,
        })),
      ],
    },
  };
}

export const DIAGRAMS: (() => Diagram)[] = [chain, compare, locators, reportBuild, () => evidence()];

/** The files each diagram is drawn into, under website/generated/diagrams/. */
export const files = (d: Diagram): string[] =>
  (d.layout.kind === "grid" ? [`${d.name}.svg`, `${d.name}-narrow.svg`] : [`${d.name}.svg`]);
