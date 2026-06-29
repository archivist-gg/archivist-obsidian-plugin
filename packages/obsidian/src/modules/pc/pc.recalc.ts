import {
  abilityModifier,
  proficiencyFromLevel,
  savingThrow,
  skillBonus,
  passivePerception,
  passive,
  attackBonus,
  saveDC,
} from "@archivist/dnd5e/dnd/math";
import { ABILITY_KEYS, SKILL_ABILITY, ALL_SKILLS } from "@archivist/dnd5e/dnd/constants";
import type { Ability, SkillSlug } from "@archivist/dnd5e";
import type { FeatEntity } from "../feat/feat.types";
import type { RaceEntity } from "../race/race.types";
import type { EntityRegistry } from "@archivist/core";
import { computeAppliedBonuses, computeSlotsAndAttacks, emptyAppliedBonuses } from "./pc.equipment";
import { collectChosenProficiencies, collectChosenAbilityPoints } from "./pc.decision-engine";
import { computeFeatureEffects } from "./pc.feature-effects";
import { computeConditionEffects } from "./pc.conditions";
import { resolveSpellcasting, deriveSpellSlots, computeSpellLimits, type CasterClassInput, type LimitClassInput } from "./pc.spellcasting";
import type {
  ACTerm,
  ChoiceValue,
  DerivedEquipment,
  DerivedStats,
  ProficiencySet,
  ResolvedCharacter,
  ResolvedClass,
  ResolvedFeature,
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
 * Resolves the selected subrace's fixed ability-score increases, matched by
 * slug the same way race-block merges subrace traits (the `[[..]]` wikilink
 * wrapper is stripped before comparison). Returns [] when no subrace selected
 * or no match. Choice-style increases are not expected on subraces here.
 */
function subraceAsi(
  resolved: ResolvedCharacter,
): Array<{ ability?: Ability; amount?: number }> {
  const subSlug = resolved.definition.subrace?.replace(/\[\[|\]\]/g, "") ?? null;
  if (!subSlug) return [];
  const subraces =
    (resolved.race as unknown as {
      subraces?: Array<{ slug: string; ability_score_increases?: Array<{ ability?: Ability; amount?: number }> }>;
    })?.subraces ?? [];
  const sub = subraces.find((s) => s.slug === subSlug);
  return sub?.ability_score_increases ?? [];
}

/**
 * Sums the LEGACY class-level ASI-BRANCH allocations (`choices[lvl].asi`) per
 * ability across every class. This is the path taken when an L4/L8-style
 * "Ability Score Increase or Feat" decision resolves to the plain +2 ASI branch
 * rather than a feat. Shared by both `computeAbilityScores`' fold and
 * `abilityBonusBreakdown`'s `class` bucket so the two reads can never drift.
 *
 * Disjoint from chosen-feat ability-points (`choices[lvl]["feat:<id>"]`) and from
 * origin ability-points — no source double-counts.
 */
export function collectClassAsiBranch(
  resolved: ResolvedCharacter,
): Partial<Record<Ability, number>> {
  const out: Partial<Record<Ability, number>> = {};
  for (const c of resolved.classes) {
    for (const [, choice] of Object.entries(c.choices)) {
      const asi = (choice as { asi?: Partial<Record<Ability, number>> })?.asi;
      if (!asi) continue;
      for (const ab of ABILITY_KEYS) {
        const v = asi[ab];
        if (typeof v === "number") out[ab] = (out[ab] ?? 0) + v;
      }
    }
  }
  return out;
}

/** Per-ability bonus provenance for the builder's obelisk captions:
 *  species = fixed race ASI + subrace fixed ASI + race ability-points choices;
 *  background = background ability-points choices;
 *  class = legacy class ASI-BRANCH allocations (the L4 asi-or-feat → asi path);
 *  feat = class chosen-feat ability-points (the L4 asi-or-feat → feat path) +
 *         flat feat ability_bonuses (e.g. Athlete +1 STR). All already fold into
 *         computeAbilityScores totals, so the caption must account for them or a
 *         tile reads higher than the named sources explain (smoke r1/r5c). */
export function abilityBonusBreakdown(
  resolved: ResolvedCharacter,
): Record<Ability, { species: number; background: number; class: number; feat: number }> {
  const race = flattenRaceAsi(resolved.race);
  const origin = collectChosenAbilityPoints(resolved);
  const sub = subraceAsi(resolved);
  const classAsi = collectClassAsiBranch(resolved);
  const featPoints = collectClassFeatAbilityPoints(resolved);

  const out = {} as Record<Ability, { species: number; background: number; class: number; feat: number }>;
  for (const ab of ABILITY_KEYS) {
    let species = (race[ab] ?? 0) + (origin.race[ab] ?? 0);
    for (const asi of sub) {
      if (asi.ability === ab && typeof asi.amount === "number") species += asi.amount;
    }
    let feat = featPoints[ab] ?? 0;
    for (const f of resolved.feats) {
      const bonus = (f as unknown as { ability_bonuses?: Partial<Record<Ability, number>> }).ability_bonuses?.[ab];
      if (typeof bonus === "number") feat += bonus;
    }
    out[ab] = { species, background: origin.background[ab] ?? 0, class: classAsi[ab] ?? 0, feat };
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

  // Generic unarmored-ac effect (e.g. Reaver Bravado: 10 + DEX + CHA).
  // Takes precedence over the legacy unarmored_defense flag scan below.
  for (const rf of resolved.features) {
    const eff = (rf.feature.effects ?? []).find((e) => e.kind === "unarmored-ac");
    if (eff && eff.kind === "unarmored-ac") {
      const base = eff.base ?? 10;
      const terms: ACTerm[] = [
        { source: "Unarmored", amount: base, kind: "unarmored" },
        { source: "DEX modifier", amount: mods.dex, kind: "dex" },
      ];
      let total = base + mods.dex;
      for (const ab of eff.abilities) {
        if (ab === "dex") continue; // dex already included
        terms.push({ source: `${ab.toUpperCase()} modifier (${rf.feature.name ?? "Unarmored"})`, amount: mods[ab], kind: "ability" });
        total += mods[ab];
      }
      return { total, terms };
    }
  }

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
 * Folds class-level CHOSEN-FEAT ability-points into per-ability totals.
 *
 * When the L4-style "asi or feat" decision resolves to a feat that carries
 * `ability-points` choices (e.g. Ability Score Improvement, the epic Boons),
 * the picker persists the allocation under the namespaced key
 * `choices[lvl]["feat:" + choice.id]` (the engine's `buildItem` surfaces those
 * children; see pc.decision-engine.ts). This is disjoint from both the legacy
 * asi-BRANCH key (`choices[lvl].asi`) and origin ability-points, so no source
 * double-counts. The chosen feat entity is resolved from `resolved.feats`
 * (already looked up by the resolver) — no registry needed here.
 *
 * Clamps defensively (per-ability max_per, then stops at the points total in
 * ABILITY_KEYS order), mirroring collectChosenAbilityPoints.
 */
export function collectClassFeatAbilityPoints(
  resolved: ResolvedCharacter,
): Partial<Record<Ability, number>> {
  const out: Partial<Record<Ability, number>> = {};
  const stripRef = (ref: string): string => ref.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const featBySlug = new Map<string, FeatEntity>();
  for (const f of resolved.feats) featBySlug.set(f.slug, f);

  for (const c of resolved.classes) {
    for (const atLevel of Object.values(c.choices)) {
      const block = atLevel as Record<string, ChoiceValue> | undefined;
      if (!block) continue;
      const featRef = block.feat;
      if (typeof featRef !== "string") continue;
      const feat = featBySlug.get(stripRef(featRef));
      if (!feat) continue;
      for (const ch of feat.choices ?? []) {
        if (ch.kind !== "ability-points") continue;
        const raw = block[`feat:${ch.id}`];
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        let left = ch.points;
        for (const ab of ABILITY_KEYS) {
          if (ch.pool && !ch.pool.includes(ab)) continue;
          const v = raw[ab];
          if (typeof v !== "number" || v <= 0 || left <= 0) continue;
          const take = Math.min(v, ch.max_per, left);
          out[ab] = (out[ab] ?? 0) + take;
          left -= take;
        }
      }
    }
  }
  return out;
}

/**
 * Combines racial ASI (from race.ability_score_increases), feat ASI,
 * class-choice ASI (from classes[i].choices[lvl].asi), chosen-feat ASI
 * (from classes[i].choices[lvl]["feat:<id>"]), and user overrides.
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

  // Subrace fixed increases (e.g. Hill Dwarf +1 WIS) — matched by slug the
  // same way race-block merges subrace traits.
  for (const asi of subraceAsi(resolved)) {
    if (asi.ability && typeof asi.amount === "number") out[asi.ability] = (out[asi.ability] ?? 0) + asi.amount;
  }

  // Origin (race/background) ability-points decisions (SP2 Plan 4). Class-level
  // ASI stays on the legacy choices[lvl].asi path below — no double-counting.
  const originPoints = collectChosenAbilityPoints(resolved);
  for (const src of [originPoints.race, originPoints.background]) {
    for (const ab of ABILITY_KEYS) {
      const v = src[ab];
      if (typeof v === "number") out[ab] = (out[ab] ?? 0) + v;
    }
  }

  // Legacy class ASI-BRANCH fold (`choices[lvl].asi`). Extracted into
  // collectClassAsiBranch so this fold and the breakdown's `class` bucket read
  // identically and can't drift.
  const classAsi = collectClassAsiBranch(resolved);
  for (const ab of ABILITY_KEYS) {
    const v = classAsi[ab];
    if (typeof v === "number") out[ab] = (out[ab] ?? 0) + v;
  }

  // Class CHOSEN-FEAT ability-points (SP2 Plan 5). Disjoint from the asi-branch
  // fold above (the `feat:<id>` key never collides with the `asi` branch key).
  const featPoints = collectClassFeatAbilityPoints(resolved);
  for (const ab of ABILITY_KEYS) {
    const v = featPoints[ab];
    if (typeof v === "number") out[ab] = (out[ab] ?? 0) + v;
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

/** Concats defense lists in precedence order (manual, equipment, features),
 *  deduping case-insensitively — first occurrence's spelling wins. */
function dedupeDefenseList(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const v of list) {
      const key = v.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
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
  // over resolved.features + currently-toggled activatable buffs; threaded into
  // each stat below, before overrides. The active set is the union of toggled
  // ids/slugs from state.active_buffs; activatable features fold ONLY while their
  // id is in it (a buff is off by default). Selected activatable pool boons are
  // surfaced as synthetic ResolvedFeatures (id = the boon slug) so their effects
  // gate on the same set.
  const activeBuffs = new Set(resolved.state.active_buffs ?? []);
  const buffFeatures: ResolvedFeature[] = [];
  for (const pool of resolved.pools ?? []) {
    for (const sel of pool.selected ?? []) {
      const e = sel.entity;
      if (e?.activatable && (e.effects?.length ?? 0) > 0) {
        buffFeatures.push({
          feature: { id: sel.slug, name: e.name, activatable: true, effects: e.effects },
          // source is inert for the fold; attribute to the pool's owning class
          // (never a hardcoded class) so the generic engine carries no homebrew name.
          source: { kind: "class", slug: resolved.classes[pool.classIndex]?.entity?.slug ?? pool.id, level: pool.anchorLevel },
        });
      }
    }
  }
  const featureEffects = computeFeatureEffects([...resolved.features, ...buffFeatures], { activeBuffs });
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
  // Effect-granted armor/weapon proficiencies are CATEGORIES ("heavy"/"shield",
  // "simple"/"martial") — same form class/race/feat grants use — so they must
  // land in the `.categories` bucket the proficiency-query matcher reads (incl.
  // the heavy→medium→light implication). `.specific` is per-item slugs only.
  for (const a of featureEffects.proficiencies.armor) {
    if (!profsForApply.armor.categories.includes(a)) profsForApply.armor.categories.push(a);
  }
  for (const w of featureEffects.proficiencies.weapons) {
    if (!profsForApply.weapons.categories.includes(w)) profsForApply.weapons.categories.push(w);
  }
  profsForApply.languages.sort();
  const applied = registry
    ? computeAppliedBonuses(resolved, profsForApply, registry, warnings)
    : emptyAppliedBonuses();

  // Partition the non-AC situational bonuses already collected in
  // `applied.informational` into per-stat slices for UI tooltips (Task 7).
  // (AC informational rides a separate path via derivedEquipment.acInformational.)
  const savesInformational = applied.informational.filter(
    (i) => i.field === "saving_throws",
  );
  const spellcastingInformational = applied.informational.filter(
    (i) => i.field === "spell_attack" || i.field === "spell_save_dc",
  );
  const speedInformational = applied.informational.filter((i) =>
    i.field.startsWith("speed."),
  );

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
  // Feature ac-bonus terms: requires_armor terms only count when armor is
  // actually equipped (the structured gate for Defense's "while wearing armor").
  const featureAcTermsFor = (hasArmor: boolean): ACTerm[] =>
    featureEffects.ac_terms
      .filter((t) => !t.requires_armor || hasArmor)
      .map((t) => ({ source: t.label, amount: t.value, kind: "feature" as const }));
  const sumTerms = (terms: ACTerm[]): number => terms.reduce((s, t) => s + t.amount, 0);

  // Resolve the weapon-ability override (Hexblade "Lies", etc.) for attacks.
  // The fold (computeFeatureEffects) already captured the first concrete-ability
  // override; a "spellcasting" override is resolved here against the primary
  // caster ability (the spellcasting block proper is computed below, but the
  // ability only needs the resolved classes — no slot/DC machinery).
  let weaponAbility = featureEffects.weaponAbility;
  const wantsSpellcasting = resolved.features.some((rf) =>
    (rf.feature.effects ?? []).some((e) => e.kind === "weapon-ability" && e.ability === "spellcasting"));
  // If both a concrete-ability and a "spellcasting" weapon-ability override exist,
  // spellcasting wins (overwrites the fold's first-concrete pick). No real feature
  // combines the two in v1; this just pins the precedence.
  if (wantsSpellcasting) {
    let primaryCasterAbility: Ability | null = null;
    for (const c of resolved.classes) {
      if (!c.entity) continue;
      const profile = resolveSpellcasting(c);
      if (profile) {
        primaryCasterAbility = profile.ability;
        break;
      }
    }
    if (primaryCasterAbility) weaponAbility = primaryCasterAbility;
  }

  let derivedEquipment: DerivedEquipment | null = null;
  let acDerived: number;
  let acBreakdownDerived: ACTerm[] = [];
  let acInformationalDerived: InformationalBonus[] = [];
  if (registry) {
    derivedEquipment = computeSlotsAndAttacks(resolved, mods, profsForApply, registry, warnings, proficiencyBonus, weaponAbility ?? undefined);
    if (derivedEquipment.equippedSlots.armor) {
      const featTerms = featureAcTermsFor(true);
      acDerived = derivedEquipment.ac + sumTerms(featTerms);
      acBreakdownDerived = [...derivedEquipment.acBreakdown, ...featTerms];
      acInformationalDerived = derivedEquipment.acInformational;
    } else {
      const { total: unarmored, terms: unarmoredTerms } = unarmoredACBreakdown(resolved, mods, warnings);
      // Pull additive contributions that stand alone without body armor: item
      // bonuses, per-entry overrides, AND a shield (RAW: a shield grants +2 even
      // when unarmored). The `armor`/`dex` terms are skipped — there's no body
      // armor, and the unarmored base already incorporates DEX (and class
      // unarmored defense).
      const additive = derivedEquipment.acBreakdown.filter(
        (b) => b.kind === "item" || b.kind === "override" || b.kind === "shield",
      );
      const featTerms = featureAcTermsFor(false);
      const additiveSum = additive.reduce((sum, b) => sum + b.amount, 0);
      acDerived = unarmored + additiveSum + sumTerms(featTerms);
      acBreakdownDerived = [...unarmoredTerms, ...additive, ...featTerms];
      // Magic items still source these conditional AC bonuses even on the
      // unarmored path (the additive merge above already includes their
      // numeric contributions); carry the situational pool through.
      acInformationalDerived = derivedEquipment.acInformational;
    }
  } else {
    const { total, terms } = unarmoredACBreakdown(resolved, mods, warnings);
    const featTerms = featureAcTermsFor(false);
    acDerived = total + sumTerms(featTerms);
    acBreakdownDerived = [...terms, ...featTerms];
  }
  const ac = overrides.ac ?? acDerived;

  // Speed. A `speed-bonus` with `set:true` is an absolute walk FLOOR (e.g.
  // "your base speed becomes 60"): Math.max against the additive total, so it
  // raises a slower race but never lowers an already-higher speed.
  const additiveSpeed = speedFromRace(resolved) + applied.speed_bonuses.walk + featureEffects.speed_walk_bonus;
  const baseSpeed = Math.max(featureEffects.speed_walk_set, additiveSpeed);
  const adjustedSpeed = (baseSpeed * conditionEffects.speed_multiplier) - conditionEffects.speed_reduction_ft;
  const conditionSpeed = conditionEffects.speed_floor_zero ? 0 : Math.max(0, Math.floor(adjustedSpeed));
  const speed = overrides.speed ?? conditionSpeed;
  if (!resolved.race) warnings.push("No race resolved; speed defaulted to 30.");

  // Initiative
  const init = overrides.initiative
    ?? (initiativeBonus(mods.dex, resolved.feats, resolved.definition.edition) + featureEffects.initiative_bonus);

  // Senses: race vision vs feature-effect senses — larger wins per type.
  const senses: DerivedStats["senses"] = {
    darkvision: Math.max(resolved.race?.vision?.darkvision ?? 0, featureEffects.senses.darkvision, applied.senses.darkvision),
    blindsight: Math.max(featureEffects.senses.blindsight, applied.senses.blindsight),
    tremorsense: Math.max(featureEffects.senses.tremorsense, applied.senses.tremorsense),
    truesight: Math.max(featureEffects.senses.truesight, applied.senses.truesight),
  };

  // Spellcasting (per class, multiclass-aware). Data-driven: each class's caster
  // type / ability / preparation / table come from its (or its subclass's)
  // spellcasting block via resolveSpellcasting — no hardcoded class knowledge.
  const spellcastingClasses: SpellcastingClassInfo[] = [];
  const slotInputs: CasterClassInput[] = [];
  const limitInputs: LimitClassInput[] = [];
  for (const c of resolved.classes) {
    if (!c.entity) continue;
    const profile = resolveSpellcasting(c);
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
    slotInputs.push({ casterType: profile.casterType, level: c.level });
    limitInputs.push({ classSlug: c.entity.slug, level: c.level, profile, abilityScore: scores[profile.ability] });
  }

  // Back-compat single object: first casting class (or null).
  const spellcasting: DerivedStats["spellcasting"] = spellcastingClasses.length > 0
    ? {
        ability: spellcastingClasses[0].ability,
        saveDC: spellcastingClasses[0].saveDC,
        attackBonus: spellcastingClasses[0].attackBonus,
      }
    : null;

  const derivedSlots = deriveSpellSlots(slotInputs);
  const spellLimits: SpellLimitInfo[] = computeSpellLimits(limitInputs);

  const defenses = {
    resistances: dedupeDefenseList([
      resolved.definition.defenses?.resistances ?? [],
      applied.defenses.resistances,
      featureEffects.resistances,
    ]),
    immunities: dedupeDefenseList([
      resolved.definition.defenses?.immunities ?? [],
      applied.defenses.immunities,
    ]),
    vulnerabilities: dedupeDefenseList([
      resolved.definition.defenses?.vulnerabilities ?? [],
      applied.defenses.vulnerabilities,
    ]),
    condition_immunities: dedupeDefenseList([
      resolved.definition.defenses?.condition_immunities ?? [],
      applied.defenses.condition_immunities,
      featureEffects.condition_immunities,
    ]),
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
    savesInformational,
    spellcastingInformational,
    speedInformational,
    // Always ≥ 1; non-stacking (Math.max) extra attacks fold in pc.feature-effects.
    attacksPerAction: 1 + featureEffects.extraAttack,
    // Consolidated post-apply over the built attack rows: the d20 condition
    // penalty (always), plus display-only annotations conditionally spread so
    // untouched rows keep `critRange`/`attackNotes` ABSENT (not 20 / not []).
    // crit-range: folded weapon crit threshold, only when an effect lowered it.
    // attackNotes: reroll-damage / attack-rule captions, only when non-empty.
    attacks: (derivedEquipment?.attacks ?? []).map((a) => ({
      ...a,
      toHit: a.toHit + conditionEffects.d20_test_penalty,
      ...(featureEffects.critRange < 20 ? { critRange: featureEffects.critRange } : {}),
      ...(featureEffects.attackNotes.length ? { attackNotes: featureEffects.attackNotes } : {}),
    })),
    equippedSlots: derivedEquipment?.equippedSlots ?? {},
    carriedWeight: derivedEquipment?.carriedWeight ?? 0,
    attunementUsed: derivedEquipment?.attunementUsed ?? 0,
    attunementLimit: derivedEquipment?.attunementLimit ?? (overrides.attunement_limit ?? 3),
    conditionEffects,
    rollModifiers: featureEffects.rollModifiers,
  };
}
