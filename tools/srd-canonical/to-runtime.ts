const FIELDS_TO_KEEP_PER_KIND: Record<string, Set<string>> = {
  feat: new Set([
    "slug", "name", "edition", "source", "description", "category",
    "prerequisites", "benefits", "repeatable", "action_cost",
    // Schema-required minimal defaults emitted by feat-merge (Phase 9).
    "effects", "grants_asi", "choices",
  ]),
  race: new Set([
    "slug", "name", "edition", "source", "description", "size", "speed",
    "vision", "subspecies_of", "traits", "additional_spells",
    // Schema-required minimal defaults emitted by race-merge (Phase 9).
    "ability_score_increases", "age", "alignment", "languages", "variant_label",
    // Backwards-compat alias.
    "abilities",
  ]),
  species: new Set([
    "slug", "name", "edition", "source", "description", "size", "speed",
    "vision", "subspecies_of", "traits", "additional_spells",
    "ability_score_increases", "age", "alignment", "languages", "variant_label",
    "abilities",
  ]),
  class: new Set([
    "slug", "name", "edition", "source", "description", "hit_die",
    "primary_abilities", "saving_throws", "proficiencies", "skill_choices",
    "starting_equipment", "spellcasting", "subclass_level",
    "subclass_feature_name", "weapon_mastery", "epic_boon_level", "table",
    "features_by_level", "resources",
    // Backwards-compat / future fields.
    "hit_dice", "weapon_mastery_count", "data_for_class_table", "features",
    "multiclassing",
  ]),
  subclass: new Set([
    "slug", "name", "edition", "source", "description", "parent_class",
    "features_by_level", "resources",
    // Backwards-compat / future fields.
    "features",
  ]),
  background: new Set([
    "slug", "name", "edition", "source", "description", "skill_proficiencies",
    "tool_proficiencies", "language_proficiencies", "equipment", "feature",
    "ability_score_increases", "origin_feat", "suggested_characteristics",
    // Backwards-compat alias.
    "languages",
  ]),
  weapon: new Set([
    "slug", "name", "edition", "source", "category", "damage", "properties",
    "range", "reload", "mastery", "type_tags", "weight", "cost",
  ]),
  armor: new Set([
    "slug", "name", "edition", "source", "category", "ac", "strength_required",
    "stealth_disadvantage", "weight", "cost",
  ]),
  item: new Set([
    "slug", "name", "edition", "source", "rarity", "type", "tier",
    "description", "requires_attunement", "attunement", "base_item",
    "weight", "cost", "bonuses", "attached_spells", "charges", "effects",
    // Reserved for future / overlay-supplied structured fields.
    "consumes", "grants",
  ]),
  magicitem: new Set([
    "slug", "name", "edition", "source", "rarity", "type", "tier",
    "description", "requires_attunement", "attunement", "base_item",
    "weight", "cost", "bonuses", "attached_spells", "charges", "effects",
    "consumes", "grants",
  ]),
  spell: new Set([
    "slug", "name", "edition", "source", "level", "school", "casting_time",
    "range", "components", "duration", "concentration", "ritual",
    "description", "classes", "at_higher_levels", "casting_options",
    "damage", "saving_throw",
    // Backwards-compat / future fields.
    "damage_roll", "damage_types", "saving_throw_ability", "attack_roll",
  ]),
  monster: new Set([
    "slug", "name", "edition", "source", "size", "type", "subtype",
    "alignment", "description", "ac", "hp", "speed", "abilities", "saves",
    "skills", "senses", "passive_perception", "languages", "cr",
    "damage_vulnerabilities", "damage_resistances", "damage_immunities",
    "condition_immunities", "traits", "actions", "reactions",
    "legendary_actions", "legendary_resistance",
    // Backwards-compat alias.
    "legendary",
  ]),
  creature: new Set([
    "slug", "name", "edition", "source", "size", "type", "subtype",
    "alignment", "description", "ac", "hp", "speed", "abilities", "saves",
    "skills", "senses", "passive_perception", "languages", "cr",
    "damage_vulnerabilities", "damage_resistances", "damage_immunities",
    "condition_immunities", "traits", "actions", "reactions",
    "legendary_actions", "legendary_resistance",
    "legendary",
  ]),
  condition: new Set([
    "slug", "name", "edition", "source", "description", "effects",
  ]),
  "optional-feature": new Set([
    "slug", "name", "edition", "source", "feature_type", "description",
    "prerequisites", "available_to", "effects", "action_cost", "uses",
  ]),
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
