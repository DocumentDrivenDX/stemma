// claim.complete (CONTRACT-002 C; SD-005 BR-508): each claim in effect has a
// note behind it, a confidence level and a reason. It reads records only, and
// review plays no part.
import { type Corpus, idOf, isRetired, type LoadedFile, TYPES } from "@stemma/records";
import { grouped, once } from "../corpus-index.ts";
import { result } from "../findings.ts";
import { claimLinks } from "../review.ts";
import type { Evidence, Result } from "../report.ts";
import { active } from "./bibliography.ts";
import { itemOf, subjectOf } from "./records.ts";

/** Record files that cannot be read, with the ID each file name gives. */
const unread = (corpus: Corpus) => once(corpus, "unread attestations and notes", () => {
  const files = corpus.records.filter((f) => f.state === "unreadable" || f.state === "version_unsupported");
  return {
    attestations: files.filter((f) => f.path.startsWith("records/attestations/")).map((f) => f.path),
    notes: new Map(files.filter((f) => f.path.startsWith("records/notes/")).map((f) => [f.path.replace(/^.*\//, "").replace(/\.json$/, ""), f.path])),
  };
});

const retiredLinks = (corpus: Corpus) => once(corpus, "retired attestations by claim", () => grouped<unknown, LoadedFile>(
  corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "attestation" && isRetired(f.data)), (f) => [f.data!.claim]));

/** Why one attestation of a claim brings no note with it. */
function whyNot(corpus: Corpus, evidence: unknown): string {
  const target: LoadedFile | undefined = corpus.byId.get(String(evidence));
  if (!target?.data) return "its evidence is not a record that can be read";
  if (target.data.kind !== "note") return `its evidence is a ${String(target.data.kind)}, not a note`;
  return isRetired(target.data) ? "its note is retired" : "its note does not take part in checks";
}

export function claimResults(corpus: Corpus): Result[] {
  const check = "claim.complete";
  const confidences = TYPES.Claim!.confidence!.values!;
  return active(corpus, "claim").map((claim) => {
    const data = claim.data!;
    const links = claimLinks(corpus, idOf(claim) ?? "");
    const noted = links.some((l) => l.note);
    // An unreadable attestation could be any claim's; an unreadable note matters only to a claim that points at it.
    const hidden = noted ? [] : [...new Set([
      ...unread(corpus).attestations,
      ...links.flatMap((l) => unread(corpus).notes.get(String(l.attestation.data!.evidence)) ?? []),
    ])];
    const missing = [
      ...(noted || hidden.length > 0 ? [] : ["note"]),
      ...(typeof data.confidence === "string" && confidences.includes(data.confidence) ? [] : ["confidence"]),
      ...(typeof data.reason === "string" && data.reason.trim() !== "" ? [] : ["reason"]),
    ];
    const evidence: Evidence[] = [{ name: "claim_file", class: "location", value: claim.path }];
    if (missing.length > 0) evidence.push({ name: "missing", class: "metadata", value: missing.join(", ") });
    for (const path of hidden) evidence.push({ name: "cannot_be_read", class: "location", value: path });
    if (!noted) {
      for (const link of links) {
        evidence.push({ name: "attestation_without_a_note", class: "location", value: `${link.attestation.path}: ${whyNot(corpus, link.attestation.data!.evidence)}` });
      }
      for (const file of retiredLinks(corpus).get(idOf(claim)) ?? []) evidence.push({ name: "attestation_without_a_note", class: "location", value: `${file.path}: the attestation is retired` });
    }
    const outcome = hidden.length > 0 ? "unverifiable" : missing.length > 0 ? "fail" : "pass";
    return result({
      check, outcome, ...(outcome === "pass" ? {} : { reason: outcome === "fail" ? "claim_incomplete" : "record_unreadable" }),
      subject: subjectOf(claim), locus: idOf(claim) ?? claim.path, evidence, item: itemOf(claim),
    });
  });
}
