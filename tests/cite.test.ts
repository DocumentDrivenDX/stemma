// Golden tests: the citation formatter's output for each kind of source the
// worked example holds, first and shortened notes and the bibliography, with
// citeproc-js and the pinned Chicago 18 style. A change here is a change in what
// authors' notes say; the strings were reviewed against Chicago practice (see
// SD-008, where what the style does not do is listed).
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { formatCitations, STYLE } from "@stemma/cite";
import { noteClusters, quotedInNote } from "@stemma/publish";
import { loadCorpus } from "@stemma/records";
import { readProject } from "@stemma/workspace";
import { ROOT } from "./helpers.ts";

const corpus = loadCorpus(readProject(join(ROOT, "examples/coral-reefs")));

/** Kind of source, key, first note, and the next note citing it at the same place. */
const GOLDEN: [string, string, string, string][] = [
  ["book, edition", "dana1890", "James D. Dana, *Corals and Coral Islands*, 3rd ed. (Dodd, Mead, and Company, 1890), 292.", "Dana, *Corals and Coral Islands*, 292."],
  ["volume of a multivolume work", "lyell1832", "Charles Lyell, *Principles of Geology* (John Murray, 1832), 2:290.", "Lyell, *Principles of Geology*, 2:290."],
  ["book in a series", "semper1881", "Karl Semper, *Animal Life as Affected by the Natural Conditions of Existence*, The International Scientific Series (D. Appleton and Company, 1881), 232.", "Semper, *Animal Life*, 232."],
  ["memoir in a numbered series", "agassiz1903", "Alexander Agassiz, *The Coral Reefs of the Tropical Pacific*, Memoirs of the Museum of Comparative Zoölogy at Harvard College 28 (Printed for the Museum, 1903), xiii.", "Agassiz, *Coral Reefs of the Tropical Pacific*, xiii."],
  ["chapter in a volume", "david1904-narrative", "T. W. Edgeworth David, “Narrative of the Second and Third Expeditions,” in *The Atoll of Funafuti* (Royal Society of London, 1904), 54.", "David, “Narrative of the Second and Third Expeditions,” 54."],
  ["preface", "bonney1904-preface", "T. G. Bonney, preface to *The Atoll of Funafuti* (Royal Society of London, 1904), vii.", "Bonney, preface, vii."],
  ["appendix by another author", "bonney1889-summary", "T. G. Bonney, “Summary of the Principal Contributions to the History of Coral-Reefs since the Year 1874,” appendix to *The Structure and Distribution of Coral Reefs*, 3rd ed., by Charles Darwin (Smith, Elder, & Co., 1889), 332.", "Bonney, “Summary of the Principal Contributions,” 332."],
  ["letter in a published collection", "darwin-semper1879", "Charles Darwin to Karl Semper, October 2, 1879, in Francis Darwin, ed., *The Life and Letters of Charles Darwin, Including an Autobiographical Chapter*, vol. 3 (John Murray, 1887), 182.", "Darwin to Semper, October 2, 1879, in Darwin, *Life and Letters*, 3:182."],
  ["edited collection", "darwinletters1887", "Darwin, *Life and Letters*, 3:183.", "Darwin, *Life and Letters*, 3:183."],
  ["abstract in proceedings", "darwin1837-areas", "Charles Darwin, “On Certain Areas of Elevation and Subsidence in the Pacific and Indian Oceans, as Deduced from the Study of Coral Formations,” abstract, *Proceedings of the Geological Society of London* 2, no. 51 (1837): 552.", "Darwin, “Areas of Elevation and Subsidence,” 552."],
  ["journal article", "daly1915", "Reginald A. Daly, “The Glacial-Control Theory of Coral Reefs,” *Proceedings of the American Academy of Arts and Sciences* 51, no. 4 (1915): 224.", "Daly, “Glacial-Control Theory,” 224."],
  ["institutional report", "ladd1960", "Harry S. Ladd and Seymour O. Schlanger, *Drilling Operations on Eniwetok Atoll*, Geological Survey Professional Paper 260-Y, Bikini and Nearby Atolls, Marshall Islands (United States Government Printing Office, 1960), 863, https://doi.org/10.3133/pp260Y.", "Ladd and Schlanger, *Drilling Operations on Eniwetok Atoll*, 863."],
  ["article with article number and DOI", "blanchon2014", "Paul Blanchon et al., “Postglacial Fringing-Reef to Barrier-Reef Conversion on Tahiti Links Darwin’s Reef Types,” *Scientific Reports* 4 (2014): 1, https://doi.org/10.1038/srep04997.", "Blanchon et al., “Postglacial Fringing-Reef to Barrier-Reef Conversion,” 1."],
  ["article with DOI and pages", "steibl2024", "Sebastian Steibl et al., “A Renaissance of Atoll Ecology,” *Annual Review of Ecology, Evolution, and Systematics* 55 (2024): 303, https://doi.org/10.1146/annurev-ecolsys-102722-013447.", "Steibl et al., “Renaissance of Atoll Ecology,” 303."],
  ["work of a corporate author, title page", "funafuti1904", "Coral Reef Committee of the Royal Society, *The Atoll of Funafuti* (Royal Society of London, 1904), title page.", "Coral Reef Committee of the Royal Society, *Atoll of Funafuti*, title page."],
];
const LOCATORS = ["292", "290", "232", "xiii", "54", "vii", "332", "182", "183", "552", "224", "863", "1", "303", "title page"];

