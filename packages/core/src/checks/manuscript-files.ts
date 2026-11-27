// What record.valid says about a manuscript (CONTRACT-006, Error Semantics): a
// chapter file the reader refuses, which no check could read, and a citation or
// claim ID in a chapter that names no record. Neither repeats manuscript text.
import type { Corpus } from "@stemma/records";
import { result } from "../findings.ts";
import type { Result } from "../report.ts";
import { hasManuscript } from "./bibliography.ts";
import { manuscriptOf, positionOf } from "./cited.ts";

const CHECK = "record.valid";

export function manuscriptFileResults(corpus: Corpus): Result[] {
  if (!hasManuscript(corpus)) return [];
  const { chapters, problems, unread } = manuscriptOf(corpus);
  const out: Result[] = problems.map((problem) => result({
    check: CHECK, outcome: "unverifiable", reason: problem.code, subject: problem.path, locus: `${problem.path}#chapter`,
    evidence: [positionOf(problem.path, problem), { name: "problem", class: "metadata", value: problem.detail }],
  }));
  out.push(...unread.map((path) => result({
    check: CHECK, outcome: "unverifiable", reason: "manuscript_file_unread", subject: path, locus: path, coverage: true,
    evidence: [{ name: "file", class: "location", value: path },
      { name: "coverage", class: "metadata", value: "files under manuscript/ that are not .md chapter files were not read" }],
  })));

  // A record that cannot be read has its own finding, so its ID is not called missing.
  const unreadable = new Set(corpus.records.filter((f) => f.state !== "ok").map((f) => f.path.replace(/^.*\//, "").replace(/\.json$/, "")));
  for (const chapter of chapters) {
    const named = [
      ...chapter.citations.flatMap((c) => (c.id === undefined ? [] : [{ id: c.id, kind: "citation", at: c }])),
      ...chapter.claims.flatMap((span) => span.ids.map((id) => ({ id, kind: "claim", at: span }))),
    ];
    const seen = new Set<string>();
    for (const { id, kind, at } of named) {
      if (seen.has(id) || unreadable.has(id) || corpus.byId.get(id)?.data?.kind === kind) continue;
      seen.add(id);
      out.push(result({
        check: CHECK, outcome: "fail", reason: "reference_dangling", subject: chapter.path, locus: `${chapter.id}#reference#${id}`,
        evidence: [positionOf(chapter.path, at), { name: "points_at", class: "location", value: id },
          { name: "problem", class: "metadata", value: `no ${kind} record has this ID` }],
      }));
    }
  }
  return out;
}
