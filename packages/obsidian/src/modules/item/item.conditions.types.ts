// src/modules/item/item.conditions.types.ts
//
// Obsidian-side remnant of the condition types. The pure conditional-bonus
// grammar (Condition union + tiers, ConditionalBonus, BonusFieldPath) now lives
// in @archivist/dnd5e/types/item-conditions.types — relocated so the build-time
// SRD merger can consume it without a tools→obsidian reverse edge — and is
// re-exported here for existing item/pc consumers. The shapes below stay here
// because they couple to the deferred PC layer: ConditionContext reads
// EquippedSlots/ClassEntry from pc.types, and pc.types imports InformationalBonus
// back. No runtime exports here.

import type { EquippedSlots, ClassEntry } from "../pc/pc.types";
import type { BonusFieldPath, Condition } from "@archivist/dnd5e/types/item-conditions.types";

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
} from "@archivist/dnd5e/types/item-conditions.types";

// --------------------------------------------------------------------------
// Informational record carried through derived state to UI tooltips.
// --------------------------------------------------------------------------

export interface InformationalBonus {
  field: BonusFieldPath;
  source: string;
  value: number;
  conditions: Condition[];
}

// --------------------------------------------------------------------------
// Evaluator interface.
// --------------------------------------------------------------------------

export type ConditionOutcome = "true" | "false" | "informational";

export interface ConditionContext {
  derived: { equippedSlots: EquippedSlots };
  classList: ClassEntry[];
  race: string | null;
  subclasses: string[];
}

// --------------------------------------------------------------------------
// readNumericBonus return shape.
// --------------------------------------------------------------------------

export type BonusReadResult =
  | { kind: "applied"; value: number }
  | { kind: "skipped" }
  | { kind: "informational"; value: number; conditions: Condition[] };
