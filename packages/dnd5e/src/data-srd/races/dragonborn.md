---
archivist: true
entity_type: race
slug: dragonborn
name: Dragonborn
compendium: SRD
source: SRD 5.1
---

```race
slug: dragonborn
name: Dragonborn
edition: '2014'
source: SRD 5.1
description: |-
  ## Dragonborn Traits
  Your draconic heritage manifests in a variety of traits you share with other dragonborn.
size: medium
speed:
  walk: 30
ability_score_increases:
  - ability: str
    amount: 2
  - ability: cha
    amount: 1
age: '**_Age._** Young dragonborn grow quickly. They walk hours after hatching, attain the size and development of a 10-year-old human child by the age of 3, and reach adulthood by 15. They live to be around 80.'
alignment: '**_Alignment._** Dragonborn tend to extremes, making a conscious choice for one side or the other in the cosmic war between good and evil. Most dragonborn are good, but those who side with evil can be terrible villains.'
vision: {}
languages:
  fixed:
    - common
    - draconic
variant_label: Subrace
variants: []
traits:
  - id: draconic-ancestry
    name: Draconic Ancestry
    description: |-
      | Dragon       | Damage Type       | Breath Weapon                |
      |--------------|-------------------|------------------------------|
      | Black        | Acid              | 5 by 30 ft. line (Dex. save) |
      | Blue         | Lightning         | 5 by 30 ft. line (Dex. save) |
      | Brass        | Fire              | 5 by 30 ft. line (Dex. save) |
      | Bronze       | Lightning         | 5 by 30 ft. line (Dex. save) |
      | Copper       | Acid              | 5 by 30 ft. line (Dex. save) |
      | Gold         | Fire              | 15 ft. cone (Dex. save)      |
      | Green        | Poison            | 15 ft. cone (Con. save)      |
      | Red          | Fire              | 15 ft. cone (Dex. save)      |
      | Silver       | Cold              | 15 ft. cone (Con. save)      |
      | White        | Cold              | 15 ft. cone (Con. save)      |
  - id: draconic-ancestry
    name: _Draconic Ancestry._
    description: You have draconic ancestry. Choose one type of dragon from the Draconic Ancestry table. Your breath weapon and damage resistance are determined by the dragon type, as shown in the table.
  - id: breath-weapon
    name: _Breath Weapon._
    description: |-
      You can use your action to exhale destructive energy. Your draconic ancestry determines the size, shape, and damage type of the exhalation.
      When you use your breath weapon, each creature in the area of the exhalation must make a saving throw, the type of which is determined by your draconic ancestry. The DC for this saving throw equals 8 + your Constitution modifier + your proficiency bonus. A creature takes 2d6 damage on a failed save, and half as much damage on a successful one. The damage increases to 3d6 at 6th level, 4d6 at 11th level, and 5d6 at 16th level.
      After you use your breath weapon, you can't use it again until you complete a short or long rest.
  - id: damage-resistance
    name: _Damage Resistance._
    description: You have resistance to the damage type associated with your draconic ancestry.
```
