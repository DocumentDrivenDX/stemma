// "In the source" (CONTRACT-005 K; US-116): the source view of the Citation or
// Passage record that is open, beside the record browser. Everything shown is a
// text node, and source and record text is untrusted: each piece is isolated and
// hidden characters are shown. The page decides nothing about what is
// highlighted: it marks only the `quoted` text of a view that says
// `highlighted`, and only when every view involved says so and is the one asked
// for.
import { createContext, Fragment, type ReactNode, type RefObject, useContext, useEffect, useRef, useState } from "react";
import type { PageSegment, SourceView, SourceViewState, ViewOriginal, WorkName } from "../../core/src/source-view.ts";
import { splitControls } from "../../records/src/visible.ts";

/** Where a view comes from. It is asynchronous, so that a server can answer it. */
export type GetSourceView = (id: string) => Promise<SourceView | undefined>;

export interface SourceRoute { type: "Citation" | "Passage"; id: string }

export const STATES: Record<SourceViewState, string> = {
  highlighted: "Quotation highlighted",
  changed: "The text has changed",
  no_source_file: "No source file",
  damaged_file: "Damaged source file",
  invalid_anchor: "Invalid passage address",
  no_passage: "No passage recorded",
  citation_differs: "The citation differs from its passage",
  retired: "Retired",
  not_exported: "Text left out of this export",
};

/** True in the served page, whose data comes from the project's files as they are, not from an export. */
export const Served = createContext(false);

/** One piece of untrusted text, kept from reordering what is around it. */
export function Text({ value }: { value: string }) {
  return (
    <span dir="auto" style={{ unicodeBidi: "isolate" }}>
      {splitControls(value).map((piece, i) => ("text" in piece
        ? <Fragment key={i}>{piece.text}</Fragment>
        : <span key={i} dir="ltr" className="stemma-control" title="A hidden character in the text">{piece.control}</span>))}
    </span>
  );
}

/** A link only for a web address; anything else is text. Nothing is loaded until the reader follows it. */
export function Address({ url }: { url: string }) {
  let web = false;
  try {
    web = ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    // Not an address.
  }
  return web ? <a className="st:underline" href={url} rel="noreferrer noopener"><Text value={url} /></a> : <Text value={url} />;
}

function Work({ label, work }: { label: string; work: WorkName }) {
  return (
    <p>
      <strong>{label}:</strong> {work.title === undefined ? "(no readable title)" : <Text value={work.title} />}{" "}
      (<a className="st:underline" href={`#/explore/stemma/Source/${encodeURIComponent(work.id)}`}>{work.key === undefined ? work.id : <Text value={work.key} />}</a>)
    </p>
  );
}

const Quoted = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p><strong>{label}</strong></p>
    <blockquote className="st:my-1 st:border-l-4 st:border-slate-300 st:pl-2 st:whitespace-pre-wrap"><Text value={value} /></blockquote>
  </div>
);

function Page({ segment: s }: { segment: PageSegment }) {
  const unpaged = s.label_status === "unpaged";
  const heading = unpaged ? s.place
    : `${s.stream === "notes" ? "Notes on " : ""}${s.printed_label === undefined ? `page index ${s.index}, no printed label` : `printed page ${s.printed_label}`}`;
  const trimmed = (side: string) => <p className="st:text-slate-600">[Text trimmed {side} this point: not the whole {unpaged ? "section" : "page"} is shown.]</p>;
  return (
    <section className="st:mt-3">
      <h3 className="stemma-page-heading st:font-semibold"><Text value={heading.charAt(0).toUpperCase() + heading.slice(1)} /></h3>
      <p className="st:text-slate-600">
        {unpaged ? "This source has no pages." : <>Page label: {s.label_status}{s.label_basis === undefined ? "" : <>, by <Text value={s.label_basis} /></>}. Page index {s.index}.</>}
      </p>
      {s.trimmed_before ? trimmed("before") : null}
      <div className="stemma-source-text">
        <Text value={s.before} /><mark><Text value={s.quoted} /></mark><Text value={s.after} />
      </div>
      {s.trimmed_after ? trimmed("after") : null}
      <p>Recorded quality of this page: method <Text value={s.quality.method} />, level <Text value={s.quality.level} />.{s.quality.note === undefined ? null : <> <Text value={s.quality.note} /></>}</p>
      <ul className="st:list-disc st:pl-5">
        {s.comparisons.map((c) => (
          <li key={c.run}>
            Comparison <Text value={c.method} />{c.independent ? " (independent)" : " (not independent)"}{c.against === undefined ? null : <> against <Text value={c.against} /></>}: {(c.agreement_permille / 10).toFixed(1)}% word agreement on this page.
          </li>
        ))}
        {s.reviews.map((r) => (
          <li key={r.review}>
            {r.by === "person" ? <>A person’s review, as recorded (<Text value={r.scope} />): <Text value={r.outcome} />{r.against === undefined ? null : <> against <Text value={r.against} /></>}.</> : <>Flagged by a {r.by}.</>}
            {r.flags.map((f, i) => (
              <p key={i}>Flag: reads “<Text value={f.reading} />”{f.suggested === undefined ? null : <>; suggests “<Text value={f.suggested} />”</>}{f.note === undefined ? null : <>; <Text value={f.note} /></>}</p>
            ))}
          </li>
        ))}
      </ul>
      <p className="st:text-slate-600">
        {s.comparisons.length + s.reviews.length === 0 ? "No current comparison or review is recorded for this page." : "Comparisons and reviews are records of what was done, not proof that the text is right."}
      </p>
    </section>
  );
}

