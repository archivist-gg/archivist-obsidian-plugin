// ─────────────────────────────────────────────────────────────
// PC-domain type contract — relocated to @archivist/dnd5e (3C-R Phase 3a).
// This file is a pure re-export shim: the entire PC type surface now lives in
// `@archivist/dnd5e/pc/pc.types` (definition/resolved/derived types merged with
// the P1 nucleus), and `ConditionSlug` in `@archivist/dnd5e/pc/conditions.constants`.
// Re-exported here so the ~131 intra-plugin `./pc.types` consumers stay unchanged.
// ─────────────────────────────────────────────────────────────
export type {
  // P1 nucleus
  EquippedSlots,
  ClassEntry,
  EquipmentEntry,
  EquipmentEntryOverrides,
  EquipmentEntryState,
  SlotKey,
  ResolvedEquipped,
  LevelChoices,
  ChoiceValue,
  // Definition (parsed from YAML)
  Edition,
  AbilityMethod,
  SpellOverride,
  KnownSpellObject,
  KnownSpellEntry,
  PassiveKind,
  CharacterOverrides,
  CharacterState,
  Character,
  // Resolved
  FeatureSource,
  ResolvedFeature,
  ResolvedSpell,
  ResolvedClass,
  ResolvedPoolEntry,
  ResolvedPool,
  ResolvedCharacter,
  ProficiencySet,
  // Derived
  ACTerm,
  AttackRow,
  AppliedBonuses,
  DerivedEquipment,
  RollModifierEntry,
  DerivedStats,
  SpellcastingClassInfo,
  SpellLimitInfo,
  ConditionEffects,
} from "@archivist/dnd5e/pc/pc.types";

export type { ConditionSlug } from "@archivist/dnd5e/pc/conditions.constants";
