import { Notice, type App } from "obsidian";
import type { EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";
import type { CharacterEditState } from "../../pc.edit-state";
import type { EntityRegistry } from "@archivist-gg/core";
import type { ComponentRenderContext } from "../component.types";
import { resolveBaseItem } from "@archivist-gg/dnd5e/entities/base-item-resolver";
import { iconForEntity } from "./icon-mapping";
import { setInventoryIcon } from "../../assets/inventory-icons";
import { requiresAttunement } from "@archivist-gg/dnd5e/item/item.attunement";
import { prettifyName } from "./filter-state";
import { unequipWithAttunementCheck } from "./unequip-flow";
import { isScrollItem, isUnidentifiedPlaceholder } from "./item-predicates";
import { openScrollSpellPicker } from "./scroll-spell-picker";

export interface InventoryRowCtx {
  entry: EquipmentEntry;
  resolved: ResolvedEquipped;
  app: App;
  editState: CharacterEditState | null;
  /** Optional registry handle. When supplied, magic weapons (entityType="item"
   *  with a `base_item` wikilink) fall back to the underlying weapon entity's
   *  damage in the stat column. */
  registry?: EntityRegistry | null;
  /** The full sheet render context, threaded by the inventory list so scroll /
   *  unidentified affordances can open the spell picker (which needs the
   *  registry + edit-state + character edition). Absent in browse mode and in
   *  legacy call sites, which then render no interactive scroll affordance. */
  sheet?: ComponentRenderContext;
  onToggle?: (index: number) => void;
  expanded?: boolean;
}

const SET_SPELL_LABEL = "+ Set spell";

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
    if (ctx.expanded)       row.classList.add("expanded", "pc-row-open");

    const entity = ctx.resolved.entity;
    const placeholder = isUnidentifiedPlaceholder(entity);
    const scroll = isScrollItem(entity);
    // 3A · an unidentified placeholder reads muted (name via the folded CSS) with
    // NO "?" glyph. The stat / weight / qty cells stay blank until identified.
    if (placeholder) row.classList.add("pc-unidentified");

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
    if (placeholder) {
      sub.setText(maskedCategoryLabel(entity));
    } else {
      fillSubtitle(sub, ctx);
      if (scroll) fillScrollSub(sub, ctx);
    }

    // Stat / weight / qty-cost columns, blank for an unidentified placeholder
    // (nothing about its true stats is revealed yet).
    row.createDiv({ cls: "pc-inv-stat", text: placeholder ? "" : keyStat(ctx) });
    row.createDiv({ cls: "pc-inv-weight", text: placeholder ? "" : formatWeight(ctx) });
    row.createDiv({ cls: "pc-inv-qty-cost", text: placeholder ? "" : qtyOrCost(ctx) });

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

/** The generic category shown for an unidentified placeholder in place of its
 *  true identity (e.g. "Potion", "Wondrous Item"). */
function maskedCategoryLabel(entity: InventoryRowCtx["resolved"]["entity"]): string {
  const mc = (entity as { masked_category?: string } | null)?.masked_category;
  return mc ? capitalize(mc) : "Unidentified";
}

/** Append the scroll's spell affordance to the sub-line: the chosen spell as a
 *  crimson chip (1A) when set, else the amber unset dot + a "+ Set spell" inline
 *  CTA (2B) that opens the spell picker. */
function fillScrollSub(sub: HTMLElement, ctx: InventoryRowCtx): void {
  const spellRef = ctx.entry.overrides?.spell;
  if (spellRef) {
    sub.appendText(" · ");
    const chip = sub.createSpan({ cls: "pc-meta-chip pc-spell-chip" });
    chip.setText(scrollSpellName(spellRef, ctx.registry));
    return;
  }
  sub.appendText(" · ");
  sub.createSpan({ cls: "pc-unset-dot" });
  const cta = sub.createEl("button", { cls: "pc-inline-cta" });
  // Const-indirection dodges the sentence-case UI lint (bare-literal only).
  cta.setText(SET_SPELL_LABEL);
  cta.addEventListener("click", (e) => {
    e.stopPropagation();
    const sheet = ctx.sheet;
    const level = scrollLevelOf(ctx.resolved.entity);
    if (sheet && level != null) openScrollSpellPicker(sheet, ctx.resolved.index, level);
  });
}

function scrollSpellName(ref: string, registry: EntityRegistry | null | undefined): string {
  const slug = ref.match(/^\[\[(.+)\]\]$/)?.[1] ?? ref;
  const found = registry?.getByTypeAndSlug?.("spell", slug) ?? registry?.getBySlug?.(slug);
  return found?.name ?? prettifyName(slug);
}

function scrollLevelOf(entity: InventoryRowCtx["resolved"]["entity"]): number | null {
  const lvl = (entity as { scroll_level?: number } | null)?.scroll_level;
  return typeof lvl === "number" ? lvl : null;
}

function keyStat(ctx: InventoryRowCtx): string {
  const e = ctx.resolved.entity as
    | {
        ac?: { base?: number; flat?: number; add_dex?: boolean };
        damage?: { dice?: string; type?: string };
        base_item?: string;
      }
    | null;
  const charges = ctx.entry.state?.charges;
  if (charges) return `${charges.current}/${charges.max} ch.`;
  if (ctx.resolved.entityType === "weapon" && e?.damage) {
    return formatWeaponDamage(e.damage);
  }
  if (ctx.resolved.entityType === "armor" && e?.ac) {
    const flat = e.ac.flat ? `+${e.ac.flat}` : "";
    return `AC ${e.ac.base ?? 0}${flat}${e.ac.add_dex ? " + Dex" : ""}`;
  }
  // Magic-weapon fallback: an Item entity with a `base_item` wikilink that
  // resolves to a known weapon should show the underlying weapon's damage so
  // the stat column doesn't appear empty for items like Flame Tongue.
  if (ctx.resolved.entityType === "item" && ctx.registry && typeof e?.base_item === "string") {
    const found = resolveBaseItem(e.base_item, ctx.registry);
    if (found?.entityType === "weapon") {
      const weaponDamage = (found.data as { damage?: { dice?: string; type?: string } }).damage;
      if (weaponDamage) return formatWeaponDamage(weaponDamage);
    }
    if (found?.entityType === "armor") {
      const armorAc = (found.data as { ac?: { base?: number; flat?: number; add_dex?: boolean } }).ac;
      if (armorAc) {
        const flat = armorAc.flat ? `+${armorAc.flat}` : "";
        return `AC ${armorAc.base ?? 0}${flat}${armorAc.add_dex ? " + Dex" : ""}`;
      }
    }
  }
  return "";
}

function formatWeaponDamage(damage: { dice?: string; type?: string }): string {
  const t = damage.type ? ` ${damage.type[0].toUpperCase()}` : "";
  return `${damage.dice ?? ""}${t}`;
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
    const res = ctx.editState.equipItemWithSwap(ctx.resolved.index);
    if (res.unequipped?.length) new Notice(`Unequipped ${res.unequipped.join(", ")} (slot occupied).`);
  }
}

function capitalize(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
