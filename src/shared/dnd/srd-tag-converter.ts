import { abilityModifier } from "./math";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface ConverterAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type ActionCategory =
  | "action"
  | "trait"
  | "reaction"
  | "legendary"
  | "bonus"
  | "special";

export interface ConversionContext {
  abilities: ConverterAbilities;
  profBonus: number;
  actionName: string;
  actionCategory: ActionCategory;
  spellAbility?: "int" | "wis" | "cha";
}

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Convert SRD plain-English descriptions (e.g. "Melee Weapon Attack: +14 to hit,
 * Hit: 21 (3d8 + 8) slashing damage") into backtick formula tags
 * (e.g. "Melee Weapon Attack: `atk:STR`, Hit: `damage:3d8+STR` slashing damage")
 * by reverse-inferring which ability mod + prof produced the static value.
 *
 * Pure. Deterministic. Never throws: wraps everything in try/catch and returns
 * the original desc on any failure.
 */
export function convertDescToTags(desc: string, ctx: ConversionContext): string {
  try {
    if (!ctx.abilities) return desc;

    const mods = computeMods(ctx.abilities);
    const dcTargets = computeDcTargets(mods, ctx.profBonus);

    let result = desc;

    // Pass 1 — DC with explicit ability word
    result = result.replace(
      /DC (\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/gi,
      (_match: string, n: string, abilityWord: string) => {
        const dc = Number(n);
        const abil = abilityWordToKey(abilityWord);
        if (abil && dcTargets[abil] === dc) {
          return `\`dc:${abil.toUpperCase()}\` ${abilityWord}`;
        }
        return `\`dc:${dc}\` ${abilityWord}`;
      },
    );

    // Pass 2 — Attack bonus
    const atkTargets = computeAtkTargets(mods, ctx.profBonus);
    result = result.replace(
      /([+-])(\d+)\s+to\s+hit/g,
      (_match: string, sign: string, n: string) => {
        const bonus = sign === "-" ? -Number(n) : Number(n);
        const candidates = ABILITY_KEYS.filter((k) => atkTargets[k] === bonus);
        if (candidates.length === 0) {
          const signedStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
          return `\`atk:${signedStr}\``;
        }
        const abil = disambiguateAbility(candidates, ctx, desc);
        return `\`atk:${abil.toUpperCase()}\``;
      },
    );

    // Pass 3 — Damage expressions
    // Matches: optional "21 (" average, required "3d8", optional "+ 8" bonus,
    // optional ")" closer, optional "slashing" type word, required "damage" keyword.
    result = result.replace(
      /(?:(\d+)\s*\()?(\d+d\d+)(?:\s*([+-])\s*(\d+))?\s*\)?(?:\s+(\w+))?\s+damage/gi,
      (
        _match: string,
        _average: string | undefined,
        dice: string,
        sign: string | undefined,
        bonusStr: string | undefined,
        typeWord: string | undefined,
      ) => {
        let inner = dice;
        if (bonusStr != null) {
          const bonus = sign === "-" ? -Number(bonusStr) : Number(bonusStr);
          const matchingAbilities = ABILITY_KEYS.filter((k) => mods[k] === bonus);
          if (matchingAbilities.length > 0) {
            const abil = disambiguateAbility(matchingAbilities, ctx, desc);
            inner = `${dice}+${abil.toUpperCase()}`;
          } else {
            inner = `${dice}${bonus >= 0 ? "+" : ""}${bonus}`;
          }
        }
        const typeSuffix = typeWord ? ` ${typeWord} damage` : " damage";
        return `\`damage:${inner}\`${typeSuffix}`;
      },
    );

    // Pass 1b — DC without ability word (fallback for "spell save DC N")
    // By this point Pass 1 has already consumed "DC N Ability" patterns,
    // so only bare "DC N" fragments remain. The lookbehind prevents
    // re-matching DCs already inside backtick tags (idempotency).
    result = result.replace(
      /(?<!`)DC (\d+)(?!\s*(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))/gi,
      (_match: string, n: string) => {
        const dc = Number(n);
        const candidates = ABILITY_KEYS.filter((k) => dcTargets[k] === dc);
        if (ctx.spellAbility && candidates.includes(ctx.spellAbility)) {
          return `\`dc:${ctx.spellAbility.toUpperCase()}\``;
        }
        if (candidates.length === 1) {
          return `\`dc:${candidates[0].toUpperCase()}\``;
        }
        if (candidates.length > 1) {
          const abil = disambiguateAbility(candidates, ctx, desc);
          return `\`dc:${abil.toUpperCase()}\``;
        }
        return `\`dc:${dc}\``;
      },
    );

    // Pass 4 — Bare dice in prose (same transform as the render-time decorator)
    // The alternation branch `[^`]*` consumes backtick-delimited spans and
    // returns them untouched, so dice already inside tags are protected.
    result = result.replace(
      /`[^`]*`|(?<!\w)(\d+d\d+(?:\s*[+-]\s*\d+)?)(?!\w)/g,
      (match: string, dice: string | undefined) => {
        if (dice) return `\`dice:${dice.replace(/\s+/g, "")}\``;
        return match;
      },
    );

    return result;
  } catch {
    return desc;
  }
}

