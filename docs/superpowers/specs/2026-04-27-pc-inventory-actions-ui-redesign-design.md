# PC Inventory + Actions UI Redesign — Design

> **Status:** Approved design, ready for implementation planning. Removes the 4-slot loadout UI, redesigns the inventory header into an Attunement + Currency strip, and rebuilds the Actions tab as three monster-block-style tables (Weapons / Items / Features) with action-cost badges, charge boxes, click-to-roll inline dice, and click-to-expand row details.

**Brainstorm session:** `.superpowers/brainstorm/70267-1777313400/`

**Related docs:**
- Magic-item conditional bonuses (just shipped): `docs/superpowers/specs/2026-04-26-magic-item-conditional-bonuses-design.md`
- PC system master spec: `docs/superpowers/specs/2026-04-13-player-character-system-design.md`
- SP5 equipment design: `docs/superpowers/specs/2026-04-26-sp5-equipment-design.md`

**Out of scope — deferred to Spec B (separate brainstorm):**
- Tier-2/3/4 conditional bonus evaluators (per-roll context, scene state, health state)
- Save / spell-attack / spell-DC / speed conditional tooltip surfaces
- AI-panel auto-population for conditional bonuses

---

## 1. Goals and non-goals

### Goals

1. **Remove the 4-slot loadout UI.** Mainhand / offhand / armor / shield slot widgets disappear from the inventory tab. Equip happens from the inventory list toggle only.
2. **Unified inventory header.** Attunement (left, prominent) and Currency (right, compact) live in a single parchment-bordered strip at the top of the Inventory tab. The bottom currency strip and the loadout strip both go away.
3. **Three-table Actions tab** in monster-block style: Weapons / Items / Features, each with action-cost badge, range, structured stats, charge boxes, and click-to-expand row details.
4. **Per-item charges with manual expend / restore.** Empty box = available, ✕ = expended (matches monster-block LR/LA toggle convention). No rest hooks — toggle is always manual.
5. **Click-to-roll inline dice everywhere in Actions.** Reuses the existing `inline-tag-renderer` machinery (`atk`, `dmg`, `dc`, `dice`); only the visual presentation changes (italic-serif inline, no pills) inside the actions context.
6. **Override editor adds an Actions panel** for custom items (cost / range / max_charges / current_charges / recovery) so any non-curated item can surface in the Actions tab.

### Non-goals

- **No rest system.** Charge resets are manual only. Short Rest / Long Rest / Dawn engine is parked in master-spec SP4b.
- **No spell-folding into Actions.** Spells stay on the Spells tab. Action-cost badges apply only to weapons / items / features.
- **No automatic mainhand/offhand action-cost inference.** The user does not want the UI to label slots or treat offhand as Bonus Action automatically. Default cost for any equipped weapon is `Action`; the user can override per-item if they want a TWF/Bonus row.
- **No `effect_text` field on items.** Item rows show name + range + charges; details live in the click-expanded inventory item block.
- **No description augmenter for features.** Features render their existing `description` / `entries` verbatim in the expand row, with formula tags rendered through inline-tag-renderer where present.
- **No auto-extraction parser for charge data from prose.** Curated map + manual override only.

---

## 2. Investigation summary — why the slot UI can be removed safely

The `slot` field on `EquipmentEntry` is **load-bearing for the engine** but **not for the UI**. Every consumer of slot data was traced:

| Consumer | File:line | Slot dependency |
|---|---|---|
| AC computation | `pc.equipment.ts:316–386` | Reads `equippedSlots.armor` / `.shield` / `.mainhand` (suppress shield if 2H) |
| Attack rows | `pc.equipment.ts:537–627` | Iterates mainhand/offhand to produce attack rows; emits versatile-2H variant when offhand empty |
| Two-handed conflict | `pc.equipment.ts:307–311` | Warns if shield + 2H mainhand both equipped |
| Tier-1 conditions | `item.conditions.ts:24–34` | `no_armor`, `no_shield`, `wielding_two_handed` read `equippedSlots` |
| Recalc AC path | `pc.recalc.ts:436–455` | Branches "armored vs unarmored" on `equippedSlots.armor` presence |

