import type { ResolvedSpell, SpellLimitInfo } from "../../pc.types";

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
    if (count > lim.preparedOrKnown) out.push(`${lim.classSlug}: ${count}/${lim.preparedOrKnown} prepared`);
  }
  return out;
}
