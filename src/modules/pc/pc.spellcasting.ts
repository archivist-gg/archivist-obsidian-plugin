import type { Ability } from "../../shared/types";
import type { Edition } from "./pc.types";

export type CasterType = "full" | "half" | "third" | "pact" | "none";

export interface SpellcastingProfile {
  ability: Ability;
  casterType: Exclude<CasterType, "none">;
  preparation: "known" | "prepared";
}

function bareSlug(ref: string): string {
  const m = ref.match(/^\[\[(.+?)\]\]$/);
  return (m ? m[1] : ref).toLowerCase();
}

// Fixed SRD reference data. `preparation` differs by edition for some classes;
// `ability` and `casterType` are edition-independent. Spell *access* is not
// here — it comes from each spell's `classes[]` reverse index.
const PROFILES: Record<string, {
  ability: Ability;
  casterType: Exclude<CasterType, "none">;
  preparation: { "2014": "known" | "prepared"; "2024": "known" | "prepared" };
}> = {
  bard:     { ability: "cha", casterType: "full", preparation: { "2014": "known",    "2024": "prepared" } },
  cleric:   { ability: "wis", casterType: "full", preparation: { "2014": "prepared", "2024": "prepared" } },
  druid:    { ability: "wis", casterType: "full", preparation: { "2014": "prepared", "2024": "prepared" } },
  paladin:  { ability: "cha", casterType: "half", preparation: { "2014": "prepared", "2024": "prepared" } },
  ranger:   { ability: "wis", casterType: "half", preparation: { "2014": "known",    "2024": "prepared" } },
  sorcerer: { ability: "cha", casterType: "full", preparation: { "2014": "known",    "2024": "known" } },
  warlock:  { ability: "cha", casterType: "pact", preparation: { "2014": "known",    "2024": "known" } },
  wizard:   { ability: "int", casterType: "full", preparation: { "2014": "prepared", "2024": "prepared" } },
};

export function getSpellcastingProfile(classSlug: string, edition: Edition): SpellcastingProfile | null {
  const p = PROFILES[bareSlug(classSlug)];
  if (!p) return null;
  return { ability: p.ability, casterType: p.casterType, preparation: p.preparation[edition] };
}
