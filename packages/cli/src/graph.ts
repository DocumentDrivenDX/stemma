// `graph export` and `graph status` (CONTRACT-002 B; CONTRACT-005 B and C). The
// export is rebuilt from the record files on request and never committed.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  dataIdentity, type Export, exportBlockers, exportGraph, ExportMappingError, exportOwnFiles, exportStaleness, FILES, MANIFEST, PAGE,
} from "@stemma/graph";
import { checkOutputDirectory, outputExists, readOutputFile, RefusedOutput, removeOutputFile, writeOutputFiles } from "@stemma/workspace";
import { CommandError, emit, openCorpus, type Options, requireProject, usageError, VERSION } from "./context.ts";

const TEMPLATE = "explorer.template.html";

/**
 * The page template ships beside the built command line. Only a run from this
 * repository's source, which has no built file beside it, makes one.
 */
async function pageTemplate(): Promise<string> {
  const shipped = join(import.meta.dir, TEMPLATE);
  if (existsSync(shipped)) return readFileSync(shipped, "utf8");
  if (/[\\/]packages[\\/]cli[\\/]src[\\/]graph\.ts$/.test(import.meta.path)) {
    // Not a literal, so that the built command line holds no bundler and nothing of the explorer's sources.
    const builder = join(import.meta.dir, "../../explorer/build.ts");
    return ((await import(builder)) as { buildTemplate: () => Promise<string> }).buildTemplate();
  }
  throw new CommandError(70, "page_template_missing", "This copy of Stemma lacks its explorer page template, so no page was made. Nothing was written. Install Stemma again.", [shipped]);
}

function audienceOf(options: Options): void {
  if (options.audience === "reviewer") {
    throw new CommandError(2, "not_implemented", "`graph export --audience reviewer` is not implemented in this version: a partial filter could disclose withheld text. Nothing was done.");
  }
  if (options.audience !== "author") throw usageError("--audience is author. A reviewer export is not implemented yet.");
}

const outputOf = (root: string, options: Options): string => resolve(root, options.out ?? "build/graph/author");

const total = (list: { count: number }[]) => list.reduce((n, one) => n + one.count, 0);

export async function graphExport(options: Options): Promise<number> {
  if (options.chapter !== undefined) throw new CommandError(2, "not_implemented", "`graph export --chapter` is not implemented in this version. Nothing was done.");
  audienceOf(options);
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const blockers = exportBlockers(corpus);
  if (blockers.length > 0) {
    const listed = blockers.slice(0, 20).map((b) => `  ${b.path}: ${b.problems.slice(0, 3).join(", ")}`).join("\n");
    throw new CommandError(3, "project_unreadable", `The project cannot be read, so a graph of it would be wrong. Nothing was written. Run \`check\` for what is wrong and how to fix it.\n${listed}`, blockers.map((b) => b.path));
  }
  const template = options.page ? await pageTemplate() : undefined;
  let made: Export;
  try {
    made = exportGraph(corpus, { version: VERSION, ...(template === undefined ? {} : { template }) });
  } catch (error) {
    if (error instanceof ExportMappingError) {
      throw new CommandError(70, "export_mapping_error", `The records could not be put into a graph, which is a Stemma defect. Nothing was written. ${error.message}`);
    }
    throw error;
  }
  const out = outputOf(root, options);
  // Every name an export may write or remove.
  const names: string[] = [...Object.values(FILES), PAGE, MANIFEST];
  try {
    checkOutputDirectory(root, out, names);
  } catch (error) {
    if (error instanceof RefusedOutput) throw new CommandError(5, "output_refused", `Nothing was written to ${out}. ${error.message}`, [out]);
    throw error;
  }
  const previous = readOutputFile(out, MANIFEST);
  const own = new Set(previous ? exportOwnFiles(new TextDecoder().decode(previous)) : []);
  // A name that is there as anything but a plain file of an earlier export is someone else's.
  const others = names.filter((name) => outputExists(out, name) && !(own.has(name) && readOutputFile(out, name)));
  if (others.length > 0) {
    throw new CommandError(5, "output_refused", `Nothing was written to ${out}. It already holds ${others.join(", ")}, which no export manifest there lists as an export's own, so Stemma will not overwrite or remove it. Choose another directory with --out, or move what is there.`, [out]);
  }
  // A page left from an earlier export would show earlier data beside this one.
  if (!options.page) removeOutputFile(out, PAGE);
  // The manifest goes first: an export cut short still owns its files, so it can
  // be made again, and never reads as current, since their digests differ.
  writeOutputFiles(out, [...made.files].sort((a, b) => Number(b.name === MANIFEST) - Number(a.name === MANIFEST)));
  const { manifest } = made;
  // Something is open when the graph leaves out, or cannot follow, what it should show.
  const open = manifest.warnings.some((w) => w.code !== "large_graph");
  const lines = [
    `Exported the author graph to ${out}`,
    `Data identity ${manifest.data_identity.slice(0, 12)}${options.page ? " (the page shows the same)" : ""}`,
    `Entries: ${manifest.counts.entities}. Links: ${manifest.counts.links}. Left out: ${total(manifest.omissions)} items and ${total(manifest.dropped_links)} links, each listed by type and reason in ${MANIFEST}.`,
    `States shown where they apply: ${manifest.states.computed.join(", ")}. Not computed: ${manifest.states.not_computed.join(", ")}. A record with no state has not been shown to be clear.`,
    ...manifest.warnings.map((w) => `WARNING ${w.code}: ${w.message}${w.records.length > 0 ? ` ${w.code === "records_left_out" ? "Files" : "Records"}: ${w.records.slice(0, 20).join(", ")}${w.records.length > 20 ? ` and ${w.records.length - 20} more, all listed in ${MANIFEST}` : ""}.` : ""}`),
    "These files hold passage text and other record contents: anyone who is given them can read all of it.",
    options.page ? `Open ${join(out, PAGE)} in a browser. After records change, export again and reload.` : "No page was made; add --page for explorer.html.",
  ];
  emit(options, { out, ...(options.page ? { page: join(out, PAGE) } : {}), manifest }, `${lines.join("\n")}\n`);
  return open ? 1 : 0;
}

const STALE: Record<string, string> = {
  data_changed: "records, sources, rules or manuscript files changed since it was made",
  exporter_changed: "another version of Stemma made it",
  file_changed: "a file in it was changed",
  file_missing: "a file in it is missing",
  manifest_unreadable: "its manifest cannot be read",
};

export function graphStatus(options: Options): number {
  if (options.audience !== undefined) audienceOf(options);
  const root = requireProject(options);
  const out = outputOf(root, options);
  const now = dataIdentity(openCorpus(root));
  const manifest = readOutputFile(out, MANIFEST);
  if (!manifest) {
    emit(options, { out, state: "missing", data_identity: now.data_identity },
      `No export at ${out}. Make one with \`graph export --audience author --page\`.\n`);
    return 1;
  }
  const found = exportStaleness(new TextDecoder().decode(manifest), now, VERSION, (name) => readOutputFile(out, name));
  const head = found.fresh
    ? `The export at ${out} is current: data identity ${now.data_identity.slice(0, 12)}.`
    : `The export at ${out} is stale: ${found.reasons.map((r) => STALE[r]).join("; ")}.${found.files.length > 0 ? ` Files: ${found.files.join(", ")}.` : ""}\nExport again, then reload the page.`;
  emit(options, { out, state: found.fresh ? "fresh" : "stale", data_identity: now.data_identity, ...found }, `${head}\n`);
  return found.fresh ? 0 : 1;
}
