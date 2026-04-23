import type { SheetComponent, ComponentRenderContext } from "../components/component.types";

export class BackgroundBlock implements SheetComponent {
  readonly type = "background-block";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const b = ctx.resolved.background;
    if (!b) return;
    const section = el.createDiv({ cls: "pc-block pc-background-block" });
    section.createEl("h3", { cls: "pc-block-title", text: b.name });
    if (b.description) {
      section.createEl("p", { cls: "pc-block-description", text: b.description });
    }
    const skills = b.skill_proficiencies ?? [];
    const tools: string[] = [];
    for (const entry of b.tool_proficiencies ?? []) {
      if (entry.kind === "fixed") tools.push(...entry.items);
    }
    const languages: string[] = [];
    for (const entry of b.language_proficiencies ?? []) {
      if (entry.kind === "fixed") languages.push(...entry.languages);
    }
    if (skills.length || tools.length || languages.length) {
      const meta = section.createDiv({ cls: "pc-block-meta" });
      if (skills.length) metaItem(meta, "Skills", skills.map(prettify).join(", "));
      if (tools.length) metaItem(meta, "Tools", tools.map(prettify).join(", "));
      if (languages.length) metaItem(meta, "Languages", languages.map(prettify).join(", "));
    }
    const feature = b.feature;
    if (feature) {
      section.createEl("h4", { cls: "pc-block-subtitle", text: feature.name });
      if (feature.description) section.createEl("p", { cls: "pc-feature-desc", text: feature.description });
    }
  }
}


function metaItem(parent: HTMLElement, label: string, value: string) {
  const line = parent.createDiv({ cls: "pc-meta-line" });
  line.createSpan({ cls: "pc-meta-label", text: `${label}: ` });
  line.createSpan({ cls: "pc-meta-val", text: value });
}

function prettify(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
