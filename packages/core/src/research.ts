// The index of research notes (CONTRACT-001 L). It is worked out from paths and
// first headings each time it is asked for, so there is no index file to go
// stale or to conflict when branches merge. A note is not a record, a source or
// evidence, and nothing here judges its name or form.
import { compareCodePoints, type Corpus, decodeUtf8 } from "@stemma/records";
import { findCoordinates } from "./checks/coordinates.ts";

const TITLE_LIMIT = 200;

export interface ResearchNote {
  path: string;
  /** From a `YYYY-MM-DD-` start of the file name; absent when there is none. */
  date?: string;
  /** The first level-one heading, cut to a limit; absent when there is none, or when it holds a coordinate form. */
  title?: string;
  /** Absent when the note was read. */
  problem?: "cannot_read" | "title_withheld";
}

const dateOf = (path: string): string | undefined => {
  const found = /^(\d{4}-\d{2}-\d{2})-/.exec(path.slice(path.lastIndexOf("/") + 1))?.[1];
  if (!found) return undefined;
  const time = Date.parse(`${found}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(found) ? found : undefined;
};

/** The first `# ` line outside a fenced code block. */
const headingOf = (text: string): string | undefined => {
  let fence: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const mark = /^ {0,3}(```|~~~)/.exec(line)?.[1];
    if (mark) fence = fence === undefined ? mark : fence === mark ? undefined : fence;
    else if (fence === undefined) {
      const title = /^#[ \t]+(.*\S)/.exec(line)?.[1];
      if (title) return title;
    }
  }
  return undefined;
};

/** Every Markdown file under research/, by path, so dated notes in one folder run oldest first. */
export function researchIndex(corpus: Corpus): ResearchNote[] {
  return corpus.research
    .filter((file) => /\.md$/i.test(file.path))
    .sort((a, b) => compareCodePoints(a.path, b.path))
    .map((file): ResearchNote => {
      const date = dateOf(file.path);
      const note: ResearchNote = { path: file.path, ...(date ? { date } : {}) };
      let text: string;
      try {
        if (!file.bytes) return { ...note, problem: "cannot_read" };
        text = decodeUtf8(file.bytes);
      } catch {
        return { ...note, problem: "cannot_read" };
      }
      const title = headingOf(text.replace(/^﻿/, ""));
      if (title === undefined) return note;
      // A listing must not repeat what coordinate.stray warns about.
      if (findCoordinates(title).length > 0) return { ...note, problem: "title_withheld" };
      return { ...note, title: Array.from(title).slice(0, TITLE_LIMIT).join("") };
    });
}
