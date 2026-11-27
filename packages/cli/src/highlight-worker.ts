// The process that reads one page of an original to place a highlight
// (CONTRACT-005 M, "Highlighting on originals"). The local server starts one for
// each page, sends it the file's bytes and what to look for, and ends it. It
// opens no listener, gets no secret, makes no request, and writes nothing.
import { locateOnPage } from "../../extract/src/pdf-highlight.ts";
import { noHighlight } from "../../core/src/highlight.ts";
import type { HighlightWork } from "../../server/src/highlighter.ts";

// The memory guard. Reading a small PDF can take gigabytes in about a second
// (images that unpack far larger than the file), and the library unpacks them
// without yielding, so a timer beside it would not run. This looks from a thread
// of its own, and ends the whole process at once.
const GUARD = `onmessage = (event) => {
  const look = () => { if (process.memoryUsage.rss() > event.data) process.kill(process.pid, "SIGKILL"); };
  look();
  setInterval(look, 5);
  postMessage("watching");
};`;

/** Resolves once the guard is looking. A page is never read without it. */
function guard(most: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!(most > 0)) return reject(new Error("no bound"));
    const thread = new Worker(URL.createObjectURL(new Blob([GUARD], { type: "text/javascript" })));
    let watching = false;
    const lost = () => (watching ? process.kill(process.pid, "SIGKILL") : reject(new Error("no guard")));
    thread.addEventListener("error", lost);
    thread.addEventListener("close", lost);
    thread.addEventListener("message", () => {
      watching = true;
      resolve();
    });
    thread.postMessage(most);
  });
}

process.on("disconnect", () => process.exit(0));
process.once("message", (work: HighlightWork) => {
  void guard(work.memory)
    .then(() => locateOnPage(work.bytes, work.target))
    .catch(() => noHighlight("failed"))
    .then((answer) => process.send!(answer));
});
