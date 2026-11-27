// The served page's calls to its own server (CONTRACT-005 M): neither the
// secret nor the one-time code is sent, each signs what it is the key of; no
// answer is used before it has proved that it holds the same key; every answer
// that holds data names the data it came from; and the arras client forwards
// each read to arras's static client in the server, unchanged.
import { TAGS, type TagPair } from "../../core/src/browse-proof.ts";
import type { ArrasClient, SchemaApi } from "./arras-types.ts";
import { type Proved, provedPost } from "./proof.ts";

const KEY = "stemma.secret";

/** Why a call gave no data. `stale` passes; `locked` and `stopped` do not. */
export type Trouble = "stale" | "locked" | "stopped" | "failed";

/** What became of the one-time code. */
export type Redemption = "opened" | "code_used" | "code_expired";
/** The server's own limit on a request body (rule 10). */
const MOST_BODY_BYTES = 64 * 1024;

export class CallFailed extends Error {
  constructor(readonly trouble: Trouble, message: string) {
    super(message);
  }
}

export interface Status {
  state: "current" | "rebuilding" | "failed";
  data_identity?: string;
  message?: string;
}

function stored(): string | undefined {
  try {
    return window.sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function keep(secret: string | undefined): void {
  try {
    if (secret === undefined) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, secret);
  } catch {
    // Without storage the secret lasts as long as the page: a reload needs a new run.
  }
}

/** The one-time code the launch file put in the address, taken out of it at once. */
export function takeCode(): string | undefined {
  const code = /^#code=([A-Za-z0-9_-]+)$/.exec(window.location.hash)?.[1];
  if (code !== undefined) window.history.replaceState(null, "", window.location.pathname);
  return code;
}

const LEAVING_MS = 3000;
/** True while the browser is leaving the page, which ends its calls; that is not the server failing. */
let leaving = false;
window.addEventListener("beforeunload", () => (leaving = true));
window.addEventListener("pagehide", () => (leaving = true));
window.addEventListener("pageshow", () => (leaving = false));

export class Server {
  private secret: string | undefined = stored();
  /** Set for good once the server cannot be reached or an answer is not its own. */
  private gone = false;

  get open(): boolean {
    return this.secret !== undefined;
  }

  private forget(): void {
    this.secret = undefined;
    keep(undefined);
  }

  /** Whatever answers at this address next gets no further call, and nothing signed with the key is of use to it. */
  private stop(message: string): never {
    this.gone = true;
    this.forget();
    throw new CallFailed("stopped", message);
  }

  private async post(key: string, tags: TagPair, path: string, body: string): Promise<{ status: number; json: Record<string, unknown> }> {
    let proved: Proved | undefined;
    try {
      proved = await provedPost((to, init) => fetch(to, {
        method: "POST", cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
        headers: { "content-type": "application/json", "x-stemma-request": "1", ...init.headers },
        body: init.body,
      }), key, tags, path, body);
    } catch {
      // A page that is being left is gone before this wait ends. One that stayed after all goes on below.
      if (leaving) await new Promise((resolve) => setTimeout(resolve, LEAVING_MS));
      return this.stop("Stemma's server cannot be reached.");
    }
    if (!proved) return this.stop("What answered could not prove that it is this run of Stemma.");
    // An answer proved before another failed is not used after it.
    if (this.gone) throw new CallFailed("stopped", "Stemma's server has stopped.");
    return { status: proved.status, json: JSON.parse(proved.text) as Record<string, unknown> };
  }

  /** Trades the one-time code, which signs the request and is not sent, for the run's secret. A refused code leaves any secret the tab already has. */
  async exchange(code: string): Promise<Redemption> {
    const { status, json } = await this.post(code, TAGS.code, "/api/session", "{}");
    if (status === 200 && typeof json.secret === "string") {
      this.secret = json.secret;
      keep(this.secret);
      return "opened";
    }
    return (json.error as { code?: string } | undefined)?.code === "code_expired" ? "code_expired" : "code_used";
  }

  async call(path: string, body: unknown): Promise<Record<string, unknown>> {
    if (this.gone) throw new CallFailed("stopped", "Stemma's server has stopped.");
    if (this.secret === undefined) throw new CallFailed("locked", "This tab has no access.");
    const text = JSON.stringify(body);
    // The server's refusal of this comes before it can prove anything, which would look like another program's answer.
    if (new TextEncoder().encode(text).length > MOST_BODY_BYTES) throw new CallFailed("failed", "too_large: The request is too large.");
    const { status, json } = await this.post(this.secret, TAGS.call, path, text);
    if (status === 200) return json;
    const error = (json.error ?? {}) as { code?: string; message?: string; arras?: { status: number; code?: string } };
    if (error.code === "index_stale") throw new CallFailed("stale", error.message ?? "");
    if (error.arras) throw Object.assign(new Error(error.message), error.arras);
    throw new CallFailed("failed", `${error.code ?? status}: ${error.message ?? ""}`);
  }

  async status(): Promise<Status> {
    return (await this.call("/api/status", {})) as unknown as Status;
  }
}

/** A read of one snapshot's data. */
export type Read = <T>(path: string, body: unknown) => Promise<T>;

/**
 * Reads that give only what came from the data the page loaded. Anything else,
 * a rebuild or other data included, is told to `lost` and gives nothing.
 */
export function readsOf(server: Server, identity: string, lost: (error: CallFailed) => void): Read {
  return async <T>(path: string, body: unknown) => {
    try {
      const answer = await server.call(path, body);
      if (answer.data_identity !== identity) throw new CallFailed("stale", "The data changed.");
      return answer.result as T;
    } catch (error) {
      if (error instanceof CallFailed && error.trouble !== "failed") lost(error);
      throw error;
    }
  };
}

const READ_ONLY = "This explorer only reads: change the record files, and it reads them again.";
const refuse = () => Promise.reject(Object.assign(new Error(READ_ONLY), { status: 501 }));

/** What the arras browser reads through. `moduleQuery` goes as arras made it, and its answer comes back as arras gave it. */
export function remoteClient(read: Read): ArrasClient {
  const arras = <T>(call: string, request?: unknown) => read<T>("/api/arras", request === undefined ? { call } : { call, request });
  return {
    config: { operateBase: "", consoleBase: "" },
    version: () => arras("version"),
    viewer: () => arras("viewer"),
    meta: () => arras("meta"),
    status: () => arras("status"),
    schemaCatalog: () => arras("schemaCatalog"),
    export: (request) => arras("export", request),
    moduleQuery: (module, query, variables) => read("/api/query", { module, query, ...(variables === undefined ? {} : { variables }) }),
    validate: refuse, invoke: refuse, batch: refuse, changes: refuse, loads: refuse, query: refuse,
  };
}

export const noSchemaApi: SchemaApi = { schemaBase: "", offered: async () => false, validate: refuse, register: refuse };
