// The manuscript browser (CONTRACT-005 L; US-118): the report as the export read
// it, with each quotation, note citation and bibliography entry opening its
// source. The page finds no link: it follows the IDs the view holds. Everything
// shown is a text node, each piece isolated and hidden characters shown, and
// the source is shown with the record panel's own parts and rules.
import { Fragment, type ReactNode, useEffect, useRef } from "react";
import {
  inlineRuns, type ManuscriptCitation, type ManuscriptEntry, type ManuscriptPart, type ManuscriptView, quotationRuns, type Run,
} from "../../core/src/manuscript-view.ts";
import { Address, type GetSourceView, load, type Loaded, STATES, Text, useLoaded, ViewBody, ViewsFailed } from "./SourcePanel.tsx";
import { manuscriptHref, type ManuscriptRoute } from "./route.ts";

/** Formatted runs. Inside something that is itself a link, an address stays text. */
const Runs = ({ runs, links }: { runs: Run[]; links: boolean }) => (
  <>
    {runs.map((run, i) => (
      run.kind === "italic" ? <em key={i}><Text value={run.text} /></em>
        : run.kind === "link" && links ? <Address key={i} url={run.text} />
          : <Text key={i} value={run.text} />
    ))}
  </>
);

const quotationOf = (view: ManuscriptView, id: string) => (Object.hasOwn(view.quotations, id) ? view.quotations[id] : undefined);

/** A quotation as the report gives it, or, when it is broken, a marker that says so in its place. */
function QuotationLink({ view, id, open, inNote }: { view: ManuscriptView; id: string; open: string; inNote?: boolean }) {
  const quotation = quotationOf(view, id);
  const href = manuscriptHref({ kind: "quotation", id });
  const highlighted = quotation?.view.state === "highlighted";
  // The printed note ends each quotation with a period unless it already ends a sentence (`quotedInNote`).
  const period = inNote && !/[.?!]$/.test(quotation?.text ?? "") ? "." : "";
  return (
    <a href={href} className={highlighted ? "stemma-quotation" : "stemma-quotation stemma-broken"} data-quotation={id} aria-current={open === href ? "true" : undefined}>
      {quotation?.text === undefined
        ? <>[Broken quotation <Text value={id} />: {quotation ? STATES[quotation.view.state] : "not in the view"}]</>
        : <>“<Runs runs={quotationRuns(quotation.text, quotation.italic)} links={false} />{period}”{highlighted ? null : <> [not highlighted: {STATES[quotation.view.state]}]</>}</>}
    </a>
  );
}

const citationWords = (citation: ManuscriptCitation, links: boolean) => (
  citation.text === undefined ? <>[Citation not shown. <Text value={citation.withheld ?? ""} />]</> : <Runs runs={inlineRuns(citation.text)} links={links} />
);

function Parts({ view, parts, open, noteRef }: { view: ManuscriptView; parts: ManuscriptPart[]; open: string; noteRef: (n: number) => ReactNode }) {
  return (
    <>
      {parts.map((part, i) => (
        part.kind === "text" ? <Runs key={i} runs={inlineRuns(part.text)} links />
          : part.kind === "quotation" ? <QuotationLink key={i} view={view} id={part.id} open={open} />
            : part.kind === "note" ? <Fragment key={i}>{noteRef(part.number)}</Fragment>
              : <span key={i} className="stemma-broken">[Text withheld: it begins as a path on someone’s machine.]</span>
      ))}
    </>
  );
}

/** Moves to a place in the page without touching the address, which names the open source. */
function goTo(id: string): void {
  const element = document.getElementById(id);
  element?.scrollIntoView({ block: "center" });
  element?.focus({ preventScroll: true });
}

function Entry({ entry, open }: { entry: ManuscriptEntry; open: string }) {
  const words = entry.text === undefined ? <>[Entry not shown. <Text value={entry.withheld ?? ""} />]</> : <Runs runs={inlineRuns(entry.text)} links={false} />;
  if (entry.source === undefined) return <span className="stemma-broken">{words}</span>;
  const href = manuscriptHref({ kind: "source", id: entry.source });
  return <a href={href} className="stemma-entry" data-entry={entry.source} aria-current={open === href ? "true" : undefined}>{words}</a>;
}

