import type { SubclassEntity } from "./subclass.types";
import type { RenderContext } from "../../core/module-api";

export function renderSubclassStub(el: HTMLElement, data: SubclassEntity, _ctx: RenderContext): HTMLElement {
  const container = el.createDiv({ cls: "archivist-subclass-stub" });
  container.createEl("h2", { text: data.name });
  const parent = container.createEl("p", { cls: "archivist-subclass-parent" });
  parent.appendText("Parent class: ");
  parent.createEl("code", { text: data.parent_class });

  if (data.description) container.createEl("p", { text: data.description });

  const levels = Object.keys(data.features_by_level).map(Number).sort((a, b) => a - b);
  if (levels.length > 0) {
    container.createEl("h3", { text: "Features by level" });
    const ul = container.createEl("ul");
    for (const lvl of levels) {
      const li = ul.createEl("li");
      li.createEl("strong", { text: `Level ${lvl}: ` });
      li.appendText((data.features_by_level[lvl] ?? []).map((f) => f.name).join(", "));
    }
  }
  return container;
}
