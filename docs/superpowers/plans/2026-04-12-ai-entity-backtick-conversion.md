# AI Entity Backtick Tag Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI-generated monsters/spells/items consistently use backtick formula tags by updating the system prompt and adding a safety-net converter in the enrichment layer.

**Architecture:** Two changes: (1) update `dndContext.ts` system prompt to teach backtick combat tags instead of 5etools, (2) wire `convertDescToTags` into `enrichMonster`/`enrichSpell`/`enrichItem` so any plain-English or static output gets tagged automatically. Monsters get full ability inference; spells/items get static-fallback tagging via a dummy context.

**Tech Stack:** TypeScript, Vitest, existing `srd-tag-converter.ts` converter, `entity-enrichment.ts` enrichment layer.

**Spec:** `docs/superpowers/specs/2026-04-12-ai-entity-backtick-conversion-design.md`

---

## File structure

**Modified files:**
- `src/ai/validation/entity-enrichment.ts` — import converter, add entry conversion to all three enrichment functions
- `src/inquiry/core/prompts/dndContext.ts` — replace 5etools combat tags with backtick formula tag instructions

**New files:**
- `tests/ai-entity-enrichment.test.ts` — unit tests for the enrichment safety net

---

### Task 1: Write monster enrichment conversion tests

**Files:**
- Create: `tests/ai-entity-enrichment.test.ts`

- [ ] **Step 1: Write failing tests for monster enrichment**

```ts
// tests/ai-entity-enrichment.test.ts
import { describe, it, expect } from "vitest";
import { enrichMonster } from "../src/ai/validation/entity-enrichment";

describe("enrichMonster — backtick tag conversion", () => {
  it("converts plain English attack and damage to ability-linked tags", () => {
    // STR 16 → mod +3, CR 1 → prof +2, so atk = +5, mod = 3
    const raw: Record<string, unknown> = {
      name: "Test Brute",
      cr: "1",
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
      actions: [
        {
          name: "Greataxe",
          entries: [
            "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.",
          ],
        },
      ],
    };
    const result = enrichMonster(raw);
    const entry = (result.actions as { name: string; entries: string[] }[])[0].entries[0];
    expect(entry).toContain("`atk:STR`");
    expect(entry).toContain("`damage:1d12+STR`");
    expect(entry).not.toContain("+5 to hit");
    expect(entry).not.toContain("9 (1d12 + 3)");
  });

  it("leaves already-tagged entries unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Test Brute",
      cr: "1",
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
      actions: [
        {
          name: "Greataxe",
          entries: [
            "Melee Weapon Attack: `atk:STR` to hit, reach 5 ft., one target. Hit: `damage:1d12+STR` slashing damage.",
          ],
        },
      ],
    };
    const result = enrichMonster(raw);
    const entry = (result.actions as { name: string; entries: string[] }[])[0].entries[0];
    expect(entry).toBe(
      "Melee Weapon Attack: `atk:STR` to hit, reach 5 ft., one target. Hit: `damage:1d12+STR` slashing damage.",
    );
  });

  it("passes 5etools tags through unchanged (handled at render time)", () => {
    const raw: Record<string, unknown> = {
      name: "Test",
      cr: "1",
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
      actions: [
        {
          name: "Slash",
          entries: [
            "Melee Weapon Attack: {@hit 5} to hit, reach 5 ft., one target. {@h} {@damage 1d12+3} slashing damage.",
          ],
        },
      ],
    };
    const result = enrichMonster(raw);
    const entry = (result.actions as { name: string; entries: string[] }[])[0].entries[0];
    // {@hit 5} and {@damage ...} are not plain-English patterns, so converter ignores them
    expect(entry).toContain("{@hit 5}");
    expect(entry).toContain("{@damage 1d12+3}");
  });

  it("converts DC with explicit ability word", () => {
    // CON 14 → mod +2, CR 1 → prof +2, DC = 8 + 2 + 2 = 12
    const raw: Record<string, unknown> = {
      name: "Test",
      cr: "1",
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      traits: [
        {
          name: "Poison Aura",
          entries: [
            "Each creature must succeed on a DC 12 Constitution saving throw or be poisoned.",
          ],
        },
      ],
    };
    const result = enrichMonster(raw);
    const entry = (result.traits as { name: string; entries: string[] }[])[0].entries[0];
    expect(entry).toContain("`dc:CON`");
    expect(entry).not.toContain("DC 12");
  });

  it("converts entries across multiple sections", () => {
    // STR 16 → mod +3, CR 1 → prof +2
    const raw: Record<string, unknown> = {
      name: "Multi-Section Monster",
      cr: "1",
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
      actions: [
        {
          name: "Claw",
          entries: ["Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage."],
        },
      ],
      reactions: [
        {
          name: "Parry",
          entries: ["The creature adds 2 to its AC against one melee attack. The attacker takes 3 (1d6) slashing damage."],
        },
      ],
    };
    const result = enrichMonster(raw);
    const actionEntry = (result.actions as { name: string; entries: string[] }[])[0].entries[0];
    const reactionEntry = (result.reactions as { name: string; entries: string[] }[])[0].entries[0];
    expect(actionEntry).toContain("`atk:STR`");
    expect(actionEntry).toContain("`damage:1d6+STR`");
    expect(reactionEntry).toContain("`damage:1d6`");
  });

  it("does not crash when monster has no feature sections", () => {
    const raw: Record<string, unknown> = {
      name: "Blob",
      cr: "0",
      abilities: { str: 3, dex: 6, con: 10, int: 1, wis: 6, cha: 1 },
    };
    const result = enrichMonster(raw);
    expect(result.name).toBe("Blob");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ai-entity-enrichment.test.ts`
