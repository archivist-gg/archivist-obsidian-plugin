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
 * Shared static-fallback context for callers that enrich creature-agnostic
 * content (spells, magic items) where no real ability mods / prof bonus exist.
 *
 * All ability mods = 0 and prof = 0, so no computed target matches any
 * reasonable value and every pattern falls to the static fallback path
 * (e.g. `dc:15`, `atk:+7`).
 */
export const STATIC_FALLBACK_CONTEXT: ConversionContext = {
  abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  profBonus: 0,
  actionName: "",
  actionCategory: "trait",
};

const NATURAL_MELEE_NAMES = /\b(bite|claws?|slam|gore|tail|hooves|tusks?|talons?|fist|horns?)\b/i;
const FINESSE_WEAPON_NAMES = /\b(shortsword|rapier|dagger|whip|scimitar)\b/i;
const RANGED_WEAPON_NAMES = /\b(bow|crossbow|sling|dart|blowgun|javelin)\b/i;
const SPELL_ATTACK_PHRASES = /\bspell\s+attack\b/i;

function preferredAbilitiesForAttack(actionName: string, desc: string, spellAbility?: AbilityKey): AbilityKey[] {
  const combined = `${actionName} ${desc}`;
  if (SPELL_ATTACK_PHRASES.test(combined) && spellAbility) return [spellAbility];

  if (RANGED_WEAPON_NAMES.test(actionName)) return ["dex"];
  if (FINESSE_WEAPON_NAMES.test(actionName)) return ["str", "dex"];
  if (NATURAL_MELEE_NAMES.test(actionName)) return ["str", "dex"];
  return ["str", "dex"];
}

function identifyAbility(
  damageBonus: number | null,
  preferred: AbilityKey[],
  mods: Record<AbilityKey, number>,
): AbilityKey | null {
  if (damageBonus === null) return null;
  const candidates = ABILITY_KEYS.filter((k) => mods[k] === damageBonus);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  for (const p of preferred) {
    if (candidates.includes(p)) return p;
  }
  return [...candidates].sort()[0];
}

function parseDamageBonusFromHitText(desc: string, attackPos: number): number | null {
  const window = desc.slice(attackPos, attackPos + 250);
  const damageRe = /Hit:\s*(?:\d+\s*\()?\d+d\d+(?:\s*([+-])\s*(\d+))?\s*\)?\s*\w*\s+damage/i;
  const m = window.match(damageRe);
  if (!m) return null;
  if (m[1] === undefined || m[2] === undefined) return 0;
  return m[1] === "-" ? -Number(m[2]) : Number(m[2]);
}

/**
 * Convert SRD plain-English descriptions (e.g. "Melee Weapon Attack: +14 to hit,
 * Hit: 21 (3d8 + 8) slashing damage") into backtick formula tags
 * (e.g. "Melee Weapon Attack: `atk:STR+PB`, Hit: `dmg:3d8+STR` slashing damage")
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

    // Pass 2 — Attack bonus, damage-driven attribution (Phase 0.5)
    result = result.replace(
      /([+-])(\d+)\s+to\s+hit/g,
      (_match: string, sign: string, n: string, attackPos: number) => {
        const attackBonus = sign === "-" ? -Number(n) : Number(n);

        // Re-find the action name: scan back from attackPos for the most recent
        // "Action Name." pattern; fall back to ctx.actionName.
        const before = desc.slice(Math.max(0, attackPos - 200), attackPos);
        const actionMatch = before.match(/(?:^|\.\s+)([A-Z][\w\s,'-]{1,40})\./);
        const actionName = actionMatch ? actionMatch[1] : ctx.actionName;

        const damageBonus = parseDamageBonusFromHitText(desc, attackPos);
        const preferred = preferredAbilitiesForAttack(actionName, desc, ctx.spellAbility);
        const ability = identifyAbility(damageBonus, preferred, mods);

        if (ability === null) {
          const literal = attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;
          return `\`atk:${literal}\``;
        }
        if (attackBonus === mods[ability] + ctx.profBonus) {
          return `\`atk:${ability.toUpperCase()}+PB\``;
        }
        if (attackBonus === mods[ability]) {
          return `\`atk:${ability.toUpperCase()}\``;
        }
        // Ability identified but neither variant matches → designed value, literal.
        const literal = attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;
        return `\`atk:${literal}\``;
      },
    );

    // Pass 3 — Damage expressions, emit canonical `dmg:` (Phase 0.5)
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
            const preferred = preferredAbilitiesForAttack(ctx.actionName, "", ctx.spellAbility);
            const pick = preferred.find((p) => matchingAbilities.includes(p)) ?? [...matchingAbilities].sort()[0];
            inner = `${dice}+${pick.toUpperCase()}`;
          } else {
            inner = `${dice}${bonus >= 0 ? "+" : ""}${bonus}`;
          }
        }
        const typeSuffix = typeWord ? ` ${typeWord} damage` : " damage";
        return `\`dmg:${inner}\`${typeSuffix}`;
      },
    );

    // Pass 3b — Flat damage like "Hit: 1 piercing damage" → emit dmg:1
    result = result.replace(
      /Hit:\s*(\d+)\s+(\w+)?\s*damage/gi,
      (_match: string, n: string, typeWord: string | undefined) => {
        const tt = typeWord ? ` ${typeWord} damage` : " damage";
        return `Hit: \`dmg:${n}\`${tt}`;
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
