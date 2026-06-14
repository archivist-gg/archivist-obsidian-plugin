import type { Choice, InlineOption, EntityFilter, Ability } from "../../shared/types/choice";
import { ALL_SKILL_SLUGS } from "../../shared/types/choice";
import { ABILITY_KEYS } from "../../shared/dnd/constants";
import type { ResolvedCharacter, ChoiceValue, FeatureSource } from "./pc.types";
import type { RegisteredEntity } from "../../shared/entities/entity-registry";
import { recognizeDecision } from "./decision-recognizer";

export interface DecisionRegistry {
  search(query: string, entityType: string, limit: number): RegisteredEntity[];
  getByTypeAndSlug(entityType: string, slug: string): RegisteredEntity | undefined;
}

export interface ResolvedOption {
  value: string;
  label: string;
  entity?: RegisteredEntity;
  /** True when a `from` slug has no entity behind it — render visible-but-inert. */
  missing?: boolean;
}

/**
 * Status contract: over-selection (n > need) reports `resolved` — the engine
 * never reports an error for too many picks; the picker UI owns cap enforcement.
 * Likewise for ability-points `max_per`: the engine only sums total points
 * allocated, so per-ability caps are picker-enforced, not reflected here.
 */
export type DecisionStatus = "resolved" | "partial" | "unresolved" | "informational";

export interface DecisionItem {
  key: string;                 // choice.id (persistence key)
  source: FeatureSource;
  level: number;               // 0 for origin (race/background) decisions
  featureName: string;
  /**
   * The source feature/trait's own description (race trait, background feature,
   * class feature) — threaded through from the walk that emits the item so the
   * decision strip can render it as a quiet markdown block at the top of the
   * row's nest (smoke r7). Top-level rows only; a child inherits NOTHING from
   * its parent — it carries the sub-choice option's own `description` (when the
   * authored InlineOption supplies one) or none.
   */
  description?: string;
  /**
   * When `status === "informational"` this is a placeholder sentinel and MUST
   * NOT be rendered — informational items render from `featureName` only
   * (Task 16 contract). For every other status it is the real choice to render.
   */
  choice: Choice;
  options: ResolvedOption[];
  selected: ChoiceValue | undefined;
  status: DecisionStatus;
  /**
   * Populated only for the selected branch of a select-inline (the
   * revealed-on-selection rule): a child decision becomes visible once its
   * parent option is chosen. An unresolved child downgrades the parent's
   * status to "partial".
   */
  children?: DecisionItem[];
}

export interface DecisionLedger {
  classes: Array<{ classIndex: number; levels: Array<{ level: number; items: DecisionItem[] }> }>;
  origin: DecisionItem[];      // race + background decisions (Plan 4 consumes)
}

export interface DecisionContext { registry: DecisionRegistry }

/** Module-level dedup set for the degraded-starting-equipment warning: a class
 *  whose `starting_equipment` is in an outdated/unstructured shape warns ONCE per
 *  unique slug (not on every builder render), so the regression is surfaced
 *  without spamming the console. */
const warnedDegradedEquipment = new Set<string>();

// ── helpers ────────────────────────────────────────────────────────────────

