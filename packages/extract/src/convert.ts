// One entry for every format. Converters read bytes, write nothing, open no
// connection, and run nothing found in a file.
import { convertDocx } from "./docx.ts";
import { convertEpub } from "./epub.ts";
import { convertHtml } from "./html.ts";
import { type Converted, Unconvertible } from "./model.ts";
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

/** Every format but PDF, which needs the page labels chosen first (`convertPdf`). */
export function convertMarkupOrText(bytes: Uint8Array, mediaType: string): Converted {
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
