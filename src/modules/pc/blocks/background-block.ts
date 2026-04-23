import type { SheetComponent, ComponentRenderContext } from "../components/component.types";

export class BackgroundBlock implements SheetComponent {
  readonly type = "background-block";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const b = ctx.resolved.background;
    if (!b) return;
    const section = el.createDiv({ cls: "pc-block pc-background-block" });
    section.createEl("h3", { cls: "pc-block-title", text: b.name });
    if ((b as unknown as { description?: string }).description) {
      section.createEl("p", { cls: "pc-block-description", text: (b as unknown as { description?: string }).description ?? "" });
    }
    const prof = (b as unknown as { proficiencies?: { skills?: string[]; tools?: string[]; languages?: string[] } }).proficiencies;
    if (prof) {
      const meta = section.createDiv({ cls: "pc-block-meta" });
      if (prof.skills?.length) metaItem(meta, "Skills", prof.skills.map(prettify).join(", "));
      if (prof.tools?.length) metaItem(meta, "Tools", prof.tools.map(prettify).join(", "));
      if (prof.languages?.length) metaItem(meta, "Languages", prof.languages.map(prettify).join(", "));
    }
    const feature = (b as unknown as { feature?: { name: string; description?: string } }).feature;
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
