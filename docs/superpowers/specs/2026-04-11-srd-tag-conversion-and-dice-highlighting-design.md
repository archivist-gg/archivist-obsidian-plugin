# SRD Tag Conversion & Bare-Dice Highlighting

**Date:** 2026-04-11
**Branch:** `feat/compendium-reference-system` (pending; may be moved to a dedicated branch before implementation)
**Status:** Spec — awaiting user review, then implementation plan

## Summary

SRD monster content is currently imported as plain English (`"Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 21 (3d8 + 8) slashing damage"`) and stored verbatim in the in-memory entity registry. Action/trait mechanics are therefore disconnected from the monster's ability scores: changing STR from 30 to 20 does not update the `+14`. The existing formula-tag system (`` `atk:STR` ``, `` `dc:CHA` ``, `` `damage:3d8+STR` ``) already supports render-time derivation, but nothing in the SRD path emits these tags.

This spec adds two small, isolated units:

1. **`convertDescToTags`** — a pure function that converts SRD plain-English descriptions into tagged strings at import time using reverse-inference against the monster's own ability modifiers + proficiency bonus.
2. **`decorateProseDice`** — a pure function that wraps any bare dice notation (`1d6`, `37d8 + 259`) with synthetic `` `dice:…` `` backtick tags so the existing pill renderer picks them up automatically.

The existing pill rendering design (`.archivist-stat-tag-*` CSS, InlineTag widgets, `resolveFormulaTag`) is **not changed**. Only the vocabulary of content that flows into those existing rendering paths grows.

## Goals

- Every SRD monster action, reaction, legendary action, and trait entry has its attack bonuses, save DCs, and damage expressions expressed as formula tags after import.
- Formula tags produced by the converter resolve to the exact same numeric output the SRD text originally showed. Visual parity is mandatory.
- Bare dice notation in prose and in structured fields like HP formula renders as the same pill used for `` `dice:…` `` tags.
- The existing rendering path is untouched: same CSS, same widgets, same resolver.
- Import-time conversion runs once per plugin startup and is fully deterministic.
- User-authored content is unaffected. Only SRD-sourced content passes through the converter.

## Non-goals

