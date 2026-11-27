// The private content store: `sha256/<first two hex>/<64 hex>` (CONTRACT-001 B).
// It lies outside the project tree and outside anything git tracks. Paths come
// only from digests, never from a file name. Stemma deletes no blob.
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync, closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync,
  realpathSync, renameSync, rmSync, statSync, writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface StoreLocation { path: string; chosen_by: "--store-dir" | "STEMMA_STORE_DIR" | "default" }

export class UnsafeStore extends Error {}

/** --store-dir, then STEMMA_STORE_DIR, then a per-user directory keyed by project_id. */
export function storeLocation(root: string, projectId: unknown, option?: string, env: Record<string, string | undefined> = process.env): StoreLocation {
  if (option) return { path: resolve(root, option), chosen_by: "--store-dir" };
  if (env.STEMMA_STORE_DIR) return { path: resolve(root, env.STEMMA_STORE_DIR), chosen_by: "STEMMA_STORE_DIR" };
  // The ID forms a directory name, so it must be plain.
  if (typeof projectId !== "string" || !/^[0-9a-z]{8,40}$/.test(projectId)) {
    throw new UnsafeStore("project_id in stemma.json cannot form a directory name; name the store with --store-dir.");
  }
  const home = env.HOME || homedir();
  const base = process.platform === "darwin" ? join(home, "Library/Application Support")
    : process.platform === "win32" ? env.LOCALAPPDATA || join(home, "AppData/Local")
    : env.XDG_DATA_HOME || join(home, ".local/share");
  return { path: join(base, "stemma", "stores", projectId), chosen_by: "default" };
}

/** The real path of a location that may not exist yet. */
function realTarget(path: string): string {
  const missing: string[] = [];
  let at = resolve(path);
  while (!existsSync(at) && dirname(at) !== at) {
    missing.unshift(basename(at));
    at = dirname(at);
  }
  return join(realpathSync(at), ...missing);
}

