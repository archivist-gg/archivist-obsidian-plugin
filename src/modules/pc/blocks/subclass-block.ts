import type { SheetComponent, ComponentRenderContext } from "../components/component.types";
import type { Feature } from "../../../shared/types";
import { resolveFeatureDescription } from "./class-block";
import { renderTextWithInlineTags } from "../../../shared/rendering/renderer-utils";

export class SubclassBlock implements SheetComponent {
  readonly type = "subclass-block";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    for (const rc of ctx.resolved.classes) {
      if (!rc.subclass) continue;
      const s = rc.subclass;
      const section = el.createDiv({ cls: "pc-block pc-subclass-block" });
      section.createEl("h3", { cls: "pc-block-title", text: s.name });
      if ((s as unknown as { description?: string }).description) {
        const descEl = section.createEl("p", { cls: "pc-block-description" });
        renderTextWithInlineTags((s as unknown as { description?: string }).description ?? "", descEl);
      }
      const byLevel = ((s as unknown) as { features_by_level?: Record<number, Feature[]> }).features_by_level ?? {};
      const relevantLevels = Object.keys(byLevel).map(Number).filter((n) => !Number.isNaN(n) && n <= rc.level).sort((a, b) => a - b);
      if (relevantLevels.length === 0) continue;
      const list = section.createEl("ul", { cls: "pc-feature-list" });
      for (const lvl of relevantLevels) {
        for (const feat of byLevel[lvl] ?? []) {
          const li = list.createEl("li", { cls: "pc-feature-item" });
          li.createEl("strong", { text: `Level ${lvl} — ${feat.name}` });
          const desc = resolveFeatureDescription(feat, rc.choices[lvl]);
          if (desc) {
            const descEl = li.createDiv({ cls: "pc-feature-desc" });
            renderTextWithInlineTags(desc, descEl);
          }
        }
      }
    }
  }
}
