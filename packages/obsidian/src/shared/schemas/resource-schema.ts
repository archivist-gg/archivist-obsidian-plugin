import { z } from "zod";

const resetTriggerEnum = z.enum(["short-rest", "long-rest", "dawn", "dusk", "turn", "round", "custom"]);
const actionCostEnum = z.enum(["action", "bonus-action", "reaction", "free", "special"]);

export const resourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  max_formula: z.string().min(1),
  scales_at: z.array(z.object({
    level: z.number().int().positive(),
    max: z.string().min(1),
  }).strict()).optional(),
  die: z.object({
    base: z.string().min(1),
    scaling: z.record(z.string(), z.string()).optional(),
  }).optional(),
  reset: resetTriggerEnum,
  consumes: z.object({
    resource: z.string().min(1),
    amount: z.number().int().positive(),
  }).optional(),
  recovery: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    amount: z.union([z.number(), z.string()]),
    action: actionCostEnum.optional(),
    uses: z.number().int().nonnegative().optional(),
    reset: resetTriggerEnum,
  })).optional(),
});

export const resourceConsumptionSchema = z.object({
  source: z.enum(["resource", "class-column", "attack-dice"]).optional(),
  resource: z.string().optional(),
  column: z.string().optional(),
  amount: z.number().int().positive(),
  expend_condition: z.enum(["roll_succeeds", "roll_fails", "target_takes_damage", "always"]).optional(),
  free_uses: z.object({
    amount: z.number().int().positive(),
    reset: resetTriggerEnum,
    state_key: z.string().optional(),
  }).optional(),
});

export { resetTriggerEnum, actionCostEnum };