/** "[[SRD 2024/Classes/Fighter]]" → "fighter" (tail segment, slugified). */
export function wikilinkTailSlug(link: string): string {
  const inner = link.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const tail = inner.split("/").pop() ?? inner;
  return tail.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** "srd-2024_fighter" → "fighter". */
export function bareEntitySlug(slug: string): string {
  const i = slug.indexOf("_");
  return i === -1 ? slug : slug.slice(i + 1);
}

function matchesFilter(e: RegisteredEntity, where: EntityFilter, ownerBare: string): boolean {
  const d = e.data as { feature_type?: string; category?: string; parent_class?: string; available_to?: string[] };
  if (where.feature_type && d.feature_type !== where.feature_type) return false;
  if (where.category && d.category !== where.category) return false;
  // Weapon class: a weapon entity's `category` is compound (e.g. "martial-melee"),
  // so "martial"/"simple" prefix-matches both melee and ranged. Case-insensitive
  // for resilience against authored casing; excludes "natural".
  if (where.weapon_category) {
    const cat = (d.category ?? "").toLowerCase();
    if (!cat.startsWith(`${where.weapon_category}-`) && cat !== where.weapon_category) return false;
  }
  // Armor class: an armor entity's `category` holds the class directly
  // ("light"|"medium"|"heavy"|"shield"); exact (case-insensitive) match.
  if (where.armor_category) {
    if ((d.category ?? "").toLowerCase() !== where.armor_category) return false;
  }
  if (where.parent_class === "self") {
    if (!d.parent_class || wikilinkTailSlug(d.parent_class) !== ownerBare) return false;
  }
  if (where.available_to === "self") {
    const list = d.available_to ?? [];
    if (!list.some((l) => wikilinkTailSlug(l) === ownerBare)) return false;
  }
  return true;
}

/** Test-only export of {@link matchesFilter} (Task B2). */
export const __matchesFilterForTest = matchesFilter;

/** Map a starting-equipment category grant to a nested select-entity child.
 *  Weapons filter by weapon_category; armor by armor_category; "shield" → an
 *  armor entity in the shield class. The "shield" branch is tested BEFORE the
 *  generic "armor" branch because a shield is an armor entity_type but a
 *  distinct category.
 *
 *  Grant-category vocabulary (Task E1 authors within this; stay inside it):
 *    - `simple-weapon`, `martial-weapon` — `*-melee-*`/`*-ranged-*` variants
 *      COLLAPSE to weapon_category only (the engine has no melee/ranged axis,
 *      so `martial-melee-weapon` matches both martial-melee AND martial-ranged).
 *    - `light-armor`, `medium-armor`, `heavy-armor` — class-restricted armor.
 *    - `any-armor` (or a bare `armor`) — ALL armor, no class restriction.
 *    - `shield` — shields only.
 *  Unknown/unrecognized category falls through to a simple-weapon filter (v1
 *  default); authors should stay within the vocabulary above. */
function categoryToEntitySelect(category: string, id: string): Choice {
  const c = category.toLowerCase();
  if (c === "shield") {
    return { kind: "select-entity", id, label: "Choose a shield", count: 1, entity_type: "armor", where: { armor_category: "shield" } };
  }
  if (c.includes("armor")) {
    // Only set armor_category when a specific class is named. For "any-armor"
    // (or a bare "armor") emit a select-entity with NO `where` so enumerateOptions
    // returns ALL armor of the type (an absent filter = all-of-type).
    const klass: "light" | "medium" | "heavy" | null =
      c.includes("light") ? "light" : c.includes("medium") ? "medium" : c.includes("heavy") ? "heavy" : null;
    return klass
      ? { kind: "select-entity", id, label: `Choose ${klass} armor`, count: 1, entity_type: "armor", where: { armor_category: klass } }
      : { kind: "select-entity", id, label: "Choose armor", count: 1, entity_type: "armor" };
  }
  const wc: "simple" | "martial" = c.includes("martial") ? "martial" : "simple";
  return { kind: "select-entity", id, label: `Choose a ${c.replace(/-/g, " ")}`, count: 1, entity_type: "weapon", where: { weapon_category: wc } };
}

function enumerateOptions(choice: Choice, ctx: DecisionContext, ownerBare: string): ResolvedOption[] {
  switch (choice.kind) {
    case "select-inline":
      return choice.options.map((o) => ({ value: o.value, label: o.label }));
    case "select-entity": {
      if (choice.from) {
        const byBare = new Map<string, RegisteredEntity>();
        for (const e of ctx.registry.search("", choice.entity_type, Number.POSITIVE_INFINITY)) {
          byBare.set(bareEntitySlug(e.slug), e);
        }
        return choice.from.map((slug) => {
          const e = ctx.registry.getByTypeAndSlug(choice.entity_type, slug) ?? byBare.get(slug);
          return e ? { value: e.slug, label: e.name, entity: e } : { value: slug, label: slug, missing: true };
        });
      }
      const all = ctx.registry.search("", choice.entity_type, Number.POSITIVE_INFINITY);
      const filtered = choice.where ? all.filter((e) => matchesFilter(e, choice.where!, ownerBare)) : all;
      return filtered.map((e) => ({ value: e.slug, label: e.name, entity: e }));
    }
    case "select-proficiency": {
      const pool = choice.from ?? (choice.domain === "skill" ? [...ALL_SKILL_SLUGS] : []);
      return pool.map((v) => ({ value: v, label: v.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }));
    }
    case "ability-points": {
      const pool = choice.pool ?? (["str", "dex", "con", "int", "wis", "cha"] as Ability[]);
      return pool.map((a) => ({ value: a, label: a.toUpperCase() }));
    }
  }
}

function selectionCount(choice: Choice, selected: ChoiceValue | undefined): number {
  if (selected === undefined) return 0;
  if (choice.kind === "ability-points") {
    if (typeof selected !== "object" || Array.isArray(selected)) return 0;
    return Object.values(selected).reduce((s: number, v) => s + (typeof v === "number" ? v : 0), 0);
  }
  if (Array.isArray(selected)) return selected.length;
  return typeof selected === "string" && selected.length > 0 ? 1 : 0;
}

function requiredCount(choice: Choice): number {
  if (choice.kind === "ability-points") return choice.points;
  if (choice.kind === "select-proficiency") return choice.count;
  return choice.count ?? 1;
}

function statusOf(choice: Choice, selected: ChoiceValue | undefined): DecisionStatus {
  const n = selectionCount(choice, selected);
  const need = requiredCount(choice);
  if (n === 0) return "unresolved";
  return n >= need ? "resolved" : "partial";
}

// ── the engine ─────────────────────────────────────────────────────────────

/** Resolve the registered entity behind a persisted select-entity value (a bare
 *  slug or a `[[wikilink]]`). Matches the registry's stored slug, the bare slug
 *  (edition prefix stripped), or a wikilink tail. Returns undefined when no
 *  entity is registered (a stale/homebrew slug — caller surfaces no children). */
function resolveEntityRef(
  ctx: DecisionContext,
  entityType: string,
  value: ChoiceValue | undefined,
): RegisteredEntity | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  // Strip a `[[wikilink]]` wrapper WITHOUT slugifying — the stored entity slug
  // keeps its edition underscore (e.g. "srd-2024_magic-initiate"), which
  // wikilinkTailSlug would mangle into hyphens.
  const raw = value.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const direct = ctx.registry.getByTypeAndSlug(entityType, raw);
  if (direct) return direct;
  // Fallback: scan the type's pool by exact slug or bare-slug match (the engine
  // stores full slugs like "srd-2024_alert" but a value may carry the bare tail).
  for (const e of ctx.registry.search("", entityType, Number.POSITIVE_INFINITY)) {
    if (e.slug === raw || bareEntitySlug(e.slug) === raw) return e;
  }
  return undefined;
}

