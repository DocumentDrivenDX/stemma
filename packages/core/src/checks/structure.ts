// The structure checks (CONTRACT-002 C, FR-87). They read only the repository:
// that every part is present, in sequence and unchanged; that printed page
// labels run as a book's would; and that note markers and notes pair.
import { blockText, type Corpus, idOf, isRetired, type LoadedText, noteMarks, streamsOf } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { numberOf } from "./locators.ts";
import { foldName } from "./metadata.ts";
import { itemOf, subjectOf } from "./records.ts";

const at = (name: string, value: string): Evidence => ({ name, class: "location", value });
const meta = (name: string, value: string): Evidence => ({ name, class: "metadata", value });

export const activeTexts = (corpus: Corpus): [string, LoadedText][] =>
  [...corpus.texts].filter(([, t]) => !isRetired(t.manifest.data!));

const common = (check: string, text: LoadedText) => ({
  check, subject: subjectOf(text.manifest), source: String(text.manifest.data!.source), item: itemOf(text.manifest),
});

export function pageResults(corpus: Corpus): Result[] {
  const check = "source.pages";
  return activeTexts(corpus).flatMap(([id, text]) => {
    const parts = meta("parts", `${text.parts.length} ${text.manifest.data!.paged === true ? "page files" : "section files"} present`);
    if (text.notHeld) {
      return [result({
        ...common(check, text), outcome: "unverifiable", reason: "not_held", locus: id,
        evidence: [at("source_text", text.manifest.path), meta("parts", `none of the ${text.damage.length} listed ${text.manifest.data!.paged === true ? "page files" : "section files"} is here`),
          meta("fetch_again", `ingest --fetch --actor <kind>:<name>, or ingest --originals <dir> when you have the original`)],
      })];
    }
    if (text.damage.length > 0) {
      return text.damage.map((d) => result({
        ...common(check, text), outcome: "fail", reason: d.code, locus: `${id}#${d.code}#${d.path}#${d.detail ?? ""}`,
        evidence: [at("file", d.path), ...(d.detail ? [meta("detail", d.detail)] : [])],
      }));
    }
    if (!text.usable) {
      return [result({ ...common(check, text), outcome: "unverifiable", reason: "part_invalid", locus: id, evidence: [at("source_text", text.manifest.path)] })];
    }
    return [result({ ...common(check, text), outcome: "pass", locus: id, evidence: [at("source_text", text.manifest.path), parts] })];
  });
}

const bare = (value: string) => value.trim().replace(/^[[(—–\s.-]+|[\])—–\s.-]+$/g, "");

/**
 * What shows that the text runs on from one scan page to the next, although the
 * printed numbers jump. Two signs are read, each unlikely where leaves are lost:
 * a word split across the two pages that the source writes whole elsewhere, and
 * a run-in heading opening the second page whose words the first page announces.
 * A sentence merely left unfinished is not enough.
 */
function runsOn(text: LoadedText, earlier: number, later: number): string | undefined {
  const mainOf = (index: number) => streamsOf(text.parts.find((p) => p.index === index)!.blocks).main.trim();
  const [before, after] = [mainOf(earlier), mainOf(later)];
  const head = /(\p{L}{2,})[-\u2010\u00ad]$/u.exec(before)?.[1];
  const tail = /^\p{Ll}{2,}/u.exec(after)?.[0];
  if (head && tail) {
    const whole = foldName(head + tail);
    const elsewhere = text.parts.some((p) => p.index !== earlier && p.index !== later && ` ${foldName(streamsOf(p.blocks).main)} `.includes(` ${whole} `));
    if (elsewhere) return `a word split between the two pages, "${head}-" and "${tail}", is written whole elsewhere in the source`;
  }
  const heading = /^(\p{Lu}[\p{L}'\u2019]+(?:[ \t]+\p{L}[\p{L}'\u2019]*){1,5})\.[ \t]*[\u2013\u2014\u2015]/u.exec(after)?.[1];
  if (heading && foldName(heading).replaceAll(" ", "").length >= 10 && ` ${foldName(before)} `.includes(` ${foldName(heading)} `)) {
    return `the second page opens with the heading "${heading}", words the first page announces`;
  }
  return undefined;
}

/**
 * Whether a jump in the printed numbers is a matter of the numbering alone: every
 * page of the original is held, the two pages are neighbours in it, the numbers
 * run in step on both sides of the jump, and the text runs on across it.
 */
function numberingOnly(text: LoadedText, earlier: number, later: number): string | undefined {
  if (!text.usable || text.damage.length > 0 || text.manifest.data!.coverage !== "all" || later - earlier !== 1) return undefined;
  const at = (index: number) => {
    const label = text.parts.find((p) => p.index === index)?.front.label;
    return typeof label === "string" ? numberOf(label) : undefined;
  };
  const inStep = (first: number) => {
    const [a, b] = [at(first), at(first + 1)];
    return a !== undefined && b !== undefined && a.style === b.style && b.value === a.value + 1;
  };
  return inStep(earlier - 1) && inStep(later) ? runsOn(text, earlier, later) : undefined;
}

