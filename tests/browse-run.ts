// Starts the built command's `browse` for a test and talks to it as its page
// does. Nothing here opens a browser: every run is started with --no-open. Each
// run is ended by the test that started it, and by `endRuns` if one is left.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { bundle } from "../scripts/build.ts";
import { temporary } from "./helpers.ts";

let built: Promise<string> | undefined;
/** The command line as it is shipped, built once for the test file. */
export const shipped = (): Promise<string> => (built ??= bundle(temporary()));

const live = new Set<Run>();
export async function endRuns(): Promise<void> {
  await Promise.all([...live].map((run) => run.stop("SIGKILL")));
}

export interface Ran {
  address: string;
  data_identity: string;
  launch_file: string;
  opened: boolean;
  build_ms: number;
  entries: number;
}

export class Run {
  stdout = "";
  stderr = "";
  private constructor(
    readonly child: ReturnType<typeof Bun.spawn<"ignore", "pipe", "pipe">>,
    /** The directories the run was given for temporary and home files. */
    readonly tmp: string, readonly home: string,
  ) {
    const drain = async (stream: ReadableStream<Uint8Array>, add: (text: string) => void) => {
      const decoder = new TextDecoder();
      const reader = stream.getReader();
      for (let next = await reader.read(); !next.done; next = await reader.read()) add(decoder.decode(next.value, { stream: true }));
    };
    this.drained = Promise.all([
      drain(child.stdout, (text) => (this.stdout += text)),
      drain(child.stderr, (text) => (this.stderr += text)),
    ]);
    live.add(this);
    void child.exited.then(() => live.delete(this));
  }
  private readonly drained: Promise<unknown>;

  static async command(args: string[], env: Record<string, string> = {}): Promise<Run> {
    const bundlePath = await shipped();
    const base = temporary();
    const tmp = join(base, "tmp");
    const home = join(base, "home");
    mkdirSync(tmp);
    mkdirSync(home);
    const child = Bun.spawn([process.execPath, ...ISOLATION_FLAGS, bundlePath, ...args], {
      cwd: base, env: { PATH: process.env.PATH ?? "", HOME: home, TMPDIR: tmp, ...env }, stdin: "ignore", stdout: "pipe", stderr: "pipe",
    });
    return new Run(child, tmp, home);
  }

  async until(done: () => boolean, ms = 30_000): Promise<void> {
    const end = Date.now() + ms;
    while (!done()) {
      if (Date.now() > end) throw new Error(`waited ${ms} ms in vain.\nstdout: ${this.stdout}\nstderr: ${this.stderr}`);
      await Bun.sleep(25);
    }
  }

  async ended(ms = 15_000): Promise<number> {
    const code = await Promise.race([this.child.exited, Bun.sleep(ms).then(() => undefined)]);
    if (code === undefined) throw new Error(`still running after ${ms} ms.\nstdout: ${this.stdout}\nstderr: ${this.stderr}`);
    await this.drained;
    return code;
  }

  async stop(signal: NodeJS.Signals = "SIGINT"): Promise<number> {
    this.child.kill(signal);
    return this.ended();
  }
}

export interface Answered {
  status: number;
  json: Record<string, any>;
}

/** A served run with its page's access: the code read from the launch file and traded for the secret. */
export class Browsing {
  private constructor(readonly run: Run, readonly info: Ran, readonly code: string, readonly secret: string) {}

  static async start(project: string, more: string[] = [], env: Record<string, string> = {}): Promise<Browsing> {
    const run = await Run.command(["browse", "--no-open", "--format", "json", "--project", project, ...more], env);
    await run.until(() => run.stdout.includes("\n") || run.child.exitCode !== null);
    if (!run.stdout.includes("\n")) throw new Error(`browse did not start: ${run.stderr}`);
    const info = JSON.parse(run.stdout.split("\n")[0]!) as Ran;
    const code = codeIn(info.launch_file);
    const got = await post(info, "/api/session", { code });
    return new Browsing(run, info, code, got.json.secret as string);
  }

  call(path: string, body: unknown = {}): Promise<Answered> {
    return post(this.info, path, body, this.secret);
  }

  query(query: string, variables?: Record<string, unknown>): Promise<Answered> {
    return this.call("/api/query", { module: "stemma", query, ...(variables ? { variables } : {}) });
  }

  /** Waits until the server says the data is current, and gives its identity. */
  async current(ms = 30_000): Promise<string> {
    const end = Date.now() + ms;
    for (;;) {
      const { json } = await this.call("/api/status");
      if (json.state === "current") return json.data_identity as string;
      if (Date.now() > end) throw new Error(`not current after ${ms} ms: ${JSON.stringify(json)}`);
      await Bun.sleep(50);
    }
  }

  stop(signal?: NodeJS.Signals): Promise<number> {
    return this.run.stop(signal);
  }
}

export const codeIn = (launchFile: string): string => /#code=([A-Za-z0-9_-]+)/.exec(readFileSync(launchFile, "utf8"))![1]!;

export async function post(info: { address: string }, path: string, body: unknown, secret?: string): Promise<Answered> {
  const origin = info.address.replace(/\/$/, "");
  const response = await fetch(`${origin}${path}`, {
    method: "POST", headers: { origin, "content-type": "application/json", "x-stemma-request": "1", ...(secret ? { "x-stemma-secret": secret } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, any> };
}

/** The processes whose parent is this one, with their command lines. */
export function childrenOf(pid: number): { pid: number; command: string }[] {
  const done = Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid=,command="]);
  return done.stdout.toString().split("\n").flatMap((line) => {
    const found = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    return found && Number(found[2]) === pid ? [{ pid: Number(found[1]), command: found[3]! }] : [];
  });
}

export const commandOf = (pid: number): string => Bun.spawnSync(["ps", "-o", "command=", "-p", String(pid)]).stdout.toString().trim();

export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
