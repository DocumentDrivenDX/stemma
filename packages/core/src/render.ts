// The plain-language text form of a report. One cause is shown once with the
// items it affects (CONTRACT-002 C).
import { CHECK_DESCRIPTIONS } from "./checks/not-run.ts";
import type { Result, ReportBody } from "./report.ts";

export function groupResults(results: Result[]): Result[][] {
  const groups = new Map<string, Result[]>();
  for (const result of results) {
    const key = result.evidence.find((e) => e.name === "key" || e.name === "points_at");
    // Findings share a cause when the same check fails for the same reason on the same thing.
    const cause = [result.check, result.reason_code ?? "", key?.value ?? ""].join("\u0000");
    groups.set(cause, [...(groups.get(cause) ?? []), result]);
  }
  return [...groups.values()];
}

/** Keeps untrusted text on one line and free of terminal control characters. */
export const printable = (text: string): string => text.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, "?");

export function renderFindings(results: Result[]): string[] {
  const lines: string[] = [];
  groupResults(results.filter((r) => r.open)).forEach((group, i) => {
    const first = group[0]!;
    const verdict = first.outcome === "fail" ? "PROBLEM" : "COULD NOT CHECK";
    const places = group.length === 1 ? "" : `, ${group.length} places`;
    lines.push("", `${i + 1}. ${verdict}: ${first.message}  [${first.check}${places}]`, `   Why it matters: ${first.why}`);
    for (const suggestion of first.suggestions) lines.push(`   What to do: ${suggestion}`);
    for (const item of group) {
      lines.push(`   - ${printable(item.subject)}`);
      for (const e of item.evidence) lines.push(`       ${e.name.replaceAll("_", " ")}: ${printable(e.value)}`);
    }
  });
  return lines;
}

export function renderReport(body: ReportBody): string {
  const { summary } = body;
  const lines: string[] = [];
  if (body.label === "checked_clean") {
    lines.push(
      "CHECKED CLEAN: the checks found nothing open.",
      "This does not mean that the book is correct. It covers only what is in these project files.");
  } else {
    const parts = [
      `${summary.fail} problem(s)`,
      `${summary.unverifiable} could not be checked`,
      `${summary.not_implemented} kind(s) of check this version does not run`,
    ];
    lines.push(`OPEN FINDINGS: ${parts.join(", ")}. Nothing is blocked.`);
  }
  lines.push(`Checked the whole project: ${summary.pass} result(s) passed.`);
  lines.push(...renderFindings(body.results));
  const missing = body.not_run.filter((n) => n.reason === "not_implemented");
  if (missing.length > 0) {
    lines.push(
      "", "NOT CHECKED: this version does not run these, so the project is not called checked clean.",
      "Why it matters: a mistake of one of these kinds would go unnoticed. What to do: check them by hand where they matter.");
    for (const entry of missing) lines.push(`   - ${CHECK_DESCRIPTIONS[entry.check]}  [${entry.check}]`);
  }
  if (body.unreviewed.length > 0) {
    lines.push("", `For information, not a finding: ${body.unreviewed.length} cited item(s) are unreviewed or not admitted.`);
    for (const item of body.unreviewed) lines.push(`   - ${item.record} (${item.reason.replace("_", " ")})`);
  }
  return `${lines.join("\n")}\n`;
}
