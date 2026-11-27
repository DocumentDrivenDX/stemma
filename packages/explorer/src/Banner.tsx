// What a reader needs to know before trusting the page: whose records it shows,
// as of which data, what was left out, and what no state on it can tell them.
// Everything here is a text node.
import type { BannerData } from "../../graph/src/export.ts";

const total = (list: { count: number }[]) => list.reduce((n, one) => n + one.count, 0);
const plain = (word: string) => word.replaceAll("_", " ");

export function Banner({ data, served = false }: { data: BannerData; served?: boolean }) {
  const left = total(data.omissions);
  const dropped = total(data.dropped_links);
  return (
    <section aria-label={served ? "About this data" : "About this export"} className="st:border-b st:border-amber-700 st:bg-amber-50 st:px-4 st:py-2 st:text-sm st:leading-5 st:text-slate-900">
      <p>
        <strong>{served ? "Stemma, served from your files on this computer." : "Stemma author export."}</strong> Project <code>{data.project_id}</code>. Data identity{" "}
        <code data-testid="data-identity">{data.data_identity.slice(0, 12)}</code>. {data.counts.entities} entries and {data.counts.links} links.
        Left out: {left} items and {dropped} links.
      </p>
      <p>
        <strong>Support results are recorded model judgments, not verification.</strong> States not computed, so not shown:{" "}
        {data.states.not_computed.join(", ")}. A record with no state has not been shown to be clear.
      </p>
      {data.warnings.map((warning) => (
        <p key={warning.code} role="note">
          <strong>Warning ({warning.code}).</strong> {warning.message} {warning.records.slice(0, 20).join(", ")}
          {warning.records.length > 20 ? ` and ${warning.records.length - 20} more${served ? "" : ", listed in the export manifest"}` : ""}
        </p>
      ))}
      <details>
        <summary className="st:cursor-pointer st:underline">Details: omissions, states, and what this page is</summary>
        <div className="st:max-h-64 st:overflow-auto st:pt-1" tabIndex={0} role="group" aria-label={served ? "Data details" : "Export details"}>
          {served ? (
            <p>
              This page shows the records as Stemma last read them. When they change, it takes down what it shows, says so, and loads them
              again. A time that the browser below shows is when Stemma read them. It holds everything an author export holds, with no size
              limit on source text. Only this computer can reach it, and only through the page Stemma opened.
            </p>
          ) : <p>
            This page shows the records as they were when exported. It does not update: after an edit, export again and reload. A time
            that the browser below shows is when this page was opened, not when the data was exported. After a rebuild, compare the data
            identity with the one the export printed. Anyone who has this file can read everything in it, passage text and the text of
            the source pages that passages lie on included, and the report’s text when the manuscript is shown.
          </p>}
          <p>
            States shown where they apply: {data.states.computed.join(", ")}. The states open_finding and annotated come only from these
            checks: {data.states.checks.join(", ")}. Not from: {data.states.checks_left_out.map((c) => `${c.check} (${c.why})`).join("; ")}.
            Run a check for the findings themselves.
          </p>
          {served ? (
            <p>
              Search covers every record shown here, of every type. The Search view lists every match, page by page, with the true total.
              The record browser’s own search box lists the best 200 matches and says when there are more; its type counts are true totals;
              it takes 2 to 200 characters and at most 6 words. A record’s links are all reached with “Show more”. Source page text beyond
              what passages quote, the manuscript and research notes are not searched.
            </p>
          ) : (
            <p>
              Search lists at most 50 results, and at most 50 of one type, from the first 20 types, and takes 2 to 200 characters and at
              most 6 words. It has no next page. Other records are reached by their type lists and links.
            </p>
          )}
          <p>Left out of {served ? "what is shown" : "this export"}:</p>
          <ul className="st:list-disc st:pl-5">
            {data.omissions.map((o) => <li key={`${o.type} ${o.reason}`}>{o.type}: {plain(o.reason)}, {o.count}</li>)}
          </ul>
          {data.dropped_links.length > 0 && <p>Links left out:</p>}
          <ul className="st:list-disc st:pl-5">
            {data.dropped_links.map((o) => <li key={`${o.relationship} ${o.reason}`}>{o.relationship}: {plain(o.reason)}, {o.count}</li>)}
          </ul>
          <p>
            Full data identity <code>{data.data_identity}</code>. Corpus digest <code>{data.corpus_digest}</code>. {served ? "Read" : "Exported"} by
            Stemma {data.exporter.version}, shown with arras {data.arras}. {served ? "Licenses of the code in this page ship with Stemma." : "Licenses of the code in this page are at the end of its source."}
          </p>
        </div>
      </details>
    </section>
  );
}
