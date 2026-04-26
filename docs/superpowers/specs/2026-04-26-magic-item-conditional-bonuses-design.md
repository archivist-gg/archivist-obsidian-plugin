# Magic-Item Conditional Bonuses — Design

> **Status:** Approved design, ready for implementation planning. Captures all conditional-bonus data from the SRD into the schema; recalc evaluates Tier 1 today and stores Tiers 2–4 verbatim for future evaluators. Pure data, no `active` toggle, no manual override.

**Supersedes:** §1 of `docs/superpowers/specs/2026-04-26-magic-item-mechanics-deferred-design.md` (the prior 3-alternative deferral). That document remains the source of intent for §2 (AI-panel auto-population), which is still deferred.

**Related docs:**
- Magic-item augmentation pipeline: commits `887db0b` (initial structured fields) and `8dca1ec` (unarmored AC bonus stacking).
- PC system master spec: `docs/superpowers/specs/2026-04-13-player-character-system-design.md`.
- SP5 inventory redesign plan: `docs/superpowers/plans/2026-04-26-pc-inventory-redesign.md`.

---

## 1. Goals and non-goals

### Goals

1. **Single source of truth for bonus application.** Every consumer of `item.bonuses.*` reads through one shared accessor that handles both the unconditional (flat number) and conditional (`{ value, when }`) forms.
2. **Capture every conditional bonus the SRD prose describes.** Even conditions the recalc layer cannot yet evaluate (per-roll context, scene state, health state) are stored in the schema as typed `Condition` objects so a future evaluator can light them up without touching data.
3. **Surface unevaluable conditions to the player as informational tooltip annotations.** Headline numbers (AC, attack to-hit, damage, save bonus, …) only change for conditions the engine is sure about. Everything else shows up in a "Situational" section in the relevant tooltip.
4. **Backwards compatible.** Existing flat-number `bonuses.ac: 2` data stays valid. No migration needed.

### Non-goals

- **No `active` field on `EquipmentEntry`.** Recalc never speculates; the player never has to remember to toggle anything. This was an alternative in the deferred spec; it is intentionally rejected.
- **No per-roll evaluation in this phase.** Tier 2 conditions (vs creature type, vs ranged, on weapon-property attacks) are stored but always return `informational`. They light up when the attack-row pass gains a per-roll context, which is its own future feature.
- **No scene-state model.** Tier 3 conditions (lighting, underwater, movement state) are stored but always informational.
- **No status/condition tracking.** Tier 4 (grappled, prone, bloodied, concentrating) stored but always informational.
- **AI-panel item generation with conditions.** Out of scope; tracked in §2 of the predecessor deferral spec.
- **Conditional `static` ability scores, conditional `resist`/`immune` arrays.** Not modeled. No SRD item motivates this today; would warrant its own spec.

---

## 2. Architecture — single source of truth

```
┌──────────────────────┐    ┌──────────────────────────┐    ┌─────────────────────────┐
│ 5etools / SRD JSON   │ →  │ augment-srd-magicitems   │ →  │ Compendium .md          │
│ (raw prose)          │    │ (curated map + regex     │    │ (frontmatter w/         │
│                      │    │  + raw fallback)         │    │  bonuses.*: { value,    │
│                      │    │                          │    │  when: [...] })         │
└──────────────────────┘    └──────────────────────────┘    └─────────────┬───────────┘
                                                                          │
                                                            parsed via itemEntitySchema
                                                                          ▼
                                                            ┌─────────────────────────┐
                                                            │ ItemEntity              │
                                                            │ bonuses.<field>:        │
                                                            │   number |              │
                                                            │   ConditionalBonus      │
                                                            └─────────────┬───────────┘
                                                                          │
                                              equipped + attuned          │
                                                                          ▼
                       ┌────────────────────────────────────────────────────────┐
                       │ pc.equipment.ts — every bonus read goes through:       │
                       │                                                          │
                       │   readNumericBonus(raw, ctx) →                          │
                       │     'applied' | 'skipped' | 'informational'             │
                       │                                                          │
                       │   evaluateCondition(cond, ctx) is the only switch       │
                       │   over Condition.kind in the codebase.                  │
                       └─────────────┬──────────────────────────────┬─────────────┘
                                     │ applied: number bucket       │ informational[] bucket
                                     ▼                              ▼
                       ┌────────────────────────────────┐  ┌──────────────────────────────┐
                       │ Existing AppliedBonuses fields │  │ AppliedBonuses.informational  │
                       │ (save_bonus, spell_attack,     │  │ (per-field) +                 │
                       │  speed_bonuses, etc.)          │  │ AttackRow.informational       │
                       │ + AC breakdown, attack rows    │  │ (per-weapon)                  │
                       └─────────────┬──────────────────┘  └─────────────┬─────────────────┘
                                     ▼                                    ▼
                          Headline numbers unchanged          UI tooltips render a
                          for unconditional and Tier-1-       "Situational" section
                          true bonuses                         using conditionToText
```

