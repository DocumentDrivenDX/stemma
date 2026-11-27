// The website's generated diagrams: what the SVG treatment refuses, what the
// committed drawings hold, and that only the docs run loads the renderer. That
// the committed files match a fresh drawing is in website.test.ts. Nothing here
// loads umf-visual.
import { describe, expect, test } from "bun:test";
import { cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { exampleDir } from "../website/lib/example.ts";
import { figure } from "../website/lib/figures.ts";
import { DIAGRAMS, evidence, files, LONGEST_LABEL } from "../website/lib/graphs.ts";
import { assertSafe, type Treatment, treat } from "../website/lib/svg.ts";
import { ROOT, temporary } from "./helpers.ts";

const DRAWN = join(ROOT, "website/generated/diagrams");

/** A drawing in the shape Lini writes: two boxes and a line between them. */
const raw = (extra = "", nodeStyle = ' style="stroke-width: 2; font-family: Arial"') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -100 400 200" width="400" height="200" class="lini lini-scope-0a1b2c3d">
  <style>@layer lini.defaults { :root { --lini-fill: #ffffff; } }</style>
  <defs/>
  <g class="lini-scene">
    <g class="lini-node lini-group lini-block" data-id="visual" style="fill: none; stroke: none; stroke-width: 0; stroke-dasharray: 3,2.5" transform="translate(0,0)">
      <rect x="-190" y="-90" width="380" height="180" rx="8" ry="8"/>
      <g class="lini-node lini-note lini-path" data-id="n1"${nodeStyle} transform="translate(-80,0)">
        <path d="M -40 -20 L 40 -20 L 40 20 L -40 20 Z"/>
        <g class="lini-node lini-path" style="fill: var(--lini-stroke); stroke: none" transform="translate(0,0)">
          <path d="M 30 -20 L 40 -10 L 30 -10 Z"/>
        </g>
        <text class="lini-text" x="0" y="0">A note</text>
      </g>
      <g class="lini-node lini-box lini-block" data-id="n2" transform="translate(80,0)">
        <rect x="-40" y="-20" width="80" height="40" rx="8" ry="8"/>
        <text class="lini-text" x="0" y="0">Thesis</text>
      </g>
      <g class="lini-node lini-caption lini-block" transform="translate(-180,-95)">
        <rect x="-4" y="-6" width="8" height="12"/>
        <text class="lini-text" x="0" y="0">Title drawn by the renderer</text>
      </g>${extra}
    </g>
  </g>
  <g class="lini-links">
    <g class="lini-link lini-style-e1" data-from="visual.n1" data-to="visual.n2">
      <path d="M -40 0 L 31 0"/>
      <polygon class="lini-marker lini-marker-arrow" points="40,0 31,4.5 31,-4.5"/>
    </g>
  </g>
</svg>
`;

const treatment: Treatment = {
  key: "dgm-sample", title: "A sample & its title", desc: "Two boxes.",
  nodes: [{ native: "n1", label: "A note" }, { native: "n2", label: "Thesis", focus: true, doubled: true }],
  opposing: [{ from: "n1", to: "n2" }],
};

describe("the SVG treatment", () => {
  const out = treat(raw(), treatment);

  test("names the drawing and describes it for a screen reader", () => {
    expect(out).toContain('role="img" aria-labelledby="dgm-sample-title dgm-sample-desc"');
    expect(out).toContain('<title id="dgm-sample-title">A sample &amp; its title</title>');
    expect(out).toContain('<desc id="dgm-sample-desc">Two boxes.</desc>');
  });

  test("takes out the renderer's stylesheet, font and title caption, and trims the view box", () => {
    for (const gone of ["<style", "<defs", "Arial", "lini-scope", "lini-style", "Title drawn by the renderer", "#ffffff"]) expect(out).not.toContain(gone);
    expect(out).toContain('viewBox="-162 -62 324 124" width="324" height="124"');
    expect(out).toContain("fill: var(--stm-color-line-strong)");
  });

  test("marks the thesis with a double border and the opposing line with a bar", () => {
    expect(out).toContain('class="lini-node lini-box lini-block stm-focus" data-id="n2"');
    expect(out).toContain('class="stm-inner"');
    expect(out).toContain('class="lini-link stm-opposing"');
    expect(out).toContain('class="stm-bar"');
    expect(out).not.toContain("<polygon");
  });

  test("an unknown color, class or style property fails", () => {
    expect(() => treat(raw("", ' style="fill: #173f59"'), treatment)).toThrow("unknown color");
    expect(() => treat(raw('<g class="lini-surprise"></g>'), treatment)).toThrow("unknown class");
    expect(() => treat(raw("", ' style="opacity: 0.5"'), treatment)).toThrow("unknown style property");
    expect(() => treat(raw('<rect x="0" y="0" width="1" height="1" fill="#abcdef"/>'), treatment)).toThrow("color that is not a token");
  });

  test("a script, a link, an outside reference, a handler or a local path fails", () => {
    const home = ["", "Users", "someone", "x"].join("/");
    for (const [bad, what] of [
      ["<script>1</script>", "element"], ["<image/>", "element"], ['<g onload="x()"></g>', "event handler"],
      ['<g href="#x"></g>', "a link"], ['<path d="url(x.svg#a)"/>', "another file"], ["<text>https://example.org</text>", "web address"],
      [`<text>${home}</text>`, "local path"],
    ] as const) expect(() => assertSafe(`<svg xmlns="http://www.w3.org/2000/svg">${bad}</svg>`)).toThrow(what);
  });

  test("a box without its label, or a line outside the trimmed drawing, fails", () => {
    expect(() => treat(raw(), { ...treatment, nodes: [{ native: "n1", label: "Another" }] })).toThrow("shows");
    expect(() => treat(raw().replace("M -40 0 L 31 0", "M -185 0 L 31 0"), treatment)).toThrow("outside");
  });
});

describe("the committed diagrams", () => {
  const diagrams = DIAGRAMS.map((make) => make());

  test("are one file for each layout of each definition, and no other", () => {
    expect(readdirSync(DRAWN).sort()).toEqual(diagrams.flatMap(files).sort());
  });

  test("are safe, named, themed by the page, and show every box", () => {
    const ids: string[] = [];
    for (const d of diagrams) for (const file of files(d)) {
      const svg = readFileSync(join(DRAWN, file), "utf8");
      assertSafe(svg);
      expect(svg).toContain('role="img"');
      expect(svg).toMatch(/<title id="[^"]+">[^<]+<\/title>\s*<desc id="[^"]+">[^<]+<\/desc>/);
      expect(svg).not.toContain("<style");
      expect(svg.match(/<text /g)).toHaveLength(d.nodes.length);
      ids.push(...[...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("have short labels, and a text equivalent holding every box and every line", () => {
    for (const d of diagrams) {
      const text = d.text.entries.map((e) => `${e.term} ${e.says}`).join("\n").toLowerCase();
      for (const node of d.nodes) {
        expect([...node.label].length, node.label).toBeLessThanOrEqual(LONGEST_LABEL);
        expect(text, `${d.name}: ${node.label}`).toContain(node.label.toLowerCase());
      }
      const label = new Map(d.nodes.map((n) => [n.id, n.label]));
      for (const edge of d.edges) {
        // A chain's lines are the order of its numbered list; the report build's inputs meet in one box.
        if (!d.text.ordered) expect(text, `${d.name}: ${edge.from} to ${edge.to}`).toContain(`${label.get(edge.from)} →`.toLowerCase());
      }
      if (d.text.ordered) expect(d.edges.map((e) => [e.from, e.to])).toEqual(d.nodes.slice(1).map((n, i) => [d.nodes[i]!.id, n.id]));
    }
  });

  test("the page is refused a drawing that lacks a box of its definition", () => {
    const [first] = diagrams;
    expect(() => figure({ ...first!, nodes: [...first!.nodes, { id: "new", label: "A new box" }] }, "x")).toThrow("A new box");
  });
});

describe("the drawing of an example's evidence", () => {
  test("takes its stances from the records and draws only a contradicting note as opposing", () => {
    const drawn = evidence();
    expect(drawn.edges.filter((e) => e.opposing)).toHaveLength(1);
    expect(drawn.nodes.find((n) => n.doubled)?.label).toBe("Thesis");
    expect(drawn.text.entries[0]!.says).toStartWith("PostgreSQL");
  });

  test("fails when a record's stance has changed", () => {
    const copy = join(temporary(), "example");
    cpSync(join(exampleDir("postgres-web-apps"), "records"), join(copy, "records"), { recursive: true });
    const folder = join(copy, "records/attestations");
    const file = readdirSync(folder).map((f) => join(folder, f)).find((f) => readFileSync(f, "utf8").includes('"contradicts"'))!;
    writeFileSync(file, readFileSync(file, "utf8").replace('"contradicts"', '"supports"'));
    expect(() => evidence(copy)).toThrow("not contradicts");
  });
});

describe("the renderer", () => {
  test("is imported by one module, which only the docs run imports, and only when it draws", () => {
    const tracked = Bun.spawnSync(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "packages", "scripts", "website", "tests"], { cwd: ROOT })
      .stdout.toString().split("\0").filter((f) => /\.(ts|tsx)$/.test(f));
    const importing = (pattern: RegExp) => tracked.filter((f) => pattern.test(readFileSync(join(ROOT, f), "utf8"))).sort();
    expect(importing(/(from\s+|import\(\s*)["']@(documentdrivendx\/umf-visual|umf\/core)/)).toEqual(["website/lib/render-diagrams.ts"]);
    expect(importing(/(from\s+|import\(\s*)["'][./]+(lib\/)?render-diagrams\.ts["']/)).toEqual(["website/generate.ts"]);
    expect(readFileSync(join(ROOT, "website/generate.ts"), "utf8")).not.toMatch(/^import .*render-diagrams/m);
  });
});
