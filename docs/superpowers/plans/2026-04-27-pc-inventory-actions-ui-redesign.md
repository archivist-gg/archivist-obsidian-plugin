# PC Inventory + Actions UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Whenever this plan dispatches an agent, the parent uses `model: "opus"` per project preference.

**Goal:** Remove the 4-slot loadout UI in favor of an auto-derived slot model; redesign the inventory header into a single Attunement (left) + Currency (right) parchment strip; rebuild the Actions tab as three monster-block-style tables (Weapons / Items / Features) with action-cost badges, manual-toggle charge boxes (empty = available, ✕ = expended), click-to-roll inline italic dice, and click-to-expand row details that reuse the existing `inventory-row-expand` component.

**Architecture:** Pure presentation work. The `slot` field on `EquipmentEntry` is preserved (load-bearing for AC, attack iteration, two-handed conflict, Tier-1 conditions) but no longer surfaced via UI; `equipItem()` already auto-derives slots. Inline-tag-renderer (`atk`, `dmg`, `dc`, `dice`) is reused with a context-class CSS override (`.pc-actions-tab`) that flips pill styling to monster-block italic-serif. A new curated `ITEM_ACTIONS` slug map seeds item-action defaults; per-character overrides are written via a new "Actions" panel inside `inventory-row-expand`.

**Tech Stack:** TypeScript strict, Zod (schema), Vitest with jsdom (`npm test`), tsx (script execution), custom CSS build (`npm run build:css` concatenates `src/modules/pc/styles/*.css` into root `styles.css`).

**Reference spec:** `docs/superpowers/specs/2026-04-27-pc-inventory-actions-ui-redesign-design.md`

---

## File structure

**New files**

| Path | Responsibility |
|---|---|
| `src/modules/item/item.actions-map.ts` | `ItemAction` type + curated `ITEM_ACTIONS: Record<slug, ItemAction>` for canonical SRD chargeable / activated items |
| `src/modules/pc/components/inventory/header-strip.ts` | Composes `AttunementStrip` + divider + `CurrencyStrip` inside the parchment box |
| `src/modules/pc/components/actions/cost-badge.ts` | `renderCostBadge(parent, cost)` — pill component for the 5 cost values |
| `src/modules/pc/components/actions/charge-boxes.ts` | `renderChargeBoxes(parent, opts)` — pip strip with toggle handlers, parameterized for items vs feature_uses |
| `src/modules/pc/components/actions/row-expand.ts` | Click-to-expand state helper used by all three tables |
| `src/modules/pc/components/actions/weapons-table.ts` | Three-column table over `derived.attacks` (replaces `attack-rows.ts`) |
| `src/modules/pc/components/actions/items-table.ts` | Table over equipped items resolved via `ITEM_ACTIONS` / overrides; expand reuses `inventory-row-expand` |
| `src/modules/pc/components/actions/features-table.ts` | Table over features with `feature.action` defined; expand renders description / entries / structured attacks |
| `src/modules/pc/components/actions/feature-expand.ts` | Renders feature.description / feature.entries / feature.attacks inside the expand row |
| `src/modules/pc/components/actions/standard-actions-list.ts` | Static reference list at the bottom of the Actions tab |
| `src/modules/pc/components/inventory/override-actions-panel.ts` | Form fields inside `inventory-row-expand` for editing `entry.overrides.action` / `entry.overrides.range` / `entry.state.charges.{max,current}` / `entry.state.recovery` |
| `src/modules/pc/styles/actions.css` | Action-tab table layout, cost-badge, charge-box, italic-dice context override, expand-row styling |
| `tests/item-actions-map.test.ts` | Resolution priority tests |
| `tests/pc-inventory-header-strip.test.ts` | New header-strip composition |
| `tests/pc-actions-cost-badge.test.ts` | Cost-badge rendering |
| `tests/pc-actions-charge-boxes.test.ts` | Pip toggle behavior |
| `tests/pc-actions-row-expand.test.ts` | Expand state helper |
| `tests/pc-actions-weapons-table.test.ts` | Weapons-table rendering |
| `tests/pc-actions-items-table.test.ts` | Items-table rendering + expand |
| `tests/pc-actions-features-table.test.ts` | Features-table rendering + expand |
| `tests/pc-actions-feature-expand.test.ts` | Feature description / attacks rendering |
| `tests/pc-edit-state-charges.test.ts` | `expendCharge` / `restoreCharge` / `expendFeatureUse` / `restoreFeatureUse` |
| `tests/pc-override-actions-panel.test.ts` | Override editor Actions panel |

**Modified files**

| Path | Change |
|---|---|
| `src/modules/pc/pc.schema.ts` | Add `overrides.action`, `overrides.range`; extend `state.recovery.reset` enum; add `state.feature_uses` to character state |
| `src/modules/pc/pc.types.ts` | Mirror schema changes in derived types |
| `src/modules/pc/pc.equipment-edit.ts` | Add `expendCharge`, `restoreCharge`, `expendFeatureUse`, `restoreFeatureUse` mutations |
| `src/modules/pc/pc.edit-state.ts` | Wrap the four new mutations in `CharacterEditState` |
| `src/modules/pc/components/inventory/attunement-strip.ts` | Redesign — 68px medallion, rarity color border + glyph, name beneath, dashed empty slot |
| `src/modules/pc/components/inventory/attune-medallion.ts` | Update markup for redesigned medallion (sizing comes from CSS tokens) |
| `src/modules/pc/components/inventory/currency-strip.ts` | Redesign — colored denom letters (V2 style), drop "Wealth" label |
| `src/modules/pc/components/inventory-tab.ts` | Replace header section with `HeaderStrip`; drop loadout strip; drop bottom currency strip |
| `src/modules/pc/components/actions-tab.ts` | Rewrite to compose `WeaponsTable` + `ItemsTable` + `FeaturesTable` + `StandardActionsList`; root `<div class="pc-actions-tab">` |
| `src/modules/pc/components/inventory/inventory-row-expand.ts` | Embed `OverrideActionsPanel` collapsible at the bottom of the expand block |
| `src/modules/pc/styles/tokens.css` | Add `--pc-coin-{pp,gp,ep,sp,cp}` color tokens |
| `src/modules/pc/styles/inventory.css` | Drop all `.pc-loadout-*` rules; add `.pc-header-strip` rules; redesign `.pc-attune-*` and `.pc-currency-*` |
| `src/modules/item/item.augmenter.ts` | Augment SRD entity bundle with `actions: ItemAction` from `ITEM_ACTIONS` |

**Deleted files**

| Path | Reason |
|---|---|
| `src/modules/pc/components/inventory/loadout-strip.ts` | 4-slot widget removed entirely |
| `src/modules/pc/components/attack-rows.ts` | Replaced by `actions/weapons-table.ts` |
| `tests/pc-inventory-loadout-strip.test.ts` | Tests for deleted component |

---

## Phase 1 — Schema and types

### Task 1: Extend equipment override schema with action + range

**Files:**
- Modify: `src/modules/pc/pc.schema.ts:19-25`
- Modify: `src/modules/pc/pc.schema.ts:32-35` (extend `recovery.reset` enum)
- Test: `tests/pc-schema.test.ts` (add cases) — if file does not exist, create it; otherwise extend

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-schema.test.ts (extend or create)
import { describe, it, expect } from "vitest";
import { characterSchema } from "../src/modules/pc/pc.schema";

