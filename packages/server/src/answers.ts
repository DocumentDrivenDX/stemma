// What a built snapshot answers (CONTRACT-005 M): arras's own static loader and
// static client over the export's module and graph, held in memory, with the
// source views and the manuscript view beside them, and Stemma's own search,
// which also answers arras's search query. Nothing here writes, opens a file, or
// connects anywhere: a record ID is only looked up.
import { createStaticClient, loadStore } from "@documentdrivendx/arras-ui/static";
import { agentRecordOf, agentSearch, agentView } from "./agent.ts";
import { originalPage, recordedOriginals, type TextOriginal } from "../../core/src/original-pages.ts";
import { type HighlightTarget, noHighlight, type NoHighlightReason } from "../../core/src/highlight.ts";
import type { HighlightTargets } from "../../core/src/highlight-target.ts";
import { ARRAS_SEARCH_QUERY, arrasAccepts, createSearch, queryOf, SEARCH_LIMITS, type SearchData } from "./search.ts";
import type { SourceView } from "../../core/src/source-view.ts";
import type { Answer } from "./snapshots.ts";

export interface ServedData {
  data_identity: string;
  banner: unknown;
  moduleText: string;
  graphText: string;
  views: Record<string, unknown>;
  manuscript: { state: string };
  search: SearchData;
  /** What each source file records of its original, for the page it is and the digests that may be given. */
  originals?: Record<string, TextOriginal>;
  /** Where each highlighted passage's words lie in the text of each of its parts, for marking an original. */
  highlights?: HighlightTargets;
}

/** What a snapshot says of a passage's place on an original: what to look for, or why nothing is. */
export type HighlightAsk = { target: HighlightTarget } | { none: NoHighlightReason };

export const ARRAS_CALLS = ["version", "viewer", "meta", "status", "schemaCatalog", "export"] as const;

