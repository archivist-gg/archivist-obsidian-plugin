export interface MonsterAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface MonsterAC {
  ac: number;
  from?: string[];
}

export interface MonsterHP {
  average: number;
  formula?: string;
}

export interface MonsterSpeed {
  walk?: number;
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
}

export interface MonsterFeature {
  name: string;
  entries: string[];
}

export interface Monster {
  name: string;
  size?: string;
  type?: string;
  subtype?: string;
  alignment?: string;
  cr?: string;
  ac?: MonsterAC[];
  hp?: MonsterHP;
  speed?: MonsterSpeed;
  abilities?: MonsterAbilities;
  saves?: Partial<Record<string, number>>;
  skills?: Record<string, number>;
  senses?: string[];
  passive_perception?: number;
  languages?: string[];
  damage_vulnerabilities?: string[];
  damage_resistances?: string[];
  damage_immunities?: string[];
  condition_immunities?: string[];
  traits?: MonsterFeature[];
  actions?: MonsterFeature[];
  reactions?: MonsterFeature[];
  legendary?: MonsterFeature[];
  legendary_actions?: number;
  legendary_resistance?: number;
  columns?: number;
}
