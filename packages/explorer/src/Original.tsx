// The original page beside the highlighted text (CONTRACT-005 M, "Originals";
// US-121). Which page it is comes from the server, from the record alone; the
// page works out none. Nothing of a file is drawn before its answer has proved
// itself and its SHA-256 is the one asked for. Boxes over the drawing come only
// from the server ("Highlighting on originals"): the page matches no text and
// places nothing. It only checks that each box has something drawn in it, which
// can remove a mark and never add one. An estimate on a scan looks unlike a
// highlight and says in words that it is one.
import { useEffect, useRef, useState } from "react";
import { ESTIMATE_METHODS, type Highlight, noHighlight } from "../../core/src/highlight.ts";
import { drawnIn, markedIn } from "./pixel-check.ts";
import type { OriginalPage } from "../../core/src/original-pages.ts";
import type { PageSegment } from "../../core/src/source-view.ts";
import { CannotDraw, drawImage, type PdfEngine, type PdfPages } from "./pdf-engine.ts";
import { CallFailed, type Read, type Server } from "./remote.ts";
import { Text, useLoaded } from "./SourcePanel.tsx";

type Reason = "physical" | "unsupported_type" | "no_page_mapping" | "not_held" | "changed" | "too_large" | "not_drawn" | "failed";

const TITLES: Record<Reason, string> = {
  physical: "A physical original",
  unsupported_type: "Unsupported type",
  no_page_mapping: "No page mapping",
  not_held: "Not held",
  changed: "Digest mismatch",
  too_large: "Too large",
  not_drawn: "It could not be drawn",
  failed: "It could not be asked for",
};

/** The server's refusals of `/original`, as the page's reasons. */
const REFUSALS: Record<string, Reason> = {
  original_not_held: "not_held", original_changed: "changed", original_too_large: "too_large", original_unsupported: "unsupported_type",
};

class NotShown extends Error {
  constructor(readonly reason: Reason, why: string) {
    super(why);
  }
}

type Shown = {
  why?: undefined;
  label: string;
  draw(canvas: HTMLCanvasElement, width: number, stop: AbortSignal): Promise<void>;
  /** Where the server places this passage's words on what is drawn, or why it places none. */
  highlight(passage: string, index: number): Promise<Highlight>;
};
type Found = Shown | { reason: Reason; why: string };

/** The files and PDFs kept at once, so that two pages of one original are not asked for twice. */
const KEPT = 2;

export interface OriginalSource {
  find(text: string, index: number): Promise<Found>;
  /** Lets go of every file held. */
  close(): void;
}

/** Keeps the latest few of what `make` gives, by key. What is let go is told to `drop`. A failure is not kept. */
function recent<T>(make: (key: string) => Promise<T>, drop: (value: T) => void = () => {}) {
  const held = new Map<string, Promise<T>>();
  const forget = (key: string) => {
    const old = held.get(key);
    held.delete(key);
    void old?.then(drop, () => {});
  };
  return {
    get(key: string): Promise<T> {
      const found = held.get(key) ?? make(key);
      held.delete(key);
      held.set(key, found);
      found.catch(() => held.get(key) === found && held.delete(key));
      while (held.size > KEPT) forget(held.keys().next().value!);
      return found;
    },
    clear: () => [...held.keys()].forEach(forget),
  };
}

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