function buildItem(
  choice: Choice,
  source: FeatureSource,
  level: number,
  featureName: string,
  readValue: (id: string) => ChoiceValue | undefined,
  ctx: DecisionContext,
  ownerBare: string,
  opts?: { keyPrefix?: string; expandFeatChildren?: boolean; description?: string },
): DecisionItem {
  const keyPrefix = opts?.keyPrefix ?? "";
  // `expandFeatChildren` defaults true at the top level; we set it false inside a
  // feat's own children so a feat-select-entity nested under a feat never grows
  // grandchildren (cheap infinite-loop guard — real SRD data never nests so).
  const expandFeatChildren = opts?.expandFeatChildren ?? true;
  const key = keyPrefix + choice.id;
  const selected = readValue(key);
  const item: DecisionItem = {
    key, source, level, featureName, choice,
    description: opts?.description,
    options: enumerateOptions(choice, ctx, ownerBare),
    selected, status: statusOf(choice, selected),
  };
  // Nested choices of the selected select-inline branch.
  if (choice.kind === "select-inline" && typeof selected === "string") {
    const branch: InlineOption | undefined = choice.options.find((o) => o.value === selected);
    if (branch?.choices?.length) {
      item.children = branch.choices.map((c) =>
        buildItem(c, source, level, featureName, readValue, ctx, ownerBare, { keyPrefix, expandFeatChildren }));
      if (item.status === "resolved" && item.children.some((c) => c.status !== "resolved")) {
        item.status = "partial";
      }
    }
  }
  // Chosen-feat children: a selected feat select-entity surfaces the chosen
  // feat's OWN decisions (its `choices`) as ledger children, namespaced
  // `feat:<choiceId>` so they never collide with a sibling asi-branch `asi` key.
  // Scope is exclusive to entity_type "feat": subclass picks merge their
  // features through the class merge, never grow children here.
  if (
    choice.kind === "select-entity" && choice.entity_type === "feat" &&
    expandFeatChildren && typeof selected === "string"
  ) {
    const entity = resolveEntityRef(ctx, "feat", selected);
    const rawChoices = entity?.data?.choices;
    const featChoices: Choice[] = Array.isArray(rawChoices) ? (rawChoices as Choice[]) : [];
    if (featChoices.length) {
      const childPrefix = `${keyPrefix}feat:`;
      item.children = featChoices.map((c) =>
        buildItem(c, source, level, featureName, readValue, ctx, ownerBare,
          { keyPrefix: childPrefix, expandFeatChildren: false }));
      if (item.status === "resolved" && item.children.some((c) => c.status !== "resolved")) {
        item.status = "partial";
      }
    }
  }
  return item;
}

