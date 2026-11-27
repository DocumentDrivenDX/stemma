// The Word file's container, read from memory as untrusted input (CONTRACT-003 F
// and G; SD-015, "Input limits"). Entry names are never used as paths on disk.
import { crc32, inflateRawSync } from "node:zlib";

const MiB = 1024 * 1024;

/** The caps of SD-015, "Input limits", that apply to a Word file. */
export const WORD_LIMITS = {
  file_bytes: 200 * MiB,
  total_bytes: 1024 * MiB,
  part_bytes: 200 * MiB,
  /** The expansion ratio is capped for parts larger than this. */
  ratio_over_bytes: 10 * MiB,
  ratio: 200,
  entries: 10_000,
  xml_depth: 256,
  xml_elements: 3_000_000,
  open_fields: 64,
  text_value_bytes: MiB,
  embedded_bytes: 8 * MiB,
};
export type WordLimits = typeof WORD_LIMITS;

export class WordError extends Error {
  constructor(readonly code: "docx_unreadable" | "input_limit", message: string) {
    super(message);
    this.name = "WordError";
  }
}

export const unreadable = (why: string): never => {
  throw new WordError("docx_unreadable", `The Word file cannot be read: ${why}.`);
};
export const overLimit = (why: string): never => {
  throw new WordError("input_limit", `The Word file is over an input limit: ${why}.`);
};

interface Entry { method: number; crc: number; size: number; packed: number; start: number }

export interface WordZip {
  /** Every file entry, in the container's order. */
  names: string[];
  /** The entry's bytes, expanded and checked. Throws when there is no such entry. */
  bytes(name: string): Uint8Array;
}

const ENCRYPTED_OR_OLD = [0xd0, 0xcf, 0x11, 0xe0];

export function openWordZip(bytes: Uint8Array, limits: WordLimits): WordZip {
  if (bytes.length > limits.file_bytes) overLimit("the file's size");
  if (ENCRYPTED_OR_OLD.every((b, i) => bytes[i] === b)) unreadable("it is encrypted or in the old binary Word format. Save an unencrypted .docx copy");
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50 && i + 22 + data.readUInt16LE(i + 20) === data.length) {
      end = i;
      break;
    }
  }
  if (end < 0) unreadable("it is not a complete ZIP archive");
  const count = data.readUInt16LE(end + 10);
  const directorySize = data.readUInt32LE(end + 12);
  const directory = data.readUInt32LE(end + 16);
  if (count === 0xffff || directory === 0xffffffff || directorySize === 0xffffffff) unreadable("ZIP64 archives are not supported");
  if (count > limits.entries) overLimit("the number of archive entries");
  // A directory that holds more than it states could hide an entry.
  if (directory + directorySize !== end) unreadable("the archive directory is damaged");

  const entries = new Map<string, Entry>();
  const seen = new Set<string>();
  let total = 0;
  let at = directory;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || data.readUInt32LE(at) !== 0x02014b50) unreadable("an archive directory entry is damaged");
    const flags = data.readUInt16LE(at + 8);
    const method = data.readUInt16LE(at + 10);
    const crc = data.readUInt32LE(at + 16);
    const packed = data.readUInt32LE(at + 20);
    const size = data.readUInt32LE(at + 24);
    const nameLength = data.readUInt16LE(at + 28);
    const local = data.readUInt32LE(at + 42);
    const next = at + 46 + nameLength + data.readUInt16LE(at + 30) + data.readUInt16LE(at + 32);
    if (next > end) unreadable("an archive directory entry is damaged");
    const rawName = data.subarray(at + 46, at + 46 + nameLength);
    const name = rawName.toString("utf8");
    at = next;

    if (!name || name.startsWith("/") || /[\\\u0000]|^[A-Za-z]:/.test(name) || name.split("/").some((s) => s === ".." || s === ".")) {
      unreadable("an archive entry has an absolute, parent, or malformed path");
    }
    if (seen.has(name.toLowerCase())) unreadable("two archive entries have one name");
    seen.add(name.toLowerCase());
    if (flags & 1) unreadable("an entry is encrypted");
    if (packed === 0xffffffff || size === 0xffffffff || local === 0xffffffff) unreadable("ZIP64 archives are not supported");
    if (size > limits.part_bytes) overLimit("the size of one archive part");
    if (size > limits.ratio_over_bytes && size > packed * limits.ratio) overLimit("the expansion ratio of an archive part");
    total += size;
    if (total > limits.total_bytes) overLimit("the total uncompressed size");

    if (local + 30 > directory || data.readUInt32LE(local) !== 0x04034b50) unreadable("an archive entry is damaged");
    const localName = data.readUInt16LE(local + 26);
    const start = local + 30 + localName + data.readUInt16LE(local + 28);
    if (!data.subarray(local + 30, local + 30 + localName).equals(rawName)) unreadable("an archive entry has two names");
    if (start + packed > directory) unreadable("an archive entry is cut short");
    if (name.endsWith("/")) {
      if (size > 0) unreadable("a folder entry holds data");
      continue;
    }
    entries.set(name, { method, crc, size, packed, start });
  }
  if (at !== end) unreadable("the archive directory is damaged");

  return {
    names: [...entries.keys()],
    bytes(name) {
      const entry = entries.get(name) ?? unreadable("a part it needs is missing");
      const packed = data.subarray(entry.start, entry.start + entry.packed);
      let raw: Buffer;
      if (entry.method === 0) raw = packed;
      else if (entry.method === 8) {
        try {
          // The stated size was checked against the caps, and bounds the expansion.
          raw = inflateRawSync(packed, { maxOutputLength: entry.size + 1 });
        } catch {
          return unreadable("an entry cannot be expanded to its stated size");
        }
      } else return unreadable("an entry uses an unsupported compression method");
      if (raw.length !== entry.size) unreadable("an entry's stated size is false");
      if (crc32(raw) >>> 0 !== entry.crc) unreadable("an entry fails its checksum");
      return raw;
    },
  };
}
