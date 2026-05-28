export const PLATE = `
name: Plate
slug: plate
category: heavy
ac:
  base: 18
  flat: 0
  add_dex: false
  add_con: false
  add_wis: false
  description: "18"
strength_requirement: 15
stealth_disadvantage: true
weight: 65
cost: "1500 gp"
source: PHB
`;

export const BREASTPLATE = `
name: Breastplate
slug: breastplate
category: medium
ac:
  base: 14
  flat: 0
  add_dex: true
  dex_max: 2
  add_con: false
  add_wis: false
  description: "14 + Dex modifier (max 2)"
weight: 20
cost: "400 gp"
source: PHB
`;

export const LEATHER = `
name: Leather
slug: leather
category: light
ac:
  base: 11
  flat: 0
  add_dex: true
  add_con: false
  add_wis: false
  description: "11 + Dex modifier"
weight: 10
cost: "10 gp"
source: PHB
`;

export const SHIELD = `
name: Shield
slug: shield
category: shield
ac:
  base: 0
  flat: 2
  add_dex: false
  add_con: false
  add_wis: false
  description: "+2"
weight: 6
cost: "10 gp"
source: PHB
`;

export const MAGE_ARMOR = `
name: Mage Armor
slug: mage-armor
category: spell
ac:
  base: 13
  flat: 0
  add_dex: true
  add_con: false
  add_wis: false
  description: "13 + Dex modifier"
source: PHB
`;

export const UNARMORED_DEFENSE_MONK = `
name: Unarmored Defense (Monk)
slug: unarmored-defense-monk
category: feature
ac:
  base: 10
  flat: 0
  add_dex: true
  add_con: false
  add_wis: true
  description: "10 + Dex modifier + Wis modifier"
source: PHB
`;

export const UNARMORED_DEFENSE_BARBARIAN = `
name: Unarmored Defense (Barbarian)
slug: unarmored-defense-barbarian
category: feature
ac:
  base: 10
  flat: 0
  add_dex: true
  add_con: true
  add_wis: false
  description: "10 + Dex modifier + Con modifier"
source: PHB
`;
