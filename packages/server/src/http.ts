// The local server's HTTP surface and its rules (CONTRACT-005 M). Every check
// is made before a body is read, and a refusal holds nothing from the request.
// No part of a request reaches the file system: the assets are strings in
// memory, and the routes are compared whole. Nothing is logged.
//
// node:http, not Bun.serve: on the pinned Bun only node:http ends a request
// whose headers or body arrive too slowly.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { refusal } from "./answers.ts";
import type { Session } from "./session.ts";
import type { Answer, Verdict } from "./snapshots.ts";

export const HOST = "127.0.0.1";
export const LIMITS = { headerBytes: 16 * 1024, bodyBytes: 64 * 1024, requestMs: 10_000, connections: 64 };
export const REQUEST_HEADER = "x-stemma-request";
export const SECRET_HEADER = "x-stemma-secret";

export const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
  "cross-origin-resource-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "x-frame-options": "DENY",
};

export interface Assets {
  html: string;
  js: string;
  css: string;
}

const ASSETS: Record<string, [keyof Assets, string]> = {
  "/": ["html", "text/html; charset=utf-8"],
  "/app.js": ["js", "text/javascript; charset=utf-8"],
  "/app.css": ["css", "text/css; charset=utf-8"],
};

/** The calls a snapshot answers, by path. */
const SNAPSHOT_CALLS: Record<string, string> = {
  "/api/boot": "boot", "/api/arras": "arras", "/api/query": "query", "/api/source-view": "source-view", "/api/manuscript": "manuscript",
};
const CALLS = new Set(["/api/session", "/api/status", ...Object.keys(SNAPSHOT_CALLS)]);

/** Headers a rule reads. Node keeps only the first of some repeats, so a repeat is refused. */
const ONCE = ["host", "origin", "content-type", "content-length", "transfer-encoding", REQUEST_HEADER, SECRET_HEADER];

export interface ListenOptions {
  assets: Assets;
  session: Session;
  check(): Promise<Verdict>;
  /** Told of each call that passed every rule. */
  used?(): void;
  limits?: Partial<typeof LIMITS>;
}

export interface Listening {
  port: number;
  /** `http://127.0.0.1:<port>/` */
  address: string;
  close(): Promise<void>;
}

const STALE = (message: string) => refusal(503, "index_stale", message);

/** The body, unless it is longer than allowed. The server's request timeout bounds how long it may take. */
function readBody(request: IncomingMessage, most: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    const pieces: Buffer[] = [];
    let size = 0;
    request.on("data", (piece: Buffer) => {
      size += piece.length;
      if (size > most) {
        request.pause();
        resolve(undefined);
      } else pieces.push(piece);
    });
    request.on("end", () => resolve(Buffer.concat(pieces).toString("utf8")));
    request.on("error", () => resolve(undefined));
    request.on("aborted", () => resolve(undefined));
  });
}

