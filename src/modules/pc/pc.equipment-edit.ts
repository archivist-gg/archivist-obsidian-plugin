import type { EntityRegistry } from "../../shared/entities/entity-registry";
import type { ArmorEntity } from "../armor/armor.types";
import type { WeaponEntity } from "../weapon/weapon.types";
import type { ItemEntity } from "../item/item.types";
import type { Character, EquipmentEntry, SlotKey } from "./pc.types";
import { resolveEntityForEntry, defaultSlotForType, isWeaponEntity } from "./pc.slotting";

export type EquipResult =
  | { kind: "ok" }
  | { kind: "conflict"; withIndex: number; slot: SlotKey };

export type AttuneResult =
  | { kind: "ok" }
  | { kind: "rejected"; reason: "limit-reached" };

function isTwoHanded(w: WeaponEntity): boolean {
  return w.properties.some((p) => p === "two_handed");
}

function resolveSlot(
  character: Character,
  index: number,
  registry?: EntityRegistry,
): { slot: SlotKey | null; entity: ArmorEntity | WeaponEntity | ItemEntity | null } {
  const entry = character.equipment[index];
  if (!registry) return { slot: entry.slot ?? null, entity: null };
  const { entity, entityType } = resolveEntityForEntry(entry.item, registry);
  if (entry.slot) return { slot: entry.slot, entity };
  let slot = defaultSlotForType(entityType, entity, registry);
  if (slot === "mainhand") {
    // A two-handed weapon can ONLY occupy the mainhand — never fall back to the
    // offhand when the mainhand is taken. Surface the conflict (handled by
    // equipItem) so the swap path can free the mainhand instead of silently
    // dropping the 2H weapon into the offhand alongside the existing weapon.
    const twoHandedWeapon = !!entity && isWeaponEntity(entity) && isTwoHanded(entity);
    if (!twoHandedWeapon) {
      const mainOccupied = character.equipment.some((e, i) => {
        if (i === index || !e.equipped) return false;
        if (e.slot === "mainhand") return true;
        if (e.slot) return false;
        const { entity: oe, entityType: oet } = resolveEntityForEntry(e.item, registry);
        return defaultSlotForType(oet, oe, registry) === "mainhand";
      });
      if (mainOccupied) slot = "offhand";
    }
  }
  return { slot, entity };
}

function findOccupant(
  character: Character,
  slot: SlotKey,
  registry?: EntityRegistry,
  excludeIndex?: number,
): number | null {
  if (!registry) return null;
  for (let i = 0; i < character.equipment.length; i++) {
    if (i === excludeIndex) continue;
    const e = character.equipment[i];
    if (!e.equipped) continue;
    if (e.slot === slot) return i;
    if (!e.slot) {
      const { entity, entityType } = resolveEntityForEntry(e.item, registry);
      if (defaultSlotForType(entityType, entity, registry) === slot) return i;
    }
  }
  return null;
}

export function addItem(
  character: Character,
  slug: string,
  opts: { equipped?: boolean; slot?: SlotKey | null; granted_by?: string },
  _registry?: EntityRegistry,
): void {
  const entry: EquipmentEntry = { item: `[[${slug}]]`, equipped: !!opts.equipped };
  if (opts.slot) entry.slot = opts.slot;
  if (opts.granted_by) entry.granted_by = opts.granted_by;
  character.equipment.push(entry);
}

export function removeItem(character: Character, index: number): void {
  if (index < 0 || index >= character.equipment.length) return;
  character.equipment.splice(index, 1);
}

export function equipItem(
  character: Character,
  index: number,
  registry: EntityRegistry,
): EquipResult {
  const entry = character.equipment[index];
  if (!entry) return { kind: "ok" };
  const { slot, entity } = resolveSlot(character, index, registry);
  if (!slot) {
    entry.equipped = true;
    return { kind: "ok" };
  }
  const occupant = findOccupant(character, slot, registry, index);
  if (occupant !== null) {
    return { kind: "conflict", withIndex: occupant, slot };
  }
  if (slot === "mainhand" && entity && isWeaponEntity(entity) && isTwoHanded(entity)) {
    const shieldHolder = findOccupant(character, "shield", registry, index);
    if (shieldHolder !== null) return { kind: "conflict", withIndex: shieldHolder, slot: "shield" };
  }
  // Reverse direction: equipping a shield while a two-handed weapon holds the
  // mainhand is a single-occupancy conflict on the 2H weapon (a shield cannot
  // be wielded alongside a two-handed weapon).
  if (slot === "shield") {
    const mainHolder = findOccupant(character, "mainhand", registry, index);
    if (mainHolder !== null) {
      const { entity: mainEntity } = resolveEntityForEntry(character.equipment[mainHolder].item, registry);
      if (mainEntity && isWeaponEntity(mainEntity) && isTwoHanded(mainEntity)) {
        return { kind: "conflict", withIndex: mainHolder, slot: "mainhand" };
      }
    }
  }
  entry.equipped = true;
  entry.slot = slot;
  return { kind: "ok" };
}

export function unequipItem(character: Character, index: number): void {
  const entry = character.equipment[index];
  if (!entry) return;
  entry.equipped = false;
  delete entry.slot;
}

function attunementLimit(character: Character): number {
  return character.overrides?.attunement_limit ?? 3;
}

