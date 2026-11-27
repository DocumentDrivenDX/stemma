// One entry for every format. Converters read bytes, write nothing, open no
// connection, and run nothing found in a file.
import { convertDocx } from "./docx.ts";
import { convertEpub } from "./epub.ts";
import { convertHtml } from "./html.ts";
import { type Converted, type ConvertedPart, Unconvertible } from "./model.ts";
import { removals, removeStamps, type StampRule } from "./stamps.ts";
import { convertMarkdown, convertText } from "./text.ts";

export { convertPdf, PDF_RULES } from "./pdf-structure.ts";
export { convertDocx, convertEpub, convertHtml, convertMarkdown, convertText };

const decode = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Unconvertible("The file is not valid UTF-8 text.");
  }
};

/** Takes download stamps out of parts made from markup, text or a transcription. */
export function withoutStamps(converted: Converted): Converted {
  const parts = converted.parts.map((part): ConvertedPart => {
    const rules: StampRule[] = [];
    const blocks = part.blocks.flatMap((b) => {
      const cleaned = removeStamps(b.content);
      if (cleaned.rules.length === 0) return [b];
      rules.push(...cleaned.rules);
      const content = cleaned.text.replace(/^\s*\n|\n\s*$/g, "");
      return content.trim() === "" ? [] : [{ ...b, content }];
    });
    return rules.length === 0 ? part : { ...part, blocks, removed: removals(rules) };
  });
  return { ...converted, parts };
}

/** Every format but PDF, which needs the page labels chosen first (`convertPdf`). */
export function convertMarkupOrText(bytes: Uint8Array, mediaType: string): Converted {
  return withoutStamps(converted(bytes, mediaType));
}

function converted(bytes: Uint8Array, mediaType: string): Converted {
  switch (mediaType) {
    case "text/plain": return convertText(decode(bytes));
    case "text/markdown": return convertMarkdown(decode(bytes));
    case "text/html":
    case "application/xhtml+xml": return convertHtml(decode(bytes));
    case "application/epub+zip": return convertEpub(bytes);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return convertDocx(bytes);
    default: throw new Unconvertible(`No converter reads ${mediaType}. A page image's text must come as a transcription.`);
  }
}
