// Reuse existing shared types/constants rather than redeclaring them.
import type { Ability } from "../types/choice";
import { ABILITY_KEYS } from "./constants";
export type { Ability };
export { ABILITY_KEYS as ABILITIES };

export type CanonicalTagType = "atk" | "dmg" | "dc" | "dice";

export interface ParsedTerms {
  abilityTerm?: Ability;
  pbTerm: boolean;
  literalTerms: number[];
  diceTerms: { count: number; sides: number }[];
}

const TAG_TYPE_ALIASES: Record<string, CanonicalTagType> = {
  atk: "atk",
  attack: "atk",
  dmg: "dmg",
  damage: "dmg",
  dc: "dc",
  dice: "dice",
};

export function normalizeTagType(input: string): CanonicalTagType | null {
  const lower = input.toLowerCase().trim();
  return TAG_TYPE_ALIASES[lower] ?? null;
}

const ABILITY_RE = /^(str|dex|con|int|wis|cha)$/i;
const PB_RE = /^pb$/i;
const DICE_RE = /^(\d+)d(\d+)$/;
const LITERAL_RE = /^([+-]?\d+)$/;

export function parseTagTerms(content: string): ParsedTerms | { error: string } {
  const out: ParsedTerms = {
    pbTerm: false,
    literalTerms: [],
    diceTerms: [],
  };
  const trimmed = content.trim();
  if (trimmed.length === 0) return { error: "empty content" };

  // Tokenize on +/- between terms while preserving sign on each term.
  const tokens: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    if (trimmed[i] === "+" || trimmed[i] === "-") {
      let j = i + 1;
      while (j < trimmed.length && trimmed[j] !== "+" && trimmed[j] !== "-") j++;
      tokens.push(trimmed.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < trimmed.length && trimmed[j] !== "+" && trimmed[j] !== "-") j++;
      tokens.push(trimmed.slice(i, j));
      i = j;
    }
  }

  for (let raw of tokens) {
    raw = raw.trim();
    if (raw.length === 0) return { error: "empty term" };

    let signed = raw;
    let body = raw;
    if (raw[0] === "+" || raw[0] === "-") {
      body = raw.slice(1).trim();
    } else {
      signed = "+" + raw;
    }

    if (DICE_RE.test(body)) {
      const m = body.match(DICE_RE)!;
      out.diceTerms.push({ count: Number.parseInt(m[1], 10), sides: Number.parseInt(m[2], 10) });
      continue;
    }
    if (ABILITY_RE.test(body)) {
      if (out.abilityTerm) return { error: `multiple ability terms (${out.abilityTerm}, ${body.toLowerCase()})` };
      out.abilityTerm = body.toLowerCase() as Ability;
      continue;
    }
    if (PB_RE.test(body)) {
      if (out.pbTerm) return { error: "duplicate PB term" };
      out.pbTerm = true;
      continue;
    }
    if (LITERAL_RE.test(signed)) {
      out.literalTerms.push(Number.parseInt(signed, 10));
      continue;
    }
    return { error: `unrecognized term: ${raw}` };
  }

  return out;
}
