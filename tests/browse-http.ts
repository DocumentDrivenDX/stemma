// Raw HTTP for the local server's tests: a request exactly as written, so that
// nothing a client library would add, join or normalize is in the way.
import { connect } from "node:net";

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
