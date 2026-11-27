// A developer script: a large synthetic project, for measuring how `check` and
// `graph export` grow with project size. Nothing in it is a real work. The same
// options give the same bytes.
//
//   .tools/bun scripts/synthetic-project.ts <directory> <sources> [--unmatched <0-100>] [--plain]
//
// The directory must not exist or must be empty. For each source there are about
// 5 passages, 2 notes, 1.5 citations, 1 attestation and half a claim, and 60% of
// sources have a source file of about 30 pages. `--unmatched` is the percentage
// of note extracts and citations whose quotation is not in the source's text,
// half of them nearly there and half absent. Unless `--plain` is given, some
// text is hyphenated at line ends or has ligatures, curly quotation marks and
// footnotes, some sources have no pages, and some records are retired, reviewed
// or damaged, so that most branches of the checks are taken.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type Block, canonical, fileDigest, KINDS, normalizeSentence, recordPath, serializeManifest, serializePart, sha256, streamsOf, textDigest,
} from "../packages/records/src/index.ts";

export interface SyntheticOptions {
  sources: number;
  /** Percentage of extracts and citations whose quotation is not in the text. */
  unmatched?: number;
  variety?: boolean;
  /** Pages of an ordinary source file and of every tenth one: [fewest, most]. */
  pages?: [[number, number], [number, number]];
  seed?: number;
}

interface Made { id: string; src: number; text: string; exact: string; quotation: string; page: number; locator: { label: string; value: string } }

const SYLLABLES = ["ka", "ro", "mi", "ten", "lor", "vas", "pe", "ni", "du", "sal", "cor", "ul", "an", "fi", "gre", "mo", "ta", "sen", "bi", "lu"];
const COMMON = "the of and to in a is that for it as was with be by on not he this are or his from at which but".split(" ");

