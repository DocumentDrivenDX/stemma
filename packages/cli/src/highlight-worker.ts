// The process that reads one page of an original to place a highlight
// (CONTRACT-005 M, "Highlighting on originals"). The local server starts one for
// each page, sends it the file's bytes and what to look for, and ends it. It
// opens no listener, gets no secret, makes no request, and writes nothing.
import { locateOnPage } from "../../extract/src/pdf-highlight.ts";
import { noHighlight } from "../../core/src/highlight.ts";
import type { HighlightWork } from "../../server/src/highlighter.ts";

process.on("disconnect", () => process.exit(0));
process.once("message", (work: HighlightWork) => {
  void locateOnPage(work.bytes, work.target)
    .catch(() => noHighlight("failed"))
    .then((answer) => process.send!(answer));
});
