import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { rewriteCrossRefs } from "./cross-ref-map";

const KIND_TO_FOLDER: Record<string, string> = {
  feat: "Feats",
  race: "Races",
  species: "Species",
  class: "Classes",
  subclass: "Subclasses",
  background: "Backgrounds",
  weapon: "Weapons",
  armor: "Armor",
  item: "Magic Items",
  magicitem: "Magic Items",
  spell: "Spells",
  monster: "Monsters",
  creature: "Monsters",
  condition: "Conditions",
  "optional-feature": "OptionalFeatures",
};

const KIND_TO_CODE_BLOCK: Record<string, string> = {
  feat: "feat",
  race: "race",
  species: "race",
  class: "class",
  subclass: "subclass",
  background: "background",
  weapon: "weapon",
  armor: "armor",
  item: "item",
  magicitem: "item",
  spell: "spell",
  monster: "monster",
  creature: "monster",
  condition: "condition",
  "optional-feature": "optional-feature",
};

const INVALID_FILENAME = /[/:*?"<>|\\]/g;

export interface WriteMdInput {
  kind: string;
  edition: "2014" | "2024";
  compendium: string;
  data: Record<string, unknown> & { name: string; slug: string };
}

export function writeMd(rootDir: string, input: WriteMdInput): void {
  const folder = KIND_TO_FOLDER[input.kind];
  const codeBlock = KIND_TO_CODE_BLOCK[input.kind];
  if (!folder || !codeBlock) throw new Error(`Unknown kind: ${input.kind}`);

  const dir = path.join(rootDir, folder);
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `${input.data.name.replace(INVALID_FILENAME, "_")}.md`;
  const filePath = path.join(dir, fileName);

  const dataRewritten = rewriteAllStringFields(input.data, input.edition);

  const frontmatter = {
    archivist: true,
    entity_type: input.kind,
    slug: input.data.slug,
    name: input.data.name,
    compendium: input.compendium,
    source: input.data.source ?? (input.edition === "2014" ? "SRD 5.1" : "SRD 5.2"),
    archivist_compendium_imported_at: new Date().toISOString(),
  };

  const fmYaml = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true }).trimEnd();
  const bodyYaml = yaml.dump(dataRewritten, { lineWidth: -1, noRefs: true }).trimEnd();

  const md = `---\n${fmYaml}\n---\n\n\`\`\`${codeBlock}\n${bodyYaml}\n\`\`\`\n`;
  fs.writeFileSync(filePath, md, "utf8");
}

function rewriteAllStringFields(obj: unknown, edition: "2014" | "2024"): unknown {
  if (typeof obj === "string") return rewriteCrossRefs(obj, edition);
  if (Array.isArray(obj)) return obj.map(x => rewriteAllStringFields(x, edition));
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = rewriteAllStringFields(v, edition);
    return out;
  }
  return obj;
}
