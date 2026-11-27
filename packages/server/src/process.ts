// The child that holds a snapshot, and the messages between it and the command.
// The child gets the project's directory and the calls to answer; it never gets
// the secret or the code, and opens no listener.
import type { Answer, Built, SnapshotProcess } from "./snapshots.ts";

type Request = { id: number } & ({ op: "build" } | { op: "identity" } | { op: "ask"; route: string; body: unknown });
type Reply = { id: number } & ({ ok: unknown } | { error: { code: string; message: string } });

/** A failure the child reported, with the code the command line gives it. */
export class BuildFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export class ProcessGone extends Error {
  constructor() {
    super("The process that held the project's data ended. If the computer ran short of memory, close other programs and try again.");
  }
}

export function spawnSnapshotProcess(command: string[], root: string): SnapshotProcess {
  const waiting = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  let next = 0;
  let gone = false;
  let ended!: () => void;
  const done = new Promise<void>((resolve) => (ended = resolve));
  const child = Bun.spawn(command, {
    stdin: "ignore", stdout: "ignore", stderr: "inherit",
    ipc(reply: Reply) {
      const call = waiting.get(reply.id);
      if (!call) return;
      waiting.delete(reply.id);
      if ("error" in reply) call.reject(new BuildFailure(reply.error.code, reply.error.message));
      else call.resolve(reply.ok);
    },
    onExit() {
      gone = true;
      for (const call of waiting.values()) call.reject(new ProcessGone());
      waiting.clear();
      ended();
    },
  });
  const call = <T>(request: Record<string, unknown>) => new Promise<T>((resolve, reject) => {
    if (gone) return reject(new ProcessGone());
    const id = ++next;
    waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
    try {
      child.send({ ...request, id });
    } catch {
      waiting.delete(id);
      reject(new ProcessGone());
    }
  });
  return {
    build: () => call<Built>({ op: "build", root }),
    identity: () => call<string>({ op: "identity", root }),
    ask: (route, body) => call<Answer>({ op: "ask", route, body }),
    // It holds no file and writes nothing, so it can be ended at once, even in the middle of a build.
    stop: () => child.kill("SIGKILL"),
    ended: done,
  };
}

export interface ChildWork {
  build(root: string): Promise<{ built: Built; answer(route: string, body: unknown): Promise<Answer> }>;
  identity(root: string): Promise<string>;
}

/** The child's side. It ends when the command that started it is gone. */
export function serveSnapshot(work: ChildWork): void {
  let answer: ((route: string, body: unknown) => Promise<Answer>) | undefined;
  const reply = (message: Reply) => process.send!(message);
  process.on("disconnect", () => process.exit(0));
  process.on("message", (request: Request & { root: string }) => {
    void (async () => {
      try {
        if (request.op === "build") {
          const made = await work.build(request.root);
          answer = made.answer;
          reply({ id: request.id, ok: made.built });
        } else if (request.op === "identity") reply({ id: request.id, ok: await work.identity(request.root) });
        else if (answer) reply({ id: request.id, ok: await answer(request.route, request.body) });
        else reply({ id: request.id, error: { code: "no_snapshot", message: "No snapshot is built." } });
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        reply({ id: request.id, error: { code: typeof code === "string" ? code : "internal_error", message: error instanceof Error ? error.message : String(error) } });
      }
    })();
  });
}
