import type { EntityRegistry } from "../../shared/entities/entity-registry";
import type { Ability } from "../../shared/types";
import type { ItemEntity } from "../item/item.types";
import type { ArmorEntity } from "../armor/armor.types";
import type { WeaponEntity } from "../weapon/weapon.types";
import type {
  AppliedBonuses,
  EquipmentEntry,
  ResolvedCharacter,
  ProficiencySet,
} from "./pc.types";

interface ProficienciesForQuery {
  armor: ProficiencySet;
  weapons: ProficiencySet;
  tools: ProficiencySet;
}

function emptyAppliedBonuses(): AppliedBonuses {
  return {
    ability_bonuses: {},
    ability_statics: {},
    save_bonus: 0,
    speed_bonuses: { walk: 0, fly: null, swim: 0, climb: 0 },
    spell_attack: 0,
    spell_save_dc: 0,
    defenses: { resistances: [], immunities: [], vulnerabilities: [], condition_immunities: [] },
    senses: { darkvision: 0, tremorsense: 0, truesight: 0, blindsight: 0 },
  };
}

function unwrapSlug(item: string): string | null {
  const m = item.match(/^\[\[(.+)\]\]$/);
  return m ? m[1] : null;
}

function lookupEntity(
  entry: EquipmentEntry,
  registry: EntityRegistry,
): { entity: ArmorEntity | WeaponEntity | ItemEntity | null; entityType: string | null } {
  const slug = unwrapSlug(entry.item);
  if (!slug) return { entity: null, entityType: null };
  const found = registry.getBySlug(slug);
  if (!found) return { entity: null, entityType: null };
  return {
    entity: found.data as unknown as ArmorEntity | WeaponEntity | ItemEntity,
    entityType: found.entityType,
  };
}

function isItemEntity(e: unknown): e is ItemEntity {
  return !!e && typeof e === "object" && "rarity" in e;
}

function isAttunedActive(entry: EquipmentEntry, entity: ItemEntity | ArmorEntity | WeaponEntity | null): boolean {
  if (!entry.equipped) return false;
  const requires =
    isItemEntity(entity) &&
    entity.attunement &&
    typeof entity.attunement === "object" &&
    "required" in entity.attunement &&
    entity.attunement.required === true;
  if (!requires) return true;
  return entry.attuned === true;
}

export function computeAppliedBonuses(
  resolved: ResolvedCharacter,
  _profs: ProficienciesForQuery,
  registry: EntityRegistry,
  warnings: string[],
): AppliedBonuses {
  const out = emptyAppliedBonuses();
  const equipment = resolved.definition.equipment ?? [];

  for (const entry of equipment) {
    const { entity, entityType } = lookupEntity(entry, registry);

    if (!entity) {
      const slug = unwrapSlug(entry.item);
      if (slug && entry.equipped) warnings.push(`Equipped item [[${slug}]] not found in compendium.`);
      continue;
    }
    if (!isAttunedActive(entry, entity)) continue;
    if (entityType !== "item") continue; // armor/weapon bonuses applied in Pass B

    const item = entity as ItemEntity;
    const b = item.bonuses;
    if (!b) continue;

    if (typeof b.saving_throws === "number") out.save_bonus += b.saving_throws;
    if (typeof b.spell_attack === "number") out.spell_attack += b.spell_attack;
    if (typeof b.spell_save_dc === "number") out.spell_save_dc += b.spell_save_dc;

    if (b.ability_scores?.bonus) {
      for (const [ab, n] of Object.entries(b.ability_scores.bonus) as [Ability, number][]) {
        if (typeof n === "number") out.ability_bonuses[ab] = (out.ability_bonuses[ab] ?? 0) + n;
      }
    }
    if (b.ability_scores?.static) {
      for (const [ab, n] of Object.entries(b.ability_scores.static) as [Ability, number][]) {
        if (typeof n !== "number") continue;
        const prev = out.ability_statics[ab];
        if (prev === undefined) {
          out.ability_statics[ab] = n;
        } else {
          if (n !== prev) {
            warnings.push(
              `Multiple static ${ab.toUpperCase()} bonuses on equipped+attuned items; using highest (${Math.max(prev, n)}).`,
            );
          }
          out.ability_statics[ab] = Math.max(prev, n);
        }
      }
    }

    if (b.speed) {
      if (typeof b.speed.walk === "number") out.speed_bonuses.walk += b.speed.walk;
      if (b.speed.fly === "walk") out.speed_bonuses.fly = "walk";
      else if (typeof b.speed.fly === "number") {
        const cur = out.speed_bonuses.fly;
        out.speed_bonuses.fly = (typeof cur === "number" ? cur : 0) + b.speed.fly;
      }
      if (typeof b.speed.swim === "number") out.speed_bonuses.swim += b.speed.swim;
      if (typeof b.speed.climb === "number") out.speed_bonuses.climb += b.speed.climb;
    }

    item.resist?.forEach((s) => out.defenses.resistances.push(s));
    item.immune?.forEach((s) => out.defenses.immunities.push(s));
    item.vulnerable?.forEach((s) => out.defenses.vulnerabilities.push(s));
    item.condition_immune?.forEach((s) => out.defenses.condition_immunities.push(s));

    const senses = item.grants?.senses;
    if (senses) {
      if (typeof senses.darkvision === "number") out.senses.darkvision = Math.max(out.senses.darkvision, senses.darkvision);
      if (typeof senses.tremorsense === "number") out.senses.tremorsense = Math.max(out.senses.tremorsense, senses.tremorsense);
      if (typeof senses.truesight === "number") out.senses.truesight = Math.max(out.senses.truesight, senses.truesight);
      if (typeof senses.blindsight === "number") out.senses.blindsight = Math.max(out.senses.blindsight, senses.blindsight);
    }
  }

  return out;
}
