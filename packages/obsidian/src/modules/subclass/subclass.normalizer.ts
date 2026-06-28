import type { SubclassEntity } from "./subclass.types";
import type { Feature } from "../../shared/types";
import type { Edition } from "../class/class.types";
import type { NormalizedEntity } from "../class/class.normalizer";
import { classSlugify } from "../class/class.normalizer";

export interface Open5eArchetypeJson {
  name: string;
  slug: string;
  desc?: string;
  document__slug?: string;
}

function parseArchetypeFeatures(desc: string | undefined): Record<number, Feature[]> {
  const features: Record<number, Feature[]> = {};
  if (!desc) return features;
  const sections = desc.split(/\n(?=#####\s)/);
  for (const section of sections) {
    const headerMatch = /^#####\s+(.+?)\s*\n/.exec(section);
    if (!headerMatch) continue;
    const name = headerMatch[1].trim();
    const body = section.substring(headerMatch[0].length).trim();
    const levelMatch = /(?:at|beginning at|starting at|by)\s+(\d+)(?:st|nd|rd|th)\s+level/i.exec(body);
    const level = levelMatch ? Number(levelMatch[1]) : 3;
    const feature: Feature = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name,
      description: body,
    };
    features[level] ??= [];
    features[level].push(feature);
  }
  return features;
}

export function normalizeSrdSubclass(
  input: Open5eArchetypeJson,
  opts: { parentClassName: string; edition?: Edition; compendium?: string },
): NormalizedEntity<SubclassEntity> {
  const edition = opts.edition ?? "2014";
  const compendium = opts.compendium ?? "SRD";
  const parentSlug = classSlugify(opts.parentClassName);

  const data: SubclassEntity = {
    slug: input.slug,
    name: input.name,
    parent_class: `[[${parentSlug}]]`,
    edition,
    source: "SRD 5.1",
    description: input.desc ?? "",
    features_by_level: parseArchetypeFeatures(input.desc),
    resources: [],
  };

  return {
    frontmatter: {
      archivist: true,
      entity_type: "subclass",
      slug: data.slug,
      name: data.name,
      compendium,
      source: data.source,
    },
    data,
  };
}
