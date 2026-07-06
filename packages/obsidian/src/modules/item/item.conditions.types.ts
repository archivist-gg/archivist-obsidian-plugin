// src/modules/item/item.conditions.types.ts
//
// Thin re-export shim (3C-R Phase 1). The condition types + conditional-bonus
// grammar now live in @archivist/dnd5e/item/item.conditions.types (co-located
// there with the PC-domain nucleus and the mechanical evaluators). This shim
// re-exports them under the original plugin specifier so the ~all intra-plugin
// type-consumers (InformationalBonus / ConditionContext / ConditionalBonus /
// Condition / BonusFieldPath / …) need no edit. No runtime exports here.

export type {
  Tier1Condition,
  Tier2Condition,
  Tier3Condition,
  Tier4Condition,
  FreeTextCondition,
  AnyOfCondition,
  Condition,
  ConditionalBonus,
  BonusFieldPath,
  InformationalBonus,
  ConditionOutcome,
  ConditionContext,
  BonusReadResult,
} from "@archivist/dnd5e/item/item.conditions.types";
