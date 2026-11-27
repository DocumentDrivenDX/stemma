// The served page's calls to its own server (CONTRACT-005 M): the secret goes
// as a header, never in an address or a cookie; every answer that holds data
// names the data it came from; and the arras client forwards each read to
// arras's static client in the server, unchanged.
import type { ArrasClient, SchemaApi } from "./arras-types.ts";

const KEY = "stemma.secret";

/** Why a call gave no data. `stale` passes; `locked` and `stopped` do not. */
export type Trouble = "stale" | "locked" | "stopped" | "failed";

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

  get open(): boolean {
    return this.secret !== undefined;
  }

  private forget(): void {
    this.secret = undefined;
    keep(undefined);
  }

  private async post(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    let response: Response;
    let json: Record<string, unknown>;
    try {
      response = await fetch(path, {
        method: "POST", cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
        headers: { "content-type": "application/json", "x-stemma-request": "1", ...(this.secret === undefined ? {} : { "x-stemma-secret": this.secret }) },
        body: JSON.stringify(body),
      });
      json = (await response.json()) as Record<string, unknown>;
    } catch {
      // A page that is being left is gone before this wait ends. One that stayed after all goes on below.
      if (leaving) await new Promise((resolve) => setTimeout(resolve, LEAVING_MS));
      // Whatever answers at this address next is not to be trusted with the secret.
      this.forget();
      throw new CallFailed("stopped", "Stemma's server cannot be reached.");
    }
    return { status: response.status, json };
  }

  /** Trades the one-time code for the run's secret. A refused code leaves any secret the tab already has. */
  async exchange(code: string): Promise<boolean> {
    const had = this.secret;
    this.secret = undefined;
    const { status, json } = await this.post("/api/session", { code });
    if (status === 200 && typeof json.secret === "string") {
      this.secret = json.secret;
      keep(this.secret);
      return true;
    }
    this.secret = had;
    return false;
  }

  async call(path: string, body: unknown): Promise<Record<string, unknown>> {
    if (this.secret === undefined) throw new CallFailed("locked", "This tab has no access.");
    const { status, json } = await this.post(path, body);
    if (status === 200) return json;
    const error = (json.error ?? {}) as { code?: string; message?: string; arras?: { status: number; code?: string } };
    if (error.code === "unauthorized") {
      this.forget();
      throw new CallFailed("locked", "This tab has no access.");
    }
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
