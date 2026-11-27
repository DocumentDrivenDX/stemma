// source.held (CONTRACT-002 C; SD-002 BR-205 and BR-206): a cited source has an
// intact stored copy with intact extracted text. It says nothing about whether
// the text is a faithful reading of the copy, or whether the source supports
// the sentence that cites it.
import { checkPageSpans, type Corpus, idOf, isObject, type LoadedFile } from "@stemma/records";
import { result } from "../findings.ts";
import type { Evidence, Result } from "../report.ts";
import { type BlobReader, isDigest } from "../store.ts";
import { active, hasManuscript, resolveCitations } from "./bibliography.ts";
import { itemOf, subjectOf } from "./records.ts";

type Reason = "no_copy" | "no_text" | "record_unreadable" | "copy_missing" | "copy_altered" | "text_missing" | "text_altered" | "text_inconsistent";

interface Held {
  outcome: "pass" | "fail" | "unverifiable";
  reason?: Reason;
  evidence: Evidence[];
}

const at = (name: string, value: string): Evidence => ({ name, class: "location", value });
const meta = (name: string, value: string): Evidence => ({ name, class: "metadata", value });

const unreadableIn = (corpus: Corpus, ...directories: string[]): boolean =>
  corpus.records.some((f) => f.state !== "ok" && directories.some((d) => f.path.startsWith(`records/${d}/`)));

/** Whether the saved text fits its record: size in bytes, spans in code points. */
function fits(extraction: LoadedFile, bytes: Uint8Array): "ok" | "inconsistent" | "empty" {
  const { text_size, page_spans } = extraction.data!;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return "inconsistent";
  }
  if (text_size !== bytes.length) return "inconsistent";
  if (page_spans !== undefined && (!Array.isArray(page_spans) || checkPageSpans(page_spans, [...text].length).length > 0)) {
    return "inconsistent";
  }
  return /\S/u.test(text) ? "ok" : "empty";
}

/** The state of one source's non-retired copies and their texts. */
export function holding(corpus: Corpus, source: string, blobs: BlobReader, read: Set<string>): Held {
  const captures = active(corpus, "capture").filter((c) => c.data!.source === source);
  if (captures.length === 0) {
    return unreadableIn(corpus, "captures")
      ? { outcome: "unverifiable", reason: "record_unreadable", evidence: [] }
      : { outcome: "fail", reason: "no_copy", evidence: [] };
  }
  // Every copy and text is looked at: one good copy does not hide a damaged one.
  const damage: { reason: Reason; evidence: Evidence[] }[] = [];
  let good: Evidence[] | undefined;
  const bare: Evidence[] = [];
  for (const capture of captures) {
    const sha = capture.data!.sha256;
    const here = [at("capture_file", capture.path), ...(isDigest(sha) ? [meta("copy_sha256", sha)] : [])];
    const state = isDigest(sha) ? blobs.verify(sha) : "altered";
    if (state !== "ok") {
      damage.push({ reason: state === "altered" ? "copy_altered" : "copy_missing", evidence: here });
      continue;
    }
    if (capture.data!.size !== blobs.get(sha as string)?.length) {
      damage.push({ reason: "copy_altered", evidence: [...here, meta("problem", "the recorded size differs from the stored file's size")] });
      continue;
    }
    read.add(sha as string);
    const extractions = active(corpus, "extraction").filter((e) => e.data!.capture === idOf(capture) && e.data!.capture_sha256 === sha);
    if (extractions.length === 0) {
      bare.push(...here);
      continue;
    }
    for (const extraction of extractions) {
      const textSha = extraction.data!.text_sha256;
      const there = [...here, at("extraction_file", extraction.path), ...(isDigest(textSha) ? [meta("text_sha256", textSha)] : [])];
      const bytes = isDigest(textSha) ? blobs.get(textSha) : undefined;
      if (!bytes) {
        const textState = isDigest(textSha) ? blobs.verify(textSha) : "altered";
        damage.push({ reason: textState === "altered" ? "text_altered" : "text_missing", evidence: there });
        continue;
      }
      const state = fits(extraction, bytes);
      if (state === "inconsistent") damage.push({ reason: "text_inconsistent", evidence: there });
      else if (state === "empty") bare.push(...there, meta("problem", "the saved text holds no characters"));
      else {
        read.add(textSha as string);
        const quality = isObject(extraction.data!.quality) ? extraction.data!.quality : {};
        good ??= [...there, meta("text_method", `${String(quality.method)}, quality ${String(quality.level)}`)];
      }
    }
  }
  if (damage.length > 0) return { outcome: "unverifiable", reason: damage[0]!.reason, evidence: damage[0]!.evidence };
  if (good) return { outcome: "pass", evidence: good };
  return unreadableIn(corpus, "extractions", "captures")
    ? { outcome: "unverifiable", reason: "record_unreadable", evidence: bare }
    : { outcome: "fail", reason: "no_text", evidence: bare };
}

/**
 * One result for each citation record that names exactly one source (a key that
 * names none is cite.key's finding), and one for each uncited source whose
 * stored copy or text no longer matches its digest. `read` collects the blobs a
 * result rests on.
 */
export function heldResults(corpus: Corpus, blobs: BlobReader, read: Set<string> = new Set()): Result[] {
  const check = "source.held";
  const seen = new Map<string, Held>();
  const of = (source: string) => {
    const known = seen.get(source) ?? holding(corpus, source, blobs, read);
    seen.set(source, known);
    return known;
  };
  const cited = new Set<string>();
  // While manuscript files cannot be read, citation records do not say what is cited now.
  const results = hasManuscript(corpus) ? [] : resolveCitations(corpus).flatMap(({ citation, key, matches }) => {
    if (matches.length !== 1) return [];
    const source = idOf(matches[0]!)!;
    cited.add(source);
    const held = of(source);
    const data = citation.data!;
    const sentence = isObject(data.sentence) && typeof data.sentence.text === "string" && typeof data.sentence.sha256 === "string"
      ? { text: data.sentence.text, sha256: data.sentence.sha256 } : undefined;
    const evidence: Evidence[] = [
      at("citation_file", citation.path),
      meta("key", key ?? String(matches[0]!.data!.citation_key ?? source)),
      at("source_file", matches[0]!.path),
      ...held.evidence,
    ];
    return [result({
      check, outcome: held.outcome, ...(held.reason ? { reason: held.reason } : {}),
      subject: subjectOf(citation), locus: idOf(citation) ?? citation.path, source, evidence,
      item: itemOf(citation), ...(sentence ? { sentence } : {}),
    })];
  });
  for (const file of active(corpus, "source")) {
    const source = idOf(file)!;
    if (cited.has(source) || !active(corpus, "capture").some((c) => c.data!.source === source)) continue;
    const held = of(source);
    if (!held.reason?.endsWith("_altered") && held.reason !== "text_inconsistent") continue;
    results.push(result({
      check, outcome: held.outcome, reason: held.reason, subject: subjectOf(file), locus: "stored_copy", source,
      evidence: [at("source_file", file.path), meta("key", String(file.data!.citation_key ?? source)), ...held.evidence], item: itemOf(file),
    }));
  }
  return results;
}
