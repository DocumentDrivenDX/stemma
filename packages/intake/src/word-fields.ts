// Names reference-manager and citation fields by their instruction or tag. It
// decodes nothing. These forms come from research reading and are untested on
// files saved by the tools named.
import type { WordFieldKind } from "./word-reading.ts";

const INSTRUCTIONS: [RegExp, WordFieldKind][] = [
  // Zotero's citation instruction also holds `CSL_CITATION`, so it comes first.
  [/^ADDIN\s+ZOTERO_/i, "zotero"],
  [/^ADDIN\s+(?:CSL_CITATION|CSL_BIBLIOGRAPHY|Mendeley\b)/i, "mendeley"],
  [/^ADDIN\s+EN\./i, "endnote"],
  [/^ADDIN\s+CITAVI\./i, "citavi"],
  [/^CITATION\b/i, "word_citation"],
  [/^BIBLIOGRAPHY\b/i, "word_bibliography"],
];

export const instructionKind = (instruction: string): WordFieldKind =>
  INSTRUCTIONS.find(([pattern]) => pattern.test(instruction.trim()))?.[1] ?? "other";

/** The kind of a content control's tag, when a reference manager's. */
export function tagKind(tag: string): WordFieldKind | undefined {
  if (/^MENDELEY_(?:CITATION|BIBLIOGRAPHY)/i.test(tag)) return "mendeley";
  if (/^Citavi(?:Placeholder|Bibliography)/i.test(tag)) return "citavi";
  if (/^ZOTERO_/i.test(tag)) return "zotero";
  const kind = instructionKind(tag);
  return kind === "other" || kind.startsWith("word_") ? undefined : kind;
}
