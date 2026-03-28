# Archivist TTRPG Blocks - Test Vault

This document tests all block types, inline tags, and error handling for the Archivist plugin.

---

## Full Monster Block: Goblin

```monster
name: Goblin
size: Small
type: humanoid
subtype: goblinoid
alignment: neutral evil
cr: "1/4"
ac:
  - ac: 15
    from: [leather armor, shield]
hp:
  average: 7
  formula: 2d6
speed:
  walk: 30
abilities:
  str: 8
  dex: 14
  con: 10
  int: 10
  wis: 8
  cha: 8
skills:
  stealth: 6
senses:
  - darkvision 60 ft.
passive_perception: 9
languages:
  - Common
  - Goblin
traits:
  - name: Nimble Escape
    entries:
      - The goblin can take the Disengage or Hide action as a bonus action on each of its turns.
actions:
  - name: Scimitar
    entries:
      - "Melee Weapon Attack: `atk:+4` to hit, reach 5 ft., one target. Hit: `damage:1d6+2 slashing` slashing damage."
  - name: Shortbow
    entries:
      - "Ranged Weapon Attack: `atk:+4` to hit, range 80/320 ft., one target. Hit: `damage:1d6+2 piercing` piercing damage."
```

---

## Full Spell Block: Fireball

```spell
name: Fireball
level: 3
school: Evocation
casting_time: 1 action
range: 150 feet
components: "V, S, M (a tiny ball of bat guano and sulfur)"
duration: Instantaneous
concentration: false
ritual: false
classes:
  - Sorcerer
  - Wizard
description:
  - "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a `dc:15` Dexterity saving throw. A target takes `dice:8d6` fire damage on a failed save, or half as much damage on a successful one."
  - The fire spreads around corners. It ignites flammable objects in the area that aren't being worn or carried.
at_higher_levels:
  - "When you cast this spell using a spell slot of 4th level or higher, the damage increases by `dice:1d6` for each slot level above 3rd."
```

---

## Full Item Block: Flame Tongue Longsword

```item
name: Flame Tongue Longsword
type: weapon (longsword)
rarity: rare
attunement: true
weight: 3
damage: 1d8
damage_type: slashing
properties:
  - versatile
  - magical
entries:
  - "You can use a bonus action to speak this magic sword's command word, causing flames to erupt from the blade. These flames shed bright light in a 40-foot radius and dim light for an additional 40 feet. While the sword is ablaze, it deals an extra `damage:2d6 fire` damage to any target it hits. The flames last until you use a bonus action to speak the command word again or until you drop or sheathe the sword."
```

---

## Inline Tag Examples

Here are examples of all supported inline tags used in body text:

- Roll for damage: `dice:2d6+3`
- Fire damage: `damage:1d10 fire`
- Difficulty class: `dc:15`
- Attack bonus: `atk:+7`
- Ability modifier: `mod:+3`
- Skill check: `check:Perception DC 14`

You can embed multiple tags in one paragraph: Make a `check:Stealth DC 12` check. On a success, you deal `damage:3d6 piercing` damage with your `atk:+5` attack roll.

---

## Minimal Blocks

### Name-Only Monster

```monster
name: Shadow
```

### Name-Only Spell

```spell
name: Prestidigitation
```

### Name-Only Item

```item
name: Bag of Holding
```

---

## Error Testing: Broken YAML Monster

This block is intentionally broken to test error rendering:

```monster
name: Broken Monster
ac: [this is not valid yaml
  what: even: is: this
abilities:
  - this should be an object not an array
```