// --- Helpers ----------------------------------------------------------------

function computeMods(abilities: ConverterAbilities): Record<AbilityKey, number> {
  return {
    str: abilityModifier(abilities.str),
    dex: abilityModifier(abilities.dex),
    con: abilityModifier(abilities.con),
    int: abilityModifier(abilities.int),
    wis: abilityModifier(abilities.wis),
    cha: abilityModifier(abilities.cha),
  };
}

function computeDcTargets(
  mods: Record<AbilityKey, number>,
  profBonus: number,
): Record<AbilityKey, number> {
  return {
    str: 8 + profBonus + mods.str,
    dex: 8 + profBonus + mods.dex,
    con: 8 + profBonus + mods.con,
    int: 8 + profBonus + mods.int,
    wis: 8 + profBonus + mods.wis,
    cha: 8 + profBonus + mods.cha,
  };
}

function computeAtkTargets(
  mods: Record<AbilityKey, number>,
  profBonus: number,
): Record<AbilityKey, number> {
  return {
    str: mods.str + profBonus,
    dex: mods.dex + profBonus,
    con: mods.con + profBonus,
    int: mods.int + profBonus,
    wis: mods.wis + profBonus,
    cha: mods.cha + profBonus,
  };
}

function disambiguateAbility(
  candidates: AbilityKey[],
  ctx: ConversionContext,
  desc: string,
): AbilityKey {
  if (candidates.length === 1) return candidates[0];

  const combined = `${desc} ${ctx.actionName}`.toLowerCase();

  const prefers = (abil: AbilityKey): AbilityKey | undefined =>
    candidates.includes(abil) ? abil : undefined;

  if (/melee\s+or\s+ranged\s+weapon\s+attack/.test(combined)) {
    return prefers("str") ?? prefers("dex") ?? candidates[0];
  }
  if (/melee\s+weapon\s+attack/.test(combined)) {
    return prefers("str") ?? prefers("dex") ?? candidates[0];
  }
  if (/ranged\s+weapon\s+attack/.test(combined)) {
    return prefers("dex") ?? candidates[0];
  }
  if (/spell\s+attack/.test(combined)) {
    if (ctx.spellAbility && candidates.includes(ctx.spellAbility)) {
      return ctx.spellAbility;
    }
    return prefers("wis") ?? candidates[0];
  }

  // Name-based keyword signals
  const rangedWords = /\b(bow|crossbow|dart|sling)\b/;
  const meleeWords = /\b(bite|claw|slam|tail|gore|horns?|fist|hoof|talons?)\b/;
  if (rangedWords.test(ctx.actionName.toLowerCase())) {
    return prefers("dex") ?? candidates[0];
  }
  if (meleeWords.test(ctx.actionName.toLowerCase())) {
    return prefers("str") ?? candidates[0];
  }

  // Deterministic fallback: alphabetical
  return [...candidates].sort()[0];
}

function abilityWordToKey(word: string): AbilityKey | undefined {
  const lower = word.toLowerCase();
  switch (lower) {
    case "strength": return "str";
    case "dexterity": return "dex";
    case "constitution": return "con";
    case "intelligence": return "int";
    case "wisdom": return "wis";
    case "charisma": return "cha";
  }
  return undefined;
}

/**
 * Scan a monster's trait list for a spellcasting ability declaration like
 * "Its spellcasting ability is Wisdom". Returns undefined for non-casters.
 */
export function detectSpellcastingAbility(
  traits: { name: string; entries: string[] }[] | undefined,
): "int" | "wis" | "cha" | undefined {
  if (!traits) return undefined;
  for (const trait of traits) {
    for (const entry of trait.entries) {
      const match = entry.match(/spellcasting ability is (intelligence|wisdom|charisma)/i);
      if (match) {
        const name = match[1].toLowerCase();
        if (name === "intelligence") return "int";
        if (name === "wisdom") return "wis";
        if (name === "charisma") return "cha";
      }
    }
  }
  return undefined;
}
