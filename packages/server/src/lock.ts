// One server for a project on this computer (CONTRACT-005 N, "One server for a
// project"). The lock says who holds it and where it serves, and holds no key.
// It is held while its process lives and keeps touching it.
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, linkSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const LOCK_TIMES = { touchMs: 10_000, staleMs: 90_000 };

export interface LockHolder {
  pid: number;
  address?: string;
  project?: string;
  started?: string;
}

export type Lock =
  | { held: false; by: LockHolder | undefined }
  | { held: true; path: string; serving(address: string): void; release(): void };

/** The launcher names the plugin's data directory; without it, a directory of this user's in the temporary one. */
export const lockDirectory = (data = process.env.STEMMA_DATA): string => data || join(tmpdir(), `stemma-${process.getuid?.() ?? "user"}`);

export function lockPath(directory: string, project: string): string {
  return join(directory, "serve", `${createHash("sha256").update(realpathSync(project)).digest("hex")}.json`);
}

interface Found {
  text: string;
  by: LockHolder | undefined;
  mtimeMs: number;
}

function read(path: string): Found | undefined {
  try {
    const stat = lstatSync(path);
    // Anything but a plain file holds nothing.
    if (!stat.isFile() || stat.size > 4096) return { text: "", by: undefined, mtimeMs: 0 };
    const text = readFileSync(path, "utf8");
    let by: LockHolder | undefined;
    try {
      const { pid, address, project, started } = JSON.parse(text) as LockHolder;
      if (Number.isSafeInteger(pid) && pid > 0) {
        by = {
          pid,
          // Only an address of the form this server has is repeated.
          ...(typeof address === "string" && /^http:\/\/127\.0\.0\.1:\d{1,5}\/$/.test(address) ? { address } : {}),
          ...(typeof project === "string" ? { project } : {}), ...(typeof started === "string" ? { started } : {}),
        };
      }
    } catch {
      // Cut short or not a lock: it holds nothing once it is old.
    }
    return { text, by, mtimeMs: stat.mtimeMs };
  } catch {
    return undefined;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Held while its process is alive and it was touched lately. One just made and still empty is held too. */
const heldBy = (found: Found, now: number, times = LOCK_TIMES): boolean =>
  now - found.mtimeMs < times.staleMs && (found.by ? alive(found.by.pid) : found.text === "" && found.mtimeMs > 0);

/** Who serves this project now, if anyone. Reads only. */
export function lockHolder(directory: string, project: string, times = LOCK_TIMES): LockHolder | undefined {
  const found = read(lockPath(directory, project));
  return found && heldBy(found, Date.now(), times) ? found.by : undefined;
}

export function takeLock(directory: string, project: string, times = LOCK_TIMES): Lock {
  const path = lockPath(directory, project);
  mkdirSync(join(directory, "serve"), { recursive: true, mode: 0o700 });
  const mark = randomBytes(16).toString("base64url");
  const content: LockHolder & { holder: string } = { pid: process.pid, project, started: new Date().toISOString(), holder: mark };
  const text = () => `${JSON.stringify(content)}\n`;
  const create = (): boolean => {
    try {
      writeFileSync(path, text(), { flag: "wx", mode: 0o600 });
      chmodSync(path, 0o600);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  };
  const ours = () => read(path)?.text.includes(`"holder":"${mark}"`) === true;

  for (let attempt = 0; attempt < 5; attempt++) {
    if (create()) {
      const timer = setInterval(() => {
        try {
          if (ours()) utimesSync(path, new Date(), new Date());
          // Removed by someone's cleaning: made again, unless another holds it by now.
          else if (!read(path)) create();
        } catch {
          // The next one tries again.
        }
      }, times.touchMs);
      timer.unref();
      return {
        held: true, path,
        serving(address) {
          content.address = address;
          if (ours()) writeFileSync(path, text(), { mode: 0o600 });
        },
        release() {
          clearInterval(timer);
          if (ours()) rmSync(path, { force: true });
        },
      };
    }
    const found = read(path);
    if (!found) continue;
    if (heldBy(found, Date.now(), times)) return { held: false, by: found.by };
    // Moved aside before it is removed, so that a lock another made meanwhile is put back and not lost.
    const aside = `${path}.${randomBytes(6).toString("hex")}`;
    try {
      renameSync(path, aside);
    } catch {
      continue;
    }
    const moved = read(aside);
    if (moved && moved.text !== found.text) {
      try {
        linkSync(aside, path);
      } catch {
        // Another is there already.
      }
    }
    rmSync(aside, { force: true, recursive: true });
  }
  return { held: false, by: read(path)?.by };
}
