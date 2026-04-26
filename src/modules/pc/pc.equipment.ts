import type { EntityRegistry } from "../../shared/entities/entity-registry";
import type { Ability } from "../../shared/types";
import type { ItemEntity } from "../item/item.types";
import type { ArmorEntity } from "../armor/armor.types";
import type { WeaponEntity } from "../weapon/weapon.types";
import type {
  ACTerm,
  AppliedBonuses,
  AttackRow,
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

function isArmorEntity(e: unknown): e is ArmorEntity {
  return !!e && typeof e === "object" && "ac" in e && "category" in e && !("damage" in e);
}

function isTwoHanded(weapon: WeaponEntity): boolean {
  return weapon.properties.some((p) => p === "two_handed");
}

function defaultSlotForType(
  entityType: string | null,
  entity: ArmorEntity | WeaponEntity | ItemEntity | null,
  registry: EntityRegistry,
): SlotKey | null {
  if (entityType === "weapon") return "mainhand";
  if (entityType === "armor") {
    if (entity && "category" in entity && entity.category === "shield") return "shield";
    return "armor";
  }
  // Magic items with a base_item pointing to a known weapon/armor route to
  // the matching slot so they participate in attack rows / AC.
  if (entityType === "item" && isItemEntity(entity) && typeof entity.base_item === "string") {
    const base = registry.getByTypeAndSlug("weapon", entity.base_item);
    if (base) return "mainhand";
    const baseArmor = registry.getByTypeAndSlug("armor", entity.base_item);
    if (baseArmor) {
      const armorData = baseArmor.data as unknown as ArmorEntity;
      return armorData.category === "shield" ? "shield" : "armor";
    }
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

    const defaultSlot = defaultSlotForType(entityType, entity, registry);
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

function computeAC(
  equippedSlots: EquippedSlots,
  resolved: ResolvedCharacter,
  mods: Record<Ability, number>,
  registry: EntityRegistry,
): { ac: number; breakdown: ACTerm[] } {
  const breakdown: ACTerm[] = [];
  const armorSlot = equippedSlots.armor;
  const armorEntity = armorSlot?.entity ?? null;

  let ac = 10;
  if (armorEntity && isArmorEntity(armorEntity)) {
    ac = armorEntity.ac.base + armorEntity.ac.flat;
    breakdown.push({ source: armorEntity.name, amount: armorEntity.ac.base + armorEntity.ac.flat, kind: "armor" });
    if (armorEntity.ac.add_dex) {
      const dexCap = armorEntity.ac.dex_max ?? Number.POSITIVE_INFINITY;
      const dexAdd = Math.min(mods.dex, dexCap);
      ac += dexAdd;
      const capped = mods.dex > dexCap;
      breakdown.push({ source: `DEX modifier${capped ? " (capped)" : ""}`, amount: dexAdd, kind: "dex" });
    }
  } else {
    // Unarmored: 10 + DEX (Unarmored Defense already handled by recalc's fallback;
    // here we only show base + DEX as an unarmored breakdown when no armor is equipped).
    ac = 10 + mods.dex;
    breakdown.push({ source: "Base", amount: 10, kind: "unarmored" });
    breakdown.push({ source: "DEX modifier", amount: mods.dex, kind: "dex" });
  }

  // Per-armor entry override.
  const acBonus = armorSlot?.entry.overrides?.ac_bonus;
  if (typeof acBonus === "number" && acBonus !== 0) {
    ac += acBonus;
    breakdown.push({ source: `${armorEntity?.name ?? "Armor"} (override)`, amount: acBonus, kind: "override" });
  }

  // Shield (only if mainhand isn't two-handed).
  const main = equippedSlots.mainhand?.entity;
  const mainIsTwoHanded = main && isWeaponEntity(main) && isTwoHanded(main);
  const shieldEntity = equippedSlots.shield?.entity ?? null;
  if (shieldEntity && isArmorEntity(shieldEntity) && !mainIsTwoHanded) {
    const n = shieldEntity.ac.base + shieldEntity.ac.flat;
    ac += n;
    breakdown.push({ source: shieldEntity.name, amount: n, kind: "shield" });
  }

  // Equipped+attuned items.bonuses.ac (AC-bonus magic items).
  for (const entry of resolved.definition.equipment ?? []) {
    const { entity, entityType } = lookupEntity(entry, registry);
    if (!entity || entityType !== "item") continue;
    if (!isAttunedActive(entry, entity)) continue;
    const item = entity as ItemEntity;
    if (typeof item.bonuses?.ac === "number" && item.bonuses.ac !== 0) {
      ac += item.bonuses.ac;
      breakdown.push({ source: item.name, amount: item.bonuses.ac, kind: "item" });
    }
  }

  return { ac, breakdown };
}

// ─────────────────────────────────────────────────────────────
// Attack rows (Pass B, second half).
// Resolves equipped weapons (including magic items with base_item) into
// AttackRow entries. Picks the right ability mod (STR/DEX/finesse-best),
// stacks magic-item bonuses with per-entry overrides, applies proficiency,
// and emits a versatile "two-handed" second row only when the offhand is
// free.
// ─────────────────────────────────────────────────────────────

function hasProperty(weapon: WeaponEntity, prop: string): boolean {
  return weapon.properties.some((p) => p === prop);
}

function attackAbility(weapon: WeaponEntity, mods: Record<Ability, number>): Ability {
  const isRanged = /ranged/.test(weapon.category);
  if (isRanged) return "dex";
  if (hasProperty(weapon, "finesse")) return mods.dex >= mods.str ? "dex" : "str";
  return "str";
}

function isWeaponSlugProficient(
  weapon: WeaponEntity,
  weaponSlug: string,
  profs: ProficienciesForQuery,
): boolean {
  const wp = profs.weapons;
  if (wp.specific.includes(weaponSlug)) return true;
  // WeaponEntity.category is like "martial-melee" / "simple-ranged"; map to
  // the simple/martial axis used in proficiency category lists.
  const cat = weapon.category;
  if (typeof cat === "string") {
    if (/^simple\b/.test(cat) && wp.categories.includes("simple")) return true;
    if (/^martial\b/.test(cat) && wp.categories.includes("martial")) return true;
    if (wp.categories.includes(cat)) return true;
  }
  return false;
}

/**
 * Sums weapon_attack/weapon_damage bonuses from the magic ItemEntity (when
 * the equipped entry is an item with a base_item), defaulting to 0/0 for
 * plain weapon entities.
 */
function magicBonusesForWeaponEntry(
  entity: ArmorEntity | WeaponEntity | ItemEntity | null,
): { attack: number; damage: number } {
  if (!entity || !isItemEntity(entity)) return { attack: 0, damage: 0 };
  const b = entity.bonuses;
  return {
    attack: typeof b?.weapon_attack === "number" ? b.weapon_attack : 0,
    damage: typeof b?.weapon_damage === "number" ? b.weapon_damage : 0,
  };
}

function buildAttackRow(args: {
  id: string;
  name: string;
  weapon: WeaponEntity;
  baseDice: string;
  ability: Ability;
  mods: Record<Ability, number>;
  proficient: boolean;
  proficiencyBonus: number;
  magicAttack: number;
  magicDamage: number;
  entryAttack: number;
  entryDamage: number;
  extraDamage?: string;
}): AttackRow {
  const {
    id, name, weapon, baseDice, ability, mods, proficient, proficiencyBonus,
    magicAttack, magicDamage, entryAttack, entryDamage, extraDamage,
  } = args;

  const abilityMod = mods[ability];
  const pb = proficient ? proficiencyBonus : 0;
  const toHit = abilityMod + pb + magicAttack + entryAttack;
  const dmgFlat = abilityMod + magicDamage + entryDamage;
  const damageDice = `${baseDice}${dmgFlat >= 0 ? "+" : ""}${dmgFlat}`.replace(/\+0$/, "");

  const toHitBreakdown: ACTerm[] = [
    { source: `${ability.toUpperCase()} modifier`, amount: abilityMod, kind: "ability" },
  ];
  if (pb !== 0) toHitBreakdown.push({ source: "Proficiency bonus", amount: pb, kind: "ability" });
  if (magicAttack !== 0) toHitBreakdown.push({ source: "Magic", amount: magicAttack, kind: "item" });
  if (entryAttack !== 0) toHitBreakdown.push({ source: "Override", amount: entryAttack, kind: "override" });

  const damageBreakdown: ACTerm[] = [
    { source: `${ability.toUpperCase()} modifier`, amount: abilityMod, kind: "ability" },
  ];
  if (magicDamage !== 0) damageBreakdown.push({ source: "Magic", amount: magicDamage, kind: "item" });
  if (entryDamage !== 0) damageBreakdown.push({ source: "Override", amount: entryDamage, kind: "override" });

  const range = weapon.range
    ? `${weapon.range.normal}/${weapon.range.long} ft`
    : undefined;

  // Filter out conditional-property objects so the consumer gets a clean
  // list of property names. WeaponProperty is a union of string literals and
  // ConditionalProperty objects; narrow to the string literal arm.
  const stringProps: string[] = weapon.properties.filter(
    (p): p is Exclude<typeof p, { kind: "conditional" }> => typeof p === "string",
  );

  return {
    id,
    name,
    range,
    toHit,
    damageDice,
    damageType: weapon.damage.type,
    extraDamage,
    properties: stringProps,
    proficient,
    breakdown: { toHit: toHitBreakdown, damage: damageBreakdown },
  };
}

function computeAttacks(
  equippedSlots: EquippedSlots,
  mods: Record<Ability, number>,
  profs: ProficienciesForQuery,
  registry: EntityRegistry,
  warnings: string[],
  proficiencyBonus: number,
): AttackRow[] {
  const rows: AttackRow[] = [];
  const handedSlots: Array<{ key: "mainhand" | "offhand"; placed: ResolvedEquipped | undefined }> = [
    { key: "mainhand", placed: equippedSlots.mainhand },
    { key: "offhand", placed: equippedSlots.offhand },
  ];

  for (const { key, placed } of handedSlots) {
    if (!placed) continue;
    const { entity, entry } = placed;
    if (!entity) continue;

    // Resolve the underlying WeaponEntity. Direct weapon entries use entity
    // as-is; ItemEntity entries with base_item resolve through the registry.
    let weapon: WeaponEntity | null = null;
    if (isWeaponEntity(entity)) {
      weapon = entity;
    } else if (isItemEntity(entity) && typeof entity.base_item === "string") {
      const baseSlug = entity.base_item;
      const found = registry.getByTypeAndSlug("weapon", baseSlug);
      if (found && isWeaponEntity(found.data as unknown)) {
        weapon = found.data as unknown as WeaponEntity;
      } else {
        warnings.push(`Magic weapon ${entity.name} references missing base_item [[${baseSlug}]].`);
        continue;
      }
    } else {
      continue;
    }

    // Determine slug for proficiency check: prefer the literal slug from the
    // equipment entry (so the magic-item slug counts), fall back to the
    // weapon's own slug.
    const slugFromEntry = unwrapSlug(entry.item) ?? weapon.slug;
    const proficient = isWeaponSlugProficient(weapon, slugFromEntry, profs)
      || isWeaponSlugProficient(weapon, weapon.slug, profs);
    if (!proficient) {
      warnings.push(`Character not proficient with ${weapon.name}; proficiency bonus excluded.`);
    }

    const ability = attackAbility(weapon, mods);
    const { attack: magicAttack, damage: magicDamage } = magicBonusesForWeaponEntry(entity);
    const ovr = entry.overrides ?? {};
    const entryAttack = typeof ovr.bonus === "number" ? ovr.bonus : 0;
    const entryDamage = typeof ovr.damage_bonus === "number" ? ovr.damage_bonus : 0;
    const extraDamage = typeof ovr.extra_damage === "string" ? ovr.extra_damage : undefined;
    const displayName = ovr.name ?? weapon.name;

    const baseRow = buildAttackRow({
      id: `${key}:${weapon.slug}`,
      name: displayName,
      weapon,
      baseDice: weapon.damage.dice,
      ability,
      mods,
      proficient,
      proficiencyBonus,
      magicAttack,
      magicDamage,
      entryAttack,
      entryDamage,
      extraDamage,
    });
    rows.push(baseRow);

    // Versatile second row: only when the weapon is versatile, has a
    // versatile_dice, AND the offhand is free (so the player could grip
    // two-handed).
    if (
      key === "mainhand"
      && hasProperty(weapon, "versatile")
      && typeof weapon.damage.versatile_dice === "string"
      && !equippedSlots.offhand
    ) {
      rows.push(buildAttackRow({
        id: `${key}:${weapon.slug}:versatile`,
        name: `${displayName} (versatile)`,
        weapon,
        baseDice: weapon.damage.versatile_dice,
        ability,
        mods,
        proficient,
        proficiencyBonus,
        magicAttack,
        magicDamage,
        entryAttack,
        entryDamage,
        extraDamage,
      }));
    }
  }

  return rows;
}

export function computeSlotsAndAttacks(
  resolved: ResolvedCharacter,
  mods: Record<Ability, number>,
  profs: ProficienciesForQuery,
  registry: EntityRegistry,
  warnings: string[],
  proficiencyBonus = 2,
): DerivedEquipment {
  const equippedSlots = assignSlots(resolved, registry, warnings);
  const overrides = resolved.definition.overrides ?? {};

  const { ac, breakdown } = computeAC(equippedSlots, resolved, mods, registry);
  const attacks = computeAttacks(equippedSlots, mods, profs, registry, warnings, proficiencyBonus);
  return {
    ac,
    acBreakdown: breakdown,
    attacks,
    equippedSlots,
    carriedWeight: 0,
    // Attunement is persistent: an attuned item still occupies a slot even when unequipped (SRD).
    attunementUsed: (resolved.definition.equipment ?? []).filter((e) => e.attuned).length,
    attunementLimit: overrides.attunement_limit ?? 3,
  };
}
