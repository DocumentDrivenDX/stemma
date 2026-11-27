// A stat scan of the files a served snapshot is made from (CONTRACT-005 M,
// "Freshness"). It lists them as `readProject` does and reads no file content:
// for each, its kind, size, inode, and modification and change times; for each
// directory, the names in it.
import { type BigIntStats } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

/** Files at the top of the project that are read when present. */
const FILES = ["stemma.json", "rules.md"];
/** Directories read whole. `report/` may name a template that begins with a dot, so nothing there is skipped. */
const DIRECTORIES = ["records", "sources", "manuscript", "research", "report"];
const HIDDEN_READ = new Set(["report"]);
const AT_ONCE = 64;

interface Mark {
  stat: string;
  /** For a directory, its times and the names read from it. */
  names?: string;
}

export interface InputScan {
  marks: Map<string, Mark>;
}

// Whatever cannot be looked at counts as missing, which differs from how it was when it could be.
const statOf = (path: string): Promise<BigIntStats | undefined> => lstat(path, { bigint: true }).catch(() => undefined);

const signature = (stat: BigIntStats | undefined): string =>
  stat === undefined ? "missing" : `${stat.mode}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;

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
    const stat = await statOf(join(root, path));
    const mark: Mark = { stat: signature(stat) };
    marks.set(path, mark);
    if (!stat?.isDirectory() || FILES.includes(path)) return;
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
  await pool([...scan.marks], async ([path, mark]) => {
    if (changed) return;
    const stat = await statOf(join(root, path));
    const now = signature(stat);
    if (now === mark.stat) return;
    if (mark.names === undefined || !stat?.isDirectory() || now.split(":").slice(0, 2).join(":") !== mark.stat.split(":").slice(0, 2).join(":")) {
      changed = true;
      return;
    }
    if ((await namesOf(root, path)).join("\0") !== mark.names) changed = true;
    else mark.stat = now;
  });
  return changed;
}

/** The research files a scan found: the export counts them, and the data identity does not cover them. */
export const researchFiles = (scan: InputScan): string => [...scan.marks.keys()].filter((p) => p.startsWith("research/")).sort().join("\n");