export async function listen(options: ListenOptions): Promise<Listening> {
  const limits = { ...LIMITS, ...options.limits };
  const { session } = options;
  let host = "";
  let origin = "";

  const send = (response: ServerResponse, status: number, type: string, body: string) => {
    if (response.headersSent || response.destroyed) return;
    response.writeHead(status, { ...SECURITY_HEADERS, "content-type": type, "content-length": Buffer.byteLength(body), connection: "close" });
    // One request a connection: whatever else is arriving on it is not read.
    response.end(body);
  };
  const answer = (response: ServerResponse, { status, body }: Answer) => send(response, status, "application/json", body);
  const refuse = (response: ServerResponse, status: number, code: string, message: string) => answer(response, refusal(status, code, message));

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const counts = new Map<string, number>();
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      const name = request.rawHeaders[i]!.toLowerCase();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    if (ONCE.some((name) => (counts.get(name) ?? 0) > 1)) return refuse(response, 400, "bad_request", "A header that must come once came more than once.");
    const header = (name: string) => {
      const value = request.headers[name];
      return typeof value === "string" ? value : undefined;
    };
    // Rule 2: this also refuses another site's name made to point at this computer (DNS rebinding).
    if (header("host") !== host) return refuse(response, 403, "forbidden_host", "The Host header is not this server's address.");
    const { method, url = "" } = request;
    if (method !== "GET" && method !== "POST") return refuse(response, 405, "method_not_allowed", "Only GET and POST are answered.");
    const from = header("origin");
    if (from !== undefined && from !== origin) return refuse(response, 403, "forbidden_origin", "The request comes from another origin.");
    const length = header("content-length");
    const chunked = header("transfer-encoding") !== undefined;

    if (method === "GET") {
      // `url` is the request line's target as sent: nothing is decoded or resolved.
      const asset = Object.hasOwn(ASSETS, url) ? ASSETS[url]! : undefined;
      if (!asset) return refuse(response, 404, "not_found", "There is nothing at that path.");
      if (chunked || (length !== undefined && length !== "0")) return refuse(response, 400, "bad_request", "A GET carries no body.");
      return send(response, 200, asset[1], options.assets[asset[0]]);
    }

    if (!CALLS.has(url)) return refuse(response, 404, "not_found", "There is nothing at that path.");
    if (from === undefined) return refuse(response, 403, "forbidden_origin", "The request names no origin.");
    if (header("content-type") !== "application/json") return refuse(response, 415, "unsupported_media_type", "The body must be application/json.");
    if (header(REQUEST_HEADER) !== "1") return refuse(response, 403, "missing_request_header", `The ${REQUEST_HEADER} header is missing.`);
    if (url !== "/api/session" && !session.allows(header(SECRET_HEADER))) {
      return refuse(response, 401, "unauthorized", "The secret of this run is missing or wrong.");
    }
    if (length !== undefined && !(Number(length) <= limits.bodyBytes)) return refuse(response, 413, "too_large", "The request body is too large.");
    const text = await readBody(request, limits.bodyBytes);
    if (text === undefined) return refuse(response, 413, "too_large", "The request body is too large or did not arrive whole.");
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
      body = parsed as Record<string, unknown>;
    } catch {
      return refuse(response, 400, "bad_request", "The body is not a JSON object.");
    }

    if (url === "/api/session") {
      const secret = typeof body.code === "string" ? session.exchange(body.code) : undefined;
      if (secret === undefined) return refuse(response, 401, "code_refused", "That one-time code has been used, has expired, or is wrong.");
      options.used?.();
      return answer(response, { status: 200, body: JSON.stringify({ secret }) });
    }
    options.used?.();
    // The scan this waits for begins after the request arrived.
    const verdict = await options.check();
    if (url === "/api/status") {
      const state = verdict.state === "current" ? { state: "current", data_identity: verdict.data_identity }
        : verdict.state === "failed" ? { state: "failed", message: verdict.message } : { state: "rebuilding" };
      return answer(response, { status: 200, body: JSON.stringify(state) });
    }
    if (verdict.state !== "current") {
      return answer(response, STALE(verdict.state === "failed" ? "The project could not be read again, so nothing is shown. Ask for the status to see why." : "The project's files changed. Stemma is reading them again."));
    }
    try {
      return answer(response, await verdict.process.ask(SNAPSHOT_CALLS[url]!, body));
    } catch {
      return answer(response, STALE("The data this call needed is gone. Stemma is reading the project again."));
    }
  }

  const server = createServer({ maxHeaderSize: limits.headerBytes, connectionsCheckingInterval: Math.min(1000, limits.requestMs) } as Parameters<typeof createServer>[0] & object, (request, response) => {
    handle(request, response).catch(() => refuse(response, 500, "internal_error", "The server failed, which is a Stemma defect."));
  });
  // Rule 10. Headers and body must both have arrived within the one limit.
  server.headersTimeout = limits.requestMs;
  server.requestTimeout = limits.requestMs;
  server.keepAliveTimeout = 1;
  server.maxConnections = limits.connections;
  // No client of this server asks to send a body only if invited.
  server.on("checkContinue", (_request, response: ServerResponse) => refuse(response, 417, "bad_request", "Expect is not supported."));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // Rule 1: the loopback address and no other.
    server.listen(0, HOST, resolve);
  });
  const { port } = server.address() as { port: number };
  host = `${HOST}:${port}`;
  origin = `http://${host}`;
  return {
    port,
    address: `${origin}/`,
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}
