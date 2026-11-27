import { expect, test } from "bun:test";
import { searchFold } from "@stemma/records";

test.each([
  ["Ḥusayn", "husayn"],
  ["Ibn al-ʿArabī", "ibn al-arabi"],
  ["Qur’ān", "quran"],
  ["François Müller", "francois muller"],
  ["Søren Łódź Straße", "soren lodz strasse"],
  // Greek: polytonic accents and breathings, and final sigma however it was typed.
  ["ὈΔΥΣΣΕΎΣ", "οδυσσευσ"],
  ["λόγος", "λογοσ"],
  // Arabic: vowel signs, shadda, hamza carriers and tatweel.
  ["مُحَمَّد", "محمد"],
  ["أَحْمَد", "احمد"],
  ["كـتاب", "كتاب"],
])("search-fold turns %s into %s", (stored, folded) => {
  expect(searchFold(stored)).toBe(folded);
  // A query typed without the marks folds to the same key, and folding twice changes nothing.
  expect(searchFold(folded)).toBe(folded);
});

test("marks that carry a sound in other scripts stay", () => {
  expect(searchFold("が")).toBe("が");
  expect(searchFold("한글")).toBe("한글");
});
