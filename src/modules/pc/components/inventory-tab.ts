import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { EquipmentEntry, EquippedSlots, ResolvedEquipped, SlotKey } from "../pc.types";
import { currencyCell } from "./edit-primitives";
import { renderChargesWidget } from "./charges-widget";

const COIN_KEYS = ["pp", "gp", "ep", "sp", "cp"] as const;
const SLOT_ORDER: SlotKey[] = ["mainhand", "offhand", "armor", "shield"];
const SLOT_LABEL: Record<SlotKey, string> = { mainhand: "MAINHAND", offhand: "OFFHAND", armor: "ARMOR", shield: "SHIELD" };

export class InventoryTab implements SheetComponent {
  readonly type = "inventory-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-inventory-body" });
    const editState = ctx.editState as null | {
      equipItem: (i: number) => { kind: string; withIndex?: number; slot?: SlotKey };
      unequipItem: (i: number) => void;
      removeItem: (i: number) => void;
      attuneItem: (i: number) => { kind: string };
      unattuneItem: (i: number) => void;
      addItem: (slug: string, opts?: { equipped?: boolean; slot?: SlotKey }) => void;
      setCurrency: (coin: "pp"|"gp"|"ep"|"sp"|"cp", n: number) => void;
      setCharges: (i: number, current: number, max?: number) => void;
    };

    this.renderEquipped(root, ctx, editState);
    this.renderCarried(root, ctx, editState);
    this.renderCurrency(root, ctx, editState);
  }

  private renderEquipped(root: HTMLElement, ctx: ComponentRenderContext, editState: null | { equipItem: (i: number) => unknown; unequipItem: (i: number) => void }): void {
    root.createEl("h4", { cls: "pc-tab-heading", text: "Equipped" });
    const grid = root.createDiv({ cls: "pc-inventory-slot-grid" });
    const slots = ctx.derived.equippedSlots ?? {};

    for (const key of SLOT_ORDER) {
      const cell = grid.createDiv({ cls: "pc-inventory-slot" });
      cell.setAttribute("data-slot", key);
      cell.createDiv({ cls: "pc-inventory-slot-label", text: SLOT_LABEL[key] });
      const occupant = slots[key];
      if (occupant) {
        cell.createDiv({ cls: "pc-inventory-slot-name", text: displayName(occupant) });
        cell.createDiv({ cls: "pc-inventory-slot-stat", text: slotStat(occupant) });
        if (editState) {
          const btn = cell.createEl("button", { cls: "pc-inventory-unequip-btn", text: "unequip" });
          btn.addEventListener("click", () => editState.unequipItem(occupant.index));
        }
      } else {
        cell.createDiv({ cls: "pc-inventory-slot-empty", text: "—" });
      }
    }

    const att = root.createDiv({ cls: "pc-inventory-attunement" });
    att.setText(`${ctx.derived.attunementUsed ?? 0} / ${ctx.derived.attunementLimit ?? 3} attuned`);
  }

  private renderCarried(root: HTMLElement, ctx: ComponentRenderContext, editState: null | {
    equipItem: (i: number) => { kind: string; withIndex?: number };
    unequipItem: (i: number) => void;
    removeItem: (i: number) => void;
    attuneItem: (i: number) => { kind: string };
    unattuneItem: (i: number) => void;
    addItem: (slug: string) => void;
    setCharges: (i: number, current: number, max?: number) => void;
  }): void {
    const eq = ctx.resolved.definition.equipment ?? [];
    const heading = root.createEl("h4", { cls: "pc-tab-heading" });
    heading.setText(`Carried (${eq.length} items, ${ctx.derived.carriedWeight ?? 0} lbs)`);

    if (eq.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "Nothing carried." });
    } else {
      const list = root.createDiv({ cls: "pc-inventory-carried-list" });
      eq.forEach((entry, i) => this.renderCarriedRow(list, entry, i, editState));
    }

    if (editState) {
      const addBtn = root.createEl("button", { cls: "pc-inventory-add-btn", text: "+ add item" });
      addBtn.addEventListener("click", () => {
        const slug = window.prompt("Item slug (e.g. longsword):");
        if (slug) editState.addItem(slug.trim());
      });
    }
  }

  private renderCarriedRow(list: HTMLElement, entry: EquipmentEntry, i: number, editState: null | {
    equipItem: (i: number) => { kind: string; withIndex?: number };
    unequipItem: (i: number) => void;
    removeItem: (i: number) => void;
    attuneItem: (i: number) => { kind: string };
    unattuneItem: (i: number) => void;
    setCharges: (i: number, current: number, max?: number) => void;
  }): void {
    const row = list.createDiv({ cls: "pc-inventory-carried-row" });
    row.createSpan({ cls: "pc-inventory-item-name", text: entry.overrides?.name ?? prettyName(entry.item) });
    if (entry.qty && entry.qty > 1) row.createSpan({ cls: "pc-inventory-item-qty", text: `×${entry.qty}` });

    if (entry.state?.charges && editState) {
      const chargesHost = row.createSpan({ cls: "pc-inventory-charges-host" });
      renderChargesWidget(chargesHost, {
        current: entry.state.charges.current,
        max: entry.state.charges.max,
        recovery: entry.state.recovery ? `${entry.state.recovery.amount} at ${entry.state.recovery.reset}` : undefined,
        onSetCurrent: (n) => editState.setCharges(i, n),
      });
    }

    if (!editState) return;

    const attuneBtn = row.createEl("button", { cls: `pc-inventory-attune-btn${entry.attuned ? " is-on" : ""}`, text: entry.attuned ? "attuned ●" : "attune" });
    attuneBtn.addEventListener("click", () => {
      if (entry.attuned) editState.unattuneItem(i);
      else {
        const r = editState.attuneItem(i);
        if (r.kind === "rejected") window.alert("Attunement limit reached. Unattune another item first or raise the cap.");
      }
    });

    const equipBtn = row.createEl("button", { cls: "pc-inventory-equip-btn", text: entry.equipped ? "unequip" : "equip" });
    equipBtn.addEventListener("click", () => {
      if (entry.equipped) editState.unequipItem(i);
      else {
        const r = editState.equipItem(i);
        if (r.kind === "conflict" && typeof r.withIndex === "number") {
          if (window.confirm("Slot occupied — replace currently-equipped item?")) {
            editState.unequipItem(r.withIndex);
            editState.equipItem(i);
          }
        }
      }
    });

    const rm = row.createEl("button", { cls: "pc-inventory-remove-btn", text: "×" });
    rm.addEventListener("click", () => {
      if (entry.equipped && !window.confirm("Item is equipped — remove anyway?")) return;
      editState.removeItem(i);
    });
  }

  private renderCurrency(root: HTMLElement, ctx: ComponentRenderContext, editState: null | { setCurrency: (coin: "pp"|"gp"|"ep"|"sp"|"cp", n: number) => void }): void {
    const cur = ctx.resolved.definition.currency;
    if (!cur && !editState) return;
    root.createEl("h4", { cls: "pc-tab-heading", text: "Currency" });
    const strip = root.createDiv({ cls: "pc-currency-row" });
    for (const coin of COIN_KEYS) {
      const value = cur?.[coin] ?? 0;
      if (editState) {
        currencyCell(strip, { coin: coin.toUpperCase(), value, onSet: (n) => editState.setCurrency(coin, n) });
      } else {
        const cell = strip.createDiv({ cls: "pc-currency-cell" });
        cell.createDiv({ cls: "pc-currency-val", text: String(value) });
        cell.createDiv({ cls: "pc-currency-label", text: coin.toUpperCase() });
      }
    }
  }
}

function displayName(slot: ResolvedEquipped): string {
  return slot.entry.overrides?.name ?? slot.entity?.name ?? prettyName(slot.entry.item);
}

function slotStat(slot: ResolvedEquipped): string {
  const entity = slot.entity as { ac?: { base?: number; flat?: number }; damage?: { dice?: string; type?: string } } | null;
  if (entity?.ac) return `AC ${entity.ac.base ?? 0}${entity.ac.flat ? `+${entity.ac.flat}` : ""}`;
  if (entity?.damage) return `${entity.damage.dice} ${entity.damage.type}`;
  return "";
}

function prettyName(itemRef: string): string {
  const m = itemRef.match(/^\[\[(.+)\]\]$/);
  if (m) return m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return itemRef;
}
