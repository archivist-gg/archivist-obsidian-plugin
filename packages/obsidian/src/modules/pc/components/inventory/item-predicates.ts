/**
 * Value-based detection for identify / scroll surfaces.
 *
 * These predicates deliberately read the marker field DIRECTLY rather than
 * gating on `isItemEntity` (dnd5e `pc.slotting.ts`), which is `"rarity" in e`:
 * a leaky "is-a-magic-item" guard. An unidentified placeholder carries NO
 * `rarity`, so a rarity gate would wrongly reject it even though it resolves as
 * entity-type "item". Callers that need to narrow to an ItemEntity before
 * reading these fields should prefer `resolveEntityForEntry(...).entityType ===
 * "item"` over the rarity guard.
 *
 * Input is `unknown` so a resolved entity (`ItemEntity | WeaponEntity |
 * ArmorEntity | null`), or any partial marker carrier, can be passed safely;
 * null / non-object / a non-item entity all return `false`.
 */

/** True when the item is an unidentified placeholder (`unidentified === true`).
 *  Read value-based, with NO rarity gate (placeholders carry no rarity). */
export function isUnidentifiedPlaceholder(item: unknown): boolean {
  return (
    !!item &&
    typeof item === "object" &&
    (item as { unidentified?: unknown }).unidentified === true
  );
}

/** True when the item is a spell scroll (`scroll_level != null`). Scrolls DO
 *  carry rarity, so there is no rarity-leak concern here; a `scroll_level` of 0
 *  (cantrip scroll) still counts. */
export function isScrollItem(item: unknown): boolean {
  return (
    !!item &&
    typeof item === "object" &&
    (item as { scroll_level?: unknown }).scroll_level != null
  );
}