export function refusal(status: number, code: string, message: string): Answer {
  return { status, body: JSON.stringify({ error: { code, message } }) };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const BAD = refusal(400, "bad_request", "The request body is not what this call takes.");

/** The most an answer to a query or a search may take (rule 13). */
export const MOST_ANSWER_BYTES = 8 * 1024 * 1024;
const BOUNDED = new Set(["query", "arras", "search"]);
const TOO_LARGE = refusal(422, "answer_too_large", "The answer would be larger than the server sends. Ask for less at once; the Search view lists matches a page at a time.");
const SEARCH_KEYS = new Set(["text", "type", "offset", "limit"]);
const wholeFrom = (value: unknown, least: number, most: number): value is number => Number.isSafeInteger(value) && (value as number) >= least && (value as number) <= most;

export async function answersOf(data: ServedData, mostBytes: number = MOST_ANSWER_BYTES): Promise<(route: string, body: unknown) => Promise<Answer>> {
  const client = createStaticClient(await loadStore(data.moduleText, data.graphText), data.moduleText);
  const { banner, views, manuscript, data_identity } = data;
  const search = createSearch(data.search);
  const record = agentRecordOf(data.search.entries);
  // What the export warns of, such as records left out, so that no result passes for the whole project when it is not.
  const warnings = ((data.banner as { warnings?: { code: string; records: string[] }[] } | null)?.warnings ?? []).map((w) => ({ code: w.code, named: w.records.length }));
  const texts = data.originals ?? {};
  const recorded = recordedOriginals(texts);
  const moduleName = (JSON.parse(data.moduleText) as { id: string }).id;
  // What arras says of its answers' freshness and revision, taken from one answer of its own.
  const probe = await client.moduleQuery(moduleName, 'query { _search(text: "zz", limit: 1) { freshness { backend asOf at consistency } } }');
  const freshness = (probe.data as { _search?: { freshness?: unknown[] } } | null)?._search?.freshness ?? [];
  const ok = (result: unknown): Answer => ({ status: 200, body: JSON.stringify({ data_identity, result: result ?? null }) });
  /** arras's refusal, passed to the page as arras made it. */
  const arras = async (call: () => Promise<unknown>): Promise<Answer> => {
    try {
      return ok(await call());
    } catch (error) {
      const { status, code, message } = error as { status?: unknown; code?: unknown; message?: unknown };
      if (typeof status !== "number") throw error;
      return { status: 422, body: JSON.stringify({ error: { code: "arras_refusal", message: String(message), arras: { status, code: typeof code === "string" ? code : undefined } } }) };
    }
  };
  /** arras's search query, answered by Stemma's search. A search arras would not accept gets arras's own refusal. */
  const arrasSearch = (module: string, query: string, variables: Record<string, unknown>) => {
    const { text, types, limit = 20, ...more } = variables;
    const names = types === null || types === undefined ? undefined : types;
    if (Object.keys(more).length > 0 || typeof text !== "string" || (limit !== null && !wholeFrom(limit, 1, SEARCH_LIMITS.arrasPage))
      || (names !== undefined && !(Array.isArray(names) && names.every((name) => typeof name === "string" && search.hasType(name))))) return Promise.resolve(BAD);
    // Only what arras refuses reaches arras, for its own words: anything it would
    // search is searched here or refused, however it is padded.
    // Its limit is put within arras's own, so that what arras refuses is the text or the module.
    if (module !== moduleName || !arrasAccepts(text)) return arras(() => client.moduleQuery(module, query, { ...variables, limit: 1 }));
    const asked = queryOf(text.split(/\s+/u).filter((word) => word !== "").join(" "));
    if (!asked) return Promise.resolve(BAD);
    const answered = search.arrasPage(asked, names as string[] | undefined, (limit as number | null) ?? 20, freshness);
    return Promise.resolve(ok({ data: { _search: answered }, errors: [], revision: probe.revision }));
  };
  /** What must be found on the page of the original for the passage's words on this part to be marked. */
  const highlightAsk = (passage: string, index: number): HighlightAsk => {
    const view = Object.hasOwn(data.views, passage) ? (data.views as Record<string, SourceView>)[passage] : undefined;
    const text = view?.kind === "passage" && view.state === "highlighted" ? view.source_text?.id : undefined;
    const found = text !== undefined && view!.segments.some((s) => s.index === index) ? data.highlights?.[passage]?.[index] : undefined;
    if (text === undefined || !found || !Object.hasOwn(texts, text)) return { none: "no_segment" };
    const page = originalPage(texts[text]!, index);
    if (page.state === "image") return { none: "page_image" };
    if (page.state === "none") return { none: "no_pdf_page" };
    if ("refused" in found) return { none: found.refused };
    return { target: { sha256: page.sha256, size: page.size, page: page.page, page_count: page.page_count, text_sha256: found.text_sha256, ranges: found.ranges } };
  };
  const answer = async (route: string, body: unknown): Promise<Answer> => {
    if (!isObject(body)) return BAD;
    if (route === "boot") return ok({ banner, manuscript_state: manuscript.state });
    if (route === "manuscript") return ok(manuscript);
    if (route === "original-page") {
      const { text, index } = body;
      if (Object.keys(body).some((key) => key !== "text" && key !== "index") || typeof text !== "string" || !wholeFrom(index, 0, Number.MAX_SAFE_INTEGER)) return BAD;
      return ok(Object.hasOwn(texts, text) ? originalPage(texts[text]!, index) : null);
    }
    // Asked by the command alone, for `/api/original-highlight`, which reads the file itself.
    if (route === "highlight-target") {
      const { passage, index } = body;
      if (Object.keys(body).some((key) => key !== "passage" && key !== "index") || typeof passage !== "string" || !wholeFrom(index, 0, Number.MAX_SAFE_INTEGER)) return BAD;
      const made = highlightAsk(passage, index);
      return ok("none" in made ? { highlight: noHighlight(made.none) } : made);
    }
    // Asked by the command alone, for `/original`: the page cannot name this call.
    if (route === "original-record") return ok(typeof body.sha256 === "string" ? recorded.get(body.sha256) : null);
    // The three `agent-` calls are the MCP server's (CONTRACT-005 N): the page cannot name them.
    if (route === "agent-record") return ok(typeof body.record === "string" ? record.shown(body.record) : null);
    if (route === "agent-view") {
      if (typeof body.record !== "string") return BAD;
      const made = agentView(data.views as Record<string, SourceView>, body.record);
      return ok(made ? { view: { ...made, ...(warnings.length > 0 ? { project_warnings: warnings } : {}) } } : { view: null, record: record.shown(body.record) });
    }
    if (route === "agent-search") {
      const { text, type, offset, limit } = body;
      if (type !== undefined && !(typeof type === "string" && search.hasType(type))) {
        return refusal(400, "unknown_type", `No record of that type is held. The types are: ${data.search.types.map((t) => t.type).join(", ")}.`);
      }
      const asked = typeof text === "string" ? queryOf(text) : undefined;
      if (!asked || !wholeFrom(offset, 0, Number.MAX_SAFE_INTEGER) || !wholeFrom(limit, 1, SEARCH_LIMITS.page)) {
        return refusal(400, "bad_request", `A search is 1 to ${SEARCH_LIMITS.chars} characters and at most ${SEARCH_LIMITS.words} words.`);
      }
      return ok({ ...agentSearch(search.page(asked, type as string | undefined, offset, limit), record.entry), ...(warnings.length > 0 ? { project_warnings: warnings } : {}) });
    }
    if (route === "source-view") {
      if (typeof body.id !== "string") return BAD;
      return ok(Object.hasOwn(views, body.id) ? views[body.id] : null);
    }
    if (route === "search") {
      const { text, type, offset, limit } = body;
      if (Object.keys(body).some((key) => !SEARCH_KEYS.has(key)) || typeof text !== "string" || !(type === undefined || (typeof type === "string" && search.hasType(type)))
        || !wholeFrom(offset, 0, Number.MAX_SAFE_INTEGER) || !wholeFrom(limit, 1, SEARCH_LIMITS.page)) return BAD;
      const asked = queryOf(text);
      if (!asked) return refusal(400, "bad_request", `A search is 1 to ${SEARCH_LIMITS.chars} characters and at most ${SEARCH_LIMITS.words} words.`);
      return ok(search.page(asked, type, offset, limit));
    }
    if (route === "query") {
      const { module, query, variables } = body;
      if (typeof module !== "string" || typeof query !== "string" || (variables !== undefined && !isObject(variables))) return BAD;
      if (ARRAS_SEARCH_QUERY.test(query)) return arrasSearch(module, query, variables ?? {});
      // arras's own search lists few of the matches and says little of it, so no other query reaches it.
      if (/\b_search\b/.test(query)) return refusal(422, "unsupported_search", "This server answers only the record browser's search query. Use the search call for other searches.");
      return arras(() => client.moduleQuery(module, query, variables));
    }
    if (route === "arras") {
      const call = ARRAS_CALLS.find((name) => name === body.call);
      if (!call) return BAD;
      if (call !== "export") return arras(() => client[call]());
      if (!isObject(body.request)) return BAD;
      return arras(() => client.export(body.request as Parameters<typeof client.export>[0]));
    }
    return refusal(404, "not_found", "No such call.");
  };
  return async (route, body) => {
    const made = await answer(route, body);
    return BOUNDED.has(route) && Buffer.byteLength(made.body) > mostBytes ? TOO_LARGE : made;
  };
}
