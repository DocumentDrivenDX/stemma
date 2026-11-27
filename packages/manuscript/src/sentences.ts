// The sentence profile `sentence-split/0` (SD-007 BR-711 to BR-714). A change
// to these rules is a new profile version, because it can end annotations.
export const SENTENCE_PROFILE = "sentence-split/0";

const ABBREVIATIONS = new Set(("e.g. i.e. cf. Cf. viz. vs. Dr. Mr. Mrs. Ms. Prof. Rev. Fr. St. p. pp. f. ff. fol. fols. n. nn. no. " +
  "No. vol. vols. ch. chap. sec. fig. ed. eds. trans. repr. ca. c. fl. b. d. op. ibid. Ibid. vgl. Vgl. z.B. d.h. Bd. Hg. Nr. S.").split(" "));

const CLOSERS = /^["'’”»›)\]」』）]*/u;
const TERMINATOR = /[.?!؟۔。！？]/gu;
const IDEOGRAPHIC = /[。！？]/u;

export interface Range { start: number; end: number }

/** Matched pairs of double quotation marks, and the marks left without a partner. */
export function doubleQuotes(text: string): { pairs: Range[]; unpaired: number[] } {
  const pairs: Range[] = [];
  const unpaired: number[] = [];
  let straight: number | undefined;
  const curly: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (straight === undefined) straight = i;
      else {
        pairs.push({ start: straight, end: i + 1 });
        straight = undefined;
      }
    } else if (text[i] === "“") curly.push(i);
    else if (text[i] === "”") {
      const start = curly.pop();
      if (start === undefined) unpaired.push(i);
      else pairs.push({ start, end: i + 1 });
    }
  }
  unpaired.push(...curly, ...(straight === undefined ? [] : [straight]));
  return { pairs: pairs.sort((a, b) => a.start - b.start || b.end - a.end), unpaired: unpaired.sort((a, b) => a - b) };
}

/** Whether the period at `i` ends a listed abbreviation or an initial (BR-713). */
function abbreviated(text: string, i: number): boolean {
  const token = /[^\s(\[“‘"']*$/u.exec(text.slice(0, i + 1))![0];
  return ABBREVIATIONS.has(token) || /(?:^|\.)\p{Lu}\.$/u.test(token);
}

/**
 * The sentences of one block's plain text, as ranges that leave out the white
 * space between them. No boundary falls inside any of `whole` (BR-712).
 */
export function splitSentences(text: string, whole: Range[] = []): Range[] {
  const ends: number[] = [];
  for (const match of text.matchAll(TERMINATOR)) {
    const i = match.index;
    if (text[i] === "." && abbreviated(text, i)) continue;
    const end = i + 1 + CLOSERS.exec(text.slice(i + 1))![0].length;
    if (!IDEOGRAPHIC.test(text[i]!) && end < text.length) {
      const next = /^\s+/u.exec(text.slice(end))?.[0];
      if (next === undefined || /^\p{Ll}/u.test(text.slice(end + next.length))) continue;
    }
    if (whole.some((r) => r.start < end && end < r.end)) continue;
    ends.push(end);
  }
  const out: Range[] = [];
  let from = 0;
  for (const end of [...ends, text.length]) {
    const piece = text.slice(from, end);
    if (/\S/u.test(piece)) out.push({ start: from + /^\s*/u.exec(piece)![0].length, end: from + piece.trimEnd().length });
    from = Math.max(from, end);
  }
  return out;
}
