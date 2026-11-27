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
