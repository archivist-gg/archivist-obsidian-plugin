import type { EntityRegistry } from "../../shared/entities/entity-registry";
import type { Ability } from "../../shared/types";
import type { ItemEntity } from "../item/item.types";
import type { ArmorEntity } from "../armor/armor.types";
import type { WeaponEntity } from "../weapon/weapon.types";
import type {
  AppliedBonuses,
  DerivedEquipment,
  EquipmentEntry,
  EquippedSlots,
  ResolvedCharacter,
  ResolvedEquipped,
  ProficiencySet,
  SlotKey,
} from "./pc.types";

const ABILITY_KEYS: readonly Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function isAbilityKey(k: string): k is Ability {
  return (ABILITY_KEYS as readonly string[]).includes(k);
}

interface ProficienciesForQuery {
  armor: ProficiencySet;
  weapons: ProficiencySet;
  tools: ProficiencySet;
}

export function emptyAppliedBonuses(): AppliedBonuses {
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
  // Registry stores data as Record<string, unknown>; the entityType discriminator
  // returned alongside narrows the runtime type, but TS can't follow it.
  // Cleaner registry typing is an SP6+ refactor.
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

    // Defenses and senses live on ItemEntity directly (not on bonuses) — propagate
    // regardless of whether the item has a bonuses object.
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

    const b = item.bonuses;
    if (!b) continue;

    if (typeof b.saving_throws === "number") out.save_bonus += b.saving_throws;
    if (typeof b.spell_attack === "number") out.spell_attack += b.spell_attack;
    if (typeof b.spell_save_dc === "number") out.spell_save_dc += b.spell_save_dc;

    if (b.ability_scores?.bonus) {
      for (const [k, n] of Object.entries(b.ability_scores.bonus)) {
        if (!isAbilityKey(k) || typeof n !== "number") continue;
        out.ability_bonuses[k] = (out.ability_bonuses[k] ?? 0) + n;
      }
    }
    if (b.ability_scores?.static) {
      for (const [k, n] of Object.entries(b.ability_scores.static)) {
        if (!isAbilityKey(k) || typeof n !== "number") continue;
        const prev = out.ability_statics[k];
        if (prev === undefined) {
          out.ability_statics[k] = n;
        } else {
          if (n !== prev) {
            warnings.push(
              `Multiple static ${k.toUpperCase()} bonuses on equipped+attuned items; using highest (${Math.max(prev, n)}).`,
            );
          }
          out.ability_statics[k] = Math.max(prev, n);
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
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// Pass B: slot assignment + attack rows + AC
// (Task 6: slot assignment only; AC + attack rows stubbed for Tasks 7/8.)
// ─────────────────────────────────────────────────────────────

function isWeaponEntity(e: unknown): e is WeaponEntity {
  if (!e || typeof e !== "object") return false;
  if (!("damage" in e) || !("category" in e)) return false;
  const cat = (e as { category: unknown }).category;
  return typeof cat === "string" && /melee|ranged/.test(cat);
}

function isTwoHanded(weapon: WeaponEntity): boolean {
  return weapon.properties.some((p) => p === "two_handed");
}

function defaultSlotForType(
  entityType: string | null,
  entity: ArmorEntity | WeaponEntity | ItemEntity | null,
): SlotKey | null {
  if (entityType === "weapon") return "mainhand";
  if (entityType === "armor") {
    if (entity && "category" in entity && entity.category === "shield") return "shield";
    return "armor";
  }
  return null;
}

function assignSlots(
  resolved: ResolvedCharacter,
  registry: EntityRegistry,
  warnings: string[],
): EquippedSlots {
  const slots: EquippedSlots = {};
  const eq = resolved.definition.equipment ?? [];

  // First sweep: explicit slot.
  for (let i = 0; i < eq.length; i++) {
    const entry = eq[i];
    if (!entry.equipped || !entry.slot) continue;
    const { entity } = lookupEntity(entry, registry);
    if (slots[entry.slot]) {
      warnings.push(`${entry.slot} slot conflict: ${entry.item} ignored (already taken).`);
      continue;
    }
    const placed: ResolvedEquipped = { index: i, entity, entry };
    slots[entry.slot] = placed;
  }

  // Second sweep: derived slot.
  for (let i = 0; i < eq.length; i++) {
    const entry = eq[i];
    if (!entry.equipped || entry.slot) continue;
    const { entity, entityType } = lookupEntity(entry, registry);
    if (!entity || !entityType) continue;

    const defaultSlot = defaultSlotForType(entityType, entity);
    if (!defaultSlot) continue;

    const placed: ResolvedEquipped = { index: i, entity, entry };
    if (defaultSlot === "mainhand") {
      if (!slots.mainhand) slots.mainhand = placed;
      else if (!slots.offhand) slots.offhand = placed;
      else warnings.push(`No free hand for ${entry.item}; entry remains equipped without slot.`);
    } else {
      if (slots[defaultSlot]) {
        warnings.push(`${defaultSlot} slot already filled; ${entry.item} ignored.`);
      } else {
        slots[defaultSlot] = placed;
      }
    }
  }

  // Two-handed + shield interaction.
  const main = slots.mainhand?.entity;
  if (main && isWeaponEntity(main) && isTwoHanded(main) && slots.shield) {
    warnings.push(`Two-handed weapon equipped; shield ignored.`);
  }

  return slots;
}

export function computeSlotsAndAttacks(
  resolved: ResolvedCharacter,
  _mods: Record<Ability, number>,
  _profs: ProficienciesForQuery,
  registry: EntityRegistry,
  warnings: string[],
): DerivedEquipment {
  const equippedSlots = assignSlots(resolved, registry, warnings);
  const overrides = resolved.definition.overrides ?? {};

  // Stub the rest until subsequent tasks fill in AC chain (Task 7) and attack rows (Task 8).
  return {
    ac: 0,
    acBreakdown: [],
    attacks: [],
    equippedSlots,
    carriedWeight: 0,
    // Attunement is persistent: an attuned item still occupies a slot even when unequipped (SRD).
    attunementUsed: (resolved.definition.equipment ?? []).filter((e) => e.attuned).length,
    attunementLimit: overrides.attunement_limit ?? 3,
  };
}
