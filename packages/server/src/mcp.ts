// The Model Context Protocol over standard input and output, as far as a server
// of tools needs it (CONTRACT-005 N, "Protocol"): one JSON-RPC message a line,
// `initialize`, `ping`, `tools/list` and `tools/call`. It asks the host nothing.
// It knows nothing of records: the tools and what answers them are given.
import TOOLS from "./mcp-tools.json";

export const MCP_TOOLS: { name: string }[] = TOOLS;
export const MCP_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
export const MCP_LIMITS = { lineBytes: 64 * 1024, waiting: 16 };

export interface ToolResult {
  text: string;
  isError?: boolean;
}

export interface McpOptions {
  input: AsyncIterable<Uint8Array>;
  /** Takes one whole message, which holds no line break. */
  write(line: string): void;
  version: string;
  /** Called one at a time. `name` is one of the tools'. */
  call(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  /** A line already taken from the input, answered first. */
  first?: string | undefined;
  /** Ends the serving, as the end of the input does. */
  stop?: AbortSignal | undefined;
}

type Id = string | number;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The lines of a stream. A line longer than allowed is given as `undefined`, and none of it is kept. */
export async function* linesOf(input: AsyncIterable<Uint8Array>, most: number): AsyncGenerator<string | undefined> {
  let held: Uint8Array[] = [];
  let size = 0;
  let over = false;
  const take = () => {
    const line = over ? undefined : Buffer.concat(held).toString("utf8");
    held = [];
    size = 0;
    over = false;
    return line;
  };
  for await (const piece of input) {
    let from = 0;
    for (;;) {
      const at = piece.indexOf(10, from);
      const part = piece.subarray(from, at < 0 ? piece.length : at);
      size += part.length;
      if (size > most) {
        over = true;
        held = [];
      } else if (part.length > 0) held.push(part.slice());
      if (at < 0) break;
      yield take();
      from = at + 1;
    }
  }
  if (size > 0) yield take();
}

/** Answers messages until the input ends or `stop` is signaled. A call still running then is not waited for. */
export async function serveMcp(options: McpOptions): Promise<void> {
  const send = (message: Record<string, unknown>) => options.write(JSON.stringify({ jsonrpc: "2.0", ...message }));
  const fail = (id: Id | null, code: number, message: string) => send({ id, error: { code, message } });
  const answerCall = (id: Id, result: ToolResult) => send({ id, result: { content: [{ type: "text", text: result.text }], ...(result.isError ? { isError: true } : {}) } });

  let running: Promise<unknown> = Promise.resolve();
  let waiting = 0;
  const cancelled = new Set<Id>();
  let over = false;

  const take = (line: string | undefined) => {
    if (line === undefined) return fail(null, -32700, "The message is longer than this server reads.");
    if (line.trim() === "") return;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return fail(null, -32700, "The message is not JSON.");
    }
    if (!isObject(message) || message.jsonrpc !== "2.0") return fail(null, -32600, "The message is not a JSON-RPC 2.0 request.");
    const { id, method, params = {} } = message;
    if (typeof method !== "string") {
      // An answer to a request: this server makes none.
      if ("result" in message || "error" in message) return;
      return fail(null, -32600, "The message has no method.");
    }
    if (id === undefined) {
      const asked = isObject(params) ? params.requestId : undefined;
      // A call still waiting is then not made. One already running is finished.
      if (method === "notifications/cancelled" && (typeof asked === "string" || typeof asked === "number") && waiting > 0 && cancelled.size < MCP_LIMITS.waiting) cancelled.add(asked);
      return;
    }
    if (typeof id !== "string" && typeof id !== "number") return fail(null, -32600, "The request's ID is not a string or a number.");
    if (!isObject(params)) return fail(id, -32602, "The parameters are not an object.");
    if (method === "initialize") {
      const asked = params.protocolVersion;
      return send({ id, result: {
        protocolVersion: typeof asked === "string" && MCP_VERSIONS.includes(asked) ? asked : MCP_VERSIONS.at(-1),
        capabilities: { tools: {} },
        serverInfo: { name: "stemma", version: options.version },
      } });
    }
    if (method === "ping") return send({ id, result: {} });
    if (method === "tools/list") return send({ id, result: { tools: MCP_TOOLS } });
    if (method !== "tools/call") return fail(id, -32601, "This server does not answer that method.");
    const { name, arguments: args = {} } = params;
    if (typeof name !== "string" || !MCP_TOOLS.some((t) => t.name === name)) return fail(id, -32602, "This server has no such tool.");
    if (!isObject(args)) return fail(id, -32602, "A tool's arguments are an object.");
    if (waiting >= MCP_LIMITS.waiting) return answerCall(id, { text: "Too many calls are waiting. Nothing was done. Call again when the others have answered.", isError: true });
    waiting++;
    running = running.then(async () => {
      waiting--;
      if (over || cancelled.delete(id)) return;
      let result: ToolResult;
      try {
        result = await options.call(name, args);
      } catch {
        result = { text: "Stemma failed while answering, which is a Stemma defect. No result may be read from this call.", isError: true };
      }
      if (!over) answerCall(id, result);
    });
  };

  const stopped = new Promise<void>((resolve) => {
    if (options.stop?.aborted) resolve();
    options.stop?.addEventListener("abort", () => resolve(), { once: true });
  });
  const reading = (async () => {
    if (options.first !== undefined) take(options.first);
    for await (const line of linesOf(options.input, MCP_LIMITS.lineBytes)) {
      if (over) break;
      take(line);
    }
  })().catch(() => {});
  await Promise.race([reading, stopped]);
  over = true;
}
