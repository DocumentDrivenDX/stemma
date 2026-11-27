// The process that reads a PDF, under a bound on its memory. It does one of two
// jobs: the whole text of an original for a command that converts or compares it
// (CONTRACT-002 B, "Reading a PDF"), or one page to place a highlight
// (CONTRACT-005 M, "Highlighting on originals"). A command or the local server
// starts one for each job, sends it the file's bytes, and ends it. It opens no
// listener, gets no secret, makes no request, and writes no file.
import { PdfUnreadable, readPdf } from "../../extract/src/index.ts";
import { locateOnPage } from "../../extract/src/pdf-highlight.ts";
import { noHighlight } from "../../core/src/highlight.ts";
import type { HighlightWork } from "../../server/src/highlighter.ts";
import { guard } from "./memory-guard.ts";
import type { ReadReply, ReadWork } from "./pdf-reading.ts";

async function loadQuietly(): Promise<void> {
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try {
    await import("pdfjs-dist/legacy/build/pdf.mjs");
  } finally {
    Object.assign(console, { log, warn });
  }
}

async function whole(work: ReadWork): Promise<ReadReply> {
  try {
    await guard(work.memory);
    if (work.loadedBefore) await loadQuietly();
    return { text: await readPdf(work.bytes, work.limits) };
  } catch (error) {
    if (error instanceof PdfUnreadable) return { problem: error.problem };
    return { failed: error instanceof Error ? error.message : String(error) };
  }
}

const page = (work: HighlightWork) => guard(work.memory)
  .then(() => locateOnPage(work.bytes, work.target))
  .catch(() => noHighlight("failed"));

process.on("disconnect", () => process.exit(0));
process.once("message", (work: HighlightWork | ReadWork) => {
  void ("limits" in work ? whole(work) : page(work)).then((answer) => process.send!(answer));
});
