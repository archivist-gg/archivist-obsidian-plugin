# Magic-Item Conditional Bonuses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Whenever this plan dispatches an agent, the parent uses `model: "opus"` per project preference.

**Goal:** Capture every conditional bonus on magic items into typed `Condition` records, route every bonus read through a single `readNumericBonus` helper that returns `applied`/`skipped`/`informational`, and surface the informational pool as situational tooltip annotations in the AC tooltip, attack rows, and inventory-row expand. Recalc evaluates Tier 1 conditions today; Tiers 2-4 store their data verbatim awaiting future evaluators.

**Architecture:** New `src/modules/item/item.conditions.{types,}.ts` and `item.bonuses.ts` define the types, evaluator, accessor, and text renderer. The three open-coded bonus iteration sites in `pc.equipment.ts` (Pass A, AC, weapon) are refactored to call `readNumericBonus`, preserving existing flat-number behavior under existing tests. New `informational[]` fields on `AppliedBonuses` / `AttackRow` / AC breakdown carry the situational data through to UI surfaces. The augmenter at `scripts/augment-srd-magicitems.ts` is extended with a curated condition map and a minimal regex sweep that emit typed `Condition` arrays into `src/srd/data/magicitems.json`.

**Tech Stack:** TypeScript strict mode, Zod (schema), Vitest (tests, run with `npm test`), tsx (script execution).

**Reference spec:** `docs/superpowers/specs/2026-04-26-magic-item-conditional-bonuses-design.md`

---

## File structure

**New files**

| Path | Responsibility |
|---|---|
| `src/modules/item/item.conditions.types.ts` | `Condition` discriminated union, `ConditionalBonus`, `BonusFieldPath`, `InformationalBonus`, `ConditionContext`, `ConditionOutcome`, `BonusReadResult` |
| `src/modules/item/item.conditions.ts` | `evaluateCondition`, `evaluateConditions`, `conditionToText`, `conditionsToText` |
| `src/modules/item/item.bonuses.ts` | `readNumericBonus` |
| `scripts/augment/condition-map.ts` | `CURATED_CONDITIONS_MAP` curated table |
| `scripts/augment/condition-extractor.ts` | regex sweep + raw fallback |
| `scripts/inspect-augmented-bonuses.ts` | one-shot inspection helper for verification step |
| `tests/__fixtures__/items-conditional.ts` | Hand-crafted `ItemEntity` fixtures shared across recalc/augmenter/UI tests |
| `tests/item-conditions-schema.test.ts` | Layer 1 - Zod parse |
| `tests/item-conditions-evaluate.test.ts` | Layer 2 - evaluator |
| `tests/item-bonuses-read.test.ts` | Layer 3 - accessor |
| `tests/item-conditions-text.test.ts` | Layer 6 - text rendering |
| `tests/pc-recalc-conditional-bonuses.test.ts` | Layer 4 - recalc integration |
| `tests/pc-ac-tooltip-situational.test.ts` | Layer 7 - AC tooltip render |

**Modified files**

| Path | Change |
|---|---|
| `src/modules/item/item.schema.ts` | Add `conditionSchema`, `numberOrConditional`; update `bonusesSchema` |
| `src/modules/item/item.types.ts` | Update `ItemEntity.bonuses` to allow `number \| ConditionalBonus` per field |
| `src/modules/pc/pc.types.ts` | Extend `AppliedBonuses` and `AttackRow` with `informational` fields; add `acInformational` to `DerivedEquipment` |
| `src/modules/pc/pc.equipment.ts` | Refactor three iteration sites through `readNumericBonus`; populate informational pool |
| `src/modules/pc/pc.recalc.ts` | Thread informational data to `DerivedStats`/`DerivedEquipment` |
| `src/modules/pc/components/ac-tooltip.ts` | Render situational section |
| `src/modules/pc/components/attack-rows.ts` | Render per-row situational subline |
| `src/modules/pc/components/inventory/inventory-row-expand.ts` | Render situational bonuses caption |
| `styles.css` | `.pc-ac-tooltip-row--situational`, `.pc-attack-row-situational`, `.pc-inv-expand-situational` |
| `scripts/augment-srd-magicitems.ts` | Wire condition extraction into `mapReferenceFields` |
| `tests/srd-augment-magicitems.test.ts` | Layer 5 - augmenter |
| `tests/pc-attack-rows.test.ts` | Layer 7 - extension |
| `tests/pc-inventory-row-expand.test.ts` | Layer 7 - extension |

---

## Phase 1 - Types and schema

### Task 1: Define condition types and shared interfaces

**Files:**
- Create: `src/modules/item/item.conditions.types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/modules/item/item.conditions.types.ts
//
// Type-only module: condition discriminated union and the supporting shapes
// used by the evaluator, accessor, and renderer. No runtime exports here.

import type { Ability } from "../../shared/types";
import type { EquippedSlots, ClassEntry } from "../pc/pc.types";

// --------------------------------------------------------------------------
// Condition - discriminated union, recursive via any_of.
// --------------------------------------------------------------------------

export type Tier1Condition =
  | { kind: "no_armor" }
  | { kind: "no_shield" }
  | { kind: "wielding_two_handed" }
  | { kind: "is_class"; value: string }
  | { kind: "is_race"; value: string }
  | { kind: "is_subclass"; value: string };

export type Tier2Condition =
  | { kind: "vs_creature_type"; value: string }
  | { kind: "vs_attack_type"; value: "ranged" | "melee" }
  | { kind: "on_attack_type"; value: "ranged" | "melee" }
  | { kind: "with_weapon_property"; value: string }
  | { kind: "vs_spell_save" };

export type Tier3Condition =
  | { kind: "lighting"; value: "dim" | "bright" | "daylight" | "darkness" }
  | { kind: "underwater" }
  | { kind: "movement_state"; value: "flying" | "swimming" | "climbing" | "mounted" };

export type Tier4Condition =
  | { kind: "has_condition"; value: string }
  | { kind: "is_concentrating" }
  | { kind: "bloodied" };

export type FreeTextCondition = { kind: "raw"; text: string };

export type AnyOfCondition = { kind: "any_of"; conditions: Condition[] };

export type Condition =
  | Tier1Condition
  | Tier2Condition
  | Tier3Condition
  | Tier4Condition
  | FreeTextCondition
  | AnyOfCondition;

// --------------------------------------------------------------------------
// ConditionalBonus - wraps a numeric bonus value with an AND-list of conds.
// --------------------------------------------------------------------------

export interface ConditionalBonus {
  value: number;
  when: Condition[];
}

// --------------------------------------------------------------------------
// Field paths that may carry a ConditionalBonus.
// --------------------------------------------------------------------------

export type BonusFieldPath =
  | "ac"
  | "saving_throws"
  | "spell_attack"
  | "spell_save_dc"
  | "weapon_attack"
  | "weapon_damage"
  | `ability_scores.bonus.${Ability}`
  | "speed.walk"
  | "speed.fly"
  | "speed.swim"
  | "speed.climb";

// --------------------------------------------------------------------------
// Informational record carried through derived state to UI tooltips.
// --------------------------------------------------------------------------

export interface InformationalBonus {
  field: BonusFieldPath;
  source: string;
  value: number;
  conditions: Condition[];
}

// --------------------------------------------------------------------------
// Evaluator interface.
// --------------------------------------------------------------------------

export type ConditionOutcome = "true" | "false" | "informational";

export interface ConditionContext {
  derived: { equippedSlots: EquippedSlots };
  classList: ClassEntry[];
  race: string | null;
  subclasses: string[];
}

// --------------------------------------------------------------------------
// readNumericBonus return shape.
// --------------------------------------------------------------------------

export type BonusReadResult =
  | { kind: "applied"; value: number }
  | { kind: "skipped" }
  | { kind: "informational"; value: number; conditions: Condition[] };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors. If any errors, they must be in this new file or its imports - fix before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/modules/item/item.conditions.types.ts
git commit -m "feat(item): add Condition discriminated union and supporting types"
```

---

### Task 2: Extend Zod schema for conditional bonuses

**Files:**
- Modify: `src/modules/item/item.schema.ts:5-22`
- Modify: `src/modules/item/item.types.ts:29-46`

- [ ] **Step 1: Add conditionSchema and numberOrConditional helpers to item.schema.ts**

Insert at the top of `src/modules/item/item.schema.ts` (after `import { z } from "zod";` on line 1 and before the existing `abilityEnum`):

```ts
// --------------------------------------------------------------------------
// Condition schemas - discriminated union with recursive any_of.
// --------------------------------------------------------------------------

import type { Condition } from "./item.conditions.types";

const tier1Conditions = [
  z.object({ kind: z.literal("no_armor") }),
  z.object({ kind: z.literal("no_shield") }),
  z.object({ kind: z.literal("wielding_two_handed") }),
  z.object({ kind: z.literal("is_class"), value: z.string() }),
  z.object({ kind: z.literal("is_race"), value: z.string() }),
  z.object({ kind: z.literal("is_subclass"), value: z.string() }),
] as const;

const tier2Conditions = [
  z.object({ kind: z.literal("vs_creature_type"), value: z.string() }),
  z.object({ kind: z.literal("vs_attack_type"), value: z.enum(["ranged", "melee"]) }),
  z.object({ kind: z.literal("on_attack_type"), value: z.enum(["ranged", "melee"]) }),
  z.object({ kind: z.literal("with_weapon_property"), value: z.string() }),
  z.object({ kind: z.literal("vs_spell_save") }),
] as const;

const tier3Conditions = [
  z.object({ kind: z.literal("lighting"), value: z.enum(["dim", "bright", "daylight", "darkness"]) }),
  z.object({ kind: z.literal("underwater") }),
  z.object({ kind: z.literal("movement_state"), value: z.enum(["flying", "swimming", "climbing", "mounted"]) }),
] as const;

const tier4Conditions = [
  z.object({ kind: z.literal("has_condition"), value: z.string() }),
  z.object({ kind: z.literal("is_concentrating") }),
  z.object({ kind: z.literal("bloodied") }),
] as const;

const rawCondition = z.object({ kind: z.literal("raw"), text: z.string() });

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    ...tier1Conditions,
    ...tier2Conditions,
    ...tier3Conditions,
    ...tier4Conditions,
    rawCondition,
    z.object({ kind: z.literal("any_of"), conditions: z.array(conditionSchema) }),
  ]),
);

const conditionalBonusSchema = z.object({
  value: z.number().int(),
  when: z.array(conditionSchema),
});

const numberOrConditional = z.union([z.number().int(), conditionalBonusSchema]);
```

- [ ] **Step 2: Replace bonusesSchema with conditional-aware version**

Replace lines 5-22 of `src/modules/item/item.schema.ts`:

```ts
const bonusesSchema = z.object({
  ac: numberOrConditional.optional(),
  weapon_attack: numberOrConditional.optional(),
  weapon_damage: numberOrConditional.optional(),
  spell_attack: numberOrConditional.optional(),
  spell_save_dc: numberOrConditional.optional(),
  saving_throws: numberOrConditional.optional(),
  ability_scores: z.object({
    static: z.record(abilityEnum, z.number().int()).optional(),
    bonus: z.record(abilityEnum, numberOrConditional).optional(),
  }).optional(),
  speed: z.object({
    walk: numberOrConditional.optional(),
    fly: z.union([numberOrConditional, z.literal("walk")]).optional(),
    swim: numberOrConditional.optional(),
    climb: numberOrConditional.optional(),
  }).optional(),
});
```

- [ ] **Step 3: Update ItemEntity TypeScript type**

Replace lines 29-46 of `src/modules/item/item.types.ts`:

