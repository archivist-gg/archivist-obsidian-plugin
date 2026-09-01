import type { EntityRegistry, RegisteredEntity } from "@archivist-gg/core";
import { bareEntitySlug } from "@archivist-gg/dnd5e/entities/slug";
import { entityCompendiumVisible } from "../../shared/entities/compendium-visibility";

/**
 * Entity-backed condition labels (spec §6). Replaces the retired dnd5e
 * `CONDITION_DISPLAY_NAMES` table: the display spelling of a condition is DATA
 * that ships in the `condition` entity corpus, not a closed record in the
 * engine. The engine keeps `ConditionSlug` / `CONDITION_SLUGS`, which are the
 * STATE vocabulary and stay a mechanic.
 *
 * The degraded path is an IDENTITY, not a downgrade: with no registry, no
 * condition entities, or a partial service bundle, the map is empty and
 * `conditionDisplayName` falls back to `titleCase(slug)`, which is
 * byte-for-byte the 14 retired spellings (pinned in
 * `tests/condition-labels.test.ts` against a verbatim copy of the table). That
 * is why every entry point here is fail-open rather than throwing: three
 * shipped sheet tests hand components a ctx with no `services` at all, and the
 * production sheet must never lose a chip label to a missing registry.
 */

/** Registry surface this module reads. Deliberately ONE optional method:
 *  callers reach it through `ctx.services.entities`, which several render paths
 *  populate partially or not at all. */
type ConditionRegistry = { search?: EntityRegistry["search"] } | null | undefined;

const CONDITION_TYPE = "condition";

/** `search`'s third argument. The condition bucket is ~15 entities per book, so
 *  the unbounded scan is cheap and, unlike a limit, cannot silently truncate a
 *  many-compendium vault into a partial label map. */
const NO_LIMIT = Number.POSITIVE_INFINITY;

const NOTHING_HIDDEN: ReadonlySet<string> = new Set();

/** Module-private, per spec §6 (Gate 1 M-A5): `titleCase` exists only as
 *  module-local copies across this repo, and this module declares its own
 *  rather than exporting a shared one. Identical body to the race renderer's. */
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * ONE `search("", "condition", ∞)` scan, folded to the winning entity per BARE
 * slug (`srd-2024_condition_blinded` → `blinded`), so every book's copy of a
 * condition collapses onto the slug the engine actually holds.
 *
 * Pick order (spec §6 — a determinism guard; zero name variants exist across
 * the measured 89-doc corpus): prefer a non-hidden compendium, then take the
 * first of the name-sorted enumeration `search` returns. Visibility only
 * ORDERS the candidates — it never filters, so a vault with every condition
 * compendium hidden still resolves labels and tooltips.
 */
export function buildConditionEntityMap(
  registry: ConditionRegistry,
  hidden: ReadonlySet<string> = NOTHING_HIDDEN,
): Map<string, RegisteredEntity> {
  const out = new Map<string, RegisteredEntity>();
  if (typeof registry?.search !== "function") return out;

  for (const entity of registry.search("", CONDITION_TYPE, NO_LIMIT)) {
    const bare = bareEntitySlug(entity.slug);
    if (!bare) continue;
    const incumbent = out.get(bare);
    if (incumbent === undefined) {
      out.set(bare, entity);
      continue;
    }
    // First-wins on the sorted enumeration, with exactly one override: a
    // visible copy displaces a hidden incumbent. Never the reverse.
    if (!entityCompendiumVisible(incumbent, hidden) && entityCompendiumVisible(entity, hidden)) {
      out.set(bare, entity);
    }
  }
  return out;
}

/** Labels out of an already-built entity map. The tooltip surfaces need the
 *  ENTITY (for `description`), so they build the entity map once and derive
 *  labels here rather than scanning the registry a second time. */
export function conditionLabelMapFrom(
  entities: ReadonlyMap<string, RegisteredEntity>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [bare, entity] of entities) out.set(bare, entity.name);
  return out;
}

/** `bareSlug → display name`, built once per render pass. Callers that need no
 *  descriptions use this; the one that does uses `buildConditionEntityMap` +
 *  `conditionLabelMapFrom` so the pass still costs a single scan. */
export function buildConditionLabelMap(
  registry: ConditionRegistry,
  hidden?: ReadonlySet<string>,
): Map<string, string> {
  return conditionLabelMapFrom(buildConditionEntityMap(registry, hidden));
}

/**
 * TOTAL over the 14 `CONDITION_SLUGS`: an unregistered slug title-cases, which
 * reproduces the retired table exactly. The one site that must NOT use this is
 * `defenses-conditions-panel.ts`'s condition-immunity chip, where an
 * out-of-vocabulary immunity has an AUTHORED label that outranks a title-cased
 * slug (spec §6's stated exception).
 */
export function conditionDisplayName(slug: string, map?: ReadonlyMap<string, string>): string {
  return map?.get(slug) ?? titleCase(slug);
}

/**
 * The first paragraph of a condition entity's authored `description`, for the
 * PC chip tooltips (spec §6). `data` is the fenced code-block payload the vault
 * store registers, so `description` is present but untyped — a non-string or
 * absent value degrades to `""`, which the callers read as "nothing to append".
 */
export function conditionTooltipParagraph(entity: RegisteredEntity | undefined): string {
  const description = entity?.data.description;
  if (typeof description !== "string") return "";
  return description.split(/\r?\n[ \t]*\r?\n/)[0].trim();
}
