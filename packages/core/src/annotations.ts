// Annotations (CONTRACT-001 G; CONTRACT-002 E and F): a saved note that explains
// or dismisses one finding. An annotation never changes an outcome. An
// explanation leaves the finding open and is shown with it; only a person's
// dismissal makes it not open, and it stays listed with the reason. A note
// applies only while everything it was bound to is as it was.
import { canonical, checkShape, type Corpus, idOf, isObject, KINDS, parseJson, type Problem, RECORD_SCHEMA, recordPath } from "@stemma/records";
import { type Actor, InvalidInput } from "./operations.ts";
import type { RecordWrite } from "./capture.ts";
import { active } from "./checks/bibliography.ts";
import { sourceBinding } from "./checks/changed.ts";
import type { Result } from "./report.ts";
import { grouped } from "./corpus-index.ts";

/** Facts that keep a project from being checked clean: they can be explained, not dismissed. */
const NOT_DISMISSIBLE = new Set(["source.held", "record.valid", "build.uncommitted"]);
/** A project with text that is not here is never checked clean (FR-98), so that finding cannot be dismissed either. */
const dismissible = (found: Result): boolean => !NOT_DISMISSIBLE.has(found.check) && !(found.check === "source.pages" && found.reason_code === "not_held");

/** What a note on this finding binds to, copied from the finding and never from a caller. */
function bindingOf(corpus: Corpus, found: Result): Record<string, unknown> {
  if (found.sentence) {
    const source = found.source === undefined ? undefined : corpus.byId.get(found.source)?.data;
    return {
      sentence: { ...found.sentence },
      ...(source ? { source: { source: found.source!, record_sha256: sourceBinding(source) } } : {}),
    };
  }
  return found.item ? { item: { ...found.item } } : {};
}

const valueOf = (found: Result, name: string): string | undefined => found.evidence.find((e) => e.name === name)?.value;

/** For a near match: the two texts the writer was shown. */
function comparedOf(found: Result): Record<string, string> | undefined {
  const [cited, stored, profile] = [valueOf(found, "cited_text"), valueOf(found, "source_passage"), valueOf(found, "profile")];
  return found.reason_code === "near_match" && cited !== undefined && stored !== undefined && profile !== undefined
    ? { cited_text: cited, stored_text: stored, profile } : undefined;
}

const same = (a: unknown, b: unknown): boolean => canonical({ value: a ?? false }) === canonical({ value: b ?? false });

/** Marks each finding with the notes that still apply to it. */
export function annotate(corpus: Corpus, results: Result[]): Result[] {
  const notes = [...active(corpus, "annotation")].sort((a, b) => (a.path < b.path ? -1 : 1));
  if (notes.length === 0) return results;
  const byFinding = grouped<unknown, (typeof notes)[number]>(notes, (f) => [f.data!.finding_key]);
  return results.map((found) => {
    if (found.outcome === "pass") return found;
    const named = byFinding.get(found.finding_key);
    if (!named) return found;
    const binding = bindingOf(corpus, found);
    const applying = named.flatMap((file) => {
      const note = file.data!;
      if (note.check !== found.check) return [];
      if (!["sentence", "source", "item"].every((name) => same(note[name], binding[name]))) return [];
      if (note.compared !== undefined) {
        const now = comparedOf(found);
        const then = isObject(note.compared) ? note.compared : {};
        if (!now || Object.entries(now).some(([k, v]) => then[k] !== v)) return [];
      }
      const by = isObject(note.written) && isObject(note.written.by) ? note.written.by : {};
      return [{ id: idOf(file)!, effect: String(note.effect), by: `${String(by.kind)} ${String(by.name)}`, person: by.kind === "person", reason: String(note.reason) }];
    });
    if (applying.length === 0) return found;
    const dismissed = dismissible(found) && applying.some((n) => n.effect === "dismiss" && n.person);
    return { ...found, annotations: applying.map(({ person: _p, ...n }) => n), open: found.open && !dismissed };
  });
}

export interface AnnotationRequest {
  finding: string;
  effect: "explain" | "dismiss";
  reason: string;
  actor: Actor;
  now: Date;
  token: () => string;
}

/** A note on one finding of a run just made. */
export function planAnnotation(corpus: Corpus, results: Result[], request: AnnotationRequest): RecordWrite & { finding: Result } {
  const found = results.find((r) => r.finding_key === request.finding);
  if (!found || found.outcome === "pass") throw new InvalidInput("No finding of this project has that finding key. Take it from the report `check` writes.");
  if (request.reason.trim() === "") throw new InvalidInput("The reason is empty.");
  if (request.effect === "dismiss") {
    if (request.actor.kind !== "person") throw new InvalidInput("Only a person can dismiss a finding. A model or script records what it found with --effect explain, and the finding stays open.");
    if (!dismissible(found)) throw new InvalidInput(`${found.reason_code === "not_held" ? "A finding that a source's text is not here" : `A ${found.check} finding`} can be explained, not dismissed.`);
  }
  const id = `${KINDS.annotation!.prefix}${request.token()}`;
  const stamp = { at: request.now.toISOString().replace(/\.\d+Z$/, "Z"), by: { ...request.actor } };
  const compared = comparedOf(found);
  const text = canonical({
    schema: RECORD_SCHEMA, id, kind: "annotation", created: stamp, effect: request.effect, check: found.check,
    finding_key: found.finding_key, ...bindingOf(corpus, found), ...(compared ? { compared } : {}), reason: request.reason, written: stamp,
  });
  const problems: Problem[] = [];
  checkShape("Annotation", parseJson(text).value, "", "annotation", problems, []);
  if (problems.length > 0) throw new InvalidInput(`These values do not make a valid annotation record (${problems.map((p) => `${p.code} at ${p.field}`).join(", ")}).`);
  return { id, path: recordPath("annotation", id), text, finding: found };
}