function Reading({ view, open }: { view: ManuscriptView; open: string }) {
  const noteRef = (number: number) => (
    <sup><button type="button" id={`stemma-ref-${number}`} className="stemma-note-ref" aria-label={`Go to note ${number}`} onClick={() => goTo(`stemma-note-${number}`)}>{number}</button></sup>
  );
  return (
    <>
      {view.blocks.map((block, i) => {
        if (block.kind === "bibliography") {
          return (
            <section key={i} aria-label="Bibliography">
              <h2>Bibliography</h2>
              <ul className="stemma-bibliography">{view.bibliography.map((entry, n) => <li key={n}><Entry entry={entry} open={open} /></li>)}</ul>
            </section>
          );
        }
        const Tag = block.level ? (`h${block.level}` as "h1" | "h2" | "h3") : "p";
        return <Tag key={i}><Parts view={view} parts={block.parts} open={open} noteRef={noteRef} /></Tag>;
      })}
      {view.notes.length === 0 ? null : (
        <section aria-label="Notes">
          <h2>Notes</h2>
          <ol className="stemma-notes">
            {view.notes.map((note) => (
              <li key={note.number} id={`stemma-note-${note.number}`} value={note.number} tabIndex={-1}>
                <p>
                  {note.citations.map((citation, i) => {
                    const href = manuscriptHref({ kind: "citation", note: note.number, index: i });
                    return (
                      <Fragment key={i}>
                        {citation.quotations.map((id, n) => <Fragment key={n}><QuotationLink view={view} id={id} open={open} inNote />{" "}</Fragment>)}
                        <a href={href} className="stemma-citation" data-citation={`${note.number}/${i}`} aria-current={open === href ? "true" : undefined}>{citationWords(citation, false)}</a>{" "}
                      </Fragment>
                    );
                  })}
                </p>
                {note.comment ? <p><Parts view={view} parts={note.comment} open={open} noteRef={noteRef} /></p> : null}
                <p><button type="button" className="stemma-back" aria-label={`Back to the text from note ${note.number}`} onClick={() => goTo(`stemma-ref-${note.number}`)}>Back to the text</button></p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

const PaneLink = ({ to, children }: { to: Exclude<ManuscriptRoute, { kind: "text" }>; children: ReactNode }) => (
  <a className="st:underline" href={manuscriptHref(to)}>{children}</a>
);

/** One report quotation in its source. */
function QuotationSource({ view, id, getView }: { view: ManuscriptView; id: string; getView: GetSourceView }) {
  const quotation = quotationOf(view, id);
  const found = useLoaded<Loaded>(
    id,
    () => load({ id, kind: "quotation" }, async () => quotation?.view, getView),
    (failed) => ({ view: undefined, passages: [], failed }),
  );
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The first highlight of the pane is the one brought into view, once its text is there.
    const panel = box.current?.closest<HTMLElement>(".stemma-source");
    const mark = panel?.querySelector("mark");
    if (panel && mark && box.current?.contains(mark)) panel.scrollTop += mark.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientHeight / 4;
  }, [found]);
  return (
    <div ref={box} className="stemma-quoted" data-quotation={id} data-state={found?.view?.state}>
      <h3 className="st:mt-3 st:font-semibold">Quotation <Text value={id} /></h3>
      {quotation?.text === undefined ? null : (
        <blockquote className="st:my-1 st:border-l-4 st:border-slate-300 st:pl-2">“<Runs runs={quotationRuns(quotation.text, quotation.italic)} links={false} />”</blockquote>
      )}
      {!quotation || quotation.changes.length === 0 ? null : (
        <>
          <p>How the report’s words differ from the source text, or what their page rests on:</p>
          <ul className="st:list-disc st:pl-5">{quotation.changes.map((change, i) => <li key={i}><Text value={change} /></li>)}</ul>
        </>
      )}
      {!found ? <p>Loading.</p> : found.failed !== undefined ? <ViewsFailed error={found.failed} /> : found.view
        ? <ViewBody found={{ ...found, view: found.view }} />
        : <p role="note">This export holds no source view of this quotation, so nothing is highlighted.</p>}
    </div>
  );
}

function CitedWork({ view, id }: { view: ManuscriptView; id: string }) {
  const work = Object.hasOwn(view.works, id) ? view.works[id] : undefined;
  return (
    <>
      {work?.title === undefined ? "(no readable title)" : <Text value={work.title} />}{" "}
      (<a className="st:underline" href={`#/explore/stemma/Source/${encodeURIComponent(id)}`}><Text value={work?.key ?? id} /></a>)
    </>
  );
}

/** Every place the report cites the work of one bibliography entry. Nothing is highlighted here. */
function EntryPane({ view, entry }: { view: ManuscriptView; entry: ManuscriptEntry & { source: string } }) {
  return (
    <>
      <p><strong>Source:</strong> <CitedWork view={view} id={entry.source} /></p>
      <p className="st:my-1">{entry.text === undefined ? <Text value={entry.withheld ?? ""} /> : <Runs runs={inlineRuns(entry.text)} links />}</p>
      <p role="note">Nothing is highlighted here. Choose a place to see the words it cites. This page does not open originals.</p>
      <h3 className="st:mt-3 st:font-semibold">Where the report cites it: {entry.places.length} citation(s)</h3>
      {entry.places.length === 0 ? <p>No note cites it. The bibliography lists it all the same.</p> : null}
      <ul className="stemma-places st:list-disc st:pl-5">
        {entry.places.map((place) => {
          const citation = view.notes.find((n) => n.number === place.note)!.citations[place.citation]!;
          return (
            <li key={`${place.note}/${place.citation}`} className="st:my-1">
              <PaneLink to={{ kind: "citation", note: place.note, index: place.citation }}>Note {place.note}: {citationWords(citation, false)}</PaneLink>
              {citation.source === undefined || citation.source === entry.source ? null : <> Cites <CitedWork view={view} id={citation.source} />, printed in this work.</>}
              {citation.quotations.map((id, n) => {
                const text = quotationOf(view, id)?.text;
                return <p key={n} className="st:text-slate-600">{text === undefined ? <>Broken quotation <Text value={id} /></> : <>“<Runs runs={quotationRuns(text, quotationOf(view, id)!.italic)} links={false} />”</>}</p>;
              })}
            </li>
          );
        })}
      </ul>
      {entry.quoted.length === 0 ? null : (
        <>
          <h3 className="st:mt-3 st:font-semibold">Quoted with no citation of its own</h3>
          <ul className="st:list-disc st:pl-5">
            {entry.quoted.map((q, i) => (
              <li key={i}><PaneLink to={{ kind: "quotation", id: q.quotation }}>Quotation <Text value={q.quotation} /></PaneLink>, {q.note === undefined ? "in the text" : `in the comment of note ${q.note}`}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

const Absent = () => <p role="note">This export’s manuscript holds nothing by that name, so nothing is highlighted.</p>;

function PaneBody({ view, route, getView }: { view: ManuscriptView; route: Exclude<ManuscriptRoute, { kind: "text" }>; getView: GetSourceView }) {
  const entryLink = (source: string) => <p><PaneLink to={{ kind: "source", id: source }}>This work in the bibliography, and every place the report cites it</PaneLink></p>;
  const listed = (source: string | undefined) => source !== undefined && view.bibliography.some((e) => e.source === source);
  if (route.kind === "source") {
    const entry = view.bibliography.find((e) => e.source === route.id);
    return entry ? <EntryPane view={view} entry={{ ...entry, source: route.id }} /> : <Absent />;
  }
  if (route.kind === "citation") {
    const citation = view.notes.find((n) => n.number === route.note)?.citations[route.index];
    if (!citation) return <Absent />;
    return (
      <>
        <p><strong>Note {route.note}:</strong> {citationWords(citation, true)}</p>
        {citation.source === undefined ? <p role="note">No source is linked to this citation.</p> : <p><strong>Cited source:</strong> <CitedWork view={view} id={citation.source} /></p>}
        {citation.quotations.map((id, n) => <QuotationSource key={n} view={view} id={id} getView={getView} />)}
        {listed(citation.entry) ? entryLink(citation.entry!) : null}
      </>
    );
  }
  if (!quotationOf(view, route.id)) return <Absent />;
  const places = view.notes.flatMap((n) => n.citations.map((c, index) => ({ c, index, note: n.number }))).filter((p) => p.c.quotations.includes(route.id));
  const entry = places.find((p) => listed(p.c.entry))?.c.entry ?? view.bibliography.find((e) => e.quoted.some((q) => q.quotation === route.id))?.source;
  return (
    <>
      <QuotationSource view={view} id={route.id} getView={getView} />
      {places.map((p) => <p key={`${p.note}/${p.index}`}><PaneLink to={{ kind: "citation", note: p.note, index: p.index }}>Cited in note {p.note}</PaneLink></p>)}
      {entry === undefined ? null : entryLink(entry)}
    </>
  );
}

/** The open source, beside the text, or over its lower part on a narrow screen. Give it a key of its route. */
function Pane({ view, route, getView, from }: { view: ManuscriptView; route: Exclude<ManuscriptRoute, { kind: "text" }>; getView: GetSourceView; from: { current: Element | null } }) {
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    box.current?.focus({ preventScroll: true });
    // What was clicked stays in sight above a pane that lies over the text.
    // One quotation has a copy in the text and in its note, so measure the one that was clicked.
    const used = from.current?.isConnected && from.current.getAttribute("href") === manuscriptHref(route) ? from.current : null;
    const clicked = used ?? document.querySelector(".stemma-reading [aria-current]");
    const over = box.current?.parentElement;
    if (clicked && over && getComputedStyle(over).position === "fixed" && clicked.getBoundingClientRect().bottom > over.getBoundingClientRect().top) {
      window.scrollBy(0, clicked.getBoundingClientRect().top - 16);
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") window.location.hash = manuscriptHref({ kind: "text" });
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <div className="stemma-pane">
      <div className="stemma-pane-bar"><a className="st:underline" href={manuscriptHref({ kind: "text" })}>Close the source</a></div>
      <section ref={box} className="stemma-source st:p-3 st:text-sm st:leading-5" aria-label="In the source" tabIndex={0} data-route={manuscriptHref(route)}>
        <h2 className="st:text-base st:font-semibold">In the source</h2>
        <PaneBody view={view} route={route} getView={getView} />
      </section>
    </div>
  );
}

export function Manuscript({ view, route, getView }: { view: ManuscriptView; route: ManuscriptRoute; getView: GetSourceView }) {
  const open = manuscriptHref(route);
  const from = useRef<Element | null>(null);
  return (
    <div className={route.kind === "text" ? "stemma-manuscript" : "stemma-manuscript stemma-open"}>
      <main className="stemma-reading" onClickCapture={(event) => { from.current = (event.target as Element).closest("a"); }}>
        <p role="note" className="stemma-statement">
          <strong>This is the manuscript as the export read it, not the printed PDF.</strong>{" "}
          {view.inputs ? <>It is <code><Text value={view.inputs.template} /></code> and <code>{view.inputs.directory}/report.json</code>, assembled again with the project’s records and citation style; <code>report.md</code>, <code>report.pdf</code> and other report directories are not read. </> : null}
          Originals are not opened yet. Choose a quotation, a note’s citation, or a bibliography entry to see its source.
        </p>
        {view.state === "unavailable" ? <p role="alert">The report is not in this export. <Text value={view.why ?? ""} /> Fix it, then export again.</p> : null}
        {view.problems.length === 0 ? null : <ul role="note" className="stemma-broken">{view.problems.map((p, i) => <li key={i}><Text value={p} /></li>)}</ul>}
        <Reading view={view} open={open} />
      </main>
      {route.kind === "text" ? null : <Pane key={open} view={view} route={route} getView={getView} from={from} />}
    </div>
  );
}
