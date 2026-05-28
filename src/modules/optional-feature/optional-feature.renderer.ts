import type { OptionalFeatureEntity, OptionalFeaturePrerequisite } from "./optional-feature.types";
import type { RenderContext } from "../../core/module-api";

function describePrerequisite(p: OptionalFeaturePrerequisite): string {
  switch (p.kind) {
    case "level":
      return `level ${p.min}`;
    case "spell-known":
      return `knows ${p.spell}`;
    case "pact":
      return `Pact of the ${p.pact.charAt(0).toUpperCase()}${p.pact.slice(1)}`;
    case "class":
      return `class: ${p.class}`;
    case "ability":
      return `${p.ability.toUpperCase()} ${p.min}+`;
    case "other":
      return p.detail;
  }
}

export function renderOptionalFeatureStub(
  el: HTMLElement,
  data: OptionalFeatureEntity,
  _ctx: RenderContext,
): HTMLElement {
  el.empty();
  const wrap = el.createDiv({ cls: "archivist-optional-feature" });
  wrap.createEl("h3", { text: data.name });
  wrap.createEl("p", { text: `${data.feature_type.replace("_", " ")} • ${data.source}` });
  wrap.createEl("p", { text: data.description });
  if (data.prerequisites.length > 0) {
    const prereqEl = wrap.createDiv({ cls: "archivist-optional-feature__prereqs" });
    prereqEl.createEl("strong", { text: "Prerequisite: " });
    prereqEl.appendText(data.prerequisites.map(describePrerequisite).join(", "));
  }
  return wrap;
}
