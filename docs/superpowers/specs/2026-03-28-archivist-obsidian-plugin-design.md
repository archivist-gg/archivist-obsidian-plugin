# Archivist Obsidian Plugin — Design Spec

An Obsidian plugin that brings archivist's TTRPG content rendering into Obsidian. Monster stat blocks, spell blocks, magic item blocks, and inline DnD tags — all rendered with archivist's exact visual design (parchment theme, D&D 5e styling). No AI features, no custom saving, no settings.

## Scope

**In scope:**
- Monster stat block rendering (fenced code blocks)
- Spell block rendering (fenced code blocks)
- Magic item block rendering (fenced code blocks)
- Inline DnD tags (backtick-prefix pattern)
- Modal forms for guided block creation
- Command palette commands for inserting blocks

**Out of scope:**
- AI abilities (archivist's chat/GPT features)
- Saving system (Obsidian handles its own persistence)
- Dice rolling system (deferred to future version)
- Wiki link customization (use Obsidian's native `[[]]`)
- Settings/configuration panel
- Compendium/SRD database (entities are self-contained in YAML)

## Architecture

Single monolithic Obsidian plugin. All features ship together, no configuration needed.

### Tech Stack
- TypeScript
- Obsidian Plugin API
- esbuild (standard Obsidian plugin bundler)
- CodeMirror 6 extensions (live preview inline tags)
- Obsidian's `MarkdownPostProcessor` (reading view rendering)

### Internal Structure

```
src/
├── main.ts                    # Plugin entry, registers all processors/commands
├── types/
│   ├── monster.ts             # Monster YAML schema type
│   ├── spell.ts               # Spell YAML schema type
│   └── item.ts                # Item YAML schema type
├── parsers/
│   ├── monster-parser.ts      # YAML → Monster object
│   ├── spell-parser.ts        # YAML → Spell object
│   ├── item-parser.ts         # YAML → Item object
│   └── inline-tag-parser.ts   # Backtick-prefix tag parsing
├── renderers/
│   ├── monster-renderer.ts    # Monster → styled HTML DOM
│   ├── spell-renderer.ts      # Spell → styled HTML DOM
│   ├── item-renderer.ts       # Item → styled HTML DOM
│   └── inline-tag-renderer.ts # Tag → styled inline element
├── modals/
│   ├── monster-modal.ts       # Monster creation form
│   ├── spell-modal.ts         # Spell creation form
│   └── item-modal.ts          # Item creation form
├── extensions/
│   └── inline-tag-extension.ts # CM6 ViewPlugin for live preview
└── styles/
    ├── blocks.css             # Stat block styles (ported from archivist)
    ├── inline-tags.css        # Inline tag badge styles (ported from archivist)
    └── modals.css             # Modal form styles
```

### Obsidian Integration Points

- **Fenced code blocks** (`monster`, `spell`, `item`): registered via `registerMarkdownCodeBlockProcessor`
- **Inline tags** (`` `dice:2d6+3` ``): CodeMirror 6 `ViewPlugin` for live preview + `MarkdownPostProcessor` for reading view
- **Commands**: registered via `addCommand` for block insertion
- **Modals**: Obsidian's `Modal` class for creation forms
- **Icons**: Obsidian's built-in `setIcon()` API (Lucide icons — same library archivist uses)

## Code Block Syntax

All blocks use fenced code blocks with YAML inside. Only `name` is required — all other fields are optional. Partial stat blocks are valid.

### Monster Block

````yaml
```monster
name: Ancient Red Dragon
size: Gargantuan
type: Dragon
alignment: Chaotic Evil
cr: 24
ac:
  - ac: 22
    from: [natural armor]
hp:
  average: 546
  formula: 28d20+252
speed:
  walk: 40
  fly: 80
  climb: 40
abilities:
  str: 30
  dex: 10
  con: 29
  int: 18
  wis: 15
  cha: 23
saves:
  dex: 7
  con: 16
  wis: 9
  cha: 13
skills:
  Perception: 16
  Stealth: 7
senses: [blindsight 60 ft., darkvision 120 ft.]
passive_perception: 26
languages: [Common, Draconic]
damage_resistances: []
damage_immunities: [fire]
condition_immunities: [frightened]
legendary_actions: 3
legendary_resistance: 3
traits:
  - name: Legendary Resistance (3/Day)
    entries:
      - If the dragon fails a saving throw, it can choose to succeed instead.
actions:
  - name: Multiattack
    entries:
      - "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws."
  - name: Fire Breath (Recharge 5-6)
    entries:
      - "The dragon exhales fire in a 90-foot cone. Each creature in that area must make a DC 24 Dexterity saving throw, taking `dice:26d6` fire damage on a failed save, or half as much on a success."
reactions:
  - name: Tail Attack
    entries:
      - The dragon makes a tail attack.
legendary:
  - name: Detect
    entries:
      - The dragon makes a Wisdom (Perception) check.
  - name: Wing Attack (Costs 2 Actions)
    entries:
      - "The dragon beats its wings. Each creature within 15 ft. must succeed on a DC 25 Dexterity saving throw or take `dice:2d6+10` bludgeoning damage."
```
````

### Spell Block

````yaml
```spell
name: Fireball
level: 3
school: Evocation
casting_time: 1 action
range: 150 feet
components: V, S, M (a tiny ball of bat guano and sulfur)
duration: Instantaneous
concentration: false
ritual: false
classes: [Sorcerer, Wizard]
description:
  - "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes `dice:8d6` fire damage on a failed save, or half as much damage on a successful one."
at_higher_levels:
  - "When you cast this spell using a spell slot of 4th level or higher, the damage increases by `dice:1d6` for each slot level above 3rd."
```
````

### Magic Item Block

````yaml
```item
name: Flame Tongue Longsword
type: Weapon (longsword)
rarity: Rare
attunement: true
weight: 3
damage: 1d8
damage_type: slashing
properties: [Versatile (1d10)]
charges: null
recharge: null
curse: false
entries:
  - "You can use a bonus action to speak this magic sword's command word, causing flames to erupt from the blade. These flames shed bright light in a 40-foot radius and dim light for an additional 40 feet. While the sword is ablaze, it deals an extra `dice:2d6` fire damage to any target it hits."
```
````

### Data Model Design Decisions

- YAML over JSON: more readable, easier to hand-edit, natural for Obsidian users
- Snake_case for multi-word fields (YAML convention)
- Inline tags (`` `dice:2d6` ``) work inside entry text, composing naturally with stat blocks
- All fields optional except `name`: partial stat blocks are valid
- Arrays of strings for entries/descriptions (matches archivist's model)
- No database-only fields (entityInstanceId, vaultId, entitySource, isCustom removed)

## Inline Tags

Six tag types using backtick-prefix pattern:

| Syntax | Example | Renders as | Color |
|--------|---------|------------|-------|
| `` `dice:NOTATION` `` | `` `dice:2d6+3` `` | Dice icon + notation badge | Gold (#8a6e1e on #fef9f1) |
| `` `damage:NOTATION TYPE` `` | `` `damage:3d8 fire` `` | Dice icon + damage badge | Gold (#8a6e1e on #fef9f1) |
| `` `dc:VALUE` `` | `` `dc:15` `` | Shield icon + "DC 15" badge | Blue (#1e3a8a on #e8ecf5) |
| `` `atk:MODIFIER` `` | `` `atk:+7` `` | Swords icon + "+7 to hit" badge | Crimson (#8a1e3a on #fdf2f5) |
| `` `mod:MODIFIER` `` | `` `mod:+5` `` | Signed modifier badge | Blue (#1e3a8a on #e8ecf5) |
| `` `check:ABILITY VALUE` `` | `` `check:DEX 14` `` | Ability check badge | Blue (#1e3a8a on #e8ecf5) |

### Rendering

- **Reading view**: `MarkdownPostProcessor` finds inline code elements with known prefixes, replaces with styled `<span>` elements
- **Live preview**: CodeMirror 6 `ViewPlugin` decorates matching inline code with styled widgets
- **Styling**: Ported directly from archivist's `dnd-tag-render.css` — rounded pill badges, Lucide icons, monospace font for dice notation
- **Hover**: translateY(-2px), box-shadow `0 2px 8px rgba(0,0,0,0.15)`, brightness-95
- **Dark mode**: archivist's existing dark mode colors (rgba-based backgrounds, lighter text)
- **No click behavior** for v1 (dice system deferred)

### Graceful Degradation

If the plugin is disabled, users see normal inline code like `` `dice:2d6+3` `` which is still perfectly readable.

## Visual Design

All rendering is a 1:1 port of archivist's existing visual design. No custom or new design — use the exact same styling.

### D&D 5e Parchment Theme (from archivist)

**CSS Variables:**
```css
--d5e-parchment: #fdf1dc
--d5e-parchment-dark: #f4e4c1
--d5e-parchment-light: #fef8ee
--d5e-text-dark: #191813
--d5e-text-accent: #7a200d
--d5e-bar-fill: #922610
--d5e-bar-stroke: #922610
--d5e-border-tan: #d9c484
--d5e-border-tan-light: #e8dcc0
--d5e-border-tan-dark: #c4a95e
--d5e-shadow: 0 4px 24px rgba(134, 116, 83, 0.3), 0 2px 8px rgba(134, 116, 83, 0.2)
```

**Fonts:**
- Headers: Libre Baskerville (serif) — 25px monster name (small-caps), 23px spell/item name
- Body: Noto Sans (sans-serif) — 14px base, 13px properties, 12px type line
- Dice notation in tags: monospace

**Monster Stat Block Structure:**
1. Name (Libre Baskerville, 25px, small-caps, #7a200d)
2. Type line (italic, 12px)
3. SVG decorative bar (#922610)
4. AC, HP, Speed (property lines with hanging indent, bold #7a200d labels with dot suffix)
5. SVG bar
6. Ability scores table (6-column, centered, #7a200d headers)
7. SVG bar
8. Saving Throws, Skills, Damage Immunities, Condition Immunities, Senses, Languages, CR
9. SVG bar
10. Tab navigation (Traits | Actions | Reactions | Legendary) — uppercase, 11px, #7a200d. Tabs are interactive: clicking a tab switches visible content via JS event listeners attached during rendering. Active tab gets #922610 color + 2px bottom border + rgba background.
11. Tab content (trait/action entries with bold italic names) — only active tab's content is visible
12. Legendary resistance tracking boxes (22x22px, #d9c484 border)

**Spell Block Structure:**
1. Name (Libre Baskerville, 23px, #7a200d) + school line (italic)
2. 2px #7a200d header border
3. Properties with Lucide icons: Clock (casting time), Target (range), Box (components), Sparkles (duration)
4. Description (justified, 1.4em line-height)
5. At Higher Levels section (italic header, bordered)
6. Classes with BookOpen icon
7. Tags: Concentration (#e74c3c bg, white text), Ritual (#3498db bg, white text)

**Magic Item Block Structure:**
1. Name (Libre Baskerville, 23px, #7a200d) + type/rarity line (italic)
2. 2px #7a200d header border
3. Properties with Lucide icons: Sparkles (attunement), Scale (weight), Coins (value), Shield (properties)
4. Description entries
5. Charges/recharge info (if applicable)

### Icons

All icons use Lucide — the same icon library archivist uses (lucide-react). Obsidian ships Lucide natively, accessed via `setIcon(element, "icon-name")`. No emojis anywhere.

### Error Handling

If YAML is malformed, render an error banner at the top of the block showing the parse error, with the raw YAML visible below so users can fix it.

## Modal Forms

Commands open modal forms that generate YAML code blocks.

### Commands

- `archivist:insert-monster` — "Archivist: Insert Monster Block"
- `archivist:insert-spell` — "Archivist: Insert Spell Block"
- `archivist:insert-item` — "Archivist: Insert Magic Item Block"

### Monster Modal

| Field | Input Type | Required |
|-------|-----------|----------|
| Name | Text | Yes |
| Size | Dropdown (Tiny, Small, Medium, Large, Huge, Gargantuan) | No |
| Type | Text with suggestions (Dragon, Undead, Fiend, etc.) | No |
| Alignment | Text with suggestions | No |
| CR | Text (supports 0, 1/8, 1/4, 1/2, 1-30) | No |
| AC | Number + source text | No |
| HP Average | Number | No |
| HP Formula | Text (e.g., 28d20+252) | No |
| Speed | Multi-field (walk, fly, swim, climb, burrow) | No |
| Ability Scores | 6 number fields (STR, DEX, CON, INT, WIS, CHA) | No |
| Saves | Checkboxes for proficient saves | No |
| Skills | Multi-select with value fields | No |
| Senses | Tag-style text input | No |
| Languages | Tag-style text input | No |
| Damage Vulnerabilities | Tag-style text input | No |
| Damage Resistances | Tag-style text input | No |
| Damage Immunities | Tag-style text input | No |
| Condition Immunities | Tag-style text input | No |
| Traits | Repeatable name + text sections | No |
| Actions | Repeatable name + text sections | No |
| Reactions | Repeatable name + text sections | No |
| Legendary Actions | Repeatable name + text sections | No |
| Legendary Action Count | Number | No |
| Legendary Resistance Count | Number | No |

### Spell Modal

| Field | Input Type | Required |
|-------|-----------|----------|
| Name | Text | Yes |
| Level | Dropdown (Cantrip, 1st-9th) | No |
| School | Dropdown (Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation) | No |
| Casting Time | Text | No |
| Range | Text | No |
| Components | Text | No |
| Duration | Text | No |
| Concentration | Toggle | No |
| Ritual | Toggle | No |
| Classes | Multi-select (Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard) | No |
| Description | Textarea | No |
| At Higher Levels | Textarea | No |

### Item Modal

| Field | Input Type | Required |
|-------|-----------|----------|
| Name | Text | Yes |
| Type | Text | No |
| Rarity | Dropdown (Common, Uncommon, Rare, Very Rare, Legendary, Artifact) | No |
| Attunement | Toggle + optional text | No |
| Weight | Number | No |
| Damage | Text | No |
| Damage Type | Text | No |
| Properties | Tag-style text input | No |
| Charges | Number | No |
| Recharge | Text | No |
| Curse | Toggle | No |
| Description | Textarea | No |

### Modal Behaviors

- Only `name` is required — submit with just a name for a minimal block
- Auto-calculate ability modifiers from scores, proficiency bonus from CR
- "Advanced" toggle collapses less-common fields (legendary actions, damage immunities, etc.)
- Submit inserts properly formatted YAML code block at cursor position
- Uses Obsidian's native `Modal` and `Setting` classes for consistent look

## CSS Porting Strategy

The following archivist CSS files are ported directly to the plugin, adapted from Tailwind/React to plain CSS targeting Obsidian's DOM:

| Archivist Source | Plugin Target | What It Styles |
|-----------------|---------------|----------------|
| `styles/variables/dnd-theme.css` | `styles/blocks.css` | CSS variables for parchment theme |
| `styles/original-monster-stat-block.css` | `styles/blocks.css` | Monster stat block layout and typography |
| `styles/original-spell-block.css` | `styles/blocks.css` | Spell block layout and typography |
| `styles/legendary-resistance.css` | `styles/blocks.css` | Legendary resistance tracking boxes |
| `styles/dnd-tag-render.css` | `styles/inline-tags.css` | Inline tag pill badges with all color schemes |
| `components/editor/monster-block/*.css` | `styles/blocks.css` | Collapsible sections, damage grids, ability scores |

All Tailwind utility classes are converted to plain CSS. React-specific styling (styled-components, className composition) is flattened to standard selectors. CSS class names are prefixed with `archivist-` to avoid conflicts with other Obsidian plugins and themes.

## Testing Approach

- Manual testing in Obsidian with sample vault containing all block types
- YAML parser unit tests (valid input, malformed input, partial blocks, edge cases)
- Visual comparison against archivist's rendered output
- Test in both light and dark Obsidian themes
- Test in reading view and live preview mode
