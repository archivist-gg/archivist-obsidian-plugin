import { z } from "zod";
import { featureSchema } from "../../shared/schemas/feature-schema";
import { resourceSchema } from "../../shared/schemas/resource-schema";

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const skillEnum = z.enum([
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
]);
const armorCategoryEnum = z.enum(["light", "medium", "heavy", "shield"]);
const weaponCategoryEnum = z.enum(["simple", "martial"]);
const hitDieEnum = z.enum(["d6", "d8", "d10", "d12"]);
const editionEnum = z.enum(["2014", "2024"]);

const weaponProficiencySchema = z.object({
  fixed: z.array(z.string()).optional(),
  categories: z.array(weaponCategoryEnum).optional(),
  conditional: z.array(z.object({
    category: weaponCategoryEnum,
    where_property: z.array(z.string()).nonempty(),
  })).optional(),
}).refine(
  (w) => (w.fixed?.length ?? 0) + (w.categories?.length ?? 0) + (w.conditional?.length ?? 0) > 0,
  { message: "weapon proficiency must declare at least one of fixed/categories/conditional" }
);

const toolProficiencySchema = z.object({
  fixed: z.array(z.string()).optional(),
  choice: z.object({
    count: z.number().int().positive(),
    from: z.array(z.string()).nonempty(),
  }).optional(),
}).refine((t) => (t.fixed?.length ?? 0) > 0 || t.choice !== undefined, {
  message: "tool proficiency must declare fixed or choice",
});

const startingEquipmentEntrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), options: z.array(z.string()).nonempty() }),
  z.object({ kind: z.literal("fixed"), items: z.array(z.string()).nonempty() }),
  z.object({ kind: z.literal("gold"), amount: z.number().positive() }),
]);

const spellcastingSchema = z.object({
  ability: abilityEnum,
  preparation: z.enum(["known", "prepared", "ritual", "spontaneous"]),
  cantrip_progression: z.record(z.string(), z.number().int().nonnegative()).optional(),
  spells_known_formula: z.string().optional(),
  spell_list: z.string().min(1),
});

const weaponMasterySchema = z.object({
  starting_count: z.number().int().nonnegative(),
  scaling: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

const classTableRowSchema = z.object({
  prof_bonus: z.number().int().positive(),
  columns: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  feature_ids: z.array(z.string()),
});

export const classEntitySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  edition: editionEnum,
  source: z.string().min(1),
  description: z.string(),
  hit_die: hitDieEnum,
  primary_abilities: z.array(abilityEnum).nonempty(),
  saving_throws: z.array(abilityEnum).length(2),
  proficiencies: z.object({
    armor: z.array(armorCategoryEnum),
    weapons: weaponProficiencySchema,
    tools: toolProficiencySchema.optional(),
  }),
  skill_choices: z.object({
    count: z.number().int().positive(),
    from: z.array(skillEnum).nonempty(),
  }),
  starting_equipment: z.array(startingEquipmentEntrySchema),
  spellcasting: spellcastingSchema.nullable(),
  subclass_level: z.number().int().positive(),
  subclass_feature_name: z.string().min(1),
  weapon_mastery: weaponMasterySchema.nullable(),
  epic_boon_level: z.number().int().positive().nullable(),
  table: z.record(z.string(), classTableRowSchema),
  features_by_level: z.record(z.string(), z.array(featureSchema)),
  resources: z.array(resourceSchema),
});
