import type { RaceEntity } from "./race.types";
import type { RenderContext } from "../../core/module-api";

export function renderRaceStub(el: HTMLElement, data: RaceEntity, _ctx: RenderContext): HTMLElement {
  const container = el.createDiv({ cls: "archivist-race-stub" });
  container.createEl("h2", { text: data.name });
  if (data.description) container.createEl("p", { text: data.description });

  const meta = container.createEl("dl", { cls: "archivist-race-meta" });
  meta.createEl("dt", { text: "Size" });
  meta.createEl("dd", { text: data.size });
  meta.createEl("dt", { text: "Speed" });
  meta.createEl("dd", { text: `${data.speed.walk ?? 0} ft.` });
  if (data.vision.darkvision) {
    meta.createEl("dt", { text: "Darkvision" });
    meta.createEl("dd", { text: `${data.vision.darkvision} ft.` });
  }

  if (data.traits.length > 0) {
    container.createEl("h3", { text: "Traits" });
    const ul = container.createEl("ul");
    for (const trait of data.traits) {
      const li = ul.createEl("li");
      li.createEl("strong", { text: `${trait.name}: ` });
      li.appendText(trait.description ?? (trait.entries?.join(" ") ?? ""));
    }
  }
  return container;
}