Expected: The first test fails because `enrichMonster` doesn't yet convert entries. The "already-tagged" and "5etools pass through" tests may pass since the current code doesn't modify entries at all — they'll need to keep passing after implementation.

---

### Task 2: Implement monster enrichment conversion

**Files:**
- Modify: `src/ai/validation/entity-enrichment.ts`

- [ ] **Step 1: Add imports**

Add these imports at the top of `src/ai/validation/entity-enrichment.ts`:

```ts
import {
  convertDescToTags,
  detectSpellcastingAbility,
  type ActionCategory,
  type ConversionContext,
  type ConverterAbilities,
} from "../../entities/srd-tag-converter";
```

- [ ] **Step 2: Add conversion logic to `enrichMonster`**

Replace the current `enrichMonster` function body. The existing logic stays the same; conversion is added after the return object is built:

```ts
export function enrichMonster(
  raw: Record<string, unknown>,
): Monster & { xp?: number; proficiency_bonus?: number } {
  const cr = String(raw.cr ?? "0");
  const abilities = raw.abilities as Monster["abilities"];
  const wisdomMod = abilities ? abilityModifier(abilities.wis) : 0;
  const passivePerception =
    (raw.passive_perception as number) ?? (10 + wisdomMod);
  const languages = (raw.languages as string[])?.length
    ? (raw.languages as string[])
    : ["---"];

  const enriched = {
    ...(raw as unknown as Monster),
    cr,
    xp: getChallengeRatingXP(cr),
    proficiency_bonus: getProficiencyBonus(cr),
    passive_perception: passivePerception,
    languages,
  } as Monster & { xp?: number; proficiency_bonus?: number };

  // Safety net: convert any plain-English mechanics to backtick formula tags
  convertMonsterEntries(enriched, cr);

  return enriched;
}
```

- [ ] **Step 3: Add the `convertMonsterEntries` helper below `enrichMonster`**

```ts
const MONSTER_SECTIONS: [keyof Monster, ActionCategory][] = [
  ["traits", "trait"],
  ["actions", "action"],
  ["reactions", "reaction"],
  ["legendary", "legendary"],
];

function convertMonsterEntries(
  monster: Monster & Record<string, unknown>,
  cr: string,
): void {
  const abilities = monster.abilities;
  if (!abilities) return;

  const profBonus = getProficiencyBonus(cr);
  const spellAbility = detectSpellcastingAbility(
    monster.traits as { name: string; entries: string[] }[] | undefined,
  );

  for (const [key, category] of MONSTER_SECTIONS) {
    const features = monster[key];
    if (!Array.isArray(features)) continue;
    for (const feature of features) {
      const f = feature as { name?: string; entries?: string[] };
      if (!Array.isArray(f.entries)) continue;
      f.entries = f.entries.map((desc: string) =>
        convertDescToTags(desc, {
          abilities: abilities as ConverterAbilities,
          profBonus,
          actionName: f.name ?? "",
          actionCategory: category,
          spellAbility,
        }),
      );
    }
  }
}
```

