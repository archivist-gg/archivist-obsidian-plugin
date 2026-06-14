import { z } from "zod";

/** A buff/effect duration. Parsed in Phase 2 and rendered as a static label;
 *  Phase 3's activatable-buff toggle consumes the structured form. */
export const durationSchema = z.union([
  z.literal("instantaneous"),
  z.literal("until-dispelled"),
  z.object({
    amount: z.number().int().positive(),
    unit: z.enum(["round", "minute", "hour", "day"]),
  }).strict(),
]);

export type Duration = z.infer<typeof durationSchema>;
