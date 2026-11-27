// The checks that apply to what the project holds but that this version cannot
// run (CONTRACT-002 C, "Applicability"). They count as open. A check that does
// not apply to the project is not listed at all. When in doubt it applies.
import { type Corpus, FULLY_CHECKED_KINDS, isObject } from "@stemma/records";
import type { NotRun } from "../report.ts";
import { active, hasManuscript, listedSources } from "./bibliography.ts";

/** What each check would tell the author, in plain words. */
export const CHECK_DESCRIPTIONS: Record<string, string> = {
  "record.valid": "the extra rules for some record kinds in this project",
  "project.binary": "binary files kept in the repository",
  "cite.key": "citation keys in the manuscript files",
  "bib.uncited": "bibliography entries that are never cited",
  "source.held": "whether each cited source's text is in the project",
  "source.pages": "whether every page or section of each source file is present, in order and unchanged",
  "source.labels": "whether printed page numbers run as a book's would",
  "source.footnotes": "whether note markers and notes pair",
  "source.original": "whether each source file still matches its original",
  "source.changed": "work that rests on source text that has since changed",
  "quote.present": "whether quotations appear in the source text",
  "quote.page": "whether quotations are on the cited pages or in the cited chapter",
  "quote.self": "your own claims presented as quotations from a source",
  "locator.extent": "whether cited pages and other locators fall inside the source",
  "meta.source": "authors, titles and dates against what your sources state",
  "meta.resolver": "authors, titles and dates against saved catalogue lookups",
  "id.resolves": "whether DOIs and other identifiers name these works",
  "number.present": "whether cited figures appear in the source text",
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
  const quoting = citations.some((c) => c.data!.quotation !== undefined);
  const applies: Record<string, boolean> = {
    "quote.self": has("claim") && (manuscript || quoting),
    "construct.credit": has("construct"),
    "claim.complete": has("claim"),
    "construct.complete": has("construct"),
    "claim.inactive": manuscript && has("claim"),
    "cite.unlinked": manuscript && has("claim"),
    "takeover.removal": has("round_choice"),
    "draft.marked": manuscript,
    "support.current": has("claim"),
    "restricted.leak": active(corpus, "place_location").some((f) => isObject(f.data!.sensitivity) && f.data!.sensitivity.class !== "public"),
    ...Object.fromEntries(
      ["resolution", "alt", "credit", "permission", "vector", "font", "placement", "metadata"].map((n) => [`image.${n}`, has("image")])),
  };
  const missing = new Set(Object.entries(applies).filter(([, yes]) => yes).map(([check]) => check));
  if (corpus.records.some((f) => f.state === "ok" && !FULLY_CHECKED_KINDS.has(String(f.data?.kind)))) missing.add("record.valid");
  // Manuscript files say what is cited and quoted now, and this version does not read them.
  if (manuscript) {
    for (const check of ["cite.key", "source.held", "quote.present", "quote.page", "locator.extent", "number.present", "source.changed"]) missing.add(check);
    if (listedSources(corpus).length > 0) missing.add("bib.uncited");
  }
  return [...missing].sort().map((check) => ({ check, reason: "not_implemented" }));
}
