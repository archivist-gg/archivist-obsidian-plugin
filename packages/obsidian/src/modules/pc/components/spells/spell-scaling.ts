import type { Spell } from "../../../spell/spell.types";

/** A spell repeats under higher levels only if it has a real upcast benefit. */
export function spellScales(spell: Spell): boolean {
  return (spell.casting_options?.length ?? 0) > 0 || (spell.at_higher_levels?.length ?? 0) > 0;
}

/**
 * At-a-glance scaled effect for casting `spell` with a slot of `slotLevel`,
 * read from structured `casting_options` (`type: "slot_level_<N>"`). Returns
 * null when absent or untrustworthy. `damage_roll` is shown as-is; a
 * `target_count` that equals the slot level is the known SRD-2014 bad encoding
 * (e.g. Magic Missile 2nd->2 instead of 4) and is suppressed. This errs toward
 * showing nothing rather than a wrong number.
 */
export function spellEffectAtSlot(spell: Spell, slotLevel: number): string | null {
  const opt = (spell.casting_options ?? []).find((o) => o.type === `slot_level_${slotLevel}`);
  if (!opt) return null;
  if (opt.damage_roll) return opt.damage_roll;
  if (typeof opt.target_count === "number") {
    if (opt.target_count === slotLevel) return null; // 2014 bad-encoding guard
    return `${opt.target_count} targets`;
  }
  if (opt.duration) return opt.duration;
  return opt.desc ?? null;
}

/** Owned slot levels strictly above the spell's base level (scaling spells only). */
export function upcastLevelsFor(spell: Spell, ownedSlotLevels: number[]): number[] {
  const base = spell.level ?? 0;
  if (base < 1 || !spellScales(spell)) return [];
  return ownedSlotLevels.filter((l) => l > base).sort((a, b) => a - b);
}