export function labelResults(corpus: Corpus): Result[] {
  const check = "source.labels";
  return activeTexts(corpus).flatMap(([id, text]) => {
    if (text.manifest.data!.paged !== true || !text.parts.some((p) => p.front.label !== undefined)) return [];
    const found: { reason: string; locus: string; evidence: Evidence[] }[] = [];
    const observed: { locus: string; evidence: Evidence[] }[] = [];
    const last = new Map<string, { value: number; index: number; label: string }>();
    for (const part of text.parts) {
      const label = typeof part.front.label === "string" ? part.front.label : undefined;
      if (label === undefined) continue;
      for (const folio of part.blocks.filter((b) => b.role === "folio")) {
        if (bare(blockText(folio)) !== label) {
          found.push({ reason: "folio_differs", locus: `${part.index}#folio`, evidence: [at("file", part.path), meta("label", label), { name: "folio", class: "source_text", value: blockText(folio) }] });
        }
      }
      const number = numberOf(label);
      if (!number) continue;
      const before = last.get(number.style);
      last.set(number.style, { value: number.value, index: part.index, label });
      if (!before) continue;
      const [step, pages] = [number.value - before.value, part.index - before.index];
      const reason = step === 0 ? "label_repeated" : step < 0 ? "label_backwards" : step > pages ? "label_jump" : undefined;
      const sign = reason === "label_jump" ? numberingOnly(text, before.index, part.index) : undefined;
      if (sign) {
        const seen = `printed page ${before.label} is followed by ${label} on the next page of the original, with nothing shown missing`;
        observed.push({ locus: `${part.index}#numbering`, evidence: [at("file", part.path),
          meta("labels", `page index ${before.index} is labelled ${before.label}; page index ${part.index} is labelled ${label}`),
          meta("observation", `${seen}: every page of the original is held, the numbers run on after the jump, and ${sign}`),
          meta("coverage", `observed in an original: ${seen}`)] });
      } else if (reason) {
        found.push({ reason, locus: `${part.index}#${reason}`, evidence: [at("file", part.path), meta("labels", `page index ${before.index} is labelled ${before.label}; page index ${part.index} is labelled ${label}`)] });
      }
    }
    if (found.length === 0) {
      const labelled = text.parts.filter((p) => p.front.label !== undefined).length;
      return [result({ ...common(check, text), outcome: "pass", locus: id, evidence: [at("source_text", text.manifest.path), meta("labelled", `${labelled} of ${text.parts.length} pages have a printed label`), ...observed.flatMap((o) => o.evidence)] })];
    }
    return [...observed.map((o) => result({ ...common(check, text), outcome: "pass", locus: `${id}#${o.locus}`, evidence: o.evidence })),
      ...found.map((f) => result({ ...common(check, text), outcome: "fail", reason: f.reason, locus: `${id}#${f.locus}`, evidence: f.evidence }))];
  });
}

export function footnoteResults(corpus: Corpus): Result[] {
  const check = "source.footnotes";
  return activeTexts(corpus).flatMap(([id, text]) => {
    // On paged sources a note stands on its marker's page; without pages, anywhere in the text.
    const groups = text.manifest.data!.paged === true
      ? text.parts.map((p) => ({ name: `index ${p.index}`, path: p.path, ...noteMarks(p.blocks) }))
      : [{ name: "the text", path: text.manifest.path, ...noteMarks(text.parts.flatMap((p) => p.blocks)) }];
    if (!groups.some((g) => g.markers.length > 0 || g.notes.length > 0)) return [];
    const found = groups.flatMap((group) => {
      const notes = group.notes.map((n) => ({ ...n, used: false }));
      const out: { reason: string; label: string; name: string; path: string }[] = [];
      for (const label of group.markers) {
        const note = notes.find((n) => !n.used && n.label === label);
        if (note) note.used = true;
        else out.push({ reason: "marker_without_note", label, name: group.name, path: group.path });
      }
      for (const note of notes.filter((n) => !n.used && !n.continued)) out.push({ reason: "note_without_marker", label: note.label, name: group.name, path: group.path });
      return out;
    });
    if (found.length === 0) {
      const count = groups.reduce((n, g) => n + g.notes.length, 0);
      return [result({ ...common(check, text), outcome: "pass", locus: id, evidence: [at("source_text", text.manifest.path), meta("notes", `${count} note(s), each paired or marked as continued`)] })];
    }
    return found.map((f, i) => result({
      ...common(check, text), outcome: "fail", reason: f.reason, locus: `${id}#${f.name}#${f.reason}#${f.label}#${i}`,
      evidence: [at("file", f.path), meta("where", f.name), meta("note_label", f.label || "(none)")],
    }));
  });
}

export { idOf };
