// The explorer as Stemma serves it on the author's computer (CONTRACT-005 M):
// the same record browser, source panel and manuscript as the offline page,
// reading from the server. What is on the screen is taken down as soon as it can
// no longer be said to be current.
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ManuscriptView } from "../../core/src/manuscript-view.ts";
import type { PageSegment, SourceView } from "../../core/src/source-view.ts";
import type { BannerData } from "../../graph/src/export.ts";
import { Explorer } from "./app.tsx";
import { Banner } from "./Banner.tsx";
import { foldingClient } from "./client.ts";
import { Manuscript } from "./Manuscript.tsx";
import { Original, originalSource } from "./Original.tsx";
import { type PdfEngine, startPdfEngine } from "./pdf-engine.ts";
import { SearchView } from "./Search.tsx";
import { CallFailed, isSearch, noSchemaApi, type Read, readsOf, type Redemption, remoteClient, Server, takeCode } from "./remote.ts";
import type { ManuscriptRoute, SearchRoute } from "./route.ts";
import { type GetSourceView, Served, ShowOriginal, Text, useLoaded } from "./SourcePanel.tsx";

/** How often the page asks whether its data is still current, shown or hidden. */
const POLL_MS = 2000;
const HIDDEN_POLL_MS = 30_000;
/** Longer than this without a confirmation, and the data is covered until one comes. */
const CONFIRMED_MS = 8000;

interface Loaded {
  identity: string;
  number: number;
  banner: BannerData;
  manuscript: boolean;
}

type Phase =
  | { kind: "opening" }
  | { kind: "locked" }
  | { kind: "code_used" }
  | { kind: "code_expired" }
  | { kind: "stopped" }
  | { kind: "waiting" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; loaded: Loaded };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="st:p-4">
      <div role="status" aria-live="polite">
        <h1 className="st:text-lg st:font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

const NOTICES = {
  opening: <Notice title="Opening"><p>Reading from Stemma on this computer.</p></Notice>,
  locked: (
    <Notice title="This tab has no access">
      <p>The explorer opens only from the one-time file that Stemma’s <code>browse</code> command makes. This tab was not given its link.</p>
      <p>Stop the command and run it again, or ask your assistant to.</p>
    </Notice>
  ),
  code_used: (
    <Notice title="Another page or program opened this link first">
      <p>Stemma’s link works once, and something had already opened it when this page tried, so this page has no access.</p>
      <p>Unless that was you, in another tab or window, another program on this computer may have used the link and be reading your records now. Stop the <code>browse</code> command, or ask your assistant to, before you run it again. The command’s output says when the link was opened.</p>
    </Notice>
  ),
  code_expired: (
    <Notice title="This link has expired">
      <p>Stemma’s link works within 10 minutes of the command’s start, and nothing opened it in that time.</p>
      <p>Stop the <code>browse</code> command and run it again, or ask your assistant to.</p>
    </Notice>
  ),
  stopped: (
    <Notice title="Stemma’s server has stopped">
      <p>It cannot be reached, or what answered could not prove that it is Stemma, so what it showed is taken down. Close this tab and do not reload it: another program could answer at its address.</p>
      <p>Run <code>browse</code> again, or ask your assistant to, and use the page it opens.</p>
    </Notice>
  ),
  waiting: (
    <Notice title="The records changed">
      <p>Stemma is reading your files again. Nothing from before the change is shown. This page loads the new data by itself.</p>
    </Notice>
  ),
};

function ServedManuscript({ read, route, getView }: { read: Read; route: ManuscriptRoute; getView: GetSourceView }) {
  const found = useLoaded<{ view?: ManuscriptView; failed?: string }>(
    "manuscript",
    async () => ({ view: await read<ManuscriptView>("/api/manuscript", {}) }),
    (failed) => ({ failed }),
  );
  if (found?.view) return <Manuscript view={found.view} route={route} getView={getView} />;
  return <main className="st:p-4">{found?.failed === undefined ? <p>Loading.</p> : <p role="alert">The manuscript could not be read: <Text value={found.failed} /></p>}</main>;
}

/** One snapshot's pages. Give it a key of its number, so that nothing of another stays. */
function Ready({ server, loaded, lost, pdf }: { server: Server; loaded: Loaded; lost(error: CallFailed): void; pdf: PdfEngine }) {
  const lostNow = useRef(lost);
  lostNow.current = lost;
  const made = useMemo(() => {
    const read = readsOf(server, loaded.identity, (error) => lostNow.current(error));
    const getView: GetSourceView = async (id) => (await read<SourceView | null>("/api/source-view", { id })) ?? undefined;
    const folding = foldingClient(remoteClient(read));
    // What was last typed in the record browser's search box, for the Search view to start with.
    let typed = "";
    const client: typeof folding = {
      ...folding,
      moduleQuery: (module, query, variables) => {
        const text = (variables as { text?: unknown } | undefined)?.text;
        if (isSearch(query) && typeof text === "string") typed = text;
        return folding.moduleQuery(module, query, variables);
      },
    };
    const originals = originalSource(server, read, pdf, (error) => lostNow.current(error));
    return {
      read, getView, client, originals, search: { view: (route: SearchRoute) => <SearchView read={read} route={route} />, last: () => typed },
      showOriginal: (passage: string, text: string, segment: PageSegment) => <Original source={originals} passage={passage} text={text} segment={segment} />,
    };
  }, []);
  // What was held of this data's originals is let go with it.
  useEffect(() => () => made.originals.close(), []);
  return (
    <ShowOriginal value={made.showOriginal}>
      <div className="stemma-page">
        <Banner data={loaded.banner} served />
        <Explorer client={made.client} schemaApi={noSchemaApi} getView={made.getView} search={made.search}
          manuscript={loaded.manuscript ? (route) => <ServedManuscript read={made.read} route={route} getView={made.getView} /> : undefined} />
      </div>
    </ShowOriginal>
  );
}

