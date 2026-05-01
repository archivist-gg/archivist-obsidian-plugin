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
  description?: string[];
  at_higher_levels?: string[];
  casting_options?: CastingOption[];
}