**Three-outcome model.** Every numeric bonus read produces exactly one of:

| Outcome | When | Effect |
|---|---|---|
| `applied` | flat number, or `ConditionalBonus` whose `when[]` evaluates fully `true` | adds to headline number; appears in normal breakdown |
| `skipped` | `ConditionalBonus` whose `when[]` evaluates `false` (Tier 1 known false) | dropped silently; no UI |
| `informational` | `when[]` contains any condition that returns `informational` (Tier 2–4 + `raw`) | does NOT change headline; appears in tooltip "Situational" section |

Tier 1-false skips silently rather than producing an annotation — engine certainty doesn't need to clutter the tooltip. Open to revisit later.

**Single-source-of-truth invariants.**

| Concept | Lives in exactly one place |
|---|---|
| Condition evaluation (`Condition` → outcome) | `evaluateCondition` in `src/modules/item/item.conditions.ts` |
| Condition AND-combine | `evaluateConditions` in same file |
| Bonus shape parsing (number vs `{value, when}`) | `readNumericBonus` in `src/modules/item/item.bonuses.ts` |
| Schema definition (Condition union, ConditionalBonus) | `src/modules/item/item.schema.ts` (Zod) + matching types in `item.types.ts` |
| Augmenter writes | `scripts/augment-srd-magicitems.ts` (with `scripts/augment/condition-map.ts` and `scripts/augment/condition-extractor.ts`) |
| Condition-to-text rendering | `conditionToText`/`conditionsToText` in `src/modules/item/item.conditions.ts` |
| UI rendering of informational rows | One shared "situational row" CSS class (`.pc-ac-tooltip-row--situational`, `.pc-attack-row-situational`, `.pc-inventory-row-situational-bonuses`); each surface uses it |

When a Tier-2 evaluator lights up later (e.g., `vs_creature_type` becomes evaluable inside the attack-row pass), it is one edit to `evaluateCondition` — no other file changes.

---

## 3. Schema

### 3.1 The `Condition` discriminated union

Four tiers plus a `raw` escape hatch and an `any_of` recursive wrapper:

```ts
// src/modules/item/item.conditions.types.ts

// Tier 1 — recalc-evaluable from derived character/equipment state.
type Tier1Condition =
  | { kind: "no_armor" }
  | { kind: "no_shield" }
  | { kind: "wielding_two_handed" }
  | { kind: "is_class"; value: string }       // class slug
  | { kind: "is_race"; value: string }        // race slug
  | { kind: "is_subclass"; value: string };   // subclass slug

// Tier 2 — per-attack/per-roll context (stored, always informational in v1).
type Tier2Condition =
  | { kind: "vs_creature_type"; value: string }            // undead, fiend, …
  | { kind: "vs_attack_type"; value: "ranged" | "melee" }  // Arrow-Catching Shield
  | { kind: "on_attack_type"; value: "ranged" | "melee" }  // Bracers of Archery
  | { kind: "with_weapon_property"; value: string }        // longbow, finesse, …
  | { kind: "vs_spell_save" };

// Tier 3 — environmental / scene state (stored, always informational in v1).
type Tier3Condition =
  | { kind: "lighting"; value: "dim" | "bright" | "daylight" | "darkness" }
  | { kind: "underwater" }
  | { kind: "movement_state"; value: "flying" | "swimming" | "climbing" | "mounted" };

// Tier 4 — health / status state (stored, always informational in v1).
type Tier4Condition =
  | { kind: "has_condition"; value: string }   // grappled, prone, frightened, …
  | { kind: "is_concentrating" }
  | { kind: "bloodied" };

// Augmenter fallback for prose it could not structure cleanly.
type FreeTextCondition = { kind: "raw"; text: string };

// Recursive OR. AND is implicit in the parent `when[]`.
type AnyOfCondition = { kind: "any_of"; conditions: Condition[] };

export type Condition =
  | Tier1Condition
  | Tier2Condition
  | Tier3Condition
  | Tier4Condition
  | FreeTextCondition
  | AnyOfCondition;
```

