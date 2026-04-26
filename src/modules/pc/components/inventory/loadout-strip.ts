import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { ResolvedEquipped, SlotKey } from "../../pc.types";
import { setInventoryIcon } from "../../assets/inventory-icons";
import { unequipWithAttunementCheck } from "./unequip-flow";

const SLOT_ORDER: SlotKey[] = ["mainhand", "offhand", "armor", "shield"];
const SLOT_LABEL: Record<SlotKey, string> = {
  mainhand: "Mainhand",
  offhand:  "Offhand",
  armor:    "Armor",
  shield:   "Shield",
};
const SLOT_ICON: Record<SlotKey, string> = {
  mainhand: "sword",
  offhand:  "sword",
  armor:    "shield",
  shield:   "shield",
};

export class LoadoutStrip implements SheetComponent {
  readonly type = "loadout-strip";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-loadout-strip" });
    const slots = ctx.derived.equippedSlots;
    const editState = ctx.editState;

    for (const key of SLOT_ORDER) {
      const cell = root.createDiv({ cls: "pc-loadout-slot", attr: { "data-slot": key } });

      const iconEl = cell.createDiv({ cls: "pc-loadout-icon" });
      setInventoryIcon(iconEl, SLOT_ICON[key]);

      const info = cell.createDiv({ cls: "pc-loadout-info" });
      info.createDiv({ cls: "pc-loadout-lbl", text: SLOT_LABEL[key] });

      const occupant = slots[key];
      if (!occupant) {
        info.createDiv({ cls: "pc-loadout-val is-empty", text: "empty" });
        continue;
      }

      info.createDiv({ cls: "pc-loadout-val", text: displayName(occupant) });
      const stat = slotStat(occupant);
      if (stat) info.createDiv({ cls: "pc-loadout-stat", text: stat });

      if (editState) {
        const btn = cell.createEl("button", { cls: "pc-loadout-unequip", text: "Unequip" });
        btn.addEventListener("click", () => {
          void unequipWithAttunementCheck(ctx.app, editState, occupant.entry, occupant.index);
        });
      }
    }
  }
}

// Differs from filter-state.displayName: prettifies the [[slug]] fallback
// because loadout cells are visually prominent.
function displayName(slot: ResolvedEquipped): string {
  return slot.entry.overrides?.name ?? (slot.entity as { name?: string } | null)?.name ?? prettyName(slot.entry.item);
}

function slotStat(slot: ResolvedEquipped): string {
  const e = slot.entity as { ac?: { base?: number; flat?: number; add_dex?: boolean }; damage?: { dice?: string; type?: string } } | null;
  if (e?.ac) {
    const base = e.ac.base ?? 0;
    const flat = e.ac.flat ? `+${e.ac.flat}` : "";
    const dex = e.ac.add_dex ? " + Dex" : "";
    return `AC ${base}${flat}${dex}`;
  }
  if (e?.damage) {
    const t = e.damage.type ? ` ${e.damage.type[0].toUpperCase()}` : "";
    return `${e.damage.dice}${t}`;
  }
  return "";
}

function prettyName(itemRef: string): string {
  const m = itemRef.match(/^\[\[(.+)\]\]$/);
  if (m) return m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return itemRef;
}
