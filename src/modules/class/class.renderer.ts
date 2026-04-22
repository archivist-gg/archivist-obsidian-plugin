import type { ClassEntity } from "./class.types";
import type { RenderContext } from "../../core/module-api";

export function renderClassStub(el: HTMLElement, data: ClassEntity, _ctx: RenderContext): HTMLElement {
  const container = el.createDiv({ cls: "archivist-class-stub" });
  container.createEl("h2", { text: data.name });
  if (data.description) container.createEl("p", { text: data.description });

  const meta = container.createEl("dl", { cls: "archivist-class-meta" });
  meta.createEl("dt", { text: "Hit die" });
  meta.createEl("dd", { text: data.hit_die });
  meta.createEl("dt", { text: "Saving throws" });
  meta.createEl("dd", { text: data.saving_throws.map((a) => a.toUpperCase()).join(", ") });
  meta.createEl("dt", { text: "Subclass level" });
  meta.createEl("dd", { text: String(data.subclass_level) });

  const levels = Object.keys(data.features_by_level).map(Number).sort((a, b) => a - b);
  if (levels.length > 0) {
    container.createEl("h3", { text: "Features by level" });
    const list = container.createEl("ul");
    for (const lvl of levels) {
      const li = list.createEl("li");
      li.createEl("strong", { text: `Level ${lvl}: ` });
      const feats = data.features_by_level[lvl] ?? [];
      li.appendText(feats.map((f) => f.name).join(", "));
    }
  }
  return container;
}
