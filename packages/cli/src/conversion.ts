// Turns an original into what a source file holds, the same way for a new
// capture and for a later comparison with the original.
import {
  applyPageMap, autoSegments, type ConvertedInput, InvalidInput, LIMITS, parsePageNumbers, type Proposal, proposePageMap, normalizeText,
} from "@stemma/core";
import {
  type Converted, convertMarkupOrText, convertPdf, converterTool, type Label, type PdfText, PdfUnreadable, readPdf, textBlock, Unconvertible, withoutStamps,
} from "@stemma/extract";
import type { PageSegment } from "@stemma/records";

const PDF_PROBLEMS: Record<PdfUnreadable["problem"], string> = {
  encrypted: "This PDF is encrypted and needs a password, so it was not read.",
  damaged: "This PDF is damaged or is not a PDF the reader can take, so it was not read.",
  too_many_pages: `This PDF has more than the limit of ${LIMITS.parts} pages, so it was not read.`,
  too_much_text: `This PDF's text is larger than the limit of ${LIMITS.text_bytes / 1048576} MiB, so it was not converted.`,
  too_slow: `Reading this PDF passed the time limit of ${LIMITS.conversion_seconds} seconds, so it was stopped.`,
};

export async function readPdfCopy(bytes: Uint8Array): Promise<PdfText> {
  try {
    return await readPdf(bytes, { pages: LIMITS.parts, text_bytes: LIMITS.text_bytes, milliseconds: LIMITS.conversion_seconds * 1000 });
  } catch (error) {
    if (!(error instanceof PdfUnreadable)) throw error;
    throw new InvalidInput(`${PDF_PROBLEMS[error.problem]}`);
  }
}

export function proposalFor(pages: string[], embedded?: string[], pageNumbers?: Uint8Array): Proposal {
  const claimed: { from: string; labels: Map<number, string> }[] = [];
  if (pageNumbers) claimed.push({ from: "the supplied page-number data", labels: parsePageNumbers(pageNumbers) });
  if (embedded) claimed.push({ from: "the labels stated inside the PDF", labels: new Map(embedded.flatMap((l, i) => (l ? [[i, l] as const] : []))) });
  return proposePageMap(pages, claimed);
}

export interface ConversionOptions {
  recognized?: boolean;
  pageMap?: PageSegment[];
  autoPages?: boolean;
  pageNumbers?: Uint8Array;
  /** Labels already established, as when an original is converted again for comparison. */
  labels?: Map<number, Label>;
}

export interface Conversion { converted: Converted & ConvertedInput; notes: string[] }

/** What the automatic page map did, to be kept with the source file and shown. */
function autoNotes(proposal: Proposal, dropped: PageSegment[]): string[] {
  const seen = proposal.runs.reduce((n, r) => n + r.seen, 0);
  const total = proposal.runs.reduce((n, r) => n + r.pages, 0);
  return [
    proposal.runs.length === 0 ? "No run of printed page numbers was found, so no page is labelled."
      : `Page labels were proposed from the numbers printed in the pages' own text (the number is seen on ${seen} of ${total} labelled-run pages) and were not compared with page images by this conversion.`,
    ...(dropped.length > 0 ? [`${dropped.length} run(s) repeating labels of a longer run were left unlabelled (page indexes ${dropped.map((s) => `${s.first_index}-${s.last_index}`).join(", ")}).`] : []),
    ...proposal.comparisons.map((c) => `Compared with ${c.from}: the same label on ${c.agree} proposed page(s), another on ${c.differ.length}.`),
  ];
}

export async function convertOriginal(original: { bytes: Uint8Array; media_type: string }, options: ConversionOptions): Promise<Conversion> {
  try {
    if (original.media_type === "application/pdf") {
      const read = await readPdfCopy(original.bytes);
      let segments = options.pageMap;
      let notes: string[] = [];
      if (!segments && options.autoPages) {
        const proposal = proposalFor(read.pages, read.embeddedLabels, options.pageNumbers);
        const chosen = autoSegments(proposal);
        segments = chosen.segments;
        notes = autoNotes(proposal, chosen.dropped);
      }
      const blank = read.pages.map((_, index) => ({ index, label: { status: "undetermined" } as Label }));
      const labels = options.labels ?? new Map(applyPageMap(blank, segments ?? []).map((p) => [p.index, p.label as Label]));
      const converted = convertPdf(read, { recognized: options.recognized === true, labels });
      return { converted: { ...converted, notes: [...converted.notes, ...notes] }, notes };
    }
    const converted = convertMarkupOrText(original.bytes, original.media_type);
    if (options.pageMap) {
      if (!converted.paged) throw new InvalidInput("This text has no pages, so there are no pages to label.");
      converted.parts = applyPageMap(converted.parts, options.pageMap) as Converted["parts"];
    }
    return { converted, notes: [] };
  } catch (error) {
    if (error instanceof Unconvertible) throw new InvalidInput(`${error.message} No source file was written.`);
    throw error;
  }
}

/** Plain text with a form feed after each page, made by a tool the caller ran or typed by a person. */
export function suppliedPages(bytes: Uint8Array, method: "ocr" | "manual", tool?: { name: string; version: string }): Converted {
  const text = normalizeText(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).replace(/\0/g, "");
  const pages = text.split("\f");
  if (pages.length > 1 && !/\S/u.test(pages.at(-1)!)) pages.pop();
  if (!pages.some((p) => /\S/u.test(p))) throw new InvalidInput("There is no machine-readable text: it is empty or only white space.");
  return withoutStamps({
    paged: true, coverage: "all", identity: {}, method, tools: [tool ?? { name: "unknown", version: "unknown" }, converterTool],
    notes: ["The text was supplied; Stemma did not make it and did not compare it with the original."],
    parts: pages.map((page, index) => {
      const trimmed = page.replace(/^\n+|\n+$/g, "");
      return {
        index, label: { status: "undetermined" }, columns: "undetermined",
        undetermined: ["paragraphs", "headings", "footnotes", "block-quotes", "tables", "captions", "figures", "running-heads", "folio"],
        blocks: trimmed.trim() ? [textBlock("undetermined", trimmed)] : [],
      };
    }),
  });
}