/** Build the structural subclass-pick DecisionItem (key "subclass"). Unlike a
 *  generic select-entity it reads/writes ClassEntry.subclass directly (no
 *  per-level choices map): `selected` comes from `c.subclass`, and the strip's
 *  writeValue routes it to setSubclass off `choice.entity_type === "subclass"`.
 *  Shared by the authored path and the Fix-B synthesized guarantee so both
 *  enumerate the same candidate pool and take the same write path. */
function buildSubclassItem(
  choice: Choice,
  source: FeatureSource,
  level: number,
  featureName: string,
  c: ResolvedCharacter["classes"][number],
  ctx: DecisionContext,
  ownerBare: string,
  description?: string,
): DecisionItem {
  const selected = c.subclass ? c.subclass.slug : undefined;
  return {
    key: "subclass", source, level, featureName, description,
    choice, options: enumerateOptions(choice, ctx, ownerBare),
    selected, status: selected ? "resolved" : "unresolved",
  };
}

/** Walk every decision definition + persisted selection and collect chosen
 *  proficiencies. Pure; called by recalc. Values are validated against the
 *  decision's option pool — stale slugs (outside `from`) are ignored. */
export function collectChosenProficiencies(resolved: ResolvedCharacter): {
  skills: string[]; expertise: string[]; languages: string[]; tools: string[];
} {
  const out = { skills: [] as string[], expertise: [] as string[], languages: [] as string[], tools: [] as string[] };

  const apply = (choice: Choice, selected: ChoiceValue | undefined): void => {
    if (choice.kind !== "select-proficiency") return;
    const vals = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
    const pool = choice.from;
    const valid = pool ? vals.filter((v) => pool.includes(v)) : vals;
    // domain:"save" is intentionally not collected here — saving-throw
    // proficiencies come from class `saving_throws`, not decisions.
    const bucket = choice.domain === "skill" ? (choice.expertise ? out.expertise : out.skills)
      : choice.domain === "language" ? out.languages
      : choice.domain === "tool" ? out.tools : null;
    if (bucket) for (const v of valid) if (!bucket.includes(v)) bucket.push(v);
  };

  const walk = (choices: Choice[] | undefined, read: (id: string) => ChoiceValue | undefined): void => {
    for (const ch of choices ?? []) {
      apply(ch, read(ch.id));
      if (ch.kind === "select-inline") {
        const sel = read(ch.id);
        const branch = typeof sel === "string" ? ch.options.find((o) => o.value === sel) : undefined;
        if (branch?.choices) walk(branch.choices, read);
      }
    }
  };

  resolved.classes.forEach((c, i) => {
    if (!c.entity) return;
    const entity = c.entity;
    const readAt = (lvl: number) => (id: string): ChoiceValue | undefined =>
      (c.choices[lvl] as Record<string, ChoiceValue> | undefined)?.[id];

    // Entity-level L1 skill choice (first class only — multiclass rules are Plan 5).
    if (i === 0 && entity.skill_choices?.from?.length) {
      apply({ kind: "select-proficiency", id: "skills", count: entity.skill_choices.count,
        domain: "skill", from: entity.skill_choices.from }, readAt(1)("skills"));
    }

    for (const rf of resolved.features) {
      if (rf.source.kind !== "class" && rf.source.kind !== "subclass") continue;
      const belongs = rf.source.kind === "class" ? rf.source.slug === entity.slug
        : c.subclass != null && rf.source.slug === c.subclass.slug;
      if (!belongs) continue;
      walk(rf.feature.choices, readAt(rf.source.level));
    }
  });

  const oc = resolved.definition.origin_choices ?? {};
  const originRead = (ns: string) => (id: string): ChoiceValue | undefined => oc[`${ns}:${id}`];
  if (resolved.race) {
    walk(resolved.race.choices, originRead("race"));
    for (const t of resolved.race.traits ?? []) walk(t.choices, originRead("race"));
  }
  if (resolved.background) {
    walk(resolved.background.choices, originRead("background"));
    if (resolved.background.feature) {
      walk((resolved.background.feature as { choices?: Choice[] }).choices, originRead("background"));
    }
  }

  return out;
}

