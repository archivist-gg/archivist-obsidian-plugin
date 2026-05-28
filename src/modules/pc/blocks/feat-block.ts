import type { SheetComponent, ComponentRenderContext } from "../components/component.types";
import { renderTextWithInlineTags } from "../../../shared/rendering/renderer-utils";

export class FeatBlock implements SheetComponent {
  readonly type = "feat-block";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    if (ctx.resolved.feats.length === 0) return;
    for (const f of ctx.resolved.feats) {
      const section = el.createDiv({ cls: "pc-block pc-feat-block" });
      section.createEl("h3", { cls: "pc-block-title", text: f.name });
      const description = (f as unknown as { description?: string }).description;
      if (description) {
        const descEl = section.createEl("p", { cls: "pc-block-description" });
        renderTextWithInlineTags(description, descEl);
      }
      const prereqs = (f as unknown as { prerequisites?: string[] }).prerequisites;
      if (prereqs?.length) {
        section.createDiv({ cls: "pc-feat-prereq", text: `Prerequisites: ${prereqs.join(", ")}` });
      }
    }
  }
}