function Original({ original }: { original: ViewOriginal }) {
  const stated: [string, string | undefined][] = [
    ["Description", original.description], ["Held at", original.held_at], ["Acquired", original.acquired_at], ["Version", original.version],
  ];
  return (
    <section className="st:mt-3">
      <h3 className="st:font-semibold">The original, as recorded</h3>
      <p>Form: {original.form.replaceAll("_", " ")}{original.page_count === undefined ? "" : `, ${original.page_count} pages`}.</p>
      {original.obtained_from === undefined ? null : <p>Obtained from: <Address url={original.obtained_from} /></p>}
      {stated.map(([name, value]) => (value === undefined ? null : <p key={name}>{name}: <Text value={value} /></p>))}
      <ul className="st:list-disc st:pl-5">
        {original.files.map((f, i) => (
          <li key={i}>
            {f.index === undefined ? "File" : `Image of page index ${f.index}`}: <Text value={f.media_type} />, {f.size} bytes, SHA-256 <code><Text value={f.sha256} /></code>
            {f.upstreams.map((u) => (
              <p key={u.record}>Retrieved <Text value={u.retrieved_at} />{u.url === undefined ? ", with no recorded web address." : <> from <Address url={u.url} /></>}</p>
            ))}
          </li>
        ))}
      </ul>
      {original.other_page_files ? <p>{original.other_page_files} page image(s) of other pages are not listed.</p> : null}
      <p className="st:text-slate-600">
        This page does not open originals, and cannot say whether one is held: opening an original will come with the local server. <code>excerpt</code> says whether a copy is held.
      </p>
    </section>
  );
}

function Passage({ passage, link }: { passage: SourceView; link: boolean }) {
  const text = passage.source_text!;
  return (
    <>
      {link ? <p className="st:mt-3"><a className="st:underline" href={`#/explore/stemma/Passage/${encodeURIComponent(passage.id)}`}>Passage record {passage.id}</a></p> : null}
      <p className="st:mt-2">
        <strong>Converted or recognized text, not a reading of the page.</strong> Method <Text value={text.method} />, recorded quality <Text value={text.level} />.
      </p>
      {passage.segments.map((s) => <Page key={`${s.index} ${s.stream}`} segment={s} />)}
      <details className="st:mt-2">
        <summary className="st:cursor-pointer st:underline">How the text was made</summary>
        {text.recognition === undefined ? null : <p><Text value={text.recognition} /></p>}
        {text.note === undefined ? null : <p><Text value={text.note} /></p>}
        {text.coverage === "all" ? null : <p>Coverage: <Text value={text.coverage} />. {text.coverage_note === undefined ? null : <Text value={text.coverage_note} />}</p>}
      </details>
      {passage.original ? <Original original={passage.original} /> : null}
    </>
  );
}

const Nothing = ({ state, why }: { state: SourceViewState; why: string }): ReactNode => (
  <div role="note" className="st:my-2 st:border st:border-amber-700 st:bg-amber-50 st:p-2">
    <p><strong>{STATES[state] ?? state}. Nothing is highlighted.</strong></p>
    <p><Text value={why} /></p>
  </div>
);

export interface Loaded { view: SourceView | undefined; passages: (SourceView | undefined)[]; failed?: string }

