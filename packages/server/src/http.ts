// The local server's HTTP surface and its rules (CONTRACT-005 M). Every check
// but the signature, which covers the body, is made before a body is read, and a
// refusal holds nothing from the request.
// No part of a request reaches the file system: the assets are strings in
// memory, and the routes are compared whole. Nothing is logged.
//
// node:http, not Bun.serve: on the pinned Bun only node:http ends a request
// whose headers or body arrive too slowly.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DRAWN_TYPES, MOST_ORIGINAL_BYTES } from "../../core/src/original-pages.ts";
import { MAC_HEADER, MAC_SHAPE, NONCE_HEADER, NONCE_SHAPE, PROOF_HEADER } from "../../core/src/browse-proof.ts";
import { type Highlight, noHighlight, type HighlightTarget } from "../../core/src/highlight.ts";
import { refusal } from "./answers.ts";
import type { Highlighter } from "./highlighter.ts";
import type { Originals } from "./originals.ts";
import { ProcessGone } from "./process.ts";
import type { Prove, Session, Signed } from "./session.ts";
import type { Answer, Verdict } from "./snapshots.ts";

export const HOST = "127.0.0.1";
export const LIMITS = { headerBytes: 16 * 1024, bodyBytes: 64 * 1024, requestMs: 10_000, connections: 64 };
export const REQUEST_HEADER = "x-stemma-request";
/** Rule 13 for originals: the largest given, how many are held in memory at once, and how long one may take to be taken. */
export const ORIGINAL_LIMITS = { bytes: MOST_ORIGINAL_BYTES, held: 2, sendMs: 120_000 };

export const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
  "cross-origin-resource-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "x-frame-options": "DENY",
};

/** The pinned pdf.js beyond what is in the page's script: its worker and decoders by path, and the data it asks for by name. */
export interface PdfAssets {
  scripts: Record<string, string>;
  data: Map<string, Uint8Array>;
}

export interface Assets {
  html: string;
  js: string;
  css: string;
  pdf?: PdfAssets;
}

const SCRIPT = "text/javascript; charset=utf-8";
/** What the answer with an original carries in place of the page's policy: it is never a document or a script. */
export const ORIGINAL_HEADERS: Record<string, string> = {
  "content-security-policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
  "content-disposition": 'attachment; filename="original"',
};

const ASSETS: Record<string, ["html" | "js" | "css", string]> = {
  "/": ["html", "text/html; charset=utf-8"],
  "/app.js": ["js", SCRIPT],
  "/app.css": ["css", "text/css; charset=utf-8"],
};

/** The calls a snapshot answers, by path. */
const SNAPSHOT_CALLS: Record<string, string> = {
  "/api/boot": "boot", "/api/arras": "arras", "/api/query": "query", "/api/source-view": "source-view", "/api/manuscript": "manuscript", "/api/search": "search",
  "/api/original-page": "original-page",
};
const CALLS = new Set(["/api/session", "/api/status", "/original", "/api/original-highlight", "/pdfjs-data", ...Object.keys(SNAPSHOT_CALLS)]);

/** Headers a rule reads. Node keeps only the first of some repeats, so a repeat is refused. */
const ONCE = ["host", "origin", "content-type", "content-length", "transfer-encoding", REQUEST_HEADER, NONCE_HEADER, MAC_HEADER];

export interface ListenOptions {
  assets: Assets;
  session: Session;
  check(): Promise<Verdict>;
  /** Told of each call that passed every rule. */
  used?(): void;
  limits?: Partial<typeof LIMITS>;
  /** Where originals are read from. Without it, none is held. */
  originals?: Originals;
  originalLimits?: Partial<typeof ORIGINAL_LIMITS>;
  /** What reads a page of an original to place a highlight. Without it, none is placed. It is closed with the server. */
  highlighter?: Highlighter;
}

/** An answer whose body is bytes: only ever a successful one. */
interface Bytes {
  bytes: Uint8Array;
  headers?: Record<string, string>;
  /** Called when the bytes are taken or given up, and with it whatever holds them. */
  sent?(): void;
}

export interface Listening {
  port: number;
  /** `http://127.0.0.1:<port>/` */
  address: string;
  close(): Promise<void>;
}

const STALE = (message: string) => refusal(503, "index_stale", message);
const INTERNAL = refusal(500, "internal_error", "The server failed, which is a Stemma defect.");

/** The body, unless it is longer than allowed. The server's request timeout bounds how long it may take. */
function readBody(request: IncomingMessage, most: number): Promise<Buffer | undefined> {
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
    request.on("end", () => resolve(Buffer.concat(pieces)));
    request.on("error", () => resolve(undefined));
    request.on("aborted", () => resolve(undefined));
  });
}

