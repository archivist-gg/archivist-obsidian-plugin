import type {
  AttackRow,
  DerivedStats,
  EquipmentEntry,
  ResolvedCharacter,
  ResolvedFeature,
  ResolvedPoolEntry,
} from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";
import type { EntityRegistry } from "@archivist-gg/core";
import {
  resolveItemAction,
  type ActionCost,
  type ItemAction,
} from "@archivist-gg/dnd5e/item/item.actions-map";

/**
 * The pure categorizer at the heart of the "Actions & Features" tab
 * (spec §3). It files EVERY playable entry — weapons, magic items, class/race/
 * background features, feats and boons — into a two-level grouped model:
 *   - Level 1 = action economy (`EconomyKey`), fixed order.
 *   - Level 2 = source type (`SourceKey`), fixed order.
 * The result is a tagged-union `Section[]` the tab (Task 5) renders and the row
 * renderers (Task 4) dispatch on by `entry.kind` — no re-derivation downstream.
 *
 * Pure + side-effect-free: no DOM, no ctx, no I/O. Testable with a mock
 * `EntityRegistry`. Spells are OUT of this model (they stay on the Spells tab);
 * only feature/boon rows that happen to be spell-like flow through here.
 */

export type EconomyKey = "actions" | "bonus" | "reactions" | "passive";

export type SourceKey =
  | "weapons"
  | "class-features"
  | "items"
  | "feats"
  | "race"
  | "background"
  | "boons";

/** A collected equipped-item row: the ORIGINAL equipment index (filter-stable
 *  charge write-back key), the raw entry, its registry entity/type, and the
 *  resolved `ItemAction` (items with no action are never collected). */
export interface ItemEntry {
  index: number;
  entry: EquipmentEntry;
  entity: { name?: string; rarity?: string; actions?: object } | null;
  entityType: string | null;
  action: ItemAction;
}

/** Tagged union so the tab dispatches to the right row renderer without
 *  re-deriving. `featureRowTitle`/`isClassResourceSynthetic` remain RENDER
 *  concerns — the raw `ResolvedFeature` rides along untouched. */
export type ActionEntry =
  | { kind: "weapon"; attack: AttackRow }
  | { kind: "item"; item: ItemEntry }
  | { kind: "feature"; rf: ResolvedFeature }
  | { kind: "boon"; entry: ResolvedPoolEntry; status: "granted" | "selected"; poolLabel: string };

export interface SubGroup {
  key: SourceKey;
  label: string;
  /** Only the Actions→Weapons sub-group carries a count string (§3, DEC-G). */
  count?: string;
  entries: ActionEntry[];
}

export interface Section {
  key: EconomyKey;
  label: string;
  subGroups: SubGroup[];
}

// ─────────────────────────────────────────────────────────────
// Fixed order + labels (spec §3)
// ─────────────────────────────────────────────────────────────

const ECONOMY_ORDER: EconomyKey[] = ["actions", "bonus", "reactions", "passive"];
const SOURCE_ORDER: SourceKey[] = [
  "weapons", "class-features", "items", "feats", "race", "background", "boons",
];

const ECONOMY_LABEL: Record<EconomyKey, string> = {
  actions: "Actions",
  bonus: "Bonus Actions",
  reactions: "Reactions",
  passive: "Passive & Always-Active",
};

const SOURCE_LABEL: Record<SourceKey, string> = {
  weapons: "Weapons",
  "class-features": "Class features",
  items: "Items",
  feats: "Feats",
  race: "Race",
  background: "Background",
  boons: "Boons",
};

// ─────────────────────────────────────────────────────────────
// Economy + source assignment
// ─────────────────────────────────────────────────────────────

/**
 * The single action-economy switch — the sole bucket map for the Actions tab
 * (it superseded the former `feature-groups.ts::groupFeatures`, retired in
 * Task 5): drives weapons (`actionCost`), items (`ItemAction.cost`),
 * features/feats (`feature.action`) and boons (`entity.action_cost`) alike.
 *   `action` / `free`  → actions
 *   `bonus-action`     → bonus
 *   `reaction`         → reactions
 *   `special` / absent → passive
 */
function featureEconomy(action: ActionCost | null | undefined): EconomyKey {
  switch (action) {
    case "action":
    case "free":
      return "actions";
    case "bonus-action":
      return "bonus";
    case "reaction":
      return "reactions";
    // "special", undefined, null → Passive & Always-Active
    default:
      return "passive";
  }
}

/**
 * Boon economy (spec §3): a boon has no synthesized `feature`, so map the
 * OptionalFeatureEntity's `action_cost` through the same vocabulary; when it is
 * absent (or null) the boon is Passive — whether or not `passive === true`
 * (a granted always-on boon like "Red Cant" carries `action_cost:"free"`, the
 * 9 no-cost boons all fall through to Passive).
 */
function boonEconomy(entity: OptionalFeatureEntity): EconomyKey {
  return entity.action_cost ? featureEconomy(entity.action_cost) : (entity.passive ? "passive" : "passive");
}

/** Source sub-group for a feature/feat, from its `FeatureSource.kind`. */
function featureSource(source: ResolvedFeature["source"]): SourceKey {
  switch (source.kind) {
    case "class":
    case "subclass":
      return "class-features";
    case "race":
      return "race";
    case "background":
      return "background";
    case "feat":
      return "feats";
  }
}

