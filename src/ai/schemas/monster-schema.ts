import { z } from "zod";

const abilitiesSchema = z.object({
  str: z.number().min(1).max(30),
  dex: z.number().min(1).max(30),
  con: z.number().min(1).max(30),
  int: z.number().min(1).max(30),
  wis: z.number().min(1).max(30),
  cha: z.number().min(1).max(30),
});

const acSchema = z.object({
  ac: z.number(),
  from: z.array(z.string()).optional(),
  condition: z.string().optional(),
});

const hpSchema = z.object({
  average: z.number(),
  formula: z.string(),
});

const speedSchema = z.object({
  walk: z.number().optional(),
  fly: z.number().optional(),
  swim: z.number().optional(),
  climb: z.number().optional(),
  burrow: z.number().optional(),
});

const featureSchema = z.object({
  name: z.string(),
  entries: z.array(z.string().describe(
    "Feature text. Use inline formula tags for attack rolls, damage, and save DCs: " +
    "`atk:ABILITY` for attack bonus (e.g. `atk:STR`, `atk:DEX`), " +
    "`damage:DICE+ABILITY` for damage (e.g. `damage:1d6+STR`, `damage:2d6`), " +
    "`dc:ABILITY` for save DC (e.g. `dc:WIS`, `dc:CON`). " +
    "Use the ability that makes sense: STR for melee, DEX for ranged/finesse, spellcasting ability for spells."
  )),
});

export const monsterInputSchema = z.object({
  name: z.string().describe("Monster name"),
  size: z.enum(["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]),
  type: z.string().describe("Creature type (e.g., aberration, beast, dragon)"),
  subtype: z.string().optional(),
  alignment: z.string(),
  cr: z.string().describe('Challenge rating (e.g., "0", "1/8", "1/4", "1/2", "1" through "30")'),
  abilities: abilitiesSchema,
  ac: z.array(acSchema),
  hp: hpSchema,
  speed: speedSchema,
  saves: z.record(z.string(), z.number()).optional(),
  skills: z.record(z.string(), z.number()).optional(),
  damage_vulnerabilities: z.array(z.string()).optional(),
  damage_resistances: z.array(z.string()).optional(),
  damage_immunities: z.array(z.string()).optional(),
  condition_immunities: z.array(z.string()).optional(),
  senses: z.array(z.string()).optional(),
  passive_perception: z.number().optional(),
  languages: z.array(z.string()).optional(),
  traits: z.array(featureSchema).optional(),
  actions: z.array(featureSchema).optional(),
  reactions: z.array(featureSchema).optional(),
  legendary: z.array(featureSchema).optional(),
  legendary_actions: z.number().optional(),
  legendary_resistance: z.number().optional(),
});

export const monsterToolInput = { monster: monsterInputSchema };
