import { z } from "zod";

const castingOptionSchema = z.object({
  type: z.string(),
  damage_roll: z.string().optional(),
  target_count: z.number().optional(),
  duration: z.string().optional(),
  range: z.number().optional(),
  concentration: z.boolean().optional(),
  shape_size: z.number().optional(),
  desc: z.string().optional(),
});

export const spellEntitySchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(0).optional(),
  school: z.string().optional(),
  casting_time: z.string().optional(),
  range: z.string().optional(),
  components: z.string().optional(),
  duration: z.string().optional(),
  concentration: z.boolean().optional(),
  ritual: z.boolean().optional(),
  classes: z.array(z.string()).optional(),
  description: z.string().optional(),
  at_higher_levels: z.array(z.string()).optional(),
  damage: z.object({ types: z.array(z.string()) }).optional(),
  saving_throw: z.object({ ability: z.string() }).optional(),
  casting_options: z.array(castingOptionSchema).optional(),
}).strict();
