"""Read Stemma source files (CONTRACT-007): page parts, text streams, text digests.

An independent reading of the format, used to copy passage text out of the
source files by address and to confirm that each page is the one the address
was taken from. Standard library only.
"""
import hashlib
import json
import re
from pathlib import Path

MAIN_ROLES = ["undetermined", "paragraph", "heading", "blockquote", "list-item", "table", "caption"]
NOTE_ROLES = ["footnote"]
FURNITURE_ROLES = ["running-head", "folio", "boilerplate"]

INLINE = re.compile(r'<!--stemma:(fnref|uncertain|corrected)((?: [a-z]+="[^"<>\n]*")*)-->([^<]*)<!--/stemma:\1-->')
BLOCK_LINE = re.compile(r'^<!-- stemma:block((?: [a-z]+="[^"<>\n]*")*) -->$')
ATTR = re.compile(r' ([a-z]+)="([^"]*)"')


def _decode_value(v):
    return re.sub(r"&(amp|quot|lt|gt);", lambda m: {"amp": "&", "quot": '"', "lt": "<", "gt": ">"}[m.group(1)], v)


def _decode_text(t):
    return re.sub(r"&(lt|amp);", lambda m: "<" if m.group(1) == "lt" else "&", t)


def _trim_lines(t):
    t = re.sub(r"^(?:[ \t]*\n)+", "", t)
    return re.sub(r"(?:\n[ \t]*)+\Z", "", t)


def read_part(path):
    text = Path(path).read_text(encoding="utf-8").replace("\r\n", "\n")
    if not text.startswith("---\n"):
        raise ValueError(f"{path}: front matter missing")
    end = text.index("\n---\n", 3)
    front = json.loads(text[4:end + 1])
    body = text[end + 5:]
    blocks, current = [], None
    for line in body.split("\n"):
        m = BLOCK_LINE.match(line)
        if m:
            if current is not None:
                current["content"] = _trim_lines("\n".join(current.pop("lines")))
                blocks.append(current)
            attrs = {k: _decode_value(v) for k, v in ATTR.findall(m.group(1))}
            current = {"role": attrs.get("role", ""), "attrs": attrs, "lines": []}
        elif current is not None:
            current["lines"].append(line)
        elif line.strip():
            raise ValueError(f"{path}: text outside a block")
    if current is not None:
        current["content"] = _trim_lines("\n".join(current.pop("lines")))
        blocks.append(current)
    return front, blocks


def block_text(block):
    plain = INLINE.sub(lambda m: "" if m.group(1) == "fnref" else m.group(3), block["content"])
    if block["role"] == "table":
        rows = []
        for line in plain.split("\n"):
            if "-" in line and re.fullmatch(r"[\s|:-]+", line):
                continue
            cells = re.split(r"(?<!\\)\|", re.sub(r"(?<!\\)\|$", "", re.sub(r"^\|", "", line.strip())))
            rows.append(" ".join(c.strip().replace("\\|", "|") for c in cells))
        plain = "\n".join(rows)
    return _decode_text(plain)


def streams(blocks):
    def of(roles):
        return "\n".join(t for t in (block_text(b) for b in blocks if b["role"] in roles) if t != "")
    return {"main": of(MAIN_ROLES), "notes": of(NOTE_ROLES), "furniture": of(FURNITURE_ROLES)}


def _canonical(value, indent=""):
    """CONTRACT-001 D canonical JSON for the objects and strings used here."""
    if isinstance(value, str):
        return json.dumps(value.replace("\r\n", "\n").replace("\r", "\n"), ensure_ascii=False)
    if isinstance(value, dict):
        if not value:
            return "{}"
        inner = indent + "  "
        keys = sorted(value)
        return "{\n" + ",\n".join(f"{inner}{json.dumps(k, ensure_ascii=False)}: {_canonical(value[k], inner)}" for k in keys) + f"\n{indent}}}"
    return json.dumps(value, ensure_ascii=False)


def text_digest(blocks):
    s = streams(blocks)
    data = _canonical({"furniture": s["furniture"], "main": s["main"], "notes": s["notes"]}) + "\n"
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


class SourceFile:
    """One source directory: its manifest and its page parts."""

    def __init__(self, directory):
        self.directory = Path(directory)
        manifest = (self.directory / "source.md").read_text(encoding="utf-8")
        end = manifest.index("\n---\n", 3)
        self.manifest = json.loads(manifest[4:end + 1])
        self.id = self.manifest["id"]
        self._parts = {}

    def part(self, index):
        if index not in self._parts:
            entry = next(p for p in self.manifest["pages"] if p["index"] == index)
            path = self.directory / entry["file"]
            raw = path.read_bytes().decode("utf-8").replace("\r\n", "\n")
            if hashlib.sha256(raw.encode("utf-8")).hexdigest() != entry["sha256"]:
                raise ValueError(f"{path}: file differs from the manifest")
            front, blocks = read_part(path)
            self._parts[index] = (front, blocks, streams(blocks), text_digest(blocks))
        return self._parts[index]


def resolve(anchor_list, source):
    """Copies the text an anchor names. Fails if a page's text digest changed."""
    pieces = []
    for a in anchor_list:
        front, _blocks, s, digest = source.part(a["index"])
        if digest != a["page_sha256"]:
            raise ValueError(f"{source.id} page {a['index']}: text digest {digest} is not the anchored {a['page_sha256']}")
        pieces.append((a["index"], front, s[a["stream"]][a["start"]:a["end"]]))
    return pieces
