// What the offline page and the served page share: the record browser with the
// open record's source beside it, and the move between it, the manuscript, and
// the served page's Search view. How data reaches them is each page's own.
import type { ReactNode } from "react";
import { GraphBrowser } from "@documentdrivendx/arras-ui/browser";
import type { ArrasClient, SchemaApi } from "./arras-types.ts";
import { type ManuscriptRoute, manuscriptRouteOf, type SearchRoute, searchHref, searchRouteOf, sourceRouteOf, useHash, useLocationOfBrowser } from "./route.ts";
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

export interface Search {
  view(route: SearchRoute): ReactNode;
  /** The text last typed in the record browser's own search box. */
  last(): string;
}

/** The record browser, or the manuscript when the project has a report, or the served page's Search view, with the control that moves between them. */
export function Explorer({ manuscript, search, ...records }: BrowserData & { manuscript: ((route: ManuscriptRoute) => ReactNode) | undefined; search?: Search }) {
  const hash = useHash();
  if (!manuscript && !search) return <Records {...records} />;
  const route = manuscript && manuscriptRouteOf(hash);
  const searching = search && searchRouteOf(hash);
  return (
    <>
      <nav aria-label="Views" className="stemma-views">
        <a href="#/explore" aria-current={route || searching ? undefined : "page"}>Records</a>
        {search ? (
          <a href="#/search" aria-current={searching ? "page" : undefined} onClick={(event) => {
            if (searching) return;
            event.preventDefault();
            window.location.hash = searchHref({ type: undefined, page: 1, text: search.last() });
          }}>Search</a>
        ) : null}
        {manuscript ? <a href="#/manuscript" aria-current={route ? "page" : undefined}>Manuscript</a> : null}
      </nav>
      {searching ? search!.view(searching) : route ? manuscript!(route) : <Records {...records} />}
    </>
  );
}