export function originalSource(server: Server, read: Read, engine: PdfEngine, lost: (error: CallFailed) => void): OriginalSource {
  const told = async <T,>(call: Promise<T>): Promise<T> => {
    try {
      return await call;
    } catch (error) {
      if (error instanceof CallFailed && error.trouble !== "failed") lost(error);
      throw error;
    }
  };
  const files = recent(async (sha256: string) => {
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = await told(server.bytes("/original", { sha256 }));
    } catch (error) {
      const reason = error instanceof CallFailed && error.code !== undefined ? REFUSALS[error.code] : undefined;
      if (!reason) throw error;
      throw new NotShown(reason, (error as Error).message.replace(/^[a-z_]+: /, ""));
    }
    // The proof shows that the server sent these bytes; this, that they are the file the record names.
    if (hex(await crypto.subtle.digest("SHA-256", bytes)) !== sha256) throw new NotShown("changed", "What arrived does not have the recorded SHA-256, so it is not drawn.");
    return bytes;
  });
  const libraryData = new Map<string, Promise<Uint8Array>>();
  const data = (name: string): Promise<Uint8Array> => {
    let found = libraryData.get(name);
    if (!found) {
      libraryData.set(name, (found = told(server.bytes("/pdfjs-data", { name }))));
      found.catch(() => libraryData.delete(name));
    }
    return found;
  };
  const pdfs = recent<PdfPages>(async (sha256) => engine.open(await files.get(sha256), data), (pdf) => pdf.close());

  const shown = async (place: Exclude<OriginalPage, { state: "none" }>, index: number): Promise<Shown> => {
    if (place.state === "image") {
      const bytes = await files.get(place.sha256);
      return {
        label: `Page image of page index ${index}`,
        draw: (canvas, width, stop) => drawImage(bytes, place.media_type, canvas, width, stop),
        highlight: async () => noHighlight("page_image"),
      };
    }
    const pdf = await pdfs.get(place.sha256);
    if (pdf.pageCount !== place.page_count) {
      throw new NotShown("no_page_mapping", `The PDF has ${pdf.pageCount} pages and the source file records ${place.page_count}, so its page numbers cannot be relied on.`);
    }
    return {
      label: `Page ${place.page} of ${place.page_count} of the PDF`,
      // Looked up again, since a PDF may have been let go in the meantime.
      draw: async (canvas, width, stop) => (await pdfs.get(place.sha256)).draw(place.page, canvas, width, stop),
      highlight: async (passage, at) => {
        const made = await read<Highlight>("/api/original-highlight", { passage, index: at });
        // Boxes are for one page of one file, and go over a drawing of that and no other.
        return made.state !== "none" && (made.sha256 !== place.sha256 || made.page !== place.page || made.page_count !== place.page_count)
          ? noHighlight("failed") : made;
      },
    };
  };

  return {
    async find(text, index) {
      try {
        const place = await read<OriginalPage | null>("/api/original-page", { text, index });
        if (!place) return { reason: "no_page_mapping", why: "The source file is not one in effect that can be used." };
        if (place.state === "none") return { reason: place.reason, why: place.why };
        return await shown(place, index);
      } catch (error) {
        if (error instanceof NotShown) return { reason: error.reason, why: error.message };
        if (error instanceof CannotDraw) return { reason: "not_drawn", why: error.message };
        return { reason: "failed", why: String(error) };
      }
    },
    close() {
      pdfs.clear();
      files.clear();
      libraryData.clear();
    },
  };
}

const How = ({ reason }: { reason: Reason }) => (
  reason === "not_held" || reason === "changed"
    ? <p>To show it, put the recorded file where Stemma looks: stop <code>browse</code> and start it again with <code>--originals</code> and the folder that holds your originals, or ask your assistant to. No web address is fetched.</p>
    : null
);

function Missing({ reason, why }: { reason: Reason; why: string }) {
  return (
    <div role="note" className="st:border st:border-slate-500 st:bg-slate-50 st:p-2" data-original={reason}>
      <p><strong>Original not shown: {TITLES[reason]}.</strong></p>
      <p><Text value={why} /></p>
      <How reason={reason} />
      <p>The converted text with its highlight is what is shown.</p>
    </div>
  );
}

/** How many pixels wide a page is drawn: enough to be read when made larger. */
const DRAWN_WIDTH = 1800;

function Marking({ marked }: { marked: Highlight | undefined }) {
  if (!marked) {
    return <p className="stemma-unmarked" role="status">Asking where the quoted words lie on the original. Nothing is marked on it yet.</p>;
  }
  if (marked.state === "boxes") {
    return (
      <p className="stemma-marked">
        <strong>Highlighted on the original.</strong> The boxes are positions from the PDF’s text layer. Stemma read this page again, found its text equal to the source text, and found glyphs drawn there that the file’s text layer names as those letters, with nothing it checks for over or under them. It cannot tell whether the printed shapes are those letters, so read them. Its file’s SHA-256 is the recorded one.
      </p>
    );
  }
  if (marked.state === "estimate") {
    return (
      <p className="stemma-estimated" data-method={marked.method}>
        <strong>Approximate highlight: an estimated place on a page read as a scan.</strong> {ESTIMATE_METHODS[marked.method]} Nothing checks that the dashed boxes lie on the printed words, or that the page says these words. It is not a check of the quotation: read the page. Its file’s SHA-256 is the recorded one.
      </p>
    );
  }
  return (
    <p className="stemma-unmarked" data-reason={marked.reason}>
      <strong>The original is not highlighted.</strong> <Text value={marked.why} /> The highlighted words are in the converted text. Its file’s SHA-256 is the recorded one.
    </p>
  );
}