export interface OriginAbilityPoints {
  race: Partial<Record<Ability, number>>;
  background: Partial<Record<Ability, number>>;
}

/** Pure: folds ORIGIN (race/background) `ability-points` decisions out of
 *  origin_choices into per-namespace totals. Values are clamped picker-side
 *  already, but clamp again defensively: per-ability max_per, then stop at the
 *  points total walking ABILITY_KEYS order. Class-level ASI stays on the
 *  legacy choices[lvl].asi path recalc already folds — do not double-count. */
export function collectChosenAbilityPoints(resolved: ResolvedCharacter): OriginAbilityPoints {
  const oc = resolved.definition.origin_choices ?? {};
  const out: OriginAbilityPoints = { race: {}, background: {} };

  const fold = (ns: "race" | "background", choices: Choice[] | undefined): void => {
    for (const ch of choices ?? []) {
      if (ch.kind !== "ability-points") continue;
      const raw = oc[`${ns}:${ch.id}`];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      let left = ch.points;
      for (const ab of ABILITY_KEYS) {
        // Pool parity with collectChosenProficiencies: out-of-pool allocations
        // from hand-edited files must not fold (the picker can't produce them).
        if (ch.pool && !ch.pool.includes(ab)) continue;
        const v = raw[ab];
        if (typeof v !== "number" || v <= 0 || left <= 0) continue;
        const take = Math.min(v, ch.max_per, left);
        out[ns][ab] = (out[ns][ab] ?? 0) + take;
        left -= take;
      }
    }
  };

  const race = resolved.race;
  if (race) {
    fold("race", race.choices);
    for (const t of race.traits ?? []) fold("race", t.choices);
  }
  const bg = resolved.background;
  if (bg) {
    fold("background", bg.choices);
    fold("background", (bg.feature as { choices?: Choice[] } | undefined)?.choices);
  }
  return out;
}