export async function listen(options: ListenOptions): Promise<Listening> {
  const limits = { ...LIMITS, ...options.limits };
  const { session } = options;
  let host = "";
  let origin = "";

  const originalLimits = { ...ORIGINAL_LIMITS, ...options.originalLimits };
  /** The places for an original held in memory (rule 13). */
  let free = originalLimits.held;
  const waiting: (() => void)[] = [];
  async function hold(): Promise<() => void> {
    if (free > 0) free--;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      const next = waiting.shift();
      if (next) next();
      else free++;
    };
  }

  const send = (response: ServerResponse, status: number, type: string, body: string | Uint8Array, more: Record<string, string> = {}) => {
    if (response.headersSent || response.destroyed) return;
    response.writeHead(status, { ...SECURITY_HEADERS, ...more, "content-type": type, "content-length": Buffer.byteLength(body), connection: "close" });
    // One request a connection: whatever else is arriving on it is not read.
    response.end(body);
  };
  const answer = (response: ServerResponse, { status, body }: Answer) => send(response, status, "application/json", body);
  const refuse = (response: ServerResponse, status: number, code: string, message: string) => answer(response, refusal(status, code, message));
  /** An answer to a request whose signature held, with its proof. */
  const proved = (response: ServerResponse, prove: Prove, { status, body }: Answer) =>
    send(response, status, "application/json", body, { [PROOF_HEADER]: prove(status, body) });

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
      const scripts = options.assets.pdf?.scripts ?? {};
      const script = Object.hasOwn(scripts, url) ? scripts[url]! : undefined;
      if (!asset && script === undefined) return refuse(response, 404, "not_found", "There is nothing at that path.");
      if (chunked || (length !== undefined && length !== "0")) return refuse(response, 400, "bad_request", "A GET carries no body.");
      return asset ? send(response, 200, asset[1], options.assets[asset[0]]) : send(response, 200, SCRIPT, script!);
    }

    if (!CALLS.has(url)) return refuse(response, 404, "not_found", "There is nothing at that path.");
    if (from === undefined) return refuse(response, 403, "forbidden_origin", "The request names no origin.");
    if (header("content-type") !== "application/json") return refuse(response, 415, "unsupported_media_type", "The body must be application/json.");
    if (header(REQUEST_HEADER) !== "1") return refuse(response, 403, "missing_request_header", `The ${REQUEST_HEADER} header is missing.`);
    const redeeming = url === "/api/session";
    const unsigned = () => redeeming
      ? refuse(response, 401, "code_refused", "The request is not signed with this run's one-time code.")
      : refuse(response, 401, "unauthorized", "The request is not signed with the secret of this run.");
    const nonce = header(NONCE_HEADER) ?? "";
    const mac = header(MAC_HEADER) ?? "";
    // The signature covers the body, so only its shape can be told before the body is read.
    if (!NONCE_SHAPE.test(nonce) || !MAC_SHAPE.test(mac)) return unsigned();
    if (length !== undefined && !(Number(length) <= limits.bodyBytes)) return refuse(response, 413, "too_large", "The request body is too large.");
    const bytes = await readBody(request, limits.bodyBytes);
    if (bytes === undefined) return refuse(response, 413, "too_large", "The request body is too large or did not arrive whole.");
    const signed: Signed = { method, path: url, body: bytes, nonce, mac };

    if (redeeming) {
      const redeemed = session.redeem(signed);
      if (!redeemed) return unsigned();
      if ("refused" in redeemed) {
        return proved(response, redeemed.prove, redeemed.refused === "code_used"
          ? refusal(401, "code_used", "That one-time code has already been used.")
          : refusal(401, "code_expired", "That one-time code has expired."));
      }
      options.used?.();
      return proved(response, redeemed.prove, { status: 200, body: JSON.stringify({ secret: redeemed.secret }) });
    }

    const admitted = session.admit(signed);
    if (!admitted) return unsigned();
    // No proof: a request that was sent before has had its one proved answer.
    if (admitted.verdict === "replayed") return refuse(response, 401, "replayed", "That request has been sent before, or its time is not now.");
    const { prove } = admitted;
    if (admitted.verdict === "too_many") return proved(response, prove, refusal(503, "too_many_calls", "Too many calls in too short a time. Wait a minute."));
    let made: Answer | Bytes | undefined;
    try {
      made = await respond(url, bytes.toString("utf8"), response);
      if (!("bytes" in made)) return proved(response, prove, made);
      const { bytes: body, headers, sent } = made;
      if (sent) {
        // What holds the bytes is let go when the answer has been taken, or given up as not taken.
        if (response.destroyed) return sent();
        const late = setTimeout(() => response.destroy(), originalLimits.sendMs);
        response.once("close", () => {
          clearTimeout(late);
          sent();
        });
      }
      send(response, 200, "application/octet-stream", body, { ...headers, [PROOF_HEADER]: prove(200, body) });
    } catch {
      if (made && "bytes" in made) made.sent?.();
      return proved(response, prove, INTERNAL);
    }
  }

  /** The bytes of an original, or why they are not given (CONTRACT-005 M, "Originals"). */
  async function original(process: Extract<Verdict, { state: "current" }>["process"], body: Record<string, unknown>, response: ServerResponse): Promise<Answer | Bytes> {
    const { sha256 } = body;
    if (Object.keys(body).length !== 1 || typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) return refusal(400, "bad_request", "The request body is not what this call takes.");
    const asked = await process.ask("original-record", { sha256 });
    const recorded = (JSON.parse(asked.body) as { result?: { size: number; media_type: string } | null }).result;
    if (!recorded) return refusal(404, "unknown_original", "No source file in effect records an original with that digest.");
    if (!DRAWN_TYPES.includes(recorded.media_type)) return refusal(415, "original_unsupported", "Only PDF originals and PNG or JPEG page images are given.");
    if (recorded.size > originalLimits.bytes) return refusal(422, "original_too_large", `The original is recorded as ${recorded.size} bytes, more than the ${originalLimits.bytes} this server gives.`);
    const release = await hold();
    // Nobody is left to take it, so it is not read.
    if (response.destroyed) {
      release();
      return INTERNAL;
    }
    try {
      const found = options.originals ? await options.originals.read(sha256, recorded.size) : { refused: "original_not_held" as const };
      if ("bytes" in found) return { bytes: found.bytes, headers: ORIGINAL_HEADERS, sent: release };
      release();
      return found.refused === "original_changed"
        ? refusal(409, "original_changed", "A file of the recorded size, or the cache's file for this digest, is there, but its SHA-256 differs from the recorded one, so it is not given.")
        : refusal(404, "original_not_held", "No file with the recorded size and SHA-256 is in .stemma/originals/ or in a place named with --originals.");
    } catch (error) {
      release();
      throw error;
    }
  }

  /** Where a passage's words lie on a page of its original, or why they are not marked (CONTRACT-005 M, "Highlighting on originals"). */
  async function highlight(verdict: Extract<Verdict, { state: "current" }>, body: Record<string, unknown>, response: ServerResponse): Promise<Answer> {
    const asked = await verdict.process.ask("highlight-target", body);
    if (asked.status !== 200) return asked;
    const { result } = JSON.parse(asked.body) as { result: { highlight: Highlight } | { target: HighlightTarget } };
    const answered = (made: Highlight): Answer => ({ status: 200, body: JSON.stringify({ data_identity: verdict.data_identity, result: made }) });
    if ("highlight" in result) return answered(result.highlight);
    const { target } = result;
    if (target.size > originalLimits.bytes) return answered(noHighlight("too_large"));
    if (!options.highlighter) return answered(noHighlight("failed"));
    return answered(await options.highlighter.place(target, async () => {
      // The original read for this counts among those held at once.
      const release = await hold();
      if (response.destroyed || !options.originals) {
        release();
        return { refused: "original_not_held" };
      }
      try {
        const found = await options.originals.read(target.sha256, target.size);
        if ("bytes" in found) return { bytes: found.bytes, release };
        release();
        return found;
      } catch (error) {
        release();
        throw error;
      }
    }, () => response.destroyed));
  }

  /** The answer to a call that was accepted. */
  async function respond(url: string, text: string, response: ServerResponse): Promise<Answer | Bytes> {
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
      body = parsed as Record<string, unknown>;
    } catch {
      return refusal(400, "bad_request", "The body is not a JSON object.");
    }
    options.used?.();
    // The pinned pdf.js's own data, which no project file is part of, so no scan is waited for. The name is only looked up.
    if (url === "/pdfjs-data") {
      const found = Object.keys(body).length === 1 && typeof body.name === "string" ? options.assets.pdf?.data.get(body.name) : undefined;
      return found ? { bytes: found } : refusal(404, "not_found", "There is no such data of the PDF library.");
    }
    // The scan this waits for begins after the request arrived.
    const verdict = await options.check();
    if (url === "/api/status") {
      const state = verdict.state === "current" ? { state: "current", data_identity: verdict.data_identity }
        : verdict.state === "failed" ? { state: "failed", message: verdict.message } : { state: "rebuilding" };
      return { status: 200, body: JSON.stringify(state) };
    }
    if (verdict.state !== "current") {
      return STALE(verdict.state === "failed" ? "The project could not be read again, so nothing is shown. Ask for the status to see why." : "The project's files changed. Stemma is reading them again.");
    }
    try {
      if (url === "/original") return await original(verdict.process, body, response);
      if (url === "/api/original-highlight") return await highlight(verdict, body, response);
      return await verdict.process.ask(SNAPSHOT_CALLS[url]!, body);
    } catch (error) {
      // Only a process that has ended is a reason to wait; anything else would have the page wait for ever.
      if (!(error instanceof ProcessGone)) throw error;
      return STALE("The data this call needed is gone. Stemma is reading the project again.");
    }
  }

  const server = createServer({ maxHeaderSize: limits.headerBytes, connectionsCheckingInterval: Math.min(1000, limits.requestMs) } as Parameters<typeof createServer>[0] & object, (request, response) => {
    handle(request, response).catch(() => answer(response, INTERNAL));
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
      options.highlighter?.close();
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}
