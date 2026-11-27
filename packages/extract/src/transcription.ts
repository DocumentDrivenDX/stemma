// A transcription supplied by a recognition tool the author ran, or typed by a
// person (CONTRACT-007 K). Stemma makes no transcription of its own.
import { parseAttributes, parseBlocks } from "@stemma/records";
import { cleanText, type Converted, type ConvertedPart, converterTool, type Label, Unconvertible } from "./model.ts";

const PAGE = /^<!-- stemma:page((?: [a-z_]+="[^"<>\n]*")+) -->$/;

export function parseTranscription(input: string, method: "ocr" | "manual"): Converted {
  const lines = cleanText(input).split("\n");
  const starts = lines.flatMap((line, i) => (PAGE.test(line) ? [i] : []));
  if (starts.length === 0 || lines.slice(0, starts[0]).some((l) => l.trim() !== "")) {
    throw new Unconvertible('A transcription with blocks must begin each page with a line such as <!-- stemma:page index="0" -->.');
  }
  let previous = -1;
  const parts = starts.map((at, n): ConvertedPart => {
    const values = parseAttributes(PAGE.exec(lines[at]!)![1]!);
    const index = Number(values.index);
    if (!Number.isSafeInteger(index) || index <= previous) throw new Unconvertible("Page indexes must be whole numbers that increase.");
    previous = index;
    const { blocks, problems } = parseBlocks(lines.slice(at + 1, starts[n + 1] ?? lines.length).join("\n"), at + 2);
    if (problems.length > 0) throw new Unconvertible(`The transcription cannot be used: ${problems.map((p) => `${p.code} at line ${p.line}`).join(", ")}.`);
    const status = values.label !== undefined ? "labelled" : values.label_status;
    if (status !== undefined && !values.basis) throw new Unconvertible("A page label, or a statement that there is none, needs its basis.");
    const label: Label = status === undefined ? { status: "undetermined" }
      : { status: status as Label["status"], basis: values.basis!, ...(values.label !== undefined ? { label: values.label } : {}) };
    return { index, label, columns: "undetermined", undetermined: [], blocks };
  });
  return {
    paged: true, coverage: "partial", parts, identity: {}, method, tools: [converterTool],
    notes: ["The text was supplied as a transcription."],
  };
}
