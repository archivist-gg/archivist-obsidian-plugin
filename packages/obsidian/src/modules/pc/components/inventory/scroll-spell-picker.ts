import type { ComponentRenderContext } from "../component.types";
import type { DerivedStats } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Ability } from "@archivist-gg/dnd5e";
import type { EntityRegistry, RegisteredEntity } from "@archivist-gg/core";
import { DecisionPickModal } from "../builder/decision-modal";

// `search("", "spell", ENUMERATE_LIMIT)` is the empty-query enumeration shim (see
// browse-mode.ts collectCompendiumItems): the registry has no getAllByType, and
// `name.includes("")` matches every entity of the type.
const ENUMERATE_LIMIT = 10_000;

/** Abilities a no-caster scroll can be cast with (INT/WIS/CHA, the three
 *  spellcasting abilities). Offered by the ability-capture control. */
const SCROLL_ABILITIES: Ability[] = ["int", "wis", "cha"];

/** A spell matches its scroll when it sits at the scroll's level AND shares the
 *  character's edition. An edition-less spell (homebrew) is kept so the picker
 *  never goes empty for it; a spell declaring a DIFFERENT edition is dropped.
 *  Mirrors the lenient edition read used across the spell surfaces. */
function editionMatches(spellEdition: unknown, charEdition: string): boolean {
  return !spellEdition || spellEdition === charEdition;
}

/**
 * Build the candidate spell list for a Spell Scroll: every registered spell at
 * `scrollLevel` (a cantrip scroll is level 0) whose edition matches the
 * character's. DecisionPickModal applies NO EntityFilter, so the caller assembles
 * the candidates here. Exported pure for tests.
 */
export function buildScrollSpellCandidates(
  reg: EntityRegistry,
  scrollLevel: number,
  charEdition: string,
): RegisteredEntity[] {
  return reg.search("", "spell", ENUMERATE_LIMIT).filter((e) => {
    const data = e.data as { level?: number; edition?: unknown };
    return (data.level ?? 0) === scrollLevel && editionMatches(data.edition, charEdition);
  });
}

/**
 * Whether the character has an OWN (class) spellcasting ability. Mirrors the
 * resolver's scroll-ability signal (`resolveSpellcasting` per class →
 * `derived.spellcastingClasses`): a non-caster has an empty list. When this is
 * false a scroll cast has no DC unless the instance carries `spell_ability`,
 * which the ability-capture control writes.
 */
export function characterHasOwnSpellcastingAbility(derived: DerivedStats): boolean {
  return derived.spellcastingClasses.length > 0;
}

/** Strip `[[slug]]` to `slug`; pass a bare slug through unchanged. */
function stripSlug(ref: string): string {
  const m = ref.match(/^\[\[(.+)\]\]$/);
  return m ? m[1] : ref;
}

/**
 * Open the scroll spell picker: the level+edition candidate spells in the shared
 * long-list DecisionPickModal (choose 1). The chosen slug is written to the
 * entry's `overrides.spell`; the sheet re-renders through the edit-state
 * onChange path. Title uses `·`/`:` only (never an em dash).
 */
export function openScrollSpellPicker(
  ctx: ComponentRenderContext,
  entryIndex: number,
  scrollLevel: number,
): void {
  const reg = ctx.services?.entities as EntityRegistry | undefined;
  const editState = ctx.editState;
  if (!reg || !editState) return;

  const candidates = buildScrollSpellCandidates(reg, scrollLevel, ctx.resolved.definition.edition);
  const current = ctx.resolved.definition.equipment?.[entryIndex]?.overrides?.spell;
  const levelLabel = scrollLevel === 0 ? "cantrip" : `level ${scrollLevel}`;

  new DecisionPickModal(ctx.app, ctx, {
    title: `Scroll spell · choose a ${levelLabel} spell`,
    need: 1,
    candidates,
    initialSelected: current ? [stripSlug(current)] : [],
    writeValue: (slugs) => {
      if (slugs[0]) editState.setEquipmentOverride(entryIndex, { spell: slugs[0] });
    },
    stateKey: `scroll-spell.${entryIndex}`,
  }).open();
}

/**
 * Reusable INT/WIS/CHA capture control for a no-caster scroll. Each pick writes
 * the entry's `overrides.spell_ability` (the resolver then derives the DC via
 * `derived.abilitySpellcasting`). SHARED with the cast-view no-ability affordance
 * (T6): kept dependency-light (ctx + entryIndex). Callers gate WHEN to show it
 * via `characterHasOwnSpellcastingAbility` + the entry's current value.
 */
export function renderScrollAbilityControl(
  parent: HTMLElement,
  ctx: ComponentRenderContext,
  entryIndex: number,
  current?: Ability,
): void {
  const row = parent.createDiv({ cls: "archivist-item-property pc-scroll-ability" });
  row.createSpan({ cls: "archivist-item-property-label", text: "Cast using" });
  const opts = row.createDiv({ cls: "archivist-item-property-value pc-scroll-ability-opts" });
  for (const ability of SCROLL_ABILITIES) {
    const btn = opts.createEl("button", {
      cls: `pc-inline-cta pc-scroll-ability-btn${current === ability ? " active" : ""}`,
      text: ability.toUpperCase(),
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      ctx.editState?.setEquipmentOverride(entryIndex, { spell_ability: ability });
    });
  }
}
