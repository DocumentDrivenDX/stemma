// The generated arras module and graph file (CONTRACT-005 B, F). Both come from
// one projection, so every name the graph uses is one the module declares.
import { canonical } from "@stemma/records";
import {
  checkName, compareOrder, ExportMappingError, type Projection, type Property, SEARCHED_TYPES, typeWords,
} from "./project.ts";

export const MODULE_NAME = "stemma";
export const UMF_VERSION = "0.10.0";
export const VIEW_VERSION = "0.1.0";

/** Long text, shown as plain paragraphs. Every other field is plain text or a list: never a link and never Markdown. */
const PROSE = new Set([
  "text", "body", "quoteExact", "statement", "definition", "explanation", "note", "quoted", "passageText", "claimText",
  "response", "reason", "quotation", "sentenceText", "warrant", "summary", "stemmaNotice", "searchText",
]);

const LABELS: Record<string, string> = {
  stemmaStates: "Stemma states", stemmaNotice: "What this is", searchText: "Search index (folded text)", recordId: "Record ID",
  verdict: "Model verdict", heading: "Heading",
};

const TYPE_LABELS: Record<string, [string, string]> = {
  SupportRecord: ["Support record (model judgment)", "Support records (model judgments)"],
  Search: ["Search", "Searches"], Agent: ["Agent", "Agents"], SourceText: ["Source file", "Source files"],
};

const words = (name: string): string => {
  const out = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return out.charAt(0).toUpperCase() + out.slice(1);
};
const short = (text: string) => (text.length <= 60 ? text : `${text.slice(0, 59)}…`);

const plural = (label: string) => /(s|x|ch|sh)$/.test(label) ? `${label}es` : /[^aeiou]y$/.test(label) ? `${label.slice(0, -1)}ies` : `${label}s`;

/** Text safe to put in a script element: `<` only occurs inside JSON strings, where this is the same character. */
export const jsonText = (value: unknown): string => canonical(value).replaceAll("<", "\\u003c");

export function moduleDocument(projection: Projection): object {
  const names = new Set<string>();
  const unique = (name: string) => {
    if (names.has(name.toLowerCase())) throw new ExportMappingError(`Two relationship fields are named ${name}.`);
    names.add(name.toLowerCase());
    return checkName(name);
  };
  const elements: object[] = [];
  for (const type of projection.types) {
    checkName(type);
    const properties = [...projection.properties.get(type)!].sort(([, a], [, b]) => compareOrder(a.order, b.order));
    const field = (name: string) => `${type}.${name}`;
    // At most eight sections of 24 properties; what is left over arras shows under "More".
    const shown = properties.map(([name]) => name).filter((name) => name !== "heading" && name !== "searchText");
    const sections: { label: string; properties: string[]; collapsed?: boolean }[] = [];
    for (let at = 0; at < shown.length && sections.length < 7; at += 24) {
      sections.push({ label: sections.length === 0 ? "Details" : `Details, part ${sections.length + 1}`, properties: shown.slice(at, at + 24) });
    }
    if (projection.properties.get(type)!.has("searchText")) sections.push({ label: "Search index", properties: ["searchText"], collapsed: true });
    const [label, pluralLabel] = TYPE_LABELS[type] ?? [typeWords(type), plural(typeWords(type))];
    elements.push({
      id: type, kind: "record", name: type,
      members: properties.map(([name]) => ({ module: MODULE_NAME, element: field(name) })),
      extensions: {
        "umf.ddd": {
          kind: "entity",
          fields: Object.fromEntries(properties.map(([name, p]: [string, Property]) => [name, {
            type: { kind: "scalar", name: p.type }, cardinality: p.many ? "many" : name === "recordId" ? "one" : "optional",
          }])),
          identity: { fields: ["recordId"], scope: "context" },
        },
        "arras.view": {
          label, pluralLabel, title: "{heading}", sections,
          // Declared for every type: without this, arras would search any type it can title.
          search: SEARCHED_TYPES.includes(type) ? ["searchText"] : [],
        },
      },
      keys: [{ id: "identity", name: "Identity", primary: true, fields: [{ module: MODULE_NAME, element: field("recordId") }] }],
    });
    for (const [name, p] of properties) {
      elements.push({
        id: field(name), kind: "field", name, nullability: name === "recordId" ? "required" : "absent-allowed",
        cardinality: p.many ? "many" : "one", scalarType: p.type,
        extensions: {
          "arras.view": {
            // arras caps all view terms in a document at 128 KiB, so what it would do anyway is not repeated.
            ...(LABELS[name] ? { label: LABELS[name] } : {}),
            // Said for every single string: left alone, arras shows some as links, badges or dates by their names.
            ...(p.type === "string" && !p.many ? { format: PROSE.has(name) ? "prose" : "text" } : {}),
            hideWhenEmpty: true,
          },
        },
      });
    }
  }
  const relationships = projection.relationships.map((r) => {
    const via = words(r.path.map((p) => p.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())).map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(""));
    return {
      id: r.name, name: unique(r.name), inverse: unique(`${r.name}Inverse`),
      source: [{ module: MODULE_NAME, element: r.sourceType }],
      target: [{ module: MODULE_NAME, element: r.targetType, key: "identity" }],
      sourceMultiplicity: { min: 0, max: "*" }, targetMultiplicity: { min: 0, max: "*" },
      targetLifecycle: "independent", directed: true,
      extensions: {
        "arras.view": {
          label: short(`${via}: ${typeWords(r.targetType).toLowerCase()}`),
          inverseLabel: short(`${typeWords(r.sourceType)}, by its ${via.toLowerCase()}`),
          hideWhenEmpty: true,
        },
      },
    };
  });
  return {
    umf: UMF_VERSION, id: MODULE_NAME,
    vocabularies: { "umf.ddd": { version: "0.1.0" }, "arras.view": { version: VIEW_VERSION } },
    extensions: {},
    modules: [{
      id: MODULE_NAME, namespace: MODULE_NAME,
      extensions: {
        "umf.ddd": { kind: "bounded-context", terms: [] },
        "arras.view": { title: "Evidence graph", description: "Records of one Stemma project, as they were when exported. Support results are recorded model judgments, not verification." },
      },
      elements, relationships,
    }],
  };
}

export function graphDocument(projection: Projection): object {
  return {
    format: "arras.graph", version: 1, module: MODULE_NAME, complete: true,
    records: [
      ...projection.entities.map((e) => ({ type: e.type, key: e.key, properties: e.properties })),
      ...projection.links.map((l) => ({ relationship: l.relationship, source: l.source, target: l.target })),
    ],
  };
}