export function buildDecisionLedger(resolved: ResolvedCharacter, ctx: DecisionContext): DecisionLedger {
  const classes: DecisionLedger["classes"] = [];

  resolved.classes.forEach((c, classIndex) => {
    if (!c.entity) return;
    const entity = c.entity;
    const ownerBare = bareEntitySlug(entity.slug);
    const byLevel = new Map<number, DecisionItem[]>();
    const push = (lvl: number, item: DecisionItem) => {
      const arr = byLevel.get(lvl) ?? [];
      arr.push(item);
      byLevel.set(lvl, arr);
    };
    const readAt = (lvl: number) => (id: string): ChoiceValue | undefined =>
      (c.choices[lvl] as Record<string, ChoiceValue> | undefined)?.[id];

    // Entity-level: L1 skill choice (first class only — multiclass rules are Plan 5).
    if (classIndex === 0 && entity.skill_choices?.from?.length) {
      const skillChoice: Choice = {
        kind: "select-proficiency", id: "skills", label: "Skill Proficiencies",
        count: entity.skill_choices.count, domain: "skill",
        from: entity.skill_choices.from,
      };
      push(1, buildItem(skillChoice, { kind: "class", slug: entity.slug, level: 1 }, 1,
        "Proficiencies", readAt(1), ctx, ownerBare));
    }

    // Entity-level: starting-equipment choices (the Equipment step renders +
    // seeds these). Each option's label drives the .pc-cb-eqopt row; a
    // `{category}` grant on an option becomes a nested select-entity child that
    // is revealed when that option is selected (buildItem's select-inline child
    // rule), so the player picks the concrete weapon/armor.
    if (classIndex === 0) {
      // `equipment-{i}`/`option-{j}` keys are positional and assume stable
      // starting_equipment order (canonical SRD data); Plan 5 revisits if the
      // Equipment step persists these more broadly.
      (entity.starting_equipment ?? []).forEach((eq, i) => {
        if (eq.kind !== "choice") return;
        // Tolerate OLD-shape (an option is a plain string) and malformed options
        // (an object without an array `grants`): such options degrade to a label
        // with no nested children, and never throw. A degraded entry is also
        // surfaced (warn once per class slug below) so the regression is visible.
        const options = (eq.options ?? []) as unknown[];
        let degraded = false;
        const ch: Choice = {
          kind: "select-inline", id: `equipment-${i}`, label: "Starting Equipment", count: 1,
          options: options.map((opt, j) => {
            const label = typeof opt === "string"
              ? opt
              : ((opt as { label?: string } | null)?.label ?? "");
            const grants =
              opt && typeof opt === "object" && Array.isArray((opt as { grants?: unknown }).grants)
                ? ((opt as { grants: unknown[] }).grants)
                : [];
            if (typeof opt === "string" || !(opt && typeof opt === "object" && Array.isArray((opt as { grants?: unknown }).grants))) {
              degraded = true;
            }
            return {
              value: `option-${j}`,
              label,
              choices: grants.flatMap((g, k) =>
                g && typeof g === "object" && "category" in g && (g as { category?: string }).category
                  ? [categoryToEntitySelect((g as { category: string }).category, `equipment-${i}-opt-${j}-cat-${k}`)]
                  : []),
            } as InlineOption;
          }),
        };
        if (degraded && !warnedDegradedEquipment.has(entity.slug)) {
          warnedDegradedEquipment.add(entity.slug);
          console.warn(
            `[archivist] Starting equipment for "${entity.slug}" is in an outdated/unstructured format; ` +
            "its nested picks and seeding are skipped. Re-sync the compendium " +
            "(delete _compendium.md and reload) to fix.",
          );
        }
        push(1, buildItem(ch, { kind: "class", slug: entity.slug, level: 1 }, 1,
          "Starting Equipment", readAt(1), ctx, ownerBare));
      });
    }

    // Feature-level (class + subclass features already level-gated by the resolver),
    // with the recognizer as fallback for un-annotated decision prose (homebrew).
    // Track whether an authored subclass select-entity surfaced so the guarantee
    // below never synthesizes a duplicate (mirrors the browse walker's
    // collectBrowseDecisions; the 2024 Bard alone lacks the authored choice).
    let sawAuthoredSubclass = false;
    for (const rf of resolved.features) {
      const src = rf.source;
      if (src.kind !== "class" && src.kind !== "subclass") continue;
      const belongs = src.kind === "class"
        ? src.slug === entity.slug
        : c.subclass != null && src.slug === c.subclass.slug;
      if (!belongs) continue;
      const lvl = src.level;
      let choices = rf.feature.choices;
      if (!choices?.length) {
        const recognized = recognizeDecision(rf.feature);
        if (recognized === "informational") {
          push(lvl, {
            key: rf.feature.id ?? rf.feature.name, source: src, level: lvl,
            featureName: rf.feature.name,
            choice: { kind: "select-inline", id: rf.feature.id ?? rf.feature.name, options: [{ value: "_", label: "_" }] },
            options: [], selected: undefined, status: "informational",
          });
          continue;
        }
        choices = recognized ?? undefined;
      }
      if (!choices?.length) continue;
      for (const ch of choices) {
        // The subclass decision is structural: it reads/writes ClassEntry.subclass.
        if (ch.kind === "select-entity" && ch.entity_type === "subclass") {
          sawAuthoredSubclass = true;
          push(lvl, buildSubclassItem(ch, src, lvl, rf.feature.name, c, ctx, ownerBare, rf.feature.description));
          continue;
        }
        push(lvl, buildItem(ch, src, lvl, rf.feature.name, readAt(lvl), ctx, ownerBare,
          { description: rf.feature.description }));
      }
    }

    // Subclass-pick guarantee (Fix B): when the class declares a subclass_level
    // that the character has reached but NO authored subclass select-entity was
    // emitted (the 2024 Bard gap — alone of 12 classes), synthesize the pick off
    // subclass_level so every owned card offers it. The synthesized choice carries
    // `where: { parent_class: "self" }`, so enumerateOptions filters registry
    // subclasses to this class (matchesFilter resolves "self" → ownerBare). It
    // takes the SAME structural write path as the authored item (key "subclass",
    // routed to setSubclass by the strip's writeValue). Pure over (resolved, registry).
    const subclassLevel = (entity as { subclass_level?: number | null }).subclass_level ?? null;
    if (subclassLevel != null && subclassLevel <= c.level && !sawAuthoredSubclass) {
      const featureName = (entity as { subclass_feature_name?: string | null }).subclass_feature_name ?? "Subclass";
      const synthChoice: Choice = {
        kind: "select-entity", id: "subclass", label: featureName, count: 1,
        entity_type: "subclass", where: { parent_class: "self" },
      };
      push(subclassLevel, buildSubclassItem(
        synthChoice, { kind: "class", slug: entity.slug, level: subclassLevel },
        subclassLevel, featureName, c, ctx, ownerBare));
    }

    const levels = [...byLevel.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, items]) => ({ level, items }));
    classes.push({ classIndex, levels });
  });

  // Origin decisions (race entity-level + traits; background entity-level + feature).
  const origin: DecisionItem[] = [];
  const oc = resolved.definition.origin_choices ?? {};
  const originRead = (ns: string) => (id: string): ChoiceValue | undefined => oc[`${ns}:${id}`];
  const pushOrigin = (choices: Choice[] | undefined, ns: "race" | "background",
    source: FeatureSource, featureName: string, ownerBare: string, description?: string) => {
    for (const ch of choices ?? []) {
      origin.push(buildItem(ch, source, 0, featureName, originRead(ns), ctx, ownerBare, { description }));
    }
  };
  if (resolved.race) {
    const bare = bareEntitySlug(resolved.race.slug);
    pushOrigin(resolved.race.choices, "race",
      { kind: "race", slug: resolved.race.slug }, resolved.race.name ?? "Race", bare,
      (resolved.race as { description?: string }).description);
    for (const t of resolved.race.traits ?? []) {
      pushOrigin(t.choices, "race", { kind: "race", slug: resolved.race.slug }, t.name, bare,
        (t as { description?: string }).description);
    }
  }
  if (resolved.background) {
    const bare = bareEntitySlug(resolved.background.slug);
    pushOrigin(resolved.background.choices, "background",
      { kind: "background", slug: resolved.background.slug }, resolved.background.name ?? "Background", bare,
      (resolved.background as { description?: string }).description);
    if (resolved.background.feature) {
      pushOrigin((resolved.background.feature as { choices?: Choice[]; description?: string }).choices, "background",
        { kind: "background", slug: resolved.background.slug }, resolved.background.feature.name, bare,
        (resolved.background.feature as { description?: string }).description);
    }
  }

  return { classes, origin };
}
