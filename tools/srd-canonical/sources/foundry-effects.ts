// tools/srd-canonical/sources/foundry-effects.ts
//
// Translate Foundry-effect changes into typed bonus contributions.
// Pure function — no I/O. The merger reconciler consumes these and
// folds them into the canonical ItemBonuses block.

import type {
  BonusFieldPath,
  Condition,
} from "../../../src/modules/item/item.conditions.types";

export interface FoundryChange {
  key: string;
  mode: "ADD" | "OVERRIDE" | "DOWNGRADE" | "UPGRADE" | "MULTIPLY" | "CUSTOM" | string;
  value: number | string;
}

export interface FoundryBonusContribution {
  tag: "bonus";
  field: BonusFieldPath;
  value: number;
  when: Condition[];
}

export interface FoundryStaticContribution {
  tag: "static";
  ability: "str" | "dex" | "con" | "int" | "wis" | "cha";
  value: number;
}

export type FoundrySideChannel =
  | { tag: "side-channel"; kind: "immune"; value: string }
  | { tag: "side-channel"; kind: "resist"; value: string }
  | { tag: "side-channel"; kind: "vulnerable"; value: string }
  | { tag: "side-channel"; kind: "sense"; sense: "darkvision" | "tremorsense" | "truesight" | "blindsight"; value: number }
  | { tag: "side-channel"; kind: "grants_proficiency"; value: string };

export type FoundryContribution =
  | FoundryBonusContribution
  | FoundryStaticContribution
  | FoundrySideChannel;

const ABILITY_KEYS = new Set(["str", "dex", "con", "int", "wis", "cha"]);
const SENSE_KEYS = new Set(["darkvision", "tremorsense", "truesight", "blindsight"]);
const MOVEMENT_KEYS = new Set(["walk", "fly", "swim", "climb"]);

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, "");
    if (/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  }
  return undefined;
}

function warn(itemName: string, message: string): void {
  console.warn(`[foundry-effects] ${itemName}: ${message}`);
}

export function translateFoundryChanges(
  changes: FoundryChange[],
  itemName: string,
): FoundryContribution[] {
  const out: FoundryContribution[] = [];
  for (const change of changes) {
    if (change.mode !== "ADD") {
      warn(itemName, `unsupported mode "${change.mode}" on ${change.key} — skipped`);
      continue;
    }
    const c = translateOne(change, itemName);
    if (c) out.push(c);
  }
  return out;
}

function translateOne(change: FoundryChange, itemName: string): FoundryContribution | null {
  // Attack-mode-keyed bonuses: mwak/rwak/msak/rsak.{attack,damage}.
  const akMatch = /^system\.bonuses\.(mwak|rwak|msak|rsak)\.(attack|damage)$/.exec(change.key);
  if (akMatch) {
    const [, mode, kind] = akMatch;
    const isMelee = mode.startsWith("m");
    const isSpell = mode.endsWith("sak");
    if (isSpell && kind === "damage") {
      warn(itemName, `${change.key}: spell_damage field not modeled — skipped`);
      return null;
    }
    const value = coerceNumber(change.value);
    if (value === undefined) {
      warn(itemName, `${change.key}: non-numeric value "${change.value}" — skipped`);
      return null;
    }
    const field: BonusFieldPath = isSpell
      ? "spell_attack"
      : kind === "attack" ? "weapon_attack" : "weapon_damage";
    const when: Condition[] = [
      { kind: "on_attack_type", value: isMelee ? "melee" : "ranged" },
    ];
    return { tag: "bonus", field, value, when };
  }

  // Speed.
  const moveMatch = /^system\.attributes\.movement\.(walk|fly|swim|climb)$/.exec(change.key);
  if (moveMatch && MOVEMENT_KEYS.has(moveMatch[1])) {
    const sub = moveMatch[1];
    const value = coerceNumber(change.value);
    if (value === undefined) {
      warn(itemName, `${change.key}: non-numeric value "${change.value}" — skipped`);
      return null;
    }
    return { tag: "bonus", field: `speed.${sub}` as BonusFieldPath, value, when: [] };
  }

  // Static ability score setter.
  const abMatch = /^system\.abilities\.(str|dex|con|int|wis|cha)\.value$/.exec(change.key);
  if (abMatch && ABILITY_KEYS.has(abMatch[1])) {
    const value = coerceNumber(change.value);
    if (value === undefined) {
      warn(itemName, `${change.key}: non-numeric value "${change.value}" — skipped`);
      return null;
    }
    return { tag: "static", ability: abMatch[1] as FoundryStaticContribution["ability"], value };
  }

  // Senses.
  const senseMatch = /^system\.attributes\.senses\.(\w+)$/.exec(change.key);
  if (senseMatch && SENSE_KEYS.has(senseMatch[1])) {
    const value = coerceNumber(change.value);
    if (value === undefined) {
      warn(itemName, `${change.key}: non-numeric value "${change.value}" — skipped`);
      return null;
    }
    return {
      tag: "side-channel",
      kind: "sense",
      sense: senseMatch[1] as "darkvision" | "tremorsense" | "truesight" | "blindsight",
      value,
    };
  }

  // Defense traits (immune/resist/vulnerable).
  if (change.key === "system.traits.di.value" && typeof change.value === "string") {
    return { tag: "side-channel", kind: "immune", value: change.value };
  }
  if (change.key === "system.traits.dr.value" && typeof change.value === "string") {
    return { tag: "side-channel", kind: "resist", value: change.value };
  }
  if (change.key === "system.traits.dv.value" && typeof change.value === "string") {
    return { tag: "side-channel", kind: "vulnerable", value: change.value };
  }

  // Weapon proficiency.
  if (change.key === "system.traits.weaponProf.value" && typeof change.value === "string") {
    return { tag: "side-channel", kind: "grants_proficiency", value: change.value };
  }

  warn(itemName, `unmapped change ${change.key}=${JSON.stringify(change.value)} — skipped`);
  return null;
}
