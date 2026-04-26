// scripts/augment/condition-extractor.ts
//
// Minimal regex sweep over reference-item entries text. Emits typed conditions
// for high-confidence patterns; falls back to { kind: "raw", text }
// when generic condition language is detected without a pattern match.

import type {
  BonusFieldPath,
  Condition,
} from "../../src/modules/item/item.conditions.types";

type ConditionPerField = Partial<Record<BonusFieldPath, Condition[]>>;

interface Pattern {
  re: RegExp;
  fields: BonusFieldPath[];
  emit: (m: RegExpMatchArray) => Condition[];
}

const STRUCTURED_PATTERNS: Pattern[] = [
  {
    re: /\bwearing no armor and using no \{?@?item\s*[Ss]hield/,
    fields: ["ac"],
    emit: () => [{ kind: "no_armor" }, { kind: "no_shield" }],
  },
  {
    re: /\bif you are wearing no armor\b/i,
    fields: ["ac"],
    emit: () => [{ kind: "no_armor" }],
  },
  {
    re: /\bif you (?:are not|aren't) using a \{?@?item\s*[Ss]hield/i,
    fields: ["ac"],
    emit: () => [{ kind: "no_shield" }],
  },
  {
    re: /\bagainst ranged attack(?:s| rolls)\b/i,
    fields: ["ac", "weapon_attack"],
    emit: () => [{ kind: "vs_attack_type", value: "ranged" }],
  },
  {
    re: /\bon ranged attacks? made\b/i,
    fields: ["weapon_damage"],
    emit: () => [{ kind: "on_attack_type", value: "ranged" }],
  },
  {
    re: /\bagainst (undead|fiend|construct|aberration|beast|elemental|fey|giant|monstrosity|ooze|plant|celestial|dragon)s?\b/i,
    fields: ["weapon_attack", "weapon_damage"],
    emit: (m) => [{ kind: "vs_creature_type", value: m[1].toLowerCase() }],
  },
  {
    re: /\bunderwater\b/i,
    fields: ["speed.swim"],
    emit: () => [{ kind: "underwater" }],
  },
  {
    re: /\bin dim light\b/i,
    fields: ["ac", "weapon_attack", "weapon_damage", "speed.walk", "speed.fly"],
    emit: () => [{ kind: "lighting", value: "dim" }],
  },
  {
    re: /\bwhile flying\b/i,
    fields: ["ac"],
    emit: () => [{ kind: "movement_state", value: "flying" }],
  },
];

const RAW_FALLBACK_RE =
  /\b(?:if you are|while you are|against (?:[a-z]+s?))\b/i;

/**
 * Scan an item's prose text against structured + raw patterns.
 * Returns a per-field map of conditions to apply, plus a flag indicating
 * whether the raw fallback was used.
 */
export function extractConditionsFromProse(
  entriesText: string,
  bonusFields: BonusFieldPath[],
): { perField: ConditionPerField; usedRaw: boolean } {
  const perField: ConditionPerField = {};
  let usedRaw = false;

  for (const pat of STRUCTURED_PATTERNS) {
    const m = entriesText.match(pat.re);
    if (!m) continue;
    const conds = pat.emit(m);
    for (const f of pat.fields) {
      if (!bonusFields.includes(f)) continue;
      if (perField[f]) continue;
      perField[f] = conds;
    }
  }

  if (Object.keys(perField).length === 0 && RAW_FALLBACK_RE.test(entriesText)) {
    usedRaw = true;
    const m = RAW_FALLBACK_RE.exec(entriesText);
    if (m) {
      const sentence = extractSentenceAround(entriesText, m.index ?? 0);
      // Attach raw to all numeric bonus fields the item actually has.
      for (const f of bonusFields) {
        perField[f] = [{ kind: "raw", text: sentence }];
      }
    }
  }

  return { perField, usedRaw };
}

function extractSentenceAround(text: string, idx: number): string {
  const start = Math.max(0, text.lastIndexOf(".", idx) + 1);
  const endDot = text.indexOf(".", idx);
  const end = endDot === -1 ? text.length : endDot + 1;
  return text.slice(start, end).trim();
}
