// Bidirectional, format and control characters in untrusted text are shown, not
// obeyed: they can reorder or hide what a reader sees. Line feeds and tabs stay.

const HIDDEN = /(?![\n\t])[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

export type TextPiece = { text: string } | { control: string };

const codeOf = (character: string): string => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

/** The text in order, with each hidden character given as its code point. */
export function splitControls(text: string): TextPiece[] {
  const pieces: TextPiece[] = [];
  let at = 0;
  for (const match of text.matchAll(HIDDEN)) {
    if (match.index > at) pieces.push({ text: text.slice(at, match.index) });
    pieces.push({ control: codeOf(match[0]) });
    at = match.index + match[0].length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at) });
  return pieces;
}

/** For plain text output: `[U+202E]` where a hidden character stood. */
export const showControls = (text: string): string => text.replace(HIDDEN, (c) => `[${codeOf(c)}]`);
