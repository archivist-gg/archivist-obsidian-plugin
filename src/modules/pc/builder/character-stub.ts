import { characterSchema } from "../pc.schema";
import { characterToYaml } from "../pc.yaml-serializer";
import type { Character } from "../pc.types";

/** Slugify a name for the frontmatter `slug` field. */
function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

/** A schema-valid, class-less draft character to start a build from. */
export function buildDraftCharacter(name: string, edition: "2014" | "2024" = "2014"): Character {
  return characterSchema.parse({
    name: name.trim() || "Untitled",
    edition,
    class: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    state: { hp: { current: 0, max: 0, temp: 0 } },
  }) as Character;
}

/** The full markdown file body (frontmatter + ```pc block) for a new draft. */
export function buildDraftFileBody(name: string, edition: "2014" | "2024" = "2014"): string {
  const draft = buildDraftCharacter(name, edition);
  const yaml = characterToYaml(draft);
  const display = name.trim() || "Untitled";
  return [
    "---",
    "archivist: true",
    "archivist-type: pc",
    `slug: ${slugify(display)}`,
    `name: ${display}`,
    "compendium: Me",
    "---",
    "",
    "```pc",
    yaml.trimEnd(),
    "```",
    "",
  ].join("\n");
}
