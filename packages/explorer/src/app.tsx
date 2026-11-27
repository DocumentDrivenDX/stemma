// What the offline page and the served page share: the record browser with the
// open record's source beside it, and the move between it and the manuscript.
// How data reaches them is each page's own.
import type { ReactNode } from "react";
import { GraphBrowser } from "@documentdrivendx/arras-ui/browser";
import type { ArrasClient, SchemaApi } from "./arras-types.ts";
import { type ManuscriptRoute, manuscriptRouteOf, sourceRouteOf, useHash, useLocationOfBrowser } from "./route.ts";
import { type GetSourceView, SourcePanel } from "./SourcePanel.tsx";

export interface BrowserData {
  client: ArrasClient;
  schemaApi: SchemaApi;
  getView: GetSourceView;
}

/** The record browser, with the open citation's or passage's source beside it, or below it on a narrow screen. */
function Records({ client, schemaApi, getView }: BrowserData) {
  const [at, onLocation] = useLocationOfBrowser();
  const route = sourceRouteOf(at, "stemma");
  return (
    <div className="stemma-browser">
      <div className="stemma-records">
        <GraphBrowser client={client} schemaApi={schemaApi} onLocation={onLocation} />
      </div>
      {route ? <SourcePanel key={`${route.type}/${route.id}`} route={route} getView={getView} /> : null}
    </div>
  );
}

/** The record browser, or the manuscript when the project has a report, with the control that moves between them. */
export function Explorer({ manuscript, ...records }: BrowserData & { manuscript: ((route: ManuscriptRoute) => ReactNode) | undefined }) {
  const hash = useHash();
  if (!manuscript) return <Records {...records} />;
  const route = manuscriptRouteOf(hash);
  return (
    <>
      <nav aria-label="Views" className="stemma-views">
        <a href="#/explore" aria-current={route ? undefined : "page"}>Records</a>
        <a href="#/manuscript" aria-current={route ? "page" : undefined}>Manuscript</a>
      </nav>
      {route ? manuscript(route) : <Records {...records} />}
    </>
  );
}
