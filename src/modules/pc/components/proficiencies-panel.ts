import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedCharacter } from "../pc.types";

export class ProficienciesPanel implements SheetComponent {
  readonly type = "proficiencies-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const section = el.createDiv({ cls: "pc-sidebar-section pc-proficiencies" });
    section.createDiv({ cls: "pc-sidebar-title", text: "Proficiencies" });
    const body = section.createDiv({ cls: "pc-prof-body" });
    const agg = aggregateProficiencies(ctx.resolved);

    const labelFor = (label: string, items: string[]) => {
      const p = body.createDiv({ cls: "pc-prof-line" });
      p.createSpan({ cls: "pc-prof-key", text: `${label}: ` });
      p.createSpan({ cls: "pc-prof-vals", text: items.length ? items.join(", ") : "—" });
    };
    labelFor("Armor", agg.armor);
    labelFor("Weapons", agg.weapons);
    labelFor("Tools", agg.tools);
    labelFor("Languages", agg.languages);
  }
}

export interface ProficiencyAggregate {
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
}

export function aggregateProficiencies(resolved: ResolvedCharacter): ProficiencyAggregate {
  const armor = new Set<string>();
  const weapons = new Set<string>();
  const tools = new Set<string>();
  const languages = new Set<string>();

  for (const c of resolved.classes) {
    const prof = c.entity?.proficiencies;
    if (!prof) continue;
    for (const a of prof.armor ?? []) armor.add(prettyName(a));
    if (prof.weapons?.fixed) for (const w of prof.weapons.fixed) weapons.add(prettyName(w));
    if (prof.weapons?.categories) for (const w of prof.weapons.categories) weapons.add(prettyName(w));
    if (prof.tools?.fixed) for (const t of prof.tools.fixed) tools.add(prettyName(t));
  }

  const raceLangs = resolved.race?.languages;
  if (raceLangs?.fixed) for (const l of raceLangs.fixed) languages.add(prettyName(l));

  const bg = resolved.background;
  if (bg) {
    for (const entry of bg.tool_proficiencies ?? []) {
      if (entry.kind === "fixed") for (const t of entry.items) tools.add(prettyName(t));
    }
    for (const entry of bg.language_proficiencies ?? []) {
      if (entry.kind === "fixed") for (const l of entry.languages) languages.add(prettyName(l));
    }
  }

  // Feat-level proficiency grants (opaque flag on feat entity).
  for (const f of resolved.feats) {
    const grants = (f as unknown as {
      proficiencies?: { armor?: string[]; weapons?: string[]; tools?: string[]; languages?: string[] };
    }).proficiencies;
    if (!grants) continue;
    for (const a of grants.armor ?? []) armor.add(prettyName(a));
    for (const w of grants.weapons ?? []) weapons.add(prettyName(w));
    for (const t of grants.tools ?? []) tools.add(prettyName(t));
    for (const l of grants.languages ?? []) languages.add(prettyName(l));
  }

  return {
    armor: [...armor].sort(),
    weapons: [...weapons].sort(),
    tools: [...tools].sort(),
    languages: [...languages].sort(),
  };
}

function prettyName(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
