/**
 * `entity.attunement` can be:
 *   - undefined / false / ""           → not required
 *   - true                              → required, no restriction
 *   - "by a wizard"                     → required, with text restriction
 *   - { required: true, restriction? }  → required (structured)
 *   - { required: false }               → not required (structured)
 *
 * This predicate normalizes all five shapes into a single boolean.
 */

interface MaybeAttunement {
  attunement?: boolean | string | { required?: boolean; restriction?: string } | undefined;
}

export function requiresAttunement(entity: MaybeAttunement | null): boolean {
  if (!entity) return false;
  const a = entity.attunement;
  if (a === true) return true;
  if (typeof a === "string") return a.length > 0;
  if (typeof a === "object" && a !== null) return a.required === true;
  return false;
}
