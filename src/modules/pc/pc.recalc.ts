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
import type { FeatEntity } from "../feat/feat.types";
import type { RaceEntity } from "../race/race.types";
import type { EntityRegistry } from "../../shared/entities/entity-registry";
import { computeAppliedBonuses, computeSlotsAndAttacks, emptyAppliedBonuses } from "./pc.equipment";
import { collectChosenProficiencies } from "./pc.decision-engine";
import { computeFeatureEffects } from "./pc.feature-effects";
import { computeConditionEffects } from "./pc.conditions";
import { getSpellcastingProfile, deriveSpellSlots, computeSpellLimits } from "./pc.spellcasting";
import type {
  ACTerm,
  DerivedEquipment,
  DerivedStats,
  ProficiencySet,
  ResolvedCharacter,
  ResolvedClass,
  CharacterOverrides,
  SpellcastingClassInfo,
  SpellLimitInfo,
} from "./pc.types";
import type { InformationalBonus } from "../item/item.conditions.types";

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
 * ALL_SKILLS entries are Title Case ("Animal Handling"); DerivedStats.skills
 * keys are kebab-case SkillSlug ("animal-handling"); shared SKILL_ABILITY keys
 * are space-lowercase ("animal handling"). These two helpers bridge the gap.
 */
function skillSlugFromDisplay(display: string): SkillSlug {
  return display.toLowerCase().replace(/\s+/g, "-") as SkillSlug;
}

function skillSlugToAbilityLookup(slug: SkillSlug): string {
  return slug.replace(/-/g, " ");
}

/**
 * Flattens RaceEntity.ability_score_increases into a partial ability→bonus map.
 * Fixed increases contribute their amount directly. Choice increases are ignored
 * here — they're expected to come through class.choices with a specific ability
 * selected, which computeAbilityScores handles separately.
 */
export function flattenRaceAsi(race: RaceEntity | null): Partial<Record<Ability, number>> {
  const out: Partial<Record<Ability, number>> = {};
  if (!race?.ability_score_increases) return out;
  for (const asi of race.ability_score_increases) {
    if ("ability" in asi) {
      out[asi.ability] = (out[asi.ability] ?? 0) + asi.amount;
    }
    // Choice increases are resolved through class.choices; skip here.
  }
  return out;
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
  return unarmoredACBreakdown(resolved, mods, warnings).total;
}

/**
 * Same logic as `unarmoredAC` but also returns a structured breakdown of the
 * contributing terms (Base 10, DEX, optional class unarmored defense ability).
 * Used by recalc to assemble a richer acBreakdown when no armor is equipped.
 */
