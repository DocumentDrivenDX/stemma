import { dlopen, FFIType } from "bun:ffi";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

export const ROOT = join(import.meta.dir, "..");

/**
 * The promise's value, or undefined after `ms`. The timer is cleared either way:
 * one left waiting keeps a script such as plugin-check running until it fires.
 */
export async function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<undefined>((resolve) => (timer = setTimeout(resolve, ms, undefined)))]);
  } finally {
    clearTimeout(timer);
  }
}

const made: string[] = [];
/** Removes every temporary directory made so far; tests/cleanup.ts calls it. */
export function removeTemporaries(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function temporary(): string {
  const dir = mkdtempSync(join(tmpdir(), "stemma-test-"));
  made.push(dir);
  return dir;
}

/**
 * clonefile(2), which copies a whole directory tree on APFS in one call, sharing
 * the blocks until either copy is written. Undefined where it is not there.
 */
const clonefile = (() => {
  if (process.platform !== "darwin") return undefined;
  try {
    const lib = dlopen("/usr/lib/libSystem.B.dylib", { clonefile: { args: [FFIType.cstring, FFIType.cstring, FFIType.u32], returns: FFIType.i32 } });
    return (from: string, to: string): boolean => lib.symbols.clonefile(Buffer.from(`${from}\0`), Buffer.from(`${to}\0`), 0) === 0;
  } catch {
    return undefined;
  }
})();

/**
 * A copy of the directory `from` at `to` (which must not exist), without the
 * paths in `leave`, relative to `from`. It is a copy-on-write clone where the
 * file system makes one, and an ordinary copy elsewhere; either way the files
 * are the copy's own.
 */
export function copyTree(from: string, to: string, leave: string[] = []): string {
  if (clonefile?.(from, to)) {
    for (const path of leave) rmSync(join(to, path), { recursive: true, force: true });
    return to;
  }
  const left = new Set(leave.map((path) => join(from, path)));
  cpSync(from, to, { recursive: true, filter: (path) => !left.has(path) });
  return to;
}

/** The worked example, as a copy of its own, without what a run of Stemma makes in it. */
export const copyExample = (to: string, leave = [".stemma", "build", "report/build", "report/report.pdf"]): string =>
  copyTree(join(ROOT, "examples/coral-reefs"), to, leave);

/**
 * The command line as built for the tests. `./scripts/dev.sh check` builds dist/
 * just before the tests and names it in STEMMA_TEST_DIST, so that every test file
 * uses that one build; run any other way, a file builds its own into `to`. Either
 * way it is the build as shipped. No test changes it: one that needs a changed
 * build changes a copy.
 */
export async function builtCli(to = join(temporary(), "dist")): Promise<string> {
  const given = process.env.STEMMA_TEST_DIST;
  if (given) return join(given, "stemma.js");
  const { bundle } = await import("../scripts/build.ts");
  return bundle(to);
}

export function fixture(name: string, parent = temporary()): string {
  const dir = join(parent, name);
  cpSync(join(ROOT, "fixtures", name), dir, { recursive: true });
  return dir;
}

/** A ZIP archive holding the given entries, deflated. */
export function zip(entries: Record<string, string>, stated?: number): Uint8Array {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text);
    const packed = name === "mimetype" ? raw : deflateRawSync(raw);
    const method = name === "mimetype" ? 0 : 8;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(raw) >>> 0, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(Buffer.byteLength(name), 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc32(raw) >>> 0, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(stated ?? raw.length, 24);
    entry.writeUInt16LE(Buffer.byteLength(name), 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, Buffer.from(name), packed);
    central.push(entry, Buffer.from(name));
    offset += 30 + Buffer.byteLength(name) + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}
