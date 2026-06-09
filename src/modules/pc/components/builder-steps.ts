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
  { id: "abilities", label: "Abilities" },
  { id: "background", label: "Background" },
  { id: "equipment", label: "Equipment" },
  { id: "details", label: "Details" },
];
