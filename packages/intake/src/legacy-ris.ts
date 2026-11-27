// The RIS reader (CONTRACT-003 C). One continuation rule applies until a
// producer's own rule is established from its real files.
import { checkField, emptyParsed, LEGACY_LIMITS, LimitExceeded, type Limits, type Parsed, type ParsedEntry } from "./legacy.ts";

const TAG = /^([A-Z][A-Z0-9])  -(?: (.*))?$/s;
const LIKE_TAG = /^\s*[A-Z][A-Z0-9]\s*-(?:\s|$)/;
/** Inside a record, only spacing around the hyphen makes a line look meant as a tag. */
const NEAR_TAG = /^[A-Z][A-Z0-9](?: {1,3}-| *-  )(?:\s|$)/;

export function parseRis(text: string, limits: Limits = LEGACY_LIMITS): Parsed {
  const result = emptyParsed();
  // [line, ending] pairs; the last line may have no ending.
  const pieces = text.split(/(\r\n|\r|\n)/);
  let offset = 0;
  let continued = false;

  let record: (ParsedEntry & { start: number }) | undefined;
  /** The value still open to continuation lines. */
  let open: { parts: string[]; length: number; empty: number } | undefined;
  /** Set when a fault was found in the open record, which is then not read. */
  let faulted = false;
  /** Skips the rest of a record that a fault stopped. */
  let skipping = false;
  let outside: string[] = [];

  const close = () => {
    if (!record || !open) return;
    const field = record.fields.at(-1)!;
    field.value = open.parts.join("\n");
    checkField(field.value, field.line, limits);
    open = undefined;
  };
  const flushOutside = () => {
    while (outside.length > 0 && outside.at(-1)!.trim() === "") outside.pop();
    if (outside.length > 0) {
      result.blocks.push({ kind: result.seen === 0 ? "header" : "other", text: outside.join("\n") });
    }
    outside = [];
  };
  const fault = (code: string, line: number, detail: string, entry?: string) => {
    result.faults.push({ code, line, detail, ...(entry === undefined ? {} : { entry }) });
  };
  const start = (type: string, line: number, from: number) => {
    flushOutside();
    if (result.seen >= limits.entries) throw new LimitExceeded("entries", line);
    record = { ordinal: result.seen++, line, type, text: "", fields: [], start: from };
    skipping = false;
    faulted = false;
  };

  for (let i = 0; i < pieces.length && result.faults.length < limits.faults; i += 2) {
    const content = pieces[i]!;
    const line = i / 2 + 1;
    const from = offset;
    const through = from + content.length + (pieces[i + 1]?.length ?? 0);
    offset = through;
    if (content.length > limits.fieldBytes) throw new LimitExceeded("fieldBytes", line);
    const tag = TAG.exec(content);
    const name = tag?.[1];
    const value = tag?.[2] ?? "";

    if (record) {
      if (name === "TY") {
        fault("missing_end", record.line, `A new record starts at line ${line} before this one ends with ER.`, record.key);
        record = undefined;
        open = undefined;
        start(value, line, from);
      } else if (name === "ER") {
        close();
        if (value.trim() !== "") record.fields.push({ name, value, encoding: "text", line });
        const { start: began, ...entry } = record;
        entry.text = text.slice(began, through);
        if (!faulted) result.entries.push(entry);
        record = undefined;
      } else if (name !== undefined) {
        close();
        record.fields.push({ name, value: "", encoding: "text", line });
        open = { parts: [value], length: value.length, empty: 0 };
        if (name === "ID" && record.key === undefined && value.trim() !== "") record.key = value.trim();
      } else if (open) {
        if (content === "") open.empty++;
        else {
          if (NEAR_TAG.test(content)) {
            result.notes.push({ code: "line_like_a_tag", line, detail: "A line looks like a tag with other spacing. It is read as part of the value above it.", ...(record.key === undefined ? {} : { entry: record.key }) });
          }
          open.length += open.empty + content.length + 1;
          if (open.length > limits.fieldBytes) throw new LimitExceeded("fieldBytes", line);
          for (; open.empty > 0; open.empty--) open.parts.push("");
          open.parts.push(content);
          continued = true;
        }
      } else if (content.trim() !== "") {
        faulted = true;
        fault("unplaced_line", line, "A line before the record's first tag belongs to no tag.", record.key);
      }
      continue;
    }

    if (name === "TY") start(value, line, from);
    else if (name === "ER" && skipping) skipping = false;
    else if (LIKE_TAG.test(content)) {
      if (!skipping) {
        result.seen++;
        fault("tag_outside_record", line, "A tag stands outside any record. A record starts with a TY line, with two spaces before the hyphen.");
        // The rest of this record is not reported line by line.
        skipping = true;
      }
    } else if (!skipping && (content.trim() !== "" || outside.length > 0)) outside.push(content);
    if (skipping && /^\s*ER\s*-/.test(content)) skipping = false;
  }
  if (record && result.faults.length < limits.faults) {
    fault("missing_end", record.line, "The file ends before this record ends with ER.", record.key);
  }
  flushOutside();
  result.variant = continued ? "tagged, with continuation lines" : "tagged";
  return result;
}
