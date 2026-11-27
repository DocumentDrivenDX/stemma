// What a built snapshot answers (CONTRACT-005 M): arras's own static loader and
// static client over the export's module and graph, held in memory, with the
// source views and the manuscript view beside them. Nothing here writes, opens a
// file, or connects anywhere: a record ID is only looked up.
import { createStaticClient, loadStore } from "@documentdrivendx/arras-ui/static";
import type { Answer } from "./snapshots.ts";

export interface ServedData {
  data_identity: string;
  banner: unknown;
  moduleText: string;
  graphText: string;
  views: Record<string, unknown>;
  manuscript: { state: string };
}

export const ARRAS_CALLS = ["version", "viewer", "meta", "status", "schemaCatalog", "export"] as const;

export function refusal(status: number, code: string, message: string): Answer {
  return { status, body: JSON.stringify({ error: { code, message } }) };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const BAD = refusal(400, "bad_request", "The request body is not what this call takes.");

export async function answersOf(data: ServedData): Promise<(route: string, body: unknown) => Promise<Answer>> {
  const client = createStaticClient(await loadStore(data.moduleText, data.graphText), data.moduleText);
  const { banner, views, manuscript, data_identity } = data;
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
  return async (route, body) => {
    if (!isObject(body)) return BAD;
    if (route === "boot") return ok({ banner, manuscript_state: manuscript.state });
    if (route === "manuscript") return ok(manuscript);
    if (route === "source-view") {
      if (typeof body.id !== "string") return BAD;
      return ok(Object.hasOwn(views, body.id) ? views[body.id] : null);
    }
    if (route === "query") {
      const { module, query, variables } = body;
      if (typeof module !== "string" || typeof query !== "string" || (variables !== undefined && !isObject(variables))) return BAD;
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
}
