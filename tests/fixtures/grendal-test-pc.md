---
archivist-type: pc
---

# Grendal — canonical-bundle PC regression fixture

Mechanical-only sheet derived from `~/Documents/V/PlayerCharacters/Grendal.md`,
with wikilinks rewritten to the canonical bundle's namespaced slugs (the form
emitted by `tools/srd-canonical/`). All narrative prose has been stripped.

```pc
name: Grendal the Wary
edition: "2014"
alignment: Lawful Good
race: "[[srd-5e_dwarf]]"
subrace: null
background: "[[srd-5e_acolyte]]"
class:
  - name: "[[srd-5e_fighter]]"
    level: 5
    subclass: null
    choices:
      "1":
        skills:
          - athletics
          - perception
      "4":
        asi:
          str: 1
          con: 1
abilities:
  str: 16
  dex: 12
  con: 14
  int: 10
  wis: 13
  cha: 8
ability_method: point-buy
skills:
  proficient:
    - athletics
    - perception
    - insight
    - survival
  expertise:
    - athletics
spells:
  known: []
  overrides: []
equipment:
  - item: "[[srd-5e_longsword]]"
    equipped: true
    attuned: false
    slot: mainhand
  - item: Traveler pack
    equipped: true
  - item: "[[srd-5e_amulet-of-health]]"
    equipped: false
    attuned: false
  - item: "[[srd-5e_bracers-of-defense]]"
    equipped: false
    attuned: false
  - item: "[[srd-5e_chain-mail]]"
    equipped: false
  - item: "[[srd-5e_shield-of-missile-attraction]]"
    equipped: false
    attuned: true
  - item: "[[srd-5e_arrow-catching-shield]]"
    equipped: true
    attuned: true
  - item: "[[srd-5e_necklace-of-fireballs]]"
    equipped: true
    state:
      charges:
        current: 6
        max: 9
  - item: "[[srd-5e_wand-of-fireballs]]"
    equipped: true
    attuned: true
    state:
      charges:
        current: 5
        max: 7
overrides:
  saves: {}
currency:
  cp: 0
  sp: 0
  ep: 0
  gp: 0
  pp: 0
defenses:
  resistances: []
  immunities: []
  vulnerabilities: []
  condition_immunities: []
state:
  hp:
    current: 12
    max: 44
    temp: 0
  hit_dice:
    d10:
      used: 0
      total: 5
  spell_slots: {}
  concentration: null
  conditions: []
  exhaustion: 0
  death_saves:
    successes: 0
    failures: 0
  inspiration: 1
  feature_uses: {}
```
