import type { ComponentRenderContext } from "../component.types";
import type { EntityRegistry, RegisteredEntity } from "@archivist-gg/core";
import { DecisionPickModal } from "../builder/decision-modal";
import { categoryOf } from "./filter-state";
import { isUnidentifiedPlaceholder } from "./item-predicates";

// `search("", type, ENUMERATE_LIMIT)` is the empty-query enumeration shim (see
// browse-mode.ts collectCompendiumItems): the registry has no getAllByType, and
// `name.includes("")` matches every entity of the type.
const ENUMERATE_LIMIT = 10_000;

// The compendium entity types swept for identify candidates. Weapons and armor
// are their own entity type; every other item category (potion/ring/wand/scroll/
// wondrous item) is entity-type "item", narrowed by the item's `type` via
// `categoryOf` (shared with the inventory type filter, filter-state.ts).
const COMPENDIUM_TYPES = ["weapon", "armor", "item"] as const;

/**
 * Build the candidate list for identifying an unidentified placeholder: every
 * registered compendium entity whose category matches the placeholder's
 * `maskedCategory` (weapon/armor by entity type; potion/ring/wand/scroll/wondrous
 * item by the item's `type`), EXCLUDING the unidentified placeholders themselves.
 * DecisionPickModal applies NO EntityFilter, so the caller assembles the scoped
 * candidates here. Exported pure for tests. Mirrors buildScrollSpellCandidates.
 */
export function buildIdentifyCandidates(
  reg: EntityRegistry,
  maskedCategory: string,
): RegisteredEntity[] {
  const scope = maskedCategory.trim().toLowerCase();
  const out: RegisteredEntity[] = [];
  for (const type of COMPENDIUM_TYPES) {
    for (const e of reg.search("", type, ENUMERATE_LIMIT)) {
      if (isUnidentifiedPlaceholder(e.data)) continue;
      const itemType = (e.data as { type?: string }).type;
      if (categoryOf(e.entityType, itemType) === scope) out.push(e);
    }
  }
  return out;
}

/**
 * Open the identify picker: the category-scoped compendium items in the shared
 * long-list DecisionPickModal (choose 1): the same working modal the scroll
 * spell picker uses. Picking identifies the placeholder in place (`identifyItem`,
 * which resets all per-instance state); the sheet re-renders through the
 * edit-state onChange path. Title uses `·`/`:` only (never an em dash). Replaces
 * the retired BrowseMode-in-Modal implementation, which collapsed to an unusable
 * ribbon for lack of a `pc-content` inline-size container.
 */
export function openIdentifyPicker(
  ctx: ComponentRenderContext,
  entryIndex: number,
  maskedCategory: string,
): void {
  const reg = ctx.services?.entities as EntityRegistry | undefined;
  const editState = ctx.editState;
  if (!reg || !editState) return;

  const candidates = buildIdentifyCandidates(reg, maskedCategory);
  const category = maskedCategory.trim();

  new DecisionPickModal(ctx.app, ctx, {
    title: category ? `Identify item · choose a ${category}` : "Identify item · choose the true item",
    need: 1,
    candidates,
    initialSelected: [],
    writeValue: (slugs) => {
      if (slugs[0]) editState.identifyItem(entryIndex, slugs[0]);
    },
    stateKey: `identify-item.${entryIndex}`,
  }).open();
}
