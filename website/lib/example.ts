// The worked examples as the site reads them: their records, and for the Darwin
// book the manifest and pages of its source files. Nothing about an example is
// typed into the site twice.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXAMPLES_ROOT = join(import.meta.dir, "../../examples");

/** The folder of a worked example, by its name under examples/. */
export const exampleDir = (name: string): string => join(EXAMPLES_ROOT, name);

export const EXAMPLE = exampleDir("coral-reefs");

/** The records of one kind (a folder under records/) in an example, in file order. A kind with none has no folder. */
export const readRecords = (example: string, kind: string): any[] => {
  const folder = join(example, "records", kind);
  return existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith(".json")).sort()
    .map((f) => JSON.parse(readFileSync(join(folder, f), "utf8"))) : [];
};

/** The Darwin example's records of one kind. */
export const records = (kind: string): any[] => readRecords(EXAMPLE, kind);

export const frontMatter = (path: string, example = EXAMPLE): any => {
  const text = readFileSync(join(example, path), "utf8");
  const end = text.indexOf("\n---\n", 4);
  if (!text.startsWith("---\n") || end < 0) throw new Error(`${path} has no front matter`);
  return JSON.parse(text.slice(4, end));
};

/** What an example holds, counted from its records: works (a part of another work is not counted), citations, claims and notes. */
export function exampleCounts(example: string) {
  const works = readRecords(example, "sources").filter((s) => !(s.relations ?? []).some((r: any) => r.type === "part_of"));
  const citations = readRecords(example, "citations");
  return {
    works: works.length,
    cited: new Set(citations.map((c) => c.key)).size,
    citations: citations.length,
    claims: readRecords(example, "claims").length,
    notes: readRecords(example, "notes").length,
  };
}

/** The Darwin book: its record, where its original came from, and its source files. */
export function darwinBook() {
  const source = records("sources").find((s) => s.id === "src-darwinreefs1842");
  const upstream = records("upstreams").filter((u) => u.source === source?.id);
  const manifest = frontMatter(`sources/${source?.citation_key}/source.md`);
  if (!source || upstream.length !== 1 || manifest.source !== source.id || manifest.original.files[0].sha256 !== upstream[0].sha256) {
    throw new Error("the example's records no longer form one line of descent");
  }
  const pages: any[] = manifest.pages.map((p: { file: string }) => frontMatter(`sources/${source.citation_key}/${p.file}`));
  const citations = records("citations").sort((a, b) => Number(a.locator.value) - Number(b.locator.value));
  const passages = new Map(records("passages").map((p) => [p.id, p]));
  for (const c of citations) {
    if (c.key !== source.citation_key) throw new Error("a citation in the example names another source");
    if (passages.get(c.passage)?.text !== manifest.id) throw new Error(`${c.id} no longer rests on a passage of this book`);
  }
  return { source, upstream: upstream[0]!, manifest, pages, citations, passages };
}

/** Runs of pages with and without a printed label, in order. */
export function labelRuns(pages: { index: number; label_status: string; label?: string }[]) {
  const runs: { from: number; to: number; first?: string; last?: string }[] = [];
  for (const page of pages) {
    const label = page.label_status === "labelled" ? page.label : undefined;
    const open = runs.at(-1);
    if (open && (open.first === undefined) === (label === undefined)) {
      open.to = page.index;
      if (label !== undefined) open.last = label;
    } else runs.push({ from: page.index, to: page.index, ...(label !== undefined ? { first: label, last: label } : {}) });
  }
  return runs;
}
