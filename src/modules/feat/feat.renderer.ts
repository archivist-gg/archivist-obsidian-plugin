import type { FeatEntity } from "./feat.types";
import type { RenderContext } from "../../core/module-api";

export function renderFeatStub(el: HTMLElement, data: FeatEntity, _ctx: RenderContext): HTMLElement {
  const container = el.createDiv({ cls: "archivist-feat-stub" });
  container.createEl("h2", { text: data.name });
  container.createEl("p", { cls: "archivist-feat-category", text: `Category: ${data.category}` });
  if (data.description) container.createEl("p", { text: data.description });

  if (data.prerequisites.length > 0) {
    const p = container.createEl("p");
    p.createEl("strong", { text: "Prerequisites: " });
    p.appendText(data.prerequisites.map((pr) => JSON.stringify(pr)).join("; "));
  }

  if (data.benefits.length > 0) {
    container.createEl("h3", { text: "Benefits" });
    const ul = container.createEl("ul");
    for (const b of data.benefits) ul.createEl("li", { text: b });
  }
  return container;
}
