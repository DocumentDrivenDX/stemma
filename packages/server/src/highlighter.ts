// The reading of a page of an original to place a highlight (CONTRACT-005 M,
// "Highlighting on originals", "Bounds"). A PDF is a file from outside, so each
// page is read in a process of its own, which gets the bytes and what to look
// for, no secret, and no listener, and is ended once it answers or takes too
// long. One runs at a time and few wait. Nothing is kept.
import { createHash } from "node:crypto";
import { type Highlight, type HighlightTarget, noHighlight } from "../../core/src/highlight.ts";

export const HIGHLIGHT_LIMITS = { ms: 20_000, waiting: 8 };

export type LoadedOriginal = { bytes: Buffer; release(): void } | { refused: "original_not_held" | "original_changed" };

export interface Highlighter {
  /** `load` is called when this one's turn has come; `gone` says that nobody waits for the answer any more. */
  place(target: HighlightTarget, load: () => Promise<LoadedOriginal>, gone?: () => boolean): Promise<Highlight>;
  /** Ends the process that is reading, and any that waits gets no box. */
  close(): void;
}

/** What the process is sent. */
export interface HighlightWork { target: HighlightTarget; bytes: Uint8Array }

export function createHighlighter(command: string[], limits: Partial<typeof HIGHLIGHT_LIMITS> = {}): Highlighter {
  const bounds = { ...HIGHLIGHT_LIMITS, ...limits };
  let last: Promise<unknown> = Promise.resolve();
  let inLine = 0;
  let closed = false;
  let stop: (() => void) | undefined;

  const read = (work: HighlightWork) => new Promise<Highlight>((resolve) => {
    let answer: Highlight | undefined;
    let late = false;
    const child = Bun.spawn(command, {
      // What the PDF library prints could quote the file, so it goes nowhere.
      stdin: "ignore", stdout: "ignore", stderr: "ignore", serialization: "advanced",
      ipc(reply: Highlight) {
        answer = reply;
        child.kill("SIGKILL");
      },
      onExit() {
        clearTimeout(timer);
        stop = undefined;
        resolve(answer ?? noHighlight(late ? "too_slow" : "failed"));
      },
    });
    const timer = setTimeout(() => {
      late = true;
      child.kill("SIGKILL");
    }, bounds.ms);
    stop = () => child.kill("SIGKILL");
    try {
      child.send(work);
    } catch {
      child.kill("SIGKILL");
    }
  });

  const turn = async (target: HighlightTarget, load: () => Promise<LoadedOriginal>, gone: () => boolean): Promise<Highlight> => {
    if (closed || gone()) return noHighlight("failed");
    const found = await load();
    if ("refused" in found) return noHighlight(found.refused === "original_changed" ? "changed" : "not_held");
    try {
      // The bytes read for this must be the recorded ones, whoever gave them.
      if (createHash("sha256").update(found.bytes).digest("hex") !== target.sha256) return noHighlight("changed");
      return closed ? noHighlight("failed") : await read({ target, bytes: found.bytes });
    } finally {
      found.release();
    }
  };

  return {
    async place(target, load, gone = () => false) {
      if (inLine > bounds.waiting) return noHighlight("busy");
      inLine++;
      const mine = last.then(() => turn(target, load, gone)).catch(() => noHighlight("failed"));
      last = mine;
      try {
        return await mine;
      } finally {
        inLine--;
      }
    },
    close() {
      closed = true;
      stop?.();
    },
  };
}