// ─────────────────────────────────────────────────────────────
// Equipped-item collection (ported from items-table.ts::collectRows)
// ─────────────────────────────────────────────────────────────

/**
 * Collect equipped, action-bearing items, re-anchored on the `EntityRegistry`
 * passed to the builder (rather than a render ctx). Items with no resolved
 * `ItemAction` are dropped, and weapons + armor are excluded (they surface as
 * `weapon` entries / in the inventory expand). The ORIGINAL equipment index is
 * preserved so downstream charge write-back stays filter-stable.
 *
 * This is now the SINGLE item collector on the Actions tab: Task 5 wired the
 * tab to `buildActionModel` and retired the former ctx-anchored duplicate in
 * `items-table.ts` (whose `ItemsTable` wrapper is gone). `renderItemRow`
 * consumes the `ItemEntry` produced here with no re-derivation.
 */
function collectItemEntries(resolved: ResolvedCharacter, registry: EntityRegistry): ItemEntry[] {
  const equipment = resolved.definition.equipment ?? [];
  const out: ItemEntry[] = [];
  equipment.forEach((entry, index) => {
    const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
    if (!slug) return;
    const found = registry.getBySlug(slug) ?? null;
    const entityType = found?.entityType ?? null;
    // Weapons + armor go through the Weapons sub-group / inventory expand.
    if (entityType === "weapon" || entityType === "armor") return;
    // Only equipped items surface on this tab.
    if (!entry.equipped) return;
    // Items with no activated action are omitted.
    const action = resolveItemAction(slug, entry);
    if (!action) return;
    out.push({
      index,
      entry,
      entity: found?.data ?? null,
      entityType,
      action,
    });
  });
  return out;
}

// ─────────────────────────────────────────────────────────────
// The builder
// ─────────────────────────────────────────────────────────────

/**
 * Categorize a resolved character's playable entries into the grouped
 * `Section[]` model (spec §3). Pure — no DOM, no mutation of inputs.
 *
 * Entries are grouped into a `Map<EconomyKey, Map<SourceKey, ActionEntry[]>>`
 * that preserves per-source insertion order, then materialized in the fixed
 * `ECONOMY_ORDER × SOURCE_ORDER`, omitting empty sub-groups and sections whose
 * sub-groups are all empty. Repeated features are NOT deduped; `renderSuppressed`
 * and `buildOnly` features are skipped.
 */
export function buildActionModel(
  resolved: ResolvedCharacter,
  derived: DerivedStats,
  registry: EntityRegistry,
): Section[] {
  const buckets = new Map<EconomyKey, Map<SourceKey, ActionEntry[]>>();
  const place = (economy: EconomyKey, source: SourceKey, entry: ActionEntry): void => {
    let sources = buckets.get(economy);
    if (!sources) {
      sources = new Map();
      buckets.set(economy, sources);
    }
    let list = sources.get(source);
    if (!list) {
      list = [];
      sources.set(source, list);
    }
    list.push(entry);
  };

  // Weapons — from derived.attacks; economy = actionCost ?? "action".
  for (const attack of derived.attacks ?? []) {
    place(featureEconomy(attack.actionCost ?? "action"), "weapons", { kind: "weapon", attack });
  }

  // Items — equipped, action-bearing; economy = resolved cost (free→actions, special→passive).
  for (const item of collectItemEntries(resolved, registry)) {
    place(featureEconomy(item.action.cost), "items", { kind: "item", item });
  }

  // Features & feats — skip renderSuppressed + buildOnly; do NOT dedupe.
  for (const rf of resolved.features ?? []) {
    if (rf.renderSuppressed || rf.buildOnly) continue;
    place(featureEconomy(rf.feature.action), featureSource(rf.source), { kind: "feature", rf });
  }

  // Boons — from pools; selected then grants, in pool order.
  for (const pool of resolved.pools ?? []) {
    for (const entry of pool.selected) {
      place(boonEconomy(entry.entity), "boons", { kind: "boon", entry, status: "selected", poolLabel: pool.label });
    }
    for (const entry of pool.grants) {
      place(boonEconomy(entry.entity), "boons", { kind: "boon", entry, status: "granted", poolLabel: pool.label });
    }
  }

  // Materialize in fixed ECONOMY × SOURCE order, omitting empties.
  const attacksPerAction = derived.attacksPerAction ?? 1;
  const equippedCount = (derived.attacks ?? []).length;

  const sections: Section[] = [];
  for (const economy of ECONOMY_ORDER) {
    const sources = buckets.get(economy);
    if (!sources) continue;

    const subGroups: SubGroup[] = [];
    for (const source of SOURCE_ORDER) {
      const entries = sources.get(source);
      if (!entries || entries.length === 0) continue;

      const subGroup: SubGroup = { key: source, label: SOURCE_LABEL[source], entries };
      if (economy === "actions" && source === "weapons") {
        const prefix = attacksPerAction > 1 ? `×${attacksPerAction} attacks · ` : "";
        subGroup.count = `${prefix}${equippedCount} equipped`;
      }
      subGroups.push(subGroup);
    }

    if (subGroups.length === 0) continue;
    sections.push({ key: economy, label: ECONOMY_LABEL[economy], subGroups });
  }

  return sections;
}
