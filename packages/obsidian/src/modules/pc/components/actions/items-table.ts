import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { ItemEntry } from "./action-model";
import { renderCostBadge } from "./cost-badge";
import { renderChargeBoxes } from "./charge-boxes";
import { renderRowExpand as renderInventoryRowExpand } from "../inventory/inventory-row-expand";
import { resolveItemAction } from "@archivist-gg/dnd5e/item/item.actions-map";

const RARITY_CLASS: Record<string, string> = {
  "common": "rarity-common", "uncommon": "rarity-uncommon", "rare": "rarity-rare",
  "very rare": "rarity-very-rare", "very-rare": "rarity-very-rare",
  "legendary": "rarity-legendary", "artifact": "rarity-artifact", "legacy": "rarity-legacy",
};

/**
 * Render ONE equipped, action-bearing item as a `.pc-action-row` (plus its
 * sibling `.pc-action-expand` panel, hidden until clicked) into `list`. No
 * section head, no self-redraw: the row-click toggles `expand.hidden` + the
 * `.pc-row-open` class IN PLACE (the feature-row `hidden`-toggle pattern), so a
 * containing tab (Task 5) can file each row under its own economy×source
 * sub-group without redrawing the whole table.
 *
 * Consumes a Task-3 `ItemEntry` (`{ index, entry, entity, entityType, action }`)
 * — the action is already resolved, so no re-derivation happens here. Charge
 * write-back keys on `item.index`, the ORIGINAL equipment index (filter-stable),
 * exactly as before. Rarity classes, range, and charge boxes are preserved.
 */
export function renderItemRow(
  list: HTMLElement,
  item: ItemEntry,
  ctx: ComponentRenderContext,
): void {
  const { index, entry, entity, entityType, action } = item;
  const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1] ?? "";

  const row = list.createDiv({ cls: "pc-action-row" });

  // Cost
  renderCostBadge(row.createDiv(), action.cost);

  const ce = ctx.derived.conditionEffects;
  const isAction = action.cost === "action" || action.cost === "reaction" || action.cost === "bonus-action";
  if (ce && isAction && ce.actions_disabled) row.addClass("pc-row-disabled");

  // Name + sub
  const nameCell = row.createDiv({ cls: "pc-action-namecell" });
  const nameEl = nameCell.createDiv({ cls: "pc-action-row-name", text: entity?.name ?? slug });
  const rcls = RARITY_CLASS[(entity?.rarity ?? "").toLowerCase()];
  if (rcls) nameEl.classList.add(rcls);
  const subParts: string[] = [];
  if (entity?.rarity) subParts.push(entity.rarity);
  if (entry.attuned) subParts.push("attuned");
  if (subParts.length) nameCell.createDiv({ cls: "pc-action-row-sub", text: subParts.join(" · ") });

  // Range
  row.createDiv({ cls: "pc-action-range", text: action.range ?? "" });

  // Charges
  const chgCell = row.createDiv({ cls: "pc-action-charges" });
  const stateCharges = entry.state?.charges;
  const max = stateCharges?.max ?? action.max_charges ?? 0;
  const used = stateCharges ? Math.max(0, stateCharges.max - stateCharges.current) : 0;
  const recovery = entry.state?.recovery ?? action.recovery;
  if (max > 0) {
    renderChargeBoxes(chgCell, {
      used,
      max,
      recovery,
      // item.index = the ORIGINAL equipment index (filter-stable write-back key).
      onSet: (newUsed) => ctx.editState?.setItemCharges(index, newUsed, max),
    });
  } else {
    chgCell.createSpan({ text: "—" });
  }

  // Expand block = a full-width sibling div AFTER the row, rendered once and
  // toggled via `hidden` (no table row, no colspan, no container redraw).
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  expand.hidden = true;
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });
  renderInventoryRowExpand(inner, {
    entry,
    resolved: { index, entity: entity as never, entityType, entry },
    app: ctx.app, editState: ctx.editState,
    registry: ctx.services?.entities ?? null,
  });

  // Click anywhere on the row toggles the expand panel in place (matches
  // inventory UX). Charge boxes call e.stopPropagation() so their clicks don't
  // bubble here.
  row.addEventListener("click", () => {
    expand.hidden = !expand.hidden;
    row.classList.toggle("open", !expand.hidden);
    row.classList.toggle("pc-row-open", !expand.hidden);
  });
}

/**
 * Collect equipped, action-bearing, non-weapon/armor items as `ItemEntry[]`.
 *
 * Reconciled per the Task-3 handoff so it carries BOTH the read semantics
 * (equipped, non-weapon/armor) AND the action-skip that `ItemsTable.render`
 * used to apply downstream: items with no resolved action are dropped, and the
 * resolved `ItemAction` rides along on the entry so `renderItemRow` re-derives
 * nothing. The ORIGINAL equipment index is preserved for filter-stable charge
 * write-back. Mirrors `action-model.ts::collectItemEntries`; this ctx-anchored
 * copy exists only for the thin `ItemsTable.render` wrapper below (removed with
 * its collector in Task 5, once the tab drives `buildActionModel`).
 */
function collectItemEntries(ctx: ComponentRenderContext): ItemEntry[] {
  const equipment = ctx.resolved.definition.equipment ?? [];
  const out: ItemEntry[] = [];
  equipment.forEach((entry, index) => {
    const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
    if (!slug) return;
    const reg = ctx.services?.entities as { getBySlug?: (s: string) => { entityType?: string; data?: ItemEntry["entity"] } | null } | undefined;
    const found = reg?.getBySlug?.(slug) ?? null;
    const entityType = found?.entityType ?? null;
    // Weapons + armor go through the Weapons table / inventory expand.
    if (entityType === "weapon" || entityType === "armor") return;
    // Only equipped items surface here.
    if (!entry.equipped) return;
    // Items with no activated action are omitted.
    const action = resolveItemAction(slug, entry);
    if (!action) return;
    out.push({ index, entry, entity: found?.data ?? null, entityType, action });
  });
  return out;
}

/**
 * Thin wrapper kept so the current `actions-tab.ts` (rewired in Task 5) still
 * compiles: renders the section + list scaffold — WITHOUT the former
 * `.pc-actions-section-head` "Items — N actions" block — then dispatches each
 * collected `ItemEntry` to `renderItemRow`. No count, no head; the tab supplies
 * grouping.
 */
export class ItemsTable implements SheetComponent {
  readonly type = "items-table";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const items = collectItemEntries(ctx);
    if (items.length === 0) return;

    const section = el.createDiv({ cls: "pc-actions-section" });
    const list = section.createDiv({ cls: "pc-actions-table pc-items-table" });
    for (const item of items) renderItemRow(list, item, ctx);
  }
}
