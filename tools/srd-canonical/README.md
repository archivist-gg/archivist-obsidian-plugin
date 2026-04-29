# SRD Canonical Pipeline

Builds the canonical SRD dataset (2014 + 2024) by merging Open5e v2, the local structured-rules data dump, foundry-*.json activation data, and the hand-curated overlay.

## Usage

```bash
export STRUCTURED_RULES_PATH=/path/to/structured-rules/data
npm run build:srd-canonical
# Or refresh Open5e cache:
npm run build:srd-canonical -- --refresh-open5e
# Or single edition:
npm run build:srd-canonical -- --edition 2014
```

## Outputs

- `src/srd/data/canonical/{kind}.{edition}.json` — full canonical (committed)
- `src/srd/data/runtime/{kind}.{edition}.json` — slim runtime (committed; bundled in plugin)
- `.compendium-bundle/SRD 5e/`, `.compendium-bundle/SRD 2024/` — vault MD set (committed; copied to user vault on plugin install)

## See

- Spec: `docs/superpowers/specs/2026-04-29-srd-canonical-pipeline-design.md`
- Plan: `docs/superpowers/plans/2026-04-29-srd-canonical-pipeline.md`