function App({ server, code, pdf }: { server: Server; code: Promise<Redemption | undefined>; pdf: PdfEngine }) {
  const [phase, setPhase] = useState<Phase>({ kind: "opening" });
  const [covered, setCovered] = useState(false);
  const lost = useRef<(error: CallFailed) => void>(() => {});

  useEffect(() => {
    let over = false;
    let timer: ReturnType<typeof setTimeout>;
    let running = false;
    let again = false;
    let loaded: Loaded | undefined;
    /** Counts every time what was loaded is given up, so that nothing begun before is put back. */
    let era = 0;
    let number = 0;
    let confirmed = Date.now();

    const drop = (next: Phase) => {
      loaded = undefined;
      era++;
      setPhase(next);
    };
    const finish = (kind: "locked" | "stopped" | "code_used" | "code_expired") => {
      // The first reason stands: a later call's does not replace it.
      if (over) return;
      over = true;
      clearTimeout(timer);
      drop({ kind });
    };
    const end = (error: unknown) => {
      if (error instanceof CallFailed && (error.trouble === "locked" || error.trouble === "stopped")) {
        finish(error.trouble);
        return true;
      }
      return false;
    };
    const confirm = () => {
      confirmed = Date.now();
      setCovered(false);
    };

    const tick = async () => {
      if (over) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      clearTimeout(timer);
      try {
        const status = await server.status();
        if (over) return;
        if (status.state === "failed") drop({ kind: "failed", message: status.message ?? "" });
        else if (status.state !== "current" || status.data_identity === undefined) drop({ kind: "waiting" });
        else if (loaded?.identity !== status.data_identity) {
          if (loaded) drop({ kind: "waiting" });
          const began = era;
          const identity = status.data_identity;
          const boot = await readsOf(server, identity, () => {})<{ banner: BannerData; manuscript_state: string }>("/api/boot", {});
          if (era === began && !over) {
            loaded = { identity, number: ++number, banner: boot.banner, manuscript: boot.manuscript_state !== "none" };
            confirm();
            setPhase({ kind: "ready", loaded });
          }
        } else confirm();
      } catch (error) {
        if (!end(error)) {
          if (error instanceof CallFailed && error.trouble === "stale") drop({ kind: "waiting" });
          else drop({ kind: "failed", message: String(error) });
        }
      } finally {
        running = false;
        if (!over) {
          const soon = again;
          again = false;
          timer = setTimeout(() => void tick(), soon ? 0 : document.visibilityState === "hidden" ? HIDDEN_POLL_MS : POLL_MS);
        }
      }
    };

    lost.current = (error) => {
      if (end(error) || over) return;
      drop({ kind: "waiting" });
      void tick();
    };
    // A page coming back into view may have gone long without asking.
    const watch = () => {
      if (document.visibilityState === "visible" && Date.now() - confirmed > CONFIRMED_MS) setCovered(true);
    };
    const shown = () => {
      watch();
      if (document.visibilityState === "visible") void tick();
    };
    const watching = setInterval(watch, 1000);
    document.addEventListener("visibilitychange", shown);
    void (async () => {
      try {
        const redeemed = await code;
        if (server.open) await tick();
        else finish(redeemed === undefined || redeemed === "opened" ? "locked" : redeemed);
      } catch (error) {
        end(error);
      }
    })();
    return () => {
      over = true;
      clearTimeout(timer);
      clearInterval(watching);
      document.removeEventListener("visibilitychange", shown);
    };
  }, []);

  if (phase.kind === "failed") {
    return (
      <Notice title="The project cannot be read, so nothing is shown">
        <p className="st:whitespace-pre-wrap"><Text value={phase.message} /></p>
        <p>When the files change, Stemma reads them again.</p>
      </Notice>
    );
  }
  if (phase.kind !== "ready") return NOTICES[phase.kind];
  return (
    <>
      {covered ? <Notice title="Checking that this is current"><p>The page has not heard from Stemma for a while, so what it showed is covered until it has.</p></Notice> : null}
      <div hidden={covered}>
        <Ready key={phase.loaded.number} server={server} loaded={phase.loaded} lost={(error) => lost.current(error)} pdf={pdf} />
      </div>
    </>
  );
}

// The code leaves the address before arras reads it, and before anything else happens.
const given = takeCode();
const server = new Server();
const exchanged = given === undefined ? Promise.resolve(undefined) : server.exchange(given);
// Started now, so that all of its code is loaded with the page's own (CONTRACT-005 M, "Originals").
const pdf = startPdfEngine();

createRoot(document.getElementById("root")!).render(<Served value={true}><App server={server} code={exchanged} pdf={pdf} /></Served>);
