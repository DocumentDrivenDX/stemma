// Shared by the mcp*.test.ts files: a copy of the worked example, the shipped
// command started as a host starts it, and what it leaves behind.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { alive, shipped } from "./browse-run.ts";
import { copyExample, temporary } from "./helpers.ts";
import { McpHost } from "./mcp-run.ts";

export const filesIn = (directory: string): string[] => (!existsSync(directory) ? [] : readdirSync(directory, { withFileTypes: true }).flatMap((e) => {
  const path = join(directory, e.name);
  return e.isDirectory() ? filesIn(path) : [path];
}));
export const treeOf = (directory: string) => filesIn(directory).sort().map((path) => `${path} ${createHash("sha256").update(readFileSync(path)).digest("hex")} ${lstatSync(path).mtimeMs}`);

export function coral(): string {
  const dir = join(temporary(), "coral");
  return copyExample(dir);
}

/** The shipped command as the host starts it: from the plugin's directory, told the session's directory and the data directory. */
export async function start(session: string | undefined, more: string[] = [], places = fresh()) {
  const bundle = await shipped();
  const env = {
    PATH: "/usr/bin:/bin", HOME: places.home, TMPDIR: places.tmp, STEMMA_DATA: places.data,
    ...(session === undefined ? {} : { CLAUDE_PROJECT_DIR: session }),
  };
  const host = McpHost.start([process.execPath, ...ISOLATION_FLAGS, bundle, "mcp", ...more], env, dirname(bundle));
  return { host, places, env };
}
export function fresh() {
  const base = temporary();
  const places = { home: join(base, "home"), tmp: join(base, "tmp"), data: join(base, "data") };
  mkdirSync(places.home);
  mkdirSync(places.tmp);
  mkdirSync(places.data);
  return places;
}

export const lsof = Bun.which("lsof") ?? (existsSync("/usr/sbin/lsof") ? "/usr/sbin/lsof" : null);
export const socketsOf = (pids: number[]) => (lsof ? Bun.spawnSync([lsof, "-nP", "-a", "-i", "-p", pids.join(",")]).stdout.toString().split("\n").slice(1).filter(Boolean) : []);
export const gone = async (pid: number) => {
  for (let i = 0; i < 100 && alive(pid); i++) await Bun.sleep(100);
  return !alive(pid);
};
