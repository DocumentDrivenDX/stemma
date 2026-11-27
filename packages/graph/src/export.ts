// `graph export` and `graph status` as pure functions (CONTRACT-005 B, C, J).
// The same record and manuscript bytes and the same exporter version give the
// same bytes: no export holds a time, a user, a machine path or a git revision.
import { type ManuscriptView, type RecordStates, recordStates } from "@stemma/core";
import { compareCodePoints, type Corpus, corpusDigest, isObject, type LoadedFile, SEARCH_FOLD_VERSION, sha256 } from "@stemma/records";
import { graphDocument, jsonText, MODULE_NAME, moduleDocument, typeLabel, VIEW_VERSION } from "./module.ts";
import { type ManuscriptPort, manuscriptFile, manuscriptOf, quotedPassages } from "./manuscript.ts";
import { fillPage } from "./page.ts";
import { project, type Projection, type Warning } from "./project.ts";
import { sourceViewsFile, type SourceViewsFile } from "./sourceviews.ts";

export const ARRAS_VERSION = "0.8.1";
export const EXPORT_SCHEMA = "stemma.graph-export/0";
export const MANIFEST = "stemma.export.json";
export const PAGE = "explorer.html";
export const FILES = {
  module: "stemma.umf.json", graph: "stemma.graph.json", config: "arras-static.json", states: "stemma.states.json",
  sourceviews: "stemma.sourceviews.json", manuscript: "stemma.manuscript.json",
} as const;
/** The largest graph arras states support for. Beyond it an export is written with a warning. */
export const MEASURED = { entities: 1024, bytes: 7_900_000 };

export interface DataIdentity { corpus_digest: string; data_identity: string }

/**
 * The identity of what an export shows (CONTRACT-005 J): SHA-256 of the corpus
 * digest and then each manuscript file's digest, one a line, in digest order.
 * The report's list and template are manuscript files too.
 */
export function dataIdentity(corpus: Corpus): DataIdentity {
  const corpus_digest = corpusDigest(corpus);
  const report = corpus.report ? [corpus.report.spec, corpus.report.template ?? { path: "" }] : [];
  const manuscript = [...corpus.manuscript, ...report].map((f) => (f.bytes ? sha256(f.bytes) : "unreadable")).sort(compareCodePoints);
  return { corpus_digest, data_identity: sha256([corpus_digest, ...manuscript].map((d) => `${d}\n`).join("")) };
}

export interface Blocker { path: string; problems: string[] }

/**
 * What keeps an export from being made (CONTRACT-005, "Error Semantics"): only
 * what would make the export wrong, which is project settings that cannot be
 * read, or a records or sources directory that cannot be listed. A record that
 * cannot be read or breaks a rule is left out, counted and warned about.
 */
export function exportBlockers(corpus: Corpus): Blocker[] {
  const { settings } = corpus;
  const unread = settings.state !== "ok" || !settings.data;
  return [
    ...(unread ? [{ path: settings.path, problems: [settings.unreadable ?? (settings.state === "ok" ? "not_an_object" : settings.state)] }] : []),
    // A directory that could not be listed stands in the list as one file of its own name.
    ...corpus.records.filter((f: LoadedFile) => f.path === "records" || f.path === "sources").map((f) => ({ path: f.path, problems: ["cannot_list"] })),
  ];
}

export class UnreadableProject extends Error {
  constructor(readonly blockers: Blocker[]) {
    super(`The project cannot be read: ${blockers.map((b) => b.path).join(", ")}.`);
  }
}

export interface Manifest {
  schema: typeof EXPORT_SCHEMA;
  audience: "author";
  scope: "all";
  corpus_digest: string;
  data_identity: string;
  exporter: { name: "stemma"; version: string };
  arras: string;
  arras_view: string;
  search_fold: string;
  files: Record<string, string>;
  counts: { entities: number; links: number; by_type: Record<string, number> };
  omissions: Projection["omissions"];
  dropped_links: Projection["dropped"];
  states: { computed: string[]; not_computed: string[]; checks: string[]; checks_left_out: { check: string; why: string }[] };
  warnings: Warning[];
}

/** What the page's banner shows. It holds no file digest of the page itself. */
export type BannerData = Omit<Manifest, "files" | "schema" | "scope"> & { project_id: string; module_sha256: string; graph_sha256: string };

export interface Export {
  files: { name: string; text: string }[];
  manifest: Manifest;
  projection: Projection;
  states: RecordStates;
  sourceViews: SourceViewsFile["views"];
  manuscript: ManuscriptView;
}

