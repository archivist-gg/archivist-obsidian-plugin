import type { EntityRegistry } from "../../shared/entities/entity-registry";
import type { ClassEntity } from "../class/class.types";
import type { RaceEntity } from "../race/race.types";
import type { SubclassEntity } from "../subclass/subclass.types";
import type { BackgroundEntity } from "../background/background.types";
import type { FeatEntity } from "../feat/feat.types";
import type { Feature } from "../../shared/types";
import type {
  Character,
  ResolvedCharacter,
  ResolvedClass,
  ResolvedFeature,
  FeatureSource,
} from "./pc.types";

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

  resolve(character: Character): ResolveResult {
    const warnings: string[] = [];

    const lookup = <T>(rawRef: string | null, type: string): T | null => {
      const slug = stripSlug(rawRef);
      if (!slug) return null;
      const reg = this.entities.getBySlug(slug);
      if (!reg) {
        warnings.push(`Slug [[${slug}]] not found in compendium.`);
        return null;
      }
      if (reg.entityType !== type) {
        warnings.push(`Slug [[${slug}]] is registered as ${reg.entityType}, not ${type}.`);
        return null;
      }
      return reg.data as T;
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

    return {
      character: {
        definition: character,
        race,
        classes,
        background,
        feats,
        totalLevel,
        features,
        state: character.state,
      },
      warnings,
    };
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
    if (bundled.length > 0) {
      for (const f of bundled) out.push({ feature: f, source: { kind: "feat", slug: feat.slug } });
    } else {
      const name = feat.name ?? feat.slug;
      const description = feat.description ?? "";
      out.push({ feature: { name, description }, source: { kind: "feat", slug: feat.slug } });
    }
  }

  return out;
}
