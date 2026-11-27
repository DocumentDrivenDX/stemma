// The offline explorer: the arras graph browser over its static client, in one
// file, with no server and no request. The data is in the page; routing is
// arras's own, in the URL fragment.
import { createRoot } from "react-dom/client";
import { GraphBrowser } from "@documentdrivendx/arras-ui/browser";
import { createStaticClient, GraphLoadError, InvalidDocument, loadStore, staticSchemaApi } from "@documentdrivendx/arras-ui/static";
import type { ManuscriptView } from "../../core/src/manuscript-view.ts";
import type { SourceView } from "../../core/src/source-view.ts";
import type { BannerData } from "../../graph/src/export.ts";
import { Banner } from "./Banner.tsx";
import { foldingClient } from "./client.ts";
import { Manuscript } from "./Manuscript.tsx";
import { manuscriptRouteOf, sourceRouteOf, useHash, useLocationOfBrowser } from "./route.ts";
import { type GetSourceView, SourcePanel } from "./SourcePanel.tsx";

const dataText = (id: string): string => document.getElementById(id)!.textContent!;

/** Names the file and the record at fault, as text. */
function Failure({ error }: { error: unknown }) {
  const lines = error instanceof InvalidDocument ? error.violations.map((v) => `stemma.umf.json at ${v.path}: ${v.message}`)
    : error instanceof GraphLoadError ? error.rejections.map((r) => `stemma.graph.json, ${r.kind} ${r.ident}: ${r.reason}`)
    : [error instanceof Error ? error.message : String(error)];
  return (
    <main className="st:p-4" role="alert">
      <h1>The graph could not be loaded</h1>
      <p>Export again. If it fails again, this is a Stemma defect: report the lines below.</p>
      <ul>{lines.slice(0, 20).map((line, i) => <li key={i}>{line}</li>)}</ul>
    </main>
  );
}

/** The views the export holds, answered by ID. A server would answer the same objects. */
function inlinedViews(): GetSourceView {
  let views: Record<string, SourceView> | undefined;
  return async (id) => {
    views ??= (JSON.parse(dataText("stemma-sourceviews")) as { views: Record<string, SourceView> }).views;
    return Object.hasOwn(views, id) ? views[id] : undefined;
  };
}

/** The record browser, with the open citation's or passage's source beside it, or below it on a narrow screen. */
function Records({ client, getView }: { client: ReturnType<typeof createStaticClient>; getView: GetSourceView }) {
  const [at, onLocation] = useLocationOfBrowser();
  const route = sourceRouteOf(at, "stemma");
  return (
    <div className="stemma-browser">
      <div className="stemma-records">
        <GraphBrowser client={client} schemaApi={staticSchemaApi()} onLocation={onLocation} />
      </div>
      {route ? <SourcePanel key={`${route.type}/${route.id}`} route={route} getView={getView} /> : null}
    </div>
  );
}

/** The record browser, or the manuscript when the export holds a report, with the control that moves between them. */
function Explorer({ client, getView, manuscript }: { client: ReturnType<typeof createStaticClient>; getView: GetSourceView; manuscript: ManuscriptView }) {
  const hash = useHash();
  if (manuscript.state === "none") return <Records client={client} getView={getView} />;
  const route = manuscriptRouteOf(hash);
  return (
    <>
      <nav aria-label="Views" className="stemma-views">
        <a href="#/explore" aria-current={route ? undefined : "page"}>Records</a>
        <a href="#/manuscript" aria-current={route ? "page" : undefined}>Manuscript</a>
      </nav>
      {route ? <Manuscript view={manuscript} route={route} getView={getView} /> : <Records client={client} getView={getView} />}
    </>
  );
}

async function start(): Promise<void> {
  const root = createRoot(document.getElementById("root")!);
  try {
    const banner = JSON.parse(dataText("stemma-banner")) as BannerData;
    const moduleText = dataText("stemma-module");
    const store = await loadStore(moduleText, dataText("stemma-graph"));
    const client = foldingClient(createStaticClient(store, moduleText));
    root.render(
      <div className="stemma-page">
        <Banner data={banner} />
        <Explorer client={client} getView={inlinedViews()} manuscript={JSON.parse(dataText("stemma-manuscript")) as ManuscriptView} />
      </div>,
    );
  } catch (error) {
    root.render(<Failure error={error} />);
  }
}

void start();
