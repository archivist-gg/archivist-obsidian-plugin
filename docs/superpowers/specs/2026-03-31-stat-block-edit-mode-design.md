# Stat Block Edit Mode & D&D 5e Math Engine

## Decision

Build on our own system (Approach 2). Fantasy Statblocks was evaluated and rejected: it lacks edit mode, has no D&D math engine, only supports monsters (no spells/items), has known crash/performance bugs, and its strengths (custom layouts, multi-system support) are features we don't need. Our typed parser/renderer pipeline is a better foundation for edit mode with auto-calculating math.

## Goal

Add inline edit mode to monster stat blocks with a D&D 5e math engine that auto-recalculates derived values when ability scores, CR, or proficiency change. Extend the inline tag system with formula-based tags that bind action text to ability scores. Add multi-column toggle. Add simple field editing for spells and items.

## Scope

### In Scope
- D&D 5e math engine (pure functions, no DOM dependencies)
- Monster edit mode: inline editing on the rendered stat block
- Always-on auto-calculate with per-field override
- Extended formula tags (`atk:DEX`, `damage:1d6+DEX`, `dc:WIS`)
- Backtick autocomplete for formula tags in action text
- Bidirectional YAML sync (edit mode writes back to code fence)
- Save to Compendium (create/update vault entity note)
- Multi-column toggle for large monsters
- Simple field editing for spells and items (no cascading math)
- Section management (add/remove Traits, Actions, Reactions, Legendary, Lair, Bonus, Mythic)

### Out of Scope
- Custom layout engine (no user-defined layouts)
- Multi-system support (D&D 5e only)
- Conditional rendering / ifelse blocks
- Importers from external sources
- Plugin API for third-party consumers
- CR-to-stats derivation (CR determines proficiency bonus, not ability scores)

---

## Architecture

### 1. D&D 5e Math Engine

A pure-function module at `src/dnd/math.ts` with zero DOM dependencies. Every function takes inputs and returns outputs.

#### Constants (`src/dnd/constants.ts`)

```typescript
// CR -> Proficiency Bonus lookup
const CR_PROFICIENCY: Record<string, number> = {
  "0": 2, "1/8": 2, "1/4": 2, "1/2": 2,
  "1": 2, "2": 2, "3": 2, "4": 2,
  "5": 3, "6": 3, "7": 3, "8": 3,
  "9": 4, "10": 4, "11": 4, "12": 4,
  "13": 5, "14": 5, "15": 5, "16": 5,
  "17": 6, "18": 6, "19": 6, "20": 6,
  "21": 7, "22": 7, "23": 7, "24": 7,
  "25": 8, "26": 8, "27": 8, "28": 8,
  "29": 9, "30": 9,
};

// CR -> XP lookup
const CR_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100,
  "5": 1800, "6": 2300, "7": 2900, "8": 3900,
  "9": 5000, "10": 5900, "11": 7200, "12": 8400,
  "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000,
  "25": 75000, "26": 90000, "27": 105000, "28": 120000,
  "29": 135000, "30": 155000,
};

// Creature Size -> Hit Dice Size
const SIZE_HIT_DICE: Record<string, number> = {
  tiny: 4, small: 6, medium: 8, large: 10, huge: 12, gargantuan: 20,
};

// Skill -> Governing Ability
const SKILL_ABILITY: Record<string, string> = {
  acrobatics: "dex", "animal handling": "wis", arcana: "int",
  athletics: "str", deception: "cha", history: "int",
  insight: "wis", intimidation: "cha", investigation: "int",
  medicine: "wis", nature: "int", perception: "wis",
  performance: "cha", persuasion: "cha", religion: "int",
  "sleight of hand": "dex", stealth: "dex", survival: "wis",
};
```

#### Pure Math Functions (`src/dnd/math.ts`)

