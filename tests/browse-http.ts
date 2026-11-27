// Raw HTTP for the local server's tests: a request exactly as written, so that
// nothing a client library would add, join or normalize is in the way.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { connect } from "node:net";

// The proofs of CONTRACT-005 M, written here again from the contract with
// another library, so that the tests hold the code to the contract and not to
// itself.
const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest();

function hmac(key: string, fields: (string | Buffer)[]): string {
  const mac = createHmac("sha256", key);
  for (const field of fields) {
    const bytes = Buffer.from(field as string);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    mac.update(length).update(bytes);
  }
  return mac.digest("base64url");
}

/** Which key signs: the one-time code for the exchange, the secret for a call. */
export type Use = "code" | "call";
export const useOf = (path: string): Use => (path === "/api/session" ? "code" : "call");

export const newNonce = (at = Date.now()): string => `${at}.${randomBytes(16).toString("base64url")}`;

export const requestMac = (key: string, path: string, body: string, nonce: string, use: Use = useOf(path), method = "POST"): string =>
  hmac(key, [`stemma-browse-1 ${use} request`, method, path, sha256(body), nonce]);

export const responseProof = (key: string, path: string, status: number, body: string | Uint8Array, nonce: string, use: Use = useOf(path)): string =>
  hmac(key, [`stemma-browse-1 ${use} response`, nonce, path, String(status), sha256(body)]);

export interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** How long until the server ended the connection; Infinity when it had not within the wait. */
  endedMs: number;
}

export function raw(port: number, pieces: string[], options: { gapMs?: number; waitMs?: number; host?: string } = {}): Promise<Reply> {
  return new Promise((resolve) => {
    const began = Date.now();
    let text = "";
    let over = false;
    const socket = connect(port, options.host ?? "127.0.0.1");
    const finish = (endedMs: number) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      socket.destroy();
      const [head = "", ...rest] = text.split("\r\n\r\n");
      const [line = "", ...fields] = head.split("\r\n");
      resolve({
        status: Number(/^HTTP\/1\.1 (\d+)/.exec(line)?.[1] ?? 0),
        headers: Object.fromEntries(fields.map((f) => [f.slice(0, f.indexOf(":")).toLowerCase(), f.slice(f.indexOf(":") + 1).trim()])),
        body: rest.join("\r\n\r\n"), endedMs,
      });
    };
    const timer = setTimeout(() => finish(Number.POSITIVE_INFINITY), options.waitMs ?? 5000);
    socket.on("data", (data) => (text += data.toString("utf8")));
    socket.on("error", () => {});
    socket.on("close", () => finish(Date.now() - began));
    socket.on("connect", async () => {
      for (const piece of pieces) {
        if (over || socket.destroyed) return;
        socket.write(piece);
        if (options.gapMs) await Bun.sleep(options.gapMs);
      }
    });
  });
}

/** A request with the headers given, in order; `undefined` leaves one out. */
export function request(method: string, target: string, headers: [string, string | undefined][], body?: string): string {
  const fields = headers.filter((h): h is [string, string] => h[1] !== undefined).map(([name, value]) => `${name}: ${value}\r\n`);
  if (body !== undefined && !headers.some(([name]) => /^(content-length|transfer-encoding)$/i.test(name))) fields.push(`Content-Length: ${Buffer.byteLength(body)}\r\n`);
  return `${method} ${target} HTTP/1.1\r\n${fields.join("")}\r\n${body ?? ""}`;
}
