// src/modules/item/item.bonuses.ts
//
// Single accessor for "read a numeric bonus that may be flat or
// conditional, return one of three outcomes." Every consumer of
// item.bonuses.* numeric fields routes through here.

import type {
  BonusReadResult,
  ConditionalBonus,
  ConditionContext,
} from "./item.conditions.types";
import { evaluateConditions } from "./item.conditions";

function isConditionalBonus(x: unknown): x is ConditionalBonus {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as { value?: unknown }).value === "number" &&
    Array.isArray((x as { when?: unknown }).when)
  );
}

export function readNumericBonus(
  raw: number | ConditionalBonus | undefined | null,
  ctx: ConditionContext,
): BonusReadResult | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") {
    return raw === 0 ? null : { kind: "applied", value: raw };
  }
  if (!isConditionalBonus(raw)) return null;
  if (raw.value === 0) return null;
  const outcome = evaluateConditions(raw.when, ctx);
  if (outcome === "true") return { kind: "applied", value: raw.value };
  if (outcome === "false") return { kind: "skipped" };
  return { kind: "informational", value: raw.value, conditions: raw.when };
}
