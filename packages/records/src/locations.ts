// Other places an upstream's original can be had from (FR-98; CONTRACT-001 G).
// A location is a reference: an address, or the author's own name for a private
// copy. It never holds a path on a machine.
import type { Json, JsonObject } from "./json.ts";

/** Letters, digits and a few marks: no path separator and no colon, so a label is never a path or an address. */
const LABEL = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'()-]{0,79}$/u;

export function isLocationLabel(value: string): boolean {
  return LABEL.test(value);
}

/** An http or https address with no user name or password in it. */
export function isLocationAddress(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

/** Whether an address carries a user name or password, which a record never keeps. */
export function hasCredentials(value: string): boolean {
  try {
    const url = new URL(value);
    return url.username !== "" || url.password !== "";
  } catch {
    return false;
  }
}

/** The positions of the entries that break a rule of the location list. */
export function badLocations(locations: Json[]): number[] {
  const seen = new Set<string>();
  return locations.flatMap((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return []; // reported by the shape check
    const { kind, url, label } = entry as JsonObject;
    const kept = kind === "private";
    const name = kept ? label : url;
    const shaped = kept ? url === undefined && typeof label === "string" && isLocationLabel(label)
      : label === undefined && typeof url === "string" && isLocationAddress(url);
    const key = `${kept ? "label" : "url"} ${String(name)}`;
    const repeated = seen.has(key);
    seen.add(key);
    return shaped && !repeated ? [] : [i];
  });
}

/**
 * The addresses to ask for an upstream's original, in order: the address it was
 * retrieved from, then each location that has one. An address is asked once.
 */
export function addressesOf(upstream: JsonObject): { url: string; kind?: string }[] {
  const locations = (Array.isArray(upstream.locations) ? upstream.locations : []) as JsonObject[];
  const listed = locations.flatMap((l) => (typeof l.url === "string" ? [{ url: l.url, kind: String(l.kind) }] : []));
  const first = typeof upstream.url === "string" && upstream.url !== "" ? [{ url: upstream.url }] : [];
  return [...first, ...listed].filter((a, i, all) => all.findIndex((b) => b.url === a.url) === i);
}
