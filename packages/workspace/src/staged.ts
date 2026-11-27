// A write of many files that happens whole or not at all (Data Design,
// Consistency; SD-015 BR-1501). Every file is staged, a journal names the
// renames, and only then is anything put in place. An interrupted write is
// finished, or its staged files discarded, by the next command. One writer at a
// time holds the project's write lock. Hand edits bypass both.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomToken, safeTarget, UnsafePath, writeProjectFile } from "./index.ts";

const LOCK = ".stemma/write.lock";
const JOURNAL = ".stemma/journal.json";
const STAGING = ".stemma/staging";

/** Another command is writing in this project. */
export class ProjectBusy extends Error {}
/** A file changed between being read and being written, so nothing was written. */
export class StaleInput extends Error {}

const running = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Runs `work` while holding the write lock. A lock left by a process that has ended is taken over. */
export function withWriteLock<T>(root: string, work: () => T): T {
  const path = safeTarget(root, LOCK);
  mkdirSync(dirname(path), { recursive: true });
  const take = () => writeFileSync(path, `${process.pid}\n`, { flag: "wx" });
  try {
    take();
  } catch {
    const holder = Number(readFileSync(path, "utf8").trim());
    if (!Number.isInteger(holder) || holder <= 0 || running(holder)) throw new ProjectBusy(LOCK);
    rmSync(path, { force: true });
    take();
  }
  try {
    finishInterrupted(root);
    return work();
  } finally {
    rmSync(path, { force: true });
  }
}

/** Only what a staged write may put in place. */
const writable = (path: string): boolean => path === "stemma.json" || /^(?:records\/[a-z-]+\/[0-9a-z-]+\.json|manuscript\/[0-9a-z-]+\.md)$/.test(path);

interface Journal { token: string; files: string[] }

function move(root: string, journal: Journal): void {
  for (const file of journal.files) {
    const staged = safeTarget(root, `${STAGING}/${journal.token}/${file}`);
    // A file no longer staged was put in place before the interruption.
    if (!existsSync(staged)) continue;
    const target = safeTarget(root, file);
    mkdirSync(dirname(target), { recursive: true });
    renameSync(staged, target);
  }
  rmSync(safeTarget(root, JOURNAL), { force: true });
  rmSync(join(root, STAGING), { recursive: true, force: true });
}

/**
 * Finishes a write that was interrupted after its journal was saved, and
 * discards what was staged without one. Call it only while holding the lock.
 */
function finishInterrupted(root: string): void {
  const path = safeTarget(root, JOURNAL);
  if (!existsSync(path)) {
    rmSync(join(root, STAGING), { recursive: true, force: true });
    return;
  }
  const journal = JSON.parse(readFileSync(path, "utf8")) as Journal;
  if (!/^[0-9a-z]{8,40}$/.test(journal.token) || !Array.isArray(journal.files) || !journal.files.every(writable)) throw new UnsafePath(JOURNAL);
  move(root, journal);
}

/** Whether an earlier command left a write unfinished. */
export const writeInterrupted = (root: string): boolean => existsSync(join(root, JOURNAL));

/**
 * Writes the files together. Each must be new, except those in `replacing`,
 * which must still hold the bytes given. Call it only while holding the lock.
 */
export function writeStaged(root: string, files: { path: string; text: string }[], replacing: Map<string, Uint8Array>): void {
  const token = randomToken();
  for (const { path, text } of files) {
    if (!writable(path)) throw new UnsafePath(path);
    const target = safeTarget(root, path);
    const before = replacing.get(path);
    if (before === undefined) {
      if (existsSync(target)) throw new UnsafePath(`${path} already exists`);
    } else if (!existsSync(target) || !readFileSync(target).equals(before)) throw new StaleInput(path);
    writeProjectFile(root, `${STAGING}/${token}/${path}`, text);
  }
  const journal: Journal = { token, files: files.map((f) => f.path) };
  writeProjectFile(root, JOURNAL, `${JSON.stringify(journal)}\n`);
  move(root, journal);
}
