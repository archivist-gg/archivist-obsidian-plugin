import type { ResolvedSpell, SpellLimitInfo } from "@archivist/dnd5e/pc/pc.types";
import { baseClassName } from "@archivist/dnd5e/class/class.slug";

const ABBR: Record<string, string> = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };

export interface CastBadge { label: string; kind: "action" | "bonus" | "reaction" | "time"; }

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

/** Compact casting-time label for the Cast table. Real tokens: action,
 *  bonus-action, reaction, 1minute|minute, 10minutes, 1hour|hour, 8/12/24hours. */
export function compactCastingTime(token: string | undefined): string {
  switch (token) {
    case "action": return "1A";
    case "bonus-action": return "1BA";
    case "reaction": return "1R";
    case "minute":
    case "1minute": return "1 min";
    case "10minutes": return "10 min";
    case "hour":
    case "1hour": return "1 hr";
    case "8hours": return "8 hr";
    case "12hours": return "12 hr";
    case "24hours": return "24 hr";
    default: return token ? token : "—";
  }
}

/** Compact range. `range` is already a human string ("120 feet", "Touch", "Self"…). */
export function formatRange(range: string | undefined): string {
  if (!range) return "—";
  const feet = range.match(/^(\d+)\s*feet$/i);
  if (feet) return `${feet[1]} ft`;
  return range; // Touch / Self / Special / Sight / Unlimited / "1 mile" pass through
}

/** Three-letter ability code. Accepts full words ("dexterity") or codes ("DEX"). */
export function abbrAbility(ability: string): string {
  const key = ability.toLowerCase();
  return ABBR[key] ?? ability.slice(0, 3).toUpperCase();
}

/** Hit/DC cell data. The model has no per-spell attack field, so only the
 *  save branch exists; DC is the caster class's save DC (from derived). */
export function hitDcDescriptor(spell: ResolvedSpell, saveDC: number): { ability: string; dc: number } | null {
  const save = spell.entity.saving_throw?.ability;
  if (!save) return null;
  return { ability: abbrAbility(save), dc: saveDC };
}

/** Structured-only effect descriptor. Base damage dice are NOT in the model,
 *  so this returns the damage TYPE word only (or null). Upcast dice come from
 *  spellEffectAtSlot, not here. */
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
