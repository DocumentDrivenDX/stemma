// A brute-force reading of CONTRACT-005 M, "Search", for tests: it shares no
// code with the server's search but `search-fold`, and is as plain as it can be.
import { searchFold } from "@stemma/records";

export interface OracleEntry { type: string; key: string; label: string; text: string }

export function scan(entries: OracleEntry[], sent: string, types: string[]): { keys: string[]; counts: Map<string, number> } {
  const text = searchFold(sent);
  const words = text.split(" ").filter(Boolean);
  const wordStart = (of: string, word: string) => ` ${of}`.includes(` ${word}`);
  const found: { id: string; type: string; score: number; order: number }[] = [];
  entries.forEach((e, order) => {
    const byId = e.key.toLowerCase() === text.toLowerCase();
    if (!byId && !words.every((w) => e.text.indexOf(w) >= 0)) return;
    const head = searchFold(e.label);
    const score = byId ? Number.MAX_SAFE_INTEGER : words.reduce((sum, w) => sum + (head.includes(w) ? (wordStart(head, w) ? 4 : 3) : wordStart(e.text, w) ? 2 : 1), 0);
    found.push({ id: `${e.type} ${e.key}`, type: e.type, score, order });
  });
  const counts = new Map<string, number>();
  for (const f of found) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
  const rank = new Map(types.map((t, i) => [t, i]));
  found.sort((a, b) => b.score - a.score || rank.get(a.type)! - rank.get(b.type)! || a.order - b.order);
  return { keys: found.map((f) => f.id), counts };
}

/** The record browser's search query as arras 0.8.1 sends it, taken from a run of the served page. */
export const BROWSER_QUERY = "query($text: String!, $types: [String!], $limit: Int) { _search(text: $text, types: $types, limit: $limit) { text hits { type key score label excerpt { text mark } matched entity { key type  } } counts { type count atLeast } notSearched { type reason backend } truncated freshness { backend asOf at consistency } } }";
