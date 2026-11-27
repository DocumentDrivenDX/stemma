// `browse` (CONTRACT-002 B; CONTRACT-005 M): serves the explorer to a browser
// on this computer. Neither the secret nor the one-time code is ever written to
// standard output or standard error; that the code was used, and when, is.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inputsChanged, mayShowTheSame, scanInputs } from "@stemma/workspace";
import {
  type Assets, BuildFailure, type Built, createSession, type LaunchFile, listen, openInBrowser, type SnapshotEvent, Snapshots, spawnSnapshotProcess,
  writeLaunchFile,
} from "@stemma/server";
import { CommandError, type Options, requireProject, usageError, VERSION } from "./context.ts";
import { ISOLATION_FLAGS } from "./runtime.ts";

const ASSET_FILES: Record<keyof Assets, string> = { html: "index.html", js: "app.js", css: "app.css" };
const IDLE_MINUTES = 60;

/** A run from this repository's source, which has no built files beside it. */
const fromSource = () => /[\\/]packages[\\/]cli[\\/]src[\\/]browse\.ts$/.test(import.meta.path);

/** The served page ships beside the built command line, and is read once, whole. */
async function pageAssets(): Promise<Assets> {
  const shipped = join(import.meta.dir, "explorer-served");
  if (existsSync(shipped)) {
    return Object.fromEntries(Object.entries(ASSET_FILES).map(([name, file]) => [name, readFileSync(join(shipped, file), "utf8")])) as unknown as Assets;
  }
  if (fromSource()) {
    // Not a literal, so that the built command line holds no bundler and nothing of the explorer's sources.
    const builder = join(import.meta.dir, "../../explorer/build.ts");
    return ((await import(builder)) as { buildServed: () => Promise<Assets> }).buildServed();
  }
  throw new CommandError(70, "page_template_missing", "This copy of Stemma lacks its served explorer page, so nothing was served. Install Stemma again.", [shipped]);
}

function workerCommand(): string[] {
  const worker = join(import.meta.dir, fromSource() ? "browse-worker.ts" : "browse-worker.js");
  if (!existsSync(worker)) throw new CommandError(70, "worker_missing", "This copy of Stemma lacks part of its local server, so nothing was served. Install Stemma again.", [worker]);
  return [process.execPath, ...ISOLATION_FLAGS, worker];
}

function idleMinutes(options: Options): number {
  const given = options["idle-minutes"];
  if (given === undefined) return IDLE_MINUTES;
  const minutes = Number(given);
  if (!/^(\d+|\d*\.\d+)$/.test(given) || !(minutes > 0) || minutes > 24 * 60) throw usageError("--idle-minutes is a number of minutes, more than 0 and at most 1440.");
  return minutes;
}

/** Said when the code is redeemed, so that the author can tell their own browser from anything else's. */
const openedLine = (at: number) =>
  `The one-time link was opened at ${new Date(at).toLocaleTimeString("en-GB")} (this computer's time). That should be your browser showing the explorer. If your page says that another page or program opened the link first, or you saw no page open then, stop this command and run it again.`;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function warningLines(built: Built): string[] {
  return built.warnings.map((w) => `WARNING ${w.code}: ${w.message}${w.records.length > 0 ? ` ${w.code === "records_left_out" ? "Files" : "Records"}: ${w.records.slice(0, 5).join(", ")}${w.records.length > 5 ? ` and ${w.records.length - 5} more, all listed on the page` : ""}.` : ""}`);
}

function eventLine(event: SnapshotEvent): string {
  if (event.kind === "changed") return "The project's files changed. Reading them again; the page shows nothing until then.";
  if (event.kind === "unchanged") return `Checked in ${seconds(event.ms)}: the data is the same, and is served again.`;
  if (event.kind === "built") return [`Read again in ${seconds(event.ms)}. Data identity ${event.built.data_identity.slice(0, 12)}.`, ...warningLines(event.built)].join("\n");
  return `The project could not be read again, so nothing is served until it can. ${event.message}`;
}