/** The view asked for, with the passage views it points to. `getOwn` answers the ID itself, and `get` its passages. */
export async function load(asked: { id: string; kind: SourceView["kind"] }, getOwn: GetSourceView, get: GetSourceView = getOwn): Promise<Loaded> {
  const view = await getOwn(asked.id);
  // A view of anything but the record that is open is no view of it.
  if (!view || view.id !== asked.id || view.kind !== asked.kind) return { view: undefined, passages: [] };
  if (view.kind === "passage") return { view, passages: [view] };
  const passages = view.state === "highlighted"
    ? await Promise.all(view.passages.map(async (p) => {
      const found = await get(p.passage);
      return found && found.id === p.passage && found.kind === "passage" ? found : undefined;
    }))
    : [];
  return { view, passages };
}

/** What a view says, with the text of its passages. Nothing is marked unless every view involved says `highlighted`. */
export function ViewBody({ found }: { found: Loaded & { view: SourceView } }) {
  const view = found.view;
  const highlighted = view.state === "highlighted";
  return (
    <>
      {highlighted ? <p><strong>{STATES.highlighted}.</strong> <Text value={view.why} /></p> : <Nothing state={view.state} why={view.why} />}
      {view.work ? <Work label={view.kind === "passage" ? "Source" : "Cited work"} work={view.work} /> : null}
      {view.work?.part_of ? <Work label="Part of" work={view.work.part_of} /> : null}
      {view.citation?.key === undefined ? null : <p><strong>Citation key:</strong> <Text value={view.citation.key} /></p>}
      {view.locator ? <p><strong>{view.kind === "citation" ? "Cited place" : "Place"}:</strong> <Text value={`${view.locator.label} ${view.locator.value}`} /></p> : null}
      {view.citation?.sentence === undefined ? null : <Quoted label="Citing sentence" value={view.citation.sentence} />}
      {view.citation?.quotation === undefined ? null : <Quoted label="Quotation as the citation records it" value={view.citation.quotation} />}
      {highlighted ? found.passages.map((passage, i) => (
        !passage ? <p key={i} role="note">This export holds no view of the passage, so nothing is highlighted.</p>
          : passage.state === "highlighted" && passage.source_text ? <Passage key={passage.id} passage={passage} link={view.kind !== "passage"} />
            : <Nothing key={passage.id} state={passage.state} why={passage.why} />
      )) : view.passages.map((p) => (
        <p key={p.passage}><a className="st:underline" href={`#/explore/stemma/Passage/${encodeURIComponent(p.passage)}`}>Passage record <Text value={p.passage} /></a></p>
      ))}
    </>
  );
}

/** What was loaded for `key`, and never what was loaded for another. */
export function useLoaded<T>(key: string, make: () => Promise<T>, failed: (error: string) => T): T | undefined {
  const [loaded, setLoaded] = useState<{ key: string; found: T }>();
  useEffect(() => {
    let current = true;
    make().then(
      (found) => current && setLoaded({ key, found }),
      (error: unknown) => current && setLoaded({ key, found: failed(String(error)) }),
    );
    return () => {
      current = false;
    };
    // What is made depends on the key alone.
  }, [key]);
  return loaded?.key === key ? loaded.found : undefined;
}

/** The highlight is brought into the panel's view without moving what is beside it. */
export function useShownMark(box: RefObject<HTMLElement | null>, found: unknown): void {
  useEffect(() => {
    const panel = box.current;
    const mark = panel?.querySelector("mark");
    if (panel && mark) panel.scrollTop += mark.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientHeight / 4;
  }, [found]);
}

export const ViewsFailed = ({ error }: { error: string }) => <p role="alert">The source views could not be read, which is a Stemma defect: <Text value={error} /></p>;

/** Give it a key of the record's ID, so that nothing loaded for one record is ever shown for another. */
export function SourcePanel({ route, getView }: { route: SourceRoute; getView: GetSourceView }) {
  const served = useContext(Served);
  const box = useRef<HTMLElement>(null);
  const found = useLoaded<Loaded>(
    `${route.type}/${route.id}`,
    () => load({ id: route.id, kind: route.type === "Citation" ? "citation" : "passage" }, getView),
    (failed) => ({ view: undefined, passages: [], failed }),
  );
  useShownMark(box, found);
  const view = found?.view;
  return (
    <section ref={box} className="stemma-source st:p-3 st:text-sm st:leading-5" aria-label="In the source" tabIndex={0} data-record={route.id} data-state={view?.state}>
      <h2 className="st:text-base st:font-semibold">In the source</h2>
      {!found ? <p>Loading.</p> : found.failed !== undefined ? <ViewsFailed error={found.failed} /> : !view ? (
        <p role="note">
          {served ? "There is" : "This export holds"} no source view of this record, so nothing is highlighted. It, or something it rests on, may be retired. <code>excerpt</code> with its ID says why.
        </p>
      ) : <ViewBody found={{ ...found, view }} />}
    </section>
  );
}
