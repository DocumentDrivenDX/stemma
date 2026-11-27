// Open takeover items, grouped by what causes them (FR-93; CONTRACT-003 F7;
// SD-015 BR-1526). Groups are computed from records on each call and never
// saved. Grouping drops no item, and merges nothing.
import { compareCodePoints, type Corpus, idOf, type LoadedFile } from "@stemma/records";
import { active } from "./checks/bibliography.ts";

export interface TakeoverItem { id: string; position?: string; as_found?: string }

export interface TakeoverGroup {
  category: string;
  reason: string;
  count: number;
  /** What the items are, in plain words. */
  label: string;
  next_step: string;
  items: TakeoverItem[];
}

export interface OpenTakeover {
  groups: TakeoverGroup[];
  /** Reference-list items, from any batch, whose text as found is identical. Nothing is merged. */
  repeats: { as_found: string; items: string[] }[];
  /** Bracketed years left as text. They ask for nothing, so they are counted and not grouped. */
  left_unlinked: { count: number; by_reason: Record<string, number> };
}

const NOT_YET = "No command settles takeover items yet (`rounds` is not built).";

/** Label and next step by reason. A reason not listed is shown by its code. */
const SAID: Record<string, [string, string]> = {
  list_entry: ["reference-list entries, each now a source holding only the entry's text, its author family names and its year",
    "Add a copy of each cited work with `source capture` and `source convert --source <id>`, or record its details with `source enrich`."],
  list_entry_unread: ["reference-list entries whose authors or year could not be read; no citation is linked to them",
    `Look at each entry. Its source holds only the text as found. ${NOT_YET}`],
  citation_no_list: ["citations in a part of the manuscript that no reference list serves",
    `Where you know the source, write its key in place of \`?\` in the chapter file under manuscript/. ${NOT_YET}`],
  citation_several_entries: ["citations that more than one list entry matches",
    `Choose the source, and write its key in place of \`?\` in the chapter file under manuscript/. ${NOT_YET}`],
  citation_unread_entry: ["citations that an unread or look-alike entry could be the one meant by",
    `Check the candidates, and write the right key in place of \`?\` in the chapter file under manuscript/. ${NOT_YET}`],
  citation_no_entry: ["citations that no entry of the chapter's list matches",
    `Check the spelling and year against the list. Where you know the source, write its key in place of \`?\` in the chapter file under manuscript/. ${NOT_YET}`],
  note_without_author_date: ["notes with no author-date citation; full and short references typed in notes are not read yet",
    "Check each by hand. Their text is in the chapter file, and nothing in them is linked to a source unless it says so."],
  table: ["tables, kept as unconverted text that no check reads", "Check their citations, quotations and figures by hand."],
  note_not_in_text: ["notes referred to only from a table or a reference list, kept as unconverted text that no check reads", "Check them by hand."],
  comment: ["Word comments, kept here and not in the chapter", "Read them; they are the comment writer's words and change nothing."],
  reference_field: ["reference-manager fields whose embedded data was not decoded; only the visible text was read",
    "Compare the visible citation with what your reference manager holds."],
  hidden_text: ["hidden text, which is now ordinary text in the chapter", "Delete it from the chapter file if it does not belong."],
  original_changed: ["files that changed after they were taken over; the change is not applied",
    "Keep working in the Stemma copy, or run takeover with --separate if it is a different text."],
};

const UNREAD: [string, string] = ["", "Check this content in the original; it is not in the chapter."];

export const takeoverSaid = (reason: string): { label: string; next_step: string } => {
  const [label, next] = SAID[reason] ?? [`items the Word reader reported and did not convert (${reason.replaceAll("_", " ")})`, UNREAD[1]];
  return { label, next_step: next };
};

const text = (file: LoadedFile, name: string): string | undefined => {
  const found = file.data![name];
  return typeof found === "string" ? found : undefined;
};

/** The first number in a position, so that places are listed in reading order. */
const order = (item: TakeoverItem): number => Number(/paragraph (\d+)/.exec(item.position ?? "")?.[1] ?? 0);

/** Items with no applicable choice. `batch` limits the groups to one import; repeats always look at every batch. */
export function openTakeover(corpus: Corpus, batch?: string): OpenTakeover {
  const chosen = new Set(active(corpus, "round_choice").map((c) => c.data!.item));
  const open = active(corpus, "intake_item").filter((f) => !chosen.has(idOf(f)));
  const mine = batch === undefined ? open : open.filter((f) => f.data!.import === batch);

  const groups = new Map<string, TakeoverGroup>();
  const unlinked: Record<string, number> = {};
  for (const file of mine) {
    const category = String(file.data!.category);
    const reason = String(file.data!.reason);
    if (category === "year_parenthesis") {
      unlinked[reason] = (unlinked[reason] ?? 0) + 1;
      continue;
    }
    const key = `${category}\u0000${reason}`;
    const group = groups.get(key) ?? { category, reason, count: 0, ...takeoverSaid(reason), items: [] };
    groups.set(key, group);
    const position = text(file, "document_position");
    const found = text(file, "as_found");
    group.items.push({ id: idOf(file)!, ...(position !== undefined ? { position } : {}), ...(found !== undefined ? { as_found: found } : {}) });
    group.count++;
  }
  for (const group of groups.values()) group.items.sort((a, b) => order(a) - order(b) || compareCodePoints(a.id, b.id));

  const same = new Map<string, string[]>();
  for (const file of open) {
    const found = text(file, "as_found");
    if (!String(file.data!.reason).startsWith("list_entry") || found === undefined) continue;
    same.set(found, [...same.get(found) ?? [], idOf(file)!]);
  }
  return {
    groups: [...groups.values()].sort((a, b) => compareCodePoints(a.category, b.category) || compareCodePoints(a.reason, b.reason)),
    repeats: [...same].filter(([, ids]) => ids.length > 1).map(([as_found, ids]) => ({ as_found, items: ids.sort(compareCodePoints) }))
      .sort((a, b) => compareCodePoints(a.as_found, b.as_found)),
    left_unlinked: { count: Object.values(unlinked).reduce((a, b) => a + b, 0), by_reason: unlinked },
  };
}
