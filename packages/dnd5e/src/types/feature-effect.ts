import type { Ability } from "./choice";

export type SenseType = "darkvision" | "blindsight" | "tremorsense" | "truesight";

export type FeatureEffect =
  | { kind: "initiative-bonus"; value: number }
  | { kind: "immune-condition"; condition: string; while?: string }
  | { kind: "resistance"; damage_type: string }
  | { kind: "hp-per-level-bonus"; value: number }
  | { kind: "speed-bonus"; mode: "walk" | "fly" | "swim" | "climb" | "burrow"; value: number; set?: boolean }
  | { kind: "sense"; type: SenseType; range: number }
  | {
      kind: "apply-condition";
      condition: string;
      duration?: string;
      ends_on?: string[];
      save_repeat?: { ability: string; timing: string };
    }
  | {
      kind: "damage-bonus";
      damage_type: string;
      amount: string;
      applies_to?: "weapon" | "spell" | "all";
      condition?: string;
    }
  | {
      kind: "proficiency";
      proficiency_type: "skill" | "tool" | "language" | "saving-throw" | "armor" | "weapon";
      value: string;
    }
  | { kind: "ac-bonus"; value: number; requires_armor?: boolean }
  | { kind: "unarmored-ac"; abilities: Ability[]; base?: number; allow_shield?: boolean }
  // `weapons` recognises the sentinel "chosen" (the wielder's chosen weapon) as
  // well as explicit weapon slug(s); both are plain strings at runtime.
  | { kind: "weapon-ability"; ability: Ability | "spellcasting"; weapons?: string | string[] }
  | {
      kind: "roll-modifier";
      mode: "advantage" | "disadvantage";
      roll: "ability-check" | "saving-throw" | "attack";
      scope?: string;
      condition?: string;
    }
  | { kind: "crit-range"; min_roll: number; applies_to?: "weapon" | "spell" | "all"; condition?: string }
  | { kind: "extra-attack"; count: number }
  | { kind: "reroll-damage"; max_reroll: number; applies_to?: "weapon" | "spell" | "all"; once_per_die?: boolean }
  | { kind: "attack-rule"; flag: "no-ranged-in-melee-disadvantage" };
