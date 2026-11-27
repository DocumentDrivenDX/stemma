// Drawing an original with the pinned pdf.js (CONTRACT-005 M, "Originals"). A
// PDF is given as bytes, which have already proved themselves, and only its own
// page content is drawn, on a canvas: nothing in the file is run, no link, form
// or annotation layer is made, no attachment is read, nothing is evaluated,
// WebAssembly is off, and the library fetches nothing itself. Only the served
// page holds this.
//
// The worker is started once, as the page loads, and never again: its script
// loads all the code it will ever need then, while the address still answers as
// the server the page came from.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

/** The most a canvas holds, the most an image may state, and how long a drawing may take. */
export const DRAW_LIMITS = { canvasPixels: 16_000_000, imagePixels: 100_000_000, ms: 60_000 };

export class CannotDraw extends Error {}

const STUCK = "The part of the page that draws PDFs failed or stopped answering. While browse is running, loading the page again starts it afresh.";

export interface PdfPages {
  pageCount: number;
  /** Draws one page, counted from 1, about `width` pixels wide, on the canvas. Ends early when `stop` is aborted. */
  draw(page: number, canvas: HTMLCanvasElement, width: number, stop: AbortSignal): Promise<void>;
  close(): void;
}

export interface PdfEngine {
  /** `data` gives the library's character maps and fonts by name. */
  open(bytes: Uint8Array, data: (name: string) => Promise<Uint8Array>): Promise<PdfPages>;
}

/** The canvas's size for a page or picture of this shape, about `width` wide and within the bound. */
export function canvasSize(across: number, down: number, width: number): { width: number; height: number; scale: number } {
  let scale = width / across;
  if (across * down * scale * scale > DRAW_LIMITS.canvasPixels) scale = Math.sqrt(DRAW_LIMITS.canvasPixels / (across * down));
  return { width: Math.max(1, Math.floor(across * scale)), height: Math.max(1, Math.floor(down * scale)), scale };
}

export function startPdfEngine(script = "/pdf-worker.js"): PdfEngine {
  let broken = false;
  let worker: InstanceType<typeof pdfjs.PDFWorker> | undefined;
  try {
    const port = new Worker(script, { type: "module" });
    port.addEventListener("error", () => (broken = true));
    worker = pdfjs.PDFWorker.create({ port });
  } catch {
    broken = true;
  }
  /** Work that must end in time: after one that does not, the worker cannot be relied on. */
  const timed = <T>(work: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      work,
      new Promise<never>((_, reject) => (timer = setTimeout(() => {
        broken = true;
        reject(new CannotDraw(STUCK));
      }, DRAW_LIMITS.ms))),
    ]).finally(() => clearTimeout(timer));
  };
  return {
    async open(bytes, data) {
      if (broken || !worker) throw new CannotDraw(STUCK);
      /** The library asks through this for what it would otherwise fetch. */
      class ProvedData {
        async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
          const folder = kind === "cMapUrl" ? "cmaps" : kind === "standardFontDataUrl" ? "standard_fonts" : undefined;
          if (!folder) throw new Error(`The page gives the PDF library no ${kind}.`);
          // A copy: the library takes over what it is given.
          return (await data(`${folder}/${filename}`)).slice();
        }
      }
      const task = pdfjs.getDocument({
        // The library takes over the buffer it is given.
        data: bytes.slice(),
        worker,
        // Names only: with no fetching in the worker, they are never made into requests.
        cMapUrl: "cmaps/", cMapPacked: true, standardFontDataUrl: "standard_fonts/",
        // Where the two JavaScript image decoders were loaded from when the worker started.
        wasmUrl: "/pdfjs/",
        BinaryDataFactory: ProvedData,
        useWorkerFetch: false, useWasm: false,
        enableXfa: false,
        disableFontFace: true, useSystemFonts: false,
        disableWorkerRendering: true,
        maxImageSize: DRAW_LIMITS.imagePixels,
        verbosity: pdfjs.VerbosityLevel.ERRORS,
      });
      let document: Awaited<typeof task.promise>;
      try {
        document = await timed(task.promise);
      } catch (error) {
        void task.destroy().catch(() => {});
        if (error instanceof CannotDraw) throw error;
        throw new CannotDraw((error as { name?: string }).name === "PasswordException" ? "The PDF is encrypted and needs a password." : "The PDF library could not read this file as a PDF.");
      }
      return {
        pageCount: document.numPages,
        async draw(number, canvas, width, stop) {
          if (broken) throw new CannotDraw(STUCK);
          try {
            const page = await timed(document.getPage(number));
            const view = page.getViewport({ scale: 1 });
            const size = canvasSize(view.width, view.height, width);
            if (stop.aborted) return;
            canvas.width = size.width;
            canvas.height = size.height;
            // The page's own content only: no annotation is drawn, so no form field or link either.
            const task = page.render({ canvas, viewport: page.getViewport({ scale: size.scale }), annotationMode: pdfjs.AnnotationMode.DISABLE });
            const cancel = () => task.cancel();
            stop.addEventListener("abort", cancel, { once: true });
            try {
              await timed(task.promise);
            } finally {
              stop.removeEventListener("abort", cancel);
            }
          } catch (error) {
            if (stop.aborted) return;
            throw error instanceof CannotDraw ? error : new CannotDraw("The PDF library could not draw this page.");
          }
        },
        close: () => void task.destroy().catch(() => {}),
      };
    },
  };
}

/** The width and height a PNG or JPEG file states, when its bytes begin as that type does. */
export function statedSize(bytes: Uint8Array, type: string): { width: number; height: number } | undefined {
  const two = (at: number) => (bytes[at]! << 8) | bytes[at + 1]!;
  const four = (at: number) => two(at) * 65536 + two(at + 2);
  if (type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 24 || !signature.every((value, i) => bytes[i] === value) || String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") return undefined;
    return { width: four(16), height: four(20) };
  }
  if (type === "image/jpeg") {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
    // Segment by segment until the one that states the frame.
    for (let at = 2; at + 9 < bytes.length; ) {
      if (bytes[at] !== 0xff) return undefined;
      const marker = bytes[at + 1]!;
      if (marker === 0xff) at += 1;
      else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: two(at + 7), height: two(at + 5) };
      else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) at += 2;
      else if (marker === 0xd9 || marker === 0xda) return undefined;
      else at += 2 + two(at + 2);
    }
  }
  return undefined;
}

/** Decodes a page image with the browser's own decoder and draws it on the canvas, with no image address. */
export async function drawImage(bytes: Uint8Array<ArrayBuffer>, type: string, canvas: HTMLCanvasElement, width: number, stop: AbortSignal): Promise<void> {
  const stated = statedSize(bytes, type);
  if (!stated || stated.width < 1 || stated.height < 1) throw new CannotDraw(`The file does not begin as a ${type} image does.`);
  if (stated.width * stated.height > DRAW_LIMITS.imagePixels) throw new CannotDraw(`The image states ${stated.width} by ${stated.height} pixels, more than the page decodes.`);
  const picture = await createImageBitmap(new Blob([bytes], { type })).catch(() => {
    throw new CannotDraw("The browser could not decode the image.");
  });
  try {
    if (stop.aborted) return;
    const size = canvasSize(picture.width, picture.height, Math.min(width, picture.width));
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new CannotDraw("The browser gave no canvas to draw on.");
    context.drawImage(picture, 0, 0, size.width, size.height);
  } finally {
    picture.close();
  }
}
