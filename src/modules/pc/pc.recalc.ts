import {
  abilityModifier,
  proficiencyFromLevel,
  savingThrow,
  skillBonus,
  passivePerception,
  passive,
  attackBonus,
  saveDC,
} from "../../shared/dnd/math";
import { ABILITY_KEYS, SKILL_ABILITY, ALL_SKILLS } from "../../shared/dnd/constants";
import type { Ability, SkillSlug } from "../../shared/types";
import type { ClassEntity } from "../class/class.types";
import type { FeatEntity } from "../feat/feat.types";
import type {
  DerivedStats,
  ResolvedCharacter,
  ResolvedClass,
  CharacterOverrides,
} from "./pc.types";

type ProficiencyTri = "none" | "proficient" | "expertise";

/**
 * PHB "fixed average" value per hit die (per level beyond first). Called
 * "average" in the PHB but actually ceil((die + 1) / 2); equivalent to
 * Math.floor(die / 2) + 1 for even dice.
 *
 * d6 → 4, d8 → 5, d10 → 6, d12 → 7.
 */
export function phbAverageForDie(hitDieStr: string): number {
  const n = parseDieSize(hitDieStr);
  if (n == null) return 4;
  return Math.floor(n / 2) + 1;
}

/** Extracts the integer size from "d8" / "d10" / 8 / 10. */
export function parseDieSize(die: string | number | undefined | null): number | null {
  if (die == null) return null;
  if (typeof die === "number") return die;
  const m = die.match(/^d?(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * PC-oriented multiclass HP.
 * - First class's first level: max(hit_die) + conMod.
 * - Every subsequent level (in any class): phbAverageForDie(thatLevel'sClass) + conMod.
 * CON mod contributes once per total level.
 */
export function multiclassMaxHP(classes: ResolvedClass[], conMod: number): number {
  let total = 0;
  let firstLevelCounted = false;
  for (const c of classes) {
    const die = parseDieSize(c.entity?.hit_die);
    if (!c.entity || die == null || c.level < 1) continue;
    for (let lvl = 1; lvl <= c.level; lvl++) {
      if (!firstLevelCounted) {
        total += die + conMod;
        firstLevelCounted = true;
      } else {
        total += (Math.floor(die / 2) + 1) + conMod;
      }
    }
  }
  return Math.max(1, total);
}

/**
 * Default AC = 10 + DEX mod. If any class's features include an
 * "Unarmored Defense"–style feature with a structured flag, applies the
 * variant (Monk: +WIS; Barbarian: +CON). Falls back to feature-name
 * regex matching with a warning pushed onto `warnings`.
 */
export function unarmoredAC(
  resolved: ResolvedCharacter,
  mods: Record<Ability, number>,
  warnings: string[],
): number {
  const base = 10 + mods.dex;
  for (const rf of resolved.features) {
    const feat = rf.feature as unknown as { unarmored_defense?: { ability: Ability }; name?: string };
    if (feat.unarmored_defense?.ability) {
      return 10 + mods.dex + (mods[feat.unarmored_defense.ability] ?? 0);
    }
  }
  // Heuristic fallback.
  for (const rf of resolved.features) {
    const name = (rf.feature.name ?? "").toLowerCase();
    if (!/unarmored\s*defense/.test(name)) continue;
    // Disambiguate Monk vs Barbarian via the class slug.
    if (rf.source.kind === "class" && rf.source.slug.includes("monk")) {
      warnings.push(`Unarmored Defense detected by name on ${rf.source.slug}; populate unarmored_defense:{ability:wis} flag for accuracy.`);
      return 10 + mods.dex + mods.wis;
    }
    if (rf.source.kind === "class" && rf.source.slug.includes("barbarian")) {
      warnings.push(`Unarmored Defense detected by name on ${rf.source.slug}; populate unarmored_defense:{ability:con} flag for accuracy.`);
      return 10 + mods.dex + mods.con;
    }
  }
  return base;
}

/** Initiative = DEX mod + Alert (+5 in 2014). Extendable via feat flags. */
export function initiativeBonus(dexMod: number, feats: FeatEntity[], edition: "2014" | "2024"): number {
  let bonus = dexMod;
  for (const f of feats) {
    if (f.slug === "alert" && edition === "2014") bonus += 5;
    const initBonus = (f as unknown as { initiative_bonus?: number }).initiative_bonus;
    if (typeof initBonus === "number") bonus += initBonus;
  }
  return bonus;
}

/** Speed = race.speed.walk + flat bonuses from feats (e.g., Mobile +10). */
export function speedFromRace(resolved: ResolvedCharacter): number {
  const base = resolved.race?.speed?.walk ?? 30;
  let extra = 0;
  for (const f of resolved.feats) {
    const bonus = (f as unknown as { speed_bonus?: number }).speed_bonus;
    if (typeof bonus === "number") extra += bonus;
  }
  return base + extra;
}

/** First class with a non-null spellcasting config, or null. */
export function spellcastingForFirstCastingClass(classes: ResolvedClass[]): {
  classEntity: ClassEntity;
  ability: Ability;
} | null {
  for (const c of classes) {
    const spell = c.entity?.spellcasting;
    if (c.entity && spell && typeof spell.ability === "string") {
      return { classEntity: c.entity, ability: spell.ability };
    }
  }
  return null;
}

/**
 * Combines racial ASI (from race.ability_bonuses), feat ASI, class-choice ASI
 * (from classes[i].choices[lvl].asi), and user overrides. Overrides win; ASI
 * sources sum unconditionally.
 */
export function computeAbilityScores(
  resolved: ResolvedCharacter,
  overrides: CharacterOverrides,
): Record<Ability, number> {
  const out = { ...resolved.definition.abilities };

  const race = resolved.race as unknown as { ability_bonuses?: Partial<Record<Ability, number>> } | null;
  if (race?.ability_bonuses) {
    for (const ab of ABILITY_KEYS) {
      const b = race.ability_bonuses[ab];
      if (typeof b === "number") out[ab] = (out[ab] ?? 0) + b;
    }
  }

  for (const c of resolved.classes) {
    for (const [, choice] of Object.entries(c.choices)) {
      const asi = (choice as { asi?: Partial<Record<Ability, number>> })?.asi;
      if (asi) {
        for (const ab of ABILITY_KEYS) {
          const v = asi[ab];
          if (typeof v === "number") out[ab] = (out[ab] ?? 0) + v;
        }
      }
    }
  }

  // Feat-granted flat ability bonuses (e.g., "Athlete: +1 STR").
  for (const f of resolved.feats) {
    const bonuses = (f as unknown as { ability_bonuses?: Partial<Record<Ability, number>> }).ability_bonuses;
    if (bonuses) {
      for (const ab of ABILITY_KEYS) {
        const v = bonuses[ab];
        if (typeof v === "number") out[ab] = (out[ab] ?? 0) + v;
      }
    }
  }

  // Overrides win.
  if (overrides.scores) {
    for (const ab of ABILITY_KEYS) {
      const v = overrides.scores[ab];
      if (typeof v === "number") out[ab] = v;
    }
  }

  // Default missing abilities to 10.
  for (const ab of ABILITY_KEYS) {
    if (typeof out[ab] !== "number") out[ab] = 10;
  }

  return out;
}

export function recalc(resolved: ResolvedCharacter): DerivedStats {
  const warnings: string[] = [];
  const overrides = resolved.definition.overrides ?? {};

  const scores = computeAbilityScores(resolved, overrides);
  const mods: Record<Ability, number> = {
    str: abilityModifier(scores.str),
    dex: abilityModifier(scores.dex),
    con: abilityModifier(scores.con),
    int: abilityModifier(scores.int),
    wis: abilityModifier(scores.wis),
    cha: abilityModifier(scores.cha),
  };

  const totalLevel = resolved.classes.reduce((s, c) => s + c.level, 0);
  const proficiencyBonus = proficiencyFromLevel(totalLevel || 1);

  // Saves (first class's saving_throws only, per 5e multiclass rule).
  const firstClass = resolved.classes[0]?.entity ?? null;
  const saveProfs = new Set<Ability>(firstClass?.saving_throws ?? []);
  const saves: Record<Ability, { bonus: number; proficient: boolean }> = {} as never;
  for (const ab of ABILITY_KEYS) {
    const override = overrides.saves?.[ab];
    const prof = override?.proficient ?? saveProfs.has(ab);
    const bonus = override?.bonus ?? savingThrow(scores[ab], prof, proficiencyBonus);
    saves[ab] = { bonus, proficient: prof };
  }

  // Skills
  const profSet = new Set(resolved.definition.skills.proficient);
  const expSet = new Set(resolved.definition.skills.expertise);
  const skills: DerivedStats["skills"] = {} as never;
  for (const skill of ALL_SKILLS) {
    const skillKey = skill.toLowerCase();
    const ab = SKILL_ABILITY[skillKey] as Ability;
    const override = overrides.skills?.[skillKey as SkillSlug];
    const tri: ProficiencyTri = override?.proficiency ?? (expSet.has(skillKey as SkillSlug) ? "expertise" : profSet.has(skillKey as SkillSlug) ? "proficient" : "none");
    const bonus = override?.bonus ?? skillBonus(scores[ab], tri, proficiencyBonus);
    (skills as Record<string, { bonus: number; proficiency: ProficiencyTri; ability: Ability }>)[skillKey] = {
      bonus,
      proficiency: tri,
      ability: ab,
    };
  }

  // Passives
  const perceptionTri = (skills as Record<string, { proficiency: ProficiencyTri }>).perception.proficiency;
  const investigationTri = (skills as Record<string, { proficiency: ProficiencyTri }>).investigation.proficiency;
  const insightTri = (skills as Record<string, { proficiency: ProficiencyTri }>).insight.proficiency;
  const passives = {
    perception: overrides.passives?.perception ?? passivePerception(scores.wis, perceptionTri, proficiencyBonus),
    investigation: overrides.passives?.investigation ?? passive(scores.int, investigationTri, proficiencyBonus),
    insight: overrides.passives?.insight ?? passive(scores.wis, insightTri, proficiencyBonus),
  };

  // HP
  const hpMaxDerived = multiclassMaxHP(resolved.classes, mods.con);
  const hpMax = overrides.hp?.max ?? hpMaxDerived;

  // AC
  const acDerived = unarmoredAC(resolved, mods, warnings);
  const ac = overrides.ac ?? acDerived;

  // Speed
  const speed = overrides.speed ?? speedFromRace(resolved);
  if (!resolved.race) warnings.push("No race resolved; speed defaulted to 30.");

  // Initiative
  const init = overrides.initiative ?? initiativeBonus(mods.dex, resolved.feats, resolved.definition.edition);

  // Spellcasting
  let spellcasting: DerivedStats["spellcasting"] = null;
  const casting = spellcastingForFirstCastingClass(resolved.classes);
  if (casting) {
    const saveDCDerived = saveDC(scores[casting.ability], proficiencyBonus);
    const atkDerived = attackBonus(scores[casting.ability], proficiencyBonus);
    spellcasting = {
      ability: casting.ability,
      saveDC: overrides.spellcasting?.saveDC ?? saveDCDerived,
      attackBonus: overrides.spellcasting?.attackBonus ?? atkDerived,
    };
  }

  return {
    totalLevel,
    proficiencyBonus,
    scores,
    mods,
    saves,
    skills,
    passives,
    hp: {
      max: hpMax,
      current: resolved.state.hp.current,
      temp: resolved.state.hp.temp,
    },
    ac,
    speed,
    initiative: init,
    spellcasting,
    warnings,
  };
}
