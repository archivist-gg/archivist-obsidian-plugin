import type { Feature } from "../../shared/types/feature";
import type { Choice } from "../../shared/types/choice";

const DECISION_SIGNAL = [/\bchoose (one|two|three|a|an)\b/i, /\bof your choice\b/i, /\byour choice of\b/i];

const ASI_OR_FEAT: Choice = {
  kind: "select-inline", id: "asi-or-feat", count: 1,
  options: [
    { value: "asi", label: "Ability Score Increase",
      choices: [{ kind: "ability-points", id: "asi", points: 2, max_per: 2 }] },
    { value: "feat", label: "Feat",
      choices: [{ kind: "select-entity", id: "feat", entity_type: "feat", count: 1 }] },
  ],
};

/** id/name-slug → synthesized decision. Keep small and justified: this only
 *  serves un-annotated homebrew (the coverage gate keeps SRD authored). */
const TABLE: Record<string, Choice[]> = {
  "ability-score-improvement": [ASI_OR_FEAT],
  "expertise": [{ kind: "select-proficiency", id: "expertise", count: 2, domain: "skill", from_proficient: true, expertise: true }],
  "fighting-style": [{ kind: "select-entity", id: "fighting-style", count: 1, entity_type: "optional-feature", where: { feature_type: "fighting_style", available_to: "self" } }],
};

export function recognizeDecision(feature: Feature): Choice[] | "informational" | null {
  const slug = (feature.id ?? feature.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (TABLE[slug]) return TABLE[slug];
  const desc = feature.description ?? "";
  return DECISION_SIGNAL.some(re => re.test(desc)) ? "informational" : null;
}
