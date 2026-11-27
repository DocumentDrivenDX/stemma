// `retire` (CONTRACT-002 B; CONTRACT-001 C): removal sets `retired` and the file
// stays. What rested on a retired record is then listed by source.changed.
import { canonical, type Corpus, idOf, isObject, isRetired, serializeManifest, splitFrontMatter } from "@stemma/records";
import { type Actor, InvalidInput } from "./operations.ts";
import type { RecordWrite } from "./capture.ts";

export interface RetireRequest { ids: string[]; reason: string; replaced_by?: string; actor: Actor; now: Date }

export function planRetire(corpus: Corpus, request: RetireRequest): RecordWrite[] {
  const { ids, reason, replaced_by } = request;
  if (reason.trim() === "") throw new InvalidInput("The reason is empty.");
  if (replaced_by !== undefined && ids.length !== 1) throw new InvalidInput("--replaced-by goes with exactly one record.");
  return [...new Set(ids)].map((id) => {
    const file = corpus.byId.get(id);
    if (!file?.data) throw new InvalidInput(`No readable record has the ID ${id}.`);
    if (isRetired(file.data)) throw new InvalidInput(`${id} is already retired.`);
    if (!file.formattable) throw new InvalidInput(`${file.path} holds values that rewriting would change. Correct it first.`);
    if (replaced_by !== undefined) {
      const other = corpus.byId.get(replaced_by);
      if (!other?.data || other.data.kind !== file.data.kind || idOf(other) === id || (isObject(other.data) && isRetired(other.data))) {
        throw new InvalidInput(`--replaced-by must name another ${String(file.data.kind)} record that is not retired.`);
      }
    }
    const retired = {
      stamp: { at: request.now.toISOString().replace(/\.\d+Z$/, "Z"), by: { ...request.actor } }, reason,
      ...(replaced_by === undefined ? {} : { replaced_by }),
    };
    const next = { ...file.data, retired };
    if (file.data.kind !== "source_text") return { id, path: file.path, text: canonical(next) };
    // Retiring a source file rewrites only its manifest.
    const split = splitFrontMatter(new TextDecoder().decode(file.bytes));
    return { id, path: file.path, text: serializeManifest(next, "problem" in split ? "" : split.body) };
  });
}
