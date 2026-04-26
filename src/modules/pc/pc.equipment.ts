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
import { readNumericBonus } from "../item/item.bonuses";
import type {
  ConditionContext,
  BonusFieldPath,
  InformationalBonus,
} from "../item/item.conditions.types";

const ABILITY_KEYS: readonly Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function isAbilityKey(k: string): k is Ability {
  return (ABILITY_KEYS as readonly string[]).includes(k);
}

interface ProficienciesForQuery {
  armor: ProficiencySet;
  weapons: ProficiencySet;
  tools: ProficiencySet;
}

// TODO(SP6+): wire item.grants.senses through DerivedStats.senses + SensesPanel
export function emptyAppliedBonuses(): AppliedBonuses {
  return {
    ability_bonuses: {},
    ability_statics: {},
    save_bonus: 0,
    speed_bonuses: { walk: 0, fly: null, swim: 0, climb: 0 },
    spell_attack: 0,
    spell_save_dc: 0,
    defenses: { resistances: [], immunities: [], vulnerabilities: [], condition_immunities: [] },
    informational: [],
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

function unwrapClassSlug(maybeWiki: string | null | undefined): string {
  if (!maybeWiki) return "";
  const m = /^\[\[([^\]]+)\]\]$/.exec(maybeWiki);
  return (m ? m[1] : maybeWiki).toLowerCase();
}

function buildConditionContext(
  resolved: ResolvedCharacter,
  equippedSlots: EquippedSlots,
): ConditionContext {
  return {
    derived: { equippedSlots },
    classList: resolved.definition.class ?? [],
    race: resolved.definition.race,
    subclasses: (resolved.definition.class ?? [])
      .map((c) => c.subclass)
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .map(unwrapClassSlug),
  };
}

function pushApply(
  outcome: ReturnType<typeof readNumericBonus>,
  field: BonusFieldPath,
  source: string,
  pool: InformationalBonus[],
  onApply: (value: number) => void,
): void {
  if (!outcome) return;
  if (outcome.kind === "applied") onApply(outcome.value);
  else if (outcome.kind === "informational") {
    pool.push({ field, source, value: outcome.value, conditions: outcome.conditions });
  }
  // skipped -> drop silently
}

export function computeAppliedBonuses(
  resolved: ResolvedCharacter,
  _profs: ProficienciesForQuery,
  registry: EntityRegistry,
  warnings: string[],
): AppliedBonuses {
  const out = emptyAppliedBonuses();
  const equipment = resolved.definition.equipment ?? [];

  // Pass A doesn't yet know slot assignments. Use an empty-slot context for
  // condition evaluation; Pass A only consumes Tier-1 conditions like
  // is_class/is_race/is_subclass that don't depend on slots, and the
  // affected fields here (saves, spells, abilities, speeds) currently have
  // no slot-dependent SRD conditions.
  const ctx = buildConditionContext(resolved, {});

  for (const entry of equipment) {
    const { entity, entityType } = lookupEntity(entry, registry);

    if (!entity) {
      const slug = unwrapSlug(entry.item);
      if (slug && entry.equipped) warnings.push(`Equipped item [[${slug}]] not found in compendium.`);
      continue;
    }
    if (!isAttunedActive(entry, entity)) continue;
    if (entityType !== "item") continue;

    const item = entity as ItemEntity;

    item.resist?.forEach((s) => out.defenses.resistances.push(s));
    item.immune?.forEach((s) => out.defenses.immunities.push(s));
    item.vulnerable?.forEach((s) => out.defenses.vulnerabilities.push(s));
    item.condition_immune?.forEach((s) => out.defenses.condition_immunities.push(s));

    const b = item.bonuses;
    if (!b) continue;

    pushApply(readNumericBonus(b.saving_throws, ctx), "saving_throws", item.name,
      out.informational, (v) => { out.save_bonus += v; });
    pushApply(readNumericBonus(b.spell_attack, ctx), "spell_attack", item.name,
      out.informational, (v) => { out.spell_attack += v; });
    pushApply(readNumericBonus(b.spell_save_dc, ctx), "spell_save_dc", item.name,
      out.informational, (v) => { out.spell_save_dc += v; });

    if (b.ability_scores?.bonus) {
      for (const [k, v] of Object.entries(b.ability_scores.bonus)) {
        if (!isAbilityKey(k)) continue;
        pushApply(readNumericBonus(v, ctx),
          `ability_scores.bonus.${k}`,
          item.name, out.informational,
          (val) => { out.ability_bonuses[k] = (out.ability_bonuses[k] ?? 0) + val; });
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
      pushApply(readNumericBonus(b.speed.walk, ctx), "speed.walk", item.name,
        out.informational, (v) => { out.speed_bonuses.walk += v; });
      if (b.speed.fly === "walk") {
        out.speed_bonuses.fly = "walk";
      } else {
        pushApply(readNumericBonus(b.speed.fly, ctx),
          "speed.fly", item.name, out.informational,
          (v) => {
            const cur = out.speed_bonuses.fly;
            out.speed_bonuses.fly = (typeof cur === "number" ? cur : 0) + v;
          });
      }
      pushApply(readNumericBonus(b.speed.swim, ctx), "speed.swim", item.name,
        out.informational, (v) => { out.speed_bonuses.swim += v; });
      pushApply(readNumericBonus(b.speed.climb, ctx), "speed.climb", item.name,
        out.informational, (v) => { out.speed_bonuses.climb += v; });
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
    const { entity, entityType } = lookupEntity(entry, registry);
    if (slots[entry.slot]) {
      warnings.push(`${entry.slot} slot conflict: ${entry.item} ignored (already taken).`);
      continue;
    }
    const placed: ResolvedEquipped = { index: i, entity, entityType, entry };
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

    const placed: ResolvedEquipped = { index: i, entity, entityType, entry };
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
): { ac: number; breakdown: ACTerm[]; informational: InformationalBonus[] } {
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
  const acInformational: InformationalBonus[] = [];
  const acCtx = buildConditionContext(resolved, equippedSlots);
  for (const entry of resolved.definition.equipment ?? []) {
    const { entity, entityType } = lookupEntity(entry, registry);
    if (!entity || entityType !== "item") continue;
    if (!isAttunedActive(entry, entity)) continue;
    const item = entity as ItemEntity;
    const out = readNumericBonus(item.bonuses?.ac, acCtx);
    if (!out) continue;
    if (out.kind === "applied") {
      ac += out.value;
      breakdown.push({ source: item.name, amount: out.value, kind: "item" });
    } else if (out.kind === "informational") {
      acInformational.push({
        field: "ac",
        source: item.name,
        value: out.value,
        conditions: out.conditions,
      });
    }
  }

  return { ac, breakdown, informational: acInformational };
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
 * Combined magic-item + per-entry weapon bonuses for the equipped entry.
 * Looks up the entity for the entry, sums the magic ItemEntity's
 * weapon_attack/weapon_damage with the entry's own override bonuses, and
 * surfaces extra_damage / sourceName for the breakdown tooltip.
 */
function magicBonusesForWeaponEntry(
  entry: EquipmentEntry,
  registry: EntityRegistry,
  ctx: ConditionContext,
): {
  atk: number;
  dmg: number;
  extra?: string;
  sourceName?: string;
  informational: InformationalBonus[];
} {
  const { entity } = lookupEntity(entry, registry);
  const ovr = entry.overrides ?? {};
  const entryAttack = typeof ovr.bonus === "number" ? ovr.bonus : 0;
  const entryDamage = typeof ovr.damage_bonus === "number" ? ovr.damage_bonus : 0;
  const extra = typeof ovr.extra_damage === "string" ? ovr.extra_damage : undefined;

  let itemAttack = 0;
  let itemDamage = 0;
  let sourceName: string | undefined;
  const informational: InformationalBonus[] = [];

  if (entity && isItemEntity(entity)) {
    sourceName = entity.name;
    const b = entity.bonuses;
    const atkOut = readNumericBonus(b?.weapon_attack, ctx);
    const dmgOut = readNumericBonus(b?.weapon_damage, ctx);
    if (atkOut?.kind === "applied") itemAttack = atkOut.value;
    else if (atkOut?.kind === "informational")
      informational.push({ field: "weapon_attack", source: entity.name, value: atkOut.value, conditions: atkOut.conditions });
    if (dmgOut?.kind === "applied") itemDamage = dmgOut.value;
    else if (dmgOut?.kind === "informational")
      informational.push({ field: "weapon_damage", source: entity.name, value: dmgOut.value, conditions: dmgOut.conditions });
  }

  return {
    atk: itemAttack + entryAttack,
    dmg: itemDamage + entryDamage,
    extra,
    sourceName,
    informational,
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
  magic: { atk: number; dmg: number; extra?: string; sourceName?: string; informational: InformationalBonus[] };
}): AttackRow {
  const { id, name, weapon, baseDice, ability, mods, proficient, proficiencyBonus, magic } = args;

  const abilityMod = mods[ability];
  const pb = proficient ? proficiencyBonus : 0;
  const toHit = abilityMod + pb + magic.atk;
  const dmgFlat = abilityMod + magic.dmg;
  const damageDice = `${baseDice}${dmgFlat >= 0 ? "+" : ""}${dmgFlat}`.replace(/\+0$/, "");

  const magicSource = magic.sourceName ? `${magic.sourceName} bonus` : "Magic weapon";

  // Plan contract: emit all 3 terms structurally (Task 16 may filter zeros itself).
  const toHitBreakdown: ACTerm[] = [
    { source: `${ability.toUpperCase()} modifier`, amount: abilityMod, kind: "ability" },
    { source: "Proficiency bonus", amount: proficient ? proficiencyBonus : 0, kind: "ability" },
    { source: magicSource, amount: magic.atk, kind: "item" },
  ];

  const damageBreakdown: ACTerm[] = [
    { source: "Base damage", amount: 0, kind: "ability" },
    { source: `${ability.toUpperCase()} modifier`, amount: abilityMod, kind: "ability" },
    { source: magicSource, amount: magic.dmg, kind: "item" },
  ];

  const isRanged = /ranged/.test(weapon.category);
  const range = isRanged && weapon.range
    ? `${weapon.range.normal}/${weapon.range.long}`
    : "melee";

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
    extraDamage: magic.extra,
    properties: stringProps,
    proficient,
    breakdown: { toHit: toHitBreakdown, damage: damageBreakdown },
    informational: args.magic.informational.length > 0 ? args.magic.informational : undefined,
  };
}

function computeAttacks(
  equippedSlots: EquippedSlots,
  mods: Record<Ability, number>,
  profs: ProficienciesForQuery,
  registry: EntityRegistry,
  warnings: string[],
  proficiencyBonus: number,
  ctx: ConditionContext,
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
      if (found && isWeaponEntity(found.data)) {
        weapon = found.data;
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
    const magic = magicBonusesForWeaponEntry(entry, registry, ctx);
    const ovr = entry.overrides ?? {};
    const displayName = ovr.name ?? weapon.name;

    const baseRow = buildAttackRow({
      id: `${placed.index}:standard`,
      name: displayName,
      weapon,
      baseDice: weapon.damage.dice,
      ability,
      mods,
      proficient,
      proficiencyBonus,
      magic,
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
        id: `${placed.index}:versatile`,
        name: `${displayName} (versatile, 2h)`,
        weapon,
        baseDice: weapon.damage.versatile_dice,
        ability,
        mods,
        proficient,
        proficiencyBonus,
        magic,
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
  proficiencyBonus: number,
): DerivedEquipment {
  const equippedSlots = assignSlots(resolved, registry, warnings);
  const overrides = resolved.definition.overrides ?? {};

  const acOut = computeAC(equippedSlots, resolved, mods, registry);
  const ctx = buildConditionContext(resolved, equippedSlots);
  const attacks = computeAttacks(equippedSlots, mods, profs, registry, warnings, proficiencyBonus, ctx);
  return {
    ac: acOut.ac,
    acBreakdown: acOut.breakdown,
    acInformational: acOut.informational,
    attacks,
    equippedSlots,
    carriedWeight: 0,
    // Attunement is persistent: an attuned item still occupies a slot even when unequipped (SRD).
    attunementUsed: (resolved.definition.equipment ?? []).filter((e) => e.attuned).length,
    attunementLimit: overrides.attunement_limit ?? 3,
  };
}
