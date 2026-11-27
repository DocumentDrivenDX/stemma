// An invented project with invented originals, written to disk, for the original
// pages the served explorer shows (US-121). The records are the source view's
// invented ones; the originals are made here and nothing of them is real.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { temporary } from "./helpers.ts";
import { makePdf, type PdfOptions } from "./pdf.ts";
import { makePng } from "./png.ts";
import { anchorOf, citation, content, LETTER, PAGES, passage, project, type Project, type Rec, sources, standard, VOLUME } from "./source-view-fixture.ts";

export const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Three pages whose words are those of the fixture's pages, and large enough to be seen. */
export const pdfPages: PdfOptions["pages"] = [
  [{ segments: [{ text: "THE REEF 1" }], size: 28 }, { segments: [{ text: "The reef was old. We saw the la-" }], size: 28, y: 700 }],
  [{ segments: [{ text: "goon was deep, and nothing more is known of it." }], size: 22, y: 700 }, { segments: [{ text: "1 An invented note about soundings." }], size: 14, y: 80 }],
  [{ segments: [{ text: "The islets were few." }], size: 28, y: 700 }],
];

export const originalPdf = (more: Partial<PdfOptions> = {}): Uint8Array => makePdf({ pages: pdfPages, ...more });

/** A page image: a coloured band over white, its colour telling which page it is. */
export const originalPng = (index: number): Uint8Array =>
  makePng(600, 800, (_x, y) => (y > 100 && y < 300 ? ([[200, 0, 0], [0, 140, 0], [0, 0, 200]] as const)[index % 3]!.slice() as [number, number, number] : [255, 255, 255]));

export interface Tie { form: string; files: { sha256: string; size: number; media_type: string; index?: number }[]; page_count?: number }

export const pdfTie = (bytes: Uint8Array, pageCount: number | null = 3): Tie => ({
  form: "file", files: [{ sha256: sha(bytes), size: bytes.length, media_type: "application/pdf" }], ...(pageCount === null ? {} : { page_count: pageCount }),
});
export const imageTie = (images: Uint8Array[], media_type = "image/png"): Tie => ({
  form: "page_images", files: images.map((bytes, index) => ({ sha256: sha(bytes), size: bytes.length, media_type, index })),
});

const { one, two, note } = standard();
const islets = passage("psg-islets000001", [anchorOf(PAGES, 2, "main", "The islets were few")], "The islets were few", { locator: { label: "page", value: "3" } });
export const PASSAGES = { one, two, note, islets };
export const CITATION = "cit-onepage00001";

const quotation = (id: string, cites: string, passages: string[]) => ({ id, cites, passages: passages.map((p) => ({ passage: p })) });
const REPORT = {
  manuscript: "report.src",
  quotations: [quotation("one", "volume1850", [one.id]), quotation("two", "volume1850", [two.id]), quotation("islets", "volume1850", [islets.id])],
};
const TEMPLATE = `# A *Report*

The reef: {{q:one}}.[^one] Both {{q:two}}.[^two] And {{q:islets}}.[^islets]

{{bibliography}}
`;

const written = (dir: string, path: string, bytes: Uint8Array | string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), bytes);
};

/** The project's files with a source file tied to `tie`. Written again over the same directory, it changes the project. */
export function writeOriginalsProject(tie: Tie, change: { manifest?: Rec; paged?: boolean; pages?: Project["pages"]; records?: Rec[] } = {}, dir = join(temporary(), "reef")): string {
  const made = content(project({
    sources: sources().map((s) => (s.id === LETTER ? { ...s, type: "personal_communication" } : s)),
    records: change.records ?? [one, two, note, islets, citation(CITATION, one)],
    ...(change.pages ? { pages: change.pages } : {}),
    manifest: { original: { obtained_from: "https://example.invalid/book.pdf", acquired_at: "2026-01-05T09:00:00Z", ...tie }, ...change.manifest },
  }));
  mkdirSync(dir, { recursive: true });
  written(dir, "stemma.json", made.settings.bytes!);
  for (const file of [...made.records, ...made.sources]) written(dir, file.path, file.bytes!);
  written(dir, "report/report.json", JSON.stringify(REPORT));
  written(dir, "report/report.src", TEMPLATE);
  return dir;
}

export const VOLUME_ID = VOLUME;

/** A directory holding the given files, outside any project. */
export function folderOf(files: Record<string, Uint8Array>, dir = join(temporary(), "originals")): string {
  mkdirSync(dir, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) written(dir, name, bytes);
  return dir;
}
