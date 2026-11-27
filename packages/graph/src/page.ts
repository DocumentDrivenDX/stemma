// Fills the page template built with Stemma. The data goes into script elements
// of type application/json, whose text the browser neither runs nor changes.

/** The places in the template, by the name of what goes there. */
export const PLACEHOLDERS: Record<string, string> = {
  banner: "__STEMMA_BANNER_JSON__", stemma: "__STEMMA_MODULE_JSON__", graph: "__STEMMA_GRAPH_JSON__", sourceviews: "__STEMMA_SOURCEVIEWS_JSON__",
};

export function fillPage(template: string, data: Record<string, string>): string {
  const names = new Map(Object.entries(PLACEHOLDERS).map(([name, mark]) => [mark, name]));
  const used = new Set<string>();
  // One pass with a function: a string replacement would expand `$&` found in a record,
  // and text already put in is never looked at again.
  const page = template.replace(new RegExp([...names.keys()].join("|"), "g"), (mark) => {
    const name = names.get(mark)!;
    const text = data[name];
    if (text === undefined || used.has(name)) throw new Error(`The page template does not hold ${mark} exactly once.`);
    if (text.includes("<")) throw new Error(`The ${name} data holds an unescaped "<".`);
    used.add(name);
    return text;
  });
  if (used.size !== names.size) throw new Error("The page template lacks a place for its data.");
  return page;
}
