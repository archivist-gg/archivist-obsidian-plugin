// src/modules/pc/pc.rest.ts
import type { EntityRegistry } from "../../shared/entities/entity-registry";
import type { Character, DerivedStats, ResolvedCharacter } from "./pc.types";

function resolveItemName(
  entry: Character["equipment"][number],
  registry: EntityRegistry | null,
): string | undefined {
  if (!registry) return undefined;
  const ref = entry.item.match(/^\[\[(.+?)\]\]$/);
  const slug = ref ? ref[1] : entry.item;
  // `EntityRegistry.getBySlug(slug): RegisteredEntity | undefined` — `RegisteredEntity`
  // has `name: string`. See `src/shared/entities/entity-registry.ts`.
  return registry.getBySlug(slug)?.name;
}

export type RestType = "short" | "long";

export type RestCategoryId =
  | "hp-to-max"
  | "hd-regain"
  | "spell-slots"
  | "exhaustion"
  | `feature:${string}`
  | `item:${number}`;

export interface RestCategory {
  id: RestCategoryId;
  label: string;
  preview: string;
}

export interface RestPlan {
  type: RestType;
  categories: RestCategory[];
  hdAvailable: Array<{ die: string; remaining: number }>;
}

export function computeRestPlan(
  character: Character,
  resolved: ResolvedCharacter,
  derived: DerivedStats,
  registry: EntityRegistry | null,
  type: RestType,
): RestPlan {
  const cats: RestCategory[] = [];

  if (type === "long") {
    if (character.state.hp.current < derived.hp.max) {
      cats.push({
        id: "hp-to-max",
        label: "Hit Points",
        preview: `${character.state.hp.current} → ${derived.hp.max}`,
      });
    }

    if (character.state.exhaustion > 0) {
      cats.push({
        id: "exhaustion",
        label: "Exhaustion",
        preview: `${character.state.exhaustion} → ${character.state.exhaustion - 1}`,
      });
    }

    const slotsUsed = Object.values(character.state.spell_slots ?? {})
      .reduce((s, slot) => s + (slot.used ?? 0), 0);
    if (slotsUsed > 0) {
      cats.push({ id: "spell-slots", label: "Spell Slots", preview: "all reset" });
    }

    // HD regain
    const totalLevel = resolved.totalLevel ?? 0;
    const regainBudget = Math.max(1, Math.floor(totalLevel / 2));
    const pools = Object.entries(character.state.hit_dice ?? {})
      .map(([die, hd]) => ({ die, used: hd.used, total: hd.total }))
      .filter((p) => p.used > 0)
      .sort((a, b) => b.used - a.used);
    if (pools.length > 0) {
      let left = regainBudget;
      const dist: Array<{ die: string; give: number }> = [];
      for (const p of pools) {
        if (left === 0) break;
        const give = Math.min(p.used, left);
        if (give > 0) dist.push({ die: p.die, give });
        left -= give;
      }
      const totalGive = dist.reduce((s, d) => s + d.give, 0);
      if (totalGive > 0) {
        const detail = dist.map((d) => `${d.die}: +${d.give}`).join(", ");
        cats.push({
          id: "hd-regain",
          label: "Hit Dice",
          preview: `+${totalGive} (${detail})`,
        });
      }
    }

    // Feature uses — long rest restores BOTH short-rest and long-rest resets
    for (const [key, fu] of Object.entries(character.state.feature_uses ?? {})) {
      if (fu.used <= 0) continue;
      const rf = (resolved.features ?? []).find((r: { feature: { id?: string; name: string; resources?: Array<{ id?: string; reset: string }> } }) =>
        (r.feature.resources?.[0]?.id ?? r.feature.id) === key,
      );
      const reset = rf?.feature.resources?.[0]?.reset ?? "long-rest";
      if (reset !== "short-rest" && reset !== "long-rest") continue;
      cats.push({
        id: `feature:${key}`,
        label: rf?.feature.name ?? key,
        preview: `${fu.used}/${fu.max} restored`,
      });
    }

    // Item charges — long rest restores short, long, AND dawn (rest spans the night)
    character.equipment.forEach((entry, idx) => {
      const rec = entry.state?.recovery;
      const charges = entry.state?.charges;
      if (!rec || !charges) return;
      if (charges.current >= charges.max) return;
      if (rec.reset !== "short" && rec.reset !== "long" && rec.reset !== "dawn") return;
      const label = entry.overrides?.name
        ?? resolveItemName(entry, registry)
        ?? entry.item;
      cats.push({
        id: `item:${idx}`,
        label,
        preview: `${charges.current} → ${charges.max}`,
      });
    });
  }

  if (type === "short") {
    for (const [key, fu] of Object.entries(character.state.feature_uses ?? {})) {
      if (fu.used <= 0) continue;
      const rf = (resolved.features ?? []).find((r: { feature: { id?: string; name: string; resources?: Array<{ id?: string; reset: string }> } }) =>
        (r.feature.resources?.[0]?.id ?? r.feature.id) === key,
      );
      const reset = rf?.feature.resources?.[0]?.reset ?? "long-rest";
      if (reset !== "short-rest") continue;
      cats.push({
        id: `feature:${key}`,
        label: rf?.feature.name ?? key,
        preview: `${fu.used}/${fu.max} restored`,
      });
    }

    character.equipment.forEach((entry, idx) => {
      const rec = entry.state?.recovery;
      const charges = entry.state?.charges;
      if (!rec || !charges) return;
      if (charges.current >= charges.max) return;
      if (rec.reset !== "short") return;
      const label = entry.overrides?.name ?? resolveItemName(entry, registry) ?? entry.item;
      cats.push({
        id: `item:${idx}`,
        label,
        preview: `${charges.current} → ${charges.max}`,
      });
    });
  }

  const hdAvailable = type === "short"
    ? Object.entries(character.state.hit_dice ?? {})
        .filter(([, hd]) => hd.used < hd.total)
        .map(([die, hd]) => ({ die, remaining: hd.total - hd.used }))
    : [];

  return { type, categories: cats, hdAvailable };
}

export function applyRestResets(
  _character: Character,
  _resolved: ResolvedCharacter,
  _derived: DerivedStats,
  _plan: RestPlan,
  _optouts: Set<RestCategoryId>,
): void {
  // populated in later tasks
}
