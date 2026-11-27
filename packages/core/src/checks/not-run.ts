// Why each check that did not run did not (CONTRACT-002 C, "Not run").
// `not_implemented` counts as open: there is something to check and this
// version cannot check it. When in doubt the input counts as present.
import { type Corpus, FULLY_CHECKED_KINDS, isObject, type LoadedFile } from "@stemma/records";
import type { NotRun } from "../report.ts";
import { active, hasManuscript, listedSources, resolveCitations } from "./bibliography.ts";
import { dependants } from "./changed.ts";
import { locatorCitations } from "./locators.ts";
import { quotationSubjects } from "./quotes.ts";

/** What each check would tell the author, in plain words. */
export const CHECK_DESCRIPTIONS: Record<string, string> = {
  "record.valid": "the extra rules for some record kinds in this project",
  "cite.key": "citation keys in the manuscript files",
  "bib.uncited": "bibliography entries that are never cited",
  "source.held": "whether you hold a copy of each cited source, with its text extracted",
  "source.changed": "work that rests on a copy or source that has since changed",
  "quote.present": "whether quotations appear in the stored source text",
  "quote.self": "your own claims presented as quotations from a source",
  "locator.extent": "whether cited pages and other locators fall inside the source",
  "meta.source": "authors, titles and dates against your stored copies",
  "meta.resolver": "authors, titles and dates against saved catalogue lookups",
  "id.resolves": "whether DOIs and other identifiers name these works",
  "number.present": "whether cited figures appear in the stored source text",
  "construct.credit": "who each construct is credited to",
  "claim.complete": "whether each claim has evidence, confidence and a reason",
  "construct.complete": "whether each construct has a definition and ownership",
  "claim.inactive": "manuscript text linked to a retired claim",
  "cite.unlinked": "citations not linked to any claim",
  "takeover.removal": "claims left without support by removing a citation",
  "draft.marked": "passages marked as needing a source",
  "support.current": "whether each cited claim has a current claim-support record",
  "restricted.leak": "restricted site coordinates in project files",
  "coordinate.stray": "coordinates written in project files",
  "image.resolution": "image resolution", "image.alt": "image alternative text", "image.credit": "image credits",
  "image.permission": "image permissions", "image.vector": "vector images", "image.font": "image fonts",
  "image.placement": "image placement", "image.metadata": "location data inside images",
  "cite.format": "citation formatting (checked during a build)",
  "build.uncommitted": "uncommitted changes (checked during a build)",
  "changelog.missing": "the changelog entry (checked during a build)",
  "package.leak": "protected text in a reviewer package (checked during a build)",
};

export function notRun(corpus: Corpus): NotRun[] {
  const manuscript = hasManuscript(corpus);
  const citations = active(corpus, "citation");
  const has = (...kinds: string[]) => kinds.some((k) => active(corpus, k).length > 0);
  // Sources that would enter a built bibliography: cited or listed.
  const used: LoadedFile[] = [...new Set([...resolveCitations(corpus).flatMap((r) => r.matches), ...listedSources(corpus)])];
  const cited = citations.length > 0 || manuscript;
  const someCitation = (field: string) => citations.some((c) => c.data![field] !== undefined);

  const missing: Record<string, boolean> = {
    "quote.self": has("claim") && (manuscript || someCitation("quotation")),
    "meta.source": used.length > 0 && has("capture"),
    "meta.resolver": manuscript || used.length > 0,
    "id.resolves": manuscript || used.some((s) => Array.isArray(s.data!.identifiers) && s.data!.identifiers.length > 0),
    "number.present": cited,
    "construct.credit": has("construct"),
    "claim.complete": has("claim"),
    "construct.complete": has("construct"),
    "claim.inactive": manuscript,
    "cite.unlinked": manuscript,
    "takeover.removal": has("round_choice"),
    "draft.marked": manuscript,
    "support.current": has("claim"),
    "restricted.leak": active(corpus, "place_location").some((f) => isObject(f.data!.sensitivity) && f.data!.sensitivity.class !== "public"),
    ...Object.fromEntries(
      ["resolution", "alt", "credit", "permission", "vector", "font", "placement", "metadata"].map((n) => [`image.${n}`, has("image")])),
    "cite.format": false, "build.uncommitted": false, "changelog.missing": false, "package.leak": false,
  };
  const entries: NotRun[] = Object.entries(missing).map(([check, present]) => ({ check, reason: present ? "not_implemented" : "input_absent" }));

  if (corpus.records.some((f) => f.state === "ok" && !FULLY_CHECKED_KINDS.has(String(f.data?.kind)))) {
    entries.push({ check: "record.valid", reason: "not_implemented" });
  }
  // These three run over records. Manuscript files, which say what is cited and quoted now, are not read.
  const built: [string, boolean][] = [
    ["source.changed", dependants(corpus).length > 0],
    ["quote.present", quotationSubjects(corpus) > 0],
    ["locator.extent", locatorCitations(corpus).length > 0],
  ];
  for (const [check, subjects] of built) {
    if (manuscript) entries.push({ check, reason: "not_implemented" });
    else if (!subjects) entries.push({ check, reason: "input_absent" });
  }
  // Which sources are cited is unknown while manuscript files cannot be read.
  if (manuscript) entries.push({ check: "source.held", reason: "not_implemented" });
  else if (citations.length === 0) entries.push({ check: "source.held", reason: "input_absent" });
  if (manuscript) entries.push({ check: "cite.key", reason: "not_implemented" });
  else if (citations.length === 0) entries.push({ check: "cite.key", reason: "input_absent" });
  if (manuscript && listedSources(corpus).length > 0) entries.push({ check: "bib.uncited", reason: "not_implemented" });
  else if (listedSources(corpus).length === 0) entries.push({ check: "bib.uncited", reason: "input_absent" });
  return entries.sort((a, b) => (a.check < b.check ? -1 : a.check > b.check ? 1 : 0));
}
