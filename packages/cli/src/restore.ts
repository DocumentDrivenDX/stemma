// Writing again the text of a source file whose parts are not here (FR-98;
// CONTRACT-007 H). The committed manifest is the authority: parts are written
// only when a conversion of the original gives exactly the files it lists, each
// with its recorded digest. Otherwise nothing is written.
import { InvalidInput, LIMITS, parsePageMap, partTexts } from "@stemma/core";
import { isObject, type JsonObject, type LoadedText } from "@stemma/records";
import { type Original, writeProjectFile } from "@stemma/workspace";
import { namedFile, tools } from "./context.ts";
import { type ConversionOptions, convertOriginal } from "./conversion.ts";
import { canConvertAgain } from "./sources.ts";

const list = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isObject) : []);

/**
 * The ways page labels may have been set. The manifest does not record labels
 * (the parts hold them), so each is tried and the digests decide. `entry` is a
 * supplied plan's entry for this original, with paths relative to `base`.
 */
function settings(media: string, entry: JsonObject | undefined, base: string): { how: string; options: () => ConversionOptions }[] {
  const convert = entry && isObject(entry.convert) ? entry.convert : {};
  const named = (path: unknown) => (typeof path === "string" ? namedFile(base, path, LIMITS.page_map_bytes) : undefined);
  const numbers = list(entry?.auxiliary).find((a) => a.role === "page_numbers")?.file;
  const pdf = media === "application/pdf";
  return [
    ...(typeof convert.page_map === "string" ? [{ how: "with the page map the plan names", options: () => ({ pageMap: parsePageMap(named(convert.page_map)!) }) }] : []),
    ...(pdf ? [{ how: "with page labels proposed from the printed numbers", options: () => ({ autoPages: true, ...(numbers ? { pageNumbers: named(numbers)! } : {}) }) }] : []),
    { how: pdf ? "with no page labels" : "", options: () => ({}) },
  ];
}

/** Restores one source file's parts, and says in a sentence what was done. */
export async function restoreText(
  root: string, text: LoadedText, original: Original & { name: string }, entry: JsonObject | undefined, base: string,
): Promise<string> {
  const data = text.manifest.data!;
  const where = `${text.directory}/`;
  const not = (why: string) => `the text of ${where} was not restored, and nothing was written. ${why}`;
  const tie = isObject(data.original) ? data.original : {};
  const files = list(tie.files);
  const conversion = data.conversion as JsonObject;
  if (files.length !== 1 || files[0]!.sha256 !== original.sha256 || !canConvertAgain(conversion, original.media_type)) {
    return not("Its text was supplied by a tool or typed, so Stemma cannot make it from the original. Copy it from wherever you keep it.");
  }
  const wanted = list(data.pages).map((p) => ({ index: Number(p.index), file: String(p.file), sha256: String(p.sha256) }));
  let closest: { differing: number[]; parts: number } | undefined;
  const failures: string[] = [];
  for (const { how, options } of settings(original.media_type, entry, base)) {
    let made;
    try {
      made = partTexts((await convertOriginal(original, { recognized: conversion.method === "ocr", ...options() })).converted);
    } catch (error) {
      if (!(error instanceof InvalidInput)) throw error;
      failures.push(error.message);
      continue;
    }
    const byFile = new Map(made.map((p) => [p.file, p]));
    const differing = wanted.filter((p) => byFile.get(p.file)?.sha256 !== p.sha256).map((p) => p.index);
    if (differing.length === 0 && made.length === wanted.length) {
      // Every part is checked before the first one is written. Only listed files are written.
      for (const part of wanted) writeProjectFile(root, `${text.directory}/${part.file}`, byFile.get(part.file)!.text);
      return `restored ${wanted.length} ${data.paged === true ? "page" : "section"} file(s) of ${where}${how ? ` (converted ${how})` : ""}. Each has the digest the manifest records.`;
    }
    if (!closest || differing.length < closest.differing.length) closest = { differing, parts: made.length };
  }
  if (!closest) return not(failures[0] ?? "The original could not be converted.");
  const now = tools();
  const changed = list(conversion.tools).filter((t) => now[String(t.name)] !== undefined && now[String(t.name)] !== t.version)
    .map((t) => `${String(t.name)} ${String(t.version)} then, ${now[String(t.name)]} now`);
  const shown = closest.differing.slice(0, 20).join(", ");
  return not([
    "The original is the recorded one, but converting it again does not give the recorded text:",
    closest.differing.length > 0 ? `${closest.differing.length} of ${wanted.length} listed parts differ (index ${shown}${closest.differing.length > 20 ? ", and more" : ""})` : "the listed parts agree",
    closest.parts !== wanted.length ? `and it gives ${closest.parts} parts where the manifest lists ${wanted.length}` : "",
    changed.length > 0 ? `. Converter versions differ: ${changed.join("; ")}` : "",
    ". The text may have been corrected or relabelled by hand: copy it from wherever you keep it, or give the page map used, in an ingest plan (--plan).",
  ].filter(Boolean).join(" ").replace(/ \./g, "."));
}
