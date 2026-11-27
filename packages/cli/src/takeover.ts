// The `takeover` command (CONTRACT-002 B; CONTRACT-003 F and I). The original
// is read and never written. Everything the intake makes is written together or
// not at all.
import { statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { type Actor, renderTakeover } from "@stemma/core";
import { type IntakeReport, planTakeover, RepeatedChapter, TakeoverDefect, TakeoverRefused, WORD_LIMITS, WordError } from "@stemma/intake";
import { canonical, sha256 } from "@stemma/records";
import { randomToken, readProject, withWriteLock, writeProjectFile, writeStaged } from "@stemma/workspace";
import { actorOf, CommandError, emit, namedFile, openCorpus, type Options, requireProject, usageError, VERSION } from "./context.ts";

const SOFTWARE: Actor = { kind: "software", name: "stemma takeover" };

const notYet = (what: string) => new CommandError(2, "not_implemented", `${what} is not implemented in this version. Nothing was done.`);

export function takeover(options: Options, named: string[]): number {
  const [file] = named;
  if (!file || named.length > 1) throw usageError("takeover needs one Word file: takeover <file.docx>. Run it once for each file of a manuscript.");
  if (options.library) throw notYet("Reading a reference library at takeover (--library)");
  if (options.again) throw notYet("Running takeover again on the same file (--again)");
  const root = requireProject(options);
  openCorpus(root);
  const path = resolve(root, file);
  try {
    const stat = statSync(path);
    if (stat.isFile() && stat.size > WORD_LIMITS.file_bytes) {
      throw new CommandError(5, "input_limit", `The file is over the size limit of ${WORD_LIMITS.file_bytes / 1048576} MiB. Nothing was written.`);
    }
  } catch (error) {
    if (error instanceof CommandError) throw error;
    // Reported by the read below.
  }
  const bytes = namedFile(root, file, WORD_LIMITS.file_bytes)!;
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-") throw notYet("Takeover of a PDF manuscript");
  const actor = actorOf(options) ?? SOFTWARE;
  const digest = sha256(bytes);
  const name = basename(path);

  const plan = withWriteLock(root, () => {
    const content = readProject(root);
    try {
      const made = planTakeover({
        content, file: { name, bytes }, actor, now: new Date(), token: randomToken, version: VERSION,
        ...(options.separate ? { separate: true } : {}),
      });
      if (made.status === "imported" || made.status === "changed") {
        const settings = content.settings.bytes!;
        writeStaged(root, made.files, new Map(made.files.some((f) => f.path === "stemma.json") ? [["stemma.json", Buffer.from(settings)]] : []));
      }
      return made;
    } catch (error) {
      if (error instanceof WordError) {
        throw new CommandError(error.code === "docx_unreadable" ? 3 : 5, error.code, `${error.message} Nothing was written.`, [file]);
      }
      if (error instanceof RepeatedChapter) {
        throw new CommandError(5, "repeated_chapter",
          `Nothing was written. ${Math.round(error.share * 100)}% of this file's runs of 12 words are already in the chapters taken over from ${error.earlier}. Take one file for each chapter. If this is a revision of that file under another name, Stemma does not apply revisions, and --separate would add it as a second chapter. Pass --separate only for a different text.`,
          [file]);
      }
      if (error instanceof TakeoverRefused) throw new CommandError(3, "project_unreadable", `${error.message} Nothing was written.`, error.paths);
      if (error instanceof TakeoverDefect) {
        throw new CommandError(70, "takeover_defect", `Takeover could not make a sound copy of this file, so nothing was written. This is a Stemma defect: ${error.message}`, [file]);
      }
      throw error;
    }
  });

  // The original is only ever read (INT-03). This says so from the file, not from the code.
  if (sha256(namedFile(root, file, WORD_LIMITS.file_bytes)!) !== digest) {
    throw new CommandError(5, "stale_input", "The original changed while it was being taken over. What was written reflects the file as it was first read.", [file]);
  }

  if (plan.status === "already") {
    emit(options, plan, `${name} was already taken over, as ${plan.name} (${plan.batch}). Nothing was written.\n`);
    return 0;
  }
  if (plan.status === "changed" || plan.status === "change_already_reported") {
    const said = plan.status === "changed" ? "Saved one item saying so" : "An earlier run saved an item saying so";
    emit(options, { status: plan.status, batch: plan.batch, item: plan.item },
      `${name} has changed since it was taken over (${plan.batch}). The change is not applied: no chapter or citation was changed. ${said}: ${plan.item}.\nKeep working in the Stemma copy under manuscript/, or pass --separate if this is a different text with the same name.\n`);
    return 1;
  }
  return report(options, root, plan.report);
}

function report(options: Options, root: string, made: IntakeReport): number {
  const path = `.stemma/reports/intake-${made.body.batch}.json`;
  writeProjectFile(root, path, canonical(made));
  emit(options, made, `${renderTakeover(made.body)}\nFull intake report: ${join(root, path)}\n`);
  return made.body.takeover.groups.length > 0 ? 1 : 0;
}
