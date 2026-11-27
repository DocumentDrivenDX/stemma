// The original page beside the highlighted text (CONTRACT-005 M, "Originals";
// US-121). Which page it is comes from the server, from the record alone; the
// page works out none. Nothing of a file is drawn before its answer has proved
// itself and its SHA-256 is the one asked for. The original is never marked.
import { useEffect, useRef, useState } from "react";
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

type Shown = { why?: undefined; label: string; draw(canvas: HTMLCanvasElement, width: number, stop: AbortSignal): Promise<void> };
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
      return { label: `Page image of page index ${index}`, draw: (canvas, width, stop) => drawImage(bytes, place.media_type, canvas, width, stop) };
    }
    const pdf = await pdfs.get(place.sha256);
    if (pdf.pageCount !== place.page_count) {
      throw new NotShown("no_page_mapping", `The PDF has ${pdf.pageCount} pages and the source file records ${place.page_count}, so its page numbers cannot be relied on.`);
    }
    return {
      label: `Page ${place.page} of ${place.page_count} of the PDF`,
      // Looked up again, since a PDF may have been let go in the meantime.
      draw: async (canvas, width, stop) => (await pdfs.get(place.sha256)).draw(place.page, canvas, width, stop),
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

function Drawing({ found, name }: { found: Shown; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"drawing" | "drawn" | { why: string }>("drawing");
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const stop = new AbortController();
    found.draw(canvas.current!, DRAWN_WIDTH, stop.signal).then(
      () => !stop.signal.aborted && setState("drawn"),
      (error: unknown) => !stop.signal.aborted && setState({ why: error instanceof CannotDraw ? error.message : String(error) }),
    );
    return () => stop.abort();
  }, [found]);
  if (typeof state === "object") return <Missing reason="not_drawn" why={state.why} />;
  return (
    <figure className="st:m-0" data-original={state}>
      <figcaption>
        <p><strong>Original: {found.label}.</strong> <button type="button" className="stemma-zoom" aria-pressed={large} onClick={() => setLarge(!large)}>Larger</button></p>
        <p className="stemma-unmarked"><strong>The original is not highlighted.</strong> Nothing is marked on it: the highlighted words are in the converted text. Its file’s SHA-256 is the recorded one.</p>
      </figcaption>
      {state === "drawing" ? <p role="status">Drawing the page.</p> : null}
      <div className="stemma-sheet" tabIndex={0} role="region" aria-label={`${name}, scrollable`}>
        <canvas ref={canvas} role="img" aria-label={`${name}: ${found.label}, drawn as it is, with nothing marked on it`} style={{ width: large ? "200%" : "100%" }} />
      </div>
    </figure>
  );
}

/** The original of the page one segment of a passage lies on. */
export function Original({ source, text, segment }: { source: OriginalSource; text: string; segment: PageSegment }) {
  const found = useLoaded<Found>(`${text}/${segment.index}`, () => source.find(text, segment.index), (why) => ({ reason: "failed", why }));
  return (
    <section className="stemma-original" aria-label={`The original of ${segment.place}`}>
      {!found ? <p role="status">Asking for the original.</p> : found.why !== undefined ? <Missing reason={found.reason} why={found.why} /> : <Drawing found={found} name={`The original of ${segment.place}`} />}
      <p className="st:text-slate-600">Only the page’s own content is drawn: no annotation, form field or link, and nothing in the file is run.</p>
    </section>
  );
}
