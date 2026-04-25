export const LONGSWORD = `
name: Longsword
slug: longsword
category: martial-melee
damage:
  dice: 1d8
  type: slashing
  versatile_dice: 1d10
properties: [versatile]
type_tags: [sword]
weight: 3
cost: "15 gp"
source: PHB
`;

export const DAGGER = `
name: Dagger
slug: dagger
category: simple-melee
damage:
  dice: 1d4
  type: piercing
properties: [finesse, light, thrown]
range: { normal: 20, long: 60 }
type_tags: [dagger]
weight: 1
cost: "2 gp"
source: PHB
`;

export const LONGBOW = `
name: Longbow
slug: longbow
category: martial-ranged
damage:
  dice: 1d8
  type: piercing
properties: [ammunition, heavy, two_handed]
range: { normal: 150, long: 600 }
type_tags: [bow]
ammo_type: arrow
weight: 2
cost: "50 gp"
source: PHB
`;

export const NET = `
name: Net
slug: net
category: martial-ranged
damage:
  dice: "0"
  type: ""
properties: [special, thrown]
range: { normal: 5, long: 15 }
type_tags: [net]
weight: 3
cost: "1 gp"
source: PHB
`;

export const LANCE = `
name: Lance
slug: lance
category: martial-melee
damage:
  dice: 1d12
  type: piercing
properties:
  - reach
  - special
  - { kind: conditional, uid: two_handed, note: "unless mounted" }
type_tags: [lance]
weight: 6
cost: "10 gp"
source: PHB
`;