/** Every file of the project, by project-relative path. */
export function syntheticProject(options: SyntheticOptions): Map<string, string> {
  const N = options.sources;
  const unmatched = options.unmatched ?? 0;
  const variety = options.variety ?? true;
  const [ordinary, long] = options.pages ?? [[8, 30], [100, 200]];
  let seed = options.seed ?? 12345;
  const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 1) / 2147483648;
  const int = (n: number) => Math.floor(random() * n);
  const pick = <T>(a: T[]) => a[int(a.length)]!;
  const vocabulary = Array.from({ length: 8000 }, () => Array.from({ length: 2 + int(3) }, () => pick(SYLLABLES)).join(""));
  const word = () => (random() < 0.45 ? pick(COMMON) : vocabulary[Math.floor(random() * random() * vocabulary.length)]!);
  const words = (n: number) => Array.from({ length: n }, word).join(" ");
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const idOf = (kind: string, n: number) => `${KINDS[kind]!.prefix}syn${n.toString(36).padStart(17, "0")}`;
  const files = new Map<string, string>();
  const stamp = { at: "2026-01-05T09:00:00Z", by: { kind: "model", name: "synthetic" } };
  const record = (kind: string, body: { id: string } & Record<string, unknown>) => {
    files.set(recordPath(kind, body.id), canonical({ schema: "stemma.record/0", kind, created: stamp, ...body }));
  };
  const retirement = { stamp: { at: "2026-02-01T09:00:00Z", by: stamp.by }, reason: "synthetic retirement" };
  const some = (i: number, every: number) => variety && i % every === every - 1;
  const per = (r: number) => Math.round(N * r);
  const nAgents = Math.max(1, per(0.6)), nChapters = 20, nClaims = Math.max(1, per(0.5)), nNotes = per(2), nPassages = per(5), nCitations = per(1.5), nAttestations = per(1), nTexts = Math.max(1, per(0.6));

  const family = Array.from({ length: nAgents }, () => cap(pick(vocabulary)));
  for (let i = 0; i < nAgents; i++) record("agent", { id: idOf("agent", i), name: { family: family[i], given: cap(pick(vocabulary)) } });
  for (let i = 0; i < nChapters; i++) record("chapter", { id: idOf("chapter", i), title: cap(words(5)), order: i + 1, matter: "body" });
  const key = (i: number) => `syn${i}`;
  const listed: string[] = [];
  for (let i = 0; i < N; i++) {
    const contributions = Array.from({ length: [1, 1, 2, 2, 2][i % 5]! }, (_, j) => ({ lid: `a${j + 1}`, role: "author", agent: idOf("agent", (i * 7 + j * 13) % nAgents) }));
    record("source", {
      id: idOf("source", i), citation_key: key(i), type: pick(["article-journal", "book", "chapter", "report"]), title: { value: cap(words(10)) },
      contributions, issued: { edtf: String(1850 + int(176)) },
      bib: [{ name: "container-title", value: { value: cap(words(4)) } }, { name: "volume", value: { value: String(1 + int(90)) } }, { name: "page", value: { value: `${int(500)}-${500 + int(50)}` } }],
      identifiers: [{ scheme: "doi", value: `10.5555/synthetic.${i}` }], tags: [pick(vocabulary)],
      ...(i % 5 === 1 ? { relations: [{ lid: "r1", type: "part_of", target: idOf("source", i - 1) }] } : {}),
      ...(some(i, 97) ? { retired: retirement } : {}),
      intake: "parsed", admission: "candidate",
    });
    if (some(i, 11)) listed.push(idOf("source", i));
  }
  files.set("stemma.json", canonical({ schema: "stemma.project/0", project_id: `synthetic${N}`, format: 0, ...(listed.length > 0 ? { bibliography_include: listed } : {}) }));

  /** Spellings the quotation profile reads as the same, and a footnote now and then. */
  const spell = (line: string): string => {
    if (!variety) return line;
    let out = line;
    const space = out.indexOf(" ", 20);
    if (random() < 0.04 && space > 0) out = `${out.slice(0, space)} ${pick(["ﬁne", "oﬀer", "co­mo", "‘ka’", "“romi”", "café", "café", "Å", "東京の", "𝒜ka", "can't", "well-known"])}${out.slice(space)}`;
    if (random() < 0.03) out = out.replace(" ", "  ");
    return out;
  };
  const hyphenate = (lines: string[]): string => {
    let text = lines.join("\n");
    if (!variety) return text;
    text = text.replace(/(\p{L}{3})(\p{L}{3,})\n/gu, (all, a: string, b: string) => (random() < 0.15 ? `${a}-\n${b} ` : all));
    return text;
  };

  const perText = nPassages / nTexts;
  let passageCount = 0;
  const passages: Made[] = [];
  const textsOf = new Map<number, { main: string; page: number }[]>();
  for (let t = 0; t < nTexts; t++) {
    const src = Math.floor((t * N) / nTexts);
    const paged = !some(t, 13);
    const [fewest, most] = t % 10 === 0 ? long : ordinary;
    const pages = fewest + int(most - fewest + 1);
    const directory = `sources/syn${t}`;
    const textId = idOf("source_text", t);
    const entries: Record<string, unknown>[] = [];
    const info: { digest: string; main: string; notes: string; chapter?: string }[] = [];
    for (let p = 0; p < pages; p++) {
      const lines = Array.from({ length: 40 }, () => spell(words(11)));
      if (variety && p % 7 === 3) lines[2] = `${lines[2]} ${1000 + int(9000)} and ${int(100)} percent`;
      const blocks: Block[] = [{ role: "paragraph", content: hyphenate(lines.slice(0, 20)) }, { role: "paragraph", content: hyphenate(lines.slice(20)) }];
      if (variety && p % 9 === 4) {
        blocks[0]!.content += `<!--stemma:fnref label="1"-->1<!--/stemma:fnref-->`;
        if (!some(t, 8)) blocks.push({ role: "footnote", label: "1", content: spell(words(30)) });
      }
      const chapter = paged ? undefined : String(1 + Math.floor(p / 4));
      const front = paged
        ? { index: p, ...(some(p, 29) ? { label_status: "undetermined" } : { label: some(t, 17) && p === 5 ? "99" : String(p + 1), label_basis: "printed_sequence", label_status: "labelled" }), level: some(t, 19) ? "poor" : "unassessed", method: "text_layer", columns: "1" }
        : { index: p, chapter, label_status: "unpaged", level: "unassessed", method: "markup", columns: "1" };
      const text = serializePart(front, blocks);
      const file = `${paged ? "pages/p" : "sections/s"}${String(p).padStart(4, "0")}.md`;
      // A damaged file: its manifest records another digest.
      files.set(`${directory}/${file}`, some(t, 41) && p === 1 ? `${text}\nedited` : text);
      entries.push({ index: p, file, sha256: fileDigest(text) });
      const streams = streamsOf(blocks);
      info.push({ digest: textDigest(blocks), main: streams.main, notes: streams.notes, ...(chapter ? { chapter } : {}) });
    }
    const original = sha256(`original ${t}`);
    files.set(`${directory}/source.md`, serializeManifest({
      schema: "stemma.record/0", kind: "source_text", id: textId, created: stamp, source: idOf("source", src),
      original: { form: "file", obtained_from: `https://example.invalid/${t}.pdf`, acquired_at: "2026-01-05T09:00:00Z", ...(paged ? { page_count: pages } : {}), files: [{ media_type: "application/pdf", sha256: original, size: 1000000 }] },
      conversion: { method: "text_layer", level: "unassessed", tools: [{ name: "pdfjs-dist", version: "6.5.438" }] }, paged, coverage: "all", pages: entries,
      ...(some(t, 23) ? { retired: retirement } : {}),
    }, ""));
    textsOf.set(src, [...(textsOf.get(src) ?? []), ...info.map((part, page) => ({ main: part.main, page }))]);
    record("upstream", { id: idOf("upstream", t), source: idOf("source", src), url: `https://example.invalid/${t}.pdf`, retrieved_at: "2026-01-05T09:00:00Z", retrieved_by: stamp.by, sha256: original, size: 1000000, media_type: "application/pdf" });
    const response = JSON.stringify({ title: words(10), creator: words(2), publisher: words(3), date: "1900" });
    record("resolution", { id: idOf("resolution", t), source: idOf("source", src), resolver: "crossref", query: `10.5555/synthetic.${src}`, queried_at: "2026-01-05T09:00:00Z", outcome: "found", response, response_sha256: sha256(response), url: "https://example.invalid/api" });
    record("comparison_run", {
      id: idOf("comparison_run", t), source: idOf("source", src), text: textId, method: some(t, 3) ? "supplied_text" : "reconversion", independent: false, against: "a fresh conversion", original_sha256: original, run: stamp,
      pages: info.map((part, p) => ({ index: p, sha256: part.digest, words: 440, differing_words: some(p, 5) ? 2 : 0, agreement_permille: 1000, differences: some(p, 31) ? [{ reading: "ka", other: "ro" }] : [] })),
    });
    if (some(t, 4)) {
      record("text_review", {
        id: idOf("text_review", t), source: idOf("source", src), text: textId, scope: "whole_page", against: "page images", outcome: some(t, 8) ? "flagged" : "agrees",
        reviewed: { at: stamp.at, by: { kind: "person", name: "synthetic reader" } }, pages: [{ index: 0, sha256: info[0]!.digest }, { index: 1, sha256: some(t, 12) ? sha256("stale") : info[1]!.digest }],
        ...(some(t, 8) ? { flags: [{ index: 0, reading: "kar" }] } : {}),
      });
    }
    const wanted = Math.floor((t + 1) * perText) - Math.floor(t * perText);
    for (let k = 0; k < wanted; k++) {
      const p = int(pages);
      const part = info[p]!;
      const notes = part.notes !== "" && k % 4 === 3;
      const stream = notes ? part.notes : part.main;
      const starts = [0];
      for (let c = 0; c < stream.length; c++) if (stream[c] === " " || stream[c] === "\n") starts.push(c + 1);
      const first = int(Math.max(1, starts.length - 40));
      const start = starts[first]!;
      const end = (starts[first + 20 + int(18)] ?? stream.length + 1) - 1;
      // Passage offsets count code points.
      const exact = stream.slice(start, end);
      const points = (n: number) => [...stream.slice(0, n)].length;
      const id = idOf("passage", passageCount++);
      const locator = paged ? { label: "page", value: String(p + 1) } : { label: "chapter", value: part.chapter! };
      record("passage", {
        id, source: idOf("source", src), text: textId,
        anchor: [{ index: p, page_sha256: some(passageCount, 211) ? sha256("changed") : part.digest, stream: notes ? "notes" : "main", start: points(start), end: points(end) }],
        quote: { exact }, locator, ...(some(passageCount, 331) ? { retired: retirement } : {}),
      });
      const quotation = exact.replace(/(\p{L})[-‐­]\n(?=\p{L})/gu, "$1").replace(/­/g, "").replace(/\s+/g, " ").trim();
      passages.push({ id, src, text: textId, exact, quotation, page: p, locator });
    }
  }

  /** A quotation that is not in the text: one with some words changed, or other words altogether. */
  const wrong = (quotation: string, near: boolean): string => {
    if (!near) return cap(words(25));
    const parts = quotation.split(" ");
    for (let i = 0; i < 1 + int(2); i++) parts[1 + int(Math.max(1, parts.length - 2))] = `${pick(vocabulary)}x`;
    return parts.join(" ");
  };
  /** Every `100 / unmatched`th one, alternating between nearly there and absent. */
  const missed = (i: number): "near" | "absent" | undefined => {
    const n = Math.floor(((i + 1) * unmatched) / 100);
    return n > Math.floor((i * unmatched) / 100) ? (n % 2 === 0 ? "near" : "absent") : undefined;
  };

  const review = { state: "unreviewed" };
  for (let i = 0; i < nNotes; i++) {
    const passage = passages[i % passages.length]!;
    const type = ["extract", "paraphrase", "comment"][i % 3]!;
    const miss = type === "extract" ? missed(Math.floor(i / 3)) : undefined;
    const body = type !== "extract" ? `${cap(words(60))}.` : miss ? wrong(passage.quotation, miss === "near") : passage.quotation;
    record("note", { id: idOf("note", i), type, source: idOf("source", passage.src), passages: [passage.id], body, ...(type === "extract" ? { locator: passage.locator } : {}), review });
  }
  for (let i = 0; i < nClaims; i++) record("claim", { id: idOf("claim", i), text: `${cap(words(25))}.`, role: pick(["thesis", "claim", "claim", "claim", "rival_reading", "objection"]), chapters: [idOf("chapter", i % nChapters)], review: some(i, 5) ? { state: "reviewed" } : review });
  for (let i = 0; i < nAttestations; i++) record("attestation", { id: idOf("attestation", i), claim: idOf("claim", i % nClaims), evidence: passages[(i * 3) % passages.length]!.id, stance: pick(["supports", "partly_supports", "qualifies", "contradicts", "context"]), basis: words(15), review });
  for (let i = 0; i < nCitations; i++) {
    const passage = passages[(i * 2 + (i >= passages.length / 2 ? 1 : 0)) % passages.length]!;
    const miss = missed(i);
    // A citation with no passage is compared with every source file of its work.
    const typed = miss !== undefined || some(i, 6);
    let quotation = miss ? wrong(passage.quotation, miss === "near") : passage.quotation;
    if (!miss && typed && i % 2 === 0) quotation = quotation.replaceAll("'", "’");
    // A page that is not the one the words are on, a page past the end, and one that cannot be read.
    const locator = some(i, 15) ? { label: "page", value: String(passage.page + 2) } : some(i, 37) ? { label: "page", value: "900-910" } : some(i, 53) ? { label: "page", value: "viii?" } : passage.locator;
    const sentence = normalizeSentence(`${cap(words(10))}${some(i, 7) ? ` ${1000 + (i % 7)}1 or ${int(100)}%` : ""}: “${quotation}”.`);
    record("citation", {
      id: idOf("citation", i), chapter: idOf("chapter", i % nChapters), key: some(i, 89) ? "nosuchkey" : key(passage.src),
      ...(typed ? {} : { passage: passage.id }), quotation, locator, claims: [idOf("claim", i % nClaims)], sentence: { text: sentence, sha256: sha256(sentence) }, intake: "parsed",
    });
  }
  return files;
}

export function writeSyntheticProject(directory: string, options: SyntheticOptions): number {
  if (existsSync(directory) && readdirSync(directory).length > 0) throw new Error(`${directory} is not empty. Nothing was written.`);
  const files = syntheticProject(options);
  for (const [path, text] of files) {
    const full = join(directory, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return files.size;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const [directory, count] = args;
  const at = args.indexOf("--unmatched");
  if (!directory || !/^[1-9]\d*$/.test(count ?? "")) {
    console.error("usage: synthetic-project.ts <empty directory> <sources> [--unmatched <0-100>] [--plain]");
    process.exit(2);
  }
  const written = writeSyntheticProject(directory, { sources: Number(count), unmatched: at < 0 ? 0 : Number(args[at + 1]), variety: !args.includes("--plain") });
  console.log(`wrote ${written} files to ${directory}`);
}
