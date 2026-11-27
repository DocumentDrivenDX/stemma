// The worked example as the site reads it: its records and the manifest and pages
// of its source files. Nothing about the example is typed into the site twice.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const EXAMPLE = join(import.meta.dir, "../../examples/coral-reefs");

export const records = (kind: string): any[] =>
  readdirSync(join(EXAMPLE, "records", kind)).filter((f) => f.endsWith(".json")).sort()
    .map((f) => JSON.parse(readFileSync(join(EXAMPLE, "records", kind, f), "utf8")));

export const frontMatter = (path: string): any => {
  const text = readFileSync(join(EXAMPLE, path), "utf8");
  const end = text.indexOf("\n---\n", 4);
  if (!text.startsWith("---\n") || end < 0) throw new Error(`${path} has no front matter`);
  return JSON.parse(text.slice(4, end));
};

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
