// Serves website/dist/ on this machine only.
//   ./scripts/dev.sh preview     (set PORT to change the port)
import { join, normalize, sep } from "node:path";

const OUT = join(import.meta.dir, "dist");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 4173),
  async fetch(request) {
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const file = normalize(join(OUT, path.endsWith("/") ? `${path}index.html` : path));
    if (!file.startsWith(OUT + sep) || !(await Bun.file(file).exists())) return new Response("Not found", { status: 404 });
    return new Response(Bun.file(file), { headers: { "cache-control": "no-store" } });
  },
});
console.log(`Stemma website at http://127.0.0.1:${server.port}/ (Ctrl+C to stop)`);
