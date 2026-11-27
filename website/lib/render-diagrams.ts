// Draws the diagrams of lib/graphs.ts with umf-visual 0.7.0 and the Lini 1.1.0
// runtime it carries. Only website/generate.ts imports this, and only when it
// draws: loading umf-visual takes several seconds. The renderer is the
// library's own, which checks the runtime files' hashes, fails on any Lini
// diagnostic, a warning included, and checks the SVG. It fetches the runtime
// over HTTP, so a server on this computer hands it the installed files.
import { dirname, join, sep } from "node:path";
import { createVisualDocument } from "@documentdrivendx/umf-visual";
import { renderLiniPresentation } from "@documentdrivendx/umf-visual/renderers/lini";
import { type Diagram, DIAGRAMS, LONGEST_LABEL } from "./graphs.ts";
import { treat } from "./svg.ts";

/** The visual model version that lays boxes on a grid. */
const MODEL = "1.4.0";

async function draw(d: Diagram, order: string[] | undefined, columns: number, key: string, runtimeBaseUrl: string): Promise<string> {
  for (const node of d.nodes) {
    if ([...node.label].length > LONGEST_LABEL) throw new Error(`${d.name}: the label “${node.label}” is longer than ${LONGEST_LABEL} characters`);
  }
  const document = createVisualDocument({
    id: d.name, kind: "flow", form: "network", title: d.title, question: d.title,
    nodes: d.nodes.map((n) => ({ id: n.id, label: n.label, ...(n.shape ? { shape: n.shape } : {}), ...(n.focus ? { emphasis: "focus" as const } : {}) })),
    edges: d.edges.map((e, i) => ({ id: `e${i + 1}`, from: e.from, to: e.to })),
    ...(order ? { layout: { kind: "grid" as const, columns, order } } : {}),
  }, `visual:${key}`, MODEL);
  const result = await renderLiniPresentation(document, { direction: order ? "TB" : "LR", runtimeBaseUrl });
  if (!result.ok) throw new Error(`${key} did not draw: ${JSON.stringify(result.diagnostics)}`);
  const native = new Map(result.elementMap.filter((e) => e.kind === "node").map((e) => [e.logicalId, e.nativeId]));
  const id = (logical: string) => {
    const found = native.get(logical);
    if (!found) throw new Error(`${key}: no box ${logical}`);
    return found;
  };
  return treat(result.svg, {
    key: `dgm-${key}`, title: d.title, desc: d.desc,
    nodes: d.nodes.map((n) => ({ native: id(n.id), label: n.label, ...(n.focus ? { focus: true } : {}), ...(n.doubled ? { doubled: true } : {}) })),
    opposing: d.edges.filter((e) => e.opposing).map((e) => ({ from: id(e.from), to: id(e.to) })),
  });
}

/** Every drawing, by file name. */
export async function renderDiagrams(): Promise<Map<string, string>> {
  const runtime = dirname(Bun.resolveSync("@documentdrivendx/umf-visual/renderers/lini/assets/lini_wasm.js", import.meta.dir));
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    fetch(request) {
      const file = join(runtime, new URL(request.url).pathname.slice(1));
      return file.startsWith(runtime + sep) ? new Response(Bun.file(file)) : new Response("Not found", { status: 404 });
    },
  });
  try {
    const drawn = new Map<string, string>();
    for (const diagram of DIAGRAMS.map((make) => make())) {
      const { layout, name } = diagram;
      if (layout.kind === "flow") {
        drawn.set(`${name}.svg`, await draw(diagram, undefined, 0, name, server.url.href));
      } else {
        drawn.set(`${name}.svg`, await draw(diagram, layout.order, layout.columns, name, server.url.href));
        drawn.set(`${name}-narrow.svg`, await draw(diagram, layout.narrow, 1, `${name}-narrow`, server.url.href));
      }
    }
    return drawn;
  } finally {
    server.stop(true);
  }
}
