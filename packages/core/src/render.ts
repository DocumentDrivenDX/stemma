// The plain-language text form of a report. One cause is shown once with the
// items it affects (CONTRACT-002 C).
import { compareCodePoints } from "@stemma/records";
import { CHECK_DESCRIPTIONS } from "./checks/not-run.ts";
import { type Coverage, coverageWords } from "./verification.ts";
import type { Result, ReportBody } from "./report.ts";
import { renderOpenTakeover, whereToStart } from "./render-takeover.ts";
export { renderTakeover } from "./render-takeover.ts";

export function groupResults(results: Result[]): Result[][] {
  const groups = new Map<string, Result[]>();
  for (const result of results) {
    // Entries listed and never cited share one cause, whichever works they are.
    const key = result.check === "bib.uncited" ? undefined : result.evidence.find((e) => e.name === "key" || e.name === "points_at");
    // Findings share a cause when the same check fails for the same reason on the same thing.
    const cause = [result.check, result.reason_code ?? "", key?.value ?? ""].join("\u0000");
    groups.set(cause, [...(groups.get(cause) ?? []), result]);
  }
  return [...groups.values()];
}

/** Keeps untrusted text on one line and free of terminal control characters. */
export const printable = (text: string): string =>
  // A line or page break inside quoted text is shown as a mark, and a soft hyphen as one too.
  text.replace(/\r?\n|\f/g, " \u23ce ").replace(/\u00ad/g, "\u00ac").replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, "?");

const noteLines = (result: Result): string[] => result.annotations.map((note) =>
  `       ${note.effect === "dismiss" ? "dismissed" : "explained"} by ${printable(note.by)} (${note.id}): ${printable(note.reason)}`);

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
      // A note explains a finding and leaves it open.
      if (item.annotations.length > 0) lines.push(`       finding key: ${item.finding_key}`, ...noteLines(item));
    }
  });
  return lines;
}

/** What a passing quotation check cannot show: a word joined at a line end can hide a hyphen that belongs to it. */
function quotationNotes(results: Result[]): string[] {
  const joined = results.filter((r) => r.check === "quote.present" && r.outcome === "pass")
    .flatMap((r) => r.evidence.filter((e) => e.name === "joined_at_line_end").map((e) => `   - ${printable(r.subject)}: ${printable(e.value)}`));
  return joined.length === 0 ? [] : [
    "", "For information, not a finding: these quotations matched after joining a word the source text splits at a line end.",
    "If the hyphen belongs to the word, the quotation should keep it: look at the page.", ...joined];
}

/** Review coverage and what comparisons found, with both readings. These are figures, not findings. */
export function renderCoverage(body: { verification: Coverage[] }, most = 3): string[] {
  const lines: string[] = [];
  for (const c of body.verification) {
    lines.push(`   - ${c.directory} (${c.method}): ${coverageWords(c)}`);
    for (const run of c.runs.filter((r) => r.current && r.differing_parts > 0)) {
      lines.push(`       compared with ${printable(run.against)}${run.independent ? "" : " (not independent of the conversion)"}: ${(run.agreement_permille / 10).toFixed(1)}% of words agree`);
      for (const d of run.disagreements.slice(0, most)) {
        lines.push(`         index ${d.index}: here "${printable(d.reading)}" / there "${printable(d.other)}"`);
      }
      if (run.disagreements.length > most) lines.push(`         and more: see \`coverage ${c.text}\``);
    }
  }
  return lines;
}

/**
 * What was corroborated by other means, what was not covered, and what was seen
 * in an original, each line with the sources it is about. None of it is a finding.
 */
function coverageSummary(results: Result[]): string[] {
  const lines = new Map<string, Set<string>>();
  for (const result of results.filter((r) => !r.open && r.confirmed_by === undefined)) {
    const about = result.evidence.find((e) => e.name === "key")?.value ?? result.subject;
    for (const e of result.evidence.filter((x) => x.name === "coverage")) {
      lines.set(e.value, (lines.get(e.value) ?? new Set()).add(about));
    }
  }
  if (lines.size === 0) return [];
  return ["", "Coverage, for information: what was covered by other means or not covered. Nothing here is a problem or needs doing.",
    ...[...lines].sort(([a], [b]) => compareCodePoints(a, b)).map(([line, about]) => `   - ${printable(line)}: ${[...about].sort().map(printable).join(", ")}`)];
}

export function renderReport(body: ReportBody): string {
  const { summary } = body;
  const lines: string[] = [];
  if (body.label === "checked_clean") {
    lines.push(
      "CHECKED CLEAN: the checks found nothing open.",
      "This does not mean that the book is correct. It covers only what is in these project files.");
  } else {
    // The headline counts what is open; a confirmed result is listed apart.
    const open = (outcome: string) => body.results.filter((r) => r.open && r.outcome === outcome).length;
    const parts = [
      `${open("fail")} problem(s)`,
      `${open("unverifiable")} could not be checked`,
      `${summary.not_implemented} kind(s) of check this version does not run`,
    ];
    lines.push(`OPEN FINDINGS: ${parts.join(", ")}. Nothing is blocked.`);
  }
  lines.push(`Checked the whole project: ${summary.pass} result(s) passed.`);
  // A taken-over project starts with many findings, so its causes are listed first.
  if (body.takeover) lines.push(...whereToStart(body));
  lines.push(...renderFindings(body.results));
  lines.push(...coverageSummary(body.results));
  lines.push(...quotationNotes(body.results));
  const dismissed = body.results.filter((r) => !r.open && r.annotations.some((a) => a.effect === "dismiss"));
  if (dismissed.length > 0) {
    lines.push("", "For information: a person dismissed these findings. The check still finds what it found.");
    for (const r of dismissed) lines.push(`   - ${printable(r.subject)} [${r.check}] ${r.message}`, ...noteLines(r));
  }
  if (body.takeover) lines.push(...renderOpenTakeover(body.takeover));
  const confirmed = body.results.filter((r) => r.confirmed_by !== undefined);
  if (confirmed.length > 0) {
    lines.push("", "For information: a person recorded what they saw for these details, which nothing else here shows. They are confirmed by the author, not verified.");
    for (const r of confirmed) lines.push(`   - ${r.subject} [${r.check}] review ${r.confirmed_by}`);
  }
  if (body.verification.length > 0) {
    lines.push("", "For information, not findings: what has been compared with and reviewed for each source file.", ...renderCoverage(body));
  }
  const missing = body.not_run;
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
