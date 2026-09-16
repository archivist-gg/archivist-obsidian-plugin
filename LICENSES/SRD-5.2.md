# SRD 5.2 Attribution

This plugin bundles content from the System Reference Document 5.2 ("SRD 5.2"), released by
Wizards of the Coast under the Creative Commons Attribution 4.0 International License.

## Required attribution

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of
the Coast LLC and available at <https://www.dndbeyond.com/srd>. The SRD 5.2 is licensed under
the Creative Commons Attribution 4.0 International License, available at
<https://creativecommons.org/licenses/by/4.0/legalcode>.

Copyright (C) Wizards of the Coast LLC. "Dungeons & Dragons" and "D&D" are trademarks of
Wizards of the Coast LLC. This project is unofficial and is neither affiliated with nor
endorsed by Wizards of the Coast.

## Source

- Document: System Reference Document 5.2 (SRD 5.2)
- Publisher: Wizards of the Coast LLC
- License: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode)

## Where it is bundled

- `.compendium-bundle/index.json`: the `SRD 2024/` root, 1,808 entity notes plus one
  compendium index note. The file is a path-to-content map that the plugin inlines into the
  released `main.js` at build time and copies into the user's vault as a read-only
  `SRD 2024` compendium on first install and on a version upgrade.

The same content ships inside `@archivist-gg/dnd5e`, this plugin's engine package, as the
`*.2024.json` files under `src/srd/data/`. That package carries its own copy of this notice at
`LICENSES/SRD.md`.

## Changes made (CC-BY-4.0 s.3(a)(1)(B), "indicate if changes were made")

This material is MODIFIED. It was not taken from the SRD 5.2 PDF. It is assembled by
`tools/srd-canonical/` in the `@archivist-gg/dnd5e` package from:

- the **Open5e** v2 API (<https://open5e.com>), queried with the document filter
  `document__key__in=srd-2024`, which is the immediate redistribution source of the SRD 5.2
  text and is itself a CC-BY-4.0 redistribution;
- a structured-rules JSON dump, used to enrich mechanical fields, to expand the SRD's generic
  magic-item variants into one entity per base item, and, for the 15 conditions, as the text
  source (Open5e exposes no condition endpoint for this document);
- virtual-tabletop activation data, used to derive typed item effects;
- a hand-curated overlay, `tools/srd-canonical/overlays/srd-2024.yaml`, authored for this
  project.

Content is reformatted into this project's YAML and Markdown schema, cross-references are
rewritten as vault wikilinks, dice and save expressions are rewritten as this project's inline
roll tags, and a small number of entities with no SRD counterpart (spell scrolls and
unidentified-item placeholders) are authored here and marked as such. Narrative prose is
otherwise preserved. No mechanics are invented.

Every emitted file passes through `tools/srd-canonical/sanitize.ts`, which removes the
upstream tooling's own markup (reference tags, source-book abbreviation suffixes, template
pointers, third-party database identifiers) and the editorial commentary its contributors wrote
about the SRD, so that what ships is the rules text and this project's own structure.

Credit to **Open5e** (<https://open5e.com>) as the immediate SRD-redistribution source.