describe("citations formatted with the pinned style", () => {
  test("the style is Chicago 18th edition notes and bibliography", () => {
    expect(STYLE.title).toBe("Chicago Manual of Style 18th edition (notes and bibliography)");
    expect(STYLE.edition).toBe("18");
  });

  const clusters = GOLDEN.flatMap(([, key], i) => [1, 2].map((k) => ({ note: 2 * i + k, items: [{ key, locator: LOCATORS[i]! }] })));
  const made = formatCitations(corpus, clusters);
  GOLDEN.forEach(([kind, , first, short], i) => {
    test(`${kind}: first and shortened notes`, () => {
      expect(made.citations[2 * i]).toBe(first);
      expect(made.citations[2 * i + 1]).toBe(short);
    });
  });
  test("the bibliography: sorted, a letter under its collection, an article number in place of pages", () => {
    expect(made.bibliography).toEqual([
  "Agassiz, Alexander. *The Coral Reefs of the Tropical Pacific*. Memoirs of the Museum of Comparative Zoölogy at Harvard College 28. Printed for the Museum, 1903.",
  "Blanchon, Paul, Marian Granados-Corea, Elizabeth Abbey, et al. “Postglacial Fringing-Reef to Barrier-Reef Conversion on Tahiti Links Darwin’s Reef Types.” *Scientific Reports* 4 (2014): 4997. https://doi.org/10.1038/srep04997.",
  "Bonney, T. G. Preface to *The Atoll of Funafuti*. Royal Society of London, 1904.",
  "Bonney, T. G. “Summary of the Principal Contributions to the History of Coral-Reefs since the Year 1874.” Appendix to *The Structure and Distribution of Coral Reefs*, 3rd ed., by Charles Darwin. Smith, Elder, & Co., 1889.",
  "Coral Reef Committee of the Royal Society. *The Atoll of Funafuti*. Royal Society of London, 1904.",
  "Daly, Reginald A. “The Glacial-Control Theory of Coral Reefs.” *Proceedings of the American Academy of Arts and Sciences* 51, no. 4 (1915): 157–251.",
  "Dana, James D. *Corals and Coral Islands*. 3rd ed. Dodd, Mead, and Company, 1890.",
  "Darwin, Charles. “On Certain Areas of Elevation and Subsidence in the Pacific and Indian Oceans, as Deduced from the Study of Coral Formations.” Abstract. *Proceedings of the Geological Society of London* 2, no. 51 (1837): 552–54.",
  "Darwin, Francis, ed. *The Life and Letters of Charles Darwin, Including an Autobiographical Chapter*. Vol. 3. John Murray, 1887.",
  "David, T. W. Edgeworth. “Narrative of the Second and Third Expeditions.” In *The Atoll of Funafuti*. Royal Society of London, 1904.",
  "Ladd, Harry S., and Seymour O. Schlanger. *Drilling Operations on Eniwetok Atoll*. Geological Survey Professional Paper 260-Y. Bikini and Nearby Atolls, Marshall Islands. United States Government Printing Office, 1960. https://doi.org/10.3133/pp260Y.",
  "Lyell, Charles. *Principles of Geology*. Vol. 2. John Murray, 1832.",
  "Semper, Karl. *Animal Life as Affected by the Natural Conditions of Existence*. The International Scientific Series. D. Appleton and Company, 1881.",
  "Steibl, Sebastian, Nancy Bunbury, Hillary S. Young, and James C. Russell. “A Renaissance of Atoll Ecology.” *Annual Review of Ecology, Evolution, and Systematics* 55 (2024): 301–22. https://doi.org/10.1146/annurev-ecolsys-102722-013447.",
    ]);
    expect(made.problems).toEqual([]);
  });

  test("text put around an item never passes through the processor", () => {
    const [text] = formatCitations(corpus, [{ note: 1, items: [{ key: "dana1890", locator: "292", before: "“world's 'own' -- text.” " }] }]).citations;
    expect(text).toBe("“world's 'own' -- text.” James D. Dana, *Corals and Coral Islands*, 3rd ed. (Dodd, Mead, and Company, 1890), 292.");
  });

  test("a key that names no source is shown marked and reported, never made up", () => {
    const made = formatCitations(corpus, [{ note: 1, items: [{ key: "nobody1900", locator: "1" }] }]);
    expect(made.citations[0]).toBe("[no source for the key nobody1900]");
    expect(made.problems).toEqual([{ note: 1, key: "nobody1900", problem: "no_source" }]);
  });

  test("no output says ibid., because the pinned style does not", () => {
    const made = formatCitations(corpus, [1, 2, 3].map((note) => ({ note, items: [{ key: "dana1890", locator: "292" }] })));
    expect(made.citations[1]).toBe("Dana, *Corals and Coral Islands*, 292.");
    expect(made.citations[2]).toBe("Dana, *Corals and Coral Islands*, 292.");
  });
});

