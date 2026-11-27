// Review marks (CONTRACT-001 G; CONTRACT-002 B1): the one rule for whether a
// mark applies, and what a claim rests on.
import { type Corpus, idOf, isObject, type LoadedFile } from "@stemma/records";
import { itemOf } from "./checks/records.ts";
import { activeRecords, activeWhere, once } from "./corpus-index.ts";

/**
 * A record is reviewed only while its mark says so and the content is still
 * what the mark was made on. A record with no mark is not reviewed.
 */
export function isReviewed(file: LoadedFile): boolean {
  const review = file.data?.review;
  return isObject(review) && review.state === "reviewed" && review.content_sha256 === itemOf(file)!.content_sha256;
}

const notesById = (corpus: Corpus) => once(corpus, "notes in effect by ID", () =>
  new Map<unknown, LoadedFile>(activeRecords(corpus, "note").map((n) => [idOf(n), n])));

/** The attestations in effect for a claim, each with its evidence note when that is a note in effect. */
export function claimLinks(corpus: Corpus, claim: string): { attestation: LoadedFile; note?: LoadedFile }[] {
  return activeWhere(corpus, "attestation", "claim", claim).map((attestation) => {
    const note = notesById(corpus).get(attestation.data!.evidence);
    return { attestation, ...(note ? { note } : {}) };
  });
}

/**
 * Every record with a review mark that a cited claim brings with it. What a
 * manuscript reaches beyond a claim's evidence is added here.
 */
export function claimReach(corpus: Corpus, claim: LoadedFile): LoadedFile[] {
  return [claim, ...claimLinks(corpus, idOf(claim)!).flatMap((l) => [l.attestation, ...(l.note ? [l.note] : [])])];
}
