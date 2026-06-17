import { z } from "zod";

const wikilinkRegex = /^\[\[[^[\]]+\]\]$/;

export const selectionPoolSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  source: z.object({
    entity_type: z.literal("optional-feature"),
    where: z.object({
      feature_type: z.string().min(1),
      available_to: z.literal("self"),
    }),
  }),
  count: z.object({ column: z.string().min(1) }),
  replaceable: z.boolean().optional(),
});

export const poolGrantSchema = z.object({
  pool: z.string().min(1),
  grants: z.array(z.object({
    feature: z.string().regex(wikilinkRegex),
    at_level: z.number().int().positive(),
  })),
});

export const tabDeclSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  renders: z.object({
    pool: z.string().min(1),
    layout: z.enum(["spell-like", "blocks"]).optional(),
  }),
});