```typescript
function abilityModifier(score: number): number;
  // Math.floor((score - 10) / 2)

function proficiencyBonusFromCR(cr: string): number;
  // Lookup from CR_PROFICIENCY table

function crToXP(cr: string): number;
  // Lookup from CR_XP table

function hitDiceSizeFromCreatureSize(size: string): number;
  // Lookup from SIZE_HIT_DICE, default 8

function hpFromHitDice(hitDiceCount: number, hitDiceSize: number, conMod: number): number;
  // Math.floor(hitDiceCount * (hitDiceSize + 1) / 2 + hitDiceCount * conMod)

function savingThrow(abilityScore: number, isProficient: boolean, profBonus: number): number;
  // abilityModifier(abilityScore) + (isProficient ? profBonus : 0)

function skillBonus(abilityScore: number, proficiency: "none" | "proficient" | "expertise", profBonus: number): number;
  // abilityModifier(abilityScore) + (expertise ? profBonus*2 : proficient ? profBonus : 0)

function passivePerception(wisScore: number, perceptionProf: "none" | "proficient" | "expertise", profBonus: number): number;
  // 10 + skillBonus(wisScore, perceptionProf, profBonus)

function attackBonus(abilityScore: number, profBonus: number): number;
  // abilityModifier(abilityScore) + profBonus

function saveDC(abilityScore: number, profBonus: number): number;
  // 8 + profBonus + abilityModifier(abilityScore)

function abilityNameToKey(name: string): keyof MonsterAbilities | null;
  // "STR" -> "str", "DEX" -> "dex", etc.
```

#### Recalculation Orchestrator (`src/dnd/recalculate.ts`)

```typescript
function recalculate(monster: EditableMonster, changedField: string): EditableMonster;
```

Takes the current monster state and the field that changed. Returns a new monster with all derived values recalculated. Respects the override map -- overridden fields are never touched.

**Dependency graph:**

```
abilities.* changes ->
  All ability modifiers recalculate
  All non-overridden saves recalculate
  All non-overridden skills recalculate
  Passive Perception recalculates (if not overridden)
  HP recalculates from hit dice + new CON mod (if not overridden)
  All formula tags in action text recalculate

cr changes ->
  Proficiency bonus derives from CR (if not overridden)
  XP derives from CR (if not overridden)
  All non-overridden saves recalculate
  All non-overridden skills recalculate
  Passive Perception recalculates (if not overridden)
  All formula tags recalculate

size changes ->
  Hit dice size updates (Small=d6, Medium=d8, etc.)
  HP recalculates (if not overridden)
```

---

### 2. Editable Monster State

Extended monster type for edit mode at `src/dnd/editable-monster.ts`:

```typescript
interface EditableMonster extends Monster {
  overrides: Set<string>;
  // Tracks which fields are manually overridden.
  // e.g., "hp", "saves.dex", "skills.stealth", "passive_perception", "xp"
  // Overridden fields are LOCKED -- they do not recalculate when
  // other fields change. Click the asterisk (*) to unlock.

  saveProficiencies: Record<string, boolean>;
  // Which saves are proficient (toggle state).
  // e.g., { dex: true, wis: false, ... }

  skillProficiencies: Record<string, "none" | "proficient" | "expertise">;
  // Proficiency level per skill.
  // e.g., { stealth: "expertise", perception: "proficient", ... }

  activeSenses: Record<string, string | null>;
  // Active senses with ranges.
  // e.g., { blindsight: null, darkvision: "60 ft.", tremorsense: null, truesight: null }

  customSenses: Array<{ name: string; range: string }>;
  // User-added custom senses.
  // e.g., [{ name: "Devil's Sight", range: "120 ft." }]

  activeSections: string[];
  // Which tab sections are present.
  // e.g., ["traits", "actions", "reactions", "legendary"]

  xp?: number;
  // Auto-calculated from CR, overridable.

  proficiencyBonus?: number;
  // Auto-calculated from CR.
}
```

**Conversion functions:**
- `monsterToEditable(monster: Monster): EditableMonster` -- infers proficiencies, senses, sections from the parsed data
- `editableToMonster(editable: EditableMonster): Monster` -- converts back to the serializable Monster type
- `editableToYaml(editable: EditableMonster): string` -- serializes to YAML for writing back to the code fence

---

### 3. Extended Formula Tags

#### Tag Syntax

Extend `src/parsers/inline-tag-parser.ts` to detect ability names in tag content:

