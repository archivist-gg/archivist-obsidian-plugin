import type { App } from "obsidian";
import type { EquipmentEntry, ResolvedEquipped } from "../../pc.types";
import type { CharacterEditState } from "../../pc.edit-state";
import { iconForEntity } from "./icon-mapping";
import { setInventoryIcon } from "../../assets/inventory-icons";
import { requiresAttunement } from "./requires-attunement";
import { prettifyName } from "./filter-state";
import { unequipWithAttunementCheck } from "./unequip-flow";

export interface InventoryRowCtx {
  entry: EquipmentEntry;
  resolved: ResolvedEquipped;
  app: App;
  editState: CharacterEditState | null;
  onToggle?: (index: number) => void;
  expanded?: boolean;
}

const RARITY_CLASS: Record<string, string> = {
  "common":     "rarity-common",
  "uncommon":   "rarity-uncommon",
  "rare":       "rarity-rare",
  "very rare":  "rarity-very-rare",
  "very-rare":  "rarity-very-rare",
  "legendary":  "rarity-legendary",
  "artifact":   "rarity-artifact",
  "legacy":     "rarity-legacy",
};

export class InventoryRow {
  render(parent: HTMLElement, ctx: InventoryRowCtx): HTMLElement {
    const row = parent.createDiv({ cls: "pc-inv-row" });
    if (ctx.entry.equipped) row.classList.add("equipped");
    if (ctx.entry.attuned)  row.classList.add("attuned");
    if (ctx.expanded)       row.classList.add("expanded");

    // Toggle column: square toggle that flips equipped state on click.
    const toggleCell = row.createDiv({ cls: "pc-inv-toggle-cell" });
    const toggle = toggleCell.createDiv({ cls: "pc-inv-toggle" });
    if (ctx.entry.equipped || ctx.entry.attuned) toggle.classList.add("on");

    // Icon column
    const iconCell = row.createDiv({ cls: "pc-inv-icon" });
    setInventoryIcon(iconCell, iconForEntity(ctx.resolved, ctx.entry));

    // Name + subtitle column
    const nameCell = row.createDiv({ cls: "pc-inv-name-cell" });
    const name = nameCell.createDiv({ cls: "pc-inv-name", text: displayName(ctx) });
    const rarityClass = rarityCssClass(ctx.resolved);
    if (rarityClass) name.classList.add(rarityClass);
    if (!ctx.resolved.entity) name.classList.add("is-inline");

    const sub = nameCell.createDiv({ cls: "pc-inv-sub" });
    fillSubtitle(sub, ctx);

    // Stat / weight / qty-cost columns
    row.createDiv({ cls: "pc-inv-stat", text: keyStat(ctx) });
    row.createDiv({ cls: "pc-inv-weight", text: formatWeight(ctx) });
    row.createDiv({ cls: "pc-inv-qty-cost", text: qtyOrCost(ctx) });

    // Click handlers
    row.addEventListener("click", () => ctx.onToggle?.(ctx.resolved.index));

    toggleCell.addEventListener("click", (e) => {
      e.stopPropagation();
      handleToggleClick(ctx);
    });

    return row;
  }
}

function displayName(ctx: InventoryRowCtx): string {
  if (ctx.entry.overrides?.name) return ctx.entry.overrides.name;
  const e = ctx.resolved.entity as { name?: string } | null;
  if (e?.name) return e.name;
  return prettifyName(ctx.entry.item);
}

function rarityCssClass(resolved: ResolvedEquipped): string | null {
  const e = resolved.entity as { rarity?: string } | null;
  if (!e?.rarity) return null;
  return RARITY_CLASS[e.rarity.toLowerCase()] ?? null;
}

function fillSubtitle(sub: HTMLElement, ctx: InventoryRowCtx): void {
  const e = ctx.resolved.entity as { type?: string; rarity?: string } | null;
  const parts: { text: string; bold?: boolean }[] = [];

  if (ctx.entry.equipped) parts.push({ text: `Equipped${ctx.entry.slot ? ` · ${ctx.entry.slot}` : ""}`, bold: true });
  if (ctx.entry.attuned)  parts.push({ text: "Attuned", bold: true });

  if (!e) {
    parts.push({ text: "Custom · inline · no compendium entry" });
  } else if (ctx.resolved.entityType === "weapon") {
    parts.push({ text: capitalize(e.type ?? "weapon") });
  } else if (ctx.resolved.entityType === "armor") {
    parts.push({ text: capitalize(e.type ?? "armor") });
  } else {
    if (e.type)    parts.push({ text: capitalize(e.type) });
    if (e.rarity)  parts.push({ text: e.rarity.toLowerCase() });
    if (requiresAttunement(ctx.resolved.entity)) parts.push({ text: "requires attunement" });
  }

  parts.forEach((p, i) => {
    if (i > 0) sub.appendText(" · ");
    if (p.bold) sub.createEl("b", { text: p.text });
    else sub.appendText(p.text);
  });
}

function keyStat(ctx: InventoryRowCtx): string {
  const e = ctx.resolved.entity as { ac?: { base?: number; flat?: number; add_dex?: boolean }; damage?: { dice?: string; type?: string } } | null;
  const charges = ctx.entry.state?.charges;
  if (charges) return `${charges.current}/${charges.max} ch.`;
  if (ctx.resolved.entityType === "weapon" && e?.damage) {
    const t = e.damage.type ? ` ${e.damage.type[0].toUpperCase()}` : "";
    return `${e.damage.dice}${t}`;
  }
  if (ctx.resolved.entityType === "armor" && e?.ac) {
    const flat = e.ac.flat ? `+${e.ac.flat}` : "";
    return `AC ${e.ac.base ?? 0}${flat}${e.ac.add_dex ? " + Dex" : ""}`;
  }
  return "";
}

function formatWeight(ctx: InventoryRowCtx): string {
  const e = ctx.resolved.entity as { weight?: number } | null;
  const w = e?.weight;
  if (typeof w === "number" && w > 0) return `${w} lb`;
  return "—";
}

function qtyOrCost(ctx: InventoryRowCtx): string {
  if ((ctx.entry.qty ?? 1) > 1) return `×${ctx.entry.qty}`;
  const e = ctx.resolved.entity as { value?: number } | null;
  if (typeof e?.value === "number") return `${e.value} gp`;
  return "—";
}

function handleToggleClick(ctx: InventoryRowCtx): void {
  if (!ctx.editState) return;
  if (ctx.entry.equipped) {
    void unequipWithAttunementCheck(ctx.app, ctx.editState, ctx.entry, ctx.resolved.index);
  } else {
    ctx.editState.equipItem(ctx.resolved.index);
  }
}

function capitalize(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