The `raw` arm guarantees that no condition language detected in prose is ever lost. A future audit can promote `raw` entries into typed kinds without touching data outside the augmenter.

### 3.2 `ConditionalBonus` shape

```ts
export interface ConditionalBonus {
  value: number;
  when: Condition[];   // implicit AND; empty array equivalent to flat number
}
```

The augmenter normalizes empty `when[]` to flat number, so post-augmentation data never carries `{ value: N, when: [] }`.

### 3.3 Schema changes — fields that gain conditional form

In `src/modules/item/item.schema.ts`, the following `bonuses.*` fields change from `z.number().optional()` to `numberOrConditional.optional()`:

| Field | Motivating SRD example |
|---|---|
| `bonuses.ac` | Bracers of Defense, Arrow-Catching Shield, Dragon Masks |
| `bonuses.saving_throws` | (no SRD condition today; uniform shape) |
| `bonuses.spell_attack` | (uniform shape) |
| `bonuses.spell_save_dc` | (uniform shape) |
| `bonuses.weapon_attack` | Mace of Smiting (vs construct) |
| `bonuses.weapon_damage` | Sun Blade (vs undead), Bracers of Archery, Mace of Smiting |
| `bonuses.ability_scores.bonus.<ability>` | (no SRD condition today; uniform shape) |
| `bonuses.speed.{walk, fly, swim, climb}` | Cloak of the Manta Ray (underwater), Cloak of the Bat (lighting + flying) |

Fields that **stay flat** (no conditional form):

- `bonuses.ability_scores.static.<ability>` — setters, not bonuses; conditional-setter semantics ("STR is 19 if no armor; else what?") are unclear and no SRD item motivates them.
- `resist`, `immune`, `vulnerable`, `condition_immune` — string arrays. No SRD item has conditional resistance today.

The set of conditional-capable bonus paths above is enumerated as a string-literal union type so consumers (curated map keys, informational records, evaluator dispatch) share a vocabulary:

```ts
export type BonusFieldPath =
  | "ac"
  | "saving_throws"
  | "spell_attack"
  | "spell_save_dc"
  | "weapon_attack"
  | "weapon_damage"
  | `ability_scores.bonus.${Ability}`     // str, dex, con, int, wis, cha
  | "speed.walk" | "speed.fly" | "speed.swim" | "speed.climb";
```

### 3.4 Backwards compatibility