- Redesigning the pill appearance, colors, icons, or tag vocabulary.
- Adding sub-token highlighting inside CM6 (focus-based decoration, Lezer grammar, etc.).
- Highlighting 5etools tags that today render as plain text (`{@condition}`, `{@spell}`, `{@creature}`, `{@b}`, etc.).
- Highlighting raw ability keywords (STR/DEX/CON/...) when they appear outside a tag.
- Adding derivation to spell or item stat blocks (their renderers still don't pass a `monsterCtx`).
- Cleaning up the dead `roll`/`d` alias entries in `INLINE_TAG_CONFIGS` (separate minor task).
- Introducing a shared dice AST or replacing the external Dice Roller plugin.

## Architecture

Two new files, each a pure function module with no state or side effects:

- **`src/entities/srd-tag-converter.ts`** — exports `convertDescToTags(desc, ctx): string` and supporting types. Used exclusively by `srd-normalizer.ts`.
- **`src/renderers/prose-decorator.ts`** — exports `decorateProseDice(text): string`. Used by `renderer-utils.ts` as a final step inside `convert5eToolsTags`, and by `monster-renderer.ts` when rendering the HP formula header.

Three existing files are modified at a single call site each:

- **`src/entities/srd-normalizer.ts`** — `normalizeSrdMonster()` calls the converter over every section's entries. Builds the `ConversionContext` from the monster's own ability scores, CR-derived proficiency bonus, optional detected spellcasting ability, action name, and section category.
- **`src/renderers/renderer-utils.ts`** — `convert5eToolsTags()` gets a new final step that calls `decorateProseDice(result)`. Pre-existing rewrites run first, so by the time the decorator runs, every `{@...}` has already been converted to backtick form. The lookbehind in the decorator regex naturally skips already-tagged dice.
- **`src/renderers/monster-renderer.ts`** — the HP formula header insertion point routes `hp.formula` through `decorateProseDice` and the existing inline-tag rendering helper.

No changes to:

- `src/parsers/inline-tag-parser.ts`
- `src/renderers/inline-tag-renderer.ts`
- `src/extensions/inline-tag-extension.ts` (CM6 widget replacer)
- `src/dnd/formula-tags.ts` (resolver)
- `src/dnd/math.ts`
- `src/styles/archivist-dnd.css`

## Unit 1 — SRD text-to-tag converter

### Contract

```ts
interface ConversionContext {
  abilities: {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
  };
  profBonus: number;                            // pre-computed from CR
  actionName: string;                           // e.g. "Starstrike Blade"
  actionCategory: "action" | "trait" | "reaction" | "legendary" | "bonus" | "special";
  spellAbility?: "int" | "wis" | "cha";         // optional, parsed from spellcasting trait
}

function convertDescToTags(desc: string, ctx: ConversionContext): string;
```

The function is pure, deterministic, and never throws. On any internal error it returns the original `desc` string unchanged.

### Precomputed lookup tables

Before scanning `desc`, the converter builds:

```ts
mods        = { str: floor((str-10)/2), dex: ..., ... }
atkTargets  = { str: mods.str + profBonus, dex: ..., ... }
dcTargets   = { str: 8 + profBonus + mods.str, dex: ..., ... }
```

### Conversion passes

Four passes run in a fixed order: **DC → Attack → Damage → Bare dice**. DC runs first because it's the safest (explicit ability word in the text), followed by attack (single signed number), damage (structured dice + optional bonus), and bare dice as the final sweep. Each pass only replaces text that earlier passes haven't touched. Running the converter on already-tagged content is a no-op because the regexes only match bare English prose.

**Pass 1 — Save DC**

Two sub-regexes, applied in order:

1. `/DC (\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/gi` — the ability word is right in the text. Match the ability to its `dcTargets[abil]`. If it equals `N`, emit `` `dc:ABIL` ABIL_NAME saving throw ``. If it doesn't, emit static `` `dc:N` ABIL_NAME saving throw ``.
2. `/DC (\d+)/g` — runs on whatever the first sub-regex didn't match (rare cases like `"spell save DC 17"`). Reverse-infer `N` against `dcTargets`. If `ctx.spellAbility` is set, prefer it when it's in the candidate list. Otherwise use the same disambiguation heuristics as Pass 2.

**Pass 2 — Attack bonus**

Regex: `/([+-])(\d+) to hit/g`

For each match with signed value `N`:

1. Collect `candidates = [abil for abil in abilities if atkTargets[abil] == N]`
2. If `candidates.length == 1`: emit `` `atk:ABIL` ``
3. If `candidates.length > 1`: disambiguate by action-name and category keywords (see "Disambiguation heuristics" below)
4. If `candidates.length == 0`: emit static `` `atk:+N` ``

The surrounding phrase "to hit" is dropped because the `atk` pill renders as `"+N to hit"` via `STAT_TAG_CONFIGS`.

**Pass 3 — Damage expressions**

Regex: `/(?:(\d+)\s*\()?(\d+d\d+)(?:\s*([+-])\s*(\d+))?\s*\)?(?:\s+(\w+))?\s*damage/gi`

This matches both `"21 (3d8 + 8) slashing damage"` and `"1d4 bludgeoning damage"`. Capture groups:

- `average` — the `21`, stripped from output (the pill re-computes it)
- `dice` — `3d8`
- `sign` + `bonus` — optional `+8`
- `type` — optional `slashing`

Logic:

1. If `bonus` is present and equals any `mods[abil]`, disambiguate using the same heuristics as Pass 2, then emit `` `damage:3d8+ABIL` slashing damage ``
2. If `bonus` is present but doesn't match any mod, emit `` `damage:3d8+8` slashing damage ``
3. If no `bonus`, emit `` `damage:3d8` slashing damage ``

**Pass 4 — Bare dice in prose**

Anything left over with dice notation that didn't match Passes 1–3 (e.g. `"roll 1d20 + your Wisdom modifier"` in a trait description) gets wrapped as `` `dice:NdN+N` ``. This is the same transform Unit 2 applies at render time, replicated at import time so the registry is consistent.

### Disambiguation heuristics

When multiple abilities match an attack or DC target value:

| Signal (searched in actionName or surrounding desc prefix) | Preferred ability |
|---|---|
| `"Melee Weapon Attack:"` | STR; fall back to DEX if STR not in candidates |
| `"Ranged Weapon Attack:"` | DEX |
| `"Melee Spell Attack:"` | `ctx.spellAbility` if set, else WIS |
| `"Ranged Spell Attack:"` | `ctx.spellAbility` if set, else WIS |
| `"Melee or Ranged Weapon Attack:"` | STR if in candidates, else DEX |
| actionName contains `Bow` / `Crossbow` / `Dart` / `Sling` | DEX |
| actionName contains `Bite` / `Claw` / `Slam` / `Tail` / `Gore` / `Horns` / `Fist` / `Hoof` / `Talons` | STR |
| actionName contains `Poison` / `Breath Weapon` / `Acid` / `Gaze` | CON (for DCs) |
| No signal matches | First candidate alphabetically (deterministic) |

The alphabetical fallback may occasionally be wrong. That is acceptable because ambiguity is rare when mod+prof collisions exist, and users can always edit the tag in place in edit mode. The alternative (leaving it static) loses the stat linkage entirely.

### Spellcasting ability detection

A small helper runs before the main loop:

```ts
function detectSpellcastingAbility(traits: Trait[]): "int" | "wis" | "cha" | undefined;
```

It scans trait entries for the phrase `"spellcasting ability is Intelligence|Wisdom|Charisma"`, case-insensitive, and returns the matched ability or `undefined`. This is best-effort: non-casters and casters whose traits use a different phrasing simply get `undefined`, which means Pass 4 falls back to the generic disambiguation path.

### Example trace

Input:

```
Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 21 (3d8 + 8) slashing damage plus 13 (3d8) lightning damage.
```

Context: STR 30 (+10), prof +4, so `atkTargets.str = +14`, `mods.str = 10`. Category: `action`. Action name: `"Longsword"`.

- Pass 1 (DC with word): no match
- Pass 2 (attack): `+14 to hit` → candidates={str} → `` `atk:STR` ``
- Pass 3 (damage): `21 (3d8 + 8) slashing damage` → `bonus=8`; no ability mod equals 8 → static `` `damage:3d8+8` slashing damage ``. Next: `13 (3d8) lightning damage` → no bonus → `` `damage:3d8` lightning damage ``. Average parentheticals stripped.
- Pass 4 (DC fallback): no match
- Pass 5 (bare dice): nothing left

Output:

```
Melee Weapon Attack: `atk:STR`, reach 10 ft., one target. Hit: `damage:3d8+8` slashing damage plus `damage:3d8` lightning damage.
```

When rendered: `` `atk:STR` `` → `"+14 to hit"` via `resolveFormulaTag` + `attackBonus`. Visual output is identical to the original SRD text, but now editing STR automatically updates the attack bonus.

## Unit 2 — Prose decorator

### Contract

```ts
function decorateProseDice(text: string): string;
```

Pure string-to-string. Wraps any bare dice notation not already inside a backtick tag with a synthetic `` `dice:…` `` tag.

### Pattern

```
/(?<![`\w])(\d+d\d+(?:\s*[+-]\s*\d+)?)(?![`\w])/g
```

- `(?<![`\w])` — must not be preceded by a backtick or word character (skip already-tagged, skip identifiers)
- `\d+d\d+` — dice core
- `(?:\s*[+-]\s*\d+)?` — optional signed modifier, tolerates spaces
- `(?![`\w])` — must not be followed by a backtick or word character

Each match's interior whitespace is normalized (`1d6 + 3` → `1d6+3`) before wrapping.

### Call sites

1. **`renderer-utils.ts::convert5eToolsTags`** — as the final step of the function, after all `{@...}` rewrites have finished. By this point every `{@damage}` / `{@hit}` / `{@dice}` / `{@d20}` has been converted to backtick form and is therefore protected from the decorator by the lookbehind.

2. **`monster-renderer.ts` HP header** — where `hp.formula` is inserted into the DOM, wrap the string through `decorateProseDice` and then pass through the existing inline-tag rendering helper so the synthetic dice tag becomes a real pill in the header.

3. **Other structured fields with dice formulas** — audited during implementation. Candidates include hit-dice in other stat-block locations and spell-cast dice notations if the plugin surfaces them. Applied selectively, same one-liner pattern.

### Interaction with Unit 1

After Unit 1 runs at import time, most SRD action prose already has its dice wrapped in `` `atk/damage/dc:…` `` tags. Unit 2 is a safety net for:

- User-authored content that doesn't use tags
- SRD content where Unit 1's reverse-inference couldn't match (Pass 5 handles this at import, Unit 2 handles the same pattern at render for user content)
- Structured fields like HP formula that Unit 1 doesn't process
- AI-generated content that happens to emit plain dice

Unit 1 and Unit 2 are independent and could ship separately. They share a consistent philosophy: always normalize bare patterns into the existing tag vocabulary; never invent a new rendering path.

## Data flow

### Load-time (once per plugin startup)

```
src/srd/data/monsters.json (open5e raw)
  │
  ▼
SrdStore.loadFromBundledJson()                       [unchanged]
  │
  ▼
normalizeSrdMonster(raw)                             [MODIFIED]
  │   ├─ copy stats, abilities, saves, skills (existing)
  │   ├─ profBonus = proficiencyBonusFromCR(raw.cr)
  │   ├─ spellAbility = detectSpellcastingAbility(traits)
  │   └─ for each section in [actions, reactions, legendary_actions,
  │                           bonus_actions, special_abilities]:
  │       for each entry:
  │         entry.entries = entry.entries.map(desc =>
  │           convertDescToTags(desc, {
  │             abilities, profBonus, spellAbility,
  │             actionName: entry.name,
  │             actionCategory: sectionName
  │           })
  │         )
  │
  ▼
Monster { actions: [{ name, entries: [taggedString, ...] }], ... }
  │
  ▼
In-memory entity registry (re-materialized on every load — no persistence)
```

### Render-time (per stat block, every re-render)

```
```monster``` fence
  │
  ▼
parseMonster(yamlSource)                             [unchanged]
  │
  ▼
renderMonsterBlock(monster, container)               [MODIFIED in 1 place]
  │   ├─ build monsterCtx = { abilities, profBonus }
  │   ├─ render header:
  │   │     HP formula "37d8 + 259"
  │   │       │
  │   │       ▼
  │   │     decorateProseDice(formula)               ◄── NEW CALL
  │   │       │
  │   │       ▼
  │   │     "`dice:37d8+259`"
  │   │       │
  │   │       ▼
  │   │     existing inline-tag rendering helper
  │   │
  │   └─ for each action/reaction/trait/legendary entry:
  │         renderTextWithInlineTags(text, container, statBlockMode=true, monsterCtx)
  │           │
  │           ▼
  │         convert5eToolsTags(text)                 [MODIFIED: adds final step]
  │           │   ├─ existing: rewrite {@damage/@hit/@dc/@dice/@d20} → backtick
  │           │   ├─ existing: rewrite {@recharge/@condition/@spell/@b/@i/...}
  │           │   └─ decorateProseDice(result)       ◄── NEW FINAL STEP
  │           │
  │           ▼
  │         tokenize on backtick tags
  │           │
  │           ▼
  │         resolveFormulaTag(tag, monsterCtx) → pill content
  │           atk:STR          → "+14 to hit"
  │           damage:3d8+STR   → "3d8 + 10"
  │           dc:CHA           → "DC 20"
  │           dice:37d8+259    → "37d8+259"
  │
  ▼
DOM stat block with pills (using existing .archivist-stat-tag-* CSS)
```

### Invariants

- **Single derivation source.** `resolveFormulaTag` is the only code that computes pill values. The converter emits tags; the resolver resolves them.
- **Idempotent at every boundary.** `convertDescToTags` on already-tagged input is a no-op (regexes don't match backtick-wrapped content). `decorateProseDice` on already-tagged input is a no-op (lookbehind rejects backticks).
- **No persistence migration.** SRD entities are re-materialized from bundled JSON on every startup. The converter runs on every load but the raw JSON is never modified. User-vault entities are untouched.
- **No visual redesign.** Every new pill produced by the pipeline uses the same CSS classes and widget rendering that existed before this change.
- **Write path unchanged.** User-authored YAML flows directly through `monster-parser.ts` to the renderer. The converter never runs on user content.

## Error handling and edge cases

### Converter defensive behavior

- Top-level `try { ... } catch { return desc }` wrapper. The converter never throws.
- Missing `ctx.abilities`: skip conversion, log a one-line warning, return `desc` unchanged.
- `proficiencyBonusFromCR` returns `NaN`: fall back to `2` (matches PHB level-1 default).
- Zero candidates for attack or DC: emit the static form, numbers preserved.
- Multiple candidates with no heuristic match: deterministic alphabetical fallback. Documented in the converter's doc-comment.
- `detectSpellcastingAbility` returning `undefined` is normal and must be handled by callers.

### Prose decorator edge cases

- Identifiers like `abc1d6xyz` or `1d3d1`: rejected by word-character lookahead/lookbehind.
- Already-tagged dice (inside backticks): rejected by backtick lookbehind.
- Pseudo-dice without a size (`3d` alone): regex requires `\d+d\d+`, no match.
- Huge dice pools like `37d8 + 259`: match fine.
- Negative modifiers like `1d6-1`: `[+-]` handles both signs.
- Multiple dice in one sentence: `g` flag processes each independently.
- Non-standard dice grammar (advantage, `kh1`, `r1`, fractional): not supported; falls through as plain prose next to any wrapped matches.

### Render pipeline safety

- `resolveFormulaTag` already handles unknown content — returns the original string. Since Unit 1's fallback always emits syntactically valid tags, the resolver never sees broken input from our code.
- A synthetic `` `dice:…` `` tag from Unit 2 whose content the resolver doesn't understand still renders as a dice pill with the bare string inside. Worst case: identical to the un-decorated output, just wrapped in a pill.

### Real SRD data samples we must handle

From `src/srd/data/monsters.json`:

1. `"Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 21 (3d8 + 8) slashing damage plus 13 (3d8) lightning damage."`
2. `"The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12, +4 to hit with spell attacks)."`
3. `"Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage."`
4. `"... DC 11 Strength saving throw or be knocked prone."`
5. Spellcaster descriptions listing spell slots as prose (`"1st level (3 slots): bless, cure wounds, sanctuary"`) — contain no mechanics patterns and pass through unchanged.

These are the fixtures the regression tests must cover.

## Testing plan

All tests use Vitest (existing infrastructure). No new dependencies.

### `tests/srd-tag-converter.test.ts` (new)

Fixture-based tests for Unit 1. Each fixture is `{ desc, ctx, expected }`. Fixtures use real snippets from `src/srd/data/monsters.json` so the tests double as documentation.

Cases:
- Simple melee: `+N to hit` matches STR exactly → `` `atk:STR` ``
- Ranged with DEX: `Ranged Weapon Attack: +N to hit` → `` `atk:DEX` ``
- Finesse ambiguity: STR and DEX both match → STR for melee, DEX for ranged
- DC with ability word: `DC 15 Constitution saving throw` → `` `dc:CON` ``
- Spell save DC: `spell save DC 17` with `ctx.spellAbility="wis"` → `` `dc:WIS` ``
- Damage with ability bonus: `3d8 + 8 slashing` where STR mod = 8 → `` `damage:3d8+STR` slashing ``
- Damage with non-ability bonus: `2d6 + 5 fire` where no mod equals 5 → `` `damage:2d6+5` fire ``
- Damage without bonus: `1d4 acid damage` → `` `damage:1d4` acid damage ``
- Zero-candidates fallback: manufactured case → static `` `atk:+N` ``
- Idempotency: running the converter twice produces the same output as running it once
- Missing abilities: `ctx.abilities = undefined` returns input unchanged
- Regression fixtures: Goblin Scimitar, Wolf Bite, Giant Spider Bite, Balor Longsword, Acolyte spellcasting block (each with the full expected tagged output committed to the test)

### `tests/prose-decorator.test.ts` (new)

- Bare `1d6` → `` `dice:1d6` ``
- Bare `2d6+3` → `` `dice:2d6+3` ``
- Bare `37d8 + 259` → `` `dice:37d8+259` `` (whitespace normalized)
- Already-tagged `` `damage:1d6+3` `` → unchanged
- Inside identifier `abc1d6xyz` → unchanged
- Inside content that was previously rewritten from 5etools form → unchanged
- Multiple independent dice in one string → all wrapped
- Non-dice text → unchanged

### `tests/srd-normalizer-integration.test.ts` (new)

- Load a curated mini-SRD fixture (Goblin, Giant Spider, Balor, Acolyte, and one explicit spellcaster).
- Run `normalizeSrdMonster` on each.
- Assert: every action/reaction/legendary/trait entry contains at least one formula tag **or** an explicit static fallback.
- Snapshot the normalized output; future regressions show up as git diffs.

### Renderer smoke tests

Extend `tests/monster-renderer.test.ts` (or add `tests/hp-formula-dice-decoration.test.ts`):

- Render a monster with `hp.formula = "37d8 + 259"`; assert a `.archivist-stat-tag-dice` element exists and its text content includes `37d8+259`.
- Render a monster with an entry containing bare `1d6`; assert the decorator wrapped it and it rendered as a dice pill.

## Build and deploy

Per `CLAUDE.md`:

```bash
npm run build && /bin/cp main.js styles.css manifest.json \
  /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/
```

Before committing:

- `npx vitest run` — all tests pass
- `gitnexus_detect_changes` — confirm the change scope matches expectations (only the files listed in "Architecture" above)
- `gitnexus_impact` on `normalizeSrdMonster`, `convert5eToolsTags`, and any HP formula render helper before editing them

## Open items for the implementation plan

- Enumerate every render site that currently emits `hp.formula` so the decorator is applied uniformly.
- Decide whether `detectSpellcastingAbility` should also parse innate spellcasting traits (they use slightly different phrasing).
- Confirm that the Vitest test runner picks up the new test files without additional configuration.
- Verify the converter handles "two-headed" monster attacks like `"Hit: 21 (3d8 + 8) slashing damage plus 13 (3d8) lightning damage"` as a single pass (the test fixture covers it, but double-check the regex's global flag behavior inside a single pass).
