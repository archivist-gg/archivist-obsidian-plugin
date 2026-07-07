import type { EntityRegistry } from "@archivist/core";
import type { ClassEntity } from "@archivist/dnd5e/class/class.types";
import type { RaceEntity } from "@archivist/dnd5e/race/race.types";
import type { SubclassEntity } from "@archivist/dnd5e/subclass/subclass.types";
import type { BackgroundEntity } from "@archivist/dnd5e/background/background.types";
import type { FeatEntity } from "@archivist/dnd5e/feat/feat.types";
import type { Feature, Choice } from "@archivist/dnd5e";
import type { Spell } from "@archivist/dnd5e/spell/spell.types";
import type {
  Character,
  ResolvedCharacter,
  ResolvedClass,
  ResolvedFeature,
  ResolvedSpell,
  FeatureSource,
} from "./pc.types";
import { normalizeKnownSpell, resolveSpellcasting } from "@archivist/dnd5e/pc/pc.spellcasting";
import { resolveAllPools } from "@archivist/dnd5e/pc/pc.pools";

export interface ResolveResult {
  character: ResolvedCharacter;
  warnings: string[];
}

const SLUG_RE = /^\[\[(.+?)\]\]$/;

export function stripSlug(ref: string | null): string | null {
  if (!ref) return null;
  const m = ref.match(SLUG_RE);
  return m ? m[1] : ref;
}

export class PCResolver {
  constructor(private readonly entities: EntityRegistry) {}

  /** Exposed so recalc() can apply equipment bonuses (Pass A / Pass B). */
  get registry(): EntityRegistry {
    return this.entities;
  }

  resolve(character: Character): ResolveResult {
    const warnings: string[] = [];

    const lookup = <T>(rawRef: string | null, type: string): T | null => {
      const slug = stripSlug(rawRef);
      if (!slug) return null;
      const reg = this.entities.getByTypeAndSlug(type, slug);
      if (!reg) {
        warnings.push(`Slug [[${slug}]] not found in compendium as ${type}.`);
        return null;
      }
      // Custom-created entities (e.g. the custom-background builder) omit `slug`
      // from their body data — saveEntity generates it for the registration only,
      // so reg.data.slug is undefined. Backfill the canonical reg.slug so downstream
      // consumers (bareEntitySlug, FeatureSource.slug) never see undefined. SRD
      // entities carry a body slug and are returned unchanged.
      const data = reg.data as { slug?: string };
      return (data.slug == null ? { ...data, slug: reg.slug } : data) as T;
    };

    const race = lookup<RaceEntity>(character.race, "race");
    const background = lookup<BackgroundEntity>(character.background, "background");

    const classes: ResolvedClass[] = character.class.map((c) => ({
      entity: lookup<ClassEntity>(c.name, "class"),
      level: c.level,
      subclass: lookup<SubclassEntity>(c.subclass, "subclass"),
      choices: c.choices,
    }));

    const featSlugs = collectFeatSlugs(character);
    const feats: FeatEntity[] = [];
    for (const slug of featSlugs) {
      const f = lookup<FeatEntity>(`[[${slug}]]`, "feat");
      if (f) feats.push(f);
    }

    const totalLevel = classes.reduce((sum, c) => sum + c.level, 0);
    const features = collectResolvedFeatures(race, classes, background, feats);
    const extraFeatures = collectChosenGrantedFeatures(character, classes, this.entities, race, background);
    features.push(...extraFeatures);

    // Primary caster slug (for bare-slug spells that don't name their class).
    // Caster-ness is now data-driven (resolveSpellcasting), preserving the
    // stripped class-ref slug used elsewhere for spell attribution.
    const primaryCasterSlug = classes
      .map((c, i) => (c.entity && resolveSpellcasting(c) ? stripSlug(character.class[i].name) : null))
      .find((slug): slug is string => slug != null) ?? null;

    const spells: ResolvedSpell[] = [];
    for (const raw of character.spells.known ?? []) {
      const n = normalizeKnownSpell(raw);
      const reg = this.entities.getByTypeAndSlug("spell", n.slug);
      if (!reg) {
        warnings.push(`Spell [[${n.slug}]] not found in compendium.`);
        continue;
      }
      const entity = reg.data as unknown as Spell;
      const isCantrip = (entity.level ?? 0) === 0;
      const classSlug = n.classSlug ?? primaryCasterSlug;
      const prep = isCantrip || n.alwaysPrepared ? true : (n.preparedFlag ?? false);
      spells.push({ entity, slug: n.slug, classSlug, source: n.source, prepared: prep, alwaysPrepared: n.alwaysPrepared });
    }

    const resolvedCharacter: ResolvedCharacter = {
      definition: character,
      race,
      classes,
      background,
      feats,
      totalLevel,
      features,
      spells,
      pools: [],
      state: character.state,
    };
    resolvedCharacter.pools = resolveAllPools(resolvedCharacter, this.entities);

    return { character: resolvedCharacter, warnings };
  }
}