describe("evidence in a note: quotation, then source", () => {
  test("a quotation keeps its words and gains a full stop inside the marks only when it has no end mark", () => {
    expect(quotedInNote("as te whether")).toBe("“as te whether.”");
    expect(quotedInNote("Future observers must decide between us.")).toBe("“Future observers must decide between us.”");
    expect(quotedInNote("Is there any connection?")).toBe("“Is there any connection?”");
  });

  test("quotations from one page share a citation; another page or work gets its own, so no page is repeated", () => {
    const clusters = noteClusters(7, [
      { cites: "murray1880-structure", members: [{ locator: "510", text: "a" }, { locator: "510", text: "b" }, { locator: "511", text: "c" }] },
      { cites: "darwin-semper1879", members: [{ locator: "182", text: "d" }] },
    ]);
    expect(clusters.map((c) => [c.note, c.items.map((i) => [i.key, i.locator, i.before])])).toEqual([
      [7, [["murray1880-structure", "510", "“a.” “b.” "]]],
      [7, [["murray1880-structure", "511", "“c.” "]]],
      [7, [["darwin-semper1879", "182", "“d.” "]]],
    ]);
    const text = formatCitations(corpus, clusters).citations.join(" ");
    expect(text).toBe("“a.” “b.” John Murray, “On the Structure and Origin of Coral Reefs and Islands,” abstract, *Proceedings of the Royal Society of Edinburgh* 10, no. 107 (1879–1880): 510. “c.” Murray, “Structure and Origin,” 511. “d.” Charles Darwin to Karl Semper, October 2, 1879, in Francis Darwin, ed., *The Life and Letters of Charles Darwin, Including an Autobiographical Chapter*, vol. 3 (John Murray, 1887), 182.");
  });
});
