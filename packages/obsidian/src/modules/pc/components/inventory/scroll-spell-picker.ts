import type { ComponentRenderContext } from "../component.types";
import type { DerivedStats } from "@archivist-gg/dnd5e/pc/pc.types";
import type { EntityRegistry, RegisteredEntity } from "@archivist-gg/core";
import { DecisionPickModal } from "../builder/decision-modal";
import { hiddenCompendiumSet, entityCompendiumVisible } from "../../../../shared/entities/compendium-visibility";

// `search("", "spell", ENUMERATE_LIMIT)` is the empty-query enumeration shim (see
// browse-mode.ts collectCompendiumItems): the registry has no getAllByType, and
// `name.includes("")` matches every entity of the type.
//
// INFINITE, not a number: the level/edition gates below run AFTER this call, so
// a finite cap would silently hide matching scroll spells once the spell bucket
// outgrows it.
const ENUMERATE_LIMIT = Number.POSITIVE_INFINITY;

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
  hidden: ReadonlySet<string> = new Set(),
  keepSlug: string | null = null,
): RegisteredEntity[] {
  return reg.search("", "spell", ENUMERATE_LIMIT).filter((e) => {
    // Hidden compendiums drop out unless this is the currently-assigned spell
    // (selected-exemption); the level/edition gates below apply to everyone.
    if (!entityCompendiumVisible(e, hidden) && e.slug !== keepSlug) return false;
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

  const current = ctx.resolved.definition.equipment?.[entryIndex]?.overrides?.spell;
  const hidden = hiddenCompendiumSet(ctx.services?.plugin?.settings);
  const candidates = buildScrollSpellCandidates(
    reg, scrollLevel, ctx.resolved.definition.edition, hidden, current ? stripSlug(current) : null,
  );
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
