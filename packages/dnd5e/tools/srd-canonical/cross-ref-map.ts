const TAG_TO_FOLDER: Record<string, string> = {
  spell: "Spells",
  condition: "Conditions",
  creature: "Monsters",
  item: "Magic Items",
  feat: "Feats",
  class: "Classes",
  background: "Backgrounds",
  race: "Races",
  species: "Species",
};

function compendiumName(edition: "2014" | "2024"): string {
  return edition === "2014" ? "SRD 5e" : "SRD 2024";
}

function titleCase(s: string): string {
  return s.split(/[\s-]+/).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export function rewriteCrossRefs(text: string, edition: "2014" | "2024"): string {
  const compendium = compendiumName(edition);
  return text
    .replace(/\{@(?:damage|dice) ([^}]+)\}/g, "`d:$1`")
    .replace(/\{@hit (\d+)\}/g, "+$1")
    .replace(/\{@dc (\d+)\}/g, "DC $1")
    .replace(/\{@i ([^}]+)\}/g, "*$1*")
    .replace(/\{@b ([^}]+)\}/g, "**$1**")
    .replace(/\{@status ([^}]+)\}/g, "*$1*")
    .replace(/\{@(\w+) ([^|}]+)(?:\|[^}]+)?\}/g, (m, tag: string, body: string) => {
      const folder = TAG_TO_FOLDER[tag];
      if (!folder) return body;
      const slug = body.split("#")[0].trim();
      const display = slug;
      const target = `${compendium}/${folder}/${titleCase(slug)}`;
      return `[[${target}|${display}]]`;
    });
}