/**
 * Walks class.choices for `feat` entries and adds background feat slugs.
 * Returns bare slugs (no `[[ ]]`).
 */
export function collectFeatSlugs(character: Character): string[] {
  const slugs = new Set<string>();
  for (const c of character.class) {
    for (const [, choiceBlock] of Object.entries(c.choices)) {
      const feat = (choiceBlock as { feat?: string })?.feat;
      if (typeof feat === "string") {
        const s = stripSlug(feat);
        if (s) slugs.add(s);
      }
    }
  }
  return [...slugs];
}

/** Selected select-entity values (optional-features) and selected inline
 *  options carrying effects[] become synthesized resolved features (SP2 Plan 3 §9).
 *  The actions/resources engines consume these synthesized features, and the
 *  effects-application pass (pc.feature-effects.ts → recalc) consumes their
 *  effects[]. Scope: class/subclass level choices, plus race/background origin
 *  choices (origin_choices keys are namespaced "race:<id>" / "background:<id>"). */
export function collectChosenGrantedFeatures(
  character: Character,
  classes: ResolvedClass[],
  registry: { getByTypeAndSlug(type: string, slug: string): { data: Record<string, unknown> } | undefined },
  race: RaceEntity | null = null,
  background: BackgroundEntity | null = null,
): ResolvedFeature[] {
  const out: ResolvedFeature[] = [];
  classes.forEach((c, i) => {
    if (!c.entity) return;
    const entity = c.entity;
    const entry = character.class[i];
    if (!entry) return;
    for (const [lvlStr, atLevel] of Object.entries(entry.choices)) {
      const lvl = Number(lvlStr);
      if (!Number.isFinite(lvl) || lvl > entry.level) continue;
      const features = (entity.features_by_level ?? {})[lvl] ?? [];
      const subFeatures = c.subclass ? ((c.subclass.features_by_level ?? {})[lvl] ?? []) : [];
      for (const feature of [...features, ...subFeatures]) {
        walkChoiceGrants(feature.choices, atLevel, (granted) => {
          out.push({ feature: granted, source: { kind: "class", slug: entity.slug, level: lvl } });
        }, registry);
      }
    }
  });

  // Origin (race/background) grants. origin_choices keys are "<ns>:<choiceId>";
  // strip the namespace so walkChoiceGrants can match on bare choice ids.
  const oc = character.origin_choices ?? {};
  const originAt = (ns: string): Record<string, unknown> => {
    const at: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(oc)) {
      if (key.startsWith(`${ns}:`)) at[key.slice(ns.length + 1)] = val;
    }
    return at;
  };
  if (race) {
    const atRace = originAt("race");
    const emitRace = (granted: Feature): void => {
      out.push({ feature: granted, source: { kind: "race", slug: race.slug } });
    };
    walkChoiceGrants(race.choices, atRace, emitRace, registry);
    for (const trait of race.traits ?? []) {
      walkChoiceGrants(trait.choices, atRace, emitRace, registry);
    }
  }
  if (background) {
    const atBg = originAt("background");
    const emitBg = (granted: Feature): void => {
      out.push({ feature: granted, source: { kind: "background", slug: background.slug } });
    };
    walkChoiceGrants(background.choices, atBg, emitBg, registry);
    if (background.feature) {
      walkChoiceGrants((background.feature as { choices?: Choice[] }).choices, atBg, emitBg, registry);
    }
  }
  return out;
}