`equipItem()` (`pc.equipment-edit.ts:117–140`) already auto-derives the slot via `resolveSlot()` from the entity type. **Removing the loadout UI requires no engine change** — slots continue to be assigned automatically when items are equipped from the list toggle.

---

## 3. Inventory tab — new structure

```
┌─ Inventory ──────────────────────────────────────────────────────────┐
│ ┌─ Header strip ────────────────────────────────────────────────┐   │
│ │ ATTUNED 2/3   ◯ ◯ ◯       │  PP 2  GP 147  EP 0  SP 35  CP 12 │   │
│ │            Cloak  Ring  empty                                 │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ [toolbar / filters / search]                                         │
│                                                                      │
│ ┌─ List ─────────────────────────────────────────────────────────┐  │
│ │ [✓] Longsword  Equipped · mainhand           1d8 + STR        │  │
│ │ [✓] Chain Mail Equipped · armor              AC 16            │  │
│ │ [✓] Cloak of Protection  Attuned             +1 AC, +1 saves  │  │
│ │ [ ] Potion of Healing                        2d4 + 2          │  │
│ └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.1 Header strip

Single parchment-bordered row replacing both `LoadoutStrip` and the bottom-of-tab `CurrencyStrip`.

**Attunement (left):**
- Section label "ATTUNED" in crimson serif caps + count "2 / 3" beneath
- 3 medallion cells (or N if `attunement_limit` override is set)
- Each cell: 68px circular medallion + truncated item name (max 2 lines, no ellipsis when wrapping is possible)
- **Rarity drives medallion border + glyph color**, reusing existing `--pc-rarity-*` tokens (uncommon green, rare blue, very-rare purple, legendary amber, artifact crimson). No "Uncommon" caption text — color alone communicates rarity.
- Empty slot: dashed border, italic "empty slot" label
- Click handlers unchanged: empty → `AttunePickerModal`, filled → unattune flow

**Divider (1px tan-muted, full-height)**

**Currency (right, compact):**
- 5 coins in a row, each: colored denom letter (PP / GP / EP / SP / CP) above value
- No "Wealth" label, no sub-caption
- Coin colors (new tokens, in harmony with existing palette):
  ```
  --pc-coin-pp: #1f3f7a   (= --pc-rarity-rare)
  --pc-coin-gp: #a3590a   (= --pc-rarity-legendary)
  --pc-coin-ep: #6b6f2a   (new — olive electrum)
  --pc-coin-sp: #4a5a66   (new — steel slate)
  --pc-coin-cp: #8a3d1f   (new — copper rust)
  ```
- Edit interaction unchanged: click value → in-place numeric input (existing `setCurrency` mutation)

### 3.2 Files

| File | Action |
|---|---|
| `src/modules/pc/components/inventory/loadout-strip.ts` | **Delete** (~83 lines) |
| `src/modules/pc/components/inventory/attunement-strip.ts` | **Redesign** (medallion sizing, rarity color, name beneath, empty-slot styling) |
| `src/modules/pc/components/inventory/currency-strip.ts` | **Redesign** (V2 coin layout, colored denom letters, drop "Wealth" label) |
| `src/modules/pc/components/inventory/header-strip.ts` | **New** — composes `AttunementStrip` + divider + `CurrencyStrip` inside the parchment box |
| `src/modules/pc/components/inventory-tab.ts` | Replace header section: drop loadout, drop bottom currency-strip, render `HeaderStrip` once at the top |
| `src/modules/pc/styles/inventory.css` | Drop all `.pc-loadout-*` rules; add `.pc-header-strip` rules + redesigned `.pc-attune-*` and `.pc-currency-*` |
| `src/modules/pc/styles/tokens.css` | Add `--pc-coin-{pp,gp,ep,sp,cp}` variables |

The inventory list (`inventory-list.ts`, `inventory-row.ts`) is unchanged. The existing toggle in `inventory-row.ts:38–67` becomes the sole equip surface. Subtitle continues to display the auto-derived slot ("Equipped · mainhand") because that information is still useful when scanning the list.

`AttunePickerModal`, `AttuneConflictModal`, attune-popover, `unequipWithAttunementCheck` — all unchanged.

---

## 4. Actions tab — three-table layout

```
┌─ Actions ──────────────────────────────────────────────────────────────┐
│  WEAPONS · 3 equipped                                                  │
│  Cost   Weapon                Range          Hit    Damage          ▶ │
│  ┌────┬─────────────────────┬──────────────┬──────┬─────────────────┬─┤
│  │Act │ Longsword           │ melee 5 ft.  │ +5   │ 1d8 + 3 slash  │▶│
│  │    │ martial · versatile │              │      │ 1d10 + 3  2H   │ │
│  ├────┼─────────────────────┼──────────────┼──────┼─────────────────┼─┤
│  │Act │ Shortsword          │ melee 5 ft.  │ +5   │ 1d6 piercing   │▶│
│  │    │ martial · light     │              │      │                 │ │
│                                                                        │
│  ITEMS · 2 actions                                                     │
│  Cost   Item                 Range          Charges                 ▶ │
│  ├────┼─────────────────────┼──────────────┼─────────────────────────┤ │
│  │Act │ Wand of Fireballs   │ 150 ft.      │ ☐ ☐ ☐ ☐ ✕ ✕ ✕ / Dawn  │▼│
│  │    │ very rare · attuned │              │                         │ │
│  │    └── full inventory item block expanded here ─────────────────┘  │
│  │                                                                    │
│  FEATURES · 3 features                                                 │
│  ...                                                                   │
│                                                                        │
│  STANDARD COMBAT ACTIONS                                               │
│  Attack, Cast a Spell, Dash, Disengage, Dodge, Grapple, Help, Hide,    │
│  Improvise, Influence, Magic, Ready, Search, Shove, Study, Utilize.    │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Cost badge

