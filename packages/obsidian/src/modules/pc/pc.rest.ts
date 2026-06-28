// src/modules/pc/pc.rest.ts
import type { EntityRegistry } from "@archivist/core";
import type { Character, DerivedStats, ResolvedCharacter } from "./pc.types";

function resolveItemName(
  entry: Character["equipment"][number],
  registry: EntityRegistry | null,
): string | undefined {
  if (!registry) return undefined;
  const ref = entry.item.match(/^\[\[(.+?)\]\]$/);
  const slug = ref ? ref[1] : entry.item;
  // `EntityRegistry.getBySlug(slug): RegisteredEntity | undefined` — `RegisteredEntity`
  // has `name: string`. See `@archivist/core` (packages/core/src/entity-registry.ts).
  return registry.getBySlug(slug)?.name;
}

/**
 * First resource across all resolved features whose id matches `id`. The
 * returned `label` prefers the resource's own name, falling back to the owning
 * feature's name (resources synthesised from older fixtures may omit `name`).
 */
function findResourceById(
  resolved: ResolvedCharacter,
  id: string,
): { label: string | undefined; reset: string } | undefined {
  for (const rf of resolved.features ?? []) {
    for (const r of rf.feature.resources ?? []) {
      if (r.id === id) return { label: r.name ?? rf.feature.name, reset: r.reset };
    }
  }
  return undefined;
}

export type RestType = "short" | "long";

export type RestCategoryId =
  | "hp-to-max"
  | "hd-regain"
  | "spell-slots"
  | "pact-slots"
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
  /** Internal: per-die HD-regain target captured at plan time so apply is idempotent. */
  hdRegainDist?: Array<{ die: string; targetUsed: number }>;
}

export function computeRestPlan(
  character: Character,
  resolved: ResolvedCharacter,
  derived: DerivedStats,
  registry: EntityRegistry | null,
  type: RestType,
): RestPlan {
  const cats: RestCategory[] = [];
  let hdRegainDist: Array<{ die: string; targetUsed: number }> | undefined;

  // Pact Magic slots reset on BOTH short and long rest (unlike standard slots).
  const pact = character.state.spell_slots_pact;
  if (pact && pact.used > 0) {
    cats.push({ id: "pact-slots", label: "Pact Magic Slots", preview: "all reset" });
  }

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
      const dist: Array<{ die: string; give: number; targetUsed: number }> = [];
      for (const p of pools) {
        if (left === 0) break;
        const give = Math.min(p.used, left);
        if (give > 0) dist.push({ die: p.die, give, targetUsed: p.used - give });
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
        hdRegainDist = dist.map((d) => ({ die: d.die, targetUsed: d.targetUsed }));
      }
    }

    // Feature uses — a long rest restores short-rest, long-rest, dawn and dusk
    // resets (it spans the night). turn/round are encounter-scoped (never reset
    // by rest). See SP4d Phase 2 spec §5.
    for (const [key, fu] of Object.entries(character.state.feature_uses ?? {})) {
      if (fu.used <= 0) continue;
      const res = findResourceById(resolved, key);
      const reset = res?.reset ?? "long-rest";
      if (reset !== "short-rest" && reset !== "long-rest" && reset !== "dawn" && reset !== "dusk") continue;
      cats.push({
        id: `feature:${key}`,
        label: res?.label ?? key,
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
      const res = findResourceById(resolved, key);
      if ((res?.reset ?? "long-rest") !== "short-rest") continue;
      cats.push({
        id: `feature:${key}`,
        label: res?.label ?? key,
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

  return { type, categories: cats, hdAvailable, hdRegainDist };
}

export function applyRestResets(
  character: Character,
  _resolved: ResolvedCharacter,
  derived: DerivedStats,
  plan: RestPlan,
  optouts: Set<RestCategoryId>,
): void {
  const isKept = (id: RestCategoryId) => !optouts.has(id);

  for (const cat of plan.categories) {
    if (!isKept(cat.id)) continue;

    if (cat.id === "hp-to-max") {
      const wasZero = character.state.hp.current === 0;
      character.state.hp.current = derived.hp.max;
      if (wasZero && character.state.death_saves) {
        character.state.death_saves = { successes: 0, failures: 0 };
      }
      continue;
    }

    if (cat.id === "exhaustion") {
      character.state.exhaustion = Math.max(0, character.state.exhaustion - 1);
      continue;
    }

    if (cat.id === "spell-slots") {
      for (const slot of Object.values(character.state.spell_slots ?? {})) {
        slot.used = 0;
      }
      continue;
    }

    if (cat.id === "pact-slots") {
      if (character.state.spell_slots_pact) character.state.spell_slots_pact.used = 0;
      continue;
    }

    if (cat.id === "hd-regain") {
      // Use plan-captured target so re-applying is idempotent (min never re-restores).
      for (const d of plan.hdRegainDist ?? []) {
        const hd = character.state.hit_dice?.[d.die];
        if (!hd) continue;
        hd.used = Math.min(hd.used, Math.max(0, d.targetUsed));
      }
      continue;
    }

    if (cat.id.startsWith("feature:")) {
      const key = cat.id.slice("feature:".length);
      const fu = character.state.feature_uses?.[key];
      if (fu) fu.used = 0;
      continue;
    }

    if (cat.id.startsWith("item:")) {
      const idx = Number(cat.id.slice("item:".length));
      const entry = character.equipment[idx];
      if (entry?.state?.charges) {
        entry.state.charges.current = entry.state.charges.max;
      }
      continue;
    }
  }

  // Concentration is unconditional on long rest, no opt-out
  if (plan.type === "long") {
    character.state.concentration = null;
  }
}