```typescript
// Existing static tags (unchanged):
`atk:+4`         -> { type: "atk", content: "+4", formula: null }
`damage:1d6+2`   -> { type: "damage", content: "1d6+2", formula: null }
`dc:15`          -> { type: "dc", content: "15", formula: null }

// New formula tags (ability name detected):
`atk:DEX`        -> { type: "atk", content: "DEX", formula: { ability: "dex", kind: "attack" } }
`damage:1d6+DEX` -> { type: "damage", content: "1d6+DEX", formula: { ability: "dex", kind: "damage" } }
`dc:WIS`         -> { type: "dc", content: "WIS", formula: { ability: "wis", kind: "dc" } }
```

**Detection rule:** If the tag content (after the colon) contains one of STR, DEX, CON, INT, WIS, CHA (case-insensitive), it's a formula tag. Otherwise it's a static value. Fully backwards compatible.

#### Formula Resolution

```typescript
function resolveFormulaTag(tag: InlineTag, monster: EditableMonster): string;
```

- `atk:DEX` -> `abilityModifier(monster.abilities.dex) + monster.proficiencyBonus` -> "+4"
- `damage:1d6+DEX` -> replace "DEX" with `abilityModifier(monster.abilities.dex)` -> "1d6+2"
- `dc:WIS` -> `8 + monster.proficiencyBonus + abilityModifier(monster.abilities.wis)` -> "DC 9"

#### Rendering

- **View mode:** Formula tags render identically to static tags (calculated value, clickable to roll via Javalent Dice Roller). No formula visible.
- **Edit mode (hover):** Hovering a formula tag shows a tooltip with the formula breakdown: "DEX +2 + Prof +2 = +4".
- **Edit mode (recalculation):** When ability scores or proficiency change, all formula tags in all action/trait entries are resolved again. The rendered text updates live with a 0.4s highlight animation.

---

### 4. Backtick Autocomplete

New module at `src/edit/tag-autocomplete.ts`.

