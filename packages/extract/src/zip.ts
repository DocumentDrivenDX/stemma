// Reads a ZIP container (EPUB, DOCX) from memory with the runtime's own inflate.
// Entry names are never used as paths on disk. Sizes are capped before and
// while inflating (SD-002, "Hostile input limits").
import { inflateRawSync } from "node:zlib";
import { Unconvertible } from "./model.ts";

export const ZIP_LIMITS = { entries: 20_000, entry_bytes: 100 * 1024 * 1024, total_bytes: 400 * 1024 * 1024 };

export interface Zip {
  names: string[];
  /** The entry's text, or undefined when there is no such entry. */
  text(name: string): string | undefined;
}

export function readZip(bytes: Uint8Array, limits = ZIP_LIMITS): Zip {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bad = (why: string): never => {
    throw new Unconvertible(`The container is damaged or not supported: ${why}.`);
  };
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) bad("no directory");
  const count = data.readUInt16LE(end + 10);
  if (count > limits.entries) bad("too many entries");
  let at = data.readUInt32LE(end + 16);
  const entries = new Map<string, { method: number; size: number; start: number; packed: number; encrypted: boolean }>();
  for (let i = 0; i < count; i++) {
    if (at + 46 > data.length || data.readUInt32LE(at) !== 0x02014b50) bad("a broken directory entry");
    const [flags, method, packed, size] = [data.readUInt16LE(at + 8), data.readUInt16LE(at + 10), data.readUInt32LE(at + 20), data.readUInt32LE(at + 24)];
    const [nameLength, extra, comment, local] = [data.readUInt16LE(at + 28), data.readUInt16LE(at + 30), data.readUInt16LE(at + 32), data.readUInt32LE(at + 42)];
    const name = data.toString("utf8", at + 46, at + 46 + nameLength);
    if (local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50) bad("a broken entry");
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    entries.set(name, { method, size, start, packed, encrypted: (flags & 1) === 1 });
    at += 46 + nameLength + extra + comment;
  }
  let total = 0;
  return {
    names: [...entries.keys()],
    text(name) {
      const entry = entries.get(name);
      if (!entry) return undefined;
      if (entry.encrypted) bad("it is encrypted");
      if (entry.size > limits.entry_bytes) bad("an entry is over the size limit");
      const packed = data.subarray(entry.start, entry.start + entry.packed);
      let raw: Buffer;
      try {
        // The cap holds even when the stated size is false.
        raw = entry.method === 0 ? packed : entry.method === 8 ? inflateRawSync(packed, { maxOutputLength: limits.entry_bytes }) : bad("an unknown compression");
      } catch (error) {
        if (error instanceof Unconvertible) throw error;
        return bad("an entry cannot be expanded or passes the size limit");
      }
      total += raw.length;
      if (total > limits.total_bytes) bad("it expands past the size limit");
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(raw);
      } catch {
        return bad("an entry is not UTF-8");
      }
    },
  };
}
