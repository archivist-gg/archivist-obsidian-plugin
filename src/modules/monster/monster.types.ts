import type { Abilities, AC, HP, Speed, Feature } from "../../shared/types";

export interface Monster {
  name: string;
  size?: string;
  type?: string;
  subtype?: string;
  alignment?: string;
  cr?: string;
  ac?: AC[];
  hp?: HP;
  speed?: Speed;
  abilities?: Abilities;
  saves?: Partial<Record<string, number>>;
  skills?: Record<string, number>;
  senses?: string[];
  passive_perception?: number;
  languages?: string[];
  damage_vulnerabilities?: string[];
  damage_resistances?: string[];
  damage_immunities?: string[];
  condition_immunities?: string[];
  traits?: Feature[];
  actions?: Feature[];
  reactions?: Feature[];
  legendary?: Feature[];
  legendary_actions?: number;
  legendary_resistance?: number;
  columns?: number;
}