export interface ExportRequest {
  version: string;
  /** The built page template. When given, the export holds explorer.html. */
  template?: string;
  /** The size cap of the source views; the default is CONTRACT-005 K's. */
  sourceViewsCap?: number;
  /** Makes the manuscript view of the project's report; `cli` takes it from `publish`. */
  manuscript?: ManuscriptPort;
  /** The size cap of the manuscript view; the default is CONTRACT-005 L's. */
  manuscriptCap?: number;
}

/** What an export is made of, before its files are written. */
function assemble(corpus: Corpus, request: ExportRequest, served = false) {
  const blockers = exportBlockers(corpus);
  if (blockers.length > 0) throw new UnreadableProject(blockers);
  const states = recordStates(corpus);
  const projection = project(corpus, states, { search: served });
  const made = manuscriptOf(corpus, projection, request.manuscript);
  const sources = sourceViewsFile(corpus, projection, request.sourceViewsCap, quotedPassages(made));
  const manuscript = manuscriptFile(made, sources.views, request.manuscriptCap);
  const omissions = [...projection.omissions, ...sources.omissions].sort((a, b) => compareCodePoints(`${a.type}\0${a.reason}`, `${b.type}\0${b.reason}`));
  const moduleText = jsonText(moduleDocument(projection, served));
  const graphText = jsonText(graphDocument(projection));
  const bytes = Buffer.byteLength(moduleText) + Buffer.byteLength(graphText);
  const warnings = [...projection.warnings, ...sources.warnings, ...manuscript.warnings];
  if (projection.entities.length > MEASURED.entities || bytes > MEASURED.bytes) {
    warnings.push({
      code: "large_graph",
      message: `This graph has ${projection.entities.length} entities and ${bytes} bytes. arras states support for up to ${MEASURED.entities} entities and ${MEASURED.bytes} bytes; a larger page may be slow or fail to open.`,
      records: [],
    });
  }
  const shared: Omit<Manifest, "files" | "schema" | "scope"> = {
    audience: "author",
    ...dataIdentity(corpus),
    exporter: { name: "stemma", version: request.version },
    arras: ARRAS_VERSION, arras_view: VIEW_VERSION, search_fold: SEARCH_FOLD_VERSION,
    counts: {
      entities: projection.entities.length, links: projection.links.length,
      by_type: Object.fromEntries(projection.types.map((t) => [t, projection.entities.filter((e) => e.type === t).length])),
    },
    omissions, dropped_links: projection.dropped,
    states: { computed: states.computed, not_computed: states.not_computed, checks: states.checks, checks_left_out: states.checks_left_out },
    warnings,
  };
  const banner = (): BannerData => {
    const named = corpus.settings.data?.project_id;
    const project_id = typeof named === "string" ? named : "";
    return { ...shared, project_id, module_sha256: sha256(moduleText), graph_sha256: sha256(graphText) };
  };
  return { states, projection, sources, manuscript, moduleText, graphText, shared, banner };
}

export function exportGraph(corpus: Corpus, request: ExportRequest): Export {
  const { states, projection, sources, manuscript, moduleText, graphText, shared, banner } = assemble(corpus, request);
  const exportedKeys = new Set(projection.entities.map((e) => e.key));
  const files: { name: string; text: string }[] = [
    { name: FILES.module, text: moduleText },
    { name: FILES.graph, text: graphText },
    { name: FILES.config, text: jsonText({ module: FILES.module, graph: FILES.graph }) },
    {
      name: FILES.states,
      text: jsonText({ schema: "stemma.states/0", records: Object.fromEntries([...states.records].filter(([id]) => exportedKeys.has(id))) }),
    },
    { name: FILES.sourceviews, text: sources.text },
    { name: FILES.manuscript, text: manuscript.text },
  ];
  if (request.template !== undefined) {
    files.push({ name: PAGE, text: fillPage(request.template, { banner: jsonText(banner()), [MODULE_NAME]: moduleText, graph: graphText, sourceviews: sources.text, manuscript: manuscript.text }) });
  }
  const manifest: Manifest = {
    schema: EXPORT_SCHEMA, scope: "all", ...shared,
    files: Object.fromEntries(files.map((f) => [f.name, sha256(f.text)])),
  };
  return { files: [...files, { name: MANIFEST, text: jsonText(manifest) }], manifest, projection, states, sourceViews: sources.views, manuscript: manuscript.view };
}

