import type { Choice, InlineOption, EntityFilter, Ability } from "../../shared/types/choice";
import { ALL_SKILL_SLUGS } from "../../shared/types/choice";
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
  if (where.parent_class === "self") {
    if (!d.parent_class || wikilinkTailSlug(d.parent_class) !== ownerBare) return false;
  }
  if (where.available_to === "self") {
    const list = d.available_to ?? [];
    if (!list.some((l) => wikilinkTailSlug(l) === ownerBare)) return false;
  }
  return true;
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

function buildItem(
  choice: Choice,
  source: FeatureSource,
  level: number,
  featureName: string,
  readValue: (id: string) => ChoiceValue | undefined,
  ctx: DecisionContext,
  ownerBare: string,
): DecisionItem {
  const selected = readValue(choice.id);
  const item: DecisionItem = {
    key: choice.id, source, level, featureName, choice,
    options: enumerateOptions(choice, ctx, ownerBare),
    selected, status: statusOf(choice, selected),
  };
  // Nested choices of the selected select-inline branch.
  if (choice.kind === "select-inline" && typeof selected === "string") {
    const branch: InlineOption | undefined = choice.options.find((o) => o.value === selected);
    if (branch?.choices?.length) {
      item.children = branch.choices.map((c) =>
        buildItem(c, source, level, featureName, readValue, ctx, ownerBare));
      if (item.status === "resolved" && item.children.some((c) => c.status !== "resolved")) {
        item.status = "partial";
      }
    }
  }
  return item;
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

    // Entity-level: starting-equipment choices (recorded for the Equipment step;
    // the minimal Class-step host doesn't render these — Plan 5 does).
    if (classIndex === 0) {
      // `equipment-{i}`/`option-{j}` keys are positional and assume stable
      // starting_equipment order (canonical SRD data); Plan 5 revisits if the
      // Equipment step persists these more broadly.
      (entity.starting_equipment ?? []).forEach((eq, i) => {
        if (eq.kind !== "choice") return;
        const ch: Choice = {
          kind: "select-inline", id: `equipment-${i}`, label: "Starting Equipment", count: 1,
          options: eq.options.map((opt, j) => ({ value: `option-${j}`, label: opt })),
        };
        push(1, buildItem(ch, { kind: "class", slug: entity.slug, level: 1 }, 1,
          "Starting Equipment", readAt(1), ctx, ownerBare));
      });
    }

    // Feature-level (class + subclass features already level-gated by the resolver),
    // with the recognizer as fallback for un-annotated decision prose (homebrew).
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
          const selected = c.subclass ? c.subclass.slug : undefined;
          const item: DecisionItem = {
            key: "subclass", source: src, level: lvl, featureName: rf.feature.name,
            choice: ch, options: enumerateOptions(ch, ctx, ownerBare),
            selected, status: selected ? "resolved" : "unresolved",
          };
          push(lvl, item);
          continue;
        }
        push(lvl, buildItem(ch, src, lvl, rf.feature.name, readAt(lvl), ctx, ownerBare));
      }
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
    source: FeatureSource, featureName: string, ownerBare: string) => {
    for (const ch of choices ?? []) {
      origin.push(buildItem(ch, source, 0, featureName, originRead(ns), ctx, ownerBare));
    }
  };
  if (resolved.race) {
    const bare = bareEntitySlug(resolved.race.slug);
    pushOrigin(resolved.race.choices, "race",
      { kind: "race", slug: resolved.race.slug }, resolved.race.name ?? "Race", bare);
    for (const t of resolved.race.traits ?? []) {
      pushOrigin(t.choices, "race", { kind: "race", slug: resolved.race.slug }, t.name, bare);
    }
  }
  if (resolved.background) {
    const bare = bareEntitySlug(resolved.background.slug);
    pushOrigin(resolved.background.choices, "background",
      { kind: "background", slug: resolved.background.slug }, resolved.background.name ?? "Background", bare);
    if (resolved.background.feature) {
      pushOrigin((resolved.background.feature as { choices?: Choice[] }).choices, "background",
        { kind: "background", slug: resolved.background.slug }, resolved.background.feature.name, bare);
    }
  }

  return { classes, origin };
}
