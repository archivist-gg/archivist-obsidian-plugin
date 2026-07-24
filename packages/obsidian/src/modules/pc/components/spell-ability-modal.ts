// src/modules/pc/components/spell-ability-modal.ts
import { Modal, type App } from "obsidian";
import type { Ability } from "@archivist-gg/dnd5e";
import { ABILITY_KEYS } from "@archivist-gg/dnd5e/dnd/constants";
import type { ComponentRenderContext } from "./component.types";
import type { CharacterEditState } from "../pc.edit-state";
import { characterHasOwnSpellcastingAbility } from "./inventory/scroll-spell-picker";

let current: SpellAbilityModal | null = null;

/** Open the spellcasting-ability modal (no-op without editState, matching the
 *  Max-HP / coin precedent). */
export function openSpellAbilityModal(ctx: ComponentRenderContext): void {
  if (!ctx.editState) return;
  // Close a stale modal bound to a DIFFERENT character before reusing/opening,
  // so a split-view click on sheet B never repaints sheet A's open modal.
  if (current && ctx.editState !== current.openedWith) current.close();
  if (current) { current.updateContext(ctx); return; }
  const modal = new SpellAbilityModal(ctx.app, ctx, ctx.editState);
  current = modal;
  modal.open();
}

/** Called from SpellsTab.render on every sheet render. Repaints the open modal
 *  from fresh ctx; CLOSES it when the editState identity changed (file switch). */
export function refreshSpellAbilityModal(ctx: ComponentRenderContext): void {
  if (!current) return;
  if (!ctx.editState || ctx.editState !== current.openedWith) { current.close(); return; }
  current.updateContext(ctx);
}

export function closeSpellAbilityModal(): void {
  current?.close();
}

class SpellAbilityModal extends Modal {
  constructor(
    app: App,
    private ctx: ComponentRenderContext,
    readonly openedWith: CharacterEditState,
  ) { super(app); }

  onOpen(): void {
    // No Escape hack: this modal has no inline TEXT edit (segmented buttons
    // commit on click, DC/Atk is display-only, revert is a button), so the
    // built-in Modal Escape-close is correct.
    this.contentEl.addClass("archivist-modal", "pc-spellability-modal");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
    if (current === this) current = null;
  }

  updateContext(ctx: ComponentRenderContext): void {
    this.ctx = ctx;
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    renderSpellAbilityBody(this.contentEl, this.ctx);
  }
}

/** Create a child element with an optional class + text and append it (native
 *  DOM, so the pure body renderer works both under jsdom and inside a real
 *  Obsidian modal contentEl). */
function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement, tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = parent.ownerDocument.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  parent.appendChild(node);
  return node;
}

/** Append the "Save DC NN · Atk +N" caption (bold values) to `host`. */
function renderDerived(host: HTMLElement, saveDC: number, attackBonus: number): void {
  const doc = host.ownerDocument;
  host.appendChild(doc.createTextNode("Save DC "));
  el(host, "b", undefined, String(saveDC));
  host.appendChild(doc.createTextNode(" · Atk "));
  el(host, "b", undefined, `${attackBonus >= 0 ? "+" : ""}${attackBonus}`);
}

/** Six-ability segmented control; `active` is the currently-selected ability,
 *  `onPick` commits the click. */
function renderAbilityToggle(
  row: HTMLElement, active: Ability | undefined, onPick: (ability: Ability) => void,
): void {
  const toggle = el(row, "div", "pc-spellability-toggle");
  for (const ability of ABILITY_KEYS) {
    const btn = el(toggle, "button", `pc-ability-seg${ability === active ? " active" : ""}`, ability.toUpperCase());
    btn.addEventListener("click", () => onPick(ability));
  }
}

/**
 * Pure body renderer for the spellcasting-ability modal (exported for jsdom
 * tests; no Obsidian Modal instantiation). One row per casting class with a
 * six-ability toggle + a revert control when that class is overridden, plus a
 * non-caster scroll row when the character holds Spell Scrolls but has no own
 * spellcasting ability.
 */
export function renderSpellAbilityBody(host: HTMLElement, ctx: ComponentRenderContext): void {
  const editState = ctx.editState;
  const overrides = ctx.resolved.definition.overrides;

  el(host, "div", "pc-spellability-title", "Spellcasting Ability");
  el(host, "div", "pc-spellability-sub",
    "Choose the ability each spell source uses for its Save DC and attack.");

  for (const entry of ctx.derived.spellcastingClasses) {
    const row = el(host, "div", "pc-spellability-row");
    const head = el(row, "div", "pc-spellability-head");
    el(head, "div", "pc-spellability-class", entry.className);
    renderDerived(el(head, "div", "pc-spellability-derived"), entry.saveDC, entry.attackBonus);

    renderAbilityToggle(row, entry.ability, (ability) =>
      editState?.setSpellcastingAbilityForClass(entry.classSlug, ability));

    // Show the revert control whenever the override KEY is present (even if it
    // resolves to the same ability), labeled with the engine's defaultAbility.
    if (overrides.spellcasting_ability_by_class?.[entry.classSlug] != null) {
      const revert = el(row, "button", "pc-spellability-revert",
        `Revert to default · ${entry.defaultAbility.toUpperCase()}`);
      revert.addEventListener("click", () =>
        editState?.setSpellcastingAbilityForClass(entry.classSlug, null));
    }
  }

  // Non-caster scroll row: this is the base pick (not a per-class override), so
  // no revert. A caster's scrolls resolve via ownSpellcastingAbility, so this
  // row is non-caster-only and the two axes never collide.
  if (!characterHasOwnSpellcastingAbility(ctx.derived)
      && ctx.resolved.spells.some((s) => s.source === "item")) {
    const currentAbility = overrides.spellcasting_ability;
    const row = el(host, "div", "pc-spellability-row");
    const head = el(row, "div", "pc-spellability-head");
    el(head, "div", "pc-spellability-class", "Spell Scrolls");
    const derivedStats = currentAbility ? ctx.derived.abilitySpellcasting[currentAbility] : undefined;
    if (derivedStats) {
      renderDerived(el(head, "div", "pc-spellability-derived"), derivedStats.saveDC, derivedStats.attackBonus);
    }

    renderAbilityToggle(row, currentAbility, (ability) =>
      editState?.setSpellcastingAbility(ability));
  }
}