export function unarmoredACBreakdown(
  resolved: ResolvedCharacter,
  mods: Record<Ability, number>,
  warnings: string[],
): { total: number; terms: ACTerm[] } {
  const baseTerms: ACTerm[] = [
    { source: "Unarmored", amount: 10, kind: "unarmored" },
    { source: "DEX modifier", amount: mods.dex, kind: "dex" },
  ];

  for (const rf of resolved.features) {
    const feat = rf.feature as unknown as { unarmored_defense?: { ability: Ability }; name?: string };
    if (feat.unarmored_defense?.ability) {
      const ab = feat.unarmored_defense.ability;
      const amt = mods[ab] ?? 0;
      const terms: ACTerm[] = [
        ...baseTerms,
        { source: `${ab.toUpperCase()} modifier (Unarmored Defense)`, amount: amt, kind: "ability" },
      ];
      return { total: 10 + mods.dex + amt, terms };
    }
  }

  // Heuristic fallback by feature name.
  for (const rf of resolved.features) {
    const name = (rf.feature.name ?? "").toLowerCase();
    if (!/unarmored\s*defense/.test(name)) continue;
    if (rf.source.kind === "class" && rf.source.slug.includes("monk")) {
      warnings.push(`Unarmored Defense detected by name on ${rf.source.slug}; populate unarmored_defense:{ability:wis} flag for accuracy.`);
      const terms: ACTerm[] = [
        ...baseTerms,
        { source: "WIS modifier (Unarmored Defense)", amount: mods.wis, kind: "ability" },
      ];
      return { total: 10 + mods.dex + mods.wis, terms };
    }
    if (rf.source.kind === "class" && rf.source.slug.includes("barbarian")) {
      warnings.push(`Unarmored Defense detected by name on ${rf.source.slug}; populate unarmored_defense:{ability:con} flag for accuracy.`);
      const terms: ACTerm[] = [
        ...baseTerms,
        { source: "CON modifier (Unarmored Defense)", amount: mods.con, kind: "ability" },
      ];
      return { total: 10 + mods.dex + mods.con, terms };
    }
  }

  return { total: 10 + mods.dex, terms: baseTerms };
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

/**
 * Combines racial ASI (from race.ability_score_increases), feat ASI,
 * class-choice ASI (from classes[i].choices[lvl].asi), and user overrides.
 * Overrides win; ASI sources sum unconditionally.
 */
export function computeAbilityScores(
  resolved: ResolvedCharacter,
  overrides: CharacterOverrides,
): Record<Ability, number> {
  const out = { ...resolved.definition.abilities };

  const raceBonuses = flattenRaceAsi(resolved.race);
  for (const ab of ABILITY_KEYS) {
    const b = raceBonuses[ab];
    if (typeof b === "number") out[ab] = (out[ab] ?? 0) + b;
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

interface ClassProficiencies {
  armor?: { categories?: string[]; specific?: string[] } | string[];
  weapons?: { categories?: string[]; specific?: string[] } | string[];
  tools?: { categories?: string[]; specific?: string[] } | string[];
  languages?: string[];
}

function normalizeProfList(input: ClassProficiencies["armor"]): { categories: string[]; specific: string[] } {
  if (!input) return { categories: [], specific: [] };
  if (Array.isArray(input)) return { categories: [], specific: input };
  return { categories: input.categories ?? [], specific: input.specific ?? [] };
}

function mergeInto(target: ProficiencySet, source: { categories: string[]; specific: string[] }): void {
  for (const c of source.categories) if (!target.categories.includes(c)) target.categories.push(c);
  for (const s of source.specific) if (!target.specific.includes(s)) target.specific.push(s);
}

export function computeProficiencies(
  resolved: ResolvedCharacter,
): { armor: ProficiencySet; weapons: ProficiencySet; tools: ProficiencySet; languages: string[]; saves: Ability[] } {
  const armor: ProficiencySet = { categories: [], specific: [] };
  const weapons: ProficiencySet = { categories: [], specific: [] };
  const tools: ProficiencySet = { categories: [], specific: [] };
  const languages = new Set<string>();

  for (const c of resolved.classes) {
    const p = (c.entity as unknown as { proficiencies?: ClassProficiencies })?.proficiencies;
    if (!p) continue;
    mergeInto(armor, normalizeProfList(p.armor));
    mergeInto(weapons, normalizeProfList(p.weapons));
    mergeInto(tools, normalizeProfList(p.tools));
    p.languages?.forEach((l) => languages.add(l));
  }

  const racePr = (resolved.race as unknown as { proficiencies?: ClassProficiencies })?.proficiencies;
  if (racePr) {
    mergeInto(armor, normalizeProfList(racePr.armor));
    mergeInto(weapons, normalizeProfList(racePr.weapons));
    mergeInto(tools, normalizeProfList(racePr.tools));
    racePr.languages?.forEach((l) => languages.add(l));
  }

  const bgPr = (resolved.background as unknown as { proficiencies?: ClassProficiencies })?.proficiencies;
  if (bgPr) {
    mergeInto(armor, normalizeProfList(bgPr.armor));
    mergeInto(weapons, normalizeProfList(bgPr.weapons));
    mergeInto(tools, normalizeProfList(bgPr.tools));
    bgPr.languages?.forEach((l) => languages.add(l));
  }

  for (const f of resolved.feats) {
    const grants = (f as unknown as { grants_proficiency?: ClassProficiencies }).grants_proficiency;
    if (!grants) continue;
    mergeInto(armor, normalizeProfList(grants.armor));
    mergeInto(weapons, normalizeProfList(grants.weapons));
    mergeInto(tools, normalizeProfList(grants.tools));
    grants.languages?.forEach((l) => languages.add(l));
  }

  return {
    armor,
    weapons,
    tools,
    languages: Array.from(languages).sort(),
    saves: [],
  };
}

export function recalc(resolved: ResolvedCharacter, registry?: EntityRegistry): DerivedStats {
  const warnings: string[] = [];
  const overrides = resolved.definition.overrides ?? {};

  // Pass A: apply equipment-derived bonuses (only when registry is available).
  // The legacy single-arg call path keeps an empty AppliedBonuses so all the
  // arithmetic below is a no-op and existing callsites/tests stay green.
  // Chosen proficiencies from persisted decisions (SP2 Plan 3): skills/expertise
  // fold into the skill tri below; languages/tools fold into the proficiency set.
  const chosenProfs = collectChosenProficiencies(resolved);
  // Feature-effects pass (effects-application engine): one pure aggregation
  // over resolved.features; threaded into each stat below, before overrides.
  const featureEffects = computeFeatureEffects(resolved.features);
  const profsForApply = computeProficiencies(resolved);
  for (const t of chosenProfs.tools) {
    if (!profsForApply.tools.specific.includes(t)) profsForApply.tools.specific.push(t);
  }
  for (const l of chosenProfs.languages) {
    if (!profsForApply.languages.includes(l)) profsForApply.languages.push(l);
  }
  for (const t of featureEffects.proficiencies.tools) {
    if (!profsForApply.tools.specific.includes(t)) profsForApply.tools.specific.push(t);
  }
  for (const l of featureEffects.proficiencies.languages) {
    if (!profsForApply.languages.includes(l)) profsForApply.languages.push(l);
  }
  profsForApply.languages.sort();
  const applied = registry
    ? computeAppliedBonuses(resolved, profsForApply, registry, warnings)
    : emptyAppliedBonuses();

  // Ability scores: base computation, then apply Pass A bonus first, then
  // static (only when it raises the score), then user overrides win.
  const baseScores = computeAbilityScores(resolved, overrides);
  const scores: Record<Ability, number> = { ...baseScores };
  for (const ab of ABILITY_KEYS) {
    const bonus = applied.ability_bonuses[ab];
    if (typeof bonus === "number") scores[ab] += bonus;
  }
  for (const ab of ABILITY_KEYS) {
    const stat = applied.ability_statics[ab];
    if (typeof stat === "number" && stat > scores[ab]) scores[ab] = stat;
  }
  if (overrides.scores) {
    for (const ab of ABILITY_KEYS) {
      const o = overrides.scores[ab];
      if (typeof o === "number") scores[ab] = o;
    }
  }
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

  const conditionEffects = computeConditionEffects(
    resolved.state,
    resolved.definition.edition,
    scores,
  );

  // Saves (first class's saving_throws only, per 5e multiclass rule).
  const firstClass = resolved.classes[0]?.entity ?? null;
  const saveProfs = new Set<Ability>(firstClass?.saving_throws ?? []);
  for (const ab of featureEffects.proficiencies.saves) saveProfs.add(ab);
  const saves: Record<Ability, { bonus: number; proficient: boolean }> = {} as never;
  for (const ab of ABILITY_KEYS) {
    const override = overrides.saves?.[ab];
    const prof = override?.proficient ?? saveProfs.has(ab);
    const derivedBonus = savingThrow(scores[ab], prof, proficiencyBonus) + applied.save_bonus + conditionEffects.d20_test_penalty;
    const bonus = override?.bonus ?? derivedBonus;
    saves[ab] = { bonus, proficient: prof };
  }

  // Skills (definition lists + chosen decision proficiencies/expertise).
  const profSet = new Set([
    ...resolved.definition.skills.proficient,
    ...chosenProfs.skills,
    ...featureEffects.proficiencies.skills,
  ]);
  const expSet = new Set([...resolved.definition.skills.expertise, ...chosenProfs.expertise]);
  const skills: DerivedStats["skills"] = {} as never;
  for (const skill of ALL_SKILLS) {
    const skillKey = skillSlugFromDisplay(skill);
    const ab = SKILL_ABILITY[skillSlugToAbilityLookup(skillKey)] as Ability;
    const override = overrides.skills?.[skillKey];
    const tri: ProficiencyTri = override?.proficiency
      ?? (expSet.has(skillKey) ? "expertise"
        : profSet.has(skillKey) ? "proficient"
        : "none");
    const bonus = override?.bonus ?? (skillBonus(scores[ab], tri, proficiencyBonus) + conditionEffects.d20_test_penalty);
    (skills as Record<string, { bonus: number; proficiency: ProficiencyTri; ability: Ability }>)[skillKey] = {
      bonus,
      proficiency: tri,
      ability: ab,
    };
  }

  // Passives
  const perceptionTri = skills.perception.proficiency;
  const investigationTri = skills.investigation.proficiency;
  const insightTri = skills.insight.proficiency;
  const passives = {
    perception: overrides.passives?.perception ?? passivePerception(scores.wis, perceptionTri, proficiencyBonus),
    investigation: overrides.passives?.investigation ?? passive(scores.int, investigationTri, proficiencyBonus),
    insight: overrides.passives?.insight ?? passive(scores.wis, insightTri, proficiencyBonus),
  };

  // HP
  const hpMaxDerived = multiclassMaxHP(resolved.classes, mods.con)
    + featureEffects.hp_per_level_bonus * totalLevel;
  const hpMaxAfterConditions = Math.floor(hpMaxDerived * conditionEffects.hp_max_multiplier);
  const hpMax = overrides.hp?.max ?? hpMaxAfterConditions;

  // AC + attacks (Pass B). Falls back to unarmored when no registry available.
  //
  // Bug fix: when no armor is equipped, the previous code returned the bare
  // unarmored AC and discarded `derivedEquipment.ac` entirely — so magic-item
  // AC bonuses (Bracers of Defense, Cloak of Protection, Ring of Protection)
  // never applied to an unarmored character. We now layer the equipment-derived
  // item/override AC contributions on top of the unarmored base, while still
  // dropping armor/shield/dex contributions from the equipment breakdown
  // (there's no armor, and the unarmored base already includes its own DEX).
  let derivedEquipment: DerivedEquipment | null = null;
  let acDerived: number;
  let acBreakdownDerived: ACTerm[] = [];
  let acInformationalDerived: InformationalBonus[] = [];
  if (registry) {
    derivedEquipment = computeSlotsAndAttacks(resolved, mods, profsForApply, registry, warnings, proficiencyBonus);
    if (derivedEquipment.equippedSlots.armor) {
      acDerived = derivedEquipment.ac;
      acBreakdownDerived = derivedEquipment.acBreakdown;
      acInformationalDerived = derivedEquipment.acInformational;
    } else {
      const { total: unarmored, terms: unarmoredTerms } = unarmoredACBreakdown(resolved, mods, warnings);
      // Pull only additive contributions (item bonuses + per-entry overrides);
      // armor/shield/dex are skipped because no armor is equipped and the
      // unarmored base already incorporates DEX (and class unarmored defense).
      const additive = derivedEquipment.acBreakdown.filter(
        (b) => b.kind === "item" || b.kind === "override",
      );
      const additiveSum = additive.reduce((sum, b) => sum + b.amount, 0);
      acDerived = unarmored + additiveSum;
      acBreakdownDerived = [...unarmoredTerms, ...additive];
      // Magic items still source these conditional AC bonuses even on the
      // unarmored path (the additive merge above already includes their
      // numeric contributions); carry the situational pool through.
      acInformationalDerived = derivedEquipment.acInformational;
    }
  } else {
    const { total, terms } = unarmoredACBreakdown(resolved, mods, warnings);
    acDerived = total;
    acBreakdownDerived = terms;
  }
  const ac = overrides.ac ?? acDerived;

  // Speed
  const baseSpeed = speedFromRace(resolved) + applied.speed_bonuses.walk + featureEffects.speed_walk_bonus;
  const adjustedSpeed = (baseSpeed * conditionEffects.speed_multiplier) - conditionEffects.speed_reduction_ft;
  const conditionSpeed = conditionEffects.speed_floor_zero ? 0 : Math.max(0, Math.floor(adjustedSpeed));
  const speed = overrides.speed ?? conditionSpeed;
  if (!resolved.race) warnings.push("No race resolved; speed defaulted to 30.");

  // Initiative
  const init = overrides.initiative
    ?? (initiativeBonus(mods.dex, resolved.feats, resolved.definition.edition) + featureEffects.initiative_bonus);

  // Senses: race vision vs feature-effect darkvision — larger wins.
  const senses = {
    darkvision: Math.max(resolved.race?.vision?.darkvision ?? 0, featureEffects.darkvision),
  };

  // Spellcasting (per class, multiclass-aware)
  const edition = resolved.definition.edition;
  const spellcastingClasses: SpellcastingClassInfo[] = [];
  for (const c of resolved.classes) {
    if (!c.entity) continue;
    const profile = getSpellcastingProfile(c.entity.slug, edition);
    if (!profile) continue;
    const dc = saveDC(scores[profile.ability], proficiencyBonus) + applied.spell_save_dc;
    const atk = attackBonus(scores[profile.ability], proficiencyBonus) + applied.spell_attack;
    spellcastingClasses.push({
      classSlug: c.entity.slug,
      className: c.entity.name,
      ability: profile.ability,
      saveDC: overrides.spellcasting?.saveDC ?? dc,
      attackBonus: overrides.spellcasting?.attackBonus ?? atk,
      casterType: profile.casterType,
      preparation: profile.preparation,
    });
  }

  // Back-compat single object: first casting class (or null).
  const spellcasting: DerivedStats["spellcasting"] = spellcastingClasses.length > 0
    ? {
        ability: spellcastingClasses[0].ability,
        saveDC: spellcastingClasses[0].saveDC,
        attackBonus: spellcastingClasses[0].attackBonus,
      }
    : null;

  const derivedSlots = deriveSpellSlots(
    resolved.classes.filter((c) => c.entity).map((c) => ({ classSlug: c.entity!.slug, level: c.level })),
    edition,
  );

  const spellLimits: SpellLimitInfo[] = computeSpellLimits(
    resolved.classes.flatMap((c) => {
      if (!c.entity) return [];
      const profile = getSpellcastingProfile(c.entity.slug, edition);
      if (!profile) return [];
      return [{ classSlug: c.entity.slug, level: c.level, entity: c.entity, abilityScore: scores[profile.ability] }];
    }),
    edition,
  );

  const defenses = {
    resistances: [
      ...(resolved.definition.defenses?.resistances ?? []),
      ...applied.defenses.resistances,
    ],
    immunities: [
      ...(resolved.definition.defenses?.immunities ?? []),
      ...applied.defenses.immunities,
    ],
    vulnerabilities: [
      ...(resolved.definition.defenses?.vulnerabilities ?? []),
      ...applied.defenses.vulnerabilities,
    ],
    condition_immunities: [
      ...(resolved.definition.defenses?.condition_immunities ?? []),
      ...applied.defenses.condition_immunities,
    ],
  };

  return {
    totalLevel,
    proficiencyBonus,
    scores,
    mods,
    saves,
    proficiencies: profsForApply,
    skills,
    passives,
    senses,
    hp: {
      max: hpMax,
      current: resolved.state.hp.current,
      temp: resolved.state.hp.temp,
    },
    ac,
    speed,
    initiative: init,
    spellcasting,
    spellcastingClasses,
    derivedSpellSlots: derivedSlots.standard,
    pactMagic: derivedSlots.pact,
    spellLimits,
    warnings,
    defenses,
    acBreakdown: acBreakdownDerived,
    acInformational: acInformationalDerived,
    attacks: (derivedEquipment?.attacks ?? []).map((a) => ({
      ...a,
      toHit: a.toHit + conditionEffects.d20_test_penalty,
    })),
    equippedSlots: derivedEquipment?.equippedSlots ?? {},
    carriedWeight: derivedEquipment?.carriedWeight ?? 0,
    attunementUsed: derivedEquipment?.attunementUsed ?? 0,
    attunementLimit: derivedEquipment?.attunementLimit ?? (overrides.attunement_limit ?? 3),
    conditionEffects,
  };
}
