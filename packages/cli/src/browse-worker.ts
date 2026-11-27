// The process that holds the data `browse` serves (CONTRACT-005 M). It builds
// the export from the record files, loads it into arras's static client, and
// answers the calls the command passes to it. The command starts it and it ends
// with the command. It opens no listener and gets no secret.
import { dataIdentity, exportBlockers, servedData } from "@stemma/graph";
import { manuscriptView } from "@stemma/publish";
import { answersOf, serveSnapshot } from "@stemma/server";
import { CommandError, openCorpus, VERSION } from "./context.ts";
import { blockedMessage } from "./graph.ts";

function readable(root: string) {
  const corpus = openCorpus(root);
  const blockers = exportBlockers(corpus);
  if (blockers.length > 0) throw new CommandError(3, "project_unreadable", blockedMessage(blockers), blockers.map((b) => b.path));
  return corpus;
}

serveSnapshot({
  async build(root) {
    // The project as read is let go once the data is made from it.
    const data = (() => {
      const corpus = readable(root);
      const include = corpus.settings.data?.bibliography_include;
      // `graph` does not import `publish`: the report builder reaches it here.
      return servedData(corpus, { version: VERSION, manuscript: (exported) => manuscriptView(corpus, Array.isArray(include) ? include.map(String) : [], exported) });
    })();
    const answer = await answersOf(data);
    Bun.gc(true);
    return { built: { data_identity: data.data_identity, entries: data.banner.counts.entities, warnings: data.banner.warnings }, answer };
  },
  async identity(root) {
    const identity = dataIdentity(readable(root)).data_identity;
    Bun.gc(true);
    return identity;
  },
});
