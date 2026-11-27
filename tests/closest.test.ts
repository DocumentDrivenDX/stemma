// `findClosest` reads far less of the text than a full table would. It must give
// exactly what the full table gives, ties included, so it is compared here with
// that plain form on many small texts.
import { expect, test } from "bun:test";
import { CLOSEST_SHARE, type Closest, findClosest, type Folded, fold, foldQuotation, insideWord, NEAR_SHARE, type Within } from "../packages/core/src/matching/quote-fold.ts";

/** Every cell of the table for the whole text, every candidate sorted, the first 40 distinct spans tried. */
function plain(stored: Folded, quotation: string, within: Within): Closest | undefined {
  const needle = foldQuotation(quotation).text;
  const m = needle.length;
  if (m === 0) return undefined;
  const limit = Math.floor(m * CLOSEST_SHARE);
  const hay = stored.text;
  const distances = (a: string, b: string): number => {
    let row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      row = next;
    }
    return row[b.length]!;
  };
  let column = Array.from({ length: m + 1 }, (_, i) => ({ cost: i, start: 0 }));
  const candidates: { start: number; end: number; distance: number }[] = [];
  for (let j = 0; j < hay.length; j++) {
    const next = [{ cost: 0, start: j + 1 }];
    for (let i = 1; i <= m; i++) {
      // On a tie the diagonal is kept, then the cell to the left.
      let best = { cost: column[i - 1]!.cost + (needle[i - 1] === hay[j] ? 0 : 1), start: column[i - 1]!.start };
      if (column[i]!.cost + 1 < best.cost) best = { cost: column[i]!.cost + 1, start: column[i]!.start };
      if (next[i - 1]!.cost + 1 < best.cost) best = { cost: next[i - 1]!.cost + 1, start: next[i - 1]!.start };
      next.push(best);
    }
    column = next;
    if (column[m]!.cost <= limit) candidates.push({ start: column[m]!.start, end: j + 1, distance: column[m]!.cost });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.start - b.start || a.end - b.end);
  let best: Closest | undefined;
  const tried = new Set<string>();
  for (const candidate of candidates) {
    if (tried.size >= 40) break;
    let { start, end } = candidate;
    while (start < end && hay[start] === " ") start++;
    while (end > start && hay[end - 1] === " ") end--;
    while (start > 0 && (insideWord(hay, start) || !stored.starts[start])) start--;
    while (end < hay.length && (insideWord(hay, end) || !stored.starts[end])) end++;
    if (end <= start || tried.has(`${start} ${end}`)) continue;
    const span = { start: stored.from[start]!, end: stored.to[end - 1]! };
    if (!within(span)) continue;
    tried.add(`${start} ${end}`);
    const distance = distances(needle, hay.slice(start, end));
    if (distance <= limit && (!best || distance < best.distance)) best = { ...span, distance, near: distance <= m * NEAR_SHARE };
  }
  return best;
}

test("the closest text is what the full table gives, with and without a stretch to stay within", () => {
  let seed = 20260105;
  const int = (n: number) => Math.floor(((seed = (Math.imul(seed, 1103515245) + 12345) >>> 1) / 2147483648) * n);
  // A narrow alphabet gives many ties and many candidates; the others, the folds.
  const alphabets = [["a", "a", "a", "b", " "], ["a", "b", "c", "d", "e", " ", " ", ".", "-", "\n", "'"],
    ["a", "t", "h", "e", " ", "-", "-\n", "­", "ﬁ", "é", "é", "“", '"', "\n", "  ", "𝒜", "東"]];
  const make = (a: string[], n: number) => Array.from({ length: n }, () => a[int(a.length)]!).join("");
  let near = 0;
  for (let i = 0; i < 1500; i++) {
    const alphabet = alphabets[int(alphabets.length)]!;
    const text = make(alphabet, int(i % 25 === 0 ? 1500 : 200));
    const from = int(text.length + 1);
    // Mostly a piece of the text with a few units changed; sometimes long enough for several blocks of 32.
    const piece = [...text.slice(from, from + 1 + int(i % 7 === 0 ? 150 : 40))];
    for (let k = int(1 + piece.length / (1 + int(6))); k > 0; k--) piece.splice(int(piece.length + 1), int(2), ...(int(2) ? [make(alphabet, 1)] : []));
    const quotation = int(4) === 0 ? make(alphabet, int(60)) : piece.join("");
    const stored = fold(text, "stored");
    const whole = findClosest(stored, quotation);
    expect(whole).toEqual(plain(stored, quotation, () => true));
    if (whole?.near) near++;
    const start = Math.max(0, from - int(20));
    const region = { start, end: Math.min(text.length, start + int(120)) };
    const within: Within = (span) => span.start >= region.start && span.end <= region.end;
    expect(findClosest(stored, quotation, within, region)).toEqual(plain(stored, quotation, within));
  }
  expect(near).toBeGreaterThan(100);
});
