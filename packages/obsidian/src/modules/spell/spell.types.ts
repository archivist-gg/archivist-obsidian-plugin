export interface CastingOption {
  type: string;
  damage_roll?: string;
  target_count?: number;
  duration?: string;
  range?: number;
  concentration?: boolean;
  shape_size?: number;
  desc?: string;
}

export interface Spell {
  name: string;
  level?: number;
  school?: string;
  casting_time?: string;
  range?: string;
  components?: string;
  duration?: string;
  concentration?: boolean;
  ritual?: boolean;
  classes?: string[];
  description?: string;
  at_higher_levels?: string[];
  damage?: { types: string[] };
  saving_throw?: { ability: string };
  casting_options?: CastingOption[];
  // Body-only metadata: passed through from canonical YAML so the renderer
  // can show a source badge ("SRD 5e", "SRD 2024", or a custom compendium).
  source?: string;
  /* eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents */
  edition?: "2014" | "2024" | string;
}
