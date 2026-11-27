// record.valid: CONTRACT-001 for stemma.json, every record file, and rules.md.
import { checkRuleHeadings, type Corpus, digest, idOf, isRecordId, type JsonObject, type LoadedFile } from "@stemma/records";
import { PROBLEMS, problemTemplate, result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";

export function subjectOf(file: LoadedFile): string {
  const id = idOf(file);
  // The ID names the subject only when it is this file's own well-formed ID.
  // A source file's record is its manifest, whose directory name need not be the ID.
  const kind = String(file.data?.kind);
  const owns = id !== undefined && isRecordId(kind, id) && (kind === "source_text" ? /^sources\/[^/]+\/source\.md$/.test(file.path) : file.path.endsWith(`/${id}.json`));
  return owns ? id : file.path;
}

export function itemOf(file: LoadedFile): Result["item"] {
  const { review: _r, created: _c, changed: _m, legacy: _l, x: _x, ...content } = file.data as JsonObject;
  return { record: idOf(file)!, content_sha256: digest(content) };
}

const location = (name: string, value: string): Evidence => ({ name, class: "location", value });

export function fileResults(file: LoadedFile): Result[] {
  const check = "record.valid";
  const subject = subjectOf(file);
  const evidence = [location("file", file.path)];
  const finding = (outcome: "fail" | "unverifiable", reason: string, locus: string, extra: Evidence[] = []) =>
    result({ check, outcome, reason, subject, locus: `${file.path}#${locus}`, evidence: [...evidence, ...extra] });

  if (file.state === "unreadable") {
    return [finding("unverifiable", "record_unreadable", "file", [{ name: "problem", class: "metadata", value: file.unreadable! }])];
  }
  if (file.state === "version_unsupported") return [finding("unverifiable", "version_unsupported", "file")];

  const results = file.problems.map((problem) => {
    const extra = [
      ...(problem.field ? [location("field", problem.field)] : []),
      { name: "problem", class: "metadata", value: PROBLEMS[problem.code] } as Evidence,
      ...(problem.target ? [location(problem.code === "wrong_location" ? "expected_path" : "points_at", problem.target)] : []),
    ];
    return finding("fail", problemTemplate(problem).split(":")[1]!, `${problem.code}${problem.field}`, extra);
  });
  if (file.state === "ok" && !file.canonical && file.formattable) results.push(finding("fail", "record_noncanonical", "form"));
  return results.length > 0 ? results : [result({ check, outcome: "pass", subject, locus: file.path, evidence })];
}

export function rulesResults(corpus: Corpus): Result[] {
  const file = corpus.rules;
  if (!file) return [];
  const check = "record.valid";
  const path = file.path;
  if (!file.bytes) {
    return [result({ check, outcome: "unverifiable", reason: "record_unreadable", subject: path, locus: path, evidence: [location("file", path)] })];
  }
  const problems = checkRuleHeadings(new TextDecoder().decode(file.bytes));
  if (problems.length === 0) return [result({ check, outcome: "pass", subject: path, locus: path, evidence: [location("file", path)] })];
  return problems.map((p, i) =>
    result({
      check, outcome: "fail", reason: p.code, subject: path, locus: `${path}#${p.code}#${p.rule ?? i}`,
      evidence: [location("file", path), location("line", String(p.line))],
    }));
}
