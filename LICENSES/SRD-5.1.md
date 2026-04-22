# SRD 5.1 Attribution

This plugin bundles data from the System Reference Document 5.1, released by
Wizards of the Coast under the Creative Commons Attribution 4.0 International
License (CC-BY-4.0).

## Source

- Document: System Reference Document 5.1 (SRD 5.1)
- Publisher: Wizards of the Coast LLC
- License: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode)

## Redistribution

SRD 5.1 content bundled under `src/data/srd/` is redistributed in Markdown
form with structural transformations only. Narrative content is preserved
verbatim from the source. Attribution is required; modification is permitted.

No non-SRD content is bundled. The SRD converter
(`tools/srd-converter/`) strictly filters source entries to
`document__slug == "wotc-srd"`.

## Changes from the Source

The SRD's class features and race traits are restructured into
Archivist's Zod-validated YAML schema. Prose text is preserved as
`description` fields. No mechanics are invented or altered during the
transformation.
