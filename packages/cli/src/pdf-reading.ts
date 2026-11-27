// Reads an original PDF in a process of its own (CONTRACT-002 B, "Reading a
// PDF"). The process ends itself past a bound on its memory, so this one can
// still say which file and which limit, and write nothing for it.
import type { PdfLimits, PdfProblem, PdfText } from "@stemma/extract";

/**
 * What the process is sent. `memory` is the resident bytes at which it ends
 * itself. With `loadedBefore`, what the PDF library prints while it loads has
 * been printed by an earlier reading of this command, and is not printed again.
 */
export interface ReadWork { bytes: Uint8Array; limits: PdfLimits; memory: number; loadedBefore?: boolean }

export type ReadReply = { text: PdfText } | { problem: PdfProblem | "too_much_memory" } | { failed: string };

/** How long past the reading's own time limit, which it looks at between pages, the process is ended. */
const GRACE_MS = 10_000;

let readBefore = false;

export function readInOwnProcess(command: string[], given: ReadWork): Promise<ReadReply> {
  const work: ReadWork = { loadedBefore: readBefore, ...given };
  readBefore = true;
  return new Promise((resolve) => {
    let reply: ReadReply | undefined;
    let late = false;
    // Whether this side ended it. One killed otherwise was ended by its memory guard, or by the system.
    let ended = false;
    const end = () => {
      ended = true;
      child.kill("SIGKILL");
    };
    const child = Bun.spawn(command, {
      // What the PDF library prints goes where this command's own output goes.
      stdin: "ignore", stdout: "inherit", stderr: "inherit", serialization: "advanced",
      ipc(message: ReadReply) {
        reply = message;
        end();
      },
      onExit(done) {
        clearTimeout(timer);
        resolve(reply ?? (late ? { problem: "too_slow" }
          : !ended && done.signalCode === "SIGKILL" ? { problem: "too_much_memory" }
            : { failed: `The process reading the PDF ended without an answer (${done.signalCode ?? `exit ${done.exitCode}`}).` }));
      },
    });
    const timer = setTimeout(() => {
      late = true;
      end();
    }, work.limits.milliseconds + GRACE_MS);
    try {
      child.send(work);
    } catch {
      end();
    }
  });
}
