// Words, names, and year forms as the author-date profile defines them
// (CONTRACT-003 H). Changing a rule here makes a new profile version.

export const PROFILE = "author-date/1";

/** Case, diacritics, and apostrophe and hyphen forms folded away. */
export const fold = (text: string): string =>
  text.normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[’‘ʼ′´`＇]/g, "'")
    .replace(/[‐‑‒–—―−﹘﹣－]/g, "-")
    .toLowerCase().replace(/\s+/g, " ").trim();

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `text` holds `phrase` as whole words, after folding. */
export const holdsWords = (text: string, phrase: string): boolean =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(fold(phrase))}(?![\\p{L}\\p{N}])`, "u").test(fold(text));

const YEAR = String.raw`(?<![\p{L}\p{N}])(?<!\p{N}\.)(?:(?:1\d{3}|20\d{2})[a-z]?(?![\p{L}\p{N}])(?!\.\p{N})|(?:[Nn]\.\s?[Dd]\.|[Ff]orthcoming(?![\p{L}\p{N}])|[Ii]n [Pp]ress(?![\p{L}\p{N}])))`;

export interface YearForm {
  start: number;
  end: number;
  /** Four digits, or `n.d.`, `forthcoming`, or `in press`. */
  year: string;
  suffix: string;
}

const yearForm = (found: string, start: number): YearForm => {
  const numbered = /^(\d{4})([a-z]?)$/.exec(found);
  const word = fold(found);
  return {
    start, end: start + found.length,
    year: numbered ? numbered[1]! : word.startsWith("n") ? "n.d." : word,
    suffix: numbered ? numbered[2]! : "",
  };
};

export const yearForms = (text: string): YearForm[] =>
  [...text.matchAll(new RegExp(YEAR, "gu"))].map((m) => yearForm(m[0], m.index));

/** The year form that starts exactly at `at`. */
export function yearAt(text: string, at: number): YearForm | undefined {
  const pattern = new RegExp(YEAR, "yu");
  pattern.lastIndex = at;
  const found = pattern.exec(text);
  return found ? yearForm(found[0], at) : undefined;
}

const PARTICLES = new Set(("van von de der den du da di del della des la le ten ter zu zur dos das do el al bin ibn af av op y").split(" "));
const CONNECTORS = new Set(["of", "for", "the", "on"]);

export const MONTHS = new Set(("january february march april may june july august september october november december spring summer autumn fall winter").split(" "));

/** Capitalized words that open a sentence or a bracket and begin no name. */
export const SENTENCE_WORDS = new Set((
  "accordingly according after also although and as because before both but cf compare contra contrary consequently conversely earlier especially even " +
  "finally first following for from furthermore hence here however if in indeed instead later like likewise moreover nevertheless " +
  "now on or recently second see similarly since so then there thus though unlike when whereas where while with yet"
).split(" "));

export const isInitials = (word: string): boolean => /^(?:\p{Lu}\.-?)+$/u.test(word);

export const isCapitalWord = (word: string): boolean =>
  /^(?:(?:d['’]|l['’]|al-|el-)(?=\p{Lu}))?[\p{Lu}\p{Lt}\p{Lo}][\p{L}\p{M}'’‐‑-]*$/u.test(word) || word === "St.";

export const isParticle = (word: string): boolean => PARTICLES.has(word);
export const isConnector = (word: string): boolean => CONNECTORS.has(word);

/** One name: capitalized words, with particles before or between and connectors between. It ends in a capitalized word. */
export function isName(name: string): boolean {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0 || !isCapitalWord(words.at(-1)!)) return false;
  return words.every((w, i) => isCapitalWord(w) || isInitials(w) || isParticle(w) || (i > 0 && isConnector(w)));
}

export const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);
