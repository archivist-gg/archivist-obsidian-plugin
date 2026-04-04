# Archivist

An Obsidian plugin for D&D 5e content. Write YAML inside fenced code blocks and get rendered parchment-styled stat blocks, spell cards, and magic item entries.

## Features

- **Monster Stat Blocks** -- Full stat blocks with abilities, skills, saves, senses, and feature sections (traits, actions, reactions, legendary/lair/mythic actions). Supports single and two-column layouts.
- **Spell Blocks** -- Spell cards with level, school, casting time, range, components, duration, and description.
- **Magic Item Blocks** -- Item entries with rarity, attunement, type, and description.
- **Inline Tags** -- Inline dice rolls (`dice:2d6+3`), attack rolls (`atk:DEX`), damage (`damage:1d8+STR`), and DC checks (`dc:WIS`) rendered directly in text.
- **Edit Mode** -- Click-to-edit UI for all block types with auto-calculated values (HP, AC, saves, skills, passive perception) and manual override support.
- **D&D 5e Math Engine** -- Auto-calculates proficiency bonus, ability modifiers, saving throws, skill bonuses, HP, and AC from ability scores.
- **Entity Compendium** -- SRD entity registry with 300+ monsters, spells, and items. Supports custom user entities.
- **AI Chat Engine** -- Claudian-powered assistant for generating and looking up D&D content (requires Anthropic API key).

## Usage

Create a fenced code block with the appropriate language tag:

````markdown
```monster
name: Adult Red Dragon
size: huge
type: dragon
alignment: chaotic evil
ac: 19 (natural armor)
hp: 256 (19d12+133)
speed: 40 ft., climb 40 ft., fly 80 ft.
abilities: [27, 10, 25, 16, 13, 21]
```
````

````markdown
```spell
name: Fireball
level: 3
school: Evocation
casting_time: 1 action
range: 150 feet
components: V, S, M (a tiny ball of bat guano and sulfur)
duration: Instantaneous
description: |
  A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.
```
````

````markdown
```item
name: Flame Tongue
type: Weapon (any sword)
rarity: rare
attunement: true
description: |
  You can use a bonus action to speak this magic sword's command word, causing flames to erupt from the blade.
```
````

## Installation (Beta via BRAT)

This plugin is in beta. To install:

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian community plugins
2. Open BRAT settings and click "Add Beta Plugin"
3. Enter: `archivist-gg/archivist-obsidian-plugin`
4. Enable the plugin in Settings > Community Plugins

## Building from Source

```bash
npm install
npm run build
```

Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/archivist/` directory.

## License

MIT
