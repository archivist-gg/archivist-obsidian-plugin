import type { SheetComponent, ComponentRenderContext } from "../components/component.types";
import type { RaceEntity } from "../../race/race.types";
import type { Feature } from "../../../shared/types";
import { renderTextWithInlineTags } from "../../../shared/rendering/renderer-utils";

export class RaceBlock implements SheetComponent {
  readonly type = "race-block";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const r = ctx.resolved.race;
    if (!r) return;
    const section = el.createDiv({ cls: "pc-block pc-race-block" });
    section.createEl("h3", { cls: "pc-block-title", text: ctx.resolved.definition.subrace ? `${prettify(ctx.resolved.definition.subrace)} ${r.name}` : r.name });
    if ((r as unknown as { description?: string }).description) {
      const descEl = section.createEl("p", { cls: "pc-block-description" });
      renderTextWithInlineTags((r as unknown as { description?: string }).description ?? "", descEl);
    }
    const meta = section.createDiv({ cls: "pc-block-meta" });
    const size = (r as unknown as { size?: string }).size;
    const speed = (r as unknown as { speed?: { walk?: number } }).speed?.walk;
    const dark = (r as unknown as { vision?: { darkvision?: number } }).vision?.darkvision;
    if (size) metaItem(meta, "Size", size);
    if (typeof speed === "number") metaItem(meta, "Speed", `${speed} ft.`);
    if (typeof dark === "number" && dark > 0) metaItem(meta, "Darkvision", `${dark} ft.`);

    const traits = mergeTraits(r, ctx.resolved.definition.subrace);
    if (traits.length > 0) {
      section.createEl("h4", { cls: "pc-block-subtitle", text: "Traits" });
      const list = section.createEl("ul", { cls: "pc-feature-list" });
      for (const t of traits) {
        const li = list.createEl("li", { cls: "pc-feature-item" });
        li.createEl("strong", { text: t.name });
        const desc = t.description ?? t.entries?.join(" ") ?? "";
        if (desc) {
          const descEl = li.createDiv({ cls: "pc-feature-desc" });
          renderTextWithInlineTags(desc, descEl);
        }
      }
    }
  }
}

function mergeTraits(r: RaceEntity, subraceSlug: string | null): Feature[] {
  const base = ((r as unknown) as { traits?: Feature[] }).traits ?? [];
  if (!subraceSlug) return base;
  const subraces = ((r as unknown) as { subraces?: Array<{ slug: string; traits?: Feature[] }> }).subraces ?? [];
  const cleanSub = subraceSlug.replace(/\[\[|\]\]/g, "");
  const match = subraces.find((s) => s.slug === cleanSub);
  return [...base, ...(match?.traits ?? [])];
}

function metaItem(parent: HTMLElement, label: string, value: string) {
  const line = parent.createDiv({ cls: "pc-meta-line" });
  line.createSpan({ cls: "pc-meta-label", text: `${label}: ` });
  line.createSpan({ cls: "pc-meta-val", text: value });
}

function prettify(slug: string): string {
  return slug.replace(/\[\[|\]\]/g, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
