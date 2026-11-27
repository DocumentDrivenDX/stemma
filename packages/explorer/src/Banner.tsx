// What a reader needs to know before trusting the page: whose records it shows,
// as of which data, what was left out, and what no state on it can tell them.
// Everything here is a text node.
import type { BannerData } from "../../graph/src/export.ts";

const total = (list: { count: number }[]) => list.reduce((n, one) => n + one.count, 0);
const plain = (word: string) => word.replaceAll("_", " ");

export function Banner({ data }: { data: BannerData }) {
  const left = total(data.omissions);
  const dropped = total(data.dropped_links);
  return (
    <section aria-label="About this export" className="st:border-b st:border-amber-700 st:bg-amber-50 st:px-4 st:py-2 st:text-sm st:leading-5 st:text-slate-900">
      <p>
        <strong>Stemma author export.</strong> Project <code>{data.project_id}</code>. Data identity{" "}
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
          {warning.records.length > 20 ? ` and ${warning.records.length - 20} more, listed in the export manifest` : ""}
        </p>
      ))}
      <details>
        <summary className="st:cursor-pointer st:underline">Details: omissions, states, and what this page is</summary>
        <div className="st:max-h-64 st:overflow-auto st:pt-1" tabIndex={0} role="group" aria-label="Export details">
          <p>
            This page shows the records as they were when exported. It does not update: after an edit, export again and reload. A time
            that the browser below shows is when this page was opened, not when the data was exported. After a rebuild, compare the data
            identity with the one the export printed. Anyone who has this file can read everything in it, passage text and the text of
            the source pages that passages lie on included.
          </p>
          <p>
            States shown where they apply: {data.states.computed.join(", ")}. The states open_finding and annotated come only from these
            checks: {data.states.checks.join(", ")}. Not from: {data.states.checks_left_out.map((c) => `${c.check} (${c.why})`).join("; ")}.
            Run a check for the findings themselves.
          </p>
          <p>
            Search lists at most 50 results, and at most 50 of one type, from the first 20 types. Other records are reached by their
            type lists and links.
          </p>
          <p>Left out of this export:</p>
          <ul className="st:list-disc st:pl-5">
            {data.omissions.map((o) => <li key={`${o.type} ${o.reason}`}>{o.type}: {plain(o.reason)}, {o.count}</li>)}
          </ul>
          {data.dropped_links.length > 0 && <p>Links left out:</p>}
          <ul className="st:list-disc st:pl-5">
            {data.dropped_links.map((o) => <li key={`${o.relationship} ${o.reason}`}>{o.relationship}: {plain(o.reason)}, {o.count}</li>)}
          </ul>
          <p>
            Full data identity <code>{data.data_identity}</code>. Corpus digest <code>{data.corpus_digest}</code>. Exported by
            Stemma {data.exporter.version}, shown with arras {data.arras}. Licenses of the code in this page are at the end of its source.
          </p>
        </div>
      </details>
    </section>
  );
}