function walkChoiceGrants(
  choices: Choice[] | undefined,
  atLevel: Record<string, unknown>,
  emit: (f: Feature) => void,
  registry: { getByTypeAndSlug(type: string, slug: string): { data: Record<string, unknown> } | undefined },
): void {
  for (const ch of choices ?? []) {
    const sel = atLevel[ch.id];
    if (ch.kind === "select-entity" && ch.entity_type === "optional-feature") {
      const slugs = Array.isArray(sel) ? sel : typeof sel === "string" ? [sel] : [];
      for (const slug of slugs) {
        const reg = registry.getByTypeAndSlug("optional-feature", stripSlug(String(slug)) ?? String(slug));
        if (!reg) continue;
        const d = reg.data as {
          name?: string; slug?: string; description?: string;
          effects?: unknown[]; action_cost?: string;
        };
        emit({
          id: d.slug ?? String(slug),
          name: d.name ?? String(slug),
          description: d.description,
          effects: d.effects as Feature["effects"],
          ...(d.action_cost ? { action: d.action_cost as Feature["action"] } : {}),
        });
      }
    }
    if (ch.kind === "select-inline") {
      const branch = typeof sel === "string" ? ch.options.find((o) => o.value === sel) : undefined;
      if (branch?.effects?.length) {
        emit({ id: `${ch.id}-${branch.value}`, name: branch.label, description: branch.description, effects: branch.effects });
      }
      if (branch?.choices) walkChoiceGrants(branch.choices, atLevel, emit, registry);
    }
  }
}

export function collectResolvedFeatures(
  race: RaceEntity | null,
  classes: ResolvedClass[],
  background: BackgroundEntity | null,
  feats: FeatEntity[],
): ResolvedFeature[] {
  const out: ResolvedFeature[] = [];

  for (const c of classes) {
    if (!c.entity) continue;
    const slug = c.entity.slug;
    const byLevel = c.entity.features_by_level ?? {};
    for (const [lvlStr, feats0] of Object.entries(byLevel)) {
      const lvl = parseInt(lvlStr, 10);
      if (Number.isNaN(lvl) || lvl > c.level) continue;
      for (const feat of feats0) {
        out.push({ feature: feat, source: { kind: "class", slug, level: lvl } satisfies FeatureSource });
      }
    }
    // Entity-level class resources (declared on the class, not on a feature) —
    // surfaced so the seed and rest see them like feature-level resources. The
    // `resources` array is shared with the registry entity (read-only
    // downstream), so no copy is needed.
    if (c.entity.resources?.length) {
      out.push({
        feature: { name: c.entity.name, resources: c.entity.resources },
        source: { kind: "class", slug, level: 1 } satisfies FeatureSource,
      });
    }
    if (c.subclass) {
      const sSlug = c.subclass.slug;
      const sByLevel = c.subclass.features_by_level ?? {};
      for (const [lvlStr, feats0] of Object.entries(sByLevel)) {
        const lvl = parseInt(lvlStr, 10);
        if (Number.isNaN(lvl) || lvl > c.level) continue;
        for (const feat of feats0) {
          out.push({ feature: feat, source: { kind: "subclass", slug: sSlug, level: lvl } satisfies FeatureSource });
        }
      }
      // Entity-level subclass resources.
      if (c.subclass.resources?.length) {
        out.push({
          feature: { name: c.subclass.name, resources: c.subclass.resources },
          source: { kind: "subclass", slug: sSlug, level: 1 } satisfies FeatureSource,
        });
      }
    }
  }

  if (race) {
    const traits = race.traits ?? [];
    for (const feat of traits) {
      out.push({ feature: feat, source: { kind: "race", slug: race.slug } });
    }
  }

  if (background) {
    const bgFeature = background.feature;
    if (bgFeature) {
      out.push({ feature: bgFeature, source: { kind: "background", slug: background.slug } });
    }
  }

  for (const feat of feats) {
    const bundled = (feat as unknown as { features?: Feature[] }).features ?? [];
    const entityEffects = feat.effects ?? [];
    if (bundled.length > 0) {
      bundled.forEach((f, i) => {
        // Entity-level feat effects ride the first bundled feature. Shallow
        // copy — registry entities are shared and must not be mutated.
        const feature = i === 0 && entityEffects.length > 0
          ? { ...f, effects: [...(f.effects ?? []), ...entityEffects] }
          : f;
        out.push({ feature, source: { kind: "feat", slug: feat.slug } });
      });
    } else {
      const name = feat.name ?? feat.slug;
      const description = feat.description ?? "";
      out.push({
        feature: {
          name,
          description,
          ...(feat.resources ? { resources: feat.resources } : {}),
          ...(entityEffects.length > 0 ? { effects: entityEffects } : {}),
        },
        source: { kind: "feat", slug: feat.slug },
      });
    }
  }

  return out;
}
