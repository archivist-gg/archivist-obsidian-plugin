import type { ResourceConsumption } from "@archivist-gg/dnd5e/types/resource";

/** The ONE caption table for `consumes.expend_condition` (R4-G4 §3.2.3; the enum is engine-declared on
 *  `resourceConsumptionSchema` in dnd5e `src/schemas/resource-schema.ts`). Captions only: the SEMANTICS
 *  (spend only on a failed roll, ...) are G8's. `Record<...>` is the exhaustiveness guard, the
 *  `RESET_LABELS` idiom: widening the engine enum fails the build here until the new member gains a
 *  caption. */
export const EXPEND_CONDITION_LABELS: Record<NonNullable<ResourceConsumption["expend_condition"]>, string> = {
  roll_succeeds: "spent only when the roll succeeds",
  roll_fails: "spent only when the roll fails",
  target_takes_damage: "spent only when the target takes damage",
  always: "spent on use",
};