- [ ] **Step 4: Run the monster tests to verify they pass**

Run: `npx vitest run tests/ai-entity-enrichment.test.ts`
Expected: All 6 monster tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ai/validation/entity-enrichment.ts tests/ai-entity-enrichment.test.ts
git commit -m "feat: add backtick tag conversion safety net for AI-generated monsters"
```

---

### Task 3: Write and implement spell enrichment conversion

**Files:**
- Modify: `tests/ai-entity-enrichment.test.ts`
- Modify: `src/ai/validation/entity-enrichment.ts`

- [ ] **Step 1: Write failing spell tests**

Append to `tests/ai-entity-enrichment.test.ts`:

```ts
import { enrichSpell } from "../src/ai/validation/entity-enrichment";

describe("enrichSpell — backtick tag conversion", () => {
  it("converts static DC and damage dice in description", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Burst",
      level: 3,
      description: [
        "Each creature in the area must make a DC 15 Dexterity saving throw, taking 8d6 fire damage on a failed save, or half as much on a success.",
      ],
    };
    const result = enrichSpell(raw);
    const desc = (result.description as string[])[0];
    expect(desc).toContain("`dc:15`");
    expect(desc).toContain("`damage:8d6`");
  });

  it("leaves already-tagged description unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Burst",
      level: 3,
      description: [
        "Each creature must make a `dc:15` Dexterity saving throw, taking `damage:8d6` fire damage on a failed save.",
      ],
    };
    const result = enrichSpell(raw);
    const desc = (result.description as string[])[0];
    expect(desc).toBe(
      "Each creature must make a `dc:15` Dexterity saving throw, taking `damage:8d6` fire damage on a failed save.",
    );
  });

  it("converts bare dice in at_higher_levels", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Burst",
      level: 3,
      at_higher_levels: [
        "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
      ],
    };
    const result = enrichSpell(raw);
    const higher = (result.at_higher_levels as string[])[0];
    expect(higher).toContain("`dice:1d6`");
  });

  it("leaves plain text without mechanics unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Detect Magic",
      level: 1,
      description: [
        "For the duration, you sense the presence of magic within 30 feet of you.",
      ],
    };
    const result = enrichSpell(raw);
    const desc = (result.description as string[])[0];
    expect(desc).toBe("For the duration, you sense the presence of magic within 30 feet of you.");
  });
});
```

- [ ] **Step 2: Run tests to verify the new spell tests fail**

Run: `npx vitest run tests/ai-entity-enrichment.test.ts`
Expected: Spell conversion tests fail (enrichSpell doesn't convert yet). Monster tests still pass.

- [ ] **Step 3: Add static context constant and spell conversion**

In `src/ai/validation/entity-enrichment.ts`, add the static context constant after the imports (note: `ConversionContext` was already imported in Task 2):

```ts
/**
 * Dummy context for spells/items: all ability mods = -5, prof = 0.
 * No computed target matches any reasonable value, so every pattern
 * falls to the static fallback path (e.g. `dc:15`, `atk:+7`).
 */
