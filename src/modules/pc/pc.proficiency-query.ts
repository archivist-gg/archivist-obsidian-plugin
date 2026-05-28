// src/modules/pc/pc.proficiency-query.ts

import type { ArmorEntity } from "../armor/armor.types";
import type { WeaponEntity } from "../weapon/weapon.types";
import type { ProficiencySet } from "./pc.types";

interface ProficienciesForQuery {
  armor: ProficiencySet;
  weapons: ProficiencySet;
  tools: ProficiencySet;
}

export function isProficientWithWeapon(
  weapon: WeaponEntity,
  profs: ProficienciesForQuery,
): boolean {
  if (profs.weapons.specific.includes(weapon.slug)) return true;
  // weapon.category is "simple-melee" / "martial-ranged" / etc.;
  // class data uses "simple" / "martial" without melee/ranged split.
  const baseCategory = weapon.category.split("-")[0];
  return profs.weapons.categories.includes(baseCategory);
}

export function isProficientWithArmor(
  armor: ArmorEntity,
  profs: ProficienciesForQuery,
): boolean {
  if (profs.armor.specific.includes(armor.slug)) return true;
  if (profs.armor.categories.includes(armor.category)) return true;

  // Heavy implies medium and light; medium implies light.
  if (armor.category === "light" &&
      (profs.armor.categories.includes("medium") || profs.armor.categories.includes("heavy"))) return true;
  if (armor.category === "medium" && profs.armor.categories.includes("heavy")) return true;

  return false;
}
