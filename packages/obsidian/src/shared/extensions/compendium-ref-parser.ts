export interface CompendiumRef {
  entityType: string | null;
  slug: string;
}

const VALID_TYPES = new Set([
  "monster", "spell", "item", "feat", "condition",
  "class", "background", "armor", "weapon",
]);

export function parseCompendiumRef(text: string): CompendiumRef | null {
  const match = text.match(/^\{\{\s*(.+?)\s*\}\}$/);
  if (!match) return null;
  const inner = match[1].trim();
  if (!inner) return null;
  const colonIdx = inner.indexOf(":");
  if (colonIdx === -1) return { entityType: null, slug: inner };
  const prefix = inner.substring(0, colonIdx).trim();
  const slug = inner.substring(colonIdx + 1).trim();
  if (!slug) return null;
  if (!VALID_TYPES.has(prefix)) return { entityType: null, slug: inner };
  return { entityType: prefix, slug };
}

/** Minimal registry surface the resolver needs (structurally satisfied by EntityRegistry). */
interface CompendiumRefRegistry<T> {
  getBySlug(slug: string): T | undefined;
  getByTypeAndSlug(entityType: string, slug: string): T | undefined;
}

/**
 * Resolve a parsed {{type:slug}} reference against a registry.
 *
 * Typed branch: look up by (type, slug). Defense-in-depth self-heal — if the
 * lookup misses and `slug` is a stale 2-part `<prefix>_<name>` literal, retry
 * once against the type-namespaced 3-part form `<prefix>_<type>_<name>`. This
 * lets pre-namespacing note refs (`{{monster:srd-2024_x}}`) still resolve after
 * slugs became `srd-2024_monster_x`.
 *
 * Untyped branch: pure `getBySlug` on the literal, unchanged — no rewriting.
 */
export function resolveCompendiumRef<T>(
  registry: CompendiumRefRegistry<T>,
  ref: { entityType?: string | null; slug: string },
): T | undefined {
  if (!ref.entityType) return registry.getBySlug(ref.slug);
  let ent = registry.getByTypeAndSlug(ref.entityType, ref.slug);
  if (!ent) {
    const p = ref.slug.split("_");
    if (p.length === 2) {
      ent = registry.getByTypeAndSlug(ref.entityType, `${p[0]}_${ref.entityType}_${p[1]}`);
    }
  }
  return ent;
}