```ts
import type { ConditionalBonus } from "./item.conditions.types";

  bonuses?: {
    ac?: number | ConditionalBonus;
    weapon_attack?: number | ConditionalBonus;
    weapon_damage?: number | ConditionalBonus;
    spell_attack?: number | ConditionalBonus;
    spell_save_dc?: number | ConditionalBonus;
    saving_throws?: number | ConditionalBonus;
    ability_scores?: {
      static?: Partial<Record<Ability, number>>;
      bonus?: Partial<Record<Ability, number | ConditionalBonus>>;
    };
    speed?: {
      walk?: number | ConditionalBonus;
      fly?: number | ConditionalBonus | "walk";
      swim?: number | ConditionalBonus;
      climb?: number | ConditionalBonus;
    };
  };
```

(The `ConditionalBonus` import goes at the top with other imports.)

- [ ] **Step 4: Run typecheck and existing tests**

Run: `npx tsc --noEmit && npm test`
Expected: 0 type errors; all existing tests pass. The schema is a strict superset, so no behavior change yet.

If a type error mentions a consumer of `item.bonuses.ac` that does `if (typeof b.ac === "number")` style narrowing, leave it alone - that's the existing iteration site and Tasks 9-10 will refactor it. The narrowing still typechecks; the consumer just won't see the new shape until the refactor.

- [ ] **Step 5: Commit**

```bash
git add src/modules/item/item.schema.ts src/modules/item/item.types.ts
git commit -m "feat(item): extend bonuses schema to accept ConditionalBonus"
```

---

### Task 3: Schema validation tests

**Files:**
- Create: `tests/item-conditions-schema.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// tests/item-conditions-schema.test.ts
import { describe, it, expect } from "vitest";
import { itemEntitySchema } from "../src/modules/item/item.schema";

const baseItem = { name: "Test Item", rarity: "uncommon" };

describe("conditionSchema (via itemEntitySchema.bonuses)", () => {
  it("accepts flat number for backwards compat", () => {
    const r = itemEntitySchema.safeParse({ ...baseItem, bonuses: { ac: 2 } });
    expect(r.success).toBe(true);
  });

  it("accepts ConditionalBonus shape", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { ac: { value: 2, when: [{ kind: "no_armor" }, { kind: "no_shield" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a Tier 1 condition (is_class)", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { weapon_damage: { value: 1, when: [{ kind: "is_class", value: "bard" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a Tier 2 condition (vs_creature_type)", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { weapon_damage: { value: 2, when: [{ kind: "vs_creature_type", value: "undead" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a Tier 3 condition (underwater)", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { speed: { swim: { value: 30, when: [{ kind: "underwater" }] } } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a Tier 4 condition (bloodied)", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { weapon_damage: { value: 2, when: [{ kind: "bloodied" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a raw condition", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { ac: { value: 2, when: [{ kind: "raw", text: "while bloodied at half HP" }] } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts recursive any_of", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: {
        weapon_damage: {
          value: 2,
          when: [
            {
              kind: "any_of",
              conditions: [
                { kind: "with_weapon_property", value: "longbow" },
                { kind: "with_weapon_property", value: "shortbow" },
              ],
            },
          ],
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it("accepts mixed flat and conditional fields on the same item", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: {
        ac: 1,
        weapon_damage: { value: 2, when: [{ kind: "vs_creature_type", value: "undead" }] },
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown condition kind", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { ac: { value: 2, when: [{ kind: "not_a_real_kind" }] } },
    });
    expect(r.success).toBe(false);
  });

  it("rejects ConditionalBonus missing value", () => {
    const r = itemEntitySchema.safeParse({
      ...baseItem,
      bonuses: { ac: { when: [{ kind: "no_armor" }] } },
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- tests/item-conditions-schema.test.ts`
Expected: all 11 tests PASS (the schema work in Task 2 makes them green - these tests validate the schema is correctly authored, not driving new code).

If any fail, the schema in Task 2 has a mistake; fix it inline rather than writing more code.

- [ ] **Step 3: Commit**

```bash
git add tests/item-conditions-schema.test.ts
git commit -m "test(item): cover ConditionalBonus and Condition union schema parsing"
```

---

## Phase 2 - Pure-function evaluator and accessor

### Task 4: `evaluateCondition` - Tier 1 evaluator + Tier 2-4 informational

**Files:**
- Create: `src/modules/item/item.conditions.ts`
- Create: `tests/item-conditions-evaluate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/item-conditions-evaluate.test.ts
import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../src/modules/item/item.conditions";
import type { ConditionContext } from "../src/modules/item/item.conditions.types";

function ctx(over: Partial<ConditionContext> = {}): ConditionContext {
  return {
    derived: { equippedSlots: {} },
    classList: [],
    race: null,
    subclasses: [],
    ...over,
  };
}

describe("evaluateCondition - Tier 1", () => {
  it("no_armor -> true when armor slot empty", () => {
    expect(evaluateCondition({ kind: "no_armor" }, ctx())).toBe("true");
  });

  it("no_armor -> false when armor slot filled", () => {
    const c = ctx({
      derived: { equippedSlots: { armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } } } },
    });
    expect(evaluateCondition({ kind: "no_armor" }, c)).toBe("false");
  });

  it("no_shield -> true when shield slot empty", () => {
    expect(evaluateCondition({ kind: "no_shield" }, ctx())).toBe("true");
  });

  it("no_shield -> false when shield slot filled", () => {
    const c = ctx({
      derived: { equippedSlots: { shield: { index: 0, entity: null, entityType: "armor", entry: { item: "s" } } } },
    });
    expect(evaluateCondition({ kind: "no_shield" }, c)).toBe("false");
  });

  it("wielding_two_handed -> false when no two-handed mainhand", () => {
    expect(evaluateCondition({ kind: "wielding_two_handed" }, ctx())).toBe("false");
  });

  it("is_class -> true on exact slug match", () => {
    const c = ctx({ classList: [{ class: "[[bard]]", level: 5, subclass: null, choices: {} }] });
    expect(evaluateCondition({ kind: "is_class", value: "bard" }, c)).toBe("true");
  });

  it("is_class -> true on multiclass inclusion", () => {
    const c = ctx({
      classList: [
        { class: "[[fighter]]", level: 3, subclass: null, choices: {} },
        { class: "[[bard]]", level: 2, subclass: null, choices: {} },
      ],
    });
    expect(evaluateCondition({ kind: "is_class", value: "bard" }, c)).toBe("true");
  });

  it("is_class -> false on no match", () => {
    const c = ctx({ classList: [{ class: "[[fighter]]", level: 5, subclass: null, choices: {} }] });
    expect(evaluateCondition({ kind: "is_class", value: "bard" }, c)).toBe("false");
  });

  it("is_race -> true on slug match", () => {
    const c = ctx({ race: "[[dwarf]]" });
    expect(evaluateCondition({ kind: "is_race", value: "dwarf" }, c)).toBe("true");
  });

  it("is_race -> false when race null", () => {
    expect(evaluateCondition({ kind: "is_race", value: "dwarf" }, ctx())).toBe("false");
  });

  it("is_subclass -> true on slug membership", () => {
    const c = ctx({ subclasses: ["soulknife", "evocation"] });
    expect(evaluateCondition({ kind: "is_subclass", value: "soulknife" }, c)).toBe("true");
  });

  it("is_subclass -> false when not present", () => {
    expect(evaluateCondition({ kind: "is_subclass", value: "soulknife" }, ctx())).toBe("false");
  });
});

describe("evaluateCondition - Tier 2-4 always informational in v1", () => {
  it.each([
    [{ kind: "vs_creature_type", value: "undead" }],
    [{ kind: "vs_attack_type", value: "ranged" }],
    [{ kind: "on_attack_type", value: "ranged" }],
    [{ kind: "with_weapon_property", value: "longbow" }],
    [{ kind: "vs_spell_save" }],
    [{ kind: "lighting", value: "dim" }],
    [{ kind: "underwater" }],
    [{ kind: "movement_state", value: "flying" }],
    [{ kind: "has_condition", value: "grappled" }],
    [{ kind: "is_concentrating" }],
    [{ kind: "bloodied" }],
  ] as const)("%j -> informational", (cond) => {
    expect(evaluateCondition(cond, ctx())).toBe("informational");
  });
});

describe("evaluateCondition - raw and any_of", () => {
  it("raw -> always informational", () => {
    expect(evaluateCondition({ kind: "raw", text: "anything" }, ctx())).toBe("informational");
  });

  it("any_of -> true when any branch true", () => {
    const c = ctx({ classList: [{ class: "[[bard]]", level: 1, subclass: null, choices: {} }] });
    const cond = {
      kind: "any_of" as const,
      conditions: [
        { kind: "is_class" as const, value: "fighter" },
        { kind: "is_class" as const, value: "bard" },
      ],
    };
    expect(evaluateCondition(cond, c)).toBe("true");
  });

  it("any_of -> false when all branches false", () => {
    const c = ctx({ classList: [{ class: "[[wizard]]", level: 1, subclass: null, choices: {} }] });
    const cond = {
      kind: "any_of" as const,
      conditions: [
        { kind: "is_class" as const, value: "fighter" },
        { kind: "is_class" as const, value: "bard" },
      ],
    };
    expect(evaluateCondition(cond, c)).toBe("false");
  });

  it("any_of -> informational when any branch informational and none true", () => {
    const cond = {
      kind: "any_of" as const,
      conditions: [
        { kind: "is_class" as const, value: "bard" }, // false
        { kind: "underwater" as const },                // informational
      ],
    };
    expect(evaluateCondition(cond, ctx())).toBe("informational");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/item-conditions-evaluate.test.ts`
Expected: FAIL - module `src/modules/item/item.conditions` does not exist.

- [ ] **Step 3: Implement `evaluateCondition`**

Create `src/modules/item/item.conditions.ts`:

```ts
// src/modules/item/item.conditions.ts
//
// Single switch over Condition.kind. Tier 1 evaluates against character
// state; Tiers 2-4 + raw always return "informational" until their
// respective evaluators land. any_of recurses.

import type {
  Condition,
  ConditionContext,
  ConditionOutcome,
} from "./item.conditions.types";

function unwrapSlug(maybeWiki: string | null | undefined): string {
  if (!maybeWiki) return "";
  const m = /^\[\[([^\]]+)\]\]$/.exec(maybeWiki);
  return (m ? m[1] : maybeWiki).toLowerCase();
}

export function evaluateCondition(
  cond: Condition,
  ctx: ConditionContext,
): ConditionOutcome {
  switch (cond.kind) {
    case "no_armor":
      return ctx.derived.equippedSlots.armor === undefined ? "true" : "false";
    case "no_shield":
      return ctx.derived.equippedSlots.shield === undefined ? "true" : "false";
    case "wielding_two_handed": {
      const main = ctx.derived.equippedSlots.mainhand?.entity;
      if (!main || typeof main !== "object" || !("properties" in main)) return "false";
      const props = (main as { properties?: unknown }).properties;
      if (!Array.isArray(props)) return "false";
      return props.some((p) => p === "two_handed") ? "true" : "false";
    }
    case "is_class": {
      const target = cond.value.toLowerCase();
      return ctx.classList.some((c) => unwrapSlug(c.class) === target) ? "true" : "false";
    }
    case "is_race":
      return unwrapSlug(ctx.race) === cond.value.toLowerCase() ? "true" : "false";
    case "is_subclass":
      return ctx.subclasses.some((s) => s.toLowerCase() === cond.value.toLowerCase())
        ? "true"
        : "false";

    // Tier 2-4 - always informational in v1.
    case "vs_creature_type":
    case "vs_attack_type":
    case "on_attack_type":
    case "with_weapon_property":
    case "vs_spell_save":
    case "lighting":
    case "underwater":
    case "movement_state":
    case "has_condition":
    case "is_concentrating":
    case "bloodied":
      return "informational";

    case "raw":
      return "informational";

    case "any_of": {
      let sawInformational = false;
      for (const branch of cond.conditions) {
        const o = evaluateCondition(branch, ctx);
        if (o === "true") return "true";
        if (o === "informational") sawInformational = true;
      }
      return sawInformational ? "informational" : "false";
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/item-conditions-evaluate.test.ts`
Expected: all 26 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/item/item.conditions.ts tests/item-conditions-evaluate.test.ts
git commit -m "feat(item): evaluateCondition for Tier 1, informational fallthrough for 2-4"
```

---

### Task 5: `evaluateConditions` - AND-combine

**Files:**
- Modify: `src/modules/item/item.conditions.ts`
- Modify: `tests/item-conditions-evaluate.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/item-conditions-evaluate.test.ts`:

```ts
import { evaluateConditions } from "../src/modules/item/item.conditions";

