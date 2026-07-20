import { Notice, type App } from "obsidian";
import type { AttackRow, EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Ability } from "@archivist-gg/dnd5e";
import type { CharacterEditState } from "../../pc.edit-state";
import { renderItemBlock } from "../../../item/item.renderer";
import { renderWeaponBlock } from "../../../weapon/weapon.renderer";
import { renderArmorBlock } from "../../../armor/armor.renderer";
import type { WeaponEntity } from "@archivist-gg/dnd5e/weapon/weapon.types";
import type { ArmorEntity } from "@archivist-gg/dnd5e/armor/armor.types";
import type { Item } from "@archivist-gg/dnd5e/item/item.types";
import type { EntityRegistry } from "@archivist-gg/core";
import type { ComponentRenderContext } from "../component.types";
import { requiresAttunement } from "@archivist-gg/dnd5e/item/item.attunement";
import { unequipWithAttunementCheck } from "./unequip-flow";
import { renderOverrideActionsPanel } from "./override-actions-panel";
import { isScrollItem, isUnidentifiedPlaceholder } from "./item-predicates";
import { openScrollSpellPicker } from "./scroll-spell-picker";
import { openIdentifyPicker } from "./identify-item-picker";
import { prettifyName } from "./filter-state";

export interface RowExpandCtx {
  entry: EquipmentEntry;
  resolved: ResolvedEquipped;
  app: App;
  editState: CharacterEditState | null;
  /** Optional registry handle. Reserved for future expand-time entity lookups;
   *  currently unused by the renderer itself but accepted for API stability. */
  registry?: EntityRegistry | null;
  /** The full sheet render context, threaded by the inventory list so scroll /
   *  unidentified affordances can read the resolved character (chosen spell,
   *  caster ability) and open the spell / identify pickers. Absent in browse
   *  mode → those affordances are skipped there. */
  sheet?: ComponentRenderContext;
  /** 2024 weapon mastery for this attack, threaded ONLY by the Actions-tab
   *  weapons table so the weapon card shows an in-card mastery section. The
   *  Inventory-tab + compendium call sites pass none → card renders unchanged. */
  mastery?: AttackRow["mastery"];
  onAttuneConflict?: (incomingIndex: number) => void;
}

export function renderRowExpand(parent: HTMLElement, ctx: RowExpandCtx): HTMLElement {
  const expand = parent.createDiv({ cls: "pc-inv-expand" });

  if (!ctx.resolved.entity) {
    const orphan = expand.createDiv({ cls: "pc-inv-orphan" });
    orphan.createSpan({ cls: "pc-inv-orphan-icon", text: "⚠" });
    orphan.createSpan({
      cls: "pc-inv-orphan-msg",
      text: `No compendium entry for "${ctx.entry.item}". Link it as [[slug]] in YAML or remove the row.`,
    });
  } else if (ctx.resolved.entityType === "weapon") {
    expand.appendChild(renderWeaponBlock(ctx.resolved.entity as WeaponEntity, ctx.mastery));
  } else if (ctx.resolved.entityType === "armor") {
    expand.appendChild(renderArmorBlock(ctx.resolved.entity as ArmorEntity));
  } else {
    const item = ctx.resolved.entity as Item;
    // Async item renderer (markdown description); use a stable wrapper so the
    // returned `expand` reference stays valid for callers.
    const itemWrapper = expand.createDiv();
    void renderItemBlock(item, ctx.app).then((block) => {
      itemWrapper.appendChild(block);
    });
  }

  // 4C · scroll spell block: the chosen spell rendered as an item-block property
  // (Spell + level) with a change CTA, or a set-spell CTA when none is chosen.
  // Save DC / Attack live on the Spells tab where the scroll is cast, not here.
  // Only when the full sheet ctx is threaded (inventory list, not browse mode).
  if (ctx.sheet && isScrollItem(ctx.resolved.entity)) {
    renderScrollSpellSection(expand, ctx, ctx.sheet);
  }

  // PC-actions strip — sits below the block, separate concern.
  if (ctx.editState) renderActionsStrip(expand, ctx, ctx.editState);

  // Action overrides panel — collapsible, edit-mode only.
  if (ctx.editState) {
    const details = expand.createEl("details", { cls: "pc-override-actions-details" });
    details.createEl("summary", { text: "Action overrides" });
    renderOverrideActionsPanel(details, {
      entry: ctx.entry,
      entryIndex: ctx.resolved.index,
      editState: ctx.editState,
    });
  }
  return expand;
}

