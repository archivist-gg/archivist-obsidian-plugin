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
  z.object({ kind: z.literal("darkvision"), range: z.number().int().nonnegative() }),
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
]);
