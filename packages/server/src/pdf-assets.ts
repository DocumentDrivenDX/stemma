// The parts of the pinned pdf.js the local server holds beyond the page's own
// script (CONTRACT-005 M, "Originals"): the worker and its two image decoders,
// served by name, and the character maps and standard fonts it asks for, given
// only to signed calls. All of it is read once, into memory.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The worker's scripts by the path each is served at, with the name of the file the build writes. */
export const PDF_SCRIPTS: Record<string, string> = {
  "/pdf-worker.js": "pdf-worker.js",
  "/pdfjs/pdf.worker.min.js": "pdf.worker.min.js",
  "/pdfjs/openjpeg_nowasm_fallback.js": "openjpeg_nowasm_fallback.js",
  "/pdfjs/jbig2_nowasm_fallback.js": "jbig2_nowasm_fallback.js",
};

/** The character maps and standard fonts in a directory laid out as the library's, by the names pdf.js is given. Licenses are not data. */
export function pdfData(directory: string): Map<string, Uint8Array> {
  return new Map(["cmaps", "standard_fonts"].flatMap((folder) => readdirSync(join(directory, folder))
    .filter((name) => !name.startsWith("LICENSE"))
    .map((name) => [`${folder}/${name}`, readFileSync(join(directory, folder, name))] as const)));
}