The schema is a strict superset. Every existing `bonuses.X: 2` literal in the SRD bundle and in user vaults stays valid. The next augmenter run rewrites bundled-SRD entries with the new shape where applicable; user-customized notes are skipped (per `regenerate-srd-magicitems.ts`'s existing `isSafeToOverwrite` guard).

### 3.5 Validation

- `z.discriminatedUnion("kind", […])` for `Condition` — fast-path Zod parsing and clean error messages.
- The recursive `any_of.conditions` field references `Condition` itself; Zod handles via `z.lazy`.

---

## 4. Augmenter

### 4.1 Existing pipeline

`scripts/augment-srd-magicitems.ts` reads the 5etools-shaped `items.json` plus `items-base.json` from the user's `archivist-pc` working dir and writes augmented records into `src/srd/data/magicitems.json`. `mapReferenceFields()` is the field-mapping core. Today it consumes 5etools' already-structured fields (`bonusAc`, `bonusWeapon`, `ability.static`, …) and emits flat numeric bonuses; it does not read prose.

### 4.2 New extraction step

After existing flat-field assignment in `mapReferenceFields`, a new step wraps numeric bonuses with conditions when prose says so:

```
For each numeric bonus field that was assigned a flat number:
  let conditions = curated[slug]?.[field]  ??  proseExtractor(entries)?.[field]
  if (conditions && conditions.length > 0):
    bonuses[field] = { value: <flat>, when: conditions }
```

### 4.3 Curated mapping (`scripts/augment/condition-map.ts`)

A typed table from item slug to per-field `Condition[]`. The trusted source for known SRD items:

```ts
export const CURATED_CONDITIONS_MAP: Record<string, Partial<Record<BonusFieldPath, Condition[]>>> = {
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
  // …grow over time as audit promotes regex `raw` entries to typed.
};
```

Initial entries cover at minimum: Bracers of Defense, Arrow-Catching Shield, Bracers of Archery, Sun Blade, Mace of Smiting, Axe of the Dwarvish Lords, Cloak of the Manta Ray, Dragon Masks (no_armor variants), Badge of the Watch.

### 4.4 Regex sweep (`scripts/augment/condition-extractor.ts`)

A small ordered list of high-confidence patterns for items not in the curated map. Each pattern emits one or more typed conditions on a specific field. The pattern set is deliberately **minimal** rather than aggressive — false negatives (item stays flat when it should be conditional) are recoverable via the curated map; false positives (wrong condition tagged) silently corrupt data.

Initial patterns (extend as needed):

| Regex (case-insensitive, applied to entries text) | Target field | Emit |
|---|---|---|
| `wearing no armor and using no \{?@?item\s*shield` | ac | `[no_armor, no_shield]` |
| `if you are wearing no armor` | ac | `[no_armor]` |
| `if you (?:are not\|aren't) using a \{?@?item\s*shield` | ac | `[no_shield]` |
| `against ranged attack` | ac, weapon_attack | `[vs_attack_type:ranged]` |
| `on ranged attacks? made` | weapon_damage | `[on_attack_type:ranged]` |
| `against (undead\|fiend\|construct\|aberration\|beast\|elemental\|fey\|giant\|monstrosity\|ooze\|plant\|celestial\|dragon)s?` | weapon_attack, weapon_damage | `[vs_creature_type:<match>]` |
| `\bunderwater\b` | speed.swim | `[underwater]` |
| `in dim light` | (any) | `[lighting:dim]` |
| `while flying` | (any) | `[movement_state:flying]` |

If none match but the prose contains generic condition language (`if you`, `while you are`, `against`), the augmenter emits a `{ kind: "raw", text: "<sentence>" }` and logs to the growth list.

### 4.5 Output normalization

- Empty `when[]` collapses to flat number before writing.
- A field that maps to multiple regex hits keeps only the first; ordered priority is curated > regex-typed > raw.

### 4.6 Augmenter report

The CLI run prints a categorized summary:

```
Conditions extracted:
  Curated mapping:    23 items
  Regex (structured): 11 items
  Regex (raw):         9 items   ← growth list — manually map next
  Total touched:      43 items
```

The growth list is the actionable maintenance output; iterations of human review move entries from "raw" to "curated" by editing `condition-map.ts`.

### 4.7 Scope

The augmenter only touches the bundled SRD pipeline (`src/srd/data/magicitems.json` → vault `Compendium/SRD/Magic Items/*.md` via `regenerate-srd-magicitems.ts`). User-customized notes are skipped by the regenerator's existing `isSafeToOverwrite` guard. Hand-authored compendium markdown can adopt the conditional shape directly in YAML if the user writes it that way; otherwise stays flat. AI-panel item generation (separate spec §2 in the predecessor) does not write conditions yet.

---

## 5. Recalc — evaluator and accessor

### 5.1 `evaluateCondition(cond, ctx)`

Single switch over `Condition.kind`. Tier 1 returns `"true"` or `"false"`; Tier 2–4 and `raw` always return `"informational"`. `any_of` recurses.

```ts
export type ConditionOutcome = "true" | "false" | "informational";

export interface ConditionContext {
  derived: { equippedSlots: EquippedSlots };
  classList: ClassEntry[];
  race: string | null;
  subclasses: string[];
}

export function evaluateCondition(cond: Condition, ctx: ConditionContext): ConditionOutcome { … }

// AND-combine: any "false" → false; else any "informational" → informational; else true.
export function evaluateConditions(conds: Condition[], ctx: ConditionContext): ConditionOutcome { … }
```

`any_of` recursion: any branch `true` → branch outcome `true`; else any branch `informational` → branch outcome `informational`; else `false`.

`evaluateConditions` short-circuits on `false` — a Tier 1-false condition wins over Tier 2–4 informational siblings, because the engine is sure the bonus does not apply.

### 5.2 `readNumericBonus(raw, ctx)`

```ts
export type BonusReadResult =
  | { kind: "applied"; value: number }
  | { kind: "skipped" }
  | { kind: "informational"; value: number; conditions: Condition[] };

export function readNumericBonus(
  raw: number | ConditionalBonus | undefined,
  ctx: ConditionContext,
): BonusReadResult | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return raw === 0 ? null : { kind: "applied", value: raw };
  if (raw.value === 0) return null;
  const outcome = evaluateConditions(raw.when, ctx);
  if (outcome === "true") return { kind: "applied", value: raw.value };
  if (outcome === "false") return { kind: "skipped" };
  return { kind: "informational", value: raw.value, conditions: raw.when };
}
```

### 5.3 Refactor of existing iteration sites

Three sites in `pc.equipment.ts` are open-coded today. Each becomes `readNumericBonus` + dispatch. Existing flat-number behavior must remain identical — these tests already exist (`pc-recalc-ac.test.ts`, `pc-attack-rows.test.ts`).

- **Pass A — `computeAppliedBonuses`** (lines 82-153 today): wraps each `b.X` read for `saving_throws`, `spell_attack`, `spell_save_dc`, `ability_scores.bonus`, `speed.*` through the helper. Defenses (`resist`/`immune`/etc.) stay flat (no conditional support).
- **Pass B — AC** (lines 300-310 today): `b.ac` read goes through helper.
- **Pass B — weapon** (`magicBonusesForWeaponEntry`, line 359 today): `b.weapon_attack` and `b.weapon_damage` reads go through helper. Per-weapon informational bonuses bubble up onto the constructed `AttackRow`.

### 5.4 New `AppliedBonuses.informational` field

```ts
// src/modules/pc/pc.types.ts (extend AppliedBonuses)
export interface InformationalBonus {
  field: BonusFieldPath;        // "ac" | "weapon_attack" | "speed.walk" | "ability_scores.bonus.str" | …
  source: string;                // item.name
  value: number;
  conditions: Condition[];
}

export interface AppliedBonuses {
  // …existing fields unchanged…
  informational: InformationalBonus[];
}
```

`AttackRow` gains an optional `informational?: InformationalBonus[]` for per-weapon situational bonuses, since different equipped weapons can carry different conditions.

### 5.5 AC breakdown extension

The existing `acBreakdown` in `computeSlotsAndAttacks` returns `{ ac, breakdown }`. It gains a parallel `informational: InformationalBonus[]` slice for AC-specific conditional bonuses. The AC tooltip render reads from this slice.

---

## 6. UI surfacing

### 6.1 `conditionToText` — the rendering single source of truth

Lives in `src/modules/item/item.conditions.ts` next to `evaluateCondition`. Exhaustive switch over `Condition.kind`. Same call from every render surface.

```ts
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

### 6.2 AC tooltip (`.pc-ac-tooltip`)

Existing structure (post-`8dca1ec` parchment styling) gets a new section that appears only when `acInformational` is non-empty:

```
AC 17
Chain Mail              +16
DEX modifier             +0
Cloak of Protection      +1
─────────────────────────
Situational                       ← new italic/muted subheader
Bracers of Defense  +2  if no armor and no shield
Arrow-Catching Shield  +2  vs ranged attacks
```

CSS additions:

```css
.pc-ac-tooltip-row--situational { font-style: italic; opacity: 0.85; }
.pc-ac-tooltip-row--situational .pc-ac-tooltip-condition {
  color: var(--pc-text-muted);
  font-size: var(--pc-fs-label);
  margin-left: var(--pc-space-1);
}
```

### 6.3 Attack row — per-weapon situational subline

```
Longbow         +6 to hit  1d8+3 piercing
  ↳ situational: +2 dmg on ranged attacks (longbow or shortbow)
Shortsword      +5 to hit  1d6+3 piercing
```

`AttackRow.informational` is rendered as a sub-line under the main row; `fieldLabel(info.field)` maps `"weapon_attack"` → `"to hit"` and `"weapon_damage"` → `"dmg"`.

### 6.4 Inventory row expand — situational bonuses caption

`inventory-row-expand.ts` already shows the item's description block on click. When the underlying item has any conditional bonus, the expand renders a "Situational bonuses" caption listing them:

```
Bracers of Defense
Description: While wearing these bracers…
Situational bonuses:
  • +2 AC if no armor and no shield
```

This lets the player verify the augmented data on an item before they equip it.

### 6.5 Save / spell-attack / spell-save-dc / speed tooltips (deferred)

The recalc pipeline carries situational data for these fields, but the tooltips that would surface them are not all in place today. **In v1, only the AC tooltip and attack rows render situational rows**; informational data still flows through to derived state, awaiting future tooltip work for saves, spell stats, and speed. This is captured as a follow-up below.

### 6.6 Edge cases

- **Empty informational[]** — entire situational section/sub-line is omitted. Tooltips look identical to today for unconditional items (regression-safe).
- **Mix of Tier 1-false and Tier 2–4** — by §2 of this design, Tier 1-false silently skips. `informational[]` only contains Tier 2–4 + `raw`.
- **`any_of` rendering** — wrapped in parentheses with " or " between branches; nested `any_of`s render with nested parens.
- **`raw`** — text rendered verbatim, no wrapper.

---

## 7. Testing — bottom-up TDD layers

Build order matches test-first dependency: schema → evaluator → accessor → augmenter → recalc integration → text rendering → UI.

### 7.1 Layer 1 — schema (`tests/item-conditions-schema.test.ts`)

Pure Zod parse tests. Cover every `Condition.kind`, both `number` and `ConditionalBonus` forms on each affected `bonuses.*` field, recursive `any_of`, and rejection of unknown kinds.

### 7.2 Layer 2 — `evaluateCondition` (`tests/item-conditions-evaluate.test.ts`)

Pure-function tests. One test per kind:
- Tier 1 kinds: true and false branches with derived-state fixtures.
- Tier 2–4 + `raw`: assert always-`informational`.
- `any_of`: true/false/informational branches and recursion.
- `evaluateConditions` AND-combine: false beats informational; informational beats true (see §5.1).

### 7.3 Layer 3 — `readNumericBonus` (`tests/item-bonuses-read.test.ts`)

The three-outcome categorizer:
- `null` for undefined and zero
- `applied` for flat number and Tier-1-true `ConditionalBonus`
- `skipped` for Tier-1-false `ConditionalBonus`
- `informational` for any `ConditionalBonus` with Tier-2+ or `raw` conditions

### 7.4 Layer 4 — recalc integration (`tests/pc-recalc-conditional-bonuses.test.ts` + extensions)

Headline-number assertions plus informational-array assertions:
- Bracers of Defense: applies / skips correctly across armor + shield states.
- Arrow-Catching Shield: AC unchanged, informational entry present.
- Sun Blade: attack row carries `+2 vs undead` informational.
- Bracers of Archery: only longbow/shortbow attack rows carry the informational; melee weapon rows don't.
- Cloak of the Manta Ray: speed.swim conditional carried as informational underwater.
- Cloak of Protection (control): flat number still works.
- Mixed: chain mail + cloak + bracers + arrow-catching shield gives correct headline AC + correct informational set.

### 7.5 Layer 5 — augmenter (`tests/srd-augment-magicitems.test.ts` extensions)

Fixture-driven over `mapReferenceFields`:
- Curated mappings emit correct shape (Bracers of Defense, Bracers of Archery, Sun Blade, Mace of Smiting, …).
- Regex structured patterns emit typed conditions (vs ranged, vs undead, …).
- Regex raw fallback emits `{ kind: "raw", text }` plus a warning.
- Negative: Cloak of Protection stays flat (while-equipped is not a conditional bonus).
- Negative: items with no condition language stay flat.
- Normalization: empty `when[]` collapses to flat number.

### 7.6 Layer 6 — `conditionToText` (`tests/item-conditions-text.test.ts`)

Table-driven assertions for every `Condition.kind` rendering. Cover `conditionsToText` AND-join, `any_of` parens, and nested cases.

### 7.7 Layer 7 — UI render

- `tests/pc-ac-tooltip-situational.test.ts` (new): renders the situational section iff informational present; uses `conditionsToText` for the condition string.
- `tests/pc-attack-rows.test.ts` (extend): per-weapon situational sub-line.
- `tests/pc-inventory-row-expand.test.ts` (extend): situational bonuses caption on items that have conditional bonuses; absent on items that don't.

### 7.8 Coverage targets

- Every `Condition.kind` evaluated at least once (Layer 2).
- Every `Condition.kind` rendered at least once (Layer 6).
- Every numeric `bonuses.*` field exercised with both flat and conditional input (Layer 3).
- Every UI surface that gains a situational section gets at least one positive and one negative test (Layer 7).

### 7.9 Shared fixtures

`tests/__fixtures__/items-conditional.ts` exporting hand-crafted `ItemEntity` records (Bracers of Defense, Arrow-Catching Shield, Sun Blade, Bracers of Archery, Cloak of Protection, Cloak of the Manta Ray, …) reused across recalc, render, and integration tests.

---

## 8. Module touchpoints

| Path | Status | Change |
|---|---|---|
| `src/modules/item/item.conditions.types.ts` | new | `Condition` union, `ConditionalBonus`, `InformationalBonus`, `BonusFieldPath` types |
| `src/modules/item/item.conditions.ts` | new | `evaluateCondition`, `evaluateConditions`, `conditionToText`, `conditionsToText` |
| `src/modules/item/item.bonuses.ts` | new | `readNumericBonus`, `BonusReadResult` |
| `src/modules/item/item.schema.ts` | extend | `numberOrConditional` Zod helper; affected `bonuses.*` fields use it; `conditionSchema` discriminated union |
| `src/modules/item/item.types.ts` | extend | mirrored types from item.schema.ts updates |
| `src/modules/pc/pc.types.ts` | extend | `AppliedBonuses.informational`, `AttackRow.informational?` |
| `src/modules/pc/pc.equipment.ts` | refactor + extend | three iteration sites consolidated through `readNumericBonus`; informational pool populated |
| `src/modules/pc/pc.recalc.ts` | extend | thread informational through to derived state |
| AC tooltip render site | extend | new "Situational" section |
| Attack row render site | extend | per-row situational sub-line |
| `src/modules/pc/components/inventory/inventory-row-expand.ts` | extend | "Situational bonuses" caption |
| `pc/inventory.css` (in `styles.css`) | extend | `.pc-ac-tooltip-row--situational`, `.pc-attack-row-situational`, item-row caption styling |
| `scripts/augment-srd-magicitems.ts` | extend | wire condition-extraction step |
| `scripts/augment/condition-map.ts` | new | curated `(slug → field → Condition[])` table |
| `scripts/augment/condition-extractor.ts` | new | regex sweep + raw fallback |
| `tests/item-conditions-schema.test.ts` | new | Layer 1 |
| `tests/item-conditions-evaluate.test.ts` | new | Layer 2 |
| `tests/item-bonuses-read.test.ts` | new | Layer 3 |
| `tests/pc-recalc-conditional-bonuses.test.ts` | new | Layer 4 |
| `tests/srd-augment-magicitems.test.ts` | extend | Layer 5 |
| `tests/item-conditions-text.test.ts` | new | Layer 6 |
| `tests/pc-ac-tooltip-situational.test.ts` | new | Layer 7 |
| `tests/pc-attack-rows.test.ts`, `tests/pc-inventory-row-expand.test.ts` | extend | Layer 7 |
| `tests/__fixtures__/items-conditional.ts` | new | shared fixtures |

---

## 9. Out of scope and follow-ups

These are intentionally not part of this spec and are tracked here so they don't surprise future planners:

1. **Per-roll attack-context evaluator.** When attack-row generation gains a context object that knows the target creature type, the currently-rolled weapon, and ranged-vs-melee, Tier 2 conditions become evaluable. That is its own feature; this spec only stores the data.
2. **Scene-state model.** Lighting, environment, mounted/swim/fly state. Tier 3 lights up when this lands.
3. **Status / health-state tracking.** Bloodied, concentrating, grappled, prone, frightened. Tier 4 lights up when this lands.
4. **Save / spell-stat / speed tooltips with situational rows.** Data flows through; rendering for these surfaces is deferred.
5. **AI-panel item generation with conditions.** Tracked in §2 of `2026-04-26-magic-item-mechanics-deferred-design.md` (the predecessor deferral).
6. **Conditional `static` ability scores or conditional `resist` arrays.** Not modeled; no SRD motivator.
7. **Promoting `raw` augmenter entries to typed kinds.** This is ongoing maintenance: each iteration of the augmenter run produces a growth list; humans audit and edit `condition-map.ts`. Not a one-shot task.

---

## 10. Tracking

When implementation begins, file the plan at `docs/superpowers/plans/2026-04-26-magic-item-conditional-bonuses.md` and reference this spec for design intent.
