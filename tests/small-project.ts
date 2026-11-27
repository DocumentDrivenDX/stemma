// A small invented project on disk, for tests of what Stemma does with any
// project rather than with what the worked example says: three sources, a
// four-page source file, passages, a citation and a report that quotes them.
// Reading it takes milliseconds where the worked example takes about a second,
// so tests that start a server, rebuild or search many times use it. Nothing in
// it is a real source.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { temporary } from "./helpers.ts";
import { content, PAGES, type Page, project } from "./source-view-fixture.ts";

/** The citation the project holds, of the passage on its second page. */
export const SMALL_CITATION = "cit-onepage00001";

/** The fixture's pages and one more, so that a search finds "subsidence" as it does in the worked example. */
const pages = (): Page[] => [
  ...structuredClone(PAGES),
  { label: "4", blocks: [{ role: "paragraph", content: "The subsidence of the floor let the reef grow upward." }] },
];

const REPORT = {
  manuscript: "report.src",
  quotations: [
    { id: "one", cites: "volume1850", passages: [{ passage: "psg-onepage00001" }] },
    { id: "two", cites: "volume1850", passages: [{ passage: "psg-twopages0001" }] },
    { id: "note", cites: "volume1850", passages: [{ passage: "psg-footnote0001" }] },
  ],
};

/** A sentence of the report that holds no quotation and no note, between two that do. */
export const SMALL_SENTENCE = "This report argues that the shape of a reef was never the evidence for it.";

/** Sentences of each kind: with a quotation, with a citation only, with neither, and in a note's comment. */
const TEMPLATE = `# A *Report* on a Reef

The reef: {{q:one}}.[^one] Both {{q:two}}.[^two] ${SMALL_SENTENCE} The soundings were invented.[^note|An invented comment stands in this note.]

{{bibliography}}
`;

/** Writes the project into `dir`, which it makes, and gives `dir`. */
export function smallProject(dir = join(temporary(), "small")): string {
  const made = content(project({ pages: pages() }));
  const put = (path: string, bytes: Uint8Array | string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), bytes);
  };
  put("stemma.json", made.settings.bytes!);
  for (const file of [...made.records, ...made.sources]) put(file.path, file.bytes!);
  put("report/report.json", JSON.stringify(REPORT));
  put("report/report.src", TEMPLATE);
  return dir;
}
