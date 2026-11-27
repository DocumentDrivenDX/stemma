// The `search-fold` profile (CONTRACT-005 F and H; SD-011): derived search keys
// that match across diacritics. The same function folds the indexed text and the
// query. It changes derived keys only, never a record. A change to any rule
// below needs a new version.

export const SEARCH_FOLD_VERSION = "search-fold/0";

/**
 * Marks that are removed after compatibility decomposition: general combining
 * diacritics (Latin, Greek, Cyrillic), Hebrew points and accents, and Arabic
 * vowel signs, hamza and madda marks. Marks of other scripts, where they carry
 * the sound of a word, stay.
 */
const MARKS = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-֑︯-ׇֽֿׁׂׅׄؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g;

/**
 * Removed: signs that transliterations write for ayn and hamza, apostrophes and
 * primes that stand in for them, the Arabic tatweel and the soft hyphen.
 */
const DROPPED = /['­ـʹ-ʿˈ‘’‛′Ꞌꞌꜣꜥ]/g;

/** Letters that do not decompose into a base letter and a mark. Applied after lower case. */
const LETTERS: Record<string, string> = {
  "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "ħ": "h",
  "ı": "i", "ß": "ss", "þ": "th",
  // Greek final sigma and lunate sigma.
  "ς": "σ", "ϲ": "σ",
  // Arabic alef wasla and alef maqsura.
  "ٱ": "ا", "ى": "ي",
};
const LETTER = new RegExp(`[${Object.keys(LETTERS).join("")}]`, "g");

export function searchFold(text: string): string {
  return text.normalize("NFKD").toLowerCase().normalize("NFKD")
    .replace(MARKS, "").replace(DROPPED, "")
    .replace(LETTER, (c) => LETTERS[c]!)
    .normalize("NFC").replace(/\p{White_Space}+/gu, " ").trim();
}
