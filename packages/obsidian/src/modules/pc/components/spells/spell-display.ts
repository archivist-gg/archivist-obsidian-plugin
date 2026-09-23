import type { ResolvedSpell, SpellLimitInfo } from "@archivist-gg/dnd5e/pc/pc.types";
import { baseClassName } from "@archivist-gg/dnd5e/class/class.slug";
import { bareEntitySlug } from "@archivist-gg/dnd5e/entities/slug";
import { parseCastingTime } from "@archivist-gg/dnd5e/spell/casting-time";
import { ATTACK_ROLL_SPELLS } from "./attack-spells";

const ABBR: Record<string, string> = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };

export interface CastBadge { label: string; kind: "action" | "bonus" | "reaction" | "time"; }

/** The Cast table's placeholder for a cell whose value the spell does not carry. Named (R4 {G5, G6}
 *  live rider N-1-19) because three cells print it and the rider made a fourth do so: a cell that used
 *  to render empty left its row a line short beside its neighbours. The GLYPH is not this rider's to
 *  choose · P8 owns the null-glyph ruling, and this constant is where that ruling will land. */
export const EMPTY_CELL = "—";

/** R4-G7 T8 RIDER-17 (F-ALWAYS (a)): the ONE label of the always-prepared marker (`.pc-spell-always`), printed by
 *  BOTH spell views (the Cast table's name line and the Prepare list's name), so the two can never drift. It
 *  replaced a bare lowercase `always` that read as a stray word beside the spell name. */
export const ALWAYS_PREPARED_LABEL = "Always prepared";

export function castingTimeBadge(token: string | undefined): CastBadge {
  switch (token) {
    case "action": return { label: "Action", kind: "action" };
    case "bonus-action": return { label: "Bonus", kind: "bonus" };
    case "reaction": return { label: "Reaction", kind: "reaction" };
    case "1minute": return { label: "1 min", kind: "time" };
    case "10minutes": return { label: "10 min", kind: "time" };
    case "1hour": return { label: "1 hr", kind: "time" };
    case "8hours": return { label: "8 hr", kind: "time" };
    case "12hours": return { label: "12 hr", kind: "time" };
    case "24hours": return { label: "24 hr", kind: "time" };
    default: return { label: token ? token : "—", kind: "time" };
  }
}

export function componentLetters(components: string | undefined): { letters: string[]; material: boolean } {
  if (!components) return { letters: [], material: false };
  const letters: string[] = [];
  if (/\bV\b/.test(components)) letters.push("V");
  if (/\bS\b/.test(components)) letters.push("S");
  const material = /\bM\b/.test(components);
  if (material) letters.push("M");
  return { letters, material };
}

export function effectTags(spell: ResolvedSpell): string[] {
  const tags: string[] = [];
  const dmg = spell.entity.damage?.types ?? [];
  const save = spell.entity.saving_throw?.ability;
  if (save) tags.push(`${ABBR[save] ?? save.toUpperCase()} save`);
  for (const t of dmg) tags.push(t);
  return tags;
}

export function groupByLevel(spells: ResolvedSpell[]): Map<number, ResolvedSpell[]> {
  const map = new Map<number, ResolvedSpell[]>();
  for (const s of spells) {
    const lvl = s.entity.level ?? 0;
    (map.get(lvl) ?? map.set(lvl, []).get(lvl)!).push(s);
  }
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}

/** Returns an array of `total` booleans: true = used, false = available. */
export function slotCells(total: number, used: number): boolean[] {
  return Array.from({ length: total }, (_, i) => i < used);
}

/**
 * Soft warnings for prepared-caster classes whose prepared spell count exceeds
 * their limit. Cantrips and always-prepared spells are excluded from the count.
 */