export interface BrowseDependencies {
  /** Opens the launch file; true when the system took it. */
  open?: (path: string) => Promise<boolean>;
  /** Ends the run, as a signal does. */
  stop?: AbortSignal;
}

export async function browse(options: Options, dependencies: BrowseDependencies = {}): Promise<number> {
  const root = requireProject(options);
  const idle = idleMinutes(options) * 60_000;
  const json = options.format === "json";
  const say = (line: string) => process.stdout.write(`${line}\n`);
  // With --format json, standard output is the one object; everything else is said on standard error.
  const tell = json ? (line: string) => process.stderr.write(`${line}\n`) : say;
  const assets = await pageAssets();
  const command = workerCommand();

  let ending: (why: string) => void = () => {};
  const ended = new Promise<string>((resolve) => (ending = resolve));
  const signals = (["SIGINT", "SIGTERM", "SIGHUP"] as const).map((name) => [name, () => ending("stopped")] as const);
  for (const [name, stop] of signals) process.on(name, stop);
  dependencies.stop?.addEventListener("abort", () => ending("stopped"), { once: true });

  const snapshots = new Snapshots(
    { scan: () => scanInputs(root), changed: (since) => inputsChanged(root, since), mayShowTheSame },
    () => spawnSnapshotProcess(command, root),
    (event) => tell(eventLine(event)),
  );
  let server: { close(): Promise<void> } | undefined;
  let launch: LaunchFile | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    tell("Reading the project. The browser opens when it is ready.");
    const began = Date.now();
    const starting = snapshots.start();
    // A signal during a long first read ends it: the child is ended below.
    const built = await Promise.race([starting, ended]);
    if (typeof built === "string") {
      starting.catch(() => {});
      return 0;
    }
    const buildMs = Date.now() - began;

    let used = Date.now();
    const session = createSession((how, at) => {
      launch?.remove();
      if (how === "used") tell(openedLine(at));
    });
    const listening = await listen({ assets, session, check: () => snapshots.check(), used: () => (used = Date.now()) }).catch((error: unknown) => {
      throw new CommandError(5, "cannot_listen", `No port on 127.0.0.1 could be opened, so nothing is served. ${error instanceof Error ? error.message : ""}`);
    });
    server = listening;
    launch = writeLaunchFile(listening.address, session.code);
    const opened = options["no-open"] ? false : await (dependencies.open ?? openInBrowser)(launch.path);

    if (json) {
      process.stdout.write(`${JSON.stringify({ address: listening.address, data_identity: built.data_identity, launch_file: launch.path, opened, build_ms: buildMs, entries: built.entries, warnings: built.warnings, stemma: VERSION })}\n`);
    } else {
      say([
        `Serving the explorer at ${listening.address} to this computer only.`,
        `Data identity ${built.data_identity.slice(0, 12)}. Entries: ${built.entries}. Read in ${seconds(buildMs)}.`,
        ...warningLines(built),
        "The served pages hold passage text, source page text, other record contents, and the report's text when there is one.",
        opened ? "Your browser was asked to open it. If no page appears, open this file in your browser:" : "To open it, open this file in your browser:",
        `  ${launch.path}`,
        "The file works once, within 10 minutes, and lets whoever reads it first into the page: do not read it, copy it, or show it to anyone.",
        `It stops after ${idle / 60_000} minutes without use, or when you press Ctrl+C.`,
      ].join("\n"));
    }

    timer = setInterval(() => {
      if (Date.now() - used >= idle) ending("idle");
    }, Math.min(1000, idle / 4));
    const why = await ended;
    tell(why === "idle" ? `Stopped after ${idle / 60_000} minutes without use.` : "Stopped.");
    return 0;
  } catch (error) {
    if (error instanceof BuildFailure) {
      throw new CommandError(error.code === "project_unreadable" || error.code === "version_unsupported" ? 3 : 70, error.code, `Nothing is served. ${error.message}`);
    }
    throw error;
  } finally {
    clearInterval(timer);
    launch?.remove();
    await server?.close();
    await snapshots.stop();
    for (const [name, stop] of signals) process.off(name, stop);
  }
}
