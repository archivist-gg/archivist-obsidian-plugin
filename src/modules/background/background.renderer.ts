import type { BackgroundEntity } from "./background.types";
import type { RenderContext } from "../../core/module-api";

export function renderBackgroundStub(el: HTMLElement, data: BackgroundEntity, _ctx: RenderContext): HTMLElement {
  const container = el.createDiv({ cls: "archivist-background-stub" });
  container.createEl("h2", { text: data.name });
  if (data.description) container.createEl("p", { text: data.description });

  if (data.skill_proficiencies.length > 0) {
    const skills = container.createEl("p");
    skills.createEl("strong", { text: "Skill proficiencies: " });
    skills.appendText(data.skill_proficiencies.join(", "));
  }

  const featureBlock = container.createEl("div", { cls: "archivist-background-feature" });
  featureBlock.createEl("h3", { text: data.feature.name });
  featureBlock.createEl("p", { text: data.feature.description });
  return container;
}