export function preparedWarnings(spells: ResolvedSpell[], limits: SpellLimitInfo[]): string[] {
  const out: string[] = [];
  for (const lim of limits) {
    if (lim.kind !== "prepared" || lim.preparedOrKnown == null) continue;
    const count = spells.filter((s) =>
      s.classSlug === lim.classSlug && s.prepared && !s.alwaysPrepared && (s.entity.level ?? 0) > 0,
    ).length;
    if (count > lim.preparedOrKnown) out.push(`${baseClassName(lim.classSlug)}: ${count}/${lim.preparedOrKnown} prepared`);
  }
  return out;
}

/** Compact casting-time label for the Cast table and the add drawer: `1A`, `1BA`, `1R`, `N min`, `N hr`.
 *
 *  Reads through dnd5e's `parseCastingTime`, the same reader the add-drawer filter buckets with, so a
 *  spelling one understands the other does too. The leading token decides, in any case, spacing, count or
 *  plural (`1 action`, `10 minute`, `8 hours`, `bonus`), and prose after it (a reaction's trigger) stays for
 *  the tooltip both callers set. A token the parser cannot read passes through verbatim, and an absent one
 *  reads as the placeholder. */
export function compactCastingTime(token: string | undefined): string {
  const parsed = parseCastingTime(token);
  if (!parsed) return token ? token : EMPTY_CELL;
  switch (parsed.kind) {
    case "action": return "1A";
    case "bonus": return "1BA";
    case "reaction": return "1R";
    case "time": return `${parsed.count} ${parsed.unit === "hour" ? "hr" : "min"}`;
  }
}

/** Compact range. `range` is already a human string ("120 feet", "Touch", "Self"…). */
export function formatRange(range: string | undefined): string {
  if (!range) return EMPTY_CELL;
  const feet = range.match(/^(\d+)\s*feet$/i);
  if (feet) return `${feet[1]} ft`;
  return range; // Touch / Self / Special / Sight / Unlimited / "1 mile" pass through
}

/** Three-letter ability code. Accepts full words ("dexterity") or codes ("DEX"). */
export function abbrAbility(ability: string): string {
  const key = ability.toLowerCase();
  return ABBR[key] ?? ability.slice(0, 3).toUpperCase();
}

/** Discriminated Hit/DC cell data. Attack-roll spells resolve their to-hit with
 *  a spell ATTACK bonus; save spells show the caster's save DC. */
export type HitDcDescriptor =
  | { kind: "attack"; bonus: number }
  | { kind: "save"; ability: string; dc: number };

/** Hit/DC cell data. A curated attack-roll spell (matched by edition-agnostic
 *  base slug) shows "Atk +N" from the passed attack bonus; otherwise a spell with
 *  a saving throw shows the caster's save DC. A spell with neither (e.g. Magic
 *  Missile's auto-hit) has no to-hit → null. `atk` defaults to 0 when omitted. */
export function hitDcDescriptor(spell: ResolvedSpell, saveDC: number, atk?: number): HitDcDescriptor | null {
  if (ATTACK_ROLL_SPELLS.has(bareEntitySlug(spell.slug))) {
    return { kind: "attack", bonus: atk ?? 0 };
  }
  const save = spell.entity.saving_throw?.ability;
  if (!save) return null;
  return { kind: "save", ability: abbrAbility(save), dc: saveDC };
}

/** Structured-only effect descriptor: the damage TYPE word only (or null). The
 *  dice, base and scaled, come from dnd5e `spell.scaling`, not here:
 *  spellEffectPartsAtSlot for a slot row (the spell's base `damage_roll` at its
 *  own level, a `casting_options` roll above it), spellEffectAtCharacterLevel
 *  for a cantrip (its tier-1 base roll below the first tier; R4-G7 T8 RIDER-15). */
export function effectDescriptor(spell: ResolvedSpell): { damageType: string | null } {
  return { damageType: spell.entity.damage?.types?.[0] ?? null };
}

/** Source/edition tag for a spell row, or null when the entity has no edition. */
export function editionTag(spell: ResolvedSpell): { label: string; mod: string } | null {
  const ed = spell.entity.edition;
  if (ed === "2014") return { label: "5e", mod: "e2014" };
  if (ed === "2024") return { label: "2024", mod: "e2024" };
  return null;
}
