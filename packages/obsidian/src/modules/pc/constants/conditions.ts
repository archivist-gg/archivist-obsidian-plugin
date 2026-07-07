// Condition slugs/labels — relocated to @archivist/dnd5e/pc/conditions.constants
// (3C-R Phase 3a). Value+type re-export shim so existing `../constants/conditions`
// consumers (runtime CONDITION_SLUGS/CONDITION_DISPLAY_NAMES + type ConditionSlug) stay unchanged.
export { CONDITION_SLUGS, CONDITION_DISPLAY_NAMES } from "@archivist/dnd5e/pc/conditions.constants";
export type { ConditionSlug } from "@archivist/dnd5e/pc/conditions.constants";
