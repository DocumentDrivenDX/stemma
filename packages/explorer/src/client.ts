// arras only lowers the case of a search, so the query is folded here the way
// the exporter folded the search text (the `search-fold` profile).
import type { createStaticClient } from "@documentdrivendx/arras-ui/static";
import { searchFold } from "../../records/src/search-fold.ts";

type Client = ReturnType<typeof createStaticClient>;

export function foldingClient(client: Client): Client {
  return {
    ...client,
    moduleQuery: (module, query, variables) => {
      const text = (variables as { text?: unknown } | undefined)?.text;
      if (typeof text !== "string" || !/\b_search\b/.test(query)) return client.moduleQuery(module, query, variables);
      const folded = searchFold(text);
      // arras refuses a query shorter than two characters, which folding can make.
      return client.moduleQuery(module, query, { ...(variables as object), text: Array.from(folded).length < 2 ? text : folded });
    },
  };
}