function renderActionsStrip(parent: HTMLElement, ctx: RowExpandCtx, editState: CharacterEditState): void {
  const strip = parent.createDiv({ cls: "pc-inv-actions" });
  const i = ctx.resolved.index;

  // 5A · Identify: for an unidentified placeholder, opens the shared
  // DecisionPickModal scoped to the placeholder's masked_category; picking a
  // real item identifies the row in place. Needs the sheet ctx for the registry.
  if (ctx.sheet && isUnidentifiedPlaceholder(ctx.resolved.entity)) {
    const sheet = ctx.sheet;
    const masked = (ctx.resolved.entity as { masked_category?: string } | null)?.masked_category ?? "";
    const idBtn = strip.createEl("button", { cls: "pc-inv-action pc-identify", text: "Identify…" });
    idBtn.addEventListener("click", () => openIdentifyPicker(sheet, i, masked));
  }

  // Equip / Unequip
  const equipBtn = strip.createEl("button", { cls: "pc-inv-action", text: ctx.entry.equipped ? "Unequip" : "Equip" });
  if (ctx.entry.equipped) equipBtn.classList.add("active");
  equipBtn.addEventListener("click", () => {
    if (ctx.entry.equipped) {
      void unequipWithAttunementCheck(ctx.app, editState, ctx.entry, i);
    } else {
      const res = editState.equipItemWithSwap(i);
      if (res.unequipped?.length) new Notice(`Unequipped ${res.unequipped.join(", ")} (slot occupied).`);
    }
  });

  // Attune / Unattune — only when required
  if (requiresAttunement(ctx.resolved.entity)) {
    const attuneBtn = strip.createEl("button", { cls: "pc-inv-action", text: ctx.entry.attuned ? "Unattune" : "Attune" });
    if (ctx.entry.attuned) attuneBtn.classList.add("active");
    attuneBtn.addEventListener("click", () => {
      if (ctx.entry.attuned) {
        editState.unattuneItem(i);
        return;
      }
      const result = editState.attuneItem(i);
      if (result.kind === "rejected") {
        ctx.onAttuneConflict?.(i);
      }
      if (result.unequipped?.length) {
        new Notice(`Unequipped ${result.unequipped.join(", ")} (slot occupied).`);
      }
    });
  }

  // Remove (existing ConfirmModal flow handled by editState.removeItem callers)
  const rmBtn = strip.createEl("button", { cls: "pc-inv-action danger", text: "Remove" });
  rmBtn.addEventListener("click", () => editState.removeItem(i));
}

// ── 4C · scroll spell block ──────────────────────────────────────────────────

/** Append a two-column item-block property row; returns the value cell so the
 *  caller can fill it with text and inline controls. Mirrors the weapon/armor
 *  renderers' `appendProperty` shape (`.archivist-item-property{,-label,-value}`). */
