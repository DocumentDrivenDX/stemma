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
