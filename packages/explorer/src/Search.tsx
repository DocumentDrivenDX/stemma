// The served explorer's Search view (CONTRACT-005 M): every match of a search,
// with its true total, in rank order, a page at a time. The server searches; this
// shows one page. Everything from a record or a search is a text node.
import { useState } from "react";
import { recordHref, type SearchRoute, searchHref } from "./route.ts";
import { Text, useLoaded } from "./SourcePanel.tsx";
import type { Read } from "./remote.ts";

export const SEARCH_PAGE = 50;

interface TypeCount { type: string; label: string; count: number }
interface Result {
  text: string;
  total: number;
  all: number;
  counts: TypeCount[];
  searched: { entries: number; types: number };
  hits: { rank: number; type: string; type_label: string; key: string; label: string; excerpt: { text: string; mark: boolean }[] }[];
}

const number = (n: number) => n.toLocaleString("en-US");
const records = (n: number) => `${number(n)} ${n === 1 ? "record matches" : "records match"}`;

function Scope() {
  return (
    <p className="st:text-sm st:text-slate-600">
      A record matches when each word of the search is somewhere in its search text, in any order, ignoring case and Latin, Greek, Hebrew
      and Arabic marks. In text written without spaces between words, such as Chinese, Japanese or Thai, type a run of characters; put a
      space between runs that need not be next to each other. Every type of record shown here is searched. Not searched: source page text
      beyond what passages quote, the manuscript, research notes, and retired or left-out records.
    </p>
  );
}

function Pager({ route, pages }: { route: SearchRoute; pages: number }) {
  const [typed, setTyped] = useState("");
  const link = (label: string, page: number) => (page >= 1 && page <= pages && page !== route.page
    ? <a href={searchHref({ ...route, page })}>{label}</a>
    : <span aria-disabled="true">{label}</span>);
  return (
    <nav aria-label="Pages of results" className="stemma-pager">
      {link("First", 1)}
      {link("Previous", Math.min(route.page - 1, pages))}
      <span>Page {number(route.page)} of {number(pages)}</span>
      {link("Next", route.page + 1)}
      {link("Last", pages)}
      <form onSubmit={(event) => {
        event.preventDefault();
        const page = Number(typed);
        if (Number.isInteger(page) && page >= 1) window.location.hash = searchHref({ ...route, page: Math.min(page, pages) });
        setTyped("");
      }}>
        <label>Go to page <input type="number" min={1} max={pages} value={typed} onChange={(event) => setTyped(event.target.value)} /></label>
        <button type="submit">Go</button>
      </form>
    </nav>
  );
}

function Results({ route, result }: { route: SearchRoute; result: Result }) {
  const pages = Math.max(1, Math.ceil(result.total / SEARCH_PAGE));
  const first = (route.page - 1) * SEARCH_PAGE + 1;
  const shown = result.hits.length;
  const label = result.counts.find((c) => c.type === route.type)?.label ?? route.type;
  return (
    <>
      <p role="status" data-testid="stemma-search-total">
        <strong>{records(result.total)}</strong>
        {route.type === undefined ? "" : <> of the type {label} (of {number(result.all)} of all types)</>}
        {" "}“<Text value={result.text} />”.{" "}
        {shown > 0 ? `Listed here: ${number(first)} to ${number(first + shown - 1)}, best matches first.`
          : result.total > 0 ? "There is no such page." : `Searched ${number(result.searched.entries)} records of ${number(result.searched.types)} types.`}
      </p>
      {result.all > 0 ? (
        <nav aria-label="Narrow by type" className="stemma-types">
          <a href={searchHref({ ...route, type: undefined, page: 1 })} aria-current={route.type === undefined ? "true" : undefined}>All types: {number(result.all)}</a>
          {result.counts.map((c) => (
            <a key={c.type} href={searchHref({ ...route, type: c.type, page: 1 })} aria-current={route.type === c.type ? "true" : undefined}>{c.label}: {number(c.count)}</a>
          ))}
        </nav>
      ) : null}
      {shown > 0 ? (
        <ol className="stemma-hits">
          {result.hits.map((hit) => (
            <li key={`${hit.type} ${hit.key}`} value={hit.rank}>
              <a href={recordHref(hit.type, hit.key)}><Text value={hit.label} /></a>
              <span className="stemma-hit-type"> {hit.type_label} · <code>{hit.key}</code></span>
              {hit.excerpt.length > 0 ? (
                <span className="stemma-hit-excerpt">
                  {hit.excerpt.map((part, i) => (part.mark ? <mark key={i}><Text value={part.text} /></mark> : <Text key={i} value={part.text} />))}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {result.total > 0 ? <Pager route={route} pages={pages} /> : null}
    </>
  );
}

function Answered({ read, route }: { read: Read; route: SearchRoute }) {
  const found = useLoaded<{ result?: Result; failed?: string }>(
    searchHref(route),
    async () => ({
      result: await read<Result>("/api/search", {
        text: route.text, ...(route.type === undefined ? {} : { type: route.type }), offset: (route.page - 1) * SEARCH_PAGE, limit: SEARCH_PAGE,
      }),
    }),
    (failed) => ({ failed }),
  );
  if (found?.result) return <Results route={route} result={found.result} />;
  if (found?.failed === undefined) return <p role="status">Searching.</p>;
  return <p role="alert">The search was not answered. <Text value={found.failed.replace(/^(Error: )?(bad_request: )?/, "")} /></p>;
}

/** The form's text starts as the route's; give the view a key of it, so that Back brings the right one. */
function Form({ route }: { route: SearchRoute }) {
  const [text, setText] = useState(route.text);
  return (
    <form role="search" className="stemma-search-form" onSubmit={(event) => {
      event.preventDefault();
      // A new search is of all types again.
      window.location.hash = searchHref({ type: undefined, page: 1, text });
    }}>
      <label htmlFor="stemma-search-text">Search all records</label>
      <input id="stemma-search-text" type="search" dir="auto" maxLength={200} autoComplete="off" autoFocus value={text} onChange={(event) => setText(event.target.value)} />
      <button type="submit">Search</button>
    </form>
  );
}

export function SearchView({ read, route }: { read: Read; route: SearchRoute }) {
  return (
    <main className="stemma-search">
      <h1>Search</h1>
      <Form key={route.text} route={route} />
      {route.text.trim() === "" ? <p>Type a word, part of a word, or a record ID.</p> : <Answered key={searchHref(route)} read={read} route={route} />}
      <Scope />
    </main>
  );
}