describe("equipmentEntry overrides — action + range", () => {
  it("accepts overrides.action and overrides.range", () => {
    const parsed = characterSchema.parse({
      name: "T", edition: "2014", race: null, subrace: null, background: null,
      class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual",
      skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] },
      equipment: [{
        item: "[[wand-of-fireballs]]", equipped: true, attuned: true,
        overrides: { action: "action", range: "150 ft." },
        state: { charges: { current: 5, max: 7 }, recovery: { amount: "1d6+1", reset: "dawn" } },
      }],
      overrides: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
    });
    expect(parsed.equipment[0].overrides?.action).toBe("action");
    expect(parsed.equipment[0].overrides?.range).toBe("150 ft.");
  });

  it("accepts state.recovery.reset = 'special'", () => {
    const recovery = { amount: "0", reset: "special" as const };
    const parsed = characterSchema.parse({
      name: "T", edition: "2014", race: null, subrace: null, background: null,
      class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual",
      skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] },
      equipment: [{ item: "[[ring-of-three-wishes]]", equipped: true, state: { recovery } }],
      overrides: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
    });
    expect(parsed.equipment[0].state?.recovery?.reset).toBe("special");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-schema.test.ts -t "overrides — action"`
Expected: FAIL with "Unrecognized key(s) in object: 'action', 'range'" or "Invalid enum value"

- [ ] **Step 3: Apply the schema changes**

In `src/modules/pc/pc.schema.ts`, at the existing `equipmentEntryOverridesSchema` block (lines 19-25):

```ts
const equipmentEntryOverridesSchema = z.object({
  name: z.string().optional(),
  bonus: z.number().int().optional(),
  damage_bonus: z.number().int().optional(),
  extra_damage: z.string().optional(),
  ac_bonus: z.number().int().optional(),
  action: z.enum(["action", "bonus-action", "reaction", "free", "special"]).optional(),
  range: z.string().optional(),
}).strict();
```

In the same file at the existing `equipmentEntryStateSchema.recovery.reset` enum (line 34), change:

```ts
reset: z.enum(["dawn", "short", "long", "special"]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pc-schema.test.ts -t "overrides — action"` and the second test.
Expected: PASS for both.

- [ ] **Step 5: Commit**

```bash
git add tests/pc-schema.test.ts src/modules/pc/pc.schema.ts
git commit -m "feat(pc): allow overrides.action/range + state.recovery.reset='special'"
```

---

### Task 2: Add `state.feature_uses` to character state schema

**Files:**
- Modify: `src/modules/pc/pc.schema.ts:81-111` (`characterStateSchema`)
- Test: `tests/pc-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe("characterState — feature_uses", () => {
  it("defaults feature_uses to {} when missing", () => {
    const parsed = characterSchema.parse({
      name: "T", edition: "2014", race: null, subrace: null, background: null,
      class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual",
      skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] },
      equipment: [],
      overrides: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
    });
    expect(parsed.state.feature_uses).toEqual({});
  });

  it("accepts feature_uses with arbitrary string keys", () => {
    const parsed = characterSchema.parse({
      name: "T", edition: "2014", race: null, subrace: null, background: null,
      class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual",
      skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] },
      equipment: [],
      overrides: {},
      state: {
        hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {},
        concentration: null, conditions: [], inspiration: 0, exhaustion: 0,
        feature_uses: { "second-wind": { used: 0, max: 1 }, "action-surge": { used: 1, max: 1 } },
      },
    });
    expect(parsed.state.feature_uses["action-surge"]).toEqual({ used: 1, max: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-schema.test.ts -t "feature_uses"`
Expected: FAIL — `feature_uses` not present on parsed state.

- [ ] **Step 3: Apply the schema change**

In `src/modules/pc/pc.schema.ts`, inside `characterStateSchema` (around line 110, just before `attuned_items`), add:

```ts
  feature_uses: z.record(z.string(), z.object({
    used: z.number().int().nonnegative(),
    max:  z.number().int().nonnegative(),
  })).default({}),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pc-schema.test.ts -t "feature_uses"`
Expected: PASS for both test cases.

- [ ] **Step 5: Commit**

```bash
git add tests/pc-schema.test.ts src/modules/pc/pc.schema.ts
git commit -m "feat(pc): add state.feature_uses for tracking feature charge expenditure"
```

---

### Task 3: Mirror schema additions in derived types

**Files:**
- Modify: `src/modules/pc/pc.types.ts`

- [ ] **Step 1: Run typecheck before changes to confirm baseline**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 2: Add types alongside existing ones**

Locate the `EquipmentEntry` / `EquipmentEntryOverrides` / `CharacterState` types in `src/modules/pc/pc.types.ts`. They should be derived from the schema via `z.input` or hand-written mirrors. If hand-written:

```ts
// EquipmentEntryOverrides
export interface EquipmentEntryOverrides {
  name?: string;
  bonus?: number;
  damage_bonus?: number;
  extra_damage?: string;
  ac_bonus?: number;
  action?: "action" | "bonus-action" | "reaction" | "free" | "special";
  range?: string;
}

// CharacterState — add:
export interface CharacterState {
  // ... existing fields ...
  feature_uses: Record<string, { used: number; max: number }>;
}

// EquipmentEntryState.recovery.reset — extend:
recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };
```

If the types are inferred from the schema via `z.input<typeof characterSchema>`, they update automatically — verify this by greppng `pc.types.ts` for `z.input`. In that case Step 2 is just running typecheck.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/pc/pc.types.ts
git commit -m "chore(pc): extend types to match schema additions"
```

---

## Phase 2 — Curated `ItemAction` map and augmenter

### Task 4: Create the curated `ITEM_ACTIONS` map module

**Files:**
- Create: `src/modules/item/item.actions-map.ts`
- Test: `tests/item-actions-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/item-actions-map.test.ts
import { describe, it, expect } from "vitest";
import { ITEM_ACTIONS, type ItemAction } from "../src/modules/item/item.actions-map";

describe("ITEM_ACTIONS curated map", () => {
  it("includes wand-of-fireballs with 7 charges and dawn 1d6+1 recovery", () => {
    const a = ITEM_ACTIONS["wand-of-fireballs"];
    expect(a).toBeDefined();
    expect(a.cost).toBe("action");
    expect(a.range).toBe("150 ft.");
    expect(a.max_charges).toBe(7);
    expect(a.recovery).toEqual({ amount: "1d6+1", reset: "dawn" });
  });

  it("includes boots-of-speed (bonus-action, self, 1 use, long rest)", () => {
    const a = ITEM_ACTIONS["boots-of-speed"];
    expect(a.cost).toBe("bonus-action");
    expect(a.range).toBe("self");
    expect(a.max_charges).toBe(1);
    expect(a.recovery).toEqual({ amount: "1", reset: "long" });
  });

  it("includes ring-of-three-wishes (special recovery)", () => {
    const a = ITEM_ACTIONS["ring-of-three-wishes"];
    expect(a.recovery?.reset).toBe("special");
  });

  it("ItemAction type structure compiles", () => {
    const a: ItemAction = { cost: "free", range: undefined, max_charges: undefined, recovery: undefined };
    expect(a.cost).toBe("free");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/item-actions-map.test.ts`
Expected: FAIL with "Cannot find module item.actions-map".

- [ ] **Step 3: Create the module**

```ts
// src/modules/item/item.actions-map.ts

export type ActionCost = "action" | "bonus-action" | "reaction" | "free" | "special";

export interface ItemAction {
  cost: ActionCost;
  range?: string;
  max_charges?: number;
  recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };
}

/**
 * Curated map of canonical SRD chargeable / activated items.
 * Slugs match the SRD compendium slug format. Augmenter reads this map
 * and stamps `actions: ItemAction` onto the augmented entity bundle.
 */
export const ITEM_ACTIONS: Record<string, ItemAction> = {
  // Wands and rods
  "wand-of-fireballs":           { cost: "action",       range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-magic-missiles":      { cost: "action",       range: "120 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-lightning-bolts":     { cost: "action",       range: "100 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-paralysis":           { cost: "action",       range: "60 ft.",  max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-fear":                { cost: "action",       range: "self",    max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-binding":             { cost: "action",       range: "self",    max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-secrets":             { cost: "action",       range: "30 ft.",  max_charges: 3, recovery: { amount: "1d3",   reset: "dawn" } },
  "wand-of-web":                 { cost: "action",       range: "60 ft.",  max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-wonder":              { cost: "action",       range: "120 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },

  // Activatable wondrous items
  "boots-of-speed":              { cost: "bonus-action", range: "self",    max_charges: 1, recovery: { amount: "1",     reset: "long" } },
  "boots-of-levitation":         { cost: "action",       range: "self" },
  "boots-of-striding-and-springing": { cost: "free",     range: "self" },
  "broom-of-flying":             { cost: "action",       range: "touch" },
  "cloak-of-displacement":       { cost: "free",         range: "self" },
  "cloak-of-the-bat":            { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "1", reset: "long" } },
  "decanter-of-endless-water":   { cost: "action",       range: "touch" },
  "drum-of-panic":               { cost: "action",       range: "120 ft.", max_charges: 1, recovery: { amount: "1", reset: "long" } },
  "eyes-of-charming":            { cost: "action",       range: "30 ft.",  max_charges: 3, recovery: { amount: "3", reset: "dawn" } },

  // Rings
  "ring-of-three-wishes":        { cost: "action",       range: "self",    max_charges: 3, recovery: { amount: "0", reset: "special" } },
  "ring-of-shooting-stars":      { cost: "action",       range: "60 ft.",  max_charges: 6, recovery: { amount: "1d6", reset: "dawn" } },
  "ring-of-the-ram":             { cost: "action",       range: "60 ft.",  max_charges: 3, recovery: { amount: "1d3", reset: "dawn" } },
  "ring-of-spell-storing":       { cost: "action",       range: "self",    max_charges: 5 },

  // Magic weapons with activation actions (surface in items table only via override; weapons table is primary)
  "sun-blade":                   { cost: "free",         range: "self" },

  // Potions / consumables
  "potion-of-healing":           { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "potion-of-greater-healing":   { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "potion-of-superior-healing":  { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "potion-of-supreme-healing":   { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "alchemists-fire":             { cost: "action",       range: "20 ft.",  max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "holy-water":                  { cost: "action",       range: "20 ft.",  max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "oil-of-sharpness":            { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/item-actions-map.test.ts`
Expected: PASS — all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add tests/item-actions-map.test.ts src/modules/item/item.actions-map.ts
git commit -m "feat(item): curated ITEM_ACTIONS map for SRD chargeable / activated items"
```

---

### Task 5: Define `resolveItemAction` accessor with override priority

**Files:**
- Modify: `src/modules/item/item.actions-map.ts`
- Test: `tests/item-actions-map.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/item-actions-map.test.ts`:

```ts
import { resolveItemAction } from "../src/modules/item/item.actions-map";
import type { EquipmentEntry } from "../src/modules/pc/pc.types";

describe("resolveItemAction priority", () => {
  it("returns null when no override and slug not in map", () => {
    const entry = { item: "[[mundane-rope]]" } as EquipmentEntry;
    expect(resolveItemAction("mundane-rope", entry)).toBeNull();
  });

  it("returns curated map entry when slug matches and no override", () => {
    const entry = { item: "[[wand-of-fireballs]]" } as EquipmentEntry;
    const a = resolveItemAction("wand-of-fireballs", entry);
    expect(a?.cost).toBe("action");
    expect(a?.range).toBe("150 ft.");
  });

  it("override.action+range wins over curated map", () => {
    const entry = {
      item: "[[wand-of-fireballs]]",
      overrides: { action: "bonus-action", range: "60 ft." },
    } as EquipmentEntry;
    const a = resolveItemAction("wand-of-fireballs", entry);
    expect(a?.cost).toBe("bonus-action");
    expect(a?.range).toBe("60 ft.");
    expect(a?.max_charges).toBe(7);
  });

  it("override.action without curated map base produces ItemAction with override only", () => {
    const entry = {
      item: "[[homebrew-thing]]",
      overrides: { action: "reaction", range: "30 ft." },
    } as EquipmentEntry;
    const a = resolveItemAction("homebrew-thing", entry);
    expect(a?.cost).toBe("reaction");
    expect(a?.range).toBe("30 ft.");
    expect(a?.max_charges).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/item-actions-map.test.ts -t "resolveItemAction"`
Expected: FAIL — `resolveItemAction` not exported.

- [ ] **Step 3: Implement the accessor**

Append to `src/modules/item/item.actions-map.ts`:

```ts
import type { EquipmentEntry } from "../pc/pc.types";

/**
 * Resolve the ItemAction for an equipped entry.
 * Priority: entry.overrides (action + range) merged onto curated map.
 * Returns null when neither source supplies an action cost.
 */
export function resolveItemAction(slug: string, entry: EquipmentEntry): ItemAction | null {
  const curated = ITEM_ACTIONS[slug] ?? null;
  const override = entry.overrides;
  const overrideCost = override?.action;
  const overrideRange = override?.range;

  if (!curated && !overrideCost) return null;

  return {
    cost: overrideCost ?? curated!.cost,
    range: overrideRange ?? curated?.range,
    max_charges: curated?.max_charges,
    recovery: curated?.recovery,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/item-actions-map.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add tests/item-actions-map.test.ts src/modules/item/item.actions-map.ts
git commit -m "feat(item): resolveItemAction with override-over-curated priority"
```

---

### Task 6: Wire the augmenter to stamp `actions` onto SRD bundle

**Files:**
- Modify: `src/modules/item/item.augmenter.ts`
- Modify: SRD bundle output (regenerated, not committed source)
- Test: `tests/item-augmenter.test.ts` if it exists; otherwise add a focused test

First find the augmenter:
```bash
grep -ln "augment\|magicitems" src/modules/item/ scripts/ 2>/dev/null
```

The augmenter that already produces conditional bonuses is the one to extend. Based on the spec it lives at `scripts/augment-srd-magicitems.ts` (or similar) and writes to a generated JSON bundle.

- [ ] **Step 1: Locate the augmenter file**

Run:
```bash
grep -rln "CURATED_CONDITIONS_MAP\|condition-map\|augment-srd" scripts/ src/modules/item/ 2>/dev/null
```

Note the path printed. The instructions below assume `scripts/augment-srd-magicitems.ts`; adapt to the actual file.

- [ ] **Step 2: Write the failing test**

Create `tests/item-augmenter-actions.test.ts`:

```ts
/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { augmentItem } from "../src/modules/item/item.augmenter"; // adapt import to actual entry point
import { ITEM_ACTIONS } from "../src/modules/item/item.actions-map";

describe("item.augmenter — actions stamping", () => {
  it("stamps ITEM_ACTIONS[slug] as `actions` on a curated entity", () => {
    const augmented = augmentItem({ slug: "wand-of-fireballs", name: "Wand of Fireballs", entries: [] });
    expect(augmented.actions).toEqual(ITEM_ACTIONS["wand-of-fireballs"]);
  });

  it("leaves `actions` undefined when slug is not curated", () => {
    const augmented = augmentItem({ slug: "mundane-rope", name: "Rope, Hempen", entries: [] });
    expect(augmented.actions).toBeUndefined();
  });
});
```

If the augmenter has a different signature (e.g. operates on a list rather than a single entity), adapt the test to call the actual exported function.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/item-augmenter-actions.test.ts`
Expected: FAIL — `actions` not present on augmented entity.

- [ ] **Step 4: Extend the augmenter**

Open the augmenter file (located in Step 1). Find the function that produces the per-entity augmented bundle (the existing condition extraction is the prior art — find that and add a sibling step). Add:

```ts
import { ITEM_ACTIONS } from "../src/modules/item/item.actions-map";
// or relative import depending on file location

// In the per-entity augmentation function, after conditional bonuses are stamped:
const action = ITEM_ACTIONS[entity.slug];
if (action) {
  augmented.actions = action;
}
```

If the augmented entity type is declared in a sibling types file (e.g. `item.types.ts`), add `actions?: ItemAction;` there.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/item-augmenter-actions.test.ts`
Expected: PASS for both cases.

- [ ] **Step 6: Regenerate the SRD magic-items bundle**

Run the regenerate script (find with `grep -E '"regenerate' package.json`):
```bash
npm run regenerate-srd-armor   # or the magicitems-equivalent
```
Confirm the generated JSON has `"actions": {...}` on entries that match `ITEM_ACTIONS` keys.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: PASS — no regressions.

- [ ] **Step 8: Commit**

```bash
git add tests/item-augmenter-actions.test.ts src/modules/item/item.augmenter.ts \
  src/modules/item/item.types.ts \
  src/data/srd/  # or wherever the regenerated bundle lives — only the .json or .generated.ts
git commit -m "feat(item): augmenter stamps ITEM_ACTIONS[slug] onto SRD entity bundle"
```

---

## Phase 3 — Inventory header redesign

### Task 7: Add coin color tokens

**Files:**
- Modify: `src/modules/pc/styles/tokens.css`

- [ ] **Step 1: Add tokens in the existing `:root` block**

In `src/modules/pc/styles/tokens.css`, alongside the existing `--pc-rarity-*` and color tokens, add:

```css
  /* Coin colors — dramatic + harmonized */
  --pc-coin-pp: #1f3f7a;  /* matches --pc-rarity-rare */
  --pc-coin-gp: #a3590a;  /* matches --pc-rarity-legendary */
  --pc-coin-ep: #6b6f2a;
  --pc-coin-sp: #4a5a66;
  --pc-coin-cp: #8a3d1f;
```

- [ ] **Step 2: Rebuild CSS**

Run: `npm run build:css`
Expected: success — `styles.css` updated with the new tokens.

- [ ] **Step 3: Commit**

```bash
git add src/modules/pc/styles/tokens.css styles.css
git commit -m "style(pc): add --pc-coin-{pp,gp,ep,sp,cp} tokens"
```

---

### Task 8: Redesign CurrencyStrip with V2 colored denoms

**Files:**
- Modify: `src/modules/pc/components/inventory/currency-strip.ts`
- Modify: `src/modules/pc/styles/inventory.css`
- Test: `tests/pc-inventory-currency-strip.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-inventory-currency-strip.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { CurrencyStrip } from "../src/modules/pc/components/inventory/currency-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function makeCtx(currency: { pp?: number; gp?: number; ep?: number; sp?: number; cp?: number }): ComponentRenderContext {
  return {
    resolved: { definition: { currency } } as never,
    derived: {} as never, core: {} as never, app: {} as never, editState: null,
  };
}

describe("CurrencyStrip — redesigned", () => {
  it("renders 5 coin cells in pp/gp/ep/sp/cp order", () => {
    const root = mountContainer();
    new CurrencyStrip().render(root, makeCtx({ pp: 2, gp: 147, ep: 0, sp: 35, cp: 12 }));
    const cells = [...root.querySelectorAll(".pc-currency-cell")];
    expect(cells.map((c) => c.querySelector(".pc-currency-denom")?.textContent)).toEqual(["PP", "GP", "EP", "SP", "CP"]);
    expect(cells.map((c) => c.querySelector(".pc-currency-val")?.textContent)).toEqual(["2", "147", "0", "35", "12"]);
  });

  it("denom span carries coin-specific class for color", () => {
    const root = mountContainer();
    new CurrencyStrip().render(root, makeCtx({ pp: 1 }));
    expect(root.querySelector(".pc-currency-denom.coin-pp")).toBeTruthy();
    expect(root.querySelector(".pc-currency-denom.coin-gp")).toBeTruthy();
  });

  it("does NOT render a 'Wealth' label", () => {
    const root = mountContainer();
    new CurrencyStrip().render(root, makeCtx({}));
    expect(root.textContent?.toLowerCase()).not.toContain("wealth");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-inventory-currency-strip.test.ts`
Expected: FAIL — `.pc-currency-denom` not present, "Wealth" label still rendered, etc.

- [ ] **Step 3: Rewrite CurrencyStrip**

Replace the body of `src/modules/pc/components/inventory/currency-strip.ts`:

```ts
import type { SheetComponent, ComponentRenderContext } from "../component.types";
import { currencyCell } from "../edit-primitives";

const COIN_KEYS = ["pp", "gp", "ep", "sp", "cp"] as const;
type CoinKey = typeof COIN_KEYS[number];

export class CurrencyStrip implements SheetComponent {
  readonly type = "currency-strip";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const cur = ctx.resolved.definition.currency;
    const editState = ctx.editState;
    const strip = el.createDiv({ cls: "pc-currency-row" });

    for (const coin of COIN_KEYS) {
      const value = cur?.[coin] ?? 0;
      const cell = strip.createDiv({ cls: "pc-currency-cell" });

      cell.createDiv({ cls: `pc-currency-denom coin-${coin}`, text: coin.toUpperCase() });

      if (editState) {
        currencyCell(cell, { coin: coin.toUpperCase(), value, onSet: (n) => editState.setCurrency(coin, n) });
      } else {
        cell.createDiv({ cls: "pc-currency-val", text: String(value) });
      }
    }
  }
}
```

If `currencyCell` from `edit-primitives` already provides its own DENOM markup, adapt: in the editing branch, render only the `<input>` with class `pc-currency-val` and ensure the denom span sits above it. Verify by reading `src/modules/pc/components/edit-primitives.ts` and adjusting markup so the test assertions hold.

- [ ] **Step 4: Update CSS**

In `src/modules/pc/styles/inventory.css`, replace the existing `.pc-currency-row` / `.pc-currency-cell` rules with:

```css
.pc-currency-row {
  display: flex;
  gap: var(--pc-space-3);
  align-items: center;
}
.pc-currency-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 36px;
}
.pc-currency-denom {
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-body);
  letter-spacing: var(--pc-ls-caps-sm);
  font-weight: 700;
  text-transform: uppercase;
  line-height: var(--pc-lh-tight);
}
.pc-currency-denom.coin-pp { color: var(--pc-coin-pp); }
.pc-currency-denom.coin-gp { color: var(--pc-coin-gp); }
.pc-currency-denom.coin-ep { color: var(--pc-coin-ep); }
.pc-currency-denom.coin-sp { color: var(--pc-coin-sp); }
.pc-currency-denom.coin-cp { color: var(--pc-coin-cp); }
.pc-currency-val {
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-title);
  color: var(--pc-text-primary);
  line-height: var(--pc-lh-value);
}
```

- [ ] **Step 5: Rebuild CSS**

Run: `npm run build:css`

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/pc-inventory-currency-strip.test.ts`
Expected: PASS — all 3 cases.

Run: `npm test` for regressions.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/pc-inventory-currency-strip.test.ts \
  src/modules/pc/components/inventory/currency-strip.ts \
  src/modules/pc/styles/inventory.css styles.css
git commit -m "feat(pc): redesign CurrencyStrip with V2 colored denom letters, drop 'Wealth' label"
```

---

### Task 9: Redesign AttunementStrip + medallion (68px, rarity color, name beneath)

**Files:**
- Modify: `src/modules/pc/components/inventory/attunement-strip.ts`
- Modify: `src/modules/pc/components/inventory/attune-medallion.ts` (markup only — sizing comes from CSS)
- Modify: `src/modules/pc/styles/inventory.css` (medallion sizing + name styling + rarity-color border)
- Test: `tests/pc-inventory-attunement-strip.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-inventory-attunement-strip.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { AttunementStrip } from "../src/modules/pc/components/inventory/attunement-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctxWithAttuned(attuned: Array<{ name: string; rarity: string }>): ComponentRenderContext {
  const equipment = attuned.map((it, i) => ({
    item: `[[item-${i}]]`, equipped: true, attuned: true,
  }));
  return {
    resolved: { definition: { equipment } } as never,
    derived: { attunementUsed: attuned.length, attunementLimit: 3 } as never,
    core: { entities: { getBySlug: (slug: string) => {
      const idx = Number(slug.split("-")[1]);
      return { entityType: "item", data: { name: attuned[idx].name, rarity: attuned[idx].rarity } };
    }}} as never,
    app: {} as never,
    editState: null,
  };
}

describe("AttunementStrip — redesigned", () => {
  it("renders 'ATTUNED' crimson label and N/M count", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctxWithAttuned([{ name: "Cloak", rarity: "uncommon" }]));
    expect(root.querySelector(".pc-attune-label")?.textContent?.toLowerCase()).toContain("attuned");
    expect(root.querySelector(".pc-attune-count")?.textContent).toMatch(/1.*\/\s*3/);
  });

  it("renders one medallion-cell per limit slot, with item name below", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctxWithAttuned([
      { name: "Cloak of Protection", rarity: "uncommon" },
      { name: "Ring of Mind Shielding", rarity: "uncommon" },
    ]));
    const cells = root.querySelectorAll(".pc-medallion-wrapper");
    expect(cells.length).toBe(3);
    expect(cells[0].querySelector(".pc-medallion-name")?.textContent).toBe("Cloak of Protection");
    expect(cells[1].querySelector(".pc-medallion-name")?.textContent).toBe("Ring of Mind Shielding");
  });

  it("empty slots get class 'empty' on medallion + 'empty' label below", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctxWithAttuned([{ name: "Cloak", rarity: "uncommon" }]));
    const empties = root.querySelectorAll(".pc-medallion.empty");
    expect(empties.length).toBe(2);
  });

  it("medallion gets rarity-* class for border + glyph color", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctxWithAttuned([{ name: "Wand", rarity: "very rare" }]));
    expect(root.querySelector(".pc-medallion.rarity-very-rare")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-inventory-attunement-strip.test.ts`
Expected: FAIL — current strip likely doesn't have these exact class names or layout.

- [ ] **Step 3: Read the current strip**

Read `src/modules/pc/components/inventory/attunement-strip.ts` and `attune-medallion.ts`. Confirm class names. The renderMedallion function already adds `.pc-medallion-name`. The strip wraps medallions; we need to ensure: (1) `.pc-attune-label` (crimson "ATTUNED") + `.pc-attune-count` ("2 / 3") are present, (2) `.pc-medallion-wrapper` cells render in the limit count, (3) each cell delegates to `renderMedallion`.

- [ ] **Step 4: Adjust the strip if needed**

Edit `src/modules/pc/components/inventory/attunement-strip.ts` to ensure the markup matches. Pseudo-shape:

```ts
const head = root.createDiv({ cls: "pc-attune-head" });
head.createDiv({ cls: "pc-attune-label", text: "Attuned" });
head.createDiv({ cls: "pc-attune-count", text: `${used} / ${limit}` });
const meds = root.createDiv({ cls: "pc-attune-meds" });
for (let i = 0; i < limit; i++) {
  renderMedallion(meds, { slotIndex: i, occupant: occupants[i] ?? null, onClickEmpty, onClickFilled });
}
```

- [ ] **Step 5: Update CSS — medallion sizing + name + rarity colors**

In `src/modules/pc/styles/inventory.css`, replace existing `.pc-medallion*` rules:

```css
.pc-attune-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
}
.pc-attune-label {
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-small);
  color: var(--pc-crimson);
  text-transform: uppercase;
  letter-spacing: var(--pc-ls-caps-sm);
  font-weight: 700;
}
.pc-attune-count {
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-mid);
  line-height: var(--pc-lh-tight);
}
.pc-attune-meds {
  display: flex;
  gap: var(--pc-space-5);
  align-items: flex-start;
}
.pc-medallion-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--pc-space-2);
  width: 116px;
  cursor: pointer;
}
.pc-medallion {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  border: 2px solid var(--pc-crimson);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: inset 0 0 8px rgba(146, 38, 16, 0.10);
  color: var(--pc-crimson);
}
.pc-medallion.empty {
  border-style: dashed;
  border-color: var(--pc-text-muted);
  background: transparent;
  box-shadow: none;
  opacity: 0.55;
  color: var(--pc-text-muted);
}
.pc-medallion.rarity-uncommon  { border-color: var(--pc-rarity-uncommon);  color: var(--pc-rarity-uncommon); }
.pc-medallion.rarity-rare      { border-color: var(--pc-rarity-rare);      color: var(--pc-rarity-rare); }
.pc-medallion.rarity-very-rare { border-color: var(--pc-rarity-very-rare); color: var(--pc-rarity-very-rare); }
.pc-medallion.rarity-legendary { border-color: var(--pc-rarity-legendary); color: var(--pc-rarity-legendary); }
.pc-medallion.rarity-artifact  { border-color: var(--pc-rarity-artifact);  color: var(--pc-rarity-artifact); }
.pc-medallion-name {
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-small);
  color: var(--pc-text-soft);
  text-align: center;
  line-height: var(--pc-lh-snug);
  max-width: 116px;
  word-break: break-word;
}
```

- [ ] **Step 6: Rebuild CSS + run tests**

Run: `npm run build:css && npx vitest run tests/pc-inventory-attunement-strip.test.ts`
Expected: PASS for all 4 cases. Then `npm test` for regressions.

- [ ] **Step 7: Commit**

```bash
git add tests/pc-inventory-attunement-strip.test.ts \
  src/modules/pc/components/inventory/attunement-strip.ts \
  src/modules/pc/components/inventory/attune-medallion.ts \
  src/modules/pc/styles/inventory.css styles.css
