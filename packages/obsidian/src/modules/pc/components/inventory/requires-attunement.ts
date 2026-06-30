import type { ArmorEntity } from "@archivist/dnd5e/armor/armor.types";
import type { WeaponEntity } from "@archivist/dnd5e/weapon/weapon.types";
import type { ItemEntity } from "../../../item/item.types";

/**
 * `entity.attunement` can be:
 *   - undefined / false / ""           → not required
 *   - true                              → required, no restriction
 *   - "by a wizard"                     → required, with text restriction
 *   - { required: true, restriction? }  → required (structured)
 *   - { required: false }               → not required (structured)
 *
 * This predicate normalizes all five shapes into a single boolean.
 *
 * Accepts any equipped entity. Only items model `attunement`; armor and
 * weapons never require attunement in this domain, so they short-circuit to
 * `false` via the property-presence narrow below.
 */

export function requiresAttunement(
  entity: ArmorEntity | WeaponEntity | ItemEntity | null,
): boolean {
  if (!entity || !("attunement" in entity)) return false;
  const a = entity.attunement;
  if (a === true) return true;
  if (typeof a === "string") return a.length > 0;
  if (typeof a === "object" && a !== null) return a.required === true;
  return false;
}
