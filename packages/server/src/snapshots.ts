// Which snapshot may answer (CONTRACT-005 M, "Freshness"). A call is answered
// only after a scan of the inputs that began after the call arrived found
// nothing changed. A change takes the snapshot out of service until its data
// identity is computed again and, when that moved, a new one is built. This
// knows nothing of records: the scan and the process that builds are given.

/** An answer as it is sent: an HTTP status and a JSON body. */
export interface Answer {
  status: number;
  body: string;
}

export interface Built {
  data_identity: string;
  /** Entries in the graph, for the command's own report. */
  entries: number;
  warnings: { code: string; message: string; records: string[] }[];
}

/** One process holding, or about to hold, one snapshot. */
export interface SnapshotProcess {
  /** Reads the project and builds everything the snapshot answers from. */
  build(): Promise<Built>;
  /** The data identity of the files as they are now. */
  identity(): Promise<string>;
  ask(route: string, body: unknown): Promise<Answer>;
  stop(): void;
  /** Settles when the process has ended. */
  readonly ended: Promise<void>;
}

export interface Inputs<S> {
  scan(): Promise<S>;
  changed(since: S): Promise<boolean>;
  /** Whether what the data identity does not cover is the same in both. */
  alike(a: S, b: S): boolean;
}

export type Verdict =
  | { state: "current"; data_identity: string; process: SnapshotProcess }
  | { state: "rebuilding" }
  | { state: "failed"; message: string };

export type SnapshotEvent =
  | { kind: "changed" }
  | { kind: "unchanged"; ms: number }
  | { kind: "built"; built: Built; ms: number }
  | { kind: "failed"; message: string };

interface Held<S> {
  process: SnapshotProcess;
  built: Built;
  /** The scan made before the snapshot's files were read. */
  scan: S;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export class Snapshots<S> {
  private held: Held<S> | undefined;
  private state: "current" | "rebuilding" | "failed" = "rebuilding";
  private message = "";
  /** For a failed build, the scan made before it read anything. */
  private failedAt: S | undefined;
  private stopped = false;
  private starting: SnapshotProcess | undefined;
  private running: Promise<unknown> = Promise.resolve();
  private queued: Promise<Verdict> | undefined;

  constructor(private readonly inputs: Inputs<S>, private readonly spawn: () => SnapshotProcess, private readonly on: (event: SnapshotEvent) => void = () => {}) {}

  /** Builds the first snapshot, and fails when it cannot be built. `stop` ends it at any point. */
  async start(): Promise<Built> {
    const scan = await this.inputs.scan();
    return (await this.buildFrom(scan)).built;
  }

  private async buildFrom(scan: S): Promise<Held<S>> {
    const process = this.spawn();
    this.starting = process;
    try {
      if (this.stopped) throw new Error("The server is stopping.");
      const built = await process.build();
      if (this.stopped) throw new Error("The server is stopping.");
      const held = { process, built, scan };
      this.held = held;
      this.state = "current";
      // A snapshot whose process ends on its own is replaced.
      void process.ended.then(() => {
        if (this.stopped || this.held !== held) return;
        this.held = undefined;
        this.state = "rebuilding";
        void this.refresh();
      });
      return held;
    } catch (error) {
      process.stop();
      throw error;
    } finally {
      this.starting = undefined;
    }
  }

  /**
   * The verdict of a scan that begins after this call. Calls made while one is
   * waiting to begin share it.
   */
  check(): Promise<Verdict> {
    if (this.queued) return this.queued;
    const next = this.running.then(() => {
      this.queued = undefined;
      const scanned = this.scanOnce();
      this.running = scanned.catch(() => {});
      return scanned;
    });
    this.queued = next;
    return next;
  }

  private async scanOnce(): Promise<Verdict> {
    if (this.state === "current" && this.held) {
      const held = this.held;
      const changed = await this.inputs.changed(held.scan);
      if (this.held === held && this.state === "current") {
        if (!changed) return { state: "current", data_identity: held.built.data_identity, process: held.process };
        this.state = "rebuilding";
        this.on({ kind: "changed" });
        void this.refresh();
      }
    } else if (this.state === "failed" && this.failedAt !== undefined && (await this.inputs.changed(this.failedAt))) {
      this.state = "rebuilding";
      this.on({ kind: "changed" });
      void this.refresh();
    }
    return this.state === "failed" ? { state: "failed", message: this.message } : { state: "rebuilding" };
  }

  /** Never throws: a failure is the state `failed`. */
  private async refresh(): Promise<void> {
    const began = Date.now();
    let scan: S | undefined;
    try {
      // Before anything is read, so that a change during the work is seen afterwards.
      scan = await this.inputs.scan();
      const held = this.held;
      if (held && this.inputs.alike(held.scan, scan)) {
        const identity = await held.process.identity();
        if (this.stopped) return;
        if (this.held === held && identity === held.built.data_identity) {
          held.scan = scan;
          this.state = "current";
          this.on({ kind: "unchanged", ms: Date.now() - began });
          return;
        }
      }
      // The old one ends first, so that two are never held at once.
      this.held = undefined;
      held?.process.stop();
      await held?.process.ended;
      const next = await this.buildFrom(scan);
      this.on({ kind: "built", built: next.built, ms: Date.now() - began });
    } catch (error) {
      if (this.stopped) return;
      const held = this.held;
      this.held = undefined;
      held?.process.stop();
      this.state = "failed";
      this.message = messageOf(error);
      this.failedAt = scan;
      this.on({ kind: "failed", message: this.message });
    }
  }

  /** Ends every process. Returns when they are gone. */
  async stop(): Promise<void> {
    this.stopped = true;
    const processes = [this.held?.process, this.starting].filter((p) => p !== undefined);
    this.held = undefined;
    this.state = "failed";
    this.message = "The server is stopping.";
    for (const process of processes) process.stop();
    await Promise.all(processes.map((p) => p.ended));
  }
}
