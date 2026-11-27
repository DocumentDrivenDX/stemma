// Which record the arras browser is showing. arras keeps its own routing in the
// URL fragment: its location stays uncontrolled, the fragment is read with its
// own parser, and `onLocation` tells of the moves that rewrite the fragment
// without a `hashchange`.
import { type ExploreLocation, parseExplore } from "@documentdrivendx/arras-ui/browser";
import { useCallback, useEffect, useState } from "react";
import type { SourceRoute } from "./SourcePanel.tsx";

const here = (): ExploreLocation | undefined => {
  const parsed = parseExplore(window.location.hash);
  return parsed.kind === "explore" ? parsed.loc : undefined;
};

export function sourceRouteOf(at: ExploreLocation | undefined, module: string): SourceRoute | undefined {
  if (!at || at.module !== module || at.history || !at.key || (at.type !== "Citation" && at.type !== "Passage")) return undefined;
  return { type: at.type, id: at.key };
}

export function useLocationOfBrowser(): [ExploreLocation | undefined, (to: ExploreLocation) => void] {
  const [at, setAt] = useState(here);
  useEffect(() => {
    const update = () => setAt(here());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  // Called before arras writes the fragment, so the move itself is what to keep.
  const onLocation = useCallback((to: ExploreLocation) => setAt(to), []);
  return [at, onLocation];
}

// The manuscript's own routes. The record browser is not mounted on them, so
// arras's routing never reads one.
export type ManuscriptRoute =
  | { kind: "text" }
  | { kind: "quotation"; id: string }
  | { kind: "citation"; note: number; index: number }
  | { kind: "source"; id: string };

export function manuscriptHref(route: ManuscriptRoute): string {
  if (route.kind === "text") return "#/manuscript";
  const rest = route.kind === "citation" ? `${route.note}/${route.index}` : encodeURIComponent(route.id);
  return `#/manuscript/${route.kind}/${rest}`;
}

/** The manuscript route a fragment names, or nothing when it is the record browser's. */
export function manuscriptRouteOf(hash: string): ManuscriptRoute | undefined {
  const [first, second, third, fourth, ...more] = hash.replace(/^#\/?/, "").split("/");
  if (first !== "manuscript") return undefined;
  const text: ManuscriptRoute = { kind: "text" };
  if (more.length > 0 || !third) return text;
  if (second === "citation") {
    return /^\d+$/.test(third) && /^\d+$/.test(fourth ?? "") ? { kind: "citation", note: Number(third), index: Number(fourth) } : text;
  }
  if ((second !== "quotation" && second !== "source") || fourth !== undefined) return text;
  try {
    return { kind: second, id: decodeURIComponent(third) };
  } catch {
    return text;
  }
}

// The served page's Search view. Its text is in the fragment, which no request
// carries, so that Back returns to the same page of results.
export interface SearchRoute {
  type: string | undefined;
  /** From 1. */
  page: number;
  text: string;
}

export function searchHref({ type, page, text }: SearchRoute): string {
  return text === "" ? "#/search" : `#/search/${type === undefined ? "all" : encodeURIComponent(type)}/${page}/${encodeURIComponent(text.toWellFormed())}`;
}

/** The search a fragment names, or nothing when it is another view's. */
export function searchRouteOf(hash: string): SearchRoute | undefined {
  const [first, type, page, text, ...more] = hash.replace(/^#\/?/, "").split("/");
  if (first !== "search") return undefined;
  const none: SearchRoute = { type: undefined, page: 1, text: "" };
  if (more.length > 0 || !type || !/^[1-9]\d{0,8}$/.test(page ?? "") || !text) return none;
  try {
    return { type: type === "all" ? undefined : decodeURIComponent(type), page: Number(page), text: decodeURIComponent(text) };
  } catch {
    return none;
  }
}

/** A record's page in the record browser. */
export const recordHref = (type: string, key: string): string => `#/explore/stemma/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;

export function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return hash;
}
