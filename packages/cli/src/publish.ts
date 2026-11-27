// Citations and the research report (CONTRACT-002 B, CONTRACT-006 I): formatted
// by citeproc-js with the pinned Chicago style, and typeset by the pinned Typst.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CITEPROC_VERSION, type CiteItem, formatCitations, LOCALE, STYLE } from "@stemma/cite";
import { InvalidInput, runChecks } from "@stemma/core";
import { buildReport, compileTypst, evidenceLedger, ledgerWords, obtainTypst, ReportError, type ReportSpec, TYPST_VERSION, TypstUnavailable } from "@stemma/publish";
import { isObject, sha256 } from "@stemma/records";
import { projectRelative } from "@stemma/workspace";
import { CommandError, emit, openCorpus, type Options, requireProject, tools, usageError } from "./context.ts";

const readJson = (path: string, what: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new InvalidInput(`${what} cannot be read as JSON.`);
  }
};

/** `cite format`: notes in order, then the bibliography, from a list of clusters. */
export function citeFormat(options: Options): number {
  if (!options.input) throw usageError('cite format needs --input <file> (or - for standard input): {"notes": [[{"key": "…", "locator": "…"}], …]}.');
  const root = requireProject(options);
  const input = readJson(options.input === "-" ? "/dev/stdin" : resolve(root, options.input), "The input");
  const notes = isObject(input) && Array.isArray(input.notes) ? input.notes : undefined;
  const clusters = notes?.map((n) => (Array.isArray(n) ? n.filter(isObject).map((i): CiteItem => {
    if (typeof i.key !== "string") throw new InvalidInput("Every item needs a key.");
    return { key: i.key, ...(typeof i.locator === "string" ? { locator: i.locator, label: typeof i.label === "string" ? i.label : "page" } : {}) };
  }) : []));
  if (!clusters) throw new InvalidInput('The input is {"notes": [[{"key": "…", "locator": "…"}], …]}: one list of items for each note.');
  const made = formatCitations(openCorpus(root), clusters.map((items, i) => ({ note: i + 1, items })));
  const text = [
    ...made.citations.map((n, i) => `${i + 1}. ${n}`), "", "Bibliography", ...made.bibliography, "",
    ...made.problems.map((p) => `cite.format: note ${p.note}: ${p.problem === "no_source" ? `no source has the key ${p.key}; the note shows it marked` : `${p.key} holds reserved characters`}`),
    `Formatted by citeproc-js ${CITEPROC_VERSION} with ${STYLE.title} (${STYLE.file}, ${STYLE.commit.slice(0, 12)}) and ${LOCALE.file}.`,
  ].join("\n");
  emit(options, { notes: made.citations, bibliography: made.bibliography, problems: made.problems, citeproc: CITEPROC_VERSION, style: STYLE, locale: LOCALE }, `${text}\n`);
  return made.problems.length > 0 ? 1 : 0;
}

/** `build report [<dir>]`: the report in <dir> (default `report`) rebuilt, checked, or typeset. */
export async function buildReportCommand(options: Options, dir: string | undefined): Promise<number> {
  const root = requireProject(options);
  const rel = projectRelative(root, dir ?? "report");
  const base = join(root, rel);
  const specPath = join(base, "report.json");
  if (!existsSync(specPath)) throw new InvalidInput(`${rel}/report.json does not exist.`);
  const spec = readJson(specPath, `${rel}/report.json`) as ReportSpec;
  if (!isObject(spec) || typeof spec.manuscript !== "string" || !Array.isArray(spec.quotations)) {
    throw new InvalidInput(`${rel}/report.json needs "manuscript" (a file name) and "quotations" (a list).`);
  }
  const corpus = openCorpus(root);
  const settings = corpus.settings.data!;
  const include = Array.isArray(settings.bibliography_include) ? settings.bibliography_include.map(String) : [];
  const template = readFileSync(join(base, spec.manuscript), "utf8");
  let built;
  try {
    built = buildReport(corpus, spec, template, include);
  } catch (error) {
    if (error instanceof ReportError) {
      const told = options.check ? " Whether the report's files are current cannot be told." : "";
      throw new CommandError(5, "report_input", `The report was not built: ${error.message}. Nothing was written.${told}`, [rel]);
    }
    throw error;
  }
  const problems = built.problems.map((p) => `cite.format: ${p}`);
  const ledger = evidenceLedger({
    corpus, spec, assembly: built.assembly, quotations: built.quotations,
    outputs: { "report.md": built.files["report.md"]!, "report.typ": built.files["report.typ"]! },
    inputs: { spec_sha256: sha256(readFileSync(specPath)), template_sha256: sha256(template) },
    checks: runChecks(corpus, tools()).body,
  });
  built.files["evidence.json"] = ledger;
  if (options.check) {
    const stale = Object.entries(built.files).filter(([name, text]) => !existsSync(join(base, name)) || readFileSync(join(base, name), "utf8") !== text).map(([n]) => n);
    if (stale.length > 0) {
      emit(options, { stale, problems }, `Out of date: ${stale.map((n) => `${rel}/${n}`).join(", ")}. Run build report ${rel} to rebuild.\n`);
      return 1;
    }
    emit(options, { stale, notes: built.notes.length, problems }, `${Object.keys(built.files).map((n) => `${rel}/${n}`).join(", ")} are current: ${built.notes.length} notes.\n${problems.join("\n")}${problems.length ? "\n" : ""}`);
    return problems.length > 0 ? 1 : 0;
  }
  for (const [name, text] of Object.entries(built.files)) writeFileSync(join(base, name), text);
  mkdirSync(join(base, "build"), { recursive: true });
  writeFileSync(join(base, "build/notes.json"), `${JSON.stringify({ notes: built.notes }, null, 1)}\n`);
  const lines = [`Wrote ${Object.keys(built.files).map((n) => `${rel}/${n}`).join(", ")}: ${built.notes.length} notes, about ${built.words} words before the notes.`, ledgerWords(ledger), ...problems];
  if (options.pdf) {
    const data = process.env.STEMMA_DATA;
    if (!data) throw new CommandError(4, "no_data_directory", "The plugin's data directory is not known, so the pinned Typst cannot be found or fetched. Run Stemma through its launcher.");
    try {
      const typst = await obtainTypst(data, (line) => process.stderr.write(`${line}\n`));
      compileTypst(typst, base, join(base, "report.typ"), join(base, "report.pdf"));
    } catch (error) {
      if (error instanceof TypstUnavailable) throw new CommandError(4, "typst_unavailable", `${error.message} The Markdown and Typst files were written; the PDF was not.`);
      throw error;
    }
    lines.push(`Typeset ${rel}/report.pdf with Typst ${TYPST_VERSION}.`);
  }
  emit(options, { written: Object.keys(built.files), notes: built.notes.length, problems }, `${lines.join("\n")}\n`);
  return problems.length > 0 ? 1 : 0;
}
