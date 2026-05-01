const FIELDS_TO_KEEP_PER_KIND: Record<string, Set<string>> = {
  feat: new Set(["slug", "name", "edition", "source", "category", "prerequisites", "effects", "grants_asi", "repeatable", "choices"]),
  race: new Set(["slug", "name", "edition", "source", "size", "speed", "vision", "abilities", "languages", "subspecies_of", "traits"]),
  species: new Set(["slug", "name", "edition", "source", "size", "speed", "vision", "abilities", "languages", "subspecies_of", "traits"]),
  class: new Set(["slug", "name", "edition", "source", "hit_dice", "primary_abilities", "saving_throws", "spellcasting", "resources", "weapon_mastery", "data_for_class_table", "features"]),
  subclass: new Set(["slug", "name", "edition", "source", "description", "parent_class", "features_by_level", "resources"]),
  background: new Set(["slug", "name", "edition", "source", "skill_proficiencies", "tool_proficiencies", "language_proficiencies", "equipment", "feature", "ability_score_increases", "origin_feat"]),
  weapon: new Set(["slug", "name", "edition", "source", "category", "damage", "properties", "range", "reload", "mastery", "type_tags", "weight", "cost"]),
  armor: new Set(["slug", "name", "edition", "source", "category", "ac", "strength_required", "stealth_disadvantage", "weight", "cost"]),
  item: new Set(["slug", "name", "edition", "source", "rarity", "tier", "attunement", "bonuses", "charges", "attached_spells", "consumes", "grants", "base_item"]),
  magicitem: new Set(["slug", "name", "edition", "source", "rarity", "tier", "attunement", "bonuses", "charges", "attached_spells", "consumes", "grants", "base_item"]),
  spell: new Set(["slug", "name", "edition", "source", "level", "school", "casting_time", "range", "components", "duration", "ritual", "concentration", "saving_throw", "damage"]),
  monster: new Set(["slug", "name", "edition", "source", "size", "type", "alignment", "ac", "hp", "speed", "abilities", "saves", "skills", "senses", "languages", "cr"]),
  creature: new Set(["slug", "name", "edition", "source", "size", "type", "alignment", "ac", "hp", "speed", "abilities", "saves", "skills", "senses", "languages", "cr"]),
  condition: new Set(["slug", "name", "edition", "source", "effects"]),
  "optional-feature": new Set(["slug", "name", "edition", "source", "feature_type", "prerequisites", "available_to", "effects", "action_cost", "uses"]),
};

export function projectToRuntime(kind: string, entry: Record<string, unknown>): Record<string, unknown> {
  const keep = FIELDS_TO_KEEP_PER_KIND[kind];
  if (!keep) throw new Error(`projectToRuntime: unknown kind: ${kind}`);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(entry)) {
    if (keep.has(k)) out[k] = entry[k];
  }
  return out;
}
