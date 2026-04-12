# AI Entity Backtick Tag Conversion

**Date:** 2026-04-12
**Branch:** `feat/compendium-reference-system`
**Status:** Spec — awaiting user review, then implementation plan

## Summary

AI-generated monsters, spells, and items (via `generate_monster`, `generate_spell`, `generate_item` MCP tools) should consistently use backtick formula tags (`` `atk:STR` ``, `` `damage:2d6+DEX` ``, `` `dc:CON` ``) instead of static numbers or 5etools tags. The tool descriptions already instruct this, but the system prompt contradicts by teaching 5etools combat syntax, and there is no safety net if the AI emits plain English or static values.

This spec adds:

1. **System prompt update** — replace 5etools combat tag instructions with backtick formula tag syntax, teaching ability-linked tags.
2. **Enrichment safety net** — run the existing `convertDescToTags` converter on AI tool output during enrichment, before the result is returned. Monsters get full ability inference; spells/items get static-fallback tagging.

## Goals

- AI-generated monster entries use ability-linked formula tags (`` `atk:STR` ``, `` `damage:2d6+STR` ``, `` `dc:CON` ``).
- AI-generated spell/item entries wrap any bare mechanics (DC, attack bonus, dice) as static backtick tags.
- The system prompt consistently teaches backtick syntax for combat mechanics across both chat instructions and tool descriptions.
- If the AI ignores instructions and writes plain English, the safety net converts it automatically.
- Already-tagged content passes through unchanged (idempotent).
- No changes to parsers, renderers, CSS, or the existing SRD pipeline.

## Non-goals

- Converting chat prose (non-tool output) to backtick format.
- Adding ability-linked inference to spells/items (no ability scores available).
- Changing the 5etools entity reference or formatting tag syntax (`{@spell}`, `{@condition}`, `{@b}`, `{@i}`).
- Modifying the render pipeline (`convert5eToolsTags`, `decorateProseDice`, `resolveFormulaTag`).

## Architecture

**No new files** (aside from tests). Two existing files modified:

- **`src/ai/validation/entity-enrichment.ts`** — imports `convertDescToTags` and `detectSpellcastingAbility` from `srd-tag-converter.ts`. Adds entry conversion to `enrichMonster`, `enrichSpell`, `enrichItem`.
- **`src/inquiry/core/prompts/dndContext.ts`** — replaces 5etools combat tag section with backtick formula tag instructions.

One new test file:

- **`tests/ai-entity-enrichment.test.ts`** — unit tests for the enrichment safety net.

### Dependency

`entity-enrichment.ts` gains imports from:
- `src/entities/srd-tag-converter.ts` (`convertDescToTags`, `detectSpellcastingAbility`, `ConversionContext`, `ConverterAbilities`, `ActionCategory`)
- `src/dnd/math.ts` (already reachable via existing `cr-xp-mapping.ts` import path)

No circular dependencies. `srd-tag-converter.ts` is a pure-function module with no state.

## Unit 1 — System Prompt Update

### File: `src/inquiry/core/prompts/dndContext.ts`

Replace the `5eTOOLS INLINE TAGS` combat section. Keep entity references and formatting tags as 5etools.

**Current** combat tag instructions:
```
Combat tags:
- {@atk mw} = Melee Weapon Attack:  {@atk rw} = Ranged Weapon Attack:
- {@atk ms} = Melee Spell Attack:  {@atk rs} = Ranged Spell Attack:
- {@atk mw,rw} = Melee or Ranged Weapon Attack:
- {@hit 7} = +7 to hit  {@h} = Hit:
- {@damage 2d6+4 slashing} = damage roll with type  {@dice 3d6} = generic dice roll
- {@dc 15} = DC 15  {@recharge 5} = (Recharge 5-6)  {@chance 50} = 50% chance
```

**Replacement** — ability-linked backtick formula tags:
```
COMBAT FORMULA TAGS (ALWAYS use these in action/trait/feature entries, not static numbers):
- `atk:ABILITY` — attack bonus (ability mod + proficiency). Use STR for melee, DEX for ranged/finesse, spellcasting ability for spell attacks.
  Examples: `atk:STR`, `atk:DEX`
- `damage:DICEdNOTATION+ABILITY` — damage with ability mod.
  Examples: `damage:2d6+STR`, `damage:1d8+DEX`
- `damage:DICEdNOTATION` — damage dice only, no ability mod.
  Example: `damage:2d6` for bonus damage types
- `dc:ABILITY` — save DC (8 + proficiency + ability mod).
  Examples: `dc:CON`, `dc:WIS`
- `dice:NOTATION` — generic dice roll display.
  Example: `dice:3d6`

Valid abilities: STR, DEX, CON, INT, WIS, CHA (uppercase only).

Non-combat tags (still use 5etools syntax):
- {@recharge 5} = (Recharge 5-6)  {@recharge} = (Recharge)
- {@chance 50} = 50% chance
- {@h} = Hit:
```

The example action entry is updated to:
```
"Melee Weapon Attack: `atk:STR` to hit, reach 5 ft., one target. {@h} `damage:2d6+STR` slashing damage plus `damage:1d6` fire damage."
```

Entity references (`{@spell}`, `{@creature}`, `{@condition}`, etc.) and formatting (`{@b}`, `{@i}`, `{@note}`) remain unchanged.