function Drawing({ found, name, passage, index }: { found: Shown; name: string; passage: string; index: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"drawing" | "drawn" | { why: string }>("drawing");
  const [marked, setMarked] = useState<Highlight>();
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const stop = new AbortController();
    found.draw(canvas.current!, DRAWN_WIDTH, stop.signal).then(
      () => !stop.signal.aborted && setState("drawn"),
      (error: unknown) => !stop.signal.aborted && setState({ why: error instanceof CannotDraw ? error.message : String(error) }),
    );
    return () => stop.abort();
  }, [found]);
  useEffect(() => {
    if (state !== "drawn") return;
    let current = true;
    found.highlight(passage, index).then(
      (made) => current && setMarked(made.state !== "none" && !(made.state === "estimate" ? markedIn : drawnIn)(canvas.current!, made.boxes) ? noHighlight("pixels_disagree") : made),
      () => current && setMarked(noHighlight("not_asked")),
    );
    return () => {
      current = false;
    };
  }, [found, state, passage, index]);
  const boxes = state === "drawn" && marked && marked.state !== "none" ? marked.boxes : [];
  const estimated = marked?.state === "estimate";
  const marking = boxes.length === 0 ? "nothing marked on it" : estimated ? "dashed boxes estimating where the quoted words are" : "boxes marking the quoted words";
  // The first box is brought into the sheet's view without moving what is around it.
  useEffect(() => {
    const view = sheet.current;
    const first = view?.querySelector(".stemma-box, .stemma-estimate");
    if (view && first) view.scrollTop += first.getBoundingClientRect().top - view.getBoundingClientRect().top - view.clientHeight / 3;
  }, [boxes.length > 0, large]);
  if (typeof state === "object") return <Missing reason="not_drawn" why={state.why} />;
  const percent = (part: number) => `${part * 100}%`;
  return (
    <figure className="st:m-0" data-original={state} data-highlight={marked ? (marked.state === "none" ? marked.reason : marked.state) : "asking"}>
      <figcaption>
        <p><strong>Original: {found.label}.</strong> <button type="button" className="stemma-zoom" aria-pressed={large} onClick={() => setLarge(!large)}>Larger</button></p>
        <Marking marked={state === "drawn" ? marked : undefined} />
      </figcaption>
      {state === "drawing" ? <p role="status">Drawing the page.</p> : null}
      <div ref={sheet} className="stemma-sheet" tabIndex={0} role="region" aria-label={`${name}, scrollable`}>
        <div className="stemma-leaf" style={{ width: large ? "200%" : "100%" }}>
          <canvas ref={canvas} role="img" aria-label={`${name}: ${found.label}, drawn as it is, with ${marking}`} style={{ width: "100%" }} />
          {/* Laid over the drawing: the drawing itself is never changed. */}
          {boxes.map((box, i) => (
            <div key={i} className={estimated ? "stemma-estimate" : "stemma-box"} aria-hidden="true" style={{ left: percent(box.left), top: percent(box.top), width: percent(box.width), height: percent(box.height) }} />
          ))}
        </div>
      </div>
    </figure>
  );
}

/** The original of the page one segment of a passage lies on. */
export function Original({ source, passage, text, segment }: { source: OriginalSource; passage: string; text: string; segment: PageSegment }) {
  const found = useLoaded<Found>(`${text}/${segment.index}`, () => source.find(text, segment.index), (why) => ({ reason: "failed", why }));
  return (
    <section className="stemma-original" aria-label={`The original of ${segment.place}`}>
      {!found ? <p role="status">Asking for the original.</p> : found.why !== undefined ? <Missing reason={found.reason} why={found.why} />
        : <Drawing key={`${passage}/${segment.index}`} found={found} passage={passage} index={segment.index} name={`The original of ${segment.place}`} />}
      <p className="st:text-slate-600">Only the page’s own content is drawn: no annotation, form field or link, and nothing in the file is run.</p>
    </section>
  );
}
