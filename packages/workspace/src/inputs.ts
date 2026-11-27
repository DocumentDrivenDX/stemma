// A stat scan of the files a served snapshot is made from (CONTRACT-005 M,
// "Freshness"). It lists them as `readProject` does and reads no file content:
// for each, its kind, size, inode, and modification and change times; for each
// directory, the names in it.
import { type Stats } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

/** Files at the top of the project that are read when present. */
const FILES = ["stemma.json", "rules.md"];
/** Directories read whole. `report/` may name a template that begins with a dot, so nothing there is skipped. */
const DIRECTORIES = ["records", "sources", "manuscript", "research", "report"];
const HIDDEN_READ = new Set(["report"]);
const AT_ONCE = 64;

/** What is compared of one input; `mode` is 0 for one that is not there or cannot be looked at. */
interface Seen {
  mode: number;
  ino: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
}

interface Mark {
  /** The path as it is asked for, joined once. */
  full: string;
  stat: Seen;
  /** For a directory, the names read from it. */
  names?: string;
}

export interface InputScan {
  marks: Map<string, Mark>;
}

const MISSING: Stats | Seen = { mode: 0, ino: 0, size: 0, mtimeMs: 0, ctimeMs: 0 };

// Whatever cannot be looked at counts as missing, which differs from how it was when it could be. The
// times keep a fraction of a millisecond, finer than the systems stamp files; stats with whole
// nanoseconds took twice as long over 170,000 files.
const statOf = (path: string): Promise<Stats | Seen> => lstat(path).catch(() => MISSING);

const seen = ({ mode, ino, size, mtimeMs, ctimeMs }: Seen): Seen => ({ mode, ino, size, mtimeMs, ctimeMs });
const same = (a: Seen, b: Seen) => a.ctimeMs === b.ctimeMs && a.mtimeMs === b.mtimeMs && a.size === b.size && a.ino === b.ino && a.mode === b.mode;
const isDirectory = (mode: number) => (mode & 0o170000) === 0o040000;

const namesOf = async (root: string, path: string): Promise<string[]> => {
  try {
    const hidden = HIDDEN_READ.has(path.split("/")[0]!);
    return (await readdir(join(root, path))).filter((name) => hidden || !name.startsWith(".")).sort();
  } catch {
    return ["\0unreadable"];
  }
};

/** Runs `work` over every item, a bounded number at once; `work` may add items. */
async function pool<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let running = 0;
  await new Promise<void>((done, failed) => {
    const fill = () => {
      while (running < AT_ONCE && next < items.length) {
        running++;
        work(items[next++]!).then(() => {
          running--;
          fill();
        }, failed);
      }
      if (running === 0 && next >= items.length) done();
    };
    fill();
  });
}

/** Every input as it is now. */
export async function scanInputs(root: string): Promise<InputScan> {
  const marks = new Map<string, Mark>();
  const queue = [...FILES, ...DIRECTORIES];
  await pool(queue, async (path) => {
    // The names are listed after the directory's times are taken, so a change between the two is seen next time.
    const full = join(root, path);
    const stat = await statOf(full);
    const mark: Mark = { full, stat: seen(stat) };
    marks.set(path, mark);
    if (!isDirectory(stat.mode) || FILES.includes(path)) return;
    const names = await namesOf(root, path);
    mark.names = names.join("\0");
    for (const name of names) if (name !== "\0unreadable") queue.push(`${path}/${name}`);
  });
  return { marks };
}

/**
 * Whether any input differs from the scan. A directory whose times moved but
 * which holds the same names, as after a hidden file came and went, is not a
 * change; its new times are kept in the scan.
 */
export async function inputsChanged(root: string, scan: InputScan): Promise<boolean> {
  let changed = false;
  // Plain loops over one shared iterator, with no copy of the list: over a project of 170,000 files this
  // runs before every answer.
  const marks = scan.marks.entries();
  await Promise.all(Array.from({ length: AT_ONCE }, async () => {
    for (let next = marks.next(); !changed && !next.done; next = marks.next()) {
      const [path, mark] = next.value;
      const now = await statOf(mark.full);
      if (same(now, mark.stat)) continue;
      // Only a directory's times and size may move with nothing changed, as long as it holds the same names.
      if (mark.names === undefined || now.mode !== mark.stat.mode || now.ino !== mark.stat.ino) changed = true;
      else if ((await namesOf(root, path)).join("\0") !== mark.names) changed = true;
      else mark.stat = seen(now);
    }
  }));
  return changed;
}

/** The research files a scan found: the export counts them, and the data identity does not cover them. */
export const researchFiles = (scan: InputScan): string => [...scan.marks.keys()].filter((p) => p.startsWith("research/")).sort().join("\n");

/** Where a research note or a report output can change with the data the same. */
const MAY_NOT_COUNT = /^(research|report)(\/|$)/;

/**
 * Whether the two scans may show the same data, so that its identity is worth
 * computing before building again: the research files are the same set, and no
 * other file outside `research/` and `report/` came, went, or changed size.
 */
export function mayShowTheSame(a: InputScan, b: InputScan): boolean {
  if (researchFiles(a) !== researchFiles(b)) return false;
  const counted = (scan: InputScan) => [...scan.marks].filter(([path]) => !MAY_NOT_COUNT.test(path));
  const before = counted(a);
  return before.length === counted(b).length && before.every(([path, mark]) => {
    const now = b.marks.get(path);
    return now !== undefined && (mark.names !== undefined || now.stat.size === mark.stat.size);
  });
}