describe("evaluateConditions - AND-combine", () => {
  it("empty array -> true (always-applies)", () => {
    expect(evaluateConditions([], ctx())).toBe("true");
  });

  it("all true -> true", () => {
    const r = evaluateConditions([{ kind: "no_armor" }, { kind: "no_shield" }], ctx());
    expect(r).toBe("true");
  });

  it("any false -> false (false beats informational)", () => {
    const c = ctx({
      derived: {
        equippedSlots: {
          armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } },
        },
      },
    });
    const r = evaluateConditions(
      [{ kind: "no_armor" }, { kind: "underwater" }],
      c,
    );
    expect(r).toBe("false");
  });

  it("any informational with no false -> informational", () => {
    const r = evaluateConditions(
      [{ kind: "no_armor" }, { kind: "underwater" }],
      ctx(),
    );
    expect(r).toBe("informational");
  });

  it("all informational -> informational", () => {
    const r = evaluateConditions(
      [{ kind: "underwater" }, { kind: "vs_attack_type", value: "ranged" }],
      ctx(),
    );
    expect(r).toBe("informational");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/item-conditions-evaluate.test.ts`
Expected: 5 new tests FAIL - `evaluateConditions` not exported.

- [ ] **Step 3: Implement `evaluateConditions`**

Append to `src/modules/item/item.conditions.ts`:

```ts
/**
 * AND-combine a list of conditions.
 * - Empty list -> "true" (always-applies; matches flat-number semantics).
 * - Any "false" -> "false" (engine certainty short-circuits informational).
 * - Else any "informational" -> "informational".
 * - Else "true".
 */
export function evaluateConditions(
  conds: Condition[],
  ctx: ConditionContext,
): ConditionOutcome {
  let sawInformational = false;
  for (const c of conds) {
    const o = evaluateCondition(c, ctx);
    if (o === "false") return "false";
    if (o === "informational") sawInformational = true;
  }
  return sawInformational ? "informational" : "true";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/item-conditions-evaluate.test.ts`
Expected: all 31 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/item/item.conditions.ts tests/item-conditions-evaluate.test.ts
git commit -m "feat(item): evaluateConditions AND-combine with priority false-info-true"
```

---

### Task 6: `readNumericBonus` accessor

**Files:**
- Create: `src/modules/item/item.bonuses.ts`
- Create: `tests/item-bonuses-read.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/item-bonuses-read.test.ts
import { describe, it, expect } from "vitest";
import { readNumericBonus } from "../src/modules/item/item.bonuses";
import type { ConditionContext } from "../src/modules/item/item.conditions.types";

const baseCtx: ConditionContext = {
  derived: { equippedSlots: {} },
  classList: [],
  race: null,
  subclasses: [],
};

describe("readNumericBonus", () => {
  it("returns null for undefined", () => {
    expect(readNumericBonus(undefined, baseCtx)).toBeNull();
  });

  it("returns null for zero (flat)", () => {
    expect(readNumericBonus(0, baseCtx)).toBeNull();
  });

  it("returns null for zero value in conditional bonus", () => {
    expect(readNumericBonus({ value: 0, when: [] }, baseCtx)).toBeNull();
  });

  it("returns applied for flat number", () => {
    expect(readNumericBonus(2, baseCtx)).toEqual({ kind: "applied", value: 2 });
  });

  it("returns applied for ConditionalBonus when all true", () => {
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "no_armor" }, { kind: "no_shield" }] },
      baseCtx,
    );
    expect(r).toEqual({ kind: "applied", value: 2 });
  });

  it("returns applied for ConditionalBonus with empty when[]", () => {
    expect(readNumericBonus({ value: 3, when: [] }, baseCtx)).toEqual({
      kind: "applied",
      value: 3,
    });
  });

  it("returns skipped when any condition false", () => {
    const ctx: ConditionContext = {
      ...baseCtx,
      derived: {
        equippedSlots: {
          armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } },
        },
      },
    };
    const r = readNumericBonus({ value: 2, when: [{ kind: "no_armor" }] }, ctx);
    expect(r).toEqual({ kind: "skipped" });
  });

  it("returns informational when any condition informational and none false", () => {
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "vs_attack_type", value: "ranged" }] },
      baseCtx,
    );
    expect(r).toEqual({
      kind: "informational",
      value: 2,
      conditions: [{ kind: "vs_attack_type", value: "ranged" }],
    });
  });

  it("false beats informational (engine certainty)", () => {
    const ctx: ConditionContext = {
      ...baseCtx,
      derived: {
        equippedSlots: {
          armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } },
        },
      },
    };
    const r = readNumericBonus(
      { value: 2, when: [{ kind: "no_armor" }, { kind: "underwater" }] },
      ctx,
    );
    expect(r).toEqual({ kind: "skipped" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/item-bonuses-read.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `readNumericBonus`**

Create `src/modules/item/item.bonuses.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/item-bonuses-read.test.ts`
Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/item/item.bonuses.ts tests/item-bonuses-read.test.ts
git commit -m "feat(item): readNumericBonus three-outcome accessor"
```

---

### Task 7: `conditionToText` and `conditionsToText`

**Files:**
- Modify: `src/modules/item/item.conditions.ts`
- Create: `tests/item-conditions-text.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/item-conditions-text.test.ts
import { describe, it, expect } from "vitest";
import {
  conditionToText,
  conditionsToText,
} from "../src/modules/item/item.conditions";

describe("conditionToText", () => {
  it.each([
    [{ kind: "no_armor" }, "no armor"],
    [{ kind: "no_shield" }, "no shield"],
    [{ kind: "wielding_two_handed" }, "wielding two-handed"],
    [{ kind: "is_class", value: "bard" }, "if Bard"],
    [{ kind: "is_race", value: "dwarf" }, "if Dwarf"],
    [{ kind: "is_subclass", value: "soulknife" }, "if Soulknife"],
    [{ kind: "vs_creature_type", value: "undead" }, "vs undead"],
    [{ kind: "vs_attack_type", value: "ranged" }, "vs ranged attacks"],
    [{ kind: "on_attack_type", value: "ranged" }, "on ranged attacks"],
    [{ kind: "with_weapon_property", value: "longbow" }, "with longbow"],
    [{ kind: "vs_spell_save" }, "vs spells"],
    [{ kind: "lighting", value: "dim" }, "in dim light"],
    [{ kind: "underwater" }, "underwater"],
    [{ kind: "movement_state", value: "flying" }, "while flying"],
    [{ kind: "has_condition", value: "grappled" }, "while grappled"],
    [{ kind: "is_concentrating" }, "while concentrating"],
    [{ kind: "bloodied" }, "while bloodied"],
    [{ kind: "raw", text: "while bloodied at half HP" }, "while bloodied at half HP"],
  ] as const)("%j -> %s", (cond, expected) => {
    expect(conditionToText(cond)).toBe(expected);
  });

  it("any_of -> parens with ' or '", () => {
    expect(
      conditionToText({
        kind: "any_of",
        conditions: [
          { kind: "with_weapon_property", value: "longbow" },
          { kind: "with_weapon_property", value: "shortbow" },
        ],
      }),
    ).toBe("(with longbow or with shortbow)");
  });

  it("nested any_of inside any_of renders nested parens", () => {
    expect(
      conditionToText({
        kind: "any_of",
        conditions: [
          { kind: "no_armor" },
          { kind: "any_of", conditions: [{ kind: "underwater" }, { kind: "bloodied" }] },
        ],
      }),
    ).toBe("(no armor or (underwater or while bloodied))");
  });
});

describe("conditionsToText", () => {
  it("empty list -> empty string", () => {
    expect(conditionsToText([])).toBe("");
  });

  it("single condition -> no joiner", () => {
    expect(conditionsToText([{ kind: "no_armor" }])).toBe("no armor");
  });

  it("AND-joins with ' and '", () => {
    expect(
      conditionsToText([{ kind: "no_armor" }, { kind: "no_shield" }]),
    ).toBe("no armor and no shield");
  });

  it("renders any_of inside AND-list", () => {
    expect(
      conditionsToText([
        { kind: "on_attack_type", value: "ranged" },
        {
          kind: "any_of",
          conditions: [
            { kind: "with_weapon_property", value: "longbow" },
            { kind: "with_weapon_property", value: "shortbow" },
          ],
        },
      ]),
    ).toBe("on ranged attacks and (with longbow or with shortbow)");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/item-conditions-text.test.ts`
Expected: FAIL - `conditionToText` and `conditionsToText` not exported.

- [ ] **Step 3: Implement the renderers**

Append to `src/modules/item/item.conditions.ts`:

```ts
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

export function conditionToText(cond: Condition): string {
  switch (cond.kind) {
    case "no_armor":            return "no armor";
    case "no_shield":           return "no shield";
    case "wielding_two_handed": return "wielding two-handed";
    case "is_class":            return `if ${capitalize(cond.value)}`;
    case "is_race":             return `if ${capitalize(cond.value)}`;
    case "is_subclass":         return `if ${capitalize(cond.value)}`;
    case "vs_creature_type":    return `vs ${cond.value}`;
    case "vs_attack_type":      return `vs ${cond.value} attacks`;
    case "on_attack_type":      return `on ${cond.value} attacks`;
    case "with_weapon_property":return `with ${cond.value}`;
    case "vs_spell_save":       return "vs spells";
    case "lighting":            return `in ${cond.value} light`;
    case "underwater":          return "underwater";
    case "movement_state":      return `while ${cond.value}`;
    case "has_condition":       return `while ${cond.value}`;
    case "is_concentrating":    return "while concentrating";
    case "bloodied":            return "while bloodied";
    case "raw":                 return cond.text;
    case "any_of":
      return "(" + cond.conditions.map(conditionToText).join(" or ") + ")";
  }
}

export function conditionsToText(conds: Condition[]): string {
  return conds.map(conditionToText).join(" and ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/item-conditions-text.test.ts`
Expected: all 23 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/item/item.conditions.ts tests/item-conditions-text.test.ts
git commit -m "feat(item): conditionToText and conditionsToText for tooltip rendering"
```

---

## Phase 3 - Recalc data plumbing (no behavior change)

### Task 8: Add informational fields to AppliedBonuses, AttackRow, DerivedEquipment

**Files:**
- Modify: `src/modules/pc/pc.types.ts:166-211`
- Modify: `src/modules/pc/pc.equipment.ts:32-46` (`emptyAppliedBonuses`)

- [ ] **Step 1: Extend types in pc.types.ts**

Replace `AttackRow` interface (lines 166-177) with:

```ts
export interface AttackRow {
  id: string;
  name: string;
  range?: string;
  toHit: number;
  damageDice: string;
  damageType: string;
  extraDamage?: string;
  properties: string[];
  proficient: boolean;
  breakdown: { toHit: ACTerm[]; damage: ACTerm[] };
  informational?: import("../item/item.conditions.types").InformationalBonus[];
}
```

Replace `AppliedBonuses` interface (lines 193-201) with:

```ts
export interface AppliedBonuses {
  ability_bonuses: Partial<Record<Ability, number>>;
  ability_statics: Partial<Record<Ability, number>>;
  save_bonus: number;
  speed_bonuses: { walk: number; fly: number | "walk" | null; swim: number; climb: number };
  spell_attack: number;
  spell_save_dc: number;
  defenses: { resistances: string[]; immunities: string[]; vulnerabilities: string[]; condition_immunities: string[] };
  informational: import("../item/item.conditions.types").InformationalBonus[];
}
```

Replace `DerivedEquipment` interface (lines 203-211) with:

```ts
export interface DerivedEquipment {
  ac: number;
  acBreakdown: ACTerm[];
  acInformational: import("../item/item.conditions.types").InformationalBonus[];
  attacks: AttackRow[];
  equippedSlots: EquippedSlots;
  carriedWeight: number;
  attunementUsed: number;
  attunementLimit: number;
}
```

- [ ] **Step 2: Initialize the new field in `emptyAppliedBonuses`**

Find `emptyAppliedBonuses` in `src/modules/pc/pc.equipment.ts` (around line 32). Replace its body to include `informational: []`:

```ts
export function emptyAppliedBonuses(): AppliedBonuses {
  return {
    ability_bonuses: {},
    ability_statics: {},
    save_bonus: 0,
    speed_bonuses: { walk: 0, fly: null, swim: 0, climb: 0 },
    spell_attack: 0,
    spell_save_dc: 0,
    defenses: { resistances: [], immunities: [], vulnerabilities: [], condition_immunities: [] },
    informational: [],
  };
}
```

- [ ] **Step 3: Initialize acInformational in `computeSlotsAndAttacks`**

Find the return statement of `computeSlotsAndAttacks` in `src/modules/pc/pc.equipment.ts` (around line 553) and add `acInformational: []` to the returned object:

```ts
return {
  ac,
  acBreakdown: breakdown,
  acInformational: [],
  attacks,
  equippedSlots: slots,
  carriedWeight,
  attunementUsed,
  attunementLimit,
};
```

(Tasks 9-10 will populate this; for now it stays empty.)

- [ ] **Step 4: Verify typecheck and existing tests pass**

Run: `npx tsc --noEmit && npm test`
Expected: 0 type errors; all existing tests pass. The new field is initialized empty everywhere; no behavior changes.

- [ ] **Step 5: Commit**

```bash
git add src/modules/pc/pc.types.ts src/modules/pc/pc.equipment.ts
git commit -m "feat(pc): add informational pool to AppliedBonuses, AttackRow, DerivedEquipment"
```

---

### Task 9: Refactor Pass A through `readNumericBonus`

**Files:**
- Modify: `src/modules/pc/pc.equipment.ts:82-153`

The existing tests in `tests/pc-recalc.test.ts` and others must continue to pass with **byte-identical** output for unconditional items. The refactor only changes the internal mechanics, not the result shape.

- [ ] **Step 1: Add imports at the top of pc.equipment.ts**

Add to the import block at the top of `src/modules/pc/pc.equipment.ts`:

```ts
import { readNumericBonus } from "../item/item.bonuses";
import type {
  ConditionContext,
  BonusFieldPath,
  InformationalBonus,
} from "../item/item.conditions.types";
```

- [ ] **Step 2: Add `buildConditionContext` helper**

Insert above `computeAppliedBonuses` in `src/modules/pc/pc.equipment.ts`:

```ts
function unwrapClassSlug(maybeWiki: string | null | undefined): string {
  if (!maybeWiki) return "";
  const m = /^\[\[([^\]]+)\]\]$/.exec(maybeWiki);
  return (m ? m[1] : maybeWiki).toLowerCase();
}

function buildConditionContext(
  resolved: ResolvedCharacter,
  equippedSlots: EquippedSlots,
): ConditionContext {
  return {
    derived: { equippedSlots },
    classList: resolved.definition.class ?? [],
    race: resolved.definition.race,
    subclasses: (resolved.definition.class ?? [])
      .map((c) => c.subclass)
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .map(unwrapClassSlug),
  };
}

function pushApply(
  outcome: ReturnType<typeof readNumericBonus>,
  field: BonusFieldPath,
  source: string,
  pool: InformationalBonus[],
  onApply: (value: number) => void,
): void {
  if (!outcome) return;
  if (outcome.kind === "applied") onApply(outcome.value);
  else if (outcome.kind === "informational") {
    pool.push({ field, source, value: outcome.value, conditions: outcome.conditions });
  }
  // skipped -> drop silently
}
```

- [ ] **Step 3: Refactor `computeAppliedBonuses` body**

Replace the loop body inside `computeAppliedBonuses` (lines 91-151) with the version that routes through `readNumericBonus`. The full function becomes:

```ts
export function computeAppliedBonuses(
  resolved: ResolvedCharacter,
  _profs: ProficienciesForQuery,
  registry: EntityRegistry,
  warnings: string[],
): AppliedBonuses {
  const out = emptyAppliedBonuses();
  const equipment = resolved.definition.equipment ?? [];

  // Pass A doesn't yet know slot assignments. Use an empty-slot context for
  // condition evaluation; Pass A only consumes Tier-1 conditions like
  // is_class/is_race/is_subclass that don't depend on slots, and the
  // affected fields here (saves, spells, abilities, speeds) currently have
  // no slot-dependent SRD conditions.
  const ctx = buildConditionContext(resolved, {});

  for (const entry of equipment) {
    const { entity, entityType } = lookupEntity(entry, registry);

    if (!entity) {
      const slug = unwrapSlug(entry.item);
      if (slug && entry.equipped) warnings.push(`Equipped item [[${slug}]] not found in compendium.`);
      continue;
    }
    if (!isAttunedActive(entry, entity)) continue;
    if (entityType !== "item") continue;

    const item = entity as ItemEntity;

    item.resist?.forEach((s) => out.defenses.resistances.push(s));
    item.immune?.forEach((s) => out.defenses.immunities.push(s));
    item.vulnerable?.forEach((s) => out.defenses.vulnerabilities.push(s));
    item.condition_immune?.forEach((s) => out.defenses.condition_immunities.push(s));

    const b = item.bonuses;
    if (!b) continue;

    pushApply(readNumericBonus(b.saving_throws, ctx), "saving_throws", item.name,
      out.informational, (v) => { out.save_bonus += v; });
    pushApply(readNumericBonus(b.spell_attack, ctx), "spell_attack", item.name,
      out.informational, (v) => { out.spell_attack += v; });
    pushApply(readNumericBonus(b.spell_save_dc, ctx), "spell_save_dc", item.name,
      out.informational, (v) => { out.spell_save_dc += v; });

    if (b.ability_scores?.bonus) {
      for (const [k, v] of Object.entries(b.ability_scores.bonus)) {
        if (!isAbilityKey(k)) continue;
        pushApply(readNumericBonus(v as number | { value: number; when: [] } | undefined, ctx),
          `ability_scores.bonus.${k}` as BonusFieldPath,
          item.name, out.informational,
          (val) => { out.ability_bonuses[k] = (out.ability_bonuses[k] ?? 0) + val; });
      }
    }
    if (b.ability_scores?.static) {
      for (const [k, n] of Object.entries(b.ability_scores.static)) {
        if (!isAbilityKey(k) || typeof n !== "number") continue;
        const prev = out.ability_statics[k];
        if (prev === undefined) {
          out.ability_statics[k] = n;
        } else {
          if (n !== prev) {
            warnings.push(
              `Multiple static ${k.toUpperCase()} bonuses on equipped+attuned items; using highest (${Math.max(prev, n)}).`,
            );
          }
          out.ability_statics[k] = Math.max(prev, n);
        }
      }
    }

    if (b.speed) {
      pushApply(readNumericBonus(b.speed.walk, ctx), "speed.walk", item.name,
        out.informational, (v) => { out.speed_bonuses.walk += v; });
      if (b.speed.fly === "walk") {
        out.speed_bonuses.fly = "walk";
      } else {
        pushApply(readNumericBonus(b.speed.fly as number | { value: number; when: [] } | undefined, ctx),
          "speed.fly", item.name, out.informational,
          (v) => {
            const cur = out.speed_bonuses.fly;
            out.speed_bonuses.fly = (typeof cur === "number" ? cur : 0) + v;
          });
      }
      pushApply(readNumericBonus(b.speed.swim, ctx), "speed.swim", item.name,
        out.informational, (v) => { out.speed_bonuses.swim += v; });
      pushApply(readNumericBonus(b.speed.climb, ctx), "speed.climb", item.name,
        out.informational, (v) => { out.speed_bonuses.climb += v; });
    }
  }

  return out;
}
```

- [ ] **Step 4: Run existing recalc tests to verify no regressions**

Run: `npm test -- tests/pc-recalc.test.ts tests/pc-recalc-ac.test.ts tests/pc-recalc-proficiency.test.ts`
Expected: all PASS. If any fails on output that includes `informational: []`, that's an empty-array equality issue - investigate and confirm the test was using strict deep equality on a shape that didn't have the field before.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/pc/pc.equipment.ts
git commit -m "refactor(pc): route Pass A bonus reads through readNumericBonus"
```

---

### Task 10: Refactor Pass B (AC + weapon) through `readNumericBonus`

**Files:**
- Modify: `src/modules/pc/pc.equipment.ts:300-310, 359-385, 553`

- [ ] **Step 1: Refactor AC iteration**

Replace lines 300-310 of `src/modules/pc/pc.equipment.ts` with:

```ts
  // Equipped+attuned items.bonuses.ac (AC-bonus magic items).
  const acInformational: InformationalBonus[] = [];
  const acCtx = buildConditionContext(resolved, slots);
  for (const entry of resolved.definition.equipment ?? []) {
    const { entity, entityType } = lookupEntity(entry, registry);
    if (!entity || entityType !== "item") continue;
    if (!isAttunedActive(entry, entity)) continue;
    const item = entity as ItemEntity;
    const out = readNumericBonus(item.bonuses?.ac, acCtx);
    if (!out) continue;
    if (out.kind === "applied") {
      ac += out.value;
      breakdown.push({ source: item.name, amount: out.value, kind: "item" });
    } else if (out.kind === "informational") {
      acInformational.push({
        field: "ac",
        source: item.name,
        value: out.value,
        conditions: out.conditions,
      });
    }
  }
```

- [ ] **Step 2: Update the AC-computing helper return shape**

The helper that returns `{ ac, breakdown }` needs a parallel `informational` field. Update its return type signature:

```ts
function computeAC(/* existing args */): { ac: number; breakdown: ACTerm[]; informational: InformationalBonus[] } {
  // ... existing body ...
  return { ac, breakdown, informational: acInformational };
}
```

And update its caller inside `computeSlotsAndAttacks` to capture the third field:

```ts
const acOut = computeAC(/* args */);
// ... use acOut.ac, acOut.breakdown, acOut.informational ...
```

- [ ] **Step 3: Plumb `acInformational` into the `computeSlotsAndAttacks` return**

Update the return statement (around line 553):

```ts
return {
  ac: acOut.ac,
  acBreakdown: acOut.breakdown,
  acInformational: acOut.informational,
  attacks,
  equippedSlots: slots,
  carriedWeight,
  attunementUsed,
  attunementLimit,
};
```

- [ ] **Step 4: Refactor `magicBonusesForWeaponEntry`**

Replace lines 359-385 of `src/modules/pc/pc.equipment.ts` with:

```ts
function magicBonusesForWeaponEntry(
  entry: EquipmentEntry,
  registry: EntityRegistry,
  ctx: ConditionContext,
): {
  atk: number;
  dmg: number;
  extra?: string;
  sourceName?: string;
  informational: InformationalBonus[];
} {
  const { entity } = lookupEntity(entry, registry);
  const ovr = entry.overrides ?? {};
  const entryAttack = typeof ovr.bonus === "number" ? ovr.bonus : 0;
  const entryDamage = typeof ovr.damage_bonus === "number" ? ovr.damage_bonus : 0;
  const extra = typeof ovr.extra_damage === "string" ? ovr.extra_damage : undefined;

  let itemAttack = 0;
  let itemDamage = 0;
  let sourceName: string | undefined;
  const informational: InformationalBonus[] = [];

  if (entity && isItemEntity(entity)) {
    sourceName = entity.name;
    const b = entity.bonuses;
    const atkOut = readNumericBonus(b?.weapon_attack, ctx);
    const dmgOut = readNumericBonus(b?.weapon_damage, ctx);
    if (atkOut?.kind === "applied") itemAttack = atkOut.value;
    else if (atkOut?.kind === "informational")
      informational.push({ field: "weapon_attack", source: entity.name, value: atkOut.value, conditions: atkOut.conditions });
    if (dmgOut?.kind === "applied") itemDamage = dmgOut.value;
    else if (dmgOut?.kind === "informational")
      informational.push({ field: "weapon_damage", source: entity.name, value: dmgOut.value, conditions: dmgOut.conditions });
  }

  return {
    atk: itemAttack + entryAttack,
    dmg: itemDamage + entryDamage,
    extra,
    sourceName,
    informational,
  };
}
```

- [ ] **Step 5: Update call site of `magicBonusesForWeaponEntry`**

Find the call site around line 495 inside the attack-row build loop. Build a `ConditionContext` near the start of that loop using `buildConditionContext(resolved, slots)` and pass it in:

```ts
const ctx = buildConditionContext(resolved, slots);
// ... inside the loop ...
const magic = magicBonusesForWeaponEntry(entry, registry, ctx);
```

- [ ] **Step 6: Wire informational onto AttackRow in `buildAttackRow`**

Inside `buildAttackRow` (around lines 387-440), update the `args.magic` field type to include `informational`:

```ts
magic: { atk: number; dmg: number; extra?: string; sourceName?: string; informational: InformationalBonus[] };
```

In the constructed `AttackRow` returned by `buildAttackRow`, add the `informational` field:

```ts
return {
  // ... existing fields ...
  informational: args.magic.informational.length > 0 ? args.magic.informational : undefined,
};
```

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: all PASS. Existing flat-number behavior preserved.

- [ ] **Step 8: Commit**

```bash
git add src/modules/pc/pc.equipment.ts
git commit -m "refactor(pc): route Pass B AC and weapon bonus reads through readNumericBonus"
```

---

### Task 11: Plumb informational into pc.recalc.ts

**Files:**
- Modify: `src/modules/pc/pc.recalc.ts:432-516`

- [ ] **Step 1: Add the import**

At the top of `src/modules/pc/pc.recalc.ts`, add:

```ts
import type { InformationalBonus } from "../item/item.conditions.types";
```

- [ ] **Step 2: Add a parallel local for AC informational**

Open `src/modules/pc/pc.recalc.ts`. Find the section around line 432 where `acBreakdownDerived` is declared. Add a parallel local:

```ts
let acInformationalDerived: InformationalBonus[] = [];
```

- [ ] **Step 3: Populate from `derivedEquipment` in each branch**

Find each branch that sets `acBreakdownDerived = derivedEquipment.acBreakdown`. In the same branch, add:

```ts
acInformationalDerived = derivedEquipment.acInformational ?? [];
```

For unarmored fallback branches that compute their own breakdown, leave `acInformationalDerived = []` (no items contribute AC bonuses through the unarmored path today).

In the magic-item-additive branch (where unarmored AC plus magic-item additive AC bonuses are merged), copy `derivedEquipment.acInformational` into the local since magic items are still the source.

- [ ] **Step 4: Add `acInformational` to the returned `DerivedStats`**

Find the recalc return statement that builds `DerivedStats` (around line 516). The current return includes `acBreakdown: acBreakdownDerived`; add alongside it:

```ts
acInformational: acInformationalDerived,
```

This may require also extending the `DerivedStats` interface in `pc.types.ts:213-260` if AC informational is exposed there separately - check the existing structure. If `DerivedStats` already exposes `acBreakdown`, mirror that pattern for `acInformational`.

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/pc/pc.recalc.ts src/modules/pc/pc.types.ts
git commit -m "feat(pc): thread acInformational from DerivedEquipment through recalc"
```

---

## Phase 4 - Recalc integration with conditional bonuses

### Task 12: Shared fixtures for conditional items

**Files:**
- Create: `tests/__fixtures__/items-conditional.ts`

- [ ] **Step 1: Create the fixtures file**

```ts
// tests/__fixtures__/items-conditional.ts
//
// Hand-crafted ItemEntity records used across recalc, augmenter, and UI
// tests. Kept small and focused - each fixture exercises a different
// condition shape.

import type { ItemEntity } from "../../src/modules/item/item.types";

export const bracersOfDefense: ItemEntity = {
  name: "Bracers of Defense",
  slug: "bracers-of-defense",
  rarity: "rare",
  attunement: { required: true },
  bonuses: {
    ac: { value: 2, when: [{ kind: "no_armor" }, { kind: "no_shield" }] },
  },
};

export const arrowCatchingShield: ItemEntity = {
  name: "Arrow-Catching Shield",
  slug: "arrow-catching-shield",
  rarity: "rare",
  attunement: { required: true },
  bonuses: {
    ac: { value: 2, when: [{ kind: "vs_attack_type", value: "ranged" }] },
  },
};

export const sunBlade: ItemEntity = {
  name: "Sun Blade",
  slug: "sun-blade",
  rarity: "rare",
  attunement: { required: true },
  base_item: "longsword",
  bonuses: {
    weapon_attack: 2,
    weapon_damage: { value: 2, when: [{ kind: "vs_creature_type", value: "undead" }] },
  },
};

export const bracersOfArchery: ItemEntity = {
  name: "Bracers of Archery",
  slug: "bracers-of-archery",
  rarity: "uncommon",
  attunement: { required: true },
  bonuses: {
    weapon_damage: {
      value: 2,
      when: [
        { kind: "on_attack_type", value: "ranged" },
        {
          kind: "any_of",
          conditions: [
            { kind: "with_weapon_property", value: "longbow" },
            { kind: "with_weapon_property", value: "shortbow" },
          ],
        },
      ],
    },
  },
};

export const cloakOfTheMantaRay: ItemEntity = {
  name: "Cloak of the Manta Ray",
  slug: "cloak-of-the-manta-ray",
  rarity: "uncommon",
  bonuses: {
    speed: { swim: { value: 60, when: [{ kind: "underwater" }] } },
  },
};

export const cloakOfProtection: ItemEntity = {
  name: "Cloak of Protection",
  slug: "cloak-of-protection",
  rarity: "uncommon",
  attunement: { required: true },
  bonuses: { ac: 1, saving_throws: 1 },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add tests/__fixtures__/items-conditional.ts
git commit -m "test(pc): add conditional-item fixtures for cross-cutting tests"
```

---

### Task 13: Recalc integration tests

**Files:**
- Create: `tests/pc-recalc-conditional-bonuses.test.ts`

- [ ] **Step 1: Locate an existing recalc test fixture for reference**

Open `tests/pc-recalc-ac.test.ts` and read the imports + test setup pattern. Match the same shape (registry construction, character resolution, recalc call) so the new file is consistent.

- [ ] **Step 2: Write the failing tests**

Create `tests/pc-recalc-conditional-bonuses.test.ts`. Use the same scaffolding as `tests/pc-recalc-ac.test.ts` for entity registry, character builder, and recalc invocation. The file should contain these test cases:

```ts
// tests/pc-recalc-conditional-bonuses.test.ts
import { describe, it, expect } from "vitest";
// Mirror imports/helpers from tests/pc-recalc-ac.test.ts for registry,
// character construction, and recalc invocation. The cases below
// describe assertions; reuse existing test scaffolding.
import {
  bracersOfDefense,
  arrowCatchingShield,
  sunBlade,
  cloakOfTheMantaRay,
  cloakOfProtection,
} from "./__fixtures__/items-conditional";

describe("AC with conditional item bonuses", () => {
  it("Bracers of Defense applies +2 when no armor + no shield", () => {
    // Build character: no armor, no shield, bracers equipped+attuned.
    // Expect derived.ac to include the +2 (e.g. 10 + DEX + 2).
    // Expect acInformational to be empty (Tier-1-true is silently applied).
  });

  it("Bracers of Defense skips +2 when wearing armor", () => {
    // Chain mail + bracers. Headline AC = chain mail value (no +2 bracers).
    // acInformational empty (Tier-1-false silently skips).
  });

  it("Bracers of Defense skips +2 when holding a shield no armor", () => {
    // No armor + shield + bracers. Headline AC = 10 + DEX + shield base.
    // No +2 from bracers.
  });

  it("Arrow-Catching Shield surfaces +2 vs ranged as informational", () => {
    // No armor + arrow-catching shield equipped+attuned.
    // Headline AC = 10 + DEX + shield base; does NOT include the +2 conditional.
    // acInformational contains: { field: "ac", source: "Arrow-Catching Shield",
    //   value: 2, conditions: [{kind:"vs_attack_type", value:"ranged"}] }.
  });

  it("Cloak of Protection still works with flat number", () => {
    // Cloak equipped+attuned. AC +1 from cloak applied; saving_throws +1.
  });

  it("Mixed: chain mail + cloak + bracers + arrow-catching shield", () => {
    // Headline AC = chain-mail-base + cloak +1 + shield-base.
    // Bracers contributes nothing (wearing armor -> skipped).
    // acInformational contains arrow-catching shield's +2 vs ranged.
  });
});

describe("Weapon damage with conditional item bonuses", () => {
  it("Sun Blade weapon_attack applies, weapon_damage informational", () => {
    // Equipped+attuned Sun Blade as mainhand longsword.
    // AttackRow.toHit includes the +2 weapon_attack bonus.
    // AttackRow.damageDice does NOT include the +2 (it's conditional).
    // AttackRow.informational contains the +2 vs undead entry.
  });
});

describe("Speed with conditional item bonuses", () => {
  it("Cloak of the Manta Ray swim speed informational underwater", () => {
    // Cloak equipped+attuned (no attunement required for this fixture).
    // Headline swim_speed unchanged (no +60 applied because underwater is informational).
    // out.informational contains: { field: "speed.swim",
    //   source: "Cloak of the Manta Ray", value: 60,
    //   conditions: [{kind:"underwater"}] }.
  });
});
```

For each test: build the character + registry exactly as the surrounding pc-recalc-ac.test.ts pattern. The test file is allowed to be ~150-250 lines.

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/pc-recalc-conditional-bonuses.test.ts`
Expected: all assertions PASS once the test scaffolding mirrors the existing AC test file. If any FAIL, debug:
- For "Bracers of Defense applies/skips": confirm Pass B AC iteration uses the slot-aware ConditionContext (Task 10 Step 1)
- For "Arrow-Catching Shield": confirm `acInformational` is plumbed through recalc (Task 11)
- For "Sun Blade": confirm `magicBonusesForWeaponEntry` puts informational on the AttackRow (Task 10 Step 6)

- [ ] **Step 4: Commit**

```bash
git add tests/pc-recalc-conditional-bonuses.test.ts
git commit -m "test(pc): integration coverage for conditional-bonus recalc"
```

---

## Phase 5 - Augmenter

### Task 14: Curated condition map module

**Files:**
- Create: `scripts/augment/condition-map.ts`

- [ ] **Step 1: Create the module**

```ts
// scripts/augment/condition-map.ts
//
// Curated mapping of (item slug -> bonus field -> Condition[]) for items
// whose conditions have been manually verified against SRD prose.
// Trusted source - overrides regex extractor when present.

import type {
  BonusFieldPath,
  Condition,
} from "../../src/modules/item/item.conditions.types";

type ConditionPerField = Partial<Record<BonusFieldPath, Condition[]>>;

export const CURATED_CONDITIONS_MAP: Record<string, ConditionPerField> = {
  "bracers-of-defense": {
    ac: [{ kind: "no_armor" }, { kind: "no_shield" }],
  },
  "arrow-catching-shield": {
    ac: [{ kind: "vs_attack_type", value: "ranged" }],
  },
  "bracers-of-archery": {
    weapon_damage: [
      { kind: "on_attack_type", value: "ranged" },
      {
        kind: "any_of",
        conditions: [
          { kind: "with_weapon_property", value: "longbow" },
          { kind: "with_weapon_property", value: "shortbow" },
        ],
      },
    ],
  },
  "sun-blade": {
    weapon_damage: [{ kind: "vs_creature_type", value: "undead" }],
  },
  "mace-of-smiting": {
    weapon_attack: [{ kind: "vs_creature_type", value: "construct" }],
    weapon_damage: [{ kind: "vs_creature_type", value: "construct" }],
  },
  "axe-of-the-dwarvish-lords": {
    weapon_damage: [{ kind: "is_race", value: "dwarf" }],
  },
  "cloak-of-the-manta-ray": {
    "speed.swim": [{ kind: "underwater" }],
  },
  "badge-of-the-watch": {
    ac: [{ kind: "no_shield" }],
  },
  "black-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
  "blue-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
  "green-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
  "red-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
  "white-dragon-mask": {
    ac: [{ kind: "no_armor" }],
  },
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/augment/condition-map.ts
git commit -m "feat(augment): curated condition map for SRD magic items"
```

---

### Task 15: Regex condition extractor

**Files:**
- Create: `scripts/augment/condition-extractor.ts`

- [ ] **Step 1: Create the extractor**

```ts
// scripts/augment/condition-extractor.ts
//
// Minimal regex sweep over 5etools entries text. Emits typed conditions
// for high-confidence patterns; falls back to { kind: "raw", text }
// when generic condition language is detected without a pattern match.

import type {
  BonusFieldPath,
  Condition,
} from "../../src/modules/item/item.conditions.types";

type ConditionPerField = Partial<Record<BonusFieldPath, Condition[]>>;

interface Pattern {
  re: RegExp;
  fields: BonusFieldPath[];
  emit: (m: RegExpMatchArray) => Condition[];
}

const STRUCTURED_PATTERNS: Pattern[] = [
  {
    re: /\bwearing no armor and using no \{?@?item\s*[Ss]hield/,
    fields: ["ac"],
    emit: () => [{ kind: "no_armor" }, { kind: "no_shield" }],
  },
  {
    re: /\bif you are wearing no armor\b/i,
    fields: ["ac"],
    emit: () => [{ kind: "no_armor" }],
  },
  {
    re: /\bif you (?:are not|aren't) using a \{?@?item\s*[Ss]hield/i,
    fields: ["ac"],
    emit: () => [{ kind: "no_shield" }],
  },
  {
    re: /\bagainst ranged attack(?:s| rolls)\b/i,
    fields: ["ac", "weapon_attack"],
    emit: () => [{ kind: "vs_attack_type", value: "ranged" }],
  },
  {
    re: /\bon ranged attacks? made\b/i,
    fields: ["weapon_damage"],
    emit: () => [{ kind: "on_attack_type", value: "ranged" }],
  },
  {
    re: /\bagainst (undead|fiend|construct|aberration|beast|elemental|fey|giant|monstrosity|ooze|plant|celestial|dragon)s?\b/i,
    fields: ["weapon_attack", "weapon_damage"],
    emit: (m) => [{ kind: "vs_creature_type", value: m[1].toLowerCase() }],
  },
  {
    re: /\bunderwater\b/i,
    fields: ["speed.swim"],
    emit: () => [{ kind: "underwater" }],
  },
  {
    re: /\bin dim light\b/i,
    fields: ["ac", "weapon_attack", "weapon_damage", "speed.walk", "speed.fly"],
    emit: () => [{ kind: "lighting", value: "dim" }],
  },
  {
    re: /\bwhile flying\b/i,
    fields: ["ac"],
    emit: () => [{ kind: "movement_state", value: "flying" }],
  },
];

const RAW_FALLBACK_RE =
  /\b(?:if you are|while you are|against (?:[a-z]+s?))\b/i;

/**
 * Scan an item's prose text against structured + raw patterns.
 * Returns a per-field map of conditions to apply, plus a flag indicating
 * whether the raw fallback was used.
 */
export function extractConditionsFromProse(
  entriesText: string,
  bonusFields: BonusFieldPath[],
): { perField: ConditionPerField; usedRaw: boolean } {
  const perField: ConditionPerField = {};
  let usedRaw = false;

  for (const pat of STRUCTURED_PATTERNS) {
    const m = entriesText.match(pat.re);
    if (!m) continue;
    const conds = pat.emit(m);
    for (const f of pat.fields) {
      if (!bonusFields.includes(f)) continue;
      if (perField[f]) continue;
      perField[f] = conds;
    }
  }

  if (Object.keys(perField).length === 0 && RAW_FALLBACK_RE.test(entriesText)) {
    usedRaw = true;
    const m = RAW_FALLBACK_RE.exec(entriesText);
    if (m) {
      const sentence = extractSentenceAround(entriesText, m.index ?? 0);
      // Attach raw to all numeric bonus fields the item actually has.
      for (const f of bonusFields) {
        perField[f] = [{ kind: "raw", text: sentence }];
      }
    }
  }

  return { perField, usedRaw };
}

function extractSentenceAround(text: string, idx: number): string {
  const start = Math.max(0, text.lastIndexOf(".", idx) + 1);
  const endDot = text.indexOf(".", idx);
  const end = endDot === -1 ? text.length : endDot + 1;
  return text.slice(start, end).trim();
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/augment/condition-extractor.ts
git commit -m "feat(augment): regex condition extractor with raw fallback"
```

---

### Task 16: Wire extractor into `mapReferenceFields`

**Files:**
- Modify: `scripts/augment-srd-magicitems.ts:221-296, 471`

- [ ] **Step 1: Add imports**

At the top of `scripts/augment-srd-magicitems.ts`, add:

```ts
import { CURATED_CONDITIONS_MAP } from "./augment/condition-map";
import { extractConditionsFromProse } from "./augment/condition-extractor";
import type { BonusFieldPath } from "../src/modules/item/item.conditions.types";
```

- [ ] **Step 2: Add `entriesText` helper**

Add near the top of the file (after existing helpers like `slugify`):

```ts
function entriesText(ref: ReferenceItemEntry): string {
  const out: string[] = [];
  function walk(x: unknown): void {
    if (typeof x === "string") out.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") {
      for (const v of Object.values(x as Record<string, unknown>)) walk(v);
    }
  }
  walk(ref.entries);
  return out.join(" ");
}
```

- [ ] **Step 3: Add the condition-wrapping step in mapReferenceFields**

Inside `mapReferenceFields`, after the existing `if (Object.keys(bonuses).length > 0) out.bonuses = bonuses;` line (around line 296), insert:

```ts
// -- conditions ----------------------------------------------------------
// Wrap numeric bonus fields with Condition arrays from the curated map
// (preferred) or regex sweep (fallback). Emits raw entries as a last
// resort so prose-only condition language is captured.
if (out.bonuses) {
  const slug = slugify(ref.name);
  const curated = CURATED_CONDITIONS_MAP[slug];
  const fieldsPresent: BonusFieldPath[] = [];

  // Identify which numeric bonus paths are currently flat numbers in the
  // augmented bonuses object - those are candidates for wrapping.
  for (const f of [
    "ac", "saving_throws", "spell_attack", "spell_save_dc",
    "weapon_attack", "weapon_damage",
    "speed.walk", "speed.fly", "speed.swim", "speed.climb",
  ] as const) {
    const path = f.split(".");
    let target: unknown = out.bonuses;
    for (const p of path) {
      if (target && typeof target === "object") {
        target = (target as Record<string, unknown>)[p];
      } else {
        target = undefined;
      }
    }
    if (typeof target === "number") fieldsPresent.push(f);
  }

  let perField: Partial<Record<BonusFieldPath, unknown>> = {};
  if (curated) {
    perField = curated as Partial<Record<BonusFieldPath, unknown>>;
  } else if (fieldsPresent.length > 0) {
    const text = entriesText(ref);
    const ex = extractConditionsFromProse(text, fieldsPresent);
    perField = ex.perField;
    if (ex.usedRaw) warnings.push(`raw condition fallback on ${ref.name}: ${slug}`);
  }

  for (const field of fieldsPresent) {
    const conds = perField[field];
    if (!Array.isArray(conds) || conds.length === 0) continue;

    // Wrap the existing flat number with { value, when }.
    const path = field.split(".");
    const last = path.pop()!;
    let target = out.bonuses as Record<string, unknown>;
    for (const p of path) {
      const next = target[p];
      if (typeof next !== "object" || next === null) break;
      target = next as Record<string, unknown>;
    }
    const flat = target[last];
    if (typeof flat === "number") {
      target[last] = { value: flat, when: conds };
    }
  }
}
```

- [ ] **Step 4: Update augmenter report in main()**

Find the existing report block in `main()` (around line 471). Append a condition extraction summary before the final exit:

```ts
const conditionsTouched = augmented.filter((it) => {
  const b = it.bonuses;
  if (!b || typeof b !== "object") return false;
  for (const v of Object.values(b)) {
    if (v && typeof v === "object" && "when" in v) return true;
    if (v && typeof v === "object") {
      for (const inner of Object.values(v as Record<string, unknown>)) {
        if (inner && typeof inner === "object" && "when" in inner) return true;
      }
    }
  }
  return false;
}).length;
console.log(`Conditional bonuses written on ${conditionsTouched} items.`);
const rawWarnings = warnings.filter((w) => w.startsWith("raw condition fallback"));
console.log(`Raw fallback used on ${rawWarnings.length} items (growth list).`);
```

- [ ] **Step 5: Commit**

```bash
git add scripts/augment-srd-magicitems.ts
git commit -m "feat(augment): wire condition extraction into mapReferenceFields"
```

---

### Task 17: Augmenter unit tests

**Files:**
- Modify: `tests/srd-augment-magicitems.test.ts`

- [ ] **Step 1: Add condition-extraction tests**

Append to `tests/srd-augment-magicitems.test.ts`:

```ts
describe("augmenter - condition extraction", () => {
  it("Bracers of Defense ac wrapped with no_armor + no_shield", () => {
    const ref = {
      name: "Bracers of Defense",
      bonusAc: "+2",
      entries: ["...if you are wearing no armor and using no {@item shield|PHB}..."],
    };
    const out = mapReferenceFields(ref as never, []);
    expect(out.bonuses?.ac).toEqual({
      value: 2,
      when: [{ kind: "no_armor" }, { kind: "no_shield" }],
    });
  });

  it("Sun Blade weapon_damage wrapped vs undead curated", () => {
    const ref = {
      name: "Sun Blade",
      bonusWeapon: "+2",
      entries: ["...this weapon deals an extra 1d8 radiant damage to undead..."],
    };
    const out = mapReferenceFields(ref as never, []);
    expect(out.bonuses?.weapon_damage).toEqual({
      value: 2,
      when: [{ kind: "vs_creature_type", value: "undead" }],
    });
  });

  it("Bracers of Archery weapon_damage with on_attack_type + any_of", () => {
    const ref = {
      name: "Bracers of Archery",
      bonusWeaponDamage: "+2",
      entries: ["...you gain a +2 bonus to damage rolls on ranged attacks made with such weapons..."],
    };
    const out = mapReferenceFields(ref as never, []);
    expect(out.bonuses?.weapon_damage).toMatchObject({
      value: 2,
      when: expect.arrayContaining([
        { kind: "on_attack_type", value: "ranged" },
      ]),
    });
  });

  it("regex sweep matches against ranged attacks to ac field", () => {
    const ref = {
      name: "Made-Up Item",
      bonusAc: "+2",
      entries: ["You gain a +2 bonus to AC against ranged attacks while you wield this."],
    };
    const out = mapReferenceFields(ref as never, []);
    expect(out.bonuses?.ac).toEqual({
      value: 2,
      when: [{ kind: "vs_attack_type", value: "ranged" }],
    });
  });

  it("regex raw fallback emits raw + warning for unmapped condition language", () => {
    const ref = {
      name: "Strange Cloak",
      bonusAc: "+1",
      entries: ["You gain +1 AC if you are dancing under a full moon."],
    };
    const warnings: string[] = [];
    const out = mapReferenceFields(ref as never, warnings);
    expect(out.bonuses?.ac).toMatchObject({
      value: 1,
      when: [{ kind: "raw", text: expect.stringContaining("dancing") }],
    });
    expect(warnings.some((w) => w.startsWith("raw condition fallback"))).toBe(true);
  });

  it("Cloak of Protection stays flat while-equipped is not a condition", () => {
    const ref = {
      name: "Cloak of Protection",
      bonusAc: "+1",
      bonusSavingThrow: "+1",
      entries: ["You gain a +1 bonus to AC and saving throws while you wear this cloak."],
    };
    const out = mapReferenceFields(ref as never, []);
    expect(out.bonuses?.ac).toBe(1);
    expect(out.bonuses?.saving_throws).toBe(1);
  });

  it("items with no condition language stay flat", () => {
    const ref = {
      name: "+1 Longsword",
      bonusWeapon: "+1",
      entries: ["You gain a +1 bonus to attack and damage rolls made with this magic weapon."],
    };
    const out = mapReferenceFields(ref as never, []);
    expect(out.bonuses?.weapon_attack).toBe(1);
    expect(out.bonuses?.weapon_damage).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/srd-augment-magicitems.test.ts`
Expected: all tests PASS, including the 7 new ones.

- [ ] **Step 3: Commit**

```bash
git add tests/srd-augment-magicitems.test.ts
git commit -m "test(augment): cover curated map, regex sweep, raw fallback, negatives"
```

---

### Task 18: Run augmenter against the SRD bundle

**Files:**
- Create: `scripts/inspect-augmented-bonuses.ts`
- Modify: `src/srd/data/magicitems.json` (output)

- [ ] **Step 1: Create an inspection helper script**

```ts
// scripts/inspect-augmented-bonuses.ts
//
// One-shot helper that reads src/srd/data/magicitems.json and prints
// the bonuses field for a configurable list of items by slug or name.
// Used during plan verification.

import * as fs from "fs";
import * as path from "path";

const SRD_PATH = path.resolve(__dirname, "..", "src/srd/data/magicitems.json");
const SAMPLE_SLUGS = [
  "bracers-of-defense",
  "arrow-catching-shield",
  "sun-blade",
  "cloak-of-protection",
  "cloak-of-the-manta-ray",
];

interface ItemRecord { name?: string; slug?: string; bonuses?: unknown }

const data = JSON.parse(fs.readFileSync(SRD_PATH, "utf-8")) as ItemRecord[];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

for (const target of SAMPLE_SLUGS) {
  const it = data.find((x) => x.slug === target || (x.name && slugify(x.name) === target));
  console.log(`${target}: ${JSON.stringify(it?.bonuses ?? null)}`);
}
```

- [ ] **Step 2: Run the augmenter**

Run: `npx tsx scripts/augment-srd-magicitems.ts`
Expected output includes a "Conditional bonuses written on N items" line. N should be at least 13 (the curated mappings) plus any regex-structured matches.

- [ ] **Step 3: Inspect Bracers of Defense and friends in the augmented output**

Run: `npx tsx scripts/inspect-augmented-bonuses.ts`
Expected output:
- `bracers-of-defense: {"ac":{"value":2,"when":[{"kind":"no_armor"},{"kind":"no_shield"}]}}`
- `arrow-catching-shield`: AC field is conditional with `vs_attack_type: ranged`
- `sun-blade`: `weapon_damage` conditional with `vs_creature_type: undead`; `weapon_attack` flat number
- `cloak-of-protection`: flat `{"ac":1,"saving_throws":1}`
- `cloak-of-the-manta-ray`: `speed.swim` is conditional with `underwater`

- [ ] **Step 4: Confirm the schema validates the augmented data**

Run: `npm test -- tests/srd-normalizer-magicitem.test.ts`
Expected: PASS. The bundled JSON parses through `itemEntitySchema` without errors.

- [ ] **Step 5: Commit augmented data**

```bash
git add src/srd/data/magicitems.json scripts/inspect-augmented-bonuses.ts
git commit -m "chore(srd): regenerate magicitems bundle with conditional bonuses"
```

---

## Phase 6 - UI surfaces

### Task 19: AC tooltip situational section

**Files:**
- Modify: `src/modules/pc/components/ac-tooltip.ts`
- Modify: `src/modules/pc/components/ac-shield.ts:29`
- Create: `tests/pc-ac-tooltip-situational.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/pc-ac-tooltip-situational.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderACTooltip } from "../src/modules/pc/components/ac-tooltip";
import type { InformationalBonus } from "../src/modules/item/item.conditions.types";

function setup(): HTMLElement {
  const root = document.createElement("div");
  if (!("createDiv" in (root as unknown as object))) {
    Object.defineProperty(root, "createDiv", {
      value(opts: { cls?: string; text?: string }) {
        const d = document.createElement("div");
        if (opts?.cls) d.className = opts.cls;
        if (opts?.text) d.textContent = opts.text;
        root.appendChild(d);
        return d;
      },
    });
  }
  return root;
}

describe("AC tooltip situational section", () => {
  let parent: HTMLElement;
  beforeEach(() => { parent = setup(); });

  it("renders no situational section when informational is empty", () => {
    renderACTooltip(parent, {
      ac: 17,
      breakdown: [{ source: "Chain Mail", amount: 16, kind: "armor" }],
      overridden: false,
      informational: [],
    });
    expect(parent.querySelector(".pc-ac-tooltip-row--situational")).toBeNull();
  });

  it("renders a situational row when informational has entries", () => {
    const informational: InformationalBonus[] = [
      {
        field: "ac",
        source: "Arrow-Catching Shield",
        value: 2,
        conditions: [{ kind: "vs_attack_type", value: "ranged" }],
      },
    ];
    renderACTooltip(parent, {
      ac: 17,
      breakdown: [{ source: "Chain Mail", amount: 16, kind: "armor" }],
      overridden: false,
      informational,
    });
    const sit = parent.querySelector(".pc-ac-tooltip-row--situational");
    expect(sit).not.toBeNull();
    expect(sit!.textContent).toContain("Arrow-Catching Shield");
    expect(sit!.textContent).toContain("vs ranged attacks");
    expect(sit!.textContent).toContain("+2");
  });

  it("renders multiple situational rows in order", () => {
    const informational: InformationalBonus[] = [
      { field: "ac", source: "A", value: 1, conditions: [{ kind: "underwater" }] },
      { field: "ac", source: "B", value: 2, conditions: [{ kind: "bloodied" }] },
    ];
    renderACTooltip(parent, {
      ac: 10,
      breakdown: [],
      overridden: false,
      informational,
    });
    const rows = parent.querySelectorAll(".pc-ac-tooltip-row--situational");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("A");
    expect(rows[1].textContent).toContain("B");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/pc-ac-tooltip-situational.test.ts`
Expected: FAIL - `informational` not in `ACTooltipOpts` and section not rendered.

- [ ] **Step 3: Update `ac-tooltip.ts`**

Replace the entire contents of `src/modules/pc/components/ac-tooltip.ts`:

```ts
import type { ACTerm } from "../pc.types";
import type { InformationalBonus } from "../../item/item.conditions.types";
import { conditionsToText } from "../../item/item.conditions";

export interface ACTooltipOpts {
  ac: number;
  breakdown: ACTerm[];
  overridden: boolean;
  informational?: InformationalBonus[];
}

export function renderACTooltip(parent: HTMLElement, opts: ACTooltipOpts): HTMLElement {
  const tip = parent.createDiv({ cls: "pc-ac-tooltip" });
  const header = tip.createDiv({ cls: "pc-ac-tooltip-total" });
  header.setText(`Armor Class: ${opts.ac}${opts.overridden ? "  (overridden)" : ""}`);
  if (opts.overridden) {
    tip.createDiv({ cls: "pc-ac-tooltip-row pc-ac-tooltip-override", text: `Override: ${opts.ac}` });
    tip.createDiv({ cls: "pc-ac-tooltip-divider", text: "-- underlying --" });
  }
  for (const t of opts.breakdown) {
    const row = tip.createDiv({ cls: `pc-ac-tooltip-row${opts.overridden ? " is-greyed" : ""}` });
    row.createSpan({ cls: "pc-ac-tooltip-source", text: t.source });
    row.createSpan({ cls: "pc-ac-tooltip-amount", text: formatSignedAmount(t.amount) });
  }

  const info = opts.informational ?? [];
  if (info.length > 0) {
    tip.createDiv({ cls: "pc-ac-tooltip-divider", text: "Situational" });
    for (const i of info) {
      const row = tip.createDiv({ cls: "pc-ac-tooltip-row pc-ac-tooltip-row--situational" });
      row.createSpan({ cls: "pc-ac-tooltip-source", text: i.source });
      row.createSpan({ cls: "pc-ac-tooltip-amount", text: formatSignedAmount(i.value) });
      row.createSpan({ cls: "pc-ac-tooltip-condition", text: conditionsToText(i.conditions) });
    }
  }

  return tip;
}

function formatSignedAmount(n: number): string {
  if (n === 0) return "+0";
  return n > 0 ? `+${n}` : String(n);
}
```

- [ ] **Step 4: Update `ac-shield.ts` to pass informational through**

Replace line 29 of `src/modules/pc/components/ac-shield.ts`:

```ts
renderACTooltip(tipEl, {
  ac: ctx.derived.ac,
  breakdown: ctx.derived.acBreakdown ?? [],
  overridden,
  informational: ctx.derived.acInformational ?? [],
});
```

- [ ] **Step 5: Add CSS**

Append to `styles.css` (in the AC tooltip section, near `.pc-ac-tooltip-divider`):

```css
.pc-ac-tooltip-row--situational { font-style: italic; opacity: 0.85; }
.pc-ac-tooltip-row--situational .pc-ac-tooltip-condition {
  color: var(--pc-text-muted);
  font-size: var(--pc-fs-label);
  margin-left: var(--pc-space-1);
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: all PASS, including the 3 new tooltip tests.

- [ ] **Step 7: Commit**

```bash
git add src/modules/pc/components/ac-tooltip.ts src/modules/pc/components/ac-shield.ts styles.css tests/pc-ac-tooltip-situational.test.ts
git commit -m "feat(pc): AC tooltip renders situational section for conditional bonuses"
```

---

### Task 20: Attack row situational subline

**Files:**
- Modify: `src/modules/pc/components/attack-rows.ts:7-32`
- Modify: `tests/pc-attack-rows.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/pc-attack-rows.test.ts` (mirror the existing test scaffolding for AttackRows component construction):

```ts
describe("attack row situational subline", () => {
  it("renders a subline when AttackRow.informational has entries", () => {
    // Construct a derived ctx with one attack carrying a Sun-Blade-shaped
    // informational entry on weapon_damage (vs undead).
    // Render via AttackRows component; assert .pc-attack-row-situational
    // exists and its text contains source + condition + signed value.
  });

  it("renders no subline when AttackRow.informational is undefined", () => {
    // Plain attack with no informational; .pc-attack-row-situational absent.
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/pc-attack-rows.test.ts`
Expected: 2 new tests FAIL.

- [ ] **Step 3: Update `attack-rows.ts`**

Replace lines 7-32 of `src/modules/pc/components/attack-rows.ts`:

```ts
import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { AttackRow } from "../pc.types";
import { conditionsToText } from "../../item/item.conditions";

export class AttackRows implements SheetComponent {
  readonly type = "attack-rows";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-attack-rows" });
    const attacks = ctx.derived.attacks ?? [];

    if (attacks.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "No attacks." });
      return;
    }

    const table = root.createEl("table", { cls: "pc-attack-table" });
    const thead = table.createEl("thead").createEl("tr");
    for (const col of ["Name", "Range", "Hit", "Damage", "Notes"]) thead.createEl("th", { text: col });
    const tbody = table.createEl("tbody");

    for (const a of attacks) {
      const tr = tbody.createEl("tr", { cls: "pc-attack-row" });
      tr.createEl("td", { cls: "pc-attack-name", text: a.name });
      tr.createEl("td", { cls: "pc-attack-range", text: a.range ?? "-" });
      tr.createEl("td", { cls: "pc-attack-tohit", text: formatSigned(a.toHit) });
      tr.createEl("td", { cls: "pc-attack-damage", text: damageCellText(a) });
      const notes = tr.createEl("td", { cls: "pc-attack-notes" });
      const info = notes.createSpan({ cls: "pc-attack-info", text: "i" });
      info.title = breakdownTitle(a);
      if (!a.proficient) notes.createSpan({ cls: "pc-attack-non-prof", text: "(non-prof)" });

      // Situational subline for conditional bonuses.
      if (a.informational && a.informational.length > 0) {
        const sub = tbody.createEl("tr", { cls: "pc-attack-row-situational" });
        const td = sub.createEl("td");
        td.setAttribute("colspan", "5");
        for (const i of a.informational) {
          const line = td.createDiv({ cls: "pc-attack-row-situational-line" });
          line.createSpan({ text: `${i.source}: ${formatSigned(i.value)} ${fieldLabel(i.field)} ${conditionsToText(i.conditions)}` });
        }
      }
    }
  }
}

function fieldLabel(field: string): string {
  if (field === "weapon_attack") return "to hit";
  if (field === "weapon_damage") return "dmg";
  return field;
}
```

(Keep existing helpers `formatSigned`, `damageCellText`, `breakdownTitle` below; do not duplicate.)

- [ ] **Step 4: CSS**

Append to `styles.css`:

```css
.pc-attack-row-situational td {
  font-style: italic;
  color: var(--pc-text-muted);
  font-size: var(--pc-fs-label);
  padding: 0.1em 0.5em 0.3em 1.5em;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/pc/components/attack-rows.ts styles.css tests/pc-attack-rows.test.ts
git commit -m "feat(pc): attack row sub-line for situational weapon bonuses"
```

---

### Task 21: Inventory row expand situational caption

**Files:**
- Modify: `src/modules/pc/components/inventory/inventory-row-expand.ts:42`
- Modify: `tests/pc-inventory-row-expand.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/pc-inventory-row-expand.test.ts` (mirror existing scaffolding for renderRowExpand):

```ts
import { bracersOfDefense, cloakOfProtection } from "./__fixtures__/items-conditional";

describe("inventory row expand situational caption", () => {
  it("shows situational bonuses caption for items with conditional bonuses", () => {
    // Render renderRowExpand for an entry whose resolved.entity is bracersOfDefense.
    // Assert .pc-inv-expand-situational element exists.
    // Assert it lists the conditional bonus: text contains "+2 AC" and
    // "no armor" and "no shield".
  });

  it("does not render the caption for unconditional items", () => {
    // Render with cloakOfProtection (flat number bonuses only).
    // Assert .pc-inv-expand-situational is absent.
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/pc-inventory-row-expand.test.ts`
Expected: 2 new tests FAIL.

- [ ] **Step 3: Add `renderSituationalCaption` helper**

Append to `src/modules/pc/components/inventory/inventory-row-expand.ts` (after the existing imports, before `renderRowExpand`):

```ts
import type { ItemEntity } from "../../../item/item.types";
import type {
  Condition,
  ConditionalBonus,
  BonusFieldPath,
} from "../../../item/item.conditions.types";
import { conditionsToText } from "../../../item/item.conditions";

interface SituationalLine {
  field: BonusFieldPath;
  value: number;
  conditions: Condition[];
}

function isConditionalBonus(x: unknown): x is ConditionalBonus {
  return !!x && typeof x === "object" && Array.isArray((x as { when?: unknown }).when);
}

function collectSituational(item: ItemEntity): SituationalLine[] {
  const out: SituationalLine[] = [];
  const b = item.bonuses;
  if (!b) return out;

  for (const key of [
    "ac", "saving_throws", "spell_attack", "spell_save_dc",
    "weapon_attack", "weapon_damage",
  ] as const) {
    const v = b[key];
    if (isConditionalBonus(v)) {
      out.push({ field: key, value: v.value, conditions: v.when });
    }
  }

  if (b.speed) {
    for (const k of ["walk", "fly", "swim", "climb"] as const) {
      const v = b.speed[k];
      if (isConditionalBonus(v)) {
        out.push({ field: `speed.${k}`, value: v.value, conditions: v.when });
      }
    }
  }

  if (b.ability_scores?.bonus) {
    for (const [k, v] of Object.entries(b.ability_scores.bonus)) {
      if (isConditionalBonus(v)) {
        out.push({ field: `ability_scores.bonus.${k}` as BonusFieldPath, value: v.value, conditions: v.when });
      }
    }
  }

  return out;
}

function fieldShortLabel(field: BonusFieldPath): string {
  if (field === "ac") return "AC";
  if (field === "saving_throws") return "saves";
  if (field === "spell_attack") return "spell atk";
  if (field === "spell_save_dc") return "spell DC";
  if (field === "weapon_attack") return "weapon atk";
  if (field === "weapon_damage") return "weapon dmg";
  if (field.startsWith("speed.")) return field.slice("speed.".length) + " speed";
  if (field.startsWith("ability_scores.bonus.")) return field.slice("ability_scores.bonus.".length).toUpperCase();
  return field;
}

function renderSituationalCaption(parent: HTMLElement, item: ItemEntity): void {
  const lines = collectSituational(item);
  if (lines.length === 0) return;
  const cap = parent.createDiv({ cls: "pc-inv-expand-situational" });
  cap.createDiv({ cls: "pc-inv-expand-situational-title", text: "Situational bonuses" });
  for (const l of lines) {
    const li = cap.createDiv({ cls: "pc-inv-expand-situational-line" });
    const sign = l.value >= 0 ? "+" : "";
    li.setText(`- ${sign}${l.value} ${fieldShortLabel(l.field)} ${conditionsToText(l.conditions)}`);
  }
}
```

- [ ] **Step 4: Call `renderSituationalCaption` from `renderRowExpand`**

Inside `renderRowExpand`, after the existing block-rendering branches and before `renderActionsStrip` (around line 45), add:

```ts
  // Situational bonuses caption - independent of weapon/armor/item branch.
  if (ctx.resolved.entityType === "item" && ctx.resolved.entity) {
    renderSituationalCaption(expand, ctx.resolved.entity as ItemEntity);
  }
```

- [ ] **Step 5: CSS**

Append to `styles.css`:

```css
.pc-inv-expand-situational {
  margin-top: var(--pc-space-2);
  padding: var(--pc-space-1) var(--pc-space-2);
  border-left: 2px solid var(--pc-tan);
  font-style: italic;
  color: var(--pc-text-muted);
  font-size: var(--pc-fs-label);
}
.pc-inv-expand-situational-title { font-weight: 600; margin-bottom: var(--pc-space-1); }
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/pc/components/inventory/inventory-row-expand.ts styles.css tests/pc-inventory-row-expand.test.ts
git commit -m "feat(pc): inventory expand shows situational bonuses caption"
```

---

## Phase 7 - Final verification

### Task 22: Full regression sweep + manual SRD verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests PASS. No skipped or unexpected failures.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: 0 errors. Warnings are acceptable.

- [ ] **Step 4: Inspect augmenter output for the sample items**

Run: `npx tsx scripts/inspect-augmented-bonuses.ts`
Expected output matches Task 18 Step 3 (Bracers of Defense conditional, Cloak of Protection flat, etc).

- [ ] **Step 5: Manual UI smoke test**

Run: `npm run dev`
Open Obsidian, navigate to a PC sheet with Bracers of Defense equipped+attuned (no armor, no shield):
- Confirm headline AC includes the +2.
- Hover the AC shield; confirm the breakdown row shows "Bracers of Defense +2".
- No "Situational" divider should appear (Tier-1-true is silently applied).

Equip chain mail on the same character:
- Confirm headline AC drops back to chain mail's value (the +2 disappears, silently skipped).

Equip an Arrow-Catching Shield instead:
- Confirm headline AC includes the shield's flat base AC.
- Confirm the AC tooltip shows a "Situational" divider with "Arrow-Catching Shield +2 vs ranged attacks".

Equip a Sun Blade as mainhand:
- Confirm the attack row shows the +2 to-hit (applied flat).
- Confirm a situational sub-line under the row reads "Sun Blade: +2 dmg vs undead".

Open the inventory and click to expand any of these items:
- Confirm a "Situational bonuses" caption appears below the description, listing the relevant conditional bonus.

- [ ] **Step 6: Final commit if any minor adjustments were needed**

If steps 1-5 found issues, fix and commit them with descriptive messages before proceeding.

- [ ] **Step 7: Push**

```bash
git push
```

The branch `feat/phase0-module-architecture` should now contain all 22 tasks' commits.

---

## Self-review notes

This plan was drafted from `docs/superpowers/specs/2026-04-26-magic-item-conditional-bonuses-design.md`. Spec-coverage check:

| Spec section | Plan task(s) |
|---|---|
| §3 schema (Condition union, ConditionalBonus, BonusFieldPath) | Tasks 1, 2 |
| §3.4 backwards compatibility | Tasks 2, 9 (verified by existing tests) |
| §4 augmenter - curated map | Task 14 |
| §4 augmenter - regex sweep + raw fallback | Task 15 |
| §4 augmenter - wire into mapReferenceFields | Task 16 |
| §4 augmenter - tests | Task 17 |
| §5.1 evaluateCondition + evaluateConditions | Tasks 4, 5 |
| §5.2 readNumericBonus | Task 6 |
| §5.3 refactor of three iteration sites | Tasks 9, 10 |
| §5.4-5.5 informational data plumbing | Tasks 8, 11 |
| §6.1 conditionToText | Task 7 |
| §6.2 AC tooltip situational | Task 19 |
| §6.3 Attack row situational sub-line | Task 20 |
| §6.4 Inventory row expand caption | Task 21 |
| §6.5 deferred save/spell/speed tooltips | Out of scope (per spec §9.4) |
| §7 testing layers 1-7 | Tasks 3, 4-7, 13, 17, 19-21 |
| §9 follow-ups (out of scope) | Documented in spec; not in this plan |

All spec sections have task coverage or are explicitly out-of-scope per the spec itself.