function attunedCount(character: Character): number {
  return character.equipment.filter((e) => e.attuned).length;
}

export function attuneItem(
  character: Character,
  index: number,
  _registry: EntityRegistry,
): AttuneResult {
  const entry = character.equipment[index];
  if (!entry || entry.attuned) return { kind: "ok" };
  if (attunedCount(character) >= attunementLimit(character)) {
    return { kind: "rejected", reason: "limit-reached" };
  }
  entry.attuned = true;
  return { kind: "ok" };
}

export function unattuneItem(character: Character, index: number): void {
  const entry = character.equipment[index];
  if (!entry) return;
  entry.attuned = false;
}

export function setCharges(character: Character, index: number, current: number, max?: number): void {
  const entry = character.equipment[index];
  if (!entry?.state?.charges) return;
  if (typeof max === "number") entry.state.charges.max = Math.max(0, Math.floor(max));
  const ceiling = entry.state.charges.max;
  entry.state.charges.current = Math.max(0, Math.min(ceiling, Math.floor(current)));
}

export function clearCharges(character: Character, index: number): void {
  const entry = character.equipment[index];
  if (!entry?.state) return;
  delete entry.state.charges;
}

export function setCurrency(character: Character, coin: "pp" | "gp" | "ep" | "sp" | "cp", value: number): void {
  if (!character.currency) character.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  character.currency[coin] = Math.max(0, Math.floor(value));
}

export function expendCharge(character: Character, entryIdx: number, defaultMax?: number): void {
  const e = character.equipment?.[entryIdx];
  if (!e) return;
  if (!e.state) e.state = {};
  if (!e.state.charges) {
    if (!defaultMax || defaultMax <= 0) return;
    e.state.charges = { current: defaultMax, max: defaultMax };
  }
  e.state.charges.current = Math.max(0, e.state.charges.current - 1);
}

export function restoreCharge(character: Character, entryIdx: number, defaultMax?: number): void {
  const e = character.equipment?.[entryIdx];
  if (!e) return;
  if (!e.state) e.state = {};
  if (!e.state.charges) {
    if (!defaultMax || defaultMax <= 0) return;
    e.state.charges = { current: defaultMax, max: defaultMax };
  }
  e.state.charges.current = Math.min(e.state.charges.max, e.state.charges.current + 1);
}

/**
 * Atomic charge update. Sets `state.charges.current = clamp(max - newUsed, 0, max)`,
 * seeding `state.charges = { current: defaultMax, max: defaultMax }` if absent.
 * Called by the UI's per-click handler when the user clicks a charge pip; lets
 * a multi-pip jump (e.g. clicking from 3 used → 5 used) emit a single change.
 */
export function setItemCharges(
  character: Character,
  entryIdx: number,
  newUsed: number,
  defaultMax?: number,
): void {
  const e = character.equipment?.[entryIdx];
  if (!e) return;
  if (!e.state) e.state = {};
  if (!e.state.charges) {
    if (!defaultMax || defaultMax <= 0) return;
    e.state.charges = { current: defaultMax, max: defaultMax };
  }
  const max = e.state.charges.max;
  const used = Math.max(0, Math.min(max, Math.floor(newUsed)));
  e.state.charges.current = max - used;
}

export function setEquipmentOverride(
  character: Character,
  idx: number,
  patch: Partial<NonNullable<EquipmentEntry["overrides"]>>,
): void {
  const e = character.equipment?.[idx];
  if (!e) return;
  const next = { ...(e.overrides ?? {}), ...patch };
  // Strip undefined keys so YAML output stays clean when the user clears a field.
  for (const k of Object.keys(next) as Array<keyof typeof next>) {
    if (next[k] === undefined) delete next[k];
  }
  if (Object.keys(next).length === 0) {
    delete e.overrides;
  } else {
    e.overrides = next;
  }
}

export function setEquipmentState(
  character: Character,
  idx: number,
  patch: {
    charges?: { current?: number; max?: number };
    recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };
  },
): void {
  const e = character.equipment?.[idx];
  if (!e) return;
  e.state = e.state ?? {};
  if (patch.charges) {
    const cur = e.state.charges ?? { current: 0, max: 0 };
    const max = patch.charges.max ?? cur.max;
    const current = patch.charges.current ?? cur.current;
    e.state.charges = {
      current: Math.max(0, Math.min(max, Math.floor(current))),
      max: Math.max(0, Math.floor(max)),
    };
  }
  if (patch.recovery) e.state.recovery = patch.recovery;
}

export function expendFeatureUse(character: Character, featureKey: string): void {
  const fu = character.state.feature_uses ?? (character.state.feature_uses = {});
  const v = fu[featureKey];
  if (!v) return;
  v.used = Math.min(v.max, v.used + 1);
}

export function restoreFeatureUse(character: Character, featureKey: string): void {
  const v = character.state.feature_uses?.[featureKey];
  if (!v) return;
  v.used = Math.max(0, v.used - 1);
}

export function setFeatureUse(character: Character, featureKey: string, n: number): void {
  const v = character.state.feature_uses?.[featureKey];
  if (!v) return;
  if (!Number.isFinite(n)) return;
  v.used = Math.max(0, Math.min(v.max, Math.floor(n)));
}
