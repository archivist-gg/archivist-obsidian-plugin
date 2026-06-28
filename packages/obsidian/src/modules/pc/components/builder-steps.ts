/** The ordered Character Builder steps. Spells + Review are intentionally
 *  absent (spec §1): spells are learned in the Spells tab after Finish, and the
 *  finished sheet is the review. */
export interface BuilderStep {
  readonly id: string;
  readonly label: string;
}

export const BUILDER_STEPS: readonly BuilderStep[] = [
  { id: "race", label: "Race / Species" },
  { id: "class", label: "Class & Levels" },
  // Background precedes Abilities: a 2024 background grants ability-score points
  // and the origin feat, so the score work should follow the background pick.
  { id: "background", label: "Background" },
  { id: "abilities", label: "Abilities" },
  { id: "equipment", label: "Equipment" },
  { id: "details", label: "Details" },
];