## Unit 2 — Enrichment Safety Net

### File: `src/ai/validation/entity-enrichment.ts`

### Monster enrichment

After existing enrichment logic in `enrichMonster`, iterate over all entry-bearing sections and run `convertDescToTags` with a real `ConversionContext`:

```ts
const sections: [string, ActionCategory][] = [
  ["traits", "trait"],
  ["actions", "action"],
  ["reactions", "reaction"],
  ["legendary", "legendary"],
  ["bonus_actions", "bonus"],
];

const abilities = enriched.abilities;
const profBonus = getProficiencyBonus(cr);
const spellAbility = detectSpellcastingAbility(enriched.traits);

for (const [key, category] of sections) {
  const features = enriched[key];
  if (!Array.isArray(features)) continue;
  for (const feature of features) {
    if (!Array.isArray(feature.entries)) continue;
    feature.entries = feature.entries.map((desc: string) =>
      convertDescToTags(desc, {
        abilities,
        profBonus,
        actionName: feature.name ?? "",
        actionCategory: category,
        spellAbility,
      })
    );
  }
}
```

This is the same pattern `normalizeSrdMonster` uses — identical function, identical context shape.

### Spell enrichment

After existing enrichment logic in `enrichSpell`, run `convertDescToTags` on `description` and `at_higher_levels` arrays with a dummy context that forces the static fallback path:

```ts
const STATIC_CONTEXT: ConversionContext = {
  abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  profBonus: 0,
  actionName: "",
  actionCategory: "trait",
};
```

With all ability mods at -5 and profBonus at 0, no computed attack/DC target matches any reasonable value. Every pattern match falls to the zero-candidates path, emitting static tags like `` `dc:15` ``, `` `atk:+7` ``, `` `damage:8d6` ``.

```ts
if (Array.isArray(enriched.description)) {
  enriched.description = enriched.description.map((p: string) =>
    convertDescToTags(p, STATIC_CONTEXT)
  );
}
if (Array.isArray(enriched.at_higher_levels)) {
  enriched.at_higher_levels = enriched.at_higher_levels.map((p: string) =>
    convertDescToTags(p, STATIC_CONTEXT)
  );
}
```

### Item enrichment

Same static context pattern on the `entries` array:

```ts
if (Array.isArray(enriched.entries)) {
  enriched.entries = enriched.entries.map((e: string) =>
    convertDescToTags(e, STATIC_CONTEXT)
  );
}
```

### Key properties

- **Idempotent.** `convertDescToTags` regexes skip backtick-wrapped content. Running on already-tagged input is a no-op.
- **Safe.** `convertDescToTags` never throws — try/catch returns the original string on any error.
- **Consistent.** Same converter function and approach used by the SRD pipeline. No parallel implementation.

## Interaction with existing pipeline

The enrichment conversion and render-time processing are complementary and don't interfere:

| Layer | What it does | When it runs |
|-------|-------------|--------------|
| **Enrichment (this spec)** | Tags attack/damage/DC/dice in stored entity data | Tool execution time |
| **`convert5eToolsTags`** | Converts 5etools `{@...}` tags to backtick format | Render time |
| **`decorateProseDice`** | Wraps remaining bare dice in `dice:…` tags | Render time |
| **`resolveFormulaTag`** | Resolves formula tags to display values | Render time |

All layers are idempotent. A tagged entry passes through `convert5eToolsTags` and `decorateProseDice` unchanged because their regexes skip backtick-wrapped content.

## Testing plan

### `tests/ai-entity-enrichment.test.ts` (new)

**Monster tests:**

- **Plain English entries** — monster with STR 16 (+3), prof +2, action entry `"Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage."`. Assert output contains `` `atk:STR` `` and `` `damage:1d8+STR` ``.
- **Already-tagged entries (no-op)** — monster with entries containing `` `atk:STR` `` and `` `damage:1d8+STR` ``. Assert output identical to input.
- **5etools entries pass through** — monster with entries like `"{@hit 5} to hit"`. The enrichment converter doesn't match `{@hit}` syntax (not plain English format). Assert unchanged. (These convert at render time via `convert5eToolsTags`.)
- **DC with ability word** — entry containing `"DC 13 Constitution saving throw"` with CON that matches. Assert `` `dc:CON` ``.
- **Multiple sections** — monster with actions, reactions, and traits. Assert all sections get converted.

**Spell tests:**

- **Static DC and dice** — description containing `"DC 15 Dexterity saving throw, taking 8d6 fire damage"`. Assert `` `dc:15` `` and `` `damage:8d6` ``.
- **Already-tagged description** — no-op, passes through.
- **at_higher_levels** — `"the damage increases by 1d6"`. Assert `` `dice:1d6` `` wrapping.
- **No mechanics text** — plain description text passes through unchanged.

**Item tests:**

- **Bare dice in entries** — `"deals an extra 2d6 fire damage"`. Assert `` `damage:2d6` `` wrapping.
- **Already-tagged entries** — no-op.
- **No mechanics text** — passes through unchanged.

## Build and deploy

```bash
npm run build && /bin/cp main.js styles.css manifest.json \
  /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/
```

Before committing:
- `npx vitest run` — all tests pass
- `gitnexus_detect_changes` — confirm only `entity-enrichment.ts`, `dndContext.ts`, and the new test file changed
