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
  | { kind: "feature"; rf: ResolvedFeature; merged?: ResolvedFeature[] }
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
  passive: "Passive & Free Actions",
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
 *   `action`                     → actions
 *   `bonus-action`               → bonus
 *   `reaction`                   → reactions
 *   `free` / `special` / absent  → passive (Passive & Free Actions)
 */
function featureEconomy(action: ActionCost | null | undefined): EconomyKey {
  switch (action) {
    case "action":
      return "actions";
    case "bonus-action":
      return "bonus";
    case "reaction":
      return "reactions";
    // "free", "special", undefined, null → Passive & Free Actions
    default:
      return "passive";
  }
}

/**
 * Boon economy (spec §3): a boon has no synthesized `feature`, so map the
 * OptionalFeatureEntity's `action_cost` through the same vocabulary. A free
 * boon (`action_cost:"free"`, e.g. "Red Cant"/"Bedevil") and a no-cost boon
 * both land in Passive & Free Actions — `featureEconomy` maps `free`,
 * `special`, and absent alike to `passive`, so this is a straight pass-through.
 */
function boonEconomy(entity: OptionalFeatureEntity): EconomyKey {
  return featureEconomy(entity.action_cost);
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
    default:
      return assertNever(source);
  }
}

/** Compile-time exhaustiveness guard: unreachable for a well-typed FeatureSource;
 *  throws if a new `source.kind` is added without a matching case above. */
function assertNever(x: never): never {
  throw new Error(`Unhandled feature source: ${JSON.stringify(x)}`);
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
// Same-parent class+subclass merge (spec §2 / D2-1)
// ─────────────────────────────────────────────────────────────

/** Case-insensitive, whitespace-trimmed feature-name key for the merge match. */
function mergeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Collapse a same-named class feature and its OWN-subclass feature into a single
 * primary entry (spec §2, D2-1 — "Invoke Hell"). Runs on ONE (economy,
 * source-display-group) bucket's `ActionEntry[]`, so pairs in different economy
 * Sections never merge. A class-sourced feature entry is the PRIMARY; each later
 * subclass-sourced feature entry joins its `merged[]` when ALL hold:
 *   1. `feature.name` equal (trimmed, case-insensitive),
 *   2. one entry `source.kind === "class"`, the other `=== "subclass"`,
 *   3. `` `${classSlug}|${subclassSlug}` `` ∈ `sameParent`.
 * The `sameParent` join (built from `resolved.classes`) is what pins the merge to
 * the character's CHOSEN subclass — a flat name scan would wrongly collapse a
 * cross-class collision (Cleric-class + Paladin-subclass "Channel Divinity").
 * Both Extra Attack fixtures are `kind:"class"` → condition 2 never fires → they
 * stay two rows. Supports N≥1 secondaries generically (only 1 occurs for SRD).
 */
function mergeFeatureEntries(list: ActionEntry[], sameParent: Set<string>): ActionEntry[] {
  const consumed = new Set<number>();
  const out: ActionEntry[] = [];
  for (let i = 0; i < list.length; i++) {
    if (consumed.has(i)) continue;
    const entry = list[i];
    // Only a class-sourced feature entry can be a merge primary.
    if (entry.kind !== "feature" || entry.rf.source.kind !== "class") {
      out.push(entry);
      continue;
    }
    const classSlug = entry.rf.source.slug;
    const nameKey = mergeNameKey(entry.rf.feature.name);
    const merged: ResolvedFeature[] = [];
    for (let j = i + 1; j < list.length; j++) {
      if (consumed.has(j)) continue;
      const other = list[j];
      if (other.kind !== "feature" || other.rf.source.kind !== "subclass") continue;
      if (mergeNameKey(other.rf.feature.name) !== nameKey) continue;
      if (!sameParent.has(`${classSlug}|${other.rf.source.slug}`)) continue;
      merged.push(other.rf);
      consumed.add(j);
    }
    out.push(merged.length ? { kind: "feature", rf: entry.rf, merged } : entry);
  }
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

  // Items — equipped, action-bearing; economy = resolved cost (free/special → passive).
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

  // Same-parent join set (spec §2): `${class.slug}|${subclass.slug}` for the
  // character's CHOSEN class→subclass pairs. Null-guarded — unit fixtures omit
  // `classes`, and a class carrying no chosen subclass yields no pair.
  const sameParent = new Set<string>();
  for (const c of resolved.classes ?? []) {
    const classSlug = c.entity?.slug;
    const subclassSlug = c.subclass?.slug;
    if (classSlug && subclassSlug) sameParent.add(`${classSlug}|${subclassSlug}`);
  }
  // Per-bucket merge post-pass: collapse a same-named class + its-own-subclass
  // feature into one entry. Runs within each (economy, source) list only, so a
  // same-name pair split across economies never merges.
  for (const sources of buckets.values()) {
    for (const [source, list] of sources) {
      sources.set(source, mergeFeatureEntries(list, sameParent));
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
