// The offline explorer: the arras graph browser over its static client, in one
// file, with no server and no request. The data is in the page; routing is
// arras's own, in the URL fragment.
import { createRoot } from "react-dom/client";
import { createStaticClient, GraphLoadError, InvalidDocument, loadStore, staticSchemaApi } from "@documentdrivendx/arras-ui/static";
import type { ManuscriptView } from "../../core/src/manuscript-view.ts";
import type { SourceView } from "../../core/src/source-view.ts";
import type { BannerData } from "../../graph/src/export.ts";
import { Explorer } from "./app.tsx";
import { Banner } from "./Banner.tsx";
import { foldingClient } from "./client.ts";
import { Manuscript } from "./Manuscript.tsx";
import type { GetSourceView } from "./SourcePanel.tsx";

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

async function start(): Promise<void> {
  const root = createRoot(document.getElementById("root")!);
  try {
    const banner = JSON.parse(dataText("stemma-banner")) as BannerData;
    const moduleText = dataText("stemma-module");
    const store = await loadStore(moduleText, dataText("stemma-graph"));
    const client = foldingClient(createStaticClient(store, moduleText));
    const schemaApi = staticSchemaApi();
    const getView = inlinedViews();
    const manuscript = JSON.parse(dataText("stemma-manuscript")) as ManuscriptView;
    root.render(
      <div className="stemma-page">
        <Banner data={banner} />
        <Explorer client={client} schemaApi={schemaApi} getView={getView}
          manuscript={manuscript.state === "none" ? undefined : (route) => <Manuscript view={manuscript} route={route} getView={getView} />} />
      </div>,
    );
  } catch (error) {
    root.render(<Failure error={error} />);
  }
}

void start();
