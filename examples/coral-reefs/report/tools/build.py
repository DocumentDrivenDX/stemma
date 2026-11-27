#!/usr/bin/env python3
"""Builds the report from its template, its passage records and the source files.

    ./scripts/dev.sh report          (python3 -I examples/coral-reefs/report/tools/build.py)
    ./scripts/dev.sh report-check    (the same with --check: writes nothing, fails if stale)

The passages point into the worked example's committed source files
(examples/coral-reefs/sources/); nothing outside the repository is read.

Every quotation in the output is copied from a source file by the address in a
passage record; none is typed in the template. For each passage the build:
  1. reads the passage record (made by `stemma passage capture`) or the directly
     selected range, and copies the text from the source file's page by offset;
  2. stops if the page's text digest differs from the one in the record, or if
     the copied text differs from the text the record holds;
  3. renders it: a hyphen at a line end is removed and the lines joined, unless
     the joined word is listed in keep_hyphens; other line ends become spaces;
     segments are joined with their join string; reviewed corrections are
     applied, each of which must match exactly once; listed words are set in
     italic;
  4. writes notes in Chicago style: the full form at a work's first citation,
     the short form after, the printed page, and the quoted text when the
     sentence carrying the note does not already quote it.

Outputs, all regenerated on each run: report.md, report.typ, verification.md,
and build/notes.json. The same inputs give the same bytes.
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PROJECT = ROOT.parent
sys.path.insert(0, str(HERE))
from sourcefiles import SourceFile  # noqa: E402

QUOTE = re.compile(r"\{\{q:([A-Za-z0-9-]+)\}\}")
NOTE = re.compile(r"\[\^([A-Za-z0-9,-]*)(?:\|((?:[^\]{]|\{\{q:[A-Za-z0-9-]+\}\})*))?\]")


class BuildError(Exception):
    pass


def load_sources(sources_dir):
    """Indexes the project's source files by their text ID (the manifest's record ID)."""
    by_text = {}
    for manifest in sorted(Path(sources_dir).glob("*/source.md")):
        sf = SourceFile(manifest.parent)
        by_text[sf.id] = sf
    if not by_text:
        raise BuildError(f"no source files under {sources_dir}")
    return by_text


def page_range(a, b):
    """Chicago-style inclusive numbers: 510–11, 247–48, 93–94, 899–900."""
    if not (a.isdigit() and b.isdigit()):
        return f"{a}–{b}"
    if int(a) < 100 or int(a) % 100 == 0 or len(a) != len(b):
        return f"{a}–{b}"
    keep = len(b)
    while keep > 2 and a[: len(a) - keep + 1] == b[: len(b) - keep + 1]:
        keep -= 1
    return f"{a}–{b[-keep:]}"


def span(locs):
    """One locator for several passages of a work: a page range when all are plain page numbers."""
    bases = {loc[:-2] if loc.endswith(" n") else loc for loc in locs}
    if len(bases) == 1 and len(locs) == 2:
        return f"{bases.pop()} and n"
    nums = []
    for loc in locs:
        for part in re.split(r"–", loc.rstrip("n")):
            if not part.isdigit():
                return ", ".join(locs)
        first = loc.rstrip("n").split("–")[0]
        last = loc.rstrip("n").split("–")[-1]
        if len(last) < len(first):
            last = first[: len(first) - len(last)] + last
        nums += [int(first), int(last)]
    if min(nums) == max(nums):
        return str(min(nums))
    return page_range(str(min(nums)), str(max(nums)))


def render_passage(spec, records, sources):
    """Returns the rendered quotation and what went into it."""
    pieces, locators, provenance = [], [], []
    for n, seg in enumerate(spec["segments"]):
        if "passage" in seg:
            rec = records[seg["passage"]]
            if rec["text"] not in sources:
                raise BuildError(f"{spec['id']}: the project has no source file {rec['text']}")
            sf = sources[rec["text"]]
            if sf.manifest["source"] != rec["source"] or not (PROJECT / "records/sources" / f"{rec['source']}.json").exists():
                raise BuildError(f"{spec['id']}: {rec['text']} does not belong to the source record {rec['source']} in the project")
            copied = []
            for a in rec["anchor"]:
                _front, _blocks, streams, digest = sf.part(a["index"])
                if digest != a["page_sha256"]:
                    raise BuildError(f"{spec['id']}: page {a['index']} of {rec['text']} has changed since the passage was captured")
                copied.append(streams[a["stream"]][a["start"]:a["end"]])
            exact = "\n".join(copied)
            if exact != rec["quote"]["exact"]:
                raise BuildError(f"{spec['id']}: the source file no longer gives the captured text")
            loc = rec["locator"]["value"]
            provenance.append({"passage": rec["id"], "text": rec["text"], "anchor": rec["anchor"], "locator": loc})
        else:
            r = seg["range"]
            sf = sources[r["text"]]
            _front, _blocks, streams, digest = sf.part(r["index"])
            if digest != r["page_sha256"]:
                raise BuildError(f"{spec['id']}: page {r['index']} of {r['text']} has changed since the range was selected")
            exact = streams[r["stream"]][r["start"]:r["end"]]
            loc = seg.get("locator", {}).get("value") or locators[-1]
            provenance.append({"range": r, "text": r["text"], "locator": loc, "locator_basis": seg.get("locator_basis")})
        if n > 0:
            pieces.append(seg.get("join", " "))
        pieces.append(exact)
        locators.append(loc)
    text = "".join(pieces)
    keep = set(spec.get("keep_hyphens", []))
    joined = []

    def dehyphen(m):
        word = m.group(1) + "-" + m.group(2)
        if word in keep:
            joined.append(f"{m.group(1)}-|{m.group(2)} kept as {word}")
            return word
        joined.append(f"{m.group(1)}-|{m.group(2)} joined as {m.group(1)}{m.group(2)}")
        return m.group(1) + m.group(2)

    text = re.sub(r"(\w+)-\n(\w+)", dehyphen, text)
    text = text.replace("\n", " ")
    for c in spec.get("corrections", []):
        if text.count(c["was"]) != 1:
            raise BuildError(f"{spec['id']}: correction {c['was']!r} does not match exactly once")
        text = text.replace(c["was"], c["now"])
    plain = text
    for word in spec.get("italic", []):
        if word not in text:
            raise BuildError(f"{spec['id']}: italic {word!r} not found")
        text = text.replace(word, f"*{word}*")
    seen = []
    for loc in locators:
        if loc not in seen:
            seen.append(loc)
    loc = seen[0] if len(seen) == 1 else page_range(seen[0], seen[-1])
    if spec.get("locator_suffix"):
        loc += spec["locator_suffix"] if loc[-1].isdigit() else " " + spec["locator_suffix"]
    return {"id": spec["id"], "cites": spec["cites"], "text": text, "plain": plain, "locator": loc,
            "joined": joined, "corrections": spec.get("corrections", []), "italic": spec.get("italic", []),
            "join_notes": [s["join_note"] for s in spec["segments"] if "join_note" in s], "provenance": provenance}


def build(sources_dir, check=False):
    works = json.loads((ROOT / "records/works.json").read_text(encoding="utf-8"))
    specs = json.loads((ROOT / "records/passages.json").read_text(encoding="utf-8"))
    records = {}
    for f in sorted((ROOT / "records/passages").glob("*.json")):
        rec = json.loads(f.read_text(encoding="utf-8"))
        records[rec["id"]] = rec
    sources = load_sources(sources_dir)
    passages = {s["id"]: render_passage(s, records, sources) for s in specs}
    template = (ROOT / "report.src").read_text(encoding="utf-8")

    cited_once = set()
    notes = []
    used_works = set()

    def citation(p):
        key = p["cites"]
        work = works[key]
        used_works.add(work.get("in", key))
        form = "note_short" if key in cited_once else "note_full"
        cited_once.add(key)
        return work[form].replace("{loc}", p["locator"])

    out_paragraphs = []
    for para in template.split("\n\n"):
        para = para.strip("\n")
        if para == "{{bibliography}}":
            out_paragraphs.append(para)
            continue
        quoted_since_note = set()
        result, pos = [], 0
        tokens = sorted([(m.start(), m.end(), "q", m) for m in QUOTE.finditer(para)] +
                        [(m.start(), m.end(), "n", m) for m in NOTE.finditer(para)])
        for start, end, kind, m in tokens:
            if start < pos:  # a quotation inside a note's comment, already rendered with the note
                continue
            result.append(para[pos:start])
            pos = end
            if kind == "q":
                pid = m.group(1)
                if pid not in passages:
                    raise BuildError(f"unknown passage {pid} in the template")
                quoted_since_note.add(pid)
                result.append("“" + passages[pid]["text"] + "”")
            else:
                ids = [i for i in m.group(1).split(",") if i]
                comment = m.group(2)
                if comment:
                    def comment_quote(cm):
                        if cm.group(1) not in passages:
                            raise BuildError(f"unknown passage {cm.group(1)} in a note")
                        quoted_since_note.add(cm.group(1))
                        return "“" + passages[cm.group(1)]["text"] + "”"
                    comment = QUOTE.sub(comment_quote, comment)
                parts = []
                groups = []
                for pid in ids:
                    if pid not in passages:
                        raise BuildError(f"unknown passage {pid} in a note")
                    if groups and groups[-1][0] == passages[pid]["cites"]:
                        groups[-1][1].append(pid)
                    else:
                        groups.append((passages[pid]["cites"], [pid]))
                for _key, members in groups:
                    first = passages[members[0]]
                    locs = []
                    for pid in members:
                        if passages[pid]["locator"] not in locs:
                            locs.append(passages[pid]["locator"])
                    quoted = [pid for pid in members if pid not in quoted_since_note]
                    if not quoted:
                        parts.append(citation(dict(first, locator=span(locs))) + ".")
                        continue
                    if len(locs) == 1:
                        cite = citation(first)
                        quotes = [passages[pid]["text"] for pid in quoted]
                        parts.append(cite + ": " + " ".join("“" + q + "”." for q in quotes))
                    else:
                        cite = citation(dict(first, locator=span(locs)))
                        sub = []
                        for pid in quoted:
                            sub.append("At " + passages[pid]["locator"] + ": “" + passages[pid]["text"] + "”.")
                        parts.append(cite + ". " + " ".join(sub))
                if comment:
                    parts.append(comment)
                number = len(notes) + 1
                notes.append({"number": number, "text": " ".join(parts), "passages": ids, "inline": sorted(quoted_since_note - set(ids)), "comment": comment})
                result.append(f"[^{number}]")
                quoted_since_note = set()
        result.append(para[pos:])
        out_paragraphs.append("".join(result))

    bib_keys = sorted(used_works, key=lambda k: works[k]["sort"])
    bibliography = ["## Bibliography"] + [works[k]["bib"] for k in bib_keys]
    body = []
    for para in out_paragraphs:
        if para == "{{bibliography}}":
            body.extend(bibliography)
        else:
            body.append(para)
    md = "\n\n".join(body) + "\n\n" + "\n".join(f"[^{n['number']}]: {n['text']}" for n in notes) + "\n"
    outputs = {"report.md": md, "report.typ": to_typst(body, notes), "verification.md": verification(notes, passages, works, records)}
    if check:
        stale = [name for name, text in outputs.items()
                 if not (ROOT / name).exists() or (ROOT / name).read_text(encoding="utf-8") != text]
        if stale:
            raise BuildError("out of date: " + ", ".join(stale) + " (run ./scripts/dev.sh report)")
    else:
        for name, text in outputs.items():
            (ROOT / name).write_text(text, encoding="utf-8")
        (ROOT / "build").mkdir(exist_ok=True)
        (ROOT / "build/notes.json").write_text(json.dumps({"notes": notes, "passages": passages}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    words = len(re.findall(r"[A-Za-z’'-]+", re.sub(r"\[\^\d+\]", "", "\n\n".join(p for p in body if not p.startswith("## Bibliography")).split("## Bibliography")[0])))
    return len(notes), words


# ---------- Typst ----------

TYPST_SPECIAL = re.compile(r"([\\#$*_`<>@\[\]~=/+-])")


def typst_text(s):
    """Escapes Markdown-subset text for Typst markup, keeping *italic* and links."""
    out, pos = [], 0
    for m in re.finditer(r"\*([^*]+)\*|https?://\S+?(?=[.,;)]?(?:\s|$))", s):
        out.append(TYPST_SPECIAL.sub(r"\\\1", s[pos:m.start()]))
        if m.group(1) is not None:
            out.append("_" + TYPST_SPECIAL.sub(r"\\\1", m.group(1)) + "_")
        else:
            out.append(f'#link("{m.group(0)}")')
        pos = m.end()
    out.append(TYPST_SPECIAL.sub(r"\\\1", s[pos:]))
    return "".join(out)


def to_typst(body, notes):
    by_number = {n["number"]: n["text"] for n in notes}
    lines = [
        '#set document(title: "Foundations Out of Sight")',
        '#set page(paper: "a4", margin: (x: 2.6cm, y: 2.8cm), numbering: "1")',
        '#set text(font: ("Libertinus Serif", "New Computer Modern"), size: 11pt, lang: "en")',
        "#set smartquote(enabled: false)",
        "#set par(justify: true, leading: 0.62em, first-line-indent: 1.2em, spacing: 0.62em)",
        "#show heading: set block(above: 1.4em, below: 0.8em)",
        "#show heading.where(level: 2): set text(size: 12.5pt)",
        "#show heading.where(level: 3): set text(size: 11pt, style: \"italic\", weight: \"regular\")",
        "#set footnote.entry(gap: 0.5em, indent: 0em)",
        "#show footnote.entry: set text(size: 8.6pt)",
        "",
    ]
    in_bib = False
    for para in body:
        if para.startswith("# "):
            lines.append(f'#align(center, text(size: 20pt, weight: "bold")[{typst_text(para[2:])}])')
            continue
        if para.startswith("## ") and not lines[-1].startswith("#align(center, text(size: 13pt") and para[3:].startswith("Darwin"):
            lines.append(f'#align(center, text(size: 13pt, style: "italic")[{typst_text(para[3:])}])\n#v(1.2em)')
            continue
        if para.startswith("### "):
            lines.append(f'#align(center)[#text(weight: "bold")[{typst_text(para[4:])}]]')
            continue
        if para.startswith("## "):
            in_bib = para[3:] == "Bibliography"
            if in_bib:
                lines.append("#pagebreak(weak: true)")
            lines.append("== " + typst_text(para[3:]))
            continue
        if in_bib:
            lines.append(f"#par(first-line-indent: 0em, hanging-indent: 1.5em)[{typst_text(para)}]")
            continue
        pieces, pos = [], 0
        for m in re.finditer(r"\[\^(\d+)\]", para):
            pieces.append(typst_text(para[pos:m.start()]))
            pieces.append("#footnote[" + typst_text(by_number[int(m.group(1))]) + "]")
            pos = m.end()
        pieces.append(typst_text(para[pos:]))
        lines.append("".join(pieces))
        lines.append("")
    return "\n".join(lines) + "\n"


# ---------- verification table ----------

CHECKS = ROOT / "records/checks.json"


def verification(notes, passages, works, records):
    checks = json.loads(CHECKS.read_text(encoding="utf-8"))
    rows = ["# Verification of the report’s notes", "",
            "This table is generated by `tools/build.py` from the passage records and `records/checks.json`. "
            "It is separate from the report and is not part of the publication.", "",
            "**Who checked.** Every comparison below was made by an AI model (claude-opus-5-5) reading page images "
            "drawn from the stored PDFs with `examples/coral-reefs/tools/render-pages.swift` at 900 pixels wide. "
            "**No person has reviewed any quotation, page number, correction or bibliographic detail.**", "",
            "**What was compared.** The rendered quotation, word by word and punctuation included, with the page image. "
            "Not treated as textual differences: line breaks; spacing before punctuation; the glyph shape of quotation marks "
            "and apostrophes, which follows the text layer; small capitals, given in ordinary capitals and lower case. "
            "Line-end hyphens were joined unless listed as kept; each join is listed and was judged against the image.", "",
            "| Note | Passage | Source file, page index, characters | Printed page | How verified | Changes from the text layer |",
            "|---|---|---|---|---|---|"]
    for n in notes:
        if not n["passages"]:
            rows.append(f"| {n['number']} | (comment only) | | | | |")
        for pid in n["inline"] + n["passages"]:
            p = passages[pid]
            addr = []
            for pr in p["provenance"]:
                if "anchor" in pr:
                    for a in pr["anchor"]:
                        addr.append(f"`{pr['text']}/{a['index']}:{a['stream']}:{a['start']}-{a['end']}` (record `{pr['passage']}`)")
                else:
                    r = pr["range"]
                    addr.append(f"`{r['text']}/{r['index']}:{r['stream']}:{r['start']}-{r['end']}` (selected directly; no passage record)")
            chk = checks.get(pid)
            if not chk:
                raise BuildError(f"{pid}: no entry in records/checks.json")
            changes = [f"correction “{c['was']}” → “{c['now']}”, read from the page image by {c['by']}, not reviewed by a person" for c in p["corrections"]]
            changes += p["joined"] + [f"italic: {w} (as on the page)" for w in p["italic"]] + p["join_notes"]
            for pr in p["provenance"]:
                if pr.get("locator_basis"):
                    changes.append("locator: " + pr["locator_basis"])
            rows.append(f"| {n['number']} | {pid}{' (quoted in the text)' if pid in n['inline'] else ''} | {'<br>'.join(addr)} | {p['locator']} | {chk} | {'; '.join(changes) or 'none'} |")
    rows += ["", "## Bibliographic details", "",
             "Each entry was read from page images of the stored copy, by the same model, not by a person.", "",
             "| Work | Pages read |", "|---|---|"]
    for key, w in works.items():
        if key.startswith("_"):
            continue
        rows.append(f"| {key} | {w['basis']} |")
    return "\n".join(rows) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", default=str(PROJECT / "sources"), help="the project's source files (default: the worked example's sources/)")
    ap.add_argument("--check", action="store_true", help="write nothing; fail if report.md, report.typ or verification.md would change")
    args = ap.parse_args()
    try:
        count, words = build(args.sources, args.check)
    except (BuildError, ValueError) as e:
        print(f"build stopped: {e}", file=sys.stderr)
        return 1
    if args.check:
        print(f"report.md, report.typ and verification.md are current: {count} notes")
    else:
        print(f"wrote report.md, report.typ, verification.md: {count} notes, about {words} words before the notes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
