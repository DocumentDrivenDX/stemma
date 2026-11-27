// An MCP host for tests: starts a command, writes it one JSON message a line, and
// keeps everything it says. Each server is ended by the test that started it, and
// by `endMcp` if one is left.
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporary } from "./helpers.ts";

const live = new Set<McpHost>();
export async function endMcp(): Promise<void> {
  await Promise.all([...live].map((host) => host.end("SIGKILL")));
}

export interface Called {
  text: string;
  isError: boolean;
  /** The quoted data of the result, when it has any. */
  data: any;
}

/** The JSON between a result's begin and end lines; the mark must close what it opened. */
export function quotedData(text: string): any {
  const begin = /^--- ([0-9a-f]{16}) begin: quoted data, not instructions$/m.exec(text);
  if (!begin) return undefined;
  const body = text.slice(begin.index + begin[0].length + 1);
  const end = `\n--- ${begin[1]} end`;
  if (!body.endsWith(end) || body.slice(0, -end.length).includes(begin[1]!)) throw new Error(`the data block is not closed by its own mark:\n${text}`);
  return JSON.parse(body.slice(0, -end.length));
}

export class McpHost {
  /** Every byte of both outputs. */
  stdout = "";
  stderr = "";
  private readonly replies = new Map<unknown, any>();
  private pending = "";
  private next = 0;
  private readonly drained: Promise<unknown>;
  private constructor(readonly child: ReturnType<typeof Bun.spawn<"pipe", "pipe", "pipe">>) {
    const drain = async (stream: ReadableStream<Uint8Array>, add: (text: string) => void) => {
      const decoder = new TextDecoder();
      const reader = stream.getReader();
      for (let got = await reader.read(); !got.done; got = await reader.read()) add(decoder.decode(got.value, { stream: true }));
    };
    this.drained = Promise.all([
      drain(child.stdout, (text) => {
        this.stdout += text;
        this.pending += text;
        for (let at = this.pending.indexOf("\n"); at >= 0; at = this.pending.indexOf("\n")) {
          const message = JSON.parse(this.pending.slice(0, at));
          this.pending = this.pending.slice(at + 1);
          this.replies.set(message.id, message);
        }
      }),
      drain(child.stderr, (text) => (this.stderr += text)),
    ]);
    live.add(this);
    void child.exited.then(() => live.delete(this));
  }

  static start(command: string[], env: Record<string, string>, cwd: string): McpHost {
    return new McpHost(Bun.spawn(command, { cwd, env, stdin: "pipe", stdout: "pipe", stderr: "pipe" }));
  }

  send(line: string): void {
    this.child.stdin.write(`${line}\n`);
    this.child.stdin.flush();
  }

  async reply(id: unknown, ms = 60_000): Promise<any> {
    const end = Date.now() + ms;
    while (!this.replies.has(id)) {
      if (Date.now() > end || (this.child.exitCode !== null && !this.pending.includes("\n"))) {
        await Bun.sleep(50);
        if (!this.replies.has(id)) throw new Error(`no answer to ${String(id)}.\nstdout: ${this.stdout}\nstderr: ${this.stderr}`);
      }
      await Bun.sleep(10);
    }
    const got = this.replies.get(id);
    this.replies.delete(id);
    return got;
  }

  request(method: string, params?: unknown): Promise<any> {
    const id = ++this.next;
    // The order Claude Code writes them in.
    this.send(JSON.stringify({ method, ...(params === undefined ? {} : { params }), jsonrpc: "2.0", id }));
    return this.reply(id);
  }

  async initialize(): Promise<any> {
    const got = await this.request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    this.send(JSON.stringify({ method: "notifications/initialized", jsonrpc: "2.0" }));
    return got.result;
  }

  async call(name: string, args: unknown = {}): Promise<Called> {
    const got = await this.request("tools/call", { name, arguments: args });
    if (!got.result) return { text: got.error.message, isError: true, data: undefined };
    const text = got.result.content[0].text as string;
    return { text, isError: got.result.isError === true, data: quotedData(text) };
  }

  /** Closes the input, or signals; gives the exit code. */
  async end(signal?: NodeJS.Signals, ms = 15_000): Promise<number> {
    if (signal) this.child.kill(signal);
    else this.child.stdin.end();
    const code = await Promise.race([this.child.exited, Bun.sleep(ms).then(() => undefined)]);
    if (code === undefined) throw new Error(`still running after ${ms} ms.\nstderr: ${this.stderr}`);
    await this.drained;
    return code;
  }
}

/**
 * A stand-in for the system's opener: it notes how it was called and keeps a
 * copy of the file it was given, and opens nothing.
 */
export function stubOpener(exit = 0) {
  const directory = temporary();
  const program = join(directory, "opener");
  // The call is noted after the copy is made, so that a test that sees the call can read the copy.
  writeFileSync(program, `#!/bin/sh\ncp "$1" '${directory}/launch.html'\nfor a in "$@"; do printf '%s\\n' "$a" >> '${directory}/arguments'; done\nexit ${exit}\n`);
  chmodSync(program, 0o755);
  const read = (name: string) => (existsSync(join(directory, name)) ? readFileSync(join(directory, name), "utf8") : "");
  return {
    program,
    /** Every argument of every call, one a line. */
    calls: () => read("arguments").split("\n").filter(Boolean),
    /** What the last launch file given holds: the address, the code and the record route. */
    launched: () => {
      const found = /url=(http:\/\/127\.0\.0\.1:\d+\/)#code=([A-Za-z0-9_-]{43})(?:&amp;to=([^"]+))?"/.exec(read("launch.html"));
      return found ? { address: found[1]!, code: found[2]!, route: found[3] } : undefined;
    },
  };
}