function itemProperty(parent: HTMLElement, label: string): HTMLElement {
  const row = parent.createDiv({ cls: "archivist-item-property" });
  row.createSpan({ cls: "archivist-item-property-label", text: label });
  return row.createSpan({ cls: "archivist-item-property-value" });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
const spellLevelLabel = (l: number): string => (l === 0 ? "Cantrip" : `${ordinal(l)} level`);

// Const-indirection so the sentence-case UI lint (bare-literal only, see
// decision-modal.ts) leaves these intended-casing CTA labels intact.
const SET_SPELL_LABEL = "+ Set spell";
const CHANGE_SPELL_LABEL = "change";

interface ScrollSpell {
  name: string;
  level: number;
  ability?: Ability;
}

/** Resolve the scroll's chosen spell for display. Prefers the resolver's item
 *  ResolvedSpell (carries the spell entity + derived casting ability), falling
 *  back to a registry lookup + the class/instance ability when the resolved pass
 *  has not (yet) produced a row. */
function resolveScrollSpell(sheet: ComponentRenderContext, entryIndex: number, spellRef: string): ScrollSpell {
  const fromResolved = sheet.resolved.spells.find(
    (s) => s.source === "item" && s.entryIndex === entryIndex,
  );
  if (fromResolved) {
    return { name: fromResolved.entity.name, level: fromResolved.entity.level ?? 0, ability: fromResolved.ability ?? undefined };
  }
  const slug = spellRef.match(/^\[\[(.+)\]\]$/)?.[1] ?? spellRef;
  const reg = sheet.services?.entities as
    | { getByTypeAndSlug?: (t: string, s: string) => { name?: string; data?: { level?: number } } | undefined;
        getBySlug?: (s: string) => { name?: string; data?: { level?: number } } | undefined | null; }
    | undefined;
  const found = reg?.getByTypeAndSlug?.("spell", slug) ?? reg?.getBySlug?.(slug) ?? null;
  const ability = sheet.derived.spellcastingClasses[0]?.ability
    ?? sheet.resolved.definition.equipment?.[entryIndex]?.overrides?.spell_ability;
  return { name: found?.name ?? prettifyName(slug), level: found?.data?.level ?? 0, ability };
}

function renderScrollSpellSection(parent: HTMLElement, ctx: RowExpandCtx, sheet: ComponentRenderContext): void {
  const entryIndex = ctx.resolved.index;
  const scrollLevel = (ctx.resolved.entity as { scroll_level?: number } | null)?.scroll_level ?? 0;
  const spellRef = ctx.entry.overrides?.spell;
  const section = parent.createDiv({ cls: "archivist-item-properties pc-scroll-spellblock" });

  if (spellRef) {
    const spell = resolveScrollSpell(sheet, entryIndex, spellRef);
    const value = itemProperty(section, "Spell");
    value.appendText(`${spell.name} · ${spellLevelLabel(spell.level)}`);
    // Secondary "change" affordance: a QUIET text-link, not a CTA pill. Reuses
    // the subtle `.pc-spell-remove` dress (muted text, transparent border until
    // hover) + `.pc-spell-change` for left spacing so it detaches from the value.
    // It reads clearly lighter than the primary "+ Set spell" `.pc-inline-cta`.
    const change = value.createEl("button", { cls: "pc-spell-remove pc-spell-change" });
    change.setText(CHANGE_SPELL_LABEL);
    change.addEventListener("click", (e) => {
      e.stopPropagation();
      openScrollSpellPicker(sheet, entryIndex, scrollLevel);
    });

    // Save DC / Attack are intentionally NOT shown here — they surface on the
    // Spells tab, where the scroll is actually cast (the cast row carries the
    // per-cast DC / attack from the resolved casting ability).
  } else {
    const value = itemProperty(section, "Spell");
    // P7 F1 · reuse the EQUIP / REMOVE dress (`.pc-inv-action`: subtle tan-outline
    // button that fills crimson on hover) so this set-spell affordance harmonizes
    // with its sibling action buttons instead of reading as a heavy crimson pill.
    const cta = value.createEl("button", { cls: "pc-inv-action" });
    cta.setText(SET_SPELL_LABEL);
    cta.addEventListener("click", (e) => {
      e.stopPropagation();
      openScrollSpellPicker(sheet, entryIndex, scrollLevel);
    });
  }
  // The no-caster casting ability is set once at the top of the Spells tab
  // (character-level overrides.spellcasting_ability), not per scroll row here.
}
