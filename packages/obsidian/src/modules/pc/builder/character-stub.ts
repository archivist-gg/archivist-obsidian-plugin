import * as yaml from "js-yaml";
import { slugify } from "../../../shared/entities/entity-vault-store";
import { characterSchema } from "../pc.schema";
import { characterToYaml } from "../pc.yaml-serializer";
import type { Character } from "../pc.types";

/** A schema-valid, class-less draft character to start a build from. */
export function buildDraftCharacter(name: string, edition: "2014" | "2024" = "2014"): Character {
  return characterSchema.parse({
    name: name.trim() || "Untitled",
    edition,
    // Mark the file a Builder draft (resumable until Finish removes the flag).
    builder: true,
    class: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    state: { hp: { current: 0, max: 0, temp: 0 } },
  });
}

/** The full markdown file body (frontmatter + ```pc block) for a new draft. */
export function buildDraftFileBody(name: string, edition: "2014" | "2024" = "2014"): string {
  const draft = buildDraftCharacter(name, edition);
  const frontmatter: Record<string, unknown> = {
    archivist: true,
    "archivist-type": "pc",
    slug: slugify(draft.name) || "untitled",
    name: draft.name,
    compendium: "Me",
  };
  const fm = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false });
  const body = characterToYaml(draft).trimEnd();
  return `---\n${fm}---\n\n\`\`\`pc\n${body}\n\`\`\`\n`;
}