**Trigger:** When the user types a backtick (`` ` ``) inside an action/trait textarea in edit mode.

**Dropdown contents (grouped):**

| Group | Tag | Description | Preview |
|-------|-----|-------------|---------|
| Attack | `` `atk:STR` `` | STR + Prof | +1 |
| Attack | `` `atk:DEX` `` | DEX + Prof | +4 |
| Attack | `` `atk:CON` `` | CON + Prof | +2 |
| Attack | `` `atk:INT` `` | INT + Prof | +2 |
| Attack | `` `atk:WIS` `` | WIS + Prof | +1 |
| Attack | `` `atk:CHA` `` | CHA + Prof | +1 |
| Damage | `` `damage:_d_+STR` `` | Dice + STR mod | _d_-1 |
| Damage | `` `damage:_d_+DEX` `` | Dice + DEX mod | _d_+2 |
| Save DC | `` `dc:STR` `` | 8 + Prof + STR | DC 9 |
| Save DC | `` `dc:DEX` `` | 8 + Prof + DEX | DC 12 |
| Save DC | `` `dc:CON` `` | 8 + Prof + CON | DC 10 |
| Save DC | `` `dc:INT` `` | 8 + Prof + INT | DC 10 |
| Save DC | `` `dc:WIS` `` | 8 + Prof + WIS | DC 9 |
| Save DC | `` `dc:CHA` `` | 8 + Prof + CHA | DC 9 |
| Static | `` `dice:_d_` `` | Roll dice (no stat) | |
| Static | `` `atk:+_` `` | Static attack bonus | |
| Static | `` `damage:_d_+_` `` | Static damage | |
| Static | `` `dc:_` `` | Static save DC | |

Preview values are **live-calculated** from the current monster's ability scores and proficiency bonus. `_d_` and `_` are placeholders the user fills in after insertion.

**Interaction:**
1. Type `` ` `` -> dropdown opens
2. Type to filter (e.g., `` `atk `` filters to attack options)
3. Arrow keys to navigate, Enter to select
4. Selection inserts the full tag with closing backtick
5. For damage/static templates, cursor is placed at the placeholder position

---

### 5. Edit Mode UI

#### Activation

The edit button sits in the Obsidian side button stack, between the `</>` source button and the trash button. Order: `</>` | Columns | Edit | Trash. All buttons use 28x28px squares with 4px gap.

Clicking the edit button:
1. The stat block gets a `2px solid #922610` outline with `2px` offset
2. All display text transforms to editable inputs inline
3. The side buttons remain as `</>` | Columns | Edit (active, crimson fill) | Trash

When the user makes any change, the side buttons swap to the save state:
- **Save** (green checkmark `#5cb85c`) -- writes changes back to the YAML code fence
- **Compendium** (tan/gold book icon `#d9c484`) -- saves to vault entity note
- **Cancel** (muted X) -- discards changes, exits edit mode

#### Input Styling

All inputs follow the Archivist design system:
- **Text inputs:** Transparent background, dashed bottom-border (`1px dashed #d9c484`). Focus changes border to solid `#922610`. No white background flash.
- **Number inputs:** Custom up/down triangle spinners inside dashed-border boxes. No browser native arrows. Used for AC, Speed, and all ability scores.
- **Dropdowns:** Same dashed bottom-border with custom crimson chevron SVG arrow. Used for Size, Alignment (two dropdowns: ethical axis + moral axis), and CR (0 through 30).
- **Textareas:** `rgba(253,241,220,0.6)` background (parchment-toned), `1px solid #d9c484` border. Used for action/trait descriptions.

#### Editable Sections

**Header:**
- Name: full-width text input, Libre Baskerville 25px small-caps
- Size: dropdown (Tiny through Gargantuan)
- Type: text input ("Humanoid")
- Alignment: two dropdowns (Lawful/Neutral/Chaotic/Unaligned/Any + Good/Evil/Neutral)

**Core Properties:**
- AC: number input with spinner + text input for source ("leather armor, shield")
- HP: auto-calculated value (click to override) + hit dice formula input ("2d6"). Shows "(auto)" label. Hover tooltip shows full formula.
- Speed: number input with spinner + "ft."

**Ability Scores:**
- Six number inputs with custom spinners in a table layout
- Modifiers shown as read-only text below each input
- Changing any score triggers full recalculation cascade

**Saving Throws (collapsible, chevron on left):**
- 3-column grid with all 6 abilities
- Proficiency toggle square for each (none -> proficient -> none cycle)
- Values are auto-calculated: ability mod + (proficient ? prof bonus : 0)
- All values clickable to override

**Skills (collapsible, chevron on left):**
- 2-column grid with all 18 skills
- Proficiency toggle for each (none -> proficient -> expertise -> none cycle)
- All skills show calculated default values (ability modifier for non-proficient, mod + prof for proficient, mod + prof*2 for expertise)
- All values clickable to override

**Senses (collapsible, chevron on left):**
- 2-column grid with 4 standard senses (Blindsight, Darkvision, Tremorsense, Truesight)
- Toggle circle for each; active senses get a range input
- Custom senses: name input + range input + X to remove
- "+ Add Custom Sense" button (full width, matches "+ Add Action" style)
- Passive Perception: auto-calculated with formula label, clickable to override

**Languages:** text input

**Challenge:** dropdown (CR 0-30), XP auto-calculated with "(auto)" label, clickable to override

**Sections (tab bar):**
- Tab bar with all active sections as tabs
- Scrollable horizontally when many tabs are present (`overflow-x: auto`)
- "+" button at the end (18px bold) opens a dropdown listing all available section types
- Already-added sections are grayed/struck-through in the dropdown
- Available sections: Traits, Actions, Reactions, Bonus Actions, Legendary Actions, Lair Actions, Mythic Actions
- Sections can be removed via right-click on the tab

**Features (Actions, Traits, etc.):**
- Each feature is a card with `1px solid #d9c484` border, `rgba(244,228,193,0.4)` background
- X button in top-right corner of the card (22x22px)
- Feature name: bottom-border-only dashed input, bold italic
- Feature text: parchment-toned textarea with formula tag support
- "+ Add Action" button (full width) at the bottom of each tab

---

### 6. Multi-Column Toggle

A column toggle button in the Obsidian side button stack (between `</>` and Edit). Renders as two rectangles icon.

**Behavior:**
- Click toggles between single-column and two-column layout
- Multi-column uses CSS `columns: 2` with height-based content distribution
- A plugin setting controls the default mode for "big" blocks (monsters with more than N lines of content)
- The toggle state is per-block and persists in the monster's YAML as `columns: 1` or `columns: 2`

**Settings:**
- `defaultMultiColumn`: boolean (default: false) -- whether large blocks auto-render in two columns
- `multiColumnThreshold`: number (default: 20) -- minimum content lines to trigger auto two-column

---

### 7. Bidirectional YAML Sync

When the user clicks Save (green checkmark):

1. `editableToYaml(monster)` serializes the current editable state to YAML
2. `ctx.getSectionInfo(el)` gets the code fence line range
3. The YAML is wrapped in ` ```monster\n...\n``` ` fences
4. `editor.replaceRange(newContent, from, to)` writes back to the markdown source
5. Obsidian's code block processor re-renders the block

When the user clicks Add to Compendium (book icon):

1. `editableToMonster(monster)` converts to the serializable Monster type
2. `generateEntityMarkdown(entity)` creates an Obsidian note with frontmatter
3. The note is written to `{compendiumRoot}/{userEntityFolder}/Monsters/{name}.md`
4. `entityRegistry.register(entity)` adds it to the in-memory registry

Both actions can be used independently or together.

---

### 8. Spell & Item Simple Editing

Spells and items get basic field editing without cascading math:

**Spell edit mode:**
- Name, level, school, casting time, range, components, duration: inline inputs/dropdowns
- Concentration, ritual: toggle checkboxes
- Description, at higher levels: textareas
- Classes: comma-separated text input

**Item edit mode:**
- Name, type, rarity, weight, value: inline inputs/dropdowns
- Attunement: toggle + optional text input for condition
- Damage, damage type, properties: inputs
- Charges, recharge: inputs
- Curse: toggle
- Description entries: textarea

Same save flow (side buttons swap to save/compendium/cancel). Same bidirectional YAML sync.

---

### 9. Override System

Any auto-calculated field can be manually overridden:

1. **Click** on an auto-calculated value (HP, XP, any save, any skill, passive Perception)
2. The value becomes an editable input
3. Typing a manual value adds the field to the `overrides` set
4. An asterisk (*) appears next to the value in superscript crimson
5. The overridden value is **locked** -- it does NOT recalculate when other fields change
6. **Click the asterisk** to remove the override, unlock the field, and recalculate immediately

Formula tags in action text can also be overridden: click the tag, replace with a static value (e.g., change `atk:DEX` to `atk:+5`).

---

## File Structure

```
src/dnd/
  constants.ts          -- CR tables, size tables, skill-ability map
  math.ts               -- Pure math functions (modifier, save, skill, HP, DC, attack)
  recalculate.ts        -- Orchestrator: cascades changes through dependency graph
  editable-monster.ts   -- EditableMonster type + conversion functions
  formula-tags.ts       -- Formula tag detection, resolution, recalculation

src/edit/
  monster-edit-mode.ts  -- Edit mode controller: activates/deactivates, manages state
  monster-edit-render.ts -- Renders edit mode UI (inputs, toggles, grids, etc.)
  spell-edit-mode.ts    -- Spell edit mode (simple field editing)
  item-edit-mode.ts     -- Item edit mode (simple field editing)
  tag-autocomplete.ts   -- Backtick autocomplete dropdown for formula tags
  yaml-serializer.ts    -- EditableMonster -> YAML string
  side-buttons.ts       -- Side button state management (default/editing/save)
  multi-column.ts       -- Column toggle logic + CSS class management

src/styles/
  archivist-edit.css    -- All edit mode CSS (inputs, toggles, grids, cards, buttons)
```

---

## Visual Design Reference

Mockups at `.superpowers/brainstorm/57430-*/content/edit-mode-v8.html`. Key design decisions:

- **Parchment-first:** All edit UI sits on the parchment background. No white backgrounds anywhere.
- **Dashed borders signal editability:** Text inputs use `1px dashed #d9c484`. Focus changes to solid `#922610`.
- **Custom spinners everywhere:** All number inputs (AC, Speed, abilities) use triangle up/down buttons. No browser native arrows.
- **D&D color palette on dark mode:** Side buttons use crimson/tan/muted tones that work on Obsidian's dark background. Save is green.
- **Collapsible sections:** Chevron on the LEFT side of the title. Saves = 3-column grid, Skills = 2-column grid, Senses = 2-column grid.
- **Feature cards:** Bordered cards with parchment-tinted background. X in top-right corner.
- **Always-on auto-calculate:** No toggle. All derived values recalculate automatically. Overrides lock individual fields.
- **Scrollable tabs:** Tab bar scrolls horizontally. "+" button is prominent (18px bold).
