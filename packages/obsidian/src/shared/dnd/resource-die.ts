import type { ResourceDie } from "../types/resource";

/** The die face in effect at `level`: the value of the highest `scaling` key
 *  ≤ level, else `die.base`. Keys are level thresholds as strings (JSON/YAML
 *  object keys are strings). Extracted from the resource badge so feature-attack
 *  damage can scale identically. Non-numeric scaling keys coerce to NaN and are skipped. */
export function resolveScalingDie(die: ResourceDie, level: number): string {
  let face = die.base;
  let best = 0;
  for (const [lvl, f] of Object.entries(die.scaling ?? {})) {
    const n = Number(lvl);
    if (n <= level && n > best) { best = n; face = f; }
  }
  return face;
}