git commit -m "feat(pc): redesign AttunementStrip with 68px rarity-colored medallions + names"
```

---

### Task 10: Create HeaderStrip composing Attunement + divider + Currency

**Files:**
- Create: `src/modules/pc/components/inventory/header-strip.ts`
- Modify: `src/modules/pc/styles/inventory.css`
- Test: `tests/pc-inventory-header-strip.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-inventory-header-strip.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { HeaderStrip } from "../src/modules/pc/components/inventory/header-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function makeCtx(): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } } } as never,
    derived: { attunementUsed: 0, attunementLimit: 3 } as never,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("HeaderStrip", () => {
  it("renders root .pc-header-strip with attune-section + divider + currency-section", () => {
    const root = mountContainer();
    new HeaderStrip().render(root, makeCtx());
    expect(root.querySelector(".pc-header-strip")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-attune")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-divider")).toBeTruthy();
    expect(root.querySelector(".pc-header-strip > .pc-header-currency")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-inventory-header-strip.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create HeaderStrip**

```ts
// src/modules/pc/components/inventory/header-strip.ts
import type { SheetComponent, ComponentRenderContext } from "../component.types";
import { AttunementStrip } from "./attunement-strip";
import { CurrencyStrip } from "./currency-strip";

export class HeaderStrip implements SheetComponent {
  readonly type = "header-strip";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const strip = el.createDiv({ cls: "pc-header-strip" });

    const attune = strip.createDiv({ cls: "pc-header-attune" });
    new AttunementStrip().render(attune, ctx);

    strip.createDiv({ cls: "pc-header-divider" });

    const currency = strip.createDiv({ cls: "pc-header-currency" });
    new CurrencyStrip().render(currency, ctx);
  }
}
```

- [ ] **Step 4: Add CSS for the strip**

In `src/modules/pc/styles/inventory.css`:

```css
.pc-header-strip {
  display: flex;
  align-items: stretch;
  gap: var(--pc-space-5);
  padding: var(--pc-space-3) var(--pc-space-4);
  border: 1px solid var(--pc-tan-muted);
  background: rgba(255, 255, 255, 0.32);
  border-radius: var(--pc-radius-md);
}
.pc-header-attune { display: flex; align-items: stretch; gap: var(--pc-space-4); flex: 1 1 auto; }
.pc-header-divider { width: 1px; align-self: stretch; background: var(--pc-tan-muted); }
.pc-header-currency { display: flex; align-items: center; flex: 0 0 auto; }
```

- [ ] **Step 5: Rebuild CSS + run tests**

Run: `npm run build:css && npx vitest run tests/pc-inventory-header-strip.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/pc-inventory-header-strip.test.ts \
  src/modules/pc/components/inventory/header-strip.ts \
  src/modules/pc/styles/inventory.css styles.css
git commit -m "feat(pc): introduce HeaderStrip composing Attunement + Currency"
```

---

### Task 11: Wire HeaderStrip into inventory-tab; remove LoadoutStrip + bottom currency

**Files:**
- Modify: `src/modules/pc/components/inventory-tab.ts`
- Delete: `src/modules/pc/components/inventory/loadout-strip.ts`
- Delete: `tests/pc-inventory-loadout-strip.test.ts`
- Modify: `src/modules/pc/styles/inventory.css` (drop `.pc-loadout-*` rules)

- [ ] **Step 1: Read current inventory-tab.ts to confirm what's wired**

Read `src/modules/pc/components/inventory-tab.ts`. Confirm lines 28-30 instantiate `LoadoutStrip` and lines ~118-134 render the bottom currency strip.

- [ ] **Step 2: Replace header section + drop bottom currency**

In `src/modules/pc/components/inventory-tab.ts`:

- Remove the import of `LoadoutStrip` and the line that instantiates it.
- Remove the bottom-of-body currency block (the section that creates the currency strip again).
- Replace the header block (was `LoadoutStrip` + `AttunementStrip`) with:

```ts
import { HeaderStrip } from "./inventory/header-strip";
// ...
const header = el.createDiv({ cls: "pc-inventory-header" });
new HeaderStrip().render(header, ctx);
```

- [ ] **Step 3: Delete the loadout component + its test**

```bash
git rm src/modules/pc/components/inventory/loadout-strip.ts
git rm tests/pc-inventory-loadout-strip.test.ts
```

- [ ] **Step 4: Drop `.pc-loadout-*` CSS**

In `src/modules/pc/styles/inventory.css`, delete all rules whose selector starts with `.pc-loadout`. Run `grep -n pc-loadout src/modules/pc/styles/inventory.css` after to confirm none remain.

- [ ] **Step 5: Rebuild CSS + run full tests**

Run: `npm run build:css && npm test`
Expected: PASS (no regression). The `loadout-strip.test.ts` deletion removes the failures that would otherwise appear.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev` (in another terminal so the watch builds; you don't need to wait for it). Open Obsidian, open a PC sheet, view the Inventory tab.

Expected: header shows attunement medallions on left, divider, coin row on right; no slot widgets; no bottom currency duplicate. (If you can't run Obsidian here, mark this step done by inspecting the rendered HTML in a unit test.)

- [ ] **Step 7: Commit**

```bash
git add src/modules/pc/components/inventory-tab.ts src/modules/pc/styles/inventory.css styles.css
git commit -m "feat(pc): replace inventory header with HeaderStrip; remove LoadoutStrip + bottom currency"
```

---

## Phase 4 — Actions tab core building blocks

### Task 12: Create CostBadge component

**Files:**
- Create: `src/modules/pc/components/actions/cost-badge.ts`
- Create: `src/modules/pc/styles/actions.css`
- Modify: `src/modules/pc/styles/index.css` (or wherever the styles index lives) to `@import "./actions.css";`
- Test: `tests/pc-actions-cost-badge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-actions-cost-badge.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderCostBadge, type ActionCost } from "../src/modules/pc/components/actions/cost-badge";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderCostBadge", () => {
  const cases: Array<[ActionCost, string, string]> = [
    ["action",       "Action",   "cost-action"],
    ["bonus-action", "Bonus",    "cost-bonus"],
    ["reaction",     "Reaction", "cost-reaction"],
    ["free",         "Free",     "cost-free"],
    ["special",      "Special",  "cost-special"],
  ];

  it.each(cases)("renders %s as label %s with class %s", (cost, label, cls) => {
    const root = mountContainer();
    renderCostBadge(root, cost);
    const badge = root.querySelector(".pc-cost-badge");
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe(label);
    expect(badge?.classList.contains(cls)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-actions-cost-badge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create CostBadge**

```ts
// src/modules/pc/components/actions/cost-badge.ts

export type ActionCost = "action" | "bonus-action" | "reaction" | "free" | "special";

const LABEL: Record<ActionCost, string> = {
  "action": "Action",
  "bonus-action": "Bonus",
  "reaction": "Reaction",
  "free": "Free",
  "special": "Special",
};

const CLS: Record<ActionCost, string> = {
  "action": "cost-action",
  "bonus-action": "cost-bonus",
  "reaction": "cost-reaction",
  "free": "cost-free",
  "special": "cost-special",
};

export function renderCostBadge(parent: HTMLElement, cost: ActionCost): HTMLElement {
  return parent.createDiv({ cls: `pc-cost-badge ${CLS[cost]}`, text: LABEL[cost] });
}
```

- [ ] **Step 4: Create actions.css with cost-badge styling**

```css
/* src/modules/pc/styles/actions.css */

.pc-cost-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  font-size: var(--pc-fs-micro);
  font-weight: 700;
  letter-spacing: var(--pc-ls-caps-md);
  text-transform: uppercase;
  color: #fff;
  line-height: var(--pc-lh-tight);
}
.pc-cost-badge.cost-action   { background: var(--pc-crimson); }
.pc-cost-badge.cost-bonus    { background: var(--pc-rarity-legendary); }
.pc-cost-badge.cost-reaction { background: var(--pc-rarity-rare); }
.pc-cost-badge.cost-free     { background: var(--pc-text-soft); }
.pc-cost-badge.cost-special  { background: var(--pc-text-muted); }
```

- [ ] **Step 5: Wire actions.css into the build**

Find the PC styles index file (likely `src/modules/pc/styles/index.css`):
```bash
ls src/modules/pc/styles/
```

If `index.css` exists, add `@import "./actions.css";` at the bottom. If not, find how `inventory.css` is included by `build-css.mjs` (which already concatenates `src/modules/pc/styles/*.css` per the script's `PC_STYLE_DIR` constant — confirm by reading `scripts/build-css.mjs` lines that iterate the dir). If concatenation is glob-based, the new file is automatically picked up.

- [ ] **Step 6: Rebuild CSS + run tests**

Run: `npm run build:css && npx vitest run tests/pc-actions-cost-badge.test.ts`
Expected: PASS for all 5 cases.

- [ ] **Step 7: Commit**

```bash
git add tests/pc-actions-cost-badge.test.ts \
  src/modules/pc/components/actions/cost-badge.ts \
  src/modules/pc/styles/actions.css \
  src/modules/pc/styles/index.css \
  styles.css
git commit -m "feat(pc): CostBadge component + actions.css with 5 cost variants"
```

---

### Task 13: Create ChargeBoxes component (empty=available, ✕=expended)

**Files:**
- Create: `src/modules/pc/components/actions/charge-boxes.ts`
- Modify: `src/modules/pc/styles/actions.css`
- Test: `tests/pc-actions-charge-boxes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-actions-charge-boxes.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderChargeBoxes } from "../src/modules/pc/components/actions/charge-boxes";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderChargeBoxes", () => {
  it("renders N total boxes; (max - used) are empty (available), 'used' have .expended", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 3, max: 7, recovery: { amount: "1d6+1", reset: "dawn" } });
    const boxes = root.querySelectorAll(".pc-charge-box");
    expect(boxes.length).toBe(7);
    const expended = root.querySelectorAll(".pc-charge-box.expended");
    expect(expended.length).toBe(3);
  });

  it("clicking an empty box calls onExpend", () => {
    const root = mountContainer();
    const onExpend = vi.fn();
    const onRestore = vi.fn();
    renderChargeBoxes(root, { used: 0, max: 3, onExpend, onRestore });
    const firstEmpty = root.querySelector(".pc-charge-box:not(.expended)") as HTMLElement;
    firstEmpty.click();
    expect(onExpend).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("clicking an expended box calls onRestore", () => {
    const root = mountContainer();
    const onExpend = vi.fn();
    const onRestore = vi.fn();
    renderChargeBoxes(root, { used: 2, max: 3, onExpend, onRestore });
    const firstExpended = root.querySelector(".pc-charge-box.expended") as HTMLElement;
    firstExpended.click();
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onExpend).not.toHaveBeenCalled();
  });

  it("renders recovery suffix when provided", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 1, recovery: { amount: "1", reset: "long" } });
    const rec = root.querySelector(".pc-charge-recovery");
    expect(rec?.textContent).toMatch(/long rest/i);
  });

  it("formats recovery 'special' as 'Special'", () => {
    const root = mountContainer();
    renderChargeBoxes(root, { used: 0, max: 1, recovery: { amount: "0", reset: "special" } });
    expect(root.querySelector(".pc-charge-recovery")?.textContent?.toLowerCase()).toContain("special");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-actions-charge-boxes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create ChargeBoxes**

```ts
// src/modules/pc/components/actions/charge-boxes.ts

export interface ChargeBoxesOpts {
  used: number;
  max: number;
  recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };
  onExpend?: () => void;
  onRestore?: () => void;
}

const RESET_LABEL: Record<"dawn" | "short" | "long" | "special", string> = {
  "dawn":    "Dawn",
  "short":   "Short Rest",
  "long":    "Long Rest",
  "special": "Special",
};

export function renderChargeBoxes(parent: HTMLElement, opts: ChargeBoxesOpts): HTMLElement {
  const wrap = parent.createDiv({ cls: "pc-charge-boxes" });
  const boxes = wrap.createDiv({ cls: "pc-charge-box-strip" });

  for (let i = 0; i < opts.max; i++) {
    const isExpended = i < opts.used;
    const box = boxes.createDiv({ cls: `pc-charge-box${isExpended ? " expended" : ""}` });
    if (isExpended) box.setAttribute("data-state", "expended");
    box.addEventListener("click", () => {
      if (isExpended) opts.onRestore?.();
      else opts.onExpend?.();
    });
  }

  if (opts.recovery) {
    const label = formatRecovery(opts.recovery);
    wrap.createDiv({ cls: "pc-charge-recovery", text: `/ ${label}` });
  }
  return wrap;
}

function formatRecovery(rec: { amount: string; reset: "dawn" | "short" | "long" | "special" }): string {
  const base = RESET_LABEL[rec.reset];
  if (rec.reset === "dawn" && rec.amount && rec.amount !== "1") {
    return `${base} ${rec.amount}`;
  }
  return base;
}
```

- [ ] **Step 4: Add CSS**

Append to `src/modules/pc/styles/actions.css`:

```css
.pc-charge-boxes {
  display: inline-flex;
  align-items: center;
  gap: var(--pc-space-2);
}
.pc-charge-box-strip {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}
.pc-charge-box {
  width: 14px;
  height: 14px;
  border: 1px solid var(--pc-text-soft);
  background: rgba(255, 255, 255, 0.45);
  border-radius: 1px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-body);
  font-weight: 700;
  color: var(--pc-crimson);
  line-height: 1;
}
.pc-charge-box.expended::before { content: "✕"; }
.pc-charge-recovery {
  font-family: var(--pc-font-serif);
  font-style: italic;
  font-size: var(--pc-fs-small);
  color: var(--pc-text-soft);
}
```

- [ ] **Step 5: Rebuild + tests**

Run: `npm run build:css && npx vitest run tests/pc-actions-charge-boxes.test.ts`
Expected: PASS for all 5 cases.

- [ ] **Step 6: Commit**

```bash
git add tests/pc-actions-charge-boxes.test.ts \
  src/modules/pc/components/actions/charge-boxes.ts \
  src/modules/pc/styles/actions.css styles.css
git commit -m "feat(pc): ChargeBoxes component (empty=available, ✕=expended) with toggle + recovery suffix"
```

---

### Task 14: Create row-expand helper

**Files:**
- Create: `src/modules/pc/components/actions/row-expand.ts`
- Test: `tests/pc-actions-row-expand.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-actions-row-expand.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { createExpandState, attachExpandToggle } from "../src/modules/pc/components/actions/row-expand";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("row-expand helper", () => {
  it("createExpandState exposes is/toggle/keys for a Set<string>", () => {
    const s = createExpandState();
    expect(s.is("a")).toBe(false);
    s.toggle("a");
    expect(s.is("a")).toBe(true);
    s.toggle("a");
    expect(s.is("a")).toBe(false);
  });

  it("attachExpandToggle calls onChange when clicked and adds .open class", () => {
    const root = mountContainer();
    const row = root.createDiv({ cls: "pc-action-row" });
    const onChange = vi.fn();
    attachExpandToggle(row, "row-1", onChange);
    expect(row.querySelector(".pc-action-caret")).toBeTruthy();

    (row as HTMLElement).click();
    expect(onChange).toHaveBeenCalledWith("row-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-actions-row-expand.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create row-expand**

```ts
// src/modules/pc/components/actions/row-expand.ts

export interface ExpandState {
  is(key: string): boolean;
  toggle(key: string): void;
  keys(): string[];
}

export function createExpandState(initial: string[] = []): ExpandState {
  const set = new Set<string>(initial);
  return {
    is: (k) => set.has(k),
    toggle: (k) => { if (set.has(k)) set.delete(k); else set.add(k); },
    keys: () => [...set],
  };
}

/** Adds a caret element and a click handler that fires `onChange(key)`. */
export function attachExpandToggle(row: HTMLElement, key: string, onChange: (key: string) => void): void {
  const caret = row.createSpan({ cls: "pc-action-caret", text: "▶" });
  caret.setAttribute("data-key", key);
  row.addEventListener("click", () => onChange(key));
}
```

- [ ] **Step 4: Add CSS**

Append to `src/modules/pc/styles/actions.css`:

```css
.pc-action-caret {
  color: var(--pc-text-muted);
  font-size: var(--pc-fs-small);
  display: inline-block;
  transition: transform 0.15s;
}
.pc-action-row.open .pc-action-caret { transform: rotate(90deg); color: var(--pc-crimson); }
.pc-action-row { cursor: pointer; }
.pc-action-row:hover { background: rgba(255, 255, 255, 0.18); }
.pc-action-expand-row {
  background: rgba(255, 255, 255, 0.22);
}
.pc-action-expand-inner {
  padding: var(--pc-space-3);
  border-left: 3px solid var(--pc-crimson);
  margin: var(--pc-space-1) 0 var(--pc-space-1) var(--pc-space-3);
}
```

- [ ] **Step 5: Rebuild + tests**

Run: `npm run build:css && npx vitest run tests/pc-actions-row-expand.test.ts`
Expected: PASS for both cases.

- [ ] **Step 6: Commit**

```bash
git add tests/pc-actions-row-expand.test.ts \
  src/modules/pc/components/actions/row-expand.ts \
  src/modules/pc/styles/actions.css styles.css
git commit -m "feat(pc): row-expand helper for Actions tables"
```

---

### Task 15: Create StandardActionsList component

**Files:**
- Create: `src/modules/pc/components/actions/standard-actions-list.ts`
- Modify: `src/modules/pc/styles/actions.css`
- Test: `tests/pc-actions-standard-list.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-actions-standard-list.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderStandardActionsList } from "../src/modules/pc/components/actions/standard-actions-list";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("StandardActionsList", () => {
  it("renders title + comma-separated 16 standard actions", () => {
    const root = mountContainer();
    renderStandardActionsList(root);
    const block = root.querySelector(".pc-standard-actions");
    expect(block).toBeTruthy();
    expect(block?.querySelector(".pc-standard-actions-title")?.textContent?.toLowerCase())
      .toContain("standard combat actions");
    const body = block?.querySelector(".pc-standard-actions-body")?.textContent ?? "";
    ["Attack", "Cast a Spell", "Dash", "Disengage", "Dodge", "Grapple", "Help", "Hide",
     "Improvise", "Influence", "Magic", "Ready", "Search", "Shove", "Study", "Utilize"]
      .forEach((a) => expect(body).toContain(a));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-actions-standard-list.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create the component**

```ts
// src/modules/pc/components/actions/standard-actions-list.ts

const STANDARD_ACTIONS = [
  "Attack", "Cast a Spell", "Dash", "Disengage", "Dodge", "Grapple",
  "Help", "Hide", "Improvise", "Influence", "Magic", "Ready",
  "Search", "Shove", "Study", "Utilize",
];

export function renderStandardActionsList(parent: HTMLElement): HTMLElement {
  const block = parent.createDiv({ cls: "pc-standard-actions" });
  block.createDiv({ cls: "pc-standard-actions-title", text: "Standard combat actions" });
  block.createDiv({ cls: "pc-standard-actions-body", text: STANDARD_ACTIONS.join(", ") + "." });
  return block;
}
```

- [ ] **Step 4: Add CSS**

Append to `src/modules/pc/styles/actions.css`:

```css
.pc-standard-actions {
  margin-top: var(--pc-space-4);
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-body);
  color: var(--pc-text-soft);
  line-height: var(--pc-lh-body);
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid var(--pc-tan-muted);
  border-radius: var(--pc-radius-sm);
  padding: var(--pc-space-2) var(--pc-space-3);
}
.pc-standard-actions-title {
  font-weight: 700;
  color: var(--pc-text-primary);
  margin-bottom: var(--pc-space-1);
}
```

- [ ] **Step 5: Rebuild + tests**

Run: `npm run build:css && npx vitest run tests/pc-actions-standard-list.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/pc-actions-standard-list.test.ts \
  src/modules/pc/components/actions/standard-actions-list.ts \
  src/modules/pc/styles/actions.css styles.css
git commit -m "feat(pc): StandardActionsList reference block"
```

---

## Phase 5 — Weapons table (replaces attack-rows.ts)

### Task 16: Create WeaponsTable component

**Files:**
- Create: `src/modules/pc/components/actions/weapons-table.ts`
- Modify: `src/modules/pc/styles/actions.css`
- Test: `tests/pc-actions-weapons-table.test.ts`

- [ ] **Step 1: Read attack-rows.ts to understand the existing data shape**

Read `src/modules/pc/components/attack-rows.ts`. Note `AttackRow` type, the `informational` field used for situational sub-line, and the existing markup classes.

- [ ] **Step 2: Write the failing test**

```ts
// tests/pc-actions-weapons-table.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { WeaponsTable } from "../src/modules/pc/components/actions/weapons-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { AttackRow } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function ctxWithAttacks(attacks: AttackRow[]): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [] } } as never,
    derived: { attacks } as never,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never, editState: null,
  };
}

describe("WeaponsTable", () => {
  it("renders one row per attack with cost badge defaulting to Action", () => {
    const root = mountContainer();
    const attacks = [{
      key: "mainhand", name: "Longsword", range: "melee 5 ft.", hit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      proficient: true, informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    const rows = root.querySelectorAll(".pc-action-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector(".pc-cost-badge.cost-action")).toBeTruthy();
    expect(rows[0].textContent).toContain("Longsword");
    expect(rows[0].textContent).toContain("+5");
    expect(rows[0].textContent).toContain("1d8 + 3");
  });

  it("renders versatile 1H + 2H damage stacked in damage cell", () => {
    const root = mountContainer();
    const attacks = [{
      key: "mainhand", name: "Longsword", range: "melee 5 ft.", hit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      versatile: { damageDice: "1d10 + 3" },
      proficient: true, informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    const dmgCell = root.querySelector(".pc-weapon-damage")?.textContent ?? "";
    expect(dmgCell).toContain("1d8 + 3");
    expect(dmgCell).toContain("1d10 + 3");
  });

  it("preserves situational sub-line when informational present", () => {
    const root = mountContainer();
    const attacks = [{
      key: "mainhand", name: "+1 Longsword", range: "melee 5 ft.", hit: 6,
      damageDice: "1d8 + 4", damageType: "slashing", proficient: true,
      informational: [{ source: "Frost Brand", value: 1, field: "weapon_attack",
        conditions: [{ kind: "vs_creature_type", value: "fire" }] }],
      slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    expect(root.querySelector(".pc-attack-row-situational")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/pc-actions-weapons-table.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create WeaponsTable**

```ts
// src/modules/pc/components/actions/weapons-table.ts
import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { AttackRow, EquipmentEntry } from "../../pc.types";
import { renderCostBadge, type ActionCost } from "./cost-badge";
import { attachExpandToggle, createExpandState, type ExpandState } from "./row-expand";
import { renderRowExpand as renderInventoryRowExpand } from "../inventory/inventory-row-expand";
import { formatSigned } from "../../utils/format-signed"; // adapt path or inline if missing

export class WeaponsTable implements SheetComponent {
  readonly type = "weapons-table";
  private expand = createExpandState();

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const attacks = ctx.derived.attacks ?? [];
    if (attacks.length === 0) return;

    const section = el.createDiv({ cls: "pc-actions-section" });
    const head = section.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ cls: "pc-actions-section-title", text: "Weapons" });
    head.createSpan({ cls: "pc-actions-section-count", text: `${attacks.length} equipped` });

    const table = section.createEl("table", { cls: "pc-actions-table pc-weapons-table" });
    const tbody = table.createEl("tbody");

    for (const a of attacks) {
      const key = `weapon:${a.key ?? a.name}`;
      const row = tbody.createEl("tr", { cls: "pc-action-row" });

      // Cost
      const costCell = row.createEl("td", { cls: "pc-weapon-cost" });
      const cost = (a.actionCost ?? "action") as ActionCost;
      renderCostBadge(costCell, cost);

      // Name + sub
      const nameCell = row.createEl("td", { cls: "pc-weapon-name" });
      nameCell.createDiv({ cls: "pc-action-row-name", text: a.name });
      if (a.subLabel) nameCell.createDiv({ cls: "pc-action-row-sub", text: a.subLabel });

      // Range
      row.createEl("td", { cls: "pc-weapon-range", text: a.range ?? "" });

      // Hit (inline italic)
      const hitCell = row.createEl("td", { cls: "pc-weapon-hit" });
      const hitTag = hitCell.createSpan({ cls: "archivist-tag-atk", text: formatSigned(a.hit) });
      hitTag.setAttribute("data-formula", String(a.hit));

      // Damage (inline italic; versatile shows both stacked)
      const dmgCell = row.createEl("td", { cls: "pc-weapon-damage" });
      dmgCell.createSpan({ cls: "archivist-tag-damage", text: a.damageDice });
      if (a.damageType) dmgCell.appendText(` ${a.damageType}`);
      if (a.versatile?.damageDice) {
        dmgCell.createEl("br");
        dmgCell.createSpan({ cls: "archivist-tag-damage", text: a.versatile.damageDice });
        dmgCell.appendText(" two-handed");
      }

      // Caret
      const caretCell = row.createEl("td", { cls: "pc-weapon-caret" });
      attachExpandToggle(caretCell, key, (k) => this.toggleAndRedraw(el, ctx, k));

      // Mark open if state is open
      if (this.expand.is(key)) {
        row.classList.add("open");
        const expandTr = tbody.createEl("tr", { cls: "pc-action-expand-row" });
        const td = expandTr.createEl("td");
        td.setAttribute("colspan", "6");
        const inner = td.createDiv({ cls: "pc-action-expand-inner" });
        // For weapons the expand reuses the same item-block as Inventory tab
        const entry = findEntryForAttack(ctx, a);
        const resolved = findResolvedForAttack(ctx, a);
        if (entry && resolved) {
          renderInventoryRowExpand(inner, { entry, resolved, app: ctx.app, editState: ctx.editState });
        } else {
          inner.createDiv({ cls: "pc-action-row-sub", text: "(no item record for this attack)" });
        }
      }

      // Situational sub-line preserved from old attack-rows.ts behavior
      const info = a.informational;
      if (info && info.length > 0) {
        const sub = tbody.createEl("tr", { cls: "pc-attack-row-situational" });
        const td = sub.createEl("td");
        td.setAttribute("colspan", "6");
        for (const i of info) {
          const line = td.createDiv({ cls: "pc-attack-row-situational-line" });
          line.createSpan({ text: `${i.source}: ${formatSigned(i.value)} ${i.field} ${conditionsToText(i.conditions)}` });
        }
      }
    }
  }

  private toggleAndRedraw(el: HTMLElement, ctx: ComponentRenderContext, key: string): void {
    this.expand.toggle(key);
    el.empty();
    this.render(el, ctx);
  }
}

// Helpers — implement near the bottom of the file or import:
function findEntryForAttack(ctx: ComponentRenderContext, a: AttackRow): EquipmentEntry | null {
  const equipment = ctx.resolved.definition.equipment ?? [];
  return equipment.find((e) => e.slot === a.slotKey) ?? null;
}
function findResolvedForAttack(ctx: ComponentRenderContext, a: AttackRow) {
  // Mirrors inventory-list resolveEquipment but keyed by slot.
  const entry = findEntryForAttack(ctx, a);
  if (!entry) return null;
  const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
  if (!slug) return null;
  const reg = ctx.core?.entities as { getBySlug?: (s: string) => { entityType?: string; data?: object } | null } | undefined;
  const found = reg?.getBySlug?.(slug);
  if (!found) return null;
  const idx = ctx.resolved.definition.equipment?.indexOf(entry) ?? -1;
  return { index: idx, entity: (found.data ?? {}) as never, entityType: found.entityType ?? null, entry };
}
function conditionsToText(conditions: { kind: string; value?: string }[]): string {
  return conditions.map((c) => c.value ? `(${c.kind}: ${c.value})` : `(${c.kind})`).join(" ");
}
```

If `formatSigned` does not exist, inline:
```ts
function formatSigned(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }
```

If `AttackRow.subLabel`, `actionCost`, `versatile`, `slotKey` don't exist on the type, add them as optional fields in `pc.types.ts` and populate them in `pc.equipment.ts:computeAttacks` (separate Step in this Task — see Step 5 below).

- [ ] **Step 5: Extend AttackRow type + computeAttacks to populate it**

In `src/modules/pc/pc.types.ts`, add to `AttackRow`:
```ts
slotKey?: "mainhand" | "offhand";
subLabel?: string;     // e.g. "martial · versatile"
actionCost?: "action" | "bonus-action" | "reaction" | "free" | "special";
versatile?: { damageDice: string };
```

In `src/modules/pc/pc.equipment.ts:computeAttacks` (around lines 537-627), populate the new fields:
```ts
const subLabel = formatWeaponSubLabel(weapon); // e.g. weapon.type + " · " + (weapon.properties?.join(", ") ?? "")
const actionCost = entry.overrides?.action ?? "action";
// ... and for versatile weapons in mainhand with empty offhand, instead of emitting a second row,
// attach `versatile: { damageDice: versatileDice }` to the original row.
```

This change has visible effects on existing tests (the versatile second-row emission goes away). Update `tests/pc-equipment-derive.test.ts` accordingly: assert the row has `versatile.damageDice`, not a second row.

- [ ] **Step 6: Add CSS**

Append to `src/modules/pc/styles/actions.css`:

```css
.pc-actions-section { margin-bottom: var(--pc-space-4); }
.pc-actions-section-head {
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-small);
  color: var(--pc-crimson);
  text-transform: uppercase;
  letter-spacing: var(--pc-ls-caps-md);
  margin-bottom: var(--pc-space-2);
  border-bottom: 1px solid var(--pc-tan-muted);
  padding-bottom: var(--pc-space-1);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.pc-actions-section-count {
  font-family: var(--pc-font-sans);
  font-size: var(--pc-fs-label);
  color: var(--pc-text-muted);
  letter-spacing: var(--pc-ls-caps-md);
  font-weight: 600;
}

.pc-actions-table { width: 100%; border-collapse: collapse; font-size: var(--pc-fs-body); }
.pc-actions-table th {
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-label);
  color: var(--pc-text-muted);
  text-align: left;
  padding: var(--pc-space-1) var(--pc-space-1);
  border-bottom: 1px solid var(--pc-tan-muted);
  text-transform: uppercase;
  letter-spacing: var(--pc-ls-caps-md);
  font-weight: 600;
}
.pc-actions-table td {
  padding: var(--pc-space-2) var(--pc-space-1);
  vertical-align: middle;
  border-bottom: 1px dashed var(--pc-tan-muted);
}
.pc-actions-table tr:last-child td { border-bottom: none; }
.pc-action-row-name {
  font-family: var(--pc-font-serif);
  font-weight: 700;
  font-size: var(--pc-fs-body);
}
.pc-action-row-sub {
  font-family: var(--pc-font-serif);
  font-style: italic;
  font-size: var(--pc-fs-small);
  color: var(--pc-text-muted);
}

/* Inline italic dice tag override inside actions tab */
.pc-actions-tab .archivist-tag-atk,
.pc-actions-tab .archivist-tag-damage,
.pc-actions-tab .archivist-tag-dice {
  background: transparent;
  border: none;
  padding: 0;
  font-family: var(--pc-font-serif);
  font-style: italic;
  font-weight: 700;
  border-bottom: 1px dotted transparent;
  cursor: pointer;
  color: var(--pc-crimson);
}
.pc-actions-tab .archivist-tag-damage { color: var(--pc-rarity-rare); }
.pc-actions-tab .archivist-tag-atk:hover    { border-bottom-color: var(--pc-crimson); }
.pc-actions-tab .archivist-tag-damage:hover { border-bottom-color: var(--pc-rarity-rare); }
```

- [ ] **Step 7: Rebuild + tests**

Run: `npm run build:css && npx vitest run tests/pc-actions-weapons-table.test.ts tests/pc-equipment-derive.test.ts`
Expected: PASS for both.

Run: `npm test` for regressions.

- [ ] **Step 8: Commit**

```bash
git add tests/pc-actions-weapons-table.test.ts tests/pc-equipment-derive.test.ts \
  src/modules/pc/components/actions/weapons-table.ts \
  src/modules/pc/pc.types.ts src/modules/pc/pc.equipment.ts \
  src/modules/pc/styles/actions.css styles.css
git commit -m "feat(pc): WeaponsTable replaces attack-rows; versatile inlined; preserves situational sub-line"
```

---

### Task 17: Wire WeaponsTable into actions-tab; delete attack-rows.ts

**Files:**
- Modify: `src/modules/pc/components/actions-tab.ts`
- Delete: `src/modules/pc/components/attack-rows.ts`
- Delete: `tests/pc-attack-rows.test.ts` (or update — check if tests cover ground we still need)

- [ ] **Step 1: Read actions-tab.ts**

Note the current composition (currently uses `AttackRows` for weapon attacks).

- [ ] **Step 2: Replace AttackRows with WeaponsTable; add `pc-actions-tab` root class**

Edit `src/modules/pc/components/actions-tab.ts`:

```ts
import { WeaponsTable } from "./actions/weapons-table";
// drop AttackRows import

// In render():
const root = el.createDiv({ cls: "pc-actions-tab" });
new WeaponsTable().render(root, ctx);
// (Items + Features + StandardActionsList come in later phases)
```

- [ ] **Step 3: Remove attack-rows.ts and its test**

```bash
git rm src/modules/pc/components/attack-rows.ts
git rm tests/pc-attack-rows.test.ts  # only if its assertions are now covered by weapons-table tests
```

If the attack-rows test covers ground not duplicated in weapons-table — port the missing assertions over before deleting.

- [ ] **Step 4: Run full tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/pc/components/actions-tab.ts
git commit -m "feat(pc): actions-tab uses WeaponsTable; remove legacy attack-rows component"
```

---

## Phase 6 — Items table

### Task 18: Add edit-state methods for charge mutations

**Files:**
- Modify: `src/modules/pc/pc.equipment-edit.ts`
- Modify: `src/modules/pc/pc.edit-state.ts`
- Test: `tests/pc-edit-state-charges.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-edit-state-charges.test.ts
import { describe, it, expect } from "vitest";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import type { Character } from "../src/modules/pc/pc.types";

function baseChar(): Character {
  return {
    name: "T", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [{
      item: "[[wand-of-fireballs]]", equipped: true, attuned: true,
      state: { charges: { current: 7, max: 7 } },
    }],
    overrides: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0, feature_uses: { "second-wind": { used: 0, max: 1 } } },
  } as Character;
}

describe("CharacterEditState — charge mutations", () => {
  it("expendCharge decrements current; restoreCharge increments", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.expendCharge(0);
    expect(c.equipment[0].state?.charges?.current).toBe(6);
    es.restoreCharge(0);
    expect(c.equipment[0].state?.charges?.current).toBe(7);
  });

  it("expendCharge clamps to 0", () => {
    const c = baseChar();
    c.equipment[0].state!.charges!.current = 0;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.expendCharge(0);
    expect(c.equipment[0].state?.charges?.current).toBe(0);
  });

  it("restoreCharge clamps to max", () => {
    const c = baseChar();
    c.equipment[0].state!.charges!.current = 7;
    const es = new CharacterEditState(c, {} as never, () => {});
    es.restoreCharge(0);
    expect(c.equipment[0].state?.charges?.current).toBe(7);
  });

  it("expendFeatureUse increments used; restore decrements", () => {
    const c = baseChar();
    const es = new CharacterEditState(c, {} as never, () => {});
    es.expendFeatureUse("second-wind");
    expect(c.state.feature_uses["second-wind"].used).toBe(1);
    es.restoreFeatureUse("second-wind");
    expect(c.state.feature_uses["second-wind"].used).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-edit-state-charges.test.ts`
Expected: FAIL — methods missing.

- [ ] **Step 3: Add mutation functions in pc.equipment-edit.ts**

Append:

```ts
export function expendCharge(character: Character, entryIdx: number): void {
  const e = character.equipment?.[entryIdx];
  const c = e?.state?.charges;
  if (!c) return;
  c.current = Math.max(0, c.current - 1);
}
export function restoreCharge(character: Character, entryIdx: number): void {
  const e = character.equipment?.[entryIdx];
  const c = e?.state?.charges;
  if (!c) return;
  c.current = Math.min(c.max, c.current + 1);
}
export function expendFeatureUse(character: Character, featureKey: string): void {
  const fu = character.state.feature_uses ?? (character.state.feature_uses = {});
  const v = fu[featureKey];
  if (!v) return;
  v.used = Math.min(v.max, v.used + 1);
}
export function restoreFeatureUse(character: Character, featureKey: string): void {
  const v = character.state.feature_uses?.[featureKey];
  if (!v) return;
  v.used = Math.max(0, v.used - 1);
}
```

- [ ] **Step 4: Wrap in CharacterEditState**

In `src/modules/pc/pc.edit-state.ts`, alongside existing `equipItem` etc.:

```ts
expendCharge(entryIdx: number): void {
  this.commit(() => eq.expendCharge(this.character, entryIdx));
}
restoreCharge(entryIdx: number): void {
  this.commit(() => eq.restoreCharge(this.character, entryIdx));
}
expendFeatureUse(featureKey: string): void {
  this.commit(() => eq.expendFeatureUse(this.character, featureKey));
}
restoreFeatureUse(featureKey: string): void {
  this.commit(() => eq.restoreFeatureUse(this.character, featureKey));
}
```

(Look at `setCurrency` near line 465 to confirm the wrapping pattern; `commit` may be named differently — match the existing pattern exactly.)

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/pc-edit-state-charges.test.ts`
Expected: PASS for all 4 cases.

Run: `npm test` for regressions.

- [ ] **Step 6: Commit**

```bash
git add tests/pc-edit-state-charges.test.ts \
  src/modules/pc/pc.equipment-edit.ts src/modules/pc/pc.edit-state.ts
git commit -m "feat(pc): edit-state mutations for item charges + feature uses"
```

---

### Task 19: Create ItemsTable component

**Files:**
- Create: `src/modules/pc/components/actions/items-table.ts`
- Test: `tests/pc-actions-items-table.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-actions-items-table.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { ItemsTable } from "../src/modules/pc/components/actions/items-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { CharacterEditState } from "../src/modules/pc/pc.edit-state";

beforeAll(() => installObsidianDomHelpers());

function ctx(opts: { entries: object[]; entityForSlug: (slug: string) => object | null; editState?: CharacterEditState | null }): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: opts.entries } } as never,
    derived: { attacks: [] } as never,
    core: { entities: { getBySlug: (slug: string) => {
      const data = opts.entityForSlug(slug);
      return data ? { entityType: "item", data } : null;
    } } } as never,
    app: {} as never,
    editState: opts.editState ?? null,
  };
}

describe("ItemsTable", () => {
  it("renders only items with a resolved ItemAction (curated or override)", () => {
    const root = mountContainer();
    new ItemsTable().render(root, ctx({
      entries: [
        { item: "[[wand-of-fireballs]]", equipped: true, attuned: true },  // curated
        { item: "[[mundane-rope]]", equipped: true },                      // not curated, no override
      ],
      entityForSlug: (slug) => slug === "wand-of-fireballs"
        ? { name: "Wand of Fireballs", rarity: "very rare", actions: { cost: "action", range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } } }
        : { name: "Hempen Rope" },
    }));
    const rows = root.querySelectorAll(".pc-action-row");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Wand of Fireballs");
  });

  it("renders charge boxes when item has charges", () => {
    const root = mountContainer();
    new ItemsTable().render(root, ctx({
      entries: [{ item: "[[wand-of-fireballs]]", equipped: true, attuned: true, state: { charges: { current: 5, max: 7 } } }],
      entityForSlug: () => ({ name: "Wand of Fireballs", rarity: "very rare", actions: { cost: "action", range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } } }),
    }));
    const boxes = root.querySelectorAll(".pc-charge-box");
    expect(boxes.length).toBe(7);
    expect(root.querySelectorAll(".pc-charge-box.expended").length).toBe(2);  // 7 - 5 = 2 used
  });

  it("clicking pip dispatches editState.expendCharge / restoreCharge", () => {
    const root = mountContainer();
    const expendCharge = vi.fn();
    const restoreCharge = vi.fn();
    new ItemsTable().render(root, ctx({
      entries: [{ item: "[[wand-of-fireballs]]", equipped: true, state: { charges: { current: 7, max: 7 } } }],
      entityForSlug: () => ({ name: "Wand of Fireballs", actions: { cost: "action", range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } } }),
      editState: { expendCharge, restoreCharge } as unknown as CharacterEditState,
    }));
    const firstEmpty = root.querySelector(".pc-charge-box:not(.expended)") as HTMLElement;
    firstEmpty.click();
    expect(expendCharge).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-actions-items-table.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create ItemsTable**

```ts
// src/modules/pc/components/actions/items-table.ts
import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { EquipmentEntry } from "../../pc.types";
import { renderCostBadge } from "./cost-badge";
import { renderChargeBoxes } from "./charge-boxes";
import { attachExpandToggle, createExpandState } from "./row-expand";
import { renderRowExpand as renderInventoryRowExpand } from "../inventory/inventory-row-expand";
import { resolveItemAction } from "../../../item/item.actions-map";

interface RowData {
  index: number;
  entry: EquipmentEntry;
  entity: { name?: string; rarity?: string; actions?: object } | null;
  entityType: string | null;
}

const RARITY_CLASS: Record<string, string> = {
  "common": "rarity-common", "uncommon": "rarity-uncommon", "rare": "rarity-rare",
  "very rare": "rarity-very-rare", "very-rare": "rarity-very-rare",
  "legendary": "rarity-legendary", "artifact": "rarity-artifact", "legacy": "rarity-legacy",
};

export class ItemsTable implements SheetComponent {
  readonly type = "items-table";
  private expand = createExpandState();

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const rows = collectRows(ctx);
    if (rows.length === 0) return;

    const section = el.createDiv({ cls: "pc-actions-section" });
    const head = section.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ cls: "pc-actions-section-title", text: "Items" });
    head.createSpan({ cls: "pc-actions-section-count", text: `${rows.length} actions` });

    const table = section.createEl("table", { cls: "pc-actions-table pc-items-table" });
    const tbody = table.createEl("tbody");

    for (const r of rows) {
      const slug = r.entry.item.match(/^\[\[(.+)\]\]$/)?.[1] ?? "";
      const action = resolveItemAction(slug, r.entry);
      if (!action) continue;

      const key = `item:${r.index}`;
      const tr = tbody.createEl("tr", { cls: "pc-action-row" });
      if (this.expand.is(key)) tr.classList.add("open");

      // Cost
      renderCostBadge(tr.createEl("td"), action.cost);

      // Name + sub
      const nameCell = tr.createEl("td");
      const nameEl = nameCell.createDiv({ cls: "pc-action-row-name", text: r.entity?.name ?? slug });
      const rcls = RARITY_CLASS[(r.entity?.rarity ?? "").toLowerCase()];
      if (rcls) nameEl.classList.add(rcls);
      const subParts: string[] = [];
      if (r.entity?.rarity) subParts.push(r.entity.rarity);
      if (r.entry.attuned) subParts.push("attuned");
      if (subParts.length) nameCell.createDiv({ cls: "pc-action-row-sub", text: subParts.join(" · ") });

      // Range
      tr.createEl("td", { text: action.range ?? "" });

      // Charges
      const chgCell = tr.createEl("td");
      const charges = r.entry.state?.charges;
      const recovery = r.entry.state?.recovery ?? action.recovery;
      if (charges) {
        renderChargeBoxes(chgCell, {
          used: charges.max - charges.current,
          max: charges.max,
          recovery,
          onExpend: () => ctx.editState?.expendCharge(r.index),
          onRestore: () => ctx.editState?.restoreCharge(r.index),
        });
      } else {
        chgCell.createSpan({ text: "—" });
      }

      // Caret
      attachExpandToggle(tr.createEl("td"), key, (k) => {
        this.expand.toggle(k);
        el.empty();
        this.render(el, ctx);
      });

      // Expand row reuses inventory-row-expand
      if (this.expand.is(key)) {
        const exp = tbody.createEl("tr", { cls: "pc-action-expand-row" });
        const td = exp.createEl("td");
        td.setAttribute("colspan", "5");
        const inner = td.createDiv({ cls: "pc-action-expand-inner" });
        renderInventoryRowExpand(inner, {
          entry: r.entry,
          resolved: { index: r.index, entity: r.entity as never, entityType: r.entityType, entry: r.entry },
          app: ctx.app, editState: ctx.editState,
        });
      }
    }
  }
}

function collectRows(ctx: ComponentRenderContext): RowData[] {
  const equipment = ctx.resolved.definition.equipment ?? [];
  return equipment
    .map((entry, index) => {
      const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
      if (!slug) return null;
      const reg = ctx.core?.entities as { getBySlug?: (s: string) => { entityType?: string; data?: object } | null } | undefined;
      const found = reg?.getBySlug?.(slug);
      const entityType = found?.entityType ?? null;
      // Skip weapons + armor — those go in the Weapons table, or surface in expand
      if (entityType === "weapon" || entityType === "armor") return null;
      // Must be equipped to surface
      if (!entry.equipped) return null;
      return { index, entry, entity: (found?.data ?? null) as RowData["entity"], entityType };
    })
    .filter((r): r is RowData => r !== null);
}
```

If `inventory-row-expand.ts` is currently a class with a `renderRowExpand` named export, confirm the export shape and adapt the import / call.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/pc-actions-items-table.test.ts`
Expected: PASS for all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add tests/pc-actions-items-table.test.ts \
  src/modules/pc/components/actions/items-table.ts
git commit -m "feat(pc): ItemsTable surfaces equipped items with resolved ItemAction; reuses inventory-row-expand"
```

---

### Task 20: Wire ItemsTable into actions-tab

**Files:**
- Modify: `src/modules/pc/components/actions-tab.ts`

- [ ] **Step 1: Compose**

```ts
import { ItemsTable } from "./actions/items-table";

const root = el.createDiv({ cls: "pc-actions-tab" });
new WeaponsTable().render(root, ctx);
new ItemsTable().render(root, ctx);
```

- [ ] **Step 2: Run full tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/pc/components/actions-tab.ts
git commit -m "feat(pc): include ItemsTable in actions-tab composition"
```

---

## Phase 7 — Features table

### Task 21: Create FeatureExpand component

**Files:**
- Create: `src/modules/pc/components/actions/feature-expand.ts`
- Test: `tests/pc-actions-feature-expand.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-actions-feature-expand.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderFeatureExpand } from "../src/modules/pc/components/actions/feature-expand";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { Feature } from "../src/shared/types/feature";

beforeAll(() => installObsidianDomHelpers());

describe("renderFeatureExpand", () => {
  it("renders feature.name as title and feature.description as body", () => {
    const root = mountContainer();
    const f: Feature = { name: "Action Surge", description: "Take one extra action this turn." };
    renderFeatureExpand(root, f, "Fighter 2");
    expect(root.querySelector(".pc-feature-expand-title")?.textContent).toBe("Action Surge");
    expect(root.querySelector(".pc-feature-expand-meta")?.textContent).toBe("Fighter 2");
    expect(root.querySelector(".pc-feature-expand-body")?.textContent).toContain("extra action");
  });

  it("renders entries as paragraphs when description absent", () => {
    const root = mountContainer();
    const f: Feature = { name: "X", entries: ["First paragraph.", "Second paragraph."] };
    renderFeatureExpand(root, f, "");
    const ps = root.querySelectorAll(".pc-feature-expand-body p");
    expect(ps.length).toBe(2);
    expect(ps[0].textContent).toBe("First paragraph.");
  });

  it("renders structured attacks under .pc-feature-expand-attacks", () => {
    const root = mountContainer();
    const f: Feature = {
      name: "Eldritch Blast",
      description: "Beams of force.",
      attacks: [{ kind: "spell-attack", name: "Beam", to_hit: "+5", damage: "1d10", damage_type: "force", range: "120 ft." }] as never,
    };
    renderFeatureExpand(root, f, "Warlock 1");
    expect(root.querySelector(".pc-feature-expand-attacks")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-actions-feature-expand.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create feature-expand.ts**

```ts
// src/modules/pc/components/actions/feature-expand.ts
import type { Feature } from "../../../../shared/types/feature";

export function renderFeatureExpand(parent: HTMLElement, feature: Feature, sourceLabel: string): HTMLElement {
  const wrap = parent.createDiv({ cls: "pc-feature-expand" });
  wrap.createDiv({ cls: "pc-feature-expand-title", text: feature.name });
  if (sourceLabel) wrap.createDiv({ cls: "pc-feature-expand-meta", text: sourceLabel });

  const body = wrap.createDiv({ cls: "pc-feature-expand-body" });
  if (feature.description) {
    body.createEl("p", { text: feature.description });
  } else if (feature.entries) {
    for (const entry of feature.entries) {
      body.createEl("p", { text: entry });
    }
  }

  if (feature.attacks && feature.attacks.length > 0) {
    const atk = wrap.createDiv({ cls: "pc-feature-expand-attacks" });
    for (const a of feature.attacks) {
      const line = atk.createDiv({ cls: "pc-feature-expand-attack-line" });
      line.createSpan({ text: `${a.name ?? "Attack"} · ${a.to_hit ?? ""} · ${a.damage ?? ""} ${a.damage_type ?? ""} · ${a.range ?? ""}` });
    }
  }
  return wrap;
}
```

If `Attack` type fields differ — check `src/shared/types/attack.ts` and adapt (`bonus`, `dice`, `type`, etc.).

- [ ] **Step 4: Add CSS**

Append to `src/modules/pc/styles/actions.css`:

```css
.pc-feature-expand-title {
  font-family: var(--pc-font-serif);
  font-weight: 700;
  font-size: var(--pc-fs-body);
  color: var(--pc-text-primary);
  margin-bottom: var(--pc-space-1);
}
.pc-feature-expand-meta {
  font-family: var(--pc-font-serif);
  font-style: italic;
  font-size: var(--pc-fs-small);
  color: var(--pc-text-muted);
  margin-bottom: var(--pc-space-2);
}
.pc-feature-expand-body {
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-body);
  color: var(--pc-text-primary);
  line-height: var(--pc-lh-body);
}
.pc-feature-expand-body p { margin: 0 0 var(--pc-space-2); }
.pc-feature-expand-attacks {
  margin-top: var(--pc-space-2);
  padding-left: var(--pc-space-2);
  border-left: 2px solid var(--pc-tan);
  font-family: var(--pc-font-serif);
  font-size: var(--pc-fs-small);
  color: var(--pc-text-soft);
}
```

- [ ] **Step 5: Rebuild + tests**

Run: `npm run build:css && npx vitest run tests/pc-actions-feature-expand.test.ts`
Expected: PASS for all 3 cases.

- [ ] **Step 6: Commit**

```bash
git add tests/pc-actions-feature-expand.test.ts \
  src/modules/pc/components/actions/feature-expand.ts \
  src/modules/pc/styles/actions.css styles.css
git commit -m "feat(pc): FeatureExpand renders feature description / entries / attacks"
```

---

### Task 22: Create FeaturesTable component

**Files:**
- Create: `src/modules/pc/components/actions/features-table.ts`
- Test: `tests/pc-actions-features-table.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-actions-features-table.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { FeaturesTable } from "../src/modules/pc/components/actions/features-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctxWithFeatures(features: object[], featureUses: Record<string, { used: number; max: number }> = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [] },
      features,
      state: { feature_uses: featureUses },
    } as never,
    derived: { attacks: [] } as never,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("FeaturesTable", () => {
  it("only renders features with action cost defined", () => {
    const root = mountContainer();
    new FeaturesTable().render(root, ctxWithFeatures([
      { id: "second-wind", name: "Second Wind", action: "bonus-action", description: "Heal 1d10+5" },
      { id: "fighting-style", name: "Fighting Style", description: "Defense" }, // no action cost
    ]));
    const rows = root.querySelectorAll(".pc-action-row");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Second Wind");
  });

  it("renders charge boxes for features with resources", () => {
    const root = mountContainer();
    new FeaturesTable().render(root, ctxWithFeatures(
      [{
        id: "second-wind", name: "Second Wind", action: "bonus-action",
        description: "Heal", resources: [{ id: "second-wind", name: "uses", max_formula: "1", reset: "short-rest" }],
      }],
      { "second-wind": { used: 1, max: 1 } },
    ));
    const boxes = root.querySelectorAll(".pc-charge-box");
    expect(boxes.length).toBe(1);
    expect(root.querySelectorAll(".pc-charge-box.expended").length).toBe(1);
  });

  it("clicking pip dispatches editState.expendFeatureUse", () => {
    const root = mountContainer();
    const expendFeatureUse = vi.fn();
    const restoreFeatureUse = vi.fn();
    new FeaturesTable().render(root, {
      ...ctxWithFeatures(
        [{
          id: "action-surge", name: "Action Surge", action: "free", description: "Extra action",
          resources: [{ id: "action-surge", name: "uses", max_formula: "1", reset: "short-rest" }],
        }],
        { "action-surge": { used: 0, max: 1 } },
      ),
      editState: { expendFeatureUse, restoreFeatureUse } as never,
    });
    const empty = root.querySelector(".pc-charge-box:not(.expended)") as HTMLElement;
    empty.click();
    expect(expendFeatureUse).toHaveBeenCalledWith("action-surge");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-actions-features-table.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create FeaturesTable**

```ts
// src/modules/pc/components/actions/features-table.ts
import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { Feature } from "../../../../shared/types/feature";
import { renderCostBadge, type ActionCost } from "./cost-badge";
import { renderChargeBoxes } from "./charge-boxes";
import { attachExpandToggle, createExpandState } from "./row-expand";
import { renderFeatureExpand } from "./feature-expand";

interface FeatureWithSource { feature: Feature; sourceLabel: string; }

const RESET_TO_RECOVERY: Record<string, "dawn" | "short" | "long" | "special"> = {
  "short-rest": "short", "long-rest": "long", "dawn": "dawn", "dusk": "long",
  "turn": "special", "round": "special", "custom": "special",
};

export class FeaturesTable implements SheetComponent {
  readonly type = "features-table";
  private expand = createExpandState();

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const rows = collectFeatures(ctx);
    if (rows.length === 0) return;

    const section = el.createDiv({ cls: "pc-actions-section" });
    const head = section.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ cls: "pc-actions-section-title", text: "Features" });
    head.createSpan({ cls: "pc-actions-section-count", text: `${rows.length} features` });

    const table = section.createEl("table", { cls: "pc-actions-table pc-features-table" });
    const tbody = table.createEl("tbody");

    for (const { feature, sourceLabel } of rows) {
      if (!feature.action || feature.action === "special") continue;  // see Task 22 note
      const key = `feature:${feature.id ?? feature.name}`;
      const tr = tbody.createEl("tr", { cls: "pc-action-row" });
      if (this.expand.is(key)) tr.classList.add("open");

      renderCostBadge(tr.createEl("td"), feature.action as ActionCost);

      const nameCell = tr.createEl("td");
      nameCell.createDiv({ cls: "pc-action-row-name", text: feature.name });
      if (sourceLabel) nameCell.createDiv({ cls: "pc-action-row-sub", text: sourceLabel });

      tr.createEl("td", { text: "self" });

      const chgCell = tr.createEl("td");
      const featureKey = feature.resources?.[0]?.id ?? feature.id;
      const fu = featureKey ? ctx.resolved.state.feature_uses?.[featureKey] : undefined;
      if (fu && featureKey) {
        const reset = feature.resources?.[0]?.reset ?? "long-rest";
        renderChargeBoxes(chgCell, {
          used: fu.used,
          max: fu.max,
          recovery: { amount: String(fu.max), reset: RESET_TO_RECOVERY[reset] ?? "special" },
          onExpend: () => ctx.editState?.expendFeatureUse(featureKey),
          onRestore: () => ctx.editState?.restoreFeatureUse(featureKey),
        });
      } else {
        chgCell.createSpan({ text: "—" });
      }

      attachExpandToggle(tr.createEl("td"), key, (k) => {
        this.expand.toggle(k);
        el.empty();
        this.render(el, ctx);
      });

      if (this.expand.is(key)) {
        const exp = tbody.createEl("tr", { cls: "pc-action-expand-row" });
        const td = exp.createEl("td");
        td.setAttribute("colspan", "5");
        const inner = td.createDiv({ cls: "pc-action-expand-inner" });
        renderFeatureExpand(inner, feature, sourceLabel);
      }
    }
  }
}

function collectFeatures(ctx: ComponentRenderContext): FeatureWithSource[] {
  const features = (ctx.resolved as unknown as { features?: { feature: Feature; sourceLabel?: string }[] | Feature[] }).features ?? [];
  // Some codebases store features as { feature, sourceLabel }[], others as Feature[] with a separate label resolver.
  // Adapt the shape below to the actual ResolvedCharacter.features layout.
  return features.map((f) => "feature" in (f as object) ? f as FeatureWithSource : { feature: f as Feature, sourceLabel: "" });
}
```

Open `src/modules/pc/pc.types.ts` and look up `ResolvedCharacter.features` to confirm the actual shape; adjust `collectFeatures` accordingly. The tests assume `resolved.features` is `Feature[]`; make `sourceLabel` derivation match the codebase's existing pattern from `features-tab.ts`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/pc-actions-features-table.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/pc-actions-features-table.test.ts \
  src/modules/pc/components/actions/features-table.ts
git commit -m "feat(pc): FeaturesTable surfaces features with action cost; pip-toggles wired to feature_uses"
```

---

### Task 23: Wire FeaturesTable + StandardActionsList into actions-tab

**Files:**
- Modify: `src/modules/pc/components/actions-tab.ts`

- [ ] **Step 1: Add to composition**

```ts
import { FeaturesTable } from "./actions/features-table";
import { renderStandardActionsList } from "./actions/standard-actions-list";

const root = el.createDiv({ cls: "pc-actions-tab" });
new WeaponsTable().render(root, ctx);
new ItemsTable().render(root, ctx);
new FeaturesTable().render(root, ctx);
renderStandardActionsList(root);
```

- [ ] **Step 2: Run full tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/pc/components/actions-tab.ts
git commit -m "feat(pc): complete actions-tab composition (Weapons + Items + Features + standard list)"
```

---

## Phase 8 — Override editor Actions panel

### Task 24: Create OverrideActionsPanel

**Files:**
- Create: `src/modules/pc/components/inventory/override-actions-panel.ts`
- Test: `tests/pc-override-actions-panel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pc-override-actions-panel.test.ts
/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderOverrideActionsPanel } from "../src/modules/pc/components/inventory/override-actions-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { EquipmentEntry } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

describe("OverrideActionsPanel", () => {
  it("renders form fields for action / range / max_charges / recovery", () => {
    const root = mountContainer();
    const entry = { item: "[[wand-of-fireballs]]", overrides: { action: "action", range: "150 ft." }, state: { charges: { current: 5, max: 7 }, recovery: { amount: "1d6+1", reset: "dawn" } } } as EquipmentEntry;
    renderOverrideActionsPanel(root, { entry, entryIndex: 0, editState: {} as never });
    expect(root.querySelector("select[data-field='action']")).toBeTruthy();
    expect(root.querySelector("input[data-field='range']")).toBeTruthy();
    expect(root.querySelector("input[data-field='max_charges']")).toBeTruthy();
    expect((root.querySelector("input[data-field='range']") as HTMLInputElement).value).toBe("150 ft.");
  });

  it("changing action select calls editState.setEquipmentOverride", () => {
    const root = mountContainer();
    const setEquipmentOverride = vi.fn();
    const entry = { item: "[[w]]" } as EquipmentEntry;
    renderOverrideActionsPanel(root, { entry, entryIndex: 0, editState: { setEquipmentOverride } as never });
    const sel = root.querySelector("select[data-field='action']") as HTMLSelectElement;
    sel.value = "bonus-action";
    sel.dispatchEvent(new Event("change"));
    expect(setEquipmentOverride).toHaveBeenCalledWith(0, expect.objectContaining({ action: "bonus-action" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pc-override-actions-panel.test.ts`
Expected: FAIL — module missing, and `editState.setEquipmentOverride` does not yet exist.

- [ ] **Step 3: Add `setEquipmentOverride` to edit-state**

In `src/modules/pc/pc.equipment-edit.ts`:
```ts
export function setEquipmentOverride(character: Character, idx: number, patch: Partial<NonNullable<EquipmentEntry["overrides"]>>): void {
  const e = character.equipment?.[idx];
  if (!e) return;
  e.overrides = { ...(e.overrides ?? {}), ...patch };
}
export function setEquipmentState(character: Character, idx: number, patch: { charges?: { current?: number; max?: number }; recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" } }): void {
  const e = character.equipment?.[idx];
  if (!e) return;
  e.state = e.state ?? {};
  if (patch.charges) {
    const cur = e.state.charges ?? { current: 0, max: 0 };
    e.state.charges = { current: patch.charges.current ?? cur.current, max: patch.charges.max ?? cur.max };
  }
  if (patch.recovery) e.state.recovery = patch.recovery;
}
```

In `src/modules/pc/pc.edit-state.ts`:
```ts
setEquipmentOverride(idx: number, patch: Partial<EquipmentEntryOverrides>): void {
  this.commit(() => eq.setEquipmentOverride(this.character, idx, patch));
}
setEquipmentState(idx: number, patch: Parameters<typeof eq.setEquipmentState>[2]): void {
  this.commit(() => eq.setEquipmentState(this.character, idx, patch));
}
```

- [ ] **Step 4: Create the panel**

```ts
// src/modules/pc/components/inventory/override-actions-panel.ts
import type { EquipmentEntry } from "../../pc.types";
import type { CharacterEditState } from "../../pc.edit-state";

export interface OverrideActionsPanelOpts {
  entry: EquipmentEntry;
  entryIndex: number;
  editState: CharacterEditState;
}

const COSTS = ["action", "bonus-action", "reaction", "free", "special"] as const;
const RESETS = ["dawn", "short", "long", "special"] as const;

export function renderOverrideActionsPanel(parent: HTMLElement, opts: OverrideActionsPanelOpts): HTMLElement {
  const wrap = parent.createDiv({ cls: "pc-override-actions" });
  wrap.createDiv({ cls: "pc-override-actions-title", text: "Action overrides" });

  const grid = wrap.createDiv({ cls: "pc-override-actions-grid" });

  // Action cost
  const costLabel = grid.createEl("label", { text: "Cost" });
  const costSel = costLabel.createEl("select");
  costSel.setAttribute("data-field", "action");
  costSel.createEl("option", { text: "—", attr: { value: "" } });
  for (const c of COSTS) costSel.createEl("option", { text: c, attr: { value: c } });
  costSel.value = opts.entry.overrides?.action ?? "";
  costSel.addEventListener("change", () => {
    opts.editState.setEquipmentOverride(opts.entryIndex, { action: (costSel.value || undefined) as never });
  });

  // Range
  const rangeLabel = grid.createEl("label", { text: "Range" });
  const rangeInput = rangeLabel.createEl("input");
  rangeInput.setAttribute("data-field", "range");
  rangeInput.setAttribute("type", "text");
  rangeInput.value = opts.entry.overrides?.range ?? "";
  rangeInput.addEventListener("change", () => {
    opts.editState.setEquipmentOverride(opts.entryIndex, { range: rangeInput.value || undefined });
  });

  // Max charges
  const maxLabel = grid.createEl("label", { text: "Max charges" });
  const maxInput = maxLabel.createEl("input");
  maxInput.setAttribute("data-field", "max_charges");
  maxInput.setAttribute("type", "number");
  maxInput.value = String(opts.entry.state?.charges?.max ?? "");
  maxInput.addEventListener("change", () => {
    opts.editState.setEquipmentState(opts.entryIndex, { charges: { max: Number(maxInput.value) || 0 } });
  });

  // Current charges
  const curLabel = grid.createEl("label", { text: "Current" });
  const curInput = curLabel.createEl("input");
  curInput.setAttribute("data-field", "current_charges");
  curInput.setAttribute("type", "number");
  curInput.value = String(opts.entry.state?.charges?.current ?? "");
  curInput.addEventListener("change", () => {
    opts.editState.setEquipmentState(opts.entryIndex, { charges: { current: Number(curInput.value) || 0 } });
  });

  // Recovery reset
  const resetLabel = grid.createEl("label", { text: "Recovery" });
  const resetSel = resetLabel.createEl("select");
  resetSel.setAttribute("data-field", "recovery_reset");
  resetSel.createEl("option", { text: "—", attr: { value: "" } });
  for (const r of RESETS) resetSel.createEl("option", { text: r, attr: { value: r } });
  resetSel.value = opts.entry.state?.recovery?.reset ?? "";
  resetSel.addEventListener("change", () => {
    if (!resetSel.value) return;
    const amount = opts.entry.state?.recovery?.amount ?? "1";
    opts.editState.setEquipmentState(opts.entryIndex, {
      recovery: { amount, reset: resetSel.value as never },
    });
  });

  // Recovery amount
  const amtLabel = grid.createEl("label", { text: "Recovery amount" });
  const amtInput = amtLabel.createEl("input");
  amtInput.setAttribute("data-field", "recovery_amount");
  amtInput.setAttribute("type", "text");
  amtInput.value = opts.entry.state?.recovery?.amount ?? "";
  amtInput.addEventListener("change", () => {
    if (!opts.entry.state?.recovery?.reset) return;
    opts.editState.setEquipmentState(opts.entryIndex, {
      recovery: { amount: amtInput.value, reset: opts.entry.state.recovery.reset },
    });
  });

  return wrap;
}
```

- [ ] **Step 5: Add CSS**

Append to `src/modules/pc/styles/inventory.css` (or `actions.css`):

```css
.pc-override-actions {
  margin-top: var(--pc-space-3);
  padding: var(--pc-space-2) var(--pc-space-3);
  border: 1px dashed var(--pc-tan-muted);
  border-radius: var(--pc-radius-sm);
  background: rgba(255, 255, 255, 0.18);
}
.pc-override-actions-title {
  font-family: var(--pc-font-serif);
  font-weight: 700;
  font-size: var(--pc-fs-small);
  color: var(--pc-crimson);
  margin-bottom: var(--pc-space-2);
}
.pc-override-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--pc-space-2);
  font-family: var(--pc-font-sans);
  font-size: var(--pc-fs-small);
}
.pc-override-actions-grid label {
  display: flex;
  flex-direction: column;
  gap: var(--pc-space-1);
  color: var(--pc-text-muted);
}
.pc-override-actions-grid input,
.pc-override-actions-grid select {
  padding: 2px 4px;
  border: 1px solid var(--pc-tan-muted);
  border-radius: var(--pc-radius-sm);
  background: rgba(255, 255, 255, 0.7);
}
```

- [ ] **Step 6: Rebuild + tests**

Run: `npm run build:css && npx vitest run tests/pc-override-actions-panel.test.ts tests/pc-edit-state-charges.test.ts`
Expected: PASS for all assertions in both files.

- [ ] **Step 7: Commit**

```bash
git add tests/pc-override-actions-panel.test.ts \
  src/modules/pc/components/inventory/override-actions-panel.ts \
  src/modules/pc/pc.equipment-edit.ts src/modules/pc/pc.edit-state.ts \
  src/modules/pc/styles/inventory.css styles.css
git commit -m "feat(pc): OverrideActionsPanel + setEquipmentOverride / setEquipmentState mutations"
```

---

### Task 25: Embed OverrideActionsPanel into inventory-row-expand

**Files:**
- Modify: `src/modules/pc/components/inventory/inventory-row-expand.ts`

- [ ] **Step 1: Read the current expand component**

Read `src/modules/pc/components/inventory/inventory-row-expand.ts` and note where its body ends. The panel goes at the end as a collapsible section.

- [ ] **Step 2: Insert the panel**

Add at the end of `renderRowExpand`:

```ts
import { renderOverrideActionsPanel } from "./override-actions-panel";

// ... existing render logic ...
if (opts.editState) {
  const details = host.createEl("details", { cls: "pc-override-actions-details" });
  details.createEl("summary", { text: "Action overrides" });
  renderOverrideActionsPanel(details, {
    entry: opts.entry,
    entryIndex: opts.resolved.index,
    editState: opts.editState,
  });
}
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS — including any inventory-row-expand snapshot tests (update snapshots if needed).

- [ ] **Step 4: Commit**

```bash
git add src/modules/pc/components/inventory/inventory-row-expand.ts
git commit -m "feat(pc): embed OverrideActionsPanel inside inventory-row-expand"
```

---

## Phase 9 — Cleanup, regressions, and polish

### Task 26: Verify regressions across existing tests

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS or only pre-existing warnings.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Build production**

Run: `npm run build`
Expected: PASS — produces working `main.js` and `styles.css`.

- [ ] **Step 5: Manual smoke test in Obsidian**

Open Obsidian with the dev build, open a character sheet that has:
- multiple equipped weapons (longsword + shortsword + handaxe ideal)
- at least one attuned magic item from the curated map (Wand of Fireballs ideal)
- at least one feature with action cost + a resource (Second Wind / Action Surge)

Verify:
- Inventory tab shows new header strip (medallions + currency)
- Inventory list still works (toggle equip)
- Actions tab shows three sections + standard combat actions list
- Click weapon dice → roll fires (requires Dice Roller community plugin)
- Click charge box → toggles ✕ state, persists across page reload
- Click row caret → expand shows item / feature details

- [ ] **Step 6: Commit any final fixes**

If any issues surfaced in Step 5, fix in this final commit:
```bash
git add -p
git commit -m "fix(pc): address regressions surfaced during smoke test"
```

If no issues, skip this step.

---

### Task 27: Final pass — drop dead CSS, confirm tokens.css deletions

- [ ] **Step 1: Grep for orphaned classes**

```bash
grep -rn "pc-loadout" src/modules/pc/ tests/ 2>/dev/null
grep -rn "pc-loadout" styles.css 2>/dev/null
```

Expected: no matches anywhere — the LoadoutStrip class deletion in Task 11 should have caught all CSS.

- [ ] **Step 2: Confirm `attack-rows` references removed**

```bash
grep -rn "attack-rows\|AttackRows" src/modules/pc/ tests/ 2>/dev/null
```

Expected: no matches outside the design spec.

- [ ] **Step 3: Final test + build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit (likely empty if all clean)**

```bash
git status   # should be clean
```

If anything was left to remove:
```bash
git add -A
git commit -m "chore(pc): final cleanup — remove orphaned loadout/attack-rows references"
```

---

## Self-review checklist

Before handing off to execution:

**Spec coverage:**
- §3 Inventory tab → Tasks 7, 8, 9, 10, 11 (tokens, currency, attunement, header-strip, wiring + delete)
- §4 Actions tab → Tasks 12-23 (cost-badge, charge-boxes, row-expand, weapons, items, features, standard list)
- §5 Curated `ItemAction` map → Tasks 4, 5, 6
- §6 Override editor Actions panel → Tasks 24, 25
- §7 Schema additions → Tasks 1, 2, 3
- §8 Action-cost resolution → covered by Tasks 5 (resolveItemAction priority) and 16 (weapons default)
- §11 Testing strategy → all unit + integration tests included; manual smoke in Task 26
- §12 Open details → "Whether weapons-row caret expansion is enabled in v1" → enabled per Task 16

**Placeholder scan:** No "TBD"; all code blocks are complete; commands include expected output. Where adapter logic depends on shape of existing code (e.g. Task 21 `collectFeatures`), the task explicitly tells the engineer to read the existing types and adapt — this is unavoidable scaffolding, not a placeholder.

**Type consistency:** `ItemAction` and `ActionCost` types used uniformly across Tasks 4, 5, 6, 12, 16, 19. `expendCharge`/`restoreCharge`/`expendFeatureUse`/`restoreFeatureUse` defined in Task 18, consumed in Tasks 19 and 22. `setEquipmentOverride` / `setEquipmentState` defined in Task 24, consumed inside the same task's panel.
