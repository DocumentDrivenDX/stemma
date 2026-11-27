// The structure checks (CONTRACT-002 C, FR-87). They read only the repository:
// that every part is present, in sequence and unchanged; that printed page
// labels run as a book's would; and that note markers and notes pair.
import { blockText, type Corpus, idOf, isRetired, type LoadedText, noteMarks } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { numberOf } from "./locators.ts";
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

export function labelResults(corpus: Corpus): Result[] {
  const check = "source.labels";
  return activeTexts(corpus).flatMap(([id, text]) => {
    if (text.manifest.data!.paged !== true || !text.parts.some((p) => p.front.label !== undefined)) return [];
    const found: { reason: string; locus: string; evidence: Evidence[] }[] = [];
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
      if (reason) {
        found.push({ reason, locus: `${part.index}#${reason}`, evidence: [at("file", part.path), meta("labels", `page index ${before.index} is labelled ${before.label}; page index ${part.index} is labelled ${label}`)] });
      }
    }
    if (found.length === 0) {
      const labelled = text.parts.filter((p) => p.front.label !== undefined).length;
      return [result({ ...common(check, text), outcome: "pass", locus: id, evidence: [at("source_text", text.manifest.path), meta("labelled", `${labelled} of ${text.parts.length} pages have a printed label`)] })];
    }
    return found.map((f) => result({ ...common(check, text), outcome: "fail", reason: f.reason, locus: `${id}#${f.locus}`, evidence: f.evidence }));
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
