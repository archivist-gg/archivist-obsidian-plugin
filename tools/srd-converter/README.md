# DEPRECATED — superseded by `tools/srd-canonical/`

This converter is deprecated as of the SRD Canonical Pipeline initiative
(see `docs/superpowers/plans/2026-04-29-srd-canonical-pipeline.md`).

The new pipeline at `tools/srd-canonical/` produces the canonical SRD
dataset by merging Open5e v2, the local structured-rules data dump,
foundry-*.json activation data, and a hand-curated overlay. Use:

```bash
export STRUCTURED_RULES_PATH=/path/to/structured-rules/data
npm run build:srd-canonical
```

This directory is retained for one release cycle as a fallback in case
the new pipeline surfaces unexpected regressions. After 2+ stable
release cycles confirm no regression, this directory will be deleted.

---

# SRD Converter

Offline tool that converts open5e-formatted JSON into Archivist's Markdown
bundle under `src/data/srd/`.

## Usage

```bash
npm run convert-srd                                      # default: 2014, ~/w/archivist/server/data/srd/
npm run convert-srd -- --source-dir /path/to/srd         # override source
npm run convert-srd -- --edition 2024                    # switch edition
npm run convert-srd -- --output-dir src/data/srd-2024    # override output
```

## What it does

1. Reads `classes/all.json`, `races/all.json`, `backgrounds/all.json`, `feats/all.json`.
2. **Filters strictly to `document__slug == "wotc-srd"`.** Tome of Heroes (`toh`),
   Tal'Dorei (`taldorei`), and open5e custom content (`o5e`) are skipped.
3. For each class, splits `archetypes[]` into separate subclass files.
4. Writes one `.md` file per entity with YAML frontmatter + typed code block.
5. Fails loudly on subclass slug collisions.

## Attribution

SRD 5.1 is redistributed under CC-BY 4.0. See `LICENSES/SRD-5.1.md`.