const STATIC_CONTEXT: ConversionContext = {
  abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  profBonus: 0,
  actionName: "",
  actionCategory: "trait",
};
```

Then update `enrichSpell` — existing logic stays, conversion added at the end:

```ts
export function enrichSpell(raw: Record<string, unknown>): Spell {
  const duration = raw.duration as string | undefined;
  const concentration =
    (raw.concentration as boolean) ??
    (duration?.toLowerCase().includes("concentration") ?? false);
  const classes = (raw.classes as string[])?.length
    ? (raw.classes as string[])
    : ["Wizard", "Sorcerer"];

  const enriched = {
    ...(raw as unknown as Spell),
    concentration,
    ritual: (raw.ritual as boolean) ?? false,
    classes,
  };

  // Safety net: convert any plain-English mechanics to backtick tags (static fallback)
  if (Array.isArray(enriched.description)) {
    enriched.description = enriched.description.map((p: string) =>
      convertDescToTags(p, STATIC_CONTEXT),
    );
  }
  if (Array.isArray(enriched.at_higher_levels)) {
    enriched.at_higher_levels = enriched.at_higher_levels.map((p: string) =>
      convertDescToTags(p, STATIC_CONTEXT),
    );
  }

  return enriched;
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run tests/ai-entity-enrichment.test.ts`
Expected: All monster and spell tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ai/validation/entity-enrichment.ts tests/ai-entity-enrichment.test.ts
git commit -m "feat: add backtick tag conversion safety net for AI-generated spells"
```

---

### Task 4: Write and implement item enrichment conversion

**Files:**
- Modify: `tests/ai-entity-enrichment.test.ts`
- Modify: `src/ai/validation/entity-enrichment.ts`

- [ ] **Step 1: Write failing item tests**

Append to `tests/ai-entity-enrichment.test.ts`:

```ts
import { enrichItem } from "../src/ai/validation/entity-enrichment";

describe("enrichItem — backtick tag conversion", () => {
  it("converts bare damage dice in entries", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Tongue",
      type: "Weapon (any sword)",
      rarity: "Rare",
      entries: [
        "While the sword is ablaze, it deals an extra 2d6 fire damage to any target it hits.",
      ],
    };
    const result = enrichItem(raw);
    const entry = (result.entries as string[])[0];
    expect(entry).toContain("`damage:2d6`");
  });

  it("leaves already-tagged entries unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Flame Tongue",
      type: "Weapon (any sword)",
      rarity: "Rare",
      entries: [
        "While the sword is ablaze, it deals an extra `damage:2d6` fire damage to any target it hits.",
      ],
    };
    const result = enrichItem(raw);
    const entry = (result.entries as string[])[0];
    expect(entry).toBe(
      "While the sword is ablaze, it deals an extra `damage:2d6` fire damage to any target it hits.",
    );
  });

  it("leaves plain text entries unchanged", () => {
    const raw: Record<string, unknown> = {
      name: "Bag of Holding",
      type: "Wondrous item",
      rarity: "Uncommon",
      entries: [
        "This bag has an interior space considerably larger than its outside dimensions.",
      ],
    };
    const result = enrichItem(raw);
    const entry = (result.entries as string[])[0];
    expect(entry).toBe(
      "This bag has an interior space considerably larger than its outside dimensions.",
    );
  });

  it("does not crash when item has no entries", () => {
    const raw: Record<string, unknown> = {
      name: "Simple Ring",
      type: "Ring",
      rarity: "Common",
    };
    const result = enrichItem(raw);
    expect(result.name).toBe("Simple Ring");
  });
});
```

- [ ] **Step 2: Run tests to verify item tests fail**

Run: `npx vitest run tests/ai-entity-enrichment.test.ts`
Expected: Item conversion tests fail. Monster and spell tests still pass.

- [ ] **Step 3: Add conversion to `enrichItem`**

Update `enrichItem` in `src/ai/validation/entity-enrichment.ts` — existing logic stays, conversion added at the end:

```ts
export function enrichItem(
  raw: Record<string, unknown>,
): Item & { source?: string } {
  const enriched = {
    ...(raw as unknown as Item),
    source: (raw.source as string) ?? "Homebrew",
    attunement: raw.attunement ?? false,
    curse: (raw.curse as boolean) ?? false,
  } as Item & { source?: string };

  // Safety net: convert any plain-English mechanics to backtick tags (static fallback)
  if (Array.isArray(enriched.entries)) {
    enriched.entries = enriched.entries.map((e: string) =>
      convertDescToTags(e, STATIC_CONTEXT),
    );
  }

  return enriched;
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run tests/ai-entity-enrichment.test.ts`
Expected: All monster, spell, and item tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ai/validation/entity-enrichment.ts tests/ai-entity-enrichment.test.ts
git commit -m "feat: add backtick tag conversion safety net for AI-generated items"
```

---

### Task 5: Update system prompt

**Files:**
- Modify: `src/inquiry/core/prompts/dndContext.ts`

- [ ] **Step 1: Replace the 5etools combat tag section**

In `src/inquiry/core/prompts/dndContext.ts`, replace lines 50-71 (the `5eTOOLS INLINE TAGS` section) with the updated version. The section currently reads:

```
5eTOOLS INLINE TAGS:
When writing action/trait/feature entries in stat blocks, use 5etools inline tag syntax. The renderer supports these tags:

Combat tags:
- {@atk mw} = Melee Weapon Attack:  {@atk rw} = Ranged Weapon Attack:
- {@atk ms} = Melee Spell Attack:  {@atk rs} = Ranged Spell Attack:
- {@atk mw,rw} = Melee or Ranged Weapon Attack:
- {@hit 7} = +7 to hit  {@h} = Hit:
- {@damage 2d6+4 slashing} = damage roll with type  {@dice 3d6} = generic dice roll
- {@dc 15} = DC 15  {@recharge 5} = (Recharge 5-6)  {@chance 50} = 50% chance

Entity references:
- {@spell fireball} {@item longsword} {@creature goblin} {@condition frightened}
- {@skill Perception} {@sense darkvision} {@action Dash} {@ability str}
- {@class fighter} {@feat Alert} {@background Acolyte} {@race Elf}
- {@disease Cackle Fever} {@hazard brown mold} {@plane Shadowfell}

Formatting:
- {@b bold text} {@i italic text} {@note parenthetical note}

Example action entry using these tags:
"Melee Weapon Attack: {@hit 7} to hit, reach 5 ft., one target. {@h} {@damage 2d6+4 slashing} slashing damage plus {@damage 1d6 fire} fire damage."
```

Replace with:

```
INLINE TAGS:
When writing action/trait/feature entries in stat blocks, use these inline tag formats.

Combat formula tags (ALWAYS use these, not static numbers):
- \`atk:ABILITY\` — attack bonus (ability mod + proficiency). Use STR for melee, DEX for ranged/finesse, spellcasting ability for spell attacks.
  Examples: \`atk:STR\`, \`atk:DEX\`
- \`damage:DICEdNOTATION+ABILITY\` — damage with ability mod.
  Examples: \`damage:2d6+STR\`, \`damage:1d8+DEX\`
- \`damage:DICEdNOTATION\` — damage dice only, no ability mod.
  Example: \`damage:2d6\` for bonus damage types
- \`dc:ABILITY\` — save DC (8 + proficiency + ability mod).
  Examples: \`dc:CON\`, \`dc:WIS\`
- \`dice:NOTATION\` — generic dice roll display.
  Example: \`dice:3d6\`

Valid abilities: STR, DEX, CON, INT, WIS, CHA (uppercase only).

Non-combat utility tags (5etools syntax):
- {@recharge 5} = (Recharge 5-6)  {@recharge} = (Recharge)
- {@chance 50} = 50% chance
- {@h} = Hit:

Entity references (5etools syntax):
- {@spell fireball} {@item longsword} {@creature goblin} {@condition frightened}
- {@skill Perception} {@sense darkvision} {@action Dash} {@ability str}
- {@class fighter} {@feat Alert} {@background Acolyte} {@race Elf}
- {@disease Cackle Fever} {@hazard brown mold} {@plane Shadowfell}

Formatting (5etools syntax):
- {@b bold text} {@i italic text} {@note parenthetical note}

Example action entry:
"Melee Weapon Attack: \`atk:STR\` to hit, reach 5 ft., one target. {@h} \`damage:2d6+STR\` slashing damage plus \`damage:1d6\` fire damage."
```

The concrete edit: in `dndContext.ts`, find the string starting with `5eTOOLS INLINE TAGS:` and ending with the example action entry line, and replace it with the new text above.

- [ ] **Step 2: Verify the build succeeds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/inquiry/core/prompts/dndContext.ts
git commit -m "feat: update system prompt to teach backtick formula tags instead of 5etools combat syntax"
```

---

### Task 6: Run full test suite and deploy

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass, including existing SRD converter tests and the new AI enrichment tests.

- [ ] **Step 2: Build and deploy**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/`
Expected: Build succeeds and files are copied.

- [ ] **Step 3: Run gitnexus detect changes**

Run: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})`
Expected: Changes limited to `entity-enrichment.ts`, `dndContext.ts`, and `ai-entity-enrichment.test.ts` (plus any files already changed on the branch).
