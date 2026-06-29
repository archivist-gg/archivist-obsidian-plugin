// packages/dnd5e/tools/srd-canonical/normalizers/normalized-entity.ts
//
// Build-time shape returned by the SRD normalizers: the frontmatter block plus
// the typed entity data. A self-contained generic interface, kept local to the
// dnd5e SRD tools so the normalizer has no tools→obsidian dependency. (Mirrors
// the obsidian `class.normalizer` NormalizedEntity, which serves the
// obsidian-side normalizers.)

export interface NormalizedEntity<T = unknown> {
  frontmatter: {
    archivist: true;
    entity_type: string;
    slug: string;
    name: string;
    compendium: string;
    source: string;
  };
  data: T;
}
