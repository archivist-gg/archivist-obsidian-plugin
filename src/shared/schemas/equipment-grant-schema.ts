import { z } from "zod";
import type { EquipmentGrant, EquipmentOption, StartingEquipmentEntry, StartingGold } from "../types/equipment-grant";

export const equipmentGrantSchema: z.ZodType<EquipmentGrant> = z.union([
  z.object({ item: z.string().min(1), qty: z.number().int().positive().optional() }).strict(),
  z.object({ category: z.string().min(1), qty: z.number().int().positive().optional() }).strict(),
  z.object({ gold: z.number().int().positive() }).strict(),
]);

export const equipmentOptionSchema: z.ZodType<EquipmentOption> = z.object({
  label: z.string().min(1),
  grants: z.array(equipmentGrantSchema),
}).strict();

export const startingEquipmentEntrySchema: z.ZodType<StartingEquipmentEntry> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), options: z.array(equipmentOptionSchema).nonempty() }).strict(),
  z.object({ kind: z.literal("fixed"), label: z.string().min(1).optional(), grants: z.array(equipmentGrantSchema) }).strict(),
  z.object({ kind: z.literal("gold"), amount: z.number().int().positive() }).strict(),
]);

export const startingGoldSchema: z.ZodType<StartingGold> = z.object({
  fixed: z.number().int().nonnegative().optional(),
  dice: z.string().min(1).optional(),
  multiplier: z.number().int().positive().optional(),
}).strict();
