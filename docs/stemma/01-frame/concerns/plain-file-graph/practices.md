---
ddx:
  id: stemma.concern.plain-file-graph.practices
  authoring:
    home: repo
---

# Practices: plain-file-graph

- Serialize each record the same way every time, and reject duplicate keys.
- Define line endings and text normalization before hashing. Do not apply a
  normalization that changes meaning, and keep values preserved from legacy
  files unchanged.
- Use file names that are safe on case-insensitive file systems and on Windows.
- Rebuild every index from records alone. Compare a canonical dump of two
  rebuilds, not database bytes, which differ between SQLite builds.
- Detect records changed after the last index build before answering a query.
- Migrate record formats with a versioned, repeatable step that runs only when
  the author asks, after listing the changes it will make.
- Own the text folding used for search across diacritics and scripts, and
  version it.
