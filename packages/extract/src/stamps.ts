// Download stamps (CONTRACT-007 I): the line a library or publisher adds to the
// copy it serves, saying who took it, from where and when. It is data about a
// person and no part of the work. Each rule matches a whole stamp, so that the
// work's own words are not taken for one. What is removed is never recorded.
export const STAMP_RULES_VERSION = "1";

export type StampRule = "annual_reviews" | "jstor" | "taylor_francis" | "wiley";

export interface Removal { kind: "download_stamp"; rule: StampRule; rules_version: string }

const ADDRESS = String.raw`(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4})`;
const DAY = String.raw`(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}`;
const CLOCK = String.raw`\d{1,2}:\d{2}:\d{2}`;
const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";

const RULES: [StampRule, RegExp][] = [
  ["annual_reviews", new RegExp(String.raw`Downloaded\s+from\s+(?:https?://)?(?:www\.)?annualreviews\.org\.?[\s\S]{0,200}?\bIP:\s*${ADDRESS}\s+On:\s*${DAY}\s+${CLOCK}`, "g")],
  ["jstor", new RegExp(String.raw`This\s+content\s+downloaded\s+from\s+${ADDRESS}\s+on\s+${DAY},?\s+${CLOCK}(?:\s*(?:AM|PM))?\s+(?:UTC|GMT|\+00:00)(?:\s*All\s+use\s+subject\s+to\s+(?:https?://about\.jstor\.org/terms|JSTOR\s+Terms\s+and\s+Conditions))?`, "g")],
  ["taylor_francis", new RegExp(String.raw`Downloaded\s+by\s+\[[^\]]{1,200}\]\s+at\s+\d{1,2}:\d{2}\s+\d{1,2}\s+${MONTH}\s+\d{4}`, "g")],
  ["wiley", new RegExp(String.raw`Downloaded\s+from\s+https?://onlinelibrary\.wiley\.com/\S+\s+by\s+[\s\S]{1,300}?,\s*Wiley\s+Online\s+Library\s+on\s+\[\d{1,2}/\d{1,2}/\d{4}\]\.(?:\s*See\s+the\s+Terms\s+and\s+Conditions)?`, "g")],
];

export interface Span { start: number; end: number; rule: StampRule }

/** Where the stamps are, in order and without overlap. */
export function stampSpans(text: string): Span[] {
  const found = RULES.flatMap(([rule, form]) => [...text.matchAll(form)].map((m) => ({ start: m.index, end: m.index + m[0].length, rule })));
  return found.sort((a, b) => a.start - b.start || b.end - a.end).filter((s, i, all) => !all.slice(0, i).some((o) => s.start < o.end));
}

/** One entry for each rule that removed something. */
export const removals = (rules: Iterable<StampRule>): Removal[] =>
  [...new Set(rules)].sort().map((rule) => ({ kind: "download_stamp", rule, rules_version: STAMP_RULES_VERSION }));

export function removeStamps(text: string): { text: string; rules: StampRule[] } {
  const spans = stampSpans(text);
  let out = "";
  let at = 0;
  for (const span of spans) {
    out += text.slice(at, span.start);
    at = span.end;
  }
  return { text: out + text.slice(at), rules: spans.map((s) => s.rule) };
}

/**
 * Takes the stamps out of pieces that make one text when joined, as a PDF page's
 * text items do: a stamp may be one piece, part of one, or run over several.
 * `after` is what joins a piece to the next, such as a line break.
 */
export function removeFromPieces(pieces: { text: string; after: string }[]): { texts: string[]; rules: StampRule[] } {
  const spans = stampSpans(pieces.map((p) => p.text + p.after).join(""));
  let offset = 0;
  const texts = pieces.map((piece) => {
    const from = offset;
    offset += piece.text.length + piece.after.length;
    let out = "";
    let at = 0;
    for (const span of spans) {
      const start = Math.max(0, Math.min(piece.text.length, span.start - from));
      const end = Math.max(0, Math.min(piece.text.length, span.end - from));
      if (end <= start) continue;
      out += piece.text.slice(at, start);
      at = end;
    }
    return out + piece.text.slice(at);
  });
  return { texts, rules: spans.map((s) => s.rule) };
}
