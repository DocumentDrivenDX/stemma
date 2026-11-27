// project.binary: a project holds text. Originals and other binary files are
// referenced, not kept in the repository (CONTRACT-001 B).
import type { Corpus } from "@stemma/records";
import { result } from "../findings.ts";
import type { Result } from "../report.ts";

export function binaryResults(corpus: Corpus): Result[] {
  const check = "project.binary";
  if (corpus.binaries.length === 0) {
    return [result({ check, outcome: "pass", subject: "project", locus: "files", evidence: [{ name: "binary_files", class: "metadata", value: "none found" }] })];
  }
  return corpus.binaries.map((path) => result({
    check, outcome: "fail", reason: "binary_file", subject: path, locus: path,
    evidence: [{ name: "file", class: "location", value: path }],
  }));
}
