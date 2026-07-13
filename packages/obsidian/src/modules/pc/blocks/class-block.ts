import type { SheetComponent, ComponentRenderContext } from "../components/component.types";
import type { ClassEntity } from "@archivist-gg/dnd5e/class/class.types";
import type { ResolvedClass } from "@archivist-gg/dnd5e/pc/pc.types";
import { renderTextWithInlineTags } from "../../../shared/rendering/renderer-utils";
import { resolveFeatureDescription } from "./feature-card";

export class ClassBlock implements SheetComponent {
  readonly type = "class-block";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    for (const rc of ctx.resolved.classes) {
      if (!rc.entity) continue;
      this.renderSingleClass(el, rc);
    }
  }

  private renderSingleClass(el: HTMLElement, rc: ResolvedClass) {
    const e = rc.entity as ClassEntity;
    const section = el.createDiv({ cls: "pc-block pc-class-block" });
    section.createEl("h3", { cls: "pc-block-title", text: `${e.name} — Level ${rc.level}` });

    const meta = section.createDiv({ cls: "pc-block-meta" });
    metaItem(meta, "Hit Die", e.hit_die);
    metaItem(meta, "Saves", (e.saving_throws ?? []).map((s) => s.toUpperCase()).join(", ") || "—");
    if (e.primary_abilities?.length) metaItem(meta, "Primary", e.primary_abilities.map((a) => a.toUpperCase()).join(", "));

    const byLevel = e.features_by_level ?? {};
    const relevantLevels = Object.keys(byLevel).map(Number).filter((n) => !Number.isNaN(n) && n <= rc.level).sort((a, b) => a - b);
    if (relevantLevels.length === 0) return;

    section.createEl("h4", { cls: "pc-block-subtitle", text: "Features" });
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

function metaItem(parent: HTMLElement, label: string, value: string) {
  const line = parent.createDiv({ cls: "pc-meta-line" });
  line.createSpan({ cls: "pc-meta-label", text: `${label}: ` });
  line.createSpan({ cls: "pc-meta-val", text: value });
}
