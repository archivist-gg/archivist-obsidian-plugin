// src/modules/pc/pc.rest.ts
import type { Character, DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";
import type { RestPlan, RestCategoryId } from "@archivist-gg/dnd5e/pc/pc.rest";

export function applyRestResets(
  character: Character,
  _resolved: ResolvedCharacter,
  derived: DerivedStats,
  plan: RestPlan,
  optouts: Set<RestCategoryId>,
): void {
  const isKept = (id: RestCategoryId) => !optouts.has(id);

  for (const cat of plan.categories) {
    if (!isKept(cat.id)) continue;

    if (cat.id === "hp-to-max") {
      const wasZero = character.state.hp.current === 0;
      character.state.hp.current = derived.hp.max;
      if (wasZero && character.state.death_saves) {
        character.state.death_saves = { successes: 0, failures: 0 };
      }
      continue;
    }

    if (cat.id === "exhaustion") {
      character.state.exhaustion = Math.max(0, character.state.exhaustion - 1);
      continue;
    }

    if (cat.id === "hp-modifier-reset") {
      const hp = character.overrides.hp;
      if (hp?.modifier !== undefined) {
        delete hp.modifier;
        if (Object.keys(hp).length === 0) delete character.overrides.hp;
      }
      continue;
    }

    if (cat.id === "spell-slots") {
      for (const slot of Object.values(character.state.spell_slots ?? {})) {
        slot.used = 0;
      }
      continue;
    }

    if (cat.id === "pact-slots") {
      if (character.state.spell_slots_pact) character.state.spell_slots_pact.used = 0;
      continue;
    }

    if (cat.id === "hd-regain") {
      // Use plan-captured target so re-applying is idempotent (min never re-restores).
      for (const d of plan.hdRegainDist ?? []) {
        const hd = character.state.hit_dice?.[d.die];
        if (!hd) continue;
        hd.used = Math.min(hd.used, Math.max(0, d.targetUsed));
      }
      continue;
    }

    if (cat.id.startsWith("feature:")) {
      const key = cat.id.slice("feature:".length);
      const fu = character.state.feature_uses?.[key];
      if (!fu) continue;
      // R4-G4 §7.2.2: a partial recovery category regains N uses (or all); the own reset regains to 0.
      fu.used = cat.restore === undefined || cat.restore === "all" ? 0 : Math.max(0, fu.used - cat.restore);
      continue;
    }

    if (cat.id.startsWith("buff:")) {
      // R4-G5 §4.4.2: end an active buff whose carrier declares a structured `duration`. The stored key is the
      // id's tail. The emptied array is DELETED, not left as [], so a no-buff file carries no `active_buffs:`
      // line: the same rule `CharacterEditState.toggleActiveBuff` applies, and the two writers must not drift.
      const key = cat.id.slice("buff:".length);
      const list = character.state.active_buffs;
      if (!list) continue;
      const i = list.indexOf(key);
      if (i >= 0) list.splice(i, 1);
      if (list.length === 0) delete character.state.active_buffs;
      continue;
    }

    if (cat.id.startsWith("item:")) {
      const idx = Number(cat.id.slice("item:".length));
      const entry = character.equipment[idx];
      if (entry?.state?.charges) {
        entry.state.charges.current = entry.state.charges.max;
      }
      continue;
    }
  }

  // Concentration is unconditional on long rest, no opt-out
  if (plan.type === "long") {
    character.state.concentration = null;
  }
}