const within = (outer: string, path: string): boolean => {
  const rel = relative(outer, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};

/** Whether git ignores a path in a working tree and tracks nothing under it. Unknown counts as no. */
function gitIgnores(tree: string, path: string): boolean {
  const git = (...args: string[]) => {
    try {
      // No file-system monitor: a repository's settings must not make git run a program.
      return Bun.spawnSync(["git", "-c", "core.fsmonitor=false", "-C", tree, ...args], { stdout: "pipe", stderr: "pipe" });
    } catch {
      return undefined;
    }
  };
  const rel = relative(tree, path);
  if (rel === "") return false;
  const ignored = git("check-ignore", "--quiet", "--", join(rel, "sha256", "probe"));
  const tracked = git("ls-files", "-z", "--", rel);
  return ignored?.exitCode === 0 && tracked?.exitCode === 0 && tracked.stdout.length === 0;
}

/** Why a location may not hold the store, or undefined when it may. */
export function storeProblem(root: string, path: string): string | undefined {
  const target = realTarget(path);
  const project = realpathSync(root);
  if (within(project, target)) return "it is inside the project directory. The store is private and kept apart from the project";
  if (within(target, project)) return "the project is inside it";
  if (existsSync(target) && !statSync(target).isDirectory()) return "it is not a directory";
  for (let at = target; ; at = dirname(at)) {
    if (existsSync(join(at, ".git")) && !gitIgnores(at, target)) {
      return "it is inside a git working tree that does not ignore it (or git could not be asked), so copies of sources could be committed";
    }
    if (dirname(at) === at) return undefined;
  }
}

const CHUNK = 1 << 20;

/** Hashes a regular file in pieces. `sink` receives each piece. */
export function hashFile(path: string, sink?: (chunk: Uint8Array) => void): { sha256: string; size: number } {
  const handle = openSync(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  try {
    if (!fstatSync(handle).isFile()) throw new Error("not a regular file");
    const hash = createHash("sha256");
    const buffer = new Uint8Array(CHUNK);
    let size = 0;
    for (let read; (read = readSync(handle, buffer, 0, CHUNK, null)) > 0; ) {
      const chunk = buffer.subarray(0, read);
      hash.update(chunk);
      sink?.(chunk);
      size += read;
    }
    return { sha256: hash.digest("hex"), size };
  } finally {
    closeSync(handle);
  }
}

export class UnsupportedFile extends Error {}

/**
 * The type from content, never from the name. Version 0 takes PDF files and
 * UTF-8 text. Content is only looked at, never run.
 */
export function inspectSourceFile(path: string, limit: number): { media_type: "application/pdf" | "text/plain"; sha256: string; size: number } {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    throw new UnsupportedFile("The file cannot be read.");
  }
  if (!stat.isFile()) throw new UnsupportedFile("That is not a regular file.");
  if (stat.size > limit) throw new UnsupportedFile(`The file is larger than the limit of ${limit / 1024 / 1024} MiB.`);
  if (stat.size === 0) throw new UnsupportedFile("The file is empty.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let head = "";
  let pdf: boolean | undefined;
  let text = true;
  const found = hashFile(path, (chunk) => {
    pdf ??= new TextDecoder("latin1").decode(chunk.subarray(0, 5)) === "%PDF-";
    if (pdf || !text) return;
    try {
      const piece = decoder.decode(chunk, { stream: true });
      if (head.length < 200) head += piece.slice(0, 200);
      if (/[\u0000-\u0008\u000b\u000e-\u001f]/.test(piece)) text = false;
    } catch {
      text = false;
    }
  });
  if (found.size > limit) throw new UnsupportedFile("The file grew past the limit while it was read.");
  if (pdf) return { media_type: "application/pdf", ...found };
  if (text) {
    try {
      decoder.decode();
    } catch {
      text = false;
    }
  }
  const markup = /^﻿?\s*(<!doctype html|<html|\{\\rtf)/i.test(head);
  if (!text || markup) {
    throw new UnsupportedFile("This version takes PDF files and plain UTF-8 text only; this file is neither. Nothing was stored, and no source is marked as checked.");
  }
  return { media_type: "text/plain", ...found };
}

export type StoredState = "ok" | "missing" | "altered" | "unreadable";

export class BlobStore {
  constructor(readonly root: string) {}

  private address(digest: string): string {
    if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error("not a digest");
    return join(this.root, "sha256", digest.slice(0, 2), digest);
  }

  /** A blob is a plain file in plain directories of the store. A link is never followed. */
  private plain(digest: string): StoredState | "present" {
    const path = this.address(digest);
    try {
      for (const directory of [dirname(dirname(path)), dirname(path)]) {
        if (!lstatSync(directory).isDirectory()) return "unreadable";
      }
      return lstatSync(path).isFile() ? "present" : "unreadable";
    } catch (error) {
      return (error as { code?: string }).code === "ENOENT" ? "missing" : "unreadable";
    }
  }

  has(digest: string): boolean {
    return this.plain(digest) === "present";
  }

  verify(digest: string): StoredState {
    const state = this.plain(digest);
    if (state !== "present") return state;
    try {
      return hashFile(this.address(digest)).sha256 === digest ? "ok" : "altered";
    } catch {
      return "unreadable";
    }
  }

  get(digest: string): Uint8Array | undefined {
    if (this.plain(digest) !== "present") return undefined;
    try {
      const bytes = new Uint8Array(readFileSync(this.address(digest)));
      return createHash("sha256").update(bytes).digest("hex") === digest ? bytes : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Verified put (BR-201): write a temporary file in the store, hash what was
   * written, and rename it into place. `restored` means a damaged blob was
   * replaced by bytes that do match its address.
   */
  put(from: { file: string } | { bytes: Uint8Array }, digest: string): "stored" | "present" | "restored" {
    const target = this.address(digest);
    const before = this.verify(digest);
    if (before === "ok") return "present";
    const temporary = join(this.root, "tmp", randomBytes(12).toString("hex"));
    for (const directory of [this.root, join(this.root, "tmp"), join(this.root, "sha256"), dirname(target)]) {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      if (directory !== this.root && !lstatSync(directory).isDirectory()) throw new UnsafeStore(`${directory} is not a plain directory.`);
    }
    try {
      const handle = openSync(temporary, "wx", 0o600);
      try {
        const out = (chunk: Uint8Array) => {
          for (let done = 0; done < chunk.length; ) done += writeSync(handle, chunk, done);
        };
        if ("file" in from) hashFile(from.file, out);
        else out(from.bytes);
      } finally {
        closeSync(handle);
      }
      if (hashFile(temporary).sha256 !== digest) throw new Error("the bytes changed while they were being stored");
      chmodSync(temporary, 0o600);
      renameSync(temporary, target);
    } finally {
      rmSync(temporary, { force: true });
    }
    return before === "missing" ? "stored" : "restored";
  }

  /** Every blob digest present, for `store verify --unreferenced`. */
  list(): string[] {
    const top = join(this.root, "sha256");
    const names = (path: string) => {
      try {
        return lstatSync(path).isDirectory() ? readdirSync(path) : [];
      } catch {
        return [];
      }
    };
    return names(top).flatMap((two) => names(join(top, two)).filter((n) => /^[0-9a-f]{64}$/.test(n) && n.startsWith(two))).sort();
  }
}
