// Where the local server looks for an original, and how it reads one
// (CONTRACT-005 M, "Originals"). An original is named only by its SHA-256 and
// size, as a source file records them. It is looked for in the project's cache
// and in the places the author named when the command started, and nowhere
// else. No symbolic link is followed. The bytes given are the very bytes that
// were hashed: a file is read whole into memory, and that memory is what is
// sent when its digest is the one asked for.
import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

export const ORIGINAL_SEARCH = { entries: 100_000 };

export type FoundOriginal = { bytes: Buffer } | { refused: "original_not_held" | "original_changed" };

const lstatOf = (path: string): Promise<Stats | undefined> => lstat(path).catch(() => undefined);

export interface Places {
  /** Named files and folders that will be looked in. */
  places: string[];
  /** One line for each named place that will not be. */
  warnings: string[];
}

/**
 * The places the author named, checked once. A name that is itself a link is not
 * looked in. Links in the directories above it are resolved here, once, so that
 * what is looked in afterwards is a path with no link in it.
 */
export async function originalPlaces(base: string, named: string[]): Promise<Places> {
  const places: string[] = [];
  const warnings: string[] = [];
  for (const given of named) {
    const path = resolve(base, given);
    const stat = await lstatOf(path);
    const why = !stat ? "there is nothing there that can be read"
      : stat.isSymbolicLink() ? "it is a symbolic link, which is not followed; name the folder or file itself"
        : !stat.isDirectory() && !stat.isFile() ? "it is neither a folder nor a file" : undefined;
    if (why) warnings.push(`Originals are not looked for in ${path}: ${why}.`);
    else places.push(join(await realpath(dirname(path)).catch(() => dirname(path)), basename(path)));
  }
  return { places, warnings };
}

/**
 * The bytes of a regular file of exactly `size` bytes whose SHA-256 is `sha256`.
 * `other` when it is such a file with other bytes or another size, and nothing
 * when it cannot be read as a plain file.
 */
async function readExact(path: string, sha256: string, size: number): Promise<Buffer | "other" | undefined> {
  // Not following a link at the end of the path, and not waiting on a pipe. Windows has neither flag; the lstat before this is all it has.
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)).catch(() => undefined);
  if (!handle) return undefined;
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) return undefined;
    if (stat.size !== size) return "other";
    // One byte more than expected, so that a file that grew is seen to have.
    const buffer = Buffer.allocUnsafeSlow(size + 1);
    let have = 0;
    while (have < buffer.length) {
      const { bytesRead } = await handle.read(buffer, have, Math.min(buffer.length - have, 4 << 20), have);
      if (bytesRead === 0) break;
      have += bytesRead;
    }
    if (have !== size) return "other";
    const bytes = buffer.subarray(0, size);
    return createHash("sha256").update(bytes).digest("hex") === sha256 ? bytes : "other";
  } catch {
    return undefined;
  } finally {
    await handle.close().catch(() => {});
  }
}

/** Whether every step from `base` down to `path`, both ends included, is there and is not a link. */
async function plain(base: string, path: string): Promise<boolean> {
  let at = base;
  for (const step of ["", ...relative(base, path).split(sep).filter(Boolean)]) {
    at = step === "" ? base : join(at, step);
    const stat = await lstatOf(at);
    if (!stat || stat.isSymbolicLink()) return false;
  }
  return true;
}

/** Every file of `size` bytes in the places, following no link, passing over names that begin with a dot. `most` bounds one search over all of them. */
async function* candidates(places: string[], size: number, most: number): AsyncGenerator<{ place: string; path: string }> {
  let looked = 0;
  for (const place of places) {
    const queue = [place];
    for (let i = 0; i < queue.length; i++) {
      const path = queue[i]!;
      if (++looked > most) return;
      const stat = await lstatOf(path);
      if (stat?.isFile() && stat.size === size) yield { place, path };
      if (!stat?.isDirectory()) continue;
      const names: string[] = [];
      try {
        for await (const entry of await opendir(path)) {
          if (!entry.name.startsWith(".")) names.push(entry.name);
          if (names.length > most) break;
        }
      } catch {
        continue;
      }
      for (const name of names.sort()) queue.push(join(path, name));
    }
  }
}

export interface Originals {
  read(sha256: string, size: number): Promise<FoundOriginal>;
}

export function createOriginals(root: string, places: string[], search = ORIGINAL_SEARCH): Originals {
  /** Where each digest was found: a place to look first, never a reason to believe what is there. */
  const last = new Map<string, { place: string; path: string }>();
  return {
    async read(sha256, size) {
      if (!/^[0-9a-f]{64}$/.test(sha256)) return { refused: "original_not_held" };
      let other = false;
      // The cache: the project's own directory, then two plain directories and a plain file.
      const store = join(root, ".stemma");
      const cached = join(store, "originals", sha256);
      if (await plain(store, cached)) {
        const got = await readExact(cached, sha256, size);
        if (typeof got === "object") return { bytes: got };
        other = got === "other";
      }
      const before = last.get(sha256);
      if (before && places.includes(before.place) && await plain(before.place, before.path)) {
        const got = await readExact(before.path, sha256, size);
        if (typeof got === "object") return { bytes: got };
      }
      last.delete(sha256);
      for await (const { place, path } of candidates(places, size, search.entries)) {
        const got = await readExact(path, sha256, size);
        if (typeof got === "object") {
          last.set(sha256, { place, path });
          return { bytes: got };
        }
        other ||= got === "other";
      }
      return { refused: other ? "original_changed" : "original_not_held" };
    },
  };
}