Compact pill at the start of every row. Single shared component.

| Cost | Label | Color (token) |
|---|---|---|
| `action` | "Action" | `--pc-crimson` (#922610) |
| `bonus-action` | "Bonus" | `--pc-rarity-legendary` (#a3590a) |
| `reaction` | "Reaction" | `--pc-rarity-rare` (#1f3f7a) |
| `free` | "Free" | `--pc-text-soft` (#6b5e4b) |
| `special` | "Special" | `--pc-text-muted` (#8a7a6a) |

### 4.2 Inline dice rendering — reuse, don't replace

The existing `inline-tag-renderer.ts` already handles `atk`, `dmg`, `dc`, `dice`, `mod`, `roll`, `d` with click-to-roll via `rollDiceWithRender(api, notation)`. The current pill style is wrong for the actions context — we want monster-block italic-serif inline.

A parent class **`.pc-actions-tab`** applies a contextual override in `actions.css`:

```css
.pc-actions-tab .archivist-tag-atk,
.pc-actions-tab .archivist-tag-damage,
.pc-actions-tab .archivist-tag-dice,
.pc-actions-tab .archivist-tag-dc {
  background: transparent;
  border: none;
  padding: 0;
  font-family: var(--pc-font-serif);
  font-style: italic;
  font-weight: 700;
  border-bottom: 1px dotted transparent;
  cursor: pointer;
}
.pc-actions-tab .archivist-tag-atk    { color: var(--pc-crimson); }
.pc-actions-tab .archivist-tag-damage { color: var(--pc-rarity-rare); }
.pc-actions-tab .archivist-tag-dc     { color: var(--pc-text-soft); cursor: default; font-style: normal; }
.pc-actions-tab .archivist-tag-atk:hover { border-bottom-color: var(--pc-crimson); }
.pc-actions-tab .archivist-tag-damage:hover { border-bottom-color: var(--pc-rarity-rare); }
```

Zero changes to `inline-tag-renderer.ts` itself.

### 4.3 Charge boxes

| State | Visual | Click action |
|---|---|---|
| Available | empty 14×14 square, parchment background | `expendCharge` / `expendFeatureUse` (decrement available) |
| Expended | same square, ✕ glyph in crimson serif | `restoreCharge` / `restoreFeatureUse` (increment available) |

Recovery text appears immediately after the box strip in italic serif: `/ Long Rest`, `/ Dawn 1d6+1`, `/ Special`.

### 4.4 Weapons table

**Source:** existing `derived.attacks` from `pc.equipment.ts:537–627`. No engine change.

**Columns:** `Cost | Weapon (+ sub-line) | Range | Hit | Damage | ▶`

- **Cost:** comes from `entry.overrides.action`, else `"action"` default.
- **Weapon name:** rarity-color when applicable; sub-line shows weapon category + properties only (`"martial · versatile"` — no slot label).
- **Range:** `"melee 5 ft."`, `"5 ft. or thrown (20/60)"`, etc.
- **Hit:** inline italic dice tag rendering `+N` from existing attack data.
- **Damage:** inline italic dice tag for damage dice + type. **Versatile weapons** show 1H damage on line 1 and 2H damage on line 2 inside the same cell when offhand is empty (replaces the current separate-row versatile variant emission).
- **Caret:** click → expand row showing the same item block component as inventory tab (reuses `inventory-row-expand`).
- **Situational sub-line preserved:** existing attack-row situational rendering for Tier-2-4 informational bonuses (`attack-rows.ts:34–42`) carries over verbatim into the new weapons-table component.

### 4.5 Items table

**Source:** equipped equipment entries whose entity type is not `weapon`/`armor` AND that have a resolved `ItemAction` (curated map or override). Magic weapons with their own activation actions (e.g. *Flame Tongue* ignite, *Frost Brand* extinguish) surface only via the weapon's expand row to avoid duplication; the inventory-row-expand component is enriched (small, follow-on work) to render any `ItemAction` it carries.

**Columns:** `Cost | Item (+ sub-line) | Range | Charges | ▶`

- **Cost:** `entry.overrides.action` → curated `ItemAction.cost` → row not surfaced.
- **Item name:** rarity-color from entity; sub-line shows rarity + attunement state (`"very rare · attuned"`).
- **Range:** `entry.overrides.range` → curated `ItemAction.range` → empty.
- **Charges:** if `entry.state.charges` present, render box strip; else dash. Recovery text from `entry.state.recovery`.
- **Caret:** click → expand reusing the **same `inventory-row-expand` component** that renders in the Inventory tab. Single source of truth for item detail rendering.

### 4.6 Features table

**Source:** all features (from `derived.features` / class+race resolution) where `feature.action` is one of the cost values.

**Columns:** `Cost | Feature (+ source) | Range | Charges | ▶`

- **Cost:** `feature.action` directly.
- **Feature name + sub-line:** sub-line shows source class + level (`"Fighter 1"`).
- **Range:** convention: `"self"` unless feature schema gains a range field later.
- **Charges:** if `feature.resources` is non-empty, render boxes wired to `state.feature_uses[key]` where `key = feature.resources[0].id`. v1 surfaces only the first resource as pips in the row; multi-resource features show the rest inside the expand panel. Recovery text comes from `feature.resources[0].reset`.
- **Caret:** click → expand row renders `feature.description` and/or `feature.entries[]` joined as paragraphs, run through `inline-tag-renderer` so any `[[atk:..]]`, `[[dmg:..]]`, `[[dc:..]]` tags become clickable. Structured `feature.attacks[]`, when present, render as a small table inside the expand block.

### 4.7 Standard combat actions

Static reference list at the bottom of the Actions tab. Always visible (per Q8). Single block: title in serif bold, comma-separated list in italic serif body. Lists the 16 standard actions (Attack, Cast a Spell, Dash, Disengage, Dodge, Grapple, Help, Hide, Improvise, Influence, Magic, Ready, Search, Shove, Study, Utilize).

### 4.8 Files

| File | Action |
|---|---|
| `src/modules/pc/components/actions-tab.ts` | **Rewrite** — composes the four sub-components |
| `src/modules/pc/components/attack-rows.ts` | **Replace** with `actions/weapons-table.ts` |
| `src/modules/pc/components/actions/cost-badge.ts` | **New** — `<span class="pc-cost-badge cost-{action,bonus,reaction,free,special}">` |
| `src/modules/pc/components/actions/charge-boxes.ts` | **New** — pip strip + toggle handler (parameterized for items vs feature_uses) |
| `src/modules/pc/components/actions/weapons-table.ts` | **New** — table over `derived.attacks` |
| `src/modules/pc/components/actions/items-table.ts` | **New** — table over equipped items with resolved `ItemAction` |
| `src/modules/pc/components/actions/features-table.ts` | **New** — table over features with action cost |
| `src/modules/pc/components/actions/row-expand.ts` | **New** — shared expand-state helper, click-to-expand/collapse, dispatches to inventory-row-expand for weapons/items or feature-expand for features |
| `src/modules/pc/components/actions/feature-expand.ts` | **New** — renders `feature.description` / `entries` / `attacks` inside the expand row |
| `src/modules/pc/components/actions/standard-actions-list.ts` | **New** — static reference list |
| `src/modules/pc/styles/actions.css` | **New** — table layout, cost-badge, charge-box, italic-dice context override |
| `src/modules/pc/pc.equipment-edit.ts` | **Extend** — add `expendCharge(idx)`, `restoreCharge(idx)`, `expendFeatureUse(featureId)`, `restoreFeatureUse(featureId)` |

---

## 5. Curated `ItemAction` map

```ts
// src/modules/item/item.actions-map.ts (NEW)

export type ItemAction = {
  cost: "action" | "bonus-action" | "reaction" | "free" | "special";
  range?: string;
  max_charges?: number;
  recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };  // matches existing entry.state.recovery shape
};

export const ITEM_ACTIONS: Record<string, ItemAction> = {
  "wand-of-fireballs":    { cost: "action",       range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "boots-of-speed":       { cost: "bonus-action", range: "self",    max_charges: 1, recovery: { amount: "1",     reset: "long" } },
  "ring-of-three-wishes": { cost: "action",       range: "self",    max_charges: 3, recovery: { amount: "0",     reset: "special" } },
  // ~30 canonical SRD chargeable / activated items
};
```

**Augmenter integration** (`src/modules/item/item.augmenter.ts`):
After the existing conditional-bonus pass, a new pass copies `ITEM_ACTIONS[slug]` onto the augmented entity as `actions: ItemAction`. The PC sheet reads the augmented field at render time; no character-data migration.

**Resolution priority** (`actions/items-table.ts`):
1. `entry.overrides.action` (full per-character override of cost, with optional range)
2. Augmented entity's `actions` (curated map)
3. Row not shown

---

## 6. Override editor — Actions panel

Inside `inventory-row-expand.ts` (the same expand component used for the Inventory tab and the Actions Items table), a new collapsible panel "Actions":

| UI | Field | Writes to |
|---|---|---|
| `<select>` of 5 cost values | Action cost | `entry.overrides.action` |
| Text input | Range | `entry.overrides.range` |
| Number | Max charges | `entry.state.charges.max` |
| Number (defaults to max) | Current charges | `entry.state.charges.current` |
| Reset enum + text amount | Recovery | `entry.state.recovery` |

When the slug matches `ITEM_ACTIONS`, fields pre-fill from the curated defaults but stay editable. When the slug isn't curated (custom item, homebrew), all fields start empty.

Schema additions to `equipmentEntryOverridesSchema` (`pc.schema.ts:19–25`):
```ts
action: z.enum(["action","bonus-action","reaction","free","special"]).optional(),
range:  z.string().optional(),
```

The existing `equipmentEntryStateSchema.recovery.reset` enum (`pc.schema.ts:32-35`) is `"dawn" | "short" | "long"`. **Extend** to include `"special"` for one-off / non-resting items (e.g. *Ring of Three Wishes*). Display formatter maps `"special"` → `"Special"`. `charges` itself needs no change.

---

## 7. Schema additions

```ts
// pc.schema.ts

const equipmentEntryOverridesSchema = z.object({
  name: z.string().optional(),
  bonus: z.number().int().optional(),
  damage_bonus: z.number().int().optional(),
  extra_damage: z.string().optional(),
  ac_bonus: z.number().int().optional(),
  // NEW:
  action: z.enum(["action","bonus-action","reaction","free","special"]).optional(),
  range:  z.string().optional(),
}).strict();

const characterStateSchema = z.object({
  // ... existing fields ...
  // NEW:
  feature_uses: z.record(z.string(), z.object({
    used: z.number().int().nonnegative(),
    max:  z.number().int().nonnegative(),
  })).default({}),
});

// Existing equipmentEntryStateSchema (pc.schema.ts:27-42) — extend reset enum:
const equipmentEntryStateSchema = z.object({
  charges: z.object({ current: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).optional(),
  recovery: z.object({
    amount: z.string(),
    reset: z.enum(["dawn", "short", "long", "special"]),  // "special" added
  }).optional(),
  depletion_risk: /* unchanged */,
}).strict();
```

Both are strictly additive. Existing characters parse unchanged because both fields default cleanly (the override is optional; the record defaults to `{}`).

---

## 8. Action-cost resolution rules

| Source | Cost field | Default if missing |
|---|---|---|
| Equipped weapon | `entry.overrides.action` → `"action"` | `"action"` |
| Equipped item (with `ItemAction` resolved) | `entry.overrides.action` → augmented `actions.cost` | row hidden |
| Feature | `feature.action` | row hidden |

The user's explicit choice (Q6) is that we never auto-infer Bonus Action from "offhand" slot. Slot data still drives AC and Tier-1 conditions; it does not drive Action-cost categorization. Users who want a TWF / Bonus Attack row override the offhand weapon's `entry.overrides.action = "bonus-action"`.

---

## 9. Build sequence

Implementation plan ordering is the writing-plans skill's job; the buckets below are guidance.

1. **Schema + types** — overrides.action, overrides.range, state.feature_uses
2. **Curated `ItemAction` map** + augmenter wiring (so SRD bundle ships with `actions`)
3. **Inventory header** — delete LoadoutStrip; redesign AttunementStrip + CurrencyStrip; add HeaderStrip; coin tokens; CSS
4. **Actions tab core** — cost-badge, charge-boxes, row-expand, weapons-table (replaces attack-rows.ts), standard-actions-list
5. **Items-table** — wire `ItemAction` resolution; expand row reuses inventory-row-expand
6. **Features-table** — `feature_uses` charge mutations; expand row renders description/entries through inline-tag-renderer; structured `attacks[]` rendered inside expand
7. **Override editor** — Actions panel inside inventory-row-expand
8. **Style cleanup + polish** — drop dead CSS (`.pc-loadout-*`); dotted-underline-on-hover dice tags in `.pc-actions-tab`

---

## 10. Migration

- Existing characters with `entry.slot` set: nothing breaks. The slot field stays in JSON, just isn't surfaced via UI. AC, attack iteration, two-handed conflict, Tier-1 conditions all keep reading it.
- Existing characters with `entry.state.charges` populated: surfaces as pips immediately (the field has been in the schema unused).
- Existing characters with `state.feature_uses` absent: defaults to `{}` per Zod schema.
- No data migration script required.

---

## 11. Testing strategy

**Unit**
- `item.actions-map` resolution (curated → augmented entity).
- Action-cost priority (`overrides.action > curated > weapon-default-action > unsurfaced`).
- Charge-box mutations: `expendCharge`, `restoreCharge`, `expendFeatureUse`, `restoreFeatureUse`.
- Cost-badge rendering for all 5 cost values.

**Integration**
- Pip click round-trip: empty → expended → restored → state mutation persists to character JSON.
- Items-table expand renders identical detail to Inventory-tab expand for the same item (proves single source of truth).
- Click inline dice → `rollDiceWithRender(api, notation)` invoked with correct notation.
- Versatile longsword in mainhand with empty offhand → both 1H and 2H damage rendered in the single weapons-row's damage cell.

**Visual regression**
- AC tooltip "Situational" divider still renders correctly (Tier-1 conditional bonuses unaffected).
- Attack-row situational sub-line still renders for Tier-2-4 informational weapon bonuses.
- Inventory-row appearance unchanged for non-equipped items.

**Manual**
- Existing test characters in `test-vault/` exercise the redesigned tabs end-to-end.

---

## 12. Open details (non-blocking)

These are decisions deferred to implementation that don't affect the spec:
- Specific list of ~30 SRD items to seed `ITEM_ACTIONS`. Author iteratively as items are encountered.
- Whether weapons-row caret expansion is enabled in v1 (lower priority than items / features). Default: yes, for parity.
- Whether the standard-actions list becomes collapsible later (Q8 says "always visible at the bottom"; collapsibility is polish).
- Whether `feature.range` is added to the schema (not needed for v1 — fall back to `"self"`).
