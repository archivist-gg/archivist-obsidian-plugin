import { z } from "zod";

export const featureEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("initiative-bonus"), value: z.number().int() }),
  z.object({ kind: z.literal("immune-condition"), condition: z.string().min(1), while: z.string().optional() }),
  z.object({ kind: z.literal("resistance"), damage_type: z.string().min(1) }),
  z.object({ kind: z.literal("hp-per-level-bonus"), value: z.number().int() }),
  z.object({
    kind: z.literal("speed-bonus"),
    mode: z.enum(["walk", "fly", "swim", "climb", "burrow"]),
    value: z.number().int(),
  }),
  z.object({
    kind: z.literal("sense"),
    type: z.enum(["darkvision", "blindsight", "tremorsense", "truesight"]),
    range: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("apply-condition"),
    condition: z.string().min(1),
    duration: z.string().optional(),
    ends_on: z.array(z.string()).optional(),
    save_repeat: z.object({
      ability: z.string().min(1),
      timing: z.string().min(1),
    }).optional(),
  }),
  z.object({ kind: z.literal("damage-bonus"), damage_type: z.string().min(1), amount: z.string().min(1) }),
  z.object({
    kind: z.literal("proficiency"),
    proficiency_type: z.enum(["skill", "tool", "language", "saving-throw"]),
    value: z.string().min(1),
  }),
  z.object({
    kind: z.literal("ac-bonus"),
    value: z.number().int(),
    requires_armor: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("unarmored-ac"),
    abilities: z.array(z.enum(["str", "dex", "con", "int", "wis", "cha"])),
    base: z.number().int().optional(),
    allow_shield: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("weapon-ability"),
    ability: z.union([z.enum(["str", "dex", "con", "int", "wis", "cha"]), z.literal("spellcasting")]),
    weapons: z.union([z.literal("chosen"), z.string(), z.array(z.string())]).optional(),
  }),
  z.object({
    kind: z.literal("roll-modifier"),
    mode: z.enum(["advantage", "disadvantage"]),
    roll: z.enum(["ability-check", "saving-throw", "attack"]),
    scope: z.string().optional(),
    condition: z.string().optional(),
  }),
  z.object({ kind: z.literal("extra-attack"), count: z.number().int().positive() }),
  z.object({
    kind: z.literal("crit-range"),
    min_roll: z.number().int().min(2).max(20),
    applies_to: z.enum(["weapon", "spell", "all"]).optional(),
    condition: z.string().optional(),
  }),
]);
