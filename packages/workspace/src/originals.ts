// Originals: the binaries and files that source files are converted from. They
// are never written into the project's tracked files. A fetched or supplied
// original may be kept in `.stemma/originals/<sha256>`, which git ignores;
// nothing depends on it.
import { createHash } from "node:crypto";
import {
  closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmSync,
  statSync, writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";

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

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/tiff"];

export interface Original { bytes: Uint8Array; sha256: string; size: number; media_type: string }

const starts = (bytes: Uint8Array, ...values: number[]) => values.every((v, i) => bytes[i] === v);

/**
 * The type from content. A file name's extension only tells Markdown from other
 * UTF-8 text, which have the same content. Nothing in the file is run.
 */
export function mediaType(bytes: Uint8Array, name: string): string | undefined {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  if (head.startsWith("%PDF-")) return "application/pdf";
  if (starts(bytes, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(bytes, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(bytes, 0x49, 0x49, 0x2a, 0x00) || starts(bytes, 0x4d, 0x4d, 0x00, 0x2a)) return "image/tiff";
  if (starts(bytes, 0x50, 0x4b, 0x03, 0x04)) {
    if (head.includes("mimetypeapplication/epub+zip")) return "application/epub+zip";
    // A DOCX names its main part in the archive's directory.
    return Buffer.from(bytes).includes("word/document.xml")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : undefined;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  if (/[\u0000-\u0008\u000b\u000e-\u001f]/.test(text) || text.startsWith("{\\rtf")) return undefined;
  const opening = text.slice(0, 1000).trimStart().toLowerCase();
  if (opening.startsWith("<!doctype html") || opening.startsWith("<html")) return "text/html";
  if (opening.startsWith("<?xml") && /<html[\s>]/.test(opening)) return "application/xhtml+xml";
  return /^\.(md|markdown)$/i.test(extname(name)) ? "text/markdown" : "text/plain";
}

export function readOriginal(path: string, limit: number): Original {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    throw new UnsupportedFile(`The file cannot be read: ${path}`);
  }
  if (!stat.isFile()) throw new UnsupportedFile("That is not a regular file.");
  if (stat.size > limit) throw new UnsupportedFile(`The file is larger than the limit of ${limit / 1024 / 1024} MiB.`);
  if (stat.size === 0) throw new UnsupportedFile("The file is empty.");
  const bytes = new Uint8Array(readFileSync(path));
  const type = mediaType(bytes, path);
  if (!type) {
    throw new UnsupportedFile("This version reads PDF, EPUB, DOCX, HTML, Markdown, plain UTF-8 text, and PNG, JPEG or TIFF page images; this file is none of them. Nothing was written.");
  }
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, media_type: type };
}

export const cacheDirectory = (root: string): string => join(root, ".stemma/originals");

/** Keeps a copy in the ignored cache, named by its digest. */
export function cacheOriginal(root: string, bytes: Uint8Array, sha256: string): string {
  const directory = cacheDirectory(root);
  mkdirSync(directory, { recursive: true });
  const target = join(directory, sha256);
  const temporary = `${target}.tmp`;
  try {
    writeFileSync(temporary, bytes);
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
  return target;
}

/**
 * Finds an original by digest in the cache and the given files or directories.
 * Only files of the recorded size are hashed. Links are not followed.
 */
export function findOriginal(root: string, wanted: { sha256: string; size: number }, places: string[] = []): string | undefined {
  const queue = [join(cacheDirectory(root), wanted.sha256), ...places];
  for (let i = 0; i < queue.length && i < 100_000; i++) {
    const path = queue[i]!;
    let stat;
    try {
      stat = i === 0 || places.includes(path) ? statSync(path) : lstatSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      queue.push(...readdirSync(path).filter((n) => !n.startsWith(".")).sort().map((n) => join(path, n)));
    } else if (stat.isFile() && stat.size === wanted.size && hashFile(path).sha256 === wanted.sha256) return path;
  }
  return undefined;
}