/** Warnings that tell the reader of an export what to do with its files, said of a served page instead. */
const SERVED_WORDS: [Warning["code"], string, string][] = [
  ["records_left_out", ", then export again.", "; the page reads the files again when they change."],
  ["broken_references", ", then export again.", "; the page reads the files again when they change."],
  ["manuscript_unavailable", "The report is not in this export:", "The report cannot be shown:"],
  ["manuscript_unavailable", "Fix it, then export again.", "Fix it; the page reads it again."],
  ["coordinates_in_views", "The export was written with it, so anyone given the export can read it. If it locates a restricted site, do not pass the export on.", "The served page shows it. If it locates a restricted site, do not pass on what you copy from the page."],
  ["coordinates_in_manuscript", "The export was written with it, so anyone given the export can read it. If it locates a restricted site, do not pass the export on.", "The served page shows it. If it locates a restricted site, do not pass on what you copy from the page."],
];

const servedWarning = (warning: Warning): Warning => ({
  ...warning,
  message: SERVED_WORDS.reduce((message, [code, from, to]) => (code === warning.code ? message.replace(from, to) : message), warning.message),
});

export interface Served {
  data_identity: string;
  banner: BannerData;
  moduleText: string;
  graphText: string;
  views: SourceViewsFile["views"];
  manuscript: ManuscriptView;
  /** What the server's search reads (CONTRACT-005 M, "Search"): the types in declaration order, and each entry in theirs, then by key. */
  search: { types: { type: string; label: string }[]; entries: { type: string; key: string; label: string; text: string }[] };
}

/**
 * The author export as the local server holds it (CONTRACT-005 M): the same
 * data, made by the same function, with no size cap on the source views or the
 * manuscript view, and no files. The served page does not load the graph, so
 * the warning about its size is left out.
 */
export function servedData(corpus: Corpus, request: Pick<ExportRequest, "version" | "manuscript">): Served {
  const made = assemble(corpus, { ...request, sourceViewsCap: Number.POSITIVE_INFINITY, manuscriptCap: Number.POSITIVE_INFINITY }, true);
  const banner = made.banner();
  return {
    data_identity: made.shared.data_identity,
    banner: { ...banner, warnings: banner.warnings.filter((w) => w.code !== "large_graph").map(servedWarning) },
    moduleText: made.moduleText, graphText: made.graphText, views: made.sources.views, manuscript: made.manuscript.view,
    search: {
      types: made.projection.types.map((type) => ({ type, label: typeLabel(type) })),
      entries: made.projection.entities.map((e, i) => ({ type: e.type, key: e.key, label: String(e.properties.heading), text: made.projection.search![i]! })),
    },
  };
}

/**
 * The files in a directory that are an export's own, which another export may
 * overwrite or remove: its manifest and the export files that manifest lists.
 * None when the text is not an export manifest.
 */
export function exportOwnFiles(manifestText: string): string[] {
  try {
    const manifest = JSON.parse(manifestText) as Manifest;
    if (manifest.schema !== EXPORT_SCHEMA || !isObject(manifest.files as never)) return [];
    const known: string[] = [...Object.values(FILES), PAGE];
    return [MANIFEST, ...Object.keys(manifest.files).filter((name) => known.includes(name))];
  } catch {
    return [];
  }
}

export interface Staleness {
  fresh: boolean;
  reasons: ("data_changed" | "exporter_changed" | "file_changed" | "file_missing" | "manifest_unreadable")[];
  files: string[];
}

/** Whether an existing export still shows what the project holds. `read` gives a file of the export. */
export function exportStaleness(manifestText: string, now: DataIdentity, version: string, read: (name: string) => Uint8Array | undefined): Staleness {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestText) as Manifest;
    if (manifest.schema !== EXPORT_SCHEMA || !isObject(manifest.files as never)) throw new Error("not an export manifest");
  } catch {
    return { fresh: false, reasons: ["manifest_unreadable"], files: [MANIFEST] };
  }
  const reasons = new Set<Staleness["reasons"][number]>();
  const files: string[] = [];
  if (manifest.data_identity !== now.data_identity || manifest.corpus_digest !== now.corpus_digest) reasons.add("data_changed");
  if (manifest.exporter?.version !== version) reasons.add("exporter_changed");
  const known: string[] = [...Object.values(FILES), PAGE];
  for (const [name, expected] of Object.entries(manifest.files)) {
    // A manifest is only a file in a directory: it cannot name what is read.
    const bytes = known.includes(name) ? read(name) : undefined;
    if (bytes && sha256(bytes) === expected) continue;
    reasons.add(bytes ? "file_changed" : "file_missing");
    files.push(name);
  }
  return { fresh: reasons.size === 0, reasons: [...reasons].sort(), files };
}
